// Label Type Exclusions (Settings > "Label Type Excl.", process Maintain_LabelType_Exclusions): which label types a WORKSTATION may not print. No ValMaster requirement rows exist for this page
// (searched the Module values "Label Type Exclusions", "Label Type Management" ...; the only related formal script is MDP_IncludesExcludes of Multi Document Printing), so this spec documents the live
// behavior against the source (Web/ROBAR/Management/LabelTypeExclusion, LabelTypeExclusionDb): workstation list, Add Workstation, the checkbox grid, immediate persistence, Select All for several
// workstations. Test data: workstations named CLWS<stamp> only (never the real workstations); every exclusion the spec sets is cleared again in `finally`, after which a CLWS workstation vanishes from
// the list because it neither printed nor holds an exclusion. Confirmed live 2026-11-03 on TST703 (headless).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login } from '../support/robar';
import * as lte from './lte-helpers';

test.use({ actionTimeout: 20_000 });

const stamp = Date.now().toString().slice(-6);
const WS1 = `CLWS${stamp}`;
const WS2 = `CLWS${stamp}B`;

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

async function cleanUp(page: Page): Promise<Frame> {
  let f = await lte.openExclusions(page, true);
  const list = await lte.workstationList(f);
  const mine = [WS1, WS2].filter((w) => list.includes(w));
  if (mine.length) {
    f = await lte.selectWorkstations(page, f, mine);
    const types = await lte.labelTypes(f);
    for (const w of mine) {
      for (const t of await lte.ticked(f, w)) f = await lte.toggle(page, f, w, t, false);
    }
    void types;
  }
  return f;
}

test('Label Type Exclusions: workstation list, Add Workstation, checkbox grid, immediate persistence, Select All', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  let f = await lte.openExclusions(page);
  let types: string[] = [];
  let LT1 = '';
  let LT2 = '';
  const realWorkstations = await lte.workstationList(f);

  try {
    await test.step('Page anatomy: workstation list, Add Workstation, warning; the grid only after a workstation is selected', async () => {
      await expect(f.locator('body')).toContainText('Label Type Exclusion Maintenance');
      await expect(f.locator('body')).toContainText('Warning: All changes are immediately reflected in the database.');
      await expect(f.locator('input[id$=btnAddWorkstation]')).toHaveValue('Add');
      expect(await f.locator('select[id$=lbWorkstations]').getAttribute('multiple')).not.toBeNull();
      console.log('workstations listed:', realWorkstations.join(' | '));
      expect(realWorkstations.length).toBeGreaterThan(0);
      expect(realWorkstations).toEqual([...realWorkstations].sort()); // BindWorkstationsList sorts them
      expect(await lte.grid(f).count(), 'no grid until a workstation is selected').toBe(0);
    });

    await test.step('Add Workstation: the name is listed at once, a blank or duplicate name is ignored, nothing is stored yet', async () => {
      f = await lte.addWorkstation(page, f, WS1);
      expect(await lte.workstationList(f)).toContain(WS1);
      const n = (await lte.workstationList(f)).length;
      f = await lte.addWorkstation(page, f, '');
      f = await lte.addWorkstation(page, f, WS1);
      expect((await lte.workstationList(f)).length, 'blank / duplicate adds nothing').toBe(n);
      expect(await f.locator('input[id$=txtboxAddWorkstation]').inputValue(), 'the box is emptied').toBe('');
      // not persisted: a fresh page does not list it (no print, no exclusion)
      f = await lte.openExclusions(page, true);
      expect(await lte.workstationList(f)).not.toContain(WS1);
    });

    await test.step('Selecting a workstation builds the grid: one column per label type, nothing ticked', async () => {
      f = await lte.addWorkstation(page, f, WS1);
      f = await lte.selectWorkstations(page, f, [WS1]);
      await expect(f.locator('body')).toContainText('Exclusions');
      types = await lte.labelTypes(f);
      console.log(`${types.length} label types in the grid:`, types.slice(0, 6).join(' | '), '...');
      expect(types.length).toBeGreaterThan(30);
      expect(types).toEqual([...types].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
      expect(await lte.grid(f).locator('tr.WorkstationRow').count()).toBe(1);
      expect(await lte.grid(f).locator('tr.SelectAllRow').count(), 'Select All only with 2+ workstations').toBe(0);
      expect(await lte.ticked(f, WS1)).toEqual([]);
      [LT1, LT2] = [types[0], types[1]];
    });

    await test.step('A tick is written at once; after a reload the workstation is listed (it holds an exclusion) with the same boxes ticked', async () => {
      f = await lte.toggle(page, f, WS1, LT1, true);
      f = await lte.openExclusions(page, true);
      expect(await lte.workstationList(f)).toContain(WS1); // now listed because it has an exclusion
      f = await lte.selectWorkstations(page, f, [WS1]);
      expect(await lte.ticked(f, WS1)).toEqual([LT1]);
      // a second label type, then clear the first: the row follows
      f = await lte.toggle(page, f, WS1, LT2, true);
      f = await lte.toggle(page, f, WS1, LT1, false);
      f = await lte.openExclusions(page, true);
      f = await lte.selectWorkstations(page, f, [WS1]);
      expect(await lte.ticked(f, WS1)).toEqual([LT2]);
    });

    await test.step('Two workstations: a Select All row appears and ticks a label type for both (and clears it for both)', async () => {
      f = await lte.addWorkstation(page, f, WS2);
      f = await lte.selectWorkstations(page, f, [WS1, WS2]);
      const selectAll = lte.grid(f).locator('tr.SelectAllRow');
      expect(await selectAll.count(), 'Select All row with 2 workstations').toBe(1);
      console.log('Select All row text:', (await selectAll.innerText()).replace(/\s+/g, ' ').trim().slice(0, 80));
      const types2 = await lte.labelTypes(f);
      const i = types2.indexOf(LT1);
      const all = selectAll.locator('td').nth(i + 1).locator('input[type=checkbox]');
      await all.click();
      await page.waitForTimeout(3500);
      f = await lte.frameOf(page);
      expect(await lte.ticked(f, WS1)).toEqual(expect.arrayContaining([LT1, LT2]));
      expect(await lte.ticked(f, WS2)).toEqual([LT1]);
      f = await lte.openExclusions(page, true);
      f = await lte.selectWorkstations(page, f, [WS1, WS2]);
      expect(await lte.ticked(f, WS2)).toEqual([LT1]);
      const all2 = lte.grid(f).locator('tr.SelectAllRow').locator('td').nth((await lte.labelTypes(f)).indexOf(LT1) + 1).locator('input[type=checkbox]');
      if (!(await all2.isChecked())) deviation('the Select All box of a label type is not shown ticked after a reload although every selected workstation holds that exclusion (the header boxes start unticked)');
      // an unticked header box means "tick all": the first click changes nothing (both already hold it), the second click clears the label type for both workstations
      await all2.click();
      await page.waitForTimeout(3500);
      f = await lte.frameOf(page);
      expect(await lte.ticked(f, WS2)).toEqual([LT1]);
      const header = () => lte.grid(f).locator('tr.SelectAllRow').locator('td').nth(types2.indexOf(LT1) + 1).locator('input[type=checkbox]');
      expect(await header().isChecked()).toBe(true);
      await header().click();
      await page.waitForTimeout(3500);
      f = await lte.frameOf(page);
      expect(await lte.ticked(f, WS2)).toEqual([]);
      expect(await lte.ticked(f, WS1)).toEqual(expect.not.arrayContaining([LT1]));
    });

    await test.step('The real workstations are untouched by the run', async () => {
      f = await lte.openExclusions(page, true);
      const list = await lte.workstationList(f);
      for (const w of realWorkstations) expect(list).toContain(w);
    });
  } finally {
    try {
      f = await cleanUp(page);
      f = await lte.openExclusions(page, true);
      const left = (await lte.workstationList(f)).filter((w) => w.startsWith('CLWS' + stamp));
      console.log('CL workstations still listed after the cleanup:', JSON.stringify(left));
      expect(left, 'no exclusion left: the CL workstations disappear from the list').toEqual([]);
      expect(await lte.workstationList(f)).toEqual(realWorkstations);
    } catch (e) {
      console.log(`CLEANUP FAILED (clear every exclusion of workstations ${WS1} and ${WS2} on the Label Type Exclusions page):`, String(e).slice(0, 300));
    }
  }
});
