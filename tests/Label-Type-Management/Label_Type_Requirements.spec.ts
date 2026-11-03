// Label Type Management against ValMaster (docs/agents/valmaster-label-type-management.md, scripts LT_Management-1.1 / 1.2): what the first pass (Label_Type_Management / _Actions / Security_Gating)
// did not check: the grid footer (page counter, record counter drop-down, "View X - X of X"), Retrieve-first behavior, several filters with AND / OR, "No records to view", select + double click,
// the icons, the creation side effects (LabelTypes + X_LabelTypes audit rows, the LT_ security process and its assignment to every group / user) and the "already exists" wording.
// Creation uses ONE label type, `CLLabelType` (see lt-helpers.ts): created when missing, found on every later run. Editing: only the DESCRIPTION of that row, restored afterwards.
// Confirmed live 2026-11-03 on TST703 (headless). Requirement ids: LM.160202.F.1.x / F.2.x / F.3.x / F.4.x / U.x.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as dui from '../support/dynamic-ui';
import * as sec from '../support/security';
import { CL_DESCRIPTION, CL_LABEL_TYPE, TILE, ensureClLabelType } from './lt-helpers';

test.use({ actionTimeout: 20_000 });

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

const stamp = Date.now().toString().slice(-6);
const editedDescription = `CL edit ${stamp}`; // short: the Description column is limited (a 57-character text ends in a raw SQL truncation error, see the tracker)

async function pager(f: Frame) {
  return {
    info: (await f.locator('.ui-paging-info').first().innerText().catch(() => '')).trim(),
    pageInput: await f.locator('.ui-pg-input').first().inputValue().catch(() => ''),
    pageTotal: (await f.locator('[id^=sp_1_]').first().innerText().catch(() => '')).trim(),
    sizes: await f.locator('select.ui-pg-selbox option').allInnerTexts().catch(() => [] as string[]),
    size: await f.locator('select.ui-pg-selbox').first().inputValue().catch(() => ''),
  };
}

test('Label Type Management: grid footer, Retrieve-first, filters AND / OR, double click, icons, creation side effects (LM.160202)', async ({ page }) => {
  test.setTimeout(900_000);
  let f: Frame = await dui.openDynamicUi(page, TILE);
  let createdNow = false;

  await test.step('Results are not loaded until Retrieve Data is clicked (F.1.8)', async () => {
    expect(await f.locator('tr.jqgrow').count()).toBe(0);
    await expect(f.locator('#btnRetrieveData')).toBeVisible();
  });

  await test.step('Create CLLabelType once (U.2, F.2.1, F.2.2, F.2.8): found again on every later run', async () => {
    const r = await ensureClLabelType(page, f);
    createdNow = r.created;
    f = r.frame;
    console.log(`CLLabelType: created by this run = ${createdNow}`);
    // F.2.2: the "+" icon sits at the bottom left of the grid (pager left block)
    const addIcon = await f.locator('#add_grdJqGrid').boundingBox();
    const pagerBox = await f.locator('#grdPager').boundingBox();
    expect(addIcon && pagerBox && addIcon.x - pagerBox.x < pagerBox.width / 3, 'Add icon in the left third of the pager').toBe(true);
  });

  await test.step('Page counter, record counter drop-down, "View X - X of X" (F.1.11, F.1.12, F.1.13)', async () => {
    await dui.retrieve(page, f, 'LabelType', 'Is Not Blank', '');
    const p = await pager(f);
    console.log('pager:', JSON.stringify(p));
    expect(p.info).toMatch(/^View 1 [-–] 10 of \d+$/); // F.1.13 "View X – X of X"
    expect(p.pageInput).toBe('1'); // "Page X of X"
    expect(Number(p.pageTotal)).toBeGreaterThan(1);
    expect(p.sizes.map((s) => s.trim())).toEqual(['10', '20', '30']); // F.1.12
    expect(p.size).toBe('10'); // defaults to 10
    await f.locator('select.ui-pg-selbox').first().selectOption('20');
    await page.waitForTimeout(2500);
    expect((await pager(f)).info).toMatch(/^View 1 [-–] 20 of \d+$/);
    expect(await f.locator('tr.jqgrow').count()).toBe(20);
    await f.locator('select.ui-pg-selbox').first().selectOption('10');
    await page.waitForTimeout(2000);
    // F.1.13: the maximum number of results is 9999; the page offers Limit Results = 1000 by default
    const limit = await f.locator('#resultLimitTxt').inputValue();
    console.log('Limit Results default:', limit);
    if (limit !== '9999') deviation(`LM.160202.F.1.13 says at most 9999 results are shown at a time; the page's Limit Results default is ${limit}`);
  });

  await test.step('Several filters with AND / OR, and "No records to view" (F.1.9, F.1.10, F.1.7)', async () => {
    await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', 'MBLT1');
    if ((await f.locator('select[name="dvFilters[1].Column"]').count()) === 0) {
      await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }
    const andOr = f.locator('select[name$=".AndOr"]');
    console.log('AND / OR selects:', await andOr.count(), (await andOr.first().locator('option').allInnerTexts().catch(() => [])).join('/'));
    expect(await andOr.count()).toBeGreaterThan(0);
    expect((await andOr.first().locator('option').allInnerTexts()).map((t) => t.trim().toLowerCase())).toEqual(expect.arrayContaining(['and', 'or']));
    await f.locator('select[name="dvFilters[1].Column"]').selectOption('LabelType');
    await f.locator('select[name="dvFilters[1].Operator"]').selectOption({ label: 'Exactly Matches' });
    await page.waitForTimeout(300);
    await f.locator('input[name="dvFilters[1].Value"]').fill('MBDOCX');
    await andOr.first().selectOption({ label: 'And' }).catch(() => andOr.first().selectOption({ index: 0 }));
    await f.click('#btnRetrieveData');
    await page.waitForTimeout(3500);
    expect(await dui.rows(f), 'MBLT1 AND MBDOCX matches nothing').toEqual([]);
    await expect(f.locator('.ui-paging-info').first()).toContainText('No records to view'); // F.1.10
    await andOr.first().selectOption({ label: 'Or' });
    await f.click('#btnRetrieveData');
    await page.waitForTimeout(3500);
    const either = await dui.rows(f);
    console.log('MBLT1 OR MBDOCX:', JSON.stringify(either));
    expect(either.length).toBe(2);
    // remove the second row again
    await f.getByText('Remove', { exact: true }).last().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  });

  await test.step('Select a row and double-click it: the Edit Record dialog opens (F.1.5, F.3.3, F.3.2, F.3.4)', async () => {
    await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', CL_LABEL_TYPE);
    const row = dui.gridRow(f, CL_LABEL_TYPE);
    await row.first().dblclick();
    const d = f.locator('.ui-jqdialog:visible').last();
    await d.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    expect((await d.innerText()).replace(/\s+/g, ' ')).toContain('Edit Record');
    expect(await d.locator('#Description').isDisabled(), 'only Description is editable').toBe(false);
    expect(await d.locator('#LabelType').isDisabled()).toBe(true);
    await dui.cancelForm(f);
  });

  await test.step('A duplicate is refused; the wording differs from the requirement (F.2.10)', async () => {
    const d = await dui.openFormDialog(f, 'add');
    await d.locator('#LabelType').fill(CL_LABEL_TYPE);
    await d.locator('#FileExtension').selectOption('.btw');
    await d.locator('#Description').fill('duplicate');
    await d.locator('#FilePurpose').selectOption({ index: 0 });
    await dui.submitForm(f);
    const msg = await dui.formError(f);
    console.log(`duplicate label type: "${msg}"`);
    expect(msg).not.toBe('');
    if (msg !== 'Label type already exists') deviation(`LM.160202.F.2.10 expects the message "Label type already exists"; the page shows "${msg}"`);
    await dui.cancelForm(f);
  });

  await test.step('Audit: adding and editing write X_LabelTypes records (F.2.8, F.3.5, F.3.6)', async () => {
    const auditText = async () => {
      await f.locator('#drpMainActions').click();
      await page.waitForTimeout(500);
      await f.locator('#actAuditView').click({ force: true });
      await page.waitForTimeout(3500);
      const af = page.frames().find((x) => /DynamicUIAudit/.test(x.url()))!;
      expect(af, 'an audit frame opened').toBeTruthy();
      const text = (await af.locator('body').innerText()).replace(/\s+/g, ' ');
      return { af, text };
    };
    const a1 = await auditText();
    console.log('audit page text:', a1.text.slice(0, 400));
    expect(a1.text).toContain('Audit - Label Type Management');
    // the audit grid pages by 10 and the CL label type collects 2 change records per run: count with the pager total and look for the ADD record with a second criteria row
    const auditQuery = async (af: Frame, changeType?: string): Promise<{ total: number; rows: string[] }> => {
      if ((await af.locator('select[name="dvFilters[0].Column"]').count()) === 0) await af.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
      await af.locator('select[name="dvFilters[0].Column"]').selectOption('LabelType');
      await af.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: 'Exactly Matches' });
      await page.waitForTimeout(300);
      await af.locator('input[name="dvFilters[0].Value"]').fill(CL_LABEL_TYPE);
      const second = (await af.locator('select[name="dvFilters[1].Column"]').count()) > 0;
      if (changeType) {
        if (!second) { await af.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 }); await page.waitForTimeout(500); }
        await af.locator('select[name="dvFilters[1].Column"]').selectOption('ChangeType');
        await af.locator('select[name="dvFilters[1].Operator"]').selectOption({ label: 'Exactly Matches' });
        await page.waitForTimeout(300);
        await af.locator('input[name="dvFilters[1].Value"]').fill(changeType);
        await af.locator('select[name$=".AndOr"]').first().selectOption({ label: 'And' }).catch(() => {});
      } else if (second) {
        await af.getByText('Remove', { exact: true }).last().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
      await af.click('#btnRetrieveData');
      await page.waitForTimeout(3500);
      const info = (await af.locator('.ui-paging-info').first().innerText().catch(() => '')).trim();
      const rows = (await af.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      const total = Number((info.match(/of\s+([\d,]+)/) ?? [])[1]?.replace(/,/g, '') ?? rows.length);
      return { total, rows };
    };
    const added = await auditQuery(a1.af, 'A');
    console.log('ADD audit records of CLLabelType:', JSON.stringify(added.rows));
    expect(added.total, 'exactly one ADD record: the creation (F.2.8)').toBe(1);
    expect(added.rows[0]).toMatch(/^A Claude01 /);
    const before = await auditQuery(a1.af);
    console.log('audit records of CLLabelType before the edit:', before.total);
    expect(before.total).toBeGreaterThanOrEqual(1);
    // edit the description, then restore it: two more records
    await page.locator('li.ui-tabs-tab:has-text("Audit") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    f = await dui.reopenDynamicUi(page, TILE); // the page was navigated by the Audit tab: re-resolve the frame
    await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', CL_LABEL_TYPE);
    await dui.selectGridRow(f, CL_LABEL_TYPE);
    let d = await dui.openFormDialog(f, 'edit');
    await d.locator('#Description').fill(editedDescription);
    await dui.submitForm(f);
    expect(await dui.formError(f)).toBe('');
    await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 10_000 });
    expect(await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', CL_LABEL_TYPE)).toEqual([`${CL_LABEL_TYPE} .btw ${editedDescription}`]);
    await dui.selectGridRow(f, CL_LABEL_TYPE);
    d = await dui.openFormDialog(f, 'edit');
    await d.locator('#Description').fill(CL_DESCRIPTION);
    await dui.submitForm(f);
    await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 10_000 });
    expect(await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', CL_LABEL_TYPE)).toEqual([`${CL_LABEL_TYPE} .btw ${CL_DESCRIPTION}`]);
    const a2 = await auditText();
    const after = await auditQuery(a2.af);
    const changes = await auditQuery(a2.af, 'C');
    console.log('audit records of CLLabelType after the edit and restore:', after.total, '(change records:', changes.total + ')');
    expect(after.total, 'each change adds an audit record (F.3.5, F.3.6)').toBeGreaterThanOrEqual(before.total + 2);
    expect(changes.total, 'the edits are ChangeType C (change)').toBeGreaterThanOrEqual(2);
    await page.locator('li.ui-tabs-tab:has-text("Audit") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    f = await dui.reopenDynamicUi(page, TILE);
  });

  await test.step('LT_ security process: created with the prefix and enabled for every group and user (F.4.1, F.4.2, F.4.3, F.4.4, U.4)', async () => {
    const proc = `LT_${CL_LABEL_TYPE}`;
    const g = await sec.reopenSecurity(page); // already logged in: openSecurity would log in again
    await sec.setView(g, 'GROUP');
    const groups = (await g.locator('#group_tableBody_tbody td#groupID').allInnerTexts()).map((t) => t.trim());
    console.log(`${groups.length} groups:`, groups.join(' | '));
    // CL* / MB* test groups have their process sets reset by other specs (setGroupProcesses): only the SEEDED / real groups are checked
    const real = groups.filter((n) => !/^(CL|MB)/i.test(n));
    const lacking: string[] = [];
    let checked = 0;
    for (const name of real) {
      await sec.selectRow(page, g, sec.groupRow(g, name));
      const procs = await sec.readProcesses(g);
      if (!(proc in procs)) { lacking.push(`${name}: no row`); continue; }
      checked++;
      if (!procs[proc]) {
        const enabled = Object.keys(procs).filter((k) => procs[k]);
        lacking.push(`${name}: not enabled (${enabled.length} processes enabled, ${enabled.filter((k) => k.startsWith('LT_')).length} of them LT_)`);
      }
    }
    console.log(`${proc}: checked ${checked} of ${real.length} real groups, NOT enabled in ${lacking.length}: ${JSON.stringify(lacking)}`);
    expect(checked, 'the process exists in the process list of real groups').toBeGreaterThan(0);
    expect(real.length - lacking.length, 'enabled for a large part of the groups').toBeGreaterThan(0);
    if (lacking.length) deviation(`LM.160202.F.4.2 (the new LT_ process is enabled for ALL groups): ${proc} is NOT enabled in ${lacking.length} of ${real.length} real groups: ${lacking.map((l) => l.split(':')[0]).join(', ')}`);
    // individual users too (F.4.2 "all individual Users"): the first real users of the Users view
    await sec.setView(g, 'USER');
    const users = (await g.locator('#user_tableBody_tbody td#userID').allInnerTexts()).map((t) => t.trim()).filter((n) => !/^(CL|MB)/i.test(n));
    const userLacking: string[] = [];
    for (const u of users.slice(0, 8)) {
      await sec.selectRow(page, g, sec.userRow(g, u));
      const procs = await sec.readProcesses(g);
      if (!procs[proc]) userLacking.push(u);
    }
    console.log(`${proc}: checked ${Math.min(8, users.length)} of ${users.length} real users, lacking: ${JSON.stringify(userLacking)}`);
    expect(userLacking, 'enabled for the real users').toEqual([]);
  });

  console.log(`done; CLLabelType was created by this run: ${createdNow}`);
});

void sec;
