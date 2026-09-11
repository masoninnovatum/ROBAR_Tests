#!/usr/bin/env node
// Build a formal-test-script screenshot document (the separate "-SS.docx" deliverable) from a
// folder of PNG screenshots named by substep number (e.g. 1.1.png, 2.3A.png, 3.3.png).
//
// Matches the format observed in this corpus's reference files (e.g. WM_View_and_Vote-3.1-SS.docx):
// a page header with the script name on one line and "Run 1" on the next, then for every
// substep in order: a plain paragraph with just the substep label, a paragraph with the image,
// and a blank spacer paragraph. Substeps needing multiple screenshots use suffixed letters
// (2.3A, 2.3B) -- just include both filenames in `steps`, in the order they should appear.
//
// Requires the `docx` npm package (docx-js) -- install with `npm install docx` in the working
// folder if not already present. docx-js can only AUTHOR a new file, not edit an existing one --
// that's fine here, there's no existing screenshot doc to clone, only a format to match.
//
// Usage: node build_screenshot_doc.js <screenshotsDir> <outputDocxPath> <scriptName> [runLabel]
//   screenshotsDir: folder containing "<substep>.png" files, e.g. 1.1.png, 1.3.png, 2.4.png
//   scriptName: header line 1, e.g. "WM_Preset_Management-13.1"
//   runLabel: header line 2, defaults to "Run 1"
//
// Steps are included in the order their filenames sort as (numeric-aware: 1.1 < 1.10 < 1.11 <
// 1.2 would be WRONG under plain string sort -- this script sorts numerically by the dotted
// numeric prefix, falling back to string comparison for any trailing letter suffix).

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, ImageRun, Header } = require('docx');

function pngSize(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function naturalStepSort(a, b) {
  const parse = (s) => {
    const m = s.match(/^(\d+)\.(\d+)([A-Za-z]*)$/);
    return m ? [Number(m[1]), Number(m[2]), m[3]] : [Infinity, Infinity, s];
  };
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3.localeCompare(b3);
}

async function buildScreenshotDoc(screenshotsDir, outPath, scriptName, runLabel = 'Run 1', maxWidthPx = 620) {
  const files = fs.readdirSync(screenshotsDir).filter((f) => /\.png$/i.test(f) && !f.startsWith('debug_'));
  const steps = files.map((f) => f.replace(/\.png$/i, '')).sort(naturalStepSort);

  const children = [];
  for (const step of steps) {
    const filePath = path.join(screenshotsDir, `${step}.png`);
    const buf = fs.readFileSync(filePath);
    const { width, height } = pngSize(buf);
    const scale = Math.min(1, maxWidthPx / width);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    children.push(new Paragraph({ children: [new TextRun(step)] }));
    children.push(new Paragraph({ children: [new ImageRun({ data: buf, type: 'png', transformation: { width: w, height: h } })] }));
    children.push(new Paragraph({ children: [] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter, DXA
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({ children: [new TextRun(scriptName)] }),
              new Paragraph({ children: [new TextRun(runLabel)] }),
              new Paragraph({ children: [] }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  return { stepsIncluded: steps, outPath };
}

if (require.main === module) {
  const [, , screenshotsDir, outPath, scriptName, runLabel] = process.argv;
  if (!screenshotsDir || !outPath || !scriptName) {
    console.error('Usage: node build_screenshot_doc.js <screenshotsDir> <outputDocxPath> <scriptName> [runLabel]');
    process.exit(1);
  }
  buildScreenshotDoc(screenshotsDir, outPath, scriptName, runLabel || 'Run 1').then((r) => {
    console.log(`Wrote ${r.outPath} with ${r.stepsIncluded.length} steps:`, r.stepsIncluded.join(', '));
  });
}

module.exports = { buildScreenshotDoc, naturalStepSort, pngSize };
