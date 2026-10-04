// Shared helpers for tests/Browser-Printing/*.spec.ts.
//
// Live-confirmed (2026-09-16) via direct browser exploration and headed @playwright/test probing
// before writing the first tests in this module -- see robar-module-reference.md's "Browser
// Printing" section for the full exploration notes and the confirmed-but-blocked "Timeout waiting
// for Sentinel." finding this file's scope deliberately stays clear of.

import type { Frame, Page } from '@playwright/test';
import { findFrame } from './robar';

/**
 * Playwright's own `locator.click()` (including `{ force: true }`) does NOT reliably trigger a
 * postback on the Print Screen family's (`Web/ROBAR/Printing/Screens/PrintScreen.aspx`) legacy
 * ASP.NET WebForms submit buttons -- confirmed live 2026-09-16 via a headed @playwright/test run
 * with full console/network logging attached: the click "resolves" with no error, but the page
 * silently stays on the exact same screen (same field values, no new fields/messages), even though
 * the form's own `onsubmit="javascript:return WebForm_OnSubmit();"` attribute is present and
 * `window.__doPostBack` exists. A native DOM `.click()` dispatched via `frame.evaluate()` (this
 * function) reliably triggers the real postback where Playwright's synthesized click does not --
 * confirmed to work for the first two "Next" transitions of Print by Order (empty-order screen ->
 * item/lot-entry screen -> Lot Panel). Use this for every "Next"/submit button in this screen
 * family instead of `frame.click()`/`locator.click()`.
 *
 * NOT a fix for everything: a THIRD "Next" click from the Lot Panel (the one that actually creates
 * the Lot record and would advance to template/label selection) still does not complete under any
 * click method tried (Playwright .click(), this nativeClick, and a raw dispatchEvent(MouseEvent))
 * -- the POST does complete (HTTP 200, confirmed via response logging) but the server's own
 * response renders "Timeout waiting for Sentinel." This is a genuine environment/infrastructure
 * limitation (this automated session has no reachable Sentinel Tray), not a click-method problem,
 * and is out of scope for pure browser automation -- see the module reference for detail. Every
 * helper below therefore stops at the Lot Panel and does not attempt that third transition.
 */
export async function nativeClick(frame: Frame, elementId: string): Promise<void> {
  await frame.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`nativeClick: no element with id "${id}" in this frame`);
    }
    (el as HTMLElement).click();
  }, elementId);
}

export const printEntityId = 'ctl00_printContentHolder_customControl_ddlPrintEntity';
export const orderNumberId = 'ctl00_printContentHolder_customControl_txtOrder';
export const itemNumberId = 'ctl00_printContentHolder_customControl_txtItemNumber';
export const lotNumberId = 'ctl00_printContentHolder_customControl_txtLotNumber';
export const nextButtonId = 'ctl00_btnNext';
export const resetButtonId = 'ctl00_btnResetAll';

/**
 * Opens Print by order (WebMenu tile text is a substring of "Print by order multi" and
 * "Print by order lot" too -- `exact: true` is required, confirmed live) and returns its iframe,
 * with Print Entity set (confirmed via source that a fresh page load defaults to "ROBAR", not
 * whatever the account last used -- unlike Campaign Manager's persisted-filter behavior).
 */
export async function openPrintByOrder(page: Page, printEntity = 'ROBAR'): Promise<Frame> {
  await page.getByRole('button', { name: 'Print by order', exact: true }).click();
  const frame = await findFrame(page, 'PrintScreen');
  // Real wall-clock settle time before the first interaction -- confirmed live this page's
  // ASP.NET AJAX scaffolding (WebResource.axd/ScriptResource.axd) needs a few seconds to finish
  // loading; interacting immediately after the frame merely *exists* risks the same broken-postback
  // symptom nativeClick otherwise fixes.
  await page.waitForTimeout(3000);
  if (printEntity !== 'ROBAR') {
    await frame.selectOption(`#${printEntityId}`, { label: printEntity });
  }
  return frame;
}

/** Opens Print by lot (same PrintScreen.aspx family, ConfigName=LotNumber) and returns its iframe. */
export async function openPrintByLot(page: Page, printEntity = 'ROBAR'): Promise<Frame> {
  await page.getByRole('button', { name: 'Print by lot', exact: true }).click();
  const frame = await findFrame(page, 'PrintScreen');
  await page.waitForTimeout(3000);
  if (printEntity !== 'ROBAR') {
    await frame.selectOption(`#${printEntityId}`, { label: printEntity });
  }
  return frame;
}

/** Opens Print by order multi (exact match needed -- "Print by order" is a substring of this too). */
export async function openPrintByOrderMulti(page: Page): Promise<Frame> {
  await page.getByRole('button', { name: 'Print by order multi', exact: true }).click();
  const frame = await findFrame(page, 'PrintScreen');
  await page.waitForTimeout(3000);
  return frame;
}

/** Opens Print by lot multi (exact match needed -- "Print by lot" is a substring of this too). */
export async function openPrintByLotMulti(page: Page): Promise<Frame> {
  await page.getByRole('button', { name: 'Print by lot multi', exact: true }).click();
  const frame = await findFrame(page, 'PrintScreen');
  await page.waitForTimeout(3000);
  return frame;
}
