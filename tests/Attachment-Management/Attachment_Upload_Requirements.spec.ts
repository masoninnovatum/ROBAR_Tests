// Attachment Upload re-checked against ValMaster (module "Attachment Upload", AU.170103.*; live 2026-10-11, headless, TST703, seed user Claude01). Menu tile "Attachment Upload" (process Attach_Upload_View) opens
// `InnoPages/LinkAttachmentManagement/UploadAttachments?LinkedFromWebmenu=1`. Differences from a requirement are annotated `deviation <id>` (the spec stays green).
// Data policy: the only real upload is TWO tiny text files named MBAUT<stamp>_a.txt / _b.txt with Attachment Group MBAUT<stamp> (the AttachmentFiles rows are found and, where the page allows, set inactive in
// Attachment_Management_Requirements.spec.ts). Everything else only selects files in the grid (nothing is submitted).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { login, openMenuItem, findFrame } from '../support/robar';
import { readGlobalSetting } from '../support/global-settings';

test.use({ actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Attachment Upload vs ValMaster: grid, File Purpose list, popups, excluded extensions, Reset, a real two-file upload', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  // settings first (a mid-spec Dynamic UI read leaves a stale tab)
  const excluded = await readGlobalSetting(page, 'AttachUploadExcludedExt').catch(() => undefined);
  console.log(`SETTING AttachUploadExcludedExt = ${excluded}`);
  const stamp = Date.now().toString().slice(-6);
  const group = `MBAUT${stamp}`;
  const tmp = path.join(os.tmpdir(), `mb_au_${stamp}`);
  fs.mkdirSync(tmp, { recursive: true });
  const mk = (name: string, body = 'Playwright attachment upload probe') => {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, body);
    return p;
  };
  const a = mk(`${group}_a.txt`);
  const b = mk(`${group}_b.txt`);

  await openMenuItem(page, 'Attachment Upload');
  let f: Frame = await findFrame(page, 'UploadAttachments', { attempts: 80 });
  await page.waitForTimeout(4000);
  const rows = () => f.locator('#selectedFiles tbody tr');
  const cell = (r: number, c: number) => rows().nth(r).locator('td').nth(c);

  await test.step('F.1.5 / F.1.6: excluded extension list (default .EXE, .DLL, .CHM, .SQL, .COM) and the message for a blocked file', async () => {
    // the setting holds the extensions WITHOUT dots, comma separated ("dll,exe,com,chm,sql")
    const list = (excluded ?? '').toLowerCase().split(',').map((x) => x.trim().replace(/^\./, ''));
    for (const ext of ['exe', 'dll', 'chm', 'sql', 'com']) {
      if (!list.includes(ext)) deviation('AU.170103.F.1.6', `default excluded list contains .${ext}`, `AttachUploadExcludedExt = "${excluded}"`);
    }
    const blocked = mk(`${group}_blocked.exe`);
    await f.locator('#fileToUpload0').setInputFiles([blocked]);
    await page.waitForTimeout(2500);
    const msg = (await f.locator('#invalidExtMessage').innerText().catch(() => '')).trim();
    const added = await rows().count();
    console.log(`BLOCKED EXE: message="${msg}" gridRows=${added}`);
    if (msg !== 'File extension not allowed.') deviation('AU.170103.F.1.5', '"File extension not allowed."', `"${msg}"`);
    expect.soft(added, 'the blocked file is not added to the grid').toBe(0);
    expect.soft(msg.length, 'a message is shown').toBeGreaterThan(0);
  });

  await test.step('F.3.1 - F.3.10: Browse, grid columns, FileName copied to Description, pre-selected check boxes, Select All, deselect, Reset', async () => {
    await f.locator('#fileToUpload0').setInputFiles([a, b]);
    await page.waitForTimeout(2500);
    const headers = (await f.locator('#selectedFiles thead th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    console.log(`GRID HEADERS ${JSON.stringify(headers)}`);
    expect(headers).toEqual(['File Purpose', 'File Name', 'Description', 'Param1', 'Param2']);
    expect(await rows().count()).toBe(2);
    for (const r of [0, 1]) {
      expect(await cell(r, 0).locator('input[type=checkbox]').isChecked(), `row ${r + 1} pre-selected (F.3.8)`).toBe(true);
      const fileName = await cell(r, 2).locator('input').inputValue();
      const description = await cell(r, 3).locator('input').inputValue();
      expect(description, 'FileName copied into Description (F.3.4)').toBe(fileName);
      expect(await cell(r, 3).locator('input').isEditable(), 'Description editable (F.3.5)').toBe(true);
    }
    // F.3.6: focusing the Description selects its whole content
    await cell(0, 3).locator('input').focus();
    const selected = await cell(0, 3).locator('input').evaluate((e: HTMLInputElement) => e.selectionStart === 0 && e.selectionEnd === e.value.length);
    console.log(`DESCRIPTION text fully selected on focus: ${selected}`);
    if (!selected) deviation('AU.170103.F.3.6', 'the whole Description is selected on tab / click', 'not selected');
    // F.3.9: the check box can be cleared
    await cell(1, 0).locator('input[type=checkbox]').uncheck();
    expect(await cell(1, 0).locator('input[type=checkbox]').isChecked()).toBe(false);
    await cell(1, 0).locator('input[type=checkbox]').check();
    // F.3.10: Reset clears the grid
    await f.locator('#btnReset').click();
    await page.waitForTimeout(1500);
    const afterReset = await rows().count();
    console.log(`ROWS after Reset: ${afterReset}`);
    if (afterReset !== 0) deviation('AU.170103.F.3.10', 'Reset clears the grid', `${afterReset} rows left`);
    expect.soft(afterReset).toBe(0);
  });

  await test.step('F.4.1 - F.4.7: File Purpose drop-down (Select Purpose first, configured list), Missing File Purpose tooltip', async () => {
    await f.locator('#fileToUpload0').setInputFiles([a, b]);
    await page.waitForTimeout(2500);
    const options = (await cell(0, 1).locator('select option').allInnerTexts()).map((t) => t.trim());
    console.log(`FILE PURPOSES ${JSON.stringify(options)}`);
    expect(options[0], 'F.4.4').toBe('Select Purpose');
    for (const p of ['Approvals', 'IFU', 'Label Requests', 'Redline', 'Redline Compare']) {
      if (!options.includes(p)) deviation('AU.170103.F.4.7', `default File Purpose "${p}"`, JSON.stringify(options));
      expect.soft(options).toContain(p);
    }
    expect(await f.locator('#btnUpload').isDisabled(), 'Upload disabled without a File Purpose (F.4.5)').toBe(true);
    const tip = await f.locator('#btnUpload').getAttribute('title');
    console.log(`UPLOAD tooltip = "${tip}"`);
    if (tip !== 'Missing File Purpose') deviation('AU.170103.F.4.5', 'tooltip "Missing File Purpose"', `"${tip}"`);
  });

  await test.step('F.4.6 / F.5.2 / F.5.3: Apply-to-all popups for File Purpose, Param1 and Param2 (Yes / No, do not show again)', async () => {
    const popup = async () => (await f.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    await cell(0, 1).locator('select').selectOption({ label: 'Approvals' });
    await page.waitForTimeout(1500);
    const p1 = await popup();
    const c1 = await f.locator('.ui-dialog:visible input').evaluateAll((els) => els.map((e: any) => `${e.id}|${e.type}`));
    console.log(`PURPOSE POPUP ${JSON.stringify(p1)} controls=${JSON.stringify(c1)}`);
    if (!/Apply to all records\?/.test(p1) || !c1.includes('applyAllYes|radio') || !c1.includes('applyAllNo|radio') || !c1.includes('chkShowAgain|checkbox')) deviation('AU.170103.F.4.6', '"Apply to all records?" with Yes / No radio buttons and a "do not show again" check box', p1);
    await f.locator('#applyAllNo').check();
    await f.locator('.ui-dialog:visible button').filter({ hasText: /^OK$/ }).click();
    await page.waitForTimeout(800);
    expect(await cell(1, 1).locator('select').inputValue(), 'No = only this row').toBe('Select');
    for (const [col, name, req] of [[4, 'Param1', 'AU.170103.F.5.2'], [5, 'Param2', 'AU.170103.F.5.3']] as const) {
      await cell(0, col).locator('input').fill(`P-${name}`);
      await cell(0, col).locator('input').press('Tab');
      await page.waitForTimeout(1200);
      const pp = await popup();
      console.log(`${name} POPUP ${JSON.stringify(pp)}`);
      if (!/Apply to all records\?/.test(pp)) deviation(req, '"Apply to all records?" popup', pp || 'no popup');
      await f.locator('#applyAllYes').check().catch(() => {});
      await f.locator('.ui-dialog:visible button').filter({ hasText: /^OK$/ }).click().catch(() => {});
      await page.waitForTimeout(800);
      const second = await cell(1, col).locator('input').inputValue();
      console.log(`${name}: second row after Yes = "${second}"`);
      expect.soft(second, `${name} applied to the other selected row`).toBe(`P-${name}`);
    }
  });

  await test.step('F.3.11 / F.3.12 / F.3.13 / F.3.14 / F.1.3 / F.1.4 / U.3: a real upload of two tiny files with an Attachment Group (nothing else is uploaded)', async () => {
    await cell(1, 1).locator('select').selectOption({ label: 'Approvals' }).catch(() => {});
    await page.waitForTimeout(1200);
    await f.locator('.ui-dialog:visible button').filter({ hasText: /^(OK|Cancel)$/ }).first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    expect(await cell(1, 1).locator('select').inputValue()).not.toBe('Select');
    await f.locator('#attachmentGroup').fill(group);
    expect(await f.locator('#btnUpload').isEnabled(), 'Upload enabled once every selected row has a File Purpose').toBe(true);
    await f.locator('#btnUpload').click();
    await page.waitForTimeout(6000);
    f = await findFrame(page, 'UploadAttachments', { attempts: 40 });
    const ok = (await f.locator('#returnMessage').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const err = (await f.locator('#errorMessage').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    console.log(`UPLOAD RESULT message="${ok}" error="${err}" body="${(await f.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200)}"`);
    if (!/2 files uploaded successfully/i.test(ok)) deviation('AU.170103.F.3.14', '"2 files uploaded successfully" under the page title', `"${ok}" / "${err}"`);
    fs.writeFileSync('test-data/run-results/attachment-upload-last.json', JSON.stringify({ group, files: [path.basename(a), path.basename(b)], message: ok, error: err }, null, 2));
  });
});
