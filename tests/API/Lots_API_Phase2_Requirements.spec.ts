// Lots REST API phase 2, project 20260526-001 (UAT_20260526-001): one test per FRS row (LOTAPI.20260526.F.x.y): replaceSerials / replaceLockedLCNs / replaceShareNameOverrides and the API security process.
// Same data rules as the phase 1 spec (Lots_API_Requirements.spec.ts): new lots CLO/CLL/CLI<run id><letter>; the shared existing CL lots with print history are only READ, or (F.1.8) sent ONE update with a
// marker serial number that is removed again at the end of the test. Evidence per test: runs/API/Lots2_<stamp>/<id>.json.
import { test, expect } from '@playwright/test';
import { API_USER, NO_API_USER } from './api-fixtures';
import { http, note, sql, useEvidence } from './api-support';
import { RUN, audit, create, existingLcns, first, key, lcnRows, lot, lotRows, mustOk, overrideRows, printedLot, serialRows } from './lots-helpers';

const FRS = 'LOTAPI.20260526.';
const t = (frs: string, text: string) => `${FRS}F.${frs} ${text}`;
const wording = (text: string) => test.info().annotations.push({ type: 'wording difference', description: text });
const ov = (shareName: string, value: string) => ({ shareName, value });
const sum = (rows: Array<{ n: number }>) => rows.reduce((s, r) => s + r.n, 0);
const deleted = (rows: Array<{ ChangeType: string; n: number }>) => rows.filter((r) => r.ChangeType === 'D').reduce((s, r) => s + r.n, 0);

test.use({ actionTimeout: 20_000 });

test.describe('Lots REST API phase 2 (project 20260526-001)', () => {
  useEvidence('Lots2');
  test.setTimeout(120_000);
  const [LCN1, LCN2] = existingLcns(2);

  /** A lot with two serial numbers, two overrides and one locked LCN, created and ready to be updated. */
  const seeded = async (k: string) => {
    const l = lot(k, { serialNums: ['S-1', 'S-2'], shareNameOverrides: [ov('I_Desc', 'o1'), ov('I_Desc2', 'o2')], lcns: [LCN1] });
    mustOk(await create([l], {}, `create the lot ${k} with 2 serial numbers, 2 overrides and 1 locked LCN`), `create ${k}`);
    return l;
  };

  test(t('1.1', 'replaceSerials, replaceLockedLCNs and replaceShareNameOverrides default to false when omitted'), async () => {
    const l = await seeded('p1');
    const r = await create([{ ...l, u1: 'updated', serialNums: ['NEW-1'], shareNameOverrides: [ov('I_Desc3', 'new')], lcns: [LCN2] }], { replaceExisting: true }, 'update with replaceExisting = true and none of the three replace properties');
    expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: true });
    expect(lotRows(l)[0].u1).toBe('updated'); // the lot itself is updated
    expect(serialRows(l)).toEqual(['S-1', 'S-2']); // the sub-records are untouched: nothing replaced, nothing added
    expect(overrideRows(l).map((o) => o.ShareName)).toEqual(['I_Desc', 'I_Desc2']);
    expect(lcnRows(l).map((x) => x.LCN)).toEqual([LCN1]);
  });

  test(t('1.2', 'replaceExisting = false: nothing is replaced, whatever the three replace properties say'), async () => {
    const l = await seeded('p2');
    const r = await create([{ ...l, u1: 'must not change', serialNums: ['X-1'], shareNameOverrides: [ov('I_Desc3', 'x')], lcns: [LCN2] }],
      { replaceExisting: false, replaceSerials: true, replaceLockedLCNs: true, replaceShareNameOverrides: true }, 'replaceExisting = false with all three replace properties true');
    expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: false });
    expect(lotRows(l)[0].u1).toBe('u1 value');
    expect(serialRows(l)).toEqual(['S-1', 'S-2']);
    expect(overrideRows(l).map((o) => o.ShareName)).toEqual(['I_Desc', 'I_Desc2']);
    expect(lcnRows(l).map((x) => x.LCN)).toEqual([LCN1]);
  });

  test(t('1.3', 'replaceSerials = true deletes the existing serial numbers before the provided ones are processed'), async () => {
    const l = await seeded('p3');
    const r = await create([{ ...l, serialNums: ['R-1', 'R-2', 'R-3'] }], { replaceExisting: true, replaceSerials: true }, 'replaceSerials = true with three new serial numbers');
    expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: true });
    expect(serialRows(l)).toEqual(['R-1', 'R-2', 'R-3']); // S-1 and S-2 are gone
    expect(overrideRows(l)).toHaveLength(2); // the other two data types are untouched
    expect(lcnRows(l)).toHaveLength(1);
  });

  test(t('1.4', 'replaceLockedLCNs = true deletes the existing locked LCNs before the provided LCNs are processed'), async () => {
    const l = await seeded('p4');
    const r = await create([{ ...l, lcns: [LCN2] }], { replaceExisting: true, replaceLockedLCNs: true }, 'replaceLockedLCNs = true with another LCN');
    expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: true });
    expect(lcnRows(l).map((x) => x.LCN)).toEqual([LCN2]); // LCN1 is gone
    expect(serialRows(l)).toEqual(['S-1', 'S-2']);
    expect(overrideRows(l)).toHaveLength(2);
  });

  test(t('1.5', 'replaceShareNameOverrides = true deletes the existing share name overrides before the provided ones are processed'), async () => {
    const l = await seeded('p5');
    const r = await create([{ ...l, shareNameOverrides: [ov('I_Desc3', 'replaced')] }], { replaceExisting: true, replaceShareNameOverrides: true }, 'replaceShareNameOverrides = true with one new override');
    expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: true });
    expect(overrideRows(l)).toEqual([{ ShareName: 'I_Desc3', ShareValue: 'replaced' }]); // I_Desc and I_Desc2 are gone
    expect(serialRows(l)).toEqual(['S-1', 'S-2']);
    expect(lcnRows(l)).toHaveLength(1);
  });

  test(t('1.6', 'every deleted serial number, locked LCN and override gets an audit record'), async () => {
    const l = await seeded('p6');
    const beforeSer = deleted(audit('x_LotSerialNumbers', l)), beforeOvr = deleted(audit('x_LotDataOverride', l)), beforeLcn = deleted(audit('x_LotControlNumbers', l));
    expect([beforeSer, beforeOvr, beforeLcn]).toEqual([0, 0, 0]);
    const r = await create([{ ...l, serialNums: ['A-1'], shareNameOverrides: [ov('I_Desc3', 'v')], lcns: [LCN2] }], { replaceExisting: true, replaceSerials: true, replaceLockedLCNs: true, replaceShareNameOverrides: true }, 'replace all three data types');
    expect(first(r.json).success).toBe(true);
    const xs = audit('x_LotSerialNumbers', l), xo = audit('x_LotDataOverride', l), xl = audit('x_LotControlNumbers', l);
    expect(deleted(xs)).toBe(2); // S-1, S-2
    expect(deleted(xo)).toBe(2); // I_Desc, I_Desc2
    expect(deleted(xl)).toBe(1); // LCN1
    for (const rows of [xs, xo, xl]) {
      const d = rows.filter((x) => x.ChangeType === 'D');
      d.forEach((x) => expect(x).toMatchObject({ ChangeUser: API_USER, ChangeReason: 'LotsAPI-Update Lot' }));
    }
    expect(sum(xs.filter((x) => x.ChangeType === 'A'))).toBe(3); // 2 created + 1 new
  });

  test(t('1.7', 'a replace property = true with an empty array deletes the existing records of that data type and leaves it empty'), async () => {
    const l = await seeded('p7');
    const r = await create([{ ...l, serialNums: [], shareNameOverrides: [], lcns: [] }], { replaceExisting: true, replaceSerials: true, replaceLockedLCNs: true, replaceShareNameOverrides: true }, 'all three replace properties = true with empty arrays');
    expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: true });
    expect(serialRows(l)).toEqual([]);
    expect(overrideRows(l)).toEqual([]);
    expect(lcnRows(l)).toEqual([]);
    const only = await seeded('p8');
    const o = await create([{ ...only, serialNums: [] }], { replaceExisting: true, replaceSerials: true }, 'only replaceSerials = true with an empty array');
    expect(first(o.json).success).toBe(true);
    expect(serialRows(only)).toEqual([]);
    expect(overrideRows(only)).toHaveLength(2); // the other data types are left alone
    expect(lcnRows(only)).toHaveLength(1);
  });

  // supporting check (no requirement row): on a PRINTED lot the replace properties work when replaceOnlyIfNotPrinted is false, so the F.1.8 result below is caused by replaceOnlyIfNotPrinted alone
  test('LOTAPI.20260526.support printed lot, replaceOnlyIfNotPrinted = false: replaceSerials replaces (baseline for F.1.8)', async () => {
    const p = printedLot();
    const marker = `CLAPI-P2B-${RUN}`;
    try {
      const r = await create([{ ...p.req, serialNums: [marker] }], { replaceExisting: true, replaceOnlyIfNotPrinted: false, replaceSerials: true }, 'a PRINTED lot: replaceOnlyIfNotPrinted = false and replaceSerials = true');
      expect(first(r.json)).toMatchObject({ success: true, updateExistingLot: true });
      expect(serialRows(p.req, 'serial numbers of the printed lot after')).toEqual([marker]);
    } finally {
      await create([{ ...p.req, serialNums: [] }], { replaceExisting: true, replaceSerials: true }, 'clean-up: remove the marker serial number again');
      expect(serialRows(p.req, 'serial numbers of the printed lot after the clean-up')).toEqual([]);
    }
  });

  test(t('1.8', 'the replace properties do not honor replaceOnlyIfNotPrinted: they replace even when the lot has been printed'), async () => {
    // KNOWN DEFECT (confirmed live 2026-11-19, tracker row): LotsAPIService.ProcessLot skips the WHOLE update of a printed lot when replaceOnlyIfNotPrinted is true (its comment says the flag
    // "applies to the entire update - base lot record and all three sub-record types"), which contradicts this requirement. Expected failure: when the API is fixed this test passes and test.fail() reports it.
    test.fail(true, 'known defect: replaceOnlyIfNotPrinted = true on a printed lot also blocks replaceSerials / replaceLockedLCNs / replaceShareNameOverrides (requirement F.1.8)');
    const p = printedLot();
    expect(serialRows(p.req, 'serial numbers of the printed lot before')).toEqual([]);
    const marker = `CLAPI-P2-${RUN}`;
    const r = await create([{ ...p.req, serialNums: [marker] }], { replaceExisting: true, replaceOnlyIfNotPrinted: true, replaceSerials: true }, 'a PRINTED lot: replaceOnlyIfNotPrinted = true and replaceSerials = true');
    const after = serialRows(p.req, 'serial numbers of the printed lot after');
    note('what the API did', { updateExistingLot: first(r.json)?.updateExistingLot, serialsAfter: after });
    try {
      expect(after, 'requirement: the serial numbers are replaced regardless of the printed status').toEqual([marker]);
      expect(first(r.json).updateExistingLot).toBe(true);
    } finally {
      if (after.length) {
        await create([{ ...p.req, serialNums: [] }], { replaceExisting: true, replaceSerials: true }, 'clean-up: remove the marker serial number again');
        expect(serialRows(p.req, 'serial numbers of the printed lot after the clean-up')).toEqual([]);
      }
    }
  });

  test(t('2.1', 'the security group ROBAR API Security exists and holds API_Lots'), async () => {
    const g = sql<{ ProcessName: string; Authorized: string }>(`select ProcessName, Authorized from [security] where UserGroup = 'ROBAR_API_Security' and ProcessName = 'API_Lots'`, 'security: ROBAR_API_Security / API_Lots');
    expect(g).toEqual([{ ProcessName: 'API_Lots', Authorized: 'Y' }]);
    expect(sql<{ n: number }>(`select count(*) n from Groups where GroupID = 'ROBAR_API_Security'`, 'Groups: ROBAR_API_Security')[0].n).toBe(1);
    wording('the group id is ROBAR_API_Security (underscores); the fixture user is in the CL group CLAPIGrp, not in ROBAR_API_Security itself');
  });

  test(t('2.2', 'a user without API_Lots is rejected with the API_Lots message'), async () => {
    const l = lot('q1');
    const calls = [
      await http('POST', 'Lots/LotsCreateRecord', { body: { lots: [l] }, user: NO_API_USER, title: `LotsCreateRecord as ${NO_API_USER}` }),
      await http('GET', 'Lots/GetByID', { query: { lotID: '00000000-0000-0000-0000-000000000000' }, user: NO_API_USER, title: `GetByID as ${NO_API_USER}` }),
      await http('GET', 'Lots/GetUsingPopulated', { query: { itemNumber: key('q1').itemNumber }, user: NO_API_USER, title: `GetUsingPopulated as ${NO_API_USER}` }),
      await http('GET', 'Lots/GetPrintHistoryByID', { query: { lotId: '00000000-0000-0000-0000-000000000000' }, user: NO_API_USER, title: `GetPrintHistoryByID as ${NO_API_USER}` }),
    ];
    for (const c of calls) {
      expect(c.status).toBe(401);
      expect(c.text).toContain('User not authorized for this task: API_Lots.');
    }
    expect(lotRows(l)).toHaveLength(0);
  });
});
