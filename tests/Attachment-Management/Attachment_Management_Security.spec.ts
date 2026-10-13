// Attachment Management / Attachment Upload security gating (live 2026-10-11, headless, TST703). MB fixtures only: group MBPWLoginGrp / user MBPWLogin01; the group is left without processes at the end.
// ValMaster: AM tile needs AM_Attachment_Management (F.12.3); Attachment Upload tile needs Attach_Upload_View (U.2); FP_<Purpose>_View / _Download / _Edit gate the row actions (F.1.6 / F.1.7 / F.19.2-3).
// Read-only on attachments: only opens the grid on the MB group MBAUT* files and lists the row actions. Nothing is edited, uploaded or downloaded.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import { login, loginAs, openMenuItem, findFrame, PASSWORD } from '../support/robar';
import * as sec from '../support/security';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const BASE = ['Login_WebMenu'];

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Attachment tiles and row actions follow AM_/Attach_Upload_View and FP_Approvals_* (MB group only)', async ({ page, browser }) => {
  test.setTimeout(1_200_000);
  sec.assertMb(GROUP);
  await login(page);
  const last = JSON.parse(fs.readFileSync('test-data/run-results/attachment-upload-last.json', 'utf8')) as { group: string };

  const tile = (p: Page, name: string) => p.getByRole('button', { name, exact: true }).isVisible().catch(() => false);

  const inspect = async (processes: string[]) => {
    await sec.setGroupProcesses(page, GROUP, [...BASE, ...processes]);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      const seen: { mgmt: boolean; upload: boolean; actions?: string[] | null; state?: string[] } = { mgmt: await tile(p, 'Attachment Management'), upload: await tile(p, 'Attachment Upload') };
      if (seen.mgmt) {
        await openMenuItem(p, 'Attachment Management');
        const f: Frame = await findFrame(p, 'AttachmentManagement', { attempts: 80 });
        await p.waitForTimeout(4000);
        if ((await f.locator('.criteriaFilter-Filter').count()) === 0) await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
        await f.selectOption('select[name="dvFilters[0].Column"]', 'AttachmentGroup');
        await f.selectOption('select[name="dvFilters[0].Operator"]', { label: 'Contains' });
        await f.fill('input[name="dvFilters[0].Value"]', last.group);
        await f.click('#btnRetrieveData');
        await f.locator('tr.jqgrow').first().waitFor({ timeout: 25_000 }).catch(() => {});
        await p.waitForTimeout(1500);
        const row = f.locator('tr.jqgrow').first();
        if (await row.count()) {
          await row.locator('a:has-text("Actions")').first().click({ timeout: 5000 }).catch(() => {});
          await p.waitForTimeout(800);
          seen.actions = (await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim());
          seen.state = await f.locator('ul:visible li').evaluateAll((els) => els.map((e: any) => `${e.innerText.trim()}|${e.className}|${e.getAttribute('aria-disabled')}`));
        } else seen.actions = null;
      }
      return seen;
    } finally {
      await ctx.close();
    }
  };

  const none = await inspect([]);
  console.log(`NO PROCESSES ${JSON.stringify(none)}`);
  expect.soft(none.mgmt, 'Attachment Management tile hidden without AM_Attachment_Management').toBe(false);
  expect.soft(none.upload, 'Attachment Upload tile hidden without Attach_Upload_View').toBe(false);

  const up = await inspect(['Attach_Upload_View']);
  console.log(`Attach_Upload_View ${JSON.stringify(up)}`);
  expect.soft(up.upload, 'Attachment Upload tile visible with Attach_Upload_View').toBe(true);
  expect.soft(up.mgmt).toBe(false);

  const am = await inspect(['AM_Attachment_Management']);
  console.log(`AM_Attachment_Management ${JSON.stringify(am)}`);
  expect.soft(am.mgmt, 'Attachment Management tile visible with AM_Attachment_Management').toBe(true);
  expect.soft(am.upload).toBe(false);
  // the row Actions menu always lists the entries; the FP_<Purpose>_* process ENABLES them (ui-state-disabled otherwise). Observed 2026-10-11: View <- _View, Download <- _Download, Edit <- _Edit; Edit Attributes always enabled; Assign Printer Models needs AM_AssignPrinterModel.
  const enabled = (s: { state?: string[] }) => (s.state ?? []).filter((x) => !x.includes('ui-state-disabled')).map((x) => x.split('|')[0]);
  console.log(`ENABLED with AM only: ${JSON.stringify(enabled(am))}`);
  expect.soft(enabled(am), 'without FP_Approvals_* View / Download / Edit are disabled (F.19.2)').toEqual(['Edit Attributes']);
  for (const [proc, action] of [['FP_Approvals_View', 'View'], ['FP_Approvals_Download', 'Download'], ['FP_Approvals_Edit', 'Edit']] as const) {
    const s = await inspect(['AM_Attachment_Management', proc]);
    console.log(`${proc} enabled=${JSON.stringify(enabled(s))}`);
    expect.soft(enabled(s), `${proc} enables only "${action}" (plus Edit Attributes)`).toEqual([action, 'Edit Attributes'].sort((a, b) => ['View', 'Download', 'Edit Attributes', 'Edit'].indexOf(a) - ['View', 'Download', 'Edit Attributes', 'Edit'].indexOf(b)));
  }
  const ap = await inspect(['AM_Attachment_Management', 'AM_AssignPrinterModel']);
  console.log(`AM_AssignPrinterModel enabled=${JSON.stringify(enabled(ap))}`);
  // source (AttachmentManagement.cshtml): Assign Printer Models needs AM_AssignPrinterModel AND an active row whose File Purpose is "Vision Inspection"; the MB rows are Approvals, so it stays disabled
  expect.soft(enabled(ap)).not.toContain('Assign Printer Models');

  await sec.setGroupProcesses(page, GROUP, []);
});
