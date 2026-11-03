// DIT 6630 spike 2: VLM status text for a user WITHOUT ViewUnapprovedLabelMasters, for the fixture item with a linked master.
import { test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { loginAs, openMenuItem, findFrame, PASSWORD } from '../../support/robar';
import * as sec from '../../support/security';

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const ITEM = process.env.VLM_ITEM || 'MBMDPM3213026';

async function vlm(page: Page, item: string): Promise<string[]> {
  await openMenuItem(page, 'View Label Master');
  const f: Frame = await findFrame(page, 'itemlabelmasterview');
  await f.waitForSelector('#btnRetrieveItems');
  await page.waitForTimeout(2500);
  await f.locator("select[name$='Column']").first().selectOption({ label: 'ItemNumber' }).catch(() => {});
  await f.locator("select[name$='Operator']").first().selectOption({ label: process.env.VLM_OP || 'Exactly Matches' }).catch(() => {});
  await f.locator("input[name$='Value']").first().fill(item);
  await f.locator('#queryModeDd').selectOption({ label: 'All' }).catch(() => {}); await f.locator('#btnRetrieveItems').click();
  await page.waitForTimeout(5000);
  return f.locator('#gridResults tr.jqgrow').evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim().slice(0, 40)).filter((t) => t && !t.startsWith('/Date')).join(' | ')));
}

test('VLM status without ViewUnapprovedLabelMasters', async ({ page, browser }) => {
  test.setTimeout(600_000);
  sec.assertMb(GROUP);
  await sec.openSecurity(page);
  await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu', 'LM_View_LabelMaster']);
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await loginAs(p, MB, PASSWORD);
  await p.waitForTimeout(2000);
  const rows = await vlm(p, ITEM);
  console.log('NOROLE rows', rows.length);
  for (const r of rows) console.log('NOROLE', r);
  await p.screenshot({ path: 'C:/Users/Mason/AppData/Local/Temp/claude/C--DB-Copies-703-20198/cbb849bb-1b4f-4282-bd43-98ea9e43b2be/scratchpad/dit6630/norole.png' });
  await ctx.close();
  await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu']);
});
