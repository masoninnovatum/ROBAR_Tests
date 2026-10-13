// MDM Excel Import security (live 2026-10-10, headless, TST703; MB fixtures MBPWLoginGrp / MBPWLogin01 only; nothing is imported). The Main Menu tile "Master Data Excel Import" opens
// `InnoPages/MasterDataExcelImport/JobSubmission?LinkedFromWebmenu=1` and is gated by the process MD_ExcelImport_Web (menu record); the "Validation Rules Override" checkbox by MD_Validation_Override.
// Observed (no expectation from ValMaster: the MDM import requirements are in module "Master Data"): tile visibility, what a direct URL gives without the process, what the page offers with it
// (signature block? schema list?), and whether the override checkbox follows MD_Validation_Override. The group is left without processes.

import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const URL = 'http://vmsrvtst703/InnoPages/MasterDataExcelImport/JobSubmission?LinkedFromWebmenu=1';

test('MDM Excel Import: tile, direct URL and override checkbox follow MD_ExcelImport_Web / MD_Validation_Override', async ({ page, browser }) => {
  test.setTimeout(600_000);
  sec.assertMb(GROUP);
  await login(page);

  const observe = async (processes: string[]) => {
    await sec.setGroupProcesses(page, GROUP, processes);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      const tile = await p.getByRole('button', { name: 'Master Data Excel Import', exact: true }).isVisible().catch(() => false);
      await p.goto(URL);
      await p.waitForTimeout(4000);
      const text = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
      const ids = await p.locator('input, select, textarea').evaluateAll((els) => els.map((e: any) => `${e.id || e.name}|${e.type}`).filter((x) => x !== '|undefined').slice(0, 25));
      const override = (await p.locator('input[type=checkbox]').evaluateAll((els) => els.map((e: any) => ({ id: e.id || e.name, visible: !!(e.offsetWidth || e.offsetHeight), disabled: e.disabled }))));
      return { tile, text: text.slice(0, 300), ids, override };
    } finally {
      await ctx.close();
    }
  };

  try {
    const none = await observe(['Login_WebMenu']);
    console.log(`NO PROCESS: ${JSON.stringify(none)}`);
    const withPage = await observe(['Login_WebMenu', 'MD_ExcelImport_Web']);
    console.log(`+ MD_ExcelImport_Web: ${JSON.stringify(withPage)}`);
    const withOverride = await observe(['Login_WebMenu', 'MD_ExcelImport_Web', 'MD_Validation_Override']);
    console.log(`+ MD_Validation_Override: ${JSON.stringify(withOverride)}`);
    expect.soft(none.tile, 'tile hidden without MD_ExcelImport_Web').toBe(false);
    expect.soft(withPage.tile, 'tile visible with MD_ExcelImport_Web').toBe(true);
  } finally {
    await sec.setGroupProcesses(page, GROUP, []);
  }
});
