// Creates (only what is missing) the Password Reset / Password Change fixtures on TST703: group CLPRGrp (Login_WebMenu + ResetPassword_Option) and the users CLPROp01,
// CLPRTgtA01, CLPRTgtB01, CLPRLock01. Idempotent: a second run changes nothing. Writes only CL* names (assertMb guard); never touches any other user or group.
import { test, expect } from '@playwright/test';
import * as sec from '../support/security';
import { FIXTURE_USERS, OP_GROUP, OP_PROCESSES, addGroup, addUser, groupExists, userExists } from './pr-fixtures';

test.use({ actionTimeout: 20_000 });

test('Setup_Fixtures: Password Reset / Change fixtures exist', async ({ page }) => {
  test.setTimeout(600_000);
  let f = await sec.openSecurity(page);

  await test.step(`group ${OP_GROUP}`, async () => {
    if (await groupExists(f, OP_GROUP)) { console.log(`${OP_GROUP} exists`); return; }
    f = await addGroup(page, f, OP_GROUP, 'Playwright Password Reset / Change operator');
    await expect(sec.groupRow(f, OP_GROUP)).toHaveCount(1);
    console.log(`${OP_GROUP} created`);
  });

  await test.step(`${OP_GROUP} holds exactly ${OP_PROCESSES.join(', ')}`, async () => {
    f = await sec.setGroupProcesses(page, OP_GROUP, OP_PROCESSES);
    const now = await sec.readProcesses(f);
    expect(Object.keys(now).filter((k) => now[k]).sort()).toEqual([...OP_PROCESSES].sort());
  });

  for (const u of FIXTURE_USERS) {
    await test.step(`user ${u.id} (${u.facility}, ${u.group})`, async () => {
      f = await sec.reopenSecurity(page);
      if (await userExists(f, u.id)) { console.log(`${u.id} exists`); return; }
      f = await addUser(page, f, u.id, u.facility, u.group);
      f = await sec.reopenSecurity(page);
      expect(await userExists(f, u.id)).toBe(true);
      console.log(`${u.id} created`);
    });
  }
});
