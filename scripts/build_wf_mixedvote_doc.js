#!/usr/bin/env node
// Builds the shareable evidence + requirement-gap document for Training Issues Report row 6 (mixed-vote outcome, Workflow Management / View And Vote).
// Input: runs/WF_MixedVote_<date>/evidence.json + doc/*.png (cropped copies). Usage: node scripts/build_wf_mixedvote_doc.js <runDir> <out.docx>
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, Header, PageBreak } = require('docx');

const [runDir, outPath] = process.argv.slice(2);
const ev = JSON.parse(fs.readFileSync(path.join(runDir, 'evidence.json'), 'utf8'));
const R = ev.results;

const p = (text, opts = {}) => new Paragraph({ spacing: { after: 120 }, ...opts, children: Array.isArray(text) ? text : [new TextRun(text)] });
const b = (t) => new TextRun({ text: t, bold: true });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 }, children: [new TextRun(t)] });
const bullet = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: Array.isArray(t) ? t : [new TextRun(t)] });
const cell = (t, w, head = false) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  shading: head ? { type: ShadingType.CLEAR, fill: 'D9E2F3' } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({ children: [new TextRun({ text: t, bold: head, size: 20 })] })],
});
const table = (widths, rows) => new Table({
  width: { size: widths.reduce((a, c) => a + c, 0), type: WidthType.DXA },
  columnWidths: widths,
  rows: rows.map((r, i) => new TableRow({ children: r.map((t, j) => cell(t, widths[j], i === 0)) })),
});

const children = [];
children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Workflow Management / View And Vote: final status with mixed votes')] }));
children.push(p([b('Training Issues Report, row 6. '), new TextRun('Test evidence and requirement-gap explanation.')]));
children.push(table([2600, 6760], [
  ['Item', 'Value'],
  ['Environment', 'TST703 (vmsrvtst703), Workflow Management > View And Vote'],
  ['Date run', '2026-11-02'],
  ['Global setting', 'WFRejectHasVetoPower = N (default and current TST703 value); no step uses "Vote Counts As Veto"'],
  ['Voters', 'Claude01 (test user) and MBPWLogin01 (fixture user), two browser sessions, each vote signed with the electronic-signature dialog'],
  ['Workflows', `${R.S1.id} (scenario 1), ${R.S2.id} (scenario 2), ${R.S3.id} (scenario 3); all closed, throw-away presets deleted`],
]));

children.push(h1('1. Summary for the requirement author'));
children.push(p('With veto power off, a workflow can finish Approved although one of its voters rejected it, and the final status depends only on which vote is cast last. No requirement says what the final status should be in that situation, so the behaviour is neither right nor wrong against the written requirements. It needs a decision and a requirement.'));
children.push(table([3300, 3960, 2100], [
  ['Scenario (veto off)', 'Votes, in the order cast', 'Final status'],
  ['1. Two approval groups', 'Group 1 REJECT (workflow stays Open), then group 2 APPROVE', 'Approved'],
  ['2. One parallel group', 'User A REJECT (stays Open), then user B APPROVE', 'Approved'],
  ['3. Two approval groups, later group first', 'Group 2 APPROVE (accepted while group 1 is still pending), then group 1 REJECT', 'Rejected'],
]));
children.push(p(''));
children.push(p([b('Scenarios 1 and 3 use the same two votes and the same two users. '), new TextRun('Only the order differs, and the result is the opposite. Scenario 3 also shows that a later approval group can vote before an earlier one.')]));

children.push(h1('2. What the system does (from the code)'));
children.push(p('The vote service (WFViewAndVoteService.cs, Innovatum.Pages.Plugin.WFViewAndVote.WCF, about lines 1422-1470 in 7.0.3.20320) contains this comment and logic:'));
children.push(bullet('"If the globalsetting WFRejectHasVetoPower is off workflow header status will be determined by the last vote."'));
children.push(bullet('A vote with the Veto box ticked, or a Reject while WFRejectHasVetoPower = Y, sets the workflow header to Rejected immediately.'));
children.push(bullet('Any other vote only updates its own step. While at least one step is still Open the header stays Open. When the last step has voted, the header takes the status of that last vote.'));
children.push(bullet('Approval-group numbers are not used to block voting. They only drive the notification e-mails.'));

children.push(h1('3. The requirement gap'));
children.push(h2('What the requirements say today'));
children.push(bullet([b('WFI20140321001F100.9 / .9.1 / .9.2: '), new TextRun('view and vote optionally gives reject votes veto power, so that a single reject vote rejects the entire workflow; the global setting WFRejectHasVetoPower controls it.')]));
children.push(bullet('"The WfWorkflows header status will be updated to either Rejected or Approved by reviewing all the workflow steps" (ValMaster, View and Vote), with no rule for how the steps are combined.'));
children.push(bullet('WM.200727.F.3.11 / F.3.13 and FRS.RBR.IT.104.4 / 106.2 / 106.4 / 107.3: the step options "Vote Counts as Veto" and "Vote for Entire Group". Formal script WM_View_and_Vote-3.2 tests veto ON only.'));
children.push(bullet('WFE20131106001F100.1.3: steps are displayed in sequence by approval group. This is display only; nothing says an earlier group must vote first.'));
children.push(h2('What is missing'));
children.push(bullet('Every requirement describes veto ON ("a single reject rejects the workflow"). None says what happens when the setting is N. A reader can take N to mean "a reject is only one vote among several", but not how the votes are combined.'));
children.push(bullet('The "reviewing all the workflow steps" sentence implies a calculation across steps. The code does not do one: it copies the last vote.'));
children.push(bullet('No requirement says whether a later approval group may vote before an earlier group.'));
children.push(h2('Decisions needed'));
children.push(bullet([b('Final status with veto off: '), new TextRun('(a) Approved only if every step approved, so any reject means Rejected (the setting would then only control whether a reject closes the workflow at once or after the remaining votes); or (b) the last vote wins, stated as intended with the order dependence accepted; or (c) another rule, for example a majority.')]));
children.push(bullet([b('Voting order: '), new TextRun('must group 2 wait for group 1 (the later group cannot vote, or its vote is held), or is the order notification-only? If it is notification-only, say so in the requirement.')]));
children.push(bullet([b('Documentation and tests: '), new TextRun('once decided, add the rule to ValMaster and a veto-OFF case to the formal scripts (currently veto ON only). If the intended rule is (a), the code needs a change, so this would become a defect.')]));

children.push(h1('4. Screenshot evidence'));
children.push(p('Each screenshot is a desktop capture of one browser window; the address bar shows vmsrvtst703 and the logged-in user is shown top right.'));

const groups = {};
for (const e of ev.evidence) (groups[e.file[0]] ||= []).push(e);
const titles = {
  1: 'Scenario 1: two approval groups, group 1 rejects, group 2 approves',
  2: 'Scenario 2: one parallel approval group, one reject and one approve',
  3: 'Scenario 3: group 2 approves before group 1, then group 1 rejects',
};
for (const g of Object.keys(groups).sort()) {
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h2(titles[g]));
  for (const e of groups[g]) {
    const buf = fs.readFileSync(path.join(runDir, 'doc', e.file));
    children.push(new Paragraph({ keepNext: true, spacing: { before: 160, after: 60 }, children: [b(e.file.replace('.png', '') + '  '), new TextRun(e.caption)] }));
    children.push(new Paragraph({ spacing: { after: 160 }, children: [new ImageRun({ data: buf, type: 'png', transformation: { width: 600, height: Math.round(600 * 665 / 1400) } })] }));
  }
}

const doc = new Document({
  styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'Workflow Management / View And Vote: mixed-vote final status (TST703, 2026-11-02)', size: 18, color: '666666' })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(outPath, buf); console.log('wrote ' + outPath); });
