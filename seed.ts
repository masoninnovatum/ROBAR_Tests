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
};
