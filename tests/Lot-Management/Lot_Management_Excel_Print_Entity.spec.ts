// Lot Management Excel Import with PrintEntityRequired = Y (live 2026-10-08, headless, TST703). Formal script PE_LotManagment_Import: the PrintEntity column is validated against the IMPORTING user's
// entities: a blank cell -> "This column does not allow null values."; a real entity the user is not assigned to -> "Print Entity is not linked to the UserID: <user>". MB fixtures only
// (MBPWLoginGrp / MBPWLogin01 with LE_View_Lots + EI_Lots and the single entity England); one throw-away lot MBLPI<stamp> is imported with England and deleted by the seed user. Skips unless the setting is Y.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as du from '../support/dynamic-ui';
import { readGlobalSetting } from '../support/global-settings';
import { setUserPrintEntities } from '../support/print-entity';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const PROCESSES = ['Login_WebMenu', 'LE_View_Lots', 'EI_Lots'];

test('Lot Management Excel Import with PrintEntityRequired = Y: the PrintEntity column is checked against the importing user', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  await login(page);
  const setting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  test.skip(setting !== 'Y', `PrintEntityRequired is ${setting}; the column rules below are the Y behavior`);
  const stamp = Date.now().toString().slice(-6);
  const lot = `MBLPI${stamp}`;
  const today = new Date();
  const files: string[] = [];

  const mkFile = async (entity: string, lotName = lot): Promise<string> => {
    const file = path.join(os.tmpdir(), `lots_pe_${stamp}_${files.length}.xlsx`);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['OrderNum', 'LotNum', 'ItemNumber', 'PrintEntity', 'Expires', 'Manufactured', 'Reassay', 'U1', 'U2', 'U3', 'U4', 'U5']);
    ws.addRow([`${lotName}O`, lotName, 'MI080301', entity, today, today, today, '', '', '', '', ''] as never);
    await wb.xlsx.writeFile(file);
    files.push(file);
    return file;
  };
  const openImport = async (p: Page): Promise<Frame> => {
    const f = await du.reopenDynamicUi(p, 'Lot Management');
    await f.click('#btnReset').catch(() => {});
    await p.waitForTimeout(3000);
    const g = await du.reopenDynamicUi(p, 'Lot Management');
    await g.locator('a:has-text("Actions")').first().click();
    await p.waitForTimeout(500);
    await g.locator('ul:visible li a').filter({ hasText: 'Excel Import' }).click({ force: true });
    await p.waitForTimeout(5000);
    return p.frames().filter((x) => /ExcelImport/i.test(x.url())).pop()!;
  };
  /** The MB user imports a file with `entity`; returns the page text plus every validation tooltip (title) after Validate. */
  const mbImport = async (entity: string, submit: boolean): Promise<{ text: string; titles: string[]; job: string }> => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2000);
      const imp = await openImport(p);
      await imp.locator('input[type=file]').setInputFiles(await mkFile(entity));
      await imp.locator('#btnValidate').click();
      await p.waitForTimeout(6000);
      const text = (await imp.locator('body').innerText()).replace(/\s+/g, ' ');
      const titles = await imp.locator('[title]').evaluateAll((els) => els.map((e) => e.getAttribute('title') || '').filter((t) => t && t.length > 8));
      let job = '';
      if (submit && text.includes('Validation Successful')) {
        await imp.locator('#btnSubmit').click();
        for (let i = 0; i < 30; i++) {
          await p.waitForTimeout(3000);
          const jf = p.frames().filter((x) => /ExcelImportJobDetail/i.test(x.url())).pop();
          job = jf ? (await jf.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ') : '';
          if (/Status\s+(Completed|Fail|Error)/.test(job)) break;
        }
      }
      return { text, titles, job };
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('setup: the MB user may view lots and import, with the single entity England', async () => {
      await sec.setGroupProcesses(page, GROUP, PROCESSES);
      await setUserPrintEntities(page, MB, ['England']);
    });
    await test.step('a blank PrintEntity cell is refused', async () => {
      const r = await mbImport('', false);
      console.log(`blank entity: ${r.text.slice(-200)} | titles: ${JSON.stringify(r.titles)}`);
      expect(r.text).not.toContain('Validation Successful');
      // live 2026-10-08: ONE generic message (note the product typo "specifed"), not the "This column does not allow null values." tooltip of PE_LotManagment_Import
      expect(r.text).toContain('Row 2 has an invalid value specifed for the PrintEntity column');
    });
    await test.step('an entity the user does not hold (ROBAR) is refused with the same generic message (the script expects "Print Entity is not linked to the UserID")', async () => {
      const r = await mbImport('ROBAR', false);
      console.log(`ROBAR: ${r.text.slice(-200)} | titles: ${JSON.stringify(r.titles)}`);
      expect(r.text).not.toContain('Validation Successful');
      expect((r.text + ' ' + r.titles.join(' | '))).toContain('Row 2 has an invalid value specifed for the PrintEntity column');
    });
    await test.step('an entity that does not exist is refused', async () => {
      const r = await mbImport('NoSuchEntity', false);
      console.log(`NoSuchEntity: ${r.text.slice(-200)} | titles: ${JSON.stringify(r.titles)}`);
      expect(r.text).not.toContain('Validation Successful');
      expect(r.text).toContain('Row 2 has an invalid value specifed for the PrintEntity column');
    });
    await test.step('the user\'s own entity (England) validates and imports; the lot carries England', async () => {
      const r = await mbImport('England', true);
      console.log(`England: ${r.text.slice(-160)} | job: ${r.job.slice(0, 300)}`);
      expect(r.text).toContain('Validation Successful');
      expect(r.job).toMatch(/Status\s+Completed/);
      const g = await du.reopenDynamicUi(page, 'Lot Management');
      await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
      await page.waitForTimeout(5000);
      const rows = await du.rows(g);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain('England');
    });
  } finally {
    await test.step('cleanup: delete the lot, remove the entity from the MB user, group without processes', async () => {
      try {
        const g = await du.reopenDynamicUi(page, 'Lot Management');
        await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
        await page.waitForTimeout(4000);
        if ((await du.rows(g)).length === 1) {
          await du.selectGridRow(g, lot);
          await g.click('#del_grdJqGrid');
          await page.waitForTimeout(1200);
          await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
          await page.waitForTimeout(3000);
        }
      } catch (e) {
        console.log(`lot cleanup skipped: ${String(e).slice(0, 140)}`);
      }
      await setUserPrintEntities(page, MB, []).catch((e) => console.log(`entity cleanup skipped: ${String(e).slice(0, 120)}`));
      await sec.setGroupProcesses(page, GROUP, []).catch(() => {});
    });
  }
});
