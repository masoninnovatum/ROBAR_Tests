// DIT 6630 spike 5 (read-only): for one item, print the Label Control record (versions + master key) and the VLM JSON (Id + LCProductionRelease).
import { test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../../support/robar';

const ITEM = process.env.VLM_ITEM || 'BBTest49';

test('LC vs VLM for item', async ({ page }) => {
  test.setTimeout(400_000);
  await login(page);
  // --- Label Control, With Label Master
  await openMenuItem(page, 'Label Control');
  let f: Frame = await findFrame(page, 'LabelControl/Management');
  await f.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await f.click('#btnReset');
  await page.waitForTimeout(1500);
  f = await findFrame(page, 'LabelControl/Management');
  await f.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await f.locator('#drpApproved').selectOption({ label: 'All (LCN Status)' });
  await f.locator('#drpAttachments').selectOption({ label: 'Any (Attachments)' });
  await f.locator('#drpLabelMaster').selectOption({ label: 'Any (Label Masters)' });
  await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
  await page.waitForTimeout(500);
  await f.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
  await f.locator("select[name$='Operator']").first().selectOption('ExactlyMatches');
  await f.locator("input[name$='Value']").first().fill(ITEM);
  await f.click('#btnRetrieveData');
  await page.waitForTimeout(6000);
  const heads = await f.locator('table.ui-jqgrid-htable th').evaluateAll((ths) => ths.map((t) => (t.textContent || '').trim()));
  console.log('LCHEAD', JSON.stringify(heads));
  const rows = await f.locator('tr.jqgrow').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim())));
  for (const r of rows) console.log('LCROW', JSON.stringify([r[1], r[r.length - 2], r[r.length - 1]]));
  // --- VLM JSON
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  const bodies: string[] = [];
  page.on('response', async (r) => { if (r.url().includes('GetLabelMasterData')) bodies.push(await r.text().catch(() => '')); });
  await openMenuItem(page, 'View Label Master');
  const v: Frame = await findFrame(page, 'itemlabelmasterview');
  await v.waitForSelector('#btnRetrieveItems');
  await page.waitForTimeout(2500);
  await v.locator("select[name$='Column']").first().selectOption({ label: 'ItemNumber' }).catch(() => {});
  await v.locator("select[name$='Operator']").first().selectOption({ label: 'Exactly Matches' }).catch(() => {});
  await v.locator("input[name$='Value']").first().fill(ITEM);
  await v.locator('#queryModeDd').selectOption({ label: 'With Masters' }).catch(() => {});
  await v.locator('#btnRetrieveItems').click();
  await page.waitForTimeout(6000);
  for (const b of bodies) {
    try {
      for (const x of JSON.parse(b)) console.log('VLMJSON', JSON.stringify({ ItemNumber: x.ItemNumber, IV: x.ItemVersion, TV: x.TemplateVersion, MDV: x.MasterDataVersion, Id: x.Id, HasMaster: x.HasMaster, LC: x.LCProductionRelease }));
    } catch { console.log('VLMRAW', b.slice(0, 300)); }
  }
});
