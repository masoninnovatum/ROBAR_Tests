// Confirms the CL API fixtures behave as intended against the live Items API on TST703 (read-only calls, nothing is written):
//  CLAPI01 (CLAPIGrp: API_Items + LT_CLLabelType) is accepted; CLAPINoApi01 (valid login, no API_* process) is rejected; no credentials is rejected.
import { test, expect, request } from '@playwright/test';
import { PASSWORD } from '../support/robar';
import { API_BASE, API_USER, NO_API_USER } from './api-fixtures';

const basic = (u: string, p: string) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
const URL = API_BASE + 'Items/GetByLabelType?labelType=CLLabelType';

async function get(auth?: string) {
  const ctx = await request.newContext({ extraHTTPHeaders: auth ? { Authorization: auth } : {} });
  const r = await ctx.get(URL);
  const text = await r.text();
  await ctx.dispose();
  return { status: r.status(), text };
}

test('API fixtures: authorized, not authorized, no credentials', async () => {
  const ok = await get(basic(API_USER, PASSWORD));
  console.log('CLAPI01 ->', ok.status, ok.text.slice(0, 200));
  expect(ok.status).toBe(200);
  expect(JSON.parse(ok.text).success).toBe(true);

  const denied = await get(basic(NO_API_USER, PASSWORD));
  console.log('CLAPINoApi01 ->', denied.status, denied.text.slice(0, 200));
  expect(denied.status).toBeGreaterThanOrEqual(400);
  expect(denied.text).toContain('API_Items');

  const none = await get();
  console.log('no credentials ->', none.status, none.text.slice(0, 200));
  expect(none.status).toBe(401);
});
