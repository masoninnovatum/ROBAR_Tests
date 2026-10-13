// Label Control bulk-action job submission pages re-checked against ValMaster (LC.161207.F.4 / F.6 / F.7 / F.8 / F.16; live 2026-10-11, headless, TST703, seed user Claude01).
// READ-ONLY: pages are opened and invalid submissions (empty job description / empty e-signature) are tried; NO valid job is submitted and NO wrong password is tried (a failed e-signature could lock Claude01).
// Differences from a requirement are annotated `deviation <id>`.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test.use({ actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

async function openLabelControl(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Label Control');
  let f = await findFrame(page, 'LabelControl/Management');
  await f.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await f.click('#btnReset');
  await page.waitForTimeout(1500);
  f = await findFrame(page, 'LabelControl/Management');
  await f.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return f;
}

/** Retrieves TESTPW items with the given LCN status filter. */
async function retrieve(page: Page, f: Frame, status: string): Promise<void> {
  await f.locator('#drpApproved').selectOption({ label: status });
  await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
  await page.waitForTimeout(500);
  await f.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
  await f.locator("select[name$='Operator']").first().selectOption('Contains');
  await f.locator("input[name$='Value']").first().fill('TESTPW');
  await f.click('#btnRetrieveData');
  await page.waitForTimeout(6000);
}

const body = async (f: Frame) => (await f.locator('body').innerText()).replace(/\s+/g, ' ').trim();

test('Label Control job submission pages: fields, defaults and required-field validation (no job is submitted)', async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);

  /** Opens a bulk-action job page for the first row of the given status; returns the job frame. */
  const openJobPage = async (actionId: string, urlPart: string, status: string, rowFilter?: (t: string) => boolean): Promise<Frame> => {
    const f = await openLabelControl(page);
    await retrieve(page, f, status);
    if (rowFilter) { await f.locator('#gview_grdLabelControl th').filter({ hasText: 'Item' }).first().click().catch(() => {}); await page.waitForTimeout(2500); }
    const rows = f.locator('#grdLabelControl tr.jqgrow');
    const n = await rows.count();
    let pick = 0;
    if (rowFilter) {
      pick = -1;
      for (let i = 0; i < n; i++) if (rowFilter((await rows.nth(i).innerText()).replace(/\s+/g, ' '))) { pick = i; break; }
    }
    if (pick < 0) console.log(`ROWS ${JSON.stringify((await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')))}`);
    expect(pick, `a ${status} row for ${actionId}`).toBeGreaterThanOrEqual(0);
    await rows.nth(pick).locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await f.click('#drpActions');
    await page.waitForTimeout(300);
    await f.click(`#${actionId}`, { force: true });
    const j = await findFrame(page, urlPart, { attempts: 60 });
    await j.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    return j;
  };

  /** submit with everything empty, then with only a job description; returns the messages seen */
  const tryEmpty = async (j: Frame, requirementPrefix: string, jobDescMessage: string) => {
    await j.click('#submitBtn, #SubmitButton', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const m1 = (await j.locator('.ui-dialog:visible, .field-validation-error, .validation-summary-errors, [class*=error]:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    console.log(`${requirementPrefix} EMPTY SUBMIT messages="${m1}" body-tail="${(await body(j)).slice(-260)}"`);
    if (!new RegExp(jobDescMessage, 'i').test(m1 + ' ' + (await body(j)))) deviation(`${requirementPrefix}.job-description`, `"${jobDescMessage}"`, m1 || 'no message');
    await j.locator('.ui-dialog:visible button').first().click({ timeout: 1500 }).catch(() => {});
    await j.fill('#txtJobDescription', 'Playwright validation probe (not submitted)').catch(() => {});
    await j.click('#submitBtn, #SubmitButton', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const m2 = (await body(j));
    const found = ['User ID is required', 'Password is required', 'Reason Code is required'].filter((t) => m2.includes(t));
    console.log(`${requirementPrefix} SIGNATURE messages found=${JSON.stringify(found)}`);
    for (const t of ['User ID is required', 'Password is required', 'Reason Code is required']) if (!found.includes(t)) deviation(`${requirementPrefix}.signature`, `"${t}"`, `not shown (${m2.slice(-200)})`);
    await j.locator('.ui-dialog:visible button').first().click({ timeout: 1500 }).catch(() => {});
  };

  await test.step('Manage Production Availability (F.4.x / F.5.x / F.6.2 / F.6.12)', async () => {
    const j = await openJobPage('actManageProduct', 'ManageProduction/JobSubmission', 'Unreleased Only');
    const text = await body(j);
    console.log(`MPA PAGE ${text.slice(0, 500)}`);
    const sel = (await j.locator('#controlBlock select').first().locator('option').allInnerTexts()).map((t) => t.trim());
    const cur = (await j.locator('#controlBlock select option:checked').first().innerText()).trim();
    console.log(`MPA Field To Update options ${JSON.stringify(sel)} default=${cur} releaseChecked=${await j.locator('#AllowPrint').first().isChecked().catch(() => 'n/a')}`);
    for (const o of ['Release', 'Effective Begin', 'Effective End']) if (!sel.includes(o)) deviation('LC.161207.F.4.4', `Field To Update option "${o}"`, JSON.stringify(sel));
    if (cur !== 'Release') deviation('LC.161207.F.4.5', 'Release is the default field', cur);
    if (!/Yes/.test(text)) deviation('LC.161207.F.6.12', 'text "Yes" next to the checked Release box', text.slice(0, 200));
    // F.4.6 / F.4.11 / F.4.14: add up to 3 rows
    await j.getByText('Add Field To Update', { exact: true }).click();
    await page.waitForTimeout(500);
    const second = (await j.locator('#controlBlock').nth(1).locator('select option:checked').innerText()).trim();
    console.log(`MPA second row default=${second}; all selects: ${JSON.stringify(await j.locator('#controlBlock select').evaluateAll((els) => els.map((e: any) => e.options[e.selectedIndex]?.text)))}`);
    if (!/Effective Begin/.test(second)) deviation('LC.161207.F.4.6', 'a new row defaults to Effective Begin Date', second);
    await j.getByText('Add Field To Update', { exact: true }).click();
    await page.waitForTimeout(500);
    const rowsNow = await j.locator('#controlBlock').count();
    const addDisabled = await j.getByText('Add Field To Update', { exact: true }).evaluate((e: any) => e.className + '|' + e.getAttribute('disabled') + '|' + getComputedStyle(e).pointerEvents).catch(() => '');
    console.log(`MPA rows=${rowsNow} addLink=${addDisabled}`);
    if (rowsNow !== 3) deviation('LC.161207.F.4.14', '3 Field To Update rows', String(rowsNow));
    // F.4.10: same field twice
    await j.locator('#controlBlock').nth(2).locator('select').selectOption({ label: 'Effective Begin' }).catch(() => {});
    await j.fill('#txtJobDescription', 'Playwright validation probe (not submitted)').catch(() => {});
    await j.click('#submitBtn').catch(() => {});
    await page.waitForTimeout(1500);
    const dup = await body(j);
    console.log(`MPA duplicate field message present=${/cannot be set to same value more than once/i.test(dup)}`);
    if (!/Field To Update cannot be set to same value more than once/i.test(dup)) deviation('LC.161207.F.4.10', '"Field To Update cannot be set to same value more than once. Please correct your selection"', dup.slice(-200));
    await j.locator('.ui-dialog:visible button').first().click({ timeout: 1500 }).catch(() => {});
  });

  await test.step('Assign Control Number (F.7.4 / F.7.19 / F.7.20)', async () => {
    const j = await openJobPage('actAssignLabelControl', 'MassAssign/JobSubmission', 'All (LCN Status)', (t) => /^\s*Actions TESTPW/.test(t));
    const text = await body(j);
    console.log(`ACN PAGE ${text.slice(0, 600)}`);
    for (const w of ['Use Unapproved Template', 'Use Unapproved Master Data', 'Job Description']) if (!text.includes(w)) deviation('LC.161207.F.7.4', `page shows "${w}"`, text.slice(0, 200));
    if (!/Label Control/.test(text)) deviation('LC.161207.F.7.5', 'a Label Control link', text.slice(0, 100));
    await tryEmpty(j, 'LC.161207.F.7', 'Job Description is Required');
  });

  await test.step('Mass Update Versions (F.8.6 / F.8.8 / F.8.12 / F.8.13)', async () => {
    const j = await openJobPage('actUpdateVersions', 'MassUpdateVersions/JobSubmission', 'Unreleased Only');
    const text = await body(j);
    console.log(`MUV PAGE ${text.slice(0, 600)}`);
    const defaults = await j.locator('select:visible').evaluateAll((els) => els.map((e: any) => `${e.id}=${e.options[e.selectedIndex]?.text}|[${[...e.options].map((o: any) => o.text).join(',')}]`));
    console.log(`MUV selects ${JSON.stringify(defaults)}`);
    for (const d of defaults.filter((x) => /^drp/.test(x))) if (!/Use Latest Version/.test(d.split('|')[0])) deviation('LC.161207.F.8.8', 'default Use Latest Version', d);
    for (const id of ['itemAllowUnapproved', 'templateAllowUnapproved', 'masterDataAllowUnapproved']) {
      const c = j.locator(`#${id}`);
      if (await c.count()) { if (await c.isChecked()) deviation('LC.161207.F.8.8', 'Allow Unapproved not selected', id); } else console.log(`MUV no #${id}`);
    }
    await tryEmpty(j, 'LC.161207.F.8', 'Job Description is Required');
  });

  await test.step('Link to Label Master (F.16.4 / F.16.12 / F.16.11)', async () => {
    const j = await openJobPage('actLinkToLabelMaster', 'LinkToLabelMaster/JobSubmission', 'Unreleased Only');
    const text = await body(j);
    console.log(`L2LM PAGE ${text.slice(0, 600)}`);
    for (const w of ['Replace Existing Label Master Link', 'Use Latest If No Exact Match', 'Job Description']) if (!text.includes(w)) deviation('LC.161207.F.16.4', `page shows "${w}"`, text.slice(0, 200));
    await tryEmpty(j, 'LC.161207.F.16', 'This Field is Required');
  });
});
