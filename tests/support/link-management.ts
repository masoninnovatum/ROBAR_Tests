// Link Management / Attachment Upload helpers shared by the Link Management specs (live 2026-10-15, TST703). A "Link By X" is: Associate drop-down -> the Link page -> filter to the target, check it ->
// Attach -> Attachment Management (filter on the file name, check the file, Link) -> job details "Job completed successfully". Detach: check the rows in Link Management, Detach (no confirmation).

import { expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { openMenuItem, findFrame } from './robar';

export const flat = async (f: Frame): Promise<string> => (await f.locator('body').innerText()).replace(/\s+/g, ' ').trim();
export const rowsOf = async (f: Frame): Promise<string[]> => (await f.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());

/** Picks the first <select> option whose value or text matches one of the patterns. */
export async function pick(sel: ReturnType<Frame['locator']>, patterns: RegExp[], what: string): Promise<string> {
  const opts = await sel.locator('option').evaluateAll((os) => os.map((o: any) => ({ v: o.value as string, t: (o.textContent ?? '').trim() })));
  for (const p of patterns) {
    const hit = opts.find((o) => p.test(o.t) || p.test(o.v));
    if (hit) { await sel.selectOption(hit.v); return hit.t; }
  }
  throw new Error(`no ${what} option matches ${patterns.join(' | ')}; options: ${JSON.stringify(opts.map((o) => o.t))}`);
}

/** Removes restored filter rows, adds one criterion (column picked by pattern) and retrieves; dismisses "Filter will take precedence". */
export async function retrieveWhere(page: Page, f: Frame, columnPatterns: RegExp[], value: string, operatorPatterns: RegExp[] = [/exactly/i, /contains/i]): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const rm = f.getByText('Remove', { exact: true });
    if (!(await rm.count())) break;
    await rm.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
  await page.waitForTimeout(500);
  const col = await pick(f.locator("select[name$='Column']").first(), columnPatterns, 'column');
  await pick(f.locator("select[name$='Operator']").first(), operatorPatterns, 'operator');
  await f.locator("input[name$='Value']").first().fill(value);
  console.log(`  filter ${col} = ${value}`);
  await f.click('#btnRetrieveData');
  await page.waitForTimeout(1500);
  await f.getByRole('button', { name: 'Continue' }).click({ timeout: 2500 }).catch(() => {});
  await f.locator('tr.jqgrow').first().waitFor({ timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

export async function openLinkManagement(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Link Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Link Management');
  const f = await findFrame(page, 'LinkAttachmentManagement/LinkManagement', { attempts: 80 });
  await f.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(4000);
  return f;
}

/** Link Management filtered to one file name; returns the frame with the rows loaded (zero rows = nothing linked). */
export async function showFileInLinkManagement(page: Page, fileName: string): Promise<Frame> {
  const f = await openLinkManagement(page);
  await retrieveWhere(page, f, [/^file.?name$/i, /file.?name/i], fileName, [/exactly/i, /contains/i]);
  return f;
}

/** Attachment Upload tile: uploads one local file with the first real File Purpose; returns when "uploaded successfully" shows. */
export async function uploadAttachment(page: Page, filePath: string, description: string): Promise<void> {
  await openMenuItem(page, 'Attachment Upload');
  const uploadFrame = await findFrame(page, 'LinkAttachmentManagement/UploadAttachments');
  await uploadFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await uploadFrame.setInputFiles('#fileToUpload0', filePath);
  await page.waitForTimeout(1000);
  const purposeSelect = uploadFrame.locator('select.ddlist').first();
  const realOptionValue = await purposeSelect.locator('option').nth(1).getAttribute('value');
  await purposeSelect.selectOption(realOptionValue!);
  await page.waitForTimeout(500);
  const confirmPurposeDialog = uploadFrame.locator('.ui-dialog:has-text("Confirm File Purpose")');
  if (await confirmPurposeDialog.count()) await confirmPurposeDialog.locator('button:has-text("OK")').click();
  await uploadFrame.locator('.chkFiles').first().check();
  await uploadFrame.locator('#description').first().fill(description);
  await uploadFrame.locator('#btnUpload').first().click({ force: true, timeout: 5000 });
  let returnMsg = '';
  let errorMsg = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.waitForTimeout(2000);
    const u2 = await findFrame(page, 'LinkAttachmentManagement/UploadAttachments');
    returnMsg = await u2.locator('#returnMessage').innerText({ timeout: 2000 }).catch(() => '');
    errorMsg = await u2.locator('#errorMessage').innerText({ timeout: 2000 }).catch(() => '');
    if (returnMsg || errorMsg) break;
  }
  expect(errorMsg, `upload error: ${errorMsg}`).toBe('');
  expect(returnMsg).toContain('uploaded successfully');
  await page.locator('li.ui-tabs-tab:has-text("Attachment Upload") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
}

/** Associate Attachments > <label>: filter the Link page to the target, check its first row, Attach, link the file. */
export async function linkBy(page: Page, fileName: string, label: string, pageUrl: string, columnPatterns: RegExp[], value: string): Promise<void> {
  const lm = await openLinkManagement(page);
  await lm.locator('#ddlLinkType').selectOption({ label });
  await lm.locator('#ddlLinkType').dispatchEvent('click'); // the page navigates on the select's click handler
  const lf = await findFrame(page, `LinkAttachmentManagement/${pageUrl}`, { attempts: 60 });
  await page.waitForTimeout(3000);
  await retrieveWhere(page, lf, columnPatterns, value);
  const rows = await rowsOf(lf);
  console.log(`  ${label}: ${rows.length} target row(s): ${JSON.stringify(rows.slice(0, 3))}`);
  expect(rows.length, `${label}: no target row for ${value}`).toBeGreaterThan(0);
  await lf.locator('tr.jqgrow').first().locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(800);
  await lf.click('#btnLinkAttachments');
  const am = await findFrame(page, 'LinkAttachmentManagement/AttachmentManagement', { attempts: 60 });
  await am.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await am.locator("select[name='dvFilters[0].Column']").selectOption('FileName');
  await am.locator("select[name='dvFilters[0].Operator']").selectOption('Contains');
  await am.locator("input[name='dvFilters[0].Value']").fill(fileName);
  await am.click('#btnRetrieveData');
  await am.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const fileRow = am.locator('#grdControl tr').filter({ hasText: fileName });
  await expect(fileRow, `${label}: ${fileName} not offered for linking`).toHaveCount(1, { timeout: 10_000 });
  await fileRow.locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(500);
  await am.click('#btLink', { force: true });
  const details = await findFrame(page, 'LinkAttachmentManagement/AttachmentDetails', { attempts: 60 });
  await details.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const text = await flat(details);
  console.log(`  ${label}: job details: ${text.slice(0, 260)}`);
  expect(text, `${label}: link job`).toContain('Job completed successfully');
  expect(text).toContain(fileName);
}

/** Detaches every Link Management row of the file and checks none is left. */
export async function detachAll(page: Page, fileName: string, label: string): Promise<void> {
  const f = await showFileInLinkManagement(page, fileName);
  const rows = await rowsOf(f);
  console.log(`  ${label}: ${rows.length} row(s) in Link Management before Detach: ${JSON.stringify(rows.slice(0, 4))}`);
  expect(rows.length, `${label}: the file should be linked now`).toBeGreaterThan(0);
  for (const r of await f.locator('tr.jqgrow').all()) await r.locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(800);
  await expect(f.locator('#btnDetach')).toBeEnabled({ timeout: 5000 });
  await f.click('#btnDetach', { timeout: 5000 });
  const details = await findFrame(page, 'LinkAttachmentManagement/AttachmentDetails', { attempts: 60 });
  await details.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  expect(await flat(details), `${label}: detach job`).toContain('Job completed successfully');
  const f2 = await showFileInLinkManagement(page, fileName);
  const left = await rowsOf(f2);
  console.log(`  ${label}: ${left.length} row(s) after Detach`);
  expect(left.length, `${label}: nothing may stay linked after Detach`).toBe(0);
}
