# Happy Parenthood 👶 → 🧑‍🎓

A personal, offline-first parenting app that tracks **every part of a child's day**, their **health**, and their **growth**, and **adapts itself as the child grows** from 0 to 15+ years. It installs on the phone as its own app (PWA) and needs no server, account or build step.

**Open it:** https://ilakkiyagpi-sketch.github.io/parenthoodofilakkiya/

## What it does

| Area | Features |
|---|---|
| **Home** | 🎤 **Tell me what happened**: speak (or type) a sentence such as "He ate 4 spoons of ragi at 8, napped from 11 to 12:30 and peed twice". The app turns it into separate log entries for you to check and save. Below that are **8 big one-tap buttons** (tap once to start a timer, tap again to stop; pee/poop count +1), with the rest under "More buttons". You can choose which 8 in Settings. Then today at a glance, plus three small tabs: **Today's log**, **Summary** (age-based targets) and **This month** (milestones to work on, with ideas; new things he did; the feelings activity; tip; next routine item). |
| **Diary** | Any day's full log; edit, delete or add past entries. |
| **Health** | Track an illness from start to recovery, with a temperature chart, symptoms, **prescriptions** (doctor, clinic, diagnosis, each medicine with dose, how often, days, before/after food, plus a **photo of the prescription**), **"Gave now"** buttons that show when each medicine was last given and when the next dose is due, doctor visits and vaccines. Everything is searchable ("saline", "Dr. Priya", "cough"…). |
| **Heart** | Emotional intelligence: the stage goal and activities, logging of kind and challenging moments, triggers, and what calms him. |
| **More** | Routine/timetable, **Milestones** (with a 💡 idea for each area), **New things** (daily firsts with photos), Trends, Growth, Foods tried, Vaccines, Guide, Settings, Install. |

**Photos:** add photos to any entry (meals, prescriptions, memories, illnesses…). They are shrunk on the phone to about 100 KB and backed up to a Google Drive folder.

**Voice typing:** every text box has a 🎤 button. Speech recognition is done by the phone browser's built-in service (Chrome on Android works best; English, Tamil and Hindi can be chosen in Settings). Only English sentences are turned into structured entries; anything else is saved as a note.

### Logged details
Wake-up (mood) · night sleep (how he settled, night wake-ups, quality) · naps · breastfeeds (side, duration) · bottle (type, ml) · **meals with every food + quantity + unit** (tsp / tbsp / ml / g / bowl / katori / piece…), appetite, self-feeding, reactions · water · pee (count) · poop (consistency) · potty practice · bath / oil massage · teeth brushing · morning learning (activity, details, attention) · story books · homework · exam scores · play (indoor/outdoor, type, with whom) · floor/crawl time · evening walk · sport · screen time · hobbies · chores · growth · medicine · illness · new teeth · doctor visits · mood · bonding time · gratitude · child's journal · memories. Every entry records **who** logged it (Amma, Appa, Paati, Thatha…).

### How it upgrades with age
Every time it opens, the app calculates the child's age (corrected age for premature babies under 2) and picks a stage:

| Stage | Age | EI focus |
|---|---|---|
| Newborn | 0–6 m | Feeling safe |
| Explorer Baby | 6–12 m | Trust & connection |
| Little Walker | 1–2 y | Naming feelings |
| Busy Toddler | 2–3 y | Calming down |
| Preschooler | 3–5 y | Empathy & friendship |
| Early Learner | 5–8 y | Self-control & resilience |
| Growing Kid | 8–12 y | Values, empathy in action |
| Young Teen | 12 y + | Self-awareness, purpose, relationships |

Each stage changes: the **timetable**, **daily targets**, **which log types appear** (e.g. breastfeeding and crawl time fade out; potty practice, homework, exam scores, sport, journal appear), **options in forms** (play types, learning activities, feelings vocabulary), **behaviours tracked**, **milestones**, **guide articles** and **daily tips**. When a new stage begins, a "New stage unlocked" card explains what changed.

## Install on the phone (own icon, works offline)
- **Android (Chrome):** open the link above, then tap **📲 Install** in the app (or ⋮ menu → *Install app*).
- **iPhone (Safari):** Share → *Add to Home Screen*.

## Run it

Any static web server works:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

### Put it on your phone (free)
1. In GitHub: **Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`.
2. Open the Pages URL on the phone.
3. Android Chrome: menu → **Install app / Add to Home screen**. iPhone Safari: Share → **Add to Home Screen**.

It then works offline like a normal app.

## One-tap timers
On **Today**, tap **Nap**, **Night sleep**, **Eating**, **Bath**, **Play**, **Walk**, **Learning**, **Story time**, **Breastfeed**, **Crawl time**, **Oil massage**, **Screen** (and later **Homework**, **Sport**) once to start a live timer, and tap the same button again to stop. The duration is logged automatically.
- Timers keep running even if you close the app or the phone restarts.
- Starting night sleep stops a running nap (and the other way round). **Woke up** stops any running sleep.
- After stopping **Eating**, the form opens so you can add what he ate and how much.
- Every action shows **Undo** and **Add details** for a few seconds.

## Your data & online backup (Google Sheets)
- Data is stored on the phone (IndexedDB), so the app works fully offline.
- **Automatic online backup to your own Google Sheet:** after a one-time setup (below), every change is uploaded automatically whenever the phone is online. That happens when the app opens, a few seconds after each change, when the internet comes back, and every 5 minutes. When offline, changes wait in a queue; the ☁️ badge in the header shows `✓` (all backed up), a number (changes waiting) or `⚠` (problem).
- Deleting an entry in the app only **marks** it deleted in the sheet, so nothing is ever lost there.
- **New phone:** set up the backup with the same URL and secret. The app offers to restore everything from the sheet first.
- Both parents can back up to the same sheet. Use **Restore from Google Sheet** to pull the other parent's entries onto your phone.
- Extra offline copies: **Settings → Backup (JSON)** and **Export CSV**.

### Setting up (or updating) the Google Sheet backup (5 minutes, free)
> **Already set up?** The script was updated for photo backup. Paste the new `Code.gs` and redeploy as a **new version** (Deploy → Manage deployments → ✏️ → Version: New version). Google will ask for permission again, because photos are now saved to Drive. Your existing URL stays the same.

1. Create a new Google Sheet, e.g. "Happy Parenthood Backup".
2. In the sheet: **Extensions → Apps Script**. Delete the sample code and paste the whole of [`google-sheets-backup/Code.gs`](google-sheets-backup/Code.gs).
3. Change `SECRET` at the top to your own long phrase, then **Save**.
4. **Deploy → New deployment →** type **Web app**. *Execute as:* **Me**. *Who has access:* **Anyone**. Click **Deploy** and allow the permissions. (Google may warn that the app is unverified, because it is your own script. Choose *Advanced → Go to project*.)
5. Copy the **Web app URL** (ends in `/exec`).
6. In the app: **Settings → Online backup**. Paste the URL and secret, tick **Back up automatically**, then press **Save & test**. Then press **Back up everything now** once to upload past history.

The sheet gets an **Entries** tab with readable columns (date, start, end, duration, activity, details, who logged it), so you can filter or make pivot tables. It also gets an **AppData** tab (settings, milestones, vaccines, foods) and a **Log** tab. If you later edit the script, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## Files
```
index.html            app shell
css/styles.css        styles (light + dark)
js/app.js             screens, forms, logic
js/catalog.js         every log type and its fields, behaviour lists
js/stages.js          age stages: targets, timetables, EI, milestones, vaccines
js/guide.js           parenting library + daily tips
js/charts.js          small accessible SVG charts
js/db.js              IndexedDB storage (+ change queue)
js/sync.js            automatic Google Sheets + Drive backup
js/voice.js           speech-to-text + sentence → log entries
js/photos.js          photo compression & display
google-sheets-backup/Code.gs   paste into your sheet's Apps Script
sw.js, manifest       offline + install
```
To change the content (e.g. add a food unit, a routine item or a guide article) edit `catalog.js`, `stages.js` or `guide.js` — no build needed.

## Sources (guidance is paraphrased; always follow your paediatrician)
- Sleep by age: AASM consensus endorsed by AAP — [healthychildren.org](https://www.healthychildren.org/English/healthy-living/sleep/Pages/Healthy-Sleep-Habits-How-Many-Hours-Does-Your-Child-Need.aspx), [AASM consensus (PMC4877308)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4877308)
- Complementary feeding: [WHO guideline 6–23 months](https://www.who.int/publications/i/item/9789240081864), [WHO complementary feeding](https://www.who.int/health-topics/complementary-feeding)
- Activity, screens & sleep under 5: [WHO 2019 guidelines](https://www.who.int/publications/i/item/9789241550536)
- Milestones: [CDC Learn the Signs. Act Early.](https://www.cdc.gov/ncbddd/actearly/milestones/), [CDC 9 months](https://www.cdc.gov/act-early/milestones/9-months.html)
- Emotion coaching: [Gottman Institute](https://www.gottman.com/blog/an-introduction-to-emotion-coaching/), [CDC noticing & naming emotions](https://www.cdc.gov/parenting-toddlers/noticing-and-naming/emotion-coaching.html)
- Serve & return: [Harvard Center on the Developing Child](https://developingchild.harvard.edu/resources/5-steps-for-brain-building-serve-and-return/)
- Vaccines: [Indian Academy of Pediatrics](https://iapindia.org/pdf/Immunization.pdf) (schedule changes — confirm with your doctor)

## Ideas for later
- Automatic two-way sync between parents' phones
- Reminders / notifications for routine items and vaccines
- WHO growth-percentile curves
- Monthly PDF report for paediatrician visits
- Photo attachments for memories
