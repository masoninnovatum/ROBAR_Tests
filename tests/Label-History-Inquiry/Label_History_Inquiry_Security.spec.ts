// Label History Inquiry security: LHI.190725.F.1.2 (the module is unavailable without the Label_History process) plus what the code adds: LH_ViewDetail (View Detail, `[Authorize(Roles = "LH_ViewDetail")]` on
// GetLabelHistoryInquiryDetails) and LH_Reconcile (Reconcile mode, not in ValMaster). Fixture operator CLPROp01 (group CLPRGrp = Login_WebMenu + ResetPassword_Option, seed password) logs in in a SECOND
// browser context after each group change; the seed user toggles CLPRGrp (only CL* is ever written) and restores it in `finally`. READ-ONLY on the print data: a real print (test-data/phi-fixture.json) is
// looked up. Also probes the label image URL without a session. Confirmed live 2026-11-03 on TST703 (headless).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { PASSWORD, login, loginAs, openMenuItem, findFrame, BASE_URL } from '../support/robar';
import * as sec from '../support/security';
import { OP, OP_GROUP, OP_PROCESSES } from '../Password-Management/pr-fixtures';

test.use({ actionTimeout: 20_000 });

const origin = new URL(BASE_URL).origin;
const ITEM = 'MBBQA8457561';
const LOT = 'CLPTP560850L';
const PRINT_ID = 'PID_13F1726FDCD34E47B7954CD808B653BF';
const PAGE_URL = `${origin}/InnoPages/LabelHistory/LabelHistoryInquiry?sp=GetLabelHistoryInquiryData&PageMode=Detail`;
const DETAIL_URL = `${origin}/InnoPages/LabelHistory/GetLabelHistoryInquiryDetails?storedProcedure=GetLabelHistoryInquiryData&printId=${PRINT_ID}`;
const IMAGE_URL = `${origin}/InnoPages/LabelHistory/GetLabelImage?printId=${PRINT_ID}`;

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

async function openPageAs(p: Page): Promise<Frame> {
  await p.getByRole('button', { name: 'Label History Inquiry', exact: true }).click();
  const f = await findFrame(p, 'LabelHistory');
  await f.locator('#itemnumber').waitFor({ timeout: 30_000 });
  await p.waitForTimeout(2000);
  return f;
}

test('Label History Inquiry security: Label_History process, LH_ViewDetail and the label image URL', async ({ page, browser }) => {
  test.setTimeout(900_000);
  await login(page);
  const setGroup = async (extra: string[]) => {
    await page.goto(page.url().replace(/Innovatum\/.*/i, 'Innovatum/WebMenu/MainMenu.aspx'));
    await sec.setGroupProcesses(page, OP_GROUP, [...OP_PROCESSES, ...extra]);
  };
  const asOperator = async (check: (p: Page) => Promise<void>) => {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    try {
      await loginAs(p, OP, PASSWORD);
      await p.waitForTimeout(2000);
      await check(p);
    } finally {
      await ctx.close();
    }
  };

  await test.step('The label image is served WITHOUT a session (probe with the seed user\'s print id)', async () => {
    const anon = await browser.newContext();
    try {
      const r = await anon.request.get(IMAGE_URL, { maxRedirects: 0, failOnStatusCode: false });
      const type = r.headers()['content-type'];
      const size = (await r.body()).length;
      console.log(`anonymous GET GetLabelImage: HTTP ${r.status()} ${type} ${size} bytes`);
      const page2 = await anon.request.get(PAGE_URL, { maxRedirects: 0, failOnStatusCode: false });
      const det = await anon.request.get(DETAIL_URL, { maxRedirects: 0, failOnStatusCode: false });
      console.log(`anonymous GET page: HTTP ${page2.status()} | detail: HTTP ${det.status()}`);
      expect([301, 302, 401, 403], 'the inquiry page needs a login').toContain(page2.status());
      expect([301, 302, 401, 403], 'the detail dialog needs a login').toContain(det.status());
      if (r.status() === 200 && /image/.test(type ?? '')) deviation('U.5 / F.5.2 the printed label image of a print id (InnoPages/LabelHistory/GetLabelImage?printId=...) is returned to a request with NO session (HTTP 200, image/jpeg) while the page and the detail pop-up require a login and LH_ViewDetail');
    } finally {
      await anon.close();
    }
  });

  try {
    await test.step('Without Label_History: no tile, the page is refused by URL (F.1.2)', async () => {
      await setGroup([]);
      await asOperator(async (p) => {
        expect((await p.locator('body').innerText()).replace(/\s+/g, ' ')).not.toContain('Label History Inquiry');
        const r = await p.request.get(PAGE_URL, { maxRedirects: 0, failOnStatusCode: false });
        const text = await r.text();
        console.log(`${OP} without Label_History: page HTTP ${r.status()}, inquiry rendered = ${text.includes('btnRetrieveLabelHistory')}`);
        expect(text.includes('btnRetrieveLabelHistory'), 'the inquiry is not served without the process').toBe(false);
      });
    });

    await test.step('With Label_History only: the page works, View Detail is disabled and its endpoint refuses (LH_ViewDetail)', async () => {
      await setGroup(['Label_History']);
      await asOperator(async (p) => {
        const f = await openPageAs(p);
        await f.fill('#itemnumber', ITEM);
        await f.fill('#lotnumber', LOT);
        await f.click('#btnRetrieveLabelHistory');
        await p.waitForTimeout(5000);
        const rows = await f.locator('tr.jqgrow').allInnerTexts();
        console.log('rows for the operator:', rows.length);
        expect(rows.length, 'the search itself works with Label_History').toBe(1);
        expect(await f.locator('.ui-dialog:visible').count(), 'no automatic pop-up without LH_ViewDetail').toBe(0);
        await f.locator('tr.jqgrow').first().getByText('Actions').first().click();
        await p.waitForTimeout(600);
        const item = f.locator('ul:visible li a', { hasText: 'View Detail' }).first();
        const disabled = await item.evaluate((e) => e.classList.contains('ui-state-disabled') || !!e.closest('.ui-state-disabled') || e.getAttribute('aria-disabled') === 'true');
        console.log('View Detail disabled for the operator:', disabled);
        expect(disabled).toBe(true);
        await p.keyboard.press('Escape');
        const det = await p.request.get(DETAIL_URL, { maxRedirects: 0, failOnStatusCode: false });
        const body = await det.text();
        console.log(`${OP} direct GET detail endpoint without LH_ViewDetail: HTTP ${det.status()}, contains the label data = ${body.includes('I_Num')}`);
        expect(body.includes('I_Num') || body.includes('Column Name'), 'the detail data is not served without LH_ViewDetail').toBe(false);
        const img = await p.request.get(IMAGE_URL, { maxRedirects: 0, failOnStatusCode: false });
        console.log(`${OP} GET image without LH_ViewDetail: HTTP ${img.status()}`);
      });
    });

    await test.step('With LH_ViewDetail: the single record opens its detail by itself', async () => {
      await setGroup(['Label_History', 'LH_ViewDetail']);
      await asOperator(async (p) => {
        const f = await openPageAs(p);
        await f.fill('#itemnumber', ITEM);
        await f.fill('#lotnumber', LOT);
        await f.click('#btnRetrieveLabelHistory');
        await p.waitForTimeout(6000);
        await expect(f.locator('.ui-dialog:visible .ui-dialog-title')).toHaveText('View Detail', { timeout: 10_000 });
        const d = p.frames().filter((x) => /GetLabelHistoryInquiryDetails/.test(x.url())).pop()!;
        expect((await d.locator('body').innerText()).replace(/\s+/g, ' ')).toContain(`I_Num ${ITEM}`);
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

void openMenuItem;
