#!/usr/bin/env node
// Builds the investigation report for the two issues Harini reported from FP (2026-10-30):
//   1. Images schema import only imports some of the columns   2. Web Menu: long Language text -> user name overlaps the tabs
// Usage: node scripts/build_fp_issues_report.js   (reads screenshots + measure JSON from runs/Images_Import_Lang_Overlap_2026-10-30)
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, HeadingLevel, ShadingType } = require('docx');

const DIR = path.join(__dirname, '..', 'runs', 'Images_Import_Lang_Overlap_2026-10-30');
const OUT = path.join(DIR, 'FP_Reported_Issues_Investigation_2026-10-30.docx');

const p = (text, o = {}) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, ...o })] });
const b = (text) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun(text)] });
const h = (text, level = HeadingLevel.HEADING_2) => new Paragraph({ heading: level, spacing: { before: 200, after: 100 }, children: [new TextRun(text)] });
const mono = (text) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text, font: 'Consolas', size: 18 })] });

function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
function shot(file, caption, maxW = 600) {
  const buf = fs.readFileSync(path.join(DIR, file));
  const { w, h: hh } = pngSize(buf);
  const width = Math.min(maxW, w), height = Math.round(hh * (width / w));
  return [
    new Paragraph({ spacing: { before: 100, after: 40 }, keepNext: true, children: [new TextRun({ text: caption, bold: true, size: 20 })] }),
    new Paragraph({ spacing: { after: 160 }, children: [new ImageRun({ data: buf, transformation: { width, height }, type: 'png' })] }),
  ];
}
function table(rows, widths) {
  return new Table({
    width: { size: widths.reduce((a, c) => a + c, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((c, j) => new TableCell({
        width: { size: widths[j], type: WidthType.DXA },
        shading: i === 0 ? { type: ShadingType.CLEAR, fill: 'D9E2F3' } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: String(c), bold: i === 0, size: 18 })] })],
      })),
    })),
  });
}
function measureRows(tag, label) {
  const f = path.join(DIR, `lang-${tag}-measure.json`);
  if (!fs.existsSync(f)) return [];
  return JSON.parse(fs.readFileSync(f, 'utf8')).filter((m) => m.openModules).map((m) => [label, m.openModules, m.lastTabRight, m.user ? m.user.l : '', m.overlapUserPx + ' px', m.wrappedRows ? 'yes' : 'no']);
}

const kids = [];
kids.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Investigation: two issues reported from FP')] }));
kids.push(p('Reported by Harini Pillalamarri, 2026-10-30. Tested on TST703 (VMSRVTST703), build 7.0.3.20198, user Claude01, 2026-10-30. Nothing was filed as a DIT.'));

kids.push(h('Summary', HeadingLevel.HEADING_1));
kids.push(table([
  ['#', 'Reported issue', 'Reproduced on TST703?', 'Finding'],
  ['1', 'Images schema: Excel import only imports some of the columns', 'Yes', 'A newly imported Images record keeps Image Extension, Image Type, Image Revision, Document Reference and Destination Folder, but ECN and Workflow Preset come back BLANK (and the three protected columns, Workflow ID / Workflow Status / Image File, are never imported). The same values re-imported over an existing record (update) ARE kept, and a record created in the UI keeps them. Cause: an AFTER INSERT trigger on the masterdata table blanks those fields on every new Images row.'],
  ['2', 'New Web Menu: the user name overlaps the open tabs', 'Yes', 'The header user name / language / Log off / Help block is absolutely positioned and the tab list is not limited to the space left, so the tabs run underneath it. At 1400 px wide: English overlaps from the 5th open tab, English - New Zealand from the 4th (up to 189 px). At 1920 px wide: English never overlaps, English - New Zealand overlaps (27 px) from the 7th tab. TST703 has no English - Canada.'],
], [400, 2600, 1500, 4860]));

// ---------------- Issue 1
kids.push(h('Issue 1 - Image Workflow Automation: Images schema import only imports some of the columns', HeadingLevel.HEADING_1));
kids.push(h('What was tested'));
kids.push(b('Schema "Images" (the Image Workflow Automation schema, 11 fields; "Has Data" on TST703). Master Data Excel Import page, schema = Images, Download Template, then three imports built from the template headers. Each record was read back from Master Data > View/Edit (both tabs).'));
kids.push(b('Comparison paths: the same fields entered by hand in the UI, and a second import over the existing unapproved record.'));
kids.push(b('Send To Workflow was only ever imported as False so the Image Workflow Automation EXE could not pick the test records up. Nothing was approved.'));
kids.push(h('Results'));
kids.push(table([
  ['Field (slot)', 'Protected?', 'In template?', 'New record by import', 'Re-import over existing record', 'Created in the UI'],
  ['Image Extension (Text1)', 'No', 'Yes', 'Saved', 'Saved', 'Saved'],
  ['Image Type (Text2)', 'No', 'Yes', 'Saved', '-', '-'],
  ['Image Revision (Text3)', 'No', 'Yes', 'Saved', 'Saved', 'Saved'],
  ['Document Reference (Text4)', 'No', 'Yes', 'Saved', '-', '-'],
  ['Destination Folder (Text5)', 'No', 'Yes', 'Saved', '-', '-'],
  ['ECN (Text6)', 'No', 'Yes', 'NOT saved (blank)', 'Saved', 'Saved'],
  ['Send To Workflow (Text7)', 'No', 'Yes', 'False imported; True not tested', '-', '-'],
  ['Workflow Preset (Text8)', 'No', 'Yes', 'NOT saved (blank)', 'Saved (ImgPreset1)', '-'],
  ['Workflow ID (Text9)', 'Yes', 'No', 'Not imported', '-', '-'],
  ['Workflow Status (Text10)', 'Yes', 'No', 'Not imported', '-', '-'],
  ['Image File (Text11)', 'Yes', 'No', 'Not imported', '-', '-'],
], [2100, 900, 900, 1900, 2000, 1060]));
kids.push(p(''));
kids.push(p('In every import the job finished with status Completed and an empty Errors Only grid, so the user gets no sign that values were dropped. Records used: CLIMG044824 (all columns incl. the protected ones), CLIMGA827831 (ECN only; later re-imported), CLIMGB827831 (all template columns), CLIMGU001980 (created in the UI).'));
kids.push(h('Cause (source + behaviour)'));
kids.push(b('Protected columns: the importer deliberately skips protected fields (MasterDataImporter.SetMasterDataPropertyIfExists / ...WithDefault) and Download Template leaves them out (GetImportTemplate_ExcludeProtectedFields). Workflow ID, Workflow Status and Image File are protected in the Images schema, so they can never be imported. This is by design.'));
kids.push(b('ECN and Workflow Preset are NOT protected, but the trigger trg_masterdata_clear_mdm_images_fields_on_insert (Robar/DB/UpgradeScripts/ImageWorkflowAutomation_Upgrade.sql; fresh installs: Innovatum.Install/ROBARDB/BaseProductTables/MasterData/MasterData_CustomSQL.sql) fires AFTER INSERT on masterdata for the Images schema and sets Workflow Status, Workflow ID, ECN, Workflow Preset and Image File to blank whenever any of them has a value. Its comment says the purpose is to stop "Save as new version" carrying stale workflow state onto the new revision.'));
kids.push(b('The Excel import creates the row with every value in a single INSERT, so the trigger blanks ECN and Workflow Preset right away. The UI creates the (empty) row first and saves the values afterwards as an UPDATE, so the trigger never sees them; a re-import over an existing unapproved record is also an UPDATE. That matches all three observations above.'));
kids.push(b('Not verified directly: the trigger itself on the TST703 database (no SQL access was used). The behaviour matches the trigger exactly.'));
kids.push(b('Effect on the feature: a record imported with Send To Workflow = True would have no Workflow Preset, so the automation cannot submit it (the EXE reports "Preset Invalid - Not Submitted"). Not run here, to keep the automation from touching test records.'));
kids.push(h('Suggested direction (for the developers)'));
kids.push(b('Limit the trigger to rows that really are copies of a prior version (for example only when the inserted row has a previous version), or let the import write ECN / Workflow Preset after the insert.'));
kids.push(b('Independently: the import reports Completed with no message when it drops values; consider a warning, and document that Workflow ID / Workflow Status / Image File are system-managed.'));
kids.push(b('Ask FP for the sheet they import and the columns they miss; if they are anything other than ECN / Workflow Preset / the three protected columns this analysis does not explain it. Their schema may also be named differently ("FP Images" exists on TST703 and the trigger only applies to a schema named exactly "Images").'));
kids.push(h('Screenshots'));
kids.push(...shot('img-02-import-page.png', 'Issue 1 - Step 1: Master Data Excel Import page, Images schema (Download Template offered)'));
kids.push(...shot('B_all_template_cols-job-detail.png', 'Issue 1 - Step 2: import of a sheet with every template column finishes Completed with no errors (job 7061)', 640));
kids.push(...shot('B_all_template_cols-record-general.png', 'Issue 1 - Step 3: imported record CLIMGB827831, General tab - Extension, Type, Revision, Document Reference, Destination Folder saved; ECN is blank (sheet had ECN-B-827831)'));
kids.push(...shot('B_all_template_cols-record-workflow.png', 'Issue 1 - Step 4: same record, Workflow tab - Workflow Preset is blank (sheet had ImgPreset1)'));
kids.push(...shot('ui-reopen-05-saved-record.png', 'Issue 1 - Step 5: record CLIMGU001980 created by hand in the UI - ECN (ECN-UI-001980) is kept after reopening'));
kids.push(...shot('reimport-readback-05-saved-record.png', 'Issue 1 - Step 6: CLIMGA827831 (first import had left ECN blank) re-imported over the existing record - ECN-REIMPORT is now saved'));
kids.push(...shot('reimport-readback-06-saved-record-workflow-tab.png', 'Issue 1 - Step 7: same record, Workflow tab - Workflow Preset ImgPreset1 is now saved'));

// ---------------- Issue 2
kids.push(h('Issue 2 - New Web Menu: user name overlaps the tabs with a long Language text', HeadingLevel.HEADING_1));
kids.push(h('What was tested'));
kids.push(b('New Web Menu (http://vmsrvtst703/ROBAR/), user Claude01, browser window 1400 px wide and again 1920 px wide. Ten modules were opened one at a time from the Modules list; after each one the position of the last tab and of the "[Claude01]" label was measured in the page (bounding boxes).'));
kids.push(b('Language list on TST703: English, Danish, English - New Zealand, Spanish, Spanish - Mexico, French, Italian, Chinese - China. There is no English - Canada, so English - New Zealand (the longest English entry) was used. The language was set back to English at the end.'));
kids.push(h('Results'));
const rows = [['Language', 'Tabs open', 'Last tab right edge (px)', 'User name left edge (px)', 'Tabs run under the user name by', 'Tabs wrapped to 2nd row']];
rows.push(...measureRows('02-en-1400', 'English, 1400 px'), ...measureRows('03-en-NZ-1400', 'English - New Zealand, 1400 px'), ...measureRows('02-en-1920', 'English, 1920 px'), ...measureRows('03-en-NZ-1920', 'English - New Zealand, 1920 px'));
kids.push(table(rows, [2200, 800, 1500, 1500, 2000, 1360]));
kids.push(p(''));
kids.push(b('At 1400 px: English overlaps by 35 px from the 5th tab; English - New Zealand overlaps by 47 px at 4 tabs and 189 px from 5 tabs. After 5 tabs the tab list wraps to a second row but the first row still reaches under the user name.'));
kids.push(b('At 1920 px: English never overlaps (the tab row stops at 70% of the bar, 1308 px, and wraps; the right-hand block starts at 1435 px). English - New Zealand overlaps by 27 px from the 7th tab, because its right-hand block starts at 1332 px, left of where the 70% tab row ends (1359 px).'));
kids.push(b('So it is a collision between the fixed 70% tab area and a right-hand block that grows with the language: it needs the right-hand block to be wider than the remaining 30% of the window. A longer language text therefore matters (as reported), and it shows sooner on smaller windows, where even English collides.'));
kids.push(b('On TST703 the en-NZ resources carry test prefixes ("en-NZ - Log off", "en-NZ - Help", "en-NZ - Modules"), so the right-hand block is about 100 px wider than in English. The language drop-down itself is the same width (187 px) in every language because it takes the width of its longest option. Real translated captions may be shorter than these prefixed ones, so the exact tab count where it starts will differ at FP.'));
kids.push(h('Cause (source)'));
kids.push(b('Innovatum.WebMenu/Views/WebMenu/MainMenuLayout.cshtml: the tab list sits in a normal-flow "navbar-collapse openModuleListDiv"; the block with the user name, language drop-down, Log off, Help, bell and gear (partial _LoginPartial) sits in a second div with style="position: absolute; right: 5px;". The absolutely positioned block takes no space, so the tab list does not know where to stop.'));
kids.push(b('Content/Site.css: .openModuleListUL { width: 70% } is a fixed percentage of the bar, not "whatever the right-hand block leaves". The right-hand block grows with the language text and button captions, the tab list does not shrink, so they collide.'));
kids.push(h('Suggested direction (for the developers)'));
kids.push(b('Put the two parts in one flex row (tabs flex: 1 with min-width: 0 and wrapping, right block flex: none), or give the tab list a right margin equal to the right block width, instead of absolute positioning plus a 70% width.'));
kids.push(h('Screenshots'));
kids.push(...shot('lang-02-en-1400-6tabs.png', 'Issue 2 - Step 1: English, 6 tabs open - "[Claude01]" is drawn on top of the "Lot Management" tab'));
kids.push(...shot('lang-03-en-NZ-1400-6tabs.png', 'Issue 2 - Step 2: English - New Zealand, 6 tabs open - the user name sits on the "Link Management" tab and the "Lot Management" tab is hidden behind the language drop-down'));
kids.push(...shot('lang-03-en-NZ-1400-3tabs.png', 'Issue 2 - Step 3: English - New Zealand, 3 tabs open - no overlap yet (for comparison)'));
kids.push(...shot('lang-03-en-NZ-1400-10tabs.png', 'Issue 2 - Step 4: English - New Zealand, 10 tabs open'));
kids.push(...shot('lang-03-en-NZ-1920-8tabs.png', 'Issue 2 - Step 5: 1920 px wide window, English - New Zealand, 8 tabs open - smaller overlap, still present'));
kids.push(...shot('lang-02-en-1920-8tabs.png', 'Issue 2 - Step 6: 1920 px wide window, English, 8 tabs open - no overlap (for comparison)'));

// ---------------- housekeeping
kids.push(h('Test data left on TST703 and files', HeadingLevel.HEADING_1));
kids.push(b('Unapproved Images records (v0): CLIMG044824, CLIMGA827831, CLIMGB827831, CLIMGU001980; no FP Images record was created (its import was rejected on the Workflow Preset value ImgPreset1, "Workflow Preset: InvalidValue" - not investigated further). Images schema fields were not changed. No settings were changed; Claude01 language restored to English.'));
kids.push(b('Specs: ROBAR_Tests/tests/Images-Import/ (Images_Import_Columns, Images_Import_Cases, Images_UI_Create, Images_Reimport, Readback, Lang_Overlap). Evidence: ROBAR_Tests/runs/Images_Import_Lang_Overlap_2026-10-30/. Screenshots are page captures (no browser address bar).'));

const doc = new Document({ sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children: kids }] });
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('wrote', OUT); });
