// Creates (only what is missing) the REST API fixtures on TST703: group CLAPIGrp (all API_* processes + LT_CLLabelType) and the users CLAPI01 (in CLAPIGrp) and CLAPINoApi01 (in the
// legacy Login_WebMenu-only group MBPWLoginGrp, so it authenticates but holds no API_* process). Idempotent: a second run changes nothing. Writes only CL* names (assertMb guard);
// MBPWLoginGrp is only READ (never edited). New users reuse the seed test password (sec.TEST_PASSWORD), like the other CL fixture users.
import { test, expect } from '@playwright/test';
import * as sec from '../support/security';
import { addGroup, addUser, groupExists, userExists } from '../Password-Management/pr-fixtures';
import { API_FIXTURE_USERS, API_GROUP, API_PROCESSES, FACILITY, NO_API_GROUP } from './api-fixtures';

test.use({ actionTimeout: 20_000 });

test('API_00_Setup_Fixtures: REST API group and users exist', async ({ page }) => {
  test.setTimeout(600_000);
  let f = await sec.openSecurity(page);

  await test.step(`group ${API_GROUP}`, async () => {
    if (await groupExists(f, API_GROUP)) { console.log(`${API_GROUP} exists`); return; }
    f = await addGroup(page, f, API_GROUP, 'Playwright REST API callers (do not delete)');
    await expect(sec.groupRow(f, API_GROUP)).toHaveCount(1);
    console.log(`${API_GROUP} created`);
  });

  await test.step(`${API_GROUP} holds exactly ${API_PROCESSES.join(', ')}`, async () => {
    f = await sec.setGroupProcesses(page, API_GROUP, API_PROCESSES);
    const now = await sec.readProcesses(f);
    expect(Object.keys(now).filter((k) => now[k]).sort()).toEqual([...API_PROCESSES].sort());
  });

  await test.step(`${NO_API_GROUP} (read only) holds no API_* process`, async () => {
    f = await sec.reopenSecurity(page);
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, NO_API_GROUP));
    const now = await sec.readProcesses(f);
    const apis = Object.keys(now).filter((k) => now[k] && /^API_/i.test(k));
    console.log(`${NO_API_GROUP} authorized processes:`, Object.keys(now).filter((k) => now[k]).join(', '));
    expect(apis, `${NO_API_GROUP} must hold no API_* process`).toEqual([]);
  });

  for (const u of API_FIXTURE_USERS) {
    await test.step(`user ${u.id} (${FACILITY}, ${u.group})`, async () => {
      f = await sec.reopenSecurity(page);
      if (await userExists(f, u.id)) { console.log(`${u.id} exists`); return; }
      f = await addUser(page, f, u.id, FACILITY, u.group, u.fullName);
      f = await sec.reopenSecurity(page);
      expect(await userExists(f, u.id)).toBe(true);
      console.log(`${u.id} created`);
    });
  }
});
