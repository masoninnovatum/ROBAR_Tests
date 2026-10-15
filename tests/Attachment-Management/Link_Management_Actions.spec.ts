// Link Management ACTIONS (IQ17): View, Download, Edit, Detach and Link By LCN / Item / Item Version / Template / Template Version -- the write side that the read-only
// Link_Management_Requirements / _Security specs never touched. Self-contained (headless, TST703, seed user Claude01, no BarTender): creates and approves a Campaign Manager item
// (A1SuperTemplate), assigns it an LCN, uploads ONE new text file (unique name; uploads cannot be deleted), then links that file in turn
//   By LCN, By Item, By Item Version, By Template, By Template Version
// each time: Link Management -> Associate drop-down -> the Link page -> filter to the target, check it -> Attach -> Attachment Management (filter on the file name, check, Link) -> job details
// -> back in Link Management the file shows up (rows dumped) -> Detach -> the file is gone. The first link also runs View / Download / Edit on the row (Edit: a .txt is refused; a real edit is Link_Management_Edit_Document.spec.ts).
// Template links go to the shared template A1SuperTemplate, so they are detached again straight away. Leftovers: the new item (CLLMA...), its LCN and the uploaded file (none can be deleted).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as LM from '../support/link-management';
import { rowsOf } from '../support/link-management';

test.use({ actionTimeout: 20_000 });

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}


test('Link Management actions: Link By LCN / Item / Item Version / Template / Template Version, View, Download, Edit, Detach', async ({ page }) => {
  test.setTimeout(2_400_000);
  await login(page);

  const stamp = Date.now().toString().slice(-7);
  const itemNumber = `CLLMA${stamp}`;
  const fileName = `CLLinkAct${stamp}.txt`;
  const filePath = path.join(os.tmpdir(), fileName);
  fs.writeFileSync(filePath, 'Playwright Link Management actions test file.');
  let lcn = '';

  async function openLabelControlAndQuery(): Promise<Frame> {
    await openMenuItem(page, 'Label Control');
    let frame = await findFrame(page, 'LabelControl/Management');
    await frame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    // no #btnReset (it crashes the renderer once criteria are saved): remove the restored criteria rows by hand
    for (let i = 0; i < 8; i++) {
      const rm = frame.getByText('Remove', { exact: true });
      if (!(await rm.count())) break;
      await rm.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await frame.locator('#drpApproved').selectOption({ label: 'All (LCN Status)' });
    await frame.locator('#drpAttachments').selectOption({ label: 'Any (Attachments)' });
    await frame.locator('#drpLabelMaster').selectOption({ label: 'Any (Label Masters)' });
    await frame.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(500);
    await frame.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
    await frame.locator("select[name$='Operator']").first().selectOption('ExactlyMatches');
    await frame.locator("input[name$='Value']").first().fill(itemNumber);
    await frame.click('#btnRetrieveData');
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    frame = await findFrame(page, 'LabelControl/Management');
    return frame;
  }
  const closeLabelControl = () => page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});

  await test.step('setup: create and approve a Campaign Manager item', async () => {
    await openMenuItem(page, 'Campaign Manager');
    const cmFrame = await findFrame(page, 'campaignmanager');
    await page.waitForTimeout(1000);
    await cmFrame.click('#btnCreateNew');
    await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible' });
    await cmFrame.fill('#txtItemNumber', itemNumber);
    await cmFrame.selectOption('#ddlLabelType', LABEL_TYPE);
    await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');
    const editFrame = await findFrame(page, 'items/edit');
    await editFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);
    await editFrame.selectOption('select[name="txtTemplateName"]', TEMPLATE);
    await editFrame.fill('input[name="txtDescription"]', 'Playwright Link Management actions test item');
    const [saveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/') && r.request().method() === 'POST', { timeout: 15_000 }),
      editFrame.click('button:has-text("Save")'),
    ]);
    expect(saveResponse.status()).toBe(200);
    await page.waitForTimeout(1000);
    await editFrame.click('text=Actions');
    await editFrame.click('text=Approve Item');
    await page.waitForTimeout(500);
    const approveDialog = editFrame.locator('#approveItemDialog');
    await approveDialog.locator('#sigUser').fill(USERNAME);
    await approveDialog.locator('#sigPassword').fill(PASSWORD);
    await approveDialog.locator('#sigComments').fill('Approved by Playwright Link Management actions test');
    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
      editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
    ]);
    const approveBody = await approveResponse.json();
    expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);
    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click();
    await page.waitForTimeout(500);
  });

  await test.step('setup: assign a Label Control Number to the item', async () => {
    const frame = await openLabelControlAndQuery();
    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row, `Item ${itemNumber} not found in Label Control`).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actAssignLabelControl', { force: true });
    const jobFrame = await findFrame(page, 'MassAssign/JobSubmission');
    await jobFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);
    await jobFrame.fill('#txtJobDescription', 'Playwright Link Management actions test -- Assign Control Number');
    await jobFrame.fill('#sigUser', USERNAME);
    await jobFrame.fill('#sigPassword', PASSWORD);
    await jobFrame.selectOption('#sigReason', { label: 'General' });
    await jobFrame.fill('#sigComments', 'Assigned by Playwright test');
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn'),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);
    await closeLabelControl();
    for (let attempt = 0; attempt < 10 && !lcn; attempt++) {
      await page.waitForTimeout(2000);
      const f2 = await openLabelControlAndQuery();
      lcn = ((await f2.locator('#grdLabelControl tr').filter({ hasText: itemNumber }).innerText().catch(() => '')).match(/LCN\d+/) ?? [''])[0];
      await closeLabelControl();
    }
    expect(lcn, `item ${itemNumber} never got an LCN`).toBeTruthy();
    console.log(`SETUP item ${itemNumber} LCN ${lcn} file ${fileName}`);
  });

  await test.step('setup: upload one new attachment (Attachment Upload tile)', async () => {
    await LM.uploadAttachment(page, filePath, `Playwright Link Management actions test -- ${itemNumber}`);
    fs.unlinkSync(filePath);
  });

  const showFileInLinkManagement = () => LM.showFileInLinkManagement(page, fileName);
  const linkBy = (label: string, pageUrl: string, columnPatterns: RegExp[], value: string) => LM.linkBy(page, fileName, label, pageUrl, columnPatterns, value);
  const detachAll = (label: string) => LM.detachAll(page, fileName, label);

  await test.step('Link By LCN, then View / Download / Edit on the Link Management row, then Detach', async () => {
    await linkBy('By LCN', 'LinkLCNAttachments', [/item.?number/i, /label control number/i], itemNumber);
    const f = await showFileInLinkManagement();
    const rows = await rowsOf(f);
    console.log(`BY LCN rows in Link Management: ${JSON.stringify(rows)}`);
    expect(rows.some((r) => r.includes(lcn) && r.includes(itemNumber)), 'a row with the LCN and the item').toBe(true);

    const row = f.locator('tr.jqgrow').first();
    const trigger = async (action: string) => {
      await row.locator('a:has-text("Actions")').first().click({ timeout: 5000 });
      await page.waitForTimeout(600);
      if (action === "View") console.log(`ROW ACTIONS ${JSON.stringify((await f.locator("ul:visible li a").allInnerTexts()).map((t) => t.trim()))}`);
      await f.locator('ul:visible li a').filter({ hasText: new RegExp(`^${action}`) }).first().click({ force: true });
    };
    // View
    const viewPopup = page.context().waitForEvent('page', { timeout: 20_000 }).catch(() => null);
    const viewDownload = page.waitForEvent('download', { timeout: 20_000 }).catch(() => null);
    await trigger('View');
    const vp = await viewPopup;
    const vd = await viewDownload;
    console.log(`VIEW: new page=${vp ? vp.url() : 'none'} download=${vd ? vd.suggestedFilename() : 'none'}`);
    if (vp) { await vp.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {}); console.log(`VIEW page text: ${((await vp.locator('body').innerText().catch(() => '')) || '').slice(0, 120)}`); }
    expect(!!vp || !!vd, 'View opens the document (new page or download)').toBe(true);
    await vp?.close().catch(() => {});

    // Download
    const dl = page.waitForEvent('download', { timeout: 20_000 }).catch(() => null);
    await trigger('Download');
    const d = await dl;
    console.log(`DOWNLOAD: ${d ? d.suggestedFilename() : 'none'}`);
    expect(d, 'Download offers a file').toBeTruthy();
    expect(d!.suggestedFilename()).toBe(fileName);
    const saved = path.join(os.tmpdir(), `dl_${fileName}`);
    await d!.saveAs(saved);
    expect(fs.readFileSync(saved, 'utf8')).toContain('Playwright Link Management actions test file.');
    fs.unlinkSync(saved);

    // Edit = the Redline / Document Edit flow (GetFileToken -> innoclient: protocol -> Sentinel DocumentEdit plugin opens the file in its desktop application). A .txt file is refused with a message; the
    // desktop edit of an editable type (docx) is covered by Link_Management_Edit_Document.spec.ts.
    await trigger('Edit');
    await page.waitForTimeout(2500);
    const dlgText = (await f.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    console.log(`EDIT on a .txt file: ${dlgText}`);
    expect(dlgText, 'a .txt file cannot be edited').toContain('This type of file cannot be edited.');
    await f.locator('.ui-dialog:visible button').filter({ hasText: /^(Close|Continue|Ok|OK)$/ }).first().click({ timeout: 3000 }).catch(() => {});

    await detachAll('By LCN');
  });

  await test.step('Link By Item, Detach', async () => {
    await linkBy('By Item', 'LinkItemAttachments', [/item.?number/i], itemNumber);
    const rows = await rowsOf(await showFileInLinkManagement());
    console.log(`BY ITEM rows in Link Management: ${JSON.stringify(rows)}`);
    expect(rows.some((r) => r.includes(itemNumber)), 'a row for the item').toBe(true);
    await detachAll('By Item');
  });

  await test.step('Link By Item Version, Detach', async () => {
    await linkBy('By Item Version', 'LinkItemVersionAttachments', [/item.?number/i], itemNumber);
    const rows = await rowsOf(await showFileInLinkManagement());
    console.log(`BY ITEM VERSION rows in Link Management: ${JSON.stringify(rows)}`);
    expect(rows.some((r) => r.includes(itemNumber)), 'a row for the item version').toBe(true);
    await detachAll('By Item Version');
  });

  await test.step('Link By Template, Detach', async () => {
    await linkBy('By Template', 'LinkTemplateAttachments', [/label.?name/i, /template.?name/i], TEMPLATE);
    const rows = await rowsOf(await showFileInLinkManagement());
    console.log(`BY TEMPLATE rows in Link Management: ${JSON.stringify(rows.slice(0, 5))} (${rows.length})`);
    expect(rows.some((r) => r.includes(TEMPLATE)), 'a row for the template').toBe(true);
    await detachAll('By Template');
  });

  await test.step('Link By Template Version, Detach', async () => {
    await linkBy('By Template Version', 'LinkTemplateVersionAttachments', [/template.?name/i, /label.?name/i], TEMPLATE);
    const rows = await rowsOf(await showFileInLinkManagement());
    console.log(`BY TEMPLATE VERSION rows in Link Management: ${JSON.stringify(rows.slice(0, 5))} (${rows.length})`);
    expect(rows.some((r) => r.includes(TEMPLATE)), 'a row for the template version').toBe(true);
    await detachAll('By Template Version');
  });
});
