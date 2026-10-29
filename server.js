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

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

const pub = path.join(__dirname, 'public');
app.use('/assets', express.static(path.join(pub, 'assets'), { maxAge: '7d' }));
app.use(express.static(pub, { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(pub, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log('listening on ' + PORT));
initDb();
