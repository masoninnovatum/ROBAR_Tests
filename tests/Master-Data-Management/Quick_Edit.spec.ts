// MDM Quick Edit ("Edit Selected Columns", `#btnEditSelCol`): pages through the selected records one at a time, showing ONLY the
// fields in Advanced Options' Selected Fields. Web-only; three fresh unapproved records A, B, C (Brand Name "Original <x>").
//   1. With no extra fields selected the page still opens ("Record 1 / 3") but says "Please select at least one editable column
//      in order to proceed."
//   2. With Brand Name + Catalog Number selected: edit A and B and "Save & Next" through to C, leave C alone; the grid filter on
//      Brand Name then finds A and B updated and C unchanged
//   3. Unsaved changes: navigating away asks "Changes will be lost. Would you like to proceed?" (observed outcome logged)

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { findFrame } from '../support/robar';
import * as mdm from '../support/master-data';

test('Quick Edit pages through selected records and saves only the changed ones', async ({ page }) => {
  test.setTimeout(480_000);
  let frame: Frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDQ${stamp}`;
  const [a, b, c] = ['A', 'B', 'C'].map((s) => prefix + s);

  await test.step('create three records', async () => {
    for (const n of [a, b, c]) {
      await mdm.createValidRecord(page, frame, { itemNumber: n, brandName: `Original${stamp} ${n}` });
      frame = await mdm.backToGrid(page, frame);
    }
  });

  const quickEditFrame = async () => {
    const f = await findFrame(page, 'MasterData/QuickEdit');
    await f.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return f;
  };
  const bodyText = async (f: Frame) => (await f.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
  const btn = (f: Frame, name: string) => f.getByRole('button', { name, exact: true });

  await test.step('no extra fields selected: the page explains it needs at least one editable column', async () => {
    // Selected Fields persist per account across runs: reset to the default pair first (the grid keeps the choice on retrieve).
    expect(await mdm.resetSelectedColumns(frame)).toEqual(['Item Number', 'Version Number']);
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [a, b, c]);
    await frame.click('#btnEditSelCol', { timeout: 5000 });
    const qe = await quickEditFrame();
    const text = await bodyText(qe);
    console.log(`quick edit without fields: ${text.slice(0, 300)}`);
    expect(text).toContain('Record 1 / 3');
    expect(text).toContain('Please select at least one editable column in order to proceed.');
    frame = await mdm.gotoMasterData(page);
  });

  await test.step('select Brand Name + Catalog Number, open Quick Edit', async () => {
    expect(await mdm.resetSelectedColumns(frame), 'starting from the default pair').toEqual(['Item Number', 'Version Number']);
    for (const cap of ['Brand Name', 'Catalog Number']) {
      await frame.locator('#availableLimitColumns').selectOption({ label: cap }, { timeout: 5000 });
      await frame.click('#btAvlToSel', { timeout: 5000 });
      await page.waitForTimeout(300);
    }
    expect((await frame.locator('#selectedLimitColumns option').allInnerTexts()).map((t) => t.trim())).toEqual(['Item Number', 'Version Number', 'Brand Name', 'Catalog Number']);
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [a, b, c]);
    await frame.click('#btnEditSelCol', { timeout: 5000 });
    const qe = await quickEditFrame();
    const text = await bodyText(qe);
    console.log(`quick edit with fields: ${text.slice(0, 300)}`);
    expect(text).toContain('Record 1 / 3');
    expect(text).not.toContain('Please select at least one editable column');
    // Record order is not guaranteed -- log the buttons' state on the first record.
    console.log(`first record buttons: Previous enabled=${await btn(qe, 'Previous').isEnabled()} Save enabled=${await btn(qe, 'Save').isEnabled()} Save & Next enabled=${await btn(qe, 'Save & Next').isEnabled()} Next enabled=${await btn(qe, 'Next').isEnabled()}`);
  });

  await test.step('edit two records with Save & Next, leave the third alone', async () => {
    let qe = await quickEditFrame();
    for (let i = 1; i <= 2; i++) {
      const text = await bodyText(qe);
      const current = (text.match(/Item Number:\s*(\S+)/) ?? [])[1];
      console.log(`record ${i}: ${current}`);
      expect(text).toContain(`Record ${i} / 3`);
      await mdm.fillFieldByCaption(qe, 'Brand Name', `QuickEdited${stamp} ${current}`);
      await btn(qe, 'Save & Next').click({ timeout: 5000 });
      await page.waitForTimeout(2500);
      qe = await quickEditFrame();
    }
    const text = await bodyText(qe);
    expect(text).toContain('Record 3 / 3');
    console.log(`last record buttons: Save & Next enabled=${await btn(qe, 'Save & Next').isEnabled()} Next enabled=${await btn(qe, 'Next').isEnabled()} Previous enabled=${await btn(qe, 'Previous').isEnabled()}`);
    // Do not touch record 3; leave via the Previous Page link (no unsaved changes -> no prompt).
    await qe.click('a#backLink', { timeout: 5000 });
    await page.waitForTimeout(2000);
  });

  await test.step('the grid shows the two edited records changed and the third unchanged', async () => {
    frame = await mdm.gotoMasterData(page);
    const rows = await mdm.retrieve(page, frame, { column: 'Brand_Name', operator: 'Contains', value: `QuickEdited${stamp}`, expectRows: 2 });
    await expect(rows).toHaveCount(2);
    const names = (await rows.allInnerTexts()).join(' ');
    const edited = [a, b, c].filter((n) => names.includes(n));
    console.log(`edited records (by Brand_Name filter): ${JSON.stringify(edited)}`);
    expect(edited.length).toBe(2);
    const unchanged = await mdm.retrieve(page, frame, { column: 'Brand_Name', operator: 'Contains', value: `Original${stamp}`, expectRows: 1 });
    await expect(unchanged).toHaveCount(1);
  });

  await test.step('unsaved changes: navigating away asks before discarding', async () => {
    frame = await mdm.gotoMasterData(page);
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [a, b, c]);
    await frame.click('#btnEditSelCol', { timeout: 5000 });
    const qe = await quickEditFrame();
    await mdm.fillFieldByCaption(qe, 'Catalog Number', 'UNSAVED-123');
    await btn(qe, 'Next').click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    const dialogs = (await qe.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    console.log(`navigating with unsaved changes: ${dialogs}`);
    expect(dialogs).toContain('Changes will be lost');
    await qe.locator('.ui-dialog:visible button').filter({ hasText: /Cancel|No|Close/i }).first().click({ timeout: 5000 }).catch(() => {});
  });
});
