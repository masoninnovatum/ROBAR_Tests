// Removes empty cell notes (comments) from every sheet of a workbook, keeping the real ones.   node scripts/remove-empty-notes.js "<workbook.xlsx>"
const ExcelJS = require('exceljs');
(async () => {
  const file = process.argv[2];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  let removed = 0, kept = 0;
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: true }, (row) => row.eachCell({ includeEmpty: true }, (cell) => {
      const n = cell.note;
      if (n === undefined || n === null) return;
      const text = typeof n === 'string' ? n : (n.texts || []).map((t) => t.text).join('');
      if (String(text).trim()) { kept++; return; }
      cell._comment = undefined; // ExcelJS has no public way to delete a note: clear the field and the copy cached on the value model
      if (cell._value && cell._value.model) delete cell._value.model.comment;
      removed++;
    }));
  }
  await wb.xlsx.writeFile(file);
  console.log(`removed ${removed} empty notes, kept ${kept} real notes`);
})();
