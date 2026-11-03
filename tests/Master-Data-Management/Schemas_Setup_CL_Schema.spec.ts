// Idempotent setup of the CL data schema `CLSchemaData` (see tests/support/cl-schema.ts): creates the NON-item schema only when it is missing (schemas cannot be deleted), adds its fields while it
// has no data, and on every later run only verifies it. Run it first on a fresh database (the data specs call the same helper themselves, so they also work without this spec).

import { test, expect } from '@playwright/test';
import { login } from '../support/robar';
import * as sch from '../support/schemas';
import { CL_FIELDS, CL_SCHEMA, ensureClSchema, openSchemasTile } from '../support/cl-schema';

test.use({ actionTimeout: 20_000 });

test('CL data schema: created once, verified on every run', async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  const r = await ensureClSchema(page);
  console.log(`CL data schema ${CL_SCHEMA}: created now = ${r.created}, fields added now = ${JSON.stringify(r.fieldsAdded)}`);
  const f = await openSchemasTile(page, true);
  const options = (await f.locator('select[name="schemaSelector"] option').allInnerTexts()).map((t) => t.trim());
  expect(options.filter((o) => o === CL_SCHEMA)).toHaveLength(1);
  await f.locator('select[name="schemaSelector"]').selectOption({ label: CL_SCHEMA });
  await page.waitForTimeout(4000);
  const g = await (await import('../support/robar')).findFrame(page, 'Schemas');
  const captions = (await g.locator('.md-field .md-field-caption span').allInnerTexts()).map((t) => t.trim());
  for (const x of CL_FIELDS) expect(captions, `field ${x.caption}`).toContain(x.caption);
  expect(await sch.fieldBlocks(g).count()).toBeGreaterThanOrEqual(CL_FIELDS.length);
});
