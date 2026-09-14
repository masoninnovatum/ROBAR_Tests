// Row-level action: Save As New (TM_SaveAsNew-1.9).
//
// Live-confirmed (2026-09-14) via direct MCP browser exploration before writing this test (opened
// the dialog against a real unapproved throwaway template and tried both validation failures)
// rather than guessing selectors -- see robar-module-reference.md's "Template Management" section.
// Source-grounded against Innovatum.Pages.TemplateManagement.MVC's Management.cshtml
// (saveAsNewDialogOptions, submitSaveAsNew/validateSaveAsNew, and the knockout view model's
// isNewVersionDisabled computed) and TemplateManagementModel.js.
//
// This test only exercises the "New Template/Label Type" path (the one available for an unapproved
// source template -- see the comment above the dialog assertion below for why). TM_SaveAsNew-1.9's
// "New Version" path (creating TMPNAME_v1 from an approved source, opened in the same tab) is not
// covered here -- that would need an approved template first, which is a materially different setup
// than every other row-action test in this suite (all of which deliberately use a throwaway
// unapproved template so the row action under test isn't blocked by approval state).

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as bartender from '../support/bartender';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find.
test.use({ headless: false });

test('save as new creates an independent copy of the template under a new name', async ({ page }) => {
  // Generous budget: BarTender launch-and-close for the initial create, then again after Save As
  // New's own GetFileToken/launchEditor sequence, plus a final View Label Characteristics check.
  test.setTimeout(600_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const sourceTemplateName = 'MBSaveAsNewSrc' + Math.floor(Math.random() * 100000);
  const newTemplateName = 'MBSaveAsNewCopy' + Math.floor(Math.random() * 100000);
  const sharename = 'I_Num';

  await test.step('create a throwaway source template with a known sharename', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', sourceTemplateName);
    await frame.fill('#txtDescription', 'Created via automated Playwright test (Save As New source)');
    await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    await frame.setInputFiles('#newFileInput', String.raw`\\vmsrvtst703\BaseTemplates\NewTemplate.btw`);
    await page.waitForTimeout(500);

    const [createResponse, tokenResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      frame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
    ]);
    const createBody = await createResponse.json();
    const tokenBody = await tokenResponse.json();
    expect(createBody.Success, `CreateNewTemplate failed: ${JSON.stringify(createBody)}`).toBe(true);
    expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();

    // Bind a real sharename to this source template -- the point of this test is to prove Save As
    // New's copy is an independent template with its own real content, not an empty shell, so the
    // source needs actual content to carry over (same technique View_Label_Characteristics.spec.ts
    // uses to prove Create's own pipeline).
    const bartenderPid = await bartender.launchTemplateEditor(page);
    await bartender.addTextObjectBoundToSharename(page, bartenderPid, sharename);
    await bartender.saveTemplate(page, bartenderPid);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  async function queryForTemplate(name: string) {
    await frame.fill('input[name="dvFilters[0].Value"]', name);
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/TemplateManagement/GridSessionStart') &&
          r.request().method() === 'POST' &&
          (r.request().postData() || '').includes(name),
        { timeout: 15_000 }
      ),
      frame.click('#btnRetrieveData'),
    ]);
    const row = frame.locator('#grdJqGrid tr').filter({ hasText: name });
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    return row;
  }

  await test.step('query for the source template and open Save As New', async () => {
    await frame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
    // Confirmed live: this page's CriteriaFilter widget instance is named "dvFilters" (unlike
    // Campaign Manager's instance) -- field names are "dvFilters[0].Column" etc.
    await frame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName');
    await frame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches');

    const row = await queryForTemplate(sourceTemplateName);
    await row.getByText('Actions', { exact: true }).click();
    // Standing convention for Template Management row/bulk actions: give the dropMenu popup a
    // moment to finish rendering before the next click, rather than racing it.
    await page.waitForTimeout(500);
    // Scoped to the row, not `frame` -- Save As New is a statically-declared knockout-bound dialog
    // (like Edit Attributes/Create/Replace Template), so its own hidden .ui-dialog-title already
    // exists in the DOM from page load and collides with the row's menu link under an unscoped
    // frame-wide text match. See Edit_Attributes.spec.ts's comment on this same gotcha.
    await row.getByText('Save As New', { exact: true }).click();
    await page.waitForTimeout(500);
  });

  const dialog = frame.locator('#saveAsNewDialog');
  const templateNameInput = dialog.locator('#txtSaveAsTemplateName');
  const descriptionInput = dialog.locator('#txtSaveAsDescription');
  const labelTypeSelect = dialog.locator('#ddlSaveAsLabelType');
  // Submit/Cancel are jQuery UI dialog `buttons:` entries -- rendered into a `.ui-dialog-buttonpane`
  // that's a sibling of #saveAsNewDialog, not a descendant of it (same pattern as Edit Attributes'
  // and Replace Template's Submit buttons), so located unscoped via `frame`.
  const submitButton = frame.locator('#btnSaveAsNewSubmit');

  await test.step('New Version is disabled and New Template/Label Type is selected for an unapproved source', async () => {
    // Confirmed live and via source (TemplateManagementModel.js's isNewVersionDisabled computed:
    // `!data.isApproved || !data.isLatest`): "New Version" is only available from an approved,
    // latest-version source -- our throwaway source is unapproved, so it's disabled and the dialog
    // defaults to "New Template/Label Type" instead, matching TM_SaveAsNew-1.9's own script.
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#rbNewVersion')).toBeDisabled();
    await expect(dialog.locator('#rbNewTemplate')).toBeChecked();
    await expect(templateNameInput).toBeVisible();
    await expect(descriptionInput).toBeVisible();
    await expect(labelTypeSelect).toBeVisible();
  });

  await test.step('rejects a submission with all fields left blank', async () => {
    await submitButton.click();
    await page.waitForTimeout(500);

    // Confirmed live: this is a single consolidated message (not per-field) for the all-blank case,
    // and validateSaveAsNew() blocks the SaveAsNew POST entirely -- client-side only.
    const consolidatedError = frame.locator('#saveAsNewValidationErrorDiv');
    await expect(consolidatedError).toContainText('Template Name, Description and Label Type are required fields and cannot be left blank');
    await expect(dialog).toBeVisible();
  });

  await test.step('rejects a duplicate template name', async () => {
    await templateNameInput.fill(sourceTemplateName);
    await descriptionInput.fill('Testing duplicate name validation');
    await labelTypeSelect.selectOption({ label: 'Carton Label' });
    await submitButton.click();
    await page.waitForTimeout(500);

    // Confirmed live: unlike the blank-fields case, this is an inline per-field validation message
    // next to #txtSaveAsTemplateName (a live/async uniqueness check), not the consolidated
    // #saveAsNewValidationErrorDiv -- and it also blocks submission client-side, so no SaveAsNew
    // POST fires and the dialog stays open, same as the blank-fields case.
    await expect(dialog).toContainText('Template Name already exists.');
    await expect(dialog).toBeVisible();
  });

  await test.step('submits a valid, unique name and confirms the new template opens in BarTender', async () => {
    await templateNameInput.fill(newTemplateName);
    await descriptionInput.fill('Created via automated Playwright test (Save As New copy)');
    await labelTypeSelect.selectOption({ label: 'Carton Label' });

    const [saveAsNewResponse, tokenResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/SaveAsNew'), { timeout: 15_000 }),
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      submitButton.click(),
    ]);
    const saveAsNewBody = await saveAsNewResponse.json();
    const tokenBody = await tokenResponse.json();
    expect(saveAsNewBody.Success, `SaveAsNew failed: ${JSON.stringify(saveAsNewBody)}`).toBe(true);
    expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();

    // Same GetFileToken -> Sentinel -> BarTender launch sequence as Create New Template. The new
    // template is a copy of the source's content (which already has "I_Num" bound to it), so just
    // save and close as-is -- no need to add anything new (and adding "I_Num" again would hit the
    // same "data source name already exists" collision Replace_Template.spec.ts ran into).
    const bartenderPid = await bartender.launchTemplateEditor(page);
    await bartender.saveTemplate(page, bartenderPid);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  await test.step('confirms the new template is independent and carries the source content', async () => {
    const row = await queryForTemplate(newTemplateName);
    await row.getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    // View Label Characteristics builds its dialog markup fresh via AJAX on each click, so it
    // doesn't have the pre-existing-hidden-dialog collision Save As New's own row action does -- an
    // unscoped frame-wide text match is fine here, matching View_Label_Characteristics.spec.ts.
    await frame.getByText('View Label Characteristics', { exact: true }).click();
    await page.waitForTimeout(500);

    const labelCharsDialog = frame.locator('#labelCharsDialog');
    await expect(labelCharsDialog).toBeVisible();
    await expect(labelCharsDialog).toContainText(newTemplateName);
    await expect(labelCharsDialog).toContainText(sharename);

    await frame.click('#btnViewLabelCharsClose');
    await expect(labelCharsDialog).toBeHidden();
  });
});
