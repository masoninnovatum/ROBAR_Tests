// Creates a new Campaign Manager item and approves it via the e-signature dialog.
//
// Flow confirmed live against http://vmsrvtst703/innovatum/WebMenu/ (build 7.0.3.20099):
//   Campaign Manager -> Create New Item (#btnCreateNew) -> Item Number + Label Type only
//   -> navigates to /InnoPages/items/Edit -> Template select[name="txtTemplateName"] and
//   Description input[name="txtDescription"] have NO id, only name -> Save requires
//   Description to be filled or it blocks with "Description is required." -> Actions ->
//   Approve Item opens #approveItemDialog with #sigUser/#sigPassword/#sigReason/#sigComments --
//   these ids are NOT unique on the page (retire/unretire dialogs reuse the same
//   signature-block ids), so they must be scoped to #approveItemDialog or Playwright will
//   target a hidden duplicate.
//
// See .agents/robar-module-reference.md (MsBuild repo) "Campaign Manager" section for the
// wider module reference this was cross-checked against.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

test('create a new Campaign Manager item and approve it', async ({ page }) => {
  await login(page);

  await openMenuItem(page, 'Campaign Manager');
  const cmFrame = await findFrame(page, 'campaignmanager');
  await page.waitForTimeout(1000);

  const itemNumber = 'TESTPW' + Date.now().toString().slice(-6);
  await cmFrame.click('#btnCreateNew');
  await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible' });
  await cmFrame.fill('#txtItemNumber', itemNumber);
  await cmFrame.selectOption('#ddlLabelType', LABEL_TYPE);
  await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');

  const editFrame = await findFrame(page, 'items/edit');
  await editFrame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);

  await editFrame.selectOption('select[name="txtTemplateName"]', TEMPLATE);
  await editFrame.fill('input[name="txtDescription"]', 'Playwright automated test item');

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
  await approveDialog.locator('#sigComments').fill('Approved by Playwright automated test');
  // Reason Code left at its default ("DataLoad") -- both options (DataLoad/MassApprove) are valid.

  const [approveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
    editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
  ]);
  const approveBody = await approveResponse.json();
  expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

  // Approve Item redirects to a fresh Edit?... URL for the same item/version -- wait for it and
  // confirm the "Approved By" field reflects the approving user rather than "Unapproved".
  const finalFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
  await finalFrame.waitForLoadState('networkidle').catch(() => {});

  const approvedStatus = finalFrame.locator('span[data-bind*="approvedStatus"]');
  await expect(approvedStatus).not.toHaveText('Unapproved');
  await expect(approvedStatus).toContainText(USERNAME, { ignoreCase: true });
});
