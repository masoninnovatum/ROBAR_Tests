// DIT 6630 spike 4 (read-only): Label Control rows for an item, "With Label Master" vs "Without", showing the key column.
import { test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../../support/robar';

async function lc(page: Page, item: string, labelMaster: string): Promise<string[]> {
  await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Label Control');
  let frame: Frame = await findFrame(page, 'LabelControl/Management');
  await frame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await frame.click('#btnReset');
  await page.waitForTimeout(1500);
  frame = await findFrame(page, 'LabelControl/Management');
  await frame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await frame.locator('#drpApproved').selectOption({ label: 'All (LCN Status)' });
  await frame.locator('#drpAttachments').selectOption({ label: 'Any (Attachments)' });
  await frame.locator('#drpLabelMaster').selectOption({ label: labelMaster });
  await frame.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
  await page.waitForTimeout(500);
  await frame.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
  await frame.locator("select[name$='Operator']").first().selectOption('ExactlyMatches');
  await frame.locator("input[name$='Value']").first().fill(item);
  await frame.click('#btnRetrieveData');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return frame.locator('tr.jqgrow').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim().slice(0, 24)).filter((t) => t && !t.startsWith('/Date')).join(' | ')));
}

test('LC view of VLM items', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  for (const item of (process.env.LC_ITEMS || 'BBTest44').split(',')) {
    for (const mode of ['With Label Master', 'Without Label Master']) {
      const rows = await lc(page, item, mode).catch((e) => ['ERR ' + String(e).slice(0, 80)]);
      console.log(`LC ${item} [${mode}] rows=${rows.length}`);
      for (const r of rows) console.log('LCROW', item, mode.startsWith('With ') ? 'WITH' : 'WITHOUT', r);
    }
  }
});
