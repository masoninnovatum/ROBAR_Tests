// Test-data naming (changed 2026-10-13): everything NEW that a spec creates (items, templates, MD records, lots, filters, users, groups, codes ...) is prefixed with "CL" (Claude).
// Data created before that is prefixed "MB" (the old convention) and stays: it cannot all be deleted, and existing specs / fixtures (MBPWLoginGrp, MBPWLogin01, MBBQ* lots ...) keep using it.
// Guards that protect shared accounts / records accept BOTH prefixes (MB = legacy test data, CL = new test data) and nothing else.

export const TEST_PREFIX = 'CL';
export const LEGACY_PREFIX = 'MB';

/** True when `name` starts with the current ("CL") or the legacy ("MB") test-data prefix, case-insensitive. */
export function isTestOwned(name: string): boolean {
  return /^(CL|MB)/i.test(name);
}

/** Builds a unique new-test-data name: CL + tag + the last 6 digits of the clock, e.g. `testName('PDF')` -> CLPDF123456. */
export function testName(tag = ''): string {
  return `${TEST_PREFIX}${tag}${Date.now().toString().slice(-6)}`;
}
