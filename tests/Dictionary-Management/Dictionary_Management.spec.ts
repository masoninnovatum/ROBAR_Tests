// Dictionary Management core (live 2026-10-07, headless, TST703, seed user). Page: InnoPages/DictionaryManagement/Management (CriteriaFilter `dvFilters[n]`, jqGrid #grdJqGrid, Actions = Excel Import / New Entry,
// row Actions = View/Edit / New Version, Bulk Actions = Export to Excel / Mass Approve / Mass Retire/Unretire). Dictionary records cannot be deleted: this spec creates ONE phrase family MBDM<stamp>
// (PHR1 approved + new version, PHR2 custom dates + HTML, PHR3 future begin date) and retires nothing here (see Dictionary_Management_Bulk.spec.ts). Formal scripts: DM_NewEntry-1.4, DM_ViewEdit-1.8.

import { test, expect } from '@playwright/test';
import * as dm from '../support/dictionary';

test.use({ actionTimeout: 20_000 });

test('Dictionary Management: anatomy, search, New Entry, View/Edit, HTML editor and New Version rules', async ({ page }) => {
  test.setTimeout(900_000);
  const stamp = Date.now().toString().slice(-6);
  const LANG1 = `MBLang${stamp}`;
  const PHR1 = `MBDM${stamp}A`;
  const PHR2 = `MBDM${stamp}B`;
  const PHR3 = `MBDM${stamp}C`;
  const longText = 'Playwright translation text that is deliberately longer than one hundred characters so the grid tooltip has something to show: '.padEnd(140, 'x');
  const f0 = await dm.openDictionary(page);

  await test.step('page anatomy after Reset: criteria, version filters, Latest / Effective checkboxes, Limit Results, Actions menus, grid columns', async () => {
    await f0.click('#btnReset');
    await page.waitForTimeout(2500);
    const f = dm.frameOf(page);
    await expect(f.locator('#btnRetrieveData')).toBeVisible();
    expect(await f.locator('select[name^="dvFilters"]').count(), 'Reset removes every criteria row').toBe(0);
    expect(await f.locator('#chkLatest').isChecked()).toBe(false);
    expect(await f.locator('#chkEffective').isChecked()).toBe(false);
    expect(await f.locator('#txtResultLimit').inputValue()).toBe('500');
    expect((await f.locator('#drpApproved option').allInnerTexts()).map((t) => t.trim())).toEqual(['Any', 'Approved', 'Last Version Is Approved', 'Unapproved']);
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(400);
    expect((await f.locator('select[name="dvFilters[0].Column"] option').allInnerTexts()).map((t) => t.trim())).toEqual(['Approved By', 'Approve Date', 'Effective Begin', 'Effective End', 'Language', 'Phrase', 'Translation', 'Version']);
    expect((await f.locator('select[name="dvFilters[0].Operator"] option').allInnerTexts()).map((t) => t.trim())).toEqual(['Contains', 'Does Not Match', 'Does Not Contain', 'In', 'Not In', 'Greater Than', 'Less Than', 'Exactly Matches', 'Is Blank', 'Is Not Blank']);
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(400);
    expect((await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim())).toEqual(['Excel Import', 'New Entry']);
    await f.locator('#drpMainActions').click();
    const r = await dm.search(page, 'Manufacturing Date');
    expect(r.rows.length, 'the seeded prompt phrases').toBeGreaterThanOrEqual(3);
    expect((await r.frame.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean)).toEqual(['Id', 'Category', 'Actions', 'Phrase', 'Language', 'Translation', 'Version', 'Effective Begin', 'Effective End', 'Approved By', 'Approve Date']);
  });

  await test.step('search operators on the seeded read-only prompt phrases', async () => {
    let r = await dm.search(page, 'Manufacturing Date YYYY-MM', { operator: 'Exactly Matches' });
    expect(r.rows, 'Exactly Matches').toHaveLength(1);
    expect(r.rows[0]).toContain('Prompt');
    r = await dm.search(page, 'Prompt', { column: 'Language', operator: 'Exactly Matches' });
    console.log(`Language = Prompt: ${r.info}`);
    expect(r.rows.length).toBeGreaterThan(0);
    r = await dm.search(page, 'Manufacturing Date YYYY', { operator: 'Does Not Contain' });
    expect(r.rows.every((x) => !x.includes('Manufacturing Date YYYY'))).toBe(true);
    r = await dm.search(page, '', { column: 'Approved By', operator: 'Is Blank' });
    console.log(`Approved By is blank: ${r.info}`);
    r = await dm.search(page, 'Manufacturing Date', { limit: 2 });
    expect(r.info, 'Limit Results caps the result set').toContain('of 2');
  });

  await test.step('New Entry dialog: defaults, required fields, create PHR1, duplicate refused', async () => {
    await dm.openMainAction(page, 'New Entry');
    const nf = dm.editFrame(page)!;
    expect(nf.url()).toContain('pageAction=new');
    const dates = nf.locator('input[id^=dp]');
    const today = new Date();
    expect(await dates.nth(0).inputValue(), 'Effective Begin defaults to today').toBe(`${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`);
    expect(await dates.nth(1).inputValue(), 'Effective End defaults to 12/31/2099').toBe('12/31/2099');
    expect(await nf.locator('#cbEditAsHtml').isChecked()).toBe(false);
    let text = await dm.fillNewEntry(page, { phrase: '', language: LANG1 });
    expect(text).toMatch(/Phrase:\s*This field is required\./);
    text = await dm.fillNewEntry(page, { phrase: PHR1, language: '' });
    expect(text).toMatch(/Language:\s*This field is required\./);
    expect(text, 'the Phrase value is accepted').not.toMatch(/Phrase:\s*This field is required\./);
    await dm.fillNewEntry(page, { phrase: PHR1, language: LANG1, translation: 'Translation 1' });
    await page.waitForTimeout(2500);
    expect(dm.editFrame(page), 'dialog closes after a successful Submit').toBeUndefined();
    const r = await dm.search(page, PHR1);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toContain(LANG1);
    expect(r.rows[0]).toContain('Translation 1');
    await dm.openMainAction(page, 'New Entry');
    await dm.fillNewEntry(page, { phrase: PHR1, language: LANG1, translation: 'Translation 1' });
    const dup = (await dm.editFrame(page)!.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(dup).toContain('Record already exists.');
    await dm.editFrame(page)!.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(800);
    await dm.frameOf(page).locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click();
    await page.waitForTimeout(1000);
    expect(dm.editFrame(page), 'the X closes the New Entry dialog').toBeUndefined();
    const again = await dm.search(page, PHR1);
    expect(again.rows, 'still exactly one PHR1 record').toHaveLength(1);
  });

  await test.step('New Entry with custom and future dates (PHR2, PHR3)', async () => {
    await dm.openMainAction(page, 'New Entry');
    await dm.fillNewEntry(page, { phrase: PHR2, language: LANG1, translation: 'Translation 2', begin: '1/1/2026', end: '6/30/2027' });
    await page.waitForTimeout(2500);
    let r = await dm.search(page, PHR2);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toContain('1/1/2026');
    expect(r.rows[0]).toContain('6/30/2027');
    await dm.openMainAction(page, 'New Entry');
    await dm.fillNewEntry(page, { phrase: PHR3, language: LANG1, translation: 'Translation 3', begin: '1/1/2030' });
    await page.waitForTimeout(2500);
    r = await dm.search(page, PHR3);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toContain('1/1/2030');
    // Effective Only hides the future-dated record, Latest Only keeps it
    const eff = await dm.search(page, `MBDM${stamp}`, { effective: true });
    expect(eff.rows.some((x) => x.includes(PHR3)), 'Effective Only hides a future Effective Begin').toBe(false);
    expect(eff.rows.some((x) => x.includes(PHR1))).toBe(true);
    const lat = await dm.search(page, `MBDM${stamp}`, { latest: true });
    expect(lat.rows).toHaveLength(3);
  });

  await test.step('View/Edit: phrase and language read-only, translation / dates / HTML editable; long translation saved and shown as a tooltip', async () => {
    let r = await dm.search(page, PHR1);
    const grid = r.frame;
    await grid.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(400);
    await grid.locator('ul:visible li a').filter({ hasText: 'View/Edit' }).click({ force: true });
    await page.waitForTimeout(3000);
    const ef = dm.editFrame(page)!;
    expect(ef.url()).toMatch(/pageAction=/i);
    const texts = ef.locator('input[type=text]:not([id^=dp])');
    expect(await texts.nth(0).isDisabled(), 'Phrase disabled').toBe(true);
    expect(await texts.nth(1).isDisabled(), 'Language disabled').toBe(true);
    expect(await ef.locator('input[id^=dp]').nth(0).isEnabled() || (await ef.locator('input[id^=dp]').nth(0).getAttribute('readonly')) === null).toBe(true);
    expect(await ef.locator('#nonHtmlTrans').isEnabled()).toBe(true);
    expect(await ef.locator('#cbEditAsHtml').isEnabled()).toBe(true);
    await ef.locator('#nonHtmlTrans').fill(longText);
    await ef.locator('#btnSubmit').click();
    await page.waitForTimeout(2500);
    r = await dm.search(page, PHR1);
    expect(r.rows[0]).toContain('Playwright translation text');
    const title = await r.frame.locator('#grdJqGrid tr.jqgrow td[aria-describedby$="Translation"]').first().getAttribute('title');
    console.log(`translation cell title (${title?.length} chars)`);
    expect(title ?? '', 'the grid cell tooltip carries the full translation').toContain('deliberately longer than one hundred characters');
  });

  await test.step('Edit as HTML: CKEditor appears below a disabled Translation, is removed again, HTML source is saved and retained', async () => {
    let r = await dm.search(page, PHR2);
    await r.frame.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(400);
    await r.frame.locator('ul:visible li a').filter({ hasText: 'View/Edit' }).click({ force: true });
    await page.waitForTimeout(3000);
    let ef = dm.editFrame(page)!;
    await ef.locator('#cbEditAsHtml').check();
    await page.waitForTimeout(1500);
    expect(await ef.locator('#nonHtmlTrans').isDisabled(), 'plain Translation disabled while HTML editing').toBe(true);
    expect(await ef.locator('.cke').first().isVisible(), 'CKEditor shown').toBe(true);
    await ef.locator('#cbEditAsHtml').uncheck();
    await page.waitForTimeout(1000);
    expect(await ef.locator('#nonHtmlTrans').isEnabled(), 'plain Translation enabled again').toBe(true);
    await ef.locator('#cbEditAsHtml').check();
    await page.waitForTimeout(1000);
    await ef.evaluate(() => {
      const w = window as unknown as { CKEDITOR?: { instances: Record<string, { setData: (h: string) => void }> } };
      const inst = w.CKEDITOR && Object.values(w.CKEDITOR.instances)[0];
      if (!inst) throw new Error('no CKEditor instance');
      inst.setData('<p><span style="color:#ff0000;background-color:#ffff00;font-family:Arial">PW styled</span></p>');
    });
    await ef.locator('#btnSubmit').click();
    await page.waitForTimeout(2500);
    r = await dm.search(page, PHR2);
    expect(r.rows[0], 'the translation column now holds the HTML source').toContain('PW styled');
    await r.frame.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(400);
    await r.frame.locator('ul:visible li a').filter({ hasText: 'View/Edit' }).click({ force: true });
    await page.waitForTimeout(3000);
    ef = dm.editFrame(page)!;
    expect(await ef.locator('#cbEditAsHtml').isChecked(), 'Edit as HTML stays ticked for HTML content').toBe(true);
    const html = await ef.evaluate(() => {
      const w = window as unknown as { CKEDITOR?: { instances: Record<string, { getData: () => string }> } };
      const inst = w.CKEDITOR && Object.values(w.CKEDITOR.instances)[0];
      return inst ? inst.getData() : '';
    });
    expect(html).toContain('color:#ff0000');
    await dm.frameOf(page).locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click();
    await page.waitForTimeout(800);
  });

  await test.step('New Version: Yes/No confirmation and the "latest unapproved version already exists" block', async () => {
    const r = await dm.search(page, PHR1);
    const rowActions = async (item: string) => {
      await r.frame.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
      await page.waitForTimeout(400);
      await r.frame.locator('ul:visible li a').filter({ hasText: item }).click({ force: true });
      await page.waitForTimeout(1500);
    };
    await rowActions('New Version');
    const confirm = await dm.modalText(page);
    expect(confirm).toContain('Are you sure you want to create a new version?');
    await dm.frameOf(page).getByRole('button', { name: 'No' }).click();
    await page.waitForTimeout(800);
    expect((await dm.search(page, PHR1)).rows, 'No creates nothing').toHaveLength(1);
    await rowActions('New Version');
    await dm.frameOf(page).getByRole('button', { name: 'Yes' }).click();
    await page.waitForTimeout(2500);
    const err = await dm.modalText(page);
    expect(err).toMatch(/A latest unapproved version.{0,6}0.{0,6}already exists\. Cannot create a new version\./);
    await dm.frameOf(page).getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(800);
    expect((await dm.search(page, PHR1)).rows, 'no second version').toHaveLength(1);
  });

  console.log(`fixtures: ${PHR1}, ${PHR2}, ${PHR3} (${LANG1})`);
});
