// FIXTURE BASELINE CANARY (headless, read-only by default): are the shared security fixtures the specs rely on still in their baseline state?
// Why: ~42 specs share the group MBPWLoginGrp and restore it at the end; a killed or timed-out spec leaves it EMPTY and every later fixture login then fails with
// "User not authorized for this task." (2026-11-12: Password_Change_Requirements failed 3 times before anyone looked at the group). This check collects every deviation
// and fails once with a clear message instead of many confusing failures later.
// Read-only unless CANARY_FIX=1: then the two MB/CL fixture groups below are restored to their baseline process set (assertMb guard in setGroupProcesses) and re-checked.
// To add a fixture: add a line to GROUP_BASELINES (exact process set) or INFO_GROUPS (logged only) / FIXTURE_USERS (user must exist, in this group).

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { BASE_URL, login } from '../../support/robar';
import * as sec from '../../support/security';
import { FIXTURE_USERS, OP_GROUP, OP_PROCESSES, TARGET_GROUP } from '../../Password-Management/pr-fixtures';
import { API_FIXTURE_USERS, API_GROUP, API_PROCESSES } from '../../API/api-fixtures';

/** Groups with a fixed, known process set. */
const GROUP_BASELINES: Array<{ group: string; processes: string[]; why: string }> = [
  { group: TARGET_GROUP, processes: ['Login_WebMenu'], why: 'shared by ~42 security specs and by the login fixtures MBPWLogin01 / CLPRTgtA01 / CLPRTgtB01 / CLPRLock01; empty = every fixture login is refused' },
  { group: OP_GROUP, processes: OP_PROCESSES, why: 'operator group of the Password Reset / Change specs (Login_WebMenu + ResetPassword_Option)' },
  { group: API_GROUP, processes: API_PROCESSES, why: 'REST API callers: every API_* process + LT_CLLabelType / LT_Carton Label / LT_MBLT1; the Items spec toggles LT_MBDOCX / LT_MBLT1 and a killed run can leave them changed' },
];
/** Groups without a fixed baseline: their process list is only logged. */
const INFO_GROUPS = ['MBTestGroup1'];
/** Users that must exist (they can never be deleted) and sit in the named group. MBPWLogin01 is the older login fixture. */
const USERS: Array<{ id: string; group: string }> = [{ id: 'MBPWLogin01', group: TARGET_GROUP }, ...FIXTURE_USERS.map((u) => ({ id: u.id, group: u.group })), ...API_FIXTURE_USERS.map((u) => ({ id: u.id, group: u.group }))];

const names = (m: Record<string, boolean>) => Object.keys(m).filter((k) => m[k]).sort();

test('@smoke @preflight shared security fixtures are in their baseline state', async ({ page }) => {
  test.setTimeout(300_000);
  const fix = process.env.CANARY_FIX === '1';
  const problems: string[] = [];
  const facts: string[] = [];

  // Reminder, never a failure: a build without a snapshot in docs/agents/build-snapshots has not been diffed against the previous build (npm run snapshot, then scripts/snapshot-diff.js).
  await page.goto(BASE_URL);
  await page.locator('.userID').waitFor({ timeout: 60_000 });
  const banner = (await page.locator('body').innerText()).match(/\b\d+\.\d+\.\d+\.\d+\b/)?.[0] ?? '';
  const snapDir = process.env.SNAPSHOT_DIR ? path.resolve(process.env.SNAPSHOT_DIR) : path.join(__dirname, '..', '..', '..', 'docs', 'agents', 'build-snapshots');
  if (banner && !fs.existsSync(path.join(snapDir, `${banner}.json`))) {
    const msg = `NO BUILD SNAPSHOT for ${banner}: run "npm run snapshot" and diff it against the previous build (node scripts/snapshot-diff.js <older> <newer>) before reading E2E failures`;
    console.log(`WARNING: ${msg}`);
    test.info().annotations.push({ type: 'warning', description: msg });
    facts.push(`build ${banner}: no snapshot yet`);
  } else facts.push(`build ${banner || '(unknown)'}: snapshot exists`);

  await login(page);
  let f = await sec.reopenSecurity(page);
  await sec.setView(f, 'GROUP');

  for (const b of GROUP_BASELINES) {
    if ((await sec.groupRow(f, b.group).count()) === 0) { problems.push(`group ${b.group} does not exist (${b.why})`); continue; }
    await sec.selectRow(page, f, sec.groupRow(f, b.group));
    let have = names(await sec.readProcesses(f));
    facts.push(`${b.group} = [${have.join(', ')}]`);
    const want = [...b.processes].sort();
    if (JSON.stringify(have) === JSON.stringify(want)) continue;
    const msg = `group ${b.group} holds [${have.join(', ') || 'nothing'}] but the baseline is [${want.join(', ')}] (${b.why})`;
    if (!fix) { problems.push(msg + ' - rerun with CANARY_FIX=1 to restore it'); continue; }
    console.log(`CANARY_FIX: restoring ${b.group}: ${msg}`);
    f = await sec.setGroupProcesses(page, b.group, b.processes);
    await sec.selectRow(page, f, sec.groupRow(f, b.group));
    have = names(await sec.readProcesses(f));
    facts.push(`${b.group} restored = [${have.join(', ')}]`);
    if (JSON.stringify(have) !== JSON.stringify(want)) problems.push(`group ${b.group} could not be restored (holds [${have.join(', ')}])`);
  }

  for (const g of INFO_GROUPS) {
    if ((await sec.groupRow(f, g).count()) === 0) { facts.push(`${g} = (not found)`); continue; }
    await sec.selectRow(page, f, sec.groupRow(f, g));
    const have = names(await sec.readProcesses(f));
    facts.push(`${g} = ${have.length} processes${have.length <= 6 ? ` [${have.join(', ')}]` : ''} (info only)`);
  }

  await sec.setView(f, 'USER');
  for (const u of USERS) {
    const row = sec.userRow(f, u.id);
    if ((await row.count()) === 0) { problems.push(`user ${u.id} does not exist (run the module's Setup_Fixtures spec)`); continue; }
    const text = (await row.first().innerText()).replace(/\s+/g, ' ').trim();
    facts.push(`user ${u.id}: ${text.slice(0, 90)}`);
    if (!new RegExp('(^|\\s)' + u.group + '(\\s|$)').test(text)) problems.push(`user ${u.id} is not in group ${u.group} (row: ${text.slice(0, 120)})`);
  }

  console.log(`FIXTURE BASELINE FACTS\n  ${facts.join('\n  ')}`);
  test.info().annotations.push({ type: 'fixture facts', description: facts.join('; ') });
  expect(problems, `shared fixtures are not in baseline:\n  - ${problems.join('\n  - ')}`).toEqual([]);
});
