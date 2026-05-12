# LifeOS — Phase 1 (MVP utilisable) Implementation Plan

**Goal:** Make the app actually usable as a daily driver. Manual entry only (voice journal comes in Phase 2). Gamification produces visible feedback (XP, stats, streaks).

**Architecture:** Adds to Phase 0 foundation. DynamoDB single-table access layer in `apps/api`. New routes for DailyLog, Workouts, Measurements, Photos. XP engine that turns events into stat XP. Frontend gets real forms + history views + a stats radar.

**Tech Stack:** No new deps in the platform (same Hono / Next / DynamoDB / S3 / Cognito). Add `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` in `apps/api`. Add `recharts` and `date-fns` and `react-hook-form` + `@hookform/resolvers` in `apps/web`.

**Acceptance criteria — Phase 1 is done when:**
- [ ] I can write a DailyLog entry from `/journal` (sleep h/quality, mood/energy/focus, hydration L, skincare AM/PM) and it's persisted in DynamoDB.
- [ ] I can log a Workout (type, duration, exercises with sets {reps, weight, rpe}).
- [ ] I can log a Measurement (weight + body parts).
- [ ] I can upload a Photo with tags via S3 presigned PUT.
- [ ] The Dashboard shows 6 stat bars updated from XP events.
- [ ] The Stats page shows a radar of the 6 stats + a 30-day trend line.
- [ ] 3 hardcoded daily quests are visible on the Dashboard and auto-complete when their condition is met.
- [ ] 3 streak counters (`daily_log`, `skincare_am`, `skincare_pm`) are visible and update.
- [ ] `+XP` animation pops on screen when an action is logged.
- [ ] All API mutations are guarded by Cognito JWT (existing middleware).
- [ ] CI is green; deploy workflow lands the changes on AWS.

---

## High-level task breakdown

This phase ships as a series of small, independently-committable chunks. Each chunk = 1 subagent dispatch. Each finishes with a green typecheck + tests + commit pushed (auto-deploy).

### Chunk A — DB access layer
- `apps/api/src/services/dynamodb-client.ts` — typed wrapper around DocumentClient (PK/SK/GSI helpers, `put`, `get`, `query`, `update`, `delete`, batch).
- `apps/api/src/services/keys.ts` — entity key builders (`dailyLogKey(date)`, `workoutKey(date, id)`, `photoKey(date, id)`, `measurementKey(metric, date)`, `xpEventKey(ts, id)`, `statsKey()`, `streakKey(category)`, `questKey(id)`).
- Unit tests for keys + a tiny integration test against a stub DocumentClient.

### Chunk B — Shared Zod schemas
- In `packages/shared/src/`: add `dailyLog.ts`, `workout.ts`, `measurement.ts`, `photo.ts`, `stats.ts`, `quest.ts`, `streak.ts`. Re-export from `index.ts`.
- Define request/response shapes for each entity.
- Unit tests covering parse/reject of representative payloads.

### Chunk C — DailyLog backend
- `apps/api/src/routes/daily-log.ts` :
  - `PUT /daily-log/:date` — upsert today's log (sleep, mood, hydration, skincare, supplements, notes).
  - `GET /daily-log/:date` — fetch one.
  - `GET /daily-log?from=...&to=...` — range.
- Wire into `app.ts` behind auth middleware.
- Tests: each route, with stubbed DB.

### Chunk D — XP engine + Stats snapshot
- `apps/api/src/services/xp-engine.ts` — pure function `eventsToXp(events): { totalXp, perStat }`. Mapping table for each event type (DailyLog complete = +20 Discipline, sleep ≥ 8h = +30 Vitalité, etc.).
- Helper `applyXp(ddb, userId, event)` — writes XPEvent + updates Stats snapshot (write-through).
- Hook called from DailyLog upsert handler.
- Tests for `eventsToXp` covering each rule.

### Chunk E — Workouts backend
- `apps/api/src/routes/workouts.ts` :
  - `POST /workouts` — create with embedded `exercises[{ name, sets[{ reps, weight_kg?, rpe? }] }]`.
  - `GET /workouts/:id` — fetch.
  - `GET /workouts?from=...&to=...` — range.
- XP hook: workout = +40 base + bonus if RPE ≥ 8 → Force/Endurance depending on type.

### Chunk F — Measurements backend
- `apps/api/src/routes/measurements.ts` :
  - `POST /measurements` — { metric: 'weight'|'waist'|… , value }.
  - `GET /measurements/:metric?from=...&to=...` — time series.
- No XP (passive data).

### Chunk G — Photos backend
- `apps/api/src/routes/photos.ts` :
  - `POST /photos/presign` — body `{ tag, contentType }`, returns `{ uploadUrl, key, photoId }`.
  - `POST /photos` — confirm upload, body `{ photoId, key, tags[], notes? }`. Writes Photo entity.
  - `GET /photos?tag=...&from=...&to=...` — list metadata.
  - `GET /photos/:id/url` — presigned GET for viewing.
- XP hook: photo with protocolaire tag = +15 Apparence.

### Chunk H — Stats + Streaks backend
- `apps/api/src/routes/stats.ts` — `GET /stats` returns current snapshot + recent XPEvents.
- `apps/api/src/services/streaks.ts` — pure function `recomputeStreaks(events): { daily_log, skincare_am, skincare_pm }`. Hook into DailyLog upsert.
- `apps/api/src/routes/streaks.ts` — `GET /streaks` returns current counters.

### Chunk I — Quests (hardcoded daily)
- `packages/shared/src/quests-catalog.ts` — 5 daily quests defined in code: sleep 8h+, skincare AM, skincare PM, hydration 2.5L, daily log filled.
- `apps/api/src/routes/quests.ts`:
  - `GET /quests` — returns today's 5 quests with their status (active/done) computed from today's DailyLog.
- Hook in DailyLog upsert flips quest status; XP awarded if newly completed.

### Chunk J — Frontend: DailyLog form + history
- New page `/journal` with tabs: "Aujourd'hui" (form), "Historique" (list of last 14 days).
- Form built with react-hook-form + Zod resolver, validates against `@lifeos/shared`.
- Save → POST to API → success toast + XP pop animation.
- History pulls range from API and renders as cards.

### Chunk K — Frontend: Workouts + Measurements forms
- `/workouts` : list past sessions, "+ Nouvelle séance" form with dynamic exercises/sets.
- `/stats` (initial pass) : "+ Mesure" inline form for weight + body parts.
- Use the same patterns from Chunk J.

### Chunk L — Frontend: Stats UI (6 bars + radar)
- Reusable `<StatBar stat="force" level={..} xp={..} />` component.
- Recharts `RadarChart` on `/stats` page.
- Recharts line for 30-day trend (weight + each stat XP).

### Chunk M — Frontend: Dashboard composition + Quests + Streaks
- `/dashboard` becomes the home: header (avatar mini + lvl + global XP bar + global streak), 5 quests cards (with status), 6 stat mini-bars, "Journal du soir" CTA pointing to `/journal`.
- `<QuestCard>` shows progress + XP reward + checkbox-style state.
- `<StreakChip>` shows category + current streak.
- `+XP` toast/animation using Framer Motion.

### Chunk N — Frontend: Photos page
- `/looksmax` becomes minimal usable: upload control (file → /photos/presign → PUT to S3 → /photos confirm), grid of latest photos by tag, filter by tag.

### Chunk O — Polish + cleanup
- Loading states + error boundaries on each new page.
- Empty states (first-time UX) on each section.
- A `dev:reset` script that wipes the user's data in DynamoDB (for testing).
- Update README with Phase 1 features list.

---

## Non-goals for this phase

- Voice journal pipeline (Phase 2).
- AI features — briefing, coach, deep analyses (Phase 2).
- Looksmax photo IA analysis (Phase 4).
- Achievements & Seasons UI (Phase 3).
- Avatar (Phase 3).
- Tamagotchi decay (Phase 3).
