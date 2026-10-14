// SMOKE TIER 1 (headless, writes CL data, ~1-2 min): Attachment Upload + Attachment Management: one tiny .txt file is uploaded with File Purpose "Approvals" and a new Attachment Group, the page
// reports success, and Attachment Management lists exactly one attachment for that group. Attachments cannot be deleted: one CLSmkAtt<stamp> group is left behind per run.
// Flow and selectors: Attachment-Management/Attachment_Upload_Requirements.spec.ts ("a real upload") and Attachment_Management_Requirements.spec.ts (retrieve by AttachmentGroup).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { login, openMenuItem, findFrame } from '../../support/robar';

test.use({ actionTimeout: 20_000 });

test('@smoke @tier1 Attachment Upload then Attachment Management lists it', async ({ page }) => {
  test.setTimeout(300_000);
  const stamp = Date.now().toString().slice(-6);
  const group = `CLSmkAtt${stamp}`;
  const file = path.join(os.tmpdir(), `${group}.txt`);
  fs.writeFileSync(file, 'Playwright smoke test attachment');
  await login(page);

  await test.step('upload one file (File Purpose Approvals, new Attachment Group)', async () => {
    await openMenuItem(page, 'Attachment Upload');
    let f: Frame = await findFrame(page, 'UploadAttachments', { attempts: 80 });
    await page.waitForTimeout(4000);
    await f.locator('#fileToUpload0').setInputFiles([file]);
    await page.waitForTimeout(2500);
    const purpose = f.locator('#selectedFiles tbody tr').nth(0).locator('td').nth(1).locator('select');
    await purpose.selectOption({ label: 'Approvals' });
    await page.waitForTimeout(1200);
    await f.locator('.ui-dialog:visible button').filter({ hasText: /^(OK|Cancel)$/ }).first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    await f.locator('#attachmentGroup').fill(group);
    expect(await f.locator('#btnUpload').isEnabled(), 'Upload is enabled once the row has a File Purpose').toBe(true);
    await f.locator('#btnUpload').click();
    await page.waitForTimeout(6000);
    f = await findFrame(page, 'UploadAttachments', { attempts: 40 });
    const ok = (await f.locator('#returnMessage').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const err = (await f.locator('#errorMessage').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    console.log(`SMOKE upload result: "${ok}" error "${err}"`);
    expect(ok, `upload success message (error: ${err})`).toMatch(/1 files? uploaded successfully/i);
  });

  await test.step('Attachment Management lists it', async () => {
    await page.locator('li.ui-tabs-tab:has-text("Attachment Upload") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await openMenuItem(page, 'Attachment Management');
    const f = await findFrame(page, 'AttachmentManagement', { attempts: 80 });
    await page.waitForTimeout(5000);
    if ((await f.locator('.criteriaFilter-Filter').count()) === 0) await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
    await f.selectOption('select[name="dvFilters[0].Column"]', 'AttachmentGroup');
    await f.selectOption('select[name="dvFilters[0].Operator"]', { label: 'Contains' });
    await f.fill('input[name="dvFilters[0].Value"]', group);
    await f.click('#btnRetrieveData');
    await f.locator('tr.jqgrow').first().waitFor({ timeout: 25_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const rows = (await f.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    console.log(`SMOKE attachment rows: ${JSON.stringify(rows)}`);
    expect(rows, 'exactly one attachment in the new group').toHaveLength(1);
    expect(rows[0]).toContain(group);
  });
});
