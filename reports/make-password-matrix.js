// One-off: builds the password-settings matrix workbook (DIT #6511/#6512 side quest, 2026-10-07).
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
// follow-up check: NeedsLetters = N and NeedsNumbers = N on every surface (results from test-data/pwmatrix-results-n.json)
const RN_FILE = path.join(__dirname, '..', 'test-data', 'pwmatrix-results-n.json');
const RND = fs.existsSync(RN_FILE) ? JSON.parse(fs.readFileSync(RN_FILE, 'utf8')) : {};
const RN_SURF = { SM: 'Security Management', EP: 'Expired Password page', PC: 'Password Change', PR: 'Password Reset' };
const RN_NOTE = Object.keys(RND).length ? 'RN live check (both rules N, restart + reset done): digits-only, letters-only, symbols-only and mixed-case passwords were ACCEPTED - not enforced.' : '';
const { SURFACES, SETTINGS, MATRIX, ROUNDS, CASES } = require('./password-matrix-data');

const OUT = process.argv[2] || path.join(__dirname, 'Password-Settings-Matrix.xlsx');
const wb = new ExcelJS.Workbook();
wb.creator = 'Claude (ROBAR training)';
const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const VCOL = { ENFORCED: 'FFC6EFCE', INDIRECT: 'FFFFEB9C', 'NOT READ': 'FFEDEDED', GAP: 'FFF8CBAD' };

function sheet(name, columns, rows, opts = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = HEAD;
  h.alignment = { vertical: 'middle', wrapText: true };
  h.height = 24;
  rows.forEach((r) => ws.addRow(r));
  ws.eachRow((row, n) => row.eachCell((c) => { c.border = border; if (n > 1) c.alignment = { vertical: 'top', wrapText: true }; }));
  if (opts.autoFilter) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

// README
const readme = wb.addWorksheet('README');
readme.columns = [{ width: 120 }];
[
  'Password settings x surfaces matrix (TST703) - prepared 2026-10-07 for Harini Pillalamarri (AdTech DIT #6511 / #6512 thread)',
  '',
  'Goal: for each password-related Global Setting, record how it behaves on (1) the New login page, (2) the New login page\'s password reset (Expired Password) page, (3) Security Management, (4) the Password Change module, (5) the Password Reset module - and where the gaps are, so one fix covers them all.',
  'Basis: the "Matrix" sheet is the EXPECTED behavior from a read of the 7.0.3 source and the formal scripts (Web_Menu_Improvements-1.1, PR_PasswordReset1.1, PR_UnlockAccount1.2). The "Test Plan" sheet lists every live case, grouped into setting-value ROUNDS (see "Rounds"); the Actual / Result columns are filled in as each round is executed on TST703. Source-based verdicts are marked as such until a case confirms them.',
  'Settings are GlobalSettings with owner LegacySettings. Current TST703 values: ChangeDays 90, ChangeOnReset Y, DaysBeforeReuse 365, FailLockCount 3, MinLength 5, NeedsLetters Y, NeedsNumbers Y (default is N). Every value change needs a ServiceHost restart + IIS reset (settings are cached).',
  'Surfaces and where they live: see "Surfaces". Test users are MB* accounts only (new MB users are created in Security Management); the seed user MBUser1 runs the tests.',
  'Result column values: Pass (behaved as expected), Gap (works differently from the expectation / a defect or missing rule), Blocked, N/A.',
].forEach((t, i) => { const r = readme.addRow([t]); r.alignment = { wrapText: true, vertical: 'top' }; if (i === 0) r.font = { bold: true, size: 13 }; });

// Surfaces
sheet('Surfaces', [{ header: 'Code', key: 'c', width: 8 }, { header: 'Surface', key: 's', width: 38 }, { header: 'Where / how to reach it (TST703)', key: 'u', width: 70 }, { header: 'Implemented in', key: 'i', width: 70 }], SURFACES);

// Settings
sheet('Settings', [{ header: 'Setting (owner LegacySettings)', width: 30 }, { header: 'Current TST703 value', width: 26 }, { header: 'How the code interprets it', width: 70 }, { header: 'Where it applies (from source)', width: 70 }], SETTINGS);

// Matrix
const mws = wb.addWorksheet('Matrix', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
mws.columns = [{ header: 'Setting', width: 28 }].concat(SURFACES.map((s) => ({ header: `${s[0]} - ${s[1]}`, width: 48 })));
const mh = mws.getRow(1); mh.font = { bold: true, color: { argb: 'FFFFFFFF' } }; mh.fill = HEAD; mh.alignment = { wrapText: true, vertical: 'middle' }; mh.height = 36;
for (const s of SETTINGS) {
  const row = [s[0]];
  for (const sf of SURFACES) {
    const [v, d] = MATRIX[s[0]][sf[0]];
    const rn = RN_NOTE && /^PasswordNeeds(Letters|Numbers)$/.test(s[0]) && ['EP', 'PC', 'PR', 'SM'].includes(sf[0]) ? `\n${RN_NOTE}` : '';
    row.push(`${v}: ${d}${rn}`);
  }
  const r = mws.addRow(row);
  r.eachCell((c, i) => { c.border = border; c.alignment = { wrapText: true, vertical: 'top' }; if (i > 1) { const v = String(c.value).split(':')[0]; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VCOL[v] || 'FFFFFFFF' } }; } else c.font = { bold: true }; });
}
const legend = mws.addRow([]);
mws.addRow(['Legend', 'ENFORCED = rule applied; INDIRECT = applied through the shared user check; NOT READ = the surface does not read the setting; GAP = a rule that should apply (per DIT #6512) is missing. All verdicts are source-based until the Test Plan cases confirm them.']);

// Rounds
const EXEC = { R1: '2026-10-07 - done', R2: '2026-10-07 - done', R3: '2026-10-07 - done', R4: '2026-10-07 - done', R5: '2026-10-07 - baseline restored and verified', RN: '2026-10-07 - done (16 cases, nothing enforced)', 'R6 (optional)': 'skipped (user decision)' };
const roundRows = ROUNDS.map(([id, title, vals, flip]) => [id, title, vals.PasswordChangeDays || '', vals.PasswordChangeOnReset || '', vals.PasswordDaysBeforeReuse || '', vals.PasswordFailLockCount || '', vals.PasswordMinLength || '', vals.PasswordNeedsLetters || '', vals.PasswordNeedsNumbers || '', flip, id === 'R1' ? '' : '2026-10-07', EXEC[id] || '']);
sheet('Rounds', [{ header: 'Round', width: 12 }, { header: 'Purpose', width: 44 }, { header: 'ChangeDays', width: 11 }, { header: 'ChangeOnReset', width: 14 }, { header: 'DaysBeforeReuse', width: 15 }, { header: 'FailLockCount', width: 13 }, { header: 'MinLength', width: 10 }, { header: 'NeedsLetters', width: 12 }, { header: 'NeedsNumbers', width: 12 }, { header: 'What the user flips (then restart ServiceHost + IIS reset)', width: 70 }, { header: 'Date applied', width: 14 }, { header: 'Executed', width: 28 }], roundRows);

// live results (test-data/pwmatrix-results.json) merged into the plan: extra keys such as SM-04b / EP-06a are folded into their base case
const RES_FILE =path.join(__dirname, '..', 'test-data', 'pwmatrix-results.json');
const RES = fs.existsSync(RES_FILE) ? JSON.parse(fs.readFileSync(RES_FILE, 'utf8')) : {};
const merged = (id) => {
  const keys = Object.keys(RES).filter((k) => k === id || (k.startsWith(id) && /^[a-z]$/i.test(k.slice(id.length))));
  if (!keys.length) return ['', '', ''];
  const actual = keys.map((k) => (keys.length > 1 ? `[${k}] ` : '') + RES[k].actual).join('\n');
  const result = keys.some((k) => RES[k].result === 'Gap') ? 'Gap' : keys.some((k) => RES[k].result === 'Blocked') ? 'Blocked' : 'Pass';
  const notes = [...new Set(keys.map((k) => RES[k].notes).filter(Boolean))].join('; ');
  return [actual, result, notes];
};

// follow-up cases RN-<surface>-<password kind> appended to the plan (round RN) with their live results
for (const k of Object.keys(RND)) {
  const m = /^N-(SM|EP|PC|PR)-(.+)$/.exec(k);
  if (!m) continue;
  CASES.push({ id: `RN-${m[1]}-${m[2]}`, round: 'RN', surface: m[1], setting: 'PasswordNeedsLetters + PasswordNeedsNumbers', title: `${RN_SURF[m[1]]}: ${m[2]} password with both rules off`, pre: 'Letters N, Numbers N, min 5 (user applied, restart + reset done)', steps: `Set an 8-character ${m[2]} password on ${RN_SURF[m[1]]}`, expected: 'Accepted (rules off)', _live: RND[k] });
}
const mergedRn = (c) => (c._live ? [c._live.actual, c._live.result, c._live.notes] : null);

// Test plan
const cws = sheet('Test Plan', [
  { header: 'Case', width: 9 }, { header: 'Round', width: 8 }, { header: 'Surface', width: 9 }, { header: 'Setting(s)', width: 26 }, { header: 'Title', width: 40 },
  { header: 'Preconditions', width: 34 }, { header: 'Steps', width: 52 }, { header: 'Expected (source / formal script)', width: 52 },
  { header: 'Actual (live)', width: 40 }, { header: 'Result', width: 10 }, { header: 'Evidence / notes', width: 30 },
], CASES.map((c) => [c.id, c.round, c.surface, c.setting, c.title, c.pre, c.steps, c.expected, ...(mergedRn(c) || merged(c.id))]), { autoFilter: true });
for (let r = 2; r <= CASES.length + 1; r++) {
  const cell = cws.getCell(`J${r}`);
  cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Pass,Gap,Blocked,N/A"'] };
  const v = String(cell.value || '');
  if (v) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: v === 'Gap' ? 'FFF8CBAD' : v === 'Pass' ? 'FFC6EFCE' : 'FFFFEB9C' } };
}

// Known gaps
sheet('Gaps (from source)', [{ header: '#', width: 5 }, { header: 'Gap / observation', width: 90 }, { header: 'Surface', width: 16 }, { header: 'Status', width: 28 }], [
  [1, 'Security Management does not enforce PasswordMinLength / NeedsLetters / NeedsNumbers / DaysBeforeReuse when a user is added (only "Password is required" and "Password values do not match"). Optional AddEditUserStoredProcedure hook exists but is empty by default. This is DIT #6512.', 'SM', 'CONFIRMED live R1+R2 (SM-01..03, SM-09): a 1-char, digits-only, letters-only and a 7-char password (min 8) were all accepted and those users logged in'],
  [2, 'PasswordChangeOnReset is seeded but no code reads it; the Reset tick / "Require user to change password on login" decides.', 'all', 'CONFIRMED live R2 (PR-11, SM-10): identical behavior at Y and N; no code reads it'],
  [3, 'The new login hides every failure reason: unknown user, wrong password, locked, disabled all show "Invalid UserID/Password" (reason only in the Activity table).', 'NL', 'CONFIRMED live R1/R3 (NL-03, NL-04, NL-08): locked, disabled, unknown user and wrong password all show the same text'],
  [4, 'Re-enabling a locked user with the Active tick in Security Management does not clear FailCount, so the user is still locked out until Password Reset > Unlock.', 'SM', 'CONFIRMED live R1 (SM-06): ticking Active again leaves the user locked out; Password Reset > Unlock or a reset is required'],
  [5, 'Password Change: policy and reuse are checked before the current password; reusing the CURRENT password is allowed (Expired Password page refuses it); the page needs no login.', 'PC', 'CONFIRMED live R1 (PC-06, PC-08, PC-09): new = current accepted; wrong current + invalid new not counted; page opens with no session'],
  [6, 'Password Reset: reuse failures and any server-side policy failure return only "The new password was invalid." (no specific reason).', 'PR', 'CONFIRMED live R1 (PR-05): generic "The new password was invalid." shown twice in the dialog'],
  [7, 'Message wording and rule sets differ between Expired Password, Password Change and Password Reset (e.g. "Your new password must..." vs "Your password must...!" vs "Password must contain...").', 'EP/PC/PR', 'CONFIRMED live R1 (EP-01..04, PC-01..04, PR-01..03): three different message sets for the same rules'],
  [8, 'Expired Password POST does not verify that the password is actually expired, and Password Change works without a session.', 'EP/PC', 'PC-09 confirmed live; EP direct-POST not tested (code-only)'],
  [10, 'The seed user MBUser1 (and probably any user whose PasswordSet is NULL / in the future) is never treated as expired: with PasswordChangeDays 0 every new user was sent to the Expired Password page but MBUser1 logged straight in on both login pages (R4).', 'NL', 'Observed live R4 (informational)'],
  [11, 'The Password Reset and Security Management lists show a disabled user as "Locked" (Enabled = N is treated as locked).', 'PR/SM', 'Observed live R1'],
  [9, 'Settings are cached; a blank / non-numeric numeric value throws an unhandled FormatException (MinLength, DaysBeforeReuse, ChangeDays).', 'all', 'Optional round R6'],
]);

// Follow-up: NeedsLetters = N and NeedsNumbers = N on every surface (customer report: "enforced even when disabled")
const RESN_FILE = path.join(__dirname, '..', 'test-data', 'pwmatrix-results-n.json');
if (fs.existsSync(RESN_FILE)) {
  const RN = JSON.parse(fs.readFileSync(RESN_FILE, 'utf8'));
  const nws = sheet('NeedsLetters-Numbers N check', [{ header: 'Case', width: 28 }, { header: 'What was done / actual', width: 110 }, { header: 'Result', width: 10 }, { header: 'Note', width: 50 }], Object.keys(RN).map((k) => [k, RN[k].actual, RN[k].result, RN[k].notes]));
  nws.addRow([]);
  [
    'Conclusion (TST703, both rules = N in Global Settings, ServiceHost restart + IIS reset done, 2026-10-07): the customer report could NOT be reproduced. Digits-only, letters-only, symbols-only and mixed-case-letters passwords of 8 characters were accepted on the New login Expired Password page, Security Management (always), Password Change and Password Reset; the Password Reset hidden fields showed needsLetters=false / needsNumbers=false.',
    'Code review - possible causes of "enforced although disabled": (1) STALE CACHE. SystemSettings.GetSetting keeps the settings in a static dictionary (reloaded only when a key is missing) and PasswordResetService reads them once when the service is constructed, so each process keeps its old value until it is restarted: the new web menu site (/ROBAR), the Innovatum site (Password Change), the UserMaintenance site (Password Reset front end) and the ROBAR ServiceHost (Password Reset service). A change followed by only an IIS reset, or only a ServiceHost restart, leaves some surfaces on the old value. (2) Typed settings default to TRUE: SystemSettings.PasswordNeedsLetters / PasswordNeedsNumbers return true when the setting cannot be read (try/catch), and are used by the ASP.NET membership providers; a missing / unreadable row therefore looks like "enabled". (3) The membership provider maps PasswordNeedsNumbers to MinRequiredNonAlphanumericCharacters (numbers are not non-alphanumeric characters). (4) Clients outside these five surfaces (for example ROBAR Designer) read the same settings with their own cache. (5) Only the exact value "Y" turns a rule on in the page code, so "N", blank or any other value is off.',
    'Suggested way to settle it: a partial-restart experiment (set both to Y with a full restart, then set both to N and restart ONLY ServiceHost, test the five surfaces, then restart ONLY IIS and test again) - not run yet.',
  ].forEach((t) => { const r = nws.addRow([t]); r.alignment = { wrapText: true, vertical: 'top' }; nws.mergeCells(r.number, 1, r.number, 4); r.height = 110; });
}

wb.xlsx.writeFile(OUT).then(() => console.log('written', OUT, CASES.length, 'cases'));
