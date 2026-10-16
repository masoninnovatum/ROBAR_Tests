// Counts the LABELS in a print job's PDF (the server's PrintedImages\<yyyymm>\PID_<id>.prn is a real PDF). Pages are NOT labels: on 2026-10-16 an S_Ser job of 3 labels came out as 2 Letter pages (2 + 1 labels), one of
// 5 labels as 3 pages. Each label carries the item number once, so the labels are the text items equal to `marker` (the item number) summed over all pages. Uses pdfjs-dist's legacy CommonJS build (text only, no rendering).

import * as fs from 'fs';

export async function labelsInPdf(file: string, marker: string): Promise<{ pages: number; labels: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: false, disableFontFace: true }).promise;
  let labels = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    labels += tc.items.filter((x: { str?: string }) => (x.str ?? '').trim() === marker).length;
  }
  return { pages: doc.numPages, labels };
}
