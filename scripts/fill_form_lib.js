// Reusable library for filling legacy Word Form Fields in a formal test script's document.xml,
// via direct string-splice XML editing (no Python/LibreOffice/Word-COM required).
//
// Read SKILL.md step 5 before using this -- especially 5c (the index-alignment bug) and the
// top-of-doc note that Word COM automation (Document.FormFields) should be tried FIRST in any
// environment where it's available; this raw-XML approach is the documented fallback.
//
// Typical usage:
//   const { enumerateFields } = require('./enumerate_fields');
//   const { applyFieldValues } = require('./fill_form_lib');
//   const xml = fs.readFileSync(documentXmlPath, 'utf8');
//   const { fields } = enumerateFields(xml);
//   assertFieldCount(fields, 172);              // the count from your own enumeration pass
//   assertNames(fields, { 7: 'Dropdown1', 9: 'Text10', ... });  // spot-check a handful you know
//   const V = { 7: dropdown('IS NOT'), 9: text('1.1'), 10: dropdown(' F '), ... };
//   const newXml = applyFieldValues(xml, fields, V);
//   fs.writeFileSync(outPath, newXml, 'utf8');

const RUN_PROPS = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/></w:rPr>';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// value-spec helpers -- use these when building your V{} map so the shape is always right
function dropdown(value) { return { type: 'dropdown', value }; }
function text(value) { return { type: 'text', value }; }
function checkbox(checked) { return { type: 'checkbox', checked: !!checked }; }

/** Throws if fields.length doesn't match the expected total -- call before writing anything. */
function assertFieldCount(fields, expectedTotal) {
  if (fields.length !== expectedTotal) {
    throw new Error(`Expected exactly ${expectedTotal} fields, got ${fields.length} -- aborting to avoid index misalignment (see SKILL.md step 5c)`);
  }
}

/**
 * Spot-check that fields[idx].name matches expectedNames[idx] for every idx given.
 * expectedNames: { [index]: expectedNameString | null }  -- pass null for indices you know are
 * structurally-unresolved (region === null) placeholders, per SKILL.md step 5c.
 */
function assertNames(fields, expectedNames) {
  const problems = [];
  for (const [idxStr, expected] of Object.entries(expectedNames)) {
    const idx = Number(idxStr);
    const f = fields[idx];
    if (expected === null) {
      if (!f || f.region !== null) problems.push(`field ${idx} expected to be an unresolved/null region but was not`);
      continue;
    }
    if (!f || f.region === null) {
      problems.push(`field ${idx} expected name "${expected}" but region is null/unresolved`);
      continue;
    }
    if (f.name !== expected) problems.push(`field ${idx} expected name "${expected}" but found "${f.name}"`);
  }
  if (problems.length) {
    throw new Error('Sanity check failed:\n' + problems.join('\n'));
  }
}

/**
 * Apply a map of {index: spec} value assignments to the document.xml text.
 * fields: the array returned by enumerateFields().fields (index i must equal field order).
 * valuesByIndex: { [fieldIndex]: dropdown(...)|text(...)|checkbox(...) }
 * Returns the new XML string. Does not mutate the input string.
 */
function applyFieldValues(xml, fields, valuesByIndex) {
  const edits = []; // {start, end, text}

  for (const idxStr of Object.keys(valuesByIndex)) {
    const idx = Number(idxStr);
    const f = fields[idx];
    const spec = valuesByIndex[idx];
    if (!f || !f.region) {
      console.warn(`No resolved region for field ${idx} -- skipped (this is fine for checkboxes you're leaving unchecked, otherwise investigate)`);
      continue;
    }
    const region = f.region;

    if (spec.type === 'dropdown') {
      const ffBlock = xml.slice(region.ffDataStart, region.ffDataEnd);
      const entries = [...ffBlock.matchAll(/<w:listEntry w:val="([^"]*)"/g)].map((x) => x[1]);
      const selIdx = entries.indexOf(spec.value);
      if (selIdx === -1) {
        throw new Error(`Field ${idx}: value "${spec.value}" not found in entries ${JSON.stringify(entries)}`);
      }
      const ddListOpen = '<w:ddList>';
      const ddListPos = xml.indexOf(ddListOpen, region.ffDataStart);
      edits.push({ start: ddListPos + ddListOpen.length, end: ddListPos + ddListOpen.length, text: `<w:result w:val="${selIdx}"/>` });
      edits.push({ start: region.separateEnd, end: region.endStart, text: `<w:r>${RUN_PROPS}<w:t xml:space="preserve">${escapeXml(spec.value.trim())}</w:t></w:r>` });
    } else if (spec.type === 'checkbox') {
      if (spec.checked) {
        const cbOpen = '<w:checkBox>';
        const cbPos = xml.indexOf(cbOpen, region.ffDataStart);
        edits.push({ start: cbPos + cbOpen.length, end: cbPos + cbOpen.length, text: '<w:checked/>' });
      }
      // unchecked -> no edit, that's already the default state
    } else if (spec.type === 'text') {
      const tiRe = /<w:textInput\/?>/;
      const tiMatch = tiRe.exec(xml.slice(region.ffDataStart, region.ffDataEnd));
      if (tiMatch) {
        const tiAbs = region.ffDataStart + tiMatch.index;
        if (tiMatch[0].endsWith('/>')) {
          edits.push({ start: tiAbs, end: tiAbs + tiMatch[0].length, text: `<w:textInput><w:default w:val="${escapeXml(spec.value)}"/></w:textInput>` });
        } else {
          edits.push({ start: tiAbs + tiMatch[0].length, end: tiAbs + tiMatch[0].length, text: `<w:default w:val="${escapeXml(spec.value)}"/>` });
        }
      }
      edits.push({ start: region.separateEnd, end: region.endStart, text: `<w:r>${RUN_PROPS}<w:t xml:space="preserve">${escapeXml(spec.value)}</w:t></w:r>` });
    } else {
      throw new Error(`Field ${idx}: unknown spec type "${spec.type}"`);
    }
  }

  // apply in descending start order so earlier offsets stay valid as we splice
  edits.sort((a, b) => b.start - a.start);
  let out = xml;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

module.exports = { applyFieldValues, assertFieldCount, assertNames, dropdown, text, checkbox, escapeXml };
