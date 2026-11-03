// Label History Inquiry: the positive barcode scan (LHI.190725.U.1, U.2, U.4, F.2.3, F.2.4, F.4.2 - F.4.5). A scan only finds prints of an item that ALSO has a Master Data record whose Primary DI is the
// scanned GTIN (stored procedure: `(RobarMasterData.Primary_DI_Number = <gtin> OR ItemNumber = <item>) AND Lot = <lot> AND PrintStatus = 'Printed'`, join on item number + version). None of the
// earlier fixtures had one, so with the user's OK (2026-11-03) this spec creates ONE APPROVED Master Data record (schema RobarMasterData, version 0, Primary DI `00841646990001`) for the CL serial item
// CLSerItm8455875 - the item of the real print PID_9F2A5C6B... (lot CLSPL395711, item version 0, Printed; test-data/phi-fixture.json `usrSerial`). It is created only when missing (looked up first), so a
// later run reuses it. Why this item: its serial template (CLSerTpl...) binds no md_* share names, so an approved Master Data record cannot change how it prints (the MBBQA* items of the Multi Document
// Printing specs are left alone). Master Data records cannot be deleted. Confirmed live 2026-11-03 on TST703 (headless).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { openMenuItem, findFrame } from '../support/robar';
import * as mdm from '../support/master-data';

test.use({ actionTimeout: 20_000 });

const ITEM = 'CLSerItm8455875';
const LOT = 'CLSPL395711';
const ORDER = 'CLSPL395711O';
const DI = '00841646990001';

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

/** Creates the approved Master Data record when the item has none (returns true when THIS call created it). */
async function ensureMasterDataRecord(page: Page): Promise<boolean> {
  let grid = await mdm.openMasterData(page);
  const rows = await mdm.retrieve(page, grid, { column: 'ItemNumber', operator: 'Exactly Matches', value: ITEM, schema: 'RobarMasterData' });
  const n = await rows.count();
  console.log(`Master Data records of ${ITEM}: ${n}`);
  if (n > 0) return false;
  await mdm.createValidRecord(page, grid, { itemNumber: ITEM, description: 'CL item for Label History barcode tests', primaryDi: DI, brandName: 'CL Brand' });
  grid = await mdm.backToGrid(page, grid);
  await mdm.retrieve(page, grid, { column: 'ItemNumber', operator: 'Exactly Matches', value: ITEM, expectRows: 1 });
  await mdm.checkRows(grid, [ITEM]);
  await mdm.openBulkAction(grid, 'actMassApprove');
  const job = await mdm.openJobPage(page, 'MasterDataMassApprove/JobSubmission');
  await mdm.fillJobSignature(job, `CL Label History barcode record ${Date.now().toString().slice(-6)}`, 'General Approval');
  const r = await mdm.submitJobAndRead(page, job, 'MasterDataMassApprove/JobDetail');
  console.log('approve job:', r.status);
  expect(r.status).toBe('Completed');
  return true;
}

async function openLhi(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Label History Inquiry") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Label History Inquiry');
  const f = await findFrame(page, 'LabelHistory');
  await f.locator('#itemnumber').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  return f;
}

/** Evidence screenshots: set LHI_SHOTS=<folder> to save one PNG per step (page screenshots: no browser address bar). */
let shotNo = 0;
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.LHI_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${String(++shotNo).padStart(2, '0')}_${name}.png`) });
}

async function search(page: Page, f: Frame, v: { barcode?: string; item?: string; lot?: string }, label?: string): Promise<string[]> {
  await f.fill('#barcode', v.barcode ?? '');
  await f.fill('#itemnumber', v.item ?? '');
  await f.fill('#lotnumber', v.lot ?? '');
  if (label) await shot(page, `${label}_typed`);
  await f.click('#btnRetrieveLabelHistory');
  await page.waitForTimeout(5500);
  if (label) await shot(page, `${label}_result`);
  return (await f.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
}

async function closeDetail(page: Page, f: Frame) {
  if (await f.locator('.ui-dialog:visible').count()) await f.locator('.ui-dialog:visible button', { hasText: 'Close' }).first().click().catch(() => {});
  await page.waitForTimeout(500);
}

test('Label History Inquiry: a GS1 barcode scan finds the prints of the item whose Master Data record carries the scanned GTIN', async ({ page }) => {
  test.setTimeout(900_000);
  const createdNow = await ensureMasterDataRecord(page);
  console.log(`approved Master Data record for ${ITEM}: created by this run = ${createdNow}`);

  const f = await openLhi(page);
  let baseline: string[] = [];

  await test.step('Baseline: the item + lot search returns the print(s) of the lot (F.3.3)', async () => {
    baseline = await search(page, f, { item: ITEM, lot: LOT }, 'step1_item_and_lot_search');
    console.log(`${ITEM} / ${LOT}: ${baseline.length} row(s)`, JSON.stringify(baseline).slice(0, 400));
    expect(baseline.length).toBeGreaterThanOrEqual(1);
    for (const r of baseline) expect(r).toContain(ORDER);
    await closeDetail(page, f);
  });

  await test.step('Scan 01<GTIN>10<lot>: the same prints come back through the Master Data DI (U.1, U.2, F.4.2 - F.4.4)', async () => {
    const rows = await search(page, f, { barcode: `01${DI}10${LOT}` }, 'step2_gs1_scan_01_gtin_10_lot');
    console.log('scan result rows:', rows.length);
    expect(rows.length).toBe(baseline.length);
    expect(rows.join('|')).toBe(baseline.join('|'));
    console.log('fields after the scan: item =', JSON.stringify(await f.inputValue('#itemnumber')), '| lot =', JSON.stringify(await f.inputValue('#lotnumber')));
    expect(await f.inputValue('#lotnumber'), 'the lot parsed from the scan is shown (F.2.4)').toBe(LOT);
    if ((await f.inputValue('#itemnumber')) !== ITEM) deviation(`LHI.190725.F.2.4 the Item Number derived from a scan is not shown: after scanning the GTIN of ${ITEM} the Item Number field is "${await f.inputValue('#itemnumber')}" (only the Lot Number is filled)`);
    if (rows.length === 1) await expect(f.locator('.ui-dialog:visible .ui-dialog-title')).toHaveText('View Detail', { timeout: 10_000 }); // F.5.3 also for a scan
    await closeDetail(page, f);
  });

  await test.step('Other AIs and the ^ terminator are skipped over: 11 / 17 dates, 10 lot with ^, 21 serial (F.4.4, F.4.5)', async () => {
    const barcode = `01${DI}11251014` + `17261015` + `10${LOT}^` + `21SER123`;
    const rows = await search(page, f, { barcode }, 'step3_gs1_scan_with_dates_terminator_serial');
    console.log(`scan ${barcode}: ${rows.length} row(s)`);
    expect(rows.join('|')).toBe(baseline.join('|'));
    expect(await f.inputValue('#lotnumber')).toBe(LOT);
    await closeDetail(page, f);
  });

  await test.step('A wrong GTIN or a wrong lot finds nothing', async () => {
    expect(await search(page, f, { barcode: `0100841646990099` + `10${LOT}` }, 'step4a_unknown_gtin'), 'unknown GTIN').toEqual([]);
    expect(await search(page, f, { barcode: `01${DI}10NOSUCHLOT${Date.now().toString().slice(-5)}` }, 'step4b_unknown_lot'), 'unknown lot').toEqual([]);
    await expect(f.locator('.ui-paging-info').first()).toContainText('No records to view');
  });

  await test.step('The Enter key in the scan field submits the scan (F.2.3)', async () => {
    await f.fill('#itemnumber', '');
    await f.fill('#lotnumber', '');
    await f.fill('#barcode', `01${DI}10${LOT}`);
    await f.locator('#barcode').press('Enter');
    await page.waitForTimeout(5500);
    expect((await f.locator('tr.jqgrow').allInnerTexts()).length).toBe(baseline.length);
    await closeDetail(page, f);
  });

  await test.step('A scan that cannot be parsed (starts with +) returns unrelated records with a blank lot', async () => {
    const rows = await search(page, f, { barcode: `+${DI}${LOT}` }, 'step6_unparsable_scan_starting_with_plus');
    console.log('scan starting with "+":', rows.length, 'row(s); lot field =', JSON.stringify(await f.inputValue('#lotnumber')), '|', JSON.stringify(rows));
    // fExtractGTINLotFromBarcode returns nothing for a '+' barcode, the procedure then compares with '' (GTIN '' = Primary_DI '' / item '' and Lot ''), so prints with a BLANK lot come back
    expect(rows.every((r) => !r.includes(LOT)), 'none of them is the scanned lot').toBe(true);
    if (rows.length > 0) deviation(`LHI.190725.F.3.2 / F.4.3 a barcode the parser cannot read (here one starting with +) is not rejected: GetLabelHistoryInquiryData compares the empty GTIN / lot with blank columns and returns ${rows.length} unrelated Printed record(s) (prints with a blank lot) instead of no records`);
  });
});
