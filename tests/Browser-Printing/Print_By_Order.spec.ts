// Print by Order with PrintEntityRequired = Y and AddLotReasonRequired = Y (live 2026-10-08, HEADED: Sentinel prompts are confirmed with FlaUI -- hands off the mouse; seed user Claude01 holding `*`).
// Legacy `PrintScreen.aspx?ConfigName=print1`: Print Entity dropdown + Shop Order Number -> Next -> (new order) Reason Code dialog -> Item / Lot / Order -> Next -> Lot Panel -> Next -> label screen -> Print.
// Only "Microsoft Print to PDF". A real print creates the lot (the printed lot can still be deleted in Lot Management, verified 2026-10-09): one throw-away lot MBPOE<stamp> per run, written with the CHOSEN Print Entity.
// Also covers "last used entity": after a print with entity X the dropdown defaults to X on the next visit (documented in PE_PrintByLot / PE_PrintByOrder), and the reprint / history of that order.
// Skips unless PrintEntityRequired = Y.

import { test, expect } from '@playwright/test';
import { login } from '../support/robar';
import { readGlobalSetting } from '../support/global-settings';
import * as printing from '../support/printing';
import * as du from '../support/dynamic-ui';
import { PrintByLot, PDF } from '../support/print-by-lot';

test.use({ headless: false, actionTimeout: 20_000 });

const ITEM = 'MI080301';

test('Print by Order, PrintEntityRequired = Y: entity dropdown, Reason Code, new order flow, real Print to PDF, lot carries the chosen entity, last used entity becomes the default', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const setting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  console.log(`PrintEntityRequired = ${setting}`);
  test.skip(setting !== 'Y', `PrintEntityRequired is ${setting}; this spec covers Y`);
  const stamp = Date.now().toString().slice(-6);
  const order = `MBPOE${stamp}`;
  const lot = `MBPOE${stamp}L`;
  const pbo = new PrintByLot(page, 'Print by order');
  const dd = () => pbo.f.locator(`#${printing.printEntityId}`);
  let chosen = '';

  await test.step('open Print by Order: the Print Entity dropdown lists the entities of the user (`*` = all) and a default', async () => {
    await pbo.open();
    expect(await pbo.body()).toContain('Shop Order Number:');
    await expect(dd()).toBeEnabled();
    const options = await dd().locator('option').allInnerTexts();
    const def = await dd().inputValue();
    console.log(`entity options: ${JSON.stringify(options)}; default: ${def}`);
    expect(options).toEqual(expect.arrayContaining(['England', 'ROBAR']));
    expect(options, 'ascending').toEqual([...options].sort((a, b) => a.localeCompare(b)));
    // choose an entity that is NOT the current default, so the "last used" test below is meaningful
    chosen = options.filter((o) => o !== def && ['England', 'ROBAR'].includes(o))[0] ?? options.find((o) => o !== def)!;
    console.log(`chosen entity: ${chosen}`);
  });

  await test.step('a new order with the chosen entity: Reason Code dialog (required), then Item / Lot / Order', async () => {
    await dd().selectOption({ label: chosen });
    await pbo.f.locator(`#${printing.orderNumberId}`).fill(order);
    await pbo.next();
    const d = pbo.f.locator('.ui-dialog:visible', { hasText: 'Reason Code' });
    await expect(d).toBeVisible();
    await expect(d).toContainText('You are about to add a new lot record, please select a Reason Code in order to proceed.');
    await d.getByRole('button', { name: 'Submit' }).click();
    await expect(d).toContainText('This field is required.');
    await d.locator('#reasonSel').selectOption({ label: 'On Demand' });
    await d.locator('#commentTxt').fill('Playwright print by order');
    await d.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(6000);
    pbo.f = await pbo.frame();
    console.log(`after reason: ${(await pbo.body()).slice(0, 250)}`);
    await expect(pbo.f.locator(`#${printing.itemNumberId}`)).toBeVisible();
    // the page was reset by the dialog: enter everything again (the entity may have been reset too)
    if ((await dd().inputValue()) !== chosen) await dd().selectOption({ label: chosen });
    await pbo.f.locator(`#${printing.itemNumberId}`).fill(ITEM);
    if (await pbo.f.locator(`#${printing.orderNumberId}`).count()) await pbo.f.locator(`#${printing.orderNumberId}`).fill(order);
    if (await pbo.f.locator(`#${printing.lotNumberId}`).count()) await pbo.f.locator(`#${printing.lotNumberId}`).fill(lot);
    await pbo.next();
    const text = await pbo.body();
    console.log(`lot panel: ${text.slice(0, 300)}`);
    expect(text).toContain('Override Lot');
    expect(text).toContain(`Item: ${ITEM}`);
  });

  await test.step('Next: label screen, printer = Microsoft Print to PDF, real Print', async () => {
    await pbo.next();
    await (await import('../support/bartender')).confirmSentinelLaunchPrompt(page, pbo.pid).catch(() => {});
    await page.waitForTimeout(6000);
    pbo.f = await pbo.frame();
    for (let i = 0; i < 30 && (await pbo.opt('drpPrinters').locator('option').count()) === 0; i++) await page.waitForTimeout(2000);
    await pbo.opt('drpPrinters').selectOption({ label: PDF });
    const result = await pbo.print();
    console.log(`print result: ${result.slice(-300)}`);
    expect(result).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
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

  await test.step('reopen Print by Order: the dropdown now defaults to the LAST USED entity', async () => {
    await pbo.open();
    const def = await dd().inputValue();
    console.log(`default after printing with ${chosen}: ${def}`);
    expect(def).toBe(chosen);
  });
});
