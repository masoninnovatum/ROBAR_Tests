// Print by Lot REPRINT (live 2026-10-07, HEADED, PrintEntityRequired = N). After a print the whole print panel is disabled (only Reset works). Reset + re-entering the printed lot gives the label screen
// with "Reprint" ticked and DISABLED and a "Reprint Options" block: User ID (pre-filled with the logged-in user), Password, Reason (Damaged Labels / Incorrect Data Entry), Comments. Print without a reason
// = "Please select a reprint reason."; a missing / wrong password = "Invalid Username/Password. UserID:<user>" and the Print button is disabled until the password field gets key events again.
// One throw-away lot MBPBR<stamp> per run (lots cannot be deleted). Only Microsoft Print to PDF.

import { test, expect } from '@playwright/test';
import { login, PASSWORD, USERNAME } from '../support/robar';
import { viewPrintHistory } from '../support/print-history';
import * as printing from '../support/printing';
import { PrintByLot, PDF } from '../support/print-by-lot';

test.use({ headless: false, actionTimeout: 20_000 });

const ITEM = 'MI080301';

test('Print by Lot reprint: Reprint box locked on, reason + password required, wrong password refused, reprint succeeds and is in the Reprints history', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const lot = `MBPBR${stamp}`;
  const p = new PrintByLot(page);

  const msg = async (): Promise<string> => {
    await page.waitForTimeout(3000);
    p.f = await p.frame();
    const text = await p.body();
    await p.f.locator('.ui-dialog:visible button').filter({ hasText: /Ok/ }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    return text;
  };
  const typePassword = async (value: string) => {
    const pw = p.opt('selSignature_ctl07');
    await pw.fill('');
    await pw.pressSequentially(value, { delay: 40 }); // key events re-enable the Print button after a failed attempt
  };

  await test.step('first print of a new lot succeeds', async () => {
    await p.open();
    await p.toLabelScreen(lot, ITEM, `MBPBRO${stamp}`);
    expect(await p.print()).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
    await expect(p.opt('btnDoPrint'), 'the whole print panel is locked after a print').toBeDisabled();
  });

  await test.step('Reset + the same lot again: Reprint is ticked and locked, Reprint Options appear (User ID = the user, Reason list)', async () => {
    await printing.nativeClick(p.f, printing.resetButtonId);
    await page.waitForTimeout(4000);
    p.f = await p.frame();
    await p.toLabelScreen(lot);
    await expect(p.opt('chbReprint')).toBeChecked();
    await expect(p.opt('chbReprint')).toBeDisabled();
    expect(await p.opt('selSignature_ctl05').inputValue()).toBe(USERNAME);
    const reasons = (await p.opt('selSignature_ctl09').locator('option').allInnerTexts()).map((t) => t.trim());
    console.log(`reasons: ${JSON.stringify(reasons)}`);
    expect(reasons).toEqual(expect.arrayContaining(['Damaged Labels', 'Incorrect Data Entry']));
    expect(await p.body()).toContain('Reprint Options');
  });

  await test.step('Print without a reason: "Please select a reprint reason."', async () => {
    await p.opt('btnDoPrint').click();
    expect(await msg()).toContain('Please select a reprint reason.');
  });

  await test.step('a reason but no password: "Invalid Username/Password. UserID:<user>"', async () => {
    await p.opt('selSignature_ctl09').selectOption({ label: 'Damaged Labels' });
    await p.opt('btnDoPrint').click();
    expect(await msg()).toContain(`Invalid Username/Password. UserID:${USERNAME}`);
  });

  await test.step('a wrong password: the same message', async () => {
    await typePassword('definitely-not-the-password');
    await p.opt('btnDoPrint').click();
    expect(await msg()).toContain(`Invalid Username/Password. UserID:${USERNAME}`);
  });

  await test.step('the right password + reason + comment: the reprint prints', async () => {
    await typePassword(PASSWORD);
    await p.opt('selSignature_ctl11').fill('Playwright reprint');
    expect(await p.print()).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
  });

  await test.step('InnoView: two history rows for the lot, one of them in "View Print History Reprints"', async () => {
    const all = await viewPrintHistory(page, { lot });
    const count = all.reportText.split(lot).length - 1;
    console.log(`history rows for ${lot}: ${count}; ${all.reportText.slice(0, 400)}`);
    expect(count).toBe(2);
    const reprints = await viewPrintHistory(page, { lot, report: 'View Print History Reprints' });
    console.log(`reprint rows: ${reprints.reportText.split(lot).length - 1}; ${reprints.reportText.slice(0, 500)}`);
    expect(reprints.reportText).toContain(lot);
    expect(reprints.reportText).toContain(PDF);
    for (const col of ['Reprint Reason', 'Reprint Comment', 'Reprint Signed By']) expect(reprints.reportText).toContain(col);
    expect(reprints.reportText).toContain('Damaged Labels');
    expect(reprints.reportText).toContain('Playwright reprint');
  });
});
