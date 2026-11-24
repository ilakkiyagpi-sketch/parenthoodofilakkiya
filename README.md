# Happy Parenthood 👶 → 🧑‍🎓

A personal, offline-first parenting app that tracks **every part of a child's day**, their **health**, and their **growth**, and **adapts itself as the child grows** from 0 to 15+ years. It installs on the phone as its own app (PWA) and needs no server, account or build step.

**Open it:** https://ilakkiyagpi-sketch.github.io/parenthoodofilakkiya/

## What it does

| Area | Features |
|---|---|
| **Home** | 🎤 *Tell me what happened* (voice or typing → log entries). **Category chips** (Sleep · Food · Toilet · Play · Care · Learn · Feelings · Health, ordered for the child's age; the category of the next routine item opens first). Each category shows **big one-tap buttons**: tap to start a timer and tap again to stop, +1 counters, or quick forms. Below that are four age-appropriate "today at a glance" numbers and tabs for **Today's log / Summary / This month**. |
| **Diary** | Any day's full log; edit, delete or add past entries. |
| **Health** | Illnesses with temperature chart, prescriptions (medicines, dose, frequency, days, photo), "Gave now" with next-dose time, doctor visits, search. |
| **Heart** | **This week's emotional-intelligence practice**, plus the **EI roadmap**: month by month from birth to 3 years, then year by year to 15. It also logs kind and challenging moments (29 positive and 31 challenging options, filtered by age) with triggers and what calms the child. |
| **More** | Routine, Milestones, **Physical growth** (first-year month-by-month checks, WHO comparison charts, standard readings table), New things, Trends, Foods, **Vaccines (India's government UIP schedule)**, Guide, Settings (split into sections). |

**Several children:** tap the child's name at the top to switch, or add a child. Each child has their own logs, theme, timetable, milestones and health records. Boy/girl changes the wording (he/she) and the WHO chart used.

**Age themes:** the colours and the full-screen background pictures change every month until the first birthday (Newborn Snuggles → First Smiles → … → Little Crawler → Babble & Wave), then with each stage (Little Walker, Busy Toddler, Little Artist, Early Learner, Growing Explorer, Young Teen).

**Growth vs WHO:** weight, height and head circumference are plotted on the WHO Child Growth Standards (0–5 years) and WHO Growth Reference 2007 (5–19 years), with the percentile and a plain-language verdict. Data comes from WHO's official `anthro` / `anthroplus` tables.

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

## Your data & backup

### Google Drive (recommended): "Sign in with Google"
Tap ☁️ at the top, then **Sign in with Google**. Every child's logs, settings and photos are saved in a **"Happy Parenthood Backup"** folder in that Gmail account's Google Drive. The folder holds one small file per child per month, plus a Photos folder.
- **Two phones, one family:** sign in with the same Gmail on another phone and both stay in sync. New entries, edits and deletions flow both ways.
- **New phone:** install the app, add the child (any name), sign in, and everything comes back.
- **Privacy:** the app asks only for Google's `drive.file` permission, so it can see only the files it created.
- **Sign-in time limit:** a web app's Google sign-in lasts about an hour. When ☁️ shows **Tap to sync**, tap it once. Changes are kept safely on the phone until then.

**One-time setup (owner of the app, about 10 minutes).** Google requires every app to be registered:
1. Open https://console.cloud.google.com and create a project called *Happy Parenthood*.
2. Go to **APIs & Services → Library** and enable **Google Drive API**.
3. Go to **Google Auth Platform → Branding**: enter the app name and your email. Under **Audience**, choose *External*, then press **Publish app**. Only the non-sensitive `drive.file` scope is used, so no Google review is needed.
4. Go to **Clients → Create client** and choose *Web application*. Under **Authorized JavaScript origins**, add `https://ilakkiyagpi-sketch.github.io`.
5. Put the Client ID in `js/config.js` (`GOOGLE_CLIENT_ID`), or paste it once in the app under *Settings → Online backup*.

### Google Sheet (optional, advanced)
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
js/devdata.js         age themes, first-year physical checks, EI roadmap, UIP vaccines
js/growth.js, who-data.js   WHO growth standards (LMS) and percentiles
js/pronouns.js        he/she wording per child
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
- Vaccines: [MoHFW National Immunization Schedule](https://www.mohfw.gov.in/sites/default/files/National%20Immunization%20Schedule.pdf) / [NHM](https://nhm.gov.in/New_Updates_2018/NHM_Components/Immunization/report/National_%20Immunization_Schedule.pdf) (confirm dates on the MCP card)
- Growth: WHO Child Growth Standards & Growth Reference 2007 — [WHO anthro](https://github.com/WorldHealthOrganization/anthro), [WHO anthroplus](https://github.com/WorldHealthOrganization/anthroplus)

## Ideas for later
- Automatic two-way sync between parents' phones
- Reminders / notifications for routine items and vaccines
- WHO growth-percentile curves
- Monthly PDF report for paediatrician visits
- Photo attachments for memories
