// Row-level action: View Label Characteristics (TM_LabelCharacteristics-1.1).
//
// The point of this action is to show which system sharenames are bound to a template's text
// objects (and their embedded/sample data) -- so this test binds a real Text object to a real
// sharename ("I_Num") via bartender.addTextObjectBoundToSharename before checking the dialog,
// the same way Create_and_Approve_Template.spec.ts does; a template with no text objects at all
// would make the dialog's own "no data" case pass trivially without proving anything.
//
// Selectors below are grounded in the real Suite 7 source
// (Innovatum.Pages.TemplateManagement.MVC, read 2026-09-11) rather than guessed -- specifically:
// Views/TemplateManagement/Management.cshtml (grid id "grdJqGrid", row action text "View Label
// Characteristics" from addEditColumn(), criteria filter column "LabelName"), and
// Views/Shared/LabelCharacteristicsDialog.cshtml (dialog id "labelCharsDialog", plain-text
// "Template Name: <name>" content, no wrapping element around the name itself). Confirmed live
// (both via this test passing and via direct MCP browser exploration): the per-row "Actions"
// dropdown menu stays nested inside the row's own gridcell -- it does not get repositioned
// elsewhere by the dropMenu jQuery plugin.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as bartender from '../support/bartender';

// Confirmed live (2026-09-11): playwright.config.ts's project-wide `headless: true` now launches
// Playwright's dedicated "headless shell" binary (a separate, stripped-down Chromium build under
// ms-playwright/chromium_headless_shell-*) instead of running the full browser headlessly -- that
// build never creates a real OS window at all, so FlaUI/UI Automation (which requires one) can't
// find it under any retry budget. Any test that drives a native desktop app via scripts/flaui_bridge
// needs a real window, so it must override headless here regardless of the project default.
test.use({ headless: false });

test('view label characteristics shows a newly created template\'s attributes', async ({ page }) => {
  // Generous budget: Sentinel/BarTenderEdit launch, adding+naming a text object, and Save all add
  // up -- see Create_and_Approve_Template.spec.ts's comment on why BarTender's own timing varies.
  test.setTimeout(600_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBLabelCharsTest' + Math.floor(Math.random() * 100000);
  const sharename = 'I_Num';

  await test.step('create a template with a text object bound to a real sharename', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', 'Created via automated Playwright test (View Label Characteristics)');
    await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    // Same blank starter file as Create_and_Approve_Template.spec.ts -- a text object bound to a
    // sharename gets added to it below, same as that test does.
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
    await bartender.addTextObjectBoundToSharename(page, bartenderPid, sharename);
    await bartender.saveTemplate(page, bartenderPid);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  await test.step('filter the grid for the new template and open View Label Characteristics', async () => {
    await frame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
    // Confirmed live (2026-09-11) via HTML dump: this page's CriteriaFilter widget instance is
    // named "dvFilters" (Innovatum.CriteriaFilters.Options("dvFilters", ...)), unlike Campaign
    // Manager's instance -- field names are "dvFilters[0].Column" etc, not "Filters[0].Column".
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
    // Standing convention for Template Management row/bulk actions (matches the Create dialog's
    // own settle wait after opening its Actions dropdown): give the dropMenu popup a moment to
    // finish rendering before the next click, rather than racing it.
    await page.waitForTimeout(500);
    await frame.getByText('View Label Characteristics', { exact: true }).click();
    await page.waitForTimeout(500);

    const dialog = frame.locator('#labelCharsDialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(templateName);
    await expect(dialog).toContainText('Carton Label');
    // The actual point of this action: the sharename bound to the text object we added shows up
    // as an Attribute row in the characteristics grid.
    await expect(dialog).toContainText(sharename);

    await frame.click('#btnViewLabelCharsClose');
    await expect(dialog).toBeHidden();
  });
});
