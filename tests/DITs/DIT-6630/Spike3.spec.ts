// DIT 6630 spike 3: scan all VLM "With Masters" rows as a user WITHOUT ViewUnapprovedLabelMasters; list rows whose status text is not a link.
import { test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { loginAs, openMenuItem, findFrame, PASSWORD } from '../../support/robar';
import * as sec from '../../support/security';

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';

test('scan VLM statuses', async ({ page, browser }) => {
  test.setTimeout(900_000);
  sec.assertMb(GROUP);
  await sec.openSecurity(page);
  await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu', 'LM_View_LabelMaster']);
  const ctx = await browser.newContext();
  const p: Page = await ctx.newPage();
  try {
    await loginAs(p, MB, PASSWORD);
    await p.waitForTimeout(2000);
    await openMenuItem(p, 'View Label Master');
    const f: Frame = await findFrame(p, 'itemlabelmasterview');
    await f.waitForSelector('#btnRetrieveItems');
    await p.waitForTimeout(2500);
    for (let i = 0; i < 5; i++) {
      const rm = f.getByText('Remove', { exact: true });
      if (!(await rm.count())) break;
      await rm.first().click({ timeout: 3000 }).catch(() => {});
      await p.waitForTimeout(300);
    }
    await f.locator('#btnRetrieveItems').click();
    await f.locator('#gridResults tr.jqgrow').first().waitFor({ timeout: 60_000 });
    await f.locator('select.ui-pg-selbox').first().selectOption({ label: '30' }).catch(() => {});
    await p.waitForTimeout(1500);
    const seen = new Map<string, number>();
    for (let pg = 0; pg < 40; pg++) {
      const rows = await f.locator('#gridResults tr.jqgrow').evaluateAll((trs) =>
        trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim().slice(0, 30)).filter((t) => t && !t.startsWith('/Date'))));
      for (const r of rows) {
        const last = r[r.length - 1] || '';
        const status = /^View Master/.test(last) ? 'LINK' : last;
        seen.set(status, (seen.get(status) || 0) + 1);
        if (status !== 'LINK') console.log('SCAN', r.join(' | '));
      }
      const next = f.locator('#next_resultsPager, .ui-icon-seek-next').first();
      const dis = await next.evaluate((e) => (e.closest('td') || e).className).catch(() => '');
      if (/disabled/.test(dis)) break;
      await next.click().catch(() => {});
      await p.waitForTimeout(800);
    }
    console.log('SCAN-SUMMARY', JSON.stringify([...seen.entries()]));
  } finally {
    await ctx.close();
    await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu']);
  }
});
