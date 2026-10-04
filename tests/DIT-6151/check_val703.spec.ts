// UAT_6151 step 0: confirm the environment is really VAL703 at the expected build before doing
// anything else. Run with ROBAR_BASE_URL pointed at VAL703 (the .env default is TST703).

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { BASE_URL, USERNAME, PASSWORD } from '../support/robar';

const OUT = 'C:/Users/Mason/AppData/Local/Temp/claude/C--DB-Copies-703-20198/a480f2e1-948d-42ae-aee0-d197f8c859fc/scratchpad/uat6151';

test('VAL703 login page and build banner', async ({ page }) => {
  test.setTimeout(60_000);
  console.log(`BASE_URL = ${BASE_URL}`);
  await page.goto(BASE_URL, { timeout: 30_000 });
  const loginText = await page.locator('body').innerText({ timeout: 5000 });
  console.log('=== login page text ===');
  console.log(loginText);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, 'val703_login.png') });

  await page.fill('.userID', USERNAME, { timeout: 5000 });
  await page.fill('.Password', PASSWORD, { timeout: 5000 });
  await page.click('.loginBtn', { timeout: 5000 });
  await page.waitForSelector('#logout', { timeout: 20_000 });
  const menuText = await page.locator('body').innerText({ timeout: 5000 });
  console.log('=== after login (first 600 chars) ===');
  console.log(menuText.slice(0, 600));
  expect(page.url().toLowerCase()).toContain('vmsrvval703');
});
