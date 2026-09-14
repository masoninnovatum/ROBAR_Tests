// Row-level action: Replace Template (TM_Replace-1.12).
//
// Live-confirmed (2026-09-14) via direct MCP browser exploration before writing this test (opened
// the dialog against a real unapproved throwaway template, tried both a wrong-type file and a real
// .btw, and inspected the confirmation dialog) rather than guessing selectors -- see
// robar-module-reference.md's "Template Management" section. Source-grounded against
// Innovatum.Pages.TemplateManagement.MVC's Management.cshtml (replaceTemplateDialogOptions,
// attachReplaceFileInputEvent, and the #frmReplace submit handler) for the exact request chain:
// selecting a file fires CheckForSameFileType (toggles #replaceFileValidationContainer and
// #btnReplaceTemplateSubmit's disabled state); Submit builds a plain-text confirmation dialog
// (no stable container id, only its Continue/Cancel button ids are fixed) that Cancel just closes
// with no server call at all; Continue POSTs UploadTemplateFile -> ReplaceTemplate -> GetFileToken
// in sequence -- the same GetFileToken/launchEditor sequence Create New Template uses, which is why
// this reuses tests/support/bartender.ts exactly like the other BarTender-driving tests.
//
// Uses tests/support/templates.ts's resolveBtwFile() for the replacement file -- this is the exact
// "browse for an existing template" flow ROBAR_BTW_FILE/ROBAR_BTW_LIBRARY_DIR (seed.ts) were added
// for. The wrong-file-type case just needs some non-.btw file that exists on disk; this repo's own
// package.json is a convenient, always-present one -- its content is irrelevant, only its extension
// matters to CheckForSameFileType.

import path from 'path';
import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { resolveBtwFile } from '../support/templates';
import * as bartender from '../support/bartender';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find.
test.use({ headless: false });

test('replace template rejects a mismatched file type and replaces the template with a valid one', async ({ page }) => {
  // Generous budget: BarTender launch-and-close for the initial create, then again after the
  // actual replace, plus a final View Label Characteristics check.
  test.setTimeout(600_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBReplaceTest' + Math.floor(Math.random() * 100000);
  const sharename = 'I_Num';
  const wrongTypeFile = path.join(__dirname, '..', '..', 'package.json');
  const replacementBtwFile = resolveBtwFile();

  await test.step('create a throwaway template to replace', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', 'Created via automated Playwright test (Replace Template)');
    await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    // Blank starter file -- the whole point of this test is to replace its content with a
    // different, real .btw file below, so what's in it here doesn't matter.
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

    const bartenderPid = await bartender.launchTemplateEditor(page);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  async function queryForTemplate() {
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
    return row;
  }

  await test.step('query for the new template and open Replace Template', async () => {
    await frame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
    // Confirmed live: this page's CriteriaFilter widget instance is named "dvFilters" (unlike
    // Campaign Manager's instance) -- field names are "dvFilters[0].Column" etc.
    await frame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName');
    await frame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches');
    await frame.fill('input[name="dvFilters[0].Value"]', templateName);

    const row = await queryForTemplate();
    await row.getByText('Actions', { exact: true }).click();
    // Standing convention for Template Management row/bulk actions: give the dropMenu popup a
    // moment to finish rendering before the next click, rather than racing it.
    await page.waitForTimeout(500);
    // Scoped to the row, not `frame` -- Replace Template is a statically-declared knockout-bound
    // dialog (like Edit Attributes/Create/Save As New), so its own hidden .ui-dialog-title already
    // exists in the DOM from page load and collides with the row's menu link under an unscoped
    // frame-wide text match. See Edit_Attributes.spec.ts's comment on this same gotcha.
    await row.getByText('Replace Template', { exact: true }).click();
    await page.waitForTimeout(500);
  });

  const dialog = frame.locator('#replaceTemplateDialog');
  const fileInput = dialog.locator('#replaceFileInput');
  const validationMessage = dialog.locator('#replaceFileValidationContainer');
  // Submit/Cancel are jQuery UI dialog `buttons:` entries -- rendered into a `.ui-dialog-buttonpane`
  // that's a sibling of #replaceTemplateDialog, not a descendant of it (same pattern as Edit
  // Attributes' Submit button), so located unscoped via `frame`.
  const submitButton = frame.locator('#btnReplaceTemplateSubmit');

  await test.step('rejects a file of the wrong type', async () => {
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Template Name: ${templateName}`);
    await expect(dialog).toContainText('Template Version: 0');
    await expect(dialog).toContainText('Label Type: Carton Label');
    await expect(submitButton).toBeDisabled();

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/CheckForSameFileType'), { timeout: 10_000 }),
      fileInput.setInputFiles(wrongTypeFile),
    ]);
    await page.waitForTimeout(500);

    await expect(validationMessage).toBeVisible();
    await expect(validationMessage).toContainText('New file must be of the same file type as the existing file.');
    await expect(submitButton).toBeDisabled();
  });

  await test.step('submits a valid file, then cancels the confirmation (no replace should happen)', async () => {
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/CheckForSameFileType'), { timeout: 10_000 }),
      fileInput.setInputFiles(replacementBtwFile),
    ]);
    await page.waitForTimeout(500);

    await expect(validationMessage).toBeHidden();
    await expect(submitButton).toBeEnabled();

    await submitButton.click();
    await page.waitForTimeout(500);

    // The confirmation dialog is a plain, ad-hoc jQuery UI dialog with no stable container id --
    // only its Continue/Cancel button ids are fixed (see Management.cshtml's
    // replaceTemplateDialogOptions Submit handler). Locate its message by class instead.
    // Confirmed live (2026-09-14): a bare `.message-warning` locator is NOT unique -- it also
    // matches this frame's pre-existing static "Some search results/label types are not included
    // due to label type security" banners (Create New Template's, Save As New's, and the grid's
    // own), which share the `message message-warning` classes plus an extra `message-compact` this
    // dynamically-built confirmation div doesn't have. Exclude those instead of matching by text
    // alone, since the confirmation text itself is dynamic (includes the template name).
    const confirmMessage = frame.locator('.message-warning:not(.message-compact)');
    await expect(confirmMessage).toContainText(`Are you sure you want to replace ${templateName} v0 Carton Label?`);

    await frame.locator('#btnConfirmReplaceTemplateCancel').click();
    await page.waitForTimeout(500);

    // Confirmed live: Cancel here closes BOTH the confirmation and the Replace Template dialog
    // (clearReplaceTemplateDialogParameters runs in the confirmation's own beforeClose) -- matches
    // TM_Replace-1.12's step 1.11/1.12 (Cancel closes the confirmation, no replace is recorded).
    await expect(dialog).toBeHidden();
  });

  await test.step('re-opens Replace Template and actually replaces it this time', async () => {
    const row = await queryForTemplate();
    await row.getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    await row.getByText('Replace Template', { exact: true }).click();
    await page.waitForTimeout(500);

    await expect(dialog).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/CheckForSameFileType'), { timeout: 10_000 }),
      fileInput.setInputFiles(replacementBtwFile),
    ]);
    await page.waitForTimeout(500);
    await expect(submitButton).toBeEnabled();

    await submitButton.click();
    await page.waitForTimeout(500);

    // Confirmed live (2026-09-14): jQuery UI's `.dialog("close")` (used by the earlier cancel step
    // above) only hides the ad-hoc confirmation div -- it's never removed from the DOM -- and every
    // Submit click builds a brand-new one with the SAME hardcoded button ids. By this second Submit
    // there are now two #btnConfirmReplaceTemplateContinue elements (one stale and hidden, one
    // live), so an unscoped id locator is a strict-mode violation. `:visible` disambiguates.
    const [replaceResponse, tokenResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/ReplaceTemplate'), { timeout: 15_000 }),
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      frame.locator('#btnConfirmReplaceTemplateContinue:visible').click(),
    ]);
    const replaceBody = await replaceResponse.json();
    const tokenBody = await tokenResponse.json();
    expect(replaceBody.Success, `ReplaceTemplate failed: ${JSON.stringify(replaceBody)}`).toBe(true);
    expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();

    // Same GetFileToken -> Sentinel -> BarTender launch sequence as Create New Template. Unlike
    // View_Label_Characteristics.spec.ts's own template (created blank, with nothing bound to any
    // sharename until the test adds one), `replacementBtwFile` is a real, fully-built template that
    // already has its own data-bound objects -- confirmed live (2026-09-14) the hard way: adding
    // *another* text object and trying to name its data source "I_Num" failed with BarTender's own
    // "The data source name 'I_Num' already exists" error, because that sharename is already bound
    // to an object already in this file. So there's nothing to add here -- just save the replaced
    // content as-is and close; the pre-existing "I_Num" binding is exactly what proves the
    // replacement took effect in the check below.
    const bartenderPid = await bartender.launchTemplateEditor(page);
    await bartender.saveTemplate(page, bartenderPid);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  await test.step('confirms the replacement via View Label Characteristics', async () => {
    const row = await queryForTemplate();
    await row.getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    // View Label Characteristics builds its dialog markup fresh via AJAX on each click, so it
    // doesn't have the pre-existing-hidden-dialog collision Replace Template does -- an unscoped
    // frame-wide text match is fine here, matching View_Label_Characteristics.spec.ts.
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
