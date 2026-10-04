// Label Type Management > Actions menu (DynamicUI): Excel Export, Adjust Page Size, Save Search / Load Search. Headless; nothing
// is created in Label Types (saved searches are created and removed again; the page size is restored). Dialog notes:
//   * these are `.ui-dialog` dialogs (close with the title-bar X `.ui-dialog-titlebar-close`) -- unlike the jqGrid Add/Edit/View
//     form dialogs. DO NOT `.click().catch()` a button that does not exist: that crashed the renderer ("Target crashed").
//   * Excel Export: `#fileName`, radios `#limitResults` (Limit Results (1000)) / `#unlimitedResults` (All Filtered Records), `#submitBtn`
//   * Adjust Page Size: `#defaultGridCountSelect` (10/20/30) + Wider / Narrower / Auto Fit + Submit
//   * Save Search: `#radExisting` + `#drpExistingSets` (Overwrite), `#radNew` (Save As New), `#txtFilterSaveName`,
//     `#txtFilterSaveDescription`, `#chkPublic`, Save; Load Search: grid (Name, Owner, Description) + `#filterLoadBtn`

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as dui from '../support/dynamic-ui';
import { USERNAME, findFrame } from '../support/robar';

const TILE = 'Label Type Management';

test('Label Type Management Actions: Excel Export, Adjust Page Size and Save/Load Search', async ({ page }) => {
  test.setTimeout(420_000);
  let f: Frame = await dui.openDynamicUi(page, TILE);
  const stamp = Date.now().toString().slice(-6);

  const openAction = async (id: string) => {
    await f.locator('#drpMainActions').click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await f.locator(`#${id}`).click({ force: true, timeout: 5000 });
    await page.waitForTimeout(2000);
    return f.locator('.ui-dialog:visible').last();
  };
  const closeDialog = async () => {
    await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 5000 });
    await expect(f.locator('.ui-dialog:visible')).toHaveCount(0, { timeout: 5000 });
  };

  await test.step('Excel Export: dialog and a completed export job with a download link', async () => {
    await dui.retrieve(page, f, 'LabelType', 'Contains', 'MB');
    const d = await openAction('actExcelExport');
    await expect(d).toContainText('File Name');
    await expect(d.locator('#limitResults')).toBeChecked();
    await expect(d.locator('#unlimitedResults')).not.toBeChecked();
    await expect(d.locator('label, span, td').filter({ hasText: 'Limit Results (1000)' }).first()).toBeVisible();
    await d.locator('#fileName').fill(`PWLabelTypes${stamp}`);
    await d.locator('#unlimitedResults').check();
    await d.locator('#submitBtn').click();
    // async job: wait for the completion message (percent + link)
    let text = '';
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);
      text = (await d.innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (/100\s*%/.test(text) || /download/i.test(text)) break;
    }
    console.log(`export dialog after submit: ${text.slice(0, 300)}`);
    expect(text).toMatch(/100\s*%|download/i);
    await closeDialog();
  });

  await test.step('Adjust Page Size: Default Grid Count persists across a Retrieve (restored to 10 afterwards)', async () => {
    const d = await openAction('actAdjustPageSize');
    expect(await d.locator('#defaultGridCountSelect option').allInnerTexts()).toEqual(['10', '20', '30']);
    await expect(d.locator('#defaultGridCountSelect')).toHaveValue('10');
    for (const b of ['Wider', 'Narrower', 'Auto Fit', 'Submit']) await expect(d.getByRole('button', { name: b })).toBeVisible();
    await d.locator('#defaultGridCountSelect').selectOption('30');
    await d.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(2500);
    await dui.retrieve(page, f, 'LabelType', 'Contains', 'a');
    const total = Number(((await f.locator('.ui-paging-info').innerText()).match(/of\s+(\d+)/) ?? [])[1] ?? 0);
    const shown = await f.locator('tr.jqgrow').count();
    console.log(`page size 30: ${shown} rows shown of ${total}`);
    expect(shown).toBe(Math.min(30, total));
    // restore
    const d2 = await openAction('actAdjustPageSize');
    await d2.locator('#defaultGridCountSelect').selectOption('10');
    await d2.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(2500);
    await dui.retrieve(page, f, 'LabelType', 'Contains', 'a');
    expect(await f.locator('tr.jqgrow').count()).toBe(Math.min(10, total));
  });

  /** Deletes every saved search whose name starts with `prefix` (owned by the test user) via the Load Search grid's trash icon. */
  const removeSearches = async (prefix: string) => {
    for (let i = 0; i < 10; i++) {
      const d = await openAction('actLoadFilter');
      const mine = d.locator('tr.jqgrow').filter({ hasText: prefix });
      if ((await mine.count()) === 0) {
        await closeDialog();
        return;
      }
      await mine.first().click({ timeout: 5000 });
      await d.locator('[id^="del_"], .ui-icon-trash').first().click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      const confirm = f.locator('.ui-jqdialog:visible, .ui-dialog:visible').filter({ hasText: /Delete selected record/ }).last();
      if ((await confirm.count()) > 0) {
        if (i === 0) console.log(`delete confirm: ${(await confirm.innerText()).replace(/\s+/g, ' ').slice(0, 120)}`);
        await confirm.locator('#dData, button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")').first().click({ timeout: 5000 });
        await page.waitForTimeout(1500);
      }
      await closeDialog();
    }
  };

  await test.step('Save Search / Load Search: save as new, load it back, delete', async () => {
    await removeSearches('PWSearch'); // leftovers from an interrupted earlier run
    const name = `PWSearch${stamp}`;
    await dui.retrieve(page, f, 'LabelType', 'Contains', `MB${stamp}`, { expectRows: false });
    let d = await openAction('actSaveFilter');
    await expect(d.locator('#radNew')).toBeChecked();
    console.log(`Overwrite radio disabled: ${await d.locator('#radExisting').isDisabled()} (${(await d.locator('#drpExistingSets option').count())} existing searches)`);
    // Name and Description are both required
    await d.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);
    // the message appears INLINE in the Save Search dialog (no separate error dialog) and has no trailing period
    await expect(d).toContainText('Name and Description are required');
    await expect(f.locator('.ui-dialog:visible'), 'still just the one dialog').toHaveCount(1);
    await d.locator('#txtFilterSaveName').fill(name);
    await d.locator('#txtFilterSaveDescription').fill('Playwright saved search');
    await d.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(2500);
    console.log(`dialogs after save: ${JSON.stringify((await f.locator('.ui-dialog:visible').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').slice(0, 120)))}`);
    if ((await f.locator('.ui-dialog:visible').count()) > 0) {
      await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // load it back: the criteria come back
    await dui.retrieve(page, f, 'LabelType', 'Contains', 'zzz-changed', { expectRows: false });
    d = await openAction('actLoadFilter');
    const row = d.locator('tr.jqgrow').filter({ hasText: name });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    await expect(row).toContainText(USERNAME.toLowerCase() === USERNAME ? USERNAME : USERNAME);
    await row.click();
    await d.locator('#filterLoadBtn').click();
    await page.waitForTimeout(3500);
    // loading a search rebuilds the page: take the LAST matching frame (the old one may still be listed)
    f = page.frames().filter((x) => x.url().includes('DynamicUI/DynamicUI')).pop()!;
    console.log('inputs after load: ' + JSON.stringify(await f.locator('input').evaluateAll((e) => e.map((x) => (x as HTMLInputElement).name + '=' + (x as HTMLInputElement).value))));
    await expect(f.locator('input[name$="Value"]').first()).toHaveValue(`MB${stamp}`, { timeout: 15_000 });

    await removeSearches('PWSearch');
  });
});
