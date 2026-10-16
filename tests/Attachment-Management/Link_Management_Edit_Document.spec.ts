// Link Management > row action Edit on a PDF (HEADED, TST703, seed user Claude01; moves the real mouse in the Acrobat window it started). Edit = GetFileToken -> "innoclient:" protocol -> Sentinel DocumentEdit plugin downloads the file into
// C:\Innovatum\SentinelClient\DocumentFolder\<staging id>\ and opens it in the default PDF application (Acrobat here), watches the local file and uploads a changed file as a new version.
// ONLY PDF can be edited: the DocumentEdit plugin is registered with SupportedExtensions ".pdf" (a .txt / .docx gets "This type of file cannot be edited.", see Link_Management_Actions).
// Test file: a new CLLinkEdit<stamp>.pdf (hand-built, one page) linked By Item to the approved item in test-data/link-actions-item.json (uploads cannot be deleted).

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as flaui from '../../scripts/flaui_bridge';
import { login } from '../support/robar';
import * as LM from '../support/link-management';
import * as bartender from '../support/bartender';

test.use({ headless: false, actionTimeout: 20_000 });

const DOC_FOLDER = 'C:\\Innovatum\\SentinelClient\\DocumentFolder';

/** A minimal valid one-page PDF showing `text` (offsets computed so no viewer needs to repair it). */
function makePdf(text: string): Buffer {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = `BT /F1 14 Tf 20 100 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Brings the window of one process to the front and sends keys to it (SendKeys syntax, e.g. '^w'); only used on the Acrobat process the Edit click started. */
function sendKeysTo(pid: number, keys: string): void {
  const ps = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }'; $p = Get-Process -Id ${pid}; [W]::SetForegroundWindow($p.MainWindowHandle) | Out-Null; Start-Sleep -Milliseconds 800; [System.Windows.Forms.SendKeys]::SendWait('${keys}')`;
  execFileSync('powershell.exe', ['-NoProfile', '-Command', ps]);
}

const localCopies = (name: string): string[] => {
  const hits: string[] = [];
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name === name) hits.push(p);
    }
  };
  walk(DOC_FOLDER);
  return hits;
};

test('Link Management Edit on a PDF: Sentinel opens it for editing', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const item = JSON.parse(fs.readFileSync('test-data/link-actions-item.json', 'utf8')).item as string;
  const stamp = Date.now().toString().slice(-7);
  const fileName = `CLLinkEdit${stamp}.pdf`;
  const filePath = path.join(os.tmpdir(), fileName);
  const originalPdf = makePdf(`Original text ${stamp}`);
  const originalSize = originalPdf.length;
  fs.writeFileSync(filePath, originalPdf);
  await LM.uploadAttachment(page, filePath, `Playwright Link Management edit -- ${stamp}`);
  fs.unlinkSync(filePath);
  await LM.linkBy(page, fileName, 'By Item', 'LinkItemAttachments', [/item.?number/i], item);
  try {

  const f = await LM.showFileInLinkManagement(page, fileName);
  const row = f.locator('tr.jqgrow').first();
  let tokenReply = '';
  page.on('response', async (r) => { if (r.url().includes('GetFileToken')) tokenReply = await r.text().catch(() => ''); });
  const before = await flaui.listProcesses();
  const pid = await bartender.resolveBrowserPid(page);
  await row.locator('a:has-text("Actions")').first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await f.locator('ul:visible li a').filter({ hasText: /^Edit/ }).first().click({ force: true });
  await page.waitForTimeout(3000);
  console.log(`GetFileToken -> ${tokenReply.slice(0, 300)}`);
  expect(tokenReply, 'a token was issued for a PDF').toMatch(/"Token":"[^"]+"/);

  await bartender.confirmSentinelLaunchPrompt(page, pid).catch((e) => console.log(`prompt: ${String(e).slice(0, 120)}`));
  let copies: string[] = [];
  let fresh: Array<{ name: string; pid: number; mainWindowTitle: string }> = [];
  for (let i = 0; i < 12 && !copies.length; i++) {
    await page.waitForTimeout(5000);
    copies = localCopies(fileName);
    fresh = flaui.diffNewProcesses(before, await flaui.listProcesses());
    console.log(`after ${5 * (i + 1)}s: local copies ${JSON.stringify(copies)} new processes ${JSON.stringify(fresh.map((p) => `${p.name}:${p.pid}:${p.mainWindowTitle}`))}`);
  }
  expect(copies.length, 'the plugin downloaded the PDF into the DocumentFolder').toBeGreaterThan(0);
  await page.waitForTimeout(8000);
  fresh = flaui.diffNewProcesses(before, await flaui.listProcesses());
  console.log(`editor processes: ${JSON.stringify(fresh.map((p) => `${p.name}:${p.pid}:${p.mainWindowTitle}`))}`);

  // the "edit": what a PDF editor does on Save -- the local copy gets new content (a different size, which is what the plugin's folder watcher reacts to). Written by this test, not typed in Acrobat.
  const editedText = `Edited text ${stamp}`;
  const edited = makePdf(editedText);
  // the manual edit the QA script describes: pen (Draw Freehand) stroke, Save (the toolbar Save icon, NOT Save As), then Exit. Acrobat Reader needs Protected Mode and Enhanced Security OFF
  // (Preferences > Security (Enhanced)), otherwise Save turns into Save As and nothing reaches the server.
  const reader = fresh.filter((p) => /acro/i.test(p.name) && /Reader/.test(p.mainWindowTitle))[0] ?? fresh.filter((p) => /acro/i.test(p.name))[0];
  expect(reader, 'an Acrobat process started by the Edit click').toBeTruthy();
  const pen = (args: string[]): string => execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/acrobat-pen-edit.ps1', '-ProcessId', String(reader.pid), ...args]).toString().trim();
  console.log(pen([]).split(String.fromCharCode(10)).join(' | '));
  await page.waitForTimeout(3000);
  const sizeAfterSave = fs.existsSync(copies[0]) ? fs.statSync(copies[0]).size : -1;
  console.log(`local copy after Save: ${sizeAfterSave} bytes (was ${originalSize})`);
  console.log(pen(['-ClickOnly', '35,15;65,730']).split(String.fromCharCode(10)).join(' | ')); // Menu > Exit application
  await page.waitForTimeout(3000);
  const stillOpen = (await flaui.listProcesses('acro')).some((p: { pid: number }) => p.pid === reader.pid);
  console.log(`Acrobat still running after Exit: ${stillOpen}`);

  // the plugin posts the saved file back (about 10 s in a manual run, up to 30 s); then View must show the edit (AttachEditIncrementSeqNum = N: version 0 is overwritten)
  let viewed = '';
  let viewBytes = 0;
  const EDITED = new RegExp('Ink|Annot'); // the original upload has neither; Acrobat's pen stroke is an /Ink annotation
  for (let attempt = 0; attempt < 6 && !EDITED.test(viewed); attempt++) {
    await page.waitForTimeout(attempt === 0 ? 10_000 : 6000);
    const f2 = await LM.showFileInLinkManagement(page, fileName);
    const popup = page.context().waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await f2.locator('tr.jqgrow').first().locator('a:has-text("Actions")').first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await f2.locator('ul:visible li a').filter({ hasText: /^View/ }).first().click({ force: true });
    await page.waitForTimeout(2500);
    const versions = await f2.locator('input.chkVersions').evaluateAll((els) => els.map((e: any) => e.value as string));
    if (versions.length) { await f2.locator(`input.chkVersions[value="${[...versions].sort((a, b) => Number(b) - Number(a))[0]}"]`).check(); await f2.locator('.ui-dialog:visible button').filter({ hasText: /^Submit$/ }).click(); }
    const vp = await popup;
    if (vp) {
      const body = await page.context().request.get(vp.url());
      const buf = await body.body();
      viewBytes = buf.length;
      viewed = buf.toString('latin1');
      await vp.close().catch(() => {});
    }
    console.log(`View attempt ${attempt + 1}: ${viewBytes} bytes, edit present=${EDITED.test(viewed)}, versions popup=${JSON.stringify(versions)}`);
  }
  expect(viewed, 'View shows the edit made in Acrobat (ink annotation present)').toMatch(EDITED);
  expect(viewBytes, 'the viewed file is larger than the original upload').toBeGreaterThan(originalSize);
  } finally {
    // the test link is detached even when the edit part failed (uploads stay; nothing may stay linked to the shared fixture item)
    await LM.detachAll(page, fileName, "cleanup").catch((e) => console.log(`cleanup detach failed: ${String(e).slice(0, 120)}`));
  }
});
