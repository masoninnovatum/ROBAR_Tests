// SMOKE PREFLIGHT (headless, read-only): is the environment ready for the smoke tiers? Reads the build banner and the Global Settings / Print Config values the smoke
// tests depend on, collects EVERY problem, and fails once with "environment not ready: ..." instead of 20 confusing failures later. Nothing is changed (settings are flipped by
// the user only). Expected build: env SMOKE_EXPECTED_BUILD (e.g. 7.0.3.20285); unset = just logged.
// To add a check: add a line to REQUIRED_SETTINGS (global setting, value test) or the Flex block below, with the reason it matters.

import { test, expect } from '@playwright/test';
import { BASE_URL, login } from '../../support/robar';
import { readGlobalSetting } from '../../support/global-settings';
import { readParam } from '../../support/print-config';

type Check = { name: string; owner?: string; ok: (v: string) => boolean; need: string; why: string };

const REQUIRED_SETTINGS: Check[] = [
  { name: 'MaxSizeForDownload', ok: (v) => Number(v) >= 1_000_000, need: '>= 1000000', why: 'Export Master / job Download link is hidden when the file is larger than this (it was 1 once)' },
  { name: 'PdfSaveLocation', ok: (v) => v.trim().length > 0, need: 'a folder path', why: 'Save to PDF / print to PDF writes here' },
];
// logged for context only (their value changes what other tests expect, but either value is a valid environment)
const INFO_SETTINGS = ['PrintEntityRequired', 'CM_MDM_Integration', 'DictionaryOnlyEffective', 'EmptyStringWhenNoDictionary', 'SaveToPDFDateCharacter'];

test('@smoke @preflight environment is ready for the smoke tiers', async ({ page }) => {
  test.setTimeout(600_000);
  const problems: string[] = [];
  const facts: string[] = [];

  await test.step('build banner on the login page', async () => {
    await page.goto(BASE_URL);
    await page.locator('.userID').waitFor({ timeout: 60_000 });
    const banner = (await page.locator('body').innerText()).match(/\b\d+\.\d+\.\d+\.\d+\b/)?.[0] ?? '';
    facts.push(`build banner = ${banner || '(not found)'}`);
    if (!banner) problems.push('no version banner on the login page (is the site up?)');
    const expected = process.env.SMOKE_EXPECTED_BUILD;
    if (expected && banner !== expected) problems.push(`build is ${banner}, expected ${expected}`);
  });

  await login(page);
  if (!(await page.locator('button.menuIcon').count())) problems.push('login did not reach the Main Menu (no module tiles)');

  await test.step('required Global Settings', async () => {
    for (const c of REQUIRED_SETTINGS) {
      const v = await readGlobalSetting(page, c.name, c.owner);
      facts.push(`${c.name} = ${v === undefined ? '(not found)' : v}`);
      if (v === undefined || !c.ok(v)) problems.push(`Global Setting ${c.name} is ${v === undefined ? 'missing' : `"${v}"`}, needs ${c.need} (${c.why})`);
    }
  });

  await test.step('informational Global Settings', async () => {
    for (const name of INFO_SETTINGS) {
      const v = await readGlobalSetting(page, name).catch(() => undefined);
      facts.push(`${name} = ${v === undefined ? '(not found)' : v}`);
    }
  });

  await test.step('FlexPrinting identifiers: present and no duplicates (a duplicate makes Next crash with a Server Error)', async () => {
    const seen: string[] = [];
    for (let n = 1; n <= 6; n++) {
      const v = await readParam(page, 'FlexPrinting', `Flex_Identifier_${n}`).catch(() => '');
      if (!v) break;
      facts.push(`Flex_Identifier_${n} = ${v}`);
      seen.push(v.split(',')[0].trim().toLowerCase());
    }
    if (!seen.length) problems.push('PrintConfig FlexPrinting has no Flex_Identifier_1 (Flex Printing entry screen cannot work)');
    if (new Set(seen).size !== seen.length) problems.push(`PrintConfig FlexPrinting has a duplicate identifier field (${seen.join(', ')}): Next will crash with a Server Error`);
  });

  console.log(`PREFLIGHT FACTS\n  ${facts.join('\n  ')}`);
  test.info().annotations.push({ type: 'preflight facts', description: facts.join('; ') });
  expect(problems, `environment not ready:\n  - ${problems.join('\n  - ')}`).toEqual([]);
});
