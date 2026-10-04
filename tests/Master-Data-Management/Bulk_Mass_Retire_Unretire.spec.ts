// MDM bulk Mass Retire - Unretire on three fresh records. Web-only.
//   1. Retire A + B (all-active selection -> "Retire" preselected): Job Detail shows them inactive
//   2. A mixed selection (A inactive + C active) warns "You have selected both Active and Inactive items..."
//   3. Unretire A + B (all-inactive selection -> "Unretire" preselected, Effective End Date field): active again

import { test, expect } from '@playwright/test';
import { findFrame } from '../support/robar';
import * as mdm from '../support/master-data';

test('Mass Retire - Unretire: retire, mixed-selection warning, unretire', async ({ page }) => {
  test.setTimeout(480_000);
  let frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDR${stamp}`;
  const [a, b, c] = ['A', 'B', 'C'].map((s) => prefix + s);

  const reopenGrid = async () => {
    await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Master Data', exact: true }).click({ timeout: 10_000 });
    frame = await findFrame(page, 'MasterData');
    await page.waitForTimeout(1500);
  };

  await test.step('create three active records', async () => {
    for (const n of [a, b, c]) {
      await mdm.createValidRecord(page, frame, { itemNumber: n });
      frame = await mdm.backToGrid(page, frame);
    }
  });

  await test.step('Retire A + B: Retire is preselected, the job completes and they are inactive', async () => {
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [a, b]);
    await mdm.openBulkAction(frame, 'actMassRetire');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassRetire/JobSubmission');
    await expect(jobFrame.locator('body')).toContainText('Items Selected: 2');
    expect(await jobFrame.locator('#retireItems').isChecked({ timeout: 3000 }), 'all-active selection preselects Retire').toBe(true);
    await mdm.fillJobSignature(jobFrame, 'Playwright MDM Mass Retire');
    const job = await mdm.submitJobAndRead(page, jobFrame, 'MasterDataMassRetire/JobDetail');
    console.log(`mass retire job detail: ${job.text.replace(/\s+/g, ' ').slice(0, 900)}`);
    expect(job.status).toBe('Completed');
    for (const n of [a, b]) expect(job.text).toContain(n);
  });

  await test.step('a mixed active + inactive selection shows the warning', async () => {
    await reopenGrid();
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [a, c]);
    await frame.click('#drpActions', { timeout: 5000 });
    await page.waitForTimeout(500);
    await frame.locator('#actMassRetire').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(2000);
    const dialogs = (await frame.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    console.log(`mixed selection dialog: ${dialogs.slice(0, 400)}`);
    expect(dialogs).toContain('You have selected both Active and Inactive');
    await frame.locator('.ui-dialog:visible button').filter({ hasText: /Continue/i }).first().click({ timeout: 5000 });
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassRetire/JobSubmission');
    await expect(jobFrame.locator('body')).toContainText('Items Selected: 2');
    console.log(`mixed selection radios: retire=${await jobFrame.locator('#retireItems').isChecked()} unretire=${await jobFrame.locator('#unretireItems').isChecked()}`);
  });

  await test.step('Unretire A + B: Unretire is preselected with an Effective End Date, and they are active again', async () => {
    await reopenGrid();
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [a, b]);
    await frame.click('#drpActions', { timeout: 5000 });
    await page.waitForTimeout(500);
    await frame.locator('#actMassRetire').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(2000);
    const dialogs = (await frame.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    console.log(`all-inactive selection dialog: ${dialogs.slice(0, 300)}`);
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassRetire/JobSubmission');
    expect(await jobFrame.locator('#unretireItems').isChecked({ timeout: 3000 }), 'all-inactive selection preselects Unretire').toBe(true);
    const controls = await jobFrame.evaluate(() =>
      Array.from(document.querySelectorAll('input, select')).filter((e) => (e as HTMLElement).offsetParent).map((e) => `${e.tagName.toLowerCase()}#${(e as HTMLElement).id}[${(e as HTMLInputElement).type ?? ''}]=${(e as HTMLInputElement).value}`)
    );
    console.log(`unretire controls: ${JSON.stringify(controls)}`);
    await mdm.fillJobSignature(jobFrame, 'Playwright MDM Mass Unretire');
    // Unretire needs an Effective End Date: submitting without one is refused with a dialog.
    await jobFrame.getByRole('button', { name: /^Submit/ }).click({ timeout: 5000, noWaitAfter: true });
    await expect(jobFrame.locator('.ui-dialog:visible').first()).toBeVisible({ timeout: 8000 });
    const refused = (await jobFrame.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    console.log(`unretire without a date: ${refused}`);
    expect(refused).toContain('Effective End Date Required.');
    await jobFrame.locator('.ui-dialog:visible button').filter({ hasText: /Continue|Close|OK/i }).first().click({ timeout: 5000 });
    // The date box is a readonly datepicker: drive the widget API, as in Manage Production Availability.
    await jobFrame.locator('input[id^="dp"]').evaluate((el) => { const $ = (window as any).jQuery; $(el).datepicker('setDate', new Date(2099, 11, 31)); $(el).trigger('change'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, undefined, { timeout: 5000 });
    console.log(`unretire date now: ${await jobFrame.locator('input[id^="dp"]').inputValue()}`);
    await jobFrame.getByRole('button', { name: /^Submit/ }).click({ timeout: 5000, noWaitAfter: true });
    await page.waitForTimeout(2000);
    const after = (await frame.locator('.ui-dialog:visible').allInnerTexts().catch(() => [])).join(' | ').replace(/\s+/g, ' ');
    const afterJob = (await jobFrame.locator('.ui-dialog:visible').allInnerTexts().catch(() => [])).join(' | ').replace(/\s+/g, ' ');
    console.log(`unretire submit dialogs: ${after} || ${afterJob}`);
    const confirm = jobFrame.locator('.ui-dialog:visible button').filter({ hasText: /Continue/i }).first();
    if ((await confirm.count()) > 0) await confirm.click({ timeout: 5000 });
    let detail = await findFrame(page, 'MasterDataMassRetire/JobDetail');
    await detail.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    let text = '';
    for (let i = 0; i < 40; i++) {
      text = (await detail.locator('body').innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ');
      if (/Status\s+(Completed|Error|Failed)/.test(text)) break;
      await page.waitForTimeout(2000);
      detail = await findFrame(page, 'MasterDataMassRetire/JobDetail');
    }
    console.log(`mass unretire job detail: ${text.slice(0, 900)}`);
    expect(text).toMatch(/Status\s+Completed/);
    for (const n of [a, b]) expect(text).toContain(n);
  });
});
