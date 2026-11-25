// Happy Parenthood bell — a tiny Cloudflare Worker that rings the family's phones at the
// right time, even when the app is closed.
//
// What it stores (in your own Cloudflare KV): for each connected phone, its push address
// and the list of reminder times + short texts the app sends (e.g. "09:00 Learning time").
// No logs, photos or health records ever leave the phone.
//
// Setup (see the app: Settings → Reminders & alarms → "How to set up"):
//   1. KV namespace bound as  BELL
//   2. Cron trigger           * * * * *   (every minute)
// The push keys are created automatically the first time the app connects.

const SUBJECT = 'https://ilakkiyagpi-sketch.github.io/parenthoodofilakkiya/';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const clip = (s, n) => String(s || '').slice(0, n);

async function vapid(env) {
  let k = await env.BELL.get('vapid', 'json');
  if (!k) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    k = { pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
    await env.BELL.put('vapid', JSON.stringify(k));
  }
  return k;
}

// Wake the phone with an empty push; the app then asks /due what to show.
async function sendPush(env, sub) {
  const k = await vapid(env);
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: new URL(sub.endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })}`;
  const key = await crypto.subtle.importKey('jwk', { ...k.jwk, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  const res = await fetch(sub.endpoint, { method: 'POST', headers: { TTL: '1800', Urgency: 'high', 'Content-Length': '0', Authorization: `vapid t=${unsigned}.${b64u(sig)}, k=${k.pub}` } });
  return res.status;
}

// Jobs due in [from, to). A job is { at: epoch-ms } (one time) or { daily: "HH:MM" } in the phone's time zone.
function dueJobs(dev, from, to) {
  const out = (dev.jobs || []).filter(j => {
    if (j.at) return j.at >= from && j.at < to;
    if (!j.daily) return false;
    const [h, m] = j.daily.split(':').map(Number), want = h * 60 + m, off = Number(dev.tz) || 0;
    for (let t = Math.ceil(from / 60000) * 60000; t < to; t += 60000) {
      const local = ((Math.floor(t / 60000) - off) % 1440 + 1440) % 1440;
      if (local === want) return true;
    }
    return false;
  });
  if (dev.testAt && dev.testAt >= from - 60000 && dev.testAt < to) out.push({ title: '🔔 Test alarm', body: 'The bell works! Reminders will ring like this even when the app is closed.', tag: 'test', go: '' });
  return out;
}

async function dropDevice(env, id) {
  await env.BELL.delete(`dev:${id}`);
  const ids = (await env.BELL.get('ids', 'json')) || [];
  await env.BELL.put('ids', JSON.stringify(ids.filter(x => x !== id)));
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.BELL) return json({ error: 'KV namespace "BELL" is not connected to this worker yet (Settings → Bindings).' }, 500);
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') return new Response('Happy Parenthood bell is running ✓', { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS } });
    if (path === '/vapid') return json({ key: (await vapid(env)).pub });
    if (path === '/due') {
      const dev = await env.BELL.get(`dev:${url.searchParams.get('id')}`, 'json');
      if (!dev) return json([]);
      const now = Date.now();
      return json(dueJobs(dev, now - 5 * 60000, now + 60000).map(j => ({ title: j.title, body: j.body, go: j.go || '', tag: j.tag || '' })));
    }
    if (req.method !== 'POST') return json({ error: 'not found' }, 404);
    const body = await req.json().catch(() => ({}));
    const id = clip(body.id, 64);
    if (id.length < 16) return json({ error: 'bad id' }, 400);
    if (path === '/save') {
      if (!body.sub?.endpoint?.startsWith('https://')) return json({ error: 'bad subscription' }, 400);
      const jobs = (Array.isArray(body.jobs) ? body.jobs : []).slice(0, 80).map(j => ({
        at: Number(j.at) || undefined, daily: /^\d{2}:\d{2}$/.test(j.daily || '') ? j.daily : undefined,
        title: clip(j.title, 80), body: clip(j.body, 200), go: clip(j.go, 16), tag: clip(j.tag, 40) })).filter(j => j.at || j.daily);
      const old = await env.BELL.get(`dev:${id}`, 'json');
      await env.BELL.put(`dev:${id}`, JSON.stringify({ sub: { endpoint: body.sub.endpoint }, jobs, tz: Number(body.tz) || 0, name: clip(body.name, 40), saved: Date.now() }));
      if (!old) {
        const ids = (await env.BELL.get('ids', 'json')) || [];
        if (!ids.includes(id)) { ids.push(id); await env.BELL.put('ids', JSON.stringify(ids.slice(-20))); }
      }
      return json({ ok: true, jobs: jobs.length });
    }
    if (path === '/test') {
      const dev = await env.BELL.get(`dev:${id}`, 'json');
      if (!dev) return json({ error: 'This phone is not connected yet' }, 404);
      dev.testAt = Date.now();
      await env.BELL.put(`dev:${id}`, JSON.stringify(dev));
      const status = await sendPush(env, dev.sub);
      return json({ ok: status < 300, status });
    }
    if (path === '/remove') { await dropDevice(env, id); return json({ ok: true }); }
    return json({ error: 'not found' }, 404);
  },

  // Runs every minute: ring each phone that has something due this minute.
  async scheduled(event, env) {
    const t = event.scheduledTime - (event.scheduledTime % 60000);
    const ids = (await env.BELL.get('ids', 'json')) || [];
    for (const id of ids) {
      const dev = await env.BELL.get(`dev:${id}`, 'json');
      if (!dev) continue;
      if (!dueJobs(dev, t, t + 60000).length) continue;
      const status = await sendPush(env, dev.sub).catch(() => 0);
      if (status === 404 || status === 410) await dropDevice(env, id); // phone unsubscribed or app removed
    }
  },
};
