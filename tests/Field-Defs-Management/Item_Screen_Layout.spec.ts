// Field Definitions Management > Actions > Item Screen Layout (InnoPages/FieldDefsManagement/ItemScreenLayout?labelType=<LT>), live
// 2026-10-04/05 as Claude01 on the MB fixture label type MBLT1 ONLY (every change is reverted). The page lets an admin lay out which
// Item Edit fields appear on which tab:
//   tabs `ul.sortable-tabs li.tab-li` (`#tab-li-N`, heading `a#tabs-N-heading`): Unassigned (index 0, not editable) + Basic / Other /
//   User, plus the `(+)` tab `a#tabs-addTab-heading`; each tab's fields live in `div#tabs-N-tabgrid` as `.row-template` rows whose
//   inner div id is `row_<fieldName>` (drag handle `.tabgrippy`); Save `#saveBtn` (disabled until something changed), Cancel `#cancelBtn`.
// Built on knockout-sortable (jQuery UI sortable): a field moves tabs by dragging its row handle ONTO the target tab's heading with
// real mouse events (down, move in steps, up). MBLT1 starts at Unassigned 17 / Basic 12 / Other 13 / User 8 fields (50 in all).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, findFrame } from '../support/robar';

const LABEL_TYPE = 'MBLT1';
const FIELD = 'row_u18'; // a "User Defined 18" field, unassigned by default

test('Item Screen Layout: tabs, moving a field between tabs, Save persists, Cancel discards (MBLT1, reverted)', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const open = async (): Promise<Frame> => {
    await page.locator('li.ui-tabs-tab:has-text("Field Defs Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Field Defs Management', exact: true }).click({ timeout: 10_000 });
    let f = await findFrame(page, 'FieldDefs');
    await f.locator('#ddlLabelTypes').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(2000);
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(500);
    await f.locator('#actItemScreen').click({ force: true });
    await page.waitForTimeout(3500);
    f = await findFrame(page, 'ItemScreenLayout');
    await f.locator('#ddlLabelTypes').selectOption({ label: LABEL_TYPE }, { timeout: 5000 });
    await page.waitForTimeout(3500);
    return findFrame(page, 'ItemScreenLayout');
  };
  /** Field counts per tab, by tab name. */
  const counts = async (f: Frame) => {
    const names = (await f.locator('ul.sortable-tabs li.tab-li .tab-name').allInnerTexts()).map((t) => t.trim());
    const n = await f.locator('div.tab-group-content').evaluateAll((d) => d.map((x) => x.querySelectorAll('.row-template').length));
    return Object.fromEntries(names.map((name, i) => [name, n[i]]));
  };
  const tabOf = async (f: Frame, row: string) => f.locator(`#${row}`).evaluate((e) => e.closest('.tab-group-content')?.id ?? '');
  /** Drags a field row (by its inner id) from the ACTIVE tab onto another tab's heading. */
  const dragToTab = async (f: Frame, row: string, headingSelector: string) => {
    const handle = f.locator(`#${row}`).locator('xpath=ancestor::div[contains(@class,"row-template")][1]').locator('.tabgrippy');
    const hb = (await handle.boundingBox())!;
    const tb = (await f.locator(headingSelector).boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 20, hb.y + 10, { steps: 5 });
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 25 });
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForTimeout(1500);
  };

  let f = await open();

  await test.step('layout: Label Type dropdown, tabs and per-tab field counts; Save is disabled until a change', async () => {
    const labelTypes = (await f.locator('#ddlLabelTypes option').allInnerTexts()).map((t) => t.trim());
    expect(labelTypes[0]).toBe('(Default)');
    expect(labelTypes).toContain(LABEL_TYPE);
    expect((await f.locator('ul.sortable-tabs li.tab-li .tab-name').allInnerTexts()).map((t) => t.trim())).toEqual(['Unassigned', 'Basic', 'Other', 'User']);
    await expect(f.locator('#tabs-addTab-heading'), 'the (+) tab').toHaveCount(1);
    const c = await counts(f);
    console.log(`MBLT1 field counts per tab: ${JSON.stringify(c)}`);
    expect(c).toEqual({ Unassigned: 17, Basic: 12, Other: 13, User: 8 });
    await expect(f.locator('#saveBtn')).toBeDisabled();
    await expect(f.locator('#cancelBtn')).toBeEnabled();
    // only the Unassigned tab is non-editable; the others offer rename (pencil)
    expect(await f.locator('#UnassignedTab.non-editable-tab').count()).toBe(1);
    expect(await f.locator('li.tab-li#tab-li-1 .ui-icon-pencil').count()).toBe(1);
    expect(await tabOf(f, FIELD)).toBe('tabs-0-tabgrid');
    // each row shows Default Caption, Current Caption and Sharename
    const rowText = (await f.locator(`#${FIELD}`).innerText()).replace(/\s+/g, ' ').trim();
    expect(rowText).toBe('User Defined 18 User Defined 18 I_u18');
  });

  await test.step('dragging a field onto another tab enables Save; Cancel discards the change', async () => {
    await dragToTab(f, FIELD, '#tabs-1-heading');
    await expect(f.locator('#saveBtn'), 'a move makes the page dirty').toBeEnabled({ timeout: 5000 });
    expect(await tabOf(f, FIELD)).toBe('tabs-1-tabgrid');
    expect(await counts(f)).toEqual({ Unassigned: 16, Basic: 13, Other: 13, User: 8 });
    await f.locator('#cancelBtn').click();
    await page.waitForTimeout(2500);
    f = await open();
    expect(await counts(f), 'Cancel saved nothing').toEqual({ Unassigned: 17, Basic: 12, Other: 13, User: 8 });
  });

  await test.step('Save persists the move (checked after reopening the page), then the move is reverted', async () => {
    await dragToTab(f, FIELD, '#tabs-1-heading');
    await expect(f.locator('#saveBtn')).toBeEnabled({ timeout: 5000 });
    await f.locator('#saveBtn').click();
    await page.waitForTimeout(3500);
    f = await open();
    expect(await counts(f)).toEqual({ Unassigned: 16, Basic: 13, Other: 13, User: 8 });
    expect(await tabOf(f, FIELD), 'the field now lives on the Basic tab').toBe('tabs-1-tabgrid');

    // revert: open the Basic tab and drag the field back onto Unassigned
    await f.locator('#tabs-1-heading').click();
    await page.waitForTimeout(800);
    await dragToTab(f, FIELD, '#tabs-0-heading');
    await expect(f.locator('#saveBtn')).toBeEnabled({ timeout: 5000 });
    await f.locator('#saveBtn').click();
    await page.waitForTimeout(3500);
    f = await open();
    expect(await counts(f), 'back to the original layout').toEqual({ Unassigned: 17, Basic: 12, Other: 13, User: 8 });
    expect(await tabOf(f, FIELD)).toBe('tabs-0-tabgrid');
  });
});
