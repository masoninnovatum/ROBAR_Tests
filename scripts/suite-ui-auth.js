// Accounts for the live run page (scripts/suite-ui.js), 2026-11-20.
// Everybody on the network can WATCH. Starting / stopping / pausing a run needs an account that the person running the tests (the user of this computer) has APPROVED:
//   1. someone opens the page from another computer, "Request access": picks a name + password -> account status "pending" (view only, signed in)
//   2. the owner opens http://127.0.0.1:<port> ON THIS COMPUTER, "Users": Approve / Deny / Delete (admin routes only answer requests that come from this computer)
//   3. an approved account gets the Start / Pause / Stop buttons on any computer, until the owner denies or deletes it (checked on every request, so a denial is immediate)
// Storage: scripts/suite-ui.users.json (gitignored): name, scrypt hash + salt, status, timestamps. Sessions live in memory only (a server restart signs everybody out).
// Every control action is appended to reports/suite-ui-audit.log (who, from where, what).
// The page is plain HTTP (no certificate): on a shared network a password can be read by someone sniffing it. Pick a password you use nowhere else.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,31}$/;
const SESSION_TTL_MS = 8 * 3600 * 1000;
const COOKIE = 'suiteui';
const MAX_USERS = 50;

module.exports = function makeAuth({ usersFile, auditFile, isLoopback }) {
  let store = { users: {} };
  try { const j = JSON.parse(fs.readFileSync(usersFile, 'utf8')); if (j && j.users) store = j; } catch { /* no accounts yet */ }
  const save = () => { const tmp = usersFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(store, null, 2)); fs.renameSync(tmp, usersFile); };
  const key = (n) => String(n || '').trim().toLowerCase();
  const ip = (req) => String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');

  const sessions = new Map(); // token -> { key, last }
  const fails = new Map();    // "ip|name" -> { n, until }
  const regs = new Map();     // ip -> [timestamps]

  function audit(who, from, action, detail) {
    try { fs.mkdirSync(path.dirname(auditFile), { recursive: true }); fs.appendFileSync(auditFile, `${new Date().toISOString()}\t${who}\t${from}\t${action}\t${detail || ''}\n`); } catch { /* the audit log must never break the page */ }
  }

  const hash = async (pw, salt) => (await scrypt(pw, salt, 32)).toString('hex');
  const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const err = (status, message) => Object.assign(new Error(message), { status });

  function cookieToken(req) {
    const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([0-9a-f]{48})').exec(req.headers.cookie || '');
    return m ? m[1] : '';
  }
  function sessionUser(req) {
    const t = cookieToken(req); const s = t && sessions.get(t);
    if (!s) return null;
    if (Date.now() - s.last > SESSION_TTL_MS) { sessions.delete(t); return null; }
    const u = store.users[s.key];
    if (!u) { sessions.delete(t); return null; }
    s.last = Date.now();
    return { name: u.name, status: u.status };
  }
  const setCookie = (token, maxAge) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

  function newSession(k) { const token = crypto.randomBytes(24).toString('hex'); sessions.set(token, { key: k, last: Date.now() }); return token; }

  async function register(req, name, password) {
    name = String(name || '').trim();
    if (!NAME_RE.test(name) || key(name) === 'local') throw err(400, 'Name: 2-32 characters (letters, digits, space . _ -), starting with a letter or digit.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 100) throw err(400, 'Password: 8 to 100 characters.');
    if (store.users[key(name)]) throw err(409, 'That name is already taken (use Sign in, or pick another name).');
    if (Object.keys(store.users).length >= MAX_USERS) throw err(429, 'Too many accounts; ask the owner of this computer to delete unused ones.');
    const from = ip(req); const now = Date.now();
    const recent = (regs.get(from) || []).filter((t) => now - t < 3600 * 1000);
    if (recent.length >= 5) throw err(429, 'Too many requests from this computer; try again later.');
    regs.set(from, [...recent, now]);
    const salt = crypto.randomBytes(16).toString('hex');
    store.users[key(name)] = { name, salt, hash: await hash(password, salt), status: 'pending', requested: new Date().toISOString(), lastLogin: '', lastIp: from };
    save(); audit(name, from, 'register', 'access requested');
    const token = newSession(key(name));
    return { token, cookie: setCookie(token, SESSION_TTL_MS / 1000), user: { name, status: 'pending' } };
  }

  async function login(req, name, password) {
    const k = key(name), from = ip(req), fk = from + '|' + k;
    const f = fails.get(fk);
    if (f && f.until > Date.now()) throw err(429, 'Too many wrong passwords; try again in a few minutes.');
    const u = store.users[k];
    const ok = u && typeof password === 'string' && same(await hash(password, u.salt), u.hash);
    if (!ok) {
      const n = (f ? (f.until && f.until <= Date.now() ? 0 : f.n) : 0) + 1; // a lock that has run out starts the count again
      fails.set(fk, { n, until: n >= 5 ? Date.now() + 5 * 60 * 1000 : 0 });
      audit(String(name).slice(0, 40), from, 'login-failed', '');
      throw err(401, 'Wrong name or password.');
    }
    fails.delete(fk);
    u.lastLogin = new Date().toISOString(); u.lastIp = from; save();
    const token = newSession(k);
    audit(u.name, from, 'login', u.status);
    return { token, cookie: setCookie(token, SESSION_TTL_MS / 1000), user: { name: u.name, status: u.status } };
  }

  function logout(req) { const t = cookieToken(req); if (t) sessions.delete(t); return setCookie('', 0); }

  // who may start / stop / pause: this computer, or an approved account
  function canControl(req) { if (isLoopback(req)) return true; const u = sessionUser(req); return !!u && u.status === 'approved'; }
  const who = (req) => (isLoopback(req) ? 'local' : (sessionUser(req) || {}).name || 'unknown');

  // owner-only (the caller checks isLoopback)
  const list = () => Object.values(store.users).map((u) => ({ name: u.name, status: u.status, requested: u.requested, lastLogin: u.lastLogin, lastIp: u.lastIp }));
  const pendingCount = () => Object.values(store.users).filter((u) => u.status === 'pending').length;
  function setStatus(name, status) {
    const u = store.users[key(name)];
    if (!u) throw err(404, 'No such account.');
    if (!['approved', 'denied'].includes(status)) throw err(400, 'status must be approved or denied');
    u.status = status; save(); audit('local', '127.0.0.1', status, u.name);
    if (status === 'denied') for (const [t, s] of sessions) if (s.key === key(name)) sessions.delete(t);
  }
  function remove(name) {
    const k = key(name);
    if (!store.users[k]) throw err(404, 'No such account.');
    const nm = store.users[k].name; delete store.users[k]; save(); audit('local', '127.0.0.1', 'deleted', nm);
    for (const [t, s] of sessions) if (s.key === k) sessions.delete(t);
  }

  return { register, login, logout, sessionUser, canControl, who, list, pendingCount, setStatus, remove, audit, ip };
};
