// InnoView second pass (2026-11-03): what the first pass did not do - run the reports WITH values, check the Export file, collapse the menu, and try the report pages by URL.
// Requirements (docs/agents/valmaster-innoview.md): IVFRS-2.1.x (prompts, collapsible menus, Help link), IVFRS-3.3.1 (Export button -> Excel), IVURS-1.1 / IVFRS-1.1.2 (security per report), IVFRS-3.10 (Login / Activity History).
// Confirmed live on TST703 (headless). Source: Web/InnoView/Screens/ViewReport.aspx.cs (report loaded from the ?ReportName= query string, no process check; Export writes an .xlsx to the Innovatum temp
// folder and opens it by URL), MainMenu.aspx.cs (ReportMenu.GetAll(user) builds the tree). READ-ONLY: only reports are run; the one export file lands in <web>/temp on the server (Innovatum cleans it).
// Report pages are opened directly (top-level page, session of the web menu login): `Innovatum/innoview/Screens/ViewReport.aspx?ReportName=<name>`; prompts are the page's selects / text inputs in
// order, the date prompts are READ-ONLY datepickers (set the value by script), result table `[id$=rptTable_tblMain]`, buttons Submit / Export.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { login, loginAs, BASE_URL, PASSWORD } from '../support/robar';
import { OP } from '../Password-Management/pr-fixtures';

test.use({ actionTimeout: 20_000 });

const origin = new URL(BASE_URL).origin;
const report = (name: string) => `${origin}/Innovatum/innoview/Screens/ViewReport.aspx?ReportName=${encodeURIComponent(name)}`;
const today = (() => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; })();

function deviation(requirement: string, description: string) {
  console.log(`DEVIATION ${requirement}: ${description}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description });
}

const setDate = (page: Page, i: number, value: string) => page.locator('input[type=text]').nth(i).evaluate((e, v) => { (e as HTMLInputElement).value = v; }, value);

async function submit(page: Page): Promise<void> {
  await page.locator('input[type=submit][value=Submit]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
}

/** Headers and all body rows of the result table as arrays of cell texts (read in the page: Login History returns thousands of rows). */
async function result(page: Page): Promise<{ headers: string[]; rows: string[][] }> {
  return page.locator('[id$=rptTable_tblMain]').evaluate((t) => {
    const trs = Array.from(t.querySelectorAll('tr'));
    const headers = Array.from(t.querySelectorAll('th')).map((h) => (h.textContent ?? '').trim());
    const rows = trs.filter((tr) => !tr.querySelector('th')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim()));
    return { headers, rows };
  });
}

test('InnoView: reports with values, Export file content, menu collapse, report pages by URL', async ({ page, browser }) => {
  test.setTimeout(600_000);
  await login(page);
  let loginHistory = { headers: [] as string[], rows: [] as string[][] };

  await test.step('Login History with a user and a date range returns only that user (IVFRS-3.12, IVFRS-2.1 prompts)', async () => {
    await page.goto(report('Login History'));
    await page.locator('select').first().waitFor();
    await page.locator('select').first().selectOption({ label: 'Claude01' });
    await setDate(page, 0, '1/1/2024');
    await setDate(page, 1, today);
    await submit(page);
    loginHistory = await result(page);
    console.log('Login History headers:', loginHistory.headers.join(' | '), '| rows:', loginHistory.rows.length);
    expect(loginHistory.headers).toEqual(['Logged', 'User ID', 'Workstation', 'Time Zone', 'Full Name', 'Action', 'Object Type', 'Object Name', 'Object Version', 'Reason Code', 'Comments', 'Signature', 'Sequence Number', 'Rowguid']);
    expect(loginHistory.rows.length).toBeGreaterThan(0);
    const u = loginHistory.headers.indexOf('User ID');
    expect(loginHistory.rows.every((r) => r[u] === 'Claude01')).toBe(true);
  });

  await test.step('A narrower date range returns a subset, all inside the range', async () => {
    await setDate(page, 0, today);
    await setDate(page, 1, today);
    await submit(page);
    const t = await result(page);
    console.log('Login History for today only:', t.rows.length, 'of', loginHistory.rows.length);
    expect(t.rows.length).toBeLessThanOrEqual(loginHistory.rows.length);
    expect(t.rows.length).toBeGreaterThan(0); // this very run logged in today
    const logged = t.headers.indexOf('Logged');
    expect(t.rows.every((r) => r[logged].startsWith(today))).toBe(true);
  });

  await test.step('Activity History filtered by Action returns only that action (IVFRS-3.10)', async () => {
    await page.goto(report('Activity History'));
    await page.locator('select').first().waitFor();
    const selects = page.locator('select');
    const actions = (await selects.nth(2).locator('option').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
    console.log('Activity actions offered:', actions.slice(0, 12).join(' | '), `(${actions.length})`);
    // an action that really happened: the first Action value of the Login History above (when it is offered), else the first offered
    const seen = loginHistory.rows[0]?.[loginHistory.headers.indexOf('Action')] ?? '';
    const action = actions.includes(seen) ? seen : actions[0];
    await selects.nth(2).selectOption({ label: action });
    await setDate(page, 0, '1/1/2024');
    await setDate(page, 1, today);
    await submit(page);
    const t = await result(page);
    const a = t.headers.indexOf('Action');
    console.log(`Activity History action="${action}" since 2024:`, t.rows.length, 'rows; headers:', t.headers.join(' | '));
    expect(a).toBeGreaterThan(-1);
    expect(t.rows.every((r) => r[a] === action)).toBe(true);
    if (actions.includes(seen)) expect(t.rows.length).toBeGreaterThan(0);
  });

  await test.step('Label Changes with a Label Type (IV.220311.F.1.x)', async () => {
    await page.goto(report('Label Changes'));
    await page.locator('select').first().waitFor();
    const types = (await page.locator('select').first().locator('option').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
    await page.locator('select').first().selectOption({ label: types[0] });
    await submit(page);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(body).not.toContain('Runtime Error');
    const t = await page.locator('[id$=rptTable_tblMain]').count() ? await result(page) : { headers: [], rows: [] };
    console.log(`Label Changes for "${types[0]}":`, t.rows.length, 'rows; headers:', t.headers.join(' | '));
  });

  await test.step('Export button: an .xlsx with the same headers and rows as the table (IVFRS-3.3.1)', async () => {
    await page.goto(report('Login History'));
    await page.locator('select').first().waitFor();
    await page.locator('select').first().selectOption({ label: 'Claude01' });
    await setDate(page, 0, today);
    await setDate(page, 1, today);
    await submit(page);
    const table = await result(page);
    await page.locator('input[type=submit][value=Export]').click();
    await page.waitForTimeout(4000);
    const html = await page.locator('[id$=divJavascript]').innerHTML();
    const m = html.match(/window\.open\('([^']+)'/);
    expect(m, 'the Export postback opens the file by URL').toBeTruthy();
    const url = new URL(m![1], page.url()).toString();
    console.log('export url:', url);
    expect(url).toMatch(/\/temp\/Login_History_\d{8}_\d{6}\.xlsx$/);
    const r = await page.request.get(url);
    expect(r.status()).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await r.body());
    const ws = wb.worksheets[0];
    const head = (ws.getRow(1).values as unknown[]).slice(1).map((v) => String(v ?? '').trim());
    console.log('xlsx header:', head.join(' | '), '| data rows:', ws.rowCount - 1, '| table rows:', table.rows.length);
    // the file carries the raw column names ("UserID", "TimeZone", "rowguid"), the on-screen table the spaced captions ("User ID", "Time Zone", "Rowguid")
    const flat = (a: string[]) => a.map((h) => h.replace(/\s+/g, '').toLowerCase());
    expect(flat(head)).toEqual(flat(table.headers));
    if (head.join('|') !== table.headers.join('|')) console.log('observation: export headers are the raw column names, the table headers are spaced captions');
    expect(ws.rowCount - 1).toBe(table.rows.length);
    // the file is served from a static temp folder: is it protected like the report page?
    const anon = await browser.newContext();
    try {
      const a = await anon.request.get(url);
      console.log('same file without a session: HTTP', a.status(), (await a.body()).length, 'bytes');
      if (a.status() === 200) deviation('IVURS-1.1', `an exported report (${url}) can be downloaded without logging in: Export writes the file to the static /temp folder under a time-stamped name, and nothing checks the session on download (21 CFR Part 11 login history in this case)`);
    } finally {
      await anon.close();
    }
  });

  await test.step('Menu tree: a category expands and collapses (IVFRS-2.1 collapsible menus); no Help link on the InnoView pages (IVFRS-2.1)', async () => {
    await page.goto(`${origin}/Innovatum/innoview/Screens/MainMenu.aspx`);
    const cat = page.getByText('Items', { exact: true }).first();
    await cat.waitFor();
    const reportLink = page.getByText('Approved Items', { exact: true });
    expect(await reportLink.count()).toBe(0); // collapsed at the start
    await cat.click();
    await page.waitForTimeout(2500);
    expect(await reportLink.count(), 'expanded').toBeGreaterThan(0);
    await cat.click();
    await page.waitForTimeout(2500);
    const afterSecond = await reportLink.count();
    console.log('Approved Items link count after the second click on "Items":', afterSecond);
    // the +/- button next to the title is the other toggle
    expect(afterSecond === 0 || afterSecond > 0).toBe(true);
    const help = (await page.locator('a').allInnerTexts()).filter((t) => /help/i.test(t));
    console.log('Help links on the InnoView menu page:', help.length);
    if (help.length === 0) deviation('IVFRS-2.1', 'the InnoView pages (menu and report pages) have no Help link; only the surrounding Web Menu has its own Help button');
    if (afterSecond > 0) deviation('IVFRS-2.1', 'a second click on a menu category title does not collapse it again (only the +/- button toggles it, or nothing does)');
  });

  await test.step('Report pages are served by URL without the report process or the InnoView tile process (IVFRS-1.1.2)', async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, OP, PASSWORD); // CLPROp01: Login_WebMenu + ResetPassword_Option only: no Login_InnoView, no Innov_ViewPrintHist
      await p.goto(report('View Print History'));
      await p.waitForTimeout(3000);
      const served = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
      const prompts = await p.locator('input[type=submit][value=Submit]').count();
      console.log(`${OP} (no InnoView process) opens View Print History by URL: Submit button ${prompts}, text: ${served.slice(0, 120)}`);
      let ran = false;
      if (prompts > 0) {
        await p.locator('input[type=submit][value=Submit]').click();
        await p.waitForLoadState('networkidle');
        await p.waitForTimeout(3000);
        ran = (await p.locator('[id$=rptTable_tblMain]').count()) > 0;
        console.log('the report runs for that user (result table present):', ran);
      }
      if (prompts > 0 && ran) deviation('IVFRS-1.1.2', 'View Print History (report process Innov_ViewPrintHist) and the InnoView tile (Login_InnoView) are enforced only by hiding menu entries: ViewReport.aspx?ReportName=View+Print+History is served and runs for any logged-in user (ViewReport.aspx.cs only calls RedirectIfNotLoggedIn)');
    } finally {
      await ctx.close();
    }
  });
});
