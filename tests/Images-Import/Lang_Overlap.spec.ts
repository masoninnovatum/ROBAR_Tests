// Investigation 2026-10-30 (FP report): new Web Menu (http://<srv>/ROBAR/) - with a long Language text such as "English - Canada" and several open
// module tabs, the user name ("[user]") starts overlapping the tabs. Measures the bounding boxes in the header while module tabs are opened one by one,
// once with "English" and once with "English - New Zealand" (TST703 has no English - Canada; New Zealand is the longest comparable entry).
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ROBAR } from '../../seed';

const OUT = path.join(__dirname, '..', '..', 'runs', 'Images_Import_Lang_Overlap_2026-10-30');
fs.mkdirSync(OUT, { recursive: true });
const NEW = ROBAR.url.replace(/innovatum\/WebMenu\/?$/i, '') + 'ROBAR/';
const WIDTH = Number(process.env.VW ?? 1400);
const LANG2 = process.env.LANG2 ?? 'en-NZ';
const MODS = ['Password Change', 'Schemas', 'Codes Management', 'Link Management', 'Lot Management', 'Dictionary Management', 'Security Management', 'Print History Inquiry', 'Label Control', 'Template Management'];

test(`new Web Menu: header overlap with long language text and many tabs (${WIDTH}px)`, async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: WIDTH, height: 900 });
  await page.goto(NEW);
  await page.fill('#userIDInput', ROBAR.username);
  await page.fill('#passwordInput', ROBAR.password);
  await page.click('input[type=submit]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const measure = async () => page.evaluate(() => {
    const r = (e: Element | null) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; };
    const tabs = Array.from(document.querySelectorAll('#moduleList > li')).filter((li) => (li as HTMLElement).offsetWidth > 0).map((li) => ({ text: (li.textContent || '').trim().slice(0, 24), ...r(li)! }));
    const u = r(document.querySelector('.loggedOnUserIDLabel'));
    const ln = r(document.querySelector('#langSelect'));
    const rt = r(document.querySelector('.navbar-right'));
    const lastTab = tabs.length ? Math.max(...tabs.map((t) => t.r)) : 0;
    return { tabs: tabs.length, lastTabRight: lastTab, wrappedRows: new Set(tabs.map((t) => t.t)).size > 1, user: u, lang: ln, rightBlock: rt, overlapUserPx: u ? Math.max(0, lastTab - u.l) : 0, overlapRightBlockPx: rt ? Math.max(0, lastTab - rt.l) : 0, scrollW: document.documentElement.scrollWidth, vw: window.innerWidth };
  });

  const openModule = async (name: string) => {
    await page.mouse.move(700, 400); // the menu's inactivity timer only resets on mousemove
    if (!(await page.locator('#mySidebar.sidebarOpen').count())) { await page.locator('#moduleDialogToggle').click({ timeout: 15_000 }); await page.waitForTimeout(800); }
    await page.locator('#mySidebar .moduleName', { hasText: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click({ timeout: 15_000 });
    await page.waitForTimeout(2500);
  };

  const pass = async (label: string, tag: string) => {
    const results: unknown[] = [];
    await page.screenshot({ path: path.join(OUT, `lang-${tag}-0tabs.png`) });
    results.push({ label, ...(await measure()) });
    for (let n = 1; n <= MODS.length; n++) {
      await openModule(MODS[n - 1]);
      const m = await measure();
      results.push({ label, openModules: n, ...m });
      console.log(`${label} tabs=${n} lastTabRight=${m.lastTabRight} userL=${m.user?.l} userR=${m.user?.r} langW=${m.lang?.w} rightBlockL=${m.rightBlock?.l} overlapUser=${m.overlapUserPx}px overlapRightBlock=${m.overlapRightBlockPx}px wrapped=${m.wrappedRows}`);
      if ([3, 6, 8, MODS.length].includes(n)) await page.screenshot({ path: path.join(OUT, `lang-${tag}-${n}tabs.png`) });
    }
    fs.writeFileSync(path.join(OUT, `lang-${tag}-measure.json`), JSON.stringify(results, null, 1));
  };

  await pass('English', `02-en-${WIDTH}`);
  await page.selectOption('#langSelect', LANG2);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  console.log('after language change selected =', await page.locator('#langSelect').evaluate((e: HTMLSelectElement) => e.selectedOptions[0].text));
  await pass(`Language ${LANG2}`, `03-${LANG2}-${WIDTH}`);
  await page.selectOption('#langSelect', 'en'); // restore the user's session language
  await page.waitForLoadState('networkidle');
});
