# LifeOS — Phase 0 (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployable AWS-hosted monorepo with empty backend + frontend shell, Cognito auth working end-to-end, and CI/CD wired. After this phase: the user can `git push`, the app deploys, the user opens the URL, signs into Cognito, and sees the LifeOS sidebar shell with placeholder pages.

**Architecture:** pnpm workspace monorepo. `apps/api` = Hono backend on Lambda behind API Gateway. `apps/web` = Next.js 15 on AWS Amplify Hosting. `apps/infra` = AWS CDK (TS) for all AWS resources. `packages/shared` = Zod schemas shared between front/back. CI/CD via GitHub Actions.

**Tech Stack:** TypeScript strict, pnpm, Hono, Next.js 15, Tailwind v4, shadcn/ui, AWS CDK, DynamoDB, S3, Cognito, API Gateway HTTP API, Lambda Node 20, Vitest, Playwright, AWS Amplify Hosting, GitHub Actions.

**Scope explicitly excluded from this phase:**
- Any feature route (DailyLog, Workouts, etc.) — Phase 1
- Any AI feature — Phase 2
- Voice journal pipeline — Phase 2
- Gamification logic — Phase 1 onwards
- Real UI (only sidebar shell + placeholder pages)

**Acceptance criteria — Phase 0 is done when:**
- [ ] `pnpm install && pnpm typecheck && pnpm test` passes locally.
- [ ] `pnpm --filter @lifeos/infra deploy` provisions all AWS resources successfully.
- [ ] The Amplify-hosted URL loads, redirects to Cognito Hosted UI, lets you sign up + log in.
- [ ] After login, the user lands on `/dashboard` with sidebar nav and 9 placeholder pages reachable.
- [ ] `GET /api/healthcheck` returns `{ok:true}`; `GET /api/me` returns the Cognito sub when authenticated.
- [ ] A `git push` on `main` triggers GitHub Actions that deploy backend Lambda + Amplify build.

---

## File Structure

```
Mon Organisation/
├── .github/workflows/
│   ├── ci.yml                          # build + typecheck + test on PRs and main
│   └── deploy.yml                      # deploy infra + Lambda on main
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── lambda.ts               # AWS Lambda handler wrapping Hono
│   │   │   ├── app.ts                  # Hono app factory (testable)
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.ts             # JWT Cognito verification
│   │   │   │   └── error.ts            # central error → JSON response
│   │   │   ├── routes/
│   │   │   │   ├── healthcheck.ts
│   │   │   │   └── me.ts
│   │   │   └── env.ts                  # parse + validate env vars (Zod)
│   │   ├── tests/
│   │   │   ├── healthcheck.test.ts
│   │   │   ├── me.test.ts
│   │   │   └── auth-middleware.test.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── web/
│   │   ├── app/
│   │   │   ├── layout.tsx              # root layout
│   │   │   ├── page.tsx                # /  → redirect to /dashboard or /login
│   │   │   ├── login/page.tsx          # Cognito Hosted UI redirect
│   │   │   ├── auth/callback/page.tsx  # OAuth callback handler
│   │   │   └── (app)/
│   │   │       ├── layout.tsx          # authenticated layout with sidebar
│   │   │       ├── dashboard/page.tsx
│   │   │       ├── journal/page.tsx
│   │   │       ├── stats/page.tsx
│   │   │       ├── workouts/page.tsx
│   │   │       ├── looksmax/page.tsx
│   │   │       ├── saison/page.tsx
│   │   │       ├── trophees/page.tsx
│   │   │       ├── coach/page.tsx
│   │   │       ├── rapports/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── components/
│   │   │   ├── sidebar.tsx
│   │   │   └── ui/                     # shadcn components live here
│   │   ├── lib/
│   │   │   ├── auth.ts                 # Amplify Auth config
│   │   │   └── api-client.ts           # fetch wrapper with JWT
│   │   ├── styles/globals.css
│   │   ├── public/
│   │   ├── tests/e2e/login.spec.ts     # Playwright smoke test
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── playwright.config.ts
│   │   └── package.json
│   └── infra/
│       ├── bin/lifeos.ts               # CDK app entrypoint
│       ├── lib/
│       │   ├── lifeos-stack.ts         # main stack
│       │   ├── constructs/
│       │   │   ├── data.ts             # DynamoDB + S3
│       │   │   ├── auth.ts             # Cognito User Pool + Hosted UI
│       │   │   └── api.ts              # Lambda + API Gateway
│       │   └── config.ts               # env config per environment
│       ├── test/lifeos-stack.test.ts   # CDK snapshot test
│       ├── cdk.json
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── index.ts                # re-exports
│       │   ├── env.ts                  # shared env schema helpers
│       │   └── api.ts                  # request/response schemas (Zod)
│       ├── tests/api.test.ts
│       ├── package.json
│       └── tsconfig.json
├── .gitignore                          # already exists
├── .env.example                        # template for required env vars
├── package.json                        # root with workspaces + scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .eslintrc.cjs
├── .prettierrc.json
├── vitest.workspace.ts
└── README.md
```

**Decomposition rationale:**
- `packages/shared` owns Zod schemas so back and front share types without duplication.
- `apps/api` is the only thing that talks to AWS services directly. Hono `app` is exported separately from the Lambda adapter for local testing.
- `apps/web` only talks to the API and to Cognito. Never directly to DynamoDB/S3/Bedrock.
- `apps/infra` is the only thing with CDK. No mixing infra with app code.
- Tests live next to the code, except Playwright E2E which has its own folder.

---

## Pre-requisites (one-time, NOT part of TDD loop)

The implementer must verify the user has these set up. If anything is missing, pause and ask.

- [ ] **Node.js 20+** : `node --version` returns v20.x.x or higher.
- [ ] **pnpm 9+** : `pnpm --version` returns 9.x or higher. Install with `npm install -g pnpm` if needed.
- [ ] **AWS CLI** configured : `aws sts get-caller-identity --profile default` returns a valid identity.
- [ ] **AWS CDK CLI** : `cdk --version` returns 2.x or higher. Install with `npm install -g aws-cdk` if missing.
- [ ] **GitHub repo** : the user has created an empty private repo on GitHub for this project. If not, ask: "Create a GitHub repo and give me the URL, OR tell me to skip CI/CD setup."
- [ ] **AWS Bedrock model access** : Claude Sonnet 4.6 and Haiku 4.5 access enabled in the AWS console (region `us-east-1` or `eu-west-1`). Bedrock isn't used in Phase 0 but verify now to avoid surprises. If missing, ask the user to enable in the Bedrock console.
- [ ] **Region choice** : default to `eu-west-3` (Paris). Bedrock is NOT available in eu-west-3 — for Bedrock-using Lambdas in later phases we'll use cross-region invocation to `eu-west-1` (Ireland) or `us-east-1`. Ask user to confirm region preference before starting.

---

## Task 1: Workspace bootstrap

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc.json`, `vitest.workspace.ts`, `.env.example`, `README.md`

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "lifeos",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "build": "pnpm -r build",
    "dev:api": "pnpm --filter @lifeos/api dev",
    "dev:web": "pnpm --filter @lifeos/web dev",
    "deploy:infra": "pnpm --filter @lifeos/infra deploy"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "eslint": "^8.57.0",
    "prettier": "^3.3.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 5: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  env: { node: true, es2022: true },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist', 'cdk.out', '.next', 'node_modules', 'coverage'],
};
```

- [ ] **Step 6: Create `vitest.workspace.ts`**

```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/api/vitest.config.ts',
  'apps/infra/vitest.config.ts',
  'packages/shared/vitest.config.ts',
]);
```

- [ ] **Step 7: Create `.env.example`**

```bash
# AWS
AWS_REGION=eu-west-3
AWS_PROFILE=default

# Cognito (populated by CDK after first deploy)
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_DOMAIN=

# API
API_BASE_URL=http://localhost:3001
```

- [ ] **Step 8: Create `README.md`**

```markdown
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
```

- [ ] **Step 9: Install root deps**

Run: `pnpm install`
Expected: no errors, `node_modules/` and `pnpm-lock.yaml` appear.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: bootstrap pnpm workspace and tooling"
```

---

## Task 2: `packages/shared` with first Zod schema + test

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`, `packages/shared/src/api.ts`
- Test: `packages/shared/tests/api.test.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@lifeos/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 4: Install shared deps**

Run: `pnpm install`
Expected: `zod` resolves into `packages/shared/node_modules`.

- [ ] **Step 5: Write the failing test for the `HealthcheckResponse` schema**

Create `packages/shared/tests/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HealthcheckResponse } from '../src/api';

describe('HealthcheckResponse', () => {
  it('accepts a valid healthcheck payload', () => {
    const parsed = HealthcheckResponse.parse({ ok: true, version: '0.0.0' });
    expect(parsed.ok).toBe(true);
    expect(parsed.version).toBe('0.0.0');
  });

  it('rejects a payload missing `ok`', () => {
    expect(() => HealthcheckResponse.parse({ version: '0.0.0' })).toThrow();
  });
});
```

- [ ] **Step 6: Run the test, confirm it fails**

Run: `pnpm --filter @lifeos/shared exec vitest run`
Expected: fail with `Cannot find module '../src/api'`.

- [ ] **Step 7: Implement the schema**

Create `packages/shared/src/api.ts`:

```ts
import { z } from 'zod';

export const HealthcheckResponse = z.object({
  ok: z.literal(true),
  version: z.string(),
});
export type HealthcheckResponse = z.infer<typeof HealthcheckResponse>;

export const MeResponse = z.object({
  sub: z.string(),
  email: z.string().email().optional(),
});
export type MeResponse = z.infer<typeof MeResponse>;
```

Create `packages/shared/src/index.ts`:

```ts
export * from './api';
```

- [ ] **Step 8: Run test again, confirm it passes**

Run: `pnpm --filter @lifeos/shared exec vitest run`
Expected: 2 tests pass.

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(shared): add Zod schemas for healthcheck + me endpoints"
```

---

## Task 3: `apps/api` — Hono app with healthcheck endpoint (TDD)

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`
- Create: `apps/api/src/app.ts`, `apps/api/src/routes/healthcheck.ts`, `apps/api/src/env.ts`
- Test: `apps/api/tests/healthcheck.test.ts`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@lifeos/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/local.ts",
    "build": "esbuild src/lambda.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/lambda.mjs --banner:js=\"import{createRequire}from'module';const require=createRequire(import.meta.url);\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@lifeos/shared": "workspace:*",
    "hono": "^4.5.0",
    "zod": "^3.23.0",
    "jose": "^5.6.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.140",
    "esbuild": "^0.23.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": ".", "noEmit": true },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 4: Install**

Run: `pnpm install`
Expected: `hono`, `jose`, `tsx`, `esbuild` resolved.

- [ ] **Step 5: Write the failing healthcheck test**

Create `apps/api/tests/healthcheck.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { HealthcheckResponse } from '@lifeos/shared';

describe('GET /healthcheck', () => {
  it('returns ok=true and a version string', async () => {
    const app = createApp({ version: '0.0.0', jwtVerifierStub: { verify: async () => null } });
    const res = await app.request('/healthcheck');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(HealthcheckResponse.parse(body)).toEqual({ ok: true, version: '0.0.0' });
  });
});
```

- [ ] **Step 6: Run the test, confirm it fails**

Run: `pnpm --filter @lifeos/api exec vitest run`
Expected: fail with `Cannot find module '../src/app'`.

- [ ] **Step 7: Create the env module**

Create `apps/api/src/env.ts`:

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  AWS_REGION: z.string().default('eu-west-3'),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  VERSION: z.string().default('0.0.0'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  return EnvSchema.parse(process.env);
}
```

- [ ] **Step 8: Create the app factory and healthcheck route**

Create `apps/api/src/routes/healthcheck.ts`:

```ts
import { Hono } from 'hono';
import type { HealthcheckResponse } from '@lifeos/shared';

export function healthcheckRoute(version: string) {
  const app = new Hono();
  app.get('/', (c) => {
    const body: HealthcheckResponse = { ok: true, version };
    return c.json(body);
  });
  return app;
}
```

Create `apps/api/src/app.ts`:

```ts
import { Hono } from 'hono';
import { healthcheckRoute } from './routes/healthcheck';

export interface AppDeps {
  version: string;
  jwtVerifierStub?: { verify: (token: string) => Promise<{ sub: string } | null> };
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.route('/healthcheck', healthcheckRoute(deps.version));
  return app;
}
```

- [ ] **Step 9: Run test, confirm it passes**

Run: `pnpm --filter @lifeos/api exec vitest run`
Expected: 1 test passes.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(api): healthcheck route with Hono + tests"
```

---

## Task 4: `apps/api` — Cognito JWT middleware (TDD)

**Files:**
- Create: `apps/api/src/middlewares/auth.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/auth-middleware.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/auth-middleware.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const stubAccept = { verify: async (t: string) => (t === 'good' ? { sub: 'user-123' } : null) };
const stubReject = { verify: async () => null };

describe('auth middleware', () => {
  it('rejects /me without Authorization header', async () => {
    const app = createApp({ version: '0', jwtVerifierStub: stubReject });
    const res = await app.request('/me');
    expect(res.status).toBe(401);
  });

  it('rejects /me with invalid token', async () => {
    const app = createApp({ version: '0', jwtVerifierStub: stubReject });
    const res = await app.request('/me', { headers: { Authorization: 'Bearer bad' } });
    expect(res.status).toBe(401);
  });

  it('accepts /me with valid token and returns sub', async () => {
    const app = createApp({ version: '0', jwtVerifierStub: stubAccept });
    const res = await app.request('/me', { headers: { Authorization: 'Bearer good' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sub).toBe('user-123');
  });
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `pnpm --filter @lifeos/api exec vitest run`
Expected: `/me` route not defined → 404.

- [ ] **Step 3: Create the JWT verifier production implementation**

Create `apps/api/src/middlewares/auth.ts`:

```ts
import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface JwtVerifier {
  verify: (token: string) => Promise<{ sub: string } | null>;
}

export function makeCognitoVerifier(region: string, userPoolId: string): JwtVerifier {
  const jwks = createRemoteJWKSet(
    new URL(`https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`),
  );
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
        });
        if (typeof payload.sub !== 'string') return null;
        return { sub: payload.sub };
      } catch {
        return null;
      }
    },
  };
}

export function authMiddleware(verifier: JwtVerifier): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) return c.json({ error: 'unauthorized' }, 401);
    const token = header.slice(7);
    const claims = await verifier.verify(token);
    if (!claims) return c.json({ error: 'unauthorized' }, 401);
    c.set('user', claims);
    await next();
  };
}
```

- [ ] **Step 4: Add the `/me` route**

Create `apps/api/src/routes/me.ts`:

```ts
import { Hono } from 'hono';

export function meRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();
  app.get('/', (c) => c.json({ sub: c.get('user').sub }));
  return app;
}
```

- [ ] **Step 5: Wire middleware + route into `app.ts`**

Replace `apps/api/src/app.ts` contents:

```ts
import { Hono } from 'hono';
import { healthcheckRoute } from './routes/healthcheck';
import { meRoute } from './routes/me';
import { authMiddleware, type JwtVerifier } from './middlewares/auth';

export interface AppDeps {
  version: string;
  jwtVerifierStub: JwtVerifier;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.route('/healthcheck', healthcheckRoute(deps.version));
  app.use('/me/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/me', authMiddleware(deps.jwtVerifierStub));
  app.route('/me', meRoute());
  return app;
}
```

- [ ] **Step 6: Run tests, confirm all pass**

Run: `pnpm --filter @lifeos/api exec vitest run`
Expected: 4 tests pass (1 healthcheck + 3 auth).

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(api): Cognito JWT auth middleware + /me route"
```

---

## Task 5: `apps/api` — Lambda adapter + local dev server

**Files:**
- Create: `apps/api/src/lambda.ts`, `apps/api/src/local.ts`

- [ ] **Step 1: Install Lambda + Node adapters**

Run: `pnpm --filter @lifeos/api add @hono/node-server`
Expected: dependency added.

- [ ] **Step 2: Create the Lambda handler**

Create `apps/api/src/lambda.ts`:

```ts
import { handle } from 'hono/aws-lambda';
import { createApp } from './app';
import { makeCognitoVerifier } from './middlewares/auth';
import { loadEnv } from './env';

const env = loadEnv();
if (!env.COGNITO_USER_POOL_ID) {
  throw new Error('COGNITO_USER_POOL_ID is required in Lambda environment');
}
const verifier = makeCognitoVerifier(env.AWS_REGION, env.COGNITO_USER_POOL_ID);
const app = createApp({ version: env.VERSION, jwtVerifierStub: verifier });

export const handler = handle(app);
```

- [ ] **Step 3: Create the local dev server**

Create `apps/api/src/local.ts`:

```ts
import { serve } from '@hono/node-server';
import { createApp } from './app';

const app = createApp({
  version: 'local-dev',
  jwtVerifierStub: { verify: async (t) => (t === 'local-dev' ? { sub: 'local-user' } : null) },
});

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`API listening on http://localhost:${port}`);
```

- [ ] **Step 4: Verify local boot**

Run: `pnpm --filter @lifeos/api dev` in one terminal, then in another:
```bash
curl http://localhost:3001/healthcheck
```
Expected: `{"ok":true,"version":"local-dev"}`. Stop the dev server with Ctrl+C.

- [ ] **Step 5: Verify Lambda bundle builds**

Run: `pnpm --filter @lifeos/api build`
Expected: `apps/api/dist/lambda.mjs` exists.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): Lambda handler + local dev server"
```

---

## Task 6: `apps/infra` — CDK skeleton + DynamoDB construct (TDD with snapshot)

**Files:**
- Create: `apps/infra/package.json`, `apps/infra/cdk.json`, `apps/infra/tsconfig.json`, `apps/infra/vitest.config.ts`
- Create: `apps/infra/bin/lifeos.ts`, `apps/infra/lib/lifeos-stack.ts`, `apps/infra/lib/config.ts`, `apps/infra/lib/constructs/data.ts`
- Test: `apps/infra/test/lifeos-stack.test.ts`

- [ ] **Step 1: Create `apps/infra/package.json`**

```json
{
  "name": "@lifeos/infra",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "synth": "cdk synth",
    "deploy": "cdk deploy --require-approval never",
    "destroy": "cdk destroy --force",
    "diff": "cdk diff",
    "test": "vitest run"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.150.0",
    "constructs": "^10.3.0"
  },
  "devDependencies": {
    "aws-cdk": "^2.150.0",
    "@types/node": "^20.14.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/infra/cdk.json`**

```json
{
  "app": "tsx bin/lifeos.ts",
  "context": {
    "@aws-cdk/aws-iam:minimizePolicies": true
  }
}
```

- [ ] **Step 3: Create `apps/infra/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "." },
  "include": ["bin", "lib", "test"]
}
```

- [ ] **Step 4: Create `apps/infra/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

- [ ] **Step 5: Install**

Run: `pnpm install`

- [ ] **Step 6: Create `lib/config.ts`**

```ts
export interface StackConfig {
  envName: 'dev' | 'prod';
  region: string;
  account: string;
}

export function loadStackConfig(): StackConfig {
  const account = process.env.CDK_DEFAULT_ACCOUNT;
  const region = process.env.CDK_DEFAULT_REGION ?? 'eu-west-3';
  const envName = (process.env.ENV_NAME ?? 'dev') as 'dev' | 'prod';
  if (!account) throw new Error('CDK_DEFAULT_ACCOUNT is required');
  return { envName, region, account };
}
```

- [ ] **Step 7: Create the DynamoDB construct**

Create `apps/infra/lib/constructs/data.ts`:

```ts
import { Construct } from 'constructs';
import { aws_dynamodb as ddb, aws_s3 as s3, RemovalPolicy, Duration } from 'aws-cdk-lib';

export interface DataConstructProps {
  envName: string;
}

export class DataConstruct extends Construct {
  public readonly table: ddb.Table;
  public readonly photosBucket: s3.Bucket;
  public readonly voiceBucket: s3.Bucket;
  public readonly reportsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataConstructProps) {
    super(scope, id);

    this.table = new ddb.Table(this, 'Table', {
      tableName: `lifeos-${props.envName}`,
      partitionKey: { name: 'PK', type: ddb.AttributeType.STRING },
      sortKey: { name: 'SK', type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: ddb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: ddb.AttributeType.STRING },
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'gsi2pk', type: ddb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: ddb.AttributeType.STRING },
    });

    const bucketBaseProps: s3.BucketProps = {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: Duration.days(7) }],
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envName !== 'prod',
    };
    this.photosBucket = new s3.Bucket(this, 'PhotosBucket', {
      ...bucketBaseProps,
      bucketName: `lifeos-${props.envName}-photos-${this.node.addr.slice(0, 8)}`,
    });
    this.voiceBucket = new s3.Bucket(this, 'VoiceBucket', {
      ...bucketBaseProps,
      bucketName: `lifeos-${props.envName}-voice-${this.node.addr.slice(0, 8)}`,
    });
    this.reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      ...bucketBaseProps,
      bucketName: `lifeos-${props.envName}-reports-${this.node.addr.slice(0, 8)}`,
    });
  }
}
```

- [ ] **Step 8: Create stub stack and CDK entrypoint**

Create `apps/infra/lib/lifeos-stack.ts`:

```ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataConstruct } from './constructs/data';

export interface LifeOsStackProps extends StackProps {
  envName: string;
}

export class LifeOsStack extends Stack {
  public readonly data: DataConstruct;

  constructor(scope: Construct, id: string, props: LifeOsStackProps) {
    super(scope, id, props);
    this.data = new DataConstruct(this, 'Data', { envName: props.envName });
  }
}
```

Create `apps/infra/bin/lifeos.ts`:

```ts
#!/usr/bin/env tsx
import { App } from 'aws-cdk-lib';
import { LifeOsStack } from '../lib/lifeos-stack';
import { loadStackConfig } from '../lib/config';

const app = new App();
const cfg = loadStackConfig();
new LifeOsStack(app, `LifeOs-${cfg.envName}`, {
  envName: cfg.envName,
  env: { account: cfg.account, region: cfg.region },
});
```

- [ ] **Step 9: Write a snapshot test for the stack**

Create `apps/infra/test/lifeos-stack.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LifeOsStack } from '../lib/lifeos-stack';

describe('LifeOsStack', () => {
  it('has a DynamoDB table with GSI1 and GSI2', () => {
    const app = new App();
    const stack = new LifeOsStack(app, 'TestStack', {
      envName: 'dev',
      env: { account: '123456789012', region: 'eu-west-3' },
    });
    const t = Template.fromStack(stack);
    t.resourceCountIs('AWS::DynamoDB::Table', 1);
    t.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    });
  });

  it('has 3 S3 buckets', () => {
    const app = new App();
    const stack = new LifeOsStack(app, 'TestStack', {
      envName: 'dev',
      env: { account: '123456789012', region: 'eu-west-3' },
    });
    const t = Template.fromStack(stack);
    t.resourceCountIs('AWS::S3::Bucket', 3);
  });
});
```

- [ ] **Step 10: Run test, confirm passes**

Run: `pnpm --filter @lifeos/infra exec vitest run`
Expected: 2 tests pass.

- [ ] **Step 11: CDK synth (no deploy yet)**

Run: `CDK_DEFAULT_ACCOUNT=876966397257 CDK_DEFAULT_REGION=eu-west-3 pnpm --filter @lifeos/infra synth`
Expected: synth succeeds, CloudFormation template printed to stdout.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(infra): CDK skeleton with DynamoDB table + S3 buckets"
```

---

## Task 7: `apps/infra` — Cognito User Pool + Hosted UI

**Files:**
- Create: `apps/infra/lib/constructs/auth.ts`
- Modify: `apps/infra/lib/lifeos-stack.ts`
- Modify: `apps/infra/test/lifeos-stack.test.ts`

- [ ] **Step 1: Create the auth construct**

Create `apps/infra/lib/constructs/auth.ts`:

```ts
import { Construct } from 'constructs';
import { aws_cognito as cognito, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';

export interface AuthConstructProps {
  envName: string;
  webCallbackUrls: string[];
  webLogoutUrls: string[];
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `lifeos-${props.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'web',
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: props.webCallbackUrls,
        logoutUrls: props.webLogoutUrls,
      },
      preventUserExistenceErrors: true,
    });

    this.userPoolDomain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: `lifeos-${props.envName}-${this.node.addr.slice(0, 8)}` },
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'UserPoolDomain', {
      value: `${this.userPoolDomain.domainName}.auth.${this.node.tryGetContext('region') ?? 'eu-west-3'}.amazoncognito.com`,
    });
  }
}
```

- [ ] **Step 2: Wire into the stack**

Replace `apps/infra/lib/lifeos-stack.ts`:

```ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataConstruct } from './constructs/data';
import { AuthConstruct } from './constructs/auth';

export interface LifeOsStackProps extends StackProps {
  envName: string;
  webBaseUrl: string;
}

export class LifeOsStack extends Stack {
  public readonly data: DataConstruct;
  public readonly auth: AuthConstruct;

  constructor(scope: Construct, id: string, props: LifeOsStackProps) {
    super(scope, id, props);
    this.data = new DataConstruct(this, 'Data', { envName: props.envName });
    this.auth = new AuthConstruct(this, 'Auth', {
      envName: props.envName,
      webCallbackUrls: [`${props.webBaseUrl}/auth/callback`, 'http://localhost:3000/auth/callback'],
      webLogoutUrls: [`${props.webBaseUrl}/`, 'http://localhost:3000/'],
    });
  }
}
```

- [ ] **Step 3: Update CDK entrypoint to pass `webBaseUrl`**

Replace `apps/infra/bin/lifeos.ts`:

```ts
#!/usr/bin/env tsx
import { App } from 'aws-cdk-lib';
import { LifeOsStack } from '../lib/lifeos-stack';
import { loadStackConfig } from '../lib/config';

const app = new App();
const cfg = loadStackConfig();
new LifeOsStack(app, `LifeOs-${cfg.envName}`, {
  envName: cfg.envName,
  webBaseUrl: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
  env: { account: cfg.account, region: cfg.region },
});
```

- [ ] **Step 4: Extend the snapshot test**

Append to `apps/infra/test/lifeos-stack.test.ts` (inside the describe block, with the existing stack instantiations updated to pass `webBaseUrl: 'http://localhost:3000'`):

```ts
it('has a Cognito user pool with a web client', () => {
  const app = new App();
  const stack = new LifeOsStack(app, 'TestStack', {
    envName: 'dev',
    webBaseUrl: 'http://localhost:3000',
    env: { account: '123456789012', region: 'eu-west-3' },
  });
  const t = Template.fromStack(stack);
  t.resourceCountIs('AWS::Cognito::UserPool', 1);
  t.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
  t.resourceCountIs('AWS::Cognito::UserPoolDomain', 1);
});
```

Update the two earlier tests in the same file to pass the new `webBaseUrl` property when constructing the stack.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @lifeos/infra exec vitest run`
Expected: 3 tests pass.

- [ ] **Step 6: Synth**

Run: `CDK_DEFAULT_ACCOUNT=876966397257 CDK_DEFAULT_REGION=eu-west-3 pnpm --filter @lifeos/infra synth`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(infra): Cognito user pool + web client + hosted UI domain"
```

---

## Task 8: `apps/infra` — Lambda + API Gateway construct

**Files:**
- Create: `apps/infra/lib/constructs/api.ts`
- Modify: `apps/infra/lib/lifeos-stack.ts`
- Modify: `apps/infra/test/lifeos-stack.test.ts`

- [ ] **Step 1: Install required CDK packages for Lambda Node + HTTP API**

Run:
```bash
pnpm --filter @lifeos/infra add aws-cdk-lib @aws-cdk/aws-apigatewayv2-alpha @aws-cdk/aws-apigatewayv2-integrations-alpha
```

Note: as of CDK 2.150+, HTTP API constructs are stable inside `aws-cdk-lib/aws-apigatewayv2` — verify which is available. If both the alpha and the stable versions exist, prefer stable. (The implementer should check `node_modules/aws-cdk-lib/aws-apigatewayv2/lib/index.d.ts` for available exports before writing the construct.)

- [ ] **Step 2: Create the API construct**

Create `apps/infra/lib/constructs/api.ts`:

```ts
import { Construct } from 'constructs';
import { Duration, CfnOutput } from 'aws-cdk-lib';
import { aws_lambda as lambda, aws_apigatewayv2 as apigwv2 } from 'aws-cdk-lib';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { aws_dynamodb as ddb, aws_s3 as s3 } from 'aws-cdk-lib';
import * as path from 'path';

export interface ApiConstructProps {
  envName: string;
  table: ddb.ITable;
  buckets: { photos: s3.IBucket; voice: s3.IBucket; reports: s3.IBucket };
  cognitoUserPoolId: string;
  cognitoClientId: string;
  region: string;
}

export class ApiConstruct extends Construct {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly fn: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    this.fn = new lambda.Function(this, 'Fn', {
      functionName: `lifeos-${props.envName}-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../api/dist')),
      memorySize: 512,
      timeout: Duration.seconds(15),
      environment: {
        AWS_REGION: props.region,
        TABLE_NAME: props.table.tableName,
        PHOTOS_BUCKET: props.buckets.photos.bucketName,
        VOICE_BUCKET: props.buckets.voice.bucketName,
        REPORTS_BUCKET: props.buckets.reports.bucketName,
        COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
        COGNITO_CLIENT_ID: props.cognitoClientId,
        VERSION: process.env.GIT_SHA ?? 'dev',
      },
    });
    props.table.grantReadWriteData(this.fn);
    props.buckets.photos.grantReadWrite(this.fn);
    props.buckets.voice.grantReadWrite(this.fn);
    props.buckets.reports.grantReadWrite(this.fn);

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `lifeos-${props.envName}`,
      corsPreflight: {
        allowOrigins: ['http://localhost:3000'], // production origin added later via output
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    const integration = new HttpLambdaIntegration('LambdaIntegration', this.fn);
    this.httpApi.addRoutes({ path: '/{proxy+}', methods: [apigwv2.HttpMethod.ANY], integration });
    this.httpApi.addRoutes({ path: '/', methods: [apigwv2.HttpMethod.ANY], integration });

    new CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
  }
}
```

- [ ] **Step 3: Wire into the stack**

Replace `apps/infra/lib/lifeos-stack.ts`:

```ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataConstruct } from './constructs/data';
import { AuthConstruct } from './constructs/auth';
import { ApiConstruct } from './constructs/api';

export interface LifeOsStackProps extends StackProps {
  envName: string;
  webBaseUrl: string;
  region: string;
}

export class LifeOsStack extends Stack {
  public readonly data: DataConstruct;
  public readonly auth: AuthConstruct;
  public readonly api: ApiConstruct;

  constructor(scope: Construct, id: string, props: LifeOsStackProps) {
    super(scope, id, props);

    this.data = new DataConstruct(this, 'Data', { envName: props.envName });
    this.auth = new AuthConstruct(this, 'Auth', {
      envName: props.envName,
      webCallbackUrls: [`${props.webBaseUrl}/auth/callback`, 'http://localhost:3000/auth/callback'],
      webLogoutUrls: [`${props.webBaseUrl}/`, 'http://localhost:3000/'],
    });
    this.api = new ApiConstruct(this, 'Api', {
      envName: props.envName,
      region: props.region,
      table: this.data.table,
      buckets: {
        photos: this.data.photosBucket,
        voice: this.data.voiceBucket,
        reports: this.data.reportsBucket,
      },
      cognitoUserPoolId: this.auth.userPool.userPoolId,
      cognitoClientId: this.auth.userPoolClient.userPoolClientId,
    });
  }
}
```

- [ ] **Step 4: Update CDK entrypoint**

Replace `apps/infra/bin/lifeos.ts`:

```ts
#!/usr/bin/env tsx
import { App } from 'aws-cdk-lib';
import { LifeOsStack } from '../lib/lifeos-stack';
import { loadStackConfig } from '../lib/config';

const app = new App();
const cfg = loadStackConfig();
new LifeOsStack(app, `LifeOs-${cfg.envName}`, {
  envName: cfg.envName,
  webBaseUrl: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
  region: cfg.region,
  env: { account: cfg.account, region: cfg.region },
});
```

- [ ] **Step 5: Add a test for the API**

Append in `apps/infra/test/lifeos-stack.test.ts`:

```ts
it('has a Lambda function and an HTTP API', () => {
  const app = new App();
  const stack = new LifeOsStack(app, 'TestStack', {
    envName: 'dev',
    webBaseUrl: 'http://localhost:3000',
    region: 'eu-west-3',
    env: { account: '123456789012', region: 'eu-west-3' },
  });
  const t = Template.fromStack(stack);
  t.resourceCountIs('AWS::Lambda::Function', 1);
  t.hasResourceProperties('AWS::Lambda::Function', { Runtime: 'nodejs20.x' });
  t.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
});
```

Update all earlier tests to pass `region: 'eu-west-3'` in the stack props.

- [ ] **Step 6: Build the api first so the Lambda asset exists**

Run: `pnpm --filter @lifeos/api build`
Expected: `apps/api/dist/lambda.mjs` present. Note: the CDK construct loads from `apps/api/dist` directory; ensure index file is `lambda.mjs` (matches `handler: 'lambda.handler'` if Lambda accepts mjs). If CDK Lambda asset packaging complains about ESM, switch the api build to CJS output instead — adjust `apps/api/package.json` build script: replace `--format=esm` with `--format=cjs` and rename output to `lambda.js`. Update handler string in the API construct from `'lambda.handler'` to `'lambda.handler'` (unchanged) and ensure the file is `lambda.js`.

- [ ] **Step 7: Run tests + synth**

Run: `pnpm --filter @lifeos/infra exec vitest run`
Expected: 4 tests pass.

Run: `CDK_DEFAULT_ACCOUNT=876966397257 CDK_DEFAULT_REGION=eu-west-3 pnpm --filter @lifeos/infra synth`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(infra): Lambda + HTTP API Gateway wired to api app"
```

---

## Task 9: First real CDK deploy (manual)

**No new files.** This is a verification milestone.

- [ ] **Step 1: Bootstrap CDK in the AWS account (one-time)**

Run: `CDK_DEFAULT_ACCOUNT=876966397257 CDK_DEFAULT_REGION=eu-west-3 npx cdk bootstrap aws://876966397257/eu-west-3`
Expected: CDKToolkit stack created in CloudFormation. Idempotent — safe if already bootstrapped.

- [ ] **Step 2: Deploy**

Run: `CDK_DEFAULT_ACCOUNT=876966397257 CDK_DEFAULT_REGION=eu-west-3 pnpm --filter @lifeos/infra deploy`
Expected: stack creates successfully. Note the outputs: `UserPoolId`, `UserPoolClientId`, `UserPoolDomain`, `ApiUrl`.

- [ ] **Step 3: Smoke-test the deployed healthcheck**

Run: `curl <ApiUrl from output>/healthcheck`
Expected: `{"ok":true,"version":"dev"}` (or `"unknown"` if `VERSION` env was unset).

- [ ] **Step 4: Save the outputs to `.env.local`**

Create `.env.local` (gitignored) with the values from CDK outputs. Document this step in the README so the user has it for future reference.

- [ ] **Step 5: Commit (no code changes, but document the values in README)**

Update `README.md` to add a "Deploy" section:

```markdown
## Deploy

```bash
pnpm --filter @lifeos/api build
CDK_DEFAULT_ACCOUNT=<your-account> CDK_DEFAULT_REGION=eu-west-3 pnpm --filter @lifeos/infra deploy
```

After deploy, read the outputs and update `.env.local`:
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `COGNITO_DOMAIN`
- `API_BASE_URL`
```

```bash
git add README.md
git commit -m "docs: deploy instructions"
```

---

## Task 10: `apps/web` — Next.js scaffold + Tailwind

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/tailwind.config.ts`, `apps/web/postcss.config.js`
- Create: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/styles/globals.css`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@lifeos/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@lifeos/shared": "workspace:*",
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "aws-amplify": "^6.6.0",
    "@aws-amplify/ui-react": "^6.5.0",
    "zod": "^3.23.0",
    "@tanstack/react-query": "^5.50.0",
    "framer-motion": "^11.3.0",
    "lucide-react": "^0.400.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@playwright/test": "^1.46.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0-beta.1",
    "typescript": "^5.5.0"
  }
}
```

Note: Tailwind v4 is in beta at the time of writing. If v4 install breaks, fall back to Tailwind v3 (`^3.4.0`) — adjust config below accordingly.

- [ ] **Step 2: Create `apps/web/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lifeos/shared'],
};

export default config;
```

- [ ] **Step 3: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] },
    "noEmit": true
  },
  "include": ["next-env.d.ts", "app", "components", "lib", "tests", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `apps/web/tailwind.config.ts`** (Tailwind v3 fallback shown; if using v4 follow v4 docs)

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0d1117', subtle: '#161b22', strong: '#21262d' },
        accent: {
          force: '#ff4757',
          endurance: '#ff9f43',
          vitality: '#2ed573',
          discipline: '#3742fa',
          appearance: '#a55eea',
          spirit: '#00d9ff',
          xp: '#58a6ff',
          streak: '#f78166',
        },
        text: { DEFAULT: '#c9d1d9', muted: '#8b949e' },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 5: Create `apps/web/postcss.config.js`**

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 6: Create `apps/web/styles/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
html, body { background: #0d1117; color: #c9d1d9; }
```

- [ ] **Step 7: Create `apps/web/app/layout.tsx`**

```tsx
import './../styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'LifeOS', description: 'Personal life dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create `apps/web/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  // Phase 0: always redirect to dashboard. Auth gate applied in (app)/layout.tsx.
  redirect('/dashboard');
}
```

- [ ] **Step 9: Install + run dev to verify it boots**

Run: `pnpm install`
Run: `pnpm --filter @lifeos/web dev`
Open http://localhost:3000 — expect a redirect attempt to `/dashboard` (will 404 since not built yet — that's fine, the server boots which is what we test).
Stop dev server.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(web): Next.js 15 scaffold with Tailwind dark theme"
```

---

## Task 11: `apps/web` — Amplify Auth wiring (login + callback)

**Files:**
- Create: `apps/web/lib/auth.ts`, `apps/web/lib/amplify-config.ts`
- Create: `apps/web/app/login/page.tsx`, `apps/web/app/auth/callback/page.tsx`
- Create: `apps/web/components/amplify-provider.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create `.env.local` entries for the web app**

In `apps/web/.env.local` (gitignored — add `.env.local` to `apps/web` if not already inherited):

```bash
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<from CDK output>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<from CDK output>
NEXT_PUBLIC_COGNITO_DOMAIN=<from CDK output, full domain like lifeos-dev-xxx.auth.eu-west-3.amazoncognito.com>
NEXT_PUBLIC_API_BASE_URL=<from CDK output, the HTTP API URL>
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/auth/callback
```

- [ ] **Step 2: Create the Amplify config module**

Create `apps/web/lib/amplify-config.ts`:

```ts
import { Amplify } from 'aws-amplify';

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN!;
const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI!;

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          oauth: {
            domain,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [redirectUri],
            redirectSignOut: [redirectUri.replace('/auth/callback', '/')],
            responseType: 'code',
          },
        },
      },
    },
  });
}
```

- [ ] **Step 3: Create the Amplify provider (client component)**

Create `apps/web/components/amplify-provider.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { configureAmplify } from '@/lib/amplify-config';

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    configureAmplify();
  }, []);
  return <>{children}</>;
}
```

- [ ] **Step 4: Use the provider in the root layout**

Replace `apps/web/app/layout.tsx`:

```tsx
import './../styles/globals.css';
import type { Metadata } from 'next';
import { AmplifyProvider } from '@/components/amplify-provider';

export const metadata: Metadata = { title: 'LifeOS', description: 'Personal life dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans">
        <AmplifyProvider>{children}</AmplifyProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create the auth helper**

Create `apps/web/lib/auth.ts`:

```ts
'use client';
import { signInWithRedirect, signOut, fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

export async function startLogin() {
  await signInWithRedirect();
}

export async function logout() {
  await signOut();
}

export async function currentUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export async function getIdToken(): Promise<string | null> {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString() ?? null;
}
```

- [ ] **Step 6: Create the login page**

Create `apps/web/app/login/page.tsx`:

```tsx
'use client';
import { startLogin } from '@/lib/auth';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-display tracking-wide">LIFE_OS</h1>
        <p className="text-text-muted">Personal life dashboard.</p>
        <button
          onClick={() => startLogin()}
          className="px-6 py-3 rounded bg-accent-xp/20 border border-accent-xp text-accent-xp hover:bg-accent-xp/30"
        >
          Se connecter
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Create the callback page**

Create `apps/web/app/auth/callback/page.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Hub } from 'aws-amplify/utils';

export default function CallbackPage() {
  const router = useRouter();
  useEffect(() => {
    const sub = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') router.replace('/dashboard');
      if (payload.event === 'signInWithRedirect_failure') router.replace('/login?error=1');
    });
    return () => sub();
  }, [router]);
  return <main className="min-h-screen flex items-center justify-center text-text-muted">Connexion en cours…</main>;
}
```

- [ ] **Step 8: Manual smoke test**

Run: `pnpm --filter @lifeos/web dev`
Open http://localhost:3000/login → click "Se connecter" → expect redirect to Cognito hosted UI → sign up with email → after email verification, redirect back to `/auth/callback` then `/dashboard`. Dashboard 404 is fine (next task).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): Cognito Hosted UI login + callback wired via Amplify Auth"
```

---

## Task 12: `apps/web` — Authenticated layout with sidebar + 9 placeholder pages

**Files:**
- Create: `apps/web/app/(app)/layout.tsx`
- Create: 9 placeholder pages under `app/(app)/`
- Create: `apps/web/components/sidebar.tsx`
- Create: `apps/web/lib/api-client.ts`

- [ ] **Step 1: Create the API client**

Create `apps/web/lib/api-client.ts`:

```ts
'use client';
import { getIdToken } from './auth';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!;

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Create the sidebar**

Create `apps/web/components/sidebar.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Mic, BarChart3, Dumbbell, Sparkles, CalendarRange, Trophy, MessageSquare, FileText, Settings } from 'lucide-react';
import clsx from 'clsx';

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/journal', label: 'Journal', icon: Mic },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/workouts', label: 'Workouts', icon: Dumbbell },
  { href: '/looksmax', label: 'Looksmax', icon: Sparkles },
  { href: '/saison', label: 'Saison', icon: CalendarRange },
  { href: '/trophees', label: 'Trophées', icon: Trophy },
  { href: '/coach', label: 'Coach', icon: MessageSquare },
  { href: '/rapports', label: 'Rapports', icon: FileText },
  { href: '/settings', label: 'Réglages', icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 min-h-screen border-r border-bg-strong bg-bg-subtle py-6 px-3 flex flex-col gap-1">
      <div className="px-3 mb-6 font-display tracking-widest text-accent-spirit">LIFE_OS</div>
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded text-sm hover:bg-bg-strong',
              active && 'bg-bg-strong text-accent-spirit',
            )}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 3: Create the authenticated layout (with auth gate)**

Create `apps/web/app/(app)/layout.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      const u = await currentUser();
      if (!u) router.replace('/login');
      else setReady(true);
    })();
  }, [router]);
  if (!ready) return <div className="min-h-screen flex items-center justify-center text-text-muted">…</div>;
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create the 9 placeholder pages**

For each path in this list, create the file at `apps/web/app/(app)/<section>/page.tsx` with the content below (replace `<Section Name>` and `<section>` per page).

Paths and labels:
- `dashboard` → "Dashboard"
- `journal` → "Journal"
- `stats` → "Stats"
- `workouts` → "Workouts"
- `looksmax` → "Looksmax"
- `saison` → "Saison"
- `trophees` → "Trophées"
- `coach` → "Coach"
- `rapports` → "Rapports"
- `settings` → "Réglages"

Template (apply to each):

```tsx
export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display tracking-wider"><Section Name></h1>
      <p className="text-text-muted">À venir.</p>
    </div>
  );
}
```

- [ ] **Step 5: Add a dashboard placeholder that calls `/me` as a smoke test**

Replace `apps/web/app/(app)/dashboard/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function Dashboard() {
  const [sub, setSub] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<{ sub: string }>('/me')
      .then((r) => setSub(r.sub))
      .catch((e) => setErr(String(e)));
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display tracking-wider">Dashboard</h1>
      <p className="text-text-muted">Phase 0 — coquille uniquement.</p>
      <div className="rounded border border-bg-strong p-4">
        <div className="text-xs uppercase text-text-muted">/me response</div>
        <div className="font-mono text-sm">{sub ?? err ?? 'loading…'}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Smoke test E2E manually**

Run: `pnpm --filter @lifeos/web dev`
Open http://localhost:3000 → login flow → land on `/dashboard` → see the `/me` response with your Cognito `sub`.

- [ ] **Step 7: Verify navigation**

Click each sidebar item. Each should load without errors and show the placeholder text.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): authenticated layout, sidebar, 9 placeholder pages, /me smoke test"
```

---

## Task 13: Playwright E2E smoke test (login redirect)

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/login-redirect.spec.ts`

This test does NOT exercise full Cognito auth (that requires real creds + browser automation against Cognito UI). It verifies the unauthenticated redirect behaviour, which is the part of the auth flow we control.

- [ ] **Step 1: Initialize Playwright**

Run: `pnpm --filter @lifeos/web exec playwright install chromium`
Expected: chromium binary installed.

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: { command: 'pnpm dev', port: 3000, reuseExistingServer: true },
});
```

- [ ] **Step 3: Write the redirect test**

Create `apps/web/tests/e2e/login-redirect.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('unauthenticated user is sent to /login from /dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Se connecter')).toBeVisible();
});

test('home redirects to /dashboard which redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 4: Run**

Run: `pnpm --filter @lifeos/web exec playwright test`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(web): Playwright E2E smoke for login redirect"
```

---

## Task 14: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the CI workflow**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm --filter @lifeos/api build
      - run: CDK_DEFAULT_ACCOUNT=000000000000 CDK_DEFAULT_REGION=eu-west-3 pnpm --filter @lifeos/infra synth
```

- [ ] **Step 2: Commit + push to trigger**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: GitHub Actions for typecheck + tests + cdk synth"
git push origin main
```

Expected: Actions tab shows the workflow passing.

---

## Task 15: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

Pre-requisite: configure GitHub repository secrets `AWS_ROLE_ARN` (an IAM role with permissions to deploy, configured for OIDC trust to GitHub Actions) and `AWS_ACCOUNT_ID`. If the user hasn't set this up, the implementer should either:
- Pause and provide step-by-step instructions to create the OIDC provider + role, OR
- Use long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets as a fallback (less secure but acceptable for a personal project — flag this clearly).

- [ ] **Step 1: Create the deploy workflow**

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: eu-west-3

      - name: Build API
        run: pnpm --filter @lifeos/api build

      - name: Deploy CDK
        env:
          CDK_DEFAULT_ACCOUNT: ${{ secrets.AWS_ACCOUNT_ID }}
          CDK_DEFAULT_REGION: eu-west-3
          ENV_NAME: dev
          GIT_SHA: ${{ github.sha }}
        run: pnpm --filter @lifeos/infra deploy
```

Note: Amplify Hosting deploy is intentionally NOT in this workflow. Amplify Hosting is wired separately via the AWS Console to watch the `main` branch and auto-build the frontend. Document this in the README in the next step.

- [ ] **Step 2: Document Amplify Hosting setup in README**

Append to `README.md`:

```markdown
## Frontend hosting (Amplify)

The frontend deploys via AWS Amplify Hosting (separate from CDK because Amplify Hosting is easier to wire from the console for a SPA).

One-time setup:
1. AWS Console → Amplify → Host web app → connect this GitHub repo, branch `main`.
2. Base directory: `apps/web`. Build command: `pnpm install && pnpm --filter @lifeos/web build`.
3. Add environment variables (copied from CDK outputs):
   - `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
   - `NEXT_PUBLIC_COGNITO_CLIENT_ID`
   - `NEXT_PUBLIC_COGNITO_DOMAIN`
   - `NEXT_PUBLIC_API_BASE_URL`
   - `NEXT_PUBLIC_REDIRECT_URI` (set to `https://<amplify-domain>/auth/callback`)
4. Save and deploy. Note the Amplify URL.
5. Re-deploy CDK with `WEB_BASE_URL=<amplify-url> pnpm --filter @lifeos/infra deploy` to update Cognito callback URLs.
```

- [ ] **Step 3: Commit + push**

```bash
git add -A
git commit -m "ci: deploy workflow for CDK + docs for Amplify Hosting setup"
git push
```

Expected: deploy workflow runs (will fail if secrets aren't set — implementer to coordinate with user).

---

## Acceptance verification (final checks)

After all tasks complete, run this checklist manually with the user:

- [ ] `pnpm install && pnpm typecheck && pnpm test` clean locally.
- [ ] CDK stack deployed: DynamoDB table, 3 S3 buckets, Cognito User Pool + Client + Domain, Lambda function, HTTP API. Verify in AWS Console.
- [ ] Amplify Hosting connected; production URL loads.
- [ ] At production URL: `/` → `/dashboard` → `/login` redirect chain works. Sign up + email verification + login lands on `/dashboard`.
- [ ] `/dashboard` displays the authenticated user's Cognito `sub` (proving end-to-end auth + API call works).
- [ ] All 10 sidebar links reachable, no console errors.
- [ ] GitHub Actions CI passes on `main`.
- [ ] GitHub Actions deploy succeeds on push to `main`.

---

## Out of scope reminders

This plan does NOT implement:
- Any business feature (DailyLog, Workouts, Photos, Meals, etc.) — Phase 1 plan.
- Any AI feature — Phase 2 plan.
- Voice journal pipeline — Phase 2 plan.
- XP engine, quests, stats, seasons, achievements — Phase 1 / Phase 3.
- Looksmax features — Phase 4.

Each will get its own plan document under `docs/superpowers/plans/` once Phase 0 is verified working.

---

## Self-review notes (author)

- **Spec coverage (Phase 0 only):** Every Phase 0 deliverable from the spec is covered (monorepo, CDK with DynamoDB+S3+Cognito+Lambda+APIGW, Hono backend with healthcheck+auth+/me, Next.js shell with sidebar+placeholders, login flow, CI, deploy workflow).
- **Placeholder scan:** Searched for "TBD", "TODO", "etc.", "similar to". One soft reference remains in Task 15 about IAM role setup — left intentionally because it depends on the user's existing AWS setup; the implementer is told to pause and ask if missing.
- **Type consistency:** `createApp` signature is consistent (takes `{ version, jwtVerifierStub }`). `JwtVerifier` interface used identically in middleware and tests. CDK stack props extended in a backward-incompatible way at each task (tests are updated in lockstep — Tasks 6/7/8 explicitly note the test updates).
- **Known fragilities:**
  - Tailwind v4 vs v3 ambiguity — plan flags fallback.
  - Lambda ESM vs CJS packaging — plan flags fallback in Task 8 step 6.
  - HTTP API construct path (`@aws-cdk/aws-apigatewayv2-alpha` vs stable) — plan tells implementer to verify before writing the construct.
