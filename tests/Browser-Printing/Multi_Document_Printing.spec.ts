// Multi Document Printing (live 2026-10-05, Claude01, HEADED): `InnoPages/MultiDocPrinting/MultiDocumentPrinting?ConfigName=MultiDocPrint`.
// Order / Lot / Item -> Next shows ONE screen: the Lot Panel plus a Labeling grid with one row per printer of the print entity, each row with its own
// label type / template / LCN / copies and an Action menu (View Preview / View Master / View Compare). Print and Test Print only use the
// "Microsoft Print to PDF" row (HARD RULE: never a real printer). Opening the module AND every Print raise the native "Open SentinelLauncher?"
// prompt, which is confirmed with FlaUI (real mouse -- do not touch the mouse/keyboard). Needs a user with a Print Entity (User Print Entity
// Management) and an item with an assigned LCN (MI080301 / LCN0000324 / template A1TemplateMT on TST703).
// A real print creates the lot (lots cannot be deleted): one throw-away `MBMDPL<stamp>` lot per run.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, USERNAME } from '../support/robar';
import { viewPrintHistory } from '../support/print-history';
import * as bartender from '../support/bartender';

test.use({ headless: false, actionTimeout: 20_000 });

const ITEM = 'MI080301';
const PDF_PRINTER = 'Microsoft Print to PDF';

test('Multi Document Printing: entry, lot panel, label rows, preview, Test Print and real Print to PDF', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const order = `MBMDPO${stamp}`;
  const lot = `MBMDPL${stamp}`;
  let browserPid = 0;
  let f: Frame;

  const openModule = async (): Promise<Frame> => {
    await page.locator('li.ui-tabs-tab:has-text("Multi Document Printing") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Multi Document Printing', exact: true }).click({ timeout: 10_000 });
    await page.waitForTimeout(4000);
    browserPid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, browserPid);
    for (let i = 0; i < 20; i++) {
      const g = page.frames().filter((x) => x.url().includes('MultiDocPrinting/MultiDocumentPrinting')).pop();
      if (g && (await g.locator('input[name="FlexLot_OrderNum"]').count()) > 0) return g;
      await page.waitForTimeout(1000);
    }
    throw new Error('Multi Document Printing page did not load');
  };
  const enter = async (o: string, l: string, i: string) => {
    await f.locator('input[name="FlexLot_OrderNum"]').fill(o);
    await f.locator('input[name="FlexLot_LotNum"]').fill(l);
    await f.locator('input[name="FlexLot_ItemNumber"]').fill(i);
    await f.locator('input[name="FlexLot_ItemNumber"]').press('Tab');
    await f.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(6000);
  };
  /** the Labeling grid rows (those that have a printer name in the last cell), in order */
  const printerRows = () => f.locator('tr').filter({ has: f.locator('select') }).filter({ hasText: /Zebra|SATO|Microsoft/ });
  const pdfRow = () => printerRows().filter({ hasText: PDF_PRINTER });

  await test.step('open the module (Sentinel prompt): the entry panel has Order / Lot / Item, Next and Reset', async () => {
    f = await openModule();
    const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(body).toContain('Multi Document Printing');
    for (const label of ['Order Number', 'Lot Number', 'Item Number']) expect(body).toContain(label);
    await expect(f.getByRole('button', { name: 'Next' })).toBeVisible();
    await expect(f.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  await test.step('Next: Lot Panel with the entered lot/order and defaulted dates, and one Labeling row per printer', async () => {
    await enter(order, lot, ITEM);
    const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(body).toContain('Lot Panel');
    expect(body).toContain('Override Lot Data');
    expect(body).toContain(`Item Number:${ITEM}`);
    // entry fields are now read-only, the lot panel shows them
    expect(await f.locator('input[name="FlexLot_LotNum"]').isEditable()).toBe(false);
    const inputValues = () => f.locator('input:not([type=checkbox]):not([type=button]):not([type=submit])').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(await inputValues()).toEqual(expect.arrayContaining([lot, order]));
    // Expires / Manufactured / Reassay are defaulted dates (M/D/YYYY)
    await expect.poll(async () => (await inputValues()).filter((v) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
    const rows = await printerRows().allInnerTexts();
    console.log(`printer rows: ${JSON.stringify(rows.map((r) => r.replace(/\s+/g, ' ').trim()))}`);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.join(' ')).toContain(PDF_PRINTER);
    // nothing chosen yet: Print is disabled
    await expect(f.getByRole('button', { name: /^Print$/ })).toBeDisabled();
  });

  await test.step('choose Carton Label on the PDF row: template + LCN appear, copies defaults to 1, Print is enabled', async () => {
    const row = pdfRow();
    expect((await row.locator('select').first().locator('option').allInnerTexts()).map((t) => t.trim()).length).toBeGreaterThan(0);
    const labelType = row.locator('select').filter({ hasText: 'Select a label type' });
    expect((await labelType.locator('option').allInnerTexts()).map((t) => t.trim())).toEqual(['Select a label type', 'Carton Label']);
    await labelType.selectOption({ label: 'Carton Label' });
    await page.waitForTimeout(4000);
    const text = (await pdfRow().innerText()).replace(/\s+/g, ' ');
    console.log(`PDF row: ${text}`);
    expect(text).toMatch(/A1TemplateMT/);
    expect(text).toMatch(/LCN\d+/);
    expect(await pdfRow().locator('input[name="txtCopies"]').inputValue()).toBe('1');
    await expect(f.getByRole('button', { name: /^Print$/ })).toBeEnabled();
    // action menu
    expect((await pdfRow().locator('select').filter({ hasText: 'View Preview' }).locator('option').allInnerTexts()).map((t) => t.trim())).toEqual(['Action', 'View Preview', 'View Master', 'View Compare']);
  });

  await test.step('View Preview shows the label image; View Master / Compare report "No Label Master Found" for this item', async () => {
    const action = pdfRow().locator('select').filter({ hasText: 'View Preview' });
    const go = action.locator('xpath=following::button[1]');
    await action.selectOption({ label: 'View Preview' });
    await go.click();
    await page.waitForTimeout(12_000);
    const dlg = f.locator('.ui-dialog:visible');
    await expect(dlg.first()).toBeVisible({ timeout: 15_000 });
    expect(await dlg.locator('img, canvas, iframe').count(), 'a rendered label image').toBeGreaterThan(0);
    await dlg.locator('button').filter({ hasText: 'OK' }).first().click();
    await page.waitForTimeout(800);
    for (const name of ['View Master', 'View Compare']) {
      await action.selectOption({ label: name });
      await go.click();
      await page.waitForTimeout(10_000);
      expect((await f.locator('.ui-dialog:visible').allInnerTexts()).join(' ')).toContain('No Label Master Found');
      await f.locator('.ui-dialog:visible button').filter({ hasText: 'OK' }).first().click();
      await page.waitForTimeout(800);
    }
  });

  /** Clicks the given Print button, confirms the SECOND SentinelLauncher prompt and returns the PDF row's final status. */
  const printAndWait = async (button: RegExp): Promise<string> => {
    const responses: string[] = [];
    const onResponse = async (r: import('@playwright/test').Response) => {
      if (r.url().includes('/MultiDocPrinting/GetPrinterStatus')) responses.push(await r.text().catch(() => ''));
    };
    page.on('response', onResponse);
    await f.getByRole('button', { name: button }).click();
    await page.waitForTimeout(1500);
    await bartender.confirmSentinelLaunchPrompt(page, browserPid);
    for (let i = 0; i < 30 && !responses.some((x) => /"PrintStatus":"(success|error)"/.test(x)); i++) await page.waitForTimeout(1000);
    page.off('response', onResponse);
    console.log(`status polls: ${JSON.stringify(responses.slice(-2))}`);
    return responses.find((x) => /"PrintStatus":"(success|error)"/.test(x)) ?? '';
  };

  await test.step('Test checkbox turns Print into Test Print; Test Print to the PDF printer succeeds', async () => {
    await f.locator('#testPrintCheckbox').check();
    await expect(f.getByRole('button', { name: /Test Print/ })).toBeVisible();
    expect(await printAndWait(/Test Print/)).toContain('"PrintStatus":"success"');
    await f.locator('#testPrintCheckbox').uncheck();
    await expect(f.getByRole('button', { name: /^Print$/ })).toBeVisible();
  });

  await test.step('a real Print to the PDF printer succeeds (creates the lot)', async () => {
    expect(await printAndWait(/^Print$/)).toContain('"PrintStatus":"success"');
  });

  await test.step('the REAL print is in InnoView > View Print History (once, PDF printer, 1 copy); the Test Print is not', async () => {
    const { reportText } = await viewPrintHistory(page, { lot });
    console.log(`print history for ${lot}: ${reportText.slice(0, 400)}`);
    expect(reportText.split(lot).length - 1, 'exactly one history row for the lot').toBe(1);
    expect(reportText).toContain(order);
    expect(reportText).toContain(ITEM);
    expect(reportText).toContain(PDF_PRINTER);
    expect(reportText).toMatch(/PID_[0-9A-F]{32}/);
    expect(reportText.toLowerCase()).toContain(USERNAME.toLowerCase());
    // go back to the Multi Document Printing tab (the Reset step below uses it)
    await page.locator('li.ui-tabs-tab:has-text("Multi Document Printing")').click({ timeout: 5000 });
    await page.waitForTimeout(1500);
  });

  await test.step('Reset returns to the empty entry panel', async () => {
    await f.locator('#reset-button').click({ timeout: 10_000 });
    await page.waitForTimeout(3000);
    f = page.frames().filter((x) => x.url().includes('MultiDocPrinting/MultiDocumentPrinting')).pop()!;
    await expect(f.locator('input[name="FlexLot_OrderNum"]')).toHaveValue('');
  });
});
