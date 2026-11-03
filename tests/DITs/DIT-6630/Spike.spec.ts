// DIT 6630 spike (read-only): dump View Label Master "With Masters" rows and their HasMaster text.
import { test } from '@playwright/test';
import { login } from '../../support/robar';

test('dump VLM', async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  await page.locator('button.menuIcon', { hasText: 'View Label Master' }).first().click();
  let fr;
  for (let i = 0; i < 60 && !fr; i++) {
    fr = page.frames().filter((f) => f.url().toLowerCase().includes('itemlabelmasterview')).pop();
    await page.waitForTimeout(500);
  }
  if (!fr) throw new Error('no VLM frame');
  await fr.waitForSelector('#btnRetrieveItems');
  await page.waitForTimeout(2500);
  for (let i = 0; i < 5; i++) {
    const rm = fr.getByText('Remove', { exact: true });
    if (!(await rm.count())) break;
    await rm.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await fr.locator('#btnRetrieveItems').click();
  await fr.locator('#gridResults tr.jqgrow').first().waitFor({ timeout: 60_000 });
  console.log('PAGER', await fr.locator('.ui-paging-info').first().innerText().catch(() => ''));
  for (let p = 0; p < 8; p++) {
    const rows = await fr.locator('#gridResults tr.jqgrow').evaluateAll((trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()).join(' | ')));
    for (const r of rows) console.log('ROW', r);
    const next = fr.locator('.ui-icon-seek-next').first();
    if (!(await next.count())) break;
    await next.click().catch(() => {});
    await page.waitForTimeout(1200);
  }
});
