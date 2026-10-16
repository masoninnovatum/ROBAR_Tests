// Print History Inquiry SECURITY re-checked against ValMaster (FRS-15.1.1.1 - 15.1.1.3, URS-15.1.1, SER20150611100F5.0.2; live 2026-10-15, headless, TST703; MB fixtures MBPWLoginGrp / MBPWLogin01 only, group left without processes).
// The seed user sets the group's processes; the MB user logs in fresh for each state (roles are read at LOGIN). Nothing is printed.
//   state 1 Login_WebMenu only                         -> the Print History Inquiry tile is NOT offered (FRS-15.1.1.2, process PrintHist_Login)
//   state 2 + PrintHist_Login                          -> tile, grid and the actions See Detail / See Image / Print Data Values; NOT Regenerate / Exact Reprint / Serialization Detail (FRS-15.1.1.3, F5.0.2)
//   state 3 + BP_Reprint_Label, BP_Exact_Reprint_Print, BP_SerializationDetail -> all six actions
// Direct URL checks (server side): Serialization Detail must not serve its data to a user without BP_SerializationDetail; Exact Reprint / Regenerate screens are only checked and annotated.
// Differences from a requirement are annotated `deviation <id>` (the spec stays green).

import { test, expect } from '@playwright/test';
import { skipUnlessGlobal } from '../support/preconditions';
import type { Browser, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as du from '../support/dynamic-ui';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'test-data', 'phi-fixture.json'), 'utf8')) as { normal: { printId: string }; usrSerial: { printId: string; serials: string[] } };
const TILE = 'Print History Inquiry';
const ALL_ACTIONS = ['See Detail', 'See Image', 'Regnerate', 'Exact Reprint', 'Serialization Detail', 'Print Data Values'];
const BASE_ACTIONS = ['See Detail', 'See Image', 'Print Data Values'];

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

const strip = (s: string) => s.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function rowActions(p: Page): Promise<string[]> {
  const f = await du.reopenDynamicUi(p, TILE);
  await du.clearCriteria(p, f);
  await du.retrieve(p, f, 'PrintID', 'Exactly Matches', FX.normal.printId, { expectRows: false });
  await p.waitForTimeout(4000);
  expect(await f.locator('tr.jqgrow').count(), 'the fixture print is listed for this user').toBe(1);
  await f.locator('tr.jqgrow').first().getByText('Actions').first().click();
  await p.waitForTimeout(700);
  return (await f.locator('ul:visible li').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

test('Print History Inquiry security: PrintHist_Login gates the tile; BP_Reprint_Label / BP_Exact_Reprint_Print / BP_SerializationDetail gate the actions', async ({ page, browser }) => {
  await skipUnlessGlobal(browser, 'PrintEntityRequired', 'Innovatum', 'N', 'this spec covers the PrintEntityRequired = N behavior (entity-scoped lists and the default entity differ with Y)');
  test.setTimeout(900_000);
  sec.assertMb(GROUP);
  await login(page);

  /** Sets the group's processes, logs the MB user in fresh and runs `body` on that user's page. */
  const asUser = async (processes: string[], body: (p: Page) => Promise<void>) => {
    await sec.setGroupProcesses(page, GROUP, processes);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      await body(p);
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('FRS-15.1.1.2: without PrintHist_Login the tile is not offered', async () => {
      await asUser(['Login_WebMenu'], async (p) => {
        const tiles = (await p.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim());
        console.log(`STATE login only: tiles ${JSON.stringify(tiles)}`);
        expect(tiles, 'tile hidden').not.toContain(TILE);
      });
    });

    await test.step('FRS-15.1.1.2 / 15.1.1.3: with PrintHist_Login only: the tile, the grid and the three read-only actions; no Regenerate / Exact Reprint / Serialization Detail', async () => {
      await asUser(['Login_WebMenu', 'PrintHist_Login'], async (p) => {
        const tiles = (await p.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim());
        expect(tiles, 'tile offered').toContain(TILE);
        const items = await rowActions(p);
        console.log(`STATE +PrintHist_Login: ACTIONS ${JSON.stringify(items)}`);
        expect(items).toEqual(BASE_ACTIONS);
        // direct URL: Serialization Detail needs BP_SerializationDetail (CustomAuthorize); it must not serve the details to this user
        const r = await p.request.get(`http://vmsrvtst703/Innovatum/SerialNumMgmt/SerializationDetail?printId=${FX.usrSerial.printId}`, { failOnStatusCode: false, maxRedirects: 0 });
        const t = strip(await r.text());
        console.log(`STATE +PrintHist_Login: direct Serialization Detail HTTP ${r.status()} ${t.slice(0, 100)}`);
        const served = r.status() === 200 && /Serialization Detail/i.test(t) && t.includes(FX.usrSerial.printId);
        if (served) deviation('SER20150611100F5.0.2', 'Serialization Detail is not available to a user without BP_SerializationDetail', 'the URL serves the details');
        expect.soft(served, 'Serialization Detail data is not served without BP_SerializationDetail').toBe(false);
        // direct URL: Exact Reprint screen needs BP_Exact_Reprint_Print: annotate only
        const er = await p.request.get(`http://vmsrvtst703/Innovatum/ROBAR/Printing/Screens/ExactReprintScreen.aspx?ConfigName=exactReprint&PrintID=${FX.normal.printId}&AutoDE=True`, { failOnStatusCode: false, maxRedirects: 0 });
        const ert = strip(await er.text());
        console.log(`STATE +PrintHist_Login: direct Exact Reprint screen HTTP ${er.status()} ${ert.slice(0, 160)}`);
        if (er.status() === 200 && /Print History:/i.test(ert) && !/not authorized/i.test(ert)) deviation('FRS-15.1.1.3', 'the Exact Reprint screen is not reachable by URL without BP_Exact_Reprint_Print', `ExactReprintScreen.aspx shows the reprint panel (${ert.slice(0, 80)})`);
        expect.soft(ert, 'the reprint screen refuses a user without Print_Label / the reprint process').toMatch(/not authorized/i);
      });
    });

    await test.step('FRS-15.1.1.3 / SER...F5.0.2: with BP_Reprint_Label, BP_Exact_Reprint_Print and BP_SerializationDetail all six actions are offered', async () => {
      await asUser(['Login_WebMenu', 'PrintHist_Login', 'BP_Reprint_Label', 'BP_Exact_Reprint_Print', 'BP_SerializationDetail'], async (p) => {
        const items = await rowActions(p);
        console.log(`STATE +actions: ACTIONS ${JSON.stringify(items)}`);
        expect(items).toEqual(ALL_ACTIONS);
      });
    });

    await test.step('FRS-15.1.1.3: a user who may print (Print_Label) but lacks the reprint processes: the Exact Reprint screen URL (annotated)', async () => {
      await asUser(['Login_WebMenu', 'PrintHist_Login', 'Print_Label'], async (p) => {
        const er = await p.request.get(`http://vmsrvtst703/Innovatum/ROBAR/Printing/Screens/ExactReprintScreen.aspx?ConfigName=exactReprint&PrintID=${FX.normal.printId}&AutoDE=True`, { failOnStatusCode: false, maxRedirects: 0 });
        const t = strip(await er.text());
        console.log(`STATE +Print_Label: direct Exact Reprint screen HTTP ${er.status()} ${t.slice(0, 200)}`);
        if (er.status() === 200 && /Print History:/i.test(t) && !/not authorized/i.test(t)) deviation('FRS-15.1.1.3', 'the Exact Reprint screen is not reachable by URL without BP_Exact_Reprint_Print', `with Print_Label but without BP_Exact_Reprint_Print the screen shows the reprint panel (${t.slice(0, 80)})`);
      });
    });

    await test.step('each action process alone adds exactly its own action', async () => {
      for (const [proc, action] of [['BP_Reprint_Label', 'Regnerate'], ['BP_Exact_Reprint_Print', 'Exact Reprint'], ['BP_SerializationDetail', 'Serialization Detail']] as const) {
        await asUser(['Login_WebMenu', 'PrintHist_Login', proc], async (p) => {
          const items = await rowActions(p);
          console.log(`STATE +${proc}: ACTIONS ${JSON.stringify(items)}`);
          expect(items, `${proc} adds ${action}`).toEqual(ALL_ACTIONS.filter((a) => BASE_ACTIONS.includes(a) || a === action));
        });
      }
    });
  } finally {
    await sec.setGroupProcesses(page, GROUP, []).catch((e) => console.log(`reset group failed: ${String(e).slice(0, 100)}`));
  }
});
