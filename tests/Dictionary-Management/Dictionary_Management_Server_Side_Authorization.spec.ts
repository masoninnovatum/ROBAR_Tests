// Dictionary Management SERVER-SIDE authorization (live 2026-10-09, headless, TST703; MB fixtures MBPWLoginGrp / MBPWLogin01 only). The page disables the menu items client-side ("User not authorized for this task DM_<Process>.");
// this spec bypasses the UI and POSTs straight to the JSON endpoints as a user who only holds Web_DictionaryManagement (page access) and checks that the server still refuses:
//   NewRecord -> DM_NewEntry, NewVersion -> DM_NewVersion, Update -> DM_Edit (code: DictionaryManagementService.SaveDictionary / SaveNewVersion call RobarUser.HasPermissionFor).
// Compare Lot Management / Security Management where the write endpoints have NO server-side check (DIT tracker). Only a phrase of the MB fixture family is ever attempted; a Success would create an undeletable
// dictionary record, so a success is recorded as a deviation (and the phrase name makes it identifiable). The group is left without processes.

import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as dm from '../support/dictionary';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const BASE = 'http://vmsrvtst703/InnoPages/DictionaryManagement';

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Dictionary Management: the JSON write endpoints refuse a user without DM_NewEntry / DM_NewVersion / DM_Edit', async ({ page, browser }) => {
  test.setTimeout(600_000);
  sec.assertMb(GROUP);
  await login(page);
  // a real record id of an MB test phrase (the checks must reach the authorization step, which needs an existing entry)
  await dm.reopenDictionary(page); // (openDictionary logs in again and would hang)
  const found = await dm.search(page, 'MB', { version: 'Any', latest: true, limit: 200 });
  // ONLY an MB-owned phrase may be probed (a successful probe creates a new version): pick a row whose Phrase cell STARTS with MB (a plain 'contains MB' also matches e.g. 'Batch NuMBer')
  const phrases = await found.frame.locator('#grdJqGrid tr.jqgrow').evaluateAll((trs) => trs.map((tr) => ({ id: tr.id, phrase: (tr.querySelector('td[aria-describedby$="_Phrase"]')?.textContent ?? '').trim() })));
  const mine = phrases.find((x) => /^MB/i.test(x.phrase));
  console.log('MB test phrase row: ' + JSON.stringify(mine) + ' of ' + phrases.length + ' rows');
  test.skip(!mine, 'no MB-owned dictionary phrase to probe (never probe a seeded phrase)');
  const rowId = mine!.id;
  await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu', 'Web_DictionaryManagement']);
  const ctx = await (browser as Browser).newContext();
  const p = await ctx.newPage();
  const stamp = Date.now().toString().slice(-6);
  try {
    await loginAs(p, MB, PASSWORD);
    await p.waitForTimeout(2500);
    const post = async (action: string, form: Record<string, string>) => {
      const r = await p.request.post(`${BASE}/${action}`, { form, failOnStatusCode: false });
      const text = (await r.text()).replace(/\s+/g, ' ').slice(0, 300);
      console.log(`POST ${action} -> ${r.status()} ${text}`);
      return { status: r.status(), text };
    };

    await test.step('NewRecord without DM_NewEntry is refused (Success false, "not authorized" / the process name)', async () => {
      const r = await post('NewRecord', { phrase: `MBSEC${stamp}`, language: 'English', translation: 'pw server side check', effectiveBegin: '10/09/2026', effectiveEnd: '12/31/2099', effectiveBeginClientTimezoneOffsetMinutes: '0', effectiveEndClientTimezoneOffsetMinutes: '0' });
      const refused = /"Success":false/i.test(r.text) && /authoriz|DM_NewEntry/i.test(r.text);
      if (!refused) deviation('Dictionary server-side authorization', 'NewRecord refused for a user without DM_NewEntry', `${r.status} ${r.text}`);
      expect.soft(refused, 'NewRecord refused').toBe(true);
    });

    await test.step('NewVersion without DM_NewVersion is refused (real MB test phrase id)', async () => {
      const r = await post('NewVersion', { id: rowId });
      const refused = /authoriz|DM_NewVersion/i.test(r.text);
      if (!refused) deviation('Dictionary server-side authorization', 'NewVersion refused for a user without DM_NewVersion', `${r.status} ${r.text}`);
      expect.soft(refused, 'NewVersion refused (message names the process)').toBe(true);
    });

    await test.step('Update without DM_Edit is refused (real MB test phrase id)', async () => {
      const r = await post('Update', { id: rowId, translation: 'x', effectiveBegin: '10/09/2026', effectiveEnd: '12/31/2099', effectiveBeginClientTimezoneOffsetMinutes: '0', effectiveEndClientTimezoneOffsetMinutes: '0' });
      const refused = /authoriz|DM_Edit/i.test(r.text);
      if (!refused) deviation('Dictionary server-side authorization', 'Update refused for a user without DM_Edit', `${r.status} ${r.text}`);
      expect.soft(refused, 'Update refused (message names the process)').toBe(true);
    });
  } finally {
    await ctx.close();
    await sec.setGroupProcesses(page, GROUP, []);
  }
});
