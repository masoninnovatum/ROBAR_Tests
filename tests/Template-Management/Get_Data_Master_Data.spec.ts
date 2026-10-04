// Template Management > Get Data against an item that has an APPROVED Master Data record -- the TEMPLATE-side proof of
// master-data-level share names (user learning goal, 2026-10-04).
//   template from A1SuperTemplate_v0.btw (binds md_brand, md_primedi, md_shelflife, md_ver..., I_Num, I_Desc ...)
//   -> Campaign Manager item on it -> RobarMasterData record with the SAME item number (Brand Name "GDBrand<stamp>",
//   Primary DI "00841646<stamp>"), approved -> reopen the template in BarTender -> Get Data (default selection) -> Submit.
// EVIDENCE (attached as screenshots of BarTender's Workspace, and read by eye on the first run): before Get Data the label shows
// the placeholder sample data ("brand", "prime di", "version", "Example Item Description"); after Submit it shows the item's and
// the Master Data record's REAL values: Item Number = the item, item desc = the item's description, "mdm desc" = the MD
// record's description, "mdm ver" = 0, "mdm brand" = GDBrand<stamp>, "primary di" = 00841646<stamp>, and unset fields (item
// shelf, mdm shelf) show "<Empty>". So a text object bound to share name `md_brand` / `md_primedi` is filled from the item's
// approved, effective MDM record. The label text itself is not readable through UI Automation, so the automated assertions
// are: the dialog's controls, Restore enabling after Submit, and the before/after screenshots differing.
// Uses the real mouse (FlaUI) -- do not touch the mouse while it runs. Needs the WebMenu keep-alive (long BarTender stretch).

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as cm from '../support/campaign-manager';
import * as bartender from '../support/bartender';
import * as mdm from '../support/master-data';
import * as flaui from '../../scripts/flaui_bridge';
import { resolveBtwFile } from '../support/templates';

test.use({ headless: false });

test('Get Data fills the template with the item\'s approved Master Data values (md_brand, md_primedi ...)', async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  await login(page);
  // The WebMenu logs the session out after a few idle minutes (only a real mousemove resets it); this run spends a long time in
  // BarTender, so keep it alive exactly like Create_Approved_Template_and_Item.spec.ts does.
  const keepAlive = setInterval(() => {
    page.evaluate(() => {
      const w = window as unknown as { RefreshTimeout?: () => void };
      if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout();
    }).catch(() => {});
  }, 60_000);
  test.info().annotations.push({ type: 'keepalive', description: 'RefreshTimeout every 60s' });
  await openMenuItem(page, 'Template Management');
  let tmFrame = await findFrame(page, 'TemplateManagement');
  const stamp = Date.now().toString().slice(-6);
  const templateName = 'MBGDMD' + stamp;
  const brand = 'GDBrand' + stamp;
  let itemNumber = '';

  await test.step('template from A1SuperTemplate', async () => {
    await tmFrame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await tmFrame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);
    await tmFrame.fill('#txtTemplateName', templateName);
    await tmFrame.fill('#txtDescription', 'Get Data + Master Data spike');
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
    const created = await cm.createItem(page, cmFrame, { template: templateName, description: 'GD MD spike item' });
    itemNumber = created.itemNumber;
    console.log(`item ${itemNumber}`);
  });

  await test.step('approved Master Data record for the item with a known Brand Name', async () => {
    await page.getByRole('tab', { name: 'Main Menu' }).click();
    const grid = await mdm.reopenMasterData(page);
    await mdm.createValidRecord(page, grid, { itemNumber, description: 'GD MD spike', brandName: brand, primaryDi: '00841646' + stamp });
    const ef = await findFrame(page, 'MasterData/Edit');
    await mdm.clickEditAction(page, ef, 'menuApprove');
    await mdm.signAndSubmit(ef, '#approveDialog', 'btnApproveSubmit', 'General Approval');
    await page.waitForTimeout(3000);
    console.log(`MDM approved: ${(await ef.locator('body').innerText()).match(/Approved By:\s*\S+/)?.[0]}`);
    await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('tab', { name: 'Main Menu' }).click();
  });

  await test.step('open the template, Get Data, screenshot before/after', async () => {
    await page.getByRole('tab', { name: 'Template Management' }).click();
    await page.waitForTimeout(500);
    tmFrame = await findFrame(page, 'TemplateManagement');
    // A user with no saved filter has NO filter row yet; the Add Filter click handler is bound to the inner text span only.
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
    const shot = async (name: string) => {
      const p = testInfo.outputPath(name + '.png');
      await flaui.screenshot({ processId: pid, title: 'Template Editor', elementName: 'Workspace', outPath: p });
      await testInfo.attach(name, { path: p, contentType: 'image/png' });
      console.log(`screenshot ${p}`);
    };
    await bartender.untilValue(page, 'wait for ready', () => flaui.getProperty({ processId: pid, title: 'Template Editor', name: 'Restore', automationId: 'btnRestore', property: 'IsEnabled', expectValue: 'False', retrySeconds: 60 }), { attempts: 1 });
    await shot('before_get_data');
    await bartender.until(page, 'click Get Data', () => flaui.click({ processId: pid, title: 'Template Editor', name: 'Get Data', method: 'mouse', retrySeconds: 20 }), { attempts: 1 });
    await page.waitForTimeout(3000);
    // The Get Data dialog offers BOTH a Master Data grid (dgvMasterData: MD Item Number / Version / Description / Effective
    // Begin+End / Approved By / Approval Date) and an Item grid (grpSelectItemData), plus Search / Reset.
    const tree = await flaui.dumpTree({ processId: pid, title: 'Template Editor', maxDepth: 12 }).catch((e: unknown) => String(e));
    const treeText = typeof tree === 'string' ? tree : JSON.stringify(tree);
    for (const id of ['GetDataDialog', 'grpDataSource', 'grpSelectMasterData', 'dgvMasterData', 'grpSelectItemData', 'btnSearch', 'btnReset']) {
      expect(treeText, `the Get Data dialog exposes ${id}`).toContain(id);
    }
    for (const header of ['MD Item Number', 'MD Version Number', 'MD Description', 'MD Approved By']) expect(treeText).toContain(header);
    await bartender.until(page, 'Submit', () => flaui.click({ processId: pid, title: 'Template Editor', elementAutomationId: 'pnlButtons', name: 'Submit', automationId: 'btnSubmit', method: 'mouse', retrySeconds: 30 }), { attempts: 1 });
    await page.waitForTimeout(3000);
    await bartender.until(page, 'Restore became enabled', () => flaui.getProperty({ processId: pid, title: 'Template Editor', name: 'Restore', automationId: 'btnRestore', property: 'IsEnabled', expectValue: 'True', retrySeconds: 10 }), { attempts: 1 });
    await shot('after_get_data');
    // The two screenshots must differ: the label's placeholder values (brand / prime di / version ...) were replaced by real ones.
    const fs = await import('fs');
    const before = fs.readFileSync(testInfo.outputPath('before_get_data.png'));
    const after = fs.readFileSync(testInfo.outputPath('after_get_data.png'));
    expect(Buffer.compare(before, after), 'Get Data changed what the label shows').not.toBe(0);
    await bartender.until(page, 'Restore', () => flaui.click({ processId: pid, title: 'Template Editor', name: 'Restore', automationId: 'btnRestore', method: 'mouse', retrySeconds: 45 }), { attempts: 1 });
    await page.waitForTimeout(1000);
    await bartender.saveTemplate(page, pid);
    await bartender.closeTemplateEditor(page, pid);
  });
  clearInterval(keepAlive);
  console.log(`DONE template=${templateName} item=${itemNumber} brand=${brand}`);
});
