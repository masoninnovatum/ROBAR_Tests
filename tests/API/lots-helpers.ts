// Shared helpers of the two Lots API specs (project 20240924-001 and its phase 2 20260526-001): request builders and READ-ONLY database views of a lot and its sub-records.
// Test lots are keyed CLO<run><k> / CLL<run><k> / CLI<run><k> (order / lot / item). The shared existing CL lots that already have print history are only READ (or sent an update that
// must be ignored); a test that could change one restores it.
import { RUN_ID, http, lit, sql } from './api-support';

export const RUN = RUN_ID;
export const key = (k: string) => ({ orderNum: `CLO${RUN}${k}`, lotNum: `CLL${RUN}${k}`, itemNumber: `CLI${RUN}${k}` });

export interface LotReq {
  printEntity?: string; orderNum?: string; lotNum?: string; itemNumber?: string; expirationDate?: string; manufactureDate?: string; reassayDate?: string;
  u1?: string; u2?: string; u3?: string; u4?: string; u5?: string; serialNums?: string[]; lcns?: string[]; shareNameOverrides?: Array<{ shareName: string; value: string }>;
}
/** A complete lot request for key letter k (every property the requirement lists), overridable. */
export const lot = (k: string, extra: LotReq = {}): LotReq => ({
  ...key(k), expirationDate: '2030-12-31', manufactureDate: '2026-01-15', reassayDate: '2031-06-30', u1: 'u1 value', u2: 'u2 value', u3: 'u3 value', u4: 'u4 value', u5: 'u5 value', ...extra,
});
export interface Flags { replaceExisting?: boolean; replaceOnlyIfNotPrinted?: boolean; itemMustExist?: boolean; replaceSerials?: boolean; replaceLockedLCNs?: boolean; replaceShareNameOverrides?: boolean }
export const create = (lots: LotReq[], flags: Flags = {}, title?: string) =>
  http('POST', 'Lots/LotsCreateRecord', { body: { replaceExisting: false, replaceOnlyIfNotPrinted: false, itemMustExist: false, ...flags, lots }, title });
export const first = (j: any) => j?.lots?.[0];
export const mustOk = (r: { status: number; json: any }, what: string): void => {
  if (r.status !== 200 || r.json?.success !== true) throw new Error(`setup failed (${what}): ${r.status} ${JSON.stringify(r.json)}`);
};

// ------------------------------------------------------------------------------------------------------------------------------------------------ database (read only)
const where = (l: LotReq, alias = '') => {
  const a = alias ? alias + '.' : '';
  return `${a}OrderNum = ${lit(l.orderNum ?? '')} and ${a}LotNum = ${lit(l.lotNum ?? '')} and ${a}ItemNumber = ${lit(l.itemNumber ?? '')} and ${a}PrintEntity = ${lit(l.printEntity || 'ROBAR')}`;
};
export interface LotRow { Id: string; OrderNum: string; LotNum: string; ItemNumber: string; PrintEntity: string; Expires: string; Manufactured: string; Reassay: string; u1: string; u2: string; u3: string; u4: string; u5: string; LastTouch: string }
export const lotRows = (l: LotReq, title?: string) =>
  sql<LotRow>(`select Id, OrderNum, LotNum, ItemNumber, PrintEntity, convert(varchar(10), Expires, 120) Expires, convert(varchar(10), Manufactured, 120) Manufactured, convert(varchar(10), Reassay, 120) Reassay, u1, u2, u3, u4, u5, LastTouch from Lots where ${where(l)}`,
    title ?? `Lots row of ${l.itemNumber}`);
export const serialRows = (l: LotReq, title?: string) =>
  sql<{ SerialNumber: string }>(`select SerialNumber from LotSerialNumbers where ${where(l)} order by SerialNumber`, title ?? `LotSerialNumbers of ${l.itemNumber}`).map((x) => x.SerialNumber);
export const overrideRows = (l: LotReq, title?: string) =>
  sql<{ ShareName: string; ShareValue: string }>(`select ShareName, ShareValue from LotDataOverride where ${where(l)} order by ShareName`, title ?? `LotDataOverride of ${l.itemNumber}`);
export const lcnRows = (l: LotReq, title?: string) =>
  sql<{ LCN: string; LabelType: string }>(`select LCN, LabelType from LotControlNumbers where ${where(l)} order by LCN`, title ?? `LotControlNumbers of ${l.itemNumber}`);
/** Audit rows (x_ table) of a lot's sub-records, grouped by change type. */
export const audit = (table: 'x_Lots' | 'x_LotSerialNumbers' | 'x_LotDataOverride' | 'x_LotControlNumbers', l: LotReq, title?: string) =>
  sql<{ ChangeType: string; ChangeUser: string; ChangeReason: string; n: number }>(
    `select ChangeType, ChangeUser, ChangeReason, count(*) n from ${table} where ${where(l)} group by ChangeType, ChangeUser, ChangeReason order by ChangeType, ChangeReason`, title ?? `${table} rows of ${l.itemNumber}`);
export const auditCount = (table: 'x_Lots' | 'x_LotSerialNumbers' | 'x_LotDataOverride' | 'x_LotControlNumbers', l: LotReq): number =>
  sql<{ n: number }>(`select count(*) n from ${table} where ${where(l)}`, `${table} row count of ${l.itemNumber}`)[0].n;

/** An existing CL lot that has print history (read only fixture): returns its key, Id and the print status count. */
export const printedLot = () => {
  const r = sql<{ Id: string; OrderNum: string; LotNum: string; ItemNumber: string; PrintEntity: string }>(
    `select top 1 l.Id, l.OrderNum, l.LotNum, l.ItemNumber, l.PrintEntity from Lots l where l.OrderNum like 'CL%' and not exists (select 1 from LotSerialNumbers s where s.OrderNum = l.OrderNum and s.LotNum = l.LotNum and s.ItemNumber = l.ItemNumber) ` +
      `and exists (select 1 from PrintHistory p where p.OrderNum = l.OrderNum and p.Lot = l.LotNum and p.ItemNumber = l.ItemNumber and p.PrintEntity = l.PrintEntity and p.PrintStatus = 'Printed') order by l.OrderNum`,
    'an existing CL lot with print history (read only fixture)');
  if (!r.length) throw new Error('no CL lot with print history on this environment');
  const p = r[0];
  return { id: p.Id, req: { orderNum: p.OrderNum, lotNum: p.LotNum, itemNumber: p.ItemNumber, printEntity: p.PrintEntity } as LotReq };
};
/** An item number that exists in the Items table (CL* item). */
export const existingItem = (): string => {
  const r = sql<{ ItemNumber: string }>(`select top 1 ItemNumber from Items where ItemNumber like 'CL%' order by ItemNumber`, 'an existing CL item in the Items table');
  if (!r.length) throw new Error('no CL item in the Items table');
  return r[0].ItemNumber;
};
/** LCNs that exist in LabelControl (CL* items). */
export const existingLcns = (n = 2): string[] => sql<{ LCN: string }>(`select top ${n} LCN from LabelControl where ItemNumber like 'CL%' order by LCN`, 'existing LCNs of CL items').map((x) => x.LCN);
