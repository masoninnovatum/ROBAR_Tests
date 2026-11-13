// BUILD SNAPSHOT (headless, read-only, ~5 min): records the STRUCTURE of every non-print module page of the build under test, so two builds can be diffed with
// `node scripts/snapshot-diff.js <older.json> <newer.json>` and silent changes show up (a dropdown option, a grid column, a menu item, a button caption, a new tile ...).
// Output: docs/agents/build-snapshots/<build banner>.json (override the folder with env SNAPSHOT_DIR). Nothing is clicked except the module tiles; menus are read from the DOM
// (hidden menu items are in the DOM), print tiles are NOT opened (they can raise the Sentinel prompt), no record is created or changed.
// Volatile data is kept out on purpose: only the structure is stored (headings, captions, option lists of config-driven selects, column headers, tab names, input ids), selects with
// more than 40 options are stored as a count marker, URLs lose their id values. Take two snapshots of the SAME build to measure the noise before trusting a diff.
// Tile list = the Tier 0 smoke list (URL fragments recorded live 2026-10-14); a tile that is not on the menu or opens no page is recorded as such, not failed.

import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import type { Frame, Page } from '@playwright/test';
import { BASE_URL, login } from '../../support/robar';

const MODULES: Array<[string, string]> = [
  ['Master Data', 'masterdata/management'], ['Template Management', 'templatemanagement/management'], ['Dictionary Management', 'dictionarymanagement/management'],
  ['Campaign Manager', 'campaignmanager/'], ['View Label Master', 'itemlabelmasterview'], ['Label Control', 'labelcontrol/management'], ['Lot Management', 'heading=lot_management'],
  ['Workflow Management', 'workflowmanagement/management'], ['Label Type Management', 'heading=label_type_manag'], ['Bulk Master Review', 'labelmasterreview'],
  ['Master Data Excel Import', 'masterdataexcelimport'], ['Legacy Batch History', 'heading=legacy_batch_his'], ['Attachment Management', 'attachmentmanagement'],
  ['Attachment Upload', 'uploadattachments'], ['Link Management', 'linkmanagement'], ['Training Upload', 'trainingupload'], ['InnoView', 'innoview'],
  ['Print History Inquiry', 'heading=print_history_in'], ['MD Job Inquiry', 'masterdata/jobinquiry'], ['Job Inquiry', 'campaignmanager/jobinquiry'],
  ['Template Image Inquiry', 'templateimageinquiry'], ['Transmission Inquiry', 'com/transmissioninquiry'], ['Label History Inquiry', 'labelhistoryinquiry'],
  ['Label Type Excl.', 'labeltypeexclusion'], ['Printer Control', 'heading=printer_control'], ['Print Entity Management', 'printentity/management'],
  ['User Print Entity Management', 'printentity/usermanagement'], ['Badge Maintenance', 'userbadgemaintenance'], ['Password Reset', 'passwordreset'],
  ['Password Change', 'changepwd.aspx'], ['Security Management', 'security/management'], ['Codes Management', 'codes/management'], ['Field Defs Management', 'fielddefsmanagement'],
  ['Schemas', 'schemas/edit'], ['Trading Partner Config.', 'tradingpartnerconfiguration'], ['Facility Management', 'heading=facility_managem'],
  ['Global Settings Management', 'heading=global_settings_'], ['Print Config Management', 'heading=print_config_man'], ['Notifications Management', 'heading=notifications_ma'],
  ['Notifications Link Management', 'heading=notifications_li'], ['Dashboards Management', 'heading=dashboards_manag'], ['Dashboards Link Management', 'heading=dashboards_link_'],
  ['Prompt Samples', 'heading=prompt_samples'],
];

/** URL without the id values (page ids, sessions, item numbers): path + sorted parameter names; `heading` and `moduleName` keep their value because they identify the page. */
function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    const keys = [...new Set([...x.searchParams.keys()])].sort();
    const parts = keys.map((k) => (/^(heading|modulename|pageaction)$/i.test(k) ? `${k}=${x.searchParams.get(k)}` : k));
    return x.pathname.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '/{guid}').replace(/\/\d{3,}(\/|$)/g, '/{n}$1') + (parts.length ? '?' + parts.join('&') : '');
  } catch { return u; }
}

/** Runs in the page: the structure of one document. */
const HARVEST = () => {
  const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
  const uniq = (a: string[]) => [...new Set(a.filter(Boolean))].sort();
  const sel = (q: string) => Array.from(document.querySelectorAll(q));
  const selects: Record<string, string[]> = {};
  sel('select').forEach((s, i) => {
    const el = s as HTMLSelectElement;
    const id = el.id || el.name || `select#${i}`;
    const opts = Array.from(el.options).map((o) => clean(o.text));
    selects[id] = opts.length > 40 ? [`(${opts.length > 400 ? '400+' : 'many'} options)`] : opts;
  });
  const tables: Record<string, string[]> = {};
  sel('table').forEach((t, i) => {
    const heads = Array.from(t.querySelectorAll('th')).map((h) => clean(h.textContent)).filter(Boolean);
    if (heads.length) tables[(t as HTMLElement).id || `table#${i}`] = heads;
  });
  return {
    title: clean(document.title),
    headings: uniq(sel('h1,h2,h3,h4').map((e) => clean(e.textContent))),
    buttons: uniq([...sel('button').map((e) => clean(e.textContent)), ...sel('input[type=button],input[type=submit]').map((e) => clean((e as HTMLInputElement).value))]),
    links: uniq(sel('a').map((e) => clean(e.textContent)).filter((t) => t.length <= 60)).slice(0, 120),
    menus: uniq(sel('ul a, .ui-menu-item, [role=menuitem]').map((e) => clean(e.textContent)).filter((t) => t.length <= 60)).slice(0, 120),
    tabs: uniq(sel('.ui-tabs-nav li, [role=tab]').map((e) => clean(e.textContent))),
    labels: uniq(sel('label').map((e) => clean(e.textContent)).filter((t) => t.length <= 80)).slice(0, 150),
    // ids that hold a GUID or a long number (one checkbox per process / record) are normalised, so the list does not change with the data
    inputs: uniq(sel('input,textarea').map((e) => `${(e as HTMLInputElement).type || 'text'}:${(e as HTMLElement).id || (e as HTMLInputElement).name || ''}`.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{guid}').replace(/\d{4,}/g, '{n}'))).slice(0, 200),
    selects,
    tables,
  };
};

async function harvestOnce(fr: Frame): Promise<Record<string, unknown>> {
  const own = await fr.evaluate(HARVEST).catch((e) => ({ error: String(e).slice(0, 120) }));
  const kids: Array<unknown> = [];
  // blank frames (about:blank / empty URL) are transient helpers (upload targets, ajax) that exist in some loads only: not part of the page structure
  for (const c of fr.childFrames().filter((k) => k.url() && k.url() !== 'about:blank')) kids.push({ url: normalizeUrl(c.url()), ...(await c.evaluate(HARVEST).catch(() => ({}))) });
  return { url: normalizeUrl(fr.url()), ...(own as object), childFrames: kids };
}

/** Harvests until two reads one second apart are identical (Knockout / Dynamic UI pages fill in after load; a fixed delay gave different snapshots of the same build). */
async function harvestFrame(fr: Frame, page: Page): Promise<unknown> {
  // a nested frame that exists but still has no inputs / headings has not finished loading: keep waiting even when two reads are equal (two blank reads looked "stable" before)
  // (a shell page that has no inputs, no grid and no nested frame yet is also not loaded: Link Management showed that for several seconds)
  const incomplete = (o: Record<string, unknown>) => {
    const kids = (o.childFrames as Array<Record<string, unknown[]>>) ?? [];
    const shell = !((o.inputs as unknown[])?.length) && !Object.keys((o.tables as object) ?? {}).length && kids.length === 0;
    return shell || kids.some((c) => !(c.inputs && c.inputs.length) && !(c.headings && c.headings.length));
  };
  let prev = JSON.stringify(await harvestOnce(fr));
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const cur = await harvestOnce(fr);
    const s = JSON.stringify(cur);
    if (s === prev && !incomplete(cur)) return cur;
    prev = s;
  }
  return JSON.parse(prev);
}

async function tileTexts(page: Page): Promise<string[]> {
  return (await page.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim());
}

test('@snapshot record the structure of every non-print module page of this build', async ({ page }) => {
  test.setTimeout(1_200_000);
  await page.goto(BASE_URL);
  await page.locator('.userID').waitFor({ timeout: 60_000 });
  const banner = (await page.locator('body').innerText()).match(/\b\d+\.\d+\.\d+\.\d+\b/)?.[0] ?? 'unknown-build';
  await login(page);

  const snapshot: Record<string, unknown> = { build: banner, takenAt: new Date().toISOString(), baseUrl: BASE_URL, tiles: await tileTexts(page), modules: {} };
  const modules = snapshot.modules as Record<string, unknown>;

  // SNAPSHOT_ONLY="Link Management,Master Data" snapshots just those tiles (to re-check one page quickly)
  const only = (process.env.SNAPSHOT_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const [tile, fragment] of MODULES.filter(([t]) => !only.length || only.includes(t))) {
    await test.step(tile, async () => {
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 5000 }).catch(() => {});
      const idx = (await tileTexts(page)).indexOf(tile);
      if (idx < 0) { modules[tile] = { status: 'tile not on the menu' }; return; }
      await page.locator('button.menuIcon').nth(idx).click({ timeout: 10_000 }).catch(() => {});
      let fr: Frame | undefined;
      let text = '';
      for (let i = 0; i < 50; i++) {
        fr = page.frames().filter((f) => f.url().toLowerCase().includes(fragment)).pop();
        if (fr) {
          text = (await fr.locator('body').innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ').trim();
          if (text.length > 15) break;
        }
        await page.waitForTimeout(500);
      }
      if (!fr) { modules[tile] = { status: 'no page opened' }; return; }
      modules[tile] = { status: 'opened', ...((await harvestFrame(fr, page)) as object) };
      await page.locator('li.ui-tabs-tab:not(:has-text("Main Menu")) .ui-icon-close').first().click({ timeout: 2000 }).catch(() => {});
    });
  }

  const dir = process.env.SNAPSHOT_DIR ? path.resolve(process.env.SNAPSHOT_DIR) : path.join(__dirname, '..', '..', '..', 'docs', 'agents', 'build-snapshots');
  fs.mkdirSync(dir, { recursive: true });
  const suffix = process.env.SNAPSHOT_SUFFIX ? `__${process.env.SNAPSHOT_SUFFIX}` : '';
  const file = path.join(dir, `${banner}${suffix}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 1));
  const opened = Object.values(modules).filter((m) => (m as { status: string }).status === 'opened').length;
  console.log(`SNAPSHOT build ${banner}: ${opened}/${MODULES.length} modules opened, ${(fs.statSync(file).size / 1024).toFixed(0)} KB -> ${file}`);
});
