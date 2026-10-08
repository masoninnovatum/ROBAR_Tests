// Linked Documents (live 2026-10-05, Claude01): in the Detail dialog of an ITEM or LABEL (template) workflow the "Workflow Image" tab has a
// "Linked Documents" button (`#btnLinkManagement`, enabled by LM_View_LinkManagement). It opens Link Management (`InnoPages/LinkAttachmentManagement/
// LinkManagement?workflowId=<id>`) in a new "LinkManagement" menu tab, pre-filtered (criteria rows dvFilters[n]) by the workflow's object:
//   item workflow     -> ItemNumber, ItemVersion, LabelType  (Exactly Matches; an LCN filter would be used instead if the item had one)
//   template workflow -> TemplateName, TemplateVersion, LabelType
// A standalone workflow (Create New Workflow) has NO such button. Uses workflows already on TST703 (created by Item_Workflow / Template_Workflow
// runs and by the other specs): nothing is created or changed.

import { test, expect } from '@playwright/test';
import type { Frame, Locator } from '@playwright/test';
import { login } from '../support/robar';
import * as wf from '../support/workflow';

test.use({ actionTimeout: 20_000 });

test('Linked Documents: item and template workflows open Link Management pre-filtered; a standalone workflow has no button', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  let f: Frame = await wf.showNewestFirst(page);
  await f.locator('select.ui-pg-selbox').first().selectOption('30');
  await page.waitForTimeout(4000);

  /** Newest first, 30 per page: the first row (up to 8 pages) whose text matches. */
  const findRow = async (re: RegExp): Promise<Locator> => {
    f = await wf.showNewestFirst(page);
    await f.locator('select.ui-pg-selbox').first().selectOption('30');
    await page.waitForTimeout(4000);
    // changing the page size can drop the sort: make sure the list is newest first again
    for (let i = 0; i < 3; i++) {
      const col = await f.locator('#gridResults tr.jqgrow td[aria-describedby="gridResults_WorkflowID"]').allInnerTexts();
      if (col.length < 2 || col[0].trim() >= col[col.length - 1].trim()) break;
      await f.locator('#gridResults_WorkflowID').click({ timeout: 5000 });
      await page.waitForTimeout(2500);
    }
    for (let pg = 0; pg < 12; pg++) {
      const rows = f.locator('#gridResults tr.jqgrow').filter({ hasText: re });
      const idsOnPage = await f.locator('#gridResults tr.jqgrow td[aria-describedby="gridResults_WorkflowID"]').allInnerTexts();
      console.log(`page ${pg + 1}: ${idsOnPage[0]?.trim()} .. ${idsOnPage[idsOnPage.length - 1]?.trim()} (${idsOnPage.length} rows) matches=${await rows.count()}`);
      if (await rows.count()) return rows.first();
      const next = f.locator('#next_gridPager, .ui-pg-button:has(.ui-icon-seek-next)').first();
      await next.click();
      await page.waitForTimeout(3000);
    }
    throw new Error(`no workflow row matching ${re}`);
  };
  const openDetail = async (row: Locator) => {
    await row.getByText('Detail').click();
    await page.waitForTimeout(4000);
  };
  const closeDetail = async () => {
    // (after coming back from the Link Management tab the Workflow Management page may have reloaded without the dialog)
    await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  };
  /** Clicks Linked Documents, returns the criteria rows of the Link Management tab it opens, then closes that tab. */
  const linkManagementFilters = async (workflowId: string): Promise<Record<string, string>> => {
    await f.locator('.ui-dialog:visible #btnLinkManagement').click();
    await expect.poll(async () => (await page.locator('li.ui-tabs-tab').allInnerTexts()).join('|'), { timeout: 20_000 }).toContain('LinkManagement');
    let lf: Frame | undefined;
    for (let i = 0; i < 20 && !lf; i++) {
      lf = page.frames().filter((x) => x.url().includes(`LinkAttachmentManagement/LinkManagement?workflowId=${workflowId}`)).pop();
      if (!lf) await page.waitForTimeout(1000);
    }
    expect(lf, 'the Link Management frame').toBeTruthy();
    await page.waitForTimeout(4000);
    const pairs = await lf!.locator('select[name^="dvFilters"], input[name^="dvFilters"]').evaluateAll((e) => e.map((x) => [(x as HTMLInputElement).name, (x as HTMLInputElement).value]));
    await page.locator('li.ui-tabs-tab:has-text("LinkManagement") .ui-icon-close').click({ timeout: 5000 });
    await page.locator('li.ui-tabs-tab:has-text("Workflow Management")').click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    const out: Record<string, string> = {};
    for (const [name, value] of pairs) {
      const m = name.match(/dvFilters\[(\d+)\]\.(Column|Operator|Value)/);
      if (m && m[2] === 'Column') out[`col${m[1]}`] = value;
      if (m && m[2] === 'Value') out[`val${m[1]}`] = value;
      if (m && m[2] === 'Operator') out[`op${m[1]}`] = value;
    }
    return out;
  };

  await test.step('ITEM workflow: Linked Documents -> Link Management filtered by Item Number, Item Version and Label Type', async () => {
    const row = await findRow(/Item: \S+, Version: \d+; Label Type/);
    const text = (await row.innerText()).replace(/\s+/g, ' ');
    const m = text.match(/Item: (\S+), Version: (\d+); Label Type: ([^;]+);/); // (a row may also carry a CC number before the description)
    expect(m, `item workflow description: ${text}`).toBeTruthy();
    const [, item, version, labelType] = m!;
    const id = (await row.locator('td[aria-describedby="gridResults_WorkflowID"]').innerText()).trim();
    console.log(`item workflow ${id}: ${item} v${version} ${labelType}`);
    await openDetail(row);
    await expect(f.locator('.ui-dialog:visible #btnLinkManagement')).toBeEnabled();
    const filters = await linkManagementFilters(id);
    console.log(`item filters: ${JSON.stringify(filters)}`);
    expect(filters).toMatchObject({ col0: 'ItemNumber', val0: item, col1: 'ItemVersion', val1: version, col2: 'LabelType', val2: labelType.trim() });
    for (const k of ['op0', 'op1', 'op2']) expect(filters[k]).toBe('ExactlyMatches');
    await closeDetail();
  });

  await test.step('TEMPLATE workflow: filtered by Template Name, Template Version and Label Type', async () => {
    const row = await findRow(/Label: [^;]+; Label Type:/);
    const text = (await row.innerText()).replace(/\s+/g, ' ');
    const m = text.match(/Label: ([^;]+); Label Type:([^;]+); Version:(\d+)/);
    expect(m, `template workflow description: ${text}`).toBeTruthy();
    const [, template, labelType, version] = m!;
    const id = (await row.locator('td[aria-describedby="gridResults_WorkflowID"]').innerText()).trim();
    console.log(`template workflow ${id}: ${template} v${version} ${labelType}`);
    await openDetail(row);
    await expect(f.locator('.ui-dialog:visible #btnLinkManagement')).toBeEnabled();
    const filters = await linkManagementFilters(id);
    console.log(`template filters: ${JSON.stringify(filters)}`);
    expect(filters).toMatchObject({ col0: 'TemplateName', val0: template.trim(), col1: 'TemplateVersion', val1: version, col2: 'LabelType', val2: labelType.trim() });
    await closeDetail();
  });

  await test.step('a STANDALONE workflow (no item / template) has no Linked Documents button', async () => {
    f = await wf.showNewestFirst(page);
    const row = f.locator('#gridResults tr.jqgrow').filter({ hasText: /PW (attach|report|sec|edit|A|B) / }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await openDetail(row);
    expect(await f.locator('.ui-dialog:visible #btnLinkManagement').count()).toBe(0);
    await closeDetail();
  });
});
