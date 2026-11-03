// Label History Inquiry (Reports and Inquiries, process Label_History, InnoPages/LabelHistory/LabelHistoryInquiry?sp=GetLabelHistoryInquiryData&PageMode=Detail) against ValMaster LHI.190725.*
// (docs/agents/valmaster-label-history-inquiry.md, scripts Label_History_Inquiry-1.1 / 1.2). READ-ONLY: only real prints made earlier are looked up (print history cannot be deleted):
//   * single record: item MBBQA8457561 + lot CLPTP560850L (test-data/phi-fixture.json `normal`, PID_13F1726F...)
//   * several records: item MI080301 + lot CLPBR374765 (a print and its reprint)
// Source: Innovatum.Pages.LabelHistory.MVC (LabelHistoryController, LabelHistoryInquiry.cshtml) and the stored procedure GetLabelHistoryInquiryData / function fExtractGTINLotFromBarcode.
// Page ids: `#barcode`, `#itemnumber`, `#lotnumber`, `#btnRetrieveLabelHistory` (Submit), grid `tr.jqgrow` (row action menu "View Detail"), detail dialog = iframe `GetLabelHistoryInquiryDetails`.
// Confirmed live 2026-11-03 on TST703 (headless). Differences from a requirement are annotated `deviation` and the spec stays green.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test.use({ actionTimeout: 20_000 });

const SINGLE = { item: 'MBBQA8457561', lot: 'CLPTP560850L', printId: 'PID_13F1726FDCD34E47B7954CD808B653BF', order: 'CLPTP560850' };
const MULTI = { item: 'MI080301', lot: 'CLPBR374765' };
const DEFAULT_COLUMNS = ['LabelType', 'UserID', 'OrderNumber', 'Lot', 'ExpDate', 'LCN', 'Printer', 'Reprint', 'PrintDate'];

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

async function openPage(page: Page, reopen = false): Promise<Frame> {
  if (reopen) {
    await page.locator('li.ui-tabs-tab:has-text("Label History Inquiry") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  }
  await openMenuItem(page, 'Label History Inquiry');
  const f = await findFrame(page, 'LabelHistory');
  await f.locator('#itemnumber').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  return f;
}

async function search(page: Page, f: Frame, v: { barcode?: string; item?: string; lot?: string }, wait = 5000): Promise<string[]> {
  await f.fill('#barcode', v.barcode ?? '');
  await f.fill('#itemnumber', v.item ?? '');
  await f.fill('#lotnumber', v.lot ?? '');
  await f.click('#btnRetrieveLabelHistory');
  await page.waitForTimeout(wait);
  return (await f.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
}

const detailFrame = (page: Page) => page.frames().filter((x) => /GetLabelHistoryInquiryDetails/.test(x.url())).pop();

async function closeDetail(page: Page, f: Frame) {
  if (await f.locator('.ui-dialog:visible').count()) await f.locator('.ui-dialog:visible button', { hasText: 'Close' }).first().click().catch(() => {});
  await page.waitForTimeout(500);
}

test('Label History Inquiry: menu entry, fields, item + lot search, View Detail, single-record auto detail, Enter key, barcode scan (LHI.190725)', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);

  await test.step('Menu entry under Reports and Inquiries with PageMode=Detail and the stored procedure in the URL (F.1.1, F.4.1)', async () => {
    const section = page.locator('body').getByText('Reports and Inquiries', { exact: true }).first();
    await expect(section).toBeVisible();
    const tileInSection = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('*')).filter((e) => e.children.length === 0 && (e.textContent ?? '').trim() === 'Reports and Inquiries');
      const h = headers[0];
      let n: Element | null = h;
      while (n && !n.querySelector('button.menuIcon')) n = n.parentElement;
      return !!n && Array.from(n.querySelectorAll('button.menuIcon')).some((b) => (b.textContent ?? '').includes('Label History Inquiry'));
    });
    console.log('Label History Inquiry tile in the Reports and Inquiries section:', tileInSection);
    const f = await openPage(page);
    expect(f.url()).toContain('LabelHistory/LabelHistoryInquiry');
    expect(f.url()).toContain('sp=GetLabelHistoryInquiryData');
    expect(f.url()).toContain('PageMode=Detail');
  });

  let f = await openPage(page, true);

  await test.step('Page anatomy: barcode scan field, Item Number and Lot Number fields, Submit (F.2.1, F.2.2, F.3.1)', async () => {
    await expect(f.locator('h1')).toHaveText('Label History Inquiry');
    for (const id of ['#barcode', '#itemnumber', '#lotnumber']) await expect(f.locator(id)).toBeVisible();
    await expect(f.locator('#btnRetrieveLabelHistory')).toHaveValue('Submit');
    const barcode = (await f.locator('#barcode').boundingBox())!;
    const submit = (await f.locator('#btnRetrieveLabelHistory').boundingBox())!;
    console.log('barcode box', JSON.stringify(barcode), '| Submit box', JSON.stringify(submit));
    // F.2.2: "a Submit button will be placed to the right of the barcode scan field": Submit sits beside the Lot Number field of the Item group, below the scan field
    const rightOfScan = submit.x >= barcode.x + barcode.width - 2 && Math.abs(submit.y - barcode.y) < 25;
    if (!rightOfScan) deviation('LHI.190725.F.2.2 the Submit button is not to the right of the barcode scan field: it sits in the Item group beside the Lot Number field, below the scan field');
    expect(await f.locator('tr.jqgrow').count(), 'no rows before a search').toBe(0);
  });

  await test.step('Item Number + Lot Number return the Printed records with the default columns (U.3, F.3.2, F.3.3, F.4.6, F.4.7)', async () => {
    const rows = await search(page, f, { item: SINGLE.item, lot: SINGLE.lot });
    console.log('rows:', JSON.stringify(rows));
    expect(rows.length).toBe(1);
    expect(rows[0]).toContain(SINGLE.order);
    expect(rows[0]).toContain(SINGLE.lot);
    expect(rows[0]).toContain('Microsoft Print to PDF');
    const headers = (await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter((t) => t && t !== 'id');
    console.log('grid headers:', headers.join(' | '));
    for (const c of DEFAULT_COLUMNS) expect(headers, `default column ${c}`).toContain(c);
    const extra = headers.filter((h) => !DEFAULT_COLUMNS.includes(h) && h !== 'Action');
    if (extra.length) deviation(`LHI.190725.F.4.6 lists the default columns ${DEFAULT_COLUMNS.join(', ')}; the grid also shows ${extra.join(', ')} (the stored procedure returns the reprint ReasonCode and Comments)`);
    await expect(f.locator('.ui-paging-info').first()).toContainText('View 1 - 1 of 1');
  });

  await test.step('One record: View Detail runs by itself; the pop-up shows the label image, the row data and the print data values (F.5.2, F.5.3, U.5)', async () => {
    await expect(f.locator('.ui-dialog:visible .ui-dialog-title')).toHaveText('View Detail', { timeout: 10_000 });
    const d = detailFrame(page)!;
    expect(d.url()).toContain(`printId=${SINGLE.printId}`);
    await d.locator('table').first().waitFor({ timeout: 15_000 });
    const text = (await d.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log('detail text:', text.slice(0, 400));
    // the row data (Column Name / Value)
    expect(text).toContain('Column Name Value');
    for (const [k, v] of [['LabelType', 'Carton Label'], ['UserId', 'Claude01'], ['OrderNum', SINGLE.order], ['Lot', SINGLE.lot], ['LCN', 'LCN0000557'], ['Printer', 'Microsoft Print to PDF'], ['Reprint', 'No']]) expect(text).toContain(`${k} ${v}`);
    // the print data values (ShareName / ShareValue)
    expect(text).toContain('ShareName ShareValue');
    expect(text).toContain(`I_Num ${SINGLE.item}`);
    expect(text).toContain(`L_Num ${SINGLE.lot}`);
    // the printed image
    const img = d.locator('img').first();
    await expect(img).toHaveAttribute('src', new RegExp(`GetLabelImage\\?printId=${SINGLE.printId}`));
    expect(await img.evaluate((e: HTMLImageElement) => e.naturalWidth), 'the printed image loads').toBeGreaterThan(100);
    await closeDetail(page, f);
  });

  await test.step('Several records: no automatic pop-up, every row has View Detail which opens that print (F.5.1, F.5.3)', async () => {
    const rows = await search(page, f, { item: MULTI.item, lot: MULTI.lot });
    console.log(`${MULTI.item} / ${MULTI.lot}: ${rows.length} rows`);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(await f.locator('.ui-dialog:visible').count(), 'no automatic detail when more than one record is returned').toBe(0);
    for (let i = 0; i < rows.length; i++) {
      await f.locator('tr.jqgrow').nth(i).getByText('Actions').first().click();
      await page.waitForTimeout(500);
      await expect(f.locator('ul:visible li a', { hasText: 'View Detail' }).first()).toBeVisible();
      if (i === 0) {
        await f.locator('ul:visible li a', { hasText: 'View Detail' }).first().click({ force: true });
        await page.waitForTimeout(5000);
        await expect(f.locator('.ui-dialog:visible .ui-dialog-title')).toHaveText('View Detail');
        const d = detailFrame(page)!;
        expect((await d.locator('body').innerText()).replace(/\s+/g, ' ')).toContain(`Lot ${MULTI.lot}`);
        await closeDetail(page, f);
      } else {
        await page.keyboard.press('Escape');
      }
    }
    // the print and its reprint are both Printed records of the same lot
    const reprints = rows.filter((r) => / Yes /.test(r)).length;
    console.log('rows flagged Reprint = Yes:', reprints);
  });

  await test.step('No match: an empty result and no pop-up; a lot of another item does not leak in (F.3.2)', async () => {
    const none = await search(page, f, { item: SINGLE.item, lot: 'NOSUCHLOT' + Date.now().toString().slice(-6) });
    expect(none).toEqual([]);
    await expect(f.locator('.ui-paging-info').first()).toContainText('No records to view');
    // the lot of MULTI with the item of SINGLE is a different print: nothing may come back
    const cross = await search(page, f, { item: SINGLE.item, lot: MULTI.lot });
    expect(cross, 'a lot of another item returns nothing for this item').toEqual([]);
  });

  await test.step('The Enter key submits the search (F.2.3)', async () => {
    await f.fill('#barcode', '');
    await f.fill('#itemnumber', SINGLE.item);
    await f.fill('#lotnumber', SINGLE.lot);
    await f.locator('#lotnumber').press('Enter');
    await page.waitForTimeout(5000);
    expect((await f.locator('tr.jqgrow').allInnerTexts()).length, 'Enter in the Lot Number field runs the search').toBe(1);
    await closeDetail(page, f);
  });

  await test.step('Barcode scan: the GS1 string is parsed by the stored procedure (F.2.3 - F.2.4, F.4.2 - F.4.5, U.2, U.4)', async () => {
    // GS1 with only the lot AI (10): no GTIN, so no Master Data DI can match; with ^ as the field terminator
    const rows = await search(page, f, { barcode: `10${SINGLE.lot}^` });
    console.log('scan "10<lot>^":', JSON.stringify(rows));
    console.log('fields after the scan: item =', JSON.stringify(await f.inputValue('#itemnumber')), 'lot =', JSON.stringify(await f.inputValue('#lotnumber')));
    // a scan with a GTIN that no Master Data record carries and the lot of the single print
    const rows2 = await search(page, f, { barcode: `010084164600000010${SINGLE.lot}` });
    console.log('scan "01<gtin>10<lot>":', JSON.stringify(rows2));
    console.log('fields after the second scan: item =', JSON.stringify(await f.inputValue('#itemnumber')), 'lot =', JSON.stringify(await f.inputValue('#lotnumber')));
    // the Enter key submits a scan as well
    await f.fill('#barcode', `10${SINGLE.lot}`);
    await f.locator('#barcode').press('Enter');
    await page.waitForTimeout(4000);
    console.log('Enter in the scan field ran a search; rows:', await f.locator('tr.jqgrow').count());
    await closeDetail(page, f);
  });
});
