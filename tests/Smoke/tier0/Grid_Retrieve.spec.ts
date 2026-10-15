// SMOKE TIER 0 (headless, read-only): every data grid of the main modules answers "Retrieve Data" - the grid fills (or says "No records to view") and no error appears.
// Generic on purpose: open the module, remove saved criteria rows (the page restores them; NOT #btnReset, which crashes the renderer on Dynamic UI pages), click Retrieve, wait for rows.
// MUST_HAVE_ROWS modules always hold data on TST703 (a fixture exists), so zero rows there is a failure; the others may legitimately be empty.
// Each module is its own test.step with soft assertions: one broken grid does not hide the others.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login } from '../../support/robar';
import * as mdm from '../../support/master-data';

type Grid = {
  tile: string;
  fragment: string; // lower-case URL fragment of the module's frame
  button?: string; // retrieve button selector (default #btnRetrieveData)
  rowSel?: string; // grid row selector (default tr.jqgrow)
  mustHaveRows?: boolean;
  schema?: string; // Master Data pages need a schema picked before the filter area shows
};

const GRIDS: Grid[] = [
  { tile: 'Template Management', fragment: 'templatemanagement/management', mustHaveRows: true },
  { tile: 'Dictionary Management', fragment: 'dictionarymanagement/management', mustHaveRows: true },
  { tile: 'Campaign Manager', fragment: 'campaignmanager/', button: '#btnRetrieveItems', rowSel: '#gridResults tr.jqgrow', mustHaveRows: true },
  { tile: 'View Label Master', fragment: 'itemlabelmasterview', button: '#btnRetrieveItems', rowSel: '#gridResults tr.jqgrow' },
  { tile: 'Label Control', fragment: 'labelcontrol/management', mustHaveRows: true },
  { tile: 'Lot Management', fragment: 'heading=lot_management', mustHaveRows: true },
  { tile: 'Workflow Management', fragment: 'workflowmanagement/management', button: '#btGetWorkflows', rowSel: '#gridResults tr.jqgrow', mustHaveRows: true },
  { tile: 'Label Type Management', fragment: 'heading=label_type_manag', mustHaveRows: true },
  { tile: 'Attachment Management', fragment: 'attachmentmanagement', mustHaveRows: true },
  { tile: 'Print History Inquiry', fragment: 'heading=print_history_in' },
  { tile: 'MD Job Inquiry', fragment: 'masterdata/jobinquiry', button: '#btnRetrieveJobs' },
  { tile: 'Job Inquiry', fragment: 'campaignmanager/jobinquiry', button: '#btnRetrieveItems', rowSel: '#gridResults tr.jqgrow' },
  { tile: 'Printer Control', fragment: 'heading=printer_control' },
  { tile: 'Print Entity Management', fragment: 'printentity/management', mustHaveRows: true },
  { tile: 'Codes Management', fragment: 'codes/management', mustHaveRows: true },
  { tile: 'Field Defs Management', fragment: 'fielddefsmanagement', mustHaveRows: true },
  { tile: 'Global Settings Management', fragment: 'heading=global_settings_', mustHaveRows: true },
  { tile: 'Print Config Management', fragment: 'heading=print_config_man', mustHaveRows: true },
  { tile: 'Facility Management', fragment: 'heading=facility_managem' },
  { tile: 'Notifications Management', fragment: 'heading=notifications_ma' },
];

const ERROR_TEXT = /server error|unhandled exception|an error occurred|stack trace|http error 404|http error 500/i;

async function openTile(page: Page, tile: string, fragment: string): Promise<Frame | undefined> {
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 5000 }).catch(() => {});
  const names = (await page.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim());
  const idx = names.indexOf(tile);
  if (idx < 0) return undefined;
  await page.locator('button.menuIcon').nth(idx).click({ timeout: 10_000 });
  for (let i = 0; i < 60; i++) {
    const fr = page.frames().filter((f) => f.url().toLowerCase().includes(fragment)).pop();
    if (fr) return fr;
    await page.waitForTimeout(500);
  }
  return undefined;
}

async function removeCriteria(page: Page, f: Frame): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const rm = f.getByText('Remove', { exact: true });
    if (!(await rm.count())) break;
    await rm.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

test('@smoke @tier0 data grids answer Retrieve Data', async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  for (const g of GRIDS) {
    await test.step(g.tile, async () => {
      const t0 = Date.now();
      const f = await openTile(page, g.tile, g.fragment);
      expect.soft(f, `${g.tile}: module opened`).toBeTruthy();
      if (!f) return;
      const button = f.locator(g.button ?? '#btnRetrieveData');
      await button.waitFor({ timeout: 30_000 }).catch(() => {});
      expect.soft(await button.count(), `${g.tile}: Retrieve button present`).toBeGreaterThan(0);
      if (!(await button.count())) return;
      await page.waitForTimeout(2500);
      await removeCriteria(page, f);
      await button.click({ timeout: 10_000 }).catch((e) => console.log(`GRID ${g.tile}: click failed ${String(e).slice(0, 80)}`));
      const rowSel = g.rowSel ?? 'tr.jqgrow';
      let rows = 0;
      let text = '';
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(500);
        rows = await f.locator(rowSel).count().catch(() => 0);
        text = (await f.locator('body').innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ');
        if (rows > 0 || /no records to view|no records found|no data/i.test(text) || ERROR_TEXT.test(text)) break;
      }
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`GRID ${g.tile}: ${rows} rows in ${secs}s${rows === 0 ? ` | ${text.slice(-90)}` : ''}`);
      expect.soft(ERROR_TEXT.test(text), `${g.tile}: error after Retrieve: ${text.slice(0, 160)}`).toBe(false);
      if (g.mustHaveRows) expect.soft(rows, `${g.tile}: Retrieve returned rows`).toBeGreaterThan(0);
      await page.locator('li.ui-tabs-tab:not(:has-text("Main Menu")) .ui-icon-close').first().click({ timeout: 2000 }).catch(() => {});
    });
  }
});

test('@smoke @tier0 Master Data grid retrieves item records', async ({ page }) => {
  test.setTimeout(240_000);
  const frame = await mdm.openMasterData(page);
  // the account persists the schema and the Selected Fields of the last visit (the tile test above leaves the first schema selected): pick the item schema, then reset the columns
  await mdm.selectSchema(frame, 'RobarMasterData');
  await mdm.resetSelectedColumns(frame);
  const rows = await mdm.retrieveVerified(page, frame, { column: 'ItemNumber', operator: 'Contains', value: 'MB', limit: 50 });
  await page.waitForTimeout(2000);
  const n = await rows.count();
  console.log(`GRID Master Data: ${n} rows`);
  expect(n, 'Master Data Retrieve returned item records (MB* fixture items exist)').toBeGreaterThan(0);
});
