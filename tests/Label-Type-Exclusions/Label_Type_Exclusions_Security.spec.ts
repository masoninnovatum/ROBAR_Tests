// Label Type Exclusions security: the tile "Label Type Excl." is gated by the process Maintain_LabelType_Exclusions ("Allows a user to edit label type exclusions", seed MenuWebIntegration + Processes).
// Observed: tile visibility, and whether the legacy page itself (`Innovatum/ROBAR/management/LabelTypeExclusion/ExclusionEdit.aspx`, no process attribute in the code behind: it derives from
// LoggedInParent) is served to a logged-in user who lacks the process. Fixture operator CLPROp01 (group CLPRGrp = Login_WebMenu + ResetPassword_Option, seed password) logs in in a SECOND browser
// context after each group change; the seed user toggles CLPRGrp (only CL* is ever written) and restores it in `finally`. NOTHING is ticked or changed on the page by this spec.
// Confirmed live 2026-11-03 on TST703 (headless).

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, login, loginAs, BASE_URL } from '../support/robar';
import * as sec from '../support/security';
import { OP, OP_GROUP, OP_PROCESSES } from '../Password-Management/pr-fixtures';

test.use({ actionTimeout: 20_000 });

const PROCESS = 'Maintain_LabelType_Exclusions';
const PAGE = new URL(BASE_URL).origin + '/Innovatum/ROBAR/management/LabelTypeExclusion/ExclusionEdit.aspx';

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

test('Label Type Exclusions: tile follows Maintain_LabelType_Exclusions; the page is served by URL without it', async ({ page, browser }) => {
  test.setTimeout(600_000);
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

  try {
    await test.step('Without the process: no tile; the page by URL', async () => {
      await setGroup([]);
      await asOperator(async (p) => {
        expect((await p.locator('body').innerText()).replace(/\s+/g, ' ')).not.toContain('Label Type Excl.');
        await p.goto(PAGE);
        await p.waitForTimeout(3000);
        const served = (await p.locator('select[id$=lbWorkstations]').count()) > 0;
        const text = (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160);
        console.log(`${OP} without ${PROCESS} opens the page by URL: workstation list shown = ${served} | ${text}`);
        // positive finding: the page itself is refused (IIS "The resource cannot be found", HTTP 404) for a user without the process, the seed user gets it by the same URL
        expect(served, 'the exclusion page is not served without the process').toBe(false);
        expect(text).toContain('The resource cannot be found');
        if (served) deviation(`the tile is gated by ${PROCESS} but ExclusionEdit.aspx is served (workstation list and the exclusion grid) to any logged-in user who types its URL: the process only hides the menu entry`);
      });
    });

    await test.step('With the process: the tile opens the page', async () => {
      await setGroup([PROCESS]);
      await asOperator(async (p) => {
        await expect(p.getByRole('button', { name: 'Label Type Excl.', exact: true })).toBeVisible();
        await p.getByRole('button', { name: 'Label Type Excl.', exact: true }).click();
        let f = null as import('@playwright/test').Frame | null;
        for (let i = 0; i < 30 && !f; i++) {
          f = p.frames().find((x) => /LabelTypeExclusion/i.test(x.url())) ?? null;
          if (!f) await p.waitForTimeout(500);
        }
        expect(f, 'the exclusion page frame').toBeTruthy();
        await f!.locator('select[id$=lbWorkstations]').waitFor({ timeout: 20_000 });
        await expect(f!.locator('body')).toContainText('Label Type Exclusion Maintenance');
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
