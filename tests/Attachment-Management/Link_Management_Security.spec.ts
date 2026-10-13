// Link Management security gating (AT.170103.F.3.3 / F.6.2-6.4 / F.14 / F.20.2-20.3 / F.21.2-21.3; live 2026-10-11, headless, TST703). MB fixtures only: group MBPWLoginGrp / user MBPWLogin01 (left without processes). Read-only: nothing is linked, detached or downloaded.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
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

interface Seen { tile: boolean; ddlDisabled?: boolean; detachDisabled?: boolean; purpose?: string; actions?: string[]; state?: string[] }

async function retrieveFirstRow(p: Page, f: Frame): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const rm = f.getByText('Remove', { exact: true });
    if (!(await rm.count())) break;
    await rm.first().click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(300);
  }
  await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
  await p.waitForTimeout(500);
  await f.locator("select[name$='Column']").first().selectOption({ label: 'LCN' });
  await f.locator("select[name$='Operator']").first().selectOption({ label: 'Contains' });
  await f.locator("input[name$='Value']").first().fill('LCN');
  await f.click('#btnRetrieveData');
  await p.waitForTimeout(1500);
  await f.getByRole('button', { name: 'Continue' }).click({ timeout: 2500 }).catch(() => {});
  await f.locator('tr.jqgrow').first().waitFor({ timeout: 25_000 }).catch(() => {});
  await p.waitForTimeout(1500);
}

test('Link Management tile, Associate drop-down, Detach and row actions follow their processes (MB group only)', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  await login(page);

  const inspect = async (processes: string[], purposeProcs?: (purpose: string) => string[]): Promise<Seen> => {
    await sec.setGroupProcesses(page, GROUP, [...BASE, ...processes]);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      const seen: Seen = { tile: await p.getByRole('button', { name: 'Link Management', exact: true }).isVisible().catch(() => false) };
      if (!seen.tile) return seen;
      await openMenuItem(p, 'Link Management');
      const f = await findFrame(p, 'LinkAttachmentManagement/LinkManagement', { attempts: 80 });
      await p.waitForTimeout(6000);
      seen.ddlDisabled = await f.locator('#ddlLinkType').isDisabled();
      await retrieveFirstRow(p, f);
      const row = f.locator('tr.jqgrow').first();
      if (await row.count()) {
        seen.purpose = (await row.locator('td[aria-describedby$="_Purpose"]').first().innerText().catch(() => '')).trim();
        await row.locator('input[type=checkbox]').first().check().catch(() => {});
        await p.waitForTimeout(600);
        seen.detachDisabled = await f.locator('#btnDetach').isDisabled();
        await row.locator('a:has-text("Actions")').first().click({ timeout: 5000 }).catch(() => {});
        await p.waitForTimeout(600);
        seen.actions = (await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim());
        seen.state = await f.locator('ul:visible li').evaluateAll((els) => els.map((e: any) => `${e.innerText.trim()}|${e.className.includes('ui-state-disabled')}`));
      }
      return seen;
    } finally {
      await ctx.close();
    }
  };

  const none = await inspect([]);
  console.log(`NO PROCESSES ${JSON.stringify(none)}`);
  expect.soft(none.tile, 'Link Management tile hidden without LM_View_LinkManagement (F.3.3)').toBe(false);

  const view = await inspect(['LM_View_LinkManagement']);
  console.log(`LM_View_LinkManagement ${JSON.stringify(view)}`);
  expect.soft(view.tile).toBe(true);
  if (view.ddlDisabled === false) deviation('AT.170103.F.6.4', 'Associate Attachments drop-down disabled without LM_Link_Attachments', 'enabled');
  if (view.detachDisabled === false) deviation('AT.170103.F.21.3', 'Detach disabled without LM_Detach_Attachments', 'enabled');
  if (view.actions && view.actions.length === 0) console.log('no row actions without FP_ processes');

  const link = await inspect(['LM_View_LinkManagement', 'LM_Link_Attachments']);
  console.log(`+LM_Link_Attachments ${JSON.stringify(link)}`);
  expect.soft(link.ddlDisabled, 'drop-down enabled with LM_Link_Attachments (F.6.3)').toBe(false);

  const det = await inspect(['LM_View_LinkManagement', 'LM_Detach_Attachments']);
  console.log(`+LM_Detach_Attachments ${JSON.stringify(det)}`);
  expect.soft(det.detachDisabled, 'Detach enabled with LM_Detach_Attachments once a row is checked (F.21.2)').toBe(false);

  // View / Download follow FP_<purpose>_View / _Download (names from the first row's purpose)
  const purpose = view.purpose ?? det.purpose ?? link.purpose ?? '';
  console.log(`ROW PURPOSE "${purpose}"`);
  if (purpose) {
    for (const suffix of ['View', 'Download']) {
      const s = await inspect(['LM_View_LinkManagement', `FP_${purpose}_${suffix}`]);
      console.log(`+FP_${purpose}_${suffix} ${JSON.stringify(s)}`);
      const enabled = (s.state ?? []).filter((x) => x.endsWith('|false')).map((x) => x.split('|')[0]);
      if (!enabled.includes(suffix)) deviation(suffix === 'View' ? 'AT.170103.F.14.1' : 'AT.170103.F.20.3', `${suffix} enabled with FP_${purpose}_${suffix}`, JSON.stringify(s.state));
    }
  }

  await sec.setGroupProcesses(page, GROUP, []);
});
