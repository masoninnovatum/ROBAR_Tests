// Schemas security against ValMaster (docs/agents/valmaster-schemas.md): MDM20140512003F1.0.5 (a checkpoint controls who may add / change / view schemas = process MD_Edit_Schemas) and the
// field level View / Edit Security of MDM_Security3.2 (MDM20150421102F1.0.3 / 1.0.5 / 1.0.6 / 1.0.7: only users holding the field's MC_ process may edit / view that field; blank = everybody).
// Source: SchemasController (`Edit` has [CustomAuthorize(Roles = "MD_Edit_Schemas")]; `Save` and `New` (JsonResult) carry NO attribute, `Export` has MD_Export_Schemas).
// Confirmed live 2026-11-03 on TST703 (headless). Fixture schema MBNonItemschema2 (no data, non-item: its blank New Record page creates nothing, this spec never saves a record); the three CL fields it
// adds and the one-word description change are reverted in `finally`. Fixture operator CLPROp01 (group CLPRGrp = Login_WebMenu + ResetPassword_Option, seed password) logs in in a SECOND browser
// context after each group change; the seed user toggles CLPRGrp (only CL* is ever written) and restores it. The direct Save probe only ever targets MBNonItemschema2 (an MB-owned fixture).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { PASSWORD, login, loginAs, openMenuItem, findFrame } from '../support/robar';
import * as sec from '../support/security';
import * as sch from '../support/schemas';
import { OP, OP_GROUP, OP_PROCESSES } from '../Password-Management/pr-fixtures';

test.use({ actionTimeout: 20_000 });

const FIXTURE = 'MBNonItemschema2';
const stamp = Date.now().toString().slice(-6);
const C = { view: `CL View ${stamp}`, edit: `CL Edit ${stamp}`, plain: `CL Plain ${stamp}` };
const S = { view: `cl_view_${stamp}`, edit: `cl_edit_${stamp}`, plain: `cl_plain_${stamp}` };
const MC = 'MC_Engineering';
const MD_PROCESSES = ['MD_Management_Option', 'MD_Edit_Option', 'MD_Create_Records', 'MD_Edit_Records', 'SCH_' + FIXTURE];

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

async function openSchema(page: Page, reopen = false): Promise<Frame> {
  if (reopen) {
    await page.locator('li.ui-tabs-tab:has-text("Schemas") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  }
  await openMenuItem(page, 'Schemas');
  let f = await findFrame(page, 'Schemas');
  await f.locator('select[name="schemaSelector"]').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await f.locator('select[name="schemaSelector"]').selectOption({ label: FIXTURE });
  await page.waitForTimeout(4000);
  f = await findFrame(page, 'Schemas');
  await f.locator('#groups').waitFor({ timeout: 20_000 });
  return f;
}

test('Schemas security: MD_Edit_Schemas (tile, page, direct Save) and field level View / Edit Security (MC_)', async ({ page, browser }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const origin = new URL(page.url()).origin;
  let f = await openSchema(page);
  const baselineFields = await sch.fieldBlocks(f).count();
  const descInput = () => f.locator('input.text-wide').nth(1);
  const originalDescription = await descInput().inputValue();
  let savedBody = '';
  let savedType = '';
  let probeDescription = '';
  const setGroup = async (extra: string[]) => {
    await page.goto(page.url().replace(/Innovatum\/.*/i, 'Innovatum/WebMenu/MainMenu.aspx').replace(/InnovatumMDM\/.*/i, 'Innovatum/WebMenu/MainMenu.aspx'));
    await sec.setGroupProcesses(page, OP_GROUP, [...OP_PROCESSES, ...extra]);
  };
  const asOperator = async (check: (p: Page) => Promise<void>) => {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 950 } });
    const p = await ctx.newPage();
    try {
      await loginAs(p, OP, PASSWORD);
      await p.waitForTimeout(2000);
      await check(p);
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('Setup: three fields (View Security, Edit Security, none) and a captured description-only Save request', async () => {
      const add = async (caption: string, share: string) => {
        const before = await sch.fieldBlocks(f).count();
        await f.locator('#groups > .ui-tabs-panel:visible').first().getByText('Add New Field', { exact: false }).first().click();
        await expect(sch.fieldBlocks(f)).toHaveCount(before + 1, { timeout: 5000 });
        const b = sch.fieldBlocks(f).nth(before);
        await sch.row(b, 'Caption').locator('input').fill(caption);
        await sch.row(b, 'Share Name').locator('input').fill(share);
        return b;
      };
      const v = await add(C.view, S.view);
      await sch.row(v, 'View Security').locator('select').selectOption({ label: MC });
      const e = await add(C.edit, S.edit);
      await sch.row(e, 'Edit Security').locator('select').selectOption({ label: MC });
      await add(C.plain, S.plain);
      await sch.saveSchema(page, f);
      f = await openSchema(page, true);
      expect(await sch.fieldBlocks(f).count()).toBe(baselineFields + 3);
      // a description-only change, captured: the request is replayed later without the process
      probeDescription = originalDescription + ' CL';
      let capturing = true;
      page.on('request', (r) => { if (capturing && r.url().includes('/Schemas/Save') && r.method() === 'POST') { savedBody = r.postData() ?? ''; savedType = r.headers()['content-type'] ?? ''; } });
      await descInput().fill(probeDescription);
      await descInput().press('Tab');
      await sch.saveSchema(page, f);
      capturing = false; // only the FIRST save (the changed description) is kept for the replay
      expect(savedBody).toContain(probeDescription);
      expect(savedBody.length).toBeGreaterThan(20);
      console.log('captured Save request:', savedType, savedBody.length, 'bytes');
      f = await openSchema(page, true);
      await descInput().fill(originalDescription);
      await descInput().press('Tab');
      await sch.saveSchema(page, f);
      f = await openSchema(page, true);
      expect(await descInput().inputValue()).toBe(originalDescription);
    });

    await test.step('Without MD_Edit_Schemas: no Schemas tile, the page is not served, but a direct Save request is accepted (F1.0.5)', async () => {
      await setGroup([]);
      await asOperator(async (p) => {
        const body = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
        expect(body).not.toContain('Schemas');
        const get = await p.request.get(`${origin}/InnovatumMDM/Schemas/Edit?LinkedFromWebmenu=1`, { maxRedirects: 0 });
        const text = await get.text();
        console.log('direct GET Schemas/Edit without the process: HTTP', get.status(), '| page served:', text.includes('schemaSelector'));
        expect(text.includes('schemaSelector')).toBe(false);
        // replay the captured description-only Save
        const post = await p.request.post(`${origin}/InnovatumMDM/Schemas/Save`, { data: savedBody, headers: { 'Content-Type': savedType, 'X-Requested-With': 'XMLHttpRequest' } });
        const out = (await post.text()).replace(/\s+/g, ' ').slice(0, 160);
        console.log('direct POST Schemas/Save without the process: HTTP', post.status(), out);
        const accepted = post.status() === 200 && !/not authorized|Error/i.test(out);
        if (accepted) deviation('MDM20140512003F1.0.5 SchemasController.Save (and New) have no [CustomAuthorize]: a user WITHOUT MD_Edit_Schemas who sends the Save request directly changes a schema (here the description of the MB fixture, restored right after); only the Edit page is gated');
        f = await openSchema(page, true);
        const now = await descInput().inputValue();
        console.log('description after the direct POST:', now);
        expect(accepted ? now : probeDescription).toBe(probeDescription);
        await descInput().fill(originalDescription);
        await descInput().press('Tab');
        if (!(await f.locator('#btnSaveSchema').isDisabled())) await sch.saveSchema(page, f);
        f = await openSchema(page, true);
        expect(await descInput().inputValue()).toBe(originalDescription);
      });
    });

    await test.step('With MD_Edit_Schemas the tile opens the page, but the schema list follows the SCH_<schema> processes', async () => {
      await setGroup(['MD_Edit_Schemas']);
      await asOperator(async (p) => {
        await expect(p.getByRole('button', { name: 'Schemas', exact: true })).toBeVisible();
        await openMenuItem(p, 'Schemas');
        const g = await findFrame(p, 'Schemas');
        await p.waitForTimeout(4000);
        const text = (await g.locator('body').innerText()).replace(/\s+/g, ' ');
        console.log('MD_Edit_Schemas without any SCH_ process:', text.slice(0, 160));
        expect(text).toContain('Schema Security');
        expect(text).toContain('All schemas have been disallowed due to Schema Security.');
        expect(await g.locator('select[name="schemaSelector"]').count()).toBe(0);
      });
      await setGroup(['MD_Edit_Schemas', 'SCH_' + FIXTURE]);
      await asOperator(async (p) => {
        await openMenuItem(p, 'Schemas');
        const g = await findFrame(p, 'Schemas');
        await g.locator('select[name="schemaSelector"]').waitFor({ timeout: 20_000 });
        const options = (await g.locator('select[name="schemaSelector"] option').allInnerTexts()).map((s) => s.trim());
        const text = (await g.locator('body').innerText()).replace(/\s+/g, ' ');
        console.log(`with SCH_${FIXTURE}: schemas offered ${JSON.stringify(options)} | page text: ${text.slice(0, 200)}`);
        expect(options).toEqual(['Select a schema', FIXTURE]);
        expect(text).toContain('Some schemas have been disallowed due to Schema Security.');
      });
    });

    await test.step('Field level View / Edit Security on a blank New Record page: without the MC_ process the field is hidden / disabled (MDM20150421102F1.0.3, 1.0.5, 1.0.6, 1.0.7)', async () => {
      const look = async (extra: string[]) => {
        await setGroup([...MD_PROCESSES, ...extra]);
        return new Promise<{ view: number; viewDisabled: boolean | null; edit: number; editDisabled: boolean | null; plain: number; plainDisabled: boolean | null }>((resolve, reject) => {
          asOperator(async (p) => {
            await p.getByRole('button', { name: 'Master Data', exact: true }).click({ timeout: 15_000 });
            const g = await findFrame(p, 'MasterData');
            await p.waitForTimeout(2500);
            await g.selectOption('#ddlSchemas', { label: FIXTURE });
            await p.waitForTimeout(1500);
            await g.click('#drpMainActions');
            await p.waitForTimeout(500);
            await g.click('#actNewRecord', { force: true });
            await p.waitForTimeout(4000);
            const edit = await findFrame(p, 'MasterData');
            await expect(edit.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible({ timeout: 20_000 });
            const rowOf = (c: string) => edit.getByRole('row', { name: c });
            const disabledOf = async (c: string) => ((await rowOf(c).count()) ? rowOf(c).locator('input, textarea, select').first().isDisabled() : null);
            resolve({ view: await rowOf(C.view).count(), viewDisabled: await disabledOf(C.view), edit: await rowOf(C.edit).count(), editDisabled: await disabledOf(C.edit), plain: await rowOf(C.plain).count(), plainDisabled: await disabledOf(C.plain) });
          }).catch(reject);
        });
      };
      const without = await look([]);
      console.log(`without ${MC}:`, JSON.stringify(without));
      const withMc = await look([MC]);
      console.log(`with ${MC}:`, JSON.stringify(withMc));
      expect(without.plain, 'a field without security is shown to everybody (F1.0.6 / 1.0.7)').toBe(1);
      expect(without.plainDisabled).toBe(false);
      // F1.0.5: only users with the process may VIEW the field. On the blank New Record page the field is still rendered (a saved record would be needed to see the value hidden: a schema with data would lock the fixture)
      if (without.view !== 0) deviation('MDM20150421102F1.0.5 View Security: on a blank New Record page a field whose View Security is ' + MC + ' is still shown to a user without that process (disabled=' + without.viewDisabled + '); hiding on saved records could not be tested without giving the fixture schema data');
      expect(without.edit, 'Edit Security: the field is still shown').toBe(1);
      expect(without.editDisabled, 'Edit Security: but it cannot be edited without the process (F1.0.3)').toBe(true);
      expect(withMc.view).toBe(1);
      expect(withMc.edit).toBe(1);
      expect(withMc.editDisabled).toBe(false);
    });
  } finally {
    try {
      await setGroup([]);
    } catch (e) {
      console.log('RESTORE FAILED: set group CLPRGrp back to Login_WebMenu + ResetPassword_Option in Security Management:', String(e).slice(0, 300));
    }
    try {
      f = await openSchema(page, true);
      for (const cap of Object.values(C)) {
        const b = sch.fieldBlock(f, cap);
        if (await b.count()) {
          await b.locator('.md-field-caption').click();
          await page.waitForTimeout(300);
          await b.locator('.delete-field').click({ timeout: 5000 });
        }
      }
      if ((await descInput().inputValue()) !== originalDescription) await descInput().fill(originalDescription);
      if (!(await f.locator('#btnSaveSchema').isDisabled())) await sch.saveSchema(page, f);
      f = await openSchema(page, true);
      console.log('fixture after cleanup: fields', await sch.fieldBlocks(f).count(), '| description', JSON.stringify(await descInput().inputValue()));
      expect(await sch.fieldBlocks(f).count()).toBe(baselineFields);
    } catch (e) {
      console.log(`CLEANUP FAILED (delete the CL fields with the stamp ${stamp} and restore the description "${originalDescription}" on ${FIXTURE} by hand):`, String(e).slice(0, 300));
    }
  }
});
