// Builds Training-Issues-Report.xlsx from issues-data.js (run: node reports/make-report.js <output.xlsx>)
const ExcelJS = require('exceljs');
const rows = require('./issues-data.js');

const out = process.argv[2] || 'Training-Issues-Report.xlsx';
const typeLabel = { D: 'Defect', O: 'Observation / to confirm', S: 'Script / wording difference' };

(async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Claude (QA training sessions)';
  const ws = wb.addWorksheet('Issues', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: '#', key: 'n', width: 5 },
    { header: 'Module', key: 'module', width: 26 },
    { header: 'Type', key: 'type', width: 16 },
    { header: 'Severity (QA view)', key: 'severity', width: 14 },
    { header: 'Description (what the user experiences)', key: 'description', width: 70 },
    { header: 'Root Cause', key: 'rootCause', width: 55 },
    { header: 'Possible Corrective Action', key: 'action', width: 55 },
    { header: 'DIT (existing Development Issue Tracking match)', key: 'dit', width: 38 },
  ];
  const sevOrder = (s) => (/^Critical/.test(s) ? 0 : /^High/.test(s) ? 1 : /^Medium/.test(s) ? 2 : /^Low-Medium/.test(s) ? 3 : 4);
  const sorted = rows.map((r, i) => ({ ...r, i })).sort((a, b) => sevOrder(a.severity) - sevOrder(b.severity) || a.i - b.i);
  sorted.forEach((r, idx) => ws.addRow({ n: idx + 1, module: r.module, type: typeLabel[r.type] || r.type, severity: r.severity, description: r.description, rootCause: r.rootCause, action: r.action, dit: r.dit }));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 32;
  ws.eachRow((row, n) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
    });
    if (n > 1) {
      const sev = String(row.getCell(4).value);
      const color = /^Critical/.test(sev) ? 'FFF8CBAD' : /^High/.test(sev) ? 'FFFFE699' : null;
      if (color) row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      const dit = String(row.getCell(8).value);
      if (/^#\d+/.test(dit)) row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } }; // exact DIT match
      else if (/^Related/.test(dit) || /^None for this symptom/.test(dit) || /^None found for this symptom/.test(dit)) row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    }
  });
  ws.autoFilter = { from: 'A1', to: 'H1' };

  const about = wb.addWorksheet('Read me');
  about.columns = [{ width: 110 }];
  [
    'Issues found during the exploratory / Playwright training sessions on TST703 (Suite 7, 7.0.3.20198), 2026-09-16 to 2026-10-08.',
    '',
    'Columns: Description = the issue and what the user experiences; Root Cause = what in the code/config causes it (or "Not diagnosed" when it could not be traced); Possible Corrective Action = what would fix it; DIT = an existing Development Issue Tracking ticket that matches.',
    'Type: Defect = reproduced / confirmed; Observation = behavior to confirm with developers (may be by design); Script / wording difference = formal script and product disagree.',
    'DIT colors: green = the DIT describes the same issue; blue = related ticket only (same area / different defect); no color = no matching DIT found.',
    '',
    'How DIT matches were found: the Development Issue Tracking sheet (459 rows) was searched READ-ONLY by module and symptom keywords (Description, Root Cause and Corrective Action columns). Nothing in the DIT sheet was changed. A "None found" means no ticket with a matching description was found by those searches - a manual look by someone who knows the history is still worthwhile.',
    'Root causes marked as read from code come from the 7.0.3 source tree on the QA workstation. Items marked "Not diagnosed" need server/IIS logs or database access to trace.',
    'Several rows were confirmed live with Playwright specs under ROBAR_Tests (see .agents/dit-tracker.md for the spec names and the full history). Nothing has been filed or sent to developers from these sessions.',
  ].forEach((t) => about.addRow([t]).getCell(1).alignment = { wrapText: true, vertical: 'top' });
  about.getRow(1).font = { bold: true, size: 13 };

  await wb.xlsx.writeFile(out);
  console.log(`wrote ${out} (${rows.length} issues)`);
})();
