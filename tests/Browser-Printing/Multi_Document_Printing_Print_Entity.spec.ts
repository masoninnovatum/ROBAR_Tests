// Multi Document Printing with PrintEntityRequired = Y and AddLotReasonRequired = Y (live 2026-10-08, HEADED: native "Open SentinelLauncher?" prompts are confirmed with FlaUI -- hands off the mouse;
// seed user Claude01 holding `*`). Entry panel: Print Entity dropdown (first <select>, no id) + Order / Lot / Item -> Next -> (new lot) Reason Code dialog -> Lot Panel + Labeling rows -> Carton Label on the
// "Microsoft Print to PDF" row -> Print. Verifies: the chosen entity is written to the lot (Lot Management), and the last used entity is the default on the next visit.
// A real print creates the lot (the printed lot can still be deleted in Lot Management, verified 2026-10-09): one throw-away `MBMDPE<stamp>` lot per run. Skips unless PrintEntityRequired = Y.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login } from '../support/robar';
import { readGlobalSetting } from '../support/global-settings';
import * as bartender from '../support/bartender';
import * as du from '../support/dynamic-ui';

test.use({ headless: false, actionTimeout: 20_000 });

const ITEM = 'MI080301';
const PDF_PRINTER = 'Microsoft Print to PDF';

test('Multi Document Printing, PrintEntityRequired = Y: entity dropdown, Reason Code, real Print to PDF, lot carries the chosen entity, last used entity is the default', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const setting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  console.log(`PrintEntityRequired = ${setting}`);
  test.skip(setting !== 'Y', `PrintEntityRequired is ${setting}; this spec covers Y`);
  const stamp = Date.now().toString().slice(-6);
  const order = `MBMDPEO${stamp}`;
  const lot = `MBMDPE${stamp}`;
  let browserPid = 0;
  let f: Frame;
  let chosen = '';

  const frame = (): Frame => page.frames().filter((x) => x.url().includes('MultiDocPrinting/MultiDocumentPrinting')).pop()!;
  const openModule = async (): Promise<Frame> => {
    await page.locator('li.ui-tabs-tab:has-text("Multi Document Printing") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Multi Document Printing', exact: true }).click({ timeout: 10_000 });
    await page.waitForTimeout(4000);
    browserPid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, browserPid);
    for (let i = 0; i < 20; i++) {
      const g = frame();
      if (g && (await g.locator('input[name="FlexLot_OrderNum"]').count()) > 0) return g;
      await page.waitForTimeout(1000);
    }
    throw new Error('Multi Document Printing page did not load');
  };
  const entitySelect = () => f.locator('select').first();
  const printerRows = () => f.locator('tr').filter({ has: f.locator('select') }).filter({ hasText: /Zebra|SATO|Microsoft/ });
  const pdfRow = () => printerRows().filter({ hasText: PDF_PRINTER });

  await test.step('open the module: the Print Entity dropdown lists the entities of the user (`*` = all) with a default', async () => {
    f = await openModule();
    const options = await entitySelect().locator('option').allInnerTexts();
    const def = await entitySelect().inputValue();
    console.log(`entity options: ${JSON.stringify(options)}; default: ${def}`);
    expect(options).toEqual(expect.arrayContaining(['England', 'ROBAR']));
    expect(options, 'ascending').toEqual([...options].sort((a, b) => a.localeCompare(b)));
    chosen = options.filter((o) => o !== def && ['England', 'ROBAR'].includes(o))[0] ?? options.find((o) => o !== def)!;
    console.log(`chosen entity: ${chosen}`);
    await entitySelect().selectOption({ label: chosen });
  });

  await test.step('a new lot: Order / Lot / Item -> Next (Reason Code dialog when AddLotReasonRequired = Y) -> Lot Panel with the Labeling rows', async () => {
    await f.locator('input[name="FlexLot_OrderNum"]').fill(order);
    await f.locator('input[name="FlexLot_LotNum"]').fill(lot);
    await f.locator('input[name="FlexLot_ItemNumber"]').fill(ITEM);
    await f.locator('input[name="FlexLot_ItemNumber"]').press('Tab');
    await f.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(6000);
    const d = f.locator('.ui-dialog:visible', { hasText: 'Reason Code' });
    const hasReason = (await d.count()) > 0;
    console.log(`Reason Code dialog on MDP Next: ${hasReason}`);
    if (hasReason) {
      await d.getByRole('button', { name: 'Submit' }).click();
      await expect(d).toContainText('This field is required.');
      await d.locator('#reasonSel').selectOption({ label: 'On Demand' });
      await d.locator('#commentTxt').fill('Playwright MDP entity');
      await d.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(6000);
    }
    f = frame();
    const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`after Next: ${body.slice(0, 300)}`);
    expect(body).toContain('Lot Panel');
    expect(await printerRows().count()).toBeGreaterThanOrEqual(2);
  });

  await test.step('Carton Label on the PDF row, real Print to PDF', async () => {
    const labelType = pdfRow().locator('select').filter({ hasText: 'Select a label type' });
    await labelType.selectOption({ label: 'Carton Label' });
    await page.waitForTimeout(4000);
    await expect(f.getByRole('button', { name: /^Print$/ })).toBeEnabled();
    const responses: string[] = [];
    const onResponse = async (r: import('@playwright/test').Response) => {
      if (r.url().includes('/MultiDocPrinting/GetPrinterStatus')) responses.push(await r.text().catch(() => ''));
    };
    page.on('response', onResponse);
    await f.getByRole('button', { name: /^Print$/ }).click();
    await page.waitForTimeout(1500);
    await bartender.confirmSentinelLaunchPrompt(page, browserPid);
    for (let i = 0; i < 30 && !responses.some((x) => /"PrintStatus":"(success|error)"/.test(x)); i++) await page.waitForTimeout(1000);
    page.off('response', onResponse);
    const status = responses.find((x) => /"PrintStatus":"(success|error)"/.test(x)) ?? '';
    console.log(`print status: ${status.slice(0, 200)}`);
    expect(status).toContain('"PrintStatus":"success"');
  });

  await test.step('Lot Management: the lot exists with the CHOSEN Print Entity', async () => {
    const g = await du.reopenDynamicUi(page, 'Lot Management');
    await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
    await page.waitForTimeout(5000);
    const rows = await du.rows(g);
    console.log(`lot rows: ${JSON.stringify(rows)}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(chosen);
  });

  await test.step('reopen Multi Document Printing: the dropdown defaults to the LAST USED entity', async () => {
    f = await openModule();
    const def = await entitySelect().inputValue();
    console.log(`default after printing with ${chosen}: ${def}`);
    expect(def).toBe(chosen);
  });
});
