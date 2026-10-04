// MDM bulk Assign GTIN, the "Add Source DI Field" mode. The job page holds a list of assignment rows; a row is either
//   Field to Update + Packaging Code + Company Prefix (a counter-generated GTIN), or
//   Field to Update + Packaging Code + Source DI (a GTIN derived from an existing DI field of the SAME record).
// Observed on two fresh unapproved records with known Primary DI Numbers:
//   row 1  Unit of Use DI Number <- Company Prefix "Innovatum" (counter)
//   row 2  Package DI Number     <- Source DI "Primary DI Number", Packaging Code 1
//          =>  packaging code + Primary DI digits 2-13 + a RECOMPUTED GS1 mod-10 check digit (indicator and check digit of the
//          source are dropped; two records whose Primary DIs differ only in the last digit therefore get the SAME derived GTIN).
// Web-only.

import { test, expect } from '@playwright/test';
import * as mdm from '../support/master-data';

test('Assign GTIN with an Add Source DI Field row derives the GTIN from the record\'s own DI and replaces the indicator digit', async ({ page }) => {
  test.setTimeout(480_000);
  let frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBGSD${stamp}`;
  const items = [
    { n: prefix + 'A', primary: '00841646' + stamp },
    { n: prefix + 'B', primary: '00841647' + stamp },
  ];
  /** GS1 mod-10 check digit for a 13-digit GTIN body. */
  const gs1Check = (body: string) => {
    const sum = body.split('').reverse().reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
    return String((10 - (sum % 10)) % 10);
  };
  /** Source DI GTIN = packaging code + Primary DI digits 2..13 + a RECOMPUTED GS1 check digit (the old check digit is dropped). */
  const derived = (packaging: string, primary: string) => {
    const body = packaging + primary.slice(1, 13);
    return body + gs1Check(body);
  };

  await test.step('create two unapproved records with known Primary DI Numbers', async () => {
    for (const i of items) {
      await mdm.createValidRecord(page, frame, { itemNumber: i.n, primaryDi: i.primary });
      frame = await mdm.backToGrid(page, frame);
    }
  });

  const openAssign = async () => {
    frame = await mdm.reopenMasterData(page);
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 2 });
    await mdm.checkRows(frame, items.map((i) => i.n));
    await mdm.openBulkAction(frame, 'actAssignGTIN');
    return mdm.openJobPage(page, 'MasterDataAssignGTIN/JobSubmission');
  };
  const SELECTS = 'select:not(#sigReason)';
  const TEXTS = 'input[type="text"]:not(#sigUser):not(#sigComments):not(#txtJobDescription)';

  await test.step('page: one Company Prefix row; "Add Source DI Field" adds a Source DI row, "Remove" takes a row away', async () => {
    const jf = await openAssign();
    await expect(jf.locator(SELECTS)).toHaveCount(2); // Field to Update + Company Prefix
    await expect(jf.getByText('Add Source DI Field')).toHaveCount(1);
    await jf.getByText('Add Source DI Field').click({ timeout: 5000 });
    await expect(jf.locator(SELECTS)).toHaveCount(4, { timeout: 5000 });
    const sourceOptions = (await jf.locator(SELECTS).nth(3).locator('option').allInnerTexts()).map((t) => t.trim());
    console.log(`Source DI options: ${JSON.stringify(sourceOptions)}`);
    expect(sourceOptions[0]).toBe('(select)');
    expect(sourceOptions).toEqual(expect.arrayContaining(['Primary DI Number', 'Unit of Use DI Number', 'Package DI Number']));
    expect(await jf.locator(TEXTS).evaluateAll((is) => is.map((i) => (i as HTMLInputElement).value)), 'Packaging Code defaults to 0 in both rows').toEqual(['0', '0']);
    await jf.getByText('Remove').last().click({ timeout: 5000 });
    await expect(jf.locator(SELECTS)).toHaveCount(2, { timeout: 5000 });
  });

  await test.step('run both rows: counter GTIN on Unit of Use, Source-DI GTIN (packaging code 1) on Package DI', async () => {
    const jf = await openAssign();
    await jf.getByText('Add Source DI Field').click({ timeout: 5000 });
    await expect(jf.locator(SELECTS)).toHaveCount(4, { timeout: 5000 });
    const sel = jf.locator(SELECTS);
    await sel.nth(0).selectOption({ label: 'Unit of Use DI Number' }, { timeout: 5000 });
    await sel.nth(1).selectOption({ label: 'Innovatum' }, { timeout: 5000 });
    await sel.nth(2).selectOption({ label: 'Package DI Number' }, { timeout: 5000 });
    await sel.nth(3).selectOption({ label: 'Primary DI Number' }, { timeout: 5000 });
    await jf.locator(TEXTS).nth(1).fill('1', { timeout: 5000 });
    await mdm.fillJobSignature(jf, 'Playwright Assign GTIN Source DI');
    const job = await mdm.submitJobAndRead(page, jf, 'MasterDataAssignGTIN/JobDetail');
    console.log(`job: ${job.status} ${job.text.replace(/\s+/g, ' ').slice(150, 700)}`);
    expect(job.status).toBe('Completed');
    const text = job.text.replace(/\s+/g, ' ');
    expect(text).toContain('Unit_of_Use_DI_Number');
    expect(text).toContain('Package_DI_Number');
    for (const i of items) {
      const m = text.match(new RegExp(`${i.n}\\s+0\\s+Playwright MDM record\\s+(\\d{14})\\s+(\\d{14})`));
      expect(m, `a result row for ${i.n}`).not.toBeNull();
      const [, unitOfUse, packageDi] = m!;
      expect(unitOfUse, 'a counter-generated GTIN, not the primary DI').not.toBe(i.primary);
      expect(packageDi, 'packaging code + Primary DI digits 2-13 + recomputed GS1 check digit').toBe(derived('1', i.primary));
    }
    const units = items.map((i) => (text.match(new RegExp(`${i.n}\\s+0\\s+Playwright MDM record\\s+(\\d{14})`)) ?? [])[1]);
    expect(new Set(units).size, 'each record gets its own counter value').toBe(2);
  });

  await test.step('the Primary DI Number itself is untouched', async () => {
    frame = await mdm.reopenMasterData(page);
    const rows = await mdm.retrieve(page, frame, { value: items[0].n, expectRows: 1 });
    await rows.first().locator('a:has-text("Actions")').click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await frame.locator('ul:visible a').filter({ hasText: 'View/Edit' }).first().click({ force: true, timeout: 5000 });
    await page.waitForTimeout(3500);
    const ef = await (await import('../support/robar')).findFrame(page, 'MasterData/Edit');
    // Read both inputs with ONE DOM evaluate: repeated `getByRole('row', ...)` lookups on this heavy page (125 fields) crashed the
    // renderer ("Page crashed") every run.
    const values = await ef.evaluate(() => {
      const read = (caption: string) => {
        const tr = Array.from(document.querySelectorAll('tr')).find((r) => Array.from(r.querySelectorAll('span')).some((s) => (s.textContent ?? '').trim() === caption));
        return (tr?.querySelector('input') as HTMLInputElement | null)?.value ?? null;
      };
      return { primary: read('Primary DI Number') };
    });
    // (Package DI Number lives on another tab whose rows are not in the DOM until opened; the Job Detail grid above is the
    // evidence for the derived value.)
    expect(values.primary).toBe(items[0].primary);
  });
});
