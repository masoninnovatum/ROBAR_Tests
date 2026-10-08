// Multi Document Printing: View Master / View Compare for an item that HAS a label master (live 2026-10-06, HEADED because the module raises the Sentinel prompt on open; no print is done).
// The fixture item (support/label-master-item.ts: approved item + LCN + Label Control > Recreate Master) is created the first time and reused afterwards.
// Nothing is printed, so no lot is created (the lot panel only previews a new lot).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login } from '../support/robar';
import { ensureItemWithMaster } from '../support/label-master-item';
import * as bartender from '../support/bartender';

test.use({ headless: false, actionTimeout: 20_000 });

const PDF_PRINTER = 'Microsoft Print to PDF';

test('Multi Document Printing: View Master and View Compare work for an item with a label master', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const item = await ensureItemWithMaster(page);
  console.log(`item with label master: ${item}`);
  const stamp = Date.now().toString().slice(-6);
  let f: Frame;

  await test.step('open the module (Sentinel prompt) and enter a new lot for the item', async () => {
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Multi Document Printing', exact: true }).click({ timeout: 10_000 });
    await page.waitForTimeout(4000);
    const pid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, pid);
    for (let i = 0; i < 20; i++) {
      const g = page.frames().filter((x) => x.url().includes('MultiDocPrinting/MultiDocumentPrinting')).pop();
      if (g && (await g.locator('input[name="FlexLot_OrderNum"]').count()) > 0) { f = g; break; }
      await page.waitForTimeout(1000);
    }
    await f!.locator('input[name="FlexLot_OrderNum"]').fill(`MBMDMO${stamp}`);
    await f!.locator('input[name="FlexLot_LotNum"]').fill(`MBMDML${stamp}`);
    await f!.locator('input[name="FlexLot_ItemNumber"]').fill(item);
    await f!.locator('input[name="FlexLot_ItemNumber"]').press('Tab');
    await f!.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(6000);
  });

  await test.step('choose Carton Label on the PDF row, then View Master and View Compare', async () => {
    const row = f!.locator('tr').filter({ has: f!.locator('select') }).filter({ hasText: PDF_PRINTER });
    await row.locator('select').filter({ hasText: 'Select a label type' }).selectOption({ label: 'Carton Label' });
    await page.waitForTimeout(4000);
    console.log(`PDF row: ${(await row.innerText()).replace(/\s+/g, ' ')}`);
    const action = row.locator('select').filter({ hasText: 'View Preview' });
    const go = action.locator('xpath=following::button[1]');
    const pagesBefore = page.context().pages().length;
    for (const name of ['View Master', 'View Compare']) {
      await action.selectOption({ label: name });
      const popup = page.context().waitForEvent('page', { timeout: 30_000 });
      await go.click();
      const np = await popup;
      await np.waitForLoadState('load').catch(() => {});
      await page.waitForTimeout(8000);
      const body = (await np.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      console.log(`${name} opened ${np.url()} | title "${await np.title().catch(() => '')}" | text "${body.slice(0, 200)}" | imgs ${await np.locator('img, canvas, iframe').count()}`);
      expect(np.url()).toMatch(name === 'View Master' ? /GetItemLabelMasterPdf/ : /FileComparer.*ViewMode=Horizontal/);
      expect(body).not.toContain('No master file saved');
      await np.close().catch(() => {});
      const dlgText = ((await f!.locator('.ui-dialog:visible').allInnerTexts()).join(' ')).replace(/\s+/g, ' ');
      const media = await f!.locator('.ui-dialog:visible').locator('img, canvas, iframe').count();
      console.log(`${name}: dialog "${dlgText.slice(0, 200)}" media ${media} pages ${pagesBefore} -> ${page.context().pages().length}`);
      expect(dlgText).not.toContain('No Label Master Found');
      await f!.locator('.ui-dialog:visible button').filter({ hasText: /OK|Close/ }).first().click({ timeout: 3000 }).catch(() => {});
      for (const p of page.context().pages().slice(pagesBefore)) await p.close().catch(() => {});
      await page.waitForTimeout(800);
    }
  });
});
