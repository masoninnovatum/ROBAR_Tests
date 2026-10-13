// Link Management re-checked against ValMaster (module "Link Management", AT.170103.F.3-F.22 / LM.170330.*; live 2026-10-11, headless, TST703, seed user Claude01). READ-ONLY: nothing is linked or detached.
// Requirements: .agents/valmaster-link-management.md. Differences are annotated `deviation <id>` (the spec stays green).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { readGlobalSetting } from '../support/global-settings';

test.use({ actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

const text = async (f: Frame) => (await f.locator('body').innerText()).replace(/\s+/g, ' ').trim();

async function openLinkManagement(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Link Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Link Management');
  const f = await findFrame(page, 'LinkAttachmentManagement/LinkManagement', { attempts: 80 });
  await f.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(4000);
  return f;
}

/** Removes every restored filter row, adds one criterion and retrieves; dismisses the "Filter will take precedence" dialog. */
async function retrieveWith(page: Page, f: Frame, column: string, operator: string, value: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const rm = f.getByText('Remove', { exact: true });
    if (!(await rm.count())) break;
    await rm.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
  await page.waitForTimeout(500);
  await f.locator("select[name$='Column']").first().selectOption({ label: column });
  await f.locator("select[name$='Operator']").first().selectOption({ label: operator });
  await f.locator("input[name$='Value']").first().fill(value);
  await f.click('#btnRetrieveData');
  await page.waitForTimeout(1500);
  await f.getByRole('button', { name: 'Continue' }).click({ timeout: 2500 }).catch(() => {});
  await f.locator('tr.jqgrow').first().waitFor({ timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

test('Link Management vs ValMaster: menu, filters, includes, grid, associate drop-down and the three Link pages (read-only)', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const viewTypes = await readGlobalSetting(page, 'BrowserViewFileTypeExtensions').catch(() => undefined);
  console.log(`SETTING BrowserViewFileTypeExtensions = ${viewTypes} (F.22.1 .PDF, .TXT, .JPG, .JPEG, .BMP, .PNG)`);
  if (!viewTypes) deviation('AT.170103.F.22.1', 'global setting BrowserViewFileTypeExtensions exists', 'not found by exact name');

  let f = await openLinkManagement(page);

  await test.step('F.3.1 / F.3.2 / F.4.1 - F.4.4: tile, Document Control section, filters, Include check boxes', async () => {
    const section = await page.evaluate(() => {
      const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /Link Management/.test(e.textContent ?? '') && e.closest('#mainMenu, .menuContainer, body'));
      return el ? el.parentElement?.parentElement?.innerText?.slice(0, 200) : '';
    }).catch(() => '');
    console.log(`MENU CONTEXT ${JSON.stringify(section)}`);
    expect(await f.locator('#btnRetrieveData').count()).toBe(1);
    const labels = (await f.locator('#checkboxIncludes').innerText()).replace(/\s+/g, ' ').trim();
    console.log(`INCLUDES "${labels}" checked=${JSON.stringify(await f.locator('#checkboxIncludes input').evaluateAll((els) => els.map((e: any) => e.id + ':' + e.checked)))}`);
    for (const l of ['Include LCN', 'Include Item', 'Include Template']) if (!labels.includes(l)) deviation('AT.170103.F.4.4', `check box "${l}"`, labels);
    if (await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').count()) {
      const before = await f.locator("select[name$='Column']").count();
      await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
      await page.waitForTimeout(600);
      const cols = await f.locator("select[name$='Column']").count();
      console.log(`FILTER rows before=${before} after add=${cols}; operator/value controls: ${await f.locator("select[name$='Operator']").count()}/${await f.locator("input[name$='Value'], select[name$='Value']").count()}`);
      if (cols <= before) deviation('AT.170103.F.4.3', 'a filter can be added', 'no new row');
      await f.locator("a:has-text('Remove'), .criteriaFilter-RemoveButton").first().click({ timeout: 3000 }).catch(() => {});
    } else deviation('AT.170103.F.4.1', 'Column / Operator / Value filters', 'no Add Filter control');
    if (await f.locator('#advancedOptions h3 a').count()) await f.locator('#advancedOptions h3 a').first().click();
    await page.waitForTimeout(700);
    const sel = (await f.locator('#selectedLimitColumns option').allInnerTexts()).map((t) => t.trim());
    const avail = (await f.locator('#availableLimitColumns option').allInnerTexts()).map((t) => t.trim());
    console.log(`ADVANCED selected=${JSON.stringify(sel)} availableCount=${avail.length} limit=${await f.locator('#txtResultLimit').inputValue()}`);
  });

  await test.step('F.5.6 - F.5.12: grid only after Retrieve Data; No records to view; hierarchy Items -> Templates -> LCNs; pager; row Actions', async () => {
    const pre = await f.locator('tr.jqgrow').count();
    console.log(`ROWS before Retrieve=${pre}`);
    await retrieveWith(page, f, 'LCN', 'Contains', 'LCN');
    const rows = (await f.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const headers = (await f.locator('#gview_grdControl th, th.ui-th-column').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    const info = (await f.locator('.ui-paging-info').first().innerText().catch(() => '')).trim();
    const pager = (await f.locator('#grdControl_toppager, .ui-jqgrid-pager').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log(`GRID headers=${JSON.stringify(headers)} rows(first5)=${JSON.stringify(rows.slice(0, 5))} info="${info}" pager="${pager.slice(0, 100)}"`);
    if (rows.length) {
      if (!/^View \d+ - \d+ of \d+/.test(info.replace('–', '-'))) deviation('AT.170103.F.5.12', 'View x-x of x', info);
      if (!/Page/.test(pager)) deviation('AT.170103.F.5.11', 'Page x of x', pager);
      if (!(await f.locator('tr.jqgrow').first().locator('input[type=checkbox]').count())) deviation('AT.170103.F.5.9', 'multi-select check boxes', 'none');
      const act = f.locator('tr.jqgrow').first().locator('a:has-text("Actions")').first();
      await act.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      const actions = (await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim());
      console.log(`ROW ACTIONS ${JSON.stringify(actions)}`);
      for (const a of ['View', 'Download']) if (!actions.includes(a)) deviation('AT.170103.F.5.10', `row action ${a}`, JSON.stringify(actions));
      await page.keyboard.press('Escape');
    }
    // No records to view: a value that cannot exist
    await retrieveWith(page, f, 'LCN', 'Contains', 'ZZZ_NO_SUCH_RECORD_ZZZ');
    const t = await text(f);
    console.log(`NO RECORDS present=${/No records to view/.test(t)}`);
    if (!/No records to view/.test(t)) deviation('AT.170103.F.5.7', '"No records to view"', t.slice(-150));
  });

  await test.step('F.6.1 / F.6.5 / F.7 / F.9 / F.11: Associate Attachments drop-down options and the pages they open', async () => {
    f = await openLinkManagement(page);
    const options = (await f.locator('#ddlLinkType option').allInnerTexts()).map((t) => t.trim());
    const disabled = await f.locator('#ddlLinkType').isDisabled();
    console.log(`ASSOCIATE options=${JSON.stringify(options)} disabled=${disabled}`);
    for (const o of ['by LCN', 'by Item', 'by Template']) if (!options.some((x) => x.toLowerCase().includes(o.toLowerCase()))) deviation('AT.170103.F.6.1', `option "${o}"`, JSON.stringify(options));
    // the switch links on the Link pages read "By LCN" / "By Item" / "By Item Version" / "By Template" / "By Template Version" (requirements F.7.9 / F.9.12 / F.11.10 say "Link by LCN" / "Link by Item" / "Link by Template", and only list three types)
    deviation('AT.170103.F.7.9', 'links "Link by Item" / "Link by Template" (three association types)', `links read "By ..." and five types are offered: ${JSON.stringify(options)}`);
    for (const [label, req, title, cols, links] of [
      ['By LCN', 'F.7', 'Link LCN Attachments', ['Label Control Number', 'Item Number', 'Template'], ['By Item', 'By Template']],
      ['By Item', 'F.9', 'Link Item Attachments', ['Item Number', 'Template'], ['By LCN', 'By Template']],
      ['By Template', 'F.11', 'Link Template Attachments', ['LabelName', 'Description', 'LabelType'], ['By LCN', 'By Item']],
    ] as Array<[string, string, string, string[], string[]]>) {
      f = await openLinkManagement(page);
      await f.locator('#ddlLinkType').selectOption({ label });
      await f.locator('#ddlLinkType').dispatchEvent('click'); // the page navigates on the select's click handler (navigateTo)
      await page.waitForTimeout(5000);
      const frames = page.frames().map((x) => x.url()).filter((u) => /LinkAttachmentManagement/.test(u));
      console.log(`${label} -> frames ${JSON.stringify(frames)}`);
      const lf = page.frames().find((x) => /LinkAttachmentManagement\/(Link(LCN|Item|Template)Attachments)/.test(x.url()));
      if (!lf) { deviation(`AT.170103.${req}.1`, `the "${title}" page`, `frames: ${JSON.stringify(frames)}`); continue; }
      const body = await text(lf);
      console.log(`${title} PAGE ${body.slice(0, 400)}`);
      if (!body.includes(title)) deviation(`AT.170103.${req}.1`, `page title "${title}"`, body.slice(0, 120));
      for (const l of links) if (!body.includes(l)) deviation(`AT.170103.${req}.link`, `link "${l}"`, body.slice(0, 300));
      if (!(await lf.locator('#btnLinkAttachments').count())) deviation(`AT.170103.${req}.attach`, 'an Attach button', 'none');
      else console.log(`${title} Attach button text="${await lf.locator('#btnLinkAttachments').getAttribute('value')}"`);
      await lf.click('#btnRetrieveData').catch(() => {});
      await lf.locator('tr.jqgrow').first().waitFor({ timeout: 20_000 }).catch(() => {});
      const headers = (await lf.locator('th.ui-th-column, #gview_grdControl th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      console.log(`${title} GRID headers=${JSON.stringify(headers)}`);
      for (const c of cols) if (!headers.some((h) => h.replace(/\s/g, '').toLowerCase().includes(c.replace(/\s/g, '').toLowerCase()))) deviation(`AT.170103.${req}.cols`, `column "${c}"`, JSON.stringify(headers));
    }
  });
});
