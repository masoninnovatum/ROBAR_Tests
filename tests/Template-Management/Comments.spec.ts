// Row-level action: View/Edit Comments (TM_Comments-1.4).
//
// Live-confirmed (2026-09-14) via direct MCP browser exploration before writing this test rather
// than guessing selectors -- see robar-module-reference.md's "Template Management" section.
// Source-grounded against Innovatum.Pages.TemplateManagement.MVC's Management.cshtml
// (openCommentsDialog) and Views/TemplateManagement/Comments.cshtml.
//
// Architecturally different from every other Template Management action tested so far: clicking
// "View/Edit Comments" doesn't open an in-page dialog or launch BarTender at all -- it's a plain
// `window.open(...)` to a genuinely separate page (TemplateManagement/Comments?templateName=...
// &versionNumber=...), so this test captures it as its own Playwright `Page` via
// `context.waitForEvent('page')` rather than a `Frame`/dialog locator. No FlaUI involved anywhere
// in this test.
//
// TM_Comments-1.4's own script covers a lot more than this test does -- security-process-gated
// visibility/enablement (TM_View_Comments/TM_Edit_Comments/TM_Delete_Comments/TM_Comments_Super)
// and multi-user "can't edit/delete someone else's comment" scenarios. None of that is exercised
// here (this suite has no second, lesser-privileged test account) -- this test only proves the
// single-user CRUD lifecycle: add a comment, cancel an in-progress edit, actually edit it, then
// delete it.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME } from '../support/robar';
import * as bartender from '../support/bartender';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find. Comments itself never
// touches BarTender, but the throwaway template this test creates first still does.
test.use({ headless: false });

test('view/edit comments supports adding, canceling an edit, editing, and deleting a comment', async ({ page, context }) => {
  // Generous budget for the initial throwaway-template creation's BarTender launch-and-close;
  // Comments itself is pure browser interaction and fast.
  test.setTimeout(300_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBCommentsTest' + Math.floor(Math.random() * 100000);

  await test.step('create a throwaway template to comment on', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', 'Created via automated Playwright test (Comments)');
    await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    // Comments don't depend on the template's actual content, so a blank starter is fine.
    await frame.setInputFiles('#newFileInput', String.raw`\\vmsrvtst703\BaseTemplates\NewTemplate.btw`);
    await page.waitForTimeout(500);

    const [createResponse, tokenResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      frame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
    ]);
    const createBody = await createResponse.json();
    const tokenBody = await tokenResponse.json();
    expect(createBody.Success, `CreateNewTemplate failed: ${JSON.stringify(createBody)}`).toBe(true);
    expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();

    const bartenderPid = await bartender.launchTemplateEditor(page);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  await test.step('query for the template', async () => {
    await frame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
    // Confirmed live: this page's CriteriaFilter widget instance is named "dvFilters" (unlike
    // Campaign Manager's instance) -- field names are "dvFilters[0].Column" etc.
    await frame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName');
    await frame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches');
    await frame.fill('input[name="dvFilters[0].Value"]', templateName);

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/TemplateManagement/GridSessionStart') &&
          r.request().method() === 'POST' &&
          (r.request().postData() || '').includes(templateName),
        { timeout: 15_000 }
      ),
      frame.click('#btnRetrieveData'),
    ]);
  });

  const row = frame.locator('#grdJqGrid tr').filter({ hasText: templateName });

  await row.waitFor({ state: 'visible', timeout: 10_000 });
  await row.getByText('Actions', { exact: true }).click();
  // Standing convention for Template Management row/bulk actions: give the dropMenu popup a moment
  // to finish rendering before the next click, rather than racing it.
  await page.waitForTimeout(500);

  // "View/Edit Comments" opens a real new browser window/tab (window.open), not an in-page dialog
  // -- capture it as its own Page via the context's 'page' event, not a frame/dialog locator.
  const [commentsPage] = await Promise.all([
    context.waitForEvent('page'),
    frame.getByText('View/Edit Comments', { exact: true }).click(),
  ]);
  await commentsPage.waitForLoadState();

  const newCommentInput = commentsPage.locator('#txtNewComment');
  const newCommentSubmit = commentsPage.locator('.submission-panel button');
  const bubble = commentsPage.locator('.bubble');

  await test.step('dialog shows the expected header and empty state', async () => {
    await expect(commentsPage.locator('.control-panel')).toContainText(`Template Name: ${templateName}`);
    await expect(commentsPage.locator('.control-panel')).toContainText('Label Type: Carton Label');
    await expect(commentsPage.locator('.control-panel')).toContainText('Version: 0');
    await expect(commentsPage.getByText('No comments to display')).toBeVisible();
    await expect(newCommentSubmit).toBeDisabled();
    await commentsPage.waitForTimeout(1000);
  });

  const originalCommentText = 'Automated Playwright test comment';

  await test.step('adds a new comment', async () => {
    // Confirmed live: #txtNewComment is bound with `valueUpdate: 'afterkeydown'` -- Playwright's
    // own .fill() sets the value and fires input/change events but never enables the Submit
    // button, because knockout's afterkeydown binding specifically listens for real keystrokes.
    // pressSequentially (via `slowly: true`-equivalent) dispatches genuine keydown events instead.
    await newCommentInput.pressSequentially(originalCommentText);
    await expect(newCommentSubmit).toBeEnabled();

    await Promise.all([
      commentsPage.waitForResponse((r) => r.url().includes('/TemplateManagement/GetTemplateComments'), { timeout: 10_000 }),
      newCommentSubmit.click(),
    ]);

    await expect(bubble).toContainText(originalCommentText);
    await expect(bubble).toContainText('Version: 0');
    await expect(bubble).toContainText(USERNAME, { ignoreCase: true });
    await expect(newCommentInput).toHaveValue('');
    // Standing convention in this suite: pause at a visually meaningful moment so a human watching
    // the run can actually see the result land, not just trust the assertion that follows.
    await commentsPage.waitForTimeout(1000);
  });

  await test.step('cancels an in-progress edit without changing the comment', async () => {
    await bubble.getByRole('link', { name: 'Edit', exact: true }).click();
    await commentsPage.waitForTimeout(500);
    const editInput = bubble.locator('textarea');
    await expect(editInput).toHaveValue(originalCommentText);

    await editInput.fill('this change should never be saved');
    await commentsPage.waitForTimeout(500);
    await bubble.getByRole('button', { name: 'Cancel', exact: true }).click();
    await commentsPage.waitForTimeout(500);

    await expect(bubble).toContainText(originalCommentText);
    await expect(bubble.getByText('this change should never be saved')).toHaveCount(0);
  });

  const editedCommentText = 'Edited Playwright test comment';

  await test.step('edits the comment', async () => {
    await bubble.getByRole('link', { name: 'Edit', exact: true }).click();
    await commentsPage.waitForTimeout(500);
    const editInput = bubble.locator('textarea');
    await editInput.selectText();
    // Same afterkeydown gotcha as the new-comment field above.
    await editInput.pressSequentially(editedCommentText);
    await commentsPage.waitForTimeout(500);

    await Promise.all([
      commentsPage.waitForResponse((r) => r.url().includes('/TemplateManagement/GetTemplateComments'), { timeout: 10_000 }),
      bubble.getByRole('button', { name: 'Submit', exact: true }).click(),
    ]);

    await expect(bubble).toContainText(editedCommentText);
    await expect(bubble).toContainText('Last edited by');
    await expect(bubble).toContainText(USERNAME, { ignoreCase: true });
    await commentsPage.waitForTimeout(1000);
  });

  await test.step('deletes the comment', async () => {
    await Promise.all([
      commentsPage.waitForResponse((r) => r.url().includes('/TemplateManagement/GetTemplateComments'), { timeout: 10_000 }),
      bubble.getByRole('link', { name: 'Delete', exact: true }).click(),
    ]);

    await expect(commentsPage.getByText('No comments to display')).toBeVisible();
    await expect(bubble).toHaveCount(0);
    await commentsPage.waitForTimeout(1000);
  });

  await commentsPage.close();
});
