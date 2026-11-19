// Master Data REST API (project 20260408-001, UAT_20260408-001): one test per FRS row (MDAPI.20260408.F.x.y), driven through the REST API with the CL fixture users and checked in the TST703 database
// (read-only sqlcmd). Item tests use the item schema RobarMasterData (items live in ItemHeaders + MasterData), record tests the CL non-item schema CLSchemaData (records cannot be deleted: ~10 per run);
// the empty MB fixture schema MBNonItemschema2 is only READ. Items are CLMD<run id><letter>. F.2.6 (item routed in a workflow) uses the shared workflow fixture (api-workflow-fixture.ts).
// Schema security (F.14.x) uses schemas the CL group is NOT authorized for: an item schema (Images, target = one of its existing CL* items) and a non-item schema (MBNonItemSchema, an MB-owned schema).
// Wording differences between a requirement and the live API are recorded as test annotations, not hidden. Evidence per test: runs/API/MD_<stamp>/<id>.json.
import { test, expect } from '@playwright/test';
import { API_USER, MD_DENIED_ITEM_SCHEMA, MD_DENIED_RECORD_SCHEMA, MD_EMPTY_SCHEMA, MD_ITEM_SCHEMA, MD_RECORD_SCHEMA, LT_MAIN, NO_API_USER } from './api-fixtures';
import { ensureWorkflowItem, WF_ITEM } from './api-workflow-fixture';
import { RUN_ID, http, labelNameOf, lit, markLastSetup, note, sql, useEvidence } from './api-support';

const FRS = 'MDAPI.20260408.';
const RUN = RUN_ID;
const I = (letter: string) => `CLMD${RUN}${letter}`;
const A = I('A'), B = I('B'), C = I('C'), D = I('D'), E = I('E'), F = I('F'), G = I('G'), H = I('H'), K = I('K'), L = I('L'), N = I('N');
const SCH = MD_ITEM_SCHEMA;

const t = (frs: string, text: string) => `${FRS}F.${frs} ${text}`;
const wording = (text: string) => test.info().annotations.push({ type: 'wording difference', description: text });
const first = (j: any) => j?.results?.[0];
const post = (route: string, body: unknown, title?: string) => http('POST', `MasterData/${route}`, { body, title });
const get = (route: string, query: Record<string, string>, o: { user?: string | null } = {}) => http('GET', `MasterData/${route}`, { query, ...o });
const mustOk = (r: { status: number; json: any }, what: string) => {
  markLastSetup();
  if (r.status !== 200 || r.json?.success !== true) throw new Error(`setup failed (${what}): ${r.status} ${JSON.stringify(r.json)}`);
};
const create = (item: string, attrs: Array<[string, string]> = [], description = `Master Data API test ${item}`) =>
  post('CreateOrUpdateItem', [{ itemNumber: item, description, schemaName: SCH, attributes: attrs.map(([shareName, value]) => ({ shareName, value })) }], `CreateOrUpdateItem ${item}`);
const approve = (item: string, v = 0, extra: Record<string, unknown> = {}) => post('Approve', [{ itemNumber: item, versionNumber: v, ...extra }], `Approve ${item} v${v}`);
const retire = (item: string, v = 0, flag = true, extra: Record<string, unknown> = {}) => post('Retire', [{ itemNumber: item, versionNumber: v, retire: flag, ...extra }], `${flag ? 'Retire' : 'Unretire'} ${item} v${v}`);
const attr = (shareName: string, value: string) => ({ shareName, value });
const DENIED = (s: string) => `User not authorized for this task: SCH_${s}.`;
const DISALLOWED = 'Some schemas have been disallowed due to Schema Security.';

// ------------------------------------------------------------------------------------------------------------------------------------------------ database helpers (read only)
interface ItemRow {
  ItemNumber: string; VersionNumber: number; ApprovedBy: string; ApprovalDateTime: string | null; EffectiveBegin: string; EffectiveEnd: string; Description: string; Active: boolean; SchemaName: string;
  BoxName: string | null; FdaClass: string | null; DevCount: number | null; secsApproval: number | null; endDate: string; today: string;
}
const COLS = 'h.ItemNumber, h.VersionNumber, h.ApprovedBy, h.ApprovalDateTime, h.EffectiveBegin, h.EffectiveEnd, h.Description, h.Active, s.SchemaName, m.Text19 BoxName, m.Text25 FdaClass, m.Int1 DevCount';
const mdItems = (item: string, title?: string) =>
  sql<ItemRow>(
    `select ${COLS}, case when h.ApprovalDateTime > '1901-01-01' then datediff_big(second, h.ApprovalDateTime, getdate()) end secsApproval, convert(varchar(10), h.EffectiveEnd, 120) endDate, convert(varchar(10), getdate(), 120) today ` +
      `from ItemHeaders h join MasterData m on m.Id = h.MasterDataId join MasterDataSchemas s on s.Id = m.MasterDataSchemaId where h.ItemNumber = ${lit(item)} order by h.VersionNumber`,
    title ?? `Master data item rows of ${item}`,
    { query: `select ${COLS} from ItemHeaders h join MasterData m on m.Id = h.MasterDataId join MasterDataSchemas s on s.Id = m.MasterDataSchemaId where h.ItemNumber = ${lit(item)} order by h.VersionNumber`, hide: ['secsApproval', 'endDate', 'today'] },
  );
const record = (id: number) => sql<{ Id: number; Text2: string | null; Text5: string | null; Int1: number | null; SchemaName: string }>(
  `select m.Id, m.Text2, m.Text5, m.Int1, s.SchemaName from MasterData m join MasterDataSchemas s on s.Id = m.MasterDataSchemaId where m.Id = ${id}`, `MasterData record ${id}`);
const unapprovedItemOf = (schema: string) => sql<{ ItemNumber: string }>(
  `select top 1 h.ItemNumber from ItemHeaders h join MasterData m on m.Id = h.MasterDataId join MasterDataSchemas s on s.Id = m.MasterDataSchemaId where s.SchemaName = ${lit(schema)} and h.ItemNumber like 'CL%' and (h.ApprovedBy is null or h.ApprovedBy = '') and h.VersionNumber = 0 and not exists (select 1 from ItemHeaders x where x.ItemNumber = h.ItemNumber and x.VersionNumber > 0) order by h.ItemNumber`,
  `an existing unapproved CL item in the item schema ${schema}`)[0]?.ItemNumber;

test.use({ actionTimeout: 20_000 });

test.describe('Master Data REST API (project 20260408-001)', () => {
  useEvidence('MD');
  test.setTimeout(180_000);

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.1 authentication
  test(t('1.1', 'every call requires a valid user id and password'), async () => {
    const calls: Array<['GET' | 'POST', string, any]> = [
      ['POST', 'CreateOrUpdateItem', [{ itemNumber: N, description: 'x', schemaName: SCH }]], ['POST', 'Create', [{ schemaName: MD_RECORD_SCHEMA }]], ['POST', 'CreateNewVersion', [{ itemNumber: N }]],
      ['POST', 'SaveAs', [{ sourceItemNumber: N, sourceVersionNumber: 0, newItemNumber: `${N}x` }]], ['POST', 'Update', [{ masterDataId: 1, attributes: [attr('cl_plain', 'x')] }]],
      ['POST', 'Retire', [{ itemNumber: N, versionNumber: 0, retire: true }]], ['POST', 'Approve', [{ itemNumber: N, versionNumber: 0 }]],
      ['GET', 'GetBySchemaName', { schemaName: MD_EMPTY_SCHEMA }], ['GET', 'GetByItemNumber', { itemNumber: N }],
    ];
    for (const [m, route, payload] of calls) {
      const none = await http(m, `MasterData/${route}`, m === 'GET' ? { query: payload, user: null } : { body: payload, user: null, title: `${route}: no credentials` });
      expect(none.status, `${route} without credentials`).toBe(401);
      const bad = await http(m, `MasterData/${route}`, m === 'GET' ? { query: payload, user: 'CLAPIUnknown01', password: 'NotThePassword1' } : { body: payload, user: 'CLAPIUnknown01', password: 'NotThePassword1', title: `${route}: unknown user` });
      expect(bad.status, `${route} with an unknown user`).toBe(401);
    }
    expect(mdItems(N)).toHaveLength(0); // nothing was written
  });

  test(t('1.2', "GlobalSetting 'MaxAPILoginFailuresPerMinute' is 10"), async () => {
    const r = sql<{ Value: string }>(`select Value from GlobalSettings where SettingName = 'MaxAPILoginFailuresPerMinute'`, 'GlobalSettings: MaxAPILoginFailuresPerMinute');
    expect(r).toHaveLength(1);
    expect(r[0].Value).toBe('10');
    wording('only the current value can be checked on a live system, not that it is the install default');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.2 CreateOrUpdateItem
  test(t('2.1', 'POST CreateOrUpdateItem creates and updates master data items'), async () => {
    const c = await create(A, [['md_boxname', 'box v0'], ['md_devcount', '7']]);
    expect(c.status).toBe(200);
    expect(first(c.json)).toMatchObject({ itemNumber: A, success: true, errorMessage: '' });
    const u = await create(A, [['md_boxname', 'box updated']], `Master Data API test ${A} updated`);
    expect(first(u.json)).toMatchObject({ itemNumber: A, success: true });
    expect(mdItems(A)).toHaveLength(1);
    wording('the requirement calls the method MasterDataCreateOrUpdateItem; the live route is MasterData/CreateOrUpdateItem');
  });

  test(t('2.2', 'itemNumber, description and schemaName are required; attributes are optional'), async () => {
    const full: any = { itemNumber: E, description: 'required test', schemaName: SCH };
    for (const drop of ['itemNumber', 'description', 'schemaName']) {
      const body = { ...full };
      delete body[drop];
      const r = await post('CreateOrUpdateItem', [body], `CreateOrUpdateItem without ${drop}`);
      expect(first(r.json).success, drop).toBe(false);
      expect(first(r.json).errorMessage, drop).toBe('ItemNumber, Description, and SchemaName are required.');
    }
    expect(mdItems(E)).toHaveLength(0);
    const ok = await post('CreateOrUpdateItem', [full], 'CreateOrUpdateItem without attributes');
    expect(first(ok.json)).toMatchObject({ success: true, errorMessage: '' });
    expect(mdItems(E)).toHaveLength(1);
    wording('requirement: required properties itemNumber, description, schemaName; live: one combined message "ItemNumber, Description, and SchemaName are required."');
  });

  test(t('2.3', 'a new itemNumber creates a new record with the attributes applied'), async () => {
    const r = await create(F, [['md_boxname', 'new box'], ['md_fdaclass', 'II'], ['md_devcount', '3'], ['md_no_such_share', 'x']]);
    expect(first(r.json).success).toBe(true);
    expect(first(r.json).warnings).toEqual([{ shareName: 'md_no_such_share', message: 'Unrecognized share name' }]);
    const rows = mdItems(F);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ VersionNumber: 0, ApprovedBy: '', Active: true, SchemaName: SCH, BoxName: 'new box', FdaClass: 'II', DevCount: 3 });
    expect(rows[0].endDate).toBe('2099-12-31');
  });

  test(t('2.4', 'an existing item with an unapproved version is updated in place: no new version'), async () => {
    const r = await create(A, [['md_boxname', 'box in place'], ['md_fdaclass', 'III']], `Master Data API test ${A} in place`);
    expect(first(r.json).success).toBe(true);
    const rows = mdItems(A);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ VersionNumber: 0, ApprovedBy: '', BoxName: 'box in place', FdaClass: 'III', DevCount: 7, Description: `Master Data API test ${A} in place` });
  });

  test(t('2.5', 'an existing approved item gets a new version based on the latest approved one'), async () => {
    mustOk(await approve(A), 'approve A v0 (setup)');
    const r = await create(A, [['md_boxname', 'box v1']]);
    expect(first(r.json)).toMatchObject({ success: true, errorMessage: '' });
    const rows = mdItems(A);
    expect(rows.map((x) => x.VersionNumber)).toEqual([0, 1]);
    expect(rows[0]).toMatchObject({ ApprovedBy: API_USER, BoxName: 'box in place' }); // the approved version is untouched
    expect(rows[1]).toMatchObject({ ApprovedBy: '', Active: true, BoxName: 'box v1', FdaClass: 'III', DevCount: 7 }); // copied from v0, new attribute applied
  });

  test(t('2.6', 'an item routed in an active workflow cannot be modified'), async ({ browser }) => {
    test.setTimeout(420_000);
    const target = await ensureWorkflowItem(browser, async () => {
      const ln = labelNameOf(LT_MAIN);
      mustOk(await http('POST', 'Items/CreateOrUpdate', { body: [{ itemNumber: WF_ITEM, labelType: LT_MAIN, labelName: ln, description: `Items API test ${WF_ITEM}` }], title: 'create the workflow fixture item (Items API)' }), 'create workflow fixture item');
    });
    const before = mdItems(target.itemNumber);
    const r = await create(target.itemNumber, [['md_boxname', 'blocked']]);
    expect(first(r.json)).toMatchObject({ itemNumber: target.itemNumber, success: false, errorMessage: 'Item being routed in workflow – cannot be modified.' });
    expect(mdItems(target.itemNumber).map((x) => [x.VersionNumber, x.BoxName])).toEqual(before.map((x) => [x.VersionNumber, x.BoxName])); // nothing created or changed
    wording(`target = ${target.source === 'fixture' ? 'the fixture item' : 'an existing CL / MB item'} ${target.itemNumber}; the check is Items.DocumentOwner = 'Workflow' (the Items table), also for an item that has no master data record yet`);
  });

  test(t('2.7', 'an unapproved and retired item cannot be updated'), async () => {
    mustOk(await create(B), 'create B');
    mustOk(await retire(B), 'retire B v0 (setup)');
    expect(mdItems(B)[0]).toMatchObject({ Active: false, ApprovedBy: '' });
    const r = await create(B, [['md_boxname', 'try']]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: `Item Number ${B} is retired and cannot be updated.` });
    expect(mdItems(B)[0].BoxName).toBeNull();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.3 Create (non-item schema)
  test(t('3.1', 'POST Create creates a master data record for a non-item schema'), async () => {
    const r = await post('Create', [{ schemaName: MD_RECORD_SCHEMA, attributes: [attr('cl_plain', `rec ${RUN}`), attr('cl_count', '5')] }]);
    expect(r.status).toBe(200);
    expect(first(r.json)).toMatchObject({ success: true, errorMessage: '' });
    const rec = record(first(r.json).masterDataId);
    expect(rec).toHaveLength(1);
    expect(rec[0]).toMatchObject({ SchemaName: MD_RECORD_SCHEMA, Text5: `rec ${RUN}`, Int1: 5 });
    wording('the requirement calls the method MasterDataCreate; the live route is MasterData/Create');
  });

  test(t('3.2', 'schemaName is required; attributes are optional'), async () => {
    const none = await post('Create', [{ attributes: [attr('cl_plain', 'x')] }], 'Create without schemaName');
    expect(first(none.json)).toMatchObject({ success: false, errorMessage: 'Schema Name is required.' });
    const ok = await post('Create', [{ schemaName: MD_RECORD_SCHEMA }], 'Create without attributes');
    expect(first(ok.json)).toMatchObject({ success: true, errorMessage: '' });
    expect(record(first(ok.json).masterDataId)).toHaveLength(1);
  });

  test(t('3.3', 'the response returns the MasterDataId of the new record'), async () => {
    const r = await post('Create', [{ schemaName: MD_RECORD_SCHEMA, attributes: [attr('cl_plain', `id ${RUN}`)] }]);
    const id = first(r.json).masterDataId;
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThan(0);
    expect(record(id)[0].Text5).toBe(`id ${RUN}`);
    const g = await get('GetBySchemaName', { schemaName: MD_RECORD_SCHEMA });
    expect(g.json.records.some((x: any) => x.masterDataId === id)).toBe(true);
  });

  test(t('3.4', 'an unknown schema, or one that is not a non-item schema, is rejected'), async () => {
    const unknown = await post('Create', [{ schemaName: `NoSuchSchema${RUN}` }], 'Create in an unknown schema');
    expect(first(unknown.json)).toMatchObject({ success: false, errorMessage: `SchemaName NoSuchSchema${RUN} does not exist.` });
    const itemSchema = await post('Create', [{ schemaName: SCH }], 'Create in an ITEM schema');
    expect(first(itemSchema.json)).toMatchObject({ success: false, errorMessage: `SchemaName ${SCH} does not exist.` });
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.4 CreateNewVersion
  test(t('4.1', 'CreateNewVersion creates a new unapproved version from an approved item'), async () => {
    mustOk(await create(C, [['md_boxname', 'box c'], ['md_devcount', '9']]), 'create C');
    mustOk(await approve(C), 'approve C v0 (setup)');
    const r = await post('CreateNewVersion', [{ itemNumber: C }]);
    expect(first(r.json)).toMatchObject({ itemNumber: C, success: true, errorMessage: '' });
    const rows = mdItems(C);
    expect(rows.map((x) => x.VersionNumber)).toEqual([0, 1]);
    expect(rows[1]).toMatchObject({ ApprovedBy: '', Active: true, BoxName: 'box c', DevCount: 9 });
    wording('the requirement calls the method MasterDataCreateNewVersion; the live route is MasterData/CreateNewVersion');
  });

  test(t('4.2', 'itemNumber is required'), async () => {
    const r = await post('CreateNewVersion', [{}], 'CreateNewVersion without itemNumber');
    expect(first(r.json).success).toBe(false);
    expect(first(r.json).errorMessage).toBe('Item Number is required.');
  });

  test(t('4.3', 'an unknown item, or one whose latest version is not approved, is rejected'), async () => {
    const unknown = await post('CreateNewVersion', [{ itemNumber: `NoSuchItem${RUN}` }], 'CreateNewVersion of an unknown item');
    expect(first(unknown.json)).toMatchObject({ success: false, errorMessage: `Item Number NoSuchItem${RUN} does not have a valid approved version.` });
    const unapproved = await post('CreateNewVersion', [{ itemNumber: C }], 'CreateNewVersion when the latest version (v1) is unapproved');
    expect(first(unapproved.json)).toMatchObject({ success: false, errorMessage: `Item Number ${C} does not have a valid approved version.` });
    expect(mdItems(C)).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.5 SaveAs
  test(t('5.1', 'SaveAs creates a new item from an existing record'), async () => {
    const r = await post('SaveAs', [{ sourceItemNumber: C, sourceVersionNumber: 0, newItemNumber: D }]);
    expect(first(r.json)).toMatchObject({ itemNumber: D, success: true, errorMessage: '' });
    expect(mdItems(D)).toHaveLength(1);
    wording('the requirement calls the method MasterDataSaveAs; the live route is MasterData/SaveAs');
  });

  test(t('5.2', 'sourceItemNumber, sourceVersionNumber and newItemNumber are required; attributes optionally override'), async () => {
    const full: any = { sourceItemNumber: C, sourceVersionNumber: 0, newItemNumber: `${D}x` };
    for (const drop of ['sourceItemNumber', 'sourceVersionNumber', 'newItemNumber']) {
      const body = { ...full };
      delete body[drop];
      const r = await post('SaveAs', [body], `SaveAs without ${drop}`);
      expect(first(r.json).success, drop).toBe(false);
      expect(first(r.json).errorMessage, drop).toBe('sourceItemNumber, sourceVersionNumber, and newItemNumber are required.');
    }
    expect(mdItems(`${D}x`)).toHaveLength(0);
    const ok = await post('SaveAs', [{ ...full, newItemNumber: G, attributes: [attr('md_fdaclass', 'override')] }], 'SaveAs with an attribute override');
    expect(first(ok.json).success).toBe(true);
    expect(mdItems(G)[0].FdaClass).toBe('override');
  });

  test(t('5.3', 'the new record: VersionNumber 0, unapproved, all attributes copied, overrides applied, any source status'), async () => {
    const src = mdItems(C)[0]; // approved source
    const d = mdItems(D)[0];
    expect(d).toMatchObject({ VersionNumber: 0, ApprovedBy: '', Active: true, BoxName: src.BoxName, DevCount: src.DevCount, Description: src.Description, SchemaName: SCH });
    const g = mdItems(G)[0];
    expect(g).toMatchObject({ VersionNumber: 0, ApprovedBy: '', BoxName: src.BoxName, DevCount: src.DevCount, FdaClass: 'override' }); // override applied, the rest copied
    const fromUnapproved = await post('SaveAs', [{ sourceItemNumber: C, sourceVersionNumber: 1, newItemNumber: H }], 'SaveAs from an UNAPPROVED source version');
    expect(first(fromUnapproved.json).success).toBe(true);
    expect(mdItems(H)[0]).toMatchObject({ VersionNumber: 0, ApprovedBy: '' });
  });

  test(t('5.4', 'an unknown source item is rejected'), async () => {
    const r = await post('SaveAs', [{ sourceItemNumber: `NoSuchItem${RUN}`, sourceVersionNumber: 0, newItemNumber: `${D}y` }]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: `Item Number NoSuchItem${RUN} does not exist.` });
    expect(mdItems(`${D}y`)).toHaveLength(0);
  });

  test(t('5.5', 'an existing newItemNumber is rejected'), async () => {
    const r = await post('SaveAs', [{ sourceItemNumber: C, sourceVersionNumber: 0, newItemNumber: D }]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: `Item Number ${D} already exists and cannot be used for a Save As operation.` });
    expect(mdItems(D)).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.6 Update (non-item record)
  let recId = 0;
  test(t('6.1', 'POST Update changes attributes of an existing non-item record'), async () => {
    const c = await post('Create', [{ schemaName: MD_RECORD_SCHEMA, attributes: [attr('cl_plain', `before ${RUN}`), attr('cl_count', '1')] }], 'create a record to update');
    mustOk(c, 'create record');
    recId = first(c.json).masterDataId;
    const r = await post('Update', [{ masterDataId: recId, attributes: [attr('cl_plain', `after ${RUN}`), attr('cl_count', '2')] }]);
    expect(first(r.json)).toMatchObject({ success: true, errorMessage: '' });
    expect(record(recId)[0]).toMatchObject({ Text5: `after ${RUN}`, Int1: 2 });
    wording('the requirement calls the method MasterDataUpdate; the live route is MasterData/Update');
  });

  test(t('6.2', 'masterDataId and a non-empty attributes array are required'), async () => {
    const noId = await post('Update', [{ attributes: [attr('cl_plain', 'x')] }], 'Update without masterDataId');
    expect(first(noId.json)).toMatchObject({ success: false, errorMessage: 'MasterDataId and a non-empty attributes array are required.' });
    const noAttrs = await post('Update', [{ masterDataId: recId }], 'Update without attributes');
    expect(first(noAttrs.json)).toMatchObject({ success: false, errorMessage: 'MasterDataId and a non-empty attributes array are required.' });
    const empty = await post('Update', [{ masterDataId: recId, attributes: [] }], 'Update with an empty attributes array');
    expect(first(empty.json).success).toBe(false);
    expect(record(recId)[0].Text5).toBe(`after ${RUN}`);
  });

  test(t('6.3', 'an unknown masterDataId is rejected'), async () => {
    const r = await post('Update', [{ masterDataId: 2000000000, attributes: [attr('cl_plain', 'x')] }]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: 'MasterDataId 2000000000 does not exist.' });
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.7 Retire
  test(t('7.1', 'Retire retires or unretires an item record'), async () => {
    mustOk(await create(K, [['md_boxname', 'retire me']]), 'create K');
    const r = await retire(K);
    expect(first(r.json)).toMatchObject({ itemNumber: K, success: true, errorMessage: '' });
    expect(mdItems(K)[0].Active).toBe(false);
    const u = await retire(K, 0, false);
    expect(first(u.json).success).toBe(true);
    expect(mdItems(K)[0].Active).toBe(true);
    wording('the requirement calls the method MasterDataRetire; the live route is MasterData/Retire');
  });

  test(t('7.2', 'itemNumber, versionNumber and the Boolean retire property are required'), async () => {
    const full: any = { itemNumber: K, versionNumber: 0, retire: true };
    for (const drop of ['itemNumber', 'versionNumber', 'retire']) {
      const body = { ...full };
      delete body[drop];
      const r = await post('Retire', [body], `Retire without ${drop}`);
      expect(first(r.json).success, drop).toBe(false);
      expect(first(r.json).errorMessage, drop).toBe('ItemNumber, VersionNumber, and Retire flag are required.');
    }
    expect(mdItems(K)[0].Active).toBe(true);
  });

  test(t('7.3', 'retire = true retires the item and sets effectiveEnd to the current server date, ignoring the request value'), async () => {
    const r = await retire(K, 0, true, { effectiveEnd: '2030-01-01T00:00:00' });
    expect(first(r.json).success).toBe(true);
    const row = mdItems(K)[0];
    expect(row.Active).toBe(false);
    expect(row.endDate).toBe(row.today); // the DATE of the server, not the supplied 2030-01-01
    wording('effectiveEnd is stored as the server DATE (midnight), not the server date and time');
  });

  test(t('7.4', 'retire = false unretires; effectiveEnd defaults to 2099-12-31 when not provided'), async () => {
    const noEnd = await retire(K, 0, false);
    expect(first(noEnd.json).success).toBe(true);
    expect(mdItems(K)[0]).toMatchObject({ Active: true });
    expect(mdItems(K)[0].endDate).toBe('2099-12-31');
    mustOk(await retire(K), 'retire K again (setup)');
    const withEnd = await retire(K, 0, false, { effectiveEnd: '2090-06-30T00:00:00' });
    expect(first(withEnd.json).success).toBe(true);
    expect(mdItems(K)[0].endDate).toBe('2090-06-30');
    mustOk(await retire(K, 0, false), 'unretire K (setup)');
  });

  test(t('7.5', 'an unknown item (version) is rejected'), async () => {
    const r = await retire(K, 99);
    expect(first(r.json).success).toBe(false);
    expect(first(r.json).errorMessage).toBe(`Item Number ${K} version 99 does not exist.`);
    const noItem = await retire(`NoSuchItem${RUN}`);
    expect(first(noItem.json).errorMessage).toBe(`Item Number NoSuchItem${RUN} version 0 does not exist.`);
    wording(`requirement: "Item Number XXXXX does not exist ."; live: "${first(r.json).errorMessage}" (names the version, lower case "version")`);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.8 Approve
  test(t('8.1', 'Approve approves a master data item record'), async () => {
    mustOk(await create(L), 'create L');
    const r = await approve(L);
    expect(first(r.json)).toMatchObject({ itemNumber: L, success: true, errorMessage: '' });
    expect(mdItems(L)[0].ApprovedBy).not.toBe('');
    wording('the requirement calls the method MasterDataApprove; the live route is MasterData/Approve');
  });

  test(t('8.2', 'itemNumber and versionNumber are required (the request has no approvedBy property)'), async () => {
    const noItem = await post('Approve', [{ versionNumber: 0 }], 'Approve without itemNumber');
    const noVer = await post('Approve', [{ itemNumber: L }], 'Approve without versionNumber');
    for (const r of [noItem, noVer]) {
      expect(first(r.json).success).toBe(false);
      expect(first(r.json).errorMessage).toBe('itemNumber, versionNumber, and approvedBy are required.');
    }
    wording('the requirement lists approvedBy as a required request property; ApproveRequest has no such property (the error text still names it): the approver is the authenticated user');
  });

  test(t('8.3', 'approvedBy is recorded; approvalDateTime defaults to the current server time'), async () => {
    const row = mdItems(L)[0];
    expect(row.ApprovedBy).toBe(API_USER);
    expect(Math.abs(row.secsApproval ?? 99999)).toBeLessThan(600);
    mustOk(await create(`${L}x`), 'create Lx');
    const r = await approve(`${L}x`, 0, { approvalDateTime: '2026-01-15T10:30:00' });
    expect(first(r.json).success).toBe(true);
    expect(mdItems(`${L}x`)[0].ApprovalDateTime?.startsWith('2026-01-15T10:30:00')).toBe(true);
    wording('requirement: approvedBy is "the value provided in the request"; live: the AUTHENTICATED user is recorded (there is no approvedBy property in the request), same as the Items API');
  });

  test(t('8.4', 'an unknown item / version combination is rejected'), async () => {
    const r = await approve(L, 99);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: `Item Number ${L} Version 99 does not exist.` });
  });

  test(t('8.5', 'an already approved record is rejected'), async () => {
    const r = await approve(L);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: `Item Number ${L} Version 0 has already been approved.` });
    wording('requirement and live message agree: "has already been approved."');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.9 GetBySchemaName
  test(t('9.1', 'GET GetBySchemaName returns all records of a non-item schema; schemaName is required'), async () => {
    const r = await get('GetBySchemaName', { schemaName: MD_RECORD_SCHEMA });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.records.length).toBeGreaterThanOrEqual(5);
    const count = sql<{ n: number }>(`select count(*) n from MasterData m join MasterDataSchemas s on s.Id = m.MasterDataSchemaId where s.SchemaName = ${lit(MD_RECORD_SCHEMA)}`, `records of ${MD_RECORD_SCHEMA}`)[0].n;
    expect(r.json.records).toHaveLength(count);
    const missing = await http('GET', 'MasterData/GetBySchemaName', { title: 'GetBySchemaName without schemaName' });
    expect(missing.status).toBe(400);
    expect(missing.json).toMatchObject({ success: false, errorMessage: 'SchemaName is required.' });
  });

  test(t('9.2', 'each record has masterDataId and an attributes array of shareName / value pairs'), async () => {
    const r = await get('GetBySchemaName', { schemaName: MD_RECORD_SCHEMA });
    const shares = sql<{ ShareName: string }>(`select f.ShareName from MasterDataSchemaFields f join MasterDataSchemas s on s.Id = f.MasterDataSchemaId where s.SchemaName = ${lit(MD_RECORD_SCHEMA)} order by f.SequenceNumber`, `fields of ${MD_RECORD_SCHEMA}`).map((x) => x.ShareName);
    for (const rec of r.json.records) {
      expect(Object.keys(rec).sort()).toEqual(['attributes', 'masterDataId']);
      expect(rec.attributes.map((a: any) => a.shareName).sort()).toEqual([...shares].sort()); // one pair per schema field (the order is not specified)
      rec.attributes.forEach((a: any) => expect(Object.keys(a).sort()).toEqual(['shareName', 'value']));
    }
    const mine = r.json.records.find((x: any) => x.masterDataId === recId);
    expect(mine.attributes.find((a: any) => a.shareName === 'cl_plain').value).toBe(`after ${RUN}`);
  });

  test(t('9.3', 'a schema without records returns an empty array'), async () => {
    const r = await get('GetBySchemaName', { schemaName: MD_EMPTY_SCHEMA });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ success: true, records: [] });
  });

  test(t('9.4', 'an unknown schema, or one that is not a non-item schema, is rejected'), async () => {
    const unknown = await get('GetBySchemaName', { schemaName: `NoSuchSchema${RUN}` });
    expect(unknown.status).toBe(404);
    expect(unknown.json).toMatchObject({ success: false, errorMessage: `SchemaName NoSuchSchema${RUN} does not exist.` });
    const item = await get('GetBySchemaName', { schemaName: SCH });
    expect(item.status).toBe(404);
    expect(item.json.errorMessage).toBe(`SchemaName ${SCH} does not exist.`);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.10 GetByItemNumber
  test(t('10.1', 'GET GetByItemNumber returns all versions of an item'), async () => {
    const r = await get('GetByItemNumber', { itemNumber: A });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.items.map((x: any) => x.versionNumber)).toEqual([0, 1]);
    const missing = await http('GET', 'MasterData/GetByItemNumber', { title: 'GetByItemNumber without itemNumber' });
    expect(missing.status).toBe(400);
    expect(missing.json).toMatchObject({ success: false, errorMessage: 'itemNumber is required.' });
  });

  test(t('10.2', 'each version has itemNumber, versionNumber, approvedBy, approvalDateTime, effectiveBegin, effectiveEnd, active and attributes'), async () => {
    const r = await get('GetByItemNumber', { itemNumber: A });
    for (const v of r.json.items) {
      expect(Object.keys(v).sort()).toEqual(['active', 'approvalDateTime', 'approvedBy', 'attributes', 'effectiveBegin', 'effectiveEnd', 'itemNumber', 'versionNumber']);
      v.attributes.forEach((a: any) => expect(Object.keys(a).sort()).toEqual(['shareName', 'value']));
    }
    const [v0, v1] = r.json.items;
    expect(v0).toMatchObject({ itemNumber: A, versionNumber: 0, approvedBy: API_USER, active: true });
    expect(v1).toMatchObject({ versionNumber: 1, approvedBy: null, active: true });
    expect(v0.attributes.find((a: any) => a.shareName === 'md_boxname').value).toBe('box in place');
    expect(v1.attributes.find((a: any) => a.shareName === 'md_boxname').value).toBe('box v1');
  });

  test(t('10.3', 'an unknown item number returns an error'), async () => {
    const r = await get('GetByItemNumber', { itemNumber: `NoSuchItem${RUN}` });
    expect(r.status).toBe(404);
    expect(r.json).toMatchObject({ success: false, errorMessage: `Item Number NoSuchItem${RUN} does not exist.` });
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.12 batches
  test(t('12.1', 'all POST endpoints take an array of records'), async () => {
    const b1 = I('P'), b2 = I('Q');
    const c = await post('CreateOrUpdateItem', [b1, b2].map((x) => ({ itemNumber: x, description: `batch ${x}`, schemaName: SCH })), 'CreateOrUpdateItem: 2 records');
    expect(c.json.results.map((x: any) => x.success)).toEqual([true, true]);
    const rec = await post('Create', [{ schemaName: MD_RECORD_SCHEMA }, { schemaName: MD_RECORD_SCHEMA }], 'Create: 2 records');
    expect(rec.json.results.map((x: any) => x.success)).toEqual([true, true]);
    const upd = await post('Update', rec.json.results.map((x: any) => ({ masterDataId: x.masterDataId, attributes: [attr('cl_plain', `batch ${RUN}`)] })), 'Update: 2 records');
    expect(upd.json.results.map((x: any) => x.success)).toEqual([true, true]);
    const ap = await post('Approve', [b1, b2].map((x) => ({ itemNumber: x, versionNumber: 0 })), 'Approve: 2 records');
    expect(ap.json.results.map((x: any) => x.success)).toEqual([true, true]);
    const nv = await post('CreateNewVersion', [b1, b2].map((x) => ({ itemNumber: x })), 'CreateNewVersion: 2 records');
    expect(nv.json.results.map((x: any) => x.success)).toEqual([true, true]);
    const sa = await post('SaveAs', [b1, b2].map((x) => ({ sourceItemNumber: x, sourceVersionNumber: 0, newItemNumber: `${x}S` })), 'SaveAs: 2 records');
    expect(sa.json.results.map((x: any) => x.success)).toEqual([true, true]);
    const rt = await post('Retire', [b1, b2].map((x) => ({ itemNumber: x, versionNumber: 1, retire: true })), 'Retire: 2 records');
    expect(rt.json.results.map((x: any) => x.success)).toEqual([true, true]);
    expect(mdItems(b1)).toHaveLength(2);
    expect(mdItems(`${b2}S`)).toHaveLength(1);
  });

  test(t('12.2', 'every record in a batch is processed independently'), async () => {
    const ok1 = I('R'), ok2 = I('T');
    const r = await post('CreateOrUpdateItem', [{ itemNumber: ok1, description: 'valid 1', schemaName: SCH }, { itemNumber: I('U'), schemaName: SCH }, { itemNumber: ok2, description: 'valid 2', schemaName: SCH }], 'batch: valid, invalid (no description), valid');
    expect(r.json.results.map((x: any) => x.success)).toEqual([true, false, true]);
    expect(mdItems(ok1)).toHaveLength(1);
    expect(mdItems(ok2)).toHaveLength(1);
    expect(mdItems(I('U'))).toHaveLength(0);
  });

  test(t('12.3', 'top-level success is true only if every record succeeded; each record has success and errorMessage'), async () => {
    const allOk = await post('CreateOrUpdateItem', [{ itemNumber: I('V'), description: 'v', schemaName: SCH }, { itemNumber: I('W'), description: 'w', schemaName: SCH }], 'batch: all succeed');
    expect(allOk.json.success).toBe(true);
    expect(allOk.json.results).toEqual([
      { itemNumber: I('V'), success: true, errorMessage: '', warnings: [] },
      { itemNumber: I('W'), success: true, errorMessage: '', warnings: [] },
    ]);
    const mixed = await post('CreateOrUpdateItem', [{ itemNumber: I('X'), description: 'x', schemaName: SCH }, { itemNumber: I('Y') }], 'batch: one fails');
    expect(mixed.json.success).toBe(false);
    for (const x of [...allOk.json.results, ...mixed.json.results]) {
      expect(typeof x.success).toBe('boolean');
      expect(typeof x.errorMessage).toBe('string');
      expect(x.success ? x.errorMessage === '' : x.errorMessage !== '').toBe(true);
    }
    const rec = await post('Create', [{ schemaName: MD_RECORD_SCHEMA }], 'Create: result carries masterDataId');
    expect(Object.keys(first(rec.json)).sort()).toEqual(['errorMessage', 'masterDataId', 'success', 'warnings']);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.13 security group and process
  test(t('13.1', 'the security group ROBAR API Security exists and holds API_MD'), async () => {
    const g = sql<{ ProcessName: string; Authorized: string }>(`select ProcessName, Authorized from [security] where UserGroup = 'ROBAR_API_Security' and ProcessName = 'API_MD'`, 'security: ROBAR_API_Security / API_MD');
    expect(g).toEqual([{ ProcessName: 'API_MD', Authorized: 'Y' }]);
    expect(sql<{ n: number }>(`select count(*) n from Groups where GroupID = 'ROBAR_API_Security'`, 'Groups: ROBAR_API_Security')[0].n).toBe(1);
    wording('the group id is ROBAR_API_Security (underscores); the fixture user is in the CL group CLAPIGrp, not in ROBAR_API_Security itself');
  });

  test(t('13.2', 'a user without API_MD is rejected with the API_MD message'), async () => {
    const calls: Array<['GET' | 'POST', string, any]> = [
      ['POST', 'CreateOrUpdateItem', [{ itemNumber: N, description: 'x', schemaName: SCH }]], ['POST', 'Create', [{ schemaName: MD_RECORD_SCHEMA }]], ['POST', 'CreateNewVersion', [{ itemNumber: A }]],
      ['POST', 'SaveAs', [{ sourceItemNumber: A, sourceVersionNumber: 0, newItemNumber: `${N}x` }]], ['POST', 'Update', [{ masterDataId: recId || 1, attributes: [attr('cl_plain', 'x')] }]],
      ['POST', 'Retire', [{ itemNumber: A, versionNumber: 0, retire: true }]], ['POST', 'Approve', [{ itemNumber: A, versionNumber: 1 }]],
      ['GET', 'GetBySchemaName', { schemaName: MD_EMPTY_SCHEMA }], ['GET', 'GetByItemNumber', { itemNumber: A }],
    ];
    for (const [m, route, payload] of calls) {
      const r = await http(m, `MasterData/${route}`, m === 'GET' ? { query: payload, user: NO_API_USER } : { body: payload, user: NO_API_USER, title: `${route} as ${NO_API_USER}` });
      expect(r.status, route).toBe(401);
      expect(r.text, route).toContain('User not authorized for this task: API_MD.');
    }
    expect(mdItems(N)).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.14 schema security
  test(t('14.1', 'a request with a schemaName the user is not authorized for is rejected with SCH_<schemaName>'), async () => {
    const item = await post('CreateOrUpdateItem', [{ itemNumber: N, description: 'x', schemaName: MD_DENIED_ITEM_SCHEMA }], 'CreateOrUpdateItem in a schema the user is not authorized for');
    expect(first(item.json)).toMatchObject({ success: false, errorMessage: DENIED(MD_DENIED_ITEM_SCHEMA) });
    const rec = await post('Create', [{ schemaName: MD_DENIED_RECORD_SCHEMA }], 'Create in a non-item schema the user is not authorized for');
    expect(first(rec.json)).toMatchObject({ success: false, errorMessage: DENIED(MD_DENIED_RECORD_SCHEMA) });
    const g = await get('GetBySchemaName', { schemaName: MD_DENIED_RECORD_SCHEMA });
    expect(g.status).toBe(401);
    expect(g.json).toMatchObject({ success: false, errorMessage: DENIED(MD_DENIED_RECORD_SCHEMA) });
    expect(mdItems(N)).toHaveLength(0);
  });

  test(t('14.2', 'a request without schemaName for an item or record of a schema the user is not authorized for is rejected'), async () => {
    const target = unapprovedItemOf(MD_DENIED_ITEM_SCHEMA);
    expect(target, `an unapproved CL item in ${MD_DENIED_ITEM_SCHEMA}`).toBeTruthy();
    const before = mdItems(target!);
    const rid = sql<{ Id: number }>(`select top 1 m.Id from MasterData m join MasterDataSchemas s on s.Id = m.MasterDataSchemaId where s.SchemaName = ${lit(MD_DENIED_RECORD_SCHEMA)} order by m.Id`, `a record of ${MD_DENIED_RECORD_SCHEMA} (MB-owned schema)`)[0].Id;
    const recBefore = record(rid);
    const calls = [
      await post('CreateNewVersion', [{ itemNumber: target }], `CreateNewVersion of ${target}`),
      await post('SaveAs', [{ sourceItemNumber: target, sourceVersionNumber: 0, newItemNumber: `${N}s` }], `SaveAs from ${target}`),
      await post('Retire', [{ itemNumber: target, versionNumber: 0, retire: true }], `Retire ${target}`),
      await post('Approve', [{ itemNumber: target, versionNumber: 0 }], `Approve ${target}`),
      await post('Update', [{ masterDataId: rid, attributes: [attr('cl_plain', 'x')] }], `Update record ${rid}`),
    ];
    for (const c of calls) expect(first(c.json), c.text).toMatchObject({ success: false, errorMessage: DISALLOWED });
    expect(mdItems(target!).map((x) => [x.VersionNumber, x.ApprovedBy, x.Active])).toEqual(before.map((x) => [x.VersionNumber, x.ApprovedBy, x.Active])); // nothing changed
    expect(mdItems(`${N}s`)).toHaveLength(0);
    expect(record(rid)).toEqual(recBefore);
    const g = await get('GetByItemNumber', { itemNumber: target! });
    note('GetByItemNumber of an item in an unauthorized schema: the versions are dropped silently', { status: g.status, body: g.json });
    expect(g.status).toBe(404);
    expect(g.json.errorMessage).toBe(`Item Number ${target} does not exist.`);
    wording('GetByItemNumber does not reject: versions of unauthorized schemas are silently dropped, so the caller sees "Item Number X does not exist." (documented in the code as a deliberate choice)');
  });
});
