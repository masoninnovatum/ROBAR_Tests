// Stage F of the UAT_CM_MDMIntegrationAndPDF test data: the saved filter MBMDFILTER<stamp> with Master Data Schema RobarMasterData, saved while CM_MDM_Integration = Y. Headless (no BarTender).
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { findFrame, BASE_URL } from '../support/robar';
import * as cm from '../support/campaign-manager';

const SCRATCH = 'C:/Users/Mason/AppData/Local/Temp/claude/C--DB-Copies-703-20198/a480f2e1-948d-42ae-aee0-d197f8c859fc/scratchpad/cmmdmpdf';
const STATE_FILE = path.join(SCRATCH, 'state.json');
test.use({ actionTimeout: 20_000 });
const readState = (): Record<string, any> => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {});
const writeState = (patch: Record<string, unknown>): void => fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch }, null, 2));
const log = (m: string): void => console.log();
function assertTst703(): void { if (!BASE_URL.toLowerCase().includes('vmsrvtst703')) throw new Error('not TST703'); }

test('stage F - saved filter MBMDFILTER<stamp> with Master Data Schema RobarMasterData (CM_MDM_Integration must be Y)', async ({ page }) => {
  test.setTimeout(300_000);
  assertTst703();
  const { item2 } = readState();
  expect(item2, 'run I2 first').toBeTruthy();
  let f = await cm.openCampaignManager(page);
  await page.waitForTimeout(2500);
  if (!(await f.locator('select[name="Filters[0].Column"]').count())) { await f.locator('.criteriaFilter-AddButton').first().click(); await page.waitForTimeout(600); }
  expect(await f.locator('select[name="Filters[0].Column"] option').first().innerText(), 'CM_MDM_Integration = Y shows the "Item - " prefixes').toMatch(/^Item - /);
  // Advanced Options -> Master Data Schema (the page reloads after the choice)
  await f.locator('#advancedOptions h3 a, .ui-accordion-header').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await f.locator('#selectedSchema').selectOption({ label: 'RobarMasterData' });
  await page.waitForTimeout(4000);
  f = await findFrame(page, 'campaignmanager');
  await f.getByRole('button', { name: /Continue/i }).click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(1000);
  expect(await f.locator('#selectedSchema option:checked').innerText()).toBe('RobarMasterData');
  if (!(await f.locator('select[name="Filters[0].Column"]').count())) { await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click(); await page.waitForTimeout(800); }
  await f.selectOption('select[name="Filters[0].Column"]', { label: 'Item - Item Number' });
  await f.selectOption('select[name="Filters[0].Operator"]', { label: 'Contains' });
  await f.fill('input[name="Filters[0].Value"]', 'MBPDF');
  const filterName = 'MBMDFILTER' + Date.now().toString().slice(-5);
  await f.click('#btnRetrieveItems'); // Save Filters is enabled only after a retrieve
  await page.waitForTimeout(6000);
  await f.click('#btSaveFilters');
  await f.locator('#txtFilterSaveName').waitFor({ state: 'visible', timeout: 10_000 });
  await f.fill('#txtFilterSaveName', filterName);
  await f.fill('#txtFilterSaveDescription', 'UAT CM MDM PDF steps 15-17 (saved with CM_MDM_Integration = Y)');
  const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('/CampaignManager/SaveFilters'), { timeout: 15_000 }), f.locator('.ui-dialog-buttonpane button:has-text("Save")').click()]);
  expect(response.status()).toBe(200);
  const success = f.locator('.ui-dialog:has-text("Success")');
  await expect(success).toBeVisible({ timeout: 10_000 });
  console.log('SAVE MESSAGE ' + (await success.innerText()).replace(/\s+/g, ' '));
  await success.locator('button:has-text("Ok")').click();
  writeState({ filterName, stageFDone: true });
  log(`F done: ${filterName}`);
});
