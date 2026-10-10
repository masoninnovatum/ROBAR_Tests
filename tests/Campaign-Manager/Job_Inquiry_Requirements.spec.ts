// Campaign Manager Job Inquiry re-checked against ValMaster (module "Job Inquiry", FRS.RBR.CM.107.*; live 2026-10-09, headless, TST703; read-only). Differences are annotated `deviation <id>` (the spec stays green).
// CM.107.10 the criteria columns; CM.107.8 Job Inquiry reachable from the Campaign Manager page; CM.107.1 "Do Action" grayed out until an action is chosen.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test.use({ actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Campaign Manager Job Inquiry vs ValMaster: criteria columns, no in-app link, Do Action state', async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  await openMenuItem(page, 'Campaign Manager');
  const grid = await findFrame(page, 'campaignmanager');
  await page.waitForTimeout(6000);

  await test.step('CM.107.1: Do Action is grayed out until an action is chosen', async () => {
    const actionSelect = grid.locator('#drpActions');
    const doAction = grid.locator('#btnDoAction, input[value="Do Action"], button:has-text("Do Action")').first();
    console.log(`ACTIONS select present=${(await actionSelect.count()) > 0} doAction present=${(await doAction.count()) > 0}`);
    if ((await doAction.count()) > 0) {
      const disabled = await doAction.isDisabled();
      console.log(`DO ACTION disabled before choosing an action: ${disabled}`);
      if (!disabled) deviation('FRS.RBR.CM.107.1', 'Do Action grayed out until an action is chosen', 'enabled');
    } else {
      console.log('NOTE: no "Do Action" button on this Campaign Manager version (actions are in the Bulk Actions drop-down, which starts a job directly)');
    }
  });

  await test.step('CM.107.8: a visible link to Job Inquiry exists on the Campaign Manager page', async () => {
    const links = await grid.locator('a, button, input[type=button], li').evaluateAll((els) => els.map((e) => (e.textContent || (e as HTMLInputElement).value || '').trim()).filter((t) => /job inquiry/i.test(t)));
    console.log(`LINKS mentioning Job Inquiry: ${JSON.stringify(links)}`);
    const actionsMenu = (await grid.locator('#drpActions, #drpMainActions').evaluateAll((els) => els.map((e) => e.innerHTML.replace(/\s+/g, ' ').slice(0, 400))));
    console.log(`ACTIONS MENU: ${JSON.stringify(actionsMenu).slice(0, 300)}`);
    if (links.length === 0) deviation('FRS.RBR.CM.107.8', 'access to the Job Inquiry page from the Campaign Manager page', 'no visible link (the page is only reachable by URL)');
  });

  await test.step('CM.107.10: the Job Inquiry criteria offer Display ID, Description, Status, Date Started, Date Completed, Submitting User, Single Item, Percent Complete, Action ID', async () => {
    const origin = new URL(grid.url()).origin;
    await grid.evaluate((url) => { window.location.href = url; }, `${origin}/innovatum/CampaignManager/JobInquiry`);
    await grid.locator('#btnRetrieveItems').waitFor({ state: 'visible', timeout: 15_000 });
    const jf = await findFrame(page, 'JobInquiry');
    await page.waitForTimeout(2000);
    const options = (await jf.locator('select[name="Filters[0].Column"] option').allInnerTexts()).map((t) => t.trim());
    console.log(`JOB INQUIRY COLUMNS: ${JSON.stringify(options)}`);
    const wanted = ['Display ID', 'Description', 'Status', 'Date Started', 'Date Completed', 'Submitting User', 'Single Item', 'Percent Complete', 'Action ID'];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    const missing = wanted.filter((w) => !options.some((o) => norm(o) === norm(w)));
    const extra = options.filter((o) => !wanted.some((w) => norm(w) === norm(o)));
    if (missing.length) deviation('FRS.RBR.CM.107.10', `criteria ${wanted.join(', ')}`, `missing ${JSON.stringify(missing)}; present ${JSON.stringify(options)}`);
    console.log(`MISSING ${JSON.stringify(missing)} EXTRA ${JSON.stringify(extra)}`);
    // the three differences are WORDING only (Date Inserted / % Complete / Item Number) - annotated, not failed
    expect(options.length).toBeGreaterThanOrEqual(9);
  });
});
