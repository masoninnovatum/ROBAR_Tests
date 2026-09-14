// Row-level action: View/Edit Template (TM_ViewEditTemplates-1.7).
//
// Live-confirmed (2026-09-14) via direct MCP browser exploration before writing this test rather
// than guessing selectors -- see robar-module-reference.md's "Template Management" section.
// Source-grounded against Innovatum.Pages.TemplateManagement.MVC's Management.cshtml: the
// "View/Edit Template" row action (raViewEditTemplate) is wired directly to `openFile(fileId)` --
// unlike Replace Template/Save As New, there's no intermediate dialog or file picker at all, so no
// row-scoping is needed here (nothing statically-declared to collide with) and it goes straight to
// the same GetFileToken -> Sentinel -> BarTender launch sequence Create New Template uses. Confirmed
// live via network trace: clicking it fires GetFileToken directly, with no CheckForOpenFile-style
// gate call beforehand (unlike Replace Template's loadReplaceTemplateDialog).
//
// TM_ViewEditTemplates-1.7's own script covers a lot more than this test does -- approval-state-
// driven button disabling (Save/Save As/Approve/Restore enabled or disabled depending on whether the
// template is approved and whether the user has TM_Edit_Templates), the "Save any changes made to
// this template to ROBAR?" Yes/No/Cancel prompt when closing with unsaved changes, and multi-user/
// multi-workstation file-locking ("locked for editing by", "Take Control", Override Staging Lock).
// None of that is exercised here -- this test only proves the basic, single-user path: open an
// EXISTING (not newly-created-in-this-step) template via View/Edit Template, modify it, Save, Close
// Tab cleanly (no unsaved-changes prompt expected, since Save already ran -- same assumption
// tests/support/bartender.ts's closeTemplateEditor already relies on elsewhere), and confirm the
// change actually persisted server-side. The unsaved-changes prompt in particular is a real gap
// (bartender.ts's closeTemplateEditor doc comment already flags it as unconfirmed/unhandled) that
// would need its own live-exploration pass to drive reliably via FlaUI, not a small addition to
// bolt on here.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as bartender from '../support/bartender';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find.
test.use({ headless: false });

test('view/edit template opens an existing template and persists a change made to it', async ({ page }) => {
  // Generous budget: BarTender launch-and-close for the initial create, then again via View/Edit
  // Template, plus a final View Label Characteristics check.
  test.setTimeout(600_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBViewEditTest' + Math.floor(Math.random() * 100000);
  const sharename = 'I_Num';

  await test.step('create a throwaway template, unmodified, to view/edit afterward', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', 'Created via automated Playwright test (View/Edit Template)');
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

    // Deliberately left blank/unmodified here -- the point of this test is exercising View/Edit
    // Template's own launch-and-edit path afterward, not this initial creation step.
    const bartenderPid = await bartender.launchTemplateEditor(page);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  await test.step('query for the template and open it via View/Edit Template', async () => {
    await frame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
    // Confirmed live: this page's CriteriaFilter widget instance is named "dvFilters" (unlike
    // Campaign Manager's instance) -- field names are "dvFilters[0].Column" etc.
    await frame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName');
    await frame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches');
    await frame.fill('input[name="dvFilters[0].Value"]', templateName);

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/TemplateManagement/GridSessionStart') &&
          r.request().method() === 'POST' &&
          (r.request().postData() || '').includes(templateName),
        { timeout: 15_000 }
      ),
      frame.click('#btnRetrieveData'),
    ]);

    const row = frame.locator('#grdJqGrid tr').filter({ hasText: templateName });
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.getByText('Actions', { exact: true }).click();
    // Standing convention for Template Management row/bulk actions: give the dropMenu popup a
    // moment to finish rendering before the next click, rather than racing it.
    await page.waitForTimeout(500);

    // Unlike Edit Attributes/Replace Template/Save As New, "View/Edit Template" isn't a
    // statically-declared knockout dialog at all -- it's wired straight to `openFile(fileId)`, with
    // nothing pre-existing in the DOM for an unscoped text match to collide with. Frame-wide is fine.
    const [tokenResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      frame.getByText('View/Edit Template', { exact: true }).click(),
    ]);
    const tokenBody = await tokenResponse.json();
    expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();
  });

  await test.step('modify the template in BarTender and save', async () => {
    const bartenderPid = await bartender.launchTemplateEditor(page);
    await bartender.addTextObjectBoundToSharename(page, bartenderPid, sharename);
    await bartender.saveTemplate(page, bartenderPid);
    // Confirmed live in an earlier debugging session that a template closed right after a clean
    // Save doesn't show the "Save any changes...?" prompt -- same assumption closeTemplateEditor
    // itself already relies on for every other test that reaches this point.
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  await test.step('confirms the edit persisted via View Label Characteristics', async () => {
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/TemplateManagement/GridSessionStart') &&
          r.request().method() === 'POST' &&
          (r.request().postData() || '').includes(templateName),
        { timeout: 15_000 }
      ),
      frame.click('#btnRetrieveData'),
    ]);

    const row = frame.locator('#grdJqGrid tr').filter({ hasText: templateName });
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    // Dynamically-built dialog, no row-scoping collision -- matches View_Label_Characteristics.spec.ts.
    await frame.getByText('View Label Characteristics', { exact: true }).click();
    await page.waitForTimeout(500);

    const labelCharsDialog = frame.locator('#labelCharsDialog');
    await expect(labelCharsDialog).toBeVisible();
    await expect(labelCharsDialog).toContainText(templateName);
    await expect(labelCharsDialog).toContainText(sharename);

    await frame.click('#btnViewLabelCharsClose');
    await expect(labelCharsDialog).toBeHidden();
  });
});
