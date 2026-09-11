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
