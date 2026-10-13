// Attachment Management re-checked against ValMaster (module "Attachment Management", AT.170103.F.12.* / F.16 / F.19 / SNT.170330.F.6; live 2026-10-11, headless, TST703, seed user Claude01).
// Tile "Attachment Management" (process AM_Attachment_Management, MenuParent Document Control) opens `InnoPages/LinkAttachmentManagement/AttachmentManagement?LinkedFromWebmenu=1`.
// Works on the MB test files uploaded by Attachment_Upload_Requirements.spec.ts (Attachment Group MBAUT<stamp>, file names MBAUT<stamp>_a.txt / _b.txt). Only those MB rows are ever edited.
// Differences are annotated `deviation <id>` (the spec stays green).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as fs from 'fs';
import { login, openMenuItem, findFrame } from '../support/robar';

test.use({ actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Attachment Management vs ValMaster: web-menu entry, filters, Advanced Options, grid, pager, row Actions, Edit Attributes, View / Download', async ({ page }) => {
  test.setTimeout(900_000);
  const last = fs.existsSync('test-data/run-results/attachment-upload-last.json') ? JSON.parse(fs.readFileSync('test-data/run-results/attachment-upload-last.json', 'utf8')) : { group: 'MBAUT' };
  const group: string = last.group;
  await login(page);

  await test.step('F.12.1 - F.12.4: the icon is on the web menu under Document Control', async () => {
    // the main menu text lists the section headings in order: ... "Document Control", its tiles, then the next heading ("Printing")
    const menuText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const hasTile = (await page.locator('button.menuIcon', { hasText: 'Attachment Management' }).count()) > 0;
    const inSection = /Document Control (?:(?!Printing).)*Attachment Management/.test(menuText);
    const section = hasTile ? (inSection ? 'Document Control' : 'tile found but not under a Document Control heading') : null;
    console.log(`MENU SECTION: ${section}`);
    expect(section, 'tile exists').not.toBeNull();
    if (section !== 'Document Control') deviation('AT.170103.F.12.4', 'MenuParent Document Control', String(section));
  });

  await openMenuItem(page, 'Attachment Management');
  let f: Frame = await findFrame(page, 'AttachmentManagement', { attempts: 80 });
  await page.waitForTimeout(5000);
  const retrieve = async (operator: string, value: string, column = 'AttachmentGroup') => {
    if ((await f.locator('.criteriaFilter-Filter').count()) === 0) await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
    await f.selectOption('select[name="dvFilters[0].Column"]', column);
    await f.selectOption('select[name="dvFilters[0].Operator"]', { label: operator });
    await f.fill('input[name="dvFilters[0].Value"]', value);
    await f.click('#btnRetrieveData');
    await f.locator('tr.jqgrow').first().waitFor({ timeout: 25_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return (await f.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  };

  await test.step('F.12.20: opened from the web menu, the Link button is disabled; F.12.7 Retrieve Data; F.12.5 add / remove filters', async () => {
    expect(await f.locator('#btLink').isDisabled(), 'Link disabled from the web menu').toBe(true);
    expect(await f.locator('#btnRetrieveData').isEnabled()).toBe(true);
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
    const n = await f.locator('.criteriaFilter-Filter').count();
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
    const n2 = await f.locator('.criteriaFilter-Filter').count();
    console.log(`FILTER ROW HTML ${(await f.locator('.criteriaFilter-Filter').last().innerHTML()).replace(/\s+/g, ' ').slice(0, 500)}`);
    const removeBtn = f.locator('.criteriaFilter-Filter .criteriaFilter-RemoveButton, .criteriaFilter-Filter [class*="Remove"], .criteriaFilter-Filter span:has-text("Remove"), .criteriaFilter-Filter a:has-text("Remove")').last();
    await removeBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    const n3 = await f.locator('.criteriaFilter-Filter').count();
    console.log(`FILTER ROWS after add=${n}, add again=${n2}, remove one=${n3}`);
    expect(n2).toBeGreaterThan(n);
    if (n3 >= n2) deviation('AT.170103.F.12.5', 'a filter can be removed', 'Remove did not reduce the rows');
  });

  await test.step('F.12.8 / F.12.9 / F.12.15: the grid of the uploaded files, View x-x of x', async () => {
    const rows = await retrieve('Contains', group);
    console.log(`GRID ${JSON.stringify(rows)}`);
    expect(rows.length, 'the two uploaded MB files').toBe(2);
    const info = (await f.locator('.ui-paging-info').innerText()).trim();
    console.log(`PAGER ${info}`);
    if (!/^View \d+\s*[-–]\s*\d+ of \d+/.test(info)) deviation('AT.170103.F.12.15', 'View x-x of x', info);
    expect.soft(info).toMatch(/View 1\s*[-–]\s*2 of 2/);
  });

  await test.step('F.12.10 / F.12.9 / F.3.7 / F.3.13 / F.1.4: Advanced Options (available / selected lists, Limit Results) and the AttachmentFiles columns of the uploaded rows (FileID, Sequence 0, Active Y)', async () => {
    const available = (await f.locator('#availableLimitColumns option').allInnerTexts()).map((t) => t.trim());
    const selected = (await f.locator('#selectedLimitColumns option').allInnerTexts()).map((t) => t.trim());
    console.log(`ADVANCED available=${JSON.stringify(available)} selected=${JSON.stringify(selected)} limit=${await f.locator('#txtResultLimit').inputValue()}`);
    expect(available.length + selected.length).toBeGreaterThan(5);
    // move every available column into the grid
    if (!(await f.locator('#btAvlToSel').isVisible())) await f.getByText('Advanced Options', { exact: true }).first().click(); // the panel is collapsed by default
    await page.waitForTimeout(500);
    await f.locator('#availableLimitColumns').evaluate((sel: HTMLSelectElement) => {
      Array.from(sel.options).forEach((o) => { o.selected = true; });
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await f.click('#btAvlToSel');
    await page.waitForTimeout(500);
    await f.click('#btnRetrieveData');
    await f.locator('tr.jqgrow').first().waitFor({ timeout: 25_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const headers = (await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    const rowsText = (await f.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    console.log(`GRID HEADERS ${JSON.stringify(headers)}`);
    console.log(`GRID ROWS ${JSON.stringify(rowsText)}`);
    // cells are addressed by their jqGrid column name (aria-describedby ends with the name), not by position: the grid also holds hidden columns (Id, hidden_active)
    const cellOf = async (columnName: string, rowIdx: number) => {
      const c = f.locator('tr.jqgrow').nth(rowIdx).locator(`td[aria-describedby$="_${columnName}"]`);
      return (await c.count()) ? (await c.first().innerText()).trim() : undefined;
    };
    const sequence = await cellOf('Sequence', 0);
    const active = (await cellOf('Active', 0)) ?? (await cellOf('hidden_active', 0));
    const fileId = await cellOf('FileId', 0);
    console.log(`ROW 0: FileID=${fileId} Sequence=${sequence} Active=${active}`);
    if (sequence !== undefined && sequence !== '0') deviation('AU.170103.F.3.13', 'Sequence 0 for uploaded files', String(sequence));
    if (active !== undefined && !/^(Y|Yes)$/i.test(active)) /* grid shows Yes */ deviation('AU.170103.F.1.4', 'Active defaults to Y', String(active));
    if (fileId === undefined) deviation('AU.170103.F.3.7', 'a FileID per uploaded document (a FileID column)', `columns ${JSON.stringify(headers)}`);
    const expectedColumns = ['FileID', 'Sequence', 'FilePurpose', 'Description', 'AttachmentGroup', 'Filename', 'Param1', 'Param2', 'FileExtension', 'OriginallyUploadedBy', 'UploadedOn', 'Active'];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const present = new Set([...available, ...selected, ...headers].map(norm));
    const missing = expectedColumns.filter((c) => !present.has(norm(c)) && !present.has(norm(c.replace('File', 'File '))));
    console.log(`AttachmentFiles columns not offered: ${JSON.stringify(missing)}`);
    if (missing.length) deviation('AU.170103.F.1.3', 'columns of the AttachmentFiles table', `not offered: ${JSON.stringify(missing)}`);
  });

  await test.step('F.12.13: "No records to view" for an attachment that does not exist', async () => {
    const rows = await retrieve('Contains', 'zz_no_such_attachment_999');
    const text = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`NO RECORDS: rows=${rows.length} message=${text.includes('No records to view')}`);
    if (!text.includes('No records to view')) deviation('AT.170103.F.12.13', '"No records to view"', 'message not found');
    expect.soft(text).toContain('No records to view');
  });

  await test.step('F.12.12 / F.16.1 / F.19.1 / F.12.21: row Actions offer View, Download and Edit Attributes; Edit Attributes popup (File Purpose, Attachment Group, Param1, Param2) on an MB row', async () => {
    await retrieve('Contains', group);
    const row = f.locator('tr.jqgrow').first();
    await row.locator('a:has-text("Actions")').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    const actions = (await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim());
    console.log(`ROW ACTIONS ${JSON.stringify(actions)}`);
    for (const a of ['View', 'Download', 'Edit Attributes']) if (!actions.includes(a)) deviation('AT.170103.F.12.12', `row Action "${a}"`, JSON.stringify(actions));
    await f.locator('ul:visible li a').filter({ hasText: /^Edit Attributes$/ }).click({ force: true });
    await page.waitForTimeout(2500);
    const dialog = (await f.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    const fields = await f.locator('.ui-dialog:visible input, .ui-dialog:visible select').evaluateAll((els) => els.map((e: any) => `${e.id || e.name}|${e.tagName.toLowerCase()}|${e.value}`));
    console.log(`EDIT ATTRIBUTES DIALOG: ${JSON.stringify(dialog.slice(0, 300))} fields=${JSON.stringify(fields)}`);
    for (const label of ['Purpose', 'Group', 'Param1', 'Param2']) if (!new RegExp(label, 'i').test(dialog + fields.join(' '))) deviation('AT.170103.F.12.21', `Edit Attributes shows ${label}`, dialog.slice(0, 200));
    await f.locator('.ui-dialog:visible button').filter({ hasText: /^(Cancel|Close)$/ }).first().click({ timeout: 3000 }).catch(() => {});
  });

  await test.step('F.16.2 / F.19.4: View opens the document, Download offers a file (behavior of the two actions on the MB text file)', async () => {
    await retrieve('Contains', group);
    const row = f.locator('tr.jqgrow').first();
    const trigger = async (action: string) => {
      await row.locator('a:has-text("Actions")').first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      await f.locator('ul:visible li a').filter({ hasText: new RegExp(`^${action}$`) }).click({ force: true });
    };
    const download = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    const popup = page.context().waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await trigger('Download');
    const d = await download;
    console.log(`DOWNLOAD action: download event=${d ? d.suggestedFilename() : 'none'}`);
    if (!d) deviation('AT.170103.F.19.4', 'a file download is offered', 'no download event');
    await popup;
    const viewPopup = page.context().waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    const viewDownload = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await trigger('View');
    const vp = await viewPopup;
    const vd = await viewDownload;
    console.log(`VIEW action: new page=${vp ? vp.url() : 'none'} download=${vd ? vd.suggestedFilename() : 'none'}`);
    if (!vp && !vd) deviation('AT.170103.F.16.2', 'the document is downloaded and opened in the browser', 'neither a new page nor a download');
    await vp?.close().catch(() => {});
  });
});
