// Multi Document Printing access (headless; MB fixtures MBPWLoginGrp / MBPWLogin01 only). The Main Menu tile "Multi Document Printing" and the page
// `InnoPages/MultiDocPrinting/MultiDocumentPrinting?ConfigName=MultiDocPrint` are gated by the process BP_MultiDocumentPrint (menu record + `[Authorize(Roles = "BP_MultiDocumentPrint")]`).
// NOTE: clicking Next on that page launches the Sentinel protocol, which FREEZES a headless run (see Multi_Document_Printing.spec.ts for the headed flow); only loading the entry panel
// is safe here. The group is left without processes at the end.

import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const URL = 'http://vmsrvtst703/InnoPages/MultiDocPrinting/MultiDocumentPrinting?ConfigName=MultiDocPrint';

test('Multi Document Printing security: tile and page need BP_MultiDocumentPrint', async ({ page, browser }) => {
  test.setTimeout(600_000);
  sec.assertMb(GROUP);
  await login(page);

  const asMb = async () => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    await loginAs(p, MB, PASSWORD);
    await p.waitForTimeout(2500);
    return { p, close: () => ctx.close() };
  };

  await test.step('without BP_MultiDocumentPrint: no tile, and the page itself is refused', async () => {
    await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu']);
    const u = await asMb();
    try {
      const tiles = (await u.p.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim());
      console.log(`tiles without the process: ${JSON.stringify(tiles)}`);
      expect(tiles).not.toContain('Multi Document Printing');
      const response = await u.p.goto(URL);
      await u.p.waitForTimeout(2500);
      const body = (await u.p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      console.log(`direct page without the process: status ${response?.status()} url ${u.p.url()} text "${body.slice(0, 160)}"`);
      expect(await u.p.locator('input[name="FlexLot_OrderNum"]').count(), 'no data-entry panel').toBe(0);
    } finally {
      await u.close();
    }
  });

  await test.step('with BP_MultiDocumentPrint: the tile is there and the entry panel loads', async () => {
    await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu', 'BP_MultiDocumentPrint']);
    const u = await asMb();
    try {
      const tiles = (await u.p.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim());
      expect(tiles).toContain('Multi Document Printing');
      await u.p.goto(URL);
      await u.p.waitForTimeout(4000);
      await expect(u.p.locator('input[name="FlexLot_OrderNum"]')).toBeVisible();
      expect((await u.p.locator('body').innerText()).replace(/\s+/g, ' ')).toContain('Multi Document Printing');
    } finally {
      await u.close();
    }
  });

  await test.step('cleanup: the group is left without processes', async () => {
    await sec.setGroupProcesses(page, GROUP, []);
  });
});
