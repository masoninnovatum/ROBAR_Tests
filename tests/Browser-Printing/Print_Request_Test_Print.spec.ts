// Test Print on Print by Order and the default printer (live 2026-10-09, HEADED, Print to PDF only, THREE copies printed: 1 test + 1 test + 1 real; seed user Claude01, TST703).
// ValMaster (module "WEB - Print Request"): WP20130208001F103.0.1 a Test checkbox in the print options changes the Print button into a red "Test Print" button; F103.1.1 the user can click Test Print indefinitely until Test is
// unchecked; F103.1.2 test prints are excluded from reprint calculations; F103.3.1 test prints are recorded with status "Test Printed" (not checked here: Print History Inquiry returns HTTP 500 on TST703 and the InnoView
// report lists real prints only); FRS-8.1.10.2 the default printer is the last printer used for the label (only when it exists on the user's machine); FRS-8.1.10.3 no printing after a successful print without reset.
// Item A (batch blank, Copy lowered to 1). TestPrintShow must be Y for the checkbox (it is on TST703: the checkbox is shown).

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { login } from '../support/robar';
import { toOrderLabelScreen } from '../support/print-request';
import { PDF } from '../support/print-by-lot';

test.use({ headless: false, actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Test Print: red Test Print button, repeatable, excluded from reprint; default printer = last used; locked after a real print', async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const A = JSON.parse(fs.readFileSync('test-data/batchqty-item-a.json', 'utf8')).item as string;
  const stamp = Date.now().toString().slice(-6);
  const order = `MBPTP${stamp}`;
  const lot = `MBPTP${stamp}L`;

  const buttonState = async (pb: Awaited<ReturnType<typeof toOrderLabelScreen>>) => {
    const b = pb.opt('btnDoPrint');
    return { value: await b.inputValue().catch(() => ''), cls: await b.getAttribute('class'), color: await b.evaluate((e) => getComputedStyle(e).color + ' / ' + getComputedStyle(e).backgroundColor), enabled: await b.isEnabled() };
  };

  let pb = await toOrderLabelScreen(page, order, lot, A);
  await test.step('label screen: the Test checkbox and the Print button; Copy lowered to 1', async () => {
    const tp = pb.opt('chbTestPrint');
    console.log(`TEST checkbox visible=${await tp.isVisible()} checked=${await tp.isChecked()}`);
    console.log(`BUTTON default ${JSON.stringify(await buttonState(pb))}`);
    console.log(`PRINTERS ${JSON.stringify(await pb.opt('drpPrinters').locator('option').allInnerTexts())}; selected before choosing: (set to PDF by the helper)`);
    await pb.opt('txtCopies').fill('1');
    await pb.opt('txtCopies').press('Tab');
  });

  await test.step('tick Test: the Print button becomes a red "Test Print" button (F103.0.1)', async () => {
    await pb.opt('chbTestPrint').check();
    await page.waitForTimeout(1500);
    const s = await buttonState(pb);
    console.log(`BUTTON with Test ticked ${JSON.stringify(s)}`);
    if (!/test/i.test(s.value) && !/test/i.test(s.cls ?? '')) deviation('WP20130208001F103.0.1', 'the Print button changes to a red "Test Print" button', JSON.stringify(s));
    expect.soft(s.value + ' ' + (s.cls ?? '')).toMatch(/test/i);
  });

  await test.step('click Test Print twice (F103.1.1: indefinitely) - 1 copy each', async () => {
    for (const n of [1, 2]) {
      const result = await pb.print();
      console.log(`TEST PRINT ${n}: ${result.slice(-220)}`);
      expect.soft(result, `test print ${n}`).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
      const s = await buttonState(pb);
      console.log(`BUTTON after test print ${n}: ${JSON.stringify(s)}`);
      if (!s.enabled) deviation('WP20130208001F103.1.1', 'Test Print stays clickable until Test is unchecked', `button disabled after test print ${n}`);
      if (!s.enabled) break;
    }
  });

  await test.step('a new visit after test prints only: Reprint is NOT forced (F103.1.2: test prints are excluded)', async () => {
    pb = await toOrderLabelScreen(page, order, lot, A, { existing: true, keepPrinter: true });
    const reprint = pb.opt('chbReprint');
    const selected = await pb.opt('drpPrinters').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0]?.text ?? '');
    console.log(`REVISIT after test prints: reprintChecked=${await reprint.isChecked()} disabled=${await reprint.isDisabled()} defaultPrinter="${selected}" copies=${await pb.opt('txtCopies').inputValue()}`);
    if (await reprint.isChecked()) deviation('WP20130208001F103.1.2', 'test prints excluded from reprint calculations (Reprint stays unchecked)', 'Reprint ticked after test prints only');
    expect.soft(await reprint.isChecked(), 'Reprint after test prints only').toBe(false);
    if (selected !== PDF) deviation('FRS-8.1.10.2', `default printer = the last printer used for this label (${PDF})`, `default printer "${selected}"`);
    await pb.opt('drpPrinters').selectOption({ label: PDF });
  });

  await test.step('untick Test, real Print of 1 copy: the panel is locked after the print (FRS-8.1.10.3)', async () => {
    await pb.opt('chbTestPrint').uncheck();
    await page.waitForTimeout(1500);
    console.log(`BUTTON with Test unticked ${JSON.stringify(await buttonState(pb))}`);
    await pb.opt('txtCopies').fill('1');
    await pb.opt('txtCopies').press('Tab');
    const result = await pb.print();
    console.log(`REAL PRINT: ${result.slice(-200)}`);
    expect(result).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
    const locked = !(await pb.opt('btnDoPrint').isEnabled());
    console.log(`PRINT BUTTON locked after the real print: ${locked}`);
    if (!locked) deviation('FRS-8.1.10.3', 'no further printing after a successful print without Reset', 'Print button still enabled');
    expect.soft(locked).toBe(true);
  });

  await test.step('a new visit after the real print: default printer = last used (PDF), Reprint forced', async () => {
    pb = await toOrderLabelScreen(page, order, lot, A, { existing: true, keepPrinter: true });
    const selected = await pb.opt('drpPrinters').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0]?.text ?? '');
    console.log(`REVISIT after the real print: defaultPrinter="${selected}" reprintChecked=${await pb.opt('chbReprint').isChecked()} copies=${await pb.opt('txtCopies').inputValue()}`);
    if (selected !== PDF) deviation('FRS-8.1.10.2', `default printer = the last printer used for this label (${PDF})`, `default printer "${selected}"`);
  });
});
