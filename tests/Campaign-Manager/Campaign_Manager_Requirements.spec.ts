// Campaign Manager main page re-checked against ValMaster (module "Campaign Manager", CM20130114002F117.0.2 and FRS.RBR.CM.101 - 107; live 2026-10-11, headless, TST703, read-only: nothing is created or changed).
// Differences are annotated `deviation <id>` (the spec stays green). Covered here: 117.0.2 previous filters reloaded and results retrieved on page load; 101.1 default Limit Results setting; 101.2 / 101.3 Advanced Options lists;
// 101.4 sort; 102.1 select / deselect checkboxes; 105.3 "No records to view"; 106.3 Exactly Matches turns Value into a drop-down for some columns; 106.4 AND / OR between filters.
// Already covered by older specs / doc blocks: action security processes (CM_*), Select Action empty without them, Limit Results digits, "No Items are selected", bulk actions, Job Inquiry (Job_Inquiry_Requirements).

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { readGlobalSetting } from '../support/global-settings';

test.use({ actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Campaign Manager vs ValMaster: saved filters on load, default limit, Advanced Options, sort, checkboxes, No records, Exactly Matches drop-down, AND / OR', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  // settings first (a mid-spec Dynamic UI read leaves a stale tab): the requirement names CMDefaultLimit, the code reads CM_DefaultResultLimit
  const legacy = await readGlobalSetting(page, 'CMDefaultLimit').catch(() => undefined);
  const real = await readGlobalSetting(page, 'CM_DefaultResultLimit').catch(() => undefined);
  console.log(`SETTINGS CMDefaultLimit=${legacy} CM_DefaultResultLimit=${real}`);
  if (legacy === undefined) deviation('FRS.RBR.CM.101.1', 'a setting named CMDefaultLimit', `no such setting; the code reads CM_DefaultResultLimit (value ${real ?? 'not found (code default 500)'})`);

  await openMenuItem(page, 'Campaign Manager'); // (cm.openCampaignManager logs in again and would hang after our login)
  let g = await findFrame(page, 'campaignmanager');
  await page.waitForTimeout(5000);

  await test.step('101.5 / 101.1: the Limit Results field is shown with a number', async () => {
    const limit = await g.locator('#ResultLimit').inputValue();
    console.log(`RESULT LIMIT field = ${limit}`);
    expect(limit).toMatch(/^\d+$/);
  });

  await test.step('101.2 / 101.3: Advanced Options offer available and selected result columns, selected not empty', async () => {
    const selected = (await g.locator('#selectedLimitColumns option').allInnerTexts()).map((t) => t.trim());
    const available = (await g.locator('#availableLimitColumns option').allInnerTexts()).map((t) => t.trim());
    console.log(`ADVANCED selected=${JSON.stringify(selected)} availableCount=${available.length} sample=${JSON.stringify(available.slice(0, 8))}`);
    if (selected.length === 0 || available.length === 0) deviation('FRS.RBR.CM.101.2', 'Advanced Options with available and selected columns', `selected ${selected.length} / available ${available.length}`);
    expect.soft(selected.length).toBeGreaterThan(0);
  });

  await test.step('117.0.2: the previous filters are loaded and results retrieved when the page loads', async () => {
    if ((await g.locator('.criteriaFilter-Filter').count()) === 0) await g.click('.criteriaFilter-AddButton');
    await g.selectOption('select[name="Filters[0].Column"]', 'itemsItemNumber');
    await g.selectOption('select[name="Filters[0].Operator"]', 'Contains');
    await g.fill('input[name="Filters[0].Value"]', 'MBBQ');
    await Promise.all([page.waitForResponse((r) => r.url().includes('/CampaignManager/GetData') && r.request().method() === 'POST', { timeout: 20_000 }), g.click('#btnRetrieveItems')]);
    await page.waitForTimeout(4000);
    const before = await g.locator('#gridResults tr.jqgrow').count();
    // leave and come back
    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await openMenuItem(page, 'Campaign Manager');
    g = await findFrame(page, 'campaignmanager');
    for (let i = 0; i < 20 && (await g.locator('#gridResults tr.jqgrow').count()) === 0; i++) await page.waitForTimeout(2000); // the saved-filter auto retrieve can take a while
    const value = await g.locator('input[name="Filters[0].Value"]').inputValue().catch(() => '');
    const after = await g.locator('#gridResults tr.jqgrow').count();
    console.log(`RELOAD: filter value="${value}" rows before=${before} after reload=${after}`);
    if (value !== 'MBBQ') deviation('CM20130114002F117.0.2', 'previous filter reloaded', `value "${value}"`);
    if (after === 0 && before > 0) deviation('CM20130114002F117.0.2', 'results retrieved automatically on load', 'grid empty until Retrieve Items is clicked');
  });

  await test.step('101.4: sort by a selected column (Item Number header toggles the order)', async () => {
    if ((await g.locator('#gridResults tr.jqgrow').count()) < 2) {
      await Promise.all([page.waitForResponse((r) => r.url().includes('/CampaignManager/GetData'), { timeout: 20_000 }), g.click('#btnRetrieveItems')]);
      await page.waitForTimeout(3000);
    }
    const header = g.locator('#gridResults_ItemNumber, th[id$="_ItemNumber"], th:has-text("Item Number")').first();
    const firstCells = async () => (await g.locator('#gridResults tr.jqgrow td[aria-describedby$="ItemNumber"]').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    await header.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const asc = await firstCells();
    await header.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const desc = await firstCells();
    console.log(`SORT asc=${JSON.stringify(asc.slice(0, 4))} desc=${JSON.stringify(desc.slice(0, 4))}`);
    const sortedAsc = JSON.stringify(asc) === JSON.stringify([...asc].sort((a, b) => a.localeCompare(b)));
    const sortedDesc = JSON.stringify(desc) === JSON.stringify([...desc].sort((a, b) => b.localeCompare(a)));
    if (asc.length > 1 && !(sortedAsc || sortedDesc || JSON.stringify(asc) !== JSON.stringify(desc))) deviation('FRS.RBR.CM.101.4', 'results sorted by the clicked column', `asc ${JSON.stringify(asc.slice(0, 4))} / desc ${JSON.stringify(desc.slice(0, 4))}`);
  });

  await test.step('102.1: the header checkbox selects / deselects all rows, rows can be ticked individually', async () => {
    if ((await g.locator('#gridResults tr.jqgrow').count()) === 0) {
      // the sort clicks reload the grid; make sure rows are present before ticking
      await g.selectOption('select[name="Filters[0].Column"]', 'itemsItemNumber');
      await g.selectOption('select[name="Filters[0].Operator"]', 'Contains');
      await g.fill('input[name="Filters[0].Value"]', 'MBBQ');
      await g.click('#btnRetrieveItems');
    }
    await g.locator('#gridResults tr.jqgrow').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const rows = await g.locator('#gridResults tr.jqgrow').count();
    const all = g.locator('#cb_gridResults');
    if (await all.count()) {
      await all.check();
      const ticked = await g.locator('#gridResults tr.jqgrow input.cbox:checked').count();
      await all.uncheck();
      const after = await g.locator('#gridResults tr.jqgrow input.cbox:checked').count();
      console.log(`CHECKBOXES rows=${rows} ticked by header=${ticked} after untick=${after}`);
      if (ticked !== rows || after !== 0) deviation('FRS.RBR.CM.102.1', 'select all / deselect all', `ticked ${ticked} of ${rows}, ${after} left after untick`);
      const first = g.locator('#gridResults tr.jqgrow input.cbox').first();
      await first.check();
      expect(await first.isChecked()).toBe(true);
      await first.uncheck();
    } else {
      console.log('NOTE no header checkbox #cb_gridResults');
      deviation('FRS.RBR.CM.102.1', 'a select-all check box', 'no header checkbox found');
    }
  });

  await test.step('105.3: "No records to view" when nothing matches', async () => {
    await g.selectOption('select[name="Filters[0].Column"]', 'itemsItemNumber');
    await g.selectOption('select[name="Filters[0].Operator"]', 'ExactlyMatches').catch(() => {});
    const valueBox = g.locator('input[name="Filters[0].Value"]');
    if (await valueBox.count()) await valueBox.fill('zz_no_such_item_999');
    await Promise.all([page.waitForResponse((r) => r.url().includes('/CampaignManager/GetData'), { timeout: 20_000 }), g.click('#btnRetrieveItems')]);
    await page.waitForTimeout(3000);
    const text = (await g.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`NO RECORDS shown: ${text.includes('No records to view')}`);
    if (!text.includes('No records to view')) deviation('FRS.RBR.CM.105.3', '"No records to view"', 'message not found');
    expect.soft(text).toContain('No records to view');
  });

  await test.step('106.3: with Exactly Matches the Value becomes a drop-down for some columns (e.g. Label Type, Approved By)', async () => {
    const columns = (await g.locator('select[name="Filters[0].Column"] option').evaluateAll((os) => os.map((o: any) => `${o.value}|${o.text}`)));
    console.log(`FILTER COLUMNS (${columns.length}): ${JSON.stringify(columns.slice(0, 12))}`);
    const dropdownColumns: string[] = [];
    for (const c of columns.slice(0, 40)) {
      const [value, label] = c.split('|');
      if (!value) continue;
      await g.selectOption('select[name="Filters[0].Column"]', value).catch(() => {});
      await g.selectOption('select[name="Filters[0].Operator"]', 'ExactlyMatches').catch(() => {});
      await page.waitForTimeout(300);
      if ((await g.locator('select[name="Filters[0].Value"]').count()) > 0) dropdownColumns.push(label);
    }
    console.log(`EXACTLY MATCHES DROPDOWN COLUMNS: ${JSON.stringify(dropdownColumns)}`);
    if (dropdownColumns.length === 0) deviation('FRS.RBR.CM.106.3', 'a drop-down Value for certain columns with Exactly Matches', 'none of the first 40 columns');
  });

  await test.step('106.4: a second filter offers AND / OR', async () => {
    // row 0 must be a complete filter first (the previous step left it on a drop-down column with no value)
    await g.selectOption('select[name="Filters[0].Column"]', 'itemsItemNumber');
    await g.selectOption('select[name="Filters[0].Operator"]', 'Contains');
    await g.fill('input[name="Filters[0].Value"]', 'MBBQ');
    await g.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click() /* the span is the real click target (a click on the wrapper adds nothing) */;
    await page.waitForTimeout(800);
    console.log('SECOND ROW SELECTS ' + JSON.stringify(await g.locator('.criteriaFilter-Filter select').evaluateAll((els) => els.map((e: any) => e.name + ':' + Array.from(e.options).slice(0, 4).map((o: any) => o.text).join('/')))));
    const conj = await g.locator('select[name$=".AndOr"], select[name*="AndOr"], .criteriaFilter-Filter select:has(option:text-is("And"))').evaluateAll((els) => els.map((e: any) => ({ name: e.name, options: Array.from(e.options).map((o: any) => o.text) })));
    console.log(`AND/OR selects: ${JSON.stringify(conj)}`);
    const ok = conj.some((c) => c.options.some((o: string) => /^and$/i.test(o)) && c.options.some((o: string) => /^or$/i.test(o)));
    if (!ok) deviation('FRS.RBR.CM.106.4', 'AND / OR between filters', JSON.stringify(conj));
    expect.soft(ok).toBe(true);
  });
});
