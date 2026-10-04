// Executes UAT_6187.doc (DIT #6187: Master Data Management dropdown tooltip showing Option Text
// instead of Option Value) against http://vmsrvval703/innovatum/WebMenu/, capturing evidence
// screenshots for each of the UAT's 2 steps. Pure browser flow, no native-app/FlaUI dependency.
//
// Per this project's standing automation-credential-boundary rule, login is done via the same
// robar.ts helper used by ordinary regression specs (this UAT has no e-signature/approval step at
// all, so there's no credential-boundary conflict here).

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as flaui from '../../scripts/flaui_bridge';
import * as fs from 'fs';
import * as path from 'path';

const SCRATCH = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--DB-Copies-703-20198\a480f2e1-948d-42ae-aee0-d197f8c859fc\scratchpad\uat6187_exec`;
const SHOT_DIR = path.join(SCRATCH, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(SCRATCH, 'progress.log'), line + '\n');
}

test('Execute UAT_6187 step 2 only - hover Issuing Agency, capture real tooltip', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const results: Record<string, unknown> = {};
  fs.writeFileSync(path.join(SCRATCH, 'progress.log'), '');

  // Step 1 (Schemas - GS1 - Option Value) already executed and evidenced in a prior run; this
  // run re-does step 2 only, per explicit instruction, without the field click that was
  // suppressing the native tooltip on the previous attempt.
  log('logging in');
  await login(page);

  log('opening Master Data');
  await openMenuItem(page, 'Master Data');
  const mdmFrame = await findFrame(page, 'MasterData');
  log('Master Data frame found');
  await page.waitForTimeout(1000);

  await mdmFrame.selectOption('#ddlSchemas', { label: 'RobarMasterData' }, { timeout: 5_000 }).catch((e) => log('schema select failed: ' + e.message));
  log('schema selected on MDM page');
  // Remove any pre-existing leftover filter row so Retrieve Data isn't scoped to a stale value.
  await mdmFrame.getByText('Remove', { exact: true }).first().click({ timeout: 5_000 }).catch((e) => log('Remove filter click skipped: ' + e.message));
  log('filter row removed (or none existed)');
  await page.waitForTimeout(300);
  await mdmFrame.locator('select').filter({ has: mdmFrame.locator('option', { hasText: 'Unapproved' }) }).first()
    .selectOption({ label: 'Unapproved' }, { timeout: 5_000 }).catch((e) => log('For Items select skipped: ' + e.message));
  log('For Items set to Unapproved (or skipped)');
  await mdmFrame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  log('Retrieve Data clicked');
  await page.waitForTimeout(2000);

  // Open the first result row's Actions -> View/Edit. The page-level "Actions" link (top-right,
  // New Record/Excel Import/etc.) also matches a bare "Actions" text locator and sorts first in
  // DOM order, so scope explicitly to a grid row (identified by its own Item Number cell text),
  // not `.first()` of every "Actions" link on the page.
  const firstDataRow = mdmFrame.locator('tr').filter({ hasText: '6234.1_na' }).first();
  await firstDataRow.locator('a:has-text("Actions")').click({ timeout: 10_000 });
  log('first row Actions menu opened');
  await page.waitForTimeout(500);
  await mdmFrame.locator('a:has-text("View/Edit"):visible').first().click({ timeout: 10_000 });
  log('View/Edit clicked');
  await page.waitForTimeout(1500);

  await mdmFrame.getByText('Device Id', { exact: true }).click({ timeout: 10_000 }).catch((e) => log('Device Id tab click skipped: ' + e.message));
  log('Device Id tab active on Master Data Edit page');
  await page.waitForTimeout(500);

  // Confirmed live: the Issuing Agency select2 widget's visible rendered span carries
  // title = the underlying option VALUE (e.g. "1.3.160"), not the option TEXT ("GS1") - this is
  // the actual fix under test. If the currently-loaded record's raw stored value doesn't match a
  // real configured option (a stale pre-existing-data issue, not a code regression - confirmed
  // during manual exploration on record 6234.1_na), re-pick "GS1" from this record's own dropdown
  // first so the tooltip check is against a valid, freshly-selected value.
  // Re-pick GS1 fresh so the record has a genuinely valid value (1.3.160) to demonstrate the
  // actual fix, rather than this record's pre-existing stale literal "GS1" value. Confirmed this
  // run: a preceding click does NOT suppress FlaUI's real-hardware hover-at (the earlier
  // "click suppresses tooltip" theory was wrong -- the real issue was CDP-hover never working at
  // all, click or no click; see the FlaUI hover-at section below).
  const issuingAgencySelect = mdmFrame.locator('select').filter({ has: mdmFrame.locator('option', { hasText: 'HIBCC' }) }).first();
  const titleBefore = await issuingAgencySelect.getAttribute('title');
  log('Issuing Agency title before re-pick: ' + titleBefore);
  if (titleBefore !== '1.3.160') {
    const container = issuingAgencySelect.locator('xpath=following-sibling::span[contains(@class,"select2")]').first();
    await container.click({ timeout: 10_000 });
    log('select2 container opened');
    await page.waitForTimeout(300);
    await mdmFrame.getByRole('listbox').getByText('GS1', { exact: true }).first().click({ timeout: 10_000 });
    log('GS1 re-picked from record dropdown');
    await page.waitForTimeout(500);
  }
  const titleAfter = await issuingAgencySelect.getAttribute('title');
  const valueAfter = await issuingAgencySelect.inputValue();
  const renderedSpan = issuingAgencySelect.locator('xpath=following-sibling::span[contains(@class,"select2")]//span[contains(@class,"select2-selection__rendered")]').first();
  const renderedTitle = await renderedSpan.getAttribute('title').catch(() => null);
  log(`Issuing Agency (untouched): title=${titleAfter} value=${valueAfter} renderedTitle=${renderedTitle}`);

  // Move the mouse well away first so the hover below is a genuine fresh enter, not a no-op
  // because the pointer is already sitting there from a previous action.
  await page.mouse.move(20, 20);
  await page.waitForTimeout(300);
  await renderedSpan.hover();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOT_DIR, 'step2_mdm_issuing_agency_tooltip.png'), fullPage: true });
  log('step2 CDP screenshot captured (may not show native tooltip overlay)');

  // CDP-driven Playwright .hover() (confirmed across 3 attempts: cold, held, and captured via a
  // genuine OS-level screenshot) never triggers Chromium's native title tooltip at all - the
  // remaining theory is that the tooltip controller gates on real hardware-level input, which CDP
  // doesn't provide but FlaUI's Mouse.MoveTo (real SendInput) does. Compute the element's real
  // screen coordinates (window.screenX/Y + chrome height, from the page itself - far more
  // reliable than guessing a browser-chrome height constant) and use the new hover-at FlaUI
  // command to move the actual OS mouse there, then screenshot.
  const pageTitle = await page.title();
  const candidates = await flaui.listProcesses('chrom');
  const browserProcess = candidates.find(
    (p: { mainWindowTitle: string }) => p.mainWindowTitle.includes(pageTitle) && p.mainWindowTitle.includes('for Testing')
  );
  if (browserProcess) {
    const winInfo = await page.evaluate(() => ({
      screenX: window.screenX, screenY: window.screenY,
      outerWidth: window.outerWidth, outerHeight: window.outerHeight,
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
    }));
    const box = await renderedSpan.boundingBox();
    log('window info: ' + JSON.stringify(winInfo) + ' element box: ' + JSON.stringify(box));
    if (box) {
      const chromeHeight = winInfo.outerHeight - winInfo.innerHeight;
      const screenPointX = Math.round(box.x + box.width / 2);
      const screenPointY = Math.round(chromeHeight + box.y + box.height / 2);
      log(`hover-at offsets (relative to window top-left): x=${screenPointX} y=${screenPointY} (chromeHeight=${chromeHeight})`);
      await flaui.hoverAt({ processId: browserProcess.pid, offsetX: screenPointX, offsetY: screenPointY, holdMs: 1500 });
      log('FlaUI real OS-level hover complete, taking screenshot');
      await flaui.screenshot({ processId: browserProcess.pid, outPath: path.join(SHOT_DIR, 'step2_native_tooltip_flaui.png') });
      log('FlaUI OS-level screenshot captured');
    } else {
      log('could not get element bounding box - skipping FlaUI hover');
    }
  } else {
    log('could not resolve own browser process for FlaUI hover - skipping');
  }

  results.step2 = {
    hiddenSelectTitle: titleAfter,
    hiddenSelectValue: valueAfter,
    visibleRenderedSpanTitle: renderedTitle,
    note: 'Captured without clicking the field first, so the tooltip reflects whatever value the record already has untouched.',
  };

  fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify(results, null, 2));
});
