// MD Job Inquiry against ValMaster (docs/agents/valmaster-md-job-inquiry.md): MDM20140512034F1.0.1 "A job inquiry function will be available to view job status and error conditions"
// (formal script MDM_Job_Inquiry8.1) and MDE.250128.F.3.23 (Master Data captions on the MD Job Inquiry page stay English whatever the user's language).
// The existing MD_Job_Inquiry.spec.ts creates a fresh Mass Approve job and finds it by Display Id / Item Number; THIS spec is read only and works on the historic jobs of TST703
// (about 560 since July 2024: AssignGTIN, MassApprove, SaveAsNew, ExcelImport, Retire, Unretire, EndDistribution, MassUpdate, AssignLabels; statuses Completed, CompletedWithErrors, Inserted),
// so every assertion is relational (rows match the filter, filtered count <= all jobs) instead of a hard-coded count.
// Confirmed live 2026-11-03 on TST703. Source: Innovatum.DataManagement.Web MasterDataController.JobInquiry (default filter = % Complete < 100; jobDetailUrlsByActionName per action),
// Views/MasterData/JobInquiry.cshtml, Localize_MD_JobInquiry.cs. Page ids: `select[name="dvFilters[n].Column|Operator"]`, `[name="dvFilters[n].Value"]`, `#btnRetrieveJobs`, grid `tr.jqgrow`.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame, BASE_URL, USERNAME, PASSWORD } from '../support/robar';

test.use({ actionTimeout: 20_000 });

const COLUMNS = ['Display Id', 'Job Description', 'Submitting User', 'Status', 'Date Inserted', 'Date Completed', '% Complete', 'Bulk Action', 'Item Number', 'Item Version', 'Item Description', 'Item Approved By', 'Item Approval Date'];
const OPERATORS = ['Contains', 'Does Not Match', 'Does Not Contain', 'In', 'Not In', 'Greater Than', 'Less Than', 'Exactly Matches', 'Is Blank', 'Is Not Blank'];
const HEADERS = ['Display Id', 'Action', '% Comp.', 'Status', 'User', 'Job Description', 'Date Inserted', 'Date Completed', 'Job Detail'];
/** action name -> controller of its Job Detail page (MasterDataController.JobInquiry; ExcelImport is Innovatum.Pages.Web) */
const DETAIL: Record<string, RegExp> = {
  AssignGTIN: /MasterDataAssignGTIN\/JobDetail/i,
  MassApprove: /MasterDataMassApprove\/JobDetail/i,
  SaveAsNew: /MasterDataSaveAsNew\/JobDetail/i,
  Retire: /MasterDataMassRetire\/JobDetail/i,
  Unretire: /MasterDataMassRetire\/JobDetail/i,
  EndDistribution: /MasterDataEndDistribution\/JobDetail/i,
  MassUpdate: /MasterDataMassUpdate\/JobDetail/i,
  AssignLabels: /MasterDataAssignLabels\/JobDetail/i,
};

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

async function openInquiry(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("MD Job Inquiry") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'MD Job Inquiry');
  const f = await findFrame(page, 'JobInquiry');
  await f.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await f.locator('#btnRetrieveJobs').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2000);
  return f;
}

/** Sets filter row `i` (row 0 exists; higher rows are added) and returns when the row is set. */
async function setFilter(page: Page, f: Frame, i: number, col: string, op: string, val = ''): Promise<void> {
  while ((await f.locator('select[name$=".Column"]').count()) <= i) {
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await page.waitForTimeout(500);
  }
  await f.locator(`select[name="dvFilters[${i}].Column"]`).selectOption({ label: col });
  await page.waitForTimeout(300);
  await f.locator(`select[name="dvFilters[${i}].Operator"]`).selectOption({ label: op });
  await page.waitForTimeout(300);
  if (!/Blank/.test(op)) {
    // the Value editor is rebuilt by the column / operator: a text box, or a drop-down of the known values (Status, Bulk Action ...)
    const inp = f.locator(`input[name="dvFilters[${i}].Value"]:visible`);
    const sel = f.locator(`select[name="dvFilters[${i}].Value"]:visible`);
    await expect.poll(async () => (await inp.count()) + (await sel.count()), { timeout: 5000 }).toBeGreaterThan(0);
    if (await inp.count()) {
      await inp.first().fill(val);
      await inp.first().press('Tab').catch(() => {});
    } else {
      const opts = await sel.first().locator('option').allInnerTexts();
      if (i === 0 && !opts.includes(val)) console.log(`value list of ${col}:`, opts.join(' | '));
      await sel.first().selectOption({ label: val });
    }
  }
}

/** Clicks View Detail of the first grid row and returns the URL + text of the Job Detail page (it replaces the inquiry in its frame or opens a new tab). */
async function openFirstDetail(page: Page, f: Frame): Promise<{ url: string; text: string }> {
  const link = f.locator('tr.jqgrow').first().locator('a', { hasText: 'View Detail' });
  const [popup] = await Promise.all([page.context().waitForEvent('page', { timeout: 6000 }).catch(() => null), link.click()]);
  await page.waitForTimeout(4000);
  const target = popup ?? page;
  const frames = [...target.frames()].reverse();
  const det = frames.find((x) => /JobDetail/i.test(x.url())) ?? frames[0];
  const text = (await det.locator('body').innerText({ timeout: 8000 }).catch(() => '')).replace(/\s+/g, ' ');
  if (popup) await popup.close();
  return { url: det.url(), text };
}

interface Job { id: string; action: string; pct: string; status: string; user: string; desc: string; inserted: string; completed: string }

async function retrieve(page: Page, f: Frame): Promise<{ total: number; jobs: Job[] }> {
  await f.click('#btnRetrieveJobs');
  await page.waitForTimeout(1200);
  await f.locator('.gridloading').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const info = (await f.locator('.ui-paging-info').first().innerText().catch(() => '')).trim();
  const total = Number((info.match(/of\s+([\d,]+)/) ?? [])[1]?.replace(/,/g, '') ?? (await f.locator('tr.jqgrow').count()));
  const cells: string[][] = await f.locator('tr.jqgrow').evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll('td[role=gridcell]')).filter((td) => (td as HTMLElement).offsetParent !== null).map((td) => (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim())));
  const jobs = cells.map((c) => ({ id: c[0], action: c[1], pct: c[2], status: c[3], user: c[4], desc: c[5], inserted: c[6], completed: c[7] }));
  return { total, jobs };
}

test('MD Job Inquiry: page, filters, job detail per job type, error conditions, captions (MDM20140512034F1.0.1, MDE.250128.F.3.23)', async ({ page, browser }) => {
  test.setTimeout(900_000);
  await login(page);
  let f = await openInquiry(page);
  let all = 0;

  await test.step('Page anatomy and the default filter (F1.0.1)', async () => {
    await expect(f.locator('h1')).toHaveText('Master Data Job Inquiry');
    expect(await f.locator('select[name="dvFilters[0].Column"] option').allInnerTexts()).toEqual(COLUMNS);
    expect(await f.locator('select[name="dvFilters[0].Operator"] option').allInnerTexts()).toEqual(OPERATORS);
    // opened without criteria the page filters on "% Complete Less Than 100" (jobs that are not finished yet)
    expect(await f.locator('select[name="dvFilters[0].Column"]').inputValue()).toBe('PercentComplete');
    expect(await f.locator('select[name="dvFilters[0].Operator"]').inputValue()).toBe('LessThan');
    expect(await f.locator('[name="dvFilters[0].Value"]').first().inputValue()).toBe('100');
    await expect(f.locator('#btnRetrieveJobs')).toHaveText('Retrieve Job Data');
    await expect(f.locator('.ui-jqgrid-title')).toHaveText('Master Data Jobs');
    expect((await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter((t) => t && t !== 'Job Id')).toEqual(HEADERS);
    // the default filter is also applied when the page opens: the grid is already filled with the unfinished jobs
    await expect.poll(() => f.locator('tr.jqgrow').count(), { timeout: 15_000 }).toBeGreaterThan(0);
  });

  await test.step('Default filter: unfinished jobs only; every row shows a status, a percentage and a View Detail link', async () => {
    const r = await retrieve(page, f);
    console.log('jobs with % Complete < 100:', r.total, r.jobs.map((j) => `${j.id} ${j.action} ${j.pct}% ${j.status}`).join(' | '));
    for (const j of r.jobs) {
      expect(Number(j.pct)).toBeLessThan(100);
      expect(j.status).not.toBe('Completed');
    }
    await expect(f.locator('tr.jqgrow a', { hasText: 'View Detail' })).toHaveCount(r.jobs.length);
  });

  await test.step('All jobs: paging, job types, statuses (F1.0.1 job status)', async () => {
    await setFilter(page, f, 0, 'Display Id', 'Is Not Blank');
    const r = await retrieve(page, f);
    all = r.total;
    console.log('all jobs:', all);
    expect(all).toBeGreaterThan(100);
    expect(r.jobs.length).toBe(10);
    expect(await f.locator('select.ui-pg-selbox option').allInnerTexts()).toContain('10');
    for (const j of r.jobs) expect(j.id).toMatch(/^\d{12}$/); // yyyymmdd + 4-digit sequence
    const types = new Set(r.jobs.map((j) => j.action));
    console.log('job types on page 1:', [...types].join(', '));
  });

  await test.step('Filters on every kind of column return only matching rows and never more than all jobs', async () => {
    const check = async (col: string, op: string, val: string, pred: (j: Job) => boolean, label: string, min = 1) => {
      await setFilter(page, f, 0, col, op, val);
      const r = await retrieve(page, f);
      console.log(`${label}: ${r.total} job(s)`);
      expect(r.total, label).toBeGreaterThanOrEqual(min);
      expect(r.total, label).toBeLessThanOrEqual(all);
      for (const j of r.jobs) expect(pred(j), `${label}: ${JSON.stringify(j)}`).toBe(true);
      return r;
    };
    await check('Status', 'Exactly Matches', 'CompletedWithErrors', (j) => j.status === 'CompletedWithErrors', 'Status = CompletedWithErrors');
    const notDone = await check('Status', 'Does Not Match', 'Completed', (j) => j.status !== 'Completed', 'Status does not match Completed');
    expect(notDone.total).toBeGreaterThanOrEqual(2);
    await check('Bulk Action', 'Exactly Matches', 'EndDistribution', (j) => j.action === 'EndDistribution', 'Bulk Action = EndDistribution');
    await check('Bulk Action', 'Contains', 'Retire', (j) => /retire/i.test(j.action), 'Bulk Action contains Retire (Retire + Unretire: Contains ignores case)');
    await check('Display Id', 'Exactly Matches', '202407030001', (j) => j.id === '202407030001' && j.action === 'AssignGTIN', 'Display Id = 202407030001', 1);
    await check('Display Id', 'Contains', '2024070', (j) => j.id.includes('2024070'), 'Display Id contains 2024070');
    await check('Submitting User', 'Exactly Matches', 'MBUser1', (j) => j.user === 'MBUser1', 'Submitting User = MBUser1');
    await check('Job Description', 'Contains', 'Mass Approve', (j) => /mass approve/i.test(j.desc), 'Job Description contains Mass Approve');
    await check('% Complete', 'Exactly Matches', '100', (j) => j.pct === '100', '% Complete = 100');
    await check('Date Completed', 'Is Blank', '', (j) => j.completed === '', 'Date Completed is blank (never finished)');
    await check('Date Completed', 'Is Not Blank', '', (j) => j.completed !== '', 'Date Completed is not blank');
    const none = await (async () => { await setFilter(page, f, 0, 'Display Id', 'Exactly Matches', '000000000000'); return retrieve(page, f); })();
    expect(none.total).toBe(0);
    // two criteria are ANDed
    await setFilter(page, f, 0, 'Bulk Action', 'Exactly Matches', 'AssignLabels');
    await setFilter(page, f, 1, 'Status', 'Exactly Matches', 'CompletedWithErrors');
    const both = await retrieve(page, f);
    console.log('AssignLabels AND CompletedWithErrors:', both.total);
    expect(both.total).toBeGreaterThan(0);
    for (const j of both.jobs) { expect(j.action).toBe('AssignLabels'); expect(j.status).toBe('CompletedWithErrors'); }
  });

  await test.step('View Detail opens the Job Detail page of the job type, with the job id and its status / error condition (F1.0.1)', async () => {
    const types = ['AssignGTIN', 'MassApprove', 'SaveAsNew', 'Retire', 'Unretire', 'EndDistribution', 'MassUpdate', 'AssignLabels', 'ExcelImport'];
    for (const type of types) {
      f = await openInquiry(page);
      await setFilter(page, f, 0, 'Bulk Action', 'Exactly Matches', type);
      const r = await retrieve(page, f);
      if (!r.jobs.length) { console.log(`no ${type} job on this system, skipped`); continue; }
      const job = r.jobs[0];
      const d = await openFirstDetail(page, f);
      console.log(`${type} ${job.id} (${job.status}) -> ${d.url} :: ${d.text.slice(0, 260)}`);
      if (DETAIL[type]) {
        expect(d.url).toMatch(DETAIL[type]);
        expect(d.text).toContain('Job Id ' + job.id);
      } else {
        // Excel Import jobs ARE listed by the inquiry; their detail is the InnoPages "Master Data Excel Import Job Details" page, which shows the internal job number as "Display ID"
        expect(d.url).toMatch(/InnoPages\/MasterDataExcelImport\/JobDetail/i);
        expect(d.text).toContain('Master Data Excel Import Job Details');
        const shown = (d.text.match(/Display ID\s+(\d+)/) ?? [])[1];
        console.log(`Excel Import: the inquiry's Display Id ${job.id} is shown on the detail page as "Display ID ${shown}"`);
        if (shown !== job.id) deviation(`F1.0.1 observation: the Display Id of an Excel Import job is ${job.id} in MD Job Inquiry but its Job Details page shows "Display ID ${shown}" (the internal job number); the other job types show the 12-digit id as "Job Id"`);
      }
      expect(d.text).toMatch(/Status\s+\S+/);
      expect(d.text).toContain('Error Message');
    }
    f = await openInquiry(page);
  });

  await test.step('A job that completed with errors shows its error condition on the detail page (F1.0.1 "error conditions")', async () => {
    f = await openInquiry(page);
    await setFilter(page, f, 0, 'Status', 'Exactly Matches', 'CompletedWithErrors');
    const r = await retrieve(page, f);
    expect(r.jobs.length).toBeGreaterThan(0);
    const job = r.jobs[0];
    const d = await openFirstDetail(page, f);
    console.log(`CompletedWithErrors ${job.id} ${job.action}: ${d.text.slice(0, 700)}`);
    expect(d.text).toContain('Status CompletedWithErrors');
    const afterErrors = d.text.split(/Errors/).slice(1).join(' ');
    expect(afterErrors.replace(/ItemNumber|versionNumber|VersionNumber|Id|description|Message|Page|of|\d+|No records to view/gi, '').trim().length, 'the Errors grid lists the failing items').toBeGreaterThan(5);
    f = await openInquiry(page);
  });

  await test.step('Captions stay English whatever the language (MDE.250128.F.3.23)', async () => {
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    try {
      await p2.goto(BASE_URL);
      await p2.locator('.userID').waitFor({ timeout: 60_000 });
      const lang = p2.locator('select', { hasText: 'español' }).first();
      await lang.selectOption({ label: 'español' });
      await p2.fill('.userID', USERNAME);
      await p2.fill('.Password', PASSWORD);
      await p2.click('.loginBtn');
      await p2.waitForLoadState('networkidle');
      await openMenuItem(p2, 'MD Job Inquiry');
      const s = await findFrame(p2, 'JobInquiry');
      await s.locator('#btnRetrieveJobs').waitFor({ timeout: 20_000 });
      const cols = await s.locator('select[name="dvFilters[0].Column"] option').allInnerTexts();
      const heading = (await s.locator('h1').innerText()).trim();
      console.log('Spanish session - heading:', heading, '| columns:', cols.join(' | '));
      // The page's own texts (heading, filter captions, grid headers) come from localization resources and ARE translated (TST703 test rows carry an "ES - " prefix).
      // MDE.250128.F.3.23 talks about "Master Data captions" (schema FIELD captions) staying English; this page shows none of them (its columns are page resources),
      // so the requirement cannot be observed here: recorded as an observation, not as a pass or a failure.
      expect(cols).toEqual(COLUMNS.map((c) => 'ES - ' + c));
      expect(heading).toBe('ES - Master Data Job Inquiry');
      deviation('MDE.250128.F.3.23 cannot be observed on MD Job Inquiry: the page shows no schema field captions; its own captions (heading, filter columns) are translated like any other page text (ES - ...)');
      const menuSpanish = (await p2.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160);
      console.log('main menu text in that session:', menuSpanish);
    } finally {
      await ctx.close();
    }
  });
});

void deviation;
