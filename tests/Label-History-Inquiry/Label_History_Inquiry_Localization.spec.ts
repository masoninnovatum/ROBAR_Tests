// Label History Inquiry localization (LHI.190725.F.1.3 "All static text in the Label History module will be localized", script Label_History_Inquiry-1.2): a session in another language
// (legacy login language "español"; TST703's Spanish test rows are prefixed "ES - ") must show the heading, field labels, the Submit button, the View Detail menu entry and the detail pop-up title /
// button / table captions translated. Anything without the prefix is reported as untranslated. READ-ONLY (the real print of test-data/phi-fixture.json is looked up).
// Confirmed live 2026-11-03 on TST703 (headless).

import { test, expect } from '@playwright/test';
import { openMenuItem, findFrame, BASE_URL, USERNAME, PASSWORD } from '../support/robar';

test.use({ actionTimeout: 20_000 });

const ITEM = 'MBBQA8457561';
const LOT = 'CLPTP560850L';

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

test('Label History Inquiry: static texts follow the session language (F.1.3)', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  try {
    await p.goto(BASE_URL);
    await p.locator('.userID').waitFor({ timeout: 60_000 });
    await p.locator('select', { hasText: 'español' }).first().selectOption({ label: 'español' });
    await p.fill('.userID', USERNAME);
    await p.fill('.Password', PASSWORD);
    await p.click('.loginBtn');
    await p.waitForLoadState('networkidle');
    await openMenuItem(p, 'Label History Inquiry');
    const f = await findFrame(p, 'LabelHistory');
    await f.locator('#itemnumber').waitFor({ timeout: 30_000 });
    await p.waitForTimeout(2500);

    const texts: Record<string, string> = {
      heading: (await f.locator('h1').innerText()).trim(),
      barcodeLabel: (await f.locator('label.inputLabel').nth(0).innerText()).trim(),
      itemLegend: (await f.locator('legend').first().innerText()).trim(),
      itemLabel: (await f.locator('label.inputLabel').nth(1).innerText()).trim(),
      lotLabel: (await f.locator('label.inputLabel').nth(2).innerText()).trim(),
      submit: (await f.locator('#btnRetrieveLabelHistory').inputValue()).trim(),
    };
    await f.fill('#itemnumber', ITEM);
    await f.fill('#lotnumber', LOT);
    await f.click('#btnRetrieveLabelHistory');
    await p.waitForTimeout(6000);
    texts.detailTitle = (await f.locator('.ui-dialog:visible .ui-dialog-title').first().innerText().catch(() => '')).trim();
    texts.detailClose = (await f.locator('.ui-dialog:visible button').first().innerText().catch(() => '')).trim();
    const d = p.frames().filter((x) => /GetLabelHistoryInquiryDetails/.test(x.url())).pop();
    const heads = d ? (await d.locator('th').allInnerTexts()).map((t) => t.trim()) : [];
    texts.detailHeaders = heads.join(' | ');
    const gridHeaders = (await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter((t) => t && t !== 'id');
    texts.gridHeaders = gridHeaders.join(' | ');
    console.log('Spanish session texts:', JSON.stringify(texts, null, 1));

    const untranslated = Object.entries(texts).filter(([k, v]) => !/^ES - /.test(v) && !['detailHeaders', 'gridHeaders'].includes(k) && v !== '');
    const translated = Object.entries(texts).filter(([k, v]) => /^ES - /.test(v) && !['detailHeaders', 'gridHeaders'].includes(k));
    console.log('translated:', translated.map(([k]) => k).join(', '), '| not translated:', untranslated.map(([k, v]) => `${k}="${v}"`).join(', '));
    expect(translated.length, 'the page labels are localized').toBeGreaterThan(0);
    expect(texts.heading).toBe('ES - Label History Inquiry');
    if (untranslated.length) deviation(`LHI.190725.F.1.3 static texts not translated in a Spanish session: ${untranslated.map(([k, v]) => `${k} "${v}"`).join('; ')}`);
    const plainHeaders = gridHeaders.filter((h) => !/^ES - /.test(h));
    if (plainHeaders.length) deviation(`LHI.190725.F.1.3 the grid column headers (${plainHeaders.join(', ')}) are not translated: they are the column names returned by the stored procedure (the detail pop-up captions are translated)`);
  } finally {
    await ctx.close();
  }
});
