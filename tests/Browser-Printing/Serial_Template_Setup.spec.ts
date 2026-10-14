// SETUP for the serialized (S_USerial) Print by Lot test (user request 2026-10-14, HEADED, TST703): creates a NEW template whose one text object is bound to the sharename S_USerial
// ("unique serial": the print screen then shows the Serial Number Management panel), approves it in the BarTender wrapper (e-signature from seed.ts), and creates an approved item on it
// with an LCN and a Label Master. Names are persisted in test-data/serial-pdf-fixture.json so Serial_Print_To_PDF.spec.ts can reuse them (templates and items cannot be deleted):
// a second run reuses the saved fixture instead of creating another template. Delete that json to make a fresh one.
// FlaUI drives the REAL mouse in BarTender: do not touch the mouse or keyboard.

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as flaui from '../../scripts/flaui_bridge';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as bartender from '../support/bartender';
import { resolveBtwFile } from '../support/templates';
import { ensureItemWithMaster } from '../support/label-master-item';
import { VARIANTS, fixturePath } from '../support/serial-variants';

test.use({ headless: false });


for (const v of VARIANTS.filter((x) => !x.existing)) test(`[${v.key}] create an ${v.sharename} template, approve it, and an approved item with LCN and Label Master on it`, async ({ page }, testInfo) => {
  const FIXTURE = fixturePath(v);
  const SHARENAME = v.sharename;
  test.setTimeout(1_500_000);
  await login(page);
  const keepAlive = setInterval(() => {
    page.evaluate(() => {
      const w = window as unknown as { RefreshTimeout?: () => void };
      if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout();
    }).catch(() => {});
  }, 60_000);
  try {
    let template = '';
    if (fs.existsSync(FIXTURE)) template = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).template ?? '';
    if (!template) {
      template = v.templatePrefix + Date.now().toString().slice(-6);
      await test.step(`create template ${template} bound to ${SHARENAME}`, async () => {
        await openMenuItem(page, 'Template Management');
        const tm = await findFrame(page, 'TemplateManagement');
        await tm.click('#drpMainActions');
        await page.waitForTimeout(500);
        await tm.click('#actCreateTemplate', { force: true });
        await page.waitForTimeout(1000);
        await tm.fill('#txtTemplateName', template);
        await tm.fill('#txtDescription', `Serialized (${SHARENAME}) template for the Print to PDF serial test`);
        await tm.selectOption('#ddlLabelType', { value: 'Carton Label' });
        await tm.setInputFiles('#newFileInput', resolveBtwFile());
        await page.waitForTimeout(500);
        const [createResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
          page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
          tm.locator('button:has-text("Submit"):visible').first().click({ force: true }),
        ]);
        expect((await createResponse.json()).Success).toBe(true);
        const pid = await bartender.launchTemplateEditor(page, 240);
        await bartender.addTextObjectBoundToSharename(page, pid, SHARENAME);
        const rect = await flaui.getProperty({ processId: pid, name: 'Workspace', property: 'BoundingRectangle' });
        for (const extra of v.extraSharenames ?? []) {
          await bartender.addTextObjectBoundToSharename(page, pid, extra, { center: false, placeAtOffset: bartender.secondTextObjectOffset(rect.value) });
        }
        const shot = testInfo.outputPath('template_data_source_names.png');
        await bartender.captureDataSourceNames(page, pid, shot);
        await testInfo.attach('BarTender View > Data Source Names', { path: shot, contentType: 'image/png' });
        await bartender.saveTemplate(page, pid);
        const click = (what: string, args: Parameters<typeof flaui.click>[0]) => bartender.until(page, what, () => flaui.click(args), { attempts: 1 });
        await click('click Approve', { processId: pid, title: 'Template Editor', name: 'Approve', automationId: 'btnApprove', method: 'mouse' });
        await page.waitForTimeout(1000);
        const fill = (what: string, name: string, value: string, retrySeconds: number) =>
          bartender.until(page, what, () => flaui.setText({ processId: pid, elementName: 'Signature Required', name, automationId: name, value, retrySeconds, verify: true, method: 'win32' }), { attempts: 1 });
        await fill('fill User in the Signature Required dialog', 'txtUser', USERNAME, 60);
        await fill('fill Password in the Signature Required dialog', 'txtPassword', PASSWORD, 30);
        await click('submit the Signature Required dialog', { processId: pid, elementName: 'Signature Required', name: 'Submit', automationId: 'btnSubmit', method: 'mouse' });
        await page.waitForTimeout(3000);
        await bartender.closeTemplateEditor(page, pid);
        await page.locator('li.ui-tabs-tab:has-text("Template Management") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
        fs.writeFileSync(FIXTURE, JSON.stringify({ template, sharename: SHARENAME, created: new Date().toISOString() }, null, 2));
      });
    } else {
      console.log(`reusing saved template ${template}`);
    }

    await test.step('approved item with LCN and Label Master on that template', async () => {
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
      const item = await ensureItemWithMaster(page, { template, store: v.itemStore, prefix: v.itemPrefix });
      const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
      fs.writeFileSync(FIXTURE, JSON.stringify({ ...saved, item, labelType: 'Carton Label' }, null, 2));
      console.log(`FIXTURE template=${template} item=${item}`);
    });
  } finally {
    clearInterval(keepAlive);
  }
});
