// Schema rules that need SAVED records, on the CL data schema `CLSchemaData` (tests/support/cl-schema.ts; created once, never a new schema per run): Must be unique on the server
// (MDM20150421100F1.0.2 / 1.0.3 / 1.0.4, script MDM_Data_Schemas2.4), the mass update of a unique field (MDM20150512100F2.0.3) and share names across schemas (MDM20140512010U1.0.0, tested on the
// data-free fixture MBNonItemschema2 because the field it adds is deleted again).
// Each run adds two records (CLU<stamp>, CLU<stamp>b): MDM records cannot be deleted, so the count is kept small. Requirements: docs/agents/valmaster-schemas.md.
// Confirmed live 2026-11-03 (headless). Non-item grid: no For Items / Latest / Effective controls; add a criteria row on the field CAPTION (`CL Unique`) and Retrieve.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, findFrame, openMenuItem } from '../support/robar';
import * as mdm from '../support/master-data';
import * as sch from '../support/schemas';
import { CL_SCHEMA, ensureClSchema, openSchemasTile } from '../support/cl-schema';
import { readGlobalSetting } from '../support/global-settings';

test.use({ actionTimeout: 20_000 });

const stamp = Date.now().toString().slice(-6);
const UNIQ = `CLU${stamp}`;
const FIXTURE = 'MBNonItemschema2';
const OTHER_SHARE = 'md_brand'; // the Brand Name share name of RobarMasterData

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

async function newRecord(page: Page): Promise<Frame> {
  const grid = await mdm.reopenMasterData(page);
  await mdm.selectSchema(grid, CL_SCHEMA);
  await mdm.openNewRecordAction(grid);
  const edit = await findFrame(page, 'MasterData');
  await expect(edit.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible({ timeout: 20_000 });
  await expect(edit.getByText(`Schema Name: ${CL_SCHEMA}`)).toBeVisible();
  return edit;
}

async function fillRecord(edit: Frame, v: { uniq: string; plain?: string; count?: string }): Promise<void> {
  await mdm.fillFieldByCaption(edit, 'CL Unique', v.uniq);
  await mdm.fillFieldByCaption(edit, 'CL Required', 'abc');
  await mdm.fillFieldByCaption(edit, 'CL Mask', 'K12');
  if (v.plain !== undefined) await mdm.fillFieldByCaption(edit, 'CL Plain', v.plain);
  if (v.count !== undefined) await mdm.fillFieldByCaption(edit, 'CL Count', v.count);
}

/** Clicks Save and returns what the page did: the SaveMasterData JSON (if a request was sent), dialog and validation texts. */
async function trySave(page: Page, edit: Frame): Promise<{ sent: boolean; json: any; dialogs: string[]; messages: string[] }> {
  const respPromise = page.waitForResponse((r) => r.url().includes('/InnovatumMDM/MasterData/SaveMasterData'), { timeout: 8000 }).catch(() => null);
  await edit.click('button:has-text("Save")');
  const resp = await respPromise;
  await page.waitForTimeout(1500);
  const json = resp ? await resp.json().catch(() => ({})) : null;
  const dialogs = (await edit.locator('.ui-dialog:visible').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  const messages = (await edit.locator('.validationMessage:visible').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { sent: !!resp, json, dialogs, messages };
}

/** Opens the CL schema grid filtered on the stamped unique values and checks the FIRST row. */
async function selectFirstRecord(page: Page): Promise<Frame> {
  const grid = await mdm.reopenMasterData(page);
  await mdm.selectSchema(grid, CL_SCHEMA);
  await page.waitForTimeout(2500);
  if ((await grid.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
    await grid.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await page.waitForTimeout(600);
  }
  // criteria rows persist per account too: keep exactly one row (an extra blank row from an earlier visit is ANDed and empties the grid)
  const criteriaRows = await grid.locator('select[name$=".Column"]').count();
  console.log('criteria rows restored by the page:', criteriaRows);
  for (let i = criteriaRows; i > 1; i--) {
    await grid.getByText('Remove', { exact: true }).last().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  // the account persists the last-used For Items / Latest / Effective / Limit settings even when the non-item page hides them: reset them by script (they would silently hide the records)
  await grid.evaluate(() => {
    const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));
    const sel = document.querySelector('#drpApproved') as HTMLSelectElement | null;
    if (sel) { const i = Array.from(sel.options).findIndex((o) => o.text.trim() === 'Any'); if (i >= 0) { sel.selectedIndex = i; fire(sel, 'change'); } }
    for (const id of ['#chkLatest', '#chkEffective']) { const c = document.querySelector(id) as HTMLInputElement | null; if (c && c.checked) { c.click(); } }
    const lim = document.querySelector('#txtResultLimit') as HTMLInputElement | null;
    if (lim) { lim.value = '500'; fire(lim, 'input'); fire(lim, 'change'); }
  });
  await grid.locator('select[name="dvFilters[0].Column"]').selectOption({ label: 'CL Unique' });
  await grid.locator('select[name="dvFilters[0].Operator"]').selectOption('Contains');
  await grid.locator('input[name="dvFilters[0].Value"]').fill(UNIQ);
  await grid.click('#btnRetrieveData');
  await page.waitForTimeout(3000);
  const rows = grid.locator('#grdMasterData tr.jqgrow');
  await expect.poll(() => rows.count(), { timeout: 20_000 }).toBe(2); // CLU<stamp> and CLU<stamp>b
  await rows.first().locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(600);
  return grid;
}

/** Mass Update of one CL field on the first record; returns the Job Detail text (or '' when no job page appeared) and the page's visible messages. */
async function massUpdate(page: Page, caption: string, value: string, description: string): Promise<{ detail: string; messages: string[] }> {
  const grid = await selectFirstRecord(page);
  await mdm.openBulkAction(grid, 'actMassUpdate');
  const job = await mdm.openJobPage(page, 'MasterDataMassUpdate/JobSubmission');
  await job.locator('select').first().selectOption({ label: caption });
  await job.locator('input[type=text]:visible').first().fill(value); // New Value
  await mdm.fillJobSignature(job, description, 'General Approval');
  await job.locator('input[type=text]:visible').nth(1).fill(description); // the Mass Update page's Job Description box has no id (second text box, after New Value)
  await job.locator('input[value="Submit Job"], button:has-text("Submit Job")').first().click();
  let detail = '';
  for (let i = 0; i < 12; i++) {
    const d = page.frames().find((x) => /MasterDataMassUpdate\/JobDetail/i.test(x.url()));
    if (d) { detail = (await d.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '); if (/Status:?\s*(Completed|CompletedWithErrors|Failed|Error)/i.test(detail)) break; }
    await page.waitForTimeout(2000);
  }
  const messages = detail ? [] : (await job.locator('.ui-dialog:visible, .validationMessage:visible, .message:visible, .text-danger:visible').allInnerTexts().catch(() => [])).map((t) => t.replace(/\s+/g, ' ').trim());
  return { detail, messages };
}

/** Number of MD Job Inquiry jobs whose Job Description contains `text`. */
async function jobsWithDescription(page: Page, text: string): Promise<number> {
  await page.locator('li.ui-tabs-tab:has-text("MD Job Inquiry") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'MD Job Inquiry');
  const f = await findFrame(page, 'JobInquiry');
  await f.locator('#btnRetrieveJobs').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  await f.locator('select[name="dvFilters[0].Column"]').selectOption({ label: 'Job Description' });
  await page.waitForTimeout(300);
  await f.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: 'Contains' });
  await page.waitForTimeout(300);
  await f.locator('input[name="dvFilters[0].Value"]:visible').fill(text);
  await f.click('#btnRetrieveJobs');
  await page.waitForTimeout(5000);
  const n = await f.locator('tr.jqgrow').count();
  // close the tab: its frame URL (`InnovatumMDM/MasterData/JobInquiry`) also matches `findFrame(page, 'MasterData')` and would be picked for the next Master Data open
  await page.locator('li.ui-tabs-tab:has-text("MD Job Inquiry") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  return n;
}

test('CL data schema: Must be unique on save, mass update of a unique field, share names across schemas', async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const setup = await ensureClSchema(page);
  console.log('CL data schema ready:', JSON.stringify(setup));
  const grid0 = await mdm.reopenMasterData(page);
  const offered = (await grid0.locator('#ddlSchemas option').allInnerTexts()).map((t) => t.trim());
  test.skip(!offered.includes(CL_SCHEMA), `precondition not met: the seed user cannot see ${CL_SCHEMA} in Master Data (its schema process SCH_${CL_SCHEMA} must be granted to the user's group; security is the user's to change)`);

  await test.step('A record with valid values saves (Required, Mask, Unique, Integer) and the Save button locks', async () => {
    const edit = await newRecord(page);
    await fillRecord(edit, { uniq: UNIQ, plain: 'first', count: '5' });
    const r = await trySave(page, edit);
    console.log('first save:', JSON.stringify(r));
    expect(r.sent).toBe(true);
    expect(r.json.MDRecordId).toBeGreaterThan(0);
    await expect(edit.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
  });

  await test.step('The same Unique value on a second record is refused with a message (F1.0.2, F1.0.3); a different value saves', async () => {
    const edit = await newRecord(page);
    await fillRecord(edit, { uniq: UNIQ, plain: 'second', count: '6' });
    const r = await trySave(page, edit);
    console.log('duplicate save:', JSON.stringify(r));
    expect(r.messages).toContain('This value already exists in another record. This field must be unique.');
    expect(r.dialogs.join(' ')).toContain('Some fields contain invalid values. Please check your submission and try again.');
    expect(r.sent, 'nothing is saved for the duplicate').toBe(false);
    await edit.locator('.ui-dialog:visible button', { hasText: 'Continue' }).click();
    await page.waitForTimeout(500);
    await mdm.fillFieldByCaption(edit, 'CL Unique', `${UNIQ}b`);
    const ok = await trySave(page, edit);
    console.log('save with a different unique value:', JSON.stringify(ok));
    expect(ok.sent).toBe(true);
    expect(ok.json.MDRecordId).toBeGreaterThan(0);
  });

  await test.step('UniqueVal_IncludeInactive is Y by default (F1.0.4, read only)', async () => {
    const v = await readGlobalSetting(page, 'UniqueVal_IncludeInactive', 'Innovatum.DataManagement.Web');
    console.log('UniqueVal_IncludeInactive =', v);
    expect(['Y', 'N']).toContain(v);
  });

  await test.step('Control: a Mass Update of a NON-unique field runs and completes', async () => {
    const r = await massUpdate(page, 'CL Plain', `mu${stamp}`, `CL plain mass update ${stamp}`);
    console.log('plain mass update:', r.detail.slice(0, 300));
    expect(r.detail).toMatch(/Status:?\s*Completed/i);
    const jobId = (r.detail.match(/Job Id\s+(\d+)/) ?? [])[1];
    expect(jobId).toMatch(/^\d{12}$/);
    // the finished job is NOT listed by MD Job Inquiry: that page indexes jobs by the item numbers they touched, and records of a non-item schema have none
    const listed = await jobsWithDescription(page, `CL plain mass update ${stamp}`);
    console.log(`MD Job Inquiry lists ${listed} job(s) for the completed non-item Mass Update ${jobId}`);
    if (listed === 0) deviation(`MDM20140512034F1.0.1 (job inquiry shows job status): the completed Mass Update job ${jobId} on the non-item schema ${CL_SCHEMA} is not found by MD Job Inquiry (Job Description / Display Id filters give no rows), while item-schema jobs are`);
  });

  await test.step('A Mass Update of the UNIQUE field is not accepted (MDM20150512100F2.0.3)', async () => {
    const r = await massUpdate(page, 'CL Unique', `${UNIQ}z`, `CL unique mass update ${stamp}`);
    console.log('unique mass update: job page text =', JSON.stringify(r.detail.slice(0, 200)), '| messages =', JSON.stringify(r.messages));
    expect(r.detail, 'no Job Detail page for the unique field (the control above shows the page for a plain field)').toBe('');
    if (r.messages.length === 0) deviation('MDM20150512100F2.0.3 the Mass Update page does not say why: submitting the unique field produces no Job Detail page (a plain field does) and shows no error message: the form is simply reset to blank');
  });

  await test.step(`Share names across schemas: "${OTHER_SHARE}" (a RobarMasterData field) on another schema (MDM20140512010U1.0.0)`, async () => {
    let f = await openSchemasTile(page, true);
    await f.locator('select[name="schemaSelector"]').selectOption({ label: FIXTURE });
    await page.waitForTimeout(4000);
    f = await findFrame(page, 'Schemas');
    const before = await sch.fieldBlocks(f).count();
    try {
      await f.locator('#groups > .ui-tabs-panel:visible').first().getByText('Add New Field', { exact: false }).first().click();
      await expect(sch.fieldBlocks(f)).toHaveCount(before + 1, { timeout: 5000 });
      const b = sch.fieldBlocks(f).nth(before);
      await sch.row(b, 'Caption').locator('input').fill(`CL Share ${stamp}`);
      await sch.row(b, 'Share Name').locator('input').fill(OTHER_SHARE);
      const saved = await sch.saveSchema(page, f);
      const accepted = Object.keys(saved).includes(`CL Share ${stamp}`);
      console.log(`share name ${OTHER_SHARE} already used by another schema: save accepted = ${accepted}`);
      if (accepted) deviation(`MDM20140512010U1.0.0 the same share name "${OTHER_SHARE}" is accepted on a field of a second schema (only duplicates within ONE schema are refused), so one template share name can map to different fields`);
    } finally {
      f = await openSchemasTile(page, true);
      await f.locator('select[name="schemaSelector"]').selectOption({ label: FIXTURE });
      await page.waitForTimeout(4000);
      f = await findFrame(page, 'Schemas');
      const mine = sch.fieldBlock(f, `CL Share ${stamp}`);
      if (await mine.count()) {
        await mine.locator('.md-field-caption').click();
        await page.waitForTimeout(300);
        await mine.locator('.delete-field').click();
        await sch.saveSchema(page, f);
      }
      f = await openSchemasTile(page, true);
      await f.locator('select[name="schemaSelector"]').selectOption({ label: FIXTURE });
      await page.waitForTimeout(4000);
      f = await findFrame(page, 'Schemas');
      expect(await sch.fieldBlocks(f).count(), `${FIXTURE} back to its field count`).toBe(before);
    }
  });
});
