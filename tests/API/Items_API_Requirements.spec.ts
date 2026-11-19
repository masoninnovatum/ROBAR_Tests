// Items API (project 20260409-001, UAT_20260409-001): one test per FRS row (ItemsAPI.20260409.F.x.y), driven through the REST API with the CL fixture users and checked in the TST703
// database (read-only sqlcmd). New items are CLAPI<run><letter> in 'Carton Label' / 'MBLT1' (items cannot be deleted; each run adds ~12). The security phase toggles LT_MBDOCX / LT_MBLT1 of the
// CL group CLAPIGrp through Security Management (restored by the last test). Evidence per test: runs/API/Items_<stamp>/<id>.json.
// F.2.9 needs an item routed in a workflow: api-workflow-fixture.ts finds a CL / MB item that already is, or sends the fixture item CLAPIWFItem01 to a workflow once. Wording differences between a requirement and the live API are recorded as test annotations, not hidden.
import { test, expect } from '@playwright/test';
import { API_USER, LT_DENIED, LT_MAIN, LT_NON_BTW, LT_SECOND, NO_API_USER } from './api-fixtures';
import { ensureWorkflowItem, WF_ITEM } from './api-workflow-fixture';
import { RUN_ID, markLastSetup, http, itemRows, labelNameOf, lt, note, setGroupProcess, sql, lit, useEvidence } from './api-support';

const FRS = 'ItemsAPI.20260409.';
const RUN = RUN_ID;
const id = (letter: string) => `CLAPI${RUN}${letter}`;
const A = id('A'), B = id('B'), C = id('C'), D = id('D'), E = id('E'), F = id('F'), G1 = id('G'), G2 = id('H'), H1 = id('J'), H2 = id('K'), W = id('W');
let LN_MAIN = '', LN_SECOND = '';

const rec = (itemNumber: string, extra: Record<string, unknown> = {}) => ({ itemNumber, labelType: LT_MAIN, labelName: LN_MAIN, description: `Items API test ${itemNumber}`, ...extra });
const post = (route: string, body: unknown, title?: string) => http('POST', `Items/${route}`, { body, title });
// focus: the screenshot of a big GET response shows only the records of this run (their item numbers contain the run id) and counts the others
const get = (route: string, query: Record<string, string>, o: { user?: string | null } = {}) => http('GET', `Items/${route}`, { query, focus: RUN, ...o });
const approve = (item: string, labelType = LT_MAIN, v = 0, extra: Record<string, unknown> = {}) => post('Approve', [{ itemNumber: item, labelType, versionNumber: v, ...extra }], `Approve ${item} v${v}`);
const retire = (item: string, v = 0, retireIt = true, extra: Record<string, unknown> = {}) => post('RetireOrUnretire', [{ itemNumber: item, labelType: LT_MAIN, versionNumber: v, retire: retireIt, ...extra }], `${retireIt ? 'Retire' : 'Unretire'} ${item} v${v}`);
const last = <T,>(a: T[]): T => a[a.length - 1];
const first = (j: any) => j?.results?.[0];
const mustOk = (r: { status: number; json: any }, what: string) => {
  markLastSetup(); // the call just made is a prerequisite, not the proof
  if (r.status !== 200 || r.json?.success !== true) throw new Error(`setup failed (${what}): ${r.status} ${JSON.stringify(r.json)}`);
};
const SAVE_AS = (item: string, o: Record<string, unknown> = {}) => ({ itemNumber: item, sourceLabelType: LT_MAIN, labelType: LT_SECOND, labelName: LN_SECOND, ...o });
const DENIED_MSG = (t: string) => `User not authorized for this task: LT_${t}.`;
const t = (frs: string, text: string) => `${FRS}F.${frs} ${text}`;
const wording = (text: string) => test.info().annotations.push({ type: 'wording difference', description: text });

test.use({ actionTimeout: 20_000 });

test.describe('Items API (project 20260409-001)', () => {
  useEvidence('Items');
  test.setTimeout(180_000);

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    LN_MAIN = labelNameOf(LT_MAIN);
    LN_SECOND = labelNameOf(LT_SECOND);
    for (const p of ['API_Items', `LT_${LT_MAIN}`, `LT_${LT_SECOND}`]) if (!lt(p)) throw new Error(`CLAPIGrp lacks ${p}: run tests/API/API_00_Setup_Fixtures.spec.ts`);
    if (!lt(`LT_${LT_NON_BTW}`)) await setGroupProcess(browser, `LT_${LT_NON_BTW}`, true); // F.2.4 needs the permission so that the .btw check is reached (only toggled when missing: a new worker repeats beforeAll)
    if (!lt(`LT_${LT_NON_BTW}`)) throw new Error('LT_MBDOCX was not granted');
    console.log(`run ${RUN}: label names ${LN_MAIN} / ${LN_SECOND}`);
  });

  // (no afterAll: a failed test makes Playwright start a new worker and run afterAll/beforeAll again, which would toggle security every time. The last test restores it instead.)

  // ------------------------------------------------------------------------------------------------------------------------------------------ F.1 authentication
  test(t('1.1', 'every call requires a valid user id and password'), async () => {
    const calls: Array<['GET' | 'POST', string, any]> = [
      ['POST', 'CreateOrUpdate', [rec(W)]], ['POST', 'SaveAs', [SAVE_AS(W)]], ['POST', 'RetireOrUnretire', [{ itemNumber: W, labelType: LT_MAIN, versionNumber: 0, retire: true }]],
      ['POST', 'Approve', [{ itemNumber: W, labelType: LT_MAIN, versionNumber: 0 }]],
      ['GET', 'GetByLabelType', { labelType: LT_SECOND }], ['GET', 'GetByLabelName', { labelName: LN_SECOND }], ['GET', 'GetByItemNumber', { itemNumber: A }],
    ];
    for (const [m, route, payload] of calls) {
      const none = await http(m, `Items/${route}`, m === 'GET' ? { query: payload, user: null } : { body: payload, user: null, title: `${route}: no credentials` });
      expect(none.status, `${route} without credentials`).toBe(401);
      const bad = await http(m, `Items/${route}`, m === 'GET' ? { query: payload, user: 'CLAPIUnknown01', password: 'NotThePassword1' } : { body: payload, user: 'CLAPIUnknown01', password: 'NotThePassword1', title: `${route}: unknown user` });
      expect(bad.status, `${route} with an unknown user`).toBe(401);
    }
    const good = await get('GetByLabelType', { labelType: 'CLLabelType' });
    expect(good.status).toBe(200);
  });

  test(t('1.2', "GlobalSetting 'MaxAPILoginFailuresPerMinute' is 10"), async () => {
    const r = sql<{ Value: string }>(`select Value from GlobalSettings where SettingName = 'MaxAPILoginFailuresPerMinute'`, 'GlobalSettings: MaxAPILoginFailuresPerMinute');
    expect(r).toHaveLength(1);
    expect(r[0].Value).toBe('10');
    wording('only the current value can be checked on a live system, not that it is the install default');
  });

  // ------------------------------------------------------------------------------------------------------------------------------------------ F.2 CreateOrUpdate
  test(t('2.1', 'POST CreateOrUpdate creates an item'), async () => {
    const r = await post('CreateOrUpdate', [rec(A, { attributes: [{ shareName: 'I_Desc2', value: 'v0 attr' }] })]);
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(first(r.json)).toMatchObject({ itemNumber: A, success: true, errorMessage: '' });
    expect(itemRows(A)).toHaveLength(1);
    wording('the requirement calls the method ItemsCreateOrUpdate; the live route is Items/CreateOrUpdate');
  });

  test(t('2.2', 'new item needs description and labelName; an unapproved item is updated in place'), async () => {
    const miss = await post('CreateOrUpdate', [{ itemNumber: `${A}X`, labelType: LT_MAIN }], 'new item without description / labelName');
    expect(first(miss.json)).toMatchObject({ success: false, errorMessage: 'Description and LabelName are required for new items.' });
    expect(itemRows(`${A}X`)).toHaveLength(0);
    const upd = await post('CreateOrUpdate', [rec(A, { description: `Items API test ${A} updated`, attributes: [{ shareName: 'I_Desc2', value: 'v0 updated' }, { shareName: 'I_Desc3', value: 'd3 v0' }] })], 'update the unapproved version');
    expect(first(upd.json)).toMatchObject({ success: true, errorMessage: '' });
    const rows = itemRows(A);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ VersionNumber: 0, Description: `Items API test ${A} updated`, Description2: 'v0 updated', Description3: 'd3 v0', LabelName: LN_MAIN });
  });

  test(t('2.3', 'a missing required property is rejected'), async () => {
    const noItem = await post('CreateOrUpdate', [{ labelType: LT_MAIN, labelName: LN_MAIN, description: 'x' }], 'itemNumber missing');
    expect(first(noItem.json).success).toBe(false);
    expect(first(noItem.json).errorMessage).toMatch(/ItemNumber/);
    expect(first(noItem.json).errorMessage).toMatch(/required/);
    const noType = await post('CreateOrUpdate', [{ itemNumber: `${A}X`, labelName: LN_MAIN, description: 'x' }], 'labelType missing');
    expect(first(noType.json).success).toBe(false);
    expect(first(noType.json).errorMessage).toMatch(/LabelType/);
    expect(first(noType.json).errorMessage).toMatch(/required/);
    wording(`requirement: "<Field Name> is required."; live: one combined message "${first(noItem.json).errorMessage}"`);
  });

  test(t('2.4', 'the label type must use the .btw file extension'), async () => {
    const r = await post('CreateOrUpdate', [rec(`${A}X`, { labelType: LT_NON_BTW })]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: `Label Type ${LT_NON_BTW} is not associated with .btw file extension.` });
    sql(`select LabelType, FileExtension from LabelTypes where LabelType = ${lit(LT_NON_BTW)}`, `file extension of ${LT_NON_BTW}`);
    expect(itemRows(`${A}X`)).toHaveLength(0);
  });

  test(t('2.5', 'the label name must belong to the label type'), async () => {
    const r = await post('CreateOrUpdate', [rec(`${A}X`, { labelName: LN_SECOND })]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: `Label Name ${LN_SECOND} is not associated with Label Type ${LT_MAIN}.` });
    expect(itemRows(`${A}X`)).toHaveLength(0);
  });

  test(t('2.6', 'label type security is checked'), async () => {
    const r = await post('CreateOrUpdate', [rec(`${A}X`, { labelType: LT_DENIED })]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: DENIED_MSG(LT_DENIED) });
    expect(itemRows(`${A}X`)).toHaveLength(0);
  });

  test(t('2.7', 'a new record gets AllowPrint = true, Active = true and the attributes'), async () => {
    const rows = itemRows(A, LT_MAIN);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ AllowPrint: 'Y', Active: 'Y', VersionNumber: 0, Description2: 'v0 updated' });
    expect(rows[0].EffectiveEnd.startsWith('2099-12-31')).toBe(true);
  });

  test(t('2.8', 'an item without an unapproved version gets a new version from the latest approved one'), async () => {
    mustOk(await approve(A), 'approve A v0 (setup)');
    const r = await post('CreateOrUpdate', [rec(A, { description: `Items API test ${A} v1`, attributes: [{ shareName: 'I_Desc2', value: 'v1 attr' }] })], 'update an approved item');
    expect(first(r.json)).toMatchObject({ success: true, errorMessage: '' });
    const rows = itemRows(A, LT_MAIN);
    expect(rows.map((x) => x.VersionNumber)).toEqual([0, 1]);
    expect(rows[0]).toMatchObject({ ApprovedBy: API_USER, Description2: 'v0 updated' });
    expect(rows[1]).toMatchObject({ ApprovedBy: '', Active: 'Y', Description2: 'v1 attr', Description3: 'd3 v0' }); // copied from v0, then the new attribute applied
    expect(rows[1].secsSinceBegin).toBeLessThan(180);
  });

  test(t('2.9', 'an item routed in an active workflow cannot be modified'), async ({ browser }) => {
    test.setTimeout(420_000);
    // An item is "in a workflow" when Items.DocumentOwner = 'Workflow'. Use a CL / MB item that already is; if none exists, send the fixture item to a workflow once (Campaign Manager).
    const target = await ensureWorkflowItem(browser, async () => mustOk(await post('CreateOrUpdate', [rec(WF_ITEM)], 'create the workflow fixture item'), 'create workflow fixture item'));
    const rowsBefore = itemRows(target.itemNumber, undefined, `versions of ${target.itemNumber} before the update attempt`);
    sql(`select ItemNumber, LabelType, VersionNumber, DocumentOwner, ApprovedBy from Items where ItemNumber = ${lit(target.itemNumber)} order by LabelType, VersionNumber`, `${target.itemNumber}: DocumentOwner = Workflow`);
    const r = await post('CreateOrUpdate', [{ itemNumber: target.itemNumber, labelType: target.labelType, description: 'try to update an item that is routed in a workflow', attributes: [{ shareName: 'I_Desc2', value: 'blocked' }] }], 'update an item that is routed in a workflow');
    expect(first(r.json)).toMatchObject({ itemNumber: target.itemNumber, success: false, errorMessage: `Item Number ${target.itemNumber} being routed in workflow - cannot be modified.` });
    const rowsAfter = itemRows(target.itemNumber, undefined, `versions of ${target.itemNumber} after the update attempt`);
    expect(rowsAfter.map((x) => [x.LabelType, x.VersionNumber, x.Description, x.Description2, x.ApprovedBy])).toEqual(rowsBefore.map((x) => [x.LabelType, x.VersionNumber, x.Description, x.Description2, x.ApprovedBy])); // nothing changed, no new version
    wording(`target = ${target.source === 'fixture' ? 'the fixture item' : 'an existing CL / MB item'} ${target.itemNumber} (${target.labelType}); the live check is Items.DocumentOwner = 'Workflow'`);
  });

  test(t('2.10', 'an unapproved and retired item cannot be updated'), async () => {
    mustOk(await post('CreateOrUpdate', [rec(B)], 'create B'), 'create B');
    mustOk(await retire(B), 'retire B v0 (setup)');
    expect(itemRows(B)[0]).toMatchObject({ Active: 'N', ApprovedBy: '' });
    const r = await post('CreateOrUpdate', [rec(B, { description: 'try to update' })]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: `Item Number ${B} is retired and cannot be updated.` });
  });

  test(t('2.11', 'an unrecognized shareName is skipped with a warning, the rest is applied'), async () => {
    const r = await post('CreateOrUpdate', [rec(A, { attributes: [{ shareName: 'I_Desc2', value: 'v1 again' }, { shareName: 'ZZ_NoSuchShare', value: '1' }] })]);
    expect(first(r.json)).toMatchObject({ success: true, errorMessage: '' });
    const w = first(r.json).warnings;
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ shareName: 'ZZ_NoSuchShare' });
    expect(w[0].message).toMatch(/Unrecognized/i);
    expect(itemRows(A, LT_MAIN)[1].Description2).toBe('v1 again');
    wording(`requirement: warning "Unrecognized shareNames <Values> - not applied."; live: warnings[] = ${JSON.stringify(w)}`);
  });

  test(t('2.12', 'success response format'), async () => {
    const r = await post('CreateOrUpdate', [rec(C)]);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ success: true, results: [{ itemNumber: C, success: true, errorMessage: '', warnings: [] }] });
  });

  test(t('2.13', 'failure response format'), async () => {
    const r = await post('CreateOrUpdate', [rec(B, { description: 'try to update' })]);
    expect(r.json.success).toBe(false);
    expect(first(r.json)).toMatchObject({ itemNumber: B, success: false, errorMessage: `Item Number ${B} is retired and cannot be updated.` });
  });

  // ------------------------------------------------------------------------------------------------------------------------------------------ F.3 SaveAs
  test(t('3.1', 'SaveAs creates a new item from an existing (unapproved) record'), async () => {
    const r = await post('SaveAs', [SAVE_AS(A)]);
    expect(r.status).toBe(200);
    expect(first(r.json)).toMatchObject({ itemNumber: A, success: true, errorMessage: '' });
    const rows = itemRows(A, LT_SECOND);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ VersionNumber: 0, ApprovedBy: '', Active: 'Y', LabelName: LN_SECOND });
    wording('the requirement calls the method ItemsSaveAs; the live route is Items/SaveAs');
  });

  test(t('3.2', 'SaveAs: four required properties, description optional (copied from the source)'), async () => {
    const src = last(itemRows(A, LT_MAIN));
    expect(itemRows(A, LT_SECOND)[0].Description).toBe(src.Description); // no description in the request -> copied
    mustOk(await post('CreateOrUpdate', [rec(D)], 'create D'), 'create D');
    mustOk(await approve(D), 'approve D v0 (setup)');
    const r = await post('SaveAs', [SAVE_AS(D, { description: 'Save As description' })], 'SaveAs of an approved item with a description');
    expect(first(r.json)).toMatchObject({ success: true });
    expect(itemRows(D, LT_SECOND)[0].Description).toBe('Save As description');
  });

  test(t('3.3', 'SaveAs: a missing required property is rejected'), async () => {
    for (const drop of ['itemNumber', 'sourceLabelType', 'labelType', 'labelName']) {
      const body: any = SAVE_AS(A);
      delete body[drop];
      const r = await post('SaveAs', [body], `SaveAs without ${drop}`);
      expect(first(r.json).success, drop).toBe(false);
      expect(first(r.json).errorMessage, drop).toMatch(/required/);
    }
    wording('requirement: "<Field Name> is required."; live: one combined message listing all four properties');
  });

  test(t('3.4', 'SaveAs: itemNumber + labelType must be unique and labelName must belong to the label type'), async () => {
    const dup = await post('SaveAs', [SAVE_AS(A)], 'SaveAs again (same item and label type)');
    expect(first(dup.json)).toMatchObject({ success: false, errorMessage: 'Item already exists.' });
    const wrong = await post('SaveAs', [SAVE_AS(B, { labelName: LN_MAIN })], 'SaveAs with a label name of the other label type');
    expect(first(wrong.json)).toMatchObject({ success: false, errorMessage: `Label Name ${LN_MAIN} is not associated with Label Type ${LT_SECOND}.` });
    expect(itemRows(B, LT_SECOND)).toHaveLength(0);
  });

  test(t('3.5', 'SaveAs: an existing itemNumber + labelType is rejected and nothing is created'), async () => {
    const before = itemRows(A, LT_SECOND);
    const r = await post('SaveAs', [SAVE_AS(A)]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: 'Item already exists.' });
    expect(itemRows(A, LT_SECOND)).toHaveLength(before.length);
  });

  test(t('3.6', 'SaveAs accepts a source in any approval status (approved, unapproved, retired)'), async () => {
    const retired = await post('SaveAs', [SAVE_AS(B)], 'SaveAs of a retired, unapproved source');
    expect(first(retired.json)).toMatchObject({ itemNumber: B, success: true });
    const rows = sql<{ ItemNumber: string }>(
      `select ItemNumber from Items where LabelType = ${lit(LT_SECOND)} and ItemNumber in (${[A, B, D].map(lit).join(',')}) order by ItemNumber`, 'copies in the second label type (sources: unapproved A, retired B, approved D)');
    expect(rows.map((x) => x.ItemNumber)).toEqual([A, B, D]);
  });

  test(t('3.7', 'SaveAs copies all attributes of the source'), async () => {
    const src = last(itemRows(A, LT_MAIN));
    const dst = itemRows(A, LT_SECOND)[0];
    expect(dst.Description2).toBe(src.Description2);
    expect(dst.Description3).toBe(src.Description3);
    expect(dst.Description2).not.toBe('');
  });

  test(t('3.8', 'SaveAs: a shareName that cannot be resolved is skipped with a warning'), async () => {
    // SaveAsRequest has no attributes property: the warning comes from source attributes whose shareName is not defined for the NEW label type.
    const r = await post('SaveAs', [SAVE_AS(C)]);
    expect(first(r.json)).toMatchObject({ itemNumber: C, success: true, errorMessage: '' });
    const unresolved = first(r.json).warnings.filter((w: any) => /Unrecognized/i.test(w.message));
    expect(unresolved.length).toBeGreaterThan(0);
    const names = unresolved.map((w: any) => w.shareName);
    const defs = sql<{ LabelType: string; ReplacementString: string }>(
      `select LabelType, ReplacementString from FieldDefs where FileForm = 'Items' and ReplacementString in (${names.map(lit).join(',')}) and LabelType in (${[LT_MAIN, LT_SECOND, ''].map(lit).join(',')}) order by ReplacementString, LabelType`,
      `field definitions of the unrecognized shareNames (defined for ${LT_MAIN}, not for ${LT_SECOND})`);
    for (const n of names) {
      expect(defs.some((d) => d.ReplacementString === n && d.LabelType === LT_MAIN), `${n} is defined for the source label type`).toBe(true);
      expect(defs.some((d) => d.ReplacementString === n && d.LabelType === LT_SECOND), `${n} is not defined for the new label type`).toBe(false);
    }
    expect(itemRows(C, LT_SECOND)).toHaveLength(1); // the record is still created
    wording(`requirement: warning "Unrecognized shareName <Value> - not applied."; live: warnings[] entries {shareName, message:"Unrecognized share name"} (${names.join(', ')})`);
  });

  test(t('3.9', 'SaveAs: label type security is checked'), async () => {
    const r = await post('SaveAs', [SAVE_AS(A, { labelType: LT_DENIED })]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: DENIED_MSG(LT_DENIED) });
  });

  test(t('3.10', 'SaveAs success response format'), async () => {
    mustOk(await post('CreateOrUpdate', [rec(E)], 'create E (setup)'), 'create E');
    const ok = await post('SaveAs', [SAVE_AS(E)], 'SaveAs success');
    expect(ok.status).toBe(200);
    expect(ok.json.success).toBe(true);
    expect(ok.json.results).toHaveLength(1);
    expect(first(ok.json)).toMatchObject({ itemNumber: E, success: true, errorMessage: '' });
    const w = first(ok.json).warnings;
    expect(Array.isArray(w)).toBe(true);
    w.forEach((x: any) => expect(Object.keys(x).sort()).toEqual(['message', 'shareName']));
    const protectedOnes = w.filter((x: any) => /Protected field/i.test(x.message)).map((x: any) => x.shareName);
    if (w.length) wording(`requirement example shows "warnings": []; live: ${w.length} warning(s) on every SaveAs, ${protectedOnes.length} of them "Protected field — not applied" for the identity shareNames (${protectedOnes.join(', ')}), the rest unrecognized shareNames`);
  });

  test(t('3.11', 'SaveAs failure response format'), async () => {
    const r = await post('SaveAs', [SAVE_AS(E)]);
    expect(r.json.success).toBe(false);
    expect(first(r.json)).toMatchObject({ itemNumber: E, success: false, errorMessage: 'Item already exists.' });
  });

  // ------------------------------------------------------------------------------------------------------------------------------------------ F.4 RetireOrUnretire
  test(t('4.1', 'retire / unretire works on an approved item as on an unapproved one'), async () => {
    const r = await retire(E);
    expect(first(r.json)).toMatchObject({ itemNumber: E, success: true });
    expect(itemRows(E, LT_MAIN)[0]).toMatchObject({ Active: 'N', ApprovedBy: '' }); // an UNAPPROVED item (an approved one is retired in F.4.2)
  });

  test(t('4.2', 'the request carries itemNumber, labelType, versionNumber and retire'), async () => {
    const r = await retire(D, 0, true);
    expect(first(r.json)).toMatchObject({ itemNumber: D, success: true });
    expect(itemRows(D, LT_MAIN)[0].Active).toBe('N');
  });

  test(t('4.3', 'a missing required property is rejected'), async () => {
    const full: any = { itemNumber: D, labelType: LT_MAIN, versionNumber: 0, retire: true };
    for (const drop of ['itemNumber', 'labelType', 'versionNumber', 'retire']) {
      const body = { ...full };
      delete body[drop];
      const r = await post('RetireOrUnretire', [body], `RetireOrUnretire without ${drop}`);
      expect(first(r.json).success, drop).toBe(false);
      expect(first(r.json).errorMessage, drop).toMatch(/required/);
    }
    wording('requirement: "<Field Name> is required."; live: one combined message listing all four properties');
  });

  test(t('4.4', 'label type security is checked'), async () => {
    const r = await post('RetireOrUnretire', [{ itemNumber: D, labelType: LT_DENIED, versionNumber: 0, retire: true }]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: DENIED_MSG(LT_DENIED) });
  });

  test(t('4.5', 'retire sets Active = false and EffectiveEnd to the current server time'), async () => {
    mustOk(await post('CreateOrUpdate', [rec(F)], 'create F'), 'create F');
    mustOk(await approve(F), 'approve F v0 (setup)');
    const r = await retire(F);
    expect(first(r.json).success).toBe(true);
    const row = itemRows(F, LT_MAIN)[0];
    expect(row.Active).toBe('N');
    expect(Math.abs(row.secsSinceEnd)).toBeLessThan(120);
  });

  test(t('4.6', 'retire = false unretires the record'), async () => {
    const r = await retire(F, 0, false, { effectiveEnd: '2090-06-30T00:00:00' });
    expect(first(r.json).success).toBe(true);
    const row = itemRows(F, LT_MAIN)[0];
    expect(row.Active).toBe('Y');
    expect(row.EffectiveEnd.startsWith('2090-06-30')).toBe(true);
  });

  test(t('4.7', 'unretire without effectiveEnd defaults it to 2099-12-31'), async () => {
    mustOk(await retire(F), 'retire F again (setup)');
    const r = await retire(F, 0, false);
    expect(first(r.json).success).toBe(true);
    const row = itemRows(F, LT_MAIN)[0];
    expect(row.Active).toBe('Y');
    expect(row.EffectiveEnd.startsWith('2099-12-31')).toBe(true);
  });

  test(t('4.8', 'retire success response format'), async () => {
    const r = await retire(F);
    expect(r.json).toEqual({ success: true, results: [{ itemNumber: F, success: true, errorMessage: '', warnings: [] }] });
    mustOk(await retire(F, 0, false), 'unretire F (setup)');
  });

  test(t('4.9', 'retire failure response format'), async () => {
    const r = await post('RetireOrUnretire', [{ itemNumber: F, labelType: LT_MAIN, versionNumber: 99, retire: true }]);
    expect(r.json.success).toBe(false);
    expect(first(r.json)).toMatchObject({ itemNumber: F, success: false, errorMessage: `Item Number ${F} Version 99 with Label Type ${LT_MAIN} was not found.` });
  });

  // ------------------------------------------------------------------------------------------------------------------------------------------ F.5 Approve
  test(t('5.1', 'Approve approves an item record'), async () => {
    mustOk(await post('CreateOrUpdate', [rec(W)], 'create W'), 'create W');
    const r = await approve(W);
    expect(first(r.json)).toMatchObject({ itemNumber: W, success: true });
    expect(itemRows(W)[0].ApprovedBy).not.toBe('');
    wording('the requirement calls the method ItemsApprove; the live route is Items/Approve');
  });

  test(t('5.2', 'the request carries itemNumber, versionNumber and labelType'), async () => {
    mustOk(await post('CreateOrUpdate', [rec(`${W}2`)], 'create W2'), 'create W2');
    const r = await approve(`${W}2`);
    expect(first(r.json)).toMatchObject({ success: true });
  });

  test(t('5.3', 'a missing required property is rejected'), async () => {
    const full: any = { itemNumber: W, labelType: LT_MAIN, versionNumber: 0 };
    for (const drop of ['itemNumber', 'labelType', 'versionNumber']) {
      const body = { ...full };
      delete body[drop];
      const r = await post('Approve', [body], `Approve without ${drop}`);
      expect(first(r.json).success, drop).toBe(false);
      expect(first(r.json).errorMessage, drop).toMatch(/required/);
    }
    wording('requirement: "<Field Name> is required."; live: one combined message listing the three properties');
  });

  test(t('5.4', 'label type security is checked'), async () => {
    const r = await approve(W, LT_DENIED);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: DENIED_MSG(LT_DENIED) });
  });

  test(t('5.5', 'the approver is recorded'), async () => {
    const row = itemRows(W)[0];
    expect(row.ApprovedBy).toBe(API_USER);
    wording('the Approve request has no approvedBy property: the live API records the AUTHENTICATED user as approver, not a user id from the request');
  });

  test(t('5.6', 'approvalDateTime defaults to the current server time; a supplied value is stored'), async () => {
    const row = itemRows(W)[0];
    expect(Math.abs(row.secsSinceApproval)).toBeLessThan(600);
    mustOk(await post('CreateOrUpdate', [rec(`${W}3`)], 'create W3'), 'create W3');
    const r = await approve(`${W}3`, LT_MAIN, 0, { approvalDateTime: '2026-01-15T10:30:00' });
    expect(first(r.json).success).toBe(true);
    expect(itemRows(`${W}3`)[0].ApprovalDateTime.startsWith('2026-01-15T10:30:00')).toBe(true);
  });

  test(t('5.7', 'approve success response format'), async () => {
    mustOk(await post('CreateOrUpdate', [rec(`${W}4`)], 'create W4'), 'create W4');
    const r = await approve(`${W}4`);
    expect(r.json).toEqual({ success: true, results: [{ itemNumber: `${W}4`, success: true, errorMessage: '', warnings: [] }] });
  });

  test(t('5.8', 'approve failure response format (already approved)'), async () => {
    const r = await approve(W);
    expect(r.json.success).toBe(false);
    expect(first(r.json)).toMatchObject({ itemNumber: W, success: false, errorMessage: `Item Number ${W} Version 0 is already approved.` });
  });

  // ------------------------------------------------------------------------------------------------------------------------------------------ F.6-F.8 GET
  const SHAPE = ['itemNumber', 'description', 'labelType', 'labelName', 'versionNumber', 'active', 'effectiveBegin', 'effectiveEnd', 'approvedBy', 'approvalDateTime', 'attributes'].sort();
  const expectShape = (rec0: any) => {
    expect(Object.keys(rec0).sort()).toEqual(SHAPE);
    expect(Array.isArray(rec0.attributes)).toBe(true);
    if (rec0.attributes.length) expect(Object.keys(rec0.attributes[0]).sort()).toEqual(['shareName', 'value']);
  };

  test(t('6.1', 'GetByLabelType returns the records of a label type'), async () => {
    const r = await get('GetByLabelType', { labelType: LT_SECOND });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.results.map((x: any) => x.itemNumber)).toEqual(expect.arrayContaining([A, B, D]));
    wording('the requirement calls the method ItemsGetByLabelType; the live route is Items/GetByLabelType');
  });

  test(t('6.2', 'labelType is the query parameter'), async () => {
    const r = await get('GetByLabelType', { labelType: LT_SECOND });
    expect(r.json.results.every((x: any) => x.labelType === LT_SECOND)).toBe(true);
  });

  test(t('6.3', 'labelType missing is rejected'), async () => {
    const r = await get('GetByLabelType', {});
    expect(r.status).toBe(400);
    expect(r.json).toMatchObject({ success: false, errorMessage: 'Label Type is required.' });
  });

  test(t('6.4', 'label type security is checked'), async () => {
    const denied = await get('GetByLabelType', { labelType: LT_DENIED });
    expect(denied.status).toBe(400);
    expect(denied.json).toMatchObject({ success: false, errorMessage: DENIED_MSG(LT_DENIED) });
    const ok = await get('GetByLabelType', { labelType: LT_SECOND });
    expect(ok.json.success).toBe(true);
    expect(ok.json.results.length).toBeGreaterThan(0);
  });

  test(t('6.5', 'an authorized label type without records returns an empty array'), async () => {
    const r = await get('GetByLabelType', { labelType: 'CLLabelType' });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ success: true, results: [] });
  });

  test(t('6.6', 'GetByLabelType response format'), async () => {
    const r = await get('GetByLabelType', { labelType: LT_SECOND });
    const mine = r.json.results.find((x: any) => x.itemNumber === A);
    expectShape(mine);
    expect(mine).toMatchObject({ labelType: LT_SECOND, labelName: LN_SECOND, versionNumber: 0, active: true, approvedBy: '' });
  });

  test(t('7.1', 'GetByLabelName returns the records of a label name'), async () => {
    const r = await get('GetByLabelName', { labelName: LN_SECOND });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.results.map((x: any) => x.itemNumber)).toEqual(expect.arrayContaining([A, B, D]));
  });

  test(t('7.2', 'labelName is the query parameter'), async () => {
    const r = await get('GetByLabelName', { labelName: LN_SECOND });
    expect(r.json.results.every((x: any) => x.labelName === LN_SECOND)).toBe(true);
  });

  test(t('7.3', 'labelName missing is rejected'), async () => {
    const r = await get('GetByLabelName', {});
    expect(r.status).toBe(400);
    expect(r.json).toMatchObject({ success: false, errorMessage: 'Label Name is required.' });
  });

  test(t('7.5', 'an unknown label name returns an empty array'), async () => {
    const r = await get('GetByLabelName', { labelName: `NoSuchLabelName${RUN}` });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ success: true, results: [] });
  });

  test(t('7.6', 'GetByLabelName response format'), async () => {
    const r = await get('GetByLabelName', { labelName: LN_SECOND });
    expectShape(r.json.results.find((x: any) => x.itemNumber === A));
  });

  test(t('8.1', 'GetByItemNumber returns all versions of an item'), async () => {
    const r = await get('GetByItemNumber', { itemNumber: A });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    const got = r.json.results.map((x: any) => `${x.labelType}|${x.versionNumber}`).sort();
    expect(got).toEqual([`${LT_MAIN}|0`, `${LT_MAIN}|1`, `${LT_SECOND}|0`].sort());
    wording('the requirement calls the method ItemsGetByItemNumber; the live route is Items/GetByItemNumber');
  });

  test(t('8.2', 'itemNumber is the query parameter'), async () => {
    const r = await get('GetByItemNumber', { itemNumber: D });
    expect(r.json.results.every((x: any) => x.itemNumber === D)).toBe(true);
  });

  test(t('8.3', 'itemNumber missing is rejected'), async () => {
    const r = await get('GetByItemNumber', {});
    expect(r.status).toBe(400);
    expect(r.json).toMatchObject({ success: false, errorMessage: 'Item Number is required.' });
  });

  test(t('8.5', 'an unknown item number returns an empty array'), async () => {
    const r = await get('GetByItemNumber', { itemNumber: `NoSuchItem${RUN}` });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ success: true, results: [] });
  });

  test(t('8.6', 'GetByItemNumber response format'), async () => {
    const r = await get('GetByItemNumber', { itemNumber: A });
    r.json.results.forEach(expectShape);
  });

  // security phase: LT_MBLT1 is revoked from the CL group for these two tests (restored right after, and again by the last test)
  test(t('7.4', 'GetByLabelName: records of a label type the user may not see are disallowed'), async ({ browser }) => {
    test.setTimeout(240_000);
    await setGroupProcess(browser, `LT_${LT_SECOND}`, false);
    try {
      expect(lt(`LT_${LT_SECOND}`)).toBe(false);
      const r = await get('GetByLabelName', { labelName: LN_SECOND });
      expect(r.status).toBe(200); // by design the status stays 200
      expect(r.json).toMatchObject({ success: false, errorMessage: 'Some records have been disallowed due to label type security.' });
      expect(r.json.results).toEqual([]);
    } finally {
      await setGroupProcess(browser, `LT_${LT_SECOND}`, true);
    }
    expect(lt(`LT_${LT_SECOND}`)).toBe(true);
  });

  test(t('8.4', 'GetByItemNumber: versions of a label type the user may not see are disallowed'), async ({ browser }) => {
    test.setTimeout(240_000);
    await setGroupProcess(browser, `LT_${LT_SECOND}`, false);
    try {
      const r = await get('GetByItemNumber', { itemNumber: A });
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ success: false, errorMessage: 'Some records have been disallowed due to label type security.' });
      expect(r.json.results.every((x: any) => x.labelType === LT_MAIN)).toBe(true);
      expect(r.json.results.length).toBe(2); // the two versions in the authorized label type are still returned
    } finally {
      await setGroupProcess(browser, `LT_${LT_SECOND}`, true);
    }
  });

  // ------------------------------------------------------------------------------------------------------------------------------------------ F.11 batches
  test(t('11.1', 'all POST endpoints take an array of records'), async () => {
    const c = await post('CreateOrUpdate', [rec(G1), rec(G2)], 'CreateOrUpdate: 2 records');
    expect(c.json.results.map((x: any) => x.success)).toEqual([true, true]);
    const s = await post('SaveAs', [SAVE_AS(G1), SAVE_AS(G2)], 'SaveAs: 2 records');
    expect(s.json.results.map((x: any) => x.success)).toEqual([true, true]);
    const a = await post('Approve', [G1, G2].map((x) => ({ itemNumber: x, labelType: LT_MAIN, versionNumber: 0 })), 'Approve: 2 records');
    expect(a.json.results.map((x: any) => x.success)).toEqual([true, true]);
    const r = await post('RetireOrUnretire', [G1, G2].map((x) => ({ itemNumber: x, labelType: LT_MAIN, versionNumber: 0, retire: true })), 'RetireOrUnretire: 2 records');
    expect(r.json.results.map((x: any) => x.success)).toEqual([true, true]);
    expect(itemRows(G1)).toHaveLength(2);
    expect(itemRows(G2)).toHaveLength(2);
  });

  test(t('11.2', 'every record in a batch is processed independently'), async () => {
    const bad = { itemNumber: H2, labelName: LN_MAIN, description: 'no label type' };
    const r = await post('CreateOrUpdate', [rec(H1), bad, rec(`${H2}x`)], 'batch: valid, invalid, valid');
    expect(r.json.results.map((x: any) => x.success)).toEqual([true, false, true]);
    expect(itemRows(H1)).toHaveLength(1);
    expect(itemRows(`${H2}x`)).toHaveLength(1);
    expect(itemRows(H2)).toHaveLength(0);
  });

  test(t('11.3', 'top-level success is true only if every record succeeded; every record has success and errorMessage'), async () => {
    const allOk = await post('CreateOrUpdate', [rec(`${H1}1`), rec(`${H1}2`)], 'batch: all succeed');
    expect(allOk.json.success).toBe(true);
    const mixed = await post('CreateOrUpdate', [rec(`${H1}3`), { itemNumber: `${H1}4` }], 'batch: one fails');
    expect(mixed.json.success).toBe(false);
    for (const x of [...allOk.json.results, ...mixed.json.results]) {
      expect(typeof x.success).toBe('boolean');
      expect(typeof x.errorMessage).toBe('string');
      if (x.success) expect(x.errorMessage).toBe('');
      else expect(x.errorMessage).not.toBe('');
    }
  });

  test(t('11.4', 'a record may carry a warnings array; warnings do not change success'), async () => {
    const plain = await post('CreateOrUpdate', [rec(`${H1}5`)], 'no warnings');
    expect(first(plain.json).warnings).toEqual([]);
    const warned = await post('CreateOrUpdate', [rec(`${H1}6`, { attributes: [{ shareName: 'ZZ_NoSuchShare', value: '1' }] })], 'unrecognized shareName');
    expect(warned.json.success).toBe(true);
    expect(first(warned.json)).toMatchObject({ success: true, errorMessage: '' });
    expect(first(warned.json).warnings.length).toBe(1);
  });

  // ------------------------------------------------------------------------------------------------------------------------------------------ F.12 security
  test(t('12.1', 'the security group ROBAR API Security exists and holds API_Items'), async () => {
    const g = sql<{ ProcessName: string; Authorized: string }>(`select ProcessName, Authorized from [security] where UserGroup = 'ROBAR_API_Security' and ProcessName = 'API_Items'`, 'security: ROBAR_API_Security / API_Items');
    expect(g).toEqual([{ ProcessName: 'API_Items', Authorized: 'Y' }]);
    const exists = sql<{ n: number }>(`select count(*) n from Groups where GroupID = 'ROBAR_API_Security'`, 'Groups: ROBAR_API_Security');
    expect(exists[0].n).toBe(1);
    const u = sql<{ GroupID: string }>(`select GroupID from Users where UserID = ${lit(API_USER)}`, `group of ${API_USER}`);
    note(`${API_USER} reaches the API through CLAPIGrp (a CL copy of the ROBAR_API_Security grants); no user of ROBAR_API_Security itself is used`, u);
    wording('the group id is ROBAR_API_Security (underscores); the fixture user is in the CL group CLAPIGrp, not in ROBAR_API_Security itself');
  });

  test(t('12.2', 'a user without API_Items is rejected with the API_Items message'), async () => {
    const calls: Array<['GET' | 'POST', string, any]> = [
      ['POST', 'CreateOrUpdate', [rec(W)]], ['POST', 'SaveAs', [SAVE_AS(W)]], ['POST', 'RetireOrUnretire', [{ itemNumber: W, labelType: LT_MAIN, versionNumber: 0, retire: true }]],
      ['POST', 'Approve', [{ itemNumber: W, labelType: LT_MAIN, versionNumber: 0 }]],
      ['GET', 'GetByLabelType', { labelType: LT_SECOND }], ['GET', 'GetByLabelName', { labelName: LN_SECOND }], ['GET', 'GetByItemNumber', { itemNumber: A }],
    ];
    for (const [m, route, payload] of calls) {
      const r = await http(m, `Items/${route}`, m === 'GET' ? { query: payload, user: NO_API_USER } : { body: payload, user: NO_API_USER, title: `${route} as ${NO_API_USER}` });
      expect(r.status, route).toBe(401);
      expect(r.text, route).toContain('User not authorized for this task: API_Items.');
    }
  });

  test('zz_restore security: LT_MBDOCX revoked, LT_MBLT1 granted on CLAPIGrp', async ({ browser }) => {
    test.setTimeout(240_000);
    if (lt(`LT_${LT_NON_BTW}`)) await setGroupProcess(browser, `LT_${LT_NON_BTW}`, false);
    if (!lt(`LT_${LT_SECOND}`)) await setGroupProcess(browser, `LT_${LT_SECOND}`, true);
    expect(lt(`LT_${LT_NON_BTW}`)).toBe(false);
    expect(lt(`LT_${LT_SECOND}`)).toBe(true);
  });
});
