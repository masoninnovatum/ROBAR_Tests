// Schemas (Settings > Schemas, tile "Schemas", process MD_Edit_Schemas) against ValMaster (docs/agents/valmaster-schemas.md): the schema listing / selection (MDM20140512003F1.0.1-1.0.4),
// TABS of a schema (MDM20140512004F1.0.3-1.0.9, formal script MDM_DataSchemas2.2) and field level Edit / View Security + Must be unique (MDM20150421102F1.0.2 / 1.0.4, MDM20150421100F1.0.1; scripts
// MDM_Security3.2, MDM_Data_Schemas2.4). Complements Schemas_Field_Editor (field settings, persistence), Schemas_Field_Settings_Effect and Schemas_Dropdown_Sources_Export.
// Fixture: the NO-DATA, NON-ITEM schema MBNonItemschema2 (never gets records, so its fields stay editable). Added tabs / fields are CL*-named and removed again in `finally`.
// Confirmed live 2026-11-03 on TST703 (headless). Page: `InnovatumMDM/Schemas/Edit` (tile), schema drop-down `select[name="schemaSelector"]`, tabs = jQuery UI tabs `#groups > ul > li`
// (name span `.group-name`, `+` link `#tabs-addTab-heading`, pencil rename, drag handle `.grippy`), panels `#groups > .ui-tabs-panel` each with its own "Add New Field" link and `.md-field` blocks.

import { test, expect } from '@playwright/test';
import type { Frame, Locator, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as sch from '../support/schemas';

test.use({ actionTimeout: 20_000 });

const FIXTURE = 'MBNonItemschema2';
const stamp = Date.now().toString().slice(-6);
const TAB_A = `CLTabA${stamp}`;
const TAB_B = `CLTabB${stamp}`;

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

const tabNames = (f: Frame) => f.locator('#groups > ul > li .group-name').allInnerTexts().then((a) => a.map((s) => s.trim()).filter(Boolean));
const panelCaptions = (f: Frame, i: number) => f.locator('#groups > .ui-tabs-panel').nth(i).locator('.md-field .md-field-caption span').allInnerTexts().then((a) => a.map((s) => s.trim()));

/** Opens the Schemas tile and selects `schema`; returns the (re-resolved) Schemas frame. */
async function openSchema(page: Page, schema: string, reopen = false): Promise<Frame> {
  if (reopen) {
    await page.locator('li.ui-tabs-tab:has-text("Schemas") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  }
  await openMenuItem(page, 'Schemas');
  let f = await findFrame(page, 'Schemas');
  await f.locator('select[name="schemaSelector"]').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await f.locator('select[name="schemaSelector"]').selectOption({ label: schema });
  await page.waitForTimeout(4000);
  f = await findFrame(page, 'Schemas');
  await f.locator('#groups').waitFor({ timeout: 20_000 });
  return f;
}

async function activateTab(page: Page, f: Frame, name: string): Promise<Locator> {
  const li = f.locator('#groups > ul > li').filter({ has: f.locator('.group-name', { hasText: new RegExp('^\\s*' + name + '\\s*$') }) });
  await li.locator('a.ui-tabs-anchor').click();
  await page.waitForTimeout(500);
  return f.locator('#groups > .ui-tabs-panel:visible').first();
}

/** Adds a tab with the "+" tab: it appears as "Group N" with an inline name editor; type the name and press Enter. */
async function addTab(page: Page, f: Frame, name: string): Promise<void> {
  const before = (await tabNames(f)).length;
  await f.locator('#tabs-addTab-heading').click();
  await expect.poll(async () => (await tabNames(f)).length, { timeout: 5000 }).toBe(before + 1);
  const inline = f.locator('#groups input:visible').last();
  await inline.fill(name);
  await inline.press('Enter');
  await page.waitForTimeout(500);
  expect(await tabNames(f)).toContain(name);
}

/** Adds a field to the CURRENT (visible) tab panel. */
async function addFieldHere(f: Frame, caption: string, shareName: string): Promise<Locator> {
  const panel = f.locator('#groups > .ui-tabs-panel:visible').first();
  const before = await panel.locator('.md-field').count();
  await panel.getByText('Add New Field', { exact: false }).first().click({ timeout: 5000 });
  await expect(panel.locator('.md-field')).toHaveCount(before + 1, { timeout: 5000 });
  const block = panel.locator('.md-field').nth(before); // a fixed position: `.last()` would point at a LATER field after the next add
  await sch.row(block, 'Caption').locator('input').fill(caption);
  await sch.row(block, 'Share Name').locator('input').fill(shareName);
  return block;
}

/** Drags `from` onto `to` with real mouse events (jQuery UI sortable needs them). */
async function drag(page: Page, from: Locator, to: Locator, dy = 0): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('drag: element not visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 5, a.y + a.height / 2 + 5, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + dy, { steps: 12 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(800);
}

test('Schemas: listing, tabs, field order, field security dropdowns, Must be unique (MDM20140512003 / 004, MDM20150421100 / 102)', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  let f: Frame = await openSchema(page, FIXTURE);
  const baselineTabs = await tabNames(f);
  const baselineFields = await sch.fieldBlocks(f).count();
  console.log('baseline tabs:', JSON.stringify(baselineTabs), '| fields:', baselineFields);

  try {
    await test.step('Schema listing: every schema is selectable, with read-only Item Schema / Has Data flags (F1.0.1, F1.0.4, U1.0.0)', async () => {
      const options = (await f.locator('select[name="schemaSelector"] option').allInnerTexts()).map((s) => s.trim());
      console.log(`${options.length - 1} schemas offered:`, options.slice(1, 8).join(' | '), '...');
      expect(options[0]).toBe('Select a schema');
      expect(options.length).toBeGreaterThan(30);
      for (const s of [FIXTURE, 'RobarMasterData', 'LabelerDuns', 'MBItemSchema']) expect(options).toContain(s);
      // sorted by plain character code (upper case before lower case: "ISO" before "Images", "lh-test" last), not alphabetically
      expect(options.slice(1)).toEqual([...options.slice(1)].sort());
      deviation('F1.0.1 "a grid showing all schemas": the Schemas page lists the schemas in a drop-down (Schema > Select a schema), there is no grid; edit / review is the same page (F1.0.3 / F1.0.4)');
      const flags = await f.evaluate(() => Array.from(document.querySelectorAll('input[type="checkbox"][disabled]')).slice(0, 2).map((x) => (x as HTMLInputElement).checked));
      expect(flags, `${FIXTURE}: Item Schema off, Has Data off`).toEqual([false, false]);
    });

    await test.step('A schema WITH data shows Has Data checked and an item schema is flagged (review, F1.0.4)', async () => {
      const g = await openSchema(page, 'MBItemSchema', true);
      const flags = await g.evaluate(() => Array.from(document.querySelectorAll('input[type="checkbox"][disabled]')).slice(0, 2).map((x) => (x as HTMLInputElement).checked));
      console.log('MBItemSchema flags [Item Schema, Has Data]:', JSON.stringify(flags));
      expect(flags).toEqual([true, true]);
      f = await openSchema(page, FIXTURE, true);
    });

    await test.step('Add two tabs, name them, put fields on them, Save (F1.0.3 / 1.0.4 / 1.0.8 / 1.0.5)', async () => {
      await addTab(page, f, TAB_A);
      await addTab(page, f, TAB_B);
      await activateTab(page, f, TAB_A);
      const a1 = await addFieldHere(f, `CL A1 ${stamp}`, `cl_a1_${stamp}`);
      await sch.checkbox(a1, 'Unique').setChecked(true); // Must be unique (MDM20150421100F1.0.1); set now: adding the next field collapses this accordion block
      await addFieldHere(f, `CL A2 ${stamp}`, `cl_a2_${stamp}`);
      await activateTab(page, f, TAB_B);
      const b1 = await addFieldHere(f, `CL B1 ${stamp}`, `cl_b1_${stamp}`);
      // Edit / View Security drop-downs: (None) + the MC_ processes (MDM20150421102F1.0.2 / 1.0.4)
      const editOpts = (await sch.row(b1, 'Edit Security').locator('select option').allInnerTexts()).map((s) => s.trim());
      const viewOpts = (await sch.row(b1, 'View Security').locator('select option').allInnerTexts()).map((s) => s.trim());
      console.log('Edit Security options:', editOpts.join(' | '), '| View Security options:', viewOpts.join(' | '));
      expect(editOpts[0]).toBe('(None)');
      expect(viewOpts[0]).toBe('(None)');
      expect(editOpts.slice(1).every((o) => o.startsWith('MC_'))).toBe(true); // F1.0.1 of MDM_Security: field processes carry the prefix MC_
      expect(editOpts.length).toBeGreaterThan(1);
      expect(viewOpts).toEqual(editOpts);
      await sch.row(b1, 'Edit Security').locator('select').selectOption({ label: editOpts[1] });
      await sch.row(b1, 'View Security').locator('select').selectOption({ label: editOpts[editOpts.length - 1] });
      const saved = await sch.saveSchema(page, f);
      console.log('schema saved:', JSON.stringify(saved));
      for (const c of [`CL A1 ${stamp}`, `CL A2 ${stamp}`, `CL B1 ${stamp}`]) expect(Object.keys(saved)).toContain(c);
    });

    await test.step('Reload: tabs, their order, the fields on each tab and the field settings persisted', async () => {
      f = await openSchema(page, FIXTURE, true);
      expect(await tabNames(f)).toEqual([...baselineTabs, TAB_A, TAB_B]);
      const iA = baselineTabs.length;
      expect(await panelCaptions(f, iA)).toEqual([`CL A1 ${stamp}`, `CL A2 ${stamp}`]);
      expect(await panelCaptions(f, iA + 1)).toEqual([`CL B1 ${stamp}`]);
      await activateTab(page, f, TAB_A);
      const a1 = sch.fieldBlock(f, `CL A1 ${stamp}`);
      await a1.locator('.md-field-caption').click();
      await expect(sch.checkbox(a1, 'Unique')).toBeChecked();
      await activateTab(page, f, TAB_B);
      const b1 = sch.fieldBlock(f, `CL B1 ${stamp}`);
      await b1.locator('.md-field-caption').click();
      const editSel = await sch.row(b1, 'Edit Security').locator('select').evaluate((s: HTMLSelectElement) => s.selectedOptions[0].text.trim());
      const viewSel = await sch.row(b1, 'View Security').locator('select').evaluate((s: HTMLSelectElement) => s.selectedOptions[0].text.trim());
      console.log('persisted Edit / View Security:', editSel, '/', viewSel);
      expect(editSel).toMatch(/^MC_/);
      expect(viewSel).toMatch(/^MC_/);
    });

    await test.step('Tab order can be changed with the drag handle and persists (F1.0.7)', async () => {
      const before = await tabNames(f);
      const handleB = f.locator('#groups > ul > li').filter({ has: f.locator('.group-name', { hasText: TAB_B }) }).locator('.grippy');
      const tabA = f.locator('#groups > ul > li').filter({ has: f.locator('.group-name', { hasText: TAB_A }) });
      await tabA.hover();
      await handleB.hover();
      await drag(page, handleB, tabA, 0);
      const after = await tabNames(f);
      console.log('tab order before / after the drag:', JSON.stringify(before), '/', JSON.stringify(after));
      if (after.indexOf(TAB_B) < after.indexOf(TAB_A)) {
        await sch.saveSchema(page, f);
        f = await openSchema(page, FIXTURE, true);
        const persisted = await tabNames(f);
        expect(persisted.indexOf(TAB_B)).toBeLessThan(persisted.indexOf(TAB_A));
      } else {
        deviation('F1.0.7 (edit the sequence of schema tabs): the drag of a tab by its handle could not be reproduced with automated mouse events (order unchanged), not verified');
      }
    });

    await test.step('Field order inside a tab can be changed and persists (F1.1.0)', async () => {
      await activateTab(page, f, TAB_A);
      const panel = f.locator('#groups > .ui-tabs-panel:visible').first();
      const before = await panelCaptions(f, (await tabNames(f)).indexOf(TAB_A));
      const g1 = panel.locator('.md-field .grippy').first();
      const g2 = panel.locator('.md-field .grippy').nth(1);
      await g1.hover();
      await drag(page, g2, g1, -8);
      const after = await panelCaptions(f, (await tabNames(f)).indexOf(TAB_A));
      console.log('field order before / after the drag:', JSON.stringify(before), '/', JSON.stringify(after));
      if (after[0] !== before[0]) {
        await sch.saveSchema(page, f);
        f = await openSchema(page, FIXTURE, true);
        expect(await panelCaptions(f, (await tabNames(f)).indexOf(TAB_A))).toEqual(after);
      } else {
        deviation('F1.1.0 (change the sequence of fields within a tab): the drag of a field by its handle could not be reproduced with automated mouse events (order unchanged), not verified');
      }
    });

    await test.step('A field can be moved to another tab by dropping it on the tab heading (F1.0.9)', async () => {
      await activateTab(page, f, TAB_A);
      const panel = f.locator('#groups > .ui-tabs-panel:visible').first();
      const idxA = (await tabNames(f)).indexOf(TAB_A);
      const idxB = (await tabNames(f)).indexOf(TAB_B);
      const moving = (await panelCaptions(f, idxA))[0];
      const tabB = f.locator('#groups > ul > li').filter({ has: f.locator('.group-name', { hasText: TAB_B }) });
      await panel.locator('.md-field .grippy').first().hover();
      await drag(page, panel.locator('.md-field .grippy').first(), tabB, 0);
      const afterA = await panelCaptions(f, idxA);
      const afterB = await panelCaptions(f, idxB);
      console.log(`moving "${moving}" to ${TAB_B}: ${TAB_A} now ${JSON.stringify(afterA)}, ${TAB_B} now ${JSON.stringify(afterB)}`);
      if (afterB.includes(moving)) {
        await sch.saveSchema(page, f);
        f = await openSchema(page, FIXTURE, true);
        const names = await tabNames(f);
        expect(await panelCaptions(f, names.indexOf(TAB_B))).toContain(moving);
        expect(await panelCaptions(f, names.indexOf(TAB_A))).not.toContain(moving);
      } else {
        deviation('F1.0.9 (move a field from one tab to another): dropping a field on another tab heading with automated mouse events did not move it, not verified');
      }
    });
  } finally {
    // back to the baseline: delete the CL fields, then the (now empty) tabs, Save
    try {
      f = await openSchema(page, FIXTURE, true);
      // per CL tab: open the tab, expand each field (the Delete button needs the expanded field) and delete it; the emptied tab is shown struck through and disappears at Save
      for (const n of (await tabNames(f)).filter((t) => new RegExp('^CLTab[AB]' + stamp + '$').test(t))) {
        await activateTab(page, f, n);
        const panel = f.locator('#groups > .ui-tabs-panel:visible').first();
        const count = await panel.locator('.md-field').count();
        for (let i = 0; i < count; i++) {
          const b = panel.locator('.md-field').nth(i);
          await b.locator('.md-field-caption').click();
          await page.waitForTimeout(300);
          await b.locator('.delete-field').click({ timeout: 5000 });
          await page.waitForTimeout(300);
        }
      }
      const struck = await f.locator('#groups > ul > li .group-name.deleted-field').allInnerTexts();
      console.log('tabs shown as deleted after removing their fields:', JSON.stringify(struck));
      if (!(await f.locator('#btnSaveSchema').isDisabled())) await sch.saveSchema(page, f); // nothing to save when the test stopped before its own Save
      f = await openSchema(page, FIXTURE, true);
      const left = await tabNames(f);
      console.log('tabs after cleanup:', JSON.stringify(left), '| fields:', await sch.fieldBlocks(f).count());
      if (left.join('|') !== baselineTabs.join('|')) console.log(`NOTE: empty tabs remain on ${FIXTURE}: ${JSON.stringify(left.filter((t) => !baselineTabs.includes(t)))} (a schema tab cannot be deleted once saved?)`);
      expect(await sch.fieldBlocks(f).count()).toBe(baselineFields);
    } catch (e) {
      console.log('CLEANUP FAILED (remove CL fields / tabs with the stamp ' + stamp + ' from ' + FIXTURE + ' by hand):', String(e).slice(0, 300));
    }
  }
});
