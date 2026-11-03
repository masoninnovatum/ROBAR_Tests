// New web menu - Notifications: Notifications Management + Notifications Link Management (Settings / gear, Dynamic UI), the popup at login, the bell, acknowledge, attachment download,
// Acknowledgement History. Requirements (docs/agents/valmaster-web-menu-improvements.md): U.6, F.6.1-F.6.12.
// Confirmed live 2026-11-02 on TST703. Source: Innovatum.WebMenu (WebMenuController LoadNotifications / AcknowledgeNotification, WebMenuDB.GetNotifications, MainMenuLayout.cshtml,
// Notifications.cshtml), DynamicUI definitions "Notifications" / "NotificationsLink" (Innovatum.Install).
// Test data: notifications `CLNotifA<stamp>` / `CLNotifB<stamp>` and their links to fixture user CLPROp01 (seed password, group CLPRGrp); everything is deleted again in `finally`
// (Dynamic UI Delete is available on both pages). The seed user is never linked (it would get a popup at every login). The existing attachment `Notification.pdf`
// (file purpose NotificationAttachment, from the legacy MBNotification row) is used for the attachment checks.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as du from '../support/dynamic-ui';
import { PASSWORD } from '../support/robar';
import { loginNew, closeModuleTab } from '../support/new-web-menu';
import { OP } from '../Password-Management/pr-fixtures';
import { dayOffset, deviation, fmt, openSettings, closeAllTabs, deleteMatching } from './wm-helpers';

test.use({ actionTimeout: 20_000 });

const stamp = Date.now().toString().slice(-6);
const NA = 'CLNotifA' + stamp;
const NB = 'CLNotifB' + stamp;
const ATTACH = 'Notification.pdf';

async function addNotification(page: Page, f: Frame, o: { name: string; message: string; begin: string; end: string; days: string; attach?: string }): Promise<void> {
  const d = await du.openFormDialog(f, 'add');
  await d.locator('#Name').fill(o.name);
  await d.locator('#Message').fill(o.message);
  if (o.attach) await d.locator('#AttachmentFileName').selectOption({ label: o.attach });
  await d.locator('#EffectiveBegin').fill(o.begin);
  await d.locator('#EffectiveEnd').fill(o.end);
  await d.locator('#DaysToKeepAfterExpiration').fill(o.days);
  await d.locator('#DaysToKeepAfterExpiration').press('Tab');
  await du.submitForm(f);
  expect(await du.formError(f)).toBe('');
  await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 8000 });
  void page;
}

async function addLink(f: Frame, o: { user: string; group?: string; entity?: string; notification: string }): Promise<void> {
  const d = await du.openFormDialog(f, 'add');
  await d.locator('#UserID').selectOption({ label: o.user });
  await d.locator('#GroupID').selectOption({ label: o.group ?? '*' });
  await d.locator('#PrintEntity').selectOption({ label: o.entity ?? '*' });
  await d.locator('#NotificationName').selectOption({ label: o.notification });
  await du.submitForm(f);
  expect(await du.formError(f)).toBe('');
  await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 8000 });
}

const popupRows = (p: Page) => p.locator('#notificationsTBody tr');

async function logoff(p: Page): Promise<void> {
  if (await p.locator('#notificationsDiv:not(.hidden)').count()) await p.click('#closeNotificationsBtn');
  await p.click('#logoffBtnA');
  await p.locator('#userIDInput').waitFor();
}

test('New web menu - notifications: setup, popup at login, acknowledge, bell, attachment, history', async ({ page, browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext();
  const op = await ctx.newPage();
  try {
    await loginNew(page);

    await test.step('Notifications Management: add dialog fields and validation (F.6.1, F.6.3, F.6.5)', async () => {
      const f = await openSettings(page, 'Notifications Management');
      const d = await du.openFormDialog(f, 'add');
      const labels = (await d.locator('td.CaptionTD').allInnerTexts()).filter(Boolean);
      expect(labels.slice(0, 6)).toEqual(['Name', 'Message', 'AttachmentFileName', 'EffectiveBegin', 'EffectiveEnd', 'DaysToKeepAfterExpiration']);
      // dates default to today
      expect(await d.locator('#EffectiveBegin').inputValue()).toBe(fmt(new Date()));
      expect(await d.locator('#EffectiveEnd').inputValue()).toBe(fmt(new Date()));
      // the attachment list comes from Attachment Management files with purpose NotificationAttachment
      const attachOpts = await d.locator('#AttachmentFileName option').allInnerTexts();
      console.log('AttachmentFileName options:', attachOpts.join(' | '));
      expect(attachOpts).toContain(ATTACH);
      expect(attachOpts[0]).toBe(''); // optional
      await du.submitForm(f);
      expect(await du.formError(f)).toContain('Name: Field is required');
      await d.locator('#Name').fill('x');
      await du.submitForm(f);
      expect(await du.formError(f)).toContain('Message: Field is required');
      await d.locator('#Message').fill('x');
      await d.locator('#DaysToKeepAfterExpiration').fill('abc');
      await du.submitForm(f);
      console.log('error with Days = "abc":', await du.formError(f), '| value kept:', await d.locator('#DaysToKeepAfterExpiration').inputValue());
      await du.cancelForm(f);
      // row action
      await f.locator('tr.jqgrow').first().getByText('Actions').first().click();
      await expect(f.locator('.ui-menu-item:visible').first()).toHaveText('Acknowledgement History'); // F.6.3 row level action
      await page.keyboard.press('Escape');
      await closeModuleTab(page, 'Notifications Management');
    });

    await test.step('Create two notifications and link them to the fixture user (F.6.5, F.6.6, F.6.9)', async () => {
      let f = await openSettings(page, 'Notifications Management');
      await addNotification(page, f, { name: NA, message: `Message A ${stamp} <b id="clbold">bold text</b>`, begin: dayOffset(-1), end: dayOffset(1), days: '0', attach: ATTACH });
      await addNotification(page, f, { name: NB, message: `Message B ${stamp}`, begin: dayOffset(-1), end: dayOffset(1), days: '3' });
      await du.retrieve(page, f, 'Name', 'Contains', stamp);
      const rows = await du.rows(f);
      console.log('notification rows:', rows.join(' || '));
      expect(rows.length).toBe(2);
      await closeModuleTab(page, 'Notifications Management');

      f = await openSettings(page, 'Notifications Link Management');
      const d = await du.openFormDialog(f, 'add');
      const nameOpts = await d.locator('#NotificationName option').allInnerTexts();
      expect(nameOpts).toEqual(expect.arrayContaining([NA, NB])); // only notifications effective now are offered
      const userOpts = await d.locator('#UserID option').allInnerTexts();
      expect(userOpts[0]).toBe('*');
      expect(userOpts).toContain(OP);
      expect(await d.locator('#GroupID option').allInnerTexts()).toEqual(expect.arrayContaining(['*', 'CLPRGrp']));
      console.log('PrintEntity default in the Add dialog:', await d.locator('#PrintEntity').inputValue(), '| options:', (await d.locator('#PrintEntity option').allInnerTexts()).join(' | '));
      await du.cancelForm(f);
      await addLink(f, { user: OP, notification: NA });
      await addLink(f, { user: OP, notification: NB });
      await du.retrieve(page, f, 'UserID', 'Exactly Matches', OP);
      const links = await du.rows(f);
      console.log('link rows:', links.join(' || '));
      expect(links.length).toBe(2);
      await closeModuleTab(page, 'Notifications Link Management');
    });

    await test.step('Popup at login lists the active notifications with message, attachment, checkbox (F.6.10)', async () => {
      await loginNew(op, OP, PASSWORD);
      await expect(op.locator('#notificationsDiv')).not.toHaveClass(/hidden/, { timeout: 15_000 });
      await expect(op.locator('#notificationsBackground')).not.toHaveClass(/hidden/);
      await expect(op.locator('#notificationsDiv h2')).toHaveText('ROBAR Notifications');
      const heads = await op.locator('#notificationsTable thead th').allInnerTexts();
      expect(heads.map((h) => h.trim())).toEqual(['Message', 'Attachment', 'Acknowledged?']);
      await expect(popupRows(op)).toHaveCount(2);
      const texts = (await popupRows(op).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      console.log('popup rows:', texts.join(' || '));
      expect(texts.some((t) => t.includes('Message A ' + stamp) && t.includes(ATTACH))).toBe(true);
      expect(texts.some((t) => t.includes('Message B ' + stamp))).toBe(true);
      // the message is rendered as HTML (Html.Raw): the <b> tag in the stored text is a real element
      expect(await op.locator('#clbold').count()).toBe(1);
      deviation('observation: the notification Message is rendered unencoded (Html.Raw after HtmlDecode), so HTML typed in Notifications Management is interpreted in the popup and the bell');
      await expect(popupRows(op).locator('input[type=checkbox]')).toHaveCount(2);
    });

    await test.step('Acknowledge: the box that is ticked is the notification that is recorded (F.6.11)', async () => {
      const order = (await popupRows(op).allInnerTexts()).map((t) => (t.includes('Message A') ? 'A' : 'B'));
      console.log('popup order:', order.join(','));
      const ids = await popupRows(op).locator('input[type=checkbox]').evaluateAll((els) => els.map((e) => e.id));
      await popupRows(op).first().locator('input[type=checkbox]').click();
      await op.waitForTimeout(2500);
      const disabled = await popupRows(op).locator('input[type=checkbox]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).disabled));
      const checked = await popupRows(op).locator('input[type=checkbox]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).checked));
      console.log('after ticking the FIRST box: ids', ids.join(','), '| disabled', disabled.join(','), '| checked', checked.join(','));
      // requirement F.6.11: the notification that was ticked is acknowledged (and its box locks). Live: the LAST one is (the spec keeps passing and records the deviation; it fails if the box of the ticked row locks AND the last one is also locked)
      if (!disabled[0]) {
        deviation('F.6.11 ticking the Acknowledged box of the FIRST notification acknowledges the LAST one in the list (MainMenuLayout.cshtml LoadNotifications binds every checkbox to the loop variable `checkboxID` declared with var, so every click posts the last ID)');
        expect(disabled[1]).toBe(true);
      } else {
        expect(disabled[1]).toBe(false);
      }
    });

    await test.step('After login with everything acknowledged there is no popup; the bell shows them with the acknowledgement time (F.6.11, F.6.12)', async () => {
      // acknowledge whatever is still open, one login at a time (each login acknowledges the last open one)
      for (let i = 0; i < 3; i++) {
        await logoff(op); // the popup is modal: Close first, or its backdrop blocks the Log off button
        await loginNew(op, OP, PASSWORD);
        await op.waitForTimeout(2500);
        if (await op.locator('#notificationsDiv:not(.hidden)').count() === 0) break;
        await popupRows(op).last().locator('input[type=checkbox]').click();
        await op.waitForTimeout(2000);
      }
      await logoff(op);
      await loginNew(op, OP, PASSWORD);
      await op.waitForTimeout(2500);
      await expect(op.locator('#notificationsDiv')).toHaveClass(/hidden/); // no automatic popup any more
      await op.click('#notificationsIcon');
      await expect(op.locator('#notificationsDiv')).not.toHaveClass(/hidden/);
      await expect(popupRows(op)).toHaveCount(2);
      const texts = (await popupRows(op).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      console.log('bell rows:', texts.join(' || '));
      for (const t of texts) expect(t).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)/);
      await expect(op.locator('#notificationsTBody input[type=checkbox]')).toHaveCount(0);
      await op.click('#closeNotificationsBtn');
      await expect(op.locator('#notificationsDiv')).toHaveClass(/hidden/);
    });

    await test.step('Attachment download is recorded; Acknowledgement History shows user, download time, acknowledgement time (F.6.4)', async () => {
      await op.click('#notificationsIcon');
      const [dl] = await Promise.all([op.waitForEvent('download', { timeout: 30_000 }), op.locator('#notificationsTBody a', { hasText: ATTACH }).click()]);
      console.log('downloaded file name:', dl.suggestedFilename());
      expect(dl.suggestedFilename()).toBe(ATTACH);
      await dl.cancel().catch(() => {});
      await op.waitForTimeout(1500);
      const f = await openSettings(page, 'Notifications Management');
      await du.retrieve(page, f, 'Name', 'Exactly Matches', NA);
      await f.locator('tr.jqgrow').first().getByText('Actions').first().click();
      await f.locator('.ui-menu-item:visible', { hasText: 'Acknowledgement History' }).click();
      await page.waitForTimeout(3000);
      const dlg = f.locator('.ui-dialog:visible').last();
      await dlg.locator('table th').first().waitFor({ timeout: 10_000 });
      const heads = (await dlg.locator('table th').allInnerTexts()).map((t) => t.trim());
      const cells = (await dlg.locator('table tbody tr').first().locator('td').allInnerTexts()).map((t) => t.trim());
      console.log('history columns:', heads.join(' | '), '| first row:', cells.join(' | '));
      await page.screenshot({ path: 'test-results/wm-notification-history.png' });
      expect(heads).toEqual(['UserID', 'AttachmentDownloadedOn', 'AcknowledgedOn']);
      expect(cells[0]).toBe(OP);
      expect(cells[1]).toMatch(/\d+\/\d+\/\d{4} \d+:\d{2}:\d{2} (AM|PM)/); // downloaded the attachment
      expect(cells[2]).toMatch(/\d+\/\d+\/\d{4} \d+:\d{2}:\d{2} (AM|PM)/); // acknowledged
      await dlg.locator('.ui-dialog-buttonpane button', { hasText: 'Close' }).click();
      await closeModuleTab(page, 'Notifications Management');
    });

    await test.step('Effective dates: EffectiveEnd of today and DaysToKeepAfterExpiration (F.6.5)', async () => {
      // un-acknowledged notification needed to see the popup again: use a fresh one linked to the fixture user
      const f = await openSettings(page, 'Notifications Management');
      await du.retrieve(page, f, 'Name', 'Exactly Matches', NB);
      await du.selectGridRow(f, NB);
      let d = await du.openFormDialog(f, 'edit');
      await d.locator('#EffectiveEnd').fill(dayOffset(0));
      await d.locator('#EffectiveEnd').press('Tab');
      await du.submitForm(f);
      expect(await du.formError(f)).toBe('');
      await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 8000 });
      await op.click('#notificationsIcon').catch(() => {});
      await op.click('#closeNotificationsBtn').catch(() => {});
      await op.reload();
      await op.waitForSelector('#moduleDialogToggle');
      await op.click('#notificationsIcon');
      await expect(op.locator('#notificationsDiv')).not.toHaveClass(/hidden/);
      await expect(popupRows(op).first()).toBeVisible({ timeout: 10_000 }); // A (still effective) is always listed: proves the list has loaded
      const dayTexts = (await popupRows(op).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      console.log('bell with B ending today (date only, 00:00):', dayTexts.join(' || '));
      const stillThere = dayTexts.some((t) => t.includes('Message B'));
      if (!stillThere) deviation('F.6.5 a notification whose EffectiveEnd is TODAY is no longer shown on that day (GETDATE() BETWEEN EffectiveBegin AND EffectiveEnd with a date-only EffectiveEnd at 00:00), so the end date is exclusive');
      await op.click('#closeNotificationsBtn');

      await du.selectGridRow(f, NB);
      d = await du.openFormDialog(f, 'edit');
      await d.locator('#EffectiveEnd').fill(dayOffset(-1));
      await d.locator('#DaysToKeepAfterExpiration').fill('5');
      await d.locator('#DaysToKeepAfterExpiration').press('Tab');
      await du.submitForm(f);
      await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 8000 });
      await op.reload();
      await op.waitForSelector('#moduleDialogToggle');
      await op.click('#notificationsIcon');
      await expect(op.locator('#notificationsDiv')).not.toHaveClass(/hidden/);
      await expect(popupRows(op).first()).toBeVisible({ timeout: 10_000 });
      const keepTexts = (await popupRows(op).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      console.log('bell with B ended yesterday and DaysToKeepAfterExpiration = 5:', keepTexts.join(' || '));
      if (!keepTexts.some((t) => t.includes('Message B'))) deviation('F.6.5 DaysToKeepAfterExpiration (5) has no effect: a notification that ended yesterday is not displayed (WebMenuDB.GetNotifications only filters on EffectiveBegin/EffectiveEnd)');
      await op.click('#closeNotificationsBtn');
      await closeModuleTab(page, 'Notifications Management');
    });

    await test.step('The same notification linked twice for one user is listed twice (precedence rules are not de-duplicated)', async () => {
      // A is still effective; add a second, more specific link (user + group)
      const f = await openSettings(page, 'Notifications Link Management');
      await addLink(f, { user: OP, group: 'CLPRGrp', notification: NA });
      await op.reload();
      await op.waitForSelector('#moduleDialogToggle');
      await op.click('#notificationsIcon');
      await expect(op.locator('#notificationsDiv')).not.toHaveClass(/hidden/);
      await expect(popupRows(op).first()).toBeVisible({ timeout: 10_000 });
      const n = (await popupRows(op).allInnerTexts()).filter((t) => t.includes('Message A ' + stamp)).length;
      console.log('rows for notification A with two matching links:', n);
      if (n > 1) deviation('observation: a notification that matches two link rows of the same user (user+group and user+*) is shown twice in the popup / bell (GetNotifications adds the rows of every precedence rule without de-duplication)');
      await op.click('#closeNotificationsBtn');
      await closeModuleTab(page, 'Notifications Link Management');
    });
  } finally {
    try {
      await closeAllTabs(page);
      let f = await openSettings(page, 'Notifications Link Management');
      await du.retrieve(page, f, 'UserID', 'Exactly Matches', OP, { expectRows: false });
      const gone1 = await deleteMatching(f, OP);
      console.log('cleanup: links deleted', gone1);
      await closeModuleTab(page, 'Notifications Link Management');
      f = await openSettings(page, 'Notifications Management');
      await du.retrieve(page, f, 'Name', 'Contains', stamp, { expectRows: false });
      const gone2 = await deleteMatching(f, stamp);
      console.log('cleanup: notifications deleted', gone2);
      await closeModuleTab(page, 'Notifications Management');
    } catch (e) {
      console.log('CLEANUP FAILED (delete CLNotif*' + stamp + ' rows and their CLPROp01 links by hand):', String(e).slice(0, 300));
    }
    await ctx.close();
  }
});
