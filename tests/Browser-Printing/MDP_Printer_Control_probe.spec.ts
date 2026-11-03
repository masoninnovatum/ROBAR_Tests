// Probe: how to clear the Printer Control filter row and draw the grid with the Add icon. Read-only.
import { test } from '@playwright/test';
import * as fs from 'fs';
import { openDynamicUi } from '../support/dynamic-ui';

test.use({ headless: false, actionTimeout: 20_000 });
const OUT = 'C:/Users/Mason/AppData/Local/Temp/claude/C--DB-Copies-703-20198/e4ec88ac-6090-437d-9cae-956f20f41198/scratchpad/pcm_probe2.txt';
const log = (s: string) => fs.appendFileSync(OUT, s + '\n');

test('probe printer control filter', async ({ page }) => {
  test.setTimeout(200_000);
  fs.writeFileSync(OUT, '');
  const f = await openDynamicUi(page, 'Printer Control');
  log('criteria rows at open: ' + (await f.locator('select[name="dvFilters[0].Column"]').count()));
  log('remove html: ' + (await f.locator('[class*="emove"]').evaluateAll((els) => els.map((e: any) => e.outerHTML.slice(0, 200)))).join(' ## '));
  log('add icon class: ' + (await f.locator('#add_grdJqGrid').getAttribute('class').catch(() => 'none')));
  await f.click('#btnRetrieveData');
  await page.waitForTimeout(3500);
  log('rows after retrieve: ' + (await f.locator('tr.jqgrow').count()));
  log('add icon class after: ' + (await f.locator('#add_grdJqGrid').getAttribute('class').catch(() => 'none')));
  // try removing via the criteria remove control
  const rm = f.locator('.criteriaFilter-RemoveButton');
  log('RemoveButton count: ' + (await rm.count()));
  if (await rm.count()) { await rm.first().click(); await page.waitForTimeout(800); }
  log('criteria rows after remove: ' + (await f.locator('select[name="dvFilters[0].Column"]').count()));
  await f.click('#btnRetrieveData');
  await page.waitForTimeout(3500);
  log('rows after 2nd retrieve: ' + (await f.locator('tr.jqgrow').count()));
});
