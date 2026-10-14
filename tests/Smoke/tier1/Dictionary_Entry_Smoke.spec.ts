// SMOKE TIER 1 (headless, writes CL data, ~1 min): Dictionary Management: a New Entry (phrase + language + translation) is submitted and found again by Retrieve Data.
// Entries cannot be deleted: one CLSmkDict<stamp> phrase is left behind per run (the language CLSmkLang is reused).

import { test, expect } from '@playwright/test';
import * as dm from '../../support/dictionary';

test('@smoke @tier1 Dictionary Management: new entry saved and retrievable', async ({ page }) => {
  test.setTimeout(300_000);
  const phrase = `CLSmkDict${Date.now().toString().slice(-6)}`;
  await dm.openDictionary(page);
  await dm.openMainAction(page, 'New Entry');
  await dm.fillNewEntry(page, { phrase, language: 'CLSmkLang', translation: 'Smoke translation' });
  await page.waitForTimeout(2500);
  expect(dm.editFrame(page), 'the New Entry dialog closes after a successful Submit').toBeUndefined();
  const r = await dm.search(page, phrase);
  expect(r.rows, 'exactly one record for the new phrase').toHaveLength(1);
  expect(r.rows[0]).toContain('CLSmkLang');
  expect(r.rows[0]).toContain('Smoke translation');
});
