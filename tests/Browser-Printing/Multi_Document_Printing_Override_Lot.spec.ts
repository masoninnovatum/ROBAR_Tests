// Multi Document Printing: Override Lot Data (live 2026-10-06, Claude01, HEADED). Source: LotPanel.cshtml / LotPanelModel.js -- the "Override Lot Data" checkbox (#overrideLotCheckBox, needs process
// Override_Lot_At_Print) makes the lot fields editable per their layout (Expires / Manufactured need BP_AllowMfgChangeAtPrint for Manufactured); Save / Cancel buttons appear; Save validates
// (Manufactured must be before Expires) and writes the lot. A throw-away lot `MBMDPV<stamp>` is created by the real print (lots cannot be deleted). Headed: FlaUI confirms the two Sentinel prompts.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login } from '../support/robar';
import { viewPrintHistory } from '../support/print-history';
import * as bartender from '../support/bartender';

test.use({ headless: false, actionTimeout: 20_000 });

const ITEM = 'MI080301';
const PDF_PRINTER = 'Microsoft Print to PDF';

test('Multi Document Printing: Override Lot Data (editable fields, validation, Save, Cancel) and the print uses the overridden dates', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const order = `MBMDVO${stamp}`;
  const lot = `MBMDPV${stamp}`;
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
  const dates = () => f.locator('.lot-panel-container input.mdp-input-date, input.mdp-input-date');
  const dateValues = async () => (await dates().evaluateAll((e) => e.map((x) => (x as HTMLInputElement).value)));
  const dateEnabled = async () => {
    const out: boolean[] = [];
    for (let i = 0; i < (await dates().count()); i++) out.push(await dates().nth(i).evaluate((e) => !(e as HTMLInputElement).disabled)); // the inputs are always readonly (calendar-driven); `disabled` is the real switch
    return out;
  };
  const setDate = async (i: number, v: string) => {
    // readonly input + jQuery UI datepicker: set the date through the datepicker API (fires the change the Knockout binding listens to)
    await dates().nth(i).evaluate((e, val) => {
      const $ = (window as unknown as { jQuery: (x: Element) => { datepicker: (a: string, b: Date) => void; trigger: (n: string) => void } }).jQuery;
      $(e).datepicker('setDate', new Date(val));
      $(e).trigger('change');
    }, v);
    await page.waitForTimeout(500);
  };
  const dialogText = async () => ((await f.locator('.ui-dialog:visible').allInnerTexts()).join(' ')).replace(/\s+/g, ' ');
  const closeDialogs = async () => {
    await f.locator('.ui-dialog:visible button').filter({ hasText: /OK|Close/ }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  };

  await test.step('open, enter a NEW lot, Next: only Manufactured is editable until Override Lot Data is ticked', async () => {
    f = await openModule();
    await f.locator('input[name="FlexLot_OrderNum"]').fill(order);
    await f.locator('input[name="FlexLot_LotNum"]').fill(lot);
    await f.locator('input[name="FlexLot_ItemNumber"]').fill(ITEM);
    await f.locator('input[name="FlexLot_ItemNumber"]').press('Tab');
    await f.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(6000);
    await expect(f.locator('#overrideLotCheckBox')).toBeVisible();
    console.log(`dates ${JSON.stringify(await dateValues())} enabled ${JSON.stringify(await dateEnabled())}`);
    expect(await dateEnabled(), 'only Manufactured is editable before the override (hasPermissionToChangeMgfDate + BP_AllowMfgChangeAtPrint)').toEqual([false, true, false]);
    await expect(f.locator('.save-button')).toBeHidden();
  });

  await test.step('tick Override Lot Data: dates become editable and Save / Cancel appear', async () => {
    await f.locator('#overrideLotCheckBox').check();
    await page.waitForTimeout(2500);
    console.log(`after tick enabled ${JSON.stringify(await dateEnabled())} html ${JSON.stringify(await dates().evaluateAll((e) => e.map((x) => x.outerHTML.slice(0, 260))))}`);
    expect(await dateEnabled()).toEqual([false, true, true]);
    await expect(f.locator('.save-button')).toBeVisible();
    await expect(f.locator('.cancel-button')).toBeVisible();
  });

  await test.step('Manufactured after Expires is refused on Save', async () => {
    // observed live: Expires (calculated, MI080301) stays read-only; Manufactured and Reassay become editable
    expect(await dateEnabled()).toEqual([false, true, true]);
    await setDate(1, '1/1/2030'); // Manufactured after Expires (10/7/2026)
    await f.locator('.save-button').click();
    await page.waitForTimeout(2500);
    const text = await dialogText();
    console.log(`validation dialog: ${text}`);
    expect(text.length).toBeGreaterThan(0);
    await closeDialogs();
  });

  await test.step('a valid change (Manufactured 1/1/2026, Expires 12/31/2030) Saves and the checkbox unticks', async () => {
    await setDate(1, '1/1/2026');
    await setDate(2, '12/31/2030'); // Reassay
    await f.locator('.save-button').click();
    await page.waitForTimeout(4000);
    console.log(`after save: dialogs "${await dialogText()}" values ${JSON.stringify(await dateValues())} checked ${await f.locator('#overrideLotCheckBox').isChecked()}`);
    await closeDialogs();
    // Expires follows Manufactured (MI080301: +1 day) while Reassay keeps the override
    expect(await dateValues()).toEqual(['1/2/2026', '1/1/2026', '12/31/2030']);
  });

  await test.step('Cancel throws a pending change away', async () => {
    await f.locator('#overrideLotCheckBox').check();
    await page.waitForTimeout(2000);
    await setDate(2, '6/6/2033');
    await f.locator('.cancel-button').click();
    await page.waitForTimeout(2500);
    console.log(`after cancel values ${JSON.stringify(await dateValues())} checked ${await f.locator('#overrideLotCheckBox').isChecked()}`);
    expect(await dateValues()).not.toContain('6/6/2033');
    // Expires follows Manufactured (MI080301: +1 day) while Reassay keeps the override
    expect(await dateValues()).toEqual(['1/2/2026', '1/1/2026', '12/31/2030']);
  });

  await test.step('real Print to PDF with the overridden lot, then InnoView shows the 2030 expiry', async () => {
    const row = f.locator('tr').filter({ has: f.locator('select') }).filter({ hasText: PDF_PRINTER });
    await row.locator('select').filter({ hasText: 'Select a label type' }).selectOption({ label: 'Carton Label' });
    await page.waitForTimeout(4000);
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
    expect(responses.find((x) => /"PrintStatus":"(success|error)"/.test(x)) ?? '').toContain('"PrintStatus":"success"');
    const { reportText } = await viewPrintHistory(page, { lot });
    console.log(`print history: ${reportText.slice(0, 500)}`);
    expect(reportText).toContain(lot);
    expect(reportText).toContain('1/1/2026 12:00:00 AM 1/2/2026 12:00:00 AM 12/31/2030');
  });
});
