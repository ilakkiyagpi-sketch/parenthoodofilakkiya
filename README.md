# Parenthood Arena 👶 → 🧑‍🎓

A personal, offline-first parenting app that tracks **every part of a child's day** and **adapts itself as the child grows** from 0 to 15+ years. It works like a phone app (installable PWA) and needs no server, account or build step.

## What it does

| Area | Features |
|---|---|
| **Today** | One-tap logging (Pee +1, Poop, Food, Feed, Nap/Sleep timers, Woke up, Learning, Play, Walk, Bath, Kind act). Live timers. Tiles comparing today with age-appropriate targets (sleep, naps, meals, milk feeds, pee count, outdoor time, learning, screen time, behaviour). "Next in routine", today's emotional-intelligence activity, and a daily parenting tip. |
| **Diary** | Any day's full log with summary; edit or delete any entry; add past entries. |
| **Routine** | Recommended timetable for the current age stage, shifted to the child's usual wake-up time. Shows ✓ when an activity was logged and highlights what's on now. Fully customisable. Growing-up roadmap of all stages. |
| **Heart** | Emotional intelligence and behaviour: the stage's EI goal, skills and activities. Logs positive behaviour (kindness, sharing, empathy…) and challenging moments using the ABC method (trigger → behaviour → how we responded → outcome). 14-day chart, top triggers, and which responses calmed him fastest. |
| **Grow** | Milestone checklists (9 m → 15 y), trend charts (7/14/30 days), weight/height/head growth charts, food diary (every food tried, first date, reactions), vaccination schedule (IAP-based), and memories / "firsts". |
| **Guide** | Stage overview (development, feeding, learning, EI) and a library: Gottman emotion coaching, Harvard serve-and-return, kindness, tantrums, positive discipline, sleep, feeding, screens, potty training, study habits, parent self-care. |

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

## Your data
- Everything is stored **only on the device** (IndexedDB). Nothing is uploaded.
- **Settings → Backup (JSON)** regularly, and use **Restore backup** on a new phone. **Export CSV** opens in Excel / Google Sheets.
- To share between both parents' phones today: export on one, restore on the other. (Live sync would need a small backend; see "Ideas" below.)

## Files
```
index.html            app shell
css/styles.css        styles (light + dark)
js/app.js             screens, forms, logic
js/catalog.js         every log type and its fields, behaviour lists
js/stages.js          age stages: targets, timetables, EI, milestones, vaccines
js/guide.js           parenting library + daily tips
js/charts.js          small accessible SVG charts
js/db.js              IndexedDB storage
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
- Cloud sync between parents' phones (e.g. Firebase / Supabase)
- Reminders / notifications for routine items and vaccines
- WHO growth-percentile curves
- Monthly PDF report for paediatrician visits
- Photo attachments for memories
