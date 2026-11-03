// The CL data schema: a dedicated NON-ITEM schema `CLSchemaData` that the tests may fill with records (a schema WITH data locks its saved fields, so the fixture schemas MBExploreSchema /
// MBNonItemschema2 must stay data-free and cannot be used for the "needs saved records" requirements: server-side Must be unique, mass update of a unique field ...).
// Schemas cannot be deleted, so the schema is created ONCE: `ensureClSchema` looks in the Schemas drop-down first and only creates it when it is missing (user decision 2026-11-03: "check
// whether one exists on future runs and use it, so we do not end up with a new schema every time"). All the fields the data tests need are defined at creation, because after the first
// record the saved fields can no longer be changed or deleted. Fields added later to a schema that already has data cannot be edited: such a need means a NEW schema (ask the user first).

import type { Frame, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { findFrame, openMenuItem } from './robar';
import * as sch from './schemas';

export const CL_SCHEMA = 'CLSchemaData';

export interface ClField { caption: string; shareName: string; type?: string; required?: boolean; min?: number; max?: number; mask?: string; unique?: boolean; sample?: string }

/** Every field of the CL data schema (captions double as the stable keys the tests look up). */
export const CL_FIELDS: ClField[] = [
  { caption: 'CL Unique', shareName: 'cl_unique', unique: true, sample: 'U-1' },
  { caption: 'CL Mask', shareName: 'cl_mask', mask: 'K\\d\\d', sample: 'K12' },
  { caption: 'CL Required', shareName: 'cl_required', required: true, min: 3, max: 6, sample: 'abc' },
  { caption: 'CL Plain', shareName: 'cl_plain', sample: 'plain' },
  { caption: 'CL Count', shareName: 'cl_count', type: 'Integer', sample: '1' },
];

/** Opens the Schemas tile and returns the frame (schema drop-down ready). */
export async function openSchemasTile(page: Page, reopen = false): Promise<Frame> {
  if (reopen) {
    await page.locator('li.ui-tabs-tab:has-text("Schemas") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  }
  await openMenuItem(page, 'Schemas');
  const f = await findFrame(page, 'Schemas');
  await f.locator('select[name="schemaSelector"]').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  return f;
}

async function selectSchema(page: Page, f: Frame, name: string): Promise<Frame> {
  await f.locator('select[name="schemaSelector"]').selectOption({ label: name });
  await page.waitForTimeout(4000);
  const g = await findFrame(page, 'Schemas');
  await g.locator('#groups').waitFor({ timeout: 20_000 });
  return g;
}

export interface EnsureResult { created: boolean; fieldsAdded: string[] }

/**
 * Makes sure the CL data schema exists with all CL_FIELDS: creates it when it is missing (the only time a schema is created), adds missing fields while the schema still has NO data, and
 * throws a clear error when fields are missing from a schema that already has data. Returns what it had to do. The page must be logged in as the seed user.
 */
export async function ensureClSchema(page: Page): Promise<EnsureResult> {
  let f = await openSchemasTile(page, true);
  const offered = (await f.locator('select[name="schemaSelector"] option').allInnerTexts()).map((t) => t.trim());
  let created = false;
  if (!offered.includes(CL_SCHEMA)) {
    // New Schema dialog: name + Item Schema (left UNCHECKED: a non-item schema's New Record page creates nothing until Save)
    await f.locator('#actionsDropdown').click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await f.locator('#actNewSchema').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(1000);
    const dialog = f.locator('.ui-dialog:visible').filter({ has: f.locator('#newSchemaDialog') });
    await dialog.locator('input[type="text"]').fill(CL_SCHEMA, { timeout: 5000 });
    const item = dialog.locator('input[type="checkbox"]').first();
    if (await item.count()) await item.setChecked(false);
    const before = f.url();
    await dialog.getByRole('button', { name: 'Submit' }).click({ timeout: 5000, noWaitAfter: true });
    await page.waitForTimeout(4000);
    f = await openSchemasTile(page, true);
    expect((await f.locator('select[name="schemaSelector"] option').allInnerTexts()).map((t) => t.trim()), `schema ${CL_SCHEMA} created (page was ${before})`).toContain(CL_SCHEMA);
    created = true;
    console.log(`created the CL data schema ${CL_SCHEMA}`);
  }
  f = await selectSchema(page, f, CL_SCHEMA);
  const flags = await f.evaluate(() => Array.from(document.querySelectorAll('input[type="checkbox"][disabled]')).slice(0, 2).map((x) => (x as HTMLInputElement).checked));
  expect(flags[0], `${CL_SCHEMA} must be a NON-item schema`).toBe(false);
  const hasData = flags[1];
  // a new schema has no description and Save is refused until it has one
  const desc = f.locator('input.text-wide').nth(1);
  const descMissing = (await desc.inputValue()) === '';
  if (descMissing && !hasData) await desc.fill('CL data schema for automated tests (do not delete)');
  const have = (await f.locator('.md-field .md-field-caption span').allInnerTexts()).map((t) => t.trim());
  const missing = CL_FIELDS.filter((x) => !have.includes(x.caption));
  const added: string[] = [];
  if (missing.length || (descMissing && !hasData)) {
    if (hasData && missing.length) throw new Error(`${CL_SCHEMA} already has data and lacks the fields ${missing.map((m) => m.caption).join(', ')}: saved fields of a schema with data cannot be changed; ask the user before creating another schema`);
    for (const m of missing) {
      const before = await sch.fieldBlocks(f).count();
      await f.locator('#groups > .ui-tabs-panel:visible').first().getByText('Add New Field', { exact: false }).first().click({ timeout: 5000 });
      await expect(sch.fieldBlocks(f)).toHaveCount(before + 1, { timeout: 5000 });
      const b = sch.fieldBlocks(f).nth(before);
      if (m.type) await sch.row(b, 'Field Type').locator('select').selectOption({ label: m.type });
      await sch.row(b, 'Caption').locator('input').fill(m.caption);
      await sch.row(b, 'Share Name').locator('input').fill(m.shareName);
      if (m.sample !== undefined) await sch.row(b, 'Sample Data').locator('input').fill(m.sample);
      if (m.required) await sch.checkbox(b, 'Required').setChecked(true);
      if (m.min !== undefined) await sch.row(b, 'Min Length').locator('input').fill(String(m.min));
      if (m.max !== undefined) await sch.row(b, 'Max Length').locator('input[type="number"]').fill(String(m.max));
      if (m.mask) await sch.row(b, 'Input Mask').locator('input').first().fill(m.mask);
      if (m.unique) await sch.checkbox(b, 'Unique').setChecked(true);
      added.push(m.caption);
    }
    const saved = await sch.saveSchema(page, f);
    for (const a of added) expect(Object.keys(saved), `field ${a} saved`).toContain(a);
  }
  return { created, fieldsAdded: added };
}
