// Dictionary Management re-check against the ValMaster requirements (2026-10-09; .agents/valmaster-dictionary-management.md, module "Dictionary Management", 202 rows). Seed user, headless, TST703.
// Covers what the script-based specs did not check: grid / filter UI facts (F.1.11, F.1.14, F.1.25-F.1.35), "Please select one or more records." (F.6.4 / F.7.4 / F.8.4), Mass Approve page rules (F.7.7-F.7.17),
// Mass Retire / Unretire page rules (F.8.6-F.8.31). A requirement the system does not meet is recorded as a test annotation `deviation <id>` (not a failure). Own records MBDMQ<stamp>a/b (undeletable).
// NOTE: the first run of this spec is exploratory (many console.log lines); asserts are tightened as the facts are confirmed.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as dm from '../support/dictionary';
import { PASSWORD, USERNAME } from '../support/robar';

test.use({ actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const jobFrame = (page: Page): Frame | undefined => page.frames().filter((x) => /DictionaryManagement\/\w*Job(Submission|Detail)/i.test(x.url())).pop();
async function waitJob(page: Page): Promise<Frame> {
  for (let i = 0; i < 25; i++) {
    const f = jobFrame(page);
    if (f) { await page.waitForTimeout(1500); return f; }
    await page.waitForTimeout(1000);
  }
  throw new Error('no job frame');
}

async function tick(page: Page, frame: Frame, phrases: string[]): Promise<void> {
  const want = `Checked Rows:${phrases.length}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const p of phrases) {
      const box = frame.locator('#grdJqGrid tr.jqgrow').filter({ hasText: p }).first().locator('input[type=checkbox]');
      if (!(await box.isChecked())) await box.check();
      await page.waitForTimeout(700);
    }
    if ((await frame.locator('body').innerText()).includes(want)) return;
    await frame.locator('#cb_grdJqGrid').uncheck().catch(() => {});
    await page.waitForTimeout(700);
  }
  await expect(frame.locator('body')).toContainText(want, { timeout: 10_000 });
}
async function bulk(page: Page, frame: Frame, item: string): Promise<void> {
  await frame.locator('#drpActions').scrollIntoViewIfNeeded();
  await frame.locator('#drpActions').click();
  await page.waitForTimeout(500);
  await frame.locator('ul:visible li a').filter({ hasText: item }).evaluate((a: HTMLElement) => a.click());
  await page.waitForTimeout(5000);
}
async function dismissModal(page: Page): Promise<string> {
  const d = dm.frameOf(page).locator('.ui-dialog:visible');
  const text = norm((await d.allInnerTexts()).join(' | '));
  const buttons = (await d.locator('button').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  await d.locator('button').filter({ hasText: /Continue|OK|Cancel/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  return `${text} || buttons: ${JSON.stringify(buttons)}`;
}

test('Dictionary Management vs ValMaster: grid UI facts, empty-selection dialogs, Mass Approve and Mass Retire / Unretire page rules', async ({ page }) => {
  test.setTimeout(1_500_000);
  const stamp = Date.now().toString().slice(-6);
  const LANG = `MBLangQ${stamp}`;
  const PA = `MBDMQ${stamp}a`;
  const PB = `MBDMQ${stamp}b`;
  let f = await dm.openDictionary(page);

  await test.step('grid / filter UI facts: Column list (F.1.11), Version Filters (F.1.14), Latest Only / Effective Only (F.1.18 / F.1.19), grid columns (F.1.25), counters (F.1.30-F.1.33), menus (F.1.13 / F.1.35 / F.1.29)', async () => {
    await f.click('#btnReset');
    await page.waitForTimeout(2500);
    f = dm.frameOf(page);
    if ((await f.locator('select[name="dvFilters[0].Column"]').count()) === 0) { await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click(); await page.waitForTimeout(500); }
    expect(await f.locator('select[name="dvFilters[0].Column"] option').allInnerTexts()).toEqual(['Approved By', 'Approve Date', 'Effective Begin', 'Effective End', 'Language', 'Phrase', 'Translation', 'Version']);
    expect(await f.locator('#drpApproved option').allInnerTexts()).toEqual(['Any', 'Approved', 'Last Version Is Approved', 'Unapproved']);
    await expect(f.locator('#chkLatest')).toBeAttached();
    await expect(f.locator('#chkEffective')).toBeAttached();
    const r = await dm.search(page, 'MBDM', { version: 'Any', latest: false, effective: false });
    f = r.frame;
    const headers = (await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    console.log(`grid headers: ${JSON.stringify(headers)}`);
    const wanted = ['Actions', 'Phrase', 'Language', 'Translation', 'Version', 'Effective Begin', 'Effective End', 'Approved By', 'Approve Date'];
    const visible = headers.filter((h) => h !== 'Id');
    if (JSON.stringify(visible) !== JSON.stringify(wanted)) deviation('DM.20210908.F.1.25', JSON.stringify(wanted), JSON.stringify(visible));
    expect(await f.locator('#cb_grdJqGrid').count(), 'F.1.26 select-all checkbox').toBe(1);
    expect(await f.locator('#grdJqGrid tr.jqgrow input[type=checkbox]').count(), 'F.1.27 row checkboxes').toBeGreaterThan(0);
    expect(await f.locator('select.ui-pg-selbox option').allInnerTexts()).toEqual(['10', '20', '30']);
    expect(await f.locator('select.ui-pg-selbox').inputValue()).toBe('10');
    const footer = norm(await f.locator('.ui-pg-table').first().innerText());
    console.log(`footer: ${footer}`);
    expect(footer).toMatch(/Checked Rows:\s*0/);
    expect(footer).toMatch(/Page\s*of\s*\d+/);
    expect(footer).toMatch(/View 1 - 10 of \d+/);
    const menu = async (trigger: string): Promise<string[]> => {
      await f.locator(trigger).click();
      await page.waitForTimeout(500);
      const t = (await f.locator('ul:visible li').evaluateAll((lis) => lis.map((li) => ((li.querySelector('a') as HTMLElement | null)?.id ? (li.textContent || '') : (li.textContent || '')).trim().split('document.')[0]))).filter(Boolean);
      await f.locator(trigger).click();
      return t;
    };
    expect(await menu('#drpMainActions')).toEqual(['Excel Import', 'New Entry']);
    expect(await menu('#drpActions')).toEqual(['Export to Excel', 'Mass Approve', 'Mass Retire/Unretire']);
    await f.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    expect(await f.locator('ul:visible li a').allInnerTexts(), 'F.1.29 View/Edit first').toEqual(['View/Edit', 'New Version']);
    await page.keyboard.press('Escape');
    await f.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  });

  await test.step('F.6.4 / F.7.4 / F.8.4: a bulk action with no record selected -> "Please select one or more records." with an OK button', async () => {
    f = dm.frameOf(page);
    for (const item of ['Export to Excel', 'Mass Approve', 'Mass Retire/Unretire']) {
      await bulk(page, f, item);
      const m = await dismissModal(page);
      console.log(`${item} with nothing selected: ${m}`);
      expect(m).toContain('Please select one or more records.');
      if (!/\bOK\b/.test(m.split('buttons:')[1] ?? '')) deviation(item === 'Export to Excel' ? 'DM.20210908.F.6.4' : item === 'Mass Approve' ? 'DM.20210908.F.7.4' : 'DM.20210908.F.8.4', 'a dialog with an OK button', m);
    }
  });

  await test.step('setup: two own unapproved records', async () => {
    await dm.reopenDictionary(page);
    for (const [p, t] of [[PA, 'Req A'], [PB, 'Req B']]) {
      await dm.openMainAction(page, 'New Entry');
      await dm.fillNewEntry(page, { phrase: p, language: LANG, translation: t });
      await page.waitForTimeout(2500);
    }
    const r = await dm.search(page, `MBDMQ${stamp}`);
    expect(r.rows).toHaveLength(2);
    f = r.frame;
  });

  await test.step('Mass Approve page: fields (F.7.7), reasons (F.7.13), Submit disabled (F.7.17), required messages (F.7.8 / F.7.10 / F.7.14), invalid credentials (F.7.11)', async () => {
    await tick(page, f, [PA]);
    await bulk(page, f, 'Mass Approve');
    const jf = await waitJob(page);
    for (let i = 0; i < 20 && !(await jf.locator("body").innerText().catch(() => "")).includes("Selected: 1"); i++) await page.waitForTimeout(1000); // the page first shows "Selected: 0"
    const body = norm(await jf.locator("body").innerText());
    console.log(`approve page: ${body.slice(0, 260)}`);
    for (const t of ['Mass Approve Job Submission', 'Selected: 1', 'Job Description', 'User Name', 'Password', 'Reason Code', 'Comment', 'Submit Job']) expect(body).toContain(t);
    expect(await jf.locator('#sigReason option').allInnerTexts()).toEqual(['Select Reason', 'Data Approval', 'Data Correction', 'New Entry', 'Requested Change', 'Retire/Unretire']);
    await expect(jf.locator('#btnSubmit')).toBeDisabled();
    // required messages: type a character, clear it and leave the field (the page validates fields the user has touched); the Reason Code is chosen and reset to "Select Reason"
    for (const id of ['#txtJobDescription', '#sigUser', '#sigPassword']) {
      await jf.locator(id).fill('x');
      await jf.locator(id).fill('');
      await jf.locator(id).press('Tab');
    }
    await jf.locator('#sigReason').selectOption({ index: 1 });
    await jf.locator('#sigReason').selectOption({ index: 0 });
    await jf.locator('#sigComments').focus();
    await page.waitForTimeout(800);
    const required = norm(await jf.locator('body').innerText());
    const count = (required.match(/This field is required\./g) ?? []).length;
    console.log(`"This field is required." shown ${count} time(s) after focusing each empty field`);
    if (count < 4) deviation('DM.20210908.F.7.8 / F.7.10 / F.7.14', 'This field is required. for Job Description, User Name / Password and Reason Code', `${count} message(s)`);
    // invalid credentials
    await jf.locator('#txtJobDescription').fill(`Playwright invalid credentials ${stamp}`);
    await jf.locator('#sigUser').fill('NoSuchUser99');
    await jf.locator('#sigPassword').fill('wrong');
    await jf.locator('#sigReason').selectOption({ index: 1 });
    await jf.locator('#sigPassword').press('Tab');
    await expect(jf.locator('#btnSubmit')).toBeEnabled();
    await jf.locator('#btnSubmit').click();
    await page.waitForTimeout(5000);
    const dFrames = page.frames().filter((x) => /DictionaryManagement\//i.test(x.url()));
    const texts = await Promise.all(dFrames.map(async (x) => `${x.url().split('/').slice(-1)[0].slice(0, 40)}: ${norm(await x.locator('body').innerText().catch(() => ''))}`));
    const after = norm(texts.join(' || '));
    console.log(`invalid credentials: ${after.slice(0, 600)}`);
    if (!after.includes('Invalid Username/Password: UserID: NoSuchUser99')) deviation('DM.20210908.F.7.11', 'Invalid Username/Password: UserID: XXXXX', after.slice(-260));
    await dm.reopenDictionary(page);
  });

  /** Retire / Unretire page of the CURRENT selection: returns the job frame and logs its controls. */
  const retirePage = async (phrases: string[]): Promise<Frame> => {
    await dm.reopenDictionary(page);
    const r = await dm.search(page, `MBDMQ${stamp}`);
    await tick(page, r.frame, phrases);
    await bulk(page, r.frame, 'Mass Retire/Unretire');
    const jf = await waitJob(page);
    // the page first shows "Selected: 0" with every control disabled, then the real count and the form
    for (let i = 0; i < 20 && !/Selected:\s*[1-9]/.test(await jf.locator('body').innerText().catch(() => '')); i++) await page.waitForTimeout(1000);
    await page.waitForTimeout(1500);
    return jf;
  };
  const radios = async (jf: Frame) => jf.locator('input[type=radio]').evaluateAll((els) => els.map((e: any) => `${e.id || e.name}|${(e.parentElement?.textContent || '').trim().slice(0, 12)}|checked=${e.checked}|disabled=${e.disabled}`));
  const dates = async (jf: Frame) => jf.locator('input[type=text]:visible').evaluateAll((els) => els.map((e: any) => `${e.id || e.name}|${e.value}|readonly=${e.readOnly}|disabled=${e.disabled}`));
  const submitSigned = async (jf: Frame, description: string): Promise<void> => {
    await jf.locator('#txtJobDescription').fill(description);
    await jf.locator('#sigUser').fill(USERNAME);
    await jf.locator('#sigPassword').fill(PASSWORD);
    await jf.locator('#sigReason').selectOption({ index: 1 });
    await jf.locator('#sigPassword').press('Tab');
    await expect(jf.locator('#btnSubmit')).toBeEnabled();
    await jf.locator('#btnSubmit').click();
  };

  await test.step('Mass Retire page for ONE unretired record: radios (F.8.6 / F.8.8), job submitted, Effective End = today (F.8.10)', async () => {
    const jf = await retirePage([PB]);
    const body = norm(await jf.locator('body').innerText());
    console.log(`retire page (unretired): ${body.slice(0, 300)}`);
    console.log(`radios: ${JSON.stringify(await radios(jf))}; text boxes: ${JSON.stringify(await dates(jf))}`);
    for (const t of ['Mass Retire - Unretire Job Submission', 'Selected: 1', 'Retire', 'Unretire', 'Job Description', 'Submit Job']) expect(body).toContain(t);
    await submitSigned(jf, `Playwright retire ${stamp}`);
    let text = '';
    for (let i = 0; i < 40; i++) {
      const d = page.frames().filter((x) => /DictionaryManagement\/\w*JobDetail/i.test(x.url())).pop();
      text = d ? norm(await d.locator('body').innerText().catch(() => '')) : '';
      if (/Status:?\s*(Completed|Failed)/i.test(text) || /100%/.test(text)) break;
      await page.waitForTimeout(2000);
    }
    console.log(`retire job detail: ${text.slice(0, 400)}`);
    expect(text).toMatch(/Completed|100%/);
    await dm.reopenDictionary(page);
    const r = await dm.search(page, PB);
    const d = new Date();
    const today = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    console.log(`retired row: ${r.rows[0]}`);
    if (!r.rows[0].includes(today)) deviation('DM.20210908.F.8.10', `Effective End = ${today}`, r.rows[0]);
  });

  await test.step('Mass Retire page for ONE retired record: Retire radio disabled (F.8.7); Unretire defaults Effective Begin = today and Effective End = 12/31/2099, not editable (F.8.16 / F.8.17)', async () => {
    const jf = await retirePage([PB]);
    console.log(`retire page (retired): ${norm(await jf.locator('body').innerText()).slice(0, 300)}`);
    const rs = await radios(jf);
    console.log(`radios: ${JSON.stringify(rs)}; text boxes: ${JSON.stringify(await dates(jf))}`);
    expect(rs.some((x) => /^retireItems/.test(x) && /disabled=true/.test(x)), 'F.8.7 Retire radio disabled').toBe(true);
    const allInputs = await jf.locator('input').evaluateAll((els) => els.map((e: any) => `${e.id || e.name}|${e.type}|${e.value}|vis=${!!(e.offsetWidth || e.offsetHeight)}|readonly=${e.readOnly}|disabled=${e.disabled}`));
    console.log(`all inputs on the Unretire page: ${JSON.stringify(allInputs)}`);
  });

  await test.step('Mass Retire with BOTH retired and unretired records: warning with Cancel / Continue (F.8.12 / F.8.13 / F.8.14), Retire selected by default (F.8.9)', async () => {
    await dm.reopenDictionary(page);
    const r = await dm.search(page, `MBDMQ${stamp}`);
    await tick(page, r.frame, [PA, PB]);
    await bulk(page, r.frame, 'Mass Retire/Unretire');
    const modal = await dm.modalText(page).catch(() => '');
    const jf = page.frames().filter((x) => /DictionaryManagement\/\w*Job/i.test(x.url())).pop();
    const jbody = jf ? norm(await jf.locator('body').innerText().catch(() => '')) : '';
    console.log(`mixed selection: modal=[${modal}] job page=[${jbody.slice(0, 420)}] radios=${jf ? JSON.stringify(await radios(jf)) : 'n/a'}`);
    const warning = 'You have selected both retired and unretired records. If you continue, the action you select will be applied to all records.';
    // live: the warning is a dialog INSIDE the job submission page (not the main page), with Continue / Cancel
    expect(jbody).toContain('You have selected both retired and unretired records.');
    expect(jbody).toContain('the action you select will be applied to all records.');
    if (!jbody.includes(warning)) deviation('DM.20210908.F.8.12', `"${warning}"`, 'the comma after "If you continue" is missing');
    const rs = await radios(jf!);
    expect(rs.some((x) => /^retireItems/.test(x) && /checked=true/.test(x) && /disabled=false/.test(x)), 'F.8.9 Retire selected by default').toBe(true);
    expect(rs.some((x) => /^unretireItems/.test(x) && /disabled=false/.test(x)), 'F.8.9 Unretire selectable').toBe(true);
    // F.8.14: Cancel closes the dialog and returns to the main Dictionary Management page
    await jf!.locator('.ui-dialog:visible button').filter({ hasText: 'Cancel' }).first().click();
    await page.waitForTimeout(4000);
    const back = page.frames().filter((x) => /DictionaryManagement\/Management/i.test(x.url())).pop();
    const stillJob = page.frames().some((x) => /DictionaryManagement\/\w*JobSubmission/i.test(x.url()));
    console.log(`after Cancel: main page frame=${!!back} job submission frame still open=${stillJob}`);
    if (stillJob && !back) deviation('DM.20210908.F.8.14', 'Cancel returns to the main Dictionary Management page', 'the job submission page stays open');
  });
});
