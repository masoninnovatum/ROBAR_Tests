// SMOKE TIER 1 (headless, writes CL data, ~2-3 min): the daily item chain: a NEW Campaign Manager item on the standard template is created and approved, gets a Label Control Number
// (Label Control > Assign Control Number job) and a Label Master (Recreate Master job); Label Control then lists it under "With Label Master".
// Reuses ensureItemWithMaster({ fresh: true }) (the flow proven by Label-Control/Recreate_Master.spec.ts). Items cannot be deleted: one CLSmkItm<stamp> item is left behind per run.

import { test, expect } from '@playwright/test';
import { login } from '../../support/robar';
import { ensureItemWithMaster } from '../../support/label-master-item';

test('@smoke @tier1 new item: create, approve, assign LCN, recreate Label Master', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  const t0 = Date.now();
  const item = await ensureItemWithMaster(page, { fresh: true, prefix: 'CLSmkItm' });
  console.log(`SMOKE ${((Date.now() - t0) / 1000).toFixed(0)}s item ${item} created, approved, LCN assigned, label master recreated`);
  expect(item).toMatch(/^CLSmkItm\d+$/);
});
