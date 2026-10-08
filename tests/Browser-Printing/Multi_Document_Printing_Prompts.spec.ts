// Multi Document Printing: template prompts and Edit Prompt Data (live 2026-10-06, HEADED because the module raises the Sentinel prompt). Fixture item on the approved Carton Label template
// SIMPLEPROMPTS, which asks ONE print-time prompt "What is your hair color?" (support/label-master-item.ts with master:false, persisted in test-data/prompts-item.json). Only Test Prints to the
// "Microsoft Print to PDF" row are done, so no lot is created and nothing reaches the print history. Flow (LabelPrintPanel.cshtml): a print click with unanswered prompts opens the "Print Time
// Prompts" dialog (#btnSavePrompts / #btnPromptCancel); after the answer is saved the "Edit Prompt Data" button (title "No Prompt Data Specified" while disabled) re-opens the dialog.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login } from '../support/robar';
import { ensureItemWithMaster } from '../support/label-master-item';
import * as bartender from '../support/bartender';

test.use({ headless: false, actionTimeout: 20_000 });

const PDF_PRINTER = 'Microsoft Print to PDF';
const QUESTION = 'What is your hair color?';

test('Multi Document Printing: print-time prompts (required, Cancel) and Edit Prompt Data', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const item = await ensureItemWithMaster(page, { template: 'SIMPLEPROMPTS', store: 'prompts-item.json', master: false, prefix: 'MBMDPP' });
  const stamp = Date.now().toString().slice(-6);
  let f: Frame;
  let browserPid = 0;

  const dlg = () => f.locator('.ui-dialog:visible');
  /** Cancel; the page may ask "Unsaved changes will be lost. Would you like to Continue?" (observed on an untouched answer) */
  const cancelPrompts = async () => {
    await f.locator('#btnPromptCancel').click();
    await page.waitForTimeout(1500);
    const cont = f.locator('.ui-dialog:visible button').filter({ hasText: 'Continue' });
    if ((await cont.count()) > 0) {
      console.log('cancel asked: Unsaved changes will be lost / Continue');
      await cont.first().click();
      await page.waitForTimeout(1500);
    }
  };
  const promptInput = () => dlg().locator('input[type=text], input:not([type])').last();
  const status = async (button: RegExp, answer?: string): Promise<string> => {
    const responses: string[] = [];
    const onResponse = async (r: import('@playwright/test').Response) => {
      if (r.url().includes('/MultiDocPrinting/GetPrinterStatus')) responses.push(await r.text().catch(() => ''));
    };
    page.on('response', onResponse);
    await f.getByRole('button', { name: button }).click();
    await page.waitForTimeout(3000);
    if (answer !== undefined) {
      await promptInput().fill(answer);
      await f.locator('#btnSavePrompts').click();
      await page.waitForTimeout(2000);
    }
    await bartender.confirmSentinelLaunchPrompt(page, browserPid);
    for (let i = 0; i < 30 && !responses.some((x) => /"PrintStatus":"(success|error)"/.test(x)); i++) await page.waitForTimeout(1000);
    page.off('response', onResponse);
    return responses.find((x) => /"PrintStatus":"(success|error)"/.test(x)) ?? '';
  };

  await test.step('open the module, enter a new lot for the prompts item, choose Carton Label on the PDF row', async () => {
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Multi Document Printing', exact: true }).click({ timeout: 10_000 });
    await page.waitForTimeout(4000);
    browserPid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, browserPid);
    for (let i = 0; i < 20; i++) {
      const g = page.frames().filter((x) => x.url().includes('MultiDocPrinting/MultiDocumentPrinting')).pop();
      if (g && (await g.locator('input[name="FlexLot_OrderNum"]').count()) > 0) { f = g; break; }
      await page.waitForTimeout(1000);
    }
    await f!.locator('input[name="FlexLot_OrderNum"]').fill(`MBMDPQO${stamp}`);
    await f!.locator('input[name="FlexLot_LotNum"]').fill(`MBMDPQL${stamp}`);
    await f!.locator('input[name="FlexLot_ItemNumber"]').fill(item);
    await f!.locator('input[name="FlexLot_ItemNumber"]').press('Tab');
    await f!.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(6000);
    const row = f!.locator('tr').filter({ has: f!.locator('select') }).filter({ hasText: PDF_PRINTER });
    await row.locator('select').filter({ hasText: 'Select a label type' }).selectOption({ label: 'Carton Label' });
    await page.waitForTimeout(4000);
    expect((await row.innerText()).replace(/\s+/g, ' ')).toContain('SIMPLEPROMPTS');
    await f!.locator('#testPrintCheckbox').check();
  });

  await test.step('before any answer: Edit Prompt Data is disabled with the tooltip "No Prompt Data Specified"', async () => {
    const edit = f.getByRole('button', { name: /Edit Prompt Data/ });
    await expect(edit).toBeDisabled();
    expect(await edit.getAttribute('title')).toBe('No Prompt Data Specified');
  });

  await test.step('Test Print asks the Print Time Prompts question; Cancel prints nothing', async () => {
    await f.getByRole('button', { name: /Test Print/ }).click();
    await page.waitForTimeout(4000);
    const text = (await dlg().allInnerTexts()).join(' ').replace(/\s+/g, ' ');
    console.log(`prompt dialog: ${text}`);
    expect(text).toContain('Print Time Prompts');
    expect(text).toContain('Label Type: Carton Label');
    expect(text).toContain(QUESTION);
    await cancelPrompts();
    await page.waitForTimeout(2000);
    await expect(dlg()).toHaveCount(0);
    await expect(f.getByRole('button', { name: /Edit Prompt Data/ })).toBeDisabled();
  });

  await test.step('an empty answer cannot be saved (Save disabled); answering "Brown" enables Save and lets the Test Print succeed', async () => {
    await f.getByRole('button', { name: /Test Print/ }).click();
    await page.waitForTimeout(3000);
    await promptInput().fill('');
    await expect(f.locator('#btnSavePrompts'), 'Save stays disabled while the answer is empty').toBeDisabled();
    // the Save button follows key events, not just the input event of fill()
    await promptInput().pressSequentially('Brown', { delay: 80 });
    await expect(f.locator('#btnSavePrompts')).toBeEnabled();
    await f.locator('#btnSavePrompts').click();
    await page.waitForTimeout(2000);
    await bartender.confirmSentinelLaunchPrompt(page, browserPid);
    await page.waitForTimeout(8000);
  });

  await test.step('after an answer, Edit Prompt Data is enabled and re-opens the dialog with the stored answer; a new answer is kept', async () => {
    const edit = f.getByRole('button', { name: /Edit Prompt Data/ });
    console.log(`Edit Prompt Data enabled: ${await edit.isEnabled()} title "${await edit.getAttribute('title')}"`);
    await expect(edit).toBeEnabled();
    await edit.click();
    await page.waitForTimeout(3000);
    console.log(`edit dialog: "${(await dlg().allInnerTexts()).join(' | ').replace(/\s+/g, ' ')}" value "${await promptInput().inputValue()}"`);
    expect(await promptInput().inputValue()).toBe('Brown');
    await promptInput().fill('');
    await promptInput().pressSequentially('Blue', { delay: 80 });
    await f.locator('#btnSavePrompts').click();
    await page.waitForTimeout(2000);
    await edit.click();
    await page.waitForTimeout(3000);
    expect(await promptInput().inputValue()).toBe('Blue');
    await cancelPrompts();
    await page.waitForTimeout(1500);
  });

  await test.step('the next Test Print uses the stored answer: no new prompt, status success', async () => {
    const result = await status(/Test Print/);
    console.log(`status: ${result}`);
    expect(await dlg().count(), 'no prompt dialog once answered').toBe(0);
    expect(result).toContain('"PrintStatus":"success"');
  });
});
