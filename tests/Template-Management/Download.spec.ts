// Row-level and bulk action: Download (TM_Download-1.15).
//
// Live-confirmed (2026-09-14) via direct MCP browser exploration before writing this test rather
// than guessing selectors -- see robar-module-reference.md's "Template Management" section.
// Source-grounded against Innovatum.Pages.TemplateManagement.MVC's Management.cshtml
// (downloadTemplate/bulkDownloadTemplates/triggerFileDownload). Neither path touches BarTender --
// this is pure browser download handling, no FlaUI involved anywhere in this test.
//
// Confirmed live: the row-level action downloads the raw .btw file directly, named
// "<templateName>_v<version>.btw"; the bulk action always zips (even for a single selected
// template), named "Templates_<yyyyMMddHHmmss>.zip". Both are triggered via a hidden iframe
// navigating to a GetDownloadFile?downloadKey=... URL (triggerFileDownload) rather than a direct
// link click, but Playwright's download event still captures it the same way either way.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as bartender from '../support/bartender';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find. Download itself never
// touches BarTender, but the throwaway template this test creates first still does.
test.use({ headless: false });

test('download supports both row-level (single file) and bulk (zip) downloads', async ({ page }) => {
  // Generous budget for the initial throwaway-template creation's BarTender launch-and-close;
  // Download itself is pure browser interaction and fast.
  test.setTimeout(300_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBDownloadTest' + Math.floor(Math.random() * 100000);

  await test.step('create a throwaway template to download', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', 'Created via automated Playwright test (Download)');
    await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    // Download doesn't depend on the template's actual content, so a blank starter is fine.
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

  await test.step('query for the template', async () => {
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
  });

  const row = frame.locator('#grdJqGrid tr').filter({ hasText: templateName });
  await row.waitFor({ state: 'visible', timeout: 10_000 });

  await test.step('row-level Download downloads the raw .btw file', async () => {
    await row.getByText('Actions', { exact: true }).click();
    // Standing convention for Template Management row/bulk actions: give the dropMenu popup a
    // moment to finish rendering before the next click, rather than racing it.
    await page.waitForTimeout(500);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      row.getByText('Download', { exact: true }).click(),
    ]);

    expect(download.suggestedFilename()).toBe(`${templateName}_v0.btw`);
  });

  await test.step('rejects Bulk Actions Download with nothing selected', async () => {
    await frame.getByText('Bulk Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    // Scoped by id (#actBulkDownload, confirmed via source), not text -- "Download" is also the
    // row-level action's own label, and the row action dropdown was already opened once above.
    // Given the exact same class of bug already found twice in this suite (a dropdown/dialog's DOM
    // node persisting hidden after use, colliding with a later unscoped text match), this avoids
    // relying on the row-level menu's node being fully gone rather than just hidden.
    await frame.click('#actBulkDownload', { force: true });
    await page.waitForTimeout(500);

    // Confirmed live: a plain ad-hoc jQuery UI error dialog (Management.cshtml's showError()),
    // not a form validation message -- title "Error", single "OK" button. Rendered inside the
    // module iframe (showError() runs in that frame's own script context), not the top page.
    const errorDialog = frame.getByRole('dialog', { name: 'Error' });
    await expect(errorDialog).toContainText('Please select one or more records.');
    await errorDialog.getByRole('button', { name: 'OK' }).click();
    await expect(errorDialog).toBeHidden();
  });

  await test.step('bulk Download zips the selected template', async () => {
    // Checking the row's checkbox fires async selection-tracking calls that the Bulk Actions
    // menu's enabled/disabled state depends on -- wait for that round trip, not a blind timeout.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
      row.locator('input[type="checkbox"]').check(),
    ]);
    await page.waitForTimeout(500);

    await frame.getByText('Bulk Actions', { exact: true }).click();
    await page.waitForTimeout(500);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      frame.click('#actBulkDownload', { force: true }),
    ]);

    // Confirmed live: bulk download always zips, even for a single selected template, named
    // "Templates_<yyyyMMddHHmmss>.zip" -- the exact timestamp isn't worth asserting on.
    expect(download.suggestedFilename()).toMatch(/^Templates_\d+\.zip$/);
  });
});
