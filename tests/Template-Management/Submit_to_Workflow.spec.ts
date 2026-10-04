// Bulk action: Submit to Workflow (TM_SubmitToWorkflow-1.8), server-side action name
// "SendToWorkflowJobSubmission" (see bulkActionSubmission() in Management.cshtml).
//
// Live-confirmed (2026-09-30) via Playwright, no prior MCP exploration -- this bulk action had no
// test coverage at all before this file. Key findings:
// - No e-signature fields at all (unlike Approve/Retire) -- just Job Description, Workflow
//   Comments, a Preset dropdown, a Link External PDF checkbox, and Add Attachments.
// - Choosing a Preset dynamically loads and displays its configured step(s) inline on the page
//   itself. "ROBAR Only" (the same preset already confirmed to have real steps in Campaign
//   Manager's own Send to Workflow) has one real step here too.
// - #btnSubmit's enable binding does NOT recompute purely from .fill()'ing #txtComment -- same
//   "needs an explicit blur" Knockout pattern confirmed throughout this app elsewhere (e.g.
//   Mass_Approve_Templates.spec.ts's signature fields). Press Tab before relying on the button's
//   enabled state.
// - Submit POSTs to a SubmitJob endpoint returning {JobID, Success, JobDetailUrl, ErrorString},
//   then navigates to a "Submit to Workflow Job Detail" page with the standard job-detail header
//   plus a "Template Job Detail" sub-grid (Template Name/Label Type/Template Version/Status/
//   Message) showing per-template status ("Inserted" immediately after submit).

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as bartender from '../support/bartender';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find.
test.use({ headless: false });

test('submit to workflow submits a template into a workflow preset', async ({ page }) => {
  // Generous budget for the Sentinel/BarTenderEdit launch-and-close round trip.
  test.setTimeout(300_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBWorkflowTest' + Math.floor(Math.random() * 100000);

  await test.step('create a throwaway template', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', 'Created via automated Playwright test (Submit to Workflow)');
    await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
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
    await bartender.saveTemplate(page, bartenderPid);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  await test.step('query for it, check it, and start Submit to Workflow', async () => {
    await frame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
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

    const row = frame.locator('#grdJqGrid tr').filter({ hasText: templateName });
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
      row.locator('input[type="checkbox"]').check(),
    ]);
    await page.waitForTimeout(500);

    await frame.getByText('Bulk Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    await frame.getByText('Submit to Workflow', { exact: true }).click();
    await frame.getByRole('heading', { name: 'Submit to Workflow' }).waitFor({ state: 'visible', timeout: 15_000 });
  });

  await test.step('fill and submit the workflow job', async () => {
    await frame.fill('#txtJobDescription', 'Playwright submit to workflow job');
    await frame.fill('#txtComment', 'Sent to workflow by Playwright test');
    // Submit's enable binding needs an explicit blur -- .fill() alone doesn't trigger it.
    await frame.locator('#txtComment').press('Tab');

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('GetWorkflowSteps'), { timeout: 10_000 }).catch(() => null),
      frame.selectOption('#drpPreset', { label: 'ROBAR Only' }),
    ]);
    await page.waitForTimeout(500);

    const submitButton = frame.locator('#btnSubmit');
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('SubmitJob') && r.request().method() === 'POST', { timeout: 15_000 }),
      submitButton.click(),
    ]);
    const body = await response.json();
    expect(body.Success, `SubmitJob failed: ${JSON.stringify(body)}`).toBe(true);

    await expect(frame.getByRole('heading', { name: 'Submit to Workflow Job Detail' })).toBeVisible();
    await expect(frame.locator('body')).toContainText('Inserted');
  });
});
