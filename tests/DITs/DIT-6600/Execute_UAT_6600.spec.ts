// Execution of UAT_6600 (DIT #6600): Print History Inquiry does not list Test Prints (PrintStatus TestPrinted).
// HEADED (OS-level screenshots with the address bar). One TEST print (1 copy) to Microsoft Print to PDF; no real print. TST703, seed user.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { login } from '../../support/robar';
import { toOrderLabelScreen } from '../../support/print-request';
import { PDF } from '../../support/print-by-lot';
import * as du from '../../support/dynamic-ui';

test.use({ headless: false, actionTimeout: 20_000 });

const SHOTS = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--DB-Copies-703-20198\81fdb45d-e1e5-486d-9f0f-3e09544a69d8\scratchpad\uat6600_exec`;
const shot = (n: number): void => {
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/screenshot-desktop.ps1'), '-Path', path.join(SHOTS, `step_${String(n).padStart(2, '0')}.png`)]);
};

const showStatus = async (f: import('@playwright/test').Frame) => { await f.locator('tr.jqgrow').first().locator('td').filter({ hasText: /^(Test)?Printed$/ }).first().scrollIntoViewIfNeeded().catch(() => {}); await new Promise((r) => setTimeout(r, 800)); };

test('UAT 6600 execution', async ({ page, context }) => {
  test.setTimeout(900_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const res: Record<string, unknown> = {};
  await login(page);
  await page.waitForTimeout(2000);
  shot(1);

  const A = JSON.parse(fs.readFileSync('test-data/batchqty-item-a.json', 'utf8')).item as string;
  const stamp = Date.now().toString().slice(-6);
  const order = `CLUAT6600${stamp}`;
  const pb = await toOrderLabelScreen(page, order, `CLUAT6600${stamp}L`, A);
  await pb.opt('txtCopies').fill('1');
  await pb.opt('txtCopies').press('Tab');
  await pb.opt('chbTestPrint').check();
  await page.waitForTimeout(1500);
  await pb.opt('drpPrinters').selectOption({ label: PDF });
  const result = await pb.print();
  console.log('TEST PRINT: ' + result.slice(-200));
  res.testPrint = result.slice(-200); res.order = order; res.item = A;
  shot(2);
  expect(result).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);

  await page.locator('li.ui-tabs-tab:has-text("Print by order") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(2000);
  let f = await du.reopenDynamicUi(page, 'Print History Inquiry');
  await du.clearCriteria(page, f);
  await f.click('#btnRetrieveData');
  await page.waitForTimeout(6000);
  let rows = await du.rows(f);
  const statuses = rows.filter((r) => /Test ?Printed/i.test(r)).length;
  console.log(`STEP3 rows=${rows.length} testPrintedRows=${statuses} summary=${await f.locator('.ui-paging-info').innerText().catch(() => '')}`);
  res.step3 = { rows: rows.length, testPrinted: statuses };
  await showStatus(f);
  shot(3);

  rows = await du.retrieve(page, f, 'PrintStatus', 'Contains', 'Test', { expectRows: false });
  await page.waitForTimeout(3000);
  rows = await du.rows(f);
  console.log(`STEP4 rows=${rows.length} text=${await f.locator('body').innerText().then((t) => t.includes('No records to view'))}`);
  res.step4 = { rows: rows.length, noRecords: await f.locator('body').innerText().then((t) => t.includes('No records to view')) };
  await showStatus(f);
  shot(4);

  rows = await du.retrieve(page, f, 'PrintStatus', 'Exactly Matches', 'Printed', { expectRows: false });
  await page.waitForTimeout(3000);
  rows = await du.rows(f);
  console.log(`STEP5 rows=${rows.length}`);
  res.step5 = { rows: rows.length, testPrintedRows: rows.filter((r) => /TestPrinted/i.test(r)).length, sample: rows.slice(0, 2) };
  await showStatus(f);
  shot(5);

  // Step 6: back to the Test filter, first row Actions > See Detail
  rows = await du.retrieve(page, f, 'PrintStatus', 'Contains', 'Test', { expectRows: false });
  await page.waitForTimeout(3000);
  const before = context.pages().length;
  await f.locator('tr.jqgrow').first().getByText('Actions').first().click();
  await page.waitForTimeout(600);
  await f.locator('ul:visible li a').filter({ hasText: /^\s*See Detail/ }).first().click({ force: true });
  await page.waitForTimeout(7000);
  const popup = context.pages().length > before ? context.pages()[context.pages().length - 1] : undefined;
  if (popup) await popup.bringToFront();
  const detail = popup ? (await popup.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600) : '(no popup)';
  console.log('STEP6 ' + detail);
  res.step6 = detail;
  shot(6);

  fs.writeFileSync(path.join(SHOTS, 'result.json'), JSON.stringify(res, null, 2));
  expect.soft((res.step4 as { rows: number }).rows, 'Test Prints listed when filtering PrintStatus Contains Test').toBeGreaterThan(0);
});
