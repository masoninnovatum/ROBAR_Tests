// Fixed fixtures for the REST API specs (TST703). Users and groups can never be deleted, so these are created once (API_00_Setup_Fixtures.spec.ts) and reused.
// All names start with CL (the security guard in tests/support/security.ts only lets CL/MB names be written).
import { ROBAR } from '../../seed';
import * as sec from '../support/security';

/** Server root, e.g. http://vmsrvtst703/ (the API lives under <root>innoapi/). */
export const SRV = ROBAR.url.replace(/innovatum\/WebMenu\/?$/i, '');
export const API_BASE = SRV + 'innoapi/';

/** API group: holds every API_* process (one group for all API specs) plus LT_CLLabelType so the Items API can read and write items of the CL label type. Specs toggle LT_/API_ rows on it and restore them. */
export const API_GROUP = 'CLAPIGrp';
export const API_PROCESSES = ['API_DL', 'API_Lots', 'API_MD', 'API_Items', 'API_Printing', 'API_LC', 'LT_CLLabelType', 'LT_Carton Label', 'LT_MBLT1', 'SCH_RobarMasterData', 'SCH_CLSchemaData', 'SCH_MBNonItemschema2', 'LC_Manage_ProdAvail'];

/** Master Data API test data (schema security SCH_<schema>): items go into the main item schema (it already holds the CL* items of other specs), non-item records into the CL data schema; the empty MB fixture schema is only READ. */
export const MD_ITEM_SCHEMA = 'RobarMasterData';
export const MD_RECORD_SCHEMA = 'CLSchemaData';
export const MD_EMPTY_SCHEMA = 'MBNonItemschema2';
/** Schemas the API group is NOT authorized for: an item schema (holds CL* items) and a non-item schema (MB-owned, has records). */
export const MD_DENIED_ITEM_SCHEMA = 'Images';
export const MD_DENIED_RECORD_SCHEMA = 'MBNonItemSchema';

/** Items API test data. CLLabelType has no label (template), so items live in 'Carton Label' (already holds the CL* items of other specs) and 'MBLT1' (second type for Save As). */
export const LT_MAIN = 'Carton Label';
export const LT_SECOND = 'MBLT1';
/** A .btw label type the API group is NOT authorized for. */
export const LT_DENIED = 'Shipper Label';
/** A non-.btw label type; the spec's security phase grants LT_MBDOCX to the API group temporarily and restores it. */
export const LT_NON_BTW = 'MBDOCX';

/** SQL (read only, Windows login, sqlcmd). Override with ROBAR_DB_SERVER / ROBAR_DB_NAME. */
export const DB_SERVER = process.env.ROBAR_DB_SERVER ?? 'db01';
export const DB_NAME = process.env.ROBAR_DB_NAME ?? 'ROBARTST703';

/** Existing legacy group that holds only Login_WebMenu (no API_* process): home of the "authenticated but not authorized" API user. */
export const NO_API_GROUP = 'MBPWLoginGrp';

export const API_USER = 'CLAPI01'; // authorized API caller
export const NO_API_USER = 'CLAPINoApi01'; // valid credentials, no API_* process
export const FACILITY = 'Atlanta Test';

export const API_FIXTURE_USERS: Array<{ id: string; group: string; fullName: string }> = [
  { id: API_USER, group: API_GROUP, fullName: 'Playwright API fixture (authorized API user)' },
  { id: NO_API_USER, group: NO_API_GROUP, fullName: 'Playwright API fixture (no API process)' },
];
