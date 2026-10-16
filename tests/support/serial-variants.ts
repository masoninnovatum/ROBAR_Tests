// The two kinds of serialized templates tested with Serial_Template_Setup.spec.ts / Serial_Print_To_PDF.spec.ts (2026-10-14). Fixture names live in test-data/<fixture>.
//  usr = sharename S_USerial: "unique serial", the label screen opens the Serial Number Management dialog (serial numbers are typed / uploaded / generated, one label per selected serial).
//  ser = sharename S_Ser: counter style, the label screen shows Batch Qty / Copy / Serial / Starting Serial / Of boxes (what the customer in the "prints only 1 label" question uses).

import * as path from 'path';

export interface SerialVariant {
  key: 'usr' | 'ser' | 'ser-inc' | 'ser-existing' | 'ser-counter';
  /** further sharenames bound to additional text objects on the template (RobarPrintUser.PrintRequests_Request: a component named S_COUNTER / S_Counter / S_DATAMATRIX turns Serial into Copy) */
  extraSharenames?: string[];
  /** an existing template + item (fixture json already in test-data): the setup spec skips it */
  existing?: boolean;
  /** Transforms > Serialization > Increment is set on the S_Ser text object (BarTender): without it only Copy prints (1 page), with it Copy x Serial (3 pages for Serial 3) */
  serializeIncrement?: boolean;
  /** the spec is skipped with this message */
  skip?: string;
  sharename: string;
  fixtureFile: string;
  itemStore: string;
  templatePrefix: string;
  itemPrefix: string;
  lotPrefix: string;
}

export const VARIANTS: SerialVariant[] = [
  { key: 'usr', sharename: 'S_USerial', fixtureFile: 'serial-pdf-fixture.json', itemStore: 'serial-pdf-item.json', templatePrefix: 'CLSerTpl', itemPrefix: 'CLSerItm', lotPrefix: 'CLSPL' },
  { key: 'ser', sharename: 'S_Ser', fixtureFile: 'serial-ser-fixture.json', itemStore: 'serial-ser-item.json', templatePrefix: 'CLSerSTpl', itemPrefix: 'CLSerSItm', lotPrefix: 'CLSSL' },
  { key: 'ser-inc', sharename: 'S_Ser', serializeIncrement: true, fixtureFile: 'serial-ser-inc-fixture.json', itemStore: 'serial-ser-inc-item.json', templatePrefix: 'CLSerITpl', itemPrefix: 'CLSerIItm', lotPrefix: 'CLSIL' },
  { key: 'ser-counter', sharename: 'S_Ser', extraSharenames: ['S_Counter'], fixtureFile: 'serial-ser-counter-fixture.json', itemStore: 'serial-ser-counter-item.json', templatePrefix: 'CLSerCTpl', itemPrefix: 'CLSerCItm', lotPrefix: 'CLSCL', skip: 'half-built experiment (S_Ser + S_Counter): its item setup failed twice at the Label Control row check; the code-derived S_COUNTER override is untested' },
  { key: 'ser-existing', sharename: 'S_Ser (existing template SingleSer_na)', fixtureFile: 'batchqty-item-ser.json', itemStore: '', templatePrefix: '', itemPrefix: '', lotPrefix: 'CLSEL', existing: true, skip: 'SingleSer_na shows no Serial boxes on the label screen: not an S_Ser-style template to ROBAR, so it is no comparison' },
];

export const fixturePath = (v: SerialVariant): string => path.join(__dirname, '..', '..', 'test-data', v.fixtureFile);
