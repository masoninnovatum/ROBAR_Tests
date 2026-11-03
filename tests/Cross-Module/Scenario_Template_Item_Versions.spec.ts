// Scenario builder (TST703): a template with 9 versions (0-7 approved, 8 unapproved) and an item on it with 7 versions
// (0-5 approved, 6 unapproved); item v5 -> Label Control record on template v6, item v6 -> Label Control record on template v8.
// Reproduces the Update Versions situation reported against UAT_LC_SecurityAttachmentsLinkingAndVersions (steps 23/26/27).
//
// No BarTender: the template is a server-side copy of an approved template (Template Management's own SaveAsNew endpoint,
// "Template" copy for v0, then "Version" copies for v1..v8), approved through the Approve Templates bulk job.
// State is kept in test-data/scenario-versions.json so each phase can be re-run on its own.
//   npx playwright test tests/Cross-Module/Scenario_Template_Item_Versions.spec.ts -g "phase A"

import { test, expect } from '@playwright/test';
import { resetLabelControlGrid } from '../support/label-control';
import type { Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as cm from '../support/campaign-manager';
import * as mdm from '../support/master-data';

test.use({ actionTimeout: 20_000 });

const STORE = path.join(__dirname, '..', '..', 'test-data', 'scenario-versions.json');
const SOURCE_TEMPLATE = 'A1SuperTemplate';
const LABEL_TYPE = 'Carton Label';

interface State { template?: string; item?: string; lcnV5?: string; lcnV6?: string }
const load = (): State => (fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : {});
const save = (s: State) => fs.writeFileSync(STORE, JSON.stringify(s, null, 2));

const closeTab = (page: Page, name: string) => page.locator(`li.ui-tabs-tab:has-text("${name}") .ui-icon-close`).click({ timeout: 3000 }).catch(() => {});

/** Opens Template Management with every scope control set explicitly and one Template Name criteria row. */
async function queryTemplates(page: Page, name: string, opts: { allVersions: boolean; approval: string }): Promise<Frame> {
  await closeTab(page, 'Template Management');
  await openMenuItem(page, 'Template Management');
  let frame = await findFrame(page, 'TemplateManagement');
  await frame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  await frame.selectOption('#drpApprove', { label: opts.approval });
  const latest = frame.locator('#chkLatestVersion');
  if ((await latest.isChecked()) === opts.allVersions) await latest.setChecked(!opts.allVersions);
  const eff = frame.locator('#chkEffectiveOnly');
  if (await eff.isChecked()) await eff.setChecked(false);
  if ((await frame.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
    await frame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
  }
  await frame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName');
  await frame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches');
  await frame.fill('input[name="dvFilters[0].Value"]', name);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart') && (r.request().postData() || '').includes(name), { timeout: 20_000 }),
    frame.click('#btnRetrieveData'),
  ]);
  await page.waitForTimeout(2500);
  return frame;
}

async function templateRows(frame: Frame, name: string): Promise<{ version: number; approvedBy: string; text: string }[]> {
  const rows = await frame.locator('#grdJqGrid tr.jqgrow').filter({ hasText: name }).evaluateAll((trs) =>
    trs.map((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td as HTMLElement).innerText.trim());
      return cells;
    })
  );
  return rows.map((cells) => {
    // Template Name cell, then Label Type, then Version
    const i = cells.findIndex((c) => c === name);
    return { version: Number(cells[i + 2]), approvedBy: cells.slice(i + 3).join('|'), text: cells.join('|') };
  });
}

async function postJson(frame: Frame, action: string, body: unknown): Promise<any> {
  return frame.evaluate(async ([url, payload]) => {
    const res = await fetch(url as string, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return res.json();
  }, [action, body]);
}

test.describe.serial('Scenario: template with 9 versions, item with 7 versions, Label Control records', () => {
  test('phase A: template CL... with versions 0-7 approved and 8 unapproved', async ({ page }) => {
    test.setTimeout(600_000);
    const state = load();
    const name = state.template ?? 'CLVerTpl' + Math.floor(Math.random() * 100000);
    await login(page);

    let frame = await queryTemplates(page, name, { allVersions: true, approval: 'Approved and Unapproved' });
    let rows = await templateRows(frame, name);
    if (rows.length === 0) {
      const created = await postJson(frame, 'SaveAsNew', { sourceTemplateName: SOURCE_TEMPLATE, sourceVersionNumber: 0, newTemplateName: name, description: 'Scenario template: 9 versions (Update Versions repro)', newLabelType: LABEL_TYPE, saveAsType: 'Template' });
      expect(created.Success, `SaveAsNew(Template) failed: ${JSON.stringify(created)}`).toBe(true);
      state.template = name;
      save(state);
    }
    for (let v = rows.length === 0 ? 1 : rows.length; v <= 8; v++) {
      const r = await postJson(frame, 'SaveAsNew', { sourceTemplateName: name, sourceVersionNumber: v - 1, newTemplateName: '', description: '', newLabelType: '', saveAsType: 'Version' });
      expect(r.Success, `SaveAsNew(Version ${v}) failed: ${JSON.stringify(r)}`).toBe(true);
    }
    frame = await queryTemplates(page, name, { allVersions: true, approval: 'Approved and Unapproved' });
    rows = await templateRows(frame, name);
    console.log('versions present:', rows.map((r) => r.version).sort((a, b) => a - b).join(','));
    expect(rows.map((r) => r.version).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);

    // approve 0..7 in one Approve Templates job (v8 stays unapproved)
    const toApprove = rows.filter((r) => r.version <= 7 && !r.text.toLowerCase().includes(USERNAME.toLowerCase()));
    console.log('rows still to approve:', toApprove.map((r) => r.version).join(','));
    if (toApprove.length > 0) {
      frame = await queryTemplates(page, name, { allVersions: true, approval: 'Unapproved Only' });
      const grid = frame.locator('#grdJqGrid tr.jqgrow').filter({ hasText: name });
      const n = await grid.count();
      const versions = await grid.evaluateAll((trs, nm) =>
        trs.map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td as HTMLElement).innerText.trim());
          return Number(cells[cells.indexOf(nm as string) + 2]);
        }), name);
      for (let i = 0; i < n; i++) {
        if (versions[i] <= 7) {
          await Promise.all([
            page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
            grid.nth(i).locator('input[type="checkbox"]').check(),
          ]);
        }
      }
      await page.waitForTimeout(500);
      await frame.getByText('Bulk Actions', { exact: true }).click();
      await page.waitForTimeout(500);
      await frame.getByText('Approve Templates', { exact: true }).click();
      await page.waitForTimeout(800);
      await frame.fill('#txtJobDescription', 'Scenario template versions 0-7 approve');
      await frame.fill('#sigUser', USERNAME);
      await frame.fill('#sigPassword', PASSWORD);
      await frame.locator('#sigPassword').press('Tab');
      await frame.selectOption('#sigReason', { label: 'General' });
      await expect(frame.locator('#btnSubmit')).toBeEnabled({ timeout: 10_000 });
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/TemplateManagement/ApproveSubmitJob'), { timeout: 20_000 }),
        frame.locator('#btnSubmit').click(),
      ]);
      await expect(frame.getByRole('heading', { name: 'Approve Templates Job Detail' })).toBeVisible();
      await expect(frame.locator('body')).toContainText('Completed', { timeout: 60_000 });
    }

    frame = await queryTemplates(page, name, { allVersions: true, approval: 'Approved Only' });
    const approved = (await templateRows(frame, name)).map((r) => r.version).sort((a, b) => a - b);
    console.log('approved versions:', approved.join(','));
    expect(approved).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    await closeTab(page, 'Template Management');
  });

  test('phase B: master data record + item with versions 0-5 approved and 6 unapproved', async ({ page }) => {
    test.setTimeout(900_000);
    const state = load();
    expect(state.template, 'run phase A first').toBeTruthy();
    expect(state.item, 'phase B already done (delete "item" from test-data/scenario-versions.json to redo)').toBeFalsy();
    const itemNumber = 'CLVerItm' + Date.now().toString().slice(-6);

    // one UNAPPROVED master data record (version 0) for the item number; all item versions share it
    const mdGrid = await mdm.openMasterData(page);
    await mdm.createValidRecord(page, mdGrid, { itemNumber, description: 'Scenario master data for ' + itemNumber, brandName: 'Scenario Brand' });
    state.item = itemNumber;
    save(state);
    await closeTab(page, 'Master Data');

    await openMenuItem(page, 'Campaign Manager');
    const cmFrame = await findFrame(page, 'campaignmanager');
    await page.waitForTimeout(1000);
    await cmFrame.click('#btnCreateNew');
    await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible' });
    await cmFrame.fill('#txtItemNumber', itemNumber);
    await cmFrame.selectOption('#ddlLabelType', cm.LABEL_TYPE);
    await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');
    let edit = await findFrame(page, 'items/edit');
    await edit.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);
    const options = await edit.locator('select[name="txtTemplateName"] option').allTextContents();
    expect(options, `template ${state.template} not offered on the item`).toContain(state.template);
    await edit.selectOption('select[name="txtTemplateName"]', state.template!);
    await edit.fill('input[name="txtDescription"]', 'Scenario item (Update Versions repro)');
    const [saved] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/') && r.request().method() === 'POST', { timeout: 15_000 }),
      edit.click('button:has-text("Save")'),
    ]);
    expect(saved.status()).toBe(200);
    await page.waitForTimeout(1000);

    const frameForVersion = async (v: number) => {
      const f = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}&labeltype=${encodeURIComponent(cm.LABEL_TYPE.toLowerCase())}&versionnumber=${v}`, { attempts: 40 }).catch(() => findFrame(page, 'items/edit'));
      await f.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(800);
      return f;
    };

    for (let v = 0; v <= 5; v++) {
      await cm.openItemAction(edit, 'Approve Item');
      const approved = await cm.submitSignatureDialog(page, edit, '#approveItemDialog', 'ApproveItem');
      expect(approved.Success, `ApproveItem v${v} failed: ${JSON.stringify(approved)}`).toBe(true);
      await page.waitForTimeout(1500);
      edit = await findFrame(page, 'items/edit');
      await edit.waitForLoadState('networkidle').catch(() => {});
      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/items/SaveAsNewItemVersion'), { timeout: 20_000 }),
        cm.openItemAction(edit, 'Save As New Version'),
      ]);
      const body = await resp.json();
      expect(body.Success, `SaveAsNewItemVersion v${v}->v${v + 1} failed: ${JSON.stringify(body)}`).toBe(true);
      edit = await frameForVersion(v + 1);
      await expect(edit.getByRole('cell', { name: new RegExp(`Version:\\s*${v + 1}\\b`) })).toBeVisible({ timeout: 15_000 });
      console.log(`item ${itemNumber}: version ${v} approved, version ${v + 1} created`);
    }
    // version 6 stays unapproved; confirm its template
    const tpl = await edit.locator('select[name="txtTemplateName"]').inputValue();
    console.log('item v6 template:', tpl);
    expect(tpl).toBe(state.template);
    await expect(edit.locator('span[data-bind*="approvedStatus"]')).toHaveText(/Unapproved/);
    await closeTab(page, 'Campaign Manager');
  });

  test('phase C: Label Control records for item v5 (template v6) and v6 (template v8), linked to the unapproved master data', async ({ page }) => {
    test.setTimeout(900_000);
    const state = load();
    expect(state.item, 'run phase B first').toBeTruthy();
    const item = state.item!;
    await login(page);

    const queryLc = async (version: number): Promise<Frame> => {
      await closeTab(page, 'Label Control');
      await openMenuItem(page, 'Label Control');
      let frame = await findFrame(page, 'LabelControl/Management');
      frame = await resetLabelControlGrid(page, frame);
      await frame.locator('#drpApproved').selectOption({ label: 'All (LCN Status)' });
      await frame.locator('#drpAttachments').selectOption({ label: 'Any (Attachments)' });
      await frame.locator('#drpLabelMaster').selectOption({ label: 'Any (Label Masters)' });
      const add = frame.locator('.criteriaFilter-AddButton span:not(.ui-icon)');
      await add.click();
      await page.waitForTimeout(500);
      await add.click();
      await page.waitForTimeout(500);
      const cols = frame.locator("select[name$='Column']");
      const ops = frame.locator("select[name$='Operator']");
      const vals = frame.locator("input[name$='Value']");
      await cols.nth(0).selectOption('LCV_ItemNumber');
      await ops.nth(0).selectOption('ExactlyMatches');
      await vals.nth(0).fill(item);
      await cols.nth(1).selectOption('LCV_VersionNumber');
      await ops.nth(1).selectOption('ExactlyMatches');
      await vals.nth(1).fill(String(version));
      await frame.click('#btnRetrieveData');
      await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      return frame;
    };
    const rowOf = (frame: Frame) => frame.locator('#grdLabelControl tr.jqgrow').filter({ hasText: item });
    const readSelect = (frame: Frame, sel: string) => frame.locator(sel).evaluate((el) => {
      const s = el as HTMLSelectElement;
      return { options: Array.from(s.options).map((o) => o.text.trim()), selected: s.selectedOptions[0]?.text.trim() ?? '' };
    });

    const targets = [
      { itemVersion: 5, templateVersion: 6, key: 'lcnV5' as const },
      { itemVersion: 6, templateVersion: 8, key: 'lcnV6' as const },
    ];
    for (const t of targets) {
      let frame = await queryLc(t.itemVersion);
      await expect(rowOf(frame), `item ${item} v${t.itemVersion} not found in Label Control`).toHaveCount(1, { timeout: 10_000 });
      let lcn = (await rowOf(frame).innerText()).match(/LCN\d+/)?.[0];
      if (!lcn) {
        await rowOf(frame).locator('input[type="checkbox"]').first().check();
        await page.waitForTimeout(500);
        await frame.click('#drpActions');
        await page.waitForTimeout(300);
        await frame.click('#actAssignLabelControl', { force: true });
        const job = await findFrame(page, 'MassAssign/JobSubmission');
        await job.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1000);
        await job.fill('#txtJobDescription', `Scenario versions -- assign LCN item v${t.itemVersion}`);
        await job.fill('#sigUser', USERNAME);
        await job.fill('#sigPassword', PASSWORD);
        await job.selectOption('#sigReason', { index: 1 });
        await job.fill('#sigComments', 'Assigned by scenario builder');
        const [resp] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 20_000 }),
          job.click('#submitBtn'),
        ]);
        expect((await resp.json()).Success).toBe(true);
        for (let i = 0; i < 12 && !lcn; i++) {
          await page.waitForTimeout(2500);
          frame = await queryLc(t.itemVersion);
          lcn = (await rowOf(frame).innerText().catch(() => '')).match(/LCN\d+/)?.[0];
        }
      }
      expect(lcn, `item v${t.itemVersion} never got an LCN`).toBeTruthy();
      state[t.key] = lcn;
      save(state);
      console.log(`item v${t.itemVersion}: ${lcn}`);

      // Update Versions: template version + the shared unapproved master data version
      frame = await queryLc(t.itemVersion);
      await rowOf(frame).getByText('Actions', { exact: true }).click();
      await page.waitForTimeout(500);
      await rowOf(frame).getByText('Update Versions', { exact: true }).click();
      await frame.locator('#drpTemplateVersion').waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(1500);
      const tpl = await readSelect(frame, '#drpTemplateVersion');
      const md = await readSelect(frame, '#drpMasterDataVersion');
      console.log(`v${t.itemVersion} dialog before: template ${JSON.stringify(tpl)} md ${JSON.stringify(md)}`);
      const tplLabel = tpl.options.find((o) => new RegExp(`^${t.templateVersion}\\b`).test(o));
      expect(tplLabel, `template version ${t.templateVersion} not offered: ${JSON.stringify(tpl)}`).toBeTruthy();
      await frame.locator('#drpTemplateVersion').selectOption({ label: tplLabel! });
      const mdLabel = md.options.find((o) => o.startsWith('0'));
      expect(mdLabel, `master data 0 not offered: ${JSON.stringify(md)}`).toBeTruthy();
      await frame.locator('#drpMasterDataVersion').selectOption({ label: mdLabel! });
      await page.waitForTimeout(500);
      const [upd] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('UpdateLabelControl'), { timeout: 20_000 }),
        frame.click('#btnUpdate', { timeout: 5000 }),
      ]);
      const body = await upd.json();
      expect(body.ErrorMessage ?? '', `UpdateLabelControl: ${JSON.stringify(body)}`).toBe('');
      await page.waitForTimeout(3000);

      // verify by reopening
      frame = await queryLc(t.itemVersion);
      await rowOf(frame).getByText('Actions', { exact: true }).click();
      await page.waitForTimeout(500);
      await rowOf(frame).getByText('Update Versions', { exact: true }).click();
      await frame.locator('#drpTemplateVersion').waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(1500);
      const after = {
        item: await readSelect(frame, '#drpItemVersion'),
        tpl: await readSelect(frame, '#drpTemplateVersion'),
        md: await readSelect(frame, '#drpMasterDataVersion'),
      };
      console.log(`v${t.itemVersion} dialog after: ${JSON.stringify(after)}`);
      expect(after.item.selected).toMatch(new RegExp(`^${t.itemVersion}\\b`));
      expect(after.tpl.selected).toMatch(new RegExp(`^${t.templateVersion}\\b`));
      expect(after.md.selected).toMatch(/^0/);
      await page.keyboard.press('Escape');
    }
    await closeTab(page, 'Label Control');
  });
});
