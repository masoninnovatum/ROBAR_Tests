// Serialized templates printed from Print by Lot to "Microsoft Print to PDF" (user request 2026-10-14, HEADED, TST703; NEVER a live printer). Fixtures come from Serial_Template_Setup.spec.ts.
//  [usr] S_USerial: the Serial Number Management dialog on the label screen gets serial numbers 001, 002, 003 (Add One), all selected, Done, Print -> one PDF per serial.
//  [ser] S_Ser (counter style, the customer's case "Batch Qty 0, Copy 1, Serial 3, Starting Serial 00000, Of 1 prints only 1 label"): the label screen's Serial box is set to 3 (Copy 1), Print.
// Each run logs the boxes of the print options panel, the result text, the PDFs written (PID_<id>_<n>.pdf in the OneDrive Documents folder) and InnoView > View Print History (Serial Num / Copies).
// One throw-away lot is created by the print and deleted again in Lot Management (CL-prefixed rows only). Real mouse (FlaUI confirms the Sentinel prompts): do not touch the mouse.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login } from '../support/robar';
import * as du from '../support/dynamic-ui';
import { PrintByLot, PDF } from '../support/print-by-lot';
import { viewPrintHistory } from '../support/print-history';
import { VARIANTS, fixturePath } from '../support/serial-variants';
import type { SerialVariant } from '../support/serial-variants';

test.use({ headless: false, actionTimeout: 20_000 });

const SERIALS = ['001', '002', '003'];

async function recentPdfs(minutes: number): Promise<string[]> {
  // Microsoft Print to PDF writes PID_<printid>_<n>.pdf into the (OneDrive-redirected) Documents folder of the Sentinel client user
  const roots = [path.join(process.env.OneDriveCommercial ?? process.env.OneDrive ?? '', 'Documents'), path.join(process.env.USERPROFILE ?? '', 'Documents'), path.join(process.env.USERPROFILE ?? '', 'Desktop'), path.join(process.env.USERPROFILE ?? '', 'Downloads'), 'C:\\PDFs', 'C:\\Temp'];
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 2 || !fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (/\.pdf$/i.test(e.name) && Date.now() - fs.statSync(p).mtimeMs < minutes * 60_000) out.push(p);
    }
  };
  roots.forEach((r) => { try { walk(r, 0); } catch { /* unreadable folder */ } });
  return out;
}

async function deleteLots(page: Page, prefix: string): Promise<void> {
  if (!/^CLS[A-Z]L\d+/.test(prefix)) throw new Error(`refusing to delete lots with prefix ${prefix}`);
  for (let i = 0; i < 4; i++) {
    await page.locator('li.ui-tabs-tab:has-text("Lot Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    const g = await du.reopenDynamicUi(page, 'Lot Management');
    await du.clearCriteria(page, g);
    await du.retrieve(page, g, 'LotNum', 'Contains', prefix, { expectRows: false });
    await page.waitForTimeout(3000);
    const mine = (await du.rows(g)).filter((r) => r.split(/\s+/).some((t) => t.startsWith(prefix)));
    if (!mine.length) break;
    await du.selectGridRow(g, mine[0].split(/\s+/).find((t) => t.startsWith(prefix))!);
    await g.click('#del_grdJqGrid');
    await page.waitForTimeout(1200);
    await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
    await page.waitForTimeout(3000);
  }
}

/** Boxes of the print options panel (ids posPrintOptions_<suffix>): value, visible, enabled. */
async function panelBoxes(pbl: PrintByLot): Promise<string> {
  const parts: string[] = [];
  for (const s of ['txtBatchQuantity', 'txtCopies', 'txtSerialized', 'txtSerialStart', 'txtTotalSerialCount']) {
    const el = pbl.opt(s);
    if (!(await el.count())) { parts.push(`${s}=(absent)`); continue; }
    parts.push(`${s}="${await el.inputValue().catch(() => '?')}"${(await el.isVisible().catch(() => false)) ? '' : ' hidden'}${(await el.isEnabled().catch(() => false)) ? '' : ' disabled'}`);
  }
  return parts.join('  ');
}

for (const v of VARIANTS) {
  test(`${v.key === 'usr' ? '@smoke @tier2 ' : ''}[${v.key}] Print by Lot: ${v.sharename} template, Print to PDF`, async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const fx = JSON.parse(fs.readFileSync(fixturePath(v), 'utf8')) as { template: string; item: string; labelType: string };
    expect(fx.item, 'run Serial_Template_Setup.spec.ts first').toBeTruthy();
    const lot = `${v.lotPrefix}${Date.now().toString().slice(-6)}`;
    await login(page);
    const keepAlive = setInterval(() => {
      page.evaluate(() => {
        const w = window as unknown as { RefreshTimeout?: () => void };
        if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout();
      }).catch(() => {});
    }, 60_000);
    const pbl = new PrintByLot(page);
    let expectedLabels = 1;
    try {
      await test.step('Print by lot: new lot on the serialized item, to the label screen, printer = Microsoft Print to PDF', async () => {
        await pbl.open();
        await pbl.toLabelScreen(lot, fx.item, `${lot}O`, fx.labelType);
        console.log(`[${v.key}] LABEL SCREEN: ${(await pbl.body()).slice(0, 400)}`);
        console.log(`[${v.key}] BOXES: ${await panelBoxes(pbl)}`);
      });

      if (v.key === 'usr') {
        let sf: Frame | undefined;
        await test.step('Serial Number Management dialog is open', async () => {
          for (let i = 0; i < 20 && !sf; i++) {
            sf = page.frames().find((fr) => fr.url().includes('PrintScreen'));
            if (sf && !(await sf.locator('#serialNum').isVisible().catch(() => false))) sf = undefined;
            if (!sf) await page.waitForTimeout(1500);
          }
          expect(sf, 'the Serial Number Management dialog (#serialNum) is visible on the label screen').toBeTruthy();
        });
        await test.step('Add One: 001, 002, 003; select all; Done', async () => {
          for (const s of SERIALS) {
            await sf!.locator('#serialNum').fill(s);
            await sf!.locator('#btnAddOne').click();
            await page.waitForTimeout(2500);
          }
          const gridText = (await sf!.locator('#serialNumMgmtDialog').innerText().catch(() => '')).replace(/\s+/g, ' ');
          for (const s of SERIALS) expect(gridText, `serial ${s} listed`).toContain(s);
          await testInfo.attach('serial dialog', { body: await page.screenshot(), contentType: 'image/png' });
          await sf!.locator('#selectAllCb').check();
          await page.waitForTimeout(800);
          await sf!.locator('#btnDone').click();
          await page.waitForTimeout(3000);
        });
        expectedLabels = SERIALS.length;
      } else {
        await test.step('S_Ser: Serial = 3 (Copy 1), Starting Serial and Of as shown', async () => {
          const ser = pbl.opt('txtSerialized');
          expect(await ser.isVisible(), 'the Serial box is shown for an S_Ser template').toBe(true);
          await ser.fill('3');
          await ser.press('Tab');
          await page.waitForTimeout(800);
          console.log(`[${v.key}] BOXES after typing Serial 3: ${await panelBoxes(pbl)}`);
          await testInfo.attach('print options, Serial 3', { body: await page.screenshot(), contentType: 'image/png' });
        });
        expectedLabels = 3; // Copy 1 x Serial 3 (client script: totalLabels = Copy * Serial)
      }

      let pid = '';
      await test.step('Print to Microsoft Print to PDF (Copy 1)', async () => {
        pbl.f = await pbl.frame();
        const selected = (await pbl.opt('drpPrinters').locator('option:checked').innerText()).trim();
        expect(selected, 'only the PDF printer is used').toBe(PDF);
        const before = new Set(await recentPdfs(60));
        const text = await pbl.print();
        console.log(`[${v.key}] PRINT RESULT TAIL: ${text.slice(-300)}`);
        await testInfo.attach('print result', { body: await page.screenshot(), contentType: 'image/png' });
        expect(text).toMatch(/Printed PID_\w+(\.prn)? to Microsoft Print to PDF/);
        pid = text.match(/Printed (PID_\w+?)(\.prn)? to /)?.[1] ?? '';
        // the files are written one second apart, so the last can appear after the result text: poll
        let mine: string[] = [];
        for (let i = 0; i < 15; i++) {
          mine = (await recentPdfs(10)).filter((p) => !before.has(p) && path.basename(p).startsWith(pid + '_'));
          if (mine.length >= expectedLabels) break;
          await page.waitForTimeout(2000);
        }
        console.log(`[${v.key}] PDF files for ${pid}: ${mine.map((p) => path.basename(p)).join(', ') || '(none)'} -> ${mine.length} (expected ${expectedLabels})`);
        test.info().annotations.push({ type: `PDFs ${v.key}`, description: `${mine.length} file(s) for ${pid}, expected ${expectedLabels}` });
        if (v.key === 'usr') expect(mine.length, 'one PDF per selected serial number').toBe(expectedLabels);
        else expect.soft(mine.length, 'S_Ser: Copy x Serial labels (annotated, not a hard failure: this is the behaviour under investigation)').toBe(expectedLabels);
      });

      await test.step('InnoView > View Print History lists the print (PDF printer, serial count, copies)', async () => {
        await page.locator('li.ui-tabs-tab:has-text("Print by lot") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
        const { reportText } = await viewPrintHistory(page, { lot });
        console.log(`[${v.key}] PRINT HISTORY: ${reportText.slice(reportText.indexOf('Claude01')).slice(0, 360)}`);
        expect(reportText).toContain(lot);
        expect(reportText).toContain(PDF);
      });
    } finally {
      clearInterval(keepAlive);
      await deleteLots(page, lot).catch((e) => console.log(`lot cleanup failed: ${String(e).slice(0, 120)}`));
    }
  });
}

export type { SerialVariant };
