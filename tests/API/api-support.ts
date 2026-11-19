// Shared helpers for the REST API specs (TST703): an HTTP client that records every call as evidence, a READ-ONLY sqlcmd wrapper, and a helper that toggles one security process of the
// CL API group through the Security Management UI. Evidence per test is written to runs/API/<suite>_<stamp>/<test id>.json (Authorization headers are never stored).
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { request, test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import * as sec from '../support/security';
import { PASSWORD } from '../support/robar';
import { API_BASE, API_GROUP, API_USER, DB_NAME, DB_SERVER } from './api-fixtures';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Evidence
export type EvidenceStep = { at?: string; setup?: boolean } & (
  | { kind: 'http'; title: string; method: string; url: string; user: string | null; requestBody?: unknown; status: number; responseBody: unknown; ms: number; focus?: string }
  | { kind: 'sql'; title: string; query: string; rows: unknown[] }
  | { kind: 'log'; title: string; source: string; lines: string[] }
);

let steps: EvidenceStep[] = [];
// Playwright starts a NEW worker after every failed test, and the spec file is loaded again in each one: the run id and the evidence folder stamp are therefore created once in the runner
// process (the spec file is loaded there first) and inherited by every worker through the environment.
process.env.API_RUN_ID ??= Date.now().toString().slice(-8);
process.env.API_RUN_STAMP ??= new Date().toISOString().replace(/[-:]/g, '').slice(0, 13); // yyyymmddThhmm
export const RUN_ID = process.env.API_RUN_ID;
const STAMP = process.env.API_RUN_STAMP;
export function evidenceDir(suite: string): string {
  return path.join(__dirname, '..', '..', 'runs', 'API', `${suite}_${STAMP}`);
}

/** Registers hooks that clear the evidence before each test and save it afterwards (file name = the test title up to the first space). Call once inside the describe. */
export function useEvidence(suite: string): void {
  test.beforeEach(() => { steps = []; });
  test.afterEach(async ({}, info) => {
    const dir = evidenceDir(suite);
    fs.mkdirSync(dir, { recursive: true });
    const id = info.title.split(' ')[0].replace(/[^\w.\-]/g, '_');
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ test: info.title, status: info.status, annotations: info.annotations.filter((a) => a.type === 'wording difference').map((a) => a.description), steps }, null, 2));
  });
}

/** Adds a free-text step (for example "setup: item approved") to the evidence of the running test. */
export function note(title: string, data?: unknown): void {
  steps.push({ at: new Date().toISOString(), kind: 'sql', title, query: '', rows: data === undefined ? [] : [data] });
}

/** Marks the most recent evidence step as setup (a prerequisite, not the proof): the screenshot renderer hides setup steps unless asked. */
export function markLastSetup(): void {
  if (steps.length) steps[steps.length - 1].setup = true;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// HTTP
/** Evidence only: very long string values (for example a Base64 PDF of 700 KB) are cut to their first characters plus the length. */
export function shrink(v: any): any {
  if (typeof v === 'string') return v.length > 600 ? `${v.slice(0, 100)} ... (${v.length} characters)` : v;
  if (Array.isArray(v)) return v.map(shrink);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shrink(x)]));
  return v;
}

export interface Reply { status: number; text: string; json: any; contentType: string }

/**
 * One API call. user: API_USER (default) | another id | null (no Authorization header). password defaults to the seed test password (the CL fixture users share it).
 * Unknown-user calls must pass an explicit password so that no real user gets a failed login.
 */
export async function http(
  method: 'GET' | 'POST',
  route: string,
  o: { query?: Record<string, string>; body?: unknown; raw?: string; headers?: Record<string, string>; user?: string | null; password?: string; title?: string; focus?: string; timeout?: number; allowTimeout?: boolean } = {},
): Promise<Reply> {
  const user = o.user === undefined ? API_USER : o.user;
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.raw !== undefined) headers['Content-Type'] = 'application/json'; // raw = a body sent exactly as given (for example the JSON text null)
  if (user) headers.Authorization = 'Basic ' + Buffer.from(`${user}:${o.password ?? PASSWORD}`).toString('base64');
  const url = API_BASE + route + (o.query ? '?' + new URLSearchParams(o.query).toString() : '');
  const ctx = await request.newContext();
  const t0 = Date.now();
  try {
    let r;
    try {
      r = await ctx.fetch(url, { method, headers, data: (o.raw !== undefined ? o.raw : o.body) as any, ...(o.timeout !== undefined ? { timeout: o.timeout } : {}) });
    } catch (e) {
      if (!o.allowTimeout || !/Timeout/i.test(String(e))) throw e;
      // a call that is allowed to get no answer (a server print that waits for a printer dialog): evidence shows "no response" with status 0
      steps.push({ at: new Date().toISOString(), kind: 'http', title: o.title ?? `${method} ${route}`, method, url, user, requestBody: o.body, status: 0, responseBody: `(no response within ${Math.round((o.timeout ?? 0) / 1000)} s)`, ms: Date.now() - t0, focus: o.focus } as EvidenceStep);
      return { status: 0, text: '', json: undefined, contentType: '' };
    }
    const text = await r.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = undefined; }
    steps.push({ at: new Date().toISOString(), kind: 'http', title: o.title ?? `${method} ${route}`, method, url, user, requestBody: o.body, status: r.status(), responseBody: shrink(json ?? text), ms: Date.now() - t0, focus: o.focus, ...(o.raw !== undefined ? { requestBody: o.raw } : {}) } as EvidenceStep);
    return { status: r.status(), text, json, contentType: r.headers()['content-type'] ?? '' };
  } finally {
    await ctx.dispose();
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// SQL (read only)
export const lit = (s: string): string => `N'${s.replace(/'/g, "''")}'`;

/** Runs ONE select statement through sqlcmd (Windows login) and returns the rows (the query is wrapped as FOR JSON PATH). Anything that is not a single SELECT is refused. */
export function sql<T = any>(query: string, title = 'SQL', display?: { query: string; hide: string[] }): T[] {
  const q = query.trim().replace(/;\s*$/, '');
  if (!/^select\b/i.test(q) || /;/.test(q) || /\b(insert|update|delete|drop|alter|truncate|exec|merge|create)\b/i.test(q.replace(/'[^']*'/g, ''))) {
    throw new Error(`sql(): only a single read-only SELECT is allowed, got: ${q.slice(0, 120)}`);
  }
  const out = execFileSync('sqlcmd.exe', ['-E', '-S', DB_SERVER, '-d', DB_NAME, '-l', '15', '-y', '0', '-Q', `set nocount on; ${q} for json path, include_null_values`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const text = out.replace(/\r?\n/g, '').trim();
  if (/^Msg \d+, Level/.test(text)) throw new Error(`sqlcmd: ${text.slice(0, 300)} | Query: ${q.slice(0, 300)}`);
  const rows: T[] = text ? JSON.parse(text) : [];
  // display: what the evidence (screenshot) shows - the clean query and without helper columns that only serve the test's own time comparisons
  const shown = display ? rows.map((r: any) => Object.fromEntries(Object.entries(r).filter(([k]) => !display.hide.includes(k)))) : rows;
  steps.push({ at: new Date().toISOString(), kind: 'sql', title, query: display ? display.query : q, rows: shown });
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Items table helpers
const ITEM_COLS = 'ItemNumber, LabelType, LabelName, VersionNumber, Active, AllowPrint, Description, Description2, Description3, EffectiveBegin, EffectiveEnd, ApprovedBy, ApprovalDateTime';
export interface ItemRow {
  ItemNumber: string; LabelType: string; LabelName: string; VersionNumber: number; Active: string; AllowPrint: string; Description: string; Description2: string; Description3: string;
  EffectiveBegin: string; EffectiveEnd: string; ApprovedBy: string; ApprovalDateTime: string; secsSinceEnd: number; secsSinceApproval: number; secsSinceBegin: number;
}
/** All versions of an item (optionally one label type) with seconds since EffectiveEnd / ApprovalDateTime / EffectiveBegin measured on the database clock. */
export function itemRows(item: string, labelType?: string, title?: string): ItemRow[] {
  return sql<ItemRow>(
    `select ${ITEM_COLS}, datediff_big(second, EffectiveEnd, getdate()) secsSinceEnd, datediff_big(second, ApprovalDateTime, getdate()) secsSinceApproval, datediff_big(second, EffectiveBegin, getdate()) secsSinceBegin ` +
      `from Items where ItemNumber = ${lit(item)}${labelType ? ` and LabelType = ${lit(labelType)}` : ''} order by LabelType, VersionNumber`,
    title ?? `Items rows of ${item}${labelType ? ' / ' + labelType : ''}`,
    {
      query: `select ${ITEM_COLS.split(', ').join(', ')} from Items where ItemNumber = ${lit(item)}${labelType ? ` and LabelType = ${lit(labelType)}` : ''} order by LabelType, VersionNumber`,
      hide: ['secsSinceEnd', 'secsSinceApproval', 'secsSinceBegin'],
    },
  );
}
export function labelNameOf(labelType: string): string {
  const r = sql<{ LabelName: string }>(`select top 1 LabelName from Labels where LabelType = ${lit(labelType)} order by LabelName`, `a label name of ${labelType}`);
  if (!r.length) throw new Error(`label type ${labelType} has no label`);
  return r[0].LabelName;
}
export function lt(process: string): boolean {
  return sql<{ Authorized: string }>(`select Authorized from [security] where UserGroup = ${lit(API_GROUP)} and ProcessName = ${lit(process)}`, `${process} on ${API_GROUP}`)[0]?.Authorized === 'Y';
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Security (UI): set one process of the CL API group; returns whether it changed anything.
export async function setGroupProcess(browser: Browser, process: string, authorized: boolean): Promise<boolean> {
  const page = await browser.newPage();
  try {
    const f = await sec.openSecurity(page);
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, API_GROUP));
    const cur = await sec.readProcesses(f);
    if (!(process in cur)) throw new Error(`process ${process} is not in the Security Management list`);
    if (cur[process] === authorized) return false;
    const r = await sec.toggleProcess(page, f, API_GROUP, process, authorized);
    if (!r.Success) throw new Error(`could not set ${process}=${authorized} on ${API_GROUP}: ${JSON.stringify(r)}`);
    return true;
  } finally {
    await page.close();
  }
}

export { expect };

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Server application log (read only): the API writes <web root>\InnoAPI\Logs\AppLog_<yyyymmdd>.log. The folder is reachable through the admin share of the web server. Override with ROBAR_API_LOG_DIR.
export const API_LOG_DIR = process.env.ROBAR_API_LOG_DIR ?? `//${new URL(API_BASE).hostname}/c$/inetpub/wwwroot/InnoAPI/Logs`; // UNC path with forward slashes (the admin share of the web server)
function todaysLog(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return path.join(API_LOG_DIR, `AppLog_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.log`);
}
/** Remembers how long today's log is now; pass the mark to logSince() after the action under test. */
export function logMark(): { file: string; size: number } {
  const file = todaysLog();
  return { file, size: fs.statSync(file).size };
}
/** Everything written to the log since the mark (the log is busy: every database query is in it). Records ONE evidence step with the lines that match `show` (or the first lines). */
export function logText(mark: { file: string; size: number }): string {
  const size = fs.statSync(mark.file).size;
  const len = Math.max(0, size - mark.size);
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(mark.file, 'r');
  try { fs.readSync(fd, buf, 0, len, mark.size); } finally { fs.closeSync(fd); }
  return buf.toString('utf8');
}
/** Waits (the log is written with a delay and not always in time order) until `until` matches the text written since the mark, up to `seconds`. Returns the text. */
export async function logWait(mark: { file: string; size: number }, until: RegExp, seconds = 12): Promise<string> {
  let text = '';
  for (let i = 0; i < seconds; i++) {
    text = logText(mark);
    if (until.test(text)) return text;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return logText(mark);
}
export function logSince(mark: { file: string; size: number }, title: string, show?: RegExp, maxLines = 14): string {
  const text = logText(mark);
  const all = text.split(/\r?\n/).filter(Boolean);
  const picked = (show ? all.filter((l) => show.test(l)) : all).slice(0, maxLines).map((l) => (l.length > 230 ? l.slice(0, 229) + '…' : l));
  steps.push({ at: new Date().toISOString(), kind: 'log', title, source: path.basename(mark.file) + ` (${all.length} line(s) written during the test)`, lines: picked });
  return text;
}
