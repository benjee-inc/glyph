const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 8080;
const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 5 }) : null;
let dbReady = false;

async function initDb() {
  if (!pool) { console.warn('DATABASE_URL not set; waitlist disabled'); return; }
  for (let i = 0; i < 10; i++) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS waitlist (
        id serial PRIMARY KEY,
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_lower_idx ON waitlist (lower(email))');
      await pool.query(`CREATE TABLE IF NOT EXISTS visitors (
        id uuid PRIMARY KEY,
        first_seen timestamptz NOT NULL DEFAULT now(),
        last_seen timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
        id uuid PRIMARY KEY,
        visitor_id uuid NOT NULL REFERENCES visitors(id),
        started_at timestamptz NOT NULL DEFAULT now(),
        last_seen timestamptz NOT NULL DEFAULT now(),
        landing_path text,
        referrer text,
        user_agent text
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS pageviews (
        id serial PRIMARY KEY,
        session_id uuid NOT NULL,
        visitor_id uuid NOT NULL,
        path text,
        referrer text,
        title text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query('CREATE INDEX IF NOT EXISTS sessions_started_idx ON sessions (started_at)');
      await pool.query('CREATE INDEX IF NOT EXISTS pageviews_created_idx ON pageviews (created_at)');
      await pool.query('CREATE INDEX IF NOT EXISTS visitors_last_seen_idx ON visitors (last_seen)');
      dbReady = true;
      console.log('db ready');
      return;
    } catch (e) {
      console.error('db init failed, retrying', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.get('/api/health', async (req, res) => {
  let db = false;
  if (pool) { try { await pool.query('SELECT 1'); db = true; } catch (e) {} }
  res.json({ ok: true, db });
});

app.post('/api/waitlist', express.json({ limit: '2kb' }), async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'bad_email' });
  }
  if (!pool) return res.status(503).json({ ok: false, error: 'unavailable' });
  try {
    const r = await pool.query(
      'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT ((lower(email))) DO NOTHING RETURNING id',
      [email]
    );
    if (r.rowCount === 0) return res.status(409).json({ ok: true, duplicate: true });
    return res.json({ ok: true });
  } catch (e) {
    console.error('insert failed', e.message);
    return res.status(500).json({ ok: false, error: 'server' });
  }
});

// ---- first-party analytics ----
const crypto = require('crypto');
const ANALYTICS_TOKEN = process.env.ANALYTICS_TOKEN || '';
const SESSION_MS = 30 * 60 * 1000;
const YEAR_S = 365 * 24 * 3600;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_RE = /bot|crawl|spider|slurp|preview|monitor|headless|curl|wget|python-requests|httpclient/i;

function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function setCookies(res, vid, sid) {
  res.append('Set-Cookie', `glyph_vid=${vid}; Path=/; Max-Age=${YEAR_S}; Secure; SameSite=Lax`);
  res.append('Set-Cookie', `glyph_sid=${sid}; Path=/; Max-Age=${SESSION_MS / 1000}; Secure; SameSite=Lax`);
}
const clip = (v, n) => String(v || '').slice(0, n);
function optedOut(req) { return req.get('DNT') === '1' || req.get('Sec-GPC') === '1'; }
const isBot = req => BOT_RE.test(req.get('User-Agent') || '') && req.get('X-Glyph-Test') !== '1';

app.post('/api/analytics/pageview', express.json({ limit: '4kb' }), async (req, res) => {
  if (optedOut(req)) return res.json({ ok: true, skipped: 'dnt' });
  if (isBot(req)) return res.json({ ok: true, skipped: 'bot' });
  if (!pool || !dbReady) return res.status(503).json({ ok: false, error: 'unavailable' });
  const b = req.body || {};
  const c = cookies(req);
  let vid = UUID_RE.test(c.glyph_vid || '') ? c.glyph_vid : crypto.randomUUID();
  let sid = UUID_RE.test(c.glyph_sid || '') ? c.glyph_sid : null;
  const path_ = clip(b.path, 500) || '/';
  const ref = clip(b.referrer, 500);
  const ua = clip(req.get('User-Agent'), 400);
  try {
    await pool.query(
      `INSERT INTO visitors (id) VALUES ($1)
       ON CONFLICT (id) DO UPDATE SET last_seen = now()`, [vid]);
    let live = false;
    if (sid) {
      const r = await pool.query(
        `UPDATE sessions SET last_seen = now()
         WHERE id = $1 AND visitor_id = $2 AND last_seen > now() - interval '30 minutes' RETURNING id`,
        [sid, vid]);
      live = r.rowCount > 0;
    }
    if (!live) {
      sid = crypto.randomUUID();
      await pool.query(
        `INSERT INTO sessions (id, visitor_id, landing_path, referrer, user_agent) VALUES ($1,$2,$3,$4,$5)`,
        [sid, vid, path_, ref, ua]);
    }
    await pool.query(
      `INSERT INTO pageviews (session_id, visitor_id, path, referrer, title) VALUES ($1,$2,$3,$4,$5)`,
      [sid, vid, path_, ref, clip(b.title, 200)]);
    setCookies(res, vid, sid);
    res.json({ ok: true, visitorId: vid, sessionId: sid });
  } catch (e) {
    console.error('pageview failed', e.message);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

app.post('/api/analytics/heartbeat', express.json({ limit: '1kb' }), async (req, res) => {
  if (optedOut(req)) return res.json({ ok: true, skipped: 'dnt' });
  if (!pool || !dbReady) return res.status(503).json({ ok: false, error: 'unavailable' });
  const c = cookies(req);
  const vid = c.glyph_vid, sid = c.glyph_sid || (req.body && req.body.sessionId);
  if (!UUID_RE.test(vid || '') || !UUID_RE.test(sid || '')) return res.json({ ok: true, live: false });
  try {
    const r = await pool.query(
      `UPDATE sessions SET last_seen = now()
       WHERE id = $1 AND visitor_id = $2 AND last_seen > now() - interval '30 minutes' RETURNING id`,
      [sid, vid]);
    if (r.rowCount) {
      await pool.query('UPDATE visitors SET last_seen = now() WHERE id = $1', [vid]);
      setCookies(res, vid, sid);
    }
    res.json({ ok: true, live: r.rowCount > 0 });
  } catch (e) {
    console.error('heartbeat failed', e.message);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

app.get('/api/analytics/summary', async (req, res) => {
  const auth = req.get('Authorization') || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.query.token || '');
  const ok = ANALYTICS_TOKEN && tok.length === ANALYTICS_TOKEN.length &&
    crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(ANALYTICS_TOKEN));
  if (!ok) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!pool) return res.status(503).json({ ok: false, error: 'unavailable' });
  try {
    const day = `(date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto')`;
    const r = await pool.query(`SELECT
      (SELECT count(*) FROM visitors)::int AS "uniqueVisitorsAllTime",
      (SELECT count(DISTINCT visitor_id) FROM sessions WHERE last_seen >= ${day})::int AS "uniqueVisitorsToday",
      (SELECT count(*) FROM sessions WHERE started_at >= ${day})::int AS "sessionsToday",
      (SELECT count(*) FROM sessions)::int AS "sessionsAllTime",
      (SELECT count(*) FROM pageviews WHERE created_at >= ${day})::int AS "pageviewsToday",
      (SELECT count(*) FROM pageviews)::int AS "pageviewsAllTime",
      (SELECT count(DISTINCT visitor_id) FROM sessions WHERE last_seen > now() - interval '5 minutes')::int AS "liveNow",
      (SELECT count(*) FROM waitlist)::int AS "waitlistSignups"`);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, timezone: 'America/Toronto', ...r.rows[0] });
  } catch (e) {
    console.error('summary failed', e.message);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

const pub = path.join(__dirname, 'public');
app.use('/assets', express.static(path.join(pub, 'assets'), { maxAge: '7d' }));
app.use(express.static(pub, { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(pub, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log('listening on ' + PORT));
initDb();
