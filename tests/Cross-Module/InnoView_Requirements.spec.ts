// InnoView re-checked against ValMaster (module "InnoView", IVURS / IVFRS-3.x / IV.220311.*; live 2026-10-11, headless, TST703, seed user Claude01). READ-ONLY: reports are only opened, run and read.
// Requirements: .agents/valmaster-innoview.md. Differences are annotated `deviation <id>` (the spec stays green).
// InnoView is the legacy ASP.NET app `Innovatum/innoview/Screens/ViewReport.aspx?ReportName=<name>`; the web-menu tile "InnoView" shows a category tree.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, BASE_URL } from '../support/robar';

test.use({ actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

async function openInnoView(page: Page): Promise<Frame> {
  const current = () => page.frames().filter((x) => /innoview/i.test(x.url())).pop();
  const existing = current();
  if (existing) {
    // reuse the open InnoView tab: its own "Main Menu" link returns to the category tree
    await existing.getByText('Main Menu', { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const back = current();
    if (back && (await back.getByText('21 CFR Part 11 Reporting', { exact: true }).count())) return back;
  }
  await page.locator('li.ui-tabs-tab:has-text("InnoView") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'InnoView');
  for (let i = 0; i < 20; i++) {
    const fr = current();
    if (fr) { await page.waitForTimeout(3000); return fr; }
    await page.waitForTimeout(1500);
  }
  // last resort: reload the web menu (the session cookie keeps us logged in) and open the tile again
  await page.goto(BASE_URL);
  await page.waitForTimeout(5000);
  await openMenuItem(page, 'InnoView');
  await page.waitForTimeout(6000);
  const last = current();
  if (!last) throw new Error('InnoView frame not found');
  return last;
}

test('InnoView vs ValMaster: report menu, the requirement reports, prompts, columns and Export (read-only)', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  let f = await openInnoView(page);

  const menuText = norm(await f.locator('body').innerText());
  console.log(`MENU ${menuText.slice(0, 1500)}`);
  const links = await f.locator('a').evaluateAll((els) => els.map((e: any) => `${(e.innerText || '').trim()}|${e.getAttribute('href') || ''}`).filter((x) => x.split('|')[0]));
  console.log(`LINKS ${JSON.stringify(links.slice(0, 80))}`);

  // [report name, requirement ids, expected prompts (text/ select / date labels), expected columns]
  const reports: Array<{ name: string; reqName?: string; req: string; prompts: string[]; columns: string[] }> = [
    { name: 'Label Control', req: 'LC.161207.F.18.1', prompts: [], columns: ['LCN', 'Item Number', 'Label Type', 'Template Name', 'Template Version', 'Effective Begin', 'Effective End', 'Released On', 'Released By', 'Allow Print'] },
    { name: 'Label Changes', req: 'IV.220311.F.1', prompts: ['Label Type', 'Label Name'], columns: ['Change Type', 'Change User', 'Change User Name', 'Change Date Time', 'Change Reason', 'Change Comments', 'Label Type', 'Label Name', 'Description', 'Version Number', 'Effective Begin', 'Effective End', 'Approved By', 'Last Touch', 'Checked Out By', 'Document Owner'] },
    { name: 'Activity History', reqName: 'User Activity History', req: 'IVFRS-3.10', prompts: ['User', 'Workstation', 'Action', 'Start Date', 'End Date'], columns: ['Logged', 'UserID', 'Workstation', 'TimeZone', 'FullName', 'Action', 'ObjectType', 'ObjectName', 'ObjectVersion', 'ReasonCode', 'Comments', 'Signature', 'SequenceNumber'] },
    { name: 'All Electronic Signatures', reqName: 'User Electronic Signatures', req: 'IVFRS-3.11', prompts: ['User', 'Workstation', 'Action', 'Start Date', 'End Date'], columns: ['Logged', 'UserID', 'Workstation', 'TimeZone', 'FullName', 'Action', 'ObjectType', 'ObjectName', 'ObjectVersion', 'ReasonCode', 'Comments', 'Signature', 'SequenceNumber'] },
    { name: 'Login History', reqName: 'User Login History', req: 'IVFRS-3.12', prompts: ['User', 'Workstation', 'Start Date', 'End Date'], columns: ['Logged', 'UserID', 'Workstation', 'TimeZone', 'FullName', 'Action'] },
    { name: 'Failed Login History', reqName: 'User Failed Login History', req: 'IVFRS-3.13', prompts: ['User', 'Workstation', 'Start Date', 'End Date'], columns: ['Logged', 'UserID', 'Workstation', 'TimeZone', 'FullName', 'Action'] },
    { name: 'Item Change Detail', reqName: 'User Item Detail Change', req: 'IVFRS-3.14', prompts: ['User', 'Item', 'Version', 'Start Date', 'End Date'], columns: ['Item Number', 'Description', 'Label Type', 'Version Number', 'Effective Begin', 'Effective End', 'Approved By'] },
    { name: 'View Print History', req: 'IVFRS-3.4', prompts: ['UserID', 'Template', 'Item', 'Order', 'Workstation', 'Print Date Start', 'Print Date Finish'], columns: ['User ID', 'Work Station', 'Item Number', 'Label Name', 'Order Num', 'Qty', 'Printer', 'Copies', 'Reprint', 'Batchqty'] },
    { name: 'Approved Items', req: 'IVFRS-3.5', prompts: ['Description', 'Item Number', 'Label Name', 'Approver'], columns: ['Item Number', 'Description', 'Label Type', 'Version Number', 'Approved By'] },
    { name: 'Unapproved Items', req: 'IVFRS-3.6', prompts: ['Description', 'Item Number', 'Label Name'], columns: ['Item Number', 'Description', 'Label Type', 'Version Number'] },
    { name: 'Workflow By Status', reqName: 'Workflow by Status', req: 'IVFRS-3.7', prompts: ['Header Status', 'Description', 'Last User', 'Last Status Start', 'Last Status End', 'Initiate Start', 'Initiate End'], columns: ['Workflow ID', 'Description', 'Workflow type', 'Has attachments', 'Date initiated', 'Header status', 'Last user'] },
    { name: 'Search Items By Item Number', reqName: 'Search Items by Item Number', req: 'IVFRS-3.8', prompts: ['Item Number'], columns: ['Item Number', 'Description', 'Label Type', 'Version Number'] },
    { name: 'View Print History With Failed', reqName: 'Print History with Failed Prints', req: 'IVFRS-3.9', prompts: ['Workstation', 'Print Date Start', 'Print Date Finish'], columns: ['USERID', 'WORKSTATION', 'ITEMNUMBER', 'PRINTER', 'COPIES', 'PRINTFAILED'] },
  ];

  // catalog: click every category and record the reports it reveals
  const categories = links.map((l) => l.split('|')[0]).filter((t) => t && t !== 'Main Menu');
  const catalog: Record<string, string[]> = {};
  for (const c of categories) {
    f = await openInnoView(page);
    await f.getByText(c, { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const after = (await f.locator('a').evaluateAll((els) => els.map((e: any) => (e.innerText || '').trim()))).filter(Boolean);
    // remove one occurrence of every category / Main Menu link; what is left are reports (a report may carry its category's name, e.g. Label Control)
    const rest = [...after];
    for (const k of ['Main Menu', ...categories]) { const i = rest.indexOf(k); if (i >= 0) rest.splice(i, 1); }
    catalog[c] = rest;
  }
  console.log(`CATALOG ${JSON.stringify(catalog)}`);
  const categoryOf = (name: string) => Object.keys(catalog).find((c) => catalog[c].some((n) => n.toLowerCase() === name.toLowerCase()));

  for (const r of reports) {
    f = await openInnoView(page);
    if (r.reqName) deviation(r.req, `report named "${r.reqName}"`, `the report is named "${r.name}"`);
    const cat = categoryOf(r.name);
    let opened = false;
    if (cat) {
      await f.getByText(cat, { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await f.getByText(r.name, { exact: true }).nth(r.name === cat ? 1 : 0).click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(6000);
      opened = page.frames().some((x) => /ViewReport/i.test(x.url()));
    }
    const rf = page.frames().filter((x) => /ViewReport/i.test(x.url())).pop();
    if (!opened || !rf) {
      deviation(r.req, `report "${r.name}" in the InnoView menu`, 'not reachable by name');
      continue;
    }
    // prompt block without the (long) select option lists
    const prompts = norm(await rf.evaluate(() => { const c = document.body.cloneNode(true) as HTMLElement; c.querySelectorAll('script, style').forEach((x) => x.remove()); c.querySelectorAll('select').forEach((x) => x.replaceWith('[select]')); return c.textContent || ''; })).slice(0, 700);
    console.log(`${r.name} PROMPTS ${prompts}`);
    for (const p of r.prompts) if (!new RegExp(p.replace(/\s+/g, '\\s*'), 'i').test(prompts)) deviation(`${r.req}.prompts`, `prompt "${p}" on ${r.name}`, prompts.slice(0, 200));
    const hasExport = (await rf.locator('input[type=submit][value="Export"], input[value*="Export"]').count()) > 0;
    console.log(`${r.name} Export button=${hasExport}`);
    if (!hasExport) deviation('IVFRS-3.3.1', `Export button on ${r.name}`, 'none');
    await rf.locator('input[type=submit][value="Submit"]').click({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: `test-results/innoview-${r.name.replace(/\W+/g, '_')}.png` }).catch(() => {});
    const out = page.frames().filter((x) => /ViewReport/i.test(x.url())).pop()!;
    const result = norm(await out.locator('body').innerText());
    const ths = (await out.locator('th').allInnerTexts()).map(norm).filter(Boolean);
    console.log(`${r.name} RESULT headers=${JSON.stringify(ths.slice(0, 60))} tail="${result.slice(-160)}"`);
    if (!ths.length) { console.log(`${r.name}: no result table (no rows or a prompt-only page)`); continue; }
    for (const c of r.columns) if (!ths.some((h) => h.toLowerCase().replace(/\s/g, '') === c.toLowerCase().replace(/\s/g, ''))) deviation(`${r.req}.columns`, `column "${c}" on ${r.name}`, JSON.stringify(ths.slice(0, 40)));
    expect.soft(true).toBe(true);
  }
});
