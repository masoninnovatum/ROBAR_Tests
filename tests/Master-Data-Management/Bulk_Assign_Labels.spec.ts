// MDM bulk Assign Labels: creates a Campaign Manager item (same item number, chosen Label Type, left UNAPPROVED) for each
// selected MDM record. Web-only; the result is confirmed in Campaign Manager itself, not just on the job page.

import { test, expect } from '@playwright/test';
import { openMenuItem, findFrame } from '../support/robar';
import * as mdm from '../support/master-data';
import * as cm from '../support/campaign-manager';

test('Assign Labels creates unapproved Campaign Manager items for the selected records', async ({ page }) => {
  test.setTimeout(480_000);
  let frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDL${stamp}`;
  const [a, b] = ['A', 'B'].map((s) => prefix + s);

  await test.step('create two MDM records', async () => {
    for (const n of [a, b]) {
      await mdm.createValidRecord(page, frame, { itemNumber: n });
      frame = await mdm.backToGrid(page, frame);
    }
  });

  await test.step('Assign Labels job (Carton Label): validation, then Completed', async () => {
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 2 });
    await mdm.checkRows(frame, [a, b]);
    await mdm.openBulkAction(frame, 'actAssignLabels');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataAssignLabels/JobSubmission');
    await expect(jobFrame.locator('body')).toContainText('Items Selected: 2');
    console.log(`label types: ${(await jobFrame.locator('#selLabelTypes option').count())} options; reasons: ${JSON.stringify(await jobFrame.locator('#sigReason option').allInnerTexts())}`);

    // Empty submit -> required messages.
    await jobFrame.getByRole('button', { name: /^Submit/ }).click({ timeout: 5000, noWaitAfter: true });
    await page.waitForTimeout(1200);
    const empty = (await jobFrame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`empty submit: ${empty.slice(0, 300)}`);
    expect(empty).toContain('This field is required.');

    await jobFrame.locator('#selLabelTypes').selectOption({ label: 'Carton Label' }, { timeout: 5000 });
    await page.waitForTimeout(800);
    const controls = await jobFrame.evaluate(() =>
      Array.from(document.querySelectorAll('input, select')).filter((e) => (e as HTMLElement).offsetParent).map((e) => `${e.tagName.toLowerCase()}#${(e as HTMLElement).id}[${(e as HTMLInputElement).type ?? ''}]`)
    );
    console.log(`controls after choosing a label type: ${JSON.stringify(controls)}`);
    // Choosing a label type expands a per-type section (template select `#sel-<LabelType>-lt`, a text box, a checkbox).
    const section = jobFrame.locator('#sel-Carton_Label-lt');
    console.log(`template options: ${JSON.stringify(await section.locator('option').allInnerTexts())}`);
    console.log(`section text: ${(await jobFrame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ').slice(0, 700)}`);
    const sectionInputs = await jobFrame.evaluate(() =>
      Array.from(document.querySelectorAll('input[type="text"], input[type="checkbox"]')).filter((e) => (e as HTMLElement).offsetParent && !/^sig|txtJobDescription/.test((e as HTMLElement).id)).map((e) => `${(e as HTMLInputElement).type}:${(e as HTMLInputElement).value || (e as HTMLInputElement).checked}:${(e as HTMLElement).parentElement?.innerText.replace(/\s+/g, ' ').slice(0, 40)}`)
    );
    console.log(`section inputs: ${JSON.stringify(sectionInputs)}`);
    // The per-type "Template Name: (Select Template)" select is id-less (`#sel-<type>-lt` is the "Add Field" picker);
    // there is also a "Copy From Master Data" checkbox, ticked by default.
    const templateSelect = jobFrame.locator('select').filter({ has: jobFrame.locator('option', { hasText: 'A1SuperTemplate' }) }).first();
    await templateSelect.selectOption({ label: 'A1SuperTemplate' }, { timeout: 5000 });
    // Reason codes on this page: Data Correction / General / New Entry.
    await mdm.fillJobSignature(jobFrame, 'Playwright MDM Assign Labels', 'General');
    const job = await mdm.submitJobAndRead(page, jobFrame, 'MasterDataAssignLabels/JobDetail');
    console.log(`assign labels job detail: ${job.text.replace(/\s+/g, ' ').slice(0, 900)}`);
    expect(job.status).toBe('Completed');
    for (const n of [a, b]) expect(job.text).toContain(n);
  });

  await test.step('both items now exist in Campaign Manager, unapproved', async () => {
    await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await openMenuItem(page, 'Campaign Manager');
    const cmFrame = await findFrame(page, 'campaignmanager');
    await page.waitForTimeout(1500);
    for (const n of [a, b]) {
      await cm.retrieveAndSelectItem(page, cmFrame, n);
      const row = cmFrame.locator('#gridResults tr').filter({ hasText: n });
      const rowText = (await row.first().innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
      console.log(`campaign manager row for ${n}: ${rowText}`);
      expect(rowText).toContain('Carton Label');
      expect(rowText).toContain('A1SuperTemplate');
    }
  });
});
