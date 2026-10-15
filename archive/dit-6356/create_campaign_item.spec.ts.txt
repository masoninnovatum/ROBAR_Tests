// Approves the Campaign Manager Item already created for UAT_6356 (MBUAT6356E_1790694817112,
// same Item Number as the MDM record, mirroring MDM_Print12.1.doc's pairing pattern) -- the item
// itself already exists (confirmed live: an earlier #btnCreateNew + Submit succeeded before
// failing later at template selection), so navigate straight to its Edit page via
// support/campaign-manager.ts's goToItem() (adapted for VAL703) rather than searching the grid.
//
// Template fix: A1SuperTemplate (TST703 fixture) doesn't exist in VAL703 -- switched to
// VAL703Temp1, one of several VAL703-specific test templates confirmed present via this run's
// own dump of select[name="txtTemplateName"]'s real options.

import { test, expect } from '@playwright/test';
import { login, findFrame, USERNAME, PASSWORD, BASE_URL } from '../support/robar';

const ITEM_NUMBER = 'MBUAT6356E_1790694817112';
const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'VAL703Temp1';

test('approve the existing Campaign Manager item for UAT_6356', async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);
  await login(page);

  // goToItem's own hardcoded URL is rooted at the site origin (/InnoPages/...), not under
  // BASE_URL's /innovatum/WebMenu/ path -- derive the origin instead of concatenating BASE_URL.
  const origin = new URL(BASE_URL).origin;
  const editUrl = `${origin}/InnoPages/items/Edit?itemNumber=${encodeURIComponent(ITEM_NUMBER)}&labelType=${encodeURIComponent(LABEL_TYPE)}&versionNumber=0`;
  await page.goto(editUrl);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_cm_direct_nav.png', fullPage: true });

  await page.selectOption('select[name="txtTemplateName"]', TEMPLATE, { timeout: 5000 }).catch(() => {});
  await page.fill('input[name="txtDescription"]', 'UAT_6356 Print by Lot test item', { timeout: 5000 }).catch(() => {});

  // Save is disabled (`!isDirty()`) when a prior run already saved these exact values -- confirmed
  // live (a re-run with unchanged Template/Description hit "element is not enabled" on Save).
  // Only click it when the form actually has unsaved changes.
  const saveButton = page.locator('button:has-text("Save")');
  const saveEnabled = await saveButton.isEnabled({ timeout: 3000 }).catch(() => false);
  if (saveEnabled) {
    const [saveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/') && r.request().method() === 'POST', { timeout: 15_000 }),
      saveButton.click({ timeout: 5000 }),
    ]);
    console.log('save status: ' + saveResponse.status());
    expect(saveResponse.status()).toBe(200);
  } else {
    console.log('Save button not enabled -- item already saved with these values, skipping.');
  }

  await page.waitForTimeout(1000);
  await page.click('text=Actions', { timeout: 5000 });
  // jQuery UI Menu wraps each <a> in a sibling ".ui-menu-item-wrapper" div that visually overlaps
  // and intercepts pointer events on the <a> itself -- force the click through rather than fighting
  // Playwright's actionability "receives events" check.
  await page.click('text=Approve Item', { timeout: 5000, force: true });
  await page.waitForTimeout(500);

  const approveDialog = page.locator('#approveItemDialog');
  await approveDialog.locator('#sigUser').fill(USERNAME, { timeout: 5000 });
  await approveDialog.locator('#sigPassword').fill(PASSWORD, { timeout: 5000 });
  await approveDialog.locator('#sigComments').fill('Approved by Playwright for UAT_6356', { timeout: 5000 });

  // Confirmed via outerHTML dump: #approveItemDialog is the jQuery UI dialog's CONTENT div --
  // the .ui-dialog-buttonpane (Submit/Cancel) is a SIBLING the widget renders alongside it, not a
  // descendant. Scoping the Submit click under approveDialog (a locator rooted at #approveItemDialog)
  // can therefore never find it -- search at the page level instead, matching the original
  // Create_Approved_Item.spec.ts pattern (which was iframe-scoped there, page-scoped here since
  // this test navigates directly rather than going through the WebMenu iframe shell).
  // Read the JSON body INSIDE the waitForResponse chain, not after -- this page navigates
  // (top-level, no iframe insulating it) right after ApproveItem responds, and awaiting the raw
  // Response object first then calling .json() afterward hits "No resource with given identifier
  // found" once that navigation has already torn down the response body cache.
  const [approveBody] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }).then((r) => r.json()),
    page.locator('.ui-dialog-buttonpane button:has-text("Submit")').click({ timeout: 5000 }),
  ]);
  console.log('approve result: ' + JSON.stringify(approveBody));
  expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

  await page.waitForTimeout(1500);
  const approvedStatus = page.locator('span[data-bind*="approvedStatus"]');
  await expect(approvedStatus).not.toHaveText('Unapproved');
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_cm_item_approved.png', fullPage: true });
});
