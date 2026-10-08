// Lot Management Actions > Save Search / Load Search (live 2026-10-06, headless). Observed: Save dialog = Overwrite (radio #radExisting + #drpExistingSets, disabled while the user has no saved
// search) / Save As New (#radNew), Name + Description required ("Name and Description are required"), Public checkbox (#chkPublic, ticked by default); a duplicate name with Save As New is
// REFUSED here ("A filter with this name already exists"); Load dialog lists Name / Owner / Description and #filterLoadBtn applies the criteria. There is NO delete in the UI, so the spec
// keeps ONE saved search named MBPWSS1 (re-used and overwritten every run) -- a leftover owned by the test user, listed in the .agents docs.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login } from '../support/robar';
import * as du from '../support/dynamic-ui';

test.use({ actionTimeout: 20_000 });

const NAME = 'MBPWSS1';

test('Lot Management: Save Search (new / overwrite / duplicate / required) and Load Search restore the criteria', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  let g: Frame;

  const open = async (): Promise<Frame> => {
    const f = await du.reopenDynamicUi(page, 'Lot Management');
    await f.click('#btnReset').catch(() => {});
    await page.waitForTimeout(3000);
    return du.reopenDynamicUi(page, 'Lot Management');
  };
  const action = async (item: string) => {
    await g.locator('a:has-text("Actions")').first().click();
    await page.waitForTimeout(500);
    await g.locator('ul:visible li a').filter({ hasText: item }).click({ force: true });
    await page.waitForTimeout(3000);
  };
  const dlg = () => g.locator('.ui-dialog:visible').last();
  const text = async () => (await dlg().innerText()).replace(/\s+/g, ' ');
  const save = async (mode: 'new' | 'overwrite', name: string, description: string) => {
    await action('Save Search');
    if (mode === 'new') {
      await g.locator('#radNew').check();
      await g.locator('#txtFilterSaveName').fill(name);
    } else {
      await g.locator('#radExisting').check();
      await g.locator('#drpExistingSets').selectOption({ label: name });
    }
    await g.locator('#txtFilterSaveDescription').fill(description);
    await dlg().locator('button').filter({ hasText: /^Save$/ }).click();
    await page.waitForTimeout(2500);
  };

  g = await open();
  await test.step('Retrieve with LotNum contains MBMDPL', async () => {
    await du.retrieve(page, g, 'LotNum', 'Contains', 'MBMDPL', { expectRows: false });
    await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
  });

  await test.step('Name and Description are required', async () => {
    await action('Save Search');
    await dlg().locator('button').filter({ hasText: /^Save$/ }).click();
    await page.waitForTimeout(1500);
    expect(await text()).toContain('Name and Description are required');
    await dlg().locator('button').filter({ hasText: 'Close' }).first().click();
    await page.waitForTimeout(800);
  });

  await test.step('Save the search (new the first time, overwrite afterwards)', async () => {
    await action('Save Search');
    const exists = await g.locator('#radExisting').isEnabled();
    await dlg().locator('button').filter({ hasText: 'Close' }).first().click();
    await page.waitForTimeout(800);
    await save(exists ? 'overwrite' : 'new', NAME, 'pw saved search');
    expect(await dlg().isVisible().catch(() => false), 'the dialog closes after a successful save').toBe(false);
  });

  await test.step('Save As New with an existing name is refused', async () => {
    await save('new', NAME, 'dup');
    expect(await text()).toContain('A filter with this name already exists');
    await dlg().locator('button').filter({ hasText: 'Close' }).first().click();
    await page.waitForTimeout(800);
  });

  await test.step('Overwrite does NOT update the description in the Load Search list (observation)', async () => {
    const description = `pw saved ${Date.now().toString().slice(-6)}`;
    await save('overwrite', NAME, description);
    await action('Load Search');
    const rows = await g.locator('#grdSavedFilters tr.jqgrow').allInnerTexts();
    console.log(`saved searches: ${JSON.stringify(rows)}`);
    const mine = rows.find((r) => r.includes(NAME));
    // OBSERVED: Overwrite keeps the ORIGINAL description (the new text typed in the dialog is not stored)
    expect(mine).toContain('pw saved search');
    expect(mine).not.toContain(description);
    expect(mine).toContain('Claude');
    await dlg().locator('button').filter({ hasText: 'Close' }).first().click();
    await page.waitForTimeout(800);
  });

  await test.step('Reset, then Load Search brings the criteria back (only MBMDPL lots)', async () => {
    g = await open();
    await action('Load Search');
    await g.locator('#grdSavedFilters tr.jqgrow').filter({ hasText: NAME }).first().click();
    await dlg().locator('#filterLoadBtn').click();
    await page.waitForTimeout(6000);
    g = await du.reopenDynamicUi(page, 'Lot Management');
    // OBSERVED: Load only restores the criteria row (LotNum / Contains / MBMDPL); the grid stays empty until Retrieve Data is clicked
    expect(await du.rows(g)).toHaveLength(0);
    expect(await g.locator('input').evaluateAll((e) => e.some((x) => (x as HTMLInputElement).value === 'MBMDPL'))).toBe(true);
    await g.locator('button:has-text("Retrieve Data"), input[value="Retrieve Data"]').first().click();
    await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
    const rows = await du.rows(g);
    console.log(`rows after load: ${rows.length}`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.includes('MBMDPL'))).toBe(true);
  });
});
