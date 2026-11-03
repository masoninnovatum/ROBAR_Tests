// MD Job Inquiry security gating: process MD_JobInquiry_Option (tile + page, `[CustomAuthorize(Roles = "MD_JobInquiry_Option")]` on MasterDataController.JobInquiry) and the schema security
// that limits the SEARCH RESULTS ("Search results are limited due to Schema Security.", model `SchemasDisallowedBySecurity`). Requirement context: MDM20140512034F1.0.1 (docs/agents/valmaster-md-job-inquiry.md).
// Confirmed live 2026-11-03 on TST703. Fixture operator CLPROp01 (group CLPRGrp = Login_WebMenu + ResetPassword_Option, seed password) logs in in a SECOND browser context after every group change
// (roles load at login); the seed user toggles CLPRGrp through Security Management (only CL* is ever written) and restores it in `finally`.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { PASSWORD, login, loginAs, openMenuItem, findFrame } from '../support/robar';
import * as sec from '../support/security';
import { OP, OP_GROUP, OP_PROCESSES } from '../Password-Management/pr-fixtures';

test.use({ actionTimeout: 20_000 });

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

async function allJobsTotal(page: Page, f: Frame): Promise<number> {
  await f.locator('select[name="dvFilters[0].Column"]').selectOption({ label: 'Display Id' });
  await page.waitForTimeout(300);
  await f.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: 'Is Not Blank' });
  await f.click('#btnRetrieveJobs');
  await page.waitForTimeout(1200);
  await f.locator('.gridloading').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const info = (await f.locator('.ui-paging-info').first().innerText().catch(() => '')).trim();
  const m = info.match(/of\s+([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : await f.locator('tr.jqgrow').count();
}

test('MD Job Inquiry security: MD_JobInquiry_Option and schema security', async ({ page, browser }) => {
  test.setTimeout(900_000);
  await login(page);
  // the seed user (all processes) sees every job and no schema-security warning
  let seedTotal = 0;
  await test.step('Reference: the seed user sees all jobs and no schema-security warning', async () => {
    await openMenuItem(page, 'MD Job Inquiry');
    const f = await findFrame(page, 'JobInquiry');
    await f.locator('#btnRetrieveJobs').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(2000);
    seedTotal = await allJobsTotal(page, f);
    console.log('seed user jobs:', seedTotal);
    expect(seedTotal).toBeGreaterThan(100);
    await expect(f.locator('.message-warning')).toHaveCount(0);
    await page.locator('li.ui-tabs-tab:has-text("MD Job Inquiry") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  });

  const setGroup = async (extra: string[]) => {
    await page.goto(page.url().replace(/Innovatum\/.*/i, 'Innovatum/WebMenu/MainMenu.aspx'));
    await sec.setGroupProcesses(page, OP_GROUP, [...OP_PROCESSES, ...extra]);
  };
  const asOperator = async (check: (p: Page) => Promise<void>) => {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    try {
      await loginAs(p, OP, PASSWORD);
      await check(p);
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('Without MD_JobInquiry_Option: no tile, and the page itself is refused', async () => {
      await setGroup([]);
      await asOperator(async (p) => {
        const body = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
        expect(body).not.toContain('MD Job Inquiry');
        const origin = new URL(p.url()).origin;
        const r = await p.request.get(`${origin}/InnovatumMDM/MasterData/JobInquiry?LinkedFromWebmenu=1`, { maxRedirects: 0 });
        const text = (await r.text()).replace(/\s+/g, ' ');
        console.log('direct GET without the process: HTTP', r.status(), '| renders the inquiry:', text.includes('btnRetrieveJobs'), '|', text.slice(0, 160));
        expect(text.includes('btnRetrieveJobs'), 'the inquiry page is not served without the process').toBe(false);
      });
    });

    await test.step('With MD_JobInquiry_Option only: the tile opens the page, results are limited by schema security', async () => {
      await setGroup(['MD_JobInquiry_Option']);
      await asOperator(async (p) => {
        await expect(p.locator('button.menuIcon:has-text("MD Job Inquiry")')).toHaveCount(1);
        await openMenuItem(p, 'MD Job Inquiry');
        const f = await findFrame(p, 'JobInquiry');
        await f.locator('#btnRetrieveJobs').waitFor({ timeout: 30_000 });
        await p.waitForTimeout(2500);
        const total = await allJobsTotal(p, f);
        const warning = (await f.locator('.message-warning').allInnerTexts()).join(' ').replace(/\s+/g, ' ').trim();
        console.log(`${OP}: ${total} of ${seedTotal} jobs, warning: "${warning}"`);
        expect(total).toBeLessThan(seedTotal); // no SCH_* process: the schema-bound jobs are silently left out
        expect(warning).toBe('Search results are limited due to Schema Security.');
        if (total === 0) deviation(`observation: a user with the inquiry process but no SCH_* schema process sees 0 of ${seedTotal} jobs (every job is tied to a schema, Excel Import jobs included) with only a yellow notice and an empty grid`);
      });
    });
  } finally {
    try {
      await setGroup([]);
    } catch (e) {
      console.log('RESTORE FAILED: set group CLPRGrp back to Login_WebMenu + ResetPassword_Option in Security Management:', String(e).slice(0, 300));
    }
  }
});
