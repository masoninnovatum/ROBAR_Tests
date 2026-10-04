// Cross-module daily-workflow flow, all in ONE continuous ROBAR session (single login): create
// and approve a brand-new Template (Template Management) -> create and approve a Campaign Manager
// Item using that template -> assign the item a Label Control Number (Label Control). This mirrors
// the real daily workflow the user performs manually, piece by piece, as each piece gets explored
// and proven live. Part 1 is a byte-for-byte reuse of Create_and_Approve_Template.spec.ts's own
// proven BarTender/Sentinel flow. Part 2 reuses Create_Approved_Item.spec.ts's own proven flow,
// pointed at the template just created in Part 1 instead of the fixed 'A1SuperTemplate' fixture.
// Part 3 reuses Label-Control/Assign_Control_Number.spec.ts's own proven flow, pointed at the item
// just created in Part 2 instead of creating a fresh one of its own.
//
// Three real infrastructure gotchas were found and fixed getting Parts 1-2 reliable (see
// robar-module-reference.md's "Driving BarTender/Sentinel native dialogs" playbook, items 10-11,
// and "WebMenu-wide issues" for the full history -- condensed here to what maintaining this file
// needs):
// 1. WebMenu's own session-inactivity timeout only resets on a literal mousemove, never fires from
//    inside a nested iframe, and a slow BarTender round trip can exceed it -- keepAliveInterval
//    below calls the page's own RefreshTimeout() directly via page.evaluate on the top-level page.
// 2. flaui.listProcesses() silently filters to only processes with a non-empty MainWindowTitle, so
//    a just-spawned process without one yet is invisible to it no matter how long you poll --
//    findProcessIdByName checks by process name directly via PowerShell instead.
// 3. flaui.clickAt's SendInput click can report success while landing on a different window
//    entirely (whatever is physically topmost at that screen pixel) -- bringWindowToForeground
//    forces the real target window up first, and the confirm-click loop verifies the dialog is
//    actually gone afterward rather than trusting the click result alone.
// Confirmed reliable: 3 consecutive clean runs, ~1.1-1.3 minutes each, after these fixes landed.
//
// Part 3's own gotchas (filter-scope reset, the Add Filter click target, the async-job re-query
// pattern) are documented in full in the standalone Assign_Control_Number.spec.ts header -- not
// repeated here. Part 3 needs no BarTender/native automation at all; headed mode is only required
// because of Part 1.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as flaui from '../../scripts/flaui_bridge';
import * as bartender from '../support/bartender';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function findProcessIdByName(name: string): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `(Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id)`,
    ]);
    const pid = parseInt(stdout.trim(), 10);
    return Number.isFinite(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}

async function bringWindowToForeground(pid: number): Promise<void> {
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class FgWin {
      [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
      [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@ -ErrorAction SilentlyContinue
    $p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
    if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
      [FgWin]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
      [FgWin]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
    }
    `,
  ]).catch(() => {});
}

test.use({ headless: false });

test('create and approve a new template, create and approve an item using it, and assign it a Label Control Number', async ({ page }, testInfo) => {
  test.setTimeout(600_000);

  await login(page);

  const templateName = 'MBCombo' + Math.floor(Math.random() * 100000);

  await test.step('Part 1: create and approve the template (Template Management)', async () => {
    await openMenuItem(page, 'Template Management');
    const frame = await findFrame(page, 'TemplateManagement');

    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', 'Created via Playwright cross-module test');
    await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    await frame.setInputFiles('#newFileInput', String.raw`\\vmsrvtst703\BaseTemplates\NewTemplate.btw`);
    await page.waitForTimeout(500);

    const [createResponse, tokenResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      frame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
    ]);

    const createBody = await createResponse.json();
    const tokenBody = await tokenResponse.json();
    expect(createBody.Success, `CreateNewTemplate failed: ${JSON.stringify(createBody)}`).toBe(true);
    expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();

    const browserPid = await test.step('resolve Playwright\'s own browser process id', async () => {
      const pageTitle = await page.title();
      const candidates = await flaui.listProcesses('chrom');
      const browserProcess = candidates.find(
        (p: { mainWindowTitle: string }) => p.mainWindowTitle.includes(pageTitle) && p.mainWindowTitle.includes('for Testing')
      );
      if (!browserProcess) {
        throw new Error(`Could not find Playwright's own browser process (looked for a "chrome ... for Testing" window titled "${pageTitle}")`);
      }
      return browserProcess.pid;
    });

    await test.step('confirm the native "Open SentinelLauncher?" prompt', async () => {
      let confirmed = false;
      for (let attempt = 0; attempt < 30 && !confirmed; attempt++) {
        await bringWindowToForeground(browserPid);
        await page.waitForTimeout(200);
        await flaui.clickAt({ processId: browserPid, name: 'Open SentinelLauncher', offsetX: 20, offsetY: 14 });
        await page.waitForTimeout(300);
        const tree = await flaui.dumpTree({ processId: browserPid, maxDepth: 20 }).catch((e: unknown) => ({ error: String(e) }));
        const treeStr = typeof tree === 'string' ? tree : JSON.stringify(tree);
        if (!/Open SentinelLauncher\?/.test(treeStr)) {
          confirmed = true;
        } else {
          await page.waitForTimeout(500);
        }
      }
      if (!confirmed) {
        throw new Error('Never confirmed the "Open SentinelLauncher?" prompt closed after repeated foreground+click attempts.');
      }
    });

    const bartenderPid = await test.step('find the BarTender process Sentinel launches', async () => {
      let found: number | undefined;
      for (let attempt = 0; attempt < 90 && !found; attempt++) {
        await page.waitForTimeout(1000);
        found = await findProcessIdByName('Innovatum.Sentinel.Plugin.BarTenderEdit');
      }
      if (!found) {
        throw new Error('BarTender/Sentinel process never appeared after confirming the launch prompt.');
      }
      return found;
    });

    async function untilValue<T extends { error?: string }>(
      description: string,
      action: () => Promise<T>,
      { attempts = 30, delayMs = 1000 }: { attempts?: number; delayMs?: number } = {}
    ): Promise<T> {
      let lastError: string | undefined;
      for (let i = 0; i < attempts; i++) {
        const result = await action();
        if (!result.error) return result;
        lastError = result.error;
        await page.waitForTimeout(delayMs);
      }
      throw new Error(`Gave up after ${attempts} attempts: ${description}. Last error: ${lastError}`);
    }
    async function until(
      description: string,
      action: () => Promise<{ error?: string }>,
      opts?: { attempts?: number; delayMs?: number }
    ): Promise<void> {
      await untilValue(description, action, opts);
    }

    const keepAliveInterval = setInterval(() => {
      page.evaluate(() => {
        const w = window as unknown as { RefreshTimeout?: () => void };
        if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout();
      }).catch(() => {});
    }, 120_000);

    await test.step('configure and approve the template in BarTender via FlaUI', async () => {
      await flaui.waitWindow({ processId: bartenderPid, title: 'Template Editor', timeoutSeconds: 60 });

      await until('wait for BarTender\'s toolbar to report ready (Text MenuItem enabled)', () =>
        flaui.getProperty({ processId: bartenderPid, name: 'Text', property: 'IsEnabled', controlType: 'MenuItem', retrySeconds: 150, expectValue: 'True' }),
        { attempts: 1 }
      );

      await until('click the "Text" object-creation MenuItem', () =>
        flaui.click({ processId: bartenderPid, name: 'Text', controlType: 'MenuItem', retrySeconds: 30 }),
        { attempts: 1 }
      );
      await page.waitForTimeout(300);
      await flaui.sendKeys({ keys: ['RETURN'] });

      const workspaceRect = await untilValue('read the Workspace canvas BoundingRectangle', () =>
        flaui.getProperty({ processId: bartenderPid, name: 'Workspace', property: 'BoundingRectangle' })
      );
      const centerX = Math.round(workspaceRect.value.Width / 2);
      const centerY = Math.round(workspaceRect.value.Height / 2);
      await until('drag to place the text object on the label', () =>
        flaui.drag({
          processId: bartenderPid,
          name: 'Workspace',
          fromOffsetX: centerX,
          fromOffsetY: centerY,
          toOffsetX: centerX + 100,
          toOffsetY: centerY + 30,
          retrySeconds: 30,
        }),
        { attempts: 1 }
      );

      await until('center the text object horizontally on the template', () =>
        flaui.click({ processId: bartenderPid, name: 'Center Horizontally On Template', retrySeconds: 30 }),
        { attempts: 1 }
      );
      await until('center the text object vertically on the template', () =>
        flaui.click({ processId: bartenderPid, name: 'Center Vertically On Template', retrySeconds: 30 }),
        { attempts: 1 }
      );

      await until('open the Edit menu', () =>
        flaui.click({ processId: bartenderPid, name: 'Edit', controlType: 'MenuItem', retrySeconds: 15 }),
        { attempts: 1 }
      );
      await until('click "Properties..." in the Edit menu', () =>
        flaui.click({ processId: bartenderPid, name: 'Properties...', retrySeconds: 30 }),
        { attempts: 1 }
      );

      const dataSourceName = 'I_Num';
      await until('open the Change Data Source Name Wizard', () =>
        flaui.click({ processId: bartenderPid, elementName: 'Text Properties', name: '<none>', automationId: '5109', retrySeconds: 30 }),
        { attempts: 1 }
      );
      await until('type the new data source name', () =>
        flaui.setText({
          processId: bartenderPid,
          elementName: 'Change Data Source Name Wizard',
          name: 'Name:',
          automationId: '2308',
          controlType: 'Edit',
          value: dataSourceName,
          retrySeconds: 30,
        }),
        { attempts: 1 }
      );
      await until('confirm the wizard with OK', () =>
        flaui.click({ processId: bartenderPid, elementName: 'Change Data Source Name Wizard', name: 'OK', automationId: '1', retrySeconds: 30 }),
        { attempts: 1 }
      );
      await until('close the Text Properties dialog', () =>
        flaui.click({ processId: bartenderPid, elementName: 'Text Properties', name: 'Close', automationId: '1', retrySeconds: 30 }),
        { attempts: 1 }
      );

      // Evidence: BarTender's View > Data Source Names overlay shows the sharename each text box is
      // bound to, right on the label. Attached to the Playwright report; the helper turns the
      // overlay back off afterwards.
      const dsnShot = testInfo.outputPath('template_data_source_names.png');
      await bartender.captureDataSourceNames(page, bartenderPid, dsnShot);
      await testInfo.attach('BarTender View > Data Source Names', { path: dsnShot, contentType: 'image/png' });

      await until('click Save', () =>
        flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Save', automationId: 'btnSave', retrySeconds: 30 }),
        { attempts: 1 }
      );

      await until('click Approve', () =>
        flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Approve', automationId: 'btnApprove', method: 'mouse' })
      );
      await page.waitForTimeout(1000);
      await until('fill User in the Signature Required dialog', () =>
        flaui.setText({ processId: bartenderPid, elementName: 'Signature Required', name: 'txtUser', automationId: 'txtUser', value: USERNAME, retrySeconds: 60, verify: true, method: 'win32' }),
        { attempts: 1 }
      );
      await until('fill Password in the Signature Required dialog', () =>
        flaui.setText({ processId: bartenderPid, elementName: 'Signature Required', name: 'txtPassword', automationId: 'txtPassword', value: PASSWORD, retrySeconds: 30, verify: true, method: 'win32' }),
        { attempts: 1 }
      );
      await until('submit the Signature Required dialog', () =>
        flaui.click({ processId: bartenderPid, elementName: 'Signature Required', name: 'Submit', automationId: 'btnSubmit', method: 'mouse' }),
        { attempts: 1 }
      );

      await until('click Close Tab on the Template Editor', () =>
        flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Close Tab', automationId: 'btnCloseTab', method: 'mouse' })
      );
    });

    // Bounded explicitly (was frame.waitForLoadState('networkidle') with no timeout -- took ~559s
    // on one run; something on this grid keeps polling after the BarTender tab closes, so true
    // networkidle rarely settles quickly and a brief pause is all that's actually needed). Keep the
    // session keep-alive running through this wait, not just the BarTender step above -- this is
    // the one stretch that's actually slow enough to risk the session timing out.
    // Wait until BarTender and the Sentinel plugin have FULLY closed (not just the Close Tab click) and raise the browser --
    // otherwise Part 2's page can end up hidden behind a still-closing BarTender window (seen live 2026-10-04).
    expect(await bartender.waitForBartenderClosed(page), 'BarTender / Sentinel BarTenderEdit have closed').toBe(true);
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    clearInterval(keepAliveInterval);
    await page.waitForTimeout(1000);

    await page.locator('li.ui-tabs-tab:has-text("Template Management") .ui-icon-close').click();
  });

  const itemNumber = 'MBComboItm' + Date.now().toString().slice(-6);

  await test.step('Part 2: create and approve a Campaign Manager item using that template', async () => {
    await openMenuItem(page, 'Campaign Manager');
    const cmFrame = await findFrame(page, 'campaignmanager');
    await page.waitForTimeout(1000);

    await cmFrame.click('#btnCreateNew');
    await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible' });
    await cmFrame.fill('#txtItemNumber', itemNumber);
    await cmFrame.selectOption('#ddlLabelType', 'Carton Label');
    await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');

    const editFrame = await findFrame(page, 'items/edit');
    await editFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    // Confirms the template from Part 1 is genuinely usable -- the Template dropdown lists ALL
    // templates regardless of approval status, so this is a query-free check unaffected by the
    // account's own grid filter-scope state (see feedback_filter_scope_reset.md memory).
    const templateOptions = await editFrame.locator('select[name="txtTemplateName"] option').allTextContents();
    expect(templateOptions, `Template "${templateName}" not found in the Template dropdown`).toContain(templateName);

    await editFrame.selectOption('select[name="txtTemplateName"]', templateName);
    await editFrame.fill('input[name="txtDescription"]', 'Playwright cross-module test item');

    const [saveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/') && r.request().method() === 'POST', { timeout: 15_000 }),
      editFrame.click('button:has-text("Save")'),
    ]);
    expect(saveResponse.status()).toBe(200);
    await page.waitForTimeout(1000);

    await editFrame.click('text=Actions');
    await editFrame.click('text=Approve Item');
    await page.waitForTimeout(500);

    const approveDialog = editFrame.locator('#approveItemDialog');
    await approveDialog.locator('#sigUser').fill(USERNAME);
    await approveDialog.locator('#sigPassword').fill(PASSWORD);
    await approveDialog.locator('#sigComments').fill('Approved by Playwright cross-module test');

    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
      editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
    ]);
    const approveBody = await approveResponse.json();
    expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

    const finalFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
    await finalFrame.waitForLoadState('networkidle').catch(() => {});

    const approvedStatus = finalFrame.locator('span[data-bind*="approvedStatus"]');
    await expect(approvedStatus).not.toHaveText('Unapproved');
    await expect(approvedStatus).toContainText(USERNAME, { ignoreCase: true });

    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click();
    await page.waitForTimeout(500);
  });

  async function openLabelControlAndQuery(): Promise<Frame> {
    await openMenuItem(page, 'Label Control');
    let lcFrame = await findFrame(page, 'LabelControl/Management');
    await lcFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);

    await lcFrame.click('#btnReset');
    await page.waitForTimeout(1500);
    lcFrame = await findFrame(page, 'LabelControl/Management');
    await lcFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);

    await lcFrame.locator('#drpApproved').selectOption({ label: 'All (LCN Status)' });
    await lcFrame.locator('#drpAttachments').selectOption({ label: 'Any (Attachments)' });
    await lcFrame.locator('#drpLabelMaster').selectOption({ label: 'Any (Label Masters)' });

    await lcFrame.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(500);

    await lcFrame.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
    await lcFrame.locator("select[name$='Operator']").first().selectOption('ExactlyMatches');
    await lcFrame.locator("input[name$='Value']").first().fill(itemNumber);

    await lcFrame.click('#btnRetrieveData');
    await lcFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return lcFrame;
  }

  await test.step('Part 3: assign the item a Label Control Number (Label Control)', async () => {
    const lcFrame = await openLabelControlAndQuery();

    const row = lcFrame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row, `Item ${itemNumber} not found in Label Control grid`).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await lcFrame.click('#drpActions');
    await page.waitForTimeout(300);
    await lcFrame.click('#actAssignLabelControl', { force: true });

    const jobFrame = await findFrame(page, 'MassAssign/JobSubmission');
    await jobFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    const previewText = await jobFrame.locator('body').innerText();
    expect(previewText, 'No "Starting Control Number" preview shown before submit').toContain('Starting Control Number');
    const previewMatch = previewText.match(/Starting Control Number:\s*(LCN\d+)/);
    const expectedLcn = previewMatch?.[1];
    expect(expectedLcn, `Could not parse an LCN out of the preview text: ${previewText}`).toBeTruthy();

    await jobFrame.fill('#txtJobDescription', 'Playwright cross-module test -- Assign Control Number');
    await jobFrame.fill('#sigUser', USERNAME);
    await jobFrame.fill('#sigPassword', PASSWORD);
    await jobFrame.selectOption('#sigReason', { label: 'General' });
    await jobFrame.fill('#sigComments', 'Assigned by Playwright cross-module test');

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn'),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    const detailFrame = await findFrame(page, 'MassAssign/JobDetail');
    await detailFrame.waitForLoadState('networkidle').catch(() => {});

    // Async job -- the LCN appears in the grid a few seconds after Job Detail first renders. Open Label Control and query ONCE,
    // then keep pressing Retrieve in that same module instance until the LCN shows up (no closing/reopening the module).
    await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();

    let frame2 = await openLabelControlAndQuery();
    let finalLcn: string | undefined;
    for (let attempt = 0; attempt < 30 && !finalLcn; attempt++) {
      const text2 = await frame2.locator('#grdLabelControl tr').filter({ hasText: itemNumber }).innerText().catch(() => '');
      finalLcn = text2.match(/LCN\d+/)?.[0];
      if (!finalLcn) {
        await page.waitForTimeout(3000);
        await frame2.click('#btnRetrieveData');
        await frame2.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1000);
        frame2 = await findFrame(page, 'LabelControl/Management');
      }
    }

    expect(finalLcn, `Item ${itemNumber} never showed an assigned LCN in the grid`).toBe(expectedLcn);
  });
});
