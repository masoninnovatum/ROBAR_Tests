// Schemas editor: the three Dropdown List option sources (Static List, Linked Field, Database Query) and Export Schema.
// Uses the NO-DATA, NON-ITEM fixture schema MBNonItemschema2 (blank New Record page, never saved -> the schema never gets data and
// stays editable); every field added is deleted again in `finally`.
//   * Static List  -- options typed in the editor
//   * Linked Field -- Dropdown Schema + Option Text Field + Option Value Field read from ANOTHER schema's records (LabelerDuns)
//   * Database Query -- a "Remote System SQL" textarea (needs a remote system; only the UI + validation are exercised here)
//   * Export Schema -- Actions > Export Schema downloads `<SchemaName>.sql`, a re-creation script of the SAVED schema.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as mdm from '../support/master-data';
import * as sch from '../support/schemas';
import { findFrame } from '../support/robar';

const FIXTURE = 'MBNonItemschema2';

test('Schema Dropdown sources (static / linked / query) validate, save, render and appear in Export Schema', async ({ page }) => {
  test.setTimeout(480_000);
  const stamp = Date.now().toString().slice(-6);
  const c = { stat: `PW Static ${stamp}`, link: `PW Linked ${stamp}`, query: `PW Query ${stamp}` };
  const s = { stat: `m_pwstat${stamp}`, link: `m_pwlink${stamp}`, query: `m_pwquery${stamp}` };

  let grid = await mdm.openMasterData(page);
  let f: Frame = await sch.openSchemaEditor(page, grid, FIXTURE);
  const captions = async (frame: Frame) => (await frame.locator('.md-field .md-field-caption span').allInnerTexts()).map((t) => t.trim());
  const baseline = await captions(f);
  const reopen = async () => {
    grid = await mdm.reopenMasterData(page);
    f = await sch.openSchemaEditor(page, grid, FIXTURE);
  };

  try {
    // Order matters: "Add New Field" does nothing while the schema holds an invalid field (an unconfigured dropdown), so the
    // valid Static List field is added first and the deliberately invalid Database Query field last.
    await test.step('Static List: add the PW Static field with two options', async () => {
      const block = await sch.addField(f, { type: 'Dropdown List', caption: c.stat, shareName: s.stat });
      await sch.addStaticOption(block, 'Option One', '1');
      await sch.addStaticOption(block, 'Option Two', '2');
      expect(await sch.staticOptions(block)).toEqual(['Option One', 'Option Two']);
    });

    await test.step('Linked Field: Dropdown Schema list, then Option Text / Option Value field lists for the chosen schema', async () => {
      const block = await sch.addField(f, { type: 'Dropdown List', caption: c.link, shareName: s.link });
      await expect(block.locator('input[type=radio]')).toHaveCount(3);
      expect(await block.locator('input[type=radio]').evaluateAll((rs) => rs.map((r) => (r as HTMLInputElement).value))).toEqual(['staticList', 'linkedField', 'databaseQuery']);
      await block.locator('input[type=radio][value=linkedField]').check({ timeout: 5000 });
      await page.waitForTimeout(800);
      const fs0 = block.locator('fieldset');
      expect((await fs0.locator('label').allInnerTexts()).map((t) => t.trim())).toEqual(['Dropdown Schema', 'Option Text Field', 'Option Value Field']);
      const schemaOptions = (await fs0.locator('select').first().locator('option').allInnerTexts()).map((t) => t.trim());
      expect(schemaOptions[0]).toBe('(Select)');
      expect(schemaOptions).toEqual(expect.arrayContaining(['LabelerDuns', 'RobarMasterData', FIXTURE, 'UOM']));
      // Nothing chosen yet -> the field list selects are empty.
      expect(await fs0.locator('select').nth(1).locator('option').count()).toBeLessThanOrEqual(1);
      await fs0.locator('select').first().selectOption({ label: 'LabelerDuns' }, { timeout: 5000 });
      await page.waitForTimeout(2500);
      const textOptions = (await fs0.locator('select').nth(1).locator('option').allInnerTexts()).map((t) => t.trim());
      console.log(`LabelerDuns field list: ${JSON.stringify(textOptions)}`);
      expect(textOptions).toEqual(expect.arrayContaining(['(Select)', 'Labeler Duns Number', 'Company Name']));
      await fs0.locator('select').nth(1).selectOption({ label: 'Company Name' }, { timeout: 5000 });
      await fs0.locator('select').nth(2).selectOption({ label: 'Labeler Duns Number' }, { timeout: 5000 });
    });

    await test.step('Database Query: a "Remote System SQL" textarea; an empty query makes the schema unsaveable', async () => {
      const block = await sch.addField(f, { type: 'Dropdown List', caption: c.query, shareName: s.query });
      await block.locator('input[type=radio][value=databaseQuery]').check({ timeout: 5000 });
      await page.waitForTimeout(800);
      const fs1 = block.locator('fieldset');
      await expect(fs1.locator('label', { hasText: 'Remote System SQL' })).toBeVisible();
      await expect(fs1.locator('textarea')).toHaveCount(1);
      // Static + Database Query + Linked Field are mutually exclusive views of ONE field: switching back shows the static list again.
      await block.locator('input[type=radio][value=staticList]').check({ timeout: 5000 });
      await expect(fs1.locator('select[multiple]')).toHaveCount(1);
      await block.locator('input[type=radio][value=databaseQuery]').check({ timeout: 5000 });
      // Save with the empty query (and the not-yet-configured static-list default) -> refused with the generic invalid-fields dialog.
      const refused = await sch.saveSchema(page, f);
      console.log(`save with an empty query: ${JSON.stringify(refused)}`);
      expect(refused, 'no Save request is made').toHaveProperty('__noSaveRequest', true);
      // saveSchema() already dismisses the dialog with its Continue button; make sure nothing modal is left in the way.
      await expect(f.locator('.ui-dialog:visible')).toHaveCount(0, { timeout: 5000 });
      // give the query a value so the schema can be saved (the SQL is never executed here)
      await block.locator('fieldset textarea').fill("SELECT 'a' AS Text, 'a' AS Value", { timeout: 5000 });
    });

    await test.step('Save all three fields (the query now has a value)', async () => {
      const saved = await sch.saveSchema(page, f);
      console.log(`schema saved: ${JSON.stringify(saved)}`);
      for (const cap of Object.values(c)) expect(Object.keys(saved)).toContain(cap);
    });

    await test.step('Export Schema: downloads <Schema>.sql for the SAVED schema, naming the new fields and the linked schema', async () => {
      await reopen();
      await f.locator('#actionsDropdown').click({ timeout: 5000 });
      await page.waitForTimeout(600);
      const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), f.locator('#actExportSchema').click({ force: true, timeout: 5000 })]);
      expect(download.suggestedFilename()).toBe(`${FIXTURE}.sql`);
      const out = path.join(os.tmpdir(), `pw_export_${stamp}.sql`);
      await download.saveAs(out);
      const sql = fs.readFileSync(out, 'utf8');
      console.log(`export: ${sql.length} chars`);
      expect(sql).toContain(`DECLARE @SCHEMA_NAME NVARCHAR(30) = '${FIXTURE}'`);
      expect(sql, 'refuses to run against a populated schema').toContain('This schema already exists and is populated with data');
      for (const share of Object.values(s)) expect(sql, `share name ${share} is in the script`).toContain(share);
      for (const cap of Object.values(c)) expect(sql).toContain(cap);
      expect(sql, 'the linked dropdown references the source schema').toContain('LabelerDuns');
      expect(sql, 'the static options are in the script').toContain('Option One');
      const at = sql.indexOf('AS Text');
      console.log(`query in export: ${at < 0 ? 'NOT FOUND' : sql.slice(Math.max(0, at - 120), at + 80).replace(/\s+/g, ' ')}`);
      console.log(`export mentions linked config: ${JSON.stringify((sql.match(/.{80}LabelerDuns.{80}/s) ?? [])[0]?.replace(/\s+/g, ' '))}`);
      expect(at, 'the query text is in the script (the Configuration JSON may escape the quotes)').toBeGreaterThan(-1);
    });

    await test.step('the saved fields reload with their sources; the linked dropdown renders LabelerDuns records on a blank New Record page', async () => {
      await reopen();
      const lb = sch.fieldBlock(f, c.link);
      await expect(lb.locator('input[type=radio][value=linkedField]')).toBeChecked();
      const selected = await lb.locator('fieldset select').evaluateAll((ss) => ss.slice(0, 3).map((x) => (x as HTMLSelectElement).selectedOptions[0]?.text.trim()));
      expect(selected).toEqual(['LabelerDuns', 'Company Name', 'Labeler Duns Number']);
      await expect(sch.fieldBlock(f, c.query).locator('input[type=radio][value=databaseQuery]')).toBeChecked();
      expect(await sch.fieldBlock(f, c.query).locator('fieldset textarea').inputValue()).toContain("SELECT 'a'");
      expect(await sch.staticOptions(sch.fieldBlock(f, c.stat))).toEqual(['Option One', 'Option Two']);

      grid = await mdm.reopenMasterData(page);
      await mdm.selectSchema(grid, FIXTURE);
      await mdm.openNewRecordAction(grid);
      const edit = await findFrame(page, 'MasterData');
      await edit.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const rowOf = (caption: string) => edit.getByRole('row', { name: caption });
      const dump = async (caption: string) =>
        rowOf(caption).locator('select').first().evaluate((sel) => Array.from((sel as HTMLSelectElement).options).map((o) => `${o.text.trim()}=${o.value}`));
      const staticOpts = await dump(c.stat);
      console.log(`static dropdown options: ${JSON.stringify(staticOpts)}`);
      expect(staticOpts).toEqual(expect.arrayContaining(['Option One=1', 'Option Two=2']));
      const linkedOpts = await dump(c.link);
      console.log(`linked dropdown options: ${JSON.stringify(linkedOpts)}`);
      expect(linkedOpts.length, 'one option per LabelerDuns record (+ blank)').toBeGreaterThan(1);
      expect(linkedOpts, 'text = Company Name, value = Labeler Duns Number').toContain('Innovatum=118117576');
      await edit.click('a:has-text("Previous Page")', { timeout: 5000 });
      await page.waitForTimeout(1500);
      const leave = edit.locator('.ui-dialog:visible').filter({ hasText: 'Changes will be lost' });
      if ((await leave.count()) > 0) await leave.getByRole('button', { name: /Continue|OK|Yes/ }).first().click({ timeout: 5000 });
      await page.waitForTimeout(1500);
    });
  } finally {
    await test.step('cleanup: delete the added fields; the fixture is back at its baseline (and still has no data)', async () => {
      await reopen();
      for (const cap of Object.values(c)) {
        const b = sch.fieldBlock(f, cap);
        if ((await b.count()) === 1) await b.locator('.delete-field').click({ timeout: 5000 });
      }
      await sch.saveSchema(page, f).catch(() => ({}));
      await reopen();
      const after = await captions(f);
      expect(after.filter((x) => x.startsWith('PW '))).toEqual([]);
      expect(after).toEqual(baseline);
      const checks = await f.evaluate(() => Array.from(document.querySelectorAll('input[type="checkbox"][disabled]')).slice(0, 2).map((x) => (x as HTMLInputElement).checked));
      expect(checks, 'the fixture must still have NO data').toEqual([false, false]);
    });
  }
});
