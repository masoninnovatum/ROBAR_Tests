// SMOKE TIER 0 (headless, read-only, ~3 min): (1) the Main Menu shows every expected module tile; (2) every NON-print module opens into its page without an error and with content.
// Print tiles (Print by Lot/Order, Flex, Version/Misc/Server/DX, SPF, MDP, Destination Labeling, ...) are opened by the Tier 2 print tests, because opening them can raise the Sentinel prompt.
// Tile list and URLs recorded live 2026-10-14 on TST703 7.0.3.20260 as the seed user Claude01 (sees every tile). A NEW tile on the menu is only reported (annotation), a MISSING one fails.
// Each module is its own test.step, so one broken page is reported without hiding the others (soft assertions).

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { login } from '../../support/robar';

// [tile text, URL fragment of the page it opens (lower case)]
const MODULES: Array<[string, string]> = [
  ['Master Data', 'masterdata/management'],
  ['Template Management', 'templatemanagement/management'],
  ['Dictionary Management', 'dictionarymanagement/management'],
  ['Campaign Manager', 'campaignmanager/'],
  ['View Label Master', 'itemlabelmasterview'],
  ['Label Control', 'labelcontrol/management'],
  ['Lot Management', 'heading=lot_management'],
  ['Workflow Management', 'workflowmanagement/management'],
  ['Label Type Management', 'heading=label_type_manag'],
  ['Bulk Master Review', 'labelmasterreview'],
  ['Master Data Excel Import', 'masterdataexcelimport'],
  ['Legacy Batch History', 'heading=legacy_batch_his'],
  ['Attachment Management', 'attachmentmanagement'],
  ['Attachment Upload', 'uploadattachments'],
  ['Link Management', 'linkmanagement'],
  ['Training Upload', 'trainingupload'],
  ['InnoView', 'innoview'],
  ['Print History Inquiry', 'heading=print_history_in'],
  ['MD Job Inquiry', 'masterdata/jobinquiry'],
  ['Job Inquiry', 'campaignmanager/jobinquiry'],
  ['Template Image Inquiry', 'templateimageinquiry'],
  ['Transmission Inquiry', 'com/transmissioninquiry'],
  ['Label History Inquiry', 'labelhistoryinquiry'],
  ['Label Type Excl.', 'labeltypeexclusion'],
  ['Printer Control', 'heading=printer_control'],
  ['Print Entity Management', 'printentity/management'],
  ['User Print Entity Management', 'printentity/usermanagement'],
  ['Badge Maintenance', 'userbadgemaintenance'],
  ['Password Reset', 'passwordreset'],
  ['Password Change', 'changepwd.aspx'],
  ['Security Management', 'security/management'],
  ['Codes Management', 'codes/management'],
  ['Field Defs Management', 'fielddefsmanagement'],
  ['Schemas', 'schemas/edit'],
  ['Trading Partner Config.', 'tradingpartnerconfiguration'],
  ['Facility Management', 'heading=facility_managem'],
  ['Global Settings Management', 'heading=global_settings_'],
  ['Print Config Management', 'heading=print_config_man'],
  ['Notifications Management', 'heading=notifications_ma'],
  ['Notifications Link Management', 'heading=notifications_li'],
  ['Dashboards Management', 'heading=dashboards_manag'],
  ['Dashboards Link Management', 'heading=dashboards_link_'],
  ['Prompt Samples', 'heading=prompt_samples'],
];

const PRINT_TILES = [
  'Version Printing', 'Misc. Printing', 'Print by order', 'Print by lot', 'Print by order multi', 'Print by lot multi', 'Print by order lot', 'Server Printing', 'DX Printing',
  'Flex Printing', 'Multi Document Printing', 'Destination Labeling', 'Print Reconciliation', 'Single Piece Flow Printing', 'Print Prep Testing', 'Service and Repair Print',
  'Printer User Commands', 'Alternate Print File Control',
];

const ERROR_TEXT = /server error|unhandled exception|an error occurred|stack trace|http error 404|http error 500/i;

async function tileTexts(page: Page): Promise<string[]> {
  return (await page.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim());
}

test('@smoke @tier0 Main Menu shows every expected module tile', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  const shown = await tileTexts(page);
  const expected = [...MODULES.map((m) => m[0]), ...PRINT_TILES];
  const missing = expected.filter((t) => !shown.includes(t));
  const extra = shown.filter((t) => !expected.includes(t));
  console.log(`TILES shown ${shown.length}, expected ${expected.length}; missing ${JSON.stringify(missing)}; new ${JSON.stringify(extra)}`);
  if (extra.length) test.info().annotations.push({ type: 'new tiles', description: extra.join(', ') });
  expect(missing, 'tiles missing from the Main Menu').toEqual([]);
});

test('@smoke @tier0 every non-print module opens without an error', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  for (const [tile, fragment] of MODULES) {
    await test.step(tile, async () => {
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 5000 }).catch(() => {});
      const idx = (await tileTexts(page)).indexOf(tile);
      expect.soft(idx, `tile "${tile}" on the menu`).toBeGreaterThanOrEqual(0);
      if (idx < 0) return;
      await page.locator('button.menuIcon').nth(idx).click({ timeout: 10_000 });
      // the page opens in a new iframe whose URL contains the fragment; poll until it exists AND shows some text (Knockout / Dynamic UI pages fill in after load)
      let url = '';
      let text = '';
      for (let i = 0; i < 50; i++) {
        const fr = page.frames().filter((f) => f.url().toLowerCase().includes(fragment)).pop();
        if (fr) {
          url = fr.url();
          text = (await fr.locator('body').innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ').trim();
          if (text.length > 15 || ERROR_TEXT.test(text)) break;
        }
        await page.waitForTimeout(500);
      }
      console.log(`TILE ${tile}: ${url ? 'opened' : 'NO FRAME'} | ${text.slice(0, 70)}`);
      expect.soft(url, `${tile}: a page containing "${fragment}" opened`).not.toBe('');
      expect.soft(ERROR_TEXT.test(text), `${tile}: page shows an error: ${text.slice(0, 160)}`).toBe(false);
      if (url) expect.soft(text.length, `${tile}: page has content`).toBeGreaterThan(15);
      await page.locator('li.ui-tabs-tab:not(:has-text("Main Menu")) .ui-icon-close').first().click({ timeout: 2000 }).catch(() => {});
    });
  }
});
