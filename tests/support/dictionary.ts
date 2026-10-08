// Dictionary Management helpers (live 2026-10-07, TST703). The page is InnoPages/DictionaryManagement/Management (CriteriaFilter widget `dvFilters[n]`, jqGrid #grdJqGrid);
// New Entry / View-Edit / New Version open the nested iframe InnoPages/DictionaryManagement/ViewEdit?pageAction=new|edit|newVersion inside a jQuery dialog.
// Reset clears EVERYTHING (filters, the Version dropdown, Latest / Effective checkboxes), so every search below sets all of them explicitly.

import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from './robar';

export async function openDictionary(page: Page): Promise<Frame> {
  await login(page);
  return reopenDictionary(page);
}

export async function reopenDictionary(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Dictionary Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Dictionary Management');
  const f = await findFrame(page, 'DictionaryManagement/Management');
  await page.waitForTimeout(3000);
  return f;
}

export const frameOf = (page: Page): Frame => page.frames().filter((x) => /DictionaryManagement\/Management/i.test(x.url())).pop()!;
export const editFrame = (page: Page): Frame | undefined => page.frames().filter((x) => /DictionaryManagement\/ViewEdit/i.test(x.url())).pop();

export type VersionFilter = 'Any' | 'Approved' | 'Last Version Is Approved' | 'Unapproved';

/** Reset, then retrieve with ONE criteria row (default Phrase Contains) and explicit Version / Latest / Effective settings. Returns the grid rows (text) of the current page. */
export async function search(page: Page, value: string, opts: { column?: string; operator?: string; version?: VersionFilter; latest?: boolean; effective?: boolean; limit?: number } = {}): Promise<{ frame: Frame; rows: string[]; info: string }> {
  let f = frameOf(page);
  await f.click('#btnReset');
  await page.waitForTimeout(2500);
  f = frameOf(page);
  // Reset may leave (or restore) the persisted criteria row: add a row only when none exists, and drop extra rows
  if ((await f.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await page.waitForTimeout(400);
  }
  while ((await f.locator('select[name="dvFilters[1].Column"]').count()) > 0) {
    await f.locator('.criteriaFilter-Filter .criteriaFilter-RemoveButton, a:has-text("Remove"), span:has-text("Remove")').last().click({ timeout: 5000 });
    await page.waitForTimeout(400);
  }
  await f.locator('select[name="dvFilters[0].Column"]').selectOption(opts.column ?? 'Phrase');
  await f.locator('select[name="dvFilters[0].Operator"]').selectOption(opts.operator ?? 'Contains');
  if (!/^Is (Not )?Blank$/.test(opts.operator ?? '')) await f.locator('input[name="dvFilters[0].Value"]').fill(value); // the Value box is hidden for Is Blank / Is Not Blank
  await f.locator('#drpApproved').selectOption({ label: opts.version ?? 'Any' });
  await f.locator('#chkLatest').setChecked(opts.latest ?? false);
  await f.locator('#chkEffective').setChecked(opts.effective ?? false);
  await f.locator('#txtResultLimit').fill(String(opts.limit ?? 500));
  await Promise.all([page.waitForResponse((r) => r.url().includes('GridSessionStart'), { timeout: 20_000 }), f.click('#btnRetrieveData')]);
  await page.waitForTimeout(2500);
  const rows = (await f.locator('#grdJqGrid tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  const info = (await f.locator('.ui-paging-info').allInnerTexts()).join(' ');
  return { frame: f, rows, info };
}

export async function openMainAction(page: Page, item: 'New Entry' | 'Excel Import'): Promise<void> {
  const f = frameOf(page);
  await f.locator('#drpMainActions').click();
  await page.waitForTimeout(400);
  await f.locator('ul:visible li a').filter({ hasText: item }).click({ force: true });
  await page.waitForTimeout(3000);
}

export interface EntryInput { phrase?: string; language?: string; translation?: string; begin?: string; end?: string; html?: boolean }

/** Fills the New Entry dialog (nested ViewEdit frame) and optionally submits. Returns the inline messages seen right after Submit. */
export async function fillNewEntry(page: Page, e: EntryInput, submit = true): Promise<string> {
  const nf = editFrame(page)!;
  const texts = nf.locator('input[type=text]:not([id^=dp])');
  if (e.phrase !== undefined) await texts.nth(0).fill(e.phrase);
  if (e.language !== undefined) await texts.nth(1).fill(e.language);
  if (e.translation !== undefined) await nf.locator('#nonHtmlTrans').fill(e.translation);
  const dates = nf.locator('input[id^=dp]');
  // the date boxes are datepicker-driven (readonly): set them through the jQuery UI datepicker API, which fires the change the page listens to
  const setDate = (i: number, v: string) => dates.nth(i).evaluate((el, val) => {
    const $ = (window as unknown as { jQuery: (x: Element) => { datepicker: (a: string, b: Date) => void; trigger: (n: string) => void } }).jQuery;
    $(el).datepicker('setDate', new Date(val));
    $(el).trigger('change');
  }, v);
  if (e.begin) await setDate(0, e.begin);
  if (e.end) await setDate(1, e.end);
  if (e.html) await nf.locator('#cbEditAsHtml').check();
  if (!submit) return '';
  await nf.locator('#btnSubmit').click();
  await page.waitForTimeout(2500);
  return ((await editFrame(page)?.locator('body').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

/** The visible modal(s) on the Management frame (confirmation / error dialogs), as text. */
export async function modalText(page: Page): Promise<string> {
  return (await frameOf(page).locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ').trim();
}
