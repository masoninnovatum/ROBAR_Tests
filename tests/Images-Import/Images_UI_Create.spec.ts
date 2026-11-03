// Investigation 2026-10-30: does the ECN field of the Images schema persist when the record is created in the UI (no import)?
import { test } from '@playwright/test';
import * as path from 'path';
import * as mdm from '../support/master-data';
import { findFrame } from '../support/robar';
import { closeAllModuleTabs } from '../support/master-data-import';

const OUT = path.join(__dirname, '..', '..', 'runs', 'Images_Import_Lang_Overlap_2026-10-30');

test('Images: create a record in the UI with ECN + Revision, save, reopen', async ({ page }) => {
  test.setTimeout(400_000);
  const item = 'CLIMGU' + Date.now().toString().slice(-6);
  const g = await mdm.openMasterData(page);
  await mdm.selectSchema(g, 'Images');
  await mdm.openNewRecordAction(g);
  await mdm.submitNewItemDialog(page, g, item, 'UI create ECN test');
  await page.waitForTimeout(3000);
  await mdm.setItemDescription(g, 'UI create ECN test');
  await mdm.selectDropdownFieldByCaption(g, 'Image Extension', '.png');
  await mdm.fillFieldByCaption(g, 'Image Revision', 'rUI');
  await g.getByRole('row', { name: 'ECN', exact: true }).locator('input[type=text]').first().fill('ECN-UI-' + item.slice(-6));
  await page.screenshot({ path: path.join(OUT, 'ui-01-before-save.png') });
  const resp = await mdm.saveRecord(page, g);
  console.log('SAVE RESPONSE:', JSON.stringify(resp).slice(0, 300));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'ui-02-after-save.png') });

  await closeAllModuleTabs(page);
  const g2 = await mdm.reopenMasterData(page);
  const rows = await mdm.retrieve(page, g2, { value: item, schema: 'Images', expectRows: 1 });
  await rows.first().locator('a:has-text("Actions")').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await g2.locator('ul:visible a').filter({ hasText: 'View/Edit' }).first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(4000);
  const ef = await findFrame(page, 'MasterData/Edit');
  console.log('ECN after reopen =', JSON.stringify(await ef.getByRole('row', { name: 'ECN', exact: true }).locator('input').first().inputValue()));
  console.log('Revision after reopen =', JSON.stringify(await ef.getByRole('row', { name: 'Image Revision' }).locator('input').first().inputValue()));
  await page.screenshot({ path: path.join(OUT, 'ui-03-reopened.png') });
});
