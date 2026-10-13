// InnoView security (IVURS-1.1 / IVFRS-1.1.1 / IVFRS-1.1.2; live 2026-10-11, headless, TST703). MB fixtures only: group MBPWLoginGrp / user MBPWLogin01 (left without processes). Read-only.
// Seeded: tile process Login_InnoView; Print History reports carry the report process Innov_ViewPrintHist; the other seeded reports carry no process.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { login, loginAs, openMenuItem, PASSWORD } from '../support/robar';
import * as sec from '../support/security';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('InnoView tile and Print History reports follow Login_InnoView and Innov_ViewPrintHist (MB group only)', async ({ page, browser }) => {
  test.setTimeout(900_000);
  sec.assertMb(GROUP);
  await login(page);

  const inspect = async (processes: string[]) => {
    await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu', ...processes]);
    const ctx = await (browser as Browser).newContext();
    const p: Page = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      const tile = await p.getByRole('button', { name: 'InnoView', exact: true }).isVisible().catch(() => false);
      if (!tile) return { tile, categories: [] as string[], printHistory: [] as string[] };
      await openMenuItem(p, 'InnoView');
      await p.waitForTimeout(6000);
      const f: Frame = p.frames().filter((x) => /innoview/i.test(x.url())).pop()!;
      const categories = (await f.locator('a').allInnerTexts()).map((t) => t.trim()).filter((t) => t && t !== 'Main Menu');
      let printHistory: string[] = [];
      if (categories.includes('Print History')) {
        await f.getByText('Print History', { exact: true }).first().click();
        await p.waitForTimeout(1500);
        const all = (await f.locator('a').allInnerTexts()).map((t) => t.trim());
        printHistory = all.filter((t) => /^View Print History/.test(t));
      }
      return { tile, categories, printHistory };
    } finally {
      await ctx.close();
    }
  };

  const none = await inspect([]);
  console.log(`NO PROCESSES ${JSON.stringify(none)}`);
  expect.soft(none.tile, 'InnoView tile hidden without Login_InnoView').toBe(false);

  const tileOnly = await inspect(['Login_InnoView']);
  console.log(`Login_InnoView ${JSON.stringify(tileOnly)}`);
  expect.soft(tileOnly.tile).toBe(true);
  if (tileOnly.printHistory.length) deviation('IVFRS-1.1.2', 'Print History reports hidden without Innov_ViewPrintHist', JSON.stringify(tileOnly.printHistory));

  const withHist = await inspect(['Login_InnoView', 'Innov_ViewPrintHist']);
  console.log(`+Innov_ViewPrintHist ${JSON.stringify(withHist)}`);
  if (withHist.printHistory.length === 0) deviation('IVFRS-1.1.2', 'Print History reports visible with Innov_ViewPrintHist', JSON.stringify(withHist));

  await sec.setGroupProcesses(page, GROUP, []);
});
