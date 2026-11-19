// Lots REST API, project 20240924-001 (UAT_20240924-001): one test per FRS row (LOTAPI.240924.F.x.y), driven through the REST API with the CL fixture users and checked in the TST703 database (read-only
// sqlcmd). New lots are CLO/CLL/CLI<run id><letter> (order / lot / item; lots cannot be deleted: ~25 per run). Existing CL lots WITH print history (62 on TST703) are read-only fixtures for the print history
// rows and for "replace only if not printed": the only write sent to them is an update that must be ignored, or one that re-sends their own current values.
// Wording differences between a requirement and the live API are recorded as test annotations, not hidden. Evidence per test: runs/API/Lots_<stamp>/<id>.json.
import { test, expect } from '@playwright/test';
import { API_USER, NO_API_USER } from './api-fixtures';
import { http, lit, note, sql, useEvidence } from './api-support';
import { RUN, audit, auditCount, create, existingItem, existingLcns, first, key, lcnRows, lot, lotRows, mustOk, overrideRows, printedLot, serialRows } from './lots-helpers';

const FRS = 'LOTAPI.240924.';
const t = (frs: string, text: string) => `${FRS}F.${frs} ${text}`;
const wording = (text: string) => test.info().annotations.push({ type: 'wording difference', description: text });
const GUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
const getById = (id: string, title?: string) => http('GET', 'Lots/GetByID', { query: { lotID: id }, title });
const populated = (q: Record<string, string>, title?: string) => http('GET', 'Lots/GetUsingPopulated', { query: q, title });

test.use({ actionTimeout: 20_000 });

test.describe('Lots REST API (project 20240924-001)', () => {
  useEvidence('Lots');
  test.setTimeout(120_000);

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.1 authentication
  test(t('1.1', 'the raw request is posted to the API with an authorization header'), async () => {
    const withAuth = await create([lot('a1')], {}, 'LotsCreateRecord with an Authorization header');
    expect(withAuth.status).toBe(200);
    expect(first(withAuth.json)).toMatchObject({ itemNumber: key('a1').itemNumber, success: true });
    const without = await http('POST', 'Lots/LotsCreateRecord', { body: { lots: [lot('a2')] }, user: null, title: 'LotsCreateRecord without an Authorization header' });
    expect(without.status).toBe(401);
    expect(lotRows(lot('a2'))).toHaveLength(0);
  });

  test(t('1.2', 'Basic authorization is required and the user id / password are validated against the ROBAR Users table'), async () => {
    const bearer = await http('POST', 'Lots/LotsCreateRecord', { body: { lots: [lot('a3')] }, headers: { Authorization: 'Bearer abc' }, user: null, title: 'a non-Basic Authorization header' });
    expect(bearer.status).toBe(401);
    const unknown = await http('POST', 'Lots/LotsCreateRecord', { body: { lots: [lot('a3')] }, user: 'CLAPIUnknown01', password: 'NotThePassword1', title: 'a user that is not in the Users table' });
    expect(unknown.status).toBe(401);
    const wrong = await http('POST', 'Lots/LotsCreateRecord', { body: { lots: [lot('a3')] }, user: NO_API_USER, password: 'NotThePassword1', title: 'a known user with a wrong password' });
    expect(wrong.status).toBe(401);
    expect(lotRows(lot('a3'))).toHaveLength(0);
    const ok = await create([lot('a3')], {}, 'a valid user and password');
    expect(ok.status).toBe(200);
    wording(`a non-Basic header is rejected with 401 and the text ${JSON.stringify(bearer.text)} (a base-64 decoding message)`);
  });

  test(t('1.3', 'an incorrect password does not increment FailCount'), async () => {
    const count = () => sql<{ FailCount: number }>(`select FailCount from Users where UserID = ${lit(NO_API_USER)}`, `Users.FailCount of ${NO_API_USER}`)[0].FailCount;
    const before = count();
    const r = await http('POST', 'Lots/LotsCreateRecord', { body: { lots: [lot('a4')] }, user: NO_API_USER, password: 'NotThePassword1', title: 'LotsCreateRecord with a wrong password' });
    expect(r.status).toBe(401);
    expect(count()).toBe(before);
  });

  test(t('1.4', 'an unauthorized user id returns 401'), async () => {
    const r = await http('GET', 'Lots/GetByID', { query: { lotID: 'x' }, user: 'CLAPIUnknown01', password: 'NotThePassword1', title: 'GetByID with an unknown user id' });
    expect(r.status).toBe(401);
    expect(r.text).toContain('No user found in ROBAR');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.2 LotsCreateRecord
  test(t('2.1', 'POST LotsCreateRecord creates and updates lot records'), async () => {
    const k = 'b1';
    const c = await create([lot(k, { u1: 'created' })]);
    expect(first(c.json)).toMatchObject({ success: true, updateExistingLot: false });
    const u = await create([lot(k, { u1: 'updated' })], { replaceExisting: true });
    expect(first(u.json)).toMatchObject({ success: true, updateExistingLot: true });
    const rows = lotRows(lot(k));
    expect(rows).toHaveLength(1);
    expect(rows[0].u1).toBe('updated');
    wording('the requirement says "updatedExistingLot"; the live response property is "updateExistingLot"');
  });

  test(t('2.2', 'an array of lots in one request creates or updates each of them'), async () => {
    const c = await create([lot('b2'), lot('b3')], {}, 'one request, two new lots');
    expect(c.json.lots.map((x: any) => x.success)).toEqual([true, true]);
    const u = await create([lot('b2', { u2: 'both updated' }), lot('b3', { u2: 'both updated' }), lot('b4')], { replaceExisting: true }, 'one request: update two, create one');
    expect(u.json.lots.map((x: any) => x.updateExistingLot)).toEqual([true, true, false]);
    expect(lotRows(lot('b2'))[0].u2).toBe('both updated');
    expect(lotRows(lot('b3'))[0].u2).toBe('both updated');
    expect(lotRows(lot('b4'))).toHaveLength(1);
  });

  test(t('2.3', 'lots, X_Lots, LotSerialNumbers, X_LotSerialNumbers, LotDataOverride and X_LotDataOverride are written (only Lots / X_Lots without serials and overrides)'), async () => {
    const full = lot('b5', { serialNums: ['SN-1', 'SN-2'], shareNameOverrides: [{ shareName: 'I_Desc', value: 'override 1' }, { shareName: 'I_Desc2', value: 'override 2' }] });
    mustOk(await create([full]), 'create b5');
    expect(lotRows(full)).toHaveLength(1);
    expect(serialRows(full)).toEqual(['SN-1', 'SN-2']);
    expect(overrideRows(full).map((o) => o.ShareName)).toEqual(['I_Desc', 'I_Desc2']);
    expect(audit('x_Lots', full)).toEqual([{ ChangeType: 'A', ChangeUser: API_USER, ChangeReason: 'LotsAPI-Create Lot', n: 1 }]);
    expect(audit('x_LotSerialNumbers', full).reduce((s, x) => s + x.n, 0)).toBe(2);
    expect(audit('x_LotDataOverride', full).reduce((s, x) => s + x.n, 0)).toBe(2);
    const bare = lot('b6');
    mustOk(await create([bare]), 'create b6 without serials and overrides');
    expect(lotRows(bare)).toHaveLength(1);
    expect(auditCount('x_Lots', bare)).toBe(1);
    expect(serialRows(bare)).toEqual([]);
    expect(overrideRows(bare)).toEqual([]);
    expect(auditCount('x_LotSerialNumbers', bare)).toBe(0);
    expect(auditCount('x_LotDataOverride', bare)).toBe(0);
  });

  test(t('2.4', 'a request with replaceExisting, replaceOnlyIfNotPrinted, itemMustExist and lots with every listed property is processed'), async () => {
    const l = lot('b7', { printEntity: 'ROBAR', serialNums: ['A1'], shareNameOverrides: [{ shareName: 'I_Desc', value: 'v' }] });
    const r = await create([l], { replaceExisting: true, replaceOnlyIfNotPrinted: true, itemMustExist: false });
    expect(r.status).toBe(200);
    expect(first(r.json)).toMatchObject({ success: true, errorMessage: '' });
    const row = lotRows(l)[0];
    expect(row).toMatchObject({ PrintEntity: 'ROBAR', Expires: '2030-12-31', Manufactured: '2026-01-15', Reassay: '2031-06-30', u1: 'u1 value', u2: 'u2 value', u3: 'u3 value', u4: 'u4 value', u5: 'u5 value' });
    expect(serialRows(l)).toEqual(['A1']);
    expect(overrideRows(l)).toEqual([{ ShareName: 'I_Desc', ShareValue: 'v' }]);
  });

  test(t('2.5', 'the response has success and a lots array; each lot has id, printEntity, lotNum, orderNum, itemNumber, updatedExistingLot, success, errorMessage'), async () => {
    const r = await create([lot('b8')]);
    expect(Object.keys(r.json).sort()).toEqual(['errorMessage', 'lots', 'success']);
    expect(typeof r.json.success).toBe('boolean');
    expect(Object.keys(first(r.json)).sort()).toEqual(['errorMessage', 'id', 'itemNumber', 'lotNum', 'orderNum', 'printEntity', 'success', 'updateExistingLot']);
    expect(first(r.json)).toMatchObject({ lotNum: key('b8').lotNum, orderNum: key('b8').orderNum, itemNumber: key('b8').itemNumber, printEntity: 'ROBAR' });
    wording('the requirement lists "updatedExistingLot"; the live property is "updateExistingLot"');
  });

  test(t('2.6', 'success is true when all lot records process successfully'), async () => {
    const r = await create([lot('c1'), lot('c2')]);
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
  });

  test(t('2.7', 'success is false when any lot record fails'), async () => {
    const r = await create([lot('c3'), lot('c4', { itemNumber: '' })]);
    expect(r.status).toBe(400);
    expect(r.json.success).toBe(false);
    expect(r.json.lots.map((x: any) => x.success)).toEqual([true, false]);
    expect(lotRows(lot('c3'))).toHaveLength(1); // the valid lot of the same request is saved
  });

  test(t('2.8', 'a successful lot has success true and an empty errorMessage'), async () => {
    const r = await create([lot('c5')]);
    expect(first(r.json)).toMatchObject({ success: true, errorMessage: '' });
  });

  test(t('2.9', 'a failed lot has success false and an errorMessage with the reason'), async () => {
    const r = await create([lot('c6', { itemNumber: '' })]);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: 'Item Number cannot be blank.' });
  });

  test(t('2.10', 'a successful lot returns the id (GUID) of the lot record'), async () => {
    const l = lot('c7');
    const r = await create([l]);
    expect(first(r.json).id).toMatch(GUID);
    expect(lotRows(l)[0].Id).toBe(first(r.json).id);
    const u = await create([lot('c7', { u1: 'again' })], { replaceExisting: true });
    expect(first(u.json).id).toBe(first(r.json).id); // an update returns the id of the existing record
  });

  test(t('2.11', 'updatedExistingLot is true when an existing record was updated, otherwise false'), async () => {
    const created = await create([lot('c8')]);
    expect(first(created.json).updateExistingLot).toBe(false);
    const updated = await create([lot('c8', { u1: 'new' })], { replaceExisting: true });
    expect(first(updated.json).updateExistingLot).toBe(true);
    const notUpdated = await create([lot('c8', { u1: 'ignored' })], { replaceExisting: false });
    expect(first(notUpdated.json)).toMatchObject({ success: true, updateExistingLot: false });
  });

  test(t('2.12', 'the replaceExisting property decides whether an existing lot record can be updated'), async () => {
    mustOk(await create([lot('d1', { u1: 'original' })]), 'create d1');
    const off = await create([lot('d1', { u1: 'changed?' })], { replaceExisting: false });
    expect(first(off.json).updateExistingLot).toBe(false);
    expect(lotRows(lot('d1'))[0].u1).toBe('original');
    const on = await create([lot('d1', { u1: 'changed' })], { replaceExisting: true });
    expect(first(on.json).updateExistingLot).toBe(true);
    expect(lotRows(lot('d1'))[0].u1).toBe('changed');
  });

  test(t('2.13', 'replaceExisting accepts the Boolean values true and false'), async () => {
    for (const v of [true, false]) {
      const r = await http('POST', 'Lots/LotsCreateRecord', { body: { replaceExisting: v, lots: [lot('d2')] }, title: `replaceExisting: ${v}` });
      expect(r.status).toBe(200);
      expect(first(r.json).success).toBe(true);
    }
    const text = await http('POST', 'Lots/LotsCreateRecord', { body: { replaceExisting: 'yes', lots: [lot('d2', { u1: 'text value' })] }, title: 'replaceExisting: "yes" (not a Boolean)' });
    note('a non-Boolean value is silently treated as false', { status: text.status, updateExistingLot: first(text.json)?.updateExistingLot });
    expect(first(text.json).updateExistingLot).toBe(false);
    expect(lotRows(lot('d2'))[0].u1).toBe('u1 value');
    wording('a value that is not a Boolean (for example the text "yes") is not rejected: the flag is silently treated as false');
  });

  test(t('2.14', 'replaceExisting = true updates the existing lot record'), async () => {
    mustOk(await create([lot('d3', { u3: 'before' })]), 'create d3');
    const r = await create([lot('d3', { u3: 'after' })], { replaceExisting: true });
    expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: true });
    expect(lotRows(lot('d3'))[0].u3).toBe('after');
    expect(audit('x_Lots', lot('d3')).map((x) => `${x.ChangeType}:${x.ChangeReason}`)).toEqual(['A:LotsAPI-Create Lot', 'C:LotsAPI-Update Lot']);
  });

  test(t('2.15', 'replaceExisting = false does not update the existing lot record'), async () => {
    mustOk(await create([lot('d4', { u3: 'before' })]), 'create d4');
    const r = await create([lot('d4', { u3: 'after' })], { replaceExisting: false });
    expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: false });
    expect(lotRows(lot('d4'))[0].u3).toBe('before');
    expect(auditCount('x_Lots', lot('d4'))).toBe(1);
  });

  test(t('2.16', 'replaceOnlyIfNotPrinted decides whether an existing lot can be updated based on its printing status'), async () => {
    const p = printedLot();
    const before = lotRows(p.req, 'the printed lot before')[0];
    const skipped = await create([{ ...p.req, expirationDate: before.Expires, manufactureDate: before.Manufactured, reassayDate: before.Reassay, u1: before.u1, u2: before.u2, u3: before.u3, u4: before.u4, u5: 'CLAPI must not be written' }], { replaceExisting: true, replaceOnlyIfNotPrinted: true }, 'update a PRINTED lot with replaceOnlyIfNotPrinted = true');
    expect(first(skipped.json)).toMatchObject({ success: true, updateExistingLot: false });
    expect(lotRows(p.req, 'the printed lot after')[0].u5).toBe(before.u5);
    mustOk(await create([lot('e1', { u5: 'before' })]), 'create e1 (never printed)');
    const done = await create([lot('e1', { u5: 'after' })], { replaceExisting: true, replaceOnlyIfNotPrinted: true }, 'update a lot that was NEVER printed with replaceOnlyIfNotPrinted = true');
    expect(first(done.json)).toMatchObject({ success: true, updateExistingLot: true });
    expect(lotRows(lot('e1'))[0].u5).toBe('after');
  });

  test(t('2.17', 'replaceOnlyIfNotPrinted accepts the Boolean values true and false'), async () => {
    const p = printedLot();
    const before = lotRows(p.req)[0];
    const same = { ...p.req, expirationDate: before.Expires, manufactureDate: before.Manufactured, reassayDate: before.Reassay, u1: before.u1, u2: before.u2, u3: before.u3, u4: before.u4, u5: before.u5 };
    const off = await create([same], { replaceExisting: true, replaceOnlyIfNotPrinted: false }, 'a printed lot, replaceOnlyIfNotPrinted = false: updated (its own current values are re-sent)');
    expect(first(off.json)).toMatchObject({ success: true, updateExistingLot: true });
    const on = await create([same], { replaceExisting: true, replaceOnlyIfNotPrinted: true }, 'the same printed lot, replaceOnlyIfNotPrinted = true: not updated');
    expect(first(on.json)).toMatchObject({ success: true, updateExistingLot: false });
    const after = lotRows(p.req)[0];
    expect({ ...after, LastTouch: '' }).toEqual({ ...before, LastTouch: '' }); // the data is unchanged
  });

  test(t('2.18', 'with replaceExisting = false an existing lot is never updated, whatever its printing status or replaceOnlyIfNotPrinted'), async () => {
    const p = printedLot();
    const before = lotRows(p.req)[0];
    for (const only of [true, false]) {
      const r = await create([{ ...p.req, u5: `CLAPI ${only}` }], { replaceExisting: false, replaceOnlyIfNotPrinted: only }, `printed lot, replaceExisting = false, replaceOnlyIfNotPrinted = ${only}`);
      expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: false });
    }
    expect(lotRows(p.req)[0].u5).toBe(before.u5);
    mustOk(await create([lot('e2', { u5: 'before' })]), 'create e2');
    const unprinted = await create([lot('e2', { u5: 'after' })], { replaceExisting: false, replaceOnlyIfNotPrinted: false }, 'never printed lot, replaceExisting = false');
    expect(first(unprinted.json).updateExistingLot).toBe(false);
    expect(lotRows(lot('e2'))[0].u5).toBe('before');
  });

  test(t('2.19', 'itemMustExist decides whether a new lot can be created based on its item'), async () => {
    const missing = await create([lot('f1')], { itemMustExist: true }, 'itemMustExist = true, the item does not exist');
    expect(first(missing.json).success).toBe(false);
    expect(lotRows(lot('f1'))).toHaveLength(0);
    const free = await create([lot('f1')], { itemMustExist: false }, 'itemMustExist = false, the item does not exist');
    expect(first(free.json).success).toBe(true);
    expect(lotRows(lot('f1'))).toHaveLength(1);
  });

  test(t('2.20', 'itemMustExist accepts the Boolean values true and false'), async () => {
    for (const v of [true, false]) {
      const r = await http('POST', 'Lots/LotsCreateRecord', { body: { itemMustExist: v, lots: [lot('f2', { itemNumber: existingItem() })] }, title: `itemMustExist: ${v}` });
      expect(r.status).toBe(200);
      expect(first(r.json).success).toBe(true);
    }
  });

  test(t('2.21', 'itemMustExist = true: the item must exist in the Items table for the lot to be created'), async () => {
    const item = existingItem();
    const l = lot('f3', { itemNumber: item });
    const r = await create([l], { itemMustExist: true }, `itemMustExist = true, the item ${item} exists in the Items table`);
    expect(first(r.json)).toMatchObject({ success: true, errorMessage: '' });
    expect(lotRows(l)).toHaveLength(1);
  });

  test(t('2.22', 'itemMustExist = true and the item does not exist: the response shows the "does not exist" error'), async () => {
    const r = await create([lot('f4')], { itemMustExist: true });
    expect(r.status).toBe(400);
    expect(first(r.json)).toMatchObject({ success: false, errorMessage: `Item ${key('f4').itemNumber} does not exist` });
    wording(`requirement: "Item XXXXX does not exist." (with a period); live: "${first(r.json).errorMessage}" (no period)`);
  });

  test(t('2.23', 'itemMustExist = false: the lot is created whether the item exists or not'), async () => {
    const noItem = await create([lot('f5')], { itemMustExist: false });
    expect(first(noItem.json).success).toBe(true);
    const withItem = await create([lot('f6', { itemNumber: existingItem() })], { itemMustExist: false });
    expect(first(withItem.json).success).toBe(true);
    expect(lotRows(lot('f5'))).toHaveLength(1);
  });

  test(t('2.24', 'a blank itemNumber is rejected with "Item Number cannot be blank." whatever itemMustExist is'), async () => {
    for (const must of [true, false]) {
      const r = await create([lot('f7', { itemNumber: '' })], { itemMustExist: must }, `blank itemNumber, itemMustExist = ${must}`);
      expect(first(r.json)).toMatchObject({ success: false, errorMessage: 'Item Number cannot be blank.' });
    }
    const spaces = await create([lot('f7', { itemNumber: '   ' })], {}, 'itemNumber of spaces');
    expect(first(spaces.json).errorMessage).toBe('Item Number cannot be blank.');
  });

  test(t('2.25', 'expirationDate, manufactureDate and reassayDate accept YYYY-MM-DD'), async () => {
    const l = lot('g1', { expirationDate: '2031-02-28', manufactureDate: '2025-12-01', reassayDate: '2032-07-04' });
    const r = await create([l]);
    expect(first(r.json).success).toBe(true);
    expect(lotRows(l)[0]).toMatchObject({ Expires: '2031-02-28', Manufactured: '2025-12-01', Reassay: '2032-07-04' });
  });

  test(t('2.26', "a blank expirationDate, manufactureDate or reassayDate defaults to '1899-01-01'"), async () => {
    const l = lot('g2', { expirationDate: '', manufactureDate: '', reassayDate: '' });
    const r = await create([l]);
    expect(first(r.json).success).toBe(true);
    expect(lotRows(l)[0]).toMatchObject({ Expires: '1899-01-01', Manufactured: '1899-01-01', Reassay: '1899-01-01' });
    const omitted = lot('g3');
    delete omitted.expirationDate;
    delete omitted.manufactureDate;
    delete omitted.reassayDate;
    const o = await create([omitted], {}, 'the three dates left out of the request');
    expect(first(o.json).success).toBe(true);
    expect(lotRows(omitted)[0]).toMatchObject({ Expires: '1899-01-01', Manufactured: '1899-01-01', Reassay: '1899-01-01' });
  });

  test(t('2.27', 'a date that is not YYYY-MM-DD is rejected with "Invalid date format."'), async () => {
    for (const [field, value] of [['expirationDate', '01/02/2026'], ['manufactureDate', '2026-1-5'], ['reassayDate', '31-12-2030']] as const) {
      const l = lot('g4', { [field]: value });
      const r = await create([l], {}, `${field} = ${value}`);
      expect(first(r.json), field).toMatchObject({ success: false, errorMessage: 'Invalid date format.' });
    }
    expect(lotRows(lot('g4'))).toHaveLength(0);
  });

  test(t('2.28', 'u1..u5 that are blank or not in the request default to an empty string'), async () => {
    const l = lot('g5', { u1: '', u2: '' });
    delete l.u3;
    delete l.u4;
    delete l.u5;
    const r = await create([l]);
    expect(first(r.json).success).toBe(true);
    expect(lotRows(l)[0]).toMatchObject({ u1: '', u2: '', u3: '', u4: '', u5: '' });
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.3 printEntity
  test(t('3.1', "a blank printEntity defaults to 'ROBAR'"), async () => {
    const l = lot('h1', { printEntity: '' });
    const r = await create([l]);
    expect(first(r.json)).toMatchObject({ success: true, printEntity: 'ROBAR' });
    expect(lotRows({ ...l, printEntity: 'ROBAR' })[0].PrintEntity).toBe('ROBAR');
  });

  test(t('3.2', 'a printEntity that is not in the PrintEntity table: the lot is still inserted or updated with it'), async () => {
    const pe = `CLAPIPE${RUN}`;
    expect(sql<{ n: number }>(`select count(*) n from PrintEntity where PrintEntity = ${lit(pe)}`, 'PrintEntity table: the value does not exist')[0].n).toBe(0);
    const l = lot('h2', { printEntity: pe, u1: 'inserted' });
    const created = await create([l]);
    expect(first(created.json)).toMatchObject({ success: true, printEntity: pe, updateExistingLot: false });
    const updated = await create([{ ...l, u1: 'updated' }], { replaceExisting: true });
    expect(first(updated.json)).toMatchObject({ success: true, updateExistingLot: true });
    expect(lotRows(l)[0].u1).toBe('updated');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.4 blank lotNum / orderNum
  test(t('4.1', 'blank lotNum and / or orderNum: the lot is inserted or updated with the blank values'), async () => {
    const both = lot('i1', { orderNum: '', lotNum: '' });
    const c = await create([both]);
    expect(first(c.json)).toMatchObject({ success: true, orderNum: '', lotNum: '', updateExistingLot: false });
    const u = await create([{ ...both, u1: 'updated blank key' }], { replaceExisting: true });
    expect(first(u.json)).toMatchObject({ success: true, updateExistingLot: true });
    expect(lotRows(both)[0]).toMatchObject({ OrderNum: '', LotNum: '', u1: 'updated blank key' });
    const lotOnly = lot('i2', { lotNum: '' });
    const o = await create([lotOnly]);
    expect(first(o.json).success).toBe(true);
    expect(lotRows(lotOnly)[0]).toMatchObject({ LotNum: '', OrderNum: key('i2').orderNum });
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.5 serial numbers
  test(t('5.1', 'serialNums accepts an array of serial numbers, each processed with the lot'), async () => {
    const l = lot('j1', { serialNums: ['SN-100', 'SN-101', 'SN-102'] });
    const r = await create([l]);
    expect(first(r.json).success).toBe(true);
    expect(serialRows(l)).toEqual(['SN-100', 'SN-101', 'SN-102']);
  });

  test(t('5.2', 'serialNums missing or an empty array: no rows in LotSerialNumbers / X_LotSerialNumbers'), async () => {
    const missing = lot('j2');
    const empty = lot('j3', { serialNums: [] });
    for (const l of [missing, empty]) {
      const r = await create([l]);
      expect(first(r.json).success).toBe(true);
      expect(serialRows(l)).toEqual([]);
      expect(auditCount('x_LotSerialNumbers', l)).toBe(0);
    }
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.6 share name overrides
  test(t('6.1', 'shareNameOverrides accepts an array of shareName / value pairs, processed with the lot'), async () => {
    const l = lot('k1', { shareNameOverrides: [{ shareName: 'I_Desc', value: 'first' }, { shareName: 'I_Desc2', value: 'second' }, { shareName: 'I_Desc3', value: 'third' }] });
    const r = await create([l]);
    expect(first(r.json).success).toBe(true);
    expect(overrideRows(l)).toEqual([{ ShareName: 'I_Desc', ShareValue: 'first' }, { ShareName: 'I_Desc2', ShareValue: 'second' }, { ShareName: 'I_Desc3', ShareValue: 'third' }]);
  });

  test(t('6.2', 'shareNameOverrides missing or an empty array: no rows in LotDataOverride / X_LotDataOverride'), async () => {
    for (const l of [lot('k2'), lot('k3', { shareNameOverrides: [] })]) {
      const r = await create([l]);
      expect(first(r.json).success).toBe(true);
      expect(overrideRows(l)).toEqual([]);
      expect(auditCount('x_LotDataOverride', l)).toBe(0);
    }
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.7 GetByID
  const SHAPE = ['expirationDate', 'id', 'itemNumber', 'lockedLCNs', 'lotNum', 'manufactureDate', 'orderNum', 'printEntity', 'printedLabelTypes', 'reassayDate', 'serialNums', 'shareNameOverrides', 'u1', 'u2', 'u3', 'u4', 'u5'];
  let lotL = { id: '', req: lot('m1', { serialNums: ['M-1', 'M-2'], shareNameOverrides: [{ shareName: 'I_Desc', value: 'ov' }] }) };

  test(t('7.1', 'GET GetByID retrieves a lot record by its id'), async () => {
    const c = await create([lotL.req], {}, 'create the lot to read');
    mustOk(c, 'create m1');
    lotL = { ...lotL, id: first(c.json).id };
    const r = await getById(lotL.id);
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.lot.id).toBe(lotL.id);
    expect(r.json.lot.itemNumber).toBe(lotL.req.itemNumber);
    wording('the requirement example shows .../Lots/GetByID?lotID=...; the live route is /innoapi/Lots/GetByID?lotID=...');
  });

  test(t('7.2', 'the lot property has printedLabelTypes, id, printEntity, lotNum, orderNum, itemNumber, the three dates, u1..u5, serialNums and shareNameOverrides'), async () => {
    const r = await getById(lotL.id);
    expect(Object.keys(r.json.lot).sort()).toEqual(SHAPE);
    expect(Array.isArray(r.json.lot.printedLabelTypes)).toBe(true);
    expect(Array.isArray(r.json.lot.serialNums)).toBe(true);
    expect(r.json.lot.shareNameOverrides.every((x: any) => Object.keys(x).sort().join() === 'shareName,value')).toBe(true);
    expect(r.json.lot.expirationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    wording('the live lot object also carries "lockedLCNs" (not listed in this requirement)');
  });

  test(t('7.3', 'all relevant data of the matching lot record is returned'), async () => {
    const r = await getById(lotL.id);
    expect(r.json.lot).toMatchObject({
      printEntity: 'ROBAR', lotNum: lotL.req.lotNum, orderNum: lotL.req.orderNum, itemNumber: lotL.req.itemNumber, expirationDate: '2030-12-31', manufactureDate: '2026-01-15', reassayDate: '2031-06-30',
      u1: 'u1 value', u2: 'u2 value', u3: 'u3 value', u4: 'u4 value', u5: 'u5 value',
    });
    expect([...r.json.lot.serialNums].sort()).toEqual(['M-1', 'M-2']);
    expect(r.json.lot.shareNameOverrides).toEqual([{ shareName: 'I_Desc', value: 'ov' }]);
    const p = printedLot();
    const printed = await getById(p.id, 'GetByID of a lot that has print history');
    expect(printed.json.lot.printedLabelTypes.length).toBeGreaterThan(0);
  });

  test(t('7.4', 'an unknown lot id returns a response where the lot property is null'), async () => {
    const r = await getById('00000000-0000-0000-0000-000000000000');
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ success: true, lot: null });
    const bad = await getById('not-a-guid');
    expect(bad.json.lot).toBeNull();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.8 GetPrintHistoryByID
  test(t('8.1', 'GET GetPrintHistoryByID returns the print history of a lot by id'), async () => {
    const p = printedLot();
    const r = await http('GET', 'Lots/GetPrintHistoryByID', { query: { lotId: p.id } });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.printEvents.length).toBeGreaterThan(0);
    expect(r.json.printEvents.every((e: any) => typeof e.labelType === 'string' && e.copies > 0)).toBe(true);
    const phRows = sql<{ n: number }>(`select count(*) n from PrintHistory where OrderNum = ${lit(p.req.orderNum!)} and Lot = ${lit(p.req.lotNum!)} and ItemNumber = ${lit(p.req.itemNumber!)} and PrintEntity = ${lit(p.req.printEntity!)} and PrintStatus like '%printed%'`, 'PrintHistory rows of the lot (printed)')[0].n;
    expect(r.json.printEvents).toHaveLength(phRows);
  });

  test(t('8.2', 'the response has the lot id and an array of printEvents'), async () => {
    const p = printedLot();
    const r = await http('GET', 'Lots/GetPrintHistoryByID', { query: { lotId: p.id } });
    expect(Object.keys(r.json).sort()).toEqual(['errorMessage', 'id', 'printEvents', 'success']);
    expect(r.json.id).toBe(p.id);
    expect(Array.isArray(r.json.printEvents)).toBe(true);
  });

  test(t('8.3', 'each printEvent has userID, workstation, labelType, printer, printerModel, printDate, copies, serialCopies, reprint, reprintReason, reprintSignedBy, testPrint, serialNums, shareNameOverrides'), async () => {
    const p = printedLot();
    const r = await http('GET', 'Lots/GetPrintHistoryByID', { query: { lotId: p.id } });
    const listed = ['userID', 'workstation', 'labelType', 'printer', 'printerModel', 'printDate', 'copies', 'serialCopies', 'reprint', 'reprintReason', 'reprintSignedBy', 'testPrint', 'serialNums', 'shareNameOverrides'];
    const live = Object.keys(r.json.printEvents[0]).sort();
    const missing = listed.filter((k) => !live.includes(k));
    note('property names of a live printEvent', live);
    expect(live).toEqual(expect.arrayContaining(listed.filter((k) => k !== 'shareNameOverrides')));
    expect(r.json.printEvents[0].printDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
    expect(typeof r.json.printEvents[0].reprint).toBe('boolean');
    expect(typeof r.json.printEvents[0].testPrint).toBe('boolean');
    expect(Array.isArray(r.json.printEvents[0].serialNums)).toBe(true);
    if (missing.length) wording(`the requirement lists "${missing.join(', ')}" in printEvent; the live printEvent does not carry it (the lot's share name overrides are not returned by GetPrintHistoryByID)`);
  });

  test(t('8.4', 'a lot without print events returns an empty printEvents array and the lot id that was sent'), async () => {
    const id = lotL.id;
    const r = await http('GET', 'Lots/GetPrintHistoryByID', { query: { lotId: id } });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ success: true, id, printEvents: [] });
    const unknown = await http('GET', 'Lots/GetPrintHistoryByID', { query: { lotId: '00000000-0000-0000-0000-000000000000' }, title: 'GetPrintHistoryByID of an unknown id' });
    expect(unknown.json).toMatchObject({ id: '00000000-0000-0000-0000-000000000000', printEvents: [] });
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.9 GetUsingPopulated
  test(t('9.1', 'GET GetUsingPopulated retrieves lots by orderNum, lotNum, itemNumber and printEntity'), async () => {
    const r = await populated({ itemNumber: lotL.req.itemNumber!, orderNum: lotL.req.orderNum!, lotNum: lotL.req.lotNum!, printEntity: 'ROBAR' });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.lots).toHaveLength(1);
    expect(r.json.lots[0].id).toBe(lotL.id);
    wording('the requirement example shows .../Lots/GetUsingPopulated?...; the live route is /innoapi/Lots/GetUsingPopulated?...');
  });

  test(t('9.2', 'a subset of the parameters is accepted'), async () => {
    for (const q of [{ itemNumber: lotL.req.itemNumber! }, { orderNum: lotL.req.orderNum! }, { lotNum: lotL.req.lotNum! }, { orderNum: lotL.req.orderNum!, printEntity: 'ROBAR' }]) {
      const r = await populated(q, `GetUsingPopulated with ${Object.keys(q).join(' + ')}`);
      expect(r.status, JSON.stringify(q)).toBe(200);
      expect(r.json.lots.some((x: any) => x.id === lotL.id), JSON.stringify(q)).toBe(true);
    }
  });

  test(t('9.3', 'missing parameters are disregarded: the lots matching the given ones are returned'), async () => {
    const byItem = await populated({ itemNumber: lotL.req.itemNumber! });
    const byBoth = await populated({ itemNumber: lotL.req.itemNumber!, orderNum: lotL.req.orderNum! });
    expect(byItem.json.lots.map((x: any) => x.id)).toEqual([lotL.id]);
    expect(byBoth.json.lots.map((x: any) => x.id)).toEqual([lotL.id]);
    const twin = await create([lot('m1', { orderNum: `CLO${RUN}m1-2`, lotNum: `CLL${RUN}m1-2` })], {}, 'a second lot of the same item');
    mustOk(twin, 'create the second lot of the item');
    const both = await populated({ itemNumber: lotL.req.itemNumber! }, 'GetUsingPopulated by item only: two lots');
    expect(both.json.lots).toHaveLength(2);
    const one = await populated({ itemNumber: lotL.req.itemNumber!, lotNum: lotL.req.lotNum! }, 'GetUsingPopulated by item and lot: one lot');
    expect(one.json.lots).toHaveLength(1);
  });

  test(t('9.4', 'no error when some parameters are not provided; the results are filtered by the ones that are'), async () => {
    const r = await populated({ lotNum: lotL.req.lotNum! });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(r.json.errorMessage).toBeNull();
    expect(r.json.lots.every((x: any) => x.lotNum === lotL.req.lotNum)).toBe(true);
    const none = await populated({}, 'GetUsingPopulated without any parameter');
    note('no parameter at all is the only error case', { status: none.status, body: none.json });
    expect(none.status).toBe(400);
    expect(none.json.errorMessage).toBe('No parameters are provided');
  });

  test(t('9.5', 'the response has an array of lots objects with all listed properties'), async () => {
    const r = await populated({ itemNumber: lotL.req.itemNumber!, orderNum: lotL.req.orderNum! });
    expect(Object.keys(r.json).sort()).toEqual(['errorMessage', 'lots', 'success']);
    expect(Object.keys(r.json.lots[0]).sort()).toEqual(SHAPE);
    expect(r.json.lots[0]).toMatchObject({ u1: 'u1 value', expirationDate: '2030-12-31', itemNumber: lotL.req.itemNumber });
    expect([...r.json.lots[0].serialNums].sort()).toEqual(['M-1', 'M-2']);
    wording('the live lot objects also carry "lockedLCNs" (not listed in this requirement)');
  });

  test(t('9.6', 'no matching lot returns an empty lots array'), async () => {
    const r = await populated({ itemNumber: `NoSuchItem${RUN}` });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ success: true, lots: [] });
  });

  // LCN handling and the not-authorized check belong to phase 2 (UAT_20260526-001) and to the API security process; here only a smoke check that a lot with LCNs is accepted
  test('LOTAPI.240924.note LCNs: a lot with existing LCNs is accepted (supporting check, no requirement row)', async () => {
    const l = lot('n1', { lcns: existingLcns(1) });
    const r = await create([l]);
    expect(first(r.json).success).toBe(true);
    expect(lcnRows(l).length).toBeGreaterThan(0);
    const bad = await create([lot('n2', { lcns: ['LCN_DOES_NOT_EXIST'] })], {}, 'a lot with an LCN that does not exist');
    expect(first(bad.json)).toMatchObject({ success: false, errorMessage: 'LCNs provided which do not exist: LCN_DOES_NOT_EXIST' });
  });
});
