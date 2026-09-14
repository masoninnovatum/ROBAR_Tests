// New Record (MDM_New_Record21.1) -- first Master Data Management test in this suite.
//
// Pure web/DOM -- no BarTender/FlaUI involved anywhere in this test, unlike Template Management's
// New Record analog. Live-confirmed (2026-09-14) via direct MCP browser exploration before writing
// this test rather than guessing selectors -- see robar-module-reference.md's "Master Data
// Management" section for the full exploration notes and gotchas.
//
// Schema and item number are configurable via seed.ts (ROBAR_MDM_SCHEMA / ROBAR_MDM_ITEM_NUMBER),
// defaulting to the pre-existing "RobarMasterData" item schema fixture and a randomly generated
// item number, matching how template/item names are generated elsewhere in this suite. The
// non-item-schema half of this test still uses the separate MBNonItemSchema fixture directly
// (not mentioned as needing to be configurable) -- schema creation/editing itself is its own
// separate module area (MDM_Data_Schemas) out of scope here.
//
// Confirmed discrepancies with the formal script:
// 1. Step 2.4/2.5 has the user enter the new item's Description directly in the "Create New Master
//    Data" dialog (alongside Item Number) and expects the item to simply appear afterward -- no
//    separate description step. Confirmed live: that dialog's Description textarea is a distinct
//    field (bound to a one-shot `newItemDescription` observable used only for the creation POST)
//    from the schema's own required built-in "Description" field shown on the resulting Master Data
//    Edit page (bound to `itemHeader().description`) -- the two are NOT wired together in this
//    build/environment. The Edit page's Description starts empty and required regardless of what
//    was typed in the creation dialog, and Save stays disabled until it's filled there directly.
//    This test asserts that actual behavior (fill Description again on the Edit page, then Save)
//    rather than the formal script's assumption.
// 2. That same built-in Description field cannot reliably be set via a plain `fill()`/keystrokes --
//    see setItemDescription's doc comment in tests/support/master-data.ts for why (a
//    valueUpdate:'afterkeydown' Knockout binding whose row re-renders on every keystroke, wiping the
//    input back to empty) and the direct-observable-write workaround used instead.
// 3. RobarMasterData-specific (not in the formal script at all): a fresh record on this schema also
//    needs "Primary DI Number" and "Brand Name" filled (both required, discovered live via the
//    page's own Knockout `errors` array rather than hunting through its ~14 tabs by eye), and its
//    "Labeler Duns Number" field must be changed away from its pre-populated default -- that default
//    is immediately flagged invalid by the app itself, a real, separately-confirmed product bug (see
//    robar-module-reference.md's "Confirmed bug: Labeler Duns Number..." section), not something a
//    new record should normally need to touch at all.
//
// Not exercised by this test (kept out of scope, matching how every other test in this suite scopes
// down its formal script): the negative-permission checks (Section 1, a second account lacking
// MD_Create_Records -- this suite has no second test account) and the DB audit-trail verification
// steps (Section 4), which need direct DB access this suite doesn't have.

import { test, expect } from '@playwright/test';
import { login, findFrame } from '../support/robar';
import * as mdm from '../support/master-data';
import { ROBAR } from '../../seed';

test('new record creates item-schema and non-item-schema master data records, and rejects a duplicate item number', async ({ page }) => {
  test.setTimeout(120_000);

  await login(page);
  // "Master Data" is a substring of the separate "Master Data Excel Import" module button too, so
  // the shared openMenuItem helper's :has-text() (substring) match would be ambiguous here --
  // match by exact accessible name instead (confirmed live: the button's raw textContent has
  // extra whitespace/markup around "Master Data", so a CSS :text-is() exact match doesn't hit --
  // getByRole's accessible-name match does).
  await page.getByRole('button', { name: 'Master Data', exact: true }).click();
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);

  const schemaName = ROBAR.mdmSchema;
  const itemNumber = ROBAR.mdmItemNumber || 'MBMDM' + Math.floor(Math.random() * 100000);

  await test.step(`creates a new record for an item schema (${schemaName})`, async () => {
    await mdm.selectSchema(frame, schemaName);
    await mdm.openNewRecordAction(frame);
    await mdm.submitNewItemDialog(page, frame, itemNumber, 'Created via automated Playwright test (New Record)');

    await expect(frame.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible();
    await expect(frame.getByText(`Item Number: ${itemNumber}`)).toBeVisible();
    await expect(frame.getByText(`Schema Name: ${schemaName}`)).toBeVisible();
    await expect(frame.getByText('Approved By: Unapproved')).toBeVisible();

    // See header comment (discrepancy #1) -- the dialog's Description doesn't carry over, so the
    // Edit page's own required Description field must be filled separately.
    await mdm.setItemDescription(frame, 'Playwright MDM New Record test item');

    // See header comment (discrepancy #3) -- specific to the RobarMasterData fixture schema.
    if (schemaName === 'RobarMasterData') {
      await mdm.selectDropdownFieldByCaption(frame, 'Labeler Duns Number', 'Innovatum');
      await mdm.fillFieldByCaption(frame, 'Primary DI Number', '00841646' + Math.floor(Math.random() * 1000000));
      await mdm.fillFieldByCaption(frame, 'Brand Name', 'Playwright Test Brand');
    }

    await mdm.saveRecord(page, frame);

    // Real proof Save succeeded (not just that the click didn't throw): Save/Cancel disable again
    // once there are no unsaved changes left.
    await expect(frame.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(frame.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  await test.step('attempting to create a second record with the same Item Number is rejected', async () => {
    await frame.click('a:has-text("Previous Page")');
    await page.waitForTimeout(500);

    await mdm.selectSchema(frame, schemaName);
    await mdm.openNewRecordAction(frame);
    await frame.fill('#txtNewItemNumber', itemNumber);
    await frame.fill('#txtNewItemDescription', 'Duplicate item number attempt');

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/InnovatumMDM/MasterData/CreateMasterData'), { timeout: 15_000 }),
      frame.click('#btnSubmitNewitem'),
    ]);

    // Confirmed live: the page renders TWO dialog containers with a ".newItemError" div each
    // (#newItemDialog and #newRecordDialog) -- both show the same text once a duplicate is
    // rejected, but only one is actually visible, so an unscoped ".newItemError" locator is a
    // strict-mode violation (matches 2 elements).
    await expect(frame.locator('.newItemError:visible')).toContainText('already exists');
    // Dialog stays open on rejection -- confirms no navigation/record creation happened.
    await expect(frame.locator('#txtNewItemNumber')).toBeVisible();

    await frame.locator('.ui-dialog-titlebar-close:visible').click();
    await page.waitForTimeout(300);
  });

  await test.step('creates a new record for a non-item schema (MBNonItemSchema)', async () => {
    await mdm.selectSchema(frame, 'MBNonItemSchema');
    // Confirmed live: for a non-item schema, New Record skips the "Create New Master Data" dialog
    // entirely (there's no item number to prompt for) and goes straight to a blank Master Data Edit
    // page for the schema's own fields.
    await mdm.openNewRecordAction(frame);

    await expect(frame.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible();
    await expect(frame.getByText('Schema Name: MBNonItemSchema')).toBeVisible();

    await mdm.fillFieldByCaption(frame, 'Part Number', 'PWPART' + Math.floor(Math.random() * 100000));
    await mdm.fillFieldByCaption(frame, 'Model Number', 'PWMODEL' + Math.floor(Math.random() * 100000));
    await mdm.saveRecord(page, frame);

    await expect(frame.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(frame.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
