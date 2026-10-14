// SMOKE TIER 1 (headless, writes CL data, ~1-2 min): a NEW Master Data record (schema RobarMasterData) is created with the valid-record helper, approved with the e-signature (seed.ts),
// and found again with Retrieve Data. Records cannot be deleted: one CLSmkMdm<stamp> record is left behind per run.

import { test, expect } from '@playwright/test';
import { USERNAME } from '../../support/robar';
import * as mdm from '../../support/master-data';

test('@smoke @tier1 new Master Data record: create, approve, retrieve', async ({ page }) => {
  test.setTimeout(300_000);
  let frame = await mdm.openMasterData(page);
  const item = `CLSmkMdm${Date.now().toString().slice(-6)}`;

  await test.step('create a valid record', async () => {
    await mdm.createValidRecord(page, frame, { itemNumber: item });
  });

  await test.step('approve it (e-signature from seed.ts)', async () => {
    await mdm.clickEditAction(page, frame, 'menuApprove');
    await mdm.signAndSubmit(frame, '#approveDialog', 'btnApproveSubmit', 'General Approval');
    await expect(frame.getByText(new RegExp(`Approved By:\\s*${USERNAME}`, 'i'))).toBeVisible({ timeout: 15_000 });
  });

  await test.step('back to the grid: Retrieve Data finds the approved record', async () => {
    frame = await mdm.backToGrid(page, frame);
    const rows = await mdm.retrieveVerified(page, frame, { column: 'ItemNumber', operator: 'Contains', value: item, forItems: 'Approved', schema: 'RobarMasterData', expectRows: 1 });
    expect(await rows.count(), 'Retrieve Data finds the new approved record exactly once').toBe(1);
  });
});
