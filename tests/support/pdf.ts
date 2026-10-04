// Item Edit PDF helpers (Campaign Manager item -> `#viewPDFBtn`). Live-confirmed 2026-10-04.
//
// The Item Edit page's PDF dialog (`#viewPDFDialog`) has: radios `#optLatest` (latest approved template version) /
// `#optSelect` + `#ddlItemTemplates`, checkboxes `#useUnappDict` ("Use Unapproved Dictionary Entries") and `#allowUnappMDM`
// ("Allow Unapproved MDM"), and a Submit button; Submit opens a popup `items/PDFFileWindow?uniqueId=...&template=...`
// (headed mode only -- headless returns an empty popup URL), whose URL itself serves the PDF.
//
// LIMITS (learned the hard way 2026-10-04): these label PDFs are a raster image -- there is NO extractable text, so a
// share-name value like a Brand Name cannot be read out of them. Hash equality does NOT work either: a Flate-only hash is a
// constant resource (identical for different items), while hashing the picture stream gives a DIFFERENT hash on every render
// of the same item (something time-/id-based is drawn), and total byte size varies ~100-150 bytes per render and was not a
// reliable signal for "MD data present" (one run showed +3 KB for Allow Unapproved MDM, another run +0). Treat this helper
// as a way to GET a PDF for the item (and eyeball it) -- not as proof of values. To verify merged share-name values use a
// text-bearing surface (see robar-module-reference.md "Master-data-level SHARE NAMES").

import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import * as zlib from 'zlib';
import * as crypto from 'crypto';

/** Hash of the concatenated inflated (Flate) streams of a PDF = its rendering. */
export function renderingHash(body: Buffer): { streams: number; hash: string } {
  const text = body.toString('latin1');
  const parts: Buffer[] = [];
  let i = 0;
  for (;;) {
    const st = text.indexOf('stream', i);
    if (st < 0) break;
    let start = st + 6;
    if (text[start] === '\r') start++;
    if (text[start] === '\n') start++;
    const e = text.indexOf('endstream', start);
    if (e < 0) break;
    // Hash EVERY stream: inflate Flate ones, keep others (e.g. a DCT/JPEG image) as-is -- the label picture may be either.
    // (Hashing only the Flate streams gave the SAME hash for different items, i.e. a constant resource, not the picture.)
    const raw = body.subarray(start, e);
    try {
      parts.push(zlib.inflateSync(raw));
    } catch {
      parts.push(raw);
    }
    i = e + 9;
  }
  // Hashing ALL streams was not stable (a small per-generation stream -- metadata/timestamp -- changes every time, the same
  // item rendered twice gave different hashes), so hash only the LARGEST stream = the label picture.
  const largest = parts.reduce((a, b) => (b.length > a.length ? b : a), Buffer.alloc(0));
  return { streams: parts.length, hash: crypto.createHash('sha256').update(largest).digest('hex').slice(0, 16) };
}

export interface PdfOptions {
  allowUnapprovedMdm?: boolean;
  useUnapprovedDictionary?: boolean;
}

/**
 * On a top-level Item Edit page (`cm.goToItem`), opens the PDF dialog, sets the two "unapproved" checkboxes, submits and
 * returns the PDF's rendering hash. Requires a HEADED browser (`test.use({ headless: false })`).
 */
export async function generatePdfHash(page: Page, context: BrowserContext, options: PdfOptions = {}): Promise<{ bytes: number; streams: number; hash: string }> {
  await page.locator('#viewPDFBtn').waitFor({ state: 'visible', timeout: 15_000 });
  await page.click('#viewPDFBtn');
  await expect(page.locator('#viewPDFDialog')).toBeVisible({ timeout: 10_000 });
  await page.locator('#allowUnappMDM').setChecked(!!options.allowUnapprovedMdm, { timeout: 5000 });
  await page.locator('#useUnappDict').setChecked(!!options.useUnapprovedDictionary, { timeout: 5000 });
  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: 30_000 }),
    page.locator('.ui-dialog-buttonpane button:has-text("Submit")').first().click(),
  ]);
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(2500);
  const body = await (await page.request.get(popup.url())).body();
  expect(body.subarray(0, 5).toString('latin1'), 'the popup URL serves a PDF').toBe('%PDF-');
  await popup.close().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('.ui-dialog:visible .ui-dialog-titlebar-close').first().click({ timeout: 2000 }).catch(() => {});
  return { bytes: body.length, ...renderingHash(body) };
}
