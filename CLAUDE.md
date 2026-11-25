# Happy Parenthood: project notes for Claude

A personal, offline-first parenting PWA built for one family (Amma/Appa) in Tamil Nadu, India. Live at https://ilakkiyagpi-sketch.github.io/parenthoodofilakkiya/ (GitHub Pages from `main`). The first child is **Aadhi**, a boy born around Feb 2026. The app supports several children.

## How to work here
- Plain static site: no build step, no framework, no npm. ES modules in `js/`, one stylesheet `css/styles.css`. Serve with `python3 -m http.server` and test with Playwright (Chromium is pre-installed) at a phone viewport (375×800). Check light **and** dark mode, and that the page never scrolls sideways.
- Develop on the session branch, then open a PR to `main`. The user merges PRs themselves.
- **Bump `CACHE` in `sw.js` and add any new JS file to its `SHELL` list on every release**, or phones keep the old version.
- The user is not a developer. Explain things simply, step by step, with no jargon. They prefer seeing options visually (mockups or screenshots) before big UI changes.
- Medical content is general guidance. Always include "see your paediatrician" for health topics and 108/112 for emergencies.

## Files
| File | What |
|---|---|
| `index.html`, `manifest.webmanifest`, `sw.js`, `icons/` | App shell, PWA install, offline cache |
| `js/app.js` | All screens and event handling (large; search for `// ---- SECTION` headers) |
| `js/catalog.js` | Log types and fields (age windows `min`/`max` in months), behaviour lists, triggers/responses |
| `js/stages.js` | Age stages (targets, routine, EI goal, guidance), milestones (CDC-based), `MILESTONE_TIPS`, `milestoneFocus()` |
| `js/devdata.js` | Monthly themes (0–11 m) + stage themes, first-year monthly physical checks, EI roadmap (monthly to 36 m, then yearly to 15 y), India UIP vaccine schedule |
| `js/who-data.js`, `js/growth.js` | WHO LMS growth tables (0–5 y standards + 5–19 y reference, from WHO anthro/anthroplus) and z-score/percentile helpers |
| `js/guide.js` | Parenting library articles + daily tips |
| `js/assistant-kb.js`, `js/assistant.js` | Offline "Ask" assistant (no AI): ~100 Q&A, synonym/Tanglish matching, emergency detection, personal answers from logs via `askContext()` in app.js |
| `js/voice.js` | Speech-to-text (Web Speech API) + English sentence → log-entry parser |
| `js/learning.js` | Wake windows by age, learning-time ideas (reading types, books, materials, Tamil/English rhymes) by age band |
| `bell/worker.js`, `bell/README.md` | Owner-run Cloudflare Worker ("bell"): D1 database bound as `DB` (tables auto-created), cron every minute sends an empty Web Push (VAPID keys auto-made) to phones with a reminder due; `sw.js` then fetches `/due` and shows it. Address goes in `BELL_URL` in `js/config.js` |
| `js/photos.js` | Photo compression (≤1280 px JPEG) stored in IndexedDB |
| `js/pronouns.js` | he/she wording per child (rewrites content objects in place) |
| `js/db.js` | IndexedDB: one database per child (`parenthood`, `parenthood-<childId>`); change queues for Sheet (`dirty`) and Drive (`driveDirty`) |
| `js/drive.js`, `js/config.js` | Google Drive backup via Google Identity Services (`drive.file` scope). Monthly files per child, two-way merge with tombstones. `GOOGLE_CLIENT_ID` is in config.js |
| `js/sync.js`, `google-sheets-backup/Code.gs` | Older optional Google Sheet backup through an Apps Script web app (has a `setup()` function to grant permissions) |

## Decisions the user made (keep them)
- App name **Happy Parenthood**. Professional but kid-friendly look (Nunito font, pastel activity colours).
- Home = **design C**: category chips **wrapped in rows** (no sideways scroll; age-ordered; the category of the next routine item opens first) → big one-tap buttons (tap to start a timer, tap again to stop) → "last feed" strip → 4 glance numbers (tap one → pop-up of only those entries today) → three buttons **📊 Today's summary / 🗓️ Daily pattern / This month** that open pop-ups **only when tapped**. **No timeline on Home** (it lives in Diary). This month = one screen of tiles; tap a tile to open it. Daily pattern = 24-hour chart, one row per day (7/14 days) + this week vs last week averages. No floating ＋ (it covered buttons).
- **Never jump to the top of the page** after a tap or tick (`route()` keeps scroll on the same screen; milestone and physical ticks update in place).
- Age theme fills the **whole background** and changes every month until 12 months, then per stage.
- Breastfeed asks **Left / Right / Both** on start (suggests the opposite side) and offers "switch side" while running.
- Vaccines: **only India's government UIP schedule** (free at government hospitals).
- Physical growth: first-year month-by-month checks + WHO comparison charts + standard-readings table.
- Chatbot: user chose the **free offline assistant** for now. If AI is added later, keep it optional and keep the API key out of the browser (Apps Script or Cloudflare Worker proxy).
- Backup: **Sign in with Google → Drive**. The Google Cloud project is in "Testing" mode with the family's Gmail accounts as test users ("External" audience because personal Gmail can't use "Internal"). A browser token lasts about 1 h, so the ☁️ badge shows "Tap to sync" when it expires.
- Reminders: **one button for users** ("🔔 Turn on alarms", on/off stored per phone). The owner runs the Cloudflare bell backend; no setup steps shown in the app. In-app timers alone can't ring a closed PWA.
- Settings split into sections. Several children are switched by tapping the name in the header.

## Ideas mentioned but not built yet
- Favourite meals / food 'try next' list, shared live view for both parents.
- Tamil sentences in voice logging (currently saved as notes); optional AI "Ask" fallback.
