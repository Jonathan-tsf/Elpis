# LifeOS

Personal life dashboard (gamified). See `docs/superpowers/specs/2026-05-11-lifeos-physique-design.md`.

## Setup

```bash
pnpm install
cp .env.example .env  # then fill in
pnpm typecheck
pnpm test
```

## Layout

- `apps/api` — Hono backend on Lambda
- `apps/web` — Next.js frontend
- `apps/infra` — AWS CDK
- `packages/shared` — Zod schemas shared by all
