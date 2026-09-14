// Central ROBAR login/config, loaded from environment variables so credentials never live in
// source. Copy .env.example to .env and fill in real values -- .env is gitignored, never commit it.

try {
  process.loadEnvFile();
} catch {
  // .env is optional locally (e.g. CI supplies real env vars directly instead).
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const ROBAR = {
  name: 'Innovatum Web Menu (ROBAR)',
  url: requireEnv('ROBAR_BASE_URL'),
  username: requireEnv('ROBAR_USERNAME'),
  password: requireEnv('ROBAR_PASSWORD'),
  // Optional. When unset, tests that create a template generate a random name themselves instead.
  templateName: process.env.ROBAR_TEMPLATE_NAME || undefined,
  // Folder of existing .btw files tests can pick from for "browse for an existing template" flows
  // (e.g. Replace Template). Defaults to Mason's local template library.
  btwLibraryDir:
    process.env.ROBAR_BTW_LIBRARY_DIR ||
    String.raw`C:\Users\Mason\OneDrive - Innovatum, Inc\Desktop\Attachments and Upload Files\Templates`,
  // Optional. Name (with or without .btw) of a specific file in btwLibraryDir to use. When unset,
  // the newest-modified .btw file in that folder is used instead.
  btwFile: process.env.ROBAR_BTW_FILE || undefined,
  // Master Data Management schema to use for tests that create/edit master data records. Defaults
  // to "RobarMasterData", a pre-existing test schema in this environment.
  mdmSchema: process.env.ROBAR_MDM_SCHEMA || 'RobarMasterData',
  // Optional. Fixed Master Data item number for the "New Record" test. Leave unset/commented to
  // generate a random "MBMDMNNNNN" item number each run (default behavior), matching how template
  // and item names are generated elsewhere in this suite.
  mdmItemNumber: process.env.ROBAR_MDM_ITEM_NUMBER || undefined,
};
