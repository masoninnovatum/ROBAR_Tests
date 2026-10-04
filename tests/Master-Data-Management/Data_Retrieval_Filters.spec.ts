// MDM Data Retrieval: the "For Items" dropdown (Approved / Unapproved / Any / Last Version Is Approved), "Latest Version Only",
// "Effective Only", filter operators and Limit Results -- observed on four fresh records whose states are known:
//   A  v0 approved, effective
//   B  v0 approved + v1 UNAPPROVED (approve, then Save as New Version)
//   Z  v0 approved but EXPIRED (Effective End in 2020)
//   U  v0 unapproved
// All rows are item-number-prefixed with a per-run stamp, so only these records are counted. Row counts are per VERSION row.
// Web-only.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as mdm from '../support/master-data';
import { USERNAME } from '../support/robar';

test('For Items, Latest Version Only, Effective Only, operators and Limit Results return the expected rows', async ({ page }) => {
  test.setTimeout(600_000);
  let frame: Frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDF${stamp}`;
  const [a, b, z, u] = ['A', 'B', 'Z', 'U'].map((s) => prefix + s);

  const approveOnEditPage = async () => {
    await mdm.clickEditAction(page, frame, 'menuApprove');
    await mdm.signAndSubmit(frame, '#approveDialog', 'btnApproveSubmit', 'General Approval');
    await expect(frame.getByText(new RegExp(`Approved By:\\s*${USERNAME}`, 'i'))).toBeVisible({ timeout: 15_000 });
  };

  await test.step('create A, B (+ unapproved v1), Z (expired), U', async () => {
    await mdm.createValidRecord(page, frame, { itemNumber: a });
    await approveOnEditPage();
    frame = await mdm.backToGrid(page, frame);

    await mdm.createValidRecord(page, frame, { itemNumber: b });
    await approveOnEditPage();
    await mdm.clickEditAction(page, frame, 'menuSaveAsNewVersion');
    await page.waitForTimeout(1000);
    await mdm.confirmDialog(frame);
    await page.waitForTimeout(3500);
    frame = await (await import('../support/robar')).findFrame(page, 'MasterData/Edit');
    await expect(frame.getByText('Approved By: Unapproved')).toBeVisible({ timeout: 10_000 });
    frame = await mdm.backToGrid(page, frame);

    await mdm.createValidRecord(page, frame, { itemNumber: z });
    await mdm.setEffectiveBegin(frame, new Date(2020, 0, 1));
    await mdm.setEffectiveEnd(frame, new Date(2020, 5, 30));
    await mdm.saveRecord(page, frame);
    await expect(frame.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
    await approveOnEditPage();
    frame = await mdm.backToGrid(page, frame);

    await mdm.createValidRecord(page, frame, { itemNumber: u });
    frame = await mdm.backToGrid(page, frame);
  });

  /** Row texts (item number + version) for the filter combination. */
  const rowsFor = async (options: { forItems?: string; latestOnly?: boolean; effectiveOnly?: boolean; column?: string; operator?: string; value?: string }) => {
    const rows = await mdm.retrieve(page, frame, {
      column: options.column ?? 'ItemNumber',
      operator: options.operator ?? 'Contains',
      value: options.value ?? prefix,
      forItems: options.forItems ?? 'Any',
      latestOnly: options.latestOnly ?? false,
      effectiveOnly: options.effectiveOnly ?? false,
    });
    // The grid can still be loading when retrieve() returns (an expected-non-empty result read as 0 rows): wait for rows
    // (every case in this spec expects at least one row), then let the grid settle before reading.
    // Require the row count to hold steady across three consecutive reads (a refresh was observed to land in stages).
    let previous = -1;
    let steady = 0;
    for (let attempt = 0; attempt < 20 && steady < 3; attempt++) {
      const n = await rows.count();
      steady = n > 0 && n === previous ? steady + 1 : 0;
      previous = n;
      await page.waitForTimeout(1000);
    }
    return (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace('Actions', '').trim());
  };
  const labels = (texts: string[]) => texts.map((t) => (t.match(new RegExp(prefix + '([A-Z])\\s+(\\d+)')) ?? []).slice(1).join('')).sort();

  const results: Record<string, string[]> = {};
  const run = async (key: string, options: Parameters<typeof rowsFor>[0]) => {
    results[key] = labels(await rowsFor(options));
    console.log(`filter [${key}] -> ${JSON.stringify(results[key])}`);
    return results[key];
  };

  await test.step('For Items: Any / Approved / Unapproved', async () => {
    expect(await run('any', {})).toEqual(['A0', 'B0', 'B1', 'U0', 'Z0']);
    expect(await run('approved', { forItems: 'Approved' })).toEqual(['A0', 'B0', 'Z0']);
    expect(await run('unapproved', { forItems: 'Unapproved' })).toEqual(['B1', 'U0']);
  });

  await test.step('Latest Version Only and Effective Only', async () => {
    expect(await run('latest', { latestOnly: true })).toEqual(['A0', 'B1', 'U0', 'Z0']);
    expect(await run('effective', { effectiveOnly: true }), 'the expired record Z drops out').toEqual(['A0', 'B0', 'B1', 'U0']);
    // Approved + Latest Version Only = the latest APPROVED version of each item (B shows v0, not its unapproved v1).
    expect(await run('approved+latest', { forItems: 'Approved', latestOnly: true })).toEqual(['A0', 'B0', 'Z0']);
    expect(await run('approved+effective', { forItems: 'Approved', effectiveOnly: true })).toEqual(['A0', 'B0']);
    // "Last Version Is Approved" = items whose NEWEST version is approved (B's newest is unapproved, U is unapproved).
    expect(await run('lastVersionApproved', { forItems: 'Last Version Is Approved' })).toEqual(['A0', 'Z0']);
  });

  await test.step('operators on Item Number', async () => {
    expect(await run('exactly A', { operator: 'ExactlyMatches', value: a })).toEqual(['A0']);
    expect(await run('contains B', { operator: 'Contains', value: b })).toEqual(['B0', 'B1']);
    // DoesNotMatch / DoesNotContain over the whole table cannot be scoped to this run's prefix with a single filter row, so
    // only check that the excluded record is absent from a limited sample.
    const notZ = await rowsFor({ operator: 'DoesNotMatch', value: z });
    expect(notZ.some((t) => t.includes(z)), 'DoesNotMatch excludes the exact item').toBe(false);
    void u;
  });

  await test.step('Limit Results caps the retrieve', async () => {
    // Limit Results persists per account, so set it explicitly (retrieve() resets it to 500 unless `limit` is given) and
    // put it back afterwards.
    const rows = await mdm.retrieve(page, frame, { value: prefix, forItems: 'Any', limit: 2 });
    await page.waitForTimeout(2500);
    const n = await rows.count();
    console.log(`Limit Results = 2 -> ${n} rows`);
    expect(n).toBe(2);
    const restored = await mdm.retrieve(page, frame, { value: prefix, forItems: 'Any' });
    await page.waitForTimeout(2500);
    expect(await restored.count(), 'back to the default limit: all five version rows').toBe(5);
  });
});
