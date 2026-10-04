// Item Edit page's own PDF (#viewPDFBtn) and Insert Symbols (#openSymbolsBtn) buttons --
// previously only doc/code-reviewed (IM_CreatePDF-1.29, IM_InsertSymbols-1.37 in
// robar-module-reference.md's Campaign Manager section), never actually driven live. Confirmed
// via source (Innovatum.Pages.ItemsManagement.MVC/Views/Items/Edit.cshtml):
//
// RTF Editor (#openRtfBtn) is deliberately NOT covered here -- confirmed live (2026-09-30) to be
// enabled for Carton Label and to launch a real native Sentinel app
// (Innovatum.Sentinel.Plugin.ItemRtfEdit, window "Item RTF Editor"), but full automation of it was
// paused partway (low customer usage, not worth the time right now) -- see
// robar-module-reference.md's Campaign Manager section, "RTF Editor -- paused, resume later" for
// everything already learned (control map, the Save/Cancel-don't-close-the-window gotcha, the
// unsaved-changes CustomMessageBoxWindow, variable spawn timing) so a future pass doesn't
// re-discover it from scratch.
// - #viewPDFBtn only requires a Template to be set (disable: templateIsEmpty()) -- works on an
//   approved OR unapproved item. Opens a jQuery UI dialog (#viewPDFDialog, dynamic Submit/Cancel
//   buttons, not stable ids) which GETs items/ViewPDF, then window.open()s a separate PDF
//   viewer tab on success.
// - #openSymbolsBtn requires isEditable() (i.e. UNAPPROVED) and a Template. Opens a dynamically
//   created #symbolsDiv dialog loading the Symbols partial -- plain <button class="btn"
//   value="...">symbol</button> elements; clicking one copies to clipboard and shows a green
//   confirmation message inside the dialog itself (".alert .message-success"), not a toast.
import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

// Confirmed live 2026-09-30: the PDF button's window.open() popup resolves correctly (real URL,
// contains PDFFileWindow) under headed mode but comes back with an empty URL under headless:true
// -- a headless-Chromium-specific popup-handling quirk, not a real product issue. Keep this headed.
test.use({ headless: false });

test('Item Edit PDF and Insert Symbols buttons', async ({ page, context }) => {
  test.setTimeout(180_000);

  await login(page);
  await openMenuItem(page, 'Campaign Manager');
  const cmFrame = await findFrame(page, 'campaignmanager');
  await page.waitForTimeout(1000);

  const itemNumber = 'MBPSR' + Date.now().toString().slice(-6);
  await cmFrame.click('#btnCreateNew');
  await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible' });
  await cmFrame.fill('#txtItemNumber', itemNumber);
  await cmFrame.selectOption('#ddlLabelType', LABEL_TYPE);
  await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');

  const editFrame = await findFrame(page, 'items/edit');
  await editFrame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);

  await editFrame.selectOption('select[name="txtTemplateName"]', TEMPLATE);
  await editFrame.fill('input[name="txtDescription"]', 'Playwright -- Item Edit PDF/Symbols/RTF exercise');

  const [saveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/') && r.request().method() === 'POST', { timeout: 15_000 }),
    editFrame.click('button:has-text("Save")'),
  ]);
  expect(saveResponse.status()).toBe(200);
  await page.waitForTimeout(1000);

  await test.step('Insert Symbols -- editable item', async () => {
    await expect(editFrame.locator('#openSymbolsBtn')).toBeEnabled({ timeout: 10_000 });
    await editFrame.click('#openSymbolsBtn');

    const symbolsDialog = editFrame.locator('#symbolsDiv');
    await symbolsDialog.locator('.btn').first().waitFor({ state: 'visible', timeout: 10_000 });
    const firstSymbol = symbolsDialog.locator('.btn').first();
    const symbolValue = await firstSymbol.getAttribute('value');
    await firstSymbol.click();

    const confirmation = symbolsDialog.locator('.message-success');
    await expect(confirmation).toBeVisible({ timeout: 5_000 });
    // Confirmed live 2026-09-30: "copied to clipboard" is lowercase here, with the symbol quoted
    // -- e.g. `"©" copied to clipboard.` -- genuinely different wording from MDM's own Insert
    // Symbols confirmation ("'X' Copied to Clipboard", capitalized, single-quoted) despite sharing
    // the same underlying feature concept. Don't reuse one module's exact string for the other.
    await expect(confirmation).toContainText('copied to clipboard.');
    console.log(`Insert Symbols: clicked symbol "${symbolValue}", confirmation: "${await confirmation.textContent()}"`);

    // #symbolsDiv is only the dialog's CONTENT pane -- jQuery UI wraps it together with the
    // titlebar (which has its own "Close" [X] icon button, confusingly also named "Close") and
    // the buttonpane as SIBLINGS, not children of #symbolsDiv. Scope to the buttonpane specifically
    // (same pattern as every other jQuery UI dialog's Submit button elsewhere in this suite),
    // not a bare getByRole('button', {name: 'Close'}) scoped inside #symbolsDiv -- that matches
    // zero elements and hangs on auto-retry rather than failing fast.
    await editFrame.locator('.ui-dialog-buttonpane button:has-text("Close")').first().click();
    await expect(editFrame.locator('#symbolsDiv')).toHaveCount(0, { timeout: 5_000 });
  });

  await test.step('PDF -- view/generate a PDF for the (still unapproved) item', async () => {
    await expect(editFrame.locator('#viewPDFBtn')).toBeEnabled({ timeout: 10_000 });
    await editFrame.click('#viewPDFBtn');

    const pdfDialog = editFrame.locator('#viewPDFDialog');
    await expect(pdfDialog).toBeVisible({ timeout: 10_000 });

    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: 20_000 }),
      editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').first().click(),
    ]);
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    console.log(`PDF button: popup opened, URL: ${popup.url()}`);
    expect(popup.url()).toContain('PDFFileWindow');
    await popup.close();
  });
});
