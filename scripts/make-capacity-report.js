// Builds reports/QA-Capacity-Report-DRAFT.docx: manual QA benchmarks (Smartsheet) versus Claude + Playwright automation metrics (this repo). All figures are those read on 2026-10-22; see the report's data-source notes.
//   node scripts/make-capacity-report.js
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, HeadingLevel, BorderStyle, LevelFormat, PageOrientation } = require('docx');

const W = 12240 - 2 * 1080; // usable width in DXA (US Letter, 0.75 in margins)
const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const borders = { top: border, bottom: border, left: border, right: border };

const p = (text, opts = {}) => new Paragraph({ spacing: { after: 100 }, ...opts, children: [new TextRun({ text, ...(opts.run || {}) })] });
const bullet = (text) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 }, children: [new TextRun(text)] });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 }, children: [new TextRun(t)] });

function table(widths, header, rows, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, i, isHead, shade) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, borders,
    shading: isHead ? { fill: '1F3864', type: ShadingType.CLEAR, color: 'auto' } : shade ? { fill: shade, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new Paragraph({ alignment: i > 0 && opts.numeric ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(text), bold: isHead || (opts.boldLast && false), color: isHead ? 'FFFFFF' : undefined, size: 18 })] })],
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: header.map((t, i) => cell(t, i, true)) })].concat(
      rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, i, false, r.shade || (String(t).startsWith('ASSUMPTION') ? 'FFF2CC' : undefined))) }))),
  });
}
const assume = (t) => new Paragraph({ spacing: { after: 100 }, shading: { fill: 'FFF2CC', type: ShadingType.CLEAR, color: 'auto' }, children: [new TextRun({ text: t, italics: true })] });

const children = [];
children.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 60 }, children: [new TextRun({ text: 'QA Capacity Report: Manual Validation vs Claude + Playwright Automation', bold: true, size: 36 })] }));
children.push(p('DRAFT for review. Prepared 2026-10-22 from the Smartsheet validation and DIT sheets and the ROBAR_Tests repository.', { run: { italics: true } }));
children.push(assume('Reading guide: yellow cells and paragraphs are ASSUMPTIONS or open questions to settle before this goes to anyone else. Everything else is a count read from the sources listed in section 8.'));

children.push(h1('1. Summary'));
[
  'Manual capacity (Smartsheet, 2019-2026): the sheets show 116 to 139 formal validation scripts executed per year in 2019-2023 (counting rows that have an Execute value); 2024 (93) and 2025 (72) are lower, but those two sheets have many blank Execute cells, so they are probably undercounts. In 2026 so far: 109 executed (Mason 50, Nyya 30, Maurice 28, one by another tester), 108 of them dated, in two bursts: 57 between 5 and 26 June and 51 between 21 September and 9 October. The September burst is about 3.4 scripts per working day for the three of you together.',
  'Automation (this repo, built 2026-08-25 to 2026-10-20): 180 module spec files with 194 tests and 791 named steps, plus 9 smoke specs and 16 DIT-ticket UAT execution specs. A full module run takes about 5.8 to 8.1 hours unattended on one machine; the smoke tier takes about 22 minutes.',
  'The two are not like for like. A formal script produces signed, screenshot-backed evidence; an automated spec checks behavior repeatedly and cheaply but does not by itself produce the approved Word evidence. The honest comparison is regression capacity (automation) against validation evidence capacity (manual), and how much of each the other can free up.',
  'Largest capacity effect so far: the repeatable regression pass. One full module run replaces a pass that, done by hand, would occupy the team for weeks (about 43 working days at 4 hours per script and 6 productive hours per tester per day, if one test is treated as one script; see section 5.2).',
].forEach((t) => children.push(bullet(t)));

children.push(h1('2. Manual QA benchmarks (Validation sheets)'));
children.push(p('Source: the eight "Validation 20xx" Smartsheets. Each row is a test script / scenario. Execute, Pre-Review and Post Review hold the initials of the person who did that step. MB = Mason Baxter, NA = Nyya Adams, MA = Maurice Almon.'));
children.push(h2('2.1 Scripts executed per person per year (Execute column)'));
const exec = [
  ['2019', '24', '0', '0', '127', 'HV 53, EK 39 (others)'],
  ['2020', '29 (+2 shared)', '29 (+1 shared)', '0', '138', 'HV 64, TR 2'],
  ['2021', '44', '29', '0', '142', 'HV 57'],
  ['2022', '67', '38 (+1 shared)', '32 (+1 shared)', '151', ''],
  ['2023', '61', '35', '43', '149', ''],
  ['2024', '15 (+1 shared)', '27 (+1 shared)', '26', '193', '100 rows blank; SC 12, HV 12'],
  ['2025', '32 (+1 shared)', '22', '13', '124', '52 rows blank; AL 3-4'],
  ['2026 (to date)', '50', '30', '28', '116', 'HV 1; 7 rows blank'],
  ['Total', '322', '210', '142', '1,140', ''],
];
exec.at(-1).shade = 'D9E2F3';
children.push(table([1500, 1500, 1500, 1500, 1200, 3900], ['Year', 'Mason (MB)', 'Nyya (NA)', 'Maurice (MA)', 'Sheet rows', 'Notes'], exec));
children.push(p(''));
children.push(h2('2.2 Review work (Pre-Review and Post Review)'));
children.push(table([2400, 1900, 1900, 1900], ['Role', 'Mason', 'Nyya', 'Maurice'], [
  ['Pre-Review, all years', '210', '243', '177'],
  ['Post Review, all years', '335', '176', '156'],
  ['Post Review in 2026', '31', '4', '72'],
]));
children.push(p(''));
children.push(h2('2.3 2026 throughput by window (Date Completed)'));
children.push(table([3000, 1500, 1500, 1500, 1500], ['Window', 'Mason', 'Nyya', 'Maurice', 'Team'], [
  ['5 to 26 June (about 16 working days)', '29', '15', '12', '57 (incl. 1 other)'],
  ['21 Sept to 9 Oct (15 working days)', '21', '15', '15', '51'],
  ['Per working day, September window', '1.4', '1.0', '1.0', '3.4'],
]));
children.push(p('Caveats: many scripts carry the same completion date (for example 19 scripts dated 19 June), so the date may be when the status was updated, not when the work was done. 2024 and 2025 have many rows with no Execute value, so those years understate the real volume. Rows record scripts, not hours or substeps.', { run: { italics: true } }));

children.push(h1('3. Defect tracking benchmarks (DIT sheets)'));
children.push(table([3000, 2200, 2200, 2400], ['', 'Active sheet', 'Done sheet', 'Combined'], [
  ['Rows', '402', '6,545', '6,947'],
  ['Bugs', '218', '3,557', '3,775'],
  ['Enhancements', '78', '429', '507'],
  ['Projects', '49', '180', '229'],
  ['Code Reviews', '32', '177', '209'],
  ['Critical priority', '7', '260', '267'],
  ['Test result Green (done)', 'n/a', '5,287', ''],
]));
children.push(p(''));
children.push(table([3000, 2200, 2200, 2400], ['Reported / tested by', 'Active', 'Done', 'Combined'], [
  ['Reported By: Mason', '61', '87', '148'],
  ['Reported By: Maurice', '18', '30', '48'],
  ['Reported By: Nyya', '11', '28', '39'],
  ['Tested By: Mason', '30', '1,084', '1,114'],
  ['Tested By: Nyya', '9', '278', '287'],
  ['Tested By: Maurice', '5', '103 (+99 entered as email)', '207'],
]));
children.push(p('Caveats: the Done sheet holds 6,010 rows with no Reported By and its Tested By column mixes names, emails and multi-person entries, so counts are lower bounds. The active sheet currently has 264 tickets in status New. The Done sheet spans many years; no date filter was applied.', { run: { italics: true } }));
children.push(p('ValMaster (requirements): 8,945 rows (7,407 Active; FRS 6,954, URS 1,334, TRS 654). This is the size of the requirement base the validation scripts and the automation both draw on.'));

children.push(h1('4. Claude + Playwright automation metrics'));
children.push(h2('4.1 What exists'));
children.push(table([4200, 5880], ['Measure', 'Value (2026-10-22)'], [
  ['Elapsed build time', '8 weeks (first exploratory session 2026-08-25; repository commits from 2026-09-11, 41 commits)'],
  ['Module spec files in the full suite', '180 (194 tests, 791 named steps); the Acrobat edit spec is excluded until an admin repairs Acrobat'],
  ['Other automation', '9 smoke specs (about 22 minutes), 16 DIT-ticket UAT execution specs across 8 tickets, a smoke-test skill, a suite runner'],
  ['Modules with specs', '20 areas: Attachment/Link Management, Browser Printing, Campaign Manager, Codes, Destination Labeling, Dictionary, Field Definitions, Flex Printing, Label Control, Label Type, Lot, Master Data (incl. Schemas, Excel import), Print Entity, Print History Inquiry, Security Management, Template Management, Workflow, Cross-Module'],
  ['Headed specs (real mouse and keyboard, BarTender/Sentinel)', '49 of 205'],
  ['Code size', '30,787 lines of spec code and 3,617 lines of shared helpers (28 support files)'],
  ['Knowledge written', '15,255 lines of module notes, session logs and trackers in docs/agents, plus 64 memory notes'],
]));
children.push(p(''));
children.push(h2('4.2 Run time and stability'));
children.push(table([3000, 1700, 1700, 3680], ['Run', 'Wall-clock', 'Result', 'Notes'], [
  ['Full suite 2026-10-15', '8.06 h', '160 pass / 27 fail / 3 skip', 'baseline, no wait optimisation'],
  ['Full suite 2026-10-18/19, optimised waits', 'about 5.8 to 6.5 h (in pieces)', '161 / 16 / 18 after reruns', 'interrupted by a screen lock and a VPN drop; headed specs run first now'],
  ['Individual fixes since', 'n/a', '14 of the 16 failures fixed', 'remaining: Acrobat edit (blocked), one spec of another session'],
  ['Smoke tier', 'about 22 min', 'all tiers pass', 'preflight + tier 0/1/2'],
]));
children.push(p('A single clean end-to-end run after the latest fixes has not been done yet, so the 161 / 16 / 18 figure is a merge of partial runs.', { run: { italics: true } }));
children.push(h2('4.3 Findings produced'));
[
  '114 tracker rows logged since 2026-09-16 (defects, observations, requirement and wording differences, plus retractions and positive confirmations).',
  '48 curated findings in the report shared with development: 3 Critical, 2 High, 1 High (needs decision), 16 Medium, 13 Low-Medium, 13 Low. One has been filed as a DIT so far (#6624, Print History Inquiry grid shifted one column).',
  'Several automation-found items have already led to practical fixes or confirmations: DIT #6600 verified fixed; a customer UAT failure (step 38, missing quantity-field Print Configs) traced; the S_Ser label count rule documented; a customer file-name template error (grouping indicator) traced to installer defaults.',
  'About 28 formal and customer UAT documents were executed with Claude driving the browser or desktop (a consolidated batch of about 20 plus the DIT-ticket UATs). Signatures were entered or confirmed by you.',
].forEach((t) => children.push(bullet(t)));

children.push(h1('5. Capacity comparison'));
children.push(h2('5.1 Observed'));
children.push(table([3000, 3540, 3540], ['', 'Manual (3 testers)', 'Automation (1 test account, 1 desktop)'], [
  ['Peak observed output', '57 scripts in 16 working days (June 2026); 51 in 15 working days (Sept 2026)', '194 tests / 791 steps in one run of about 6 to 8 hours'],
  ['Per working day', 'about 3.4 scripts (team), 1.0 to 1.4 per person', 'one full regression pass per overnight window; up to about 3 full passes in 24 hours in theory'],
  ['Hard limits', 'people available, other duties, signatures, review time', 'a single shared test account (workers = 1), the desktop for 49 headed specs, test-data growth, VPN/screen-lock'],
  ['Output', 'signed formal scripts with screenshots (validation evidence)', 'pass/fail per test, reports, findings; formal evidence only where a UAT is executed through the skill'],
  ['Repeatability', 'each pass costs the same effort again', 'near-zero marginal cost per extra pass'],
]));
children.push(p(''));
children.push(h2('5.2 Capacity model (inputs from Mason, 2026-10-22)'));
children.push(p('Inputs given by Mason: one formal script takes about 4 hours to execute and capture evidence, and a tester has about 6 productive hours per day for validation. Both are estimates, not measured. The remaining assumption (yellow below) is that one automated test equals one formal script.'));
children.push(table([4200, 2900, 2980], ['', 'Calculation', 'Result'], [
  ['Theoretical manual capacity, 3 testers', '3 testers x 6 h / 4 h per script', '4.5 scripts per day'],
  ['Observed September rate vs theoretical', '3.4 / 4.5', 'about 76 percent'],
  ['ASSUMPTION: hand-executing the 194 automated tests once', 'if one test = about 1 formal script, 194 x 4 h / (3 x 6 h per day)', 'about 43 working days'],
  ['Automated full pass', 'unattended', 'about 0.3 days of machine time'],
]));
children.push(p('The 1 test = 1 script equivalence is deliberately generous to manual testing in some modules (a spec can cover more than a script) and unfavorable in others (formal scripts hold 60 to 90 substeps and signed evidence). A step-level mapping of specs to formal scripts and ValMaster requirements would settle it.', { run: { italics: true } }));
if (process.env.PREVIEW) {
  children.push(h2('5.3 Measured times from the formal scripts (Word editing time)'));
  children.push(p('Source: Word "Total editing time" read from 2,745 formal scripts on the QA share (release folders 2019 to 2026). Editing time accumulates inside a file and is carried along when a script is copied, so each figure is the increase between two copies of the same script. Last Saved By decides whose time it is; Ben Faulkner and Dana Buker, the original template authors, are excluded. Every figure is a LOWER BOUND: Word counts only time the document is open and being edited, not time in the application or capturing screenshots.'));
  children.push(p('Executing a completed script (Executed copy minus For_Execution copy):', { run: { bold: true } }));
  children.push(table([2800, 1300, 1300, 1300, 3380], ['Person', 'Scripts', 'Mean min', 'Median min', 'Middle half (25th to 75th pct)'], [
    ['Mason', '91', '122', '32', '13 to 93'],
    ['Nyya', '35', '103', '34', '10 to 94'],
    ['Maurice', '22', '102', '74', '19 to 142'],
    ['Team, including others', '482', '177', '49', '13 to 142'],
  ]));
  children.push(p(''));
  children.push(p('Your estimate for executing a script is about 4 hours (240 minutes). The Word-measured median of 49 minutes is about a fifth of that, which is what you would expect from a lower bound.'));
  children.push(p('Revising an existing script into a new formal script (For_Execution minus the copy it was made from):', { run: { bold: true } }));
  children.push(table([2800, 1300, 1300, 1300, 3380], ['Person', 'Versions', 'Median min', 'Under 1 hour', 'Comment'], [
    ['Mason', '61', '22', '38 of 61', '16 versions show 5 hours or more (not believable, see note)'],
    ['Nyya', '24', '36', '14 of 24', '4 versions show 5 hours or more'],
    ['Maurice', '7', 'n/a', '2 of 7', 'too few pairs to give a median'],
    ['Team, including others', '118', '24', '70 of 118', '32 versions show 5 hours or more'],
  ]));
  children.push(p(''));
  children.push(assume('Not measurable from the files: writing a NEW script from scratch. 344 script versions had no earlier copy to compare with, and the 32 revisions that show 5 hours or more (median about 61 hours, one 171 hours) are inherited totals or documents left open, not real authoring time. ASSUMPTION NEEDED: a figure for writing a new formal script (or a timed example).'));
  children.push(h2('5.4 Claude: creating formal test scripts from requirements (timed 2026-10-22)'));
  children.push(p('Task: create the formal test scripts for project 20251009-001 (Template Management Phase II) from the ValMaster requirements, following the formal-test-script-creation process (requirements pulled from ValMaster, template learned from a real script, every technical detail grounded in the source code, code-versus-requirement differences put to the QA manager, scripts built as Word documents with real form fields, automated format checks). The clock ran from the request to the last passing check.'));
  children.push(table([4300, 1900, 3880], ['Measure', 'Result', 'Note'], [
    ['Wall clock, start to finish', '51 min', 'includes a 23.5 minute wait for the QA manager'],
    ['Claude working time', 'about 27.5 min', 'wall clock minus the wait'],
    ['Scripts / scenarios / substeps', '6 / 39 / 150', '59 pages, about 737 form fields'],
    ['Requirements covered', '13 URS and 72 F-numbered rows', 'every row of the project'],
    ['Per script', 'about 4.6 min', 'working time divided by 6'],
    ['Per substep', 'about 11 s', 'working time divided by 150'],
  ]));
  children.push(p(''));
  children.push(p('Phases (elapsed from the start): requirements pulled and grouped 1 min 22 s; template learned 2 min 28 s; document builder written and tested 6 min 37 s; six code-grounding reports received in parallel by about 11 min; decision wait 23 min 32 s (not counted); six scripts drafted and built about 11 min; verification and fixes about 5 min. The builder and checker were written during this run, so a second module would carry less setup.'));
  children.push(p('How the new scripts compare with the existing Template Management scripts for the same project (existing scripts were written and reviewed by the team):', { run: { bold: true } }));
  children.push(table([3600, 2200, 4280], ['', 'Existing scripts', 'Claude scripts (draft)'], [
    ['Requirements listed in the script headers', '56 of 72 F-numbered rows', '72 of 72 (13 of 13 URS)'],
    ['Not listed by any existing script (16)', 'F.2.1, F.4.1, F.6.1, F.8.1, F.10.1, F.12.1 (localization); F.5.5, F.7.6, F.7.7, F.7.8 (download errors); F.11.1, F.11.2, F.11.7, F.11.8, F.11.10 (Generic Template Edit plugin); F.13.1', 'covered'],
    ['Substeps, same features', 'LabelCharacteristics 21, Edit Attributes 18, Download 8, Save As New 50, Create New Template 40, Submit to Workflow 97 (some also cover other requirements)', 'Filter by Data Source 25, Edit Attributes 24, Download 23, Save As New 34, Generic Template Edit 25, Submit non-.btw 19'],
    ['Review status', 'reviewed, dry run, executed in validation', 'not reviewed, not dry run'],
  ]));
  children.push(p(''));
  children.push(assume('Caveats: (1) listing a requirement in a script header is not proof that it has a step, and the existing localization script may cover some of the 16; this comparison is by header only. (2) The Claude scripts have not been reviewed or dry run, so review and correction time would be added. (3) Claude is not yet a measure of authoring effort for a person: it shows what a first draft costs when the QA manager decides only the code-versus-requirement policy. (4) Server-side authorization is not exercised by the new scripts, and F.1.7 needs a decision (the requirement says results narrow, the code widens them).'));
}
children.push(h2('5.4 What automation does not replace'));
[
  'Signed, reviewed validation evidence (Pre-Review, Post Review, approvals) that the formal process requires.',
  'Judgement on whether a difference is a defect: several early entries needed correction after you looked (a Reset button that does not exist, a delete icon that does work). Findings still need human review before they go to development.',
  'Environment work that needs an administrator or the real desktop: Acrobat repair, service restarts, global setting changes, real-printer checks.',
  'Anything where nobody has built the spec yet: coverage is 20 areas, not the full ValMaster base.',
].forEach((t) => children.push(bullet(t)));

children.push(h1('6. Observations on the data'));
[
  'Manual volume: rows with an Execute value per year were 116, 126, 130, 138 and 139 for 2019 to 2023, then 93 (2024) and 72 (2025) where many Execute cells are blank, and 109 so far in 2026. The 2024 and 2025 figures should be corrected with the real execution records before they are used as a benchmark.',
  'Reviewer load is uneven: Mason holds 335 of the 667 post-reviews recorded, Maurice took 72 of the 2026 post-reviews. This is a workload observation, not a performance judgement.',
  'The automation effort is front-loaded: the cost was 8 weeks of build and debugging; the marginal cost of a rerun is machine time. Maintenance cost is visible in this period: roughly 20 specs needed fixes within a week after setting, environment and desktop changes (the biggest causes were setting changes, a saved filter, a screen lock and a VPN drop).',
  'Run-time reduction work (waits, grid re-queries, shared reset helpers) cut a full pass from 8.06 h toward about 6 h without changing what is verified.',
].forEach((t) => children.push(bullet(t)));

children.push(h1('7. Open items before this is shareable'));
[
  'Replace the estimated 4 hours per script and 6 productive hours per day with measured figures if the report is used outside the team, and decide whether treating one test as one script is acceptable.',
  'Decide the comparison unit: scripts, steps, or ValMaster requirements covered. A requirement-coverage count by spec was not produced for this draft.',
  'Confirm whether the Validation sheets in 2024 and 2025 should be corrected for blank Execute cells before using them as a benchmark.',
  'Decide whether to include other time sinks (documentation, triage, customer support) in the manual benchmark; none are in these sheets.',
  'Decide whether per-person figures are appropriate for the audience; they can be shown at team level only.',
  'Run one clean full-suite pass so the reliability figure is a single run.',
].forEach((t) => children.push(bullet(t)));

children.push(h1('8. Data sources and method'));
[
  'Smartsheet (read only): Validation 2019 to 2026 (sheet ids 3981707012532100, 3268220921636740, 6914870789597060, 7622451308849028, 364405683709828, 6107120294383492, 469655849226116, 2235649666011012), Development Issue Tracking 7464007675209604, Development Issue Tracking - Done 8641246936754052, ValMaster - Innovatum 3214043046537092. Counts are server-side group-by totals; the 2026 window counts use a Date Completed filter.',
  'Repository: C:/Users/Mason/ROBAR_Tests (git history, spec and helper line counts, suite run reports in reports/suite/runs, docs/agents notes and dit-tracker.md).',
  'The Projects, bugs and enhancements views are the Type column of the two DIT sheets; no separate Projects sheet was found by name.',
  'Not read: individual script contents, ticket text beyond counts, hours worked.',
].forEach((t) => children.push(bullet(t)));

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, color: '1F3864', font: 'Calibri' }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, color: '2F5496', font: 'Calibri' }, paragraph: { outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '-', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children }],
});
const out = path.join(__dirname, '..', 'reports', process.env.PREVIEW ? 'QA-Capacity-Report-PREVIEW.docx' : 'QA-Capacity-Report-DRAFT.docx');
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(out, b); console.log('wrote', out); });
