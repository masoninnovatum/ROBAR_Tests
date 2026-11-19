// Label Control REST API (project 20250702-001, UAT_20250702-001): one test per FRS row (RLCA.250702.F.x.y), driven through the REST API with the CL fixture users and checked in the TST703 database (read-only
// sqlcmd). The API works on EXISTING LCNs (it cannot create any): the GET tests compare every response field with the LabelControl / Items / Labels / ItemHeaders / ItemLabelMaster rows of a sample of CL* LCNs;
// the write tests (release / unrelease, effective dates) use the two OLDEST unreleased, release-eligible CL* LCNs (leftovers of earlier specs, never the newest ones) and put them back. Two small, harmless
// leftovers: unrelease writes ReleasedOn = 1900-01-01 (they had 2099-01-01) and an effectiveBegin written through the YYYYMMDD format loses its time of day.
// The security tests revoke LC_Manage_ProdAvail / LT_Carton Label from the CL group for a moment (restored in finally and by the last test). Wording differences between a requirement and the live API are recorded
// as test annotations; confirmed requirement gaps are marked test.fail (tracker rows). Evidence per test: runs/API/LC_<stamp>/<id>.json.
import { test, expect } from '@playwright/test';
import { API_BASE, API_USER, LT_MAIN, NO_API_USER } from './api-fixtures';
import { RUN_ID, http, lit, note, setGroupProcess, lt, sql, useEvidence } from './api-support';

const FRS = 'RLCA.250702.';
const t = (frs: string, text: string) => `${FRS}F.${frs} ${text}`;
const wording = (text: string) => test.info().annotations.push({ type: 'wording difference', description: text });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const get = (route: string, query: Record<string, string>, title?: string, o: Record<string, unknown> = {}) => http('GET', `LabelControl/${route}`, { query, title, ...o });
const toggle = (released: boolean, lcns: string[], releasedBy?: string | null, title?: string) =>
  http('POST', 'LabelControl/ToggleLCNRelease', { body: { released, ...(releasedBy === null ? {} : { releasedBy: releasedBy ?? 'API test system' }), lcns }, title: title ?? `ToggleLCNRelease released = ${released}` });
const dates = (effectiveBegin: string | null, effectiveEnd: string | null, lcns: string[], title?: string) =>
  http('POST', 'LabelControl/UpdateLCNEffectivityDates', { body: { effectiveBegin, effectiveEnd, lcns }, title: title ?? 'UpdateLCNEffectivityDates' });
const SERVER = new URL(API_BASE).hostname.toUpperCase();
const PROCESS_LC = 'LC_Manage_ProdAvail';

// ------------------------------------------------------------------------------------------------------------------------------------------------ database (read only)
const BASE = `from LabelControl lc join Items i on i.ItemNumber = lc.ItemNumber and i.LabelType = lc.LabelType and i.VersionNumber = lc.ItemVersion join Labels l on l.LabelName = lc.TemplateName and l.VersionNumber = lc.TemplateVersion ` +
  `left join ItemHeaders ih on ih.ItemNumber = lc.ItemNumber and ih.VersionNumber = lc.MasterDataVersion left join ItemLabelMaster ilm on ilm.ID = lc.LabelMasterKey`;
const d = (c: string) => `convert(varchar(23), ${c}, 126)`;
const nz = (c: string) => `nullif(ltrim(rtrim(${c})), '')`;
const SELECT = [
  'lc.LCN lcn', 'lc.ItemNumber itemNumber', 'lc.LabelType labelType', 'lc.ItemVersion itemVersion', 'lc.TemplateName templateName', 'lc.TemplateVersion templateVersion', 'lc.MasterDataVersion masterDataVersion',
  `${d('lc.EffectiveBegin')} effectiveBegin`, `${d('lc.EffectiveEnd')} effectiveEnd`, `${nz('lc.ReleasedBy')} releasedBy`, `case when ${nz('lc.ReleasedBy')} is not null then ${d('lc.ReleasedOn')} end releasedOn`,
  `${nz('lc.WorkflowId')} workflowID`, 'case when ilm.ID is not null then 1 else 0 end hasLabelMaster',
  `${nz('i.ApprovedBy')} itemApprovedBy`, `case when ${nz('i.ApprovedBy')} is not null then ${d('i.ApprovalDateTime')} end itemApprovedOn`, `${d('i.EffectiveBegin')} itemEffectiveBegin`, `${d('i.EffectiveEnd')} itemEffectiveEnd`,
  `${nz('l.ApprovedBy')} templateApprovedBy`, `case when ${nz('l.ApprovedBy')} is not null then ${d('l.ApprovalDateTime')} end templateApprovedOn`, `${d('l.EffectiveBegin')} templateEffectiveBegin`, `${d('l.EffectiveEnd')} templateEffectiveEnd`,
  `${nz('ih.ApprovedBy')} masterDataApprovedBy`, `case when ${nz('ih.ApprovedBy')} is not null then ${d('ih.ApprovalDateTime')} end masterDataApprovedOn`, `${d('ih.EffectiveBegin')} masterDataEffectiveBegin`, `${d('ih.EffectiveEnd')} masterDataEffectiveEnd`,
].join(', ');
type Rec = Record<string, any>;
const expectedOf = (lcns: string[]) => sql<Rec>(`select ${SELECT} ${BASE} where lc.LCN in (${lcns.map(lit).join(',')}) order by lc.LCN`, `LabelControl / Items / Labels / ItemHeaders / ItemLabelMaster rows of ${lcns.join(', ')}`);
const pick = (cond: string, n = 1, title = 'CL LCNs') => sql<{ LCN: string }>(`select top ${n} lc.LCN ${BASE} where lc.ItemNumber like 'CL%' and lc.LabelType = ${lit(LT_MAIN)} and ${cond} order by lc.LCN`, title).map((x) => x.LCN);
let cache: { sample: string[]; withMaster: string; noMaster: string; w: string[] } | undefined;
const data = () => {
  if (cache) return cache;
  const withMaster = pick('ilm.ID is not null', 1, 'a CL LCN that has a label master')[0];
  const noMaster = pick(`ilm.ID is null and lc.MasterDataVersion is null and ${nz('lc.ReleasedBy')} is null`, 1, 'a CL LCN without label master and master data')[0];
  const sample = [...new Set([
    ...pick(`lc.MasterDataVersion is not null and ${nz('ih.ApprovedBy')} is not null`, 1, 'a CL LCN with approved master data'), noMaster, withMaster,
    ...pick(`${nz('lc.ReleasedBy')} is not null`, 1, 'a released CL LCN'), ...pick(`lc.MasterDataVersion is not null and ${nz('ih.ApprovedBy')} is null`, 1, 'a CL LCN with unapproved master data'),
  ])];
  const w = pick(`${nz('lc.ReleasedBy')} is null and lc.MasterDataVersion is null and ${nz('i.ApprovedBy')} is not null and i.EffectiveBegin <= getdate() and i.EffectiveEnd >= getdate() and ${nz('l.ApprovedBy')} is not null and l.EffectiveBegin <= getdate() and l.EffectiveEnd >= getdate()`, 2, 'the two oldest unreleased, release-eligible CL LCNs (write fixtures)');
  if (w.length < 2) throw new Error('fewer than two release-eligible CL LCNs');
  return (cache = { sample, withMaster, noMaster, w });
};
const lcState = (lcn: string, title?: string) => sql<{ ReleasedBy: string; ro: string; AllowPrint: string; eb: string; ee: string }>(
  `select ReleasedBy, convert(varchar(23), ReleasedOn, 126) ro, AllowPrint, convert(varchar(23), EffectiveBegin, 126) eb, convert(varchar(23), EffectiveEnd, 126) ee from LabelControl where LCN = ${lit(lcn)}`, title ?? `LabelControl row of ${lcn}`)[0];
const xRows = (lcn: string, reason: string) => sql<{ ChangeType: string; ChangeUser: string; ChangeReason: string; ChangeComments: string; ChangeSignature: string; ChangeServer: string; secs: number }>(
  `select top 5 ChangeType, ChangeUser, ChangeReason, ChangeComments, ChangeSignature, ChangeServer, datediff_big(second, ChangeDateTime, getdate()) secs from x_LabelControl where LCN = ${lit(lcn)} and ChangeReason = ${lit(reason)} order by ChangeDateTime desc`,
  `x_LabelControl rows of ${lcn} (${reason})`);
/** Puts LCNs back to unreleased through the API (no-op when they already are). */
const unrelease = async (lcns: string[]) => {
  for (const lcn of lcns) if (lcState(lcn, `release state of ${lcn}`).ReleasedBy !== '') await toggle(false, [lcn], '', `unrelease ${lcn} (put back)`);
};
/** Date-times are compared to the second: the API returns them without milliseconds (the database keeps them). */
const norm = (v: any) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? v.replace(/\.\d+$/, '') : v);

test.use({ actionTimeout: 20_000 });

test.describe('Label Control REST API (project 20250702-001)', () => {
  useEvidence('LC');
  test.setTimeout(180_000);

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.1 authentication and security
  test(t('1.1', 'the API operates within the main InnoAPI website'), async () => {
    const r = await get('GetLCNByLCN', { lcn: data().noMaster });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    wording('the load balancer behind the main InnoAPI site cannot be observed from a test; only that the API answers under /innoapi/ like the other InnoAPI controllers');
  });

  test(t('1.2', 'a Basic Authorization header carrying the user id and password is required'), async () => {
    const none = await get('GetLCNByLCN', { lcn: data().noMaster }, 'no Authorization header', { user: null });
    expect(none.status).toBe(401);
    const bearer = await http('GET', 'LabelControl/GetLCNByLCN', { query: { lcn: data().noMaster }, headers: { Authorization: 'Bearer abc' }, user: null, title: 'a non-Basic Authorization header' });
    expect(bearer.status).toBe(401);
    const ok = await get('GetLCNByLCN', { lcn: data().noMaster }, 'Authorization: Basic base64(UserID:Password)');
    expect(ok.status).toBe(200);
  });

  test(t('1.3', 'the user id and password are validated against the ROBAR Users table'), async () => {
    const ok = await get('GetLCNByLCN', { lcn: data().noMaster }, 'an authorized user');
    expect(ok.status).toBe(200);
    const unknown = await get('GetLCNByLCN', { lcn: data().noMaster }, 'a user id that is not in the Users table', { user: 'CLAPIUnknown01', password: 'NotThePassword1' });
    expect(unknown.status).toBe(401);
    expect(unknown.text).toContain('No user found in ROBAR');
    const wrong = await get('GetLCNByLCN', { lcn: data().noMaster }, 'a known user with a wrong password', { user: NO_API_USER, password: 'NotThePassword1' });
    expect(wrong.status).toBe(401);
    expect(wrong.text).toContain('Invalid password');
    wording('an INACTIVE user (the live check answers "User <id> is disabled") is not exercised: it needs one more undeletable fixture user (created inactive) - not created without asking');
  });

  test(t('1.4', 'an unauthorized user id is rejected with HTTP 401'), async () => {
    const r = await get('GetLCNByLCN', { lcn: data().noMaster }, 'an unauthorized user id', { user: 'CLAPIUnknown01', password: 'NotThePassword1' });
    expect(r.status).toBe(401);
    wording(`requirement example: a JSON body {status, error, message "Invalid UserID or Password."}; live: HTTP 401 with the plain JSON text ${JSON.stringify(r.json)}`);
  });

  test(t('1.6', "the GlobalSetting 'MaxAPILoginFailuresPerMinute' is 10"), async () => {
    const r = sql<{ Value: string }>(`select Value from GlobalSettings where SettingName = 'MaxAPILoginFailuresPerMinute'`, 'GlobalSettings: MaxAPILoginFailuresPerMinute');
    expect(r).toHaveLength(1);
    expect(r[0].Value).toBe('10');
    wording('only the current value can be checked on a live system, not that it is the install default');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.2 required fields
  test(t('2.1', 'a missing or improperly formatted required field is rejected with HTTP 400'), async () => {
    test.fail(true, 'known gap: the live API answers 200 (POST, success = false) or 404 (GET, missing parameter), never 400 (tracker row 2026-11-19)');
    const w = data().w;
    const noReleasedBy = await toggle(true, [w[0]], null, 'ToggleLCNRelease without releasedBy (required)');
    const badDate = await dates('2026-01-01', null, [w[0]], 'UpdateLCNEffectivityDates with a date that is not YYYYMMDD');
    const noParam = await http('GET', 'LabelControl/GetLCNByLCN', { query: {}, title: 'GetLCNByLCN without the lcn parameter' });
    note('status codes of the three rejected requests', { noReleasedBy: noReleasedBy.status, badDate: badDate.status, noParam: noParam.status });
    expect([noReleasedBy.status, badDate.status, noParam.status]).toEqual([400, 400, 400]);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.3 GetLabelMasterByLCN
  test(t('3.1', 'GET GetLabelMasterByLCN?lcn=... returns the label master of an LCN'), async () => {
    const r = await get('GetLabelMasterByLCN', { lcn: data().withMaster });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    wording('the requirement shows https://server/InnoAPI/LabelControl/GetLabelMasterByLCN?lcn=LCN00000; the live URL is http://<server>/innoapi/LabelControl/GetLabelMasterByLCN?lcn=...');
  });

  test(t('3.2', 'the label master comes from the LabelMasterKey column of LABELCONTROL'), async () => {
    const withKey = sql<{ LCN: string; len: number }>(`select lc.LCN, datalength(ilm.LabelMaster) len from LabelControl lc join ItemLabelMaster ilm on ilm.ID = lc.LabelMasterKey where lc.LCN = ${lit(data().withMaster)}`, 'LabelMasterKey -> ItemLabelMaster of the LCN')[0];
    const r = await get('GetLabelMasterByLCN', { lcn: data().withMaster });
    expect(Buffer.from(r.json.labelMasterContentAsBase64Encoded, 'base64').length).toBe(withKey.len);
    const keyless = await get('GetLabelMasterByLCN', { lcn: data().noMaster }, 'an LCN whose LabelMasterKey is empty');
    expect(keyless.json.success).toBe(false);
  });

  test(t('3.3', 'the response has success, errorMessage and labelMasterContentAsBase64Encoded'), async () => {
    const r = await get('GetLabelMasterByLCN', { lcn: data().withMaster });
    expect(Object.keys(r.json).sort()).toEqual(['errorMessage', 'labelMasterContentAsBase64Encoded', 'success']);
    expect(typeof r.json.success).toBe('boolean');
    expect(typeof r.json.labelMasterContentAsBase64Encoded).toBe('string');
  });

  test(t('3.4', 'success is true when a label master is available (LabelMasterKey populated), false otherwise'), async () => {
    expect((await get('GetLabelMasterByLCN', { lcn: data().withMaster }, 'LabelMasterKey populated')).json.success).toBe(true);
    const none = await get('GetLabelMasterByLCN', { lcn: data().noMaster }, 'LabelMasterKey not populated');
    expect(none.json.success).toBe(false);
    const unknown = await get('GetLabelMasterByLCN', { lcn: 'LCN9999999' }, 'an LCN that does not exist');
    expect(unknown.json.success).toBe(false);
  });

  test(t('3.5', 'errorMessage is null when a label master is available, otherwise it explains the failure'), async () => {
    const ok = await get('GetLabelMasterByLCN', { lcn: data().withMaster });
    expect(ok.json.errorMessage).toBeNull();
    const none = await get('GetLabelMasterByLCN', { lcn: data().noMaster });
    expect(none.json.errorMessage).toBe(`Label master not found for LCN: ${data().noMaster}`);
    expect(none.json.labelMasterContentAsBase64Encoded).toBeNull();
  });

  test(t('3.6', 'labelMasterContentAsBase64Encoded is a Base64-encoded PDF'), async () => {
    const r = await get('GetLabelMasterByLCN', { lcn: data().withMaster });
    const bytes = Buffer.from(r.json.labelMasterContentAsBase64Encoded, 'base64');
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);
    note('decoded content', { firstBytes: bytes.subarray(0, 8).toString('latin1'), bytes: bytes.length });
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.4 GetLCNByLCN
  test(t('4.1', 'GET GetLCNByLCN?lcn=... returns the data of an LCN'), async () => {
    const r = await get('GetLCNByLCN', { lcn: data().sample[0] });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.lcns).toHaveLength(1);
    wording('the requirement shows https://server/InnoAPI/LabelControl/GetLCNByLCN?lcn=LCN00000; the live URL is http://<server>/innoapi/LabelControl/GetLCNByLCN?lcn=...');
  });

  test(t('4.2', 'the LCN data comes from the LABELCONTROL table'), async () => {
    for (const lcn of data().sample) {
      const r = await get('GetLCNByLCN', { lcn });
      const e = expectedOf([lcn])[0];
      expect(r.json.lcns[0]).toMatchObject({ lcn: e.lcn, itemNumber: e.itemNumber, labelType: e.labelType, itemVersion: e.itemVersion, templateName: e.templateName, templateVersion: e.templateVersion });
    }
  });

  test(t('4.3', 'the response contains success, errorMessage and the lcns array with the listed parameters'), async () => {
    const r = await get('GetLCNByLCN', { lcn: data().sample[0] });
    expect(Object.keys(r.json).sort()).toEqual(['errorMessage', 'lcns', 'success']);
    expect(Object.keys(r.json.lcns[0]).sort()).toEqual([
      'effectiveBegin', 'effectiveEnd', 'hasLabelMaster', 'itemApprovedBy', 'itemApprovedOn', 'itemEffectiveBegin', 'itemEffectiveEnd', 'itemNumber', 'itemVersion', 'labelType', 'lcn', 'masterDataApprovedBy', 'masterDataApprovedOn',
      'masterDataEffectiveBegin', 'masterDataEffectiveEnd', 'masterDataVersion', 'releasedBy', 'releasedOn', 'templateApprovedBy', 'templateApprovedOn', 'templateEffectiveBegin', 'templateEffectiveEnd', 'templateName', 'templateVersion', 'workflowID',
    ]);
  });

  test(t('4.4', 'success tells whether the LCN is present in LABELCONTROL: true when it is, false otherwise'), async () => {
    test.fail(true, 'known gap: an LCN that does not exist returns success = true with an empty lcns array (tracker row 2026-11-19)');
    const known = await get('GetLCNByLCN', { lcn: data().sample[0] }, 'an LCN that exists');
    expect(known.json.success).toBe(true);
    const unknown = await get('GetLCNByLCN', { lcn: 'LCN9999999' }, 'an LCN that does not exist');
    note('response for an unknown LCN', unknown.json);
    expect(unknown.json.success, 'requirement: false for an LCN that is not present').toBe(false);
  });

  test(t('4.5', 'errorMessage is null when the LCN is available, otherwise it explains the failure'), async () => {
    test.fail(true, 'known gap: an LCN that does not exist gives errorMessage = null (no message) with success = true (tracker row 2026-11-19)');
    const known = await get('GetLCNByLCN', { lcn: data().sample[0] }, 'an LCN that exists');
    expect(known.json.errorMessage).toBeNull();
    const unknown = await get('GetLCNByLCN', { lcn: 'LCN9999999' }, 'an LCN that does not exist');
    expect(unknown.json.errorMessage, 'requirement: an error message that explains the failure').toBeTruthy();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.5 GetLCNsByItemNumber
  test(t('5.1', 'GET GetLCNsByItemNumber?itemNumber=... returns the LCNs of an item'), async () => {
    const item = expectedOf([data().sample[0]])[0].itemNumber;
    const r = await get('GetLCNsByItemNumber', { itemNumber: item });
    expect(r.status).toBe(200);
    expect(r.json.lcns.length).toBeGreaterThan(0);
    expect(r.json.lcns.every((x: any) => x.itemNumber === item)).toBe(true);
    wording('the requirement shows https://server/InnoAPI/LabelControl/GetLCNsByItemNumber?itemNumber=...; the live URL is http://<server>/innoapi/LabelControl/GetLCNsByItemNumber?itemNumber=...');
  });

  test(t('5.2', 'the response has success, errorMessage and an lcns array of the listed parameters'), async () => {
    const item = expectedOf([data().sample[0]])[0].itemNumber;
    const r = await get('GetLCNsByItemNumber', { itemNumber: item });
    expect(Object.keys(r.json).sort()).toEqual(['errorMessage', 'lcns', 'success']);
    const byLcn = await get('GetLCNByLCN', { lcn: data().sample[0] });
    expect(Object.keys(r.json.lcns[0]).sort()).toEqual(Object.keys(byLcn.json.lcns[0]).sort());
    const dbCount = sql<{ n: number }>(`select count(*) n ${BASE} where lc.ItemNumber = ${lit(item)}`, `LCNs of ${item} (joined like the API)`)[0].n;
    expect(r.json.lcns).toHaveLength(dbCount);
  });

  test(t('5.3', 'success tells whether LCNs exist for the item: true when they do, false otherwise'), async () => {
    test.fail(true, 'known gap: an item without LCNs returns success = true with an empty lcns array (tracker row 2026-11-19)');
    const item = expectedOf([data().sample[0]])[0].itemNumber;
    expect((await get('GetLCNsByItemNumber', { itemNumber: item }, 'an item that has LCNs')).json.success).toBe(true);
    const none = await get('GetLCNsByItemNumber', { itemNumber: 'NoSuchItem' + RUN_ID }, 'an item without LCNs');
    note('response for an item without LCNs', none.json);
    expect(none.json.success, 'requirement: false when no LCN is present for the item').toBe(false);
  });

  test(t('5.4', 'errorMessage is null when LCNs are available, otherwise it explains the failure'), async () => {
    test.fail(true, 'known gap: an item without LCNs gives errorMessage = null (tracker row 2026-11-19)');
    const item = expectedOf([data().sample[0]])[0].itemNumber;
    expect((await get('GetLCNsByItemNumber', { itemNumber: item }, 'an item that has LCNs')).json.errorMessage).toBeNull();
    const none = await get('GetLCNsByItemNumber', { itemNumber: 'NoSuchItem' + RUN_ID }, 'an item without LCNs');
    expect(none.json.errorMessage, 'requirement: an error message that explains the failure').toBeTruthy();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.6 response fields
  test(t('6.1', 'GetLCNByLCN and GetLCNsByItemNumber responses include the lcns data'), async () => {
    const e = expectedOf([data().sample[0]])[0];
    const a = await get('GetLCNByLCN', { lcn: e.lcn });
    const b = await get('GetLCNsByItemNumber', { itemNumber: e.itemNumber });
    expect(Array.isArray(a.json.lcns) && a.json.lcns.length === 1).toBe(true);
    expect(Array.isArray(b.json.lcns) && b.json.lcns.some((x: any) => x.lcn === e.lcn)).toBe(true);
  });

  const FIELDS: Array<[string, string, string]> = [
    ['2', 'lcn', 'the lcn field is the LCN value from LABELCONTROL'], ['3', 'itemNumber', 'itemNumber is the item number of the LCN'], ['4', 'labelType', 'labelType is the label type of the LCN'],
    ['5', 'itemVersion', 'itemVersion is the item version of the LCN'], ['6', 'templateName', 'templateName is the template of the LCN'], ['7', 'templateVersion', 'templateVersion is the template version of the LCN'],
    ['8', 'masterDataVersion', 'masterDataVersion is the master data version (NULL when blank)'], ['9', 'effectiveBegin', 'effectiveBegin is the EffectiveBegin date of the LCN'], ['10', 'effectiveEnd', 'effectiveEnd is the EffectiveEnd date of the LCN'],
    ['11', 'releasedBy', 'releasedBy is the ReleasedBy value (NULL when blank)'], ['12', 'releasedOn', 'releasedOn is the ReleasedOn date'], ['13', 'workflowID', 'workflowID is the WorkflowID (NULL when blank)'],
    ['14', 'hasLabelMaster', 'hasLabelMaster is true when LABELMASTERKEY is not blank, otherwise false'], ['15', 'itemApprovedBy', 'itemApprovedBy is the ApprovedBy of the item version in ITEMS (NULL when blank)'],
    ['16', 'itemApprovedOn', 'itemApprovedOn is the ApprovalDateTime of the item version in ITEMS'], ['17', 'itemEffectiveBegin', 'itemEffectiveBegin is the EffectiveBegin of the item version in ITEMS'], ['18', 'itemEffectiveEnd', 'itemEffectiveEnd is the EffectiveEnd of the item version in ITEMS'],
    ['19', 'templateApprovedBy', 'templateApprovedBy is the ApprovedBy of the template in LABELS (NULL when blank)'], ['20', 'templateApprovedOn', 'templateApprovedOn is the ApprovalDateTime of the template in LABELS'],
    ['21', 'templateEffectiveBegin', 'templateEffectiveBegin is the EffectiveBegin of the template in LABELS'], ['22', 'templateEffectiveEnd', 'templateEffectiveEnd is the EffectiveEnd of the template in LABELS'],
    ['23', 'masterDataApprovedBy', 'masterDataApprovedBy is the ApprovedBy of the master data in ITEMHEADERS (NULL when blank)'], ['24', 'masterDataApprovedOn', 'masterDataApprovedOn is the ApprovalDateTime of the master data in ITEMHEADERS'],
    ['25', 'masterDataEffectiveBegin', 'masterDataEffectiveBegin is the EffectiveBegin of the master data in ITEMHEADERS'], ['26', 'masterDataEffectiveEnd', 'masterDataEffectiveEnd is the EffectiveEnd of the master data in ITEMHEADERS'],
  ];
  for (const [no, field, text] of FIELDS) {
    test(t(`6.${no}`, text), async () => {
      const { sample } = data();
      const expected = Object.fromEntries(expectedOf(sample).map((e) => [e.lcn, e]));
      let nullsSeen = 0, valuesSeen = 0;
      for (const lcn of sample) {
        const r = await get('GetLCNByLCN', { lcn }, `GetLCNByLCN ${lcn}`);
        expect(r.json.success).toBe(true);
        const got = norm(r.json.lcns[0][field]);
        const want = field === 'hasLabelMaster' ? expected[lcn][field] === 1 : norm(expected[lcn][field]);
        expect(got, `${field} of ${lcn}`).toEqual(want);
        if (want === null) nullsSeen++; else valuesSeen++;
      }
      note('values compared with the database', { lcns: sample.length, withValue: valuesSeen, null: nullsSeen });
      if (/DateTime|Begin|End|On$/.test(field) && /^(effective|released|item|template|masterData)/.test(field) && !/By$|Version$|Master$/.test(field)) {
        wording('the requirement shows the format YYYY-MM-DDT00:00:00.000; the live value keeps the time of day and drops zero milliseconds (for example 2026-10-13T12:15:28); a date-only value is 2099-01-01T00:00:00');
      }
    });
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.7 ToggleLCNRelease
  test(t('7.1', 'POST ToggleLCNRelease releases or unreleases LCNs'), async () => {
    const [w1] = data().w;
    const rel = await toggle(true, [w1], 'API test system', 'release the LCN');
    expect(rel.status).toBe(200);
    expect(rel.json.success).toBe(true);
    expect(lcState(w1).ReleasedBy).toBe('API test system');
    const unrel = await toggle(false, [w1], '', 'unrelease the LCN');
    expect(unrel.json.success).toBe(true);
    expect(lcState(w1).ReleasedBy).toBe('');
    wording('the requirement shows https://server/InnoAPI/LabelControl/ToggleLCNRelease; the live URL is http://<server>/innoapi/LabelControl/ToggleLCNRelease');
  });

  test(t('7.2', 'the request has released, releasedBy and lcns'), async () => {
    const [w1] = data().w;
    const r = await http('POST', 'LabelControl/ToggleLCNRelease', { body: { released: true, releasedBy: 'markf', lcns: [w1] }, title: 'request: { released, releasedBy, lcns }' });
    expect(r.json.success).toBe(true);
    const state = lcState(w1);
    expect(state.ReleasedBy).toBe('markf');
    await unrelease([w1]);
  });

  test(t('7.3', 'released = true releases the LCNs, released = false unreleases them'), async () => {
    const [w1] = data().w;
    const before = lcState(w1);
    expect(before.ReleasedBy).toBe('');
    expect((await toggle(true, [w1])).json.success).toBe(true);
    const released = lcState(w1);
    expect(released).toMatchObject({ ReleasedBy: 'API test system', AllowPrint: 'Y' });
    expect(released.ro.startsWith('1900') || released.ro.startsWith('2099')).toBe(false);
    expect((await toggle(false, [w1])).json.success).toBe(true);
    expect(lcState(w1)).toMatchObject({ ReleasedBy: '', AllowPrint: 'N' });
  });

  test(t('7.4', 'releasedBy is any text (not necessarily a ROBAR user) and is blank when unreleasing'), async () => {
    const [w1] = data().w;
    const name = `External system ${RUN_ID}`;
    expect(sql<{ n: number }>(`select count(*) n from Users where UserID = ${lit(name)}`, 'no ROBAR user has that name')[0].n).toBe(0);
    expect((await toggle(true, [w1], name)).json.success).toBe(true);
    expect(lcState(w1).ReleasedBy).toBe(name);
    expect((await toggle(false, [w1], 'ignored text')).json.success).toBe(true); // a releasedBy sent with released = false is not stored
    expect(lcState(w1).ReleasedBy).toBe('');
    const noName = await toggle(true, [w1], null, 'release without releasedBy');
    expect(noName.json).toMatchObject({ success: false, errorMessage: 'ReleasedBy is required when releasing LCNs' });
    expect(lcState(w1).ReleasedBy).toBe('');
  });

  test(t('7.5', 'lcns is a list of LCNs: all of them are processed in one request'), async () => {
    const [w1, w2] = data().w;
    const r = await toggle(true, [w1, w2], 'API test system', 'release two LCNs in one request');
    expect(r.json.success).toBe(true);
    expect([lcState(w1).ReleasedBy, lcState(w2).ReleasedBy]).toEqual(['API test system', 'API test system']);
    const u = await toggle(false, [w1, w2], '', 'unrelease two LCNs in one request');
    expect(u.json.success).toBe(true);
    expect([lcState(w1).ReleasedBy, lcState(w2).ReleasedBy]).toEqual(['', '']);
    wording('the requirement calls lcns "a comma separated list of LCNs"; the live request takes a JSON array of strings');
  });

  test(t('7.6', 'the response has success and errorMessage'), async () => {
    const [w1] = data().w;
    const r = await toggle(true, [w1]);
    expect(Object.keys(r.json).sort()).toEqual(['errorMessage', 'success']);
    await unrelease([w1]);
  });

  test(t('7.7', 'success is true for a successful release or unrelease and false for a failure'), async () => {
    const [w1] = data().w;
    expect((await toggle(true, [w1])).json.success).toBe(true);
    expect((await toggle(true, [w1], 'again', 'release an LCN that is already released')).json.success).toBe(false);
    expect((await toggle(false, [w1])).json.success).toBe(true);
    expect((await toggle(false, [w1], '', 'unrelease an LCN that is already unreleased')).json.success).toBe(false);
  });

  test(t('7.8', 'errorMessage is null on success; on failure it explains why and nothing is changed for any provided LCN'), async () => {
    const [w1, w2] = data().w;
    const ok = await toggle(true, [w1]);
    expect(ok.json.errorMessage).toBeNull();
    await unrelease([w1]);
    const bad = await toggle(true, [w1, 'LCN9999999', w2], 'API test system', 'release a list that contains an LCN that does not exist');
    expect(bad.json).toMatchObject({ success: false, errorMessage: 'LCN: LCN9999999 not found' });
    expect([lcState(w1).ReleasedBy, lcState(w2).ReleasedBy]).toEqual(['', '']); // the valid LCNs of the failed request were not released
    expect((await toggle(true, [w1])).json.success).toBe(true);
    const again = await toggle(true, [w1], 'x', 'release an LCN that is already released');
    expect(again.json).toMatchObject({ success: false, errorMessage: `LCN: ${w1} already released` });
    await unrelease([w1]);
    const un = await toggle(false, [w1], '', 'unrelease an LCN that is not released');
    expect(un.json).toMatchObject({ success: false, errorMessage: `LCN: ${w1} already unreleased` });
  });

  test(t('7.9', "every release / unrelease inserts an X_LABELCONTROL record: ChangeType 'C', ChangeUser, ChangeDateTime, ChangeReason, blank comments, signature 'N', ChangeServer"), async () => {
    const [w1] = data().w;
    const beforeRel = xRows(w1, 'Release LCN').length, beforeUn = xRows(w1, 'Unrelease LCN').length;
    expect((await toggle(true, [w1])).json.success).toBe(true);
    expect((await toggle(false, [w1])).json.success).toBe(true);
    const rel = xRows(w1, 'Release LCN'), un = xRows(w1, 'Unrelease LCN');
    expect(rel.length).toBe(Math.min(beforeRel + 1, 5));
    expect(un.length).toBe(Math.min(beforeUn + 1, 5));
    for (const row of [rel[0], un[0]]) {
      expect(row).toMatchObject({ ChangeType: 'C', ChangeUser: API_USER, ChangeComments: '', ChangeSignature: 'N', ChangeServer: SERVER });
      expect(Math.abs(row.secs)).toBeLessThan(180);
    }
    expect([rel[0].ChangeReason, un[0].ChangeReason]).toEqual(['Release LCN', 'Unrelease LCN']);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.8 UpdateLCNEffectivityDates
  const dateOf = (iso: string) => iso.slice(0, 10).replace(/-/g, '');
  /** Puts the two write fixtures' effective dates back (the begin date loses its time of day: only YYYYMMDD can be sent). */
  const restoreDates = async (originals: Array<{ lcn: string; eb: string; ee: string }>) => {
    for (const o of originals) await dates(dateOf(o.eb), dateOf(o.ee), [o.lcn], `restore the effective dates of ${o.lcn}`);
  };
  const originalsOf = () => data().w.map((lcn) => ({ lcn, ...lcState(lcn, `effective dates of ${lcn} before the test`) }));

  test(t('8.1', 'POST UpdateLCNEffectivityDates changes the effective dates of LCNs'), async () => {
    const [w1] = data().w;
    const orig = originalsOf();
    try {
      const r = await dates(null, '20980101', [w1], 'effectiveEnd = 20980101');
      expect(r.status).toBe(200);
      expect(r.json.success).toBe(true);
      expect(lcState(w1).ee.startsWith('2098-01-01')).toBe(true);
    } finally { await restoreDates(orig); }
    wording('the requirement shows https://server/InnoAPI/LabelControl/UpdateLCNEffectivityDates; the live URL is http://<server>/innoapi/LabelControl/UpdateLCNEffectivityDates');
  });

  test(t('8.2', 'the request has effectiveBegin, effectiveEnd and lcns'), async () => {
    const [w1] = data().w;
    const orig = originalsOf();
    try {
      const r = await http('POST', 'LabelControl/UpdateLCNEffectivityDates', { body: { effectiveBegin: null, effectiveEnd: '20970101', lcns: [w1] }, title: 'request: { effectiveBegin: null, effectiveEnd, lcns }' });
      expect(r.json.success).toBe(true);
      expect(lcState(w1).ee.startsWith('2097-01-01')).toBe(true);
    } finally { await restoreDates(orig); }
  });

  test(t('8.3', 'effectiveBegin (YYYYMMDD) updates the Effective Begin date; null means no change'), async () => {
    const [w1] = data().w;
    const orig = originalsOf();
    try {
      const before = lcState(w1);
      expect((await dates('20260101', null, [w1], 'effectiveBegin = 20260101, effectiveEnd = null')).json.success).toBe(true);
      const after = lcState(w1);
      expect(after.eb.startsWith('2026-01-01T00:00:00')).toBe(true);
      expect(after.ee).toBe(before.ee); // null = no change
      expect((await dates(null, '20960101', [w1], 'effectiveBegin = null')).json.success).toBe(true);
      expect(lcState(w1).eb).toBe(after.eb);
    } finally { await restoreDates(orig); }
  });

  test(t('8.4', 'effectiveEnd (YYYYMMDD) updates the Effective End date; null means no change'), async () => {
    const [w1] = data().w;
    const orig = originalsOf();
    try {
      expect((await dates(null, '20950101', [w1], 'effectiveEnd = 20950101')).json.success).toBe(true);
      const afterEnd = lcState(w1);
      expect(afterEnd.ee.startsWith('2095-01-01T00:00:00')).toBe(true);
      expect((await dates('20260102', null, [w1], 'effectiveEnd = null')).json.success).toBe(true);
      expect(lcState(w1).ee).toBe(afterEnd.ee);
    } finally { await restoreDates(orig); }
  });

  test(t('8.5', 'lcns is a list: all of them are updated in one request'), async () => {
    const [w1, w2] = data().w;
    const orig = originalsOf();
    try {
      const r = await dates(null, '20940101', [w1, w2], 'one request, two LCNs');
      expect(r.json.success).toBe(true);
      expect([lcState(w1).ee.slice(0, 10), lcState(w2).ee.slice(0, 10)]).toEqual(['2094-01-01', '2094-01-01']);
    } finally { await restoreDates(orig); }
    wording('the requirement calls lcns "a comma separated list of LCNs"; the live request takes a JSON array of strings');
  });

  test(t('8.6', 'the response has success and errorMessage'), async () => {
    const [w1] = data().w;
    const orig = originalsOf();
    try {
      const r = await dates(null, '20930101', [w1]);
      expect(Object.keys(r.json).sort()).toEqual(['errorMessage', 'success']);
    } finally { await restoreDates(orig); }
  });

  test(t('8.7', 'success is true for a successful update and false for a failure'), async () => {
    const [w1] = data().w;
    const orig = originalsOf();
    try {
      expect((await dates(null, '20920101', [w1], 'a valid update')).json.success).toBe(true);
      expect((await dates('2026-01-01', null, [w1], 'a date that is not YYYYMMDD')).json.success).toBe(false);
      expect((await dates(null, null, [w1], 'both dates blank')).json.success).toBe(false);
    } finally { await restoreDates(orig); }
  });

  test(t('8.8', 'errorMessage is null on success; on failure it explains why and nothing is changed for any provided LCN'), async () => {
    const [w1, w2] = data().w;
    const orig = originalsOf();
    try {
      const ok = await dates(null, '20910101', [w1]);
      expect(ok.json.errorMessage).toBeNull();
      const before = [lcState(w1), lcState(w2)];
      const bad = await dates(null, '20900101', [w1, 'LCN9999999', w2], 'a list that contains an LCN that does not exist');
      expect(bad.json.success).toBe(false);
      expect(bad.json.errorMessage).toBeTruthy(); // an error message explains the failure ...
      wording(`... but for UpdateLCNEffectivityDates the text is an internal error, not the intended "LCN: X not found" of ToggleLCNRelease: ${JSON.stringify(bad.json.errorMessage)} (its "not found" check never triggers: the repository returns an empty entry instead of null)`);
      expect([lcState(w1).ee, lcState(w2).ee]).toEqual([before[0].ee, before[1].ee]);
      const format = await dates('2026-01-01', null, [w1], 'a date that is not YYYYMMDD');
      expect(format.json.errorMessage).toContain('EffectiveBegin could not be parsed as a date. Must be formatted as YYYYMMDD');
      if (format.json.errorMessage.includes('both blank')) wording(`a date that cannot be parsed also reports "EffectiveBegin and EffectiveEnd are both blank" (misleading): ${JSON.stringify(format.json.errorMessage)}`);
      const blank = await dates(null, null, [w1], 'both dates blank');
      expect(blank.json.errorMessage).toBe('EffectiveBegin and EffectiveEnd are both blank');
    } finally { await restoreDates(orig); }
  });

  test(t('8.9', "every effective date update inserts an X_LABELCONTROL record: ChangeType 'C', ChangeUser, ChangeDateTime, reason 'Update Effective Dates', blank comments, signature 'N', ChangeServer"), async () => {
    const [w1] = data().w;
    const orig = originalsOf();
    try {
      const before = xRows(w1, 'Update Effective Dates').length;
      expect((await dates(null, '20890101', [w1])).json.success).toBe(true);
      const rows = xRows(w1, 'Update Effective Dates');
      expect(rows.length).toBe(Math.min(before + 1, 5));
      expect(rows[0]).toMatchObject({ ChangeType: 'C', ChangeUser: API_USER, ChangeReason: 'Update Effective Dates', ChangeComments: '', ChangeSignature: 'N', ChangeServer: SERVER });
      expect(Math.abs(rows[0].secs)).toBeLessThan(180);
    } finally { await restoreDates(orig); }
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.9 security group and process
  test(t('9.1', 'the security group ROBAR API Security exists and holds API_LC'), async () => {
    const g = sql<{ ProcessName: string; Authorized: string }>(`select ProcessName, Authorized from [security] where UserGroup = 'ROBAR_API_Security' and ProcessName = 'API_LC'`, 'security: ROBAR_API_Security / API_LC');
    expect(g).toEqual([{ ProcessName: 'API_LC', Authorized: 'Y' }]);
    expect(sql<{ n: number }>(`select count(*) n from Groups where GroupID = 'ROBAR_API_Security'`, 'Groups: ROBAR_API_Security')[0].n).toBe(1);
    wording('the group id is ROBAR_API_Security (underscores); the fixture user is in the CL group CLAPIGrp, not in ROBAR_API_Security itself');
  });

  test(t('9.2', 'a user without API_LC is rejected with the API_LC message'), async () => {
    const [w1] = data().w;
    const calls = [
      await get('GetLabelMasterByLCN', { lcn: data().withMaster }, `GetLabelMasterByLCN as ${NO_API_USER}`, { user: NO_API_USER }),
      await get('GetLCNByLCN', { lcn: data().noMaster }, `GetLCNByLCN as ${NO_API_USER}`, { user: NO_API_USER }),
      await get('GetLCNsByItemNumber', { itemNumber: 'x' }, `GetLCNsByItemNumber as ${NO_API_USER}`, { user: NO_API_USER }),
      await http('POST', 'LabelControl/ToggleLCNRelease', { body: { released: true, releasedBy: 'x', lcns: [w1] }, user: NO_API_USER, title: `ToggleLCNRelease as ${NO_API_USER}` }),
      await http('POST', 'LabelControl/UpdateLCNEffectivityDates', { body: { effectiveEnd: '20990101', lcns: [w1] }, user: NO_API_USER, title: `UpdateLCNEffectivityDates as ${NO_API_USER}` }),
    ];
    for (const c of calls) expect(c.status).toBe(401);
    for (const c of calls.slice(0, 3)) expect(c.text).toContain('User not authorized for this task: API_LC.');
    for (const c of calls.slice(3)) expect(c.text).toContain('API_LC'); // the two update endpoints name every missing process
    expect(lcState(w1).ReleasedBy).toBe('');
    note('the two update endpoints list ALL missing processes', { text: calls[3].text });
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- security phase (CL group processes are revoked for a moment)
  test(t('1.8', 'updating LCNs (release or effective dates) needs the LC_Manage_ProdAvail security process'), async ({ browser }) => {
    test.setTimeout(300_000);
    const [w1] = data().w;
    const orig = originalsOf();
    expect(lt(PROCESS_LC)).toBe(true);
    expect((await toggle(true, [w1], 'API test system', 'WITH LC_Manage_ProdAvail: release')).json.success).toBe(true);
    await unrelease([w1]);
    await setGroupProcess(browser, PROCESS_LC, false);
    try {
      expect(lt(PROCESS_LC)).toBe(false);
      const rel = await toggle(true, [w1], 'API test system', 'WITHOUT LC_Manage_ProdAvail: release');
      const upd = await dates(null, '20880101', [w1], 'WITHOUT LC_Manage_ProdAvail: effective dates');
      for (const r of [rel, upd]) {
        expect(r.status).toBe(401);
        expect(r.text).toBe(`"User not authorized for this task: ${PROCESS_LC}."`);
      }
      expect(lcState(w1)).toMatchObject({ ReleasedBy: '' });
      const read = await get('GetLCNByLCN', { lcn: w1 }, 'reading LCNs needs only API_LC');
      expect(read.status).toBe(200);
    } finally {
      await setGroupProcess(browser, PROCESS_LC, true);
      await restoreDates(orig);
    }
    expect(lt(PROCESS_LC)).toBe(true);
  });

  test(t('1.9', 'updating an LCN needs the LT_ security process of its label type'), async ({ browser }) => {
    test.setTimeout(300_000);
    const [w1] = data().w;
    const orig = originalsOf();
    await setGroupProcess(browser, `LT_${LT_MAIN}`, false);
    try {
      expect(lt(`LT_${LT_MAIN}`)).toBe(false);
      const rel = await toggle(true, [w1], 'API test system', `WITHOUT LT_${LT_MAIN}: release`);
      const upd = await dates(null, '20870101', [w1], `WITHOUT LT_${LT_MAIN}: effective dates`);
      for (const r of [rel, upd]) {
        expect(r.status).toBe(200);
        expect(r.json).toMatchObject({ success: false, errorMessage: `User is not authorized to edit Label Type: ${LT_MAIN}` });
      }
      expect(lcState(w1)).toMatchObject({ ReleasedBy: '' });
      const read = await get('GetLCNByLCN', { lcn: w1 }, 'reading is not affected');
      expect(read.status).toBe(200);
    } finally {
      await setGroupProcess(browser, `LT_${LT_MAIN}`, true);
      await restoreDates(orig);
    }
    expect(lt(`LT_${LT_MAIN}`)).toBe(true);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- rate limit (last: it blocks the tested user ids for a minute)
  test(t('1.7', 'more failed logins than MaxAPILoginFailuresPerMinute in a minute: 401 with the maximum-attempts message and a three second delay'), async () => {
    test.setTimeout(240_000);
    const user = `CLAPIRate${RUN_ID}`;
    const timings: number[] = [];
    let last: { status: number; text: string } = { status: 0, text: '' };
    for (let i = 1; i <= 12; i++) {
      const t0 = Date.now();
      last = await get('GetLCNByLCN', { lcn: 'x' }, `failed login ${i} of 12 (unknown user id)`, { user, password: 'NotThePassword1' });
      timings.push(Date.now() - t0);
    }
    note('response times in ms of the 12 failed logins', timings);
    expect(timings.slice(0, 10).every((ms) => ms < 2500), 'the first ten failures answer without the delay').toBe(true);
    expect(timings[10]).toBeGreaterThanOrEqual(2900);
    expect(timings[11]).toBeGreaterThanOrEqual(2900);
    expect(last.status).toBe(401);
    expect(last.text).toContain('Maximum number of login attempts per minute exceeded for this UserID');
    wording(`requirement example: a JSON body {status, error, message "Maximum number of login attempts per minute exceeded for this UserID. Please try again later."}; live: HTTP 401 and the plain text ${last.text}`);
  });

  test(t('1.5', 'the rate-limit check does not increment FailCount of the user'), async () => {
    test.setTimeout(240_000);
    const count = () => sql<{ FailCount: number }>(`select FailCount from Users where UserID = ${lit(NO_API_USER)}`, `Users.FailCount of ${NO_API_USER}`)[0].FailCount;
    const before = count();
    for (let i = 1; i <= 12; i++) await get('GetLCNByLCN', { lcn: 'x' }, `failed login ${i} of 12 (${NO_API_USER}, wrong password)`, { user: NO_API_USER, password: 'NotThePassword1' });
    expect(count()).toBe(before);
    await sleep(62_000); // the one-minute window of this user id must end before other tests use it again
    const ok = await get('GetLCNByLCN', { lcn: data().noMaster }, `${NO_API_USER} can log in again after the minute`, { user: NO_API_USER });
    expect(ok.status).toBe(401); // valid credentials but no API_LC: the point is that the rate limit is over
    expect(ok.text).toContain('User not authorized for this task: API_LC.');
  });

  test('zz_restore security: LC_Manage_ProdAvail and LT_Carton Label granted to CLAPIGrp', async ({ browser }) => {
    test.setTimeout(300_000);
    if (!lt(PROCESS_LC)) await setGroupProcess(browser, PROCESS_LC, true);
    if (!lt(`LT_${LT_MAIN}`)) await setGroupProcess(browser, `LT_${LT_MAIN}`, true);
    expect(lt(PROCESS_LC)).toBe(true);
    expect(lt(`LT_${LT_MAIN}`)).toBe(true);
  });
});
