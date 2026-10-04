// Template Management > Get Data options (the native dialog inside BarTender's Template Editor; source:
// Innovatum.Sentinel.Plugin.BarTenderEdit/Views/GetDataDialog.cs). Uses an item whose Master Data record is UNAPPROVED:
//   A. defaults ("Allow Unapproved Master Data" checked) -> the label is filled with the unapproved record's values
//   B. "Allow Unapproved Master Data" UNCHECKED + Search -> the Master Data grid empties and Submit leaves the md_ fields unfilled
//   C. "Use Sample Data" -> the label shows the schema's sample data (no item involved)
// Dialog controls (AutomationIds): radios rbItemData ("Use Item and Master Data", default) / rbSampleData ("Use Sample Data");
// search ddlFields + rbStartsWith/rbContains + txtValue, Search btnSearch / Reset btnReset; checkboxes chbAllowUnapprovedItems,
// chbEffectiveItemsOnly, chbAllowUnapprovedMasterData, chbEffectiveMasterDataOnly (defaults: both Allow-unapproved CHECKED, both
// Effective-only unchecked; Reset restores them); grids dgvItemGrid / dgvMasterData. Selecting an item row (or Search) reloads
// the Master Data grid with the two master-data flags. EVIDENCE = BarTender Workspace screenshots attached to the report (the
// label text is not readable through UI Automation). Uses the real mouse (FlaUI) -- do not touch the mouse while it runs.
// OBSERVED (screenshots read by eye on the first run, 2026-10-04):
//   A: item fields real (Item Number = the item, item desc) AND md fields from the UNAPPROVED record
//      (mdm desc "Get Data options MD", mdm ver 0, mdm brand OptBrand<stamp>, primary di 00841646<stamp>)
//   B: item fields still real, but the md fields stay at their placeholders ("Example MDM Description", "version", "brand",
//      "prime di", "mdm shelf") -- the unapproved Master Data record is excluded
//   C: Use Sample Data -> the SCHEMA's sample values for everything (Item123456, version 2, Aspirin, 12m, Brand, 12345678901234, 5Y)
//      i.e. the Sample Data of the GetDataSampleSchema fields (RobarMasterData), not the item's data.
// Automated assertions: Restore enables after each Submit and disables after Restore, and screenshots A/B/C differ.
// (The FlaUI bridge cannot read a CheckBox's ToggleState -- supported properties are only IsEnabled, Name, Text, Value,
// IsOffscreen, BoundingRectangle -- so the unticked state is proven by the label, not by reading the box.)

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as cm from '../support/campaign-manager';
import * as bartender from '../support/bartender';
import * as mdm from '../support/master-data';
import * as flaui from '../../scripts/flaui_bridge';
import { resolveBtwFile } from '../support/templates';

test.use({ headless: false });

test('Get Data options: unapproved Master Data on/off and Use Sample Data', async ({ page }, testInfo) => {
  test.setTimeout(1_200_000);
  await login(page);
  // The WebMenu logs the session out after a few idle minutes (only a real mousemove resets it); keep it alive.
  const keepAlive = setInterval(() => {
    page.evaluate(() => {
      const w = window as unknown as { RefreshTimeout?: () => void };
      if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout();
    }).catch(() => {});
  }, 60_000);
  await openMenuItem(page, 'Template Management');
  let tmFrame = await findFrame(page, 'TemplateManagement');
  const stamp = Date.now().toString().slice(-6);
  const templateName = 'MBGDOpt' + stamp;
  const brand = 'OptBrand' + stamp;
  let itemNumber = '';

  await test.step('template from A1SuperTemplate', async () => {
    await tmFrame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await tmFrame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);
    await tmFrame.fill('#txtTemplateName', templateName);
    await tmFrame.fill('#txtDescription', 'Get Data options test');
    await tmFrame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    await tmFrame.setInputFiles('#newFileInput', resolveBtwFile());
    await page.waitForTimeout(500);
    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      tmFrame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
    ]);
    expect((await createResponse.json()).Success).toBe(true);
    const pid = await bartender.launchTemplateEditor(page);
    await bartender.saveTemplate(page, pid);
    await bartender.closeTemplateEditor(page, pid);
  });

  await test.step('item on the template', async () => {
    await page.getByRole('tab', { name: 'Main Menu' }).click();
    await openMenuItem(page, 'Campaign Manager');
    const cmFrame = await findFrame(page, 'campaignmanager');
    await page.waitForTimeout(1000);
    itemNumber = (await cm.createItem(page, cmFrame, { template: templateName, description: 'Get Data options item' })).itemNumber;
  });

  await test.step('UNAPPROVED Master Data record for the item (Brand Name known)', async () => {
    await page.getByRole('tab', { name: 'Main Menu' }).click();
    const grid = await mdm.reopenMasterData(page);
    await mdm.createValidRecord(page, grid, { itemNumber, description: 'Get Data options MD', brandName: brand, primaryDi: '00841646' + stamp });
    const ef = await findFrame(page, 'MasterData/Edit');
    expect(await ef.getByText('Approved By: Unapproved').count(), 'the Master Data record is left unapproved').toBe(1);
    await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('tab', { name: 'Main Menu' }).click();
  });

  await test.step('open the template in BarTender and try the three Get Data modes', async () => {
    await page.getByRole('tab', { name: 'Template Management' }).click();
    await page.waitForTimeout(500);
    tmFrame = await findFrame(page, 'TemplateManagement');
    if ((await tmFrame.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
      await tmFrame.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }
    await tmFrame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName', { timeout: 5000 });
    await tmFrame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches', { timeout: 5000 });
    await tmFrame.fill('input[name="dvFilters[0].Value"]', templateName, { timeout: 5000 });
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart') && r.request().method() === 'POST' && (r.request().postData() || '').includes(templateName), { timeout: 15_000 }),
      tmFrame.click('#btnRetrieveData'),
    ]);
    const row = tmFrame.locator('#grdJqGrid tr').filter({ hasText: templateName });
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      tmFrame.getByText('View/Edit Template', { exact: true }).click(),
    ]);
    const pid = await bartender.launchTemplateEditor(page);

    const fs = await import('fs');
    const shot = async (name: string) => {
      const p = testInfo.outputPath(name + '.png');
      await flaui.screenshot({ processId: pid, title: 'Template Editor', elementName: 'Workspace', outPath: p });
      await testInfo.attach(name, { path: p, contentType: 'image/png' });
      return fs.readFileSync(p);
    };
    const click = (description: string, args: Record<string, unknown>) =>
      bartender.until(page, description, () => flaui.click({ processId: pid, title: 'Template Editor', method: 'mouse', retrySeconds: 30, ...args } as never), { attempts: 1 });
    const openGetData = async () => {
      await click('click Get Data', { name: 'Get Data', retrySeconds: 20 });
      await page.waitForTimeout(3000);
    };
    const submit = async () => {
      await click('Submit', { elementAutomationId: 'pnlButtons', name: 'Submit', automationId: 'btnSubmit' });
      await page.waitForTimeout(3000);
      await bartender.until(page, 'Restore enabled', () => flaui.getProperty({ processId: pid, title: 'Template Editor', name: 'Restore', automationId: 'btnRestore', property: 'IsEnabled', expectValue: 'True', retrySeconds: 10 }), { attempts: 1 });
    };
    const restore = async () => {
      await click('Restore', { name: 'Restore', automationId: 'btnRestore', retrySeconds: 45 });
      await page.waitForTimeout(1500);
      await bartender.until(page, 'Restore disabled again', () => flaui.getProperty({ processId: pid, title: 'Template Editor', name: 'Restore', automationId: 'btnRestore', property: 'IsEnabled', expectValue: 'False', retrySeconds: 15 }), { attempts: 1 });
    };

    await bartender.untilValue(page, 'wait for ready', () => flaui.getProperty({ processId: pid, title: 'Template Editor', name: 'Restore', automationId: 'btnRestore', property: 'IsEnabled', expectValue: 'False', retrySeconds: 60 }), { attempts: 1 });
    const placeholder = await shot('0_placeholder');

    // A. defaults: unapproved Master Data is allowed -> the record's values appear
    await openGetData();
    await submit();
    const a = await shot('A_unapproved_md_allowed');
    expect(Buffer.compare(placeholder, a), 'A: Get Data changed the label').not.toBe(0);
    await restore();

    // B. untick "Allow Unapproved Master Data", Search again so the Master Data grid reloads without the unapproved record
    await openGetData();
    await click('untick Allow Unapproved Master Data', { elementAutomationId: 'tblApprovalAndEffectivity', name: 'Allow Unapproved Master Data', controlType: 'CheckBox' });
    await page.waitForTimeout(800);
    const allowed = await flaui.getProperty({ processId: pid, title: 'Template Editor', elementAutomationId: 'tblApprovalAndEffectivity', name: 'Allow Unapproved Master Data', property: 'ToggleState' }).catch((e: unknown) => ({ error: String(e) }));
    console.log(`Allow Unapproved Master Data after click: ${JSON.stringify(allowed)}`);
    await click('Search', { elementAutomationId: 'pnlSearch', name: 'Search', automationId: 'btnSearch' });
    await page.waitForTimeout(3000);
    await submit();
    const b = await shot('B_unapproved_md_not_allowed');
    expect(Buffer.compare(a, b), 'B: without the unapproved Master Data the label differs from A').not.toBe(0);
    await restore();

    // C. Use Sample Data
    await openGetData();
    await click('choose Use Sample Data', { name: 'Use Sample Data', automationId: 'rbSampleData' });
    await page.waitForTimeout(1000);
    await submit();
    const c = await shot('C_sample_data');
    console.log(`screenshots: placeholder=${placeholder.length}B A=${a.length}B B=${b.length}B C=${c.length}B`);
    expect(Buffer.compare(a, c), 'C: sample data differs from the real item/MD data').not.toBe(0);
    await restore();

    await bartender.saveTemplate(page, pid);
    await bartender.closeTemplateEditor(page, pid);
  });
  clearInterval(keepAlive);
  console.log(`DONE template=${templateName} item=${itemNumber} brand=${brand}`);
});
