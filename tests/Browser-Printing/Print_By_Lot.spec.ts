// Print by Lot with PrintEntityRequired = N (the TST703 value; read-only check, LastTouch 09/29/2026), live 2026-10-07, HEADED (Sentinel prompts confirmed with FlaUI -- hands off the mouse).
// Legacy WebForms screen `Innovatum/ROBAR/printing/Screens/PrintScreen.aspx?ConfigName=LotNumber`: Lot Number -> Next -> (unknown lot: "No lot found." + Item / Shop Order fields) -> Next -> Lot Panel
// (Override Lot Data) -> Next -> label type / Label Control / printer screen -> Print. With the setting N there is NO Print Entity dropdown and a new lot is written with entity ROBAR.
// Only "Microsoft Print to PDF" is ever used. A real print creates the lot (the lot can be deleted again in Lot Management, verified 2026-10-09): one throw-away lot `MBPBL<stamp>` per run. Skips itself when the setting is Y.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login } from '../support/robar';
import { readGlobalSetting } from '../support/global-settings';
import * as printing from '../support/printing';
import * as bartender from '../support/bartender';
import { viewPrintHistory } from '../support/print-history';

test.use({ headless: false, actionTimeout: 20_000 });

const ITEM = 'MI080301';
const PDF = 'Microsoft Print to PDF';
const P = 'ctl00_printContentHolder_';

test('Print by Lot, PrintEntityRequired = N: no Print Entity dropdown, new lot flow, lot panel, label screen, real Print to PDF', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  const setting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  console.log(`PrintEntityRequired = ${setting}`);
  test.skip(setting !== 'N', `PrintEntityRequired is ${setting}; this spec covers N`);
  const stamp = Date.now().toString().slice(-6);
  const lot = `MBPBL${stamp}`;
  const order = `MBPBO${stamp}`;
  let pid = 0;
  let f: Frame;
  const body = async () => (await f.locator('body').innerText()).replace(/\s+/g, ' ');
  const next = async () => {
    await printing.nativeClick(f, printing.nextButtonId);
    await page.waitForTimeout(6000);
  };
  const btn = (suffix: string) => f.locator(`#${P}posPrintOptions_${suffix}`);

  await test.step('open Print by Lot (Sentinel prompt): only a Lot Number field, no Print Entity dropdown', async () => {
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Print by lot', exact: true }).click();
    await page.waitForTimeout(4000);
    pid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, pid);
    f = await printing_frame();
    await page.waitForTimeout(3000);
    expect(await body()).toContain('Lot Number:');
    expect(await f.locator(`#${printing.printEntityId}`).count(), 'no Print Entity dropdown while PrintEntityRequired = N').toBe(0);
    expect(await f.locator(`#${printing.itemNumberId}`).count()).toBe(0);
  });

  async function printing_frame(): Promise<Frame> {
    for (let i = 0; i < 20; i++) {
      const g = page.frames().filter((x) => x.url().includes('PrintScreen')).pop();
      if (g) return g;
      await page.waitForTimeout(1000);
    }
    throw new Error('Print screen did not load');
  }

  await test.step('an unknown lot: "No lot found." and Item Number / Shop Order Number fields appear', async () => {
    await f.locator(`#${printing.lotNumberId}`).fill(lot);
    await next();
    const text = await body();
    expect(text).toContain('No lot found.');
    await expect(f.locator(`#${printing.itemNumberId}`)).toBeVisible();
    await expect(f.locator(`#${printing.orderNumberId}`)).toBeVisible();
  });

  await test.step('Lot + Item + Order: the Lot Panel (new lot, Manufactured editable, Expires = Manufactured + 1 day)', async () => {
    await f.locator(`#${printing.itemNumberId}`).fill(ITEM);
    await f.locator(`#${printing.orderNumberId}`).fill(order);
    await next();
    const text = await body();
    console.log(`lot panel: ${text.slice(0, 300)}`);
    expect(text).toContain('Override Lot');
    expect(text).toContain(`Item: ${ITEM}`);
    const v = async (id: string) => f.locator(`#${P}deLot_${id}`).inputValue();
    expect(await v('txtLotNumber')).toBe(lot);
    expect(await v('txtOrderNumber')).toBe(order);
    const mfg = new Date(await v('txtLotManufactured'));
    const exp = new Date(await v('txtLotExpiration'));
    expect((exp.getTime() - mfg.getTime()) / 86_400_000, 'Expires = Manufactured + 1 day for this item').toBe(1);
    await expect(f.locator(`#${P}deLot_txtLotManufactured`)).toBeEnabled();
    await expect(f.locator(`#${P}deLot_txtLotExpiration`)).toBeDisabled();
    await expect(f.locator(`#${P}deLot_txtLotNumber`)).toBeDisabled();
  });

  await test.step('Next: label type (Carton Label), Label Control (LCN), copies 1, printers incl. PDF, Reprint / Test checkboxes and the View actions', async () => {
    await next();
    await bartender.confirmSentinelLaunchPrompt(page, pid).catch(() => {});
    await page.waitForTimeout(6000);
    const text = await body();
    console.log(`label screen: ${text.slice(0, 700)}`);
    expect(text).toContain('Please select a label type');
    expect(text).toContain('Carton Label');
    expect(text).toMatch(/LCN:LCN\d+/);
    expect(await btn('txtCopies').inputValue()).toBe('1');
    const printers = await btn('drpPrinters').locator('option').allInnerTexts();
    expect(printers).toContain(PDF);
    expect((await btn('drpSelectedAction').locator('option').allInnerTexts()).map((t) => t.trim())).toEqual(expect.arrayContaining(['View Master', 'View Preview', 'View Compare']));
    await btn('drpPrinters').selectOption({ label: PDF });
  });


  /**
   * Clicks Print with a REAL click -- Chrome only launches the sentinel: protocol after a user activation, and a script-dispatched click (nativeClick) silently
   * blocks it: no prompt, the server waits ~15 s and the page shows "Timeout waiting for Sentinel." with PrintStatus Failed (confirmed 2026-10-07) --
   * confirms the Sentinel prompt and waits for the result dialog ("Printed <PID>.prn to <printer>" / "Test Printed ...").
   */
  const printNow = async (): Promise<string> => {
    await btn('btnDoPrint').click();
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(2000);
      await bartender.confirmSentinelLaunchPrompt(page, pid).catch(() => {});
      f = await printing_frame();
      const text = await body().catch(() => '');
      if (/Printed PID_\w+\.prn|Timeout waiting for Sentinel|Print Failed/i.test(text)) {
        await f.locator('.ui-dialog:visible button, input[value=Ok]').filter({ hasText: /Ok/ }).first().click({ timeout: 3000 }).catch(() => {});
        return text;
      }
    }
    return body();
  };

  await test.step('real Print to the PDF printer', async () => {
    await btn('chbTestPrint').uncheck();
    const text = await printNow();
    console.log(`after Print: ${text.slice(-160)}`);
    expect(text).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
  });

  await test.step('the real print is in InnoView > View Print History (PDF printer, 1 copy, entity ROBAR)', async () => {
    const { reportText } = await viewPrintHistory(page, { lot });
    console.log(`print history: ${reportText.slice(0, 500)}`);
    expect(reportText.split(lot).length - 1, 'exactly one history row').toBe(1);
    expect(reportText).toContain(order);
    expect(reportText).toContain(PDF);
    expect(reportText).toContain('ROBAR');
  });
});
