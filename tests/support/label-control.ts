// Shared Label Control grid helpers. The query helper copied into ~20 Label Control specs spent 9 s of FIXED sleeps per call (3 s + 1.5 s + 3 s around the Reset) and is called 4-8 times per spec (every step
// re-queries, and the "wait for the async job" loops re-open the module on every attempt). resetLabelControlGrid waits for the page to be ready instead of sleeping.

import type { Frame, Page } from '@playwright/test';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `frame` = the freshly opened Label Control Management frame. Clicks Reset (which reloads the page; the old document is marked first so the reloaded one is recognised, the old frame stays visible for a
 * moment) and returns the reloaded, settled frame.
 */
export async function resetLabelControlGrid(page: Page, frame: Frame): Promise<Frame> {
  await frame.locator('#btnReset').waitFor({ state: 'visible', timeout: 30_000 });
  await frame.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await delay(300);
  await frame.evaluate(() => { (window as unknown as { __pwOld?: boolean }).__pwOld = true; });
  await frame.click('#btnReset');
  let fresh: Frame | undefined;
  for (let i = 0; i < 200 && !fresh; i++) {
    const frames = page.frames().filter((x) => x.url().toLowerCase().includes('labelcontrol/management'));
    const cand = frames[frames.length - 1];
    if (cand && (await cand.locator('#drpApproved').isVisible().catch(() => false)) && !(await cand.evaluate(() => (window as unknown as { __pwOld?: boolean }).__pwOld === true).catch(() => true))) fresh = cand;
    else await delay(150);
  }
  if (!fresh) throw new Error('the Label Control page did not reload after Reset');
  await fresh.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await delay(300);
  return fresh;
}
