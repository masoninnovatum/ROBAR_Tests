// BarTender action: Get Data / Restore (TM_GetData-1.11).
//
// "Get Data" opens a native dialog INSIDE BarTender's own Template Editor (not a web dialog),
// launched via a button in the Template Editor action bar and reachable from bartenderPid as a
// nested child [Window] (AutomationId "GetDataDialog") -- not a real top-level window despite
// having its own title bar, so `title: 'Get Data'` never resolves; scope through
// `elementAutomationId` instead. With the associated item already selected by default in its
// "Select Item Data" grid (no explicit search needed for this test's one-item-per-template setup),
// Submit (elementAutomationId: 'pnlButtons', automationId: 'btnSubmit') replaces the template's
// Item-level sharenames with that item's data; Restore (same action bar as Save/Close Tab) reverts
// it back. This test uses Restore before Save specifically to avoid the "Do you want to remove
// Item/Master/Sample Data before saving?" prompt TM_GetData-1.11 describes -- the same way other
// tests in this suite avoid the "unsaved changes" prompt bartender.ts's closeTemplateEditor doesn't
// yet handle.
//
// Both "Get Data" and "Submit" need `method: 'mouse'` -- their click handlers open/populate
// synchronously (the same reason Create_and_Approve_Template.spec.ts's Approve/Submit needed it),
// so the default click method (UI Automation's blocking InvokePattern) hangs, and `method: 'win32'`
// (SendMessage(BM_CLICK), also synchronous) hangs the same way. Only a real fire-and-forget
// SendInput click works. This test deliberately does NOT click the item row first -- a bare `--name`
// search against this grid's individual virtualized/MSAA-bridged cells hangs FlaUIAutomation.exe
// outright (confirmed via its own source: every retry attempt is hard-capped at 15s regardless of
// the requested retrySeconds, and a hung call is never cancelled), regardless of how small the
// search root is scoped -- and turned out to be unnecessary anyway once Submit's own window scoping
// was fixed elsewhere. See robar-module-reference.md's "Get Data" section for the full debugging
// history if this ever needs revisiting.
//
// Not exercised by this test (kept out of scope, matching how every other test in this suite scopes
// down its formal script): Use Sample Data mode, Master Data search, and the various filter/
// checkbox options in the dialog.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as cm from '../support/campaign-manager';
import * as bartender from '../support/bartender';
import * as flaui from '../../scripts/flaui_bridge';
import { resolveBtwFile } from '../support/templates';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find.
test.use({ headless: false });

test('get data loads the associated item\'s data into the template, then restore reverts it', async ({ page }) => {
  test.setTimeout(600_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const tmFrame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBGetDataTest' + Math.floor(Math.random() * 100000);

  await test.step('create a template with real Item-level sharenames (A1SuperTemplate content)', async () => {
    await tmFrame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await tmFrame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await tmFrame.fill('#txtTemplateName', templateName);
    await tmFrame.fill('#txtDescription', 'Created via automated Playwright test (Get Data)');
    await tmFrame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    // Confirmed live building Replace_Template.spec.ts: A1SuperTemplate_v0.btw is a real,
    // fully-built template with actual Item-level sharenames already bound (e.g. "I_Num") --
    // exactly what Get Data needs to have something to replace.
    await tmFrame.setInputFiles('#newFileInput', resolveBtwFile());
    await page.waitForTimeout(500);

    const [createResponse, tokenResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      tmFrame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
    ]);
    const createBody = await createResponse.json();
    const tokenBody = await tokenResponse.json();
    expect(createBody.Success, `CreateNewTemplate failed: ${JSON.stringify(createBody)}`).toBe(true);
    expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();

    const bartenderPid = await bartender.launchTemplateEditor(page);
    await bartender.saveTemplate(page, bartenderPid);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  await test.step('create an item associated with the new template', async () => {
    // Confirmed live: unapproved throwaway templates already show up as selectable options in
    // Campaign Manager's item-creation Template dropdown by name -- no approval needed.
    await page.getByRole('tab', { name: 'Main Menu' }).click();
    await page.waitForTimeout(500);
    await openMenuItem(page, 'Campaign Manager');
    const cmFrame = await findFrame(page, 'campaignmanager');
    await page.waitForTimeout(1000);

    await cm.createItem(page, cmFrame, {
      template: templateName,
      description: 'Playwright Get Data test item',
    });
  });

  await test.step('return to Template Management and reopen the template', async () => {
    await page.getByRole('tab', { name: 'Template Management' }).click();
    await page.waitForTimeout(500);

    await tmFrame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
    // Confirmed live: this page's CriteriaFilter widget instance is named "dvFilters" (unlike
    // Campaign Manager's instance) -- field names are "dvFilters[0].Column" etc.
    await tmFrame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName');
    await tmFrame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches');
    await tmFrame.fill('input[name="dvFilters[0].Value"]', templateName);

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/TemplateManagement/GridSessionStart') &&
          r.request().method() === 'POST' &&
          (r.request().postData() || '').includes(templateName),
        { timeout: 15_000 }
      ),
      tmFrame.click('#btnRetrieveData'),
    ]);

    const row = tmFrame.locator('#grdJqGrid tr').filter({ hasText: templateName });
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(500);

    // "View/Edit Template" isn't a statically-declared dialog (wired straight to openFile(fileId)),
    // so no row-scoping collision risk here -- matches View_Edit_Template.spec.ts.
    const [tokenResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      tmFrame.getByText('View/Edit Template', { exact: true }).click(),
    ]);
    const tokenBody = await tokenResponse.json();
    expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();
  });

  await test.step('Get Data, Submit against the associated item, then Restore', async () => {
    const bartenderPid = await bartender.launchTemplateEditor(page);

    // Confirmed live: Restore starts disabled (nothing to restore yet) -- a real, cheap signal
    // that Get Data hasn't touched the template, used below to confirm Submit actually did
    // something rather than just not throwing.
    await bartender.until(
      page,
      "confirm Restore starts disabled",
      () =>
        flaui.getProperty({
          processId: bartenderPid,
          title: 'Template Editor',
          name: 'Restore',
          automationId: 'btnRestore',
          property: 'IsEnabled',
          expectValue: 'False',
          retrySeconds: 10,
        }),
      { attempts: 1 }
    );

    await bartender.until(
      page,
      'click the "Get Data" button in the Template Editor action bar',
      () => flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Get Data', method: 'mouse', retrySeconds: 20 }),
      { attempts: 1 }
    );
    await page.waitForTimeout(1000);

    await bartender.until(
      page,
      'click Submit in the Get Data dialog',
      () =>
        flaui.click({
          processId: bartenderPid,
          title: 'Template Editor',
          elementAutomationId: 'pnlButtons',
          name: 'Submit',
          automationId: 'btnSubmit',
          method: 'mouse',
          retrySeconds: 30,
        }),
      { attempts: 1 }
    );
    await page.waitForTimeout(1000);

    // Confirms Submit actually replaced the template's data (not just that the click didn't
    // throw) -- Restore only enables once there's really something to restore.
    await bartender.until(
      page,
      "confirm Restore became enabled after Submit",
      () =>
        flaui.getProperty({
          processId: bartenderPid,
          title: 'Template Editor',
          name: 'Restore',
          automationId: 'btnRestore',
          property: 'IsEnabled',
          expectValue: 'True',
          retrySeconds: 10,
        }),
      { attempts: 1 }
    );

    await bartender.until(
      page,
      'click Restore in the Template Editor action bar',
      () => flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Restore', automationId: 'btnRestore', method: 'mouse', retrySeconds: 45 }),
      { attempts: 1 }
    );
    await page.waitForTimeout(1000);

    await bartender.saveTemplate(page, bartenderPid);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });
});
