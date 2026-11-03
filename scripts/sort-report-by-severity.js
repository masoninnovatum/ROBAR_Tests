// Sorts the rows of an Issues sheet by Severity (Critical, High, High (needs decision), Medium, Low-Medium, Low), keeping the existing order inside a severity, renumbers column A and keeps every
// cell's style and note. Makes a backup copy first.   node scripts/sort-report-by-severity.js "<workbook.xlsx>" "<backup folder>"
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const ORDER = ['Critical', 'High', 'High (needs decision)', 'Medium', 'Low-Medium', 'Low'];
const rank = (s) => { const i = ORDER.indexOf(String(s).trim()); return i < 0 ? ORDER.length : i; };

(async () => {
  const file = path.resolve(process.argv[2]);
  const backupDir = path.resolve(process.argv[3]);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('Issues');
  const colCount = ws.getRow(1).cellCount;
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (!row.getCell(3).value) continue;
    const cells = [];
    for (let c = 1; c <= colCount; c++) { const cell = row.getCell(c); cells.push({ value: cell.value, style: JSON.parse(JSON.stringify(cell.style || {})), note: cell.note }); }
    rows.push({ idx: r, height: row.height, sev: cells[4].value, cells });
  }
  rows.sort((a, b) => rank(a.sev) - rank(b.sev) || a.idx - b.idx);
  rows.forEach((x, i) => {
    const row = ws.getRow(i + 2);
    x.cells.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      cell.value = j === 0 ? i + 1 : c.value;
      cell.style = c.style;
      // drop the note the previous row left in this cell (clear the field and the copy cached on the value model), then set only a real one: assigning undefined
      // would create an EMPTY note on every cell (yellow box on hover)
      cell._comment = undefined;
      if (cell._value && cell._value.model) delete cell._value.model.comment;
      if (c.note) cell.note = c.note;
    });
    if (x.height) row.height = x.height;
    row.commit();
  });
  await wb.xlsx.writeFile(file);
  console.log(`sorted ${rows.length} rows; severity order: ${rows.map((x) => x.sev).join(' / ')}`);
})();
