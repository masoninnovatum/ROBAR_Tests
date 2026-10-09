// Execution of UAT_6614 (DIT #6614): Workflow Management > Preset Management. A preset created with Save As and an EMPTY description, deactivated right away,
// must be selectable again in the Preset drop-down without a JavaScript error (old code read the length of the empty description).
// HEADED (evidence = OS-level desktop screenshots with the address bar). TST703 may not carry the fix yet -- the result is reported as observed.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { login, openMenuItem, findFrame } from '../support/robar';

test.use({ headless: false, actionTimeout: 20_000 });

const SHOTS = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--DB-Copies-703-20198\a480f2e1-948d-42ae-aee0-d197f8c859fc\scratchpad\uat6614_exec`;
const shot = (n: number): void => {
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/screenshot-desktop.ps1'), '-Path', path.join(SHOTS, `step_${String(n).padStart(2, '0')}.png`)]);
};

test('UAT 6614 execution', async ({ page }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const jsErrors: string[] = [];
  page.on('pageerror', (e) => { jsErrors.push(e.message); console.log('PAGEERROR ' + e.message); });
  const name = `MBPW6614${Date.now().toString().slice(-6)}`;
  const log: Record<string, unknown> = { name };

  await login(page);
  await openMenuItem(page, 'Workflow Management');
  let f = await findFrame(page, 'WorkflowManagement');
  await f.locator('#btGetWorkflows').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3000);
  await f.locator('#drpMainActions').click();
  await page.waitForTimeout(500);
  await f.locator('#actCreateWFPreset').click({ force: true });
  await page.waitForTimeout(4000);
  f = await findFrame(page, 'PresetManagement');
  await f.locator('#ddlSelectPreset').waitFor({ timeout: 15_000 });
  const choose = async (p: string) => { await f.locator('#ddlSelectPreset').selectOption({ label: p }, { timeout: 5000 }); await page.waitForTimeout(2500); };
  const dismiss = async () => { if ((await f.locator('.ui-dialog:visible').count()) > 0) await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').first().click({ timeout: 5000 }); await page.waitForTimeout(800); };
  const submitChanges = f.locator('button.button-class-long');
  shot(1);

  // Step 2: Save As based on an existing preset, description left EMPTY
  await choose('MBPreset1');
  await f.getByRole('button', { name: 'Save As' }).click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await f.locator('#txtSaveAsName').fill(name);
  await expect(f.locator('#txtSaveAsDescription')).toHaveValue('');
  shot(2);
  await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
  await page.waitForTimeout(3500);
  f = await findFrame(page, 'PresetManagement');
  await f.locator('#ddlSelectPreset').waitFor({ timeout: 15_000 });
  log.afterSaveAs = { selected: await f.locator('#ddlSelectPreset').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0].text), description: await f.locator('#txtPresetDescription').inputValue(), dialog: (await f.locator('.ui-dialog:visible').allInnerTexts()).join(' ') };
  console.log('AFTER SAVE AS ' + JSON.stringify(log.afterSaveAs));
  shot(3);

  // Step 3: deactivate immediately
  await f.locator('#chkActive').uncheck();
  await expect(submitChanges).toBeEnabled({ timeout: 5000 });
  shot(4);
  await submitChanges.click({ timeout: 5000 });
  await page.waitForTimeout(3500);
  await dismiss();
  f = await findFrame(page, 'PresetManagement');
  shot(5);

  // Step 4: select another preset, then the deactivated one
  const errsBefore = jsErrors.length;
  await choose('ROBAR Only');
  shot(6);
  await choose(name);
  shot(7);
  const state = { selected: await f.locator('#ddlSelectPreset').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0].text), active: await f.locator('#chkActive').isChecked(), description: await f.locator('#txtPresetDescription').inputValue(), stepsRendered: await f.locator('#steps-container').innerText().then((t) => t.replace(/\s+/g, ' ').slice(0, 120)), newJsErrors: jsErrors.slice(errsBefore) };
  console.log('STATE ' + JSON.stringify(state));
  log.state = state;

  // Step 5: cleanup (delete the throw-away preset)
  await f.locator('#btDeletePreset').click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  shot(8);
  await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: /^(Yes|OK|Delete)$/ }).first().click({ timeout: 5000 });
  await page.waitForTimeout(3000);
  f = await findFrame(page, 'PresetManagement');
  log.deleted = !(await f.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).includes(name);
  shot(9);
  log.jsErrors = jsErrors;
  fs.writeFileSync('test-data/uat6614-results.json', JSON.stringify(log, null, 2));
  expect(state.newJsErrors, 'JavaScript errors while selecting the deactivated preset').toEqual([]);
});
