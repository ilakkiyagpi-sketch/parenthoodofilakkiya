# The bell: alarms when the app is closed (one-time setup by the app owner)

Android pauses web apps that are closed, so the app alone can't ring at 9:00. The **bell** is a
small free Cloudflare Worker that keeps each phone's reminder times and wakes the phone with a
push message at the right minute. The app then shows the notification (its own icon; tapping it
opens the right screen).

Users never see any of this: they only tap **⚙️ → Reminders & alarms → 🔔 Turn on alarms**.

What is stored on the bell: each phone's push address, its time zone, and the reminder times with
their short texts (e.g. "09:00 📚 Learning time for Aadhi"). No logs, photos or health records.

## Setup (about 10 minutes, on a computer)

1. Sign in at **https://dash.cloudflare.com** (the free plan is enough).
2. **Create the database:** left menu → **Storage & Databases → D1 SQL Database → Create**.
   Name it `hp-bell`. (No tables needed: the bell creates them itself.)
3. **Create the worker:** left menu → **Workers & Pages → Create → Worker** → start from
   "Hello World" → name it `hp-bell` → **Deploy**.
4. **Paste the code:** open the worker → **Edit code** → delete everything → paste the whole of
   [`bell/worker.js`](worker.js) → **Deploy**.
5. **Connect the database:** worker → **Settings → Bindings → Add → D1 database**.
   Variable name **`DB`**, database `hp-bell` → **Save**.
6. **Every-minute timer:** worker → **Settings → Trigger events → Add → Cron trigger** →
   `* * * * *` (every minute) → **Save**.
7. **Check it:** open the worker address (shown at the top, e.g.
   `https://hp-bell.yourname.workers.dev`). It should say
   *"Happy Parenthood bell is running ✓ (0 phones connected)"*.
8. **Tell the app:** put that address in [`js/config.js`](../js/config.js):
   ```js
   export const BELL_URL = 'https://hp-bell.yourname.workers.dev';
   ```
   Also bump `CACHE` in `sw.js`, then publish. (Or send the address to Claude and it will do this.)

That's it. On each phone: open the app → ⚙️ → **Reminders & alarms** → **🔔 Turn on alarms** →
Allow → **🔔 Test alarm**, then lock the phone: it should ring within a few seconds.

## Limits and costs

- Free plan: 100,000 requests/day and plenty of D1 space. Each phone uses about 10–30 requests a day.
- Free plan rings **up to 45 phones in the same minute** (e.g. everyone at 09:00). For more, move the
  worker to **Workers Paid** ($5/month) and add a variable **`MAX_PUSH`** = `900`
  (worker → Settings → Variables).
- Phones that uninstall the app or turn alarms off are removed automatically.

## If something goes wrong

- Address shows an error about **"D1 database DB is not connected"** → redo step 5 (the variable
  name must be exactly `DB`).
- Test alarm says it was sent but nothing rings → on the phone check **Settings → Apps → Chrome →
  Notifications** are on, and battery saver isn't blocking Chrome.
- Worker → **Logs** shows each minute's run and any errors.
