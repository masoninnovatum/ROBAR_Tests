// Campaign Manager helpers shared across tests/campaign-manager/*.spec.ts.
//
// IMPORTANT -- concurrency hazard confirmed live (2026-09-04): Campaign Manager's grid
// "Retrieve Items" appears to read/write some per-ACCOUNT (not per-browser-session) server-side
// query state. Two concurrent logins as the same account (e.g. a leftover/zombie browser session
// still open, or two test workers running at once) can cause one session's Retrieve Items to come
// back with a COMPLETELY DIFFERENT item than the one just filtered for -- not an error, just
// silently wrong data. This is why playwright.config.ts pins `workers: 1` for this whole suite.
// If you ever raise worker count again, at minimum keep tests/campaign-manager/**/*.spec.ts
// serialized (see Playwright's fullyParallel / describe.serial), and never leave a manually
// launched browser script logged in as mbuser1 running in the background while other automation
// runs against the same server.

import type { Frame, Locator, Page } from '@playwright/test';
import { findFrame, login, openMenuItem, USERNAME, PASSWORD } from './robar';

export const LABEL_TYPE = 'Carton Label';
export const TEMPLATE = 'A1SuperTemplate';

/**
 * Fixes the hidden #RecordsPerPage field back to a real number. Plain assignment only works if no
 * more corrupting writes land afterward -- see waitForRecordsPerPageAjax, which this should always
 * be called after, not as a substitute for it.
 */
async function fixRecordsPerPage(frame: Frame): Promise<void> {
  await frame.evaluate(() => {
    (document.getElementById('RecordsPerPage') as HTMLInputElement).value = '20';
  });
}

/**
 * Waits for RetrieveItems()'s GetUserEnvRecordsPerPage AJAX call to fully settle, if one is
 * in flight or about to fire. Confirmed bug: that call's `complete` callback is fire-and-forget
 * and passes the raw jqXHR object (not the parsed response) into `$("#RecordsPerPage").val(...)`,
 * corrupting the hidden #RecordsPerPage field to the literal string "[object Object]" -- which
 * then fails Do Action's real (native, non-AJAX) form submission with "The value '[object Object]'
 * is not valid for RecordsPerPage." Patching the field's value via JS (even atomically with the
 * Do Action click, even via a property-setter override) is NOT reliable, because this corrupting
 * write can still land after any such patch -- the only fully reliable fix is to let the corrupting
 * call finish first, then patch once, with nothing left pending. Best-effort: resolves immediately
 * (no throw) if no such call is seen within the timeout, since it may already have completed.
 */
async function waitForRecordsPerPageAjax(page: Page, timeout = 3_000): Promise<void> {
  await page
    .waitForResponse((r) => r.url().includes('/CampaignManager/GetUserEnvRecordsPerPage'), { timeout })
    .catch(() => {});
}

/** Logs in and opens the Campaign Manager grid frame. */
export async function openCampaignManager(page: Page): Promise<Frame> {
  await login(page);
  await openMenuItem(page, 'Campaign Manager');
  const cmFrame = await findFrame(page, 'campaignmanager');
  await page.waitForTimeout(1000); // grid JS finishes wiring up after the frame URL resolves
  return cmFrame;
}

export interface CreateItemOptions {
  labelType?: string;
  template?: string;
  description?: string;
}

export interface CreatedItem {
  itemNumber: string;
  editFrame: Frame;
}

/**
 * Creates a new item via Create New Item (Item Number + Label Type only), then saves it with a
 * Template and Description on the resulting Item Edit page (Description is required to Save even
 * though the creation dialog never asks for it or flags it).
 */
export async function createItem(
  page: Page,
  cmFrame: Frame,
  { labelType = LABEL_TYPE, template = TEMPLATE, description = 'Playwright automated test item' }: CreateItemOptions = {}
): Promise<CreatedItem> {
  const itemNumber = 'TESTPW' + Date.now().toString().slice(-6);

  await cmFrame.click('#btnCreateNew');
  await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible' });
  await cmFrame.fill('#txtItemNumber', itemNumber);
  await cmFrame.selectOption('#ddlLabelType', labelType);
  await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');

  const editFrame = await findFrame(page, 'items/edit');
  await editFrame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);

  await editFrame.selectOption('select[name="txtTemplateName"]', template);
  await editFrame.fill('input[name="txtDescription"]', description);
  await editFrame.click('button:has-text("Save")');
  await page.waitForTimeout(1500);

  return { itemNumber, editFrame };
}

/**
 * Navigates from an Item Edit page back to the Campaign Manager grid via the breadcrumb link
 * (top-left "<- Campaign Manager" inside #header -- id is a random GUID per page load, so this
 * selects by the element's position, not a fixed id).
 *
 * Confirmed live: the grid frame automatically re-issues the account's LAST-USED search filter
 * (a persisted "remember last search" feature) the instant it loads, with no interaction from us.
 * If our own filter setup + Retrieve Items click happens while that automatic request is still in
 * flight, our click silently no-ops (no new request fires) and whatever the stale automatic
 * response returns is left on screen -- looking exactly like Retrieve Items "returned the wrong
 * item". Waiting for that automatic load to fully settle before touching the filter UI avoids it.
 */
export async function backToGrid(page: Page, editFrame: Frame): Promise<Frame> {
  await editFrame.locator('#header a').click();
  const cmFrame = await findFrame(page, 'campaignmanager');
  await page.waitForResponse((r) => r.url().includes('/CampaignManager/GetData'), { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(500);
  return cmFrame;
}

/**
 * Filters the grid to exactly one item by Item Number and checks its row's checkbox.
 *
 * The grid frame auto-restores the account's last-used filter row on load (see backToGrid's doc
 * comment) -- including its VALUE, from whatever item a previous test last searched for. Blindly
 * clicking "Add Filter" on top of that stale row creates a second criterion instead of replacing
 * it, turning the query into an impossible "old item AND new item" AND that can never match
 * anything. So: reuse an existing filter row (always index 0) if one is already present, and only
 * click "Add Filter" to create a fresh row when none exists.
 */
export async function retrieveAndSelectItem(
  page: Page,
  cmFrame: Frame,
  itemNumber: string,
  { attempts = 8 }: { attempts?: number } = {}
): Promise<Locator> {
  const hasExistingFilterRow = (await cmFrame.locator('.criteriaFilter-Filter').count()) > 0;
  if (!hasExistingFilterRow) {
    await cmFrame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
  }
  await cmFrame.selectOption('select[name="Filters[0].Column"]', 'itemsItemNumber');
  await cmFrame.selectOption('select[name="Filters[0].Operator"]', 'ExactlyMatches');
  await cmFrame.fill('input[name="Filters[0].Value"]', itemNumber);

  const checkbox = cmFrame.locator(`input.cbox[id^="jqg_gridResults_${itemNumber}|"]`);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    // Match on the request body (not just the URL): the grid frame can have its own auto-load
    // GetData call already in flight when we get here, and a URL-only match can catch that
    // unrelated, already-in-flight response instead of the one our click below triggers.
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/CampaignManager/GetData') &&
          r.request().method() === 'POST' &&
          (r.request().postData() || '').includes(itemNumber),
        { timeout: 10_000 }
      ),
      cmFrame.click('#btnRetrieveItems'),
    ]);
    await waitForRecordsPerPageAjax(page);
    const found = await checkbox
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (found) break;
    if (attempt === attempts) {
      throw new Error(
        `Item "${itemNumber}" never appeared in the Campaign Manager grid after ${attempts} Retrieve Items attempts (filter Value stayed correct in the DOM each time -- see retrieveAndSelectItem's doc comment).`
      );
    }
    await page.waitForTimeout(1500);
  }

  // Every Retrieve Items click above also fired the buggy GetUserEnvRecordsPerPage call (see
  // waitForRecordsPerPageAjax) -- each one was waited out above, so none should still be pending.
  // Small settle wait: the HTTP response landing (what we waited for) and jQuery's `complete`
  // callback actually running are two different ticks: this closes that gap before the final fix.
  await page.waitForTimeout(300);
  await fixRecordsPerPage(cmFrame);
  await checkbox.check();
  return checkbox;
}

/**
 * Selects a bulk action from the "Select Action" dropdown and clicks Do Action. `actionValue` is
 * the <option value="..."> from #Action, e.g. 'massitemapprove', 'RetireItems', 'CreatePDF'.
 * Do Action navigates the frame to a "Job Submission - <Action>" form (Description of Job +
 * Signature block), not a modal dialog. Assumes retrieveAndSelectItem already drained every
 * pending GetUserEnvRecordsPerPage call and fixed #RecordsPerPage as its last step -- nothing
 * between that and here touches it again, so a plain click is safe.
 */
export async function startBulkAction(page: Page, cmFrame: Frame, actionValue: string): Promise<void> {
  await cmFrame.selectOption('#Action', actionValue);
  await page.waitForTimeout(300);
  await cmFrame.click('#btnDoAction');
  await findFrame(page, '/CampaignManager/JobSubmission');
  await page.waitForTimeout(500);
}

export interface SubmitJobOptions {
  jobDescription?: string;
  username?: string;
  password?: string;
  comment?: string;
  extraFields?: (frame: Frame) => Promise<void>;
}

/**
 * Fills the Job Submission form's Description + Signature block and submits it. `extraFields`
 * lets a specific action fill additional fields (e.g. Mass Item Update's Field/New Value rows)
 * before Submit is clicked.
 * Returns the parsed JSON body of the SubmitJob response.
 */
export async function submitJob(
  page: Page,
  cmFrame: Frame,
  { jobDescription, username = USERNAME, password = PASSWORD, comment, extraFields }: SubmitJobOptions = {}
): Promise<any> {
  if (jobDescription !== undefined) {
    await cmFrame.fill('#Description', jobDescription);
  }
  await cmFrame.fill('#Signature_UserName', username);
  await cmFrame.fill('#Signature_Password', password);
  if (comment !== undefined) {
    await cmFrame.fill('#Signature_Comment', comment);
  }
  if (extraFields) {
    await extraFields(cmFrame);
  }

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/SubmitJob'), { timeout: 15_000 }),
    cmFrame.click('#SubmitButton'),
  ]);
  return response.json();
}

/** Opens the Item Edit page's "Actions" menu (top-right) and clicks the item with the given text. */
export async function openItemAction(editFrame: Frame, menuText: string): Promise<void> {
  await editFrame.click('text=Actions');
  await editFrame.waitForTimeout(300);
  await editFrame.click(`text=${menuText}`);
  await editFrame.waitForTimeout(500);
}

export interface SignatureDialogOptions {
  username?: string;
  password?: string;
  reasonCode?: string;
  comment?: string;
}

/**
 * Fills and submits one of the Item Edit page's e-signature dialogs (Approve/Retire/UnRetire all
 * use this same signature-block markup). `dialogSelector` scopes the fields (e.g. '#approveItemDialog',
 * '#retireItemDialog') because their #sigUser/#sigPassword/#sigReason/#sigComments ids are NOT
 * unique on the page -- every one of these dialogs reuses the same ids, so an unscoped selector
 * can silently target a different, hidden dialog. `responseUrlIncludes` matches the endpoint the
 * Submit click POSTs to (e.g. 'RetireUnretireItem', 'ApproveItem').
 */
export async function submitSignatureDialog(
  page: Page,
  frame: Frame,
  dialogSelector: string,
  responseUrlIncludes: string,
  { username = USERNAME, password = PASSWORD, reasonCode, comment }: SignatureDialogOptions = {}
): Promise<any> {
  const dialog = frame.locator(dialogSelector);
  await dialog.locator('#sigUser').fill(username);
  await dialog.locator('#sigPassword').fill(password);
  if (reasonCode !== undefined) {
    await dialog.locator('#sigReason').selectOption(reasonCode);
  }
  if (comment !== undefined) {
    await dialog.locator('#sigComments').fill(comment);
  }

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(responseUrlIncludes), { timeout: 15_000 }),
    frame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
  ]);
  return response.json();
}

/**
 * Navigates directly to an item's Edit page (top-level, not via the grid). Useful after a bulk
 * action whose SubmitJob redirects to a Job Detail page instead of the item itself, when the test
 * just needs to confirm the item's resulting state.
 */
export async function goToItem(page: Page, itemNumber: string, labelType = LABEL_TYPE): Promise<void> {
  await page.goto(
    `http://vmsrvtst703/InnoPages/items/Edit?itemNumber=${encodeURIComponent(itemNumber)}&labelType=${encodeURIComponent(labelType)}&versionNumber=0`
  );
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
}

/** Reads the approved-status text (e.g. "MBUser1 - 9/4/2026" or "Unapproved") from an item's Edit page. */
export async function getApprovedStatus(page: Page, itemNumber: string, labelType = LABEL_TYPE): Promise<string> {
  await goToItem(page, itemNumber, labelType);
  const text = await page.locator('span[data-bind*="approvedStatus"]').textContent();
  return (text ?? '').trim();
}
