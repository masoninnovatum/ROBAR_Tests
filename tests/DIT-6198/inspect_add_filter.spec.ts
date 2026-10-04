import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test('inspect Add Filter widget', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await openMenuItem(page, 'Master Data');
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);

  const before = await frame.locator('body').innerHTML();
  console.log('=== criteriaFilter area BEFORE click ===');
  const beforeMatch = before.match(/<div[^>]*criteriaFilter[^>]*>[\s\S]{0,800}/);
  console.log(beforeMatch ? beforeMatch[0] : '(no criteriaFilter div found)');

  await frame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(3000);

  console.log('=== all table elements with id, and jQuery jqGrid check ===');
  const gridCheck = await frame.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table[id]')).map((t) => ({ id: t.id, cls: t.className }));
    const jq = (window as any).$ || (window as any).jQuery;
    let jqGridData: any = null;
    let jqGridRowCount: any = null;
    if (jq) {
      for (const t of tables) {
        try {
          const data = jq('#' + t.id).jqGrid('getGridParam', 'data');
          if (data) { jqGridData = { tableId: t.id, count: data.length, first: data[0], sampleKeys: data[0] ? Object.keys(data[0]) : null }; break; }
        } catch (e) { /* not a jqGrid */ }
      }
    }
    return { tables, jqGridData };
  }).catch((e) => ({ error: String(e) }));
  console.log(JSON.stringify(gridCheck, null, 1));

  await frame.locator('text=Add Filter').first().click();
  await page.waitForTimeout(800);

  const after = await frame.locator('body').innerHTML();
  console.log('=== criteriaFilter area AFTER click ===');
  const afterMatch = after.match(/<div[^>]*criteriaFilter[^>]*>[\s\S]{0,1500}/);
  console.log(afterMatch ? afterMatch[0] : '(no criteriaFilter div found)');

  console.log('=== all input[type=text] on page after click ===');
  const inputs = await frame.locator('input[type="text"]').all();
  for (const inp of inputs) {
    console.log(await inp.evaluate((el: any) => el.outerHTML));
  }

  console.log('=== knockout viewmodel top-level keys ===');
  const vmKeys = await frame.evaluate(() => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    return Object.keys(vm).filter((k) => typeof vm[k] !== 'function' || k.toLowerCase().includes('filter'));
  });
  console.log(JSON.stringify(vmKeys));

  console.log('=== retrieved data count and a sample item number ===');
  const sample = await frame.evaluate(() => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    const items = vm.masterDataItems ? vm.masterDataItems() : (vm.items ? vm.items() : null);
    return { hasMasterDataItems: !!vm.masterDataItems, count: items ? items.length : null, sample: items && items[0] ? Object.keys(items[0]) : null };
  }).catch((e) => ({ error: String(e) }));
  console.log(JSON.stringify(sample));

  console.log('=== filterSet structure ===');
  const filterSetInfo = await frame.evaluate(() => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    const fs = vm.filterSet;
    const keys = Object.keys(fs);
    const out: Record<string, string> = {};
    for (const k of keys) {
      try {
        const v = fs[k];
        out[k] = typeof v === 'function' ? (ko.isObservable(v) ? 'observable, value=' + JSON.stringify(v()) : 'function') : typeof v;
      } catch (e) {
        out[k] = 'error: ' + String(e);
      }
    }
    return out;
  }).catch((e) => ({ error: String(e) }));
  console.log(JSON.stringify(filterSetInfo, null, 1));

  console.log('=== gridModel.queryUrl and top-level function names ===');
  const urlInfo = await frame.evaluate(() => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    const g = vm.gridModel;
    return {
      queryUrl: g.queryUrl,
      topLevelFns: Object.keys(vm).filter((k) => typeof vm[k] === 'function'),
      ownerKeys: vm.owner ? Object.keys(vm.owner) : null,
    };
  }).catch((e) => ({ error: String(e) }));
  console.log(JSON.stringify(urlInfo, null, 1));

  console.log('=== actual grid rows currently in DOM (count + first/last item numbers) ===');
  const rowInfo = await frame.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#gridMasterData tbody tr, table.jqgrid tbody tr, tr[id]'));
    return { totalTrCount: document.querySelectorAll('tr').length, gridSpecificRows: rows.length };
  });
  console.log(JSON.stringify(rowInfo));

  console.log('=== gridModel structure ===');
  const gridInfo = await frame.evaluate(() => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    const g = vm.gridModel;
    const keys = Object.keys(g);
    const out: Record<string, string> = {};
    for (const k of keys) {
      try {
        const v = g[k];
        out[k] = typeof v === 'function' ? (ko.isObservable(v) ? 'observable, value=' + JSON.stringify(v()).slice(0, 200) : 'function') : typeof v;
      } catch (e) {
        out[k] = 'error: ' + String(e);
      }
    }
    return out;
  }).catch((e) => ({ error: String(e) }));
  console.log(JSON.stringify(gridInfo, null, 1));
});
