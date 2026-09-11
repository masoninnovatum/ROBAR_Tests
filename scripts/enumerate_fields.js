#!/usr/bin/env node
// Enumerate every legacy Word Form Field (w:ffData) in a formal test script's document.xml,
// in document order, grouped by the table cell (w:tc) that contains it.
//
// Usage: node enumerate_fields.js <path-to-document.xml> [output.json]
//
// Prints a human-readable listing to stdout (field index, name, type, dropdown entries, and a
// snippet of the enclosing cell's own text) and, if a second argument is given, writes the full
// structured field list (index, name, type, entries, cellIndex) as JSON.
//
// Read this output fully before writing any value in a fill script -- field *names* repeat
// throughout this corpus (e.g. "Check2" used for 3 unrelated checkboxes, "Text2" for 10 unrelated
// cells), so index + enclosing-cell text is what actually identifies a field, not its name alone.
//
// See SKILL.md step 5b/5c for why every field (even ones that fail to resolve structurally) must
// be accounted for in order -- this script pushes `null` for any field whose begin/separate/end
// fldChar triplet can't be resolved, rather than silently skipping it, to keep index alignment
// intact for fill_form_lib.js.

const fs = require('fs');

function enumerateFields(xml) {
  const beginRe = /<w:fldChar w:fldCharType="begin"(\/?)>/g;
  const fieldRegions = [];
  let m;

  while ((m = beginRe.exec(xml))) {
    const beginIdx = m.index;
    const isSelfClose = m[1] === '/';
    let ffDataStart = -1, ffDataEnd = -1;
    if (!isSelfClose) {
      const closeIdx = xml.indexOf('</w:fldChar>', beginIdx);
      const ffStart = xml.indexOf('<w:ffData>', beginIdx);
      if (ffStart !== -1 && ffStart < closeIdx) {
        ffDataStart = ffStart;
        ffDataEnd = xml.indexOf('</w:ffData>', ffStart) + '</w:ffData>'.length;
      }
    }
    if (ffDataStart === -1) continue; // not a form-field begin at all -- doesn't count

    const searchStart = ffDataEnd;
    const nextBegin = xml.indexOf('<w:fldChar w:fldCharType="begin"', searchStart);
    const scope = xml.slice(searchStart, nextBegin === -1 ? xml.length : nextBegin);
    const sepMatch = /<w:fldChar w:fldCharType="separate"\/?>/.exec(scope);
    const endMatch = /<w:fldChar w:fldCharType="end"\/?>/.exec(scope);

    if (!sepMatch || !endMatch) {
      fieldRegions.push(null); // preserve index alignment -- see SKILL.md step 5c
      continue;
    }
    const separateEnd = searchStart + sepMatch.index + sepMatch[0].length;
    const endStart = searchStart + endMatch.index;
    fieldRegions.push({ beginIdx, ffDataStart, ffDataEnd, separateEnd, endStart });
  }

  // name/type/entries per field, aligned to fieldRegions by re-scanning ffData blocks in order
  const ffRe = /<w:ffData>([\s\S]*?)<\/w:ffData>/g;
  const meta = [];
  while ((m = ffRe.exec(xml))) {
    const block = m[1];
    const nameMatch = block.match(/<w:name w:val="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : '(unnamed)';
    let type = 'unknown', entries = null;
    if (block.includes('<w:checkBox>')) type = 'checkbox';
    else if (block.includes('<w:ddList>')) {
      type = 'dropdown';
      entries = [...block.matchAll(/<w:listEntry w:val="([^"]*)"/g)].map((x) => x[1]);
    } else if (block.includes('<w:textInput')) type = 'text';
    meta.push({ name, type, entries, pos: m.index });
  }

  if (meta.length !== fieldRegions.length) {
    throw new Error(`Internal mismatch: ${meta.length} ffData blocks vs ${fieldRegions.length} field regions -- enumeration logic bug, do not proceed`);
  }

  // table-cell grouping, for the human-readable listing / context
  const tcStarts = [...xml.matchAll(/<w:tc>/g)].map((x) => x.index);
  const tcEnds = [...xml.matchAll(/<\/w:tc>/g)].map((x) => x.index);
  function cellIndexFor(pos) {
    let idx = -1;
    for (let i = 0; i < tcStarts.length; i++) {
      if (tcStarts[i] < pos && tcEnds[i] > pos) idx = i;
    }
    return idx;
  }

  const fields = meta.map((mo, i) => ({
    i,
    name: mo.name,
    type: mo.type,
    entries: mo.entries,
    region: fieldRegions[i],
    cellIdx: cellIndexFor(mo.pos),
  }));

  return { fields, tcStarts, tcEnds };
}

function printListing(xml, { fields, tcStarts, tcEnds }) {
  let lastCell = null;
  for (const f of fields) {
    if (f.cellIdx !== lastCell) {
      const cellXml = xml.slice(tcStarts[f.cellIdx] ?? 0, tcEnds[f.cellIdx] ?? 0);
      const plain = cellXml
        .replace(/<w:t[^>]*>/g, '¦')
        .replace(/<\/w:t>/g, '¦')
        .replace(/<[^>]+>/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n/g, '')
        .trim();
      console.log(`\n=== CELL #${f.cellIdx} === ${plain.slice(0, 300)}`);
      lastCell = f.cellIdx;
    }
    const nullTag = f.region === null ? '  [UNRESOLVED -- null placeholder, do not write here without investigating]' : '';
    console.log(`  field#${f.i} ${f.name} ${f.type} ${f.entries ? JSON.stringify(f.entries) : ''}${nullTag}`);
  }
}

if (require.main === module) {
  const [, , xmlPath, outJson] = process.argv;
  if (!xmlPath) {
    console.error('Usage: node enumerate_fields.js <path-to-document.xml> [output.json]');
    process.exit(1);
  }
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const result = enumerateFields(xml);
  console.log(`Total form fields found: ${result.fields.length}`);
  printListing(xml, result);
  if (outJson) {
    fs.writeFileSync(outJson, JSON.stringify(result.fields, null, 2));
    console.log(`\nWrote structured field list to ${outJson}`);
  }
}

module.exports = { enumerateFields };
