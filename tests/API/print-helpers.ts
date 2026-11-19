// Helpers of the Printing API spec (project 20240924-002). HARD RULE (user, 2026-10-04, two incidents since): NEVER a live printer. Every print request goes through guard() / pr(), which refuses anything but
//  - printerName "Microsoft Print to PDF" (the virtual printer on the server) and printerModel "Microsoft Print To PDF" (the model: the print server renders a PRN, nothing is sent to a device), and
//  - an ipAddress that is exactly THIS PC (where FakePrinter listens on port 9100 and the server's "print to IP" connects) or the reserved documentation address 192.0.2.1 (never routable).
// The real printer 192.168.22.44 and every other address is refused. After the prints the spec audits the server's BarTender log: only "Printer: Microsoft Print to PDF" may appear.
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { API_BASE } from './api-fixtures';
import { http, lit, shrink, sql } from './api-support';

export const PDF_MODEL = 'Microsoft Print To PDF';
export const PDF_PRINTER = 'Microsoft Print to PDF';
export const SERVER = new URL(API_BASE).hostname;
const SERVER_C = `//${SERVER}/c$/Innovatum`;

/** This PC's IPv4 address (the address the server can reach the fake printer on). */
export function ownIp(): string {
  const all = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i!.address);
  const ip = all.find((a) => /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(a));
  if (!ip) throw new Error('no private IPv4 address on this PC');
  return ip;
}
export const NEVER_ROUTED_IP = '192.0.2.1';

/** Throws for any request that could reach a real printer. */
export function guard(body: Record<string, any>): void {
  const bad: string[] = [];
  if (body.printerName && body.printerName !== PDF_PRINTER) bad.push(`printerName ${JSON.stringify(body.printerName)}`);
  if (body.printerModel && body.printerModel !== PDF_MODEL) bad.push(`printerModel ${JSON.stringify(body.printerModel)}`);
  if (body.ipAddress && body.ipAddress !== ownIp() && body.ipAddress !== NEVER_ROUTED_IP) bad.push(`ipAddress ${JSON.stringify(body.ipAddress)}`);
  // printerName without printerModel = a SERVER print: the print server sends the job to the printer and the virtual PDF printer waits for a file-name dialog, which holds a BarTender engine (4 of them block all printing, 2026-11-19)
  if (body.printerName && !body.printerModel) bad.push('printerName without printerModel (a server print)');
  if (bad.length) throw new Error(`PRINT GUARD: refusing a print request that names ${bad.join(', ')}. Only the PDF printer / model, this PC and ${NEVER_ROUTED_IP} are allowed.`);
}

export interface PrintBody { [k: string]: unknown }
/** One call to /innoapi/Print/<route> through the guard. */
export async function pr(route: 'PrintByLCN' | 'PrintByItemLabelType' | 'PrintByTemplate' | 'GetCachedPRN' | 'UpdatePrintAsRejected', body: PrintBody, title?: string, o: { user?: string | null; password?: string; timeout?: number; allowTimeout?: boolean } = {}) {
  guard(body as Record<string, any>);
  const t0 = Date.now();
  const r = await http('POST', `Print/${route}`, { body, title: title ?? route, ...o });
  return { ...r, ms: Date.now() - t0 };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ PRN / PDF / image content
export const bytes = (b64: string | null | undefined): Buffer => Buffer.from(b64 ?? '', 'base64');
export const isPdf = (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-';
export const isJpg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
/** All text strings of a PDF (the PRN of the PDF printer model is a real PDF). */
export async function pdfStrings(buf: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, disableFontFace: true }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) out.push(...(await (await doc.getPage(i)).getTextContent()).items.map((x: { str?: string }) => (x.str ?? '').trim()).filter(Boolean));
  return out;
}
export const countOf = (strings: string[], marker: string) => strings.filter((s) => s === marker).length;

// ------------------------------------------------------------------------------------------------------------------------------------------------ database views (read only)
export interface Hist { PrintID: string; Printer: string; PrinterModel: string; PrintStatus: string; Copies: number; SerialNum: number; BatchQty: number; Reprint: number; LCN: string; UserID: string; ItemNumber: string; LabelName: string; Lot: string; OrderNum: string; FileName: string; Workstation: string }
export const history = (printId: string, title?: string) => sql<Hist>(
  `select PrintID, Printer, PrinterModel, PrintStatus, Copies, SerialNum, BatchQty, Reprint, LCN, UserID, ItemNumber, LabelName, Lot, OrderNum, FileName, Workstation from PrintHistory where PrintID = ${lit(printId)}`, title ?? `PrintHistory of ${printId}`)[0];
export interface Req { PrintID: string; RequestType: string; PrinterModel: string; AssignedTo: string; RequestingUser: string; WorkStatus: string; Copies: number; SerCopies: number; ResponseMessage: string }
export const request = (printId: string, title?: string) => sql<Req>(
  `select PrintID, RequestType, PrinterModel, AssignedTo, RequestingUser, WorkStatus, Copies, SerCopies, ResponseMessage from PrintRequests where PrintID = ${lit(printId)}`, title ?? `PrintRequests of ${printId}`)[0];
export const activity = (printId: string, title?: string) => sql<{ UserID: string; Action: string; ObjectType: string; ObjectName: string; ReasonCode: string; Comments: string }>(
  `select UserID, Action, ObjectType, ObjectName, ReasonCode, Comments from Activity where ObjectName = ${lit(printId)} order by Logged`, title ?? `Activity rows of ${printId}`);
export const fileDataB = (printId: string) => sql<{ Filename: string; bytes: number }>(
  `select Filename, datalength(Contents) bytes from FileDataB where Filename like ${lit(printId + '%')} order by Filename`, `FileDataB rows of ${printId}`);
export const lotById = (id: string) => sql<{ OrderNum: string; LotNum: string; ItemNumber: string; u1: string; u2: string }>(`select OrderNum, LotNum, ItemNumber, u1, u2 from Lots where Id = ${lit(id)}`, `Lots row ${id}`)[0];
/** Server path (UNC) of a file under the print server's Innovatum folder, from a Windows path stored in PrintHistory.FileName. */
export const uncOf = (winPath: string) => winPath.replace(/^[A-Za-z]:[\\/]+Innovatum/i, SERVER_C).replace(/\\/g, '/');
/** PrintedImages folder of the current month and a print id's .prn / .jpg there. */
export function printedImage(printId: string, ext: 'prn' | 'jpg'): string | undefined {
  const now = new Date();
  for (const d of [now, new Date(now.getFullYear(), now.getMonth() - 1, 15)]) {
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    const p = `${SERVER_C}/Network/PrintedImages/${ym}/${printId}.${ext}`;
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ BarTender log audit
const btFile = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${SERVER_C}/BarTenderLogs/${p(d.getMonth() + 1)}${p(d.getDate())}${d.getFullYear()}.txt`; // no path.join: it would break the leading // of the UNC path
};
export const btMark = (): { file: string; size: number } => { const file = btFile(); return { file, size: fs.existsSync(file) ? fs.statSync(file).size : 0 }; };
/** Printer names BarTender reports for jobs since the mark. */
export function btPrinters(mark: { file: string; size: number }): string[] {
  if (!fs.existsSync(mark.file)) return [];
  const size = fs.statSync(mark.file).size;
  const buf = Buffer.alloc(Math.max(0, size - mark.size));
  const fd = fs.openSync(mark.file, 'r');
  try { fs.readSync(fd, buf, 0, buf.length, mark.size); } finally { fs.closeSync(fd); }
  return [...new Set([...buf.toString('utf8').matchAll(/Printer:\s*([^\r\n\t]+)/g)].map((m) => m[1].trim()))];
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ fake printer (TCP 9100 on this PC)
export class FakePrinter {
  private server?: net.Server;
  private chunks: Buffer[] = [];
  private connections = 0;
  async start(): Promise<void> {
    this.server = net.createServer((s) => { this.connections++; s.on('data', (d: string | Buffer) => this.chunks.push(Buffer.from(d))); });
    await new Promise<void>((res, rej) => { this.server!.once('error', rej); this.server!.listen(9100, '0.0.0.0', () => res()); });
  }
  reset(): void { this.chunks = []; this.connections = 0; }
  /** The bytes received so far, after waiting until nothing new arrived for `quietMs` (or `maxMs` passed). */
  async received(quietMs = 1500, maxMs = 15000): Promise<{ data: Buffer; connections: number }> {
    const t0 = Date.now();
    let last = -1;
    let lastChange = Date.now();
    while (Date.now() - t0 < maxMs) {
      const n = this.chunks.reduce((s, c) => s + c.length, 0);
      if (n !== last) { last = n; lastChange = Date.now(); }
      if (n > 0 && Date.now() - lastChange >= quietMs) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    return { data: Buffer.concat(this.chunks), connections: this.connections };
  }
  async stop(): Promise<void> { await new Promise<void>((r) => (this.server ? this.server.close(() => r()) : r())); }
}

export { shrink };
