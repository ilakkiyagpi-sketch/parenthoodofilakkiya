// Happy Parenthood bell — a small Cloudflare Worker that rings users' phones at the right
// time, even when the app is closed. Set up once by the app owner (see bell/README.md);
// users only tap "Turn on alarms" in the app.
//
// Stores, per phone: its push address, time zone offset and the reminder times + short texts
// the app sends (e.g. "09:00 Learning time"). No logs, photos or health records.
//
// Needs: a D1 database bound as  DB   and a cron trigger  * * * * *  (every minute).
// Free plan: up to 45 phones can ring in the same minute. On Workers Paid, set the
// variable MAX_PUSH (e.g. 900) to ring more at once.
// Tables and push (VAPID) keys are created automatically on first use.

const SUBJECT = 'https://ilakkiyagpi-sketch.github.io/parenthoodofilakkiya/';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const clip = (s, n) => String(s || '').slice(0, n);
const TEST = { title: '🔔 Test alarm', body: 'Alarms work! Reminders will ring like this even when the app is closed.', go: '', tag: 'test' };

let ready = null;
function setup(env) {
  return (ready ||= env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, tz INTEGER, saved INTEGER, test_at INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS jobs (device_id TEXT NOT NULL, at INTEGER, daily_utc INTEGER, title TEXT, body TEXT, go TEXT, tag TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS jobs_at ON jobs(at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS jobs_daily ON jobs(daily_utc)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS jobs_dev ON jobs(device_id)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)'),
  ]).catch(e => { ready = null; throw e; }));
}

async function vapid(env) {
  const row = await env.DB.prepare('SELECT v FROM kv WHERE k = ?').bind('vapid').first();
  if (row) return JSON.parse(row.v);
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const k = { pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
  await env.DB.prepare('INSERT OR IGNORE INTO kv (k, v) VALUES (?, ?)').bind('vapid', JSON.stringify(k)).run();
  return JSON.parse((await env.DB.prepare('SELECT v FROM kv WHERE k = ?').bind('vapid').first()).v); // in case two phones raced
}

// Signed "who is sending" tokens, one per push service (FCM, Mozilla, Apple…), reused for this run.
async function pusher(env) {
  const k = await vapid(env), cache = {};
  const key = await crypto.subtle.importKey('jwk', { ...k.jwk, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  return async endpoint => {
    const aud = new URL(endpoint).origin;
    if (!cache[aud]) {
      const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })}`;
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
      cache[aud] = `vapid t=${unsigned}.${b64u(sig)}, k=${k.pub}`;
    }
    // Empty push: it only wakes the phone; the app then asks /due what to show.
    const res = await fetch(endpoint, { method: 'POST', headers: { TTL: '1800', Urgency: 'high', 'Content-Length': '0', Authorization: cache[aud] } });
    return res.status;
  };
}

// "HH:MM" in the phone's local time → minute of the day in UTC (tz = JS getTimezoneOffset, e.g. -330 for India)
const dailyUtc = (hm, tz) => { const [h, m] = hm.split(':').map(Number); return (((h * 60 + m + tz) % 1440) + 1440) % 1440; };
const minuteOfDay = t => Math.floor(t / 60000) % 1440;

async function removeDevice(env, id) {
  await env.DB.batch([env.DB.prepare('DELETE FROM jobs WHERE device_id = ?').bind(id), env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(id)]);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.DB) return json({ error: 'D1 database "DB" is not connected to this worker yet (Settings → Bindings).' }, 500);
    await setup(env);
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') {
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM devices').first();
      return new Response(`Happy Parenthood bell is running ✓ (${n.n} phones connected)`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS } });
    }
    if (path === '/vapid') return json({ key: (await vapid(env)).pub });
    if (path === '/due') {
      const id = url.searchParams.get('id') || '', now = Date.now(), from = now - 5 * 60000, to = now + 60000;
      const mins = []; for (let t = Math.ceil(from / 60000) * 60000; t < to; t += 60000) mins.push(minuteOfDay(t));
      const { results } = await env.DB.prepare(`SELECT title, body, go, tag FROM jobs WHERE device_id = ? AND ((at >= ? AND at < ?) OR daily_utc IN (${mins.map(() => '?').join(',')}))`)
        .bind(id, from, to, ...mins).all();
      const dev = await env.DB.prepare('SELECT test_at FROM devices WHERE id = ?').bind(id).first();
      if (dev?.test_at && dev.test_at >= from - 60000) results.push(TEST);
      return json(results.map(r => ({ title: r.title, body: r.body, go: r.go || '', tag: r.tag || '' })));
    }
    if (req.method !== 'POST') return json({ error: 'not found' }, 404);
    const body = await req.json().catch(() => ({}));
    const id = clip(body.id, 64);
    if (id.length < 16) return json({ error: 'bad id' }, 400);
    if (path === '/save') {
      const endpoint = String(body.sub?.endpoint || '');
      if (!endpoint.startsWith('https://') || endpoint.length > 1000) return json({ error: 'bad subscription' }, 400);
      const tz = Math.max(-900, Math.min(900, Number(body.tz) || 0));
      const jobs = (Array.isArray(body.jobs) ? body.jobs : []).slice(0, 40).map(j => ({
        at: Number(j.at) > 0 ? Math.round(Number(j.at)) : null, daily: /^\d{2}:\d{2}$/.test(j.daily || '') ? j.daily : null,
        title: clip(j.title, 80), body: clip(j.body, 200), go: clip(j.go, 16), tag: clip(j.tag, 40) })).filter(j => j.at || j.daily);
      await env.DB.batch([
        env.DB.prepare('INSERT INTO devices (id, endpoint, tz, saved) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET endpoint = excluded.endpoint, tz = excluded.tz, saved = excluded.saved').bind(id, endpoint, tz, Date.now()),
        env.DB.prepare('DELETE FROM jobs WHERE device_id = ?').bind(id),
        ...jobs.map(j => env.DB.prepare('INSERT INTO jobs (device_id, at, daily_utc, title, body, go, tag) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(id, j.at, j.daily ? dailyUtc(j.daily, tz) : null, j.title, j.body, j.go, j.tag)),
      ]);
      return json({ ok: true, jobs: jobs.length });
    }
    if (path === '/test') {
      const dev = await env.DB.prepare('SELECT endpoint FROM devices WHERE id = ?').bind(id).first();
      if (!dev) return json({ error: 'This phone is not connected yet' }, 404);
      await env.DB.prepare('UPDATE devices SET test_at = ? WHERE id = ?').bind(Date.now(), id).run();
      const status = await (await pusher(env))(dev.endpoint);
      if (status === 404 || status === 410) { await removeDevice(env, id); return json({ error: 'This phone stopped accepting alarms. Turn them on again.' }, 410); }
      return json({ ok: status < 300, status });
    }
    if (path === '/remove') { await removeDevice(env, id); return json({ ok: true }); }
    return json({ error: 'not found' }, 404);
  },

  // Every minute: ring each phone that has a reminder due this minute.
  async scheduled(event, env) {
    await setup(env);
    const t = event.scheduledTime - (event.scheduledTime % 60000);
    const { results } = await env.DB.prepare(`SELECT DISTINCT d.id, d.endpoint FROM jobs j JOIN devices d ON d.id = j.device_id
      WHERE (j.at >= ? AND j.at < ?) OR j.daily_utc = ? LIMIT ?`).bind(t, t + 60000, minuteOfDay(t), Number(env.MAX_PUSH) || 45).all();
    if (results.length) {
      const push = await pusher(env);
      await Promise.all(results.map(async d => {
        const status = await push(d.endpoint).catch(() => 0);
        if (status === 404 || status === 410) await removeDevice(env, d.id); // app removed or alarms turned off
      }));
    }
    if (minuteOfDay(t) === 0) { // tidy up once a day
      await env.DB.prepare('DELETE FROM jobs WHERE at IS NOT NULL AND at < ?').bind(t - 86400000).run();
      await env.DB.prepare('DELETE FROM devices WHERE saved < ? AND id NOT IN (SELECT DISTINCT device_id FROM jobs)').bind(t - 60 * 86400000).run();
    }
  },
};
