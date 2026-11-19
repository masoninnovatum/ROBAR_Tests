// Destination Labeling (Deliveries) REST API (project 20260707-001, UAT_20260707-001): one test per FRS row (DLR.20260707.F.x.y), driven through the REST API with the CL fixture users and checked in
// the TST703 database (read-only sqlcmd) and, for F.6.2, in the server's InnoAPI application log. Orders are CLDL<run id><letter> (orders cannot be deleted; ~20 per run).
// F.2.4 needs ONE order whose HeaderStatus is 'Complete' and the API cannot set it: the spec creates the fixture order CLAPIDLComplete01 and the test skips with the one SQL statement to run until
// someone has completed it (then it stays complete). Not automated: F.4.6 for a REQUIRED column without default (needs a schema change; only the nullable / defaulted columns are checked).
// Wording differences between a requirement and the live API are recorded as test annotations, not hidden. Evidence per test: runs/API/DL_<stamp>/<id>.json.
import { test, expect } from '@playwright/test';
import { PASSWORD } from '../support/robar';
import { NO_API_USER, API_USER } from './api-fixtures';
import { RUN_ID, http, lit, logMark, logSince, logWait, markLastSetup, note, sql, useEvidence } from './api-support';

const FRS = 'DLR.20260707.';
const RUN = RUN_ID;
const O = (letter: string) => `CLDL${RUN}${letter}`;
const COMPLETE_ORDER = 'CLAPIDLComplete01';

const t = (frs: string, text: string) => `${FRS}F.${frs} ${text}`;
const wording = (text: string) => test.info().annotations.push({ type: 'wording difference', description: text });
const line = (item = 'ITEM1', lot = 'LOT1', qty: number | null = 10, extra: Record<string, unknown> = {}) => ({ itemNumber: item, lotNumber: lot, ...(qty === null ? {} : { orderedQuantity: qty }), ...extra });
const order = (orderNumber: string, extra: Record<string, unknown> = {}) => ({ orderNumber, destinationCode: 'NYC', shipToName: `Ship to ${orderNumber}`, detailLines: [line()], ...extra });
const post = (body: unknown, title?: string, o: Record<string, unknown> = {}) => http('POST', 'Deliveries/CreateOrUpdate', { body, title, ...o });
const get = (orderNumber: string, o: Record<string, unknown> = {}) => http('GET', 'Deliveries/GetByOrderNumber', { query: { orderNumber }, ...o });
const first = (j: any) => j?.results?.[0];
const mustOk = (r: { status: number; json: any }, what: string) => {
  markLastSetup();
  if (r.status !== 200 || r.json?.success !== true) throw new Error(`setup failed (${what}): ${r.status} ${JSON.stringify(r.json)}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------------------------------------------------------------------------------------ database helpers (read only)
const HDR = 'OrderNumber, DestinationCode, ShipToName, ShipToAddressLineOne, ShipToAddressLineTwo, SourceSystem, CreatedBy, HeaderStatus, CreatedOn, LastTouch, NAcolumn, NAcolumn2';
const DTL = 'OrderNumber, ItemNumber, LotNumber, OrderedQuantity, ScannedQuantity, LastTouch, NADetails, NADetails2';
interface Hdr { OrderNumber: string; DestinationCode: string; ShipToName: string; ShipToAddressLineOne: string; ShipToAddressLineTwo: string; SourceSystem: string; CreatedBy: string; HeaderStatus: string; CreatedOn: string; LastTouch: string; NAcolumn: string | null; NAcolumn2: string; secs: number }
interface Dtl { OrderNumber: string; ItemNumber: string; LotNumber: string; OrderedQuantity: number; ScannedQuantity: number; LastTouch: string; NADetails: string | null; NADetails2: string; secs: number }
const headers = (o: string) => sql<Hdr>(`select ${HDR}, datediff_big(second, LastTouch, getdate()) secs from PickHeader where OrderNumber = ${lit(o)}`, `PickHeader of ${o}`, { query: `select ${HDR} from PickHeader where OrderNumber = ${lit(o)}`, hide: ['secs'] });
const details = (o: string) => sql<Dtl>(`select ${DTL}, datediff_big(second, LastTouch, getdate()) secs from PickDetail where OrderNumber = ${lit(o)} order by ItemNumber, LotNumber`, `PickDetail of ${o}`, { query: `select ${DTL} from PickDetail where OrderNumber = ${lit(o)} order by ItemNumber, LotNumber`, hide: ['secs'] });
const liveColumns = (table: string) => sql<{ column_name: string; is_nullable: string; column_default: string | null }>(`select column_name, is_nullable, column_default from information_schema.columns where table_name = ${lit(table)} order by ordinal_position`, `live columns of ${table}`);
// the requirement's own lists: reserved columns (F.4.4) and columns that already have a named property (F.4.5)
const RESERVED = ['id', 'createdon', 'lasttouch', 'headerstatus', 'rowguid'];
const PK: Record<string, string[]> = { PickHeader: ['ordernumber'], PickDetail: ['ordernumber', 'itemnumber', 'lotnumber'] };
const MAPPED: Record<string, string[]> = {
  PickHeader: ['ordernumber', 'destinationcode', 'shiptoname', 'shiptoaddresslineone', 'shiptoaddresslinetwo', 'shiptoaddresslinethree', 'sourcesystem', 'createdon', 'createdby', 'headerstatus', 'lasttouch'],
  PickDetail: ['itemnumber', 'lotnumber', 'orderedquantity', 'scannedquantity', 'id', 'lasttouch'],
};
const extraColumns = (table: string) => liveColumns(table).filter((c) => ![...RESERVED, ...PK[table], ...MAPPED[table]].includes(c.column_name.toLowerCase()));

test.use({ actionTimeout: 20_000 });

test.describe('Destination Labeling REST API (project 20260707-001)', () => {
  useEvidence('DL');
  test.setTimeout(120_000);

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.1 operations and persistence
  test(t('1.1', 'two operations under /Deliveries: CreateOrUpdate and GetByOrderNumber'), async () => {
    const c = await post([order(O('a'))], 'CreateOrUpdate');
    expect(c.status).toBe(200);
    expect(first(c.json)).toMatchObject({ orderNumber: O('a'), success: true });
    const g = await get(O('a'));
    expect(g.status).toBe(200);
    expect(g.json.success).toBe(true);
    const none = await http('POST', 'Deliveries/NoSuchOperation', { body: [order(O('a'))], title: 'an operation that does not exist' });
    expect(none.status).toBe(404);
  });

  test(t('1.2', 'a delivery = one PickHeader row (OrderNumber) + PickDetail rows (OrderNumber, ItemNumber, LotNumber)'), async () => {
    mustOk(await post([order(O('b'), { detailLines: [line('ITEMA', 'L1', 5), line('ITEMA', 'L2', 6), line('ITEMB', 'L1', 7)] })], 'create with three detail lines'), 'create b');
    expect(headers(O('b'))).toHaveLength(1);
    expect(details(O('b')).map((d) => `${d.ItemNumber}|${d.LotNumber}`)).toEqual(['ITEMA|L1', 'ITEMA|L2', 'ITEMB|L1']);
    const upd = await post([{ orderNumber: O('b'), detailLines: [line('ITEMA', 'L1', 99), line('ITEMC', 'L1', 1)] }], 'update: same identity + one new line');
    expect(first(upd.json).success).toBe(true);
    const rows = details(O('b'));
    expect(rows).toHaveLength(4);
    expect(rows.find((d) => d.ItemNumber === 'ITEMA' && d.LotNumber === 'L1')?.OrderedQuantity).toBe(99);
    expect(headers(O('b'))).toHaveLength(1);
  });

  test(t('1.3', 'responses are camelCase JSON and the Accept header is ignored'), async () => {
    const r = await http('POST', 'Deliveries/CreateOrUpdate', { body: [order(O('c'))], headers: { Accept: 'application/xml' }, title: 'CreateOrUpdate with Accept: application/xml' });
    expect(r.contentType).toContain('application/json');
    expect(() => JSON.parse(r.text)).not.toThrow();
    expect(Object.keys(r.json).sort()).toEqual(['results', 'success']);
    expect(Object.keys(first(r.json)).sort()).toEqual(['errorMessage', 'orderNumber', 'success', 'warnings']);
    const g = await http('GET', 'Deliveries/GetByOrderNumber', { query: { orderNumber: O('c') }, headers: { Accept: 'application/xml' }, title: 'GetByOrderNumber with Accept: application/xml' });
    expect(g.contentType).toContain('application/json');
    expect(Object.keys(g.json).sort()).toEqual(['detailLines', 'errorMessage', 'header', 'success']);
    expect(Object.keys(g.json.header)).toEqual(expect.arrayContaining(['orderNumber', 'shipToName', 'createdBy', 'headerStatus', 'lastTouch']));
  });

  test(t('1.4', 'defaults on create: SourceSystem ROBAR, CreatedBy = API user, ScannedQuantity 0, HeaderStatus Pending'), async () => {
    mustOk(await post([order(O('d'))], 'create without sourceSystem'), 'create d');
    const h = headers(O('d'))[0];
    expect(h).toMatchObject({ SourceSystem: 'ROBAR', CreatedBy: API_USER, HeaderStatus: 'Pending' });
    expect(details(O('d'))[0].ScannedQuantity).toBe(0);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.2 CreateOrUpdate
  test(t('2.1', 'a null or empty body is rejected with BadRequest'), async () => {
    const empty = await post([], 'empty array');
    expect(empty.status).toBe(400);
    expect(first(empty.json)).toMatchObject({ success: false, errorMessage: 'Request body must be a non-empty array.' });
    const nul = await http('POST', 'Deliveries/CreateOrUpdate', { raw: 'null', title: 'JSON null body' });
    expect(nul.status).toBe(400);
    expect(first(nul.json)).toMatchObject({ success: false, errorMessage: 'Request body must be a non-empty array.' });
  });

  test(t('2.2', 'a new delivery needs at least one valid detail line (ItemNumber, LotNumber, non-negative quantity)'), async () => {
    const cases: Array<[string, any, RegExp]> = [
      ['no detail lines', { orderNumber: O('e1'), detailLines: [] }, /must include at least one detail line/],
      ['detail line without itemNumber', order(O('e2'), { detailLines: [{ lotNumber: 'L1', orderedQuantity: 1 }] }), /ItemNumber and LotNumber are required/],
      ['detail line without lotNumber', order(O('e3'), { detailLines: [{ itemNumber: 'I1', orderedQuantity: 1 }] }), /ItemNumber and LotNumber are required/],
      ['negative quantity', order(O('e4'), { detailLines: [line('I1', 'L1', -1)] }), /Quantity must be non-negative/],
      ['null detail line element', order(O('e5'), { detailLines: [null] }), /detail line must not be null/],
      ['new line without quantity', order(O('e6'), { detailLines: [line('I1', 'L1', null)] }), /Quantity is required for a new detail line/],
    ];
    for (const [what, body, msg] of cases) {
      const r = await post([body], what);
      expect(first(r.json).success, what).toBe(false);
      expect(first(r.json).errorMessage, what).toMatch(msg);
      expect(r.status, what).toBe(400); // every element failed
      expect(headers(body.orderNumber), `${what}: nothing is saved`).toHaveLength(0);
    }
  });

  test(t('2.3', 'an existing order is refreshed (last write wins); a new order is inserted'), async () => {
    mustOk(await post([order(O('f'), { shipToAddressLineOne: 'Address one', detailLines: [line('I1', 'L1', 10)] })], 'insert a new order'), 'create f');
    expect(headers(O('f'))[0]).toMatchObject({ ShipToName: `Ship to ${O('f')}`, ShipToAddressLineOne: 'Address one' });
    const u1 = await post([{ orderNumber: O('f'), shipToName: 'First write' }], 'update: header field only');
    expect(first(u1.json).success).toBe(true);
    const u2 = await post([{ orderNumber: O('f'), shipToName: 'Second write', shipToAddressLineOne: '' }], 'update: second write, explicit blank address');
    expect(first(u2.json).success).toBe(true);
    expect(headers(O('f'))[0]).toMatchObject({ ShipToName: 'Second write', ShipToAddressLineOne: '' }); // last write wins; an explicit blank overwrites
    const u3 = await post([{ orderNumber: O('f'), detailLines: [line('I1', 'L1', null)] }], 'update: detail line without quantity');
    expect(first(u3.json).success).toBe(true);
    expect(details(O('f'))[0].OrderedQuantity).toBe(10); // an omitted quantity leaves the value untouched
    expect(headers(O('f'))[0].ShipToName).toBe('Second write'); // a header without the property is untouched
  });

  test(t('2.4', "a delivery with HeaderStatus 'Complete' cannot be modified"), async () => {
    const existing = headers(COMPLETE_ORDER);
    if (!existing.length) mustOk(await post([order(COMPLETE_ORDER)], 'create the fixture order CLAPIDLComplete01'), 'create fixture');
    const now = headers(COMPLETE_ORDER)[0];
    test.skip(now.HeaderStatus !== 'Complete', `Fixture ${COMPLETE_ORDER} exists with HeaderStatus '${now.HeaderStatus}'. The API cannot complete it. Run once: update PickHeader set HeaderStatus = 'Complete' where OrderNumber = '${COMPLETE_ORDER}'`);
    const before = headers(COMPLETE_ORDER)[0];
    const r = await post([{ orderNumber: COMPLETE_ORDER, shipToName: 'must not change' }], 'update a Complete delivery');
    expect(first(r.json).success).toBe(false);
    expect(first(r.json).errorMessage).toContain("HeaderStatus of 'Complete'");
    expect(first(r.json).errorMessage).toMatch(/reopened/);
    expect(headers(COMPLETE_ORDER)[0].ShipToName).toBe(before.ShipToName);
  });

  test(t('2.5', 'one result entry per submitted element: orderNumber, success, errorMessage, warnings'), async () => {
    const r = await post([order(O('g1')), { orderNumber: O('g2') }, order(O('g3'))], 'batch of three: valid, invalid (no detail lines), valid');
    expect(r.json.results).toHaveLength(3);
    expect(r.json.results.map((x: any) => x.orderNumber)).toEqual([O('g1'), O('g2'), O('g3')]);
    for (const x of r.json.results) expect(Object.keys(x).sort()).toEqual(['errorMessage', 'orderNumber', 'success', 'warnings']);
    expect(r.json.results.map((x: any) => x.success)).toEqual([true, false, true]);
  });

  test(t('2.6', 'overall status OK when at least one element succeeds, BadRequest when every element fails'), async () => {
    const mixed = await post([order(O('h1')), { orderNumber: O('h2') }, order(O('h3'))], 'batch: two valid, one invalid');
    expect(mixed.status).toBe(200);
    expect(mixed.json.success).toBe(false); // top-level success is true only when every element succeeded
    expect(headers(O('h1'))).toHaveLength(1); // the invalid element did not stop the valid ones
    expect(headers(O('h3'))).toHaveLength(1);
    expect(headers(O('h2'))).toHaveLength(0);
    const allOk = await post([order(O('h4')), order(O('h5'))], 'batch: all valid');
    expect(allOk.status).toBe(200);
    expect(allOk.json.success).toBe(true);
    const allBad = await post([{ orderNumber: O('h6') }, { orderNumber: O('h7') }], 'batch: all invalid');
    expect(allBad.status).toBe(400);
    expect(allBad.json.success).toBe(false);
  });

  test(t('2.7', 'CreatedBy is the API user and LastTouch is updated on every affected record'), async () => {
    mustOk(await post([order(O('i'), { detailLines: [line('I1', 'L1', 1), line('I2', 'L1', 2)] })], 'create i'), 'create i');
    const h0 = headers(O('i'))[0];
    const d0 = details(O('i'));
    expect(h0.CreatedBy).toBe(API_USER);
    await sleep(1500);
    const r = await post([{ orderNumber: O('i'), shipToName: 'touched', detailLines: [line('I1', 'L1', 11), line('I2', 'L1', 22)] }], 'update header and both detail lines');
    expect(first(r.json).success).toBe(true);
    const h1 = headers(O('i'))[0];
    const d1 = details(O('i'));
    expect(h1.CreatedBy).toBe(API_USER);
    expect(new Date(h1.LastTouch).getTime()).toBeGreaterThan(new Date(h0.LastTouch).getTime());
    d1.forEach((d, i) => expect(new Date(d.LastTouch).getTime()).toBeGreaterThan(new Date(d0[i].LastTouch).getTime()));
    expect(h1.secs).toBeLessThan(120);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.3 GetByOrderNumber
  test(t('3.1', 'orderNumber is required'), async () => {
    const none = await http('GET', 'Deliveries/GetByOrderNumber', { title: 'GetByOrderNumber without orderNumber' });
    expect(none.status).toBe(400);
    expect(none.json).toMatchObject({ success: false, errorMessage: 'Order Number is required.' });
    const blank = await get('   ');
    expect(blank.status).toBe(400);
    expect(blank.json.success).toBe(false);
  });

  test(t('3.2', 'an unknown order number returns success false and BadRequest'), async () => {
    const r = await get(`CLDL${RUN}NONE`);
    expect(r.status).toBe(400);
    expect(r.json).toMatchObject({ success: false, errorMessage: `Order Number CLDL${RUN}NONE was not found.` });
  });

  test(t('3.3', 'a found delivery returns the header and all detail lines, each with a fields array'), async () => {
    mustOk(await post([order(O('j'), { detailLines: [line('I1', 'L1', 3), line('I2', 'L2', 4), line('I3', 'L3', 5)] })], 'create j'), 'create j');
    const r = await get(O('j'));
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.header.orderNumber).toBe(O('j'));
    expect(r.json.detailLines).toHaveLength(3);
    for (const d of r.json.detailLines) expect(Array.isArray(d.fields)).toBe(true);
    expect(Array.isArray(r.json.header.fields)).toBe(true);
    expect(r.json.detailLines.map((d: any) => d.orderedQuantity).sort()).toEqual([3, 4, 5]);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.4 Fields
  test(t('4.1', 'header and detail lines accept an optional Fields collection of Name / Value pairs'), async () => {
    const withFields = await post([order(O('k1'), { fields: [{ name: 'NAcolumn', value: 'hdr value' }], detailLines: [line('I1', 'L1', 1, { fields: [{ name: 'NADetails', value: 'det value' }] })] })], 'header and detail with fields');
    expect(first(withFields.json)).toMatchObject({ success: true, warnings: [] });
    const without = await post([order(O('k2'))], 'no fields at all');
    expect(first(without.json)).toMatchObject({ success: true, warnings: [] });
    const g = await get(O('k1'));
    expect(g.json.header.fields.find((f: any) => f.name === 'NAcolumn').value).toBe('hdr value');
  });

  test(t('4.2', 'on write a Fields name is matched to a live column case-insensitively; unmatched names warn and the rest is saved'), async () => {
    const r = await post([order(O('l'), {
      shipToName: 'saved despite warnings',
      fields: [{ name: 'nacolumn', value: 'lower case name' }, { name: 'HeaderColumnThatDoesNotExist', value: 'X' }],
      detailLines: [line('I1', 'L1', 1, { fields: [{ name: 'NADETAILS', value: 'upper case name' }, { name: 'DetailColumnThatDoesNotExist', value: 'Y' }] })],
    })], 'fields: case-insensitive match + two unmatched names');
    expect(first(r.json).success).toBe(true);
    const w = first(r.json).warnings;
    expect(w.map((x: any) => x.name).sort()).toEqual(['DetailColumnThatDoesNotExist', 'HeaderColumnThatDoesNotExist']);
    w.forEach((x: any) => expect(x.message).toMatch(/No matching column found/));
    expect(headers(O('l'))[0]).toMatchObject({ NAcolumn: 'lower case name', ShipToName: 'saved despite warnings' });
    expect(details(O('l'))[0].NADetails).toBe('upper case name');
    wording(`requirement: unmatched names returned "in the Warnings value"; live: warnings[] = ${JSON.stringify(w)}`);
  });

  test(t('4.3', 'on read every non-reserved, not-yet-mapped column is emitted in Fields'), async () => {
    mustOk(await post([order(O('m'), { fields: [{ name: 'NAcolumn', value: 'read me' }], detailLines: [line('I1', 'L1', 1, { fields: [{ name: 'NADetails', value: 'read me too' }] })] })], 'create m with field values'), 'create m');
    const g = await get(O('m'));
    const hdrExpected = extraColumns('PickHeader').map((c) => c.column_name).sort();
    const dtlExpected = extraColumns('PickDetail').map((c) => c.column_name).sort();
    note('columns that must appear in Fields (live columns minus reserved minus named properties)', { PickHeader: hdrExpected, PickDetail: dtlExpected });
    expect(g.json.header.fields.map((f: any) => f.name).sort()).toEqual(hdrExpected);
    expect(g.json.detailLines[0].fields.map((f: any) => f.name).sort()).toEqual(dtlExpected);
    expect(hdrExpected.length).toBeGreaterThan(0);
    expect(g.json.header.fields.find((f: any) => f.name === 'NAcolumn').value).toBe('read me');
    expect(g.json.detailLines[0].fields.find((f: any) => f.name === 'NADetails').value).toBe('read me too');
    wording('the live table already has columns added after the named properties (NAcolumn, NAcolumn2, NADetails, NADetails2): they appear in Fields with no code change; adding a NEW column during the test is not possible (read-only database access)');
  });

  test(t('4.4', 'reserved columns (Id, CreatedOn, LastTouch, HeaderStatus, primary key) are never accepted through Fields'), async () => {
    mustOk(await post([order(O('n'))], 'create n'), 'create n');
    const before = headers(O('n'))[0];
    const beforeD = details(O('n'))[0];
    const r = await post([{
      orderNumber: O('n'),
      fields: [{ name: 'HeaderStatus', value: 'Complete' }, { name: 'CreatedOn', value: '2001-01-01T00:00:00' }, { name: 'LastTouch', value: '2001-01-01T00:00:00' }, { name: 'rowguid', value: 'x' }, { name: 'OrderNumber', value: 'CHANGED' }],
      detailLines: [line('ITEM1', 'LOT1', null, { fields: [{ name: 'Id', value: 'x' }, { name: 'ItemNumber', value: 'CHANGED' }, { name: 'LotNumber', value: 'CHANGED' }] })],
    }], 'fields with reserved column names');
    expect(first(r.json).success).toBe(true);
    const w = first(r.json).warnings;
    expect(w).toHaveLength(8);
    w.forEach((x: any) => expect(x.message).toMatch(/Reserved column/));
    const after = headers(O('n'))[0];
    expect(after.HeaderStatus).toBe('Pending');
    expect(after.CreatedOn).toBe(before.CreatedOn);
    expect(headers('CHANGED')).toHaveLength(0);
    expect(details(O('n'))[0]).toMatchObject({ ItemNumber: beforeD.ItemNumber, LotNumber: beforeD.LotNumber });
  });

  test(t('4.5', 'a column supplied both as named property and in Fields: the named value wins'), async () => {
    const r = await post([order(O('o'), {
      shipToName: 'Named value', fields: [{ name: 'ShipToName', value: 'Fields value' }],
      detailLines: [line('I1', 'L1', 7, { fields: [{ name: 'OrderedQuantity', value: 99 }] })],
    })], 'named property and the same column in Fields');
    expect(first(r.json).success).toBe(true);
    const w = first(r.json).warnings;
    expect(w.map((x: any) => x.name).sort()).toEqual(['OrderedQuantity', 'ShipToName']);
    w.forEach((x: any) => expect(x.message).toMatch(/already mapped to a named property/));
    expect(headers(O('o'))[0].ShipToName).toBe('Named value');
    expect(details(O('o'))[0].OrderedQuantity).toBe(7);
  });

  test(t('4.6', 'only columns that are nullable or have a database default are exposed automatically'), async () => {
    const extra = [...extraColumns('PickHeader'), ...extraColumns('PickDetail')];
    note('columns exposed through Fields', extra.map((c) => ({ column: c.column_name, nullable: c.is_nullable, default: c.column_default })));
    for (const c of extra) expect(c.is_nullable === 'YES' || c.column_default !== null, `${c.column_name} is nullable or has a default`).toBe(true);
    mustOk(await post([order(O('p'))], 'create without supplying the extra columns'), 'create p');
    expect(headers(O('p'))[0]).toMatchObject({ NAcolumn: null, NAcolumn2: 'active' }); // database defaults, nothing synthesised
    expect(details(O('p'))[0]).toMatchObject({ NADetails: null, NADetails2: 'active' });
    wording('a REQUIRED column without default (which the API must not expose) cannot be added in this test (read-only database access): only the existing nullable / defaulted columns are verified');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.5 authentication
  test(t('5.1', 'both operations require Basic authentication; missing or invalid credentials return 401'), async () => {
    const calls = [
      await http('POST', 'Deliveries/CreateOrUpdate', { body: [order(O('q'))], user: null, title: 'CreateOrUpdate without credentials' }),
      await http('POST', 'Deliveries/CreateOrUpdate', { body: [order(O('q'))], user: 'CLAPIUnknown01', password: 'NotThePassword1', title: 'CreateOrUpdate with an unknown user' }),
      await http('GET', 'Deliveries/GetByOrderNumber', { query: { orderNumber: O('a') }, user: null, title: 'GetByOrderNumber without credentials' }),
      await http('GET', 'Deliveries/GetByOrderNumber', { query: { orderNumber: O('a') }, user: 'CLAPIUnknown01', password: 'NotThePassword1', title: 'GetByOrderNumber with an unknown user' }),
    ];
    calls.forEach((c) => expect(c.status).toBe(401));
    expect(headers(O('q'))).toHaveLength(0);
  });

  test(t('5.2', 'any authenticated API user may read and write deliveries'), async () => {
    const w = await post([order(O('r'))], 'write as the API user');
    expect(first(w.json).success).toBe(true);
    const r = await get(O('r'));
    expect(r.json.success).toBe(true);
    wording('contradicts F.7.2: F.5.2 says no named security process beyond authentication, F.7.2 requires API_DL (a user without API_DL is rejected, see F.7.2). The live API applies F.7.2.');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.6 audit, activity, logging
  test(t('6.1', 'every successful mutation writes an activity entry and x_PickHeader / x_PickDetail audit rows'), async () => {
    mustOk(await post([order(O('s'), { detailLines: [line('I1', 'L1', 1), line('I2', 'L1', 2)] })], 'create s'), 'create s');
    await sleep(1200);
    const u = await post([{ orderNumber: O('s'), shipToName: 'audited update', detailLines: [line('I1', 'L1', 11)] }], 'update s');
    expect(first(u.json).success).toBe(true);
    const act = sql<{ UserID: string; Action: string; ObjectType: string; ObjectName: string }>(
      `select Logged, UserID, Action, ObjectType, ObjectName from Activity where ObjectName = ${lit(O('s'))} and Action = 'DeliveriesAPI-CreateOrUpdate' order by Logged`, `Activity rows of ${O('s')}`);
    expect(act).toHaveLength(2);
    act.forEach((a) => expect(a).toMatchObject({ UserID: API_USER, Action: 'DeliveriesAPI-CreateOrUpdate', ObjectType: 'Destination Labeling', ObjectName: O('s') }));
    const xh = sql<{ ChangeType: string; ChangeUser: string; ChangeReason: string; ShipToName: string; CreatedBy: string }>(
      `select ChangeType, ChangeUser, ChangeReason, ChangeComments, ChangeDateTime, OrderNumber, ShipToName, CreatedBy, HeaderStatus from x_PickHeader where OrderNumber = ${lit(O('s'))} order by ChangeDateTime`, `x_PickHeader rows of ${O('s')}`);
    expect(xh.map((x) => x.ChangeType)).toEqual(['A', 'C']);
    xh.forEach((x) => expect(x).toMatchObject({ ChangeUser: API_USER, ChangeReason: 'DeliveriesAPI-CreateOrUpdate' }));
    expect(xh[0].ShipToName).toBe(`Ship to ${O('s')}`); // mirrors the source row at the time of the operation
    expect(xh[1].ShipToName).toBe('audited update');
    const xd = sql<{ ChangeType: string; ChangeUser: string; ChangeReason: string; ItemNumber: string }>(
      `select ChangeType, ChangeUser, ChangeReason, ChangeDateTime, OrderNumber, ItemNumber, LotNumber, OrderedQuantity from x_PickDetail where OrderNumber = ${lit(O('s'))} order by ChangeDateTime, ItemNumber`, `x_PickDetail rows of ${O('s')}`);
    expect(xd.map((x) => `${x.ChangeType}:${x.ItemNumber}`)).toEqual(['A:I1', 'A:I2', 'C:I1']);
    xd.forEach((x) => expect(x).toMatchObject({ ChangeUser: API_USER, ChangeReason: 'DeliveriesAPI-CreateOrUpdate' }));
    wording('"same database transaction" cannot be observed from outside: the audit rows exist for every mutation, atomicity itself is not tested');
  });

  test(t('6.2', 'a processing error is written to the application log and user credentials never are'), async () => {
    const tooLong = `CLDL${RUN}ERROR_ORDER_NUMBER_TOO_LONG`; // OrderNumber is nvarchar(20): the insert fails inside the API
    const mark = logMark();
    const r = await post([order(tooLong)], 'a delivery that fails in the database (order number longer than the column)');
    expect(first(r.json).success).toBe(false);
    expect(first(r.json).errorMessage).not.toBe('');
    await http('GET', 'Deliveries/GetByOrderNumber', { query: { orderNumber: O('a') }, user: 'CLAPIUnknown01', password: 'NotThePassword1', title: 'a call with invalid credentials' });
    await logWait(mark, /String or binary data would be truncated/);
    const segment = logSince(mark, 'application log: the failure of the call and the rejected login (user id only)', /<Error>|^\s*Type: System\./, 8);
    expect(segment, 'the database error is in the log').toContain('String or binary data would be truncated');
    expect(segment, 'logged as an <Error> entry of the InnoAPI group').toMatch(/<Error>[^\r\n]*InnoAPI[^\r\n]*Error ID: \d+\s+String or binary data would be truncated/);
    expect(segment.includes(PASSWORD), 'the API user password is not in the log').toBe(false);
    expect(segment.includes('NotThePassword1'), 'the invalid password is not in the log').toBe(false);
    const b64 = Buffer.from(`${API_USER}:${PASSWORD}`).toString('base64');
    expect(segment.includes(b64), 'the Authorization header value is not in the log').toBe(false);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.7 security
  test(t('7.1', 'the security group ROBAR API Security exists and holds API_DL'), async () => {
    const g = sql<{ ProcessName: string; Authorized: string }>(`select ProcessName, Authorized from [security] where UserGroup = 'ROBAR_API_Security' and ProcessName = 'API_DL'`, 'security: ROBAR_API_Security / API_DL');
    expect(g).toEqual([{ ProcessName: 'API_DL', Authorized: 'Y' }]);
    expect(sql<{ n: number }>(`select count(*) n from Groups where GroupID = 'ROBAR_API_Security'`, 'Groups: ROBAR_API_Security')[0].n).toBe(1);
    wording('the group id is ROBAR_API_Security (underscores); the fixture user is in the CL group CLAPIGrp, not in ROBAR_API_Security itself');
  });

  test(t('7.2', 'a user without API_DL is rejected with the API_DL message'), async () => {
    const w = await http('POST', 'Deliveries/CreateOrUpdate', { body: [order(O('t'))], user: NO_API_USER, title: `CreateOrUpdate as ${NO_API_USER}` });
    const r = await http('GET', 'Deliveries/GetByOrderNumber', { query: { orderNumber: O('a') }, user: NO_API_USER, title: `GetByOrderNumber as ${NO_API_USER}` });
    for (const x of [w, r]) {
      expect(x.status).toBe(401);
      expect(x.text).toContain('User not authorized for this task: API_DL.');
    }
    expect(headers(O('t'))).toHaveLength(0);
  });
});
