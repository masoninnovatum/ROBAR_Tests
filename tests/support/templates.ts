// Resolves which .btw file to use for ROBAR flows that browse for an existing template (e.g.
// Template Management's Replace Template dialog), backed by seed.ts's ROBAR_BTW_FILE /
// ROBAR_BTW_LIBRARY_DIR.

import fs from 'fs';
import path from 'path';
import { ROBAR } from '../../seed';

/**
 * Returns the full path to the .btw file to use. If ROBAR.btwFile is set, resolves it (by exact
 * name, with or without the .btw extension) within ROBAR.btwLibraryDir. Otherwise returns the
 * newest-modified .btw file in that folder.
 */
export function resolveBtwFile(): string {
  const dir = ROBAR.btwLibraryDir;
  const candidates = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.btw'));
  if (candidates.length === 0) {
    throw new Error(`No .btw files found in ${dir}`);
  }

  if (ROBAR.btwFile) {
    const wanted = ROBAR.btwFile.toLowerCase().endsWith('.btw') ? ROBAR.btwFile.toLowerCase() : `${ROBAR.btwFile.toLowerCase()}.btw`;
    const match = candidates.find((f) => f.toLowerCase() === wanted);
    if (!match) {
      throw new Error(`ROBAR_BTW_FILE "${ROBAR.btwFile}" not found in ${dir}. Available: ${candidates.join(', ')}`);
    }
    return path.join(dir, match);
  }

  const newest = candidates
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  return path.join(dir, newest.f);
}

/** Template Management keeps its Approved Only / Unapproved Only / Both filter (#drpApprove) between sessions; a just-created template is unapproved, so a spec that looks for it must select an option that lists it. */
export async function selectAnyApproval(frame: import('@playwright/test').Frame): Promise<void> {
  const sel = frame.locator('#drpApprove');
  const opts = await sel.locator('option').evaluateAll((os) => os.map((o: any) => ({ v: o.value as string, t: (o.textContent ?? '').trim() })));
  const hit = opts.find((o) => /approved and unapproved|both|all/i.test(o.t)) ?? opts.find((o) => /unapproved/i.test(o.t));
  if (hit) await sel.selectOption({ label: hit.t }); // by label: the knockout options carry no value attribute
  console.log(`approval filter -> ${hit ? hit.t : 'no matching option'} (options ${JSON.stringify(opts.map((o) => o.t))})`);
}
