// SMOKE TIER 1 (headless, writes CL data, ~1-2 min): Master Data Excel Import: a generated two-row workbook is imported into RobarMasterData (e-signature from seed.ts), the job reaches
// Completed with no row errors, and the two records exist (unapproved v0). Records cannot be deleted: two CLSmkXl<stamp>A/B records are left behind per run.
// Flow and headers: Master-Data-Management/Excel_Import.spec.ts ("valid import").

import { test, expect } from '@playwright/test';
import * as mdm from '../../support/master-data';
import { importSheet, randomDi, closeAllModuleTabs } from '../../support/master-data-import';

const HEADERS = ['ItemNumber', 'Description', 'Labeler Duns Number', 'Primary DI Number', 'Brand Name'];
const DUNS = '118117576'; // the one real Labeler Duns record ("Innovatum") on TST703

test('@smoke @tier1 Master Data Excel Import: two records imported, job Completed', async ({ page }) => {
  test.setTimeout(400_000);
  const prefix = `CLSmkXl${Date.now().toString().slice(-6)}`;
  await mdm.openMasterData(page);

  const result = await importSheet(
    page,
    HEADERS,
    [
      [`${prefix}A`, 'Smoke import A', DUNS, randomDi(), 'Smoke Brand A'],
      [`${prefix}B`, 'Smoke import B', DUNS, randomDi(), 'Smoke Brand B'],
    ],
    { tag: 'smoke' }
  );
  console.log(`SMOKE import: ${result?.status} job ${result?.jobId}`);
  expect(result?.status).toBe('Completed');
  expect(result?.errorRows, 'no row errors').toEqual([]);

  await closeAllModuleTabs(page);
  const frame = await mdm.reopenMasterData(page);
  const rows = await mdm.retrieveVerified(page, frame, { column: 'ItemNumber', operator: 'Contains', value: prefix, schema: 'RobarMasterData', expectRows: 2 });
  expect(await rows.count(), 'both imported records are listed').toBe(2);
});
