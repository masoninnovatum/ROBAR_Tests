// Investigation 2026-10-30: re-import over an EXISTING unapproved Images record (in-place UPDATE, not an INSERT) - does ECN / Workflow Preset persist?
import { test } from '@playwright/test';
import * as path from 'path';
import * as mdm from '../support/master-data';
import { findFrame } from '../support/robar';
import { importSheet, closeAllModuleTabs } from '../support/master-data-import';
const OUT = path.join(__dirname, '..', '..', 'runs', 'Images_Import_Lang_Overlap_2026-10-30');
const ITEM = process.env.IMG_ITEM ?? 'CLIMGA827831';
test('Images re-import over existing record', async ({ page }) => {
  test.setTimeout(500_000);
  await mdm.openMasterData(page);
  const res = await importSheet(page, ['ItemNumber', 'Description', 'Image Extension', 'Image Revision', 'ECN', 'Send To Workflow', 'Workflow Preset'],
    [[ITEM, 'reimport', '.jpg', 'rReimport', 'ECN-REIMPORT', 'False', 'ImgPreset1']], { tag: 'reimp', schema: 'Images', onExisting: 'Yes' });
  console.log('REIMPORT:', res?.status, res?.jobId, JSON.stringify(res?.errorRows));
  await res?.frame.locator('body').screenshot({ path: path.join(OUT, 'reimport-job-detail.png') }).catch(() => {});
  await closeAllModuleTabs(page);
  const g = await mdm.reopenMasterData(page);
  const rows = await mdm.retrieve(page, g, { value: ITEM, schema: 'Images' });
  console.log('GRID ROWS:', await rows.count(), JSON.stringify(await rows.allInnerTexts()));
  await rows.first().locator('a:has-text("Actions")').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await g.locator('ul:visible a').filter({ hasText: 'View/Edit' }).first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(4000);
  const ef = await findFrame(page, 'MasterData/Edit');
  console.log('ECN =', JSON.stringify(await ef.getByRole('row', { name: /^ECN/ }).locator('input').first().inputValue()));
  console.log('Revision =', JSON.stringify(await ef.getByRole('row', { name: /^Image Revision/ }).locator('input').first().inputValue()));
  await page.screenshot({ path: path.join(OUT, 'reimport-record-general.png') });
  await ef.getByText('Workflow', { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'reimport-record-workflow.png') });
});
