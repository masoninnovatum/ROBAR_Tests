// Schemas module field editor on the NO-DATA fixture schema MBExploreSchema (an MB-prefixed item schema from an earlier
// exploration; it must never get records, because a schema with data locks its saved fields). Web-only. Everything the
// spec adds is deleted again at the end (and in `finally`), so the fixture returns to its baseline.
//
//   1. baseline: Item Schema checked, Has Data unchecked, one starting field
//   2. New Schema dialog validation (nothing is created): empty name, then a case-insensitive duplicate name
//   3. add Short Text (required, min/max, input mask), Integer, True/False and Dropdown List fields, Save
//   4. reload the editor: every field persisted with its settings
//   5. an empty caption blocks Save client-side
//   6. delete the added fields and Save: back to the baseline field list

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as mdm from '../support/master-data';
import * as sch from '../support/schemas';

const FIXTURE = 'MBExploreSchema';

test('Schemas editor: add fields with settings, persist, validate, delete (no-data fixture schema)', async ({ page }) => {
  test.setTimeout(420_000);
  const mdFrame = await mdm.openMasterData(page);
  let f: Frame = await sch.openSchemaEditor(page, mdFrame, FIXTURE);
  const stamp = Date.now().toString().slice(-6);
  const cap = { text: `PW Text ${stamp}`, int: `PW Int ${stamp}`, bool: `PW Bool ${stamp}`, drop: `PW Drop ${stamp}` };
  const dup = { a: `PW DupA ${stamp}`, b: `PW DupB ${stamp}`, shareName: `m_pwdup${stamp}` };
  const share = { text: `m_pwtext${stamp}`, int: `m_pwint${stamp}`, bool: `m_pwbool${stamp}`, drop: `m_pwdrop${stamp}` };
  let baseline: string[] = [];

  const captions = async (frame: Frame) => (await frame.locator('.md-field .md-field-caption span').allInnerTexts()).map((t) => t.trim());
  const reopen = async () => {
    const grid = await mdm.reopenMasterData(page);
    f = await sch.openSchemaEditor(page, grid, FIXTURE);
  };

  try {
    await test.step('baseline: an item schema without data', async () => {
      const checks = await f.evaluate(() => Array.from(document.querySelectorAll('input[type="checkbox"][disabled]')).slice(0, 2).map((c) => (c as HTMLInputElement).checked));
      expect(checks, 'Item Schema checked, Has Data unchecked').toEqual([true, false]);
      baseline = await captions(f);
      console.log(`baseline captions: ${JSON.stringify(baseline)}`);
      expect(baseline.length).toBeGreaterThan(0);
      expect(baseline.some((c) => c.startsWith('PW '))).toBe(false);
    });

    await test.step('New Schema dialog validation (nothing is created)', async () => {
      await f.locator('#actionsDropdown').click({ timeout: 5000 });
      await page.waitForTimeout(600);
      await f.locator('#actNewSchema').click({ force: true, timeout: 5000 });
      await page.waitForTimeout(1000);
      const dialog = f.locator('.ui-dialog:visible').filter({ has: f.locator('#newSchemaDialog') });
      await dialog.getByRole('button', { name: 'Submit' }).click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      const emptyText = (await dialog.innerText({ timeout: 3000 })).replace(/\s+/g, ' ');
      console.log(`empty schema name: ${emptyText}`);
      expect(emptyText.toLowerCase()).toMatch(/required|name/);

      await dialog.locator('input[type="text"]').fill(FIXTURE.toLowerCase(), { timeout: 5000 });
      // Observed quirk: right after the "required" error, the FIRST Submit click with a valid name is swallowed
      // (re-validates only); a second click sends the request. Click until the popup shows (max 3 tries).
      const popup = f.locator('.ui-dialog:visible').filter({ hasText: 'The entered schema name already exists.' });
      let clicks = 0;
      for (; clicks < 3 && (await popup.count()) === 0; clicks++) {
        await dialog.getByRole('button', { name: 'Submit' }).click({ timeout: 5000, noWaitAfter: true });
        await page.waitForTimeout(1800);
      }
      console.log(`Submit clicks needed after the validation error: ${clicks}`);
      // The duplicate check is case-insensitive and shows an error popup (Continue) on top of the still-open dialog.
      await expect(popup).toHaveCount(1, { timeout: 5000 });
      await popup.getByRole('button', { name: 'Continue' }).click({ timeout: 5000 });
      // Close the still-open Create New Schema dialog; no schema was created.
      await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      expect(await f.locator('select[name="schemaSelector"] option').allInnerTexts()).not.toContain(FIXTURE.toLowerCase());
    });

    await test.step('add four fields with settings and Save', async () => {
      await sch.addField(f, { type: 'Short Text', caption: cap.text, shareName: share.text, sampleData: 'abc', required: true, minLength: 3, maxLength: 12, inputMask: 'K\\d\\d' });
      await sch.addField(f, { type: 'Integer', caption: cap.int, shareName: share.int, sampleData: '7' });
      await sch.addField(f, { type: 'True/False', caption: cap.bool, shareName: share.bool });
      // A Dropdown List needs a configured source before the schema can be saved; use a two-option static list.
      const drop = await sch.addField(f, { type: 'Dropdown List', caption: cap.drop, shareName: share.drop });
      await sch.addStaticOption(drop, 'Option One', 'opt1');
      await sch.addStaticOption(drop, 'Option Two', 'opt2');
      expect(await sch.staticOptions(drop)).toEqual(['Option One', 'Option Two']);
      const saved = await sch.saveSchema(page, f);
      console.log(`save response (added field ids): ${JSON.stringify(saved)}`);
      for (const c of Object.values(cap)) expect(Object.keys(saved), `new id returned for ${c}`).toContain(c);
    });

    await test.step('reload: every added field persisted with its settings', async () => {
      await reopen();
      const now = await captions(f);
      for (const c of Object.values(cap)) expect(now).toContain(c);

      const text = sch.fieldBlock(f, cap.text);
      await expect(text).toHaveCount(1);
      expect(await sch.row(text, 'Field Type').locator('select').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0].text.trim())).toBe('Short Text');
      expect(await sch.row(text, 'Share Name').locator('input').inputValue()).toBe(share.text);
      expect(await sch.checkbox(text, 'Required').isChecked()).toBe(true);
      expect(await sch.row(text, 'Min Length').locator('input').inputValue()).toBe('3');
      expect(await sch.row(text, 'Max Length').locator('input[type="number"]').inputValue()).toBe('12');
      expect(await sch.row(text, 'Input Mask').locator('input').first().inputValue()).toBe('K\\d\\d');

      for (const [key, type] of [['int', 'Integer'], ['bool', 'True/False'], ['drop', 'Dropdown List']] as const) {
        const b = sch.fieldBlock(f, cap[key]);
        expect(await sch.row(b, 'Field Type').locator('select').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0].text.trim())).toBe(type);
        expect(await sch.row(b, 'Share Name').locator('input').inputValue()).toBe(share[key]);
      }
      // The static dropdown's options persisted (labels; the stored values are the option values).
      expect(await sch.staticOptions(sch.fieldBlock(f, cap.drop))).toEqual(['Option One', 'Option Two']);
      // Still no data: the schema stays editable.
      const checks = await f.evaluate(() => Array.from(document.querySelectorAll('input[type="checkbox"][disabled]')).slice(0, 2).map((c) => (c as HTMLInputElement).checked));
      expect(checks).toEqual([true, false]);
    });

    await test.step('an empty caption blocks Save client-side', async () => {
      const block = await sch.addField(f, { type: 'Short Text', caption: '', shareName: `m_pwblank${stamp}` });
      let posted = false;
      page.on('request', (r) => { if (r.url().includes('/Schemas/Save')) posted = true; });
      await f.click('#btnSaveSchema', { timeout: 5000 });
      await page.waitForTimeout(2000);
      const body = (await f.locator('body').innerText({ timeout: 3000 })).replace(/\s+/g, ' ');
      console.log(`empty caption: save posted=${posted}; required message shown=${body.includes('required')}`);
      expect(posted, 'no Save request for an invalid field').toBe(false);
      // Save is refused with a modal "Invalid fields highlighted or marked with '*' must be corrected." dialog.
      const invalidDialog = f.locator('.ui-dialog:visible').filter({ hasText: 'must be corrected' });
      await expect(invalidDialog).toHaveCount(1, { timeout: 5000 });
      await invalidDialog.getByRole('button', { name: 'Continue' }).click({ timeout: 5000 });
      await page.waitForTimeout(500);
      // Remove the invalid block again (trash on an unsaved block drops it).
      await block.locator('.delete-field').click({ timeout: 5000 });
      await page.waitForTimeout(800);
    });

    await test.step('share names: two fields with the SAME share name in one schema (observed outcome)', async () => {
      await sch.addField(f, { type: 'Short Text', caption: dup.a, shareName: dup.shareName });
      await sch.addField(f, { type: 'Short Text', caption: dup.b, shareName: dup.shareName });
      const saved = await sch.saveSchema(page, f);
      const accepted = !('__noSaveRequest' in saved);
      console.log(`duplicate share name within a schema: save accepted=${accepted} response=${JSON.stringify(saved)}`);
      // The editor enforces unique share names client-side (both fields are flagged, no Save request). The seed's own
      // duplicate (`md_charname2` on two RobarMasterData fields) therefore did not come through this UI.
      expect(accepted, 'a duplicate share name within a schema must not save').toBe(false);
    });
  } finally {
    await test.step('cleanup: delete the added fields and Save; the fixture is back at its baseline', async () => {
      await reopen();
      for (const c of [...Object.values(cap), dup.a, dup.b]) {
        const b = sch.fieldBlock(f, c);
        if ((await b.count()) === 1) await b.locator('.delete-field').click({ timeout: 5000 });
      }
      if ((await f.locator('.md-field').filter({ hasText: `m_pw` }).count()) >= 0) {
        await sch.saveSchema(page, f).catch(() => ({}));
      }
      await reopen();
      const after = await captions(f);
      console.log(`captions after cleanup: ${JSON.stringify(after)}`);
      expect(after.filter((c) => c.startsWith('PW '))).toEqual([]);
      expect(after).toEqual(baseline);
    });
  }
});
