// Workflow Management > Actions > Preset Management (InnoPages/WorkflowManagement/PresetManagement), live 2026-10-05 as Claude01.
// Only throw-away MB presets (`MBPWPreset<stamp>`) are created and they are DELETED again (presets, unlike groups/schemas/label
// types, can be removed), including leftovers from an interrupted run. Page anatomy: preset `#ddlSelectPreset` + "Create New"
// button; per-preset controls `Save As`, `#btDeletePreset`, `#chkActive`, `#txtPresetDescription` + "Submit Changes", "Add Step"
// (opens `#dvMainEdit`: `#drpUser`, `#txtDepartment`, `#chkVoteForGroup`, `#drpVoteVeto`, `#txtApprovalGroup`,
// `#txtHoursToRespond`, `#chkNotifyImmediately`, `#chkNotifyOnly`, `#btCreateStep` / `#btUpdateStep` / `#btDeleteStep`).
// Dialogs: Create New Preset (`#CreateNewDialog`: `#txtCreateNewName`, `#txtCreateNewDescription`), Save As (`#SaveAsDialog`).
// Validation / errors appear as a jQuery UI dialog "Error ... OK" or an inline message under the field.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test('Preset Management: create, add and edit steps, Save As, deactivate and delete a preset', async ({ page }) => {
  test.setTimeout(480_000);
  await login(page);
  await openMenuItem(page, 'Workflow Management');
  let f: Frame = await findFrame(page, 'WorkflowManagement');
  await f.locator('#btGetWorkflows').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3000);
  await f.locator('#drpMainActions').click();
  await page.waitForTimeout(500);
  await f.locator('#actCreateWFPreset').click({ force: true });
  await page.waitForTimeout(4000);
  f = await findFrame(page, 'PresetManagement');
  await f.locator('#ddlSelectPreset').waitFor({ timeout: 15_000 });

  const stamp = Date.now().toString().slice(-6);
  const name = `MBPWPreset${stamp}`;
  const saveAs = `${name}SA`;

  const presets = async () => (await f.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim());
  const choose = async (preset: string) => {
    await f.locator('#ddlSelectPreset').selectOption({ label: preset }, { timeout: 5000 });
    await page.waitForTimeout(2200);
  };
  const dismissDialog = async (button: RegExp = /^OK$/) => {
    const d = f.locator('.ui-dialog:visible').last();
    await d.locator('.ui-dialog-buttonpane button').filter({ hasText: button }).first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
  };
  const dialogText = async () => (await f.locator('.ui-dialog:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
  const deletePreset = async (preset: string) => {
    if (!(await presets()).includes(preset)) return;
    await choose(preset);
    await f.locator('#btDeletePreset').click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    console.log(`delete confirm: ${await dialogText()}`);
    await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: /^(Yes|OK|Delete)$/ }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2200);
  };

  // leftovers from an interrupted earlier run
  for (const p of (await presets()).filter((p) => /^MBPWPreset/.test(p))) await deletePreset(p);

  try {
    await test.step('page: preset list and the Create New Preset dialog validation', async () => {
      const list = await presets();
      expect(list[0]).toBe('(Select a Preset)');
      expect(list).toEqual(expect.arrayContaining(['ROBAR Only', 'MBPreset1']));
      await f.getByRole('button', { name: 'Create New' }).click();
      await page.waitForTimeout(1200);
      const dlg = f.locator('#CreateNewDialog');
      await expect(dlg).toBeVisible();
      await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
      await page.waitForTimeout(800);
      expect(await dialogText()).toContain('Please specify a preset name.');
      // an existing name is refused (case: "ROBAR Only" exists)
      await f.locator('#txtCreateNewName').fill('ROBAR Only');
      await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
      await page.waitForTimeout(1500);
      console.log(`duplicate preset: ${await dialogText()}`);
      expect(await dialogText()).toContain('Preset already exists. Please specify a new value.');
      await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Cancel' }).first().click();
      await page.waitForTimeout(600);
    });

    await test.step(`create ${name}: it is selected, Active is on and has no steps`, async () => {
      await f.getByRole('button', { name: 'Create New' }).click();
      await page.waitForTimeout(1200);
      await f.locator('#txtCreateNewName').fill(name);
      await f.locator('#txtCreateNewDescription').fill('Playwright preset');
      await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
      await page.waitForTimeout(2500);
      expect(await presets()).toContain(name);
      await expect(f.locator('#ddlSelectPreset').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0].text)).resolves.toBe(name);
      await expect(f.locator('#chkActive')).toBeChecked();
      await expect(f.locator('#txtPresetDescription')).toHaveValue('Playwright preset');
      await expect(f.locator('#dvMainEdit'), 'the step form is hidden until Add Step').toBeHidden();
    });

    await test.step('Add Step: defaults, validation and creating two steps', async () => {
      await f.locator('#steps-container').getByText('Add Step').click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      await expect(f.locator('#lblStepEdit')).toHaveText('Add Step');
      expect(await f.locator('#drpVoteVeto option').allInnerTexts()).toEqual(['None', 'Approve', 'Reject', 'Both']);
      await expect(f.locator('#txtHoursToRespond'), 'Hours to Respond defaults to 72').toHaveValue('72');
      await expect(f.locator('#txtApprovalGroup'), 'Approval Group starts at 1').toHaveValue('1');
      await expect(f.locator('#btCreateStep')).toBeVisible();
      await expect(f.locator('#btUpdateStep')).toBeHidden();
      await expect(f.locator('#btDeleteStep')).toBeHidden();
      // no user selected -> error dialog
      await f.locator('#btCreateStep').click();
      await page.waitForTimeout(1000);
      expect(await dialogText()).toContain('User must be selected');
      await dismissDialog();

      const claude = (await f.locator('#drpUser option').allInnerTexts()).find((t) => /^Claude01 \(/.test(t.trim()));
      expect(claude, 'Claude01 is selectable as a step user').toBeTruthy();
      await f.locator('#drpUser').selectOption({ label: claude!.trim() });
      await f.locator('#txtDepartment').fill('QA');
      await f.locator('#btCreateStep').click();
      await page.waitForTimeout(2500);
      const afterOne = (await f.locator('#steps-container').innerText()).replace(/\s+/g, ' ').trim();
      console.log(`steps after one: ${afterOne}`);
      expect(afterOne).toContain('Claude01');

      // a second step: Approval Group auto-increments
      await f.locator('#steps-container').getByText('Add Step').click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      const groupDefault = await f.locator('#txtApprovalGroup').inputValue();
      console.log(`approval group default for step 2: ${groupDefault}`);
      expect(groupDefault, 'Approval Group auto-increments per new step').toBe('2');
      const mb = (await f.locator('#drpUser option').allInnerTexts()).find((t) => /^MBUser1 \(/.test(t.trim()));
      await f.locator('#drpUser').selectOption({ label: mb!.trim() });
      await f.locator('#drpVoteVeto').selectOption({ label: 'Reject' });
      await f.locator('#txtHoursToRespond').fill('24');
      await f.locator('#btCreateStep').click();
      await page.waitForTimeout(2500);
      const afterTwo = (await f.locator('#steps-container').innerText()).replace(/\s+/g, ' ').trim();
      console.log(`steps after two: ${afterTwo}`);
      expect(afterTwo).toContain('MBUser1');
    });

    await test.step('Edit Step: Update and Delete Step (with a confirmation)', async () => {
      await f.locator('#steps-container').getByText('MBUser1 (Mason Baxter)').click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      await expect(f.locator('#lblStepEdit')).toHaveText('Edit Step');
      await expect(f.locator('#btUpdateStep')).toBeVisible();
      await expect(f.locator('#btDeleteStep')).toBeVisible();
      await expect(f.locator('#btCreateStep')).toBeHidden();
      await expect(f.locator('#txtHoursToRespond')).toHaveValue('24');
      await expect(f.locator('#txtApprovalGroup')).toHaveValue('2');
      await expect(f.locator('#drpVoteVeto').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0].text)).resolves.toBe('Reject');
      await f.locator('#txtHoursToRespond').fill('48');
      await f.locator('#btUpdateStep').click();
      await page.waitForTimeout(1500);
      console.log(`update step dialog: ${await dialogText()}`);
      if ((await f.locator('.ui-dialog:visible').count()) > 0) await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: /^(Yes|OK|Update)$/ }).first().click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      await f.locator('#steps-container').getByText('MBUser1 (Mason Baxter)').click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      await expect(f.locator('#txtHoursToRespond'), 'the update persisted').toHaveValue('48');
      // Delete Step here has NO confirmation dialog (Update neither): the step disappears at once
      await f.locator('#btDeleteStep').click();
      await page.waitForTimeout(2200);
      expect(await f.locator('.ui-dialog:visible').count(), 'no confirmation dialog for Delete Step in Preset Management').toBe(0);
      const left = (await f.locator('#steps-container').innerText()).replace(/\s+/g, ' ');
      expect(left).toContain('Claude01');
      expect(left).not.toContain('MBUser1');
    });

    await test.step('Save As clones the steps into a new preset (name validated)', async () => {
      await f.getByRole('button', { name: 'Save As' }).click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      await expect(f.locator('#SaveAsDialog')).toBeVisible();
      await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
      await page.waitForTimeout(800);
      expect(await dialogText()).toContain('Please specify a preset name.');
      await f.locator('#txtSaveAsName').fill(name); // duplicate of the preset itself
      await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
      await page.waitForTimeout(1500);
      expect(await dialogText()).toContain('Preset already exists. Please specify a new value.');
      await f.locator('#txtSaveAsName').fill(saveAs);
      await f.locator('#txtSaveAsDescription').fill('Playwright Save As');
      await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
      await page.waitForTimeout(2500);
      expect(await presets()).toContain(saveAs);
      await expect(f.locator('#ddlSelectPreset').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0].text)).resolves.toBe(saveAs);
      expect(await f.locator('#steps-container').innerText(), 'the steps were cloned').toContain('Claude01');
      await expect(f.locator('#txtPresetDescription')).toHaveValue('Playwright Save As');
    });

    await test.step('description edit and the Active checkbox persist; an inactive preset stays in the list', async () => {
      // The description and Active are NOT saved on change: they go with the "Submit Changes" button (`button.button-class-long`),
      // which is DISABLED until the form is dirty (the description binding updates on blur, so Tab out of the field first).
      const submitChanges = f.locator('button.button-class-long');
      await choose(name);
      await expect(submitChanges, 'nothing changed yet').toBeDisabled();
      await f.locator('#txtPresetDescription').fill('Playwright preset (edited)');
      await f.locator('#txtPresetDescription').press('Tab');
      await expect(submitChanges).toBeEnabled({ timeout: 5000 });
      // switching presets WITHOUT submitting discards the edit
      await choose(saveAs);
      await choose(name);
      await expect(f.locator('#txtPresetDescription'), 'an unsubmitted edit is discarded').toHaveValue('Playwright preset');
      // now submit
      await f.locator('#txtPresetDescription').fill('Playwright preset (edited)');
      await f.locator('#txtPresetDescription').press('Tab');
      await submitChanges.click({ timeout: 5000 });
      await page.waitForTimeout(2200);
      console.log(`after Submit Changes: ${await dialogText()}`);
      if ((await f.locator('.ui-dialog:visible').count()) > 0) await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').first().click({ timeout: 5000 });
      await choose(saveAs);
      await choose(name);
      await expect(f.locator('#txtPresetDescription'), 'the description was saved').toHaveValue('Playwright preset (edited)');

      // deactivate: also needs Submit Changes
      await f.locator('#chkActive').uncheck();
      await expect(submitChanges).toBeEnabled({ timeout: 5000 });
      await submitChanges.click({ timeout: 5000 });
      await page.waitForTimeout(2200);
      if ((await f.locator('.ui-dialog:visible').count()) > 0) await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').first().click({ timeout: 5000 });
      await choose(saveAs);
      await choose(name);
      await expect(f.locator('#chkActive'), 'Active=off persisted').not.toBeChecked();
      expect(await presets(), 'an inactive preset is still listed').toContain(name);
      const option = f.locator('#ddlSelectPreset option').filter({ hasText: new RegExp('^' + name + '$') });
      await expect(option, 'an inactive preset option carries the is-inactive class (greyed)').toHaveClass(/is-inactive/);
      await f.locator('#chkActive').check();
      await submitChanges.click({ timeout: 5000 });
      await page.waitForTimeout(2200);
      if ((await f.locator('.ui-dialog:visible').count()) > 0) await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').first().click({ timeout: 5000 });
    });
  } finally {
    await test.step('cleanup: delete the throw-away presets', async () => {
      f = await findFrame(page, 'PresetManagement');
      await deletePreset(saveAs);
      await deletePreset(name);
      for (const p of (await presets()).filter((p) => /^MBPWPreset/.test(p))) await deletePreset(p);
      expect((await presets()).filter((p) => /^MBPWPreset/.test(p))).toEqual([]);
    });
  }
});
