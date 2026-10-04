// Field Definitions Management security gating, observed as a REAL MB user (fixtures `MBPWLoginGrp` + `MBPWLogin01`; only MB*
// security is changed). Documented gates: `Web_Field_Definitions` (tile), `FD_Maintain_FieldDefs` (edit), `LT_<Label Type>`
// (which label types' definitions are visible everywhere in the module). Roles are read at LOGIN.

import { test, expect } from '@playwright/test';
import type { Browser, Frame } from '@playwright/test';
import * as sec from '../support/security';
import { loginAs, findFrame, openMenuItem, PASSWORD } from '../support/robar';

const GROUP = 'MBPWLoginGrp';
const USER = 'MBPWLogin01';
const LT = 'LT_MBLT1';

test('Field Defs Management: tile, label-type visibility and edit rights follow Web_Field_Definitions / LT_ / FD_Maintain_FieldDefs', async ({ page, browser }) => {
  test.setTimeout(900_000);
  sec.assertMb(GROUP);
  sec.assertMb(USER);
  let f: Frame = await sec.openSecurity(page);
  await sec.setView(f, 'GROUP');
  await sec.selectRow(page, f, sec.groupRow(f, GROUP));
  const names = Object.keys(await sec.readProcesses(f));
  expect(names).toEqual(expect.arrayContaining(['Login_WebMenu', 'Web_Field_Definitions', 'FD_Maintain_FieldDefs', LT]));

  const setSet = async (procs: string[]) => {
    f = await sec.reopenSecurity(page);
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, GROUP));
    const cur = await sec.readProcesses(f);
    if (Object.values(cur).some(Boolean)) {
      const selectAll = f.locator('#cbSelectAll');
      if (!(await selectAll.isChecked())) {
        await Promise.all([page.waitForResponse((r) => r.url().includes('UpdateAllSecurityProcesses'), { timeout: 20_000 }), selectAll.setChecked(true, { timeout: 5000 })]);
        await page.waitForTimeout(800);
      }
      await Promise.all([page.waitForResponse((r) => r.url().includes('UpdateAllSecurityProcesses'), { timeout: 20_000 }), selectAll.setChecked(false, { timeout: 5000 })]);
      await page.waitForTimeout(800);
    }
    for (const p of procs) expect((await sec.toggleProcess(page, f, GROUP, p, true)).Success).toBe(true);
  };

  interface Obs {
    tile: boolean;
    labelTypes: string[];
    actions: string[];
    editEnabled?: boolean;
    newFdSources?: string[];
  }
  const observe = async (): Promise<Obs> => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, USER, PASSWORD);
      await p.waitForTimeout(2000);
      const tiles = (await p.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim());
      const out: Obs = { tile: tiles.includes('Field Defs Management'), labelTypes: [], actions: [] };
      if (!out.tile) return out;
      await openMenuItem(p, 'Field Defs Management');
      const tf = await findFrame(p, 'FieldDefs');
      await tf.locator('#ddlLabelTypes').waitFor({ timeout: 20_000 });
      await p.waitForTimeout(2500);
      out.labelTypes = (await tf.locator('#ddlLabelTypes option').allInnerTexts()).map((t) => t.trim());
      await tf.locator('#drpMainActions').click({ timeout: 5000 });
      await p.waitForTimeout(600);
      out.actions = await tf.locator('ul:visible li a').evaluateAll((as) => as.filter((a) => (a as HTMLElement).offsetWidth > 0 && (a as HTMLElement).offsetHeight > 0).map((a) => ((a as HTMLElement).textContent ?? '').trim().split('document.getElementById')[0].trim()));
      await tf.locator('#drpMainActions').click({ timeout: 5000 });
      out.newFdSources = (await tf.locator('#ddlOrigLabelTypes option').allInnerTexts()).map((t) => t.trim());
      if (out.labelTypes.includes('MBLT1')) {
        await tf.locator('#ddlLabelTypes').selectOption({ label: 'MBLT1' });
        await p.waitForTimeout(1500);
        while ((await tf.locator('.criteriaFilter-Filter').count()) > 0) {
          await tf.locator('.criteriaFilter-Filter span:has-text("Remove"), .criteriaFilter-Filter a:has-text("Remove")').first().click({ timeout: 5000 });
          await p.waitForTimeout(400);
        }
        await tf.click('#btnRetrieveData', { timeout: 5000 });
        await tf.locator('tr.jqgrow').first().waitFor({ timeout: 20_000 });
        await tf.locator('tr.jqgrow').first().click({ timeout: 5000 });
        await p.waitForTimeout(600);
        out.editEnabled = await tf.locator('#edit_grdJqGrid').evaluate((e) => !e.classList.contains('ui-state-disabled'));
      }
      return out;
    } finally {
      await ctx.close();
    }
  };

  const BASE = ['Login_WebMenu'];

  await test.step('without Web_Field_Definitions the tile is not shown', async () => {
    await setSet([...BASE, 'FD_Maintain_FieldDefs', LT]);
    expect((await observe()).tile).toBe(false);
  });

  await test.step('tile only (no LT_ process): the module opens but offers no label type except (Default)', async () => {
    await setSet([...BASE, 'Web_Field_Definitions']);
    const o = await observe();
    console.log(`tile only: labelTypes=${JSON.stringify(o.labelTypes)} actions=${JSON.stringify(o.actions)}`);
    expect(o.tile).toBe(true);
    expect(o.labelTypes).not.toContain('MBLT1');
    expect(o.labelTypes).not.toContain('Carton Label');
  });

  await test.step('+ LT_MBLT1: that label type appears, but the Edit icon stays disabled without FD_Maintain_FieldDefs', async () => {
    await setSet([...BASE, 'Web_Field_Definitions', LT]);
    const o = await observe();
    console.log(`+LT: labelTypes=${JSON.stringify(o.labelTypes)} edit=${o.editEnabled} actions=${JSON.stringify(o.actions)} newFdSources=${JSON.stringify(o.newFdSources)}`);
    expect(o.labelTypes).toContain('MBLT1');
    expect(o.labelTypes, 'only the label types the user holds LT_ for').not.toContain('Carton Label');
    expect(o.editEnabled, 'edit needs FD_Maintain_FieldDefs').toBe(false);
    expect(o.newFdSources ?? [], 'the copy-source list is filtered by LT_ too').not.toContain('Carton Label');
  });

  await test.step('+ FD_Maintain_FieldDefs: the Edit icon is enabled', async () => {
    await setSet([...BASE, 'Web_Field_Definitions', LT, 'FD_Maintain_FieldDefs']);
    const o = await observe();
    console.log(`+FD_Maintain: edit=${o.editEnabled} actions=${JSON.stringify(o.actions)}`);
    expect(o.editEnabled).toBe(true);
  });

  await test.step('cleanup: the fixture group is left with no authorizations', async () => {
    await setSet([]);
  });
});
