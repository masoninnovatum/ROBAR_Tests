// Creates a brand-new (never-printed) lot under the UAT_6356 test item via Print by Lot.
// Reuses tests/support/printing.ts's confirmed-working helpers, including nativeClick for the
// "Next" button (a plain Playwright .click() silently no-ops on this screen family's ASP.NET
// AJAX/CSP-gated postback, per robar-module-reference.md's "Browser Printing" section).

import { test } from '@playwright/test';
import { login } from '../support/robar';
import { openPrintByLot, nativeClick, lotNumberId, itemNumberId, nextButtonId } from '../support/printing';
import { resolveBrowserPid, confirmSentinelLaunchPrompt } from '../support/bartender';

const ITEM_NUMBER = 'MBUAT6356E_1790694817112';

test('create a fresh never-printed lot for UAT_6356', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  const frame = await openPrintByLot(page);

  // Confirmed in robar-module-reference.md: ClientPrintMethod=Sentinel for Chrome means opening
  // ANY printing module at all (not a specific button) triggers Chromium's native "Open
  // SentinelLauncher?" external-protocol dialog -- same mechanism as Template Management's
  // BarTender launch, reusing that module's own confirmed-working dismissal helper.
  const browserPid = await resolveBrowserPid(page);
  await confirmSentinelLaunchPrompt(page, browserPid);

  const lotNumber = `UAT6356LOT_${Date.now()}`;
  console.log(`LOT_NUMBER=${lotNumber}`);

  // The initial screen only has Lot Number (+ Print Entity) -- confirmed live via screenshot, no
  // Item Number field exists here at all. Per robar-module-reference.md: "if the lot number alone
  // resolves unambiguously, it skips straight to the Lot Panel; if ambiguous or new, it prompts
  // for Item/Order too" -- on a SEPARATE screen reached after this first Next, not simultaneously.
  await frame.fill(`#${lotNumberId}`, lotNumber, { timeout: 5000 });
  await nativeClick(frame, nextButtonId);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_lot_after_first_next.png', fullPage: true });

  let bodyText = await frame.locator('body').innerText();
  console.log('=== page text after first Next (first 1000 chars) ===');
  console.log(bodyText.slice(0, 1000));

  const itemNumberField = frame.locator(`#${itemNumberId}`);
  const needsItemNumber = await itemNumberField.count().then((c) => c > 0);
  console.log(`Item Number field present on this screen: ${needsItemNumber}`);

  if (needsItemNumber) {
    await itemNumberField.fill(ITEM_NUMBER, { timeout: 5000 });
    await nativeClick(frame, nextButtonId);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_lot_after_second_next.png', fullPage: true });
    bodyText = await frame.locator('body').innerText();
    console.log('=== page text after second Next (first 1500 chars) ===');
    console.log(bodyText.slice(0, 1500));
  }

  const hasReasonPrompt = bodyText.toLowerCase().includes('reason code');
  console.log('Reason Code prompt present: ' + hasReasonPrompt);
});
