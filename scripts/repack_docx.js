#!/usr/bin/env node
// Repackage an unzipped .docx working directory back into a real .docx file, using JSZip
// (available as a transitive dependency once `playwright` or `docx` is installed in the working
// folder -- run `npm ls jszip` to confirm, or `npm install jszip` directly if not).
//
// Do NOT use PowerShell's Compress-Archive for this -- it can emit backslash-separated zip entry
// paths (word\document.xml instead of word/document.xml), which is a real OOXML-compatibility
// risk. JSZip produces correct forward-slash paths by default.
//
// Usage: node repack_docx.js <sourceDir> <outputDocxPath>

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

function addDir(dir, zipFolder) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      addDir(full, zipFolder.folder(entry.name));
    } else {
      zipFolder.file(entry.name, fs.readFileSync(full));
    }
  }
}

async function repack(sourceDir, outPath) {
  const zip = new JSZip();
  addDir(sourceDir, zip);
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

if (require.main === module) {
  const [, , sourceDir, outPath] = process.argv;
  if (!sourceDir || !outPath) {
    console.error('Usage: node repack_docx.js <sourceDir> <outputDocxPath>');
    process.exit(1);
  }
  repack(sourceDir, outPath).then((len) => console.log(`Wrote ${outPath} (${len} bytes)`));
}

module.exports = { repack };
