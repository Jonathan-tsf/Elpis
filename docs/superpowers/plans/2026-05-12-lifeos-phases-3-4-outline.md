# LifeOS — Phases 3 & 4 outline (compact)

These phases are sketched, not detailed. Each will get a full plan when its turn comes.

## Phase 3 — Gamification depth

- **Achievements**: catalog of ~50 achievements (e.g. `FIRST_100KG_DC`, `STREAK_SLEEP_30D`). Backend detector subscribes to XPEvents and writes `Achievement` items when conditions hit. Frontend `/trophees` shows unlocked + locked-but-visible badges.
- **Seasons**: trimestrial. CDK adds an `EventBridge` rule on the first day of each quarter. Each season has a main objective + 3 season quests + reward cosmetics (titles, avatar borders). On season-end an Sonnet recap is generated.
- **Tamagotchi decay**: nightly Lambda walks the user, compares last-event date per stat, applies a visual decay flag if ≥ 3 days inactive. After 14d, sets `avatar_mode: 'dormant'`.
- **Avatar v1**: portrait stylé (cf. simple SVG or a one-time DALL·E/Stable Diffusion generation) + bordure saison + emote selon mood.

## Phase 4 — Looksmax IA + advanced tracking

- **Photo IA analysis**: route `POST /photos/:id/analyze` → Claude Sonnet vision call. Output: ratios faciaux (jawline angle, philtrum, eye area, symmetry score), points forts / axes d'amélioration, comparaison avec set précédent. Persisted as `AiPhotoAnalysis`.
- **Sets protocolaires**: front shows a side-by-side glissière comparing two sets (current vs previous).
- **Bilan sanguin**: upload PDF S3 → Textract or Claude vision to extract key values → store as `BloodTest`. Compare to reference ranges; flag anomalies.
- **Perf tests**: `PerfTest` entity for 1RM, VO2max estimé, temps sur distance. UI form + history charts.
- **Voice analysis** (stretch): record voice samples, Claude critique tone / projection / articulation. Probably out of scope.

## Phase 5+ (parking lot)

- Mobile app (Expo, sharing `packages/shared`).
- Connectors (Apple Health, Garmin, Whoop) via their APIs.
- Voice output of briefings (Polly or Nova Sonic).
- Export complete JSON archive.
- Other LIFE_OS domains: Travail, Argent, Relations, Couple, Startups, Projets, Skills — each a sub-project reusing the same foundations.
