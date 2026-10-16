// Bulk action: Mass Print ("MassPrint" in the #Action dropdown).
// No signature block (unlike most other bulk actions) -- just Print Entity / lot fields
// (Expires/Manufactured pre-filled, "System will calculate expiration date"), a Description, and
// a Select Printer dropdown (#drpPrinters) of configured virtual/network label printers -- no OS
// print dialog involved, fully automatable. Posts to /innovatum/MassPrint/SubmitJob. Button id is
// #PrintButton, not #SubmitButton.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('mass print submits a print job for the selected item', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'MassPrint');

  await gridFrame.fill('#txtDescription', 'Playwright mass print job');
  // HARD RULE: never print to a live printer. Mass Print prints from the SERVER (BarTender spooler), so a physical label printer queue gets the job (the module's old fixed choice,
  // Zebra 220XiIII Plus, received a job during the 2026-10-15 full run). Only a PDF printer is acceptable; without one the spec stops before submitting.
  const printerOptions = (await gridFrame.locator('#drpPrinters option').allInnerTexts()).map((t) => t.trim());
  const pdfPrinter = printerOptions.find((t) => /Microsoft Print to PDF/i.test(t));
  console.log(`MASS PRINT printers offered: ${JSON.stringify(printerOptions)} -> ${pdfPrinter ?? 'no PDF printer'}`);
  test.skip(!pdfPrinter, `no "Microsoft Print to PDF" in the Mass Print printer list (${printerOptions.join(', ')}); a job is never sent to a live printer`);
  await gridFrame.selectOption('#drpPrinters', { label: pdfPrinter! });
  expect((await gridFrame.locator('#drpPrinters option:checked').innerText()).trim(), 'the selected printer is the PDF printer').toMatch(/Microsoft Print to PDF/i);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/MassPrint/SubmitJob'), { timeout: 15_000 }),
    gridFrame.click('#PrintButton'),
  ]);
  const body = await response.json();
  expect(body.Success, `SubmitJob failed: ${JSON.stringify(body)}`).toBe(true);
});
