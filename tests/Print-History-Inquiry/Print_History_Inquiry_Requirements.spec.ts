// Print History Inquiry re-checked against ValMaster (module "Print History Inquiry", 26 active rows: docs/agents/valmaster-print-history-inquiry.md; live 2026-10-15, headless, TST703 7.0.3.20260, seed user Claude01).
// READ-ONLY: nothing is printed (Exact Reprint / Regenerate are only opened). Uses real prints made earlier (test-data/phi-fixture.json; print history cannot be deleted).
// Differences from a requirement are annotated `deviation <id>` and the spec stays green. The page is a Dynamic UI grid (definition PrintHistory, gate process PrintHist_Login, view v_PrintHistory):
// most FRS-15.x rows describe the old page (Select Action drop-down + Do Action button, radio buttons, Reset All), so wording differences are expected.

import { test, expect } from '@playwright/test';
import { skipUnlessGlobal } from '../support/preconditions';
import type { Frame, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, BASE_URL } from '../support/robar';
import * as du from '../support/dynamic-ui';

test.use({ actionTimeout: 20_000 });

const FX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'test-data', 'phi-fixture.json'), 'utf8')) as {
  normal: { printId: string; lot: string; order: string; item: string; copies: number; printer: string };
  usrSerial: { printId: string; serials: string[] };
  serCounter: { printId: string };
};

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

async function openPhi(page: Page): Promise<Frame> {
  const f = await du.reopenDynamicUi(page, 'Print History Inquiry');
  await du.clearCriteria(page, f);
  return f;
}

async function retrieveBy(page: Page, f: Frame, column: string, operator: string, value: string): Promise<string[]> {
  const rows = await du.retrieve(page, f, column, operator, value, { expectRows: false });
  await page.waitForTimeout(3000);
  return du.rows(f).catch(() => rows);
}

/** Clicks a row action by caption and returns the popup page it opens (if any). */
async function rowAction(page: Page, context: BrowserContext, f: Frame, rowText: string, caption: string): Promise<Page | undefined> {
  const before = context.pages().length;
  await f.locator('tr.jqgrow').filter({ hasText: rowText }).first().getByText('Actions').first().click();
  await page.waitForTimeout(600);
  await f.locator('ul:visible li a').filter({ hasText: new RegExp('^\\s*' + caption) }).first().click({ force: true });
  await page.waitForTimeout(7000);
  const pages = context.pages();
  return pages.length > before ? pages[pages.length - 1] : undefined;
}

test('Print History Inquiry vs ValMaster: security entry, search criteria, results, row actions, serialization (read-only)', async ({ page, context, browser }) => {
  await skipUnlessGlobal(browser, 'PrintEntityRequired', 'Innovatum', 'N', 'this spec covers the PrintEntityRequired = N behavior (entity-scoped lists and the default entity differ with Y)');
  test.setTimeout(900_000);
  await login(page);
  let f = await openPhi(page);

  await test.step('FRS-15.1.1.1: no access without logging in (direct URLs in a fresh session: the grid data, the See Detail page, the label image)', async () => {
    const ctx = await browser.newContext();
    const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const grid = await ctx.request.post('http://vmsrvtst703/InnoPages/DynamicUI/GridSessionGetPage', { data: {}, failOnStatusCode: false, maxRedirects: 0, headers: { 'Content-Type': 'application/json' } });
    console.log(`NO SESSION grid data: HTTP ${grid.status()}`);
    expect.soft(/"Rows"/.test(await grid.text()), 'grid data is not served without a session').toBe(false);
    const detail = await ctx.request.get(`http://vmsrvtst703/Innovatum/ROBAR/PrintHistInquiry/SeeDetail.aspx?PrintID=${FX.normal.printId}&CultureName=en`, { failOnStatusCode: false, maxRedirects: 0 });
    const detailText = strip(await detail.text());
    console.log(`NO SESSION See Detail: HTTP ${detail.status()} ${detailText.slice(0, 160)}`);
    const detailServed = detail.status() === 200 && detailText.includes(FX.normal.printId);
    if (detailServed) deviation('FRS-15.1.1.1', 'a user cannot reach Print History pages by URL without logging in (authority verification)', 'SeeDetail.aspx answers HTTP 200 WITHOUT a session and shows the print job details (user, workstation, item, lot, order, dates and the server UNC path of the label image)');
    for (const [name, url] of [
      ['Serialization Detail', `http://vmsrvtst703/Innovatum/SerialNumMgmt/SerializationDetail?printId=${FX.normal.printId}`],
      ['Print Data Values', `http://vmsrvtst703/Innovatum/PrintDataValues/PrintDataValues?printId=${FX.normal.printId}`],
    ] as const) {
      const r = await ctx.request.get(url, { failOnStatusCode: false, maxRedirects: 0 });
      console.log(`NO SESSION ${name}: HTTP ${r.status()}`);
      expect.soft(r.status(), `${name} redirects to the login without a session`).toBe(302);
    }
    const img = await ctx.request.get(`http://vmsrvtst703/Innovatum/PrintedImages/202610/${FX.normal.printId}.JPG`, { failOnStatusCode: false, maxRedirects: 0 });
    console.log(`NO SESSION label image: HTTP ${img.status()} ${(await img.body()).length} bytes`);
    if (img.status() === 200) deviation('observation (FRS-15.1.1.1)', 'label images are only available to authorized users', 'the label image file under /Innovatum/PrintedImages/<yyyymm>/ is served to anyone who knows the print id (static IIS file, no session needed)');
    await ctx.close();
  });

  await test.step('FRS-15.1.2.1 / 15.1.7.1 / URS-15.1.2: Column, Operator and Value controls; the Column list holds the Print History columns', async () => {
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
    await page.waitForTimeout(500);
    const cols = (await f.locator('select[name="dvFilters[0].Column"] option').allInnerTexts()).map((t) => t.trim());
    const ops = (await f.locator('select[name="dvFilters[0].Operator"] option').allInnerTexts()).map((t) => t.trim());
    console.log(`COLUMNS ${cols.length}: ${JSON.stringify(cols)}\nOPERATORS ${JSON.stringify(ops)}`);
    for (const c of ['PrintID', 'ItemNumber', 'Lot', 'UserID', 'PrintDate', 'Reprint', 'SerialNum', 'PrintStatus', 'LabelType']) expect.soft(cols, `column ${c}`).toContain(c);
    expect(await f.locator('input[name="dvFilters[0].Value"]').count()).toBe(1);
    expect(ops).toEqual(expect.arrayContaining(['Contains', 'Exactly Matches', 'Greater Than', 'Less Than', 'Is Blank']));
    await du.clearCriteria(page, f);
  });

  await test.step('FRS-15.1.7.2: a second filter can be added with an And / Or operator, and removed again', async () => {
    for (let i = 0; i < 2; i++) { await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click(); await page.waitForTimeout(500); }
    const andOr = (await f.locator('select[name="dvFilters[0].AndOr"] option').allInnerTexts()).map((t) => t.trim());
    expect(andOr).toEqual(['And', 'Or']);
    expect(await f.locator('select[name="dvFilters[1].Column"]').count()).toBe(1);
    await f.locator('select[name="dvFilters[0].Column"]').selectOption('Lot');
    await f.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: 'Contains' });
    await f.locator('input[name="dvFilters[0].Value"]').fill(FX.normal.lot);
    await f.locator('select[name="dvFilters[0].AndOr"]').selectOption({ label: 'And' });
    await f.locator('select[name="dvFilters[1].Column"]').selectOption('ItemNumber');
    await f.locator('select[name="dvFilters[1].Operator"]').selectOption({ label: 'Exactly Matches' });
    await f.locator('input[name="dvFilters[1].Value"]').fill(FX.normal.item);
    await f.click('#btnRetrieveData');
    await page.waitForTimeout(6000);
    const and = await du.rows(f);
    // the same two filters joined with Or and a value that matches nothing in the first: rows must be a superset
    await f.locator('select[name="dvFilters[0].Value"], input[name="dvFilters[0].Value"]').first().fill('NOSUCHLOT123');
    await f.locator('select[name="dvFilters[0].AndOr"]').selectOption({ label: 'Or' });
    await f.click('#btnRetrieveData');
    await page.waitForTimeout(6000);
    const or = await du.rows(f);
    console.log(`AND rows ${and.length}, OR rows ${or.length}`);
    expect.soft(and.length, 'Lot AND Item finds the fixture print').toBeGreaterThan(0);
    expect.soft(or.length, 'NOSUCHLOT123 OR Item finds the item rows').toBeGreaterThan(0);
    await du.clearCriteria(page, f);
    expect(await f.locator('select[name="dvFilters[1].Column"]').count(), 'Remove drops the filter rows').toBe(0);
  });

  await test.step('FRS-15.1.7.5: the Value box is type-sensitive (a date picker / number box for date and number columns)', async () => {
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
    await page.waitForTimeout(500);
    const info: Record<string, string> = {};
    for (const col of ['Lot', 'PrintDate', 'Copies', 'ExpDate']) {
      await f.locator('select[name="dvFilters[0].Column"]').selectOption(col);
      await page.waitForTimeout(400);
      info[col] = await f.locator('.criteriaFilter-Filter').first().evaluate((el) => `${el.querySelector('.hasDatepicker') ? 'datepicker' : ''}${(el.querySelector('input[name$=".Value"]') as HTMLInputElement | null)?.type ?? 'none'}`);
    }
    console.log(`VALUE CONTROL types ${JSON.stringify(info)}`);
    if (!info.PrintDate.includes('datepicker')) deviation('FRS-15.1.7.5', 'the Value criteria field is type-sensitive (date column -> date control)', `PrintDate Value box is a plain ${info.PrintDate} input like the text columns`);
    await du.clearCriteria(page, f);
  });

  await test.step('FRS-15.1.7.4: a "Reset All" button clears the criteria and the results', async () => {
    const buttons = await f.locator('input[type=button]:visible, button:visible').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value || e.textContent?.trim() || ''));
    console.log(`VISIBLE BUTTONS ${JSON.stringify(buttons)}`);
    if (!buttons.some((b) => /reset/i.test(b))) deviation('FRS-15.1.7.4', 'a "Reset All" button', `no Reset button on the page (buttons: ${JSON.stringify(buttons)}); criteria rows are removed with their Remove links`);
  });

  await test.step('URS-15.1.7: Retrieve Data returns the right records (Exactly Matches on PrintID)', async () => {
    const rows = await retrieveBy(page, f, 'PrintID', 'Exactly Matches', FX.normal.printId);
    console.log(`PRINTID ROWS ${JSON.stringify(rows)}`);
    expect(rows.length, 'exactly one record for that print id').toBe(1);
    const t = rows[0];
    for (const v of [FX.normal.lot, FX.normal.order, FX.normal.item, FX.normal.printer, 'Printed']) expect.soft(t, `record holds ${v}`).toContain(v);
    // header / cell alignment (DIT 2026-10-12: the grid is shifted by one column)
    const headers = (await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((h) => h.trim()).filter(Boolean);
    const firstCell = (await f.locator('tr.jqgrow').first().locator('td').allInnerTexts()).map((c) => c.trim());
    const entityIdx = headers.indexOf('PrintEntity');
    const underEntity = firstCell.find((c, i) => i === entityIdx + 1) ?? firstCell[entityIdx];
    console.log(`HEADER/CELL ALIGNMENT: PrintEntity header index ${entityIdx}; cells[0..4]=${JSON.stringify(firstCell.slice(0, 5))}`);
    if (!/^ROBAR$/.test(underEntity ?? '') && /PrintID\|\|SEP/.test(firstCell.join('|'))) deviation('FRS-15.1.7.1 / URS-15.1.7', 'each cell sits under its own column header', 'cells are shifted by one column: the raw key "PrintID||SEP||PID_..." sits under PrintEntity, NaN/NaN/NaN dates under UserID');
  });

  await test.step('FRS-15.1.6.1 / URS-15-1.6 / FRS-15.1.7.3: one record at a time; Select Action + Do Action only after results', async () => {
    const radios = await f.locator('tr.jqgrow input[type=radio]').count();
    const checks = await f.locator('tr.jqgrow input[type=checkbox]').count();
    const doAction = await f.getByRole('button', { name: /Do Action/i }).count();
    console.log(`SELECTION CONTROLS radios ${radios}, checkboxes ${checks}, Do Action buttons ${doAction}`);
    if (radios === 0) deviation('FRS-15.1.6.1', 'radio buttons select one result at a time', `no radio buttons (only the grid's header check box): every row has its own Actions menu, so an action always applies to that one record`);
    if (doAction === 0) deviation('FRS-15.1.7.3', 'a "Select Action" drop-down and a "Do Action" button appear after the results', 'no Do Action button: the per-row Actions menu replaces them');
  });

  await test.step('FRS-15.1.3.x / URS-15-1.3: the row Actions menu lists the plug-in actions', async () => {
    await f.locator('tr.jqgrow').first().getByText('Actions').first().click();
    await page.waitForTimeout(600);
    const items = (await f.locator('ul:visible li').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    console.log(`ROW ACTIONS ${JSON.stringify(items)}`);
    for (const a of ['See Detail', 'See Image', 'Exact Reprint', 'Serialization Detail']) expect.soft(items, a).toContain(a);
    if (!items.includes('Regenerate')) deviation('FRS-15.1.3.5', 'an action "Regenerate"', `the menu item is spelled "${items.find((i) => /regn?erate/i.test(i)) ?? '(missing)'}"`);
    expect(items, 'Regenerate action present (any spelling)').toEqual(expect.arrayContaining([expect.stringMatching(/Reg\w*nerate/)]));
    await page.keyboard.press('Escape');
  });

  await test.step('FRS-15.1.3.2: See Image opens the label image', async () => {
    f = await openPhi(page);
    await retrieveBy(page, f, 'PrintID', 'Exactly Matches', FX.normal.printId);
    const pop = await rowAction(page, context, f, FX.normal.printId, 'See Image');
    expect(pop, 'a new window opens').toBeTruthy();
    const url = pop!.url();
    const r = await context.request.get(url, { failOnStatusCode: false });
    console.log(`SEE IMAGE ${url.slice(-90)} HTTP ${r.status()} ${r.headers()['content-type']} ${(await r.body()).length} bytes`);
    expect(r.status()).toBe(200);
    const bytes = await r.body();
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes[0] === 0xff && bytes[1] === 0xd8, 'the file is a JPEG (FF D8)').toBe(true);
    if (!/^image\//.test(r.headers()['content-type'] ?? '')) deviation('observation (FRS-15.1.3.2)', 'the label image is served with an image content type', `content type is "${r.headers()['content-type']}" for the .JPG file (the browser still shows it)`);
    await pop!.close();
  });

  await test.step('FRS-15.1.3.3: See Detail shows the print job details for the print id, with reprint activity when there is any', async () => {
    f = await openPhi(page);
    await retrieveBy(page, f, 'PrintID', 'Exactly Matches', FX.normal.printId);
    const pop = await rowAction(page, context, f, FX.normal.printId, 'See Detail');
    expect(pop, 'a new window opens').toBeTruthy();
    const text = (await pop!.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`SEE DETAIL ${text.slice(0, 700)}`);
    for (const v of ['Print History Detail', FX.normal.printId, FX.normal.item, FX.normal.lot, FX.normal.order, 'UserID: Claude01', 'ItemNumber:']) expect.soft(text, `detail shows ${v}`).toContain(v);
    expect.soft(text, 'a reprint section is part of the detail page').toMatch(/Reprint/i);
    await pop!.close();
  });

  await test.step('Print Data Values (extra action): the share names and values sent to the label', async () => {
    f = await openPhi(page);
    await retrieveBy(page, f, 'PrintID', 'Exactly Matches', FX.normal.printId);
    const pop = await rowAction(page, context, f, FX.normal.printId, 'Print Data Values');
    expect(pop, 'a new window opens').toBeTruthy();
    const text = (await pop!.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const v of ['Print Data Values', 'I_Num', FX.normal.item, 'L_Num', FX.normal.lot]) expect.soft(text, v).toContain(v);
    await pop!.close();
  });

  await test.step('FRS-15.1.3.4 / 15.1.3.5: Exact Reprint and Regenerate open their print screens (nothing is printed)', async () => {
    for (const [caption, urlPart, expectText] of [['Exact Reprint', 'ExactReprintScreen', FX.normal.item], ['Reg', 'PrintScreen', 'Override']] as const) {
      f = await openPhi(page);
      await retrieveBy(page, f, 'PrintID', 'Exactly Matches', FX.normal.printId);
      await f.locator('tr.jqgrow').filter({ hasText: FX.normal.printId }).first().getByText('Actions').first().click();
      await page.waitForTimeout(600);
      await f.locator('ul:visible li a').filter({ hasText: new RegExp('^\\s*' + caption) }).first().click({ force: true });
      let fr: Frame | undefined;
      for (let i = 0; i < 20 && !fr; i++) { fr = page.frames().filter((x) => x.url().includes(urlPart)).pop(); if (!fr) await page.waitForTimeout(1000); }
      expect(fr, `${caption}: the ${urlPart} page opens in the tab`).toBeTruthy();
      await page.waitForTimeout(4000);
      const text = (await fr!.locator('body').innerText()).replace(/\s+/g, ' ');
      console.log(`${caption} SCREEN ${decodeURIComponent(fr!.url()).slice(0, 200)} :: ${text.slice(0, 300)}`);
      expect.soft(text).toContain(expectText);
      await page.locator('li.ui-tabs-tab:has-text("Print History Inquiry") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    }
  });

  await test.step('SER...F5.0.3: Serialization Detail lists Print ID, print date/time, serial #, reprint, user for a serialized print; "No Serials found!" for a plain print', async () => {
    const get = async (pid: string) => {
      const r = await page.request.get(`http://vmsrvtst703/Innovatum/SerialNumMgmt/SerializationDetail?printId=${pid}`, { failOnStatusCode: false });
      return { status: r.status(), text: (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
    };
    const plain = await get(FX.normal.printId);
    console.log(`SERIALIZATION DETAIL plain: HTTP ${plain.status} ${plain.text.slice(-160)}`);
    expect.soft(plain.text).toContain('No Serials found!');
    const ser = await get(FX.usrSerial.printId);
    console.log(`SERIALIZATION DETAIL S_USerial print: HTTP ${ser.status} ${ser.text.slice(0, 200)}`);
    const ok = ser.status === 200 && FX.usrSerial.serials.every((s) => ser.text.includes(s));
    if (!ok) deviation('SER20150611100F5.0.3', 'Serialization Detail lists the serial numbers 001 002 003 with print id, print date/time, reprint and user', `HTTP ${ser.status} ${ser.status === 500 ? '"Runtime Error" server error page (print ids with serial records fail; prints without serials answer "No Serials found!")' : ser.text.slice(0, 120)}`);
  });

  await test.step('DIT #6600 (open): Test Prints are listed in Print History', async () => {
    f = await openPhi(page);
    const byStatus = await retrieveBy(page, f, 'PrintStatus', 'Contains', 'Test');
    const printed = await retrieveBy(page, f, 'PrintStatus', 'Exactly Matches', 'Printed');
    console.log(`PRINTSTATUS Contains Test: ${byStatus.length} rows; Exactly Matches Printed: ${printed.length} rows on the page`);
    if (byStatus.length === 0) deviation('DIT #6600', 'a Test Print (made from Print by Order with the Test box ticked) is listed with its PrintStatus', 'filtering PrintStatus Contains "Test" returns no rows although test prints exist (the forced filter SP_PrintHistoryForcedFilter returns only PrintStatus = Printed when PrintEntityRequired = N)');
  });

  await test.step('URS-15.1.5: an empty result says so', async () => {
    f = await openPhi(page);
    await retrieveBy(page, f, 'PrintID', 'Exactly Matches', 'PID_DOESNOTEXIST');
    const txt = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`EMPTY RESULT: ${txt.slice(-120)}`);
    expect.soft(txt).toMatch(/No records to view/i);
  });

  await test.step('page-level Actions menu (observation)', async () => {
    await f.getByText('Actions', { exact: true }).first().click();
    await page.waitForTimeout(600);
    const items = (await f.locator('ul:visible li').allInnerTexts()).map((t) => t.replace(/document\.getElementById[\s\S]*$/, '').trim()).filter(Boolean);
    console.log(`PAGE ACTIONS ${JSON.stringify(items)}`);
    if (items.includes('Excel Import')) deviation('observation', 'a read-only history inquiry offers Excel Export / Save Search / Load Search / Adjust Page Size', 'the page-level Actions menu also offers "Excel Import" (nothing in ValMaster asks for an import into Print History)');
  });
});

void BASE_URL;
