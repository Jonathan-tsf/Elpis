# LifeOS

Personal life dashboard (gamified). See `docs/superpowers/specs/2026-05-11-lifeos-physique-design.md`.

## Setup

```bash
pnpm install
cp .env.example .env  # then fill in
pnpm typecheck
pnpm test
```

## Phase 1 features

All Phase 1 features are live in production:

- **Dashboard** — Global XP level, per-stat bars, active quests, streak chips.
- **Journal** — Daily log form (sleep, mood/energy/focus, hydration, skincare, supplements, meals, notes). History tab with last 14 days.
- **Workouts** — Workout entry form with nested exercises + sets (reps, weight, RPE). 30-day history with expandable cards. XP toast on submit.
- **Stats** — RPG stat radar chart (Recharts). Per-stat level bars. Measurements form (12 body metrics). Time-series line chart per metric (90-day window).
- **Photos (Looksmax)** — Upload flow: presign → PUT to S3 → confirm. Tag multi-select. Filterable photo grid with per-photo presigned view URLs.
- **Auth** — Cognito-hosted UI login / callback / session refresh baked into `(app)` layout.

## Layout

- `apps/api` — Hono backend on Lambda
- `apps/web` — Next.js frontend
- `apps/infra` — AWS CDK
- `packages/shared` — Zod schemas shared by all
