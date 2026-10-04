// How a schema field's settings behave on the Master Data Edit page -- the "schema level" half of the contract that
// templates/labels rely on. Uses the NO-DATA, NON-ITEM fixture schema MBNonItemschema2: for a non-item schema, New Record
// opens a BLANK Edit page and creates nothing until Save, so the fields can be observed without ever creating a record
// (a record would give the schema DATA and lock its saved fields forever). THIS SPEC NEVER CLICKS SAVE ON THE RECORD PAGE.
//
// Fields added to the schema (all deleted again at the end / in `finally`):
//   PW Req      Short Text, Required, Min 3 / Max 6
//   PW Mask     Short Text, Input Mask K\d\d
//   PW Default  Short Text, Default Value "DefaultVal"
//   PW Prot     Short Text, Protected (visible but disabled), Default Value "ProtVal"
//   PW Hidden   Short Text, Visible UNCHECKED (does not render at all), Default Value "HiddenVal"

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as mdm from '../support/master-data';
import * as sch from '../support/schemas';

const FIXTURE = 'MBNonItemschema2';

test('Schema field settings show up on a blank New Record page (required, length, mask, default, protected, hidden)', async ({ page }) => {
  test.setTimeout(420_000);
  const stamp = Date.now().toString().slice(-6);
  const c = { req: `PW Req ${stamp}`, mask: `PW Mask ${stamp}`, def: `PW Default ${stamp}`, prot: `PW Prot ${stamp}`, hidden: `PW Hidden ${stamp}` };
  const s = { req: `m_pwreq${stamp}`, mask: `m_pwmask${stamp}`, def: `m_pwdef${stamp}`, prot: `m_pwprot${stamp}`, hidden: `m_pwhid${stamp}` };

  let grid = await mdm.openMasterData(page);
  let f: Frame = await sch.openSchemaEditor(page, grid, FIXTURE);
  const captions = async (frame: Frame) => (await frame.locator('.md-field .md-field-caption span').allInnerTexts()).map((t) => t.trim());
  const baseline = await captions(f);
  console.log(`baseline captions: ${JSON.stringify(baseline)}`);
  const reopen = async () => {
    grid = await mdm.reopenMasterData(page);
    f = await sch.openSchemaEditor(page, grid, FIXTURE);
  };

  try {
    await test.step('fixture: a non-item schema with no data', async () => {
      const checks = await f.evaluate(() => Array.from(document.querySelectorAll('input[type="checkbox"][disabled]')).slice(0, 2).map((x) => (x as HTMLInputElement).checked));
      expect(checks, 'Item Schema unchecked, Has Data unchecked').toEqual([false, false]);
    });

    await test.step('add the five fields and Save the schema', async () => {
      await sch.addField(f, { type: 'Short Text', caption: c.req, shareName: s.req, required: true, minLength: 3, maxLength: 6 });
      await sch.addField(f, { type: 'Short Text', caption: c.mask, shareName: s.mask, sampleData: 'K12', inputMask: 'K\\d\\d' });
      await sch.addField(f, { type: 'Short Text', caption: c.def, shareName: s.def, defaultValue: 'DefaultVal' });
      const prot = await sch.addField(f, { type: 'Short Text', caption: c.prot, shareName: s.prot, defaultValue: 'ProtVal' });
      await sch.checkbox(prot, 'Protected').setChecked(true, { timeout: 5000 });
      const hidden = await sch.addField(f, { type: 'Short Text', caption: c.hidden, shareName: s.hidden, defaultValue: 'HiddenVal' });
      await sch.checkbox(hidden, 'Visible').setChecked(false, { timeout: 5000 });
      const saved = await sch.saveSchema(page, f);
      console.log(`schema saved: ${JSON.stringify(saved)}`);
      for (const cap of Object.values(c)) expect(Object.keys(saved)).toContain(cap);
    });

    await test.step('blank New Record page: render, defaults, protected and hidden fields (NOT saved)', async () => {
      grid = await mdm.reopenMasterData(page);
      await mdm.selectSchema(grid, FIXTURE);
      await mdm.openNewRecordAction(grid);
      const edit = await (await import('../support/robar')).findFrame(page, 'MasterData');
      await edit.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await expect(edit.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible({ timeout: 15_000 });
      await expect(edit.getByText(`Schema Name: ${FIXTURE}`)).toBeVisible();

      const rowOf = (caption: string) => edit.getByRole('row', { name: caption });
      // Visible fields render; the not-Visible one does not render at all.
      await expect(rowOf(c.req)).toHaveCount(1);
      await expect(rowOf(c.mask)).toHaveCount(1);
      await expect(rowOf(c.def)).toHaveCount(1);
      await expect(rowOf(c.prot)).toHaveCount(1);
      await expect(rowOf(c.hidden), 'Visible unchecked: the field is not rendered').toHaveCount(0);

      // Default values pre-populate.
      expect(await rowOf(c.def).locator('input[type=text]').first().inputValue()).toBe('DefaultVal');
      const protInput = rowOf(c.prot).locator('input[type=text]').first();
      expect(await protInput.inputValue()).toBe('ProtVal');
      expect(await protInput.isDisabled(), 'Protected: visible but disabled').toBe(true);

      // Required + length limits: messages appear on the field row as you type.
      const req = rowOf(c.req).locator('input[type=text]').first();
      // Validation messages are not always inside the field's own role=row, so read the message from the field's whole
      // table row container (closest <tr>) and, as a fallback, the page text.
      // Confirmed live: the messages render in `.validationMessage` elements elsewhere on the page (not in the field's row),
      // so read every visible-text validation message on the page.
      const rowText = async (_caption: string) =>
        (await edit.locator('.validationMessage').allInnerTexts()).map((t) => t.trim()).filter(Boolean).join(' | ');

      // The caption span's tooltip (title) is the field's SHARE NAME -- the name templates/labels bind to.
      expect(await rowOf(c.req).locator('span').first().getAttribute('title')).toBe(s.req);
      expect(await rowOf(c.def).locator('span').first().getAttribute('title')).toBe(s.def);
      console.log(`required field, untouched: ${await rowText(c.req)}`);
      await req.fill('ab');
      await req.blur();
      await page.waitForTimeout(500);
      const tooShort = await rowText(c.req);
      console.log(`2 chars (min 3): ${tooShort}`);
      expect(tooShort).toContain('Value is shorter than the minimum length for this field.');
      await req.fill('abcdefg');
      await req.blur();
      await page.waitForTimeout(500);
      const tooLong = await rowText(c.req);
      console.log(`7 chars (max 6): ${tooLong}`);
      expect(tooLong).toContain('Value has exceeded the maximum length for this field.');
      await req.fill('abcd');
      await req.blur();
      await page.waitForTimeout(500);
      const ok = await rowText(c.req);
      console.log(`4 chars: ${ok}`);
      expect(ok).not.toContain('Value is shorter');
      expect(ok).not.toContain('Value has exceeded');
      await req.fill('');
      await req.blur();
      await page.waitForTimeout(500);
      const empty = await rowText(c.req);
      console.log(`cleared: ${empty}`);
      expect(empty).toContain('This field is required.');

      // Input mask.
      const mask = rowOf(c.mask).locator('input[type=text]').first();
      await mask.fill('abc');
      await mask.blur();
      await page.waitForTimeout(500);
      const badMask = await rowText(c.mask);
      console.log(`mask K\\d\\d with "abc": ${badMask}`);
      // Actual wording has no "the" (the formal script / earlier notes say "...conform to the pattern mask").
      expect(badMask).toContain('Value does not conform to pattern mask');
      await mask.fill('K12');
      await mask.blur();
      await page.waitForTimeout(500);
      expect(await rowText(c.mask)).not.toContain('does not conform');

      // Save is blocked module-wide while any field is invalid -- we only observe it (never save): the Save button state.
      const saveEnabled = await edit.getByRole('button', { name: 'Save' }).isEnabled();
      console.log(`Save button enabled with an invalid required field: ${saveEnabled}`);

      // Leave without saving: Previous Page may prompt about unsaved changes.
      await edit.click('a:has-text("Previous Page")', { timeout: 5000 });
      await page.waitForTimeout(1500);
      const leave = edit.locator('.ui-dialog:visible').filter({ hasText: 'Changes will be lost' });
      if ((await leave.count()) > 0) {
        await leave.getByRole('button', { name: /Continue|OK|Yes/ }).first().click({ timeout: 5000 });
        await page.waitForTimeout(1500);
      }
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
      console.log(`captions after cleanup: ${JSON.stringify(after)}`);
      expect(after.filter((x) => x.startsWith('PW '))).toEqual([]);
      expect(after).toEqual(baseline);
      const checks = await f.evaluate(() => Array.from(document.querySelectorAll('input[type="checkbox"][disabled]')).slice(0, 2).map((x) => (x as HTMLInputElement).checked));
      expect(checks, 'the fixture must still have NO data').toEqual([false, false]);
    });
  }
});
