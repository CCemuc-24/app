# CCemuc Monolith Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the separate CCemuc Koa+Sequelize REST API (`ccemuc-api/`) and statically-exported Next.js frontend (`frontend/`) into a single Next.js (App Router) full-stack **monolith** in a new `app/` repo, replacing axios→REST calls with **server actions**, Sequelize with **Prisma + Neon Postgres**, and deploying to Vercel.

**Architecture:** One Next.js 15 app (server runtime — no static export). UI components are ported from the current frontend; backend controller logic is reimplemented as `'use server'` server actions that call Prisma directly. The only HTTP endpoint is a Route Handler for the Transbank Webpay return redirect. Payments (Transbank Webpay) and email (nodemailer) run server-side; the shared auth secret never reaches the client.

**Tech Stack:** Next.js ^15 (App Router, `src/`), React, TypeScript (strict), Tailwind CSS, Prisma + `@prisma/client`, Neon serverless Postgres, Zod (input validation), `transbank-sdk` (Webpay Plus), `nodemailer`, Vitest (tests), npm.

## Global Constraints

These apply to **every** task; each task's requirements implicitly include this section.

- **Target location:** all new code lives under `/home/rodrigoogalde/Personal/CCemuc/app/`, a **new standalone git repo** (`git init` inside `app/`, independent of the parent CCemuc repo). The user wires the GitHub remote separately.
- **Runtime:** Next.js server runtime — **never** set `output: 'export'` in `next.config.mjs`.
- **Package manager:** npm. **Node:** ≥ 18.18 (Next 15 floor).
- **Data layer:** Prisma (`@prisma/client`) only — no Sequelize. Sequelize validations/hooks are reimplemented in app code (RUT validation in `src/domain/rut.ts`, buy-order generation in `src/domain/buyOrder.ts`).
- **Database:** Neon serverless Postgres. `DATABASE_URL` = pooled connection (used at runtime); `DIRECT_URL` = direct connection (used for `prisma migrate`). The Prisma client is a `globalThis`-cached singleton in `src/lib/prisma.ts` — import it as a **named** export `{ prisma }` everywhere.
- **Backend exposure:** Next.js **server actions** (`'use server'`) replace the REST API. The single exception is `src/app/api/webpay/return/route.ts` (Route Handler) — Transbank's browser redirect cannot target a server action.
- **Result convention:** every action returns `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; field?: string; status: number }` from `src/domain/result.ts` (`ok()` / `fail()` helpers). Frontend branches on `.ok`. Status mapping: created/found → `ok()`; unique-constraint dup → `fail(msg, 409, field)`; not found → `fail(msg, 404)`; Zod shape error → `fail(msg, 400, field)`; unauthorized → `fail('Unauthorized', 403)`.
- **Validation:** every action input is validated with a Zod schema from `src/schemas/*` (including `updatePurchase`).
- **Auth:** server-only secret. Public registration/purchase actions are open (as today). Admin/mutation actions (`create/update/deleteCourse`, `deleteUser`, `update/deleteEnrollment`, `getPurchases/update/deletePurchase`) take an `adminSecret` arg and call `assertAdmin(secret)` which **throws** `UnauthorizedError` on mismatch or unset `ADMIN_SECRET`; the caller maps the throw to `fail('Unauthorized', 403)`. `assertAdmin` lives in `src/lib/auth.ts` and is implemented **before** any action phase that consumes it.
- **Payments:** env-switchable Transbank. `WEBPAY_ENVIRONMENT=integration|production` selects credentials/environment in `src/lib/webpay.ts` (integration defaults when env unset in dev).
- **Email HTML is built server-side.** `sendConfirmation(input)` accepts `{ purchaseId, email }`, loads the purchase's courses, builds the HTML via `buildConfirmationEmailHtml`, and sends via `sendMail(to, subject, html)`. No client-rendered HTML crosses the boundary.
- **Webpay return redirect uses HTTP 303** (`NextResponse.redirect(url, 303)`) so Transbank's POST becomes a GET to `/confirmation`.
- **Registration gate:** `/pricing` reads `process.env.REGISTRATION_OPEN` at request time (server) — not via `next.config.env` build-time inlining. Default `'true'` in `.env.example`.
- **TDD:** every code task is test-first with Vitest. DB/Transbank/nodemailer are mocked with `vi.mock` so unit tests need no live services; the one real migration/integration step is clearly marked.
- **Commits:** Conventional Commits, **one commit per task**, ending with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Copy:** all user-facing text stays in **Spanish**, matching the current site.
- **Faithful migration:** preserve current behavior unless a task explicitly improves it (the four baked-in improvements below). Do **not** port dead/stale code: `frontend/src/utils/handleConfirmation.ts`, the `Course.description` field, or the hardcoded `BACKEND_URL`.

### Baked-in improvements (decided)

1. **Atomicity + capacity fix** — `confirmPurchase` does mark-paid → create enrollments (purchased **+** core) → decrement capacity inside one `prisma.$transaction`. The oversell guard (`updateMany … capacity: { gt: 0 }`, fail if `count === 0`) applies **only to the user's purchased courses**; core-course enrollment never fails the confirmation.
2. **Dead-code & hardcode cleanup** — single shared RUT validator; no `handleConfirmation.ts`, no `Course.description`, no `BACKEND_URL`.
3. **Zod input validation** on every action.
4. **Vitest** test setup + per-task TDD.

## File Structure

```
app/
├── prisma/
│   ├── schema.prisma            # 4 models + CourseType enum (mirrors the Sequelize models)
│   ├── seed.ts                  # course-catalog seeder (ported)
│   └── migrations/
├── src/
│   ├── lib/
│   │   ├── prisma.ts            # serverless-safe PrismaClient singleton  (named export)
│   │   ├── webpay.ts            # Transbank wrapper, env-switchable
│   │   ├── mailer.ts            # nodemailer transport + sendMail
│   │   └── auth.ts              # assertAdmin() + UnauthorizedError
│   ├── domain/
│   │   ├── rut.ts               # isRut()/getDV()  (shared, single copy)
│   │   ├── buyOrder.ts          # generateBuyOrder() 26-char sha256
│   │   ├── courseType.ts        # CourseType { core, elective, workshop }
│   │   └── result.ts            # ActionResult<T> + ok()/fail()
│   ├── schemas/                 # Zod input schemas
│   │   ├── user.ts  course.ts  purchase.ts  enrollment.ts
│   ├── actions/                 # 'use server'
│   │   ├── users.ts  courses.ts  enrollments.ts  purchases.ts
│   ├── app/
│   │   ├── layout.tsx  globals.css  page.tsx
│   │   ├── about/ contact/ references/ schedule/ modules/ pricing/ form/ confirmation/ error/  (page.tsx each)
│   │   └── api/webpay/return/route.ts
│   ├── components/              # ported UI (header, main, mainPage/*, inscriptions/*, modulePage/*, images/*, buyInfo, mailConfirmation, …)
│   └── utils/                   # sections.json, universities.json
├── .env.example   vitest.config.ts   next.config.mjs   tailwind.config.ts   tsconfig.json   package.json
```

## Phase Overview

The plan is deliberately incremental — each phase ends with working, committed, tested software so nothing is migrated "all at once."

| Phase | Theme | Outcome |
|-------|-------|---------|
| 0 | Scaffold & infra | `app/` Next 15 project, git repo, Vitest harness, deps |
| 1 | Data layer | Prisma schema + Neon + singleton + seed |
| 2 | Domain & validation | RUT, buyOrder, CourseType, ActionResult, Zod schemas |
| 3 | Libs | `prisma`/`webpay`/`mailer`/`auth` (implemented before the action phases) |
| 4 | Users actions | `src/actions/users.ts` + tests |
| 5 | Courses + Enrollments actions | `courses.ts`, `enrollments.ts` + tests |
| 6 | Purchases actions + Webpay route | atomic confirm + capacity fix + return Route Handler |
| 7 | Frontend shell + info pages | layout, Tailwind, Header, landing, `/about` `/contact` `/references` `/schedule` `/modules` |
| 8 | Registration flow | `/pricing` + `/form` wired to server actions (no client token) |
| 9 | Confirmation + error | `/confirmation`, `/error`, server-side email HTML |
| 10 | Admin parity, cleanup, deploy | admin gating, verification sweep, Vercel deploy (+ AWS note) |

> **Note:** the libs (`auth`/`webpay`/`mailer`) are pulled forward into Phase 3 so every later action phase can `tsc --noEmit` cleanly — fixing the producer-after-consumer ordering the original draft had.

---
## Phase 0 — Scaffold & infra

Stand up the new Next.js (App Router, src dir, TS strict, Tailwind) monolith in `/home/rodrigoogalde/Personal/CCemuc/app/` with its own git repo, install the full runtime/dev dependency set, and prove the Vitest harness with a trivial passing smoke test. Every later phase commits into this repo and runs against this harness. The `app/.git` directory already exists (empty repo); these tasks populate it.

> Working directory for every command in Phases 0–1 is `/home/rodrigoogalde/Personal/CCemuc/app/` unless stated otherwise. All `npm`/`npx`/`git` commands run from there.

### Task 1: Scaffold the Next.js app, git, env example, README

**Files:**
- Create (via `create-next-app`): `app/package.json`, `app/tsconfig.json`, `app/next.config.mjs`, `app/tailwind.config.ts`, `app/postcss.config.mjs`, `app/src/app/layout.tsx`, `app/src/app/page.tsx`, `app/src/app/globals.css`, `app/.gitignore`, `app/eslint.config.mjs`
- Modify: `app/next.config.mjs` (assert NO `output: 'export'`), `app/.gitignore` (add `.env*`), `app/package.json` (name + scripts)
- Create: `app/.env.example`, `app/README.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a buildable Next 15 App Router project rooted at `/home/rodrigoogalde/Personal/CCemuc/app/`; `app/.env.example` documenting every env var later tasks read; npm scripts `dev`/`build`/`start`/`lint` (extended in later tasks).

Steps:

- [ ] Confirm `app/` is an empty git repo and prep for scaffold (create-next-app refuses a non-empty dir, but tolerates a lone `.git`):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && ls -A
  ```
  Expected output: only `.git`. If anything else is present, stop and reconcile before continuing.

- [ ] Scaffold in-place with the locked options (Next 15.x, TS, Tailwind, App Router, src dir, no Turbopack default, npm, `@/*` import alias). Run from the parent so the target dir name is explicit:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc && npx --yes create-next-app@latest app \
    --ts --tailwind --eslint --app --src-dir --no-turbopack \
    --import-alias "@/*" --use-npm
  ```
  Expected: it detects the existing `.git`, scaffolds files, installs deps, prints `Success! Created app at ...`. (If it errors "directory not empty", run with the directory already containing only `.git`; the `.git` dir alone does not block it. If your CLI version still blocks, scaffold into a temp name then move files in — but the lone-`.git` case is supported.)

- [ ] Verify the App Router + src-dir layout landed:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && ls src/app && cat next.config.mjs
  ```
  Expected: `layout.tsx page.tsx globals.css favicon.ico` under `src/app`, and a `next.config.mjs` with NO `output: 'export'` line.

- [ ] Pin Next to latest 15.x and React 19 if create-next-app pinned something else; confirm versions:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && node -e "const p=require('./package.json');console.log('next',p.dependencies.next,'react',p.dependencies.react)"
  ```
  Expected: `next 15.x` and `react 19.x` (the defaults for create-next-app@latest). If `next` is not 15.x, run `npm i next@^15 react@^19 react-dom@^19`.

- [ ] Harden `next.config.mjs` — ensure server runtime, explicitly no static export. Replace its contents:
  ```js
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    // Monolith runs on the Next.js server runtime (serverless on Vercel).
    // Do NOT set output: 'export' — server actions + route handlers require the server runtime.
    reactStrictMode: true,
  };

  export default nextConfig;
  ```

- [ ] Ensure `.gitignore` ignores env files and Next/Prisma artifacts. Append (idempotent — create-next-app already ignores `node_modules`, `.next`, `.env*` partially; make env coverage explicit):
  ```
  # local env files
  .env
  .env.local
  .env.*.local

  # prisma / generated
  /src/generated
  ```
  Then verify `.env*` is ignored:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && git check-ignore .env .env.local && echo IGNORED
  ```
  Expected: prints the two paths then `IGNORED`.

- [ ] Write `app/.env.example` documenting every variable the monolith reads (Neon connection strings carry inline comments; secrets are placeholders, never real values):
  ```bash
  # ---- Database (Neon serverless Postgres) ----
  # Pooled connection (PgBouncer) — used by the app at runtime via @prisma/client.
  # Get both strings from the Neon dashboard > Connection Details.
  # The pooled host contains "-pooler"; append ?sslmode=require&pgbouncer=true&connection_limit=1
  DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/ccemuc?sslmode=require&pgbouncer=true&connection_limit=1"
  # Direct (non-pooled) connection — used ONLY by `prisma migrate` / `prisma db seed`.
  # Same DB, NON-pooler host (no "-pooler"), no pgbouncer flag.
  DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/ccemuc?sslmode=require"

  # ---- Transbank Webpay Plus ----
  # integration => uses SDK integration commerce code/key; production => uses the real ones.
  WEBPAY_ENVIRONMENT="integration"
  WEBPAY_COMMERCE_CODE=""
  WEBPAY_API_KEY=""
  # Absolute URL Transbank redirects the browser back to after payment (must be the route handler).
  WEBPAY_RETURN_URL="http://localhost:3000/api/webpay/return"

  # ---- Email (nodemailer SMTP) ----
  EMAIL_HOST=""
  EMAIL_PORT="587"
  EMAIL_USER=""
  EMAIL_PASS=""
  EMAIL_FROM="CCemuc <no-reply@ccemuc.cl>"

  # ---- App auth & flags ----
  # Server-only secret gating admin/mutation actions. NEVER prefixed NEXT_PUBLIC_.
  ADMIN_SECRET="change-me-in-prod"
  # 'true' shows the /pricing selection UI; anything else shows "No disponible".
  REGISTRATION_OPEN="true"
  # Public base URL of the deployment (used to derive return URLs / links).
  NEXT_PUBLIC_BASE_URL="http://localhost:3000"
  ```

- [ ] Write `app/README.md` with setup/run notes:
  ```md
  # CCemuc Monolith

  Next.js 15 (App Router) full-stack monolith — replaces the separate Koa API
  (`../ccemuc-api`) and static Next frontend (`../frontend`). Data layer is Prisma on
  Neon serverless Postgres. Backend is exposed via Server Actions, plus one Route Handler
  for the Transbank Webpay return URL.

  ## Setup

  ```bash
  npm install            # runs `prisma generate` via postinstall
  cp .env.example .env   # then fill in Neon + Transbank + SMTP values
  npx prisma migrate dev # apply schema to Neon (uses DIRECT_URL)
  npm run db:seed        # seed the course catalog
  npm run dev            # http://localhost:3000
  ```

  ## Scripts

  - `npm run dev` / `build` / `start` — Next.js
  - `npm run test` — Vitest (run once)
  - `npm run db:seed` — seed course catalog
  - `npx prisma migrate dev` — create/apply migrations (DIRECT_URL)

  ## Env

  See `.env.example`. `ADMIN_SECRET` is server-only and gates admin/mutation actions.
  `REGISTRATION_OPEN` toggles the /pricing selection UI. Transbank switches on
  `WEBPAY_ENVIRONMENT` (`integration` | `production`).
  ```

- [ ] Sanity-build to prove the scaffold compiles:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npm run build
  ```
  Expected: `✓ Compiled successfully` and a route listing including `/` ; NO mention of "Export" / "Exporting (static)".

- [ ] Commit the scaffold:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && git add -A && git commit -m "chore: scaffold Next.js 15 monolith (App Router, TS, Tailwind, src dir)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 2: Install dependencies and wire npm scripts

**Files:**
- Modify: `app/package.json` (dependencies, devDependencies, scripts)

**Interfaces:**
- Consumes: the scaffolded `app/package.json` from Task 1.
- Produces: installed runtime deps `prisma`, `@prisma/client`, `zod`, `transbank-sdk`, `nodemailer` and dev deps `vitest`, `@types/node`, `@types/nodemailer`, `tsx`; npm scripts `test`, `test:watch`, `db:seed`, and `postinstall: prisma generate` that all later tasks rely on.

Steps:

- [ ] Install runtime dependencies (exact set from the section scope):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npm install @prisma/client zod transbank-sdk nodemailer
  ```
  Expected: added to `dependencies`, no errors.

- [ ] Install dev dependencies (Prisma CLI, Vitest, types, `tsx` to run the TS seed/migrate-seed):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npm install -D prisma vitest @types/node @types/nodemailer tsx
  ```
  Expected: added to `devDependencies`, no errors. (`@types/node` may already exist from create-next-app; npm dedupes.)

- [ ] Verify versions landed (Prisma 6.x, Vitest 3.x, zod 3.x, transbank-sdk 5.x):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && node -e "const p=require('./package.json');console.log({prisma:p.devDependencies.prisma,client:p.dependencies['@prisma/client'],zod:p.dependencies.zod,tbk:p.dependencies['transbank-sdk'],vitest:p.devDependencies.vitest})"
  ```
  Expected: an object with all five present (e.g. `prisma: ^6.x`, `transbank-sdk: ^5.x`).

- [ ] Read the current `scripts` block before editing:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && node -e "console.log(JSON.stringify(require('./package.json').scripts,null,2))"
  ```
  Expected: `dev`, `build`, `start`, `lint` from create-next-app.

- [ ] Add the project scripts. Edit `app/package.json` so the `scripts` block becomes exactly:
  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:seed": "prisma db seed",
    "postinstall": "prisma generate"
  }
  ```

- [ ] Add the Prisma seed hook so `prisma db seed` knows how to run the TS seeder. Add a top-level `"prisma"` key to `app/package.json` (sibling of `"scripts"`):
  ```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
  ```

- [ ] Verify `postinstall` did not break (it will warn that no schema exists yet — that is fine until Task 4). Confirm the script is wired:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && node -e "const s=require('./package.json');console.log('seed:',s.scripts['db:seed'],'| postinstall:',s.scripts.postinstall,'| prisma.seed:',s.prisma.seed)"
  ```
  Expected: `seed: prisma db seed | postinstall: prisma generate | prisma.seed: tsx prisma/seed.ts`.

- [ ] Commit:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && git add -A && git commit -m "chore: install prisma/zod/transbank/nodemailer + vitest, wire npm scripts

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 3: Vitest config + smoke test (prove the harness)

**Files:**
- Create: `app/vitest.config.ts`
- Create (test): `app/src/smoke.test.ts`

**Interfaces:**
- Consumes: `vitest` from Task 2; the `@/*` alias from `app/tsconfig.json`.
- Produces: a runnable Vitest harness (`npm run test` / `npx vitest run`) with the `@/*` alias resolved, used by every later task's tests.

Steps:

- [ ] Write `app/vitest.config.ts` — node environment (these are server/domain units, no DOM), resolve the `@/*` alias to `src/`:
  ```ts
  import { defineConfig } from 'vitest/config';
  import { fileURLToPath } from 'node:url';

  export default defineConfig({
    test: {
      environment: 'node',
      globals: false,
      include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  });
  ```

- [ ] Write the failing smoke test `app/src/smoke.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';

  describe('vitest harness', () => {
    it('runs and resolves basic assertions', () => {
      expect(1 + 1).toBe(2);
    });
  });
  ```

- [ ] Run it — it should PASS (this test proves the harness; there is no implementation to fail against). Run:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/smoke.test.ts
  ```
  Expected: `Test Files  1 passed (1)` / `Tests  1 passed (1)`. (If Vitest cannot find a config or the `@` alias, that is the real failure mode this step catches — fix `vitest.config.ts` until green.)

- [ ] Confirm the npm script wrapper also works:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npm run test
  ```
  Expected: same `1 passed` result, exit code 0.

- [ ] Commit:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && git add -A && git commit -m "test: add vitest config and passing smoke test

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

## Phase 1 — Data layer (Prisma + Neon + seed)

Replace Sequelize with Prisma against Neon serverless Postgres. The Prisma schema EXACTLY mirrors the four Sequelize models (`ccemuc-api/src/models/*.model.ts`) and the `CourseType` enum (`ccemuc-api/src/enums/course-type.enum.ts`): note the deliberate omissions per the locked decisions — no `description` field exists on Course (already absent in the model) and nothing dead is ported. We add a serverless-safe PrismaClient singleton, the first migration (run with `DIRECT_URL`), and a TS seeder porting the course catalog verbatim from `ccemuc-api/src/seeders/20240716203436-courses.ts`.

### Task 4: Prisma schema (4 models + CourseType enum) — exact mirror of Sequelize

**Files:**
- Create: `app/prisma/schema.prisma`
- Modify: `app/.env` (local only, gitignored — created from `.env.example` for the migration)

**Interfaces:**
- Consumes: `DATABASE_URL` / `DIRECT_URL` env (documented in `.env.example`, Task 1).
- Produces: the Prisma data model and generated client types `User`, `Course`, `Purchase`, `Enrollment`, and `CourseType` enum (values `core | elective | workshop`) that every action/schema task imports from `@prisma/client`. Field names mirror the Sequelize models exactly: User(`names`,`lastNames`,`rut`,`email`,`university`,`carrerYear`), Course(`title`,`module`,`type`,`price`,`capacity`,`features` Json?,`week`,`topics` String[]), Purchase(`userId`,`buyOrder` String?,`isPaid` default false,`coursesIds` String[] @db.Uuid), Enrollment(`userId`,`courseId`,`purchaseId`, @@unique([userId,courseId])).

Steps:

- [ ] Initialize Prisma (creates `prisma/schema.prisma` + appends env keys; we already authored `.env.example`, so just generate the schema scaffold). Run:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx prisma init --datasource-provider postgresql
  ```
  Expected: `prisma/schema.prisma` created and a `.env` file created/updated. (If `prisma init` overwrites `.env`, re-copy from `.env.example` in a later step.)

- [ ] Write a schema-shape test that asserts the generated TypeScript types exist with the expected fields (compile-time check via Vitest + `vi`-free type import). Create `app/prisma/schema.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import type { User, Course, Purchase, Enrollment } from '@prisma/client';
  import { CourseType, Prisma } from '@prisma/client';

  // These are type-level assertions compiled by Vitest's esbuild/tsc pipeline.
  // If the schema/generated client is missing a field, this file fails to compile.
  describe('prisma generated types', () => {
    it('CourseType enum has core/elective/workshop', () => {
      expect(CourseType.core).toBe('core');
      expect(CourseType.elective).toBe('elective');
      expect(CourseType.workshop).toBe('workshop');
    });

    it('models expose the mirrored fields', () => {
      const user: Pick<User, 'names' | 'lastNames' | 'rut' | 'email' | 'university' | 'carrerYear'> = {
        names: 'a', lastNames: 'b', rut: '1-9', email: 'e', university: 'u', carrerYear: 1,
      };
      const course: Pick<Course, 'title' | 'module' | 'type' | 'price' | 'capacity' | 'week' | 'topics'> = {
        title: 't', module: 1, type: CourseType.core, price: 0, capacity: 10, week: 0, topics: [],
      };
      const purchase: Pick<Purchase, 'userId' | 'buyOrder' | 'isPaid' | 'coursesIds'> = {
        userId: 'u', buyOrder: 'b', isPaid: false, coursesIds: [],
      };
      const enrollment: Pick<Enrollment, 'userId' | 'courseId' | 'purchaseId'> = {
        userId: 'u', courseId: 'c', purchaseId: 'p',
      };
      // features is a nullable Json column on Course
      const features: Prisma.InputJsonValue = { Modalidad: 'on-line' };

      expect(user.carrerYear).toBe(1);
      expect(course.type).toBe('core');
      expect(purchase.isPaid).toBe(false);
      expect(enrollment.courseId).toBe('c');
      expect(features).toBeTruthy();
    });
  });
  ```

- [ ] Run it — expect FAIL (client not generated from a real schema yet; the `@prisma/client` import has no `User`/`Course`/`CourseType` matching our shape):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run prisma/schema.test.ts
  ```
  Expected failure: a resolution/type error such as `Cannot find module '@prisma/client' or its corresponding type declarations` or missing exported members `CourseType`/`User` — because `prisma generate` has not run against our models.

- [ ] Write the full `app/prisma/schema.prisma` mirroring the Sequelize models exactly (UUID PKs with `dbgenerated` default to match `@Default(uuidv4)`; `coursesIds` as `String[] @db.Uuid` per Purchase; `features` as nullable `Json`; `topics` as `String[]`; composite unique on Enrollment `(userId, courseId)`; `createdAt`/`updatedAt` to mirror Sequelize timestamps; cascade deletes on relations):
  ```prisma
  // CCemuc Prisma schema — exact mirror of ccemuc-api/src/models/*.model.ts
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")  // pooled (PgBouncer) — runtime
    directUrl = env("DIRECT_URL")    // direct — migrations & seed
  }

  enum CourseType {
    core
    elective
    workshop
  }

  model User {
    id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
    names       String
    lastNames   String
    rut         String   @unique
    email       String   @unique
    university  String
    carrerYear  Int
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    enrollments Enrollment[]
    purchases   Purchase[]
  }

  model Course {
    id          String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
    title       String
    module      Int
    type        CourseType
    price       Int
    capacity    Int
    features    Json?
    week        Int
    topics      String[]
    createdAt   DateTime   @default(now())
    updatedAt   DateTime   @updatedAt

    enrollments Enrollment[]
  }

  model Purchase {
    id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
    userId      String   @db.Uuid
    buyOrder    String?
    isPaid      Boolean  @default(false)
    coursesIds  String[] @db.Uuid
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
    enrollments Enrollment[]
  }

  model Enrollment {
    id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
    userId     String   @db.Uuid
    courseId   String   @db.Uuid
    purchaseId String   @db.Uuid
    createdAt  DateTime @default(now())
    updatedAt  DateTime @updatedAt

    user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    course   Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
    purchase Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)

    @@unique([userId, courseId], name: "UserCourseUnique")
  }
  ```

- [ ] Generate the client and re-run the shape test — expect PASS:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx prisma generate && npx vitest run prisma/schema.test.ts
  ```
  Expected: `prisma generate` prints `Generated Prisma Client`, then `Tests  2 passed (2)`.

- [ ] Validate the schema is internally consistent (catches typos before any migration):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx prisma validate
  ```
  Expected: `The schema at prisma/schema.prisma is valid 🚀`.

- [ ] Commit:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && git add -A && git commit -m "feat: add prisma schema mirroring sequelize models + CourseType enum

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 5: Serverless-safe PrismaClient singleton

**Files:**
- Create: `app/src/lib/prisma.ts`
- Create (test): `app/src/lib/prisma.test.ts`

**Interfaces:**
- Consumes: generated client from Task 4 (`@prisma/client`).
- Produces: `export const prisma: PrismaClient` (default-cached on `globalThis` in non-production to survive HMR / avoid connection exhaustion on serverless). Every action/domain task that touches the DB imports `{ prisma } from '@/lib/prisma'`.

Steps:

- [ ] Write the failing test `app/src/lib/prisma.test.ts` — it mocks `@prisma/client` so no real DB/connection is needed, and asserts (a) the module exports a `prisma` instance and (b) importing twice reuses the SAME instance (singleton via `globalThis`). Use `vi.mock` for `PrismaClient`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  // Mock the generated client so the test never opens a real connection.
  const constructed: unknown[] = [];
  vi.mock('@prisma/client', () => {
    class PrismaClient {
      constructor() {
        constructed.push(this);
      }
    }
    return { PrismaClient };
  });

  describe('prisma singleton', () => {
    beforeEach(() => {
      constructed.length = 0;
      // Clear the globalThis cache between runs so we control construction count.
      // @ts-expect-error test-only global key
      delete globalThis.__ccemucPrisma;
      vi.resetModules();
    });

    it('exports a prisma client instance', async () => {
      const mod = await import('./prisma');
      expect(mod.prisma).toBeTruthy();
    });

    it('reuses the same instance across imports (no new connection per import)', async () => {
      const a = await import('./prisma');
      vi.resetModules(); // simulate a second module evaluation (e.g. HMR / serverless reuse)
      const b = await import('./prisma');
      expect(a.prisma).toBe(b.prisma);
      // Only ONE PrismaClient was ever constructed.
      expect(constructed.length).toBe(1);
    });
  });
  ```

- [ ] Run it — expect FAIL (module does not exist yet):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/prisma.test.ts
  ```
  Expected failure: `Failed to resolve import "./prisma"` / `Cannot find module`.

- [ ] Implement `app/src/lib/prisma.ts` — the serverless-safe singleton caching on `globalThis`:
  ```ts
  import { PrismaClient } from '@prisma/client';

  // Cache the client on globalThis so that:
  //  - in dev, Next.js HMR reloads don't spawn a new client (and a new pool) each time;
  //  - on serverless (Vercel), a warm lambda reuses the existing client.
  const globalForPrisma = globalThis as unknown as {
    __ccemucPrisma?: PrismaClient;
  };

  export const prisma: PrismaClient =
    globalForPrisma.__ccemucPrisma ?? new PrismaClient();

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__ccemucPrisma = prisma;
  }
  ```

- [ ] Re-run the test — expect PASS:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/prisma.test.ts
  ```
  Expected: `Tests  2 passed (2)`.

  > Note: in production (`NODE_ENV=production`) the instance is NOT stored on `globalThis`, which is correct — each cold lambda gets its own client. The test forces non-production behavior (Vitest defaults `NODE_ENV` to `test`, so the `!== 'production'` branch runs and caching is exercised).

- [ ] Commit:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && git add -A && git commit -m "feat: add serverless-safe PrismaClient singleton

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 6: First migration against Neon + course-catalog seeder

**Files:**
- Create: `app/prisma/migrations/<timestamp>_init/migration.sql` (generated by `prisma migrate dev`)
- Create: `app/prisma/seed.ts`
- Create (test): `app/prisma/seed.test.ts`

**Interfaces:**
- Consumes: schema (Task 4), `prisma db seed` script + `prisma.seed` hook (Task 2), `DIRECT_URL` for migrations.
- Produces: the initial DB schema on Neon and an idempotent `seedCourses(client)` function (default-exported runner uses the real `prisma` singleton) porting all 9 catalog courses verbatim from `ccemuc-api/src/seeders/20240716203436-courses.ts`. Later phases assume the catalog is seeded; Users/Purchases start empty.

Steps:

- [ ] Prepare the local `.env` for the migration (the migration needs a reachable Neon `DIRECT_URL`). Copy the example and fill in real Neon strings (manual one-time step — do NOT commit `.env`, it is gitignored):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && test -f .env || cp .env.example .env
  ```
  Then edit `.env` and set real `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) from the Neon dashboard. Verify the direct connection resolves before migrating:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && node -e "const u=require('dotenv');u.config();console.log('DIRECT_URL set:', !!process.env.DIRECT_URL)"
  ```
  Expected: `DIRECT_URL set: true`. (dotenv is a transitive dep of Next; if not resolvable, just confirm the var is present in `.env`.)

- [ ] **[REAL DB — requires live Neon, run manually]** Create and apply the initial migration using the DIRECT (non-pooled) URL. Prisma reads `directUrl` from the schema automatically:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx prisma migrate dev --name init
  ```
  Expected: `Applying migration ...init`, then `Your database is now in sync with your schema.` and a generated `prisma/migrations/<ts>_init/migration.sql`. (This is the one unavoidable live-DB step in this phase. PKs use `gen_random_uuid()`: Neon Postgres (≥13) provides `gen_random_uuid()` natively with no extension step, so `@default(dbgenerated("gen_random_uuid()"))` — equivalently Prisma's `@default(uuid())` — migrates cleanly. No extension-enabling step (no `CREATE EXTENSION`) is required on Neon.)

- [ ] Inspect the generated SQL to confirm the array/json/enum columns mapped correctly:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && grep -E "CourseType|coursesIds|topics|features|UserCourseUnique" prisma/migrations/*_init/migration.sql
  ```
  Expected: a `CREATE TYPE "CourseType" AS ENUM ('core','elective','workshop')`, `"coursesIds" UUID[]`, `"topics" TEXT[]`, `"features" JSONB`, and a unique index named `UserCourseUnique` (or `Enrollment_userId_courseId_key`).

- [ ] Write the failing seeder test `app/prisma/seed.test.ts`. It mocks the Prisma client (a fake with `course.create` and `course.count`) so the test runs WITHOUT a live DB, and asserts the seeder creates exactly the 9 catalog courses with the right shape (core/elective/workshop mix, a price-0 core, a price-25900 elective, topics arrays, features maps), and is idempotent (skips when courses already exist):
  ```ts
  import { describe, it, expect, vi } from 'vitest';
  import { CourseType } from '@prisma/client';
  import { seedCourses } from './seed';

  function makeFakeClient(existingCount = 0) {
    const created: Array<Record<string, unknown>> = [];
    return {
      created,
      course: {
        count: vi.fn(async () => existingCount),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: `id-${created.length}`, ...data };
        }),
      },
    };
  }

  describe('seedCourses', () => {
    it('creates all 9 catalog courses with mirrored shapes', async () => {
      const client = makeFakeClient(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await seedCourses(client as any);

      expect(client.course.create).toHaveBeenCalledTimes(9);
      expect(client.created).toHaveLength(9);

      const titles = client.created.map((c) => c.title);
      expect(titles).toContain('Módulo: Cirugía General');
      expect(titles).toContain('Workshop: Ultrasonido Clínico de urgencia');
      expect(titles).toContain('Curso de prueba');

      const general = client.created.find((c) => c.title === 'Módulo: Cirugía General')!;
      expect(general.type).toBe(CourseType.core);
      expect(general.price).toBe(0);
      expect(general.module).toBe(1);
      expect((general.topics as string[]).length).toBe(12);
      expect((general.features as Record<string, string>)['Horario']).toBe('09:00 a 14:00 hrs.');

      const digestive = client.created.find(
        (c) => c.title === 'Módulo: Cirugía Digestiva y Colopractología',
      )!;
      expect(digestive.type).toBe(CourseType.elective);
      expect(digestive.price).toBe(25900);

      // type distribution: 2 core, 5 elective, 2 workshop
      const types = client.created.map((c) => c.type);
      expect(types.filter((t) => t === CourseType.core)).toHaveLength(2);
      expect(types.filter((t) => t === CourseType.elective)).toHaveLength(5);
      expect(types.filter((t) => t === CourseType.workshop)).toHaveLength(2);
    });

    it('is idempotent — skips creation when courses already exist', async () => {
      const client = makeFakeClient(9);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await seedCourses(client as any);
      expect(client.course.create).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] Run it — expect FAIL (`seed.ts` does not exist yet):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run prisma/seed.test.ts
  ```
  Expected failure: `Failed to resolve import "./seed"`.

- [ ] Implement `app/prisma/seed.ts` — port the catalog verbatim from `ccemuc-api/src/seeders/20240716203436-courses.ts`. Export `seedCourses(client)` (idempotent), default runner uses the real singleton. Note the two workshops have NO `topics` in the source (mirror that — omit `topics`, which Prisma's `String[]` defaults to `[]`); "Curso de prueba" has `topics: []`:
  ```ts
  import { PrismaClient, CourseType } from '@prisma/client';
  import { prisma } from '../src/lib/prisma';

  type SeedCourse = {
    title: string;
    module: number;
    type: CourseType;
    price: number;
    capacity: number;
    week: number;
    features?: Record<string, string>;
    topics?: string[];
  };

  const courses: SeedCourse[] = [
    {
      title: 'Módulo: Cirugía General',
      module: 1,
      type: CourseType.core,
      price: 0,
      capacity: 1000,
      week: 0,
      features: {
        Modalidad: '13 sesiones presencial',
        Lugar: 'Campus Casa Central. Auditorio por definir.',
        Fecha: 'Sábados 31/08, 07/09 y 14/09',
        Horario: '09:00 a 14:00 hrs.',
      },
      topics: [
        'Innovaciones que Cambiaron el Curso de la Medicina',
        'Simulación y realidad virtual',
        'Conceptos generales del Pre y Postoperatorio',
        'Abdomen Agudo: Innovaciones en el Diagnóstico y Manejo Quirúrgico',
        'Conceptos Básicos de Laparoscopía para Estudiantes de la Salud',
        'Mejoras en Trasplante y Donación de Órganos',
        'El Rol del Protocolo ERAS en la Recuperación Rápida',
        'Cirugía robótica: avances en el estudio e implementación en Chile',
        'Cicatrización y materiales de sutura',
        'Inteligencia artificial en la investigación quirúrgica',
        'FORO: Toma de decisiones difíciles en pabellón',
        'FORO: Mujeres en cirugía',
      ],
    },
    {
      title: 'Módulo: Anestesiología',
      module: 6,
      type: CourseType.core,
      price: 0,
      capacity: 1000,
      week: 0,
      features: {
        Modalidad: '5 clases on-line, asincrónico',
        Lugar: 'Clases disponibles en plataforma.',
      },
      topics: [
        'Riesgos y evaluación preoperatoria',
        'Urgencias anestésicas',
        'Monitorización anestésica',
        'Manejo de la vía aérea',
        'Mecanismos de la anestesia general',
      ],
    },
    {
      title: 'Módulo: Cirugía Digestiva y Colopractología',
      module: 2,
      type: CourseType.elective,
      price: 25900,
      capacity: 100,
      week: 1,
      features: {
        Modalidad: '9 sesiones on-line sincrónicas. 3 sesiones presencial',
        Lugar: 'Campus Casa Central. Auditorio por definir.',
        Fecha: 'L 02/09 - M 03/09 - W 04/09 - S 07/09',
        Horario: 'L-M-W de 18:30 a 20:45 hrs. S de 12:20 a 13:50 hrs.',
      },
      topics: [
        'Patología esofágica benigna',
        'Obesidad y cirugía bariátrica',
        'Cáncer esófagogástrico',
        'Patología benigna biliar',
        'Trasplante hepático',
        'Ictericia obstructiva de origen maligno',
        'Urgencias de colon',
        'Cáncer de colon y recto',
        'Técnicas básicas en Coloproctología: Hartmann, colectomías y ostomías',
      ],
    },
    {
      title: 'Módulo: Cirugía de Trauma y Urología',
      module: 3,
      type: CourseType.elective,
      price: 25900,
      capacity: 100,
      week: 1,
      features: {
        Modalidad: '9 sesiones on-line sincrónicas. 3 sesiones presencial',
        Lugar: 'Campus Casa Central. Auditorio por definir.',
        Fecha: 'L 02/09 - M 03/09 - W 04/09 - S 07/09',
        Horario: 'L-M-W de 18:30 a 20:45 hrs. S de 12:20 a 13:50 hrs.',
      },
      topics: [
        'Principales errores en la evaluación primaria de trauma',
        'Trauma torácico',
        'Trauma abdominal',
        'Cirugía de control de daños',
        'Trauma Urológico de Vía Urinaria Superior',
        'Litiasis urinaria',
        'Hiperplasia Prostática Benigna',
        'Diagnóstico en Cáncer de próstata',
        'Urgencias urológicas (tips and tricks)',
      ],
    },
    {
      title: 'Módulo: Cirugía Plástica y Cirugía Oncológica',
      module: 4,
      type: CourseType.elective,
      price: 0,
      capacity: 100,
      week: 2,
      features: {
        Modalidad: '9 sesiones on-line sincrónicas. 3 sesiones presencial',
        Lugar: 'Campus Casa Central. Auditorio por definir.',
        Fecha: 'L 09/09 - M 10/09 - W 11/09 - S 14/09',
        Horario: 'L-M-W de 18:30 a 20:45 hrs. S de 12:20 a 13:50 hrs.',
      },
      topics: [
        'Patología mamaria benigna y maligna',
        'Melanoma y sarcomas de partes blandas',
        'Nódulo tiroideo y cáncer de tiroides',
        'Cáncer de cabeza y cuello',
        'Manejo del trauma maxilofacial en la atención de urgencia',
        'Cicatrización y heridas',
        'Injertos y Colgajos',
        'Quemaduras',
        'Úlceras por presión',
      ],
    },
    {
      title: 'Módulo: Cirugía de Tórax, Cardíaca y Vascular',
      module: 5,
      type: CourseType.elective,
      price: 0,
      capacity: 100,
      week: 2,
      features: {
        Modalidad: '9 sesiones on-line sincrónicas. 3 sesiones presencial',
        Lugar: 'Campus Casa Central. Auditorio por definir.',
        Fecha: 'L 09/09 - M 10/09 - W 11/09 - S 14/09',
        Horario: 'L-M-W de 18:30 a 20:45 hrs. S de 12:20 a 13:50 hrs.',
      },
      topics: [
        'Nódulo y cáncer pulmonar',
        'Neumotórax y pleurostomía',
        'Derrame pleural',
        'Patología aórtica',
        'Cirugía Cardiovascular',
        'Enfermedad tromboembólica',
        'Pie diabético',
        'Enfermedad arterial oclusiva',
        'Abdomen agudo vascular',
      ],
    },
    {
      title: 'Workshop: Técnicas en cirugía menor',
      module: 7,
      type: CourseType.workshop,
      price: 3000,
      capacity: 100,
      week: 3,
      features: {
        Modalidad: '9 sesiones on-line sincrónicas. 3 sesiones presencial',
        Lugar: 'Campus Casa Central. Auditorio por definir.',
        Fecha: 'L 02/09 - M 03/09 - W 04/09 - S 07/09',
        Horario: 'L-M-W de 18:30 a 20:45 hrs. S de 12:20 a 13:50 hrs.',
      },
    },
    {
      title: 'Workshop: Ultrasonido Clínico de urgencia',
      module: 8,
      type: CourseType.workshop,
      price: 3000,
      capacity: 60,
      week: 3,
      features: {
        Modalidad: '9 sesiones on-line sincrónicas. 3 sesiones presencial',
        Lugar: 'Campus Casa Central. Auditorio por definir.',
        Fecha: 'L 02/09 - M 03/09 - W 04/09 - S 07/09',
        Horario: 'L-M-W de 18:30 a 20:45 hrs. S de 12:20 a 13:50 hrs.',
      },
    },
    {
      title: 'Curso de prueba',
      module: 9,
      type: CourseType.elective,
      price: 50,
      capacity: 1000,
      week: 4,
      features: {
        Modalidad: '13 sesiones presencial',
        Lugar: 'Campus Casa Central. Auditorio por definir.',
        Fecha: 'Sábados 31/08, 07/09 y 14/09',
        Horario: '09:00 a 14:00 hrs.',
      },
      topics: [],
    },
  ];

  // Idempotent: only seeds when the catalog is empty. Accepts a client so it is testable.
  export async function seedCourses(
    client: Pick<PrismaClient, 'course'>,
  ): Promise<void> {
    const existing = await client.course.count();
    if (existing > 0) {
      console.log(`Course catalog already seeded (${existing} rows) — skipping.`);
      return;
    }
    for (const data of courses) {
      await client.course.create({ data });
    }
    console.log(`Seeded ${courses.length} courses.`);
  }

  async function main() {
    await seedCourses(prisma);
  }

  // Only auto-run when invoked directly (e.g. `prisma db seed` / `tsx prisma/seed.ts`),
  // never when imported by tests.
  if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
    main()
      .then(async () => {
        await prisma.$disconnect();
      })
      .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
      });
  }
  ```

- [ ] Re-run the seeder test — expect PASS (the mock means no live DB needed):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run prisma/seed.test.ts
  ```
  Expected: `Tests  2 passed (2)`.

- [ ] **[REAL DB — run manually after migration]** Seed the live Neon DB and confirm:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npm run db:seed
  ```
  Expected: `Seeded 9 courses.` Re-running prints `Course catalog already seeded (9 rows) — skipping.` (proves idempotency end-to-end).

- [ ] Run the full suite to confirm nothing regressed:
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && npm run test
  ```
  Expected: all test files pass (smoke, schema, prisma singleton, seed) — `Test Files  4 passed (4)`.

- [ ] Commit (include the generated migration SQL so teammates apply the same schema):
  ```bash
  cd /home/rodrigoogalde/Personal/CCemuc/app && git add -A && git commit -m "feat: add initial migration and course-catalog seeder

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Phase 2 — Domain utilities & Zod schemas

This phase ports the pure, dependency-free building blocks that every server action depends on: the shared RUT validator (single copy — kills the duplicate validation logic), the deterministic-format `buyOrder` generator (port of the Sequelize `@BeforeCreate` hook), the `CourseType` enum, the `ActionResult`/`ok`/`fail` result convention, and the Zod input schemas that mirror the legacy `*Attributes` interfaces. All of these are pure TypeScript with no DB/network dependency, so every test runs in-process with Vitest and no mocks (except `crypto`, which is Node built-in and used directly). Each task is strict TDD: failing test first, minimal real implementation, green, commit.

Assumes Phase 1 has scaffolded `app/` (npm, Next 15 App Router, `src/`, TypeScript strict, Tailwind, Vitest, its own git repo) and installed `zod`. All paths below are relative to `/home/rodrigoogalde/Personal/CCemuc/app/`. All commands run from that directory.

### Task 7: Port the shared RUT validator (`src/domain/rut.ts`)

Faithful port of `ccemuc-api/src/utils/rutValidator.ts` — the single canonical copy of RUT validation. Keep `isRut` returning `{ status, message }` (consumed by `userCreateSchema`'s refine in Task 11 and by the user action in a later phase). `getDV` is exported for reuse and direct unit testing. The legacy `getFakeRut` is a test/seed helper that pulls in `Math.random`; it is NOT ported (YAGNI — nothing in the migrated scope calls it). `console.log` side effects in the original are dropped.

**Files:**
- Create: `src/domain/rut.ts`
- Test: `src/domain/rut.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `export function getDV(rut: string): string | false` — `rut` is the body without DV (7–8 digits); returns the expected check digit as a string (`'0'`..`'9'` | `'K'`) or `false` if length is out of range.
  - `export function isRut(rut: string): { status: boolean; message: string }` — full `BODY-DV` string (no dots, dash required).

**Steps:**

- [ ] Step: Write the failing test.
```ts
// src/domain/rut.test.ts
import { describe, it, expect } from 'vitest';
import { isRut, getDV } from './rut';

describe('getDV', () => {
  it('computes DV for an 8-digit body', () => {
    expect(getDV('12345678')).toBe('5');
  });
  it('computes DV for a 7-digit body', () => {
    expect(getDV('1234567')).toBe('4');
  });
  it('returns "K" when the check digit is K', () => {
    expect(getDV('10869910')).toBe('K');
  });
  it('returns "0" when the modulus result is 11', () => {
    expect(getDV('11111111')).toBe('0');
  });
  it('returns false for an out-of-range length', () => {
    expect(getDV('123')).toBe(false);
    expect(getDV('123456789')).toBe(false);
  });
});

describe('isRut', () => {
  it('accepts a valid dashed RUT', () => {
    expect(isRut('12345678-5')).toEqual({ status: true, message: 'Valid RUT' });
  });
  it('accepts a lowercase k DV (case-insensitive)', () => {
    expect(isRut('10869910-k').status).toBe(true);
  });
  it('rejects a RUT containing dots', () => {
    const r = isRut('12.345.678-5');
    expect(r.status).toBe(false);
    expect(r.message).toBe('RUT must not contain dots Format: XX.XXX.XXX-X');
  });
  it('rejects a RUT without a dash', () => {
    const r = isRut('123456785');
    expect(r.status).toBe(false);
    expect(r.message).toBe('RUT must contain dashes');
  });
  it('rejects a body of the wrong length', () => {
    const r = isRut('123-5');
    expect(r.status).toBe(false);
    expect(r.message).toBe('RUT without DV must have 9 or 10 digits');
  });
  it('rejects an incorrect DV and reports the expected one', () => {
    const r = isRut('12345678-9');
    expect(r.status).toBe(false);
    expect(r.message).toBe('Invalid DV. Expected: 5');
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/domain/rut.test.ts`. Expected: fails to resolve/import `./rut` → `Error: Failed to resolve import "./rut"` (module does not exist yet), all tests errored.

- [ ] Step: Implement minimal code.
```ts
// src/domain/rut.ts
// Ported from ccemuc-api/src/utils/rutValidator.ts — single canonical RUT validator.
// getFakeRut() and console.log side effects are intentionally dropped (YAGNI / purity).

export function getDV(rut: string): string | false {
  let acum = 0;
  let num = 0;
  let N = 0;

  if (rut.length === 8) {
    const factors = [3, 2, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < rut.length; i += 1) {
      num = parseInt(rut[i], 10);
      N = factors[i];
      num *= N;
      acum += num;
    }
  } else if (rut.length === 7) {
    const factors = [2, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < rut.length; i += 1) {
      num = parseInt(rut[i], 10);
      N = factors[i];
      num *= N;
      acum += num;
    }
  } else {
    return false;
  }

  const cuo = Math.floor(acum / 11);
  const remainder = 11 - (acum - cuo * 11);

  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return remainder.toString();
}

export function isRut(rut: string): { status: boolean; message: string } {
  const response = { status: false, message: 'Valid RUT' };

  if (rut.includes('.')) {
    response.message = 'RUT must not contain dots Format: XX.XXX.XXX-X';
    return response;
  }

  if (!rut.includes('-')) {
    response.message = 'RUT must contain dashes';
    return response;
  }

  const rutWithoutDv = rut.split('-')[0];
  const dv = rut.split('-')[1].toUpperCase();

  if (!(rutWithoutDv.length >= 7 && rutWithoutDv.length <= 8)) {
    response.message = 'RUT without DV must have 9 or 10 digits';
    return response;
  }

  const expectedDV = getDV(rutWithoutDv);

  if (expectedDV !== dv) {
    response.message = `Invalid DV. Expected: ${expectedDV}`;
    return response;
  }

  response.status = true;
  return response;
}
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/domain/rut.test.ts`. Expected: `Test Files 1 passed (1)`, all 12 assertions green.

- [ ] Step: Commit.
```
git add src/domain/rut.ts src/domain/rut.test.ts && git commit -m "feat: port shared RUT validator (isRut/getDV)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 8: Port the buyOrder generator (`src/domain/buyOrder.ts`)

Port of `Purchase.generateBuyOrder` (`@BeforeCreate` hook in `ccemuc-api/src/models/purchase.model.ts`): build a raw string from a base36 timestamp + base36 random string, sha256 it, and take the first 26 hex chars. Output is non-deterministic (uses `Date.now`/`Math.random`), so the test asserts FORMAT (length 26, lowercase hex) and uniqueness across calls — never an exact value. The `console.log` from the original is dropped.

**Files:**
- Create: `src/domain/buyOrder.ts`
- Test: `src/domain/buyOrder.test.ts`

**Interfaces:**
- Consumes: Node built-in `crypto.createHash`.
- Produces: `export function generateBuyOrder(): string` — returns a 26-char lowercase-hex string.

**Steps:**

- [ ] Step: Write the failing test.
```ts
// src/domain/buyOrder.test.ts
import { describe, it, expect } from 'vitest';
import { generateBuyOrder } from './buyOrder';

describe('generateBuyOrder', () => {
  it('returns a 26-character string', () => {
    expect(generateBuyOrder()).toHaveLength(26);
  });
  it('returns only lowercase hex characters', () => {
    expect(generateBuyOrder()).toMatch(/^[0-9a-f]{26}$/);
  });
  it('returns different values across calls (non-deterministic)', () => {
    const a = generateBuyOrder();
    const b = generateBuyOrder();
    expect(a).not.toBe(b);
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/domain/buyOrder.test.ts`. Expected: `Failed to resolve import "./buyOrder"` — module missing.

- [ ] Step: Implement minimal code.
```ts
// src/domain/buyOrder.ts
// Ported from Purchase.generateBuyOrder (@BeforeCreate hook), ccemuc-api/src/models/purchase.model.ts.
import { createHash } from 'crypto';

export function generateBuyOrder(): string {
  const randomString = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  const rawBuyOrder = `${timestamp}${randomString}`;

  const hash = createHash('sha256').update(rawBuyOrder).digest('hex');

  return hash.substring(0, 26);
}
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/domain/buyOrder.test.ts`. Expected: `Test Files 1 passed (1)`, 3 assertions green.

- [ ] Step: Commit.
```
git add src/domain/buyOrder.ts src/domain/buyOrder.test.ts && git commit -m "feat: port buyOrder generator from Purchase @BeforeCreate hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 9: CourseType enum/const (`src/domain/courseType.ts`)

Port of `ccemuc-api/src/enums/course-type.enum.ts` (`{ CORE='core', ELECTIVE='elective', WORKSHOP='workshop' }`). Expose a `CourseType` const object with `core`/`elective`/`workshop` keys mapping to their string values (matching the canonical Prisma `enum CourseType { core elective workshop }`), a `CourseType` value-union type, and a `courseTypeValues` tuple for Zod's `z.enum`. A single source of truth so the Prisma enum, the Zod course schema (Task 12), and the core-course filter in the confirm-purchase action (later phase) all agree.

**Files:**
- Create: `src/domain/courseType.ts`
- Test: `src/domain/courseType.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const CourseType` — `{ core: 'core'; elective: 'elective'; workshop: 'workshop' }`.
  - `export type CourseType` — `'core' | 'elective' | 'workshop'`.
  - `export const courseTypeValues` — `readonly ['core', 'elective', 'workshop']` (for `z.enum`).

**Steps:**

- [ ] Step: Write the failing test.
```ts
// src/domain/courseType.test.ts
import { describe, it, expect } from 'vitest';
import { CourseType, courseTypeValues } from './courseType';

describe('CourseType', () => {
  it('maps each key to its lowercase string value', () => {
    expect(CourseType.core).toBe('core');
    expect(CourseType.elective).toBe('elective');
    expect(CourseType.workshop).toBe('workshop');
  });
  it('exposes the values as a tuple for z.enum', () => {
    expect(courseTypeValues).toEqual(['core', 'elective', 'workshop']);
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/domain/courseType.test.ts`. Expected: `Failed to resolve import "./courseType"` — module missing.

- [ ] Step: Implement minimal code.
```ts
// src/domain/courseType.ts
// Ported from ccemuc-api/src/enums/course-type.enum.ts.
// Values must stay in sync with prisma enum CourseType { core elective workshop }.
export const CourseType = {
  core: 'core',
  elective: 'elective',
  workshop: 'workshop',
} as const;

export type CourseType = (typeof CourseType)[keyof typeof CourseType];

export const courseTypeValues = ['core', 'elective', 'workshop'] as const;
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/domain/courseType.test.ts`. Expected: `Test Files 1 passed (1)`, 2 assertions green.

- [ ] Step: Commit.
```
git add src/domain/courseType.ts src/domain/courseType.test.ts && git commit -m "feat: add CourseType const/enum and z.enum value tuple

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 10: ActionResult convention (`src/domain/result.ts`)

The result convention every server action returns, replacing the old HTTP status/body pairs (201/200 → `ok()`; 409 → `fail(msg,409,field)`; 404 → `fail('... not found',404)`; 400/500 → `fail(msg,400/500)`). Implement EXACTLY the locked types and helpers. Test verifies the runtime shape and the default `status`.

**Files:**
- Create: `src/domain/result.ts`
- Test: `src/domain/result.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type ActionOk<T> = { ok: true; data: T }`
  - `export type ActionErr = { ok: false; error: string; field?: string; status: number }`
  - `export type ActionResult<T> = ActionOk<T> | ActionErr`
  - `export const ok = <T>(data: T): ActionOk<T>`
  - `export const fail = (error: string, status = 400, field?: string): ActionErr`

**Steps:**

- [ ] Step: Write the failing test.
```ts
// src/domain/result.test.ts
import { describe, it, expect } from 'vitest';
import { ok, fail } from './result';

describe('ok', () => {
  it('wraps data with ok:true', () => {
    expect(ok({ id: '1' })).toEqual({ ok: true, data: { id: '1' } });
  });
});

describe('fail', () => {
  it('defaults to status 400 and omits field', () => {
    const r = fail('bad input');
    expect(r).toEqual({ ok: false, error: 'bad input', status: 400 });
    expect(r.field).toBeUndefined();
  });
  it('carries an explicit status and field (409 conflict shape)', () => {
    expect(fail('email already in use', 409, 'email')).toEqual({
      ok: false,
      error: 'email already in use',
      status: 409,
      field: 'email',
    });
  });
  it('supports a 404 not-found shape', () => {
    expect(fail('User not found', 404)).toEqual({
      ok: false,
      error: 'User not found',
      status: 404,
    });
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/domain/result.test.ts`. Expected: `Failed to resolve import "./result"` — module missing.

- [ ] Step: Implement minimal code.
```ts
// src/domain/result.ts
export type ActionOk<T> = { ok: true; data: T };
export type ActionErr = { ok: false; error: string; field?: string; status: number };
export type ActionResult<T> = ActionOk<T> | ActionErr;

export const ok = <T>(data: T): ActionOk<T> => ({ ok: true, data });

export const fail = (error: string, status = 400, field?: string): ActionErr =>
  field === undefined
    ? { ok: false, error, status }
    : { ok: false, error, status, field };
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/domain/result.test.ts`. Expected: `Test Files 1 passed (1)`, 4 assertions green (including the `field` omission check).

- [ ] Step: Commit.
```
git add src/domain/result.ts src/domain/result.test.ts && git commit -m "feat: add ActionResult type with ok/fail helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 11: User & Enrollment Zod schemas (`src/schemas/user.ts`, `src/schemas/enrollment.ts`)

Zod schemas mirroring `UserAttributes` (`names`, `lastNames`, `rut`, `email`, `university`, `carrerYear:number`) and `EnrollmentAttributes` (`userId`, `courseId`, `purchaseId`). `userCreateSchema` enforces email format and runs the shared `isRut` from Task 7 via `.refine` on `rut` — when it fails, the refinement message is `isRut`'s `message` and the issue path is `['rut']`, so the action layer (later phase) can mirror the legacy 409 `{ error, field }` shape. `userUpdateSchema` is the create schema made `.partial()`. Enrollment IDs are validated as UUIDs (FKs are `@db.Uuid`). Export inferred input types consumed by the action signatures.

**Files:**
- Create: `src/schemas/user.ts`, `src/schemas/enrollment.ts`
- Test: `src/schemas/user.test.ts`, `src/schemas/enrollment.test.ts`

**Interfaces:**
- Consumes: `isRut` from `src/domain/rut.ts` (Task 7).
- Produces:
  - `src/schemas/user.ts`: `userCreateSchema`, `userUpdateSchema`, `export type UserCreateInput = z.infer<typeof userCreateSchema>`, `export type UserUpdateInput = z.infer<typeof userUpdateSchema>`.
  - `src/schemas/enrollment.ts`: `enrollmentCreateSchema`, `export type EnrollmentCreateInput = z.infer<typeof enrollmentCreateSchema>`.

**Steps:**

- [ ] Step: Write the failing tests.
```ts
// src/schemas/user.test.ts
import { describe, it, expect } from 'vitest';
import { userCreateSchema, userUpdateSchema } from './user';

const valid = {
  names: 'Ada',
  lastNames: 'Lovelace',
  rut: '12345678-5',
  email: 'ada@example.com',
  university: 'PUC',
  carrerYear: 3,
};

describe('userCreateSchema', () => {
  it('accepts a fully valid user', () => {
    expect(userCreateSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects a missing required field (names)', () => {
    const { names, ...rest } = valid;
    const r = userCreateSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['names']);
  });
  it('rejects a non-number carrerYear', () => {
    const r = userCreateSchema.safeParse({ ...valid, carrerYear: 'three' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['carrerYear']);
  });
  it('rejects a malformed email', () => {
    const r = userCreateSchema.safeParse({ ...valid, email: 'nope' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['email']);
  });
  it('rejects an invalid RUT via the shared validator, on the rut path', () => {
    const r = userCreateSchema.safeParse({ ...valid, rut: '12345678-9' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['rut']);
      expect(r.error.issues[0].message).toBe('Invalid DV. Expected: 5');
    }
  });
  it('rejects a RUT with dots, surfacing the validator message', () => {
    const r = userCreateSchema.safeParse({ ...valid, rut: '12.345.678-5' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe('RUT must not contain dots Format: XX.XXX.XXX-X');
    }
  });
});

describe('userUpdateSchema', () => {
  it('accepts a partial update', () => {
    expect(userUpdateSchema.safeParse({ university: 'UCH' }).success).toBe(true);
  });
  it('still validates a provided rut', () => {
    expect(userUpdateSchema.safeParse({ rut: '12345678-9' }).success).toBe(false);
  });
});
```
```ts
// src/schemas/enrollment.test.ts
import { describe, it, expect } from 'vitest';
import { enrollmentCreateSchema } from './enrollment';

const valid = {
  userId: '11111111-1111-1111-1111-111111111111',
  courseId: '22222222-2222-2222-2222-222222222222',
  purchaseId: '33333333-3333-3333-3333-333333333333',
};

describe('enrollmentCreateSchema', () => {
  it('accepts three valid uuids', () => {
    expect(enrollmentCreateSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects a missing courseId', () => {
    const { courseId, ...rest } = valid;
    const r = enrollmentCreateSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['courseId']);
  });
  it('rejects a non-uuid userId', () => {
    const r = enrollmentCreateSchema.safeParse({ ...valid, userId: 'abc' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['userId']);
  });
});
```

- [ ] Step: Run them, expect FAIL. Command: `npx vitest run src/schemas/user.test.ts src/schemas/enrollment.test.ts`. Expected: `Failed to resolve import "./user"` / `"./enrollment"` — modules missing.

- [ ] Step: Implement minimal code.
```ts
// src/schemas/user.ts
import { z } from 'zod';
import { isRut } from '../domain/rut';

// Mirrors ccemuc-api/src/interfaces/user.interfaces.ts (UserAttributes, minus id).
export const userCreateSchema = z.object({
  names: z.string().min(1),
  lastNames: z.string().min(1),
  rut: z.string().min(1).refine(
    (value) => isRut(value).status,
    (value) => ({ message: isRut(value).message }),
  ),
  email: z.string().email(),
  university: z.string().min(1),
  carrerYear: z.number().int(),
});

export const userUpdateSchema = userCreateSchema.partial();

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
```
```ts
// src/schemas/enrollment.ts
import { z } from 'zod';

// Mirrors ccemuc-api/src/interfaces/enrollment.interfaces.ts (EnrollmentAttributes, minus id).
export const enrollmentCreateSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  purchaseId: z.string().uuid(),
});

export type EnrollmentCreateInput = z.infer<typeof enrollmentCreateSchema>;
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/schemas/user.test.ts src/schemas/enrollment.test.ts`. Expected: `Test Files 2 passed (2)`, all assertions green — note the RUT refine surfaces `isRut`'s message on the `rut` path.

- [ ] Step: Commit.
```
git add src/schemas/user.ts src/schemas/user.test.ts src/schemas/enrollment.ts src/schemas/enrollment.test.ts && git commit -m "feat: add user and enrollment Zod schemas with shared RUT refine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 12: Course & Purchase Zod schemas (`src/schemas/course.ts`, `src/schemas/purchase.ts`)

Course schema mirrors `CourseAttributes` (`module:number`, `title`, `type:CourseType`, `price:number`, `capacity:number`, `week:number`, optional `features` JSON, optional `topics:string[]`) — `type` uses `z.enum(courseTypeValues)` from Task 9; the stale `description` field is NOT ported. `courseUpdateSchema` is `.partial()`. Purchase schemas: `purchaseCreateSchema` mirrors `PurchaseAttributes` (`userId` uuid, `coursesIds:string[]` of uuids — `buyOrder`/`isPaid` are server-generated, never client input), and `sendConfirmationSchema` carries only `purchaseId` + `email` (the action loads the purchase/courses and builds the email HTML server-side, so `subject`/`text` are no longer client input); `updatePurchaseSchema` validates the admin `updatePurchase` input (`isPaid?`, `buyOrder?`) instead of casting to `Prisma.PurchaseUpdateInput`. Export all inferred input types consumed by the action signatures.

**Files:**
- Create: `src/schemas/course.ts`, `src/schemas/purchase.ts`
- Test: `src/schemas/course.test.ts`, `src/schemas/purchase.test.ts`

**Interfaces:**
- Consumes: `courseTypeValues` from `src/domain/courseType.ts` (Task 9).
- Produces:
  - `src/schemas/course.ts`: `courseCreateSchema`, `courseUpdateSchema`, `export type CourseCreateInput`, `export type CourseUpdateInput`.
  - `src/schemas/purchase.ts`: `purchaseCreateSchema`, `sendConfirmationSchema`, `updatePurchaseSchema`, `export type PurchaseCreateInput`, `export type SendConfirmationInput`, `export type UpdatePurchaseInput`.

**Steps:**

- [ ] Step: Write the failing tests.
```ts
// src/schemas/course.test.ts
import { describe, it, expect } from 'vitest';
import { courseCreateSchema, courseUpdateSchema } from './course';

const valid = {
  title: 'Anatomía',
  module: 1,
  type: 'core',
  price: 15000,
  capacity: 40,
  week: 1,
  features: { duration: '4h' },
  topics: ['huesos', 'músculos'],
};

describe('courseCreateSchema', () => {
  it('accepts a full valid course', () => {
    expect(courseCreateSchema.safeParse(valid).success).toBe(true);
  });
  it('accepts a course without optional features/topics', () => {
    const { features, topics, ...rest } = valid;
    expect(courseCreateSchema.safeParse(rest).success).toBe(true);
  });
  it('rejects a missing required title', () => {
    const { title, ...rest } = valid;
    const r = courseCreateSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['title']);
  });
  it('rejects a non-number price', () => {
    const r = courseCreateSchema.safeParse({ ...valid, price: '15000' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['price']);
  });
  it('rejects an invalid course type', () => {
    const r = courseCreateSchema.safeParse({ ...valid, type: 'seminar' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['type']);
  });
});

describe('courseUpdateSchema', () => {
  it('accepts a partial update', () => {
    expect(courseUpdateSchema.safeParse({ capacity: 10 }).success).toBe(true);
  });
});
```
```ts
// src/schemas/purchase.test.ts
import { describe, it, expect } from 'vitest';
import { purchaseCreateSchema, sendConfirmationSchema, updatePurchaseSchema } from './purchase';

describe('purchaseCreateSchema', () => {
  const valid = {
    userId: '11111111-1111-1111-1111-111111111111',
    coursesIds: ['22222222-2222-2222-2222-222222222222'],
  };
  it('accepts a valid purchase', () => {
    expect(purchaseCreateSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects a missing userId', () => {
    const r = purchaseCreateSchema.safeParse({ coursesIds: valid.coursesIds });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['userId']);
  });
  it('rejects a non-uuid in coursesIds', () => {
    const r = purchaseCreateSchema.safeParse({ ...valid, coursesIds: ['nope'] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['coursesIds', 0]);
  });
  it('rejects an empty coursesIds array', () => {
    const r = purchaseCreateSchema.safeParse({ ...valid, coursesIds: [] });
    expect(r.success).toBe(false);
  });
});

describe('sendConfirmationSchema', () => {
  const valid = {
    purchaseId: '33333333-3333-3333-3333-333333333333',
    email: 'ada@example.com',
  };
  it('accepts a valid confirmation payload (purchaseId + email only)', () => {
    expect(sendConfirmationSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects a malformed email', () => {
    const r = sendConfirmationSchema.safeParse({ ...valid, email: 'nope' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['email']);
  });
  it('rejects a missing purchaseId', () => {
    const { purchaseId, ...rest } = valid;
    const r = sendConfirmationSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['purchaseId']);
  });
});

describe('updatePurchaseSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(updatePurchaseSchema.safeParse({}).success).toBe(true);
  });
  it('accepts isPaid + buyOrder', () => {
    expect(updatePurchaseSchema.safeParse({ isPaid: true, buyOrder: 'BO-1' }).success).toBe(true);
  });
  it('rejects a non-boolean isPaid', () => {
    const r = updatePurchaseSchema.safeParse({ isPaid: 'yes' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['isPaid']);
  });
});
```

- [ ] Step: Run them, expect FAIL. Command: `npx vitest run src/schemas/course.test.ts src/schemas/purchase.test.ts`. Expected: `Failed to resolve import "./course"` / `"./purchase"` — modules missing.

- [ ] Step: Implement minimal code.
```ts
// src/schemas/course.ts
import { z } from 'zod';
import { courseTypeValues } from '../domain/courseType';

// Mirrors ccemuc-api/src/interfaces/course.interfaces.ts (CourseAttributes, minus id).
// The stale `description` field is intentionally NOT ported.
export const courseCreateSchema = z.object({
  title: z.string().min(1),
  module: z.number().int(),
  type: z.enum(courseTypeValues),
  price: z.number().int(),
  capacity: z.number().int(),
  week: z.number().int(),
  features: z.record(z.string()).optional(),
  topics: z.array(z.string()).optional(),
});

export const courseUpdateSchema = courseCreateSchema.partial();

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
```
```ts
// src/schemas/purchase.ts
import { z } from 'zod';

// Mirrors ccemuc-api/src/interfaces/purchase.interface.ts (PurchaseAttributes, minus id).
// buyOrder and isPaid are server-generated, never client input.
export const purchaseCreateSchema = z.object({
  userId: z.string().uuid(),
  coursesIds: z.array(z.string().uuid()).min(1),
});

// Server-side confirmation: the action loads the purchase + courses and builds the
// email HTML itself, so the client only supplies the purchase id and recipient email.
export const sendConfirmationSchema = z.object({
  purchaseId: z.string().uuid(),
  email: z.string().email(),
});

// Fix 9: updatePurchase input validation (replaces casting to Prisma.PurchaseUpdateInput).
export const updatePurchaseSchema = z.object({
  isPaid: z.boolean().optional(),
  buyOrder: z.string().optional(),
});

export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;
export type SendConfirmationInput = z.infer<typeof sendConfirmationSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/schemas/course.test.ts src/schemas/purchase.test.ts`. Expected: `Test Files 2 passed (2)`, all assertions green.

- [ ] Step: Run the FULL Phase 2 suite to confirm no cross-module regression. Command: `npx vitest run src/domain src/schemas`. Expected: `Test Files 8 passed (8)` — rut, buyOrder, courseType, result, user, enrollment, course, purchase.

- [ ] Step: Commit.
```
git add src/schemas/course.ts src/schemas/course.test.ts src/schemas/purchase.ts src/schemas/purchase.test.ts && git commit -m "feat: add course and purchase Zod schemas with inferred input types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Core libraries (prisma / webpay / mailer / auth)

Port the payment-gateway and email machinery out of the monolithic `purchase.controller.ts` into three small, individually testable `src/lib/*` modules. The Koa controller hard-wired `Environment.Production` and rebuilt a `new WebpayPlus.Transaction(new Options(...))` in two places (`createWebPayTransaction` and `confirmWebPayToken`); we collapse that into one `getWebpayTransaction()` factory that is **env-switchable** (`WEBPAY_ENVIRONMENT=integration|production`), falling back to the SDK's `IntegrationCommerceCodes.WEBPAY_PLUS` / `IntegrationApiKeys.WEBPAY` defaults when integration creds are unset. We faithfully preserve the controller's `confirmWebPayToken` try/catch contract — returning `{ status: 'ERROR', error }` instead of throwing. The mailer ports `sendEmail` (Nodemailer SMTP from env) into `sendMail(to, subject, html)`. `auth.ts` ports the `authMiddleware`/`deleteAuthMiddleware` token comparison into a reusable `assertAdmin(secret)` that compares against `ADMIN_SECRET`. All three are pure-config wrappers with **no DB access**, so every test mocks `transbank-sdk` / `nodemailer` via `vi.mock` and runs offline. These modules are consumed by the purchase actions and the Webpay return Route Handler in later phases.

### Task 13: Webpay transaction factory — `getWebpayTransaction()` (env-switchable)

Build the single source of truth for constructing a configured `WebpayPlus.Transaction`. Replaces the controller's duplicated `new WebpayPlus.Transaction(new Options(COMMERCE_CODE, API_KEY_TB, Environment.Production))` and the constructor's `WebpayPlus.configureForProduction(...)`. When `WEBPAY_ENVIRONMENT=production`, use `Environment.Production` with `WEBPAY_COMMERCE_CODE` / `WEBPAY_API_KEY`; otherwise use `Environment.Integration`, defaulting the commerce code/api key to the SDK's `IntegrationCommerceCodes.WEBPAY_PLUS` / `IntegrationApiKeys.WEBPAY` when env is unset.

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/lib/webpay.ts`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/lib/webpay.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (leaf module). Depends only on `transbank-sdk` (`WebpayPlus`, `Options`, `Environment`, `IntegrationApiKeys`, `IntegrationCommerceCodes`).
- Produces: `getWebpayTransaction(): WebpayPlus.Transaction` — used by Task 14 (`createWebpayTransaction`, `commitWebpayTransaction`) within the same file.

Steps:

- [ ] Step: Write the failing test for `getWebpayTransaction()` env selection. Mock the whole SDK so we capture the `Options` constructor args and the chosen `Environment`, with no network.

```ts
// src/lib/webpay.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const optionsSpy = vi.fn();
const txInstance = { create: vi.fn(), commit: vi.fn() };
const txSpy = vi.fn(() => txInstance);

vi.mock('transbank-sdk', () => {
  class Options {
    constructor(public commerceCode: string, public apiKey: string, public environment: string) {
      optionsSpy(commerceCode, apiKey, environment);
    }
  }
  class Transaction {
    constructor(public options: Options) {
      txSpy(options);
    }
    create = txInstance.create;
    commit = txInstance.commit;
  }
  return {
    WebpayPlus: { Transaction },
    Options,
    Environment: { Production: 'PRODUCTION', Integration: 'INTEGRATION' },
    IntegrationApiKeys: { WEBPAY: 'int-api-key-default' },
    IntegrationCommerceCodes: { WEBPAY_PLUS: '597055555532' },
  };
});

describe('getWebpayTransaction', () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEBPAY_ENVIRONMENT;
    delete process.env.WEBPAY_COMMERCE_CODE;
    delete process.env.WEBPAY_API_KEY;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('uses Production env with provided commerce code + api key when WEBPAY_ENVIRONMENT=production', async () => {
    process.env.WEBPAY_ENVIRONMENT = 'production';
    process.env.WEBPAY_COMMERCE_CODE = 'prod-cc';
    process.env.WEBPAY_API_KEY = 'prod-key';
    const { getWebpayTransaction } = await import('./webpay');
    getWebpayTransaction();
    expect(optionsSpy).toHaveBeenCalledWith('prod-cc', 'prod-key', 'PRODUCTION');
  });

  it('uses Integration env and SDK integration defaults when WEBPAY_ENVIRONMENT unset and creds unset', async () => {
    const { getWebpayTransaction } = await import('./webpay');
    getWebpayTransaction();
    expect(optionsSpy).toHaveBeenCalledWith('597055555532', 'int-api-key-default', 'INTEGRATION');
  });

  it('uses Integration env with provided creds when WEBPAY_ENVIRONMENT=integration and creds set', async () => {
    process.env.WEBPAY_ENVIRONMENT = 'integration';
    process.env.WEBPAY_COMMERCE_CODE = 'int-cc';
    process.env.WEBPAY_API_KEY = 'int-key';
    const { getWebpayTransaction } = await import('./webpay');
    getWebpayTransaction();
    expect(optionsSpy).toHaveBeenCalledWith('int-cc', 'int-key', 'INTEGRATION');
  });

  it('returns a Transaction built from the Options', async () => {
    const { getWebpayTransaction } = await import('./webpay');
    const tx = getWebpayTransaction();
    expect(txSpy).toHaveBeenCalledOnce();
    expect(tx).toBe(txInstance);
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/webpay.test.ts -t "getWebpayTransaction"`. Expected failure: `Failed to resolve import "./webpay"` / `Cannot find module './webpay'` (file does not exist yet).

- [ ] Step: Implement `getWebpayTransaction()`. Each call returns a freshly-configured `WebpayPlus.Transaction` so per-request env is respected (serverless-safe, no module-load-time singleton like the old constructor).

```ts
// src/lib/webpay.ts
import {
  WebpayPlus,
  Options,
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
} from 'transbank-sdk';

/**
 * Build a configured WebpayPlus.Transaction from env.
 * WEBPAY_ENVIRONMENT=production -> Environment.Production with WEBPAY_COMMERCE_CODE / WEBPAY_API_KEY.
 * Otherwise -> Environment.Integration, defaulting to the SDK's integration test creds when unset.
 */
export function getWebpayTransaction(): WebpayPlus.Transaction {
  const isProduction = process.env.WEBPAY_ENVIRONMENT === 'production';

  const commerceCode = isProduction
    ? (process.env.WEBPAY_COMMERCE_CODE ?? '')
    : (process.env.WEBPAY_COMMERCE_CODE ?? IntegrationCommerceCodes.WEBPAY_PLUS);

  const apiKey = isProduction
    ? (process.env.WEBPAY_API_KEY ?? '')
    : (process.env.WEBPAY_API_KEY ?? IntegrationApiKeys.WEBPAY);

  const environment = isProduction ? Environment.Production : Environment.Integration;

  return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, environment));
}
```

- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/webpay.test.ts -t "getWebpayTransaction"`. Expected: `4 passed`.

- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add src/lib/webpay.ts src/lib/webpay.test.ts && git commit -m "feat: add env-switchable getWebpayTransaction factory" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 14: Webpay create + commit wrappers — `createWebpayTransaction` / `commitWebpayTransaction`

Port the controller's `createWebPayTransaction` (the `transaction.create(buyOrder, sessionId, amount, returnUrl)` call) and `confirmWebPayToken` (the `transaction.commit(token_ws)` call wrapped in a try/catch that returns `{ status: 'ERROR', error }` on throw). Both delegate to `getWebpayTransaction()` from Task 13. Note: the controller computed `totalAmount`/`returnUrl` inline from the DB; here those become caller-supplied params, so the lib stays DB-free and the purchase action (later phase) owns the price math.

**Files:**
- Modify: `/home/rodrigoogalde/Personal/CCemuc/app/src/lib/webpay.ts`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/lib/webpay.test.ts` (extend)

**Interfaces:**
- Consumes: `getWebpayTransaction(): WebpayPlus.Transaction` (Task 13).
- Produces:
  - `createWebpayTransaction(buyOrder: string, sessionId: string, amount: number, returnUrl: string): Promise<{ token: string; url: string }>` — used by `createPurchase` (purchases action phase).
  - `commitWebpayTransaction(tokenWs: string): Promise<{ status: string; [k: string]: unknown }>` — returns `{ status: 'ERROR', error }` on SDK throw — used by `confirmPurchase` and the `api/webpay/return` Route Handler.

Steps:

- [ ] Step: Write the failing tests for create + commit (append to the existing describe blocks). Reuse the same `transbank-sdk` mock from Task 13 (the `txInstance.create` / `txInstance.commit` spies). Add:

```ts
// src/lib/webpay.test.ts  (append below the getWebpayTransaction describe)

describe('createWebpayTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEBPAY_ENVIRONMENT;
  });

  it('forwards buyOrder, sessionId, amount, returnUrl to transaction.create and returns its response', async () => {
    txInstance.create.mockResolvedValueOnce({ token: 'tok-123', url: 'https://webpay/redirect' });
    const { createWebpayTransaction } = await import('./webpay');
    const res = await createWebpayTransaction('BO-1', 'user-1', 45000, 'https://app/return?purchaseId=p1');
    expect(txInstance.create).toHaveBeenCalledWith('BO-1', 'user-1', 45000, 'https://app/return?purchaseId=p1');
    expect(res).toEqual({ token: 'tok-123', url: 'https://webpay/redirect' });
  });
});

describe('commitWebpayTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEBPAY_ENVIRONMENT;
  });

  it('returns the committed transaction status on success', async () => {
    txInstance.commit.mockResolvedValueOnce({ status: 'AUTHORIZED', amount: 45000 });
    const { commitWebpayTransaction } = await import('./webpay');
    const res = await commitWebpayTransaction('tok-ws');
    expect(txInstance.commit).toHaveBeenCalledWith('tok-ws');
    expect(res).toEqual({ status: 'AUTHORIZED', amount: 45000 });
  });

  it('returns { status: "ERROR", error } when commit throws (no rethrow)', async () => {
    const boom = new Error('Transbank down');
    txInstance.commit.mockRejectedValueOnce(boom);
    const { commitWebpayTransaction } = await import('./webpay');
    const res = await commitWebpayTransaction('tok-ws');
    expect(res).toEqual({ status: 'ERROR', error: boom });
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/webpay.test.ts -t "createWebpayTransaction"` then `-t "commitWebpayTransaction"`. Expected failure: `createWebpayTransaction is not a function` / `commitWebpayTransaction is not a function` (not yet exported).

- [ ] Step: Implement both wrappers (append to `src/lib/webpay.ts`).

```ts
// src/lib/webpay.ts  (append)

/** Create a Webpay Plus transaction. Returns the gateway { token, url } to redirect the user. */
export async function createWebpayTransaction(
  buyOrder: string,
  sessionId: string,
  amount: number,
  returnUrl: string,
): Promise<{ token: string; url: string }> {
  const transaction = getWebpayTransaction();
  return transaction.create(buyOrder, sessionId, amount, returnUrl);
}

/**
 * Commit a Webpay Plus transaction by token.
 * Mirrors the legacy confirmWebPayToken contract: on SDK throw, resolve with
 * { status: 'ERROR', error } instead of rejecting, so callers branch on status.
 */
export async function commitWebpayTransaction(
  tokenWs: string,
): Promise<{ status: string; [k: string]: unknown }> {
  try {
    const transaction = getWebpayTransaction();
    return await transaction.commit(tokenWs);
  } catch (error) {
    return { status: 'ERROR', error };
  }
}
```

- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/webpay.test.ts`. Expected: all webpay tests pass (`6 passed` total across the file).

- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add src/lib/webpay.ts src/lib/webpay.test.ts && git commit -m "feat: add createWebpayTransaction and commitWebpayTransaction wrappers" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 15: Nodemailer mailer — `sendMail(to, subject, html)`

Port the controller's private `sendEmail`. The legacy code read `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_ADMIN`, `EMAIL_KEY`, `EMAIL_FROM`; per the locked ENV list we standardize to `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` (same SMTP shape, `secure: true`, HTML body). The transport is built per call (serverless-safe; no module-level connection).

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/lib/mailer.ts`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/lib/mailer.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (leaf module). Depends only on `nodemailer`.
- Produces: `sendMail(to: string, subject: string, html: string): Promise<void>` — consumed by `sendConfirmation` (purchases action phase).

Steps:

- [ ] Step: Write the failing test. Mock `nodemailer` so `createTransport` returns a fake transport with a `sendMail` spy; assert the transport config is read from env and `mailOptions` are correct, with no SMTP connection.

```ts
// src/lib/mailer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMailSpy = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
const createTransportSpy = vi.fn(() => ({ sendMail: sendMailSpy }));

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportSpy },
}));

describe('sendMail', () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_HOST = 'smtp.example.com';
    process.env.EMAIL_PORT = '465';
    process.env.EMAIL_USER = 'admin@example.com';
    process.env.EMAIL_PASS = 'secret';
    process.env.EMAIL_FROM = 'CCemuc <no-reply@example.com>';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('builds an SMTP transport from env (host, numeric port, secure, auth)', async () => {
    const { sendMail } = await import('./mailer');
    await sendMail('student@uc.cl', 'Confirmación', '<p>Hola</p>');
    expect(createTransportSpy).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'admin@example.com', pass: 'secret' },
    });
  });

  it('sends with from/to/subject and HTML body', async () => {
    const { sendMail } = await import('./mailer');
    await sendMail('student@uc.cl', 'Confirmación', '<p>Hola</p>');
    expect(sendMailSpy).toHaveBeenCalledWith({
      from: 'CCemuc <no-reply@example.com>',
      to: 'student@uc.cl',
      subject: 'Confirmación',
      html: '<p>Hola</p>',
    });
  });

  it('propagates transport errors', async () => {
    sendMailSpy.mockRejectedValueOnce(new Error('SMTP refused'));
    const { sendMail } = await import('./mailer');
    await expect(sendMail('x@y.cl', 's', '<p>h</p>')).rejects.toThrow('SMTP refused');
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/mailer.test.ts`. Expected failure: `Failed to resolve import "./mailer"` / `Cannot find module './mailer'`.

- [ ] Step: Implement `sendMail`.

```ts
// src/lib/mailer.ts
import nodemailer from 'nodemailer';

/** Send a transactional HTML email via SMTP configured from env. */
export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}
```

- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/mailer.test.ts`. Expected: `3 passed`.

- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add src/lib/mailer.ts src/lib/mailer.test.ts && git commit -m "feat: add nodemailer sendMail helper from env" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 16: Admin auth guard — `assertAdmin(secret)`

Port the Koa `authMiddleware` / `deleteAuthMiddleware` token check into a reusable, server-only guard. The legacy middleware compared a Bearer token against `AUTH_TOKEN` / `DELETE_AUTH_TOKEN` and returned `403 { error: 'Unauthorized' }`. Here, admin-gated actions call `assertAdmin(secret)` inside a `try/catch`; it compares the caller-supplied secret against `ADMIN_SECRET` (server-only env, never shipped to the client). It **throws** an `UnauthorizedError` on mismatch (and returns `void` on success), so every gated action wraps it as `try { assertAdmin(adminSecret) } catch { return fail('Unauthorized', 403) }`.

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/lib/auth.ts`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/lib/auth.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (leaf module — reads `process.env.ADMIN_SECRET`).
- Produces: `UnauthorizedError extends Error`; `assertAdmin(secret: string): void` (throws `UnauthorizedError` when `secret !== ADMIN_SECRET`). Consumed by every admin-gated action (`deleteUser`, `createCourse`, `updateCourse`, `deleteCourse`, admin enrollment/purchase ops), each calling it as `try { assertAdmin(adminSecret) } catch { return fail('Unauthorized', 403) }`.

Steps:

- [ ] Step: Write the failing test. No external deps to mock — this is a pure comparison against `process.env.ADMIN_SECRET`.

```ts
// src/lib/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('assertAdmin', () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    process.env.ADMIN_SECRET = 'top-secret';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('does not throw when the secret matches ADMIN_SECRET', async () => {
    const { assertAdmin } = await import('./auth');
    expect(() => assertAdmin(process.env.ADMIN_SECRET!)).not.toThrow();
  });

  it('throws UnauthorizedError when the secret does not match', async () => {
    const { assertAdmin, UnauthorizedError } = await import('./auth');
    expect(() => assertAdmin('wrong')).toThrow();
    expect(() => assertAdmin('wrong')).toThrow(UnauthorizedError);
  });

  it('throws for an empty secret', async () => {
    const { assertAdmin } = await import('./auth');
    expect(() => assertAdmin('')).toThrow();
  });

  it('throws when ADMIN_SECRET env is unset (never auth-by-default)', async () => {
    delete process.env.ADMIN_SECRET;
    const { assertAdmin } = await import('./auth');
    expect(() => assertAdmin('')).toThrow();
    expect(() => assertAdmin('anything')).toThrow();
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/auth.test.ts`. Expected failure: `Failed to resolve import "./auth"` / `Cannot find module './auth'`.

- [ ] Step: Implement `assertAdmin`. Guard against the unset-env footgun: if `ADMIN_SECRET` is missing, always deny (never allow `'' === ''`). It throws `UnauthorizedError` so callers map the throw to `fail('Unauthorized', 403)`.

```ts
// src/lib/auth.ts

/** Thrown by assertAdmin when the supplied secret does not match ADMIN_SECRET. */
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Server-side admin gate. Compares the caller-supplied secret against ADMIN_SECRET.
 * Returns void when authorized; throws UnauthorizedError otherwise.
 * ADMIN_SECRET is server-only and is never sent to the client.
 */
export function assertAdmin(secret: string): void {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || secret !== expected) {
    throw new UnauthorizedError('Unauthorized');
  }
}
```

- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/lib/auth.test.ts`. Expected: `4 passed`.

- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add src/lib/auth.ts src/lib/auth.test.ts && git commit -m "feat: add assertAdmin guard comparing ADMIN_SECRET" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

## Phase 4 — Server actions: Users

Port `ccemuc-api/src/controllers/user.controller.ts` to a single `'use server'` module at `src/actions/users.ts`, using the canonical `ActionResult<T>` convention instead of HTTP status/body. Each action is built TDD-first: tests mock the Prisma singleton (`src/lib/prisma.ts`) with `vi.mock` so no live DB is required, and assert each `ActionResult` branch (ok / 404 / 409+field / admin-gate).

Faithful behavior parity with the Koa controller:
- `createUser` — **find-or-return-existing by `rut`** (returns `ok(existing)`, mirroring the old `200`); otherwise Zod-validate, run the shared RUT validator, create; a Prisma unique-constraint violation (`P2002`) on `email` → `fail(..., 409, 'email')`, on `rut` → `fail(..., 409, 'rut')` (mirrors the old Sequelize `ValidationError` → `409 { error, field }`).
- `getUsers` — list all (`ok(User[])`).
- `getUserById` / `getUserByRut` — not found → `fail('User not found', 404)`.
- `updateUser` — not found → `404`; unique violation → `409` + field.
- `deleteUser` — **admin-gated** via `assertAdmin(adminSecret)`; not found → `404`; success → `ok(null)` (mirrors the old `204`).

These tasks CONSUME artifacts produced by earlier phases (exact signatures restated under each task's **Interfaces / Consumes**):
- `src/lib/prisma.ts` — `export const prisma: PrismaClient` (serverless-safe singleton).
- `src/domain/result.ts` — `ActionResult<T>`, `ok<T>(data)`, `fail(error, status?, field?)`.
- `src/domain/rut.ts` — `isRut(rut: string): { status: boolean; message: string }`.
- `src/lib/auth.ts` — `assertAdmin(secret: string): void` (throws when `secret !== ADMIN_SECRET`).
- `src/schemas/user.ts` — `userCreateSchema`, `userUpdateSchema`, `UserCreateInput`, `UserUpdateInput`.

Shared Prisma-mock setup used by every test in this phase (declared at the top of each spec file):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

beforeEach(() => {
  vi.clearAllMocks();
});
```

To simulate a Prisma unique-constraint failure, tests throw an object shaped like a `PrismaClientKnownRequestError`: `{ code: 'P2002', meta: { target: ['email'] } }`. The action narrows on `code === 'P2002'` + `meta.target` (do NOT import the Prisma error class at runtime — duck-type by `code`, so the mock stays dependency-free).

### Task 17: createUser — find-or-return-existing, Zod + RUT validation, 409 on duplicate

**Files:**
- Create: `src/actions/users.ts` (this task adds the `'use server'` header, the shared Prisma-error helper, and `createUser`)
- Test: `src/actions/users.test.ts`

**Interfaces:**
- Consumes:
  - `src/lib/prisma.ts` → `prisma.user.findUnique`, `prisma.user.create`
  - `src/domain/result.ts` → `ActionResult<T>`, `ok`, `fail`
  - `src/domain/rut.ts` → `isRut(rut: string): { status: boolean; message: string }`
  - `src/schemas/user.ts` → `userCreateSchema`, `UserCreateInput = z.infer<typeof userCreateSchema>`
- Produces:
  - `createUser(input: UserCreateInput): Promise<ActionResult<User>>`
  - `type User` (re-exported from `@prisma/client`) for use by frontend/later tasks
  - internal `prismaUniqueField(error: unknown): string | null` helper (reused by `updateUser` in Task 21)

Steps:

- [ ] Step: Write the failing test for `createUser`. Create `src/actions/users.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { createUser } from './users';

beforeEach(() => {
  vi.clearAllMocks();
});

const validInput = {
  names: 'Juan',
  lastNames: 'Pérez',
  rut: '11111111-1',
  email: 'juan@uc.cl',
  university: 'Universidad de Chile',
  carrerYear: 3,
};

describe('createUser', () => {
  it('returns the existing user (ok) when one with the same rut exists', async () => {
    const existing = { id: 'u1', ...validInput };
    (prisma.user.findUnique as any).mockResolvedValue(existing);

    const res = await createUser(validInput);

    expect(res).toEqual({ ok: true, data: existing });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { rut: validInput.rut } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates and returns the user (ok) when the rut is new', async () => {
    const created = { id: 'u2', ...validInput };
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue(created);

    const res = await createUser(validInput);

    expect(res).toEqual({ ok: true, data: created });
    expect(prisma.user.create).toHaveBeenCalledWith({ data: validInput });
  });

  it('fails 400 on Zod validation error (missing names) without hitting prisma', async () => {
    const res = await createUser({ ...validInput, names: '' });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.field).toBe('names');
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('fails 409 with field=email on a Prisma P2002 unique violation', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });

    const res = await createUser(validInput);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.field).toBe('email');
    }
  });

  it('fails 400 with field=rut when the RUT check digit is invalid', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await createUser({ ...validInput, rut: '11111111-9' });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.field).toBe('rut');
    }
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/actions/users.test.ts -t "createUser"`. Expected failure: module resolution / import error — `Failed to resolve import "./users"` (the file does not exist yet), or once the file is stubbed, `createUser is not a function`.

- [ ] Step: Implement minimal code. Create `src/actions/users.ts`:

```ts
'use server';

import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ok, fail, type ActionResult } from '@/domain/result';
import { isRut } from '@/domain/rut';
import { userCreateSchema, type UserCreateInput } from '@/schemas/user';

export type { User };

/**
 * Inspect an unknown error for a Prisma unique-constraint violation (P2002).
 * Returns the offending field name (from meta.target) or null if it is not a
 * P2002 error. Duck-typed by `code` so this module does not import the Prisma
 * error class at runtime (keeps tests dependency-free).
 */
function prismaUniqueField(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  ) {
    const meta = (error as { meta?: { target?: unknown } }).meta;
    const target = meta?.target;
    if (Array.isArray(target) && typeof target[0] === 'string') return target[0];
    if (typeof target === 'string') return target;
  }
  return null;
}

export async function createUser(input: UserCreateInput): Promise<ActionResult<User>> {
  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, 400, issue.path[0]?.toString());
  }
  const data = parsed.data;

  const rutCheck = isRut(data.rut);
  if (!rutCheck.status) {
    return fail(rutCheck.message, 400, 'rut');
  }

  // Find-or-return-existing by rut (mirrors the old controller's 200 branch).
  const existing = await prisma.user.findUnique({ where: { rut: data.rut } });
  if (existing) {
    return ok(existing);
  }

  try {
    const user = await prisma.user.create({ data });
    return ok(user);
  } catch (error) {
    const field = prismaUniqueField(error);
    if (field) {
      return fail(`${field} must be unique`, 409, field);
    }
    return fail((error as Error).message ?? 'Failed to create user', 400);
  }
}
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/actions/users.test.ts -t "createUser"`. Expected: `5 passed`.

- [ ] Step: Commit. `git add src/actions/users.ts src/actions/users.test.ts && git commit -m "feat: add createUser server action with find-or-return, Zod + RUT validation" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 18: getUsers — list all

**Files:**
- Modify: `src/actions/users.ts` (add `getUsers`)
- Test: `src/actions/users.test.ts` (add `describe('getUsers')`)

**Interfaces:**
- Consumes:
  - `src/lib/prisma.ts` → `prisma.user.findMany`
  - `src/domain/result.ts` → `ok`, `ActionResult<T>`
- Produces:
  - `getUsers(): Promise<ActionResult<User[]>>`

Steps:

- [ ] Step: Write the failing test. Append to `src/actions/users.test.ts` (add `getUsers` to the import line first: `import { createUser, getUsers } from './users';`):

```ts
describe('getUsers', () => {
  it('returns all users (ok)', async () => {
    const users = [
      { id: 'u1', names: 'A' },
      { id: 'u2', names: 'B' },
    ];
    (prisma.user.findMany as any).mockResolvedValue(users);

    const res = await getUsers();

    expect(res).toEqual({ ok: true, data: users });
    expect(prisma.user.findMany).toHaveBeenCalledWith();
  });

  it('returns an empty list (ok) when there are no users', async () => {
    (prisma.user.findMany as any).mockResolvedValue([]);

    const res = await getUsers();

    expect(res).toEqual({ ok: true, data: [] });
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/actions/users.test.ts -t "getUsers"`. Expected failure: `getUsers is not a function` / import resolution error for `getUsers`.

- [ ] Step: Implement minimal code. Append to `src/actions/users.ts`:

```ts
export async function getUsers(): Promise<ActionResult<User[]>> {
  const users = await prisma.user.findMany();
  return ok(users);
}
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/actions/users.test.ts -t "getUsers"`. Expected: `2 passed`.

- [ ] Step: Commit. `git add src/actions/users.ts src/actions/users.test.ts && git commit -m "feat: add getUsers server action" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 19: getUserById — read by id, 404 when missing

**Files:**
- Modify: `src/actions/users.ts` (add `getUserById`)
- Test: `src/actions/users.test.ts` (add `describe('getUserById')`)

**Interfaces:**
- Consumes:
  - `src/lib/prisma.ts` → `prisma.user.findUnique`
  - `src/domain/result.ts` → `ok`, `fail`, `ActionResult<T>`
- Produces:
  - `getUserById(id: string): Promise<ActionResult<User>>`

Steps:

- [ ] Step: Write the failing test. Update the import line to `import { createUser, getUsers, getUserById } from './users';` and append:

```ts
describe('getUserById', () => {
  it('returns the user (ok) when found', async () => {
    const user = { id: 'u1', names: 'Juan' };
    (prisma.user.findUnique as any).mockResolvedValue(user);

    const res = await getUserById('u1');

    expect(res).toEqual({ ok: true, data: user });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('fails 404 when the user does not exist', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await getUserById('missing');

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(404);
      expect(res.error).toBe('User not found');
    }
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/actions/users.test.ts -t "getUserById"`. Expected failure: `getUserById is not a function` / import resolution error.

- [ ] Step: Implement minimal code. Append to `src/actions/users.ts`:

```ts
export async function getUserById(id: string): Promise<ActionResult<User>> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return fail('User not found', 404);
  return ok(user);
}
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/actions/users.test.ts -t "getUserById"`. Expected: `2 passed`.

- [ ] Step: Commit. `git add src/actions/users.ts src/actions/users.test.ts && git commit -m "feat: add getUserById server action with 404 branch" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 20: getUserByRut — read by RUT, 404 when missing

**Files:**
- Modify: `src/actions/users.ts` (add `getUserByRut`)
- Test: `src/actions/users.test.ts` (add `describe('getUserByRut')`)

**Interfaces:**
- Consumes:
  - `src/lib/prisma.ts` → `prisma.user.findUnique`
  - `src/domain/result.ts` → `ok`, `fail`, `ActionResult<T>`
- Produces:
  - `getUserByRut(rut: string): Promise<ActionResult<User>>`

Steps:

- [ ] Step: Write the failing test. Update the import line to `import { createUser, getUsers, getUserById, getUserByRut } from './users';` and append:

```ts
describe('getUserByRut', () => {
  it('returns the user (ok) when found by rut', async () => {
    const user = { id: 'u1', rut: '11111111-1' };
    (prisma.user.findUnique as any).mockResolvedValue(user);

    const res = await getUserByRut('11111111-1');

    expect(res).toEqual({ ok: true, data: user });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { rut: '11111111-1' } });
  });

  it('fails 404 when no user has that rut', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await getUserByRut('99999999-9');

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(404);
      expect(res.error).toBe('User not found');
    }
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/actions/users.test.ts -t "getUserByRut"`. Expected failure: `getUserByRut is not a function` / import resolution error.

- [ ] Step: Implement minimal code. Append to `src/actions/users.ts`:

```ts
export async function getUserByRut(rut: string): Promise<ActionResult<User>> {
  const user = await prisma.user.findUnique({ where: { rut } });
  if (!user) return fail('User not found', 404);
  return ok(user);
}
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/actions/users.test.ts -t "getUserByRut"`. Expected: `2 passed`.

- [ ] Step: Commit. `git add src/actions/users.ts src/actions/users.test.ts && git commit -m "feat: add getUserByRut server action with 404 branch" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 21: updateUser — Zod-validated update, 404 + 409 branches

**Files:**
- Modify: `src/actions/users.ts` (add `updateUser`)
- Test: `src/actions/users.test.ts` (add `describe('updateUser')`)

**Interfaces:**
- Consumes:
  - `src/lib/prisma.ts` → `prisma.user.update`
  - `src/domain/result.ts` → `ok`, `fail`, `ActionResult<T>`
  - `src/schemas/user.ts` → `userUpdateSchema`, `UserUpdateInput = z.infer<typeof userUpdateSchema>`
  - internal `prismaUniqueField` helper from Task 17
- Produces:
  - `updateUser(id: string, input: UserUpdateInput): Promise<ActionResult<User>>`

Notes on parity: the old controller did `User.update(data,{where:{id}})` then re-fetched, returning `404` when zero rows matched. With Prisma we use `prisma.user.update`, which throws `P2025` ("record not found") when the id is missing — narrow on `code === 'P2025'` → `fail('User not found', 404)`. Unique-constraint collisions on update (`P2002`) → `fail(..., 409, field)` (reuses `prismaUniqueField`). If the partial update includes a `rut`, re-run `isRut` first (mirrors the model validator firing on update).

Steps:

- [ ] Step: Write the failing test. Update the import line to `import { createUser, getUsers, getUserById, getUserByRut, updateUser } from './users';` and append:

```ts
describe('updateUser', () => {
  it('updates and returns the user (ok)', async () => {
    const updated = { id: 'u1', names: 'Nuevo', email: 'new@uc.cl' };
    (prisma.user.update as any).mockResolvedValue(updated);

    const res = await updateUser('u1', { names: 'Nuevo' });

    expect(res).toEqual({ ok: true, data: updated });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { names: 'Nuevo' },
    });
  });

  it('fails 404 when the id does not exist (Prisma P2025)', async () => {
    (prisma.user.update as any).mockRejectedValue({ code: 'P2025' });

    const res = await updateUser('missing', { names: 'X' });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(404);
      expect(res.error).toBe('User not found');
    }
  });

  it('fails 409 with field=email on a unique violation', async () => {
    (prisma.user.update as any).mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });

    const res = await updateUser('u1', { email: 'dup@uc.cl' });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.field).toBe('email');
    }
  });

  it('fails 400 with field=rut when an updated rut is invalid, without hitting prisma', async () => {
    const res = await updateUser('u1', { rut: '11111111-9' });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.field).toBe('rut');
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/actions/users.test.ts -t "updateUser"`. Expected failure: `updateUser is not a function` / import resolution error.

- [ ] Step: Implement minimal code. Add the `userUpdateSchema`/`UserUpdateInput` import to the existing schema import line at the top of `src/actions/users.ts`:

```ts
import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateInput,
  type UserUpdateInput,
} from '@/schemas/user';
```

Then append the action:

```ts
export async function updateUser(
  id: string,
  input: UserUpdateInput,
): Promise<ActionResult<User>> {
  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, 400, issue.path[0]?.toString());
  }
  const data = parsed.data;

  if (typeof data.rut === 'string') {
    const rutCheck = isRut(data.rut);
    if (!rutCheck.status) {
      return fail(rutCheck.message, 400, 'rut');
    }
  }

  try {
    const user = await prisma.user.update({ where: { id }, data });
    return ok(user);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return fail('User not found', 404);
    }
    const field = prismaUniqueField(error);
    if (field) {
      return fail(`${field} must be unique`, 409, field);
    }
    return fail((error as Error).message ?? 'Failed to update user', 400);
  }
}
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/actions/users.test.ts -t "updateUser"`. Expected: `4 passed`.

- [ ] Step: Commit. `git add src/actions/users.ts src/actions/users.test.ts && git commit -m "feat: add updateUser server action with 404/409 branches" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 22: deleteUser — admin-gated delete, 404 branch

**Files:**
- Modify: `src/actions/users.ts` (add `deleteUser`)
- Test: `src/actions/users.test.ts` (add `describe('deleteUser')`)

**Interfaces:**
- Consumes:
  - `src/lib/prisma.ts` → `prisma.user.delete`
  - `src/lib/auth.ts` → `assertAdmin(secret: string): void` (throws when `secret !== ADMIN_SECRET`)
  - `src/domain/result.ts` → `ok`, `fail`, `ActionResult<T>`
- Produces:
  - `deleteUser(id: string, adminSecret: string): Promise<ActionResult<null>>`

Notes on parity: the old controller returned `204` on success — here `ok(null)`. Prisma's `delete` throws `P2025` for a missing id → `fail('User not found', 404)`. The admin gate is enforced **inside the action** by `assertAdmin`, which throws when the secret is wrong; we catch that throw and return `fail('Unauthorized', 403)` so the secret never leaks and the result shape stays uniform. The test mocks `@/lib/auth` so `ADMIN_SECRET` need not be set in the test env.

Steps:

- [ ] Step: Write the failing test. Add an auth mock near the top of `src/actions/users.test.ts` (below the prisma `vi.mock`, before the imports):

```ts
vi.mock('@/lib/auth', () => ({
  assertAdmin: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
```

Update the import line to `import { createUser, getUsers, getUserById, getUserByRut, updateUser, deleteUser } from './users';`, add `import { assertAdmin, UnauthorizedError } from '@/lib/auth';`, and append:

```ts
describe('deleteUser', () => {
  it('deletes the user (ok with null) after asserting admin', async () => {
    (assertAdmin as any).mockReturnValue(undefined);
    (prisma.user.delete as any).mockResolvedValue({ id: 'u1' });

    const res = await deleteUser('u1', 'secret');

    expect(res).toEqual({ ok: true, data: null });
    expect(assertAdmin).toHaveBeenCalledWith('secret');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('fails 403 and never touches prisma when assertAdmin throws', async () => {
    vi.mocked(assertAdmin).mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });

    const res = await deleteUser('u1', 'wrong');

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.error).toBe('Unauthorized');
    }
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('fails 404 when the id does not exist (Prisma P2025)', async () => {
    (assertAdmin as any).mockReturnValue(undefined);
    (prisma.user.delete as any).mockRejectedValue({ code: 'P2025' });

    const res = await deleteUser('missing', 'secret');

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(404);
      expect(res.error).toBe('User not found');
    }
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/actions/users.test.ts -t "deleteUser"`. Expected failure: `deleteUser is not a function` / import resolution error.

- [ ] Step: Implement minimal code. Add the auth import to the top of `src/actions/users.ts`:

```ts
import { assertAdmin } from '@/lib/auth';
```

Then append the action:

```ts
export async function deleteUser(
  id: string,
  adminSecret: string,
): Promise<ActionResult<null>> {
  try {
    assertAdmin(adminSecret);
  } catch {
    return fail('Unauthorized', 403);
  }

  try {
    await prisma.user.delete({ where: { id } });
    return ok(null);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return fail('User not found', 404);
    }
    return fail((error as Error).message ?? 'Failed to delete user', 400);
  }
}
```

- [ ] Step: Run the FULL user-actions suite, expect PASS (confirms no regression across all six actions). Command: `npx vitest run src/actions/users.test.ts`. Expected: all `describe` blocks green — `createUser` (5), `getUsers` (2), `getUserById` (2), `getUserByRut` (2), `updateUser` (4), `deleteUser` (3) → `18 passed`.

- [ ] Step: Commit. `git add src/actions/users.ts src/actions/users.test.ts && git commit -m "feat: add deleteUser admin-gated server action with 404 branch" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

## Phase 5 — Server actions: Courses & Enrollments

Port `ccemuc-api/src/controllers/course.controller.ts` to `src/actions/courses.ts`. Reads (`getCourses`, `getCourseById`) stay public; mutations (`createCourse`, `updateCourse`, `deleteCourse`) are admin-gated via `assertAdmin(adminSecret)` (replacing the old `authMiddleware`/`deleteAuthMiddleware` bearer tokens). (Deliberate divergence from legacy, where all PUTs were open: `updateCourse`/`updateEnrollment`/`updatePurchase` are admin-gated per the canonical signatures, while `updateUser` deliberately stays open so the public registration/preload flow can update a user without a secret.) All inputs are Zod-validated and all returns use the `ActionResult<T>` convention. The stale `description` field is NOT ported; `topics: string[]` and `features: Json?` are. Tests mock `@/lib/prisma` and `@/lib/auth` with `vi.mock` so no live DB is touched.

### Task 23: Course actions (create/get/getById/update/delete, admin-gated mutations)

**Files:**
- Create: `src/actions/courses.ts`
- Create (test): `src/actions/courses.test.ts`
- Consumes existing: `src/lib/prisma.ts` (Phase 1), `src/lib/auth.ts` (Phase 2), `src/domain/result.ts` (Phase 1), `src/schemas/course.ts` (Phase 3).

**Interfaces:**
- Consumes:
  - `prisma` (named export from `@/lib/prisma`) — Prisma singleton; uses `prisma.course.{create,findMany,findUnique,update,delete}`.
  - `assertAdmin(secret: string): void` from `@/lib/auth` — throws when secret mismatches `ADMIN_SECRET`.
  - `ActionResult<T>`, `ok<T>(data): ActionOk<T>`, `fail(error, status?, field?): ActionErr` from `@/domain/result`.
  - `courseCreateSchema`, `courseUpdateSchema`, `CourseCreateInput`, `CourseUpdateInput` from `@/schemas/course`.
  - Prisma-generated `Course` type from `@prisma/client`.
- Produces (later phases / frontend rely on these EXACT signatures):
  - `createCourse(input: CourseCreateInput, adminSecret: string): Promise<ActionResult<Course>>`
  - `getCourses(): Promise<ActionResult<Course[]>>`
  - `getCourseById(id: string): Promise<ActionResult<Course>>`
  - `updateCourse(id: string, input: CourseUpdateInput, adminSecret: string): Promise<ActionResult<Course>>`
  - `deleteCourse(id: string, adminSecret: string): Promise<ActionResult<null>>`

Steps:

- [ ] Step: Write the failing test. Create `src/actions/courses.test.ts` with mocks for `@/lib/prisma` and `@/lib/auth`, covering: admin gate on mutations, Zod 400+field on bad create input, find-all/find-by-id (incl. 404), update (incl. 404), delete (incl. 404), and the generic 500 path.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Prisma singleton — no live DB.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    course: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock the admin gate so we control allow/deny per test.
vi.mock('@/lib/auth', () => ({
  assertAdmin: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import { prisma } from '@/lib/prisma';
import { assertAdmin, UnauthorizedError } from '@/lib/auth';
import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} from './courses';

const mockPrisma = prisma as unknown as {
  course: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};
const mockAssertAdmin = assertAdmin as unknown as ReturnType<typeof vi.fn>;

const validCourse = {
  title: 'Cirugía I',
  module: 1,
  type: 'core' as const,
  price: 15000,
  capacity: 30,
  week: 1,
  features: { modality: 'online' },
  topics: ['Asepsia', 'Suturas'],
};

const dbCourse = { id: 'c-1', ...validCourse, createdAt: new Date(), updatedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  mockAssertAdmin.mockReturnValue(undefined); // default: allowed
});

describe('createCourse', () => {
  it('rejects when admin secret is invalid', async () => {
    mockAssertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await createCourse(validCourse, 'wrong');
    expect(res).toEqual({ ok: false, error: 'Unauthorized', status: 403 });
    expect(mockPrisma.course.create).not.toHaveBeenCalled();
  });

  it('creates and returns a course on valid input', async () => {
    mockPrisma.course.create.mockResolvedValue(dbCourse);
    const res = await createCourse(validCourse, 'right');
    expect(mockAssertAdmin).toHaveBeenCalledWith('right');
    expect(mockPrisma.course.create).toHaveBeenCalledWith({ data: validCourse });
    expect(res).toEqual({ ok: true, data: dbCourse });
  });

  it('returns 400 with field on invalid Zod input', async () => {
    const res = await createCourse({ ...validCourse, price: -1 }, 'right');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.field).toBe('price');
    }
    expect(mockPrisma.course.create).not.toHaveBeenCalled();
  });

  it('returns 400 when prisma throws', async () => {
    mockPrisma.course.create.mockRejectedValue(new Error('db down'));
    const res = await createCourse(validCourse, 'right');
    expect(res).toEqual({ ok: false, error: 'db down', status: 400 });
  });
});

describe('getCourses', () => {
  it('returns all courses', async () => {
    mockPrisma.course.findMany.mockResolvedValue([dbCourse]);
    const res = await getCourses();
    expect(res).toEqual({ ok: true, data: [dbCourse] });
  });

  it('returns 500 when prisma throws', async () => {
    mockPrisma.course.findMany.mockRejectedValue(new Error('boom'));
    const res = await getCourses();
    expect(res).toEqual({ ok: false, error: 'boom', status: 500 });
  });
});

describe('getCourseById', () => {
  it('returns the course when found', async () => {
    mockPrisma.course.findUnique.mockResolvedValue(dbCourse);
    const res = await getCourseById('c-1');
    expect(mockPrisma.course.findUnique).toHaveBeenCalledWith({ where: { id: 'c-1' } });
    expect(res).toEqual({ ok: true, data: dbCourse });
  });

  it('returns 404 when not found', async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);
    const res = await getCourseById('nope');
    expect(res).toEqual({ ok: false, error: 'Course not found', status: 404 });
  });
});

describe('updateCourse', () => {
  it('rejects when admin secret is invalid', async () => {
    mockAssertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await updateCourse('c-1', { price: 20000 }, 'wrong');
    expect(res).toEqual({ ok: false, error: 'Unauthorized', status: 403 });
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
  });

  it('updates and returns the course', async () => {
    const updated = { ...dbCourse, price: 20000 };
    mockPrisma.course.update.mockResolvedValue(updated);
    const res = await updateCourse('c-1', { price: 20000 }, 'right');
    expect(mockPrisma.course.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { price: 20000 },
    });
    expect(res).toEqual({ ok: true, data: updated });
  });

  it('returns 404 when the course does not exist', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' });
    mockPrisma.course.update.mockRejectedValue(err);
    const res = await updateCourse('nope', { price: 1 }, 'right');
    expect(res).toEqual({ ok: false, error: 'Course not found', status: 404 });
  });
});

describe('deleteCourse', () => {
  it('rejects when admin secret is invalid', async () => {
    mockAssertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await deleteCourse('c-1', 'wrong');
    expect(res).toEqual({ ok: false, error: 'Unauthorized', status: 403 });
    expect(mockPrisma.course.delete).not.toHaveBeenCalled();
  });

  it('deletes and returns null data', async () => {
    mockPrisma.course.delete.mockResolvedValue(dbCourse);
    const res = await deleteCourse('c-1', 'right');
    expect(mockPrisma.course.delete).toHaveBeenCalledWith({ where: { id: 'c-1' } });
    expect(res).toEqual({ ok: true, data: null });
  });

  it('returns 404 when the course does not exist', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' });
    mockPrisma.course.delete.mockRejectedValue(err);
    const res = await deleteCourse('nope', 'right');
    expect(res).toEqual({ ok: false, error: 'Course not found', status: 404 });
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/actions/courses.test.ts`. Expected failure: `Failed to resolve import "./courses"` (the action file does not exist yet) / "No test files found for module" resolution error.

- [ ] Step: Implement minimal code. Create `src/actions/courses.ts`. The admin gate maps a thrown error to `fail(msg, 403)`; Zod failures map to `fail(firstIssue.message, 400, firstIssue.path[0])` (uniform: Zod validation errors are 400; 409 is reserved strictly for Prisma unique-constraint violations); Prisma `P2025` (record-to-update/delete not found) maps to a 404, matching the controller's `if (updated)` / `if (deleted)` not-found branches. Reads use 500 on throw and 404 on null, exactly as `course.controller.ts`.

```ts
'use server';

import { prisma } from '@/lib/prisma';
import { assertAdmin, UnauthorizedError } from '@/lib/auth';
import { ActionResult, ok, fail } from '@/domain/result';
import {
  courseCreateSchema,
  courseUpdateSchema,
  type CourseCreateInput,
  type CourseUpdateInput,
} from '@/schemas/course';
import type { Course } from '@prisma/client';

// Re-export the Prisma Course type so consumers (e.g. /form, inscription components)
// can `import type { Course } from '@/actions/courses'`.
export type { Course } from '@prisma/client';

function isPrismaNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

export async function createCourse(
  input: CourseCreateInput,
  adminSecret: string,
): Promise<ActionResult<Course>> {
  try {
    assertAdmin(adminSecret);
  } catch {
    return fail('Unauthorized', 403);
  }

  const parsed = courseCreateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, 400, issue.path[0] as string | undefined);
  }

  try {
    const course = await prisma.course.create({ data: parsed.data });
    return ok(course);
  } catch (error) {
    return fail((error as Error).message, 400);
  }
}

export async function getCourses(): Promise<ActionResult<Course[]>> {
  try {
    const courses = await prisma.course.findMany();
    return ok(courses);
  } catch (error) {
    return fail((error as Error).message, 500);
  }
}

export async function getCourseById(id: string): Promise<ActionResult<Course>> {
  try {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return fail('Course not found', 404);
    return ok(course);
  } catch (error) {
    return fail((error as Error).message, 500);
  }
}

export async function updateCourse(
  id: string,
  input: CourseUpdateInput,
  adminSecret: string,
): Promise<ActionResult<Course>> {
  try {
    assertAdmin(adminSecret);
  } catch {
    return fail('Unauthorized', 403);
  }

  const parsed = courseUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, 400, issue.path[0] as string | undefined);
  }

  try {
    const course = await prisma.course.update({ where: { id }, data: parsed.data });
    return ok(course);
  } catch (error) {
    if (isPrismaNotFound(error)) return fail('Course not found', 404);
    return fail((error as Error).message, 500);
  }
}

export async function deleteCourse(
  id: string,
  adminSecret: string,
): Promise<ActionResult<null>> {
  try {
    assertAdmin(adminSecret);
  } catch {
    return fail('Unauthorized', 403);
  }

  try {
    await prisma.course.delete({ where: { id } });
    return ok(null);
  } catch (error) {
    if (isPrismaNotFound(error)) return fail('Course not found', 404);
    return fail((error as Error).message, 500);
  }
}
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/actions/courses.test.ts`. Expected output: all course tests green (e.g. `Test Files 1 passed`, `Tests 14 passed`).

- [ ] Step: Commit. `git add src/actions/courses.ts src/actions/courses.test.ts && git commit -m "feat: add course server actions (admin-gated CRUD, Zod validation)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

## Phase 5 (cont.) — Server actions: Enrollments

Port `ccemuc-api/src/controllers/enrollment.controller.ts` to `src/actions/enrollments.ts`. `createEnrollment` is public and find-or-returns the existing row by `(userId, courseId)` — honoring the `@@unique([userId, courseId])` constraint exactly as the original `findOne` then `build/save`. Mutations (`updateEnrollment`, `deleteEnrollment`) are admin-gated; reads (`getEnrollments`, `getEnrollmentById`) are public. A unique-constraint race (Prisma `P2002`) maps to the old `ValidationError` 409+`field` shape. Tests mock `@/lib/prisma` and `@/lib/auth`.

### Task 24: Enrollment actions (find-or-return create, get/getById, admin-gated update/delete)

**Files:**
- Create: `src/actions/enrollments.ts`
- Create (test): `src/actions/enrollments.test.ts`
- Consumes existing: `src/lib/prisma.ts` (Phase 1), `src/lib/auth.ts` (Phase 2), `src/domain/result.ts` (Phase 1), `src/schemas/enrollment.ts` (Phase 3).

**Interfaces:**
- Consumes:
  - `prisma` from `@/lib/prisma` — uses `prisma.enrollment.{findUnique,findMany,create,update,delete}`.
  - `assertAdmin(secret: string): void` from `@/lib/auth`.
  - `ActionResult<T>`, `ok`, `fail` from `@/domain/result`.
  - `enrollmentCreateSchema`, `EnrollmentCreateInput` from `@/schemas/enrollment`.
  - Prisma-generated `Enrollment` type from `@prisma/client`.
- Produces (frontend / purchase-confirm flow rely on these EXACT signatures):
  - `createEnrollment(input: EnrollmentCreateInput): Promise<ActionResult<Enrollment>>` (find-or-return existing by `(userId, courseId)`)
  - `getEnrollments(): Promise<ActionResult<Enrollment[]>>`
  - `getEnrollmentById(id: string): Promise<ActionResult<Enrollment>>`
  - `updateEnrollment(id: string, input: EnrollmentCreateInput, adminSecret: string): Promise<ActionResult<Enrollment>>`
  - `deleteEnrollment(id: string, adminSecret: string): Promise<ActionResult<null>>`

Steps:

- [ ] Step: Write the failing test. Create `src/actions/enrollments.test.ts` mocking `@/lib/prisma` and `@/lib/auth`, covering: find-or-return existing (`findUnique` hit -> returns existing, no `create`), create-new path, Zod 400+field on bad input, `P2002` unique-race -> 409+field, admin gate on update/delete, 404 on update/delete of a missing row, and read 404/500 paths.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  assertAdmin: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import { prisma } from '@/lib/prisma';
import { assertAdmin, UnauthorizedError } from '@/lib/auth';
import {
  createEnrollment,
  getEnrollments,
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollment,
} from './enrollments';

const mockPrisma = prisma as unknown as {
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};
const mockAssertAdmin = assertAdmin as unknown as ReturnType<typeof vi.fn>;

const validInput = { userId: 'u-1', courseId: 'c-1', purchaseId: 'p-1' };
const dbEnrollment = { id: 'e-1', ...validInput };

beforeEach(() => {
  vi.clearAllMocks();
  mockAssertAdmin.mockReturnValue(undefined);
});

describe('createEnrollment', () => {
  it('returns the existing enrollment without creating (find-or-return)', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(dbEnrollment);
    const res = await createEnrollment(validInput);
    expect(mockPrisma.enrollment.findUnique).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: 'u-1', courseId: 'c-1' } },
    });
    expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, data: dbEnrollment });
  });

  it('creates a new enrollment when none exists', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    mockPrisma.enrollment.create.mockResolvedValue(dbEnrollment);
    const res = await createEnrollment(validInput);
    expect(mockPrisma.enrollment.create).toHaveBeenCalledWith({ data: validInput });
    expect(res).toEqual({ ok: true, data: dbEnrollment });
  });

  it('returns 400 with field on invalid Zod input', async () => {
    const res = await createEnrollment({ ...validInput, userId: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.field).toBe('userId');
    }
    expect(mockPrisma.enrollment.findUnique).not.toHaveBeenCalled();
  });

  it('maps a P2002 unique-constraint race to 409 with field', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const err = Object.assign(new Error('unique'), {
      code: 'P2002',
      meta: { target: ['userId', 'courseId'] },
    });
    mockPrisma.enrollment.create.mockRejectedValue(err);
    const res = await createEnrollment(validInput);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.field).toBe('userId');
    }
  });

  it('returns 400 on a generic prisma error', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    mockPrisma.enrollment.create.mockRejectedValue(new Error('db down'));
    const res = await createEnrollment(validInput);
    expect(res).toEqual({ ok: false, error: 'db down', status: 400 });
  });
});

describe('getEnrollments', () => {
  it('returns all enrollments', async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([dbEnrollment]);
    const res = await getEnrollments();
    expect(res).toEqual({ ok: true, data: [dbEnrollment] });
  });

  it('returns 500 when prisma throws', async () => {
    mockPrisma.enrollment.findMany.mockRejectedValue(new Error('boom'));
    const res = await getEnrollments();
    expect(res).toEqual({ ok: false, error: 'boom', status: 500 });
  });
});

describe('getEnrollmentById', () => {
  it('returns the enrollment when found', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(dbEnrollment);
    const res = await getEnrollmentById('e-1');
    expect(mockPrisma.enrollment.findUnique).toHaveBeenCalledWith({ where: { id: 'e-1' } });
    expect(res).toEqual({ ok: true, data: dbEnrollment });
  });

  it('returns 404 when not found', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const res = await getEnrollmentById('nope');
    expect(res).toEqual({ ok: false, error: 'Enrollment not found', status: 404 });
  });
});

describe('updateEnrollment', () => {
  it('rejects when admin secret is invalid', async () => {
    mockAssertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await updateEnrollment('e-1', validInput, 'wrong');
    expect(res).toEqual({ ok: false, error: 'Unauthorized', status: 403 });
    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });

  it('updates and returns the enrollment', async () => {
    const updated = { ...dbEnrollment, purchaseId: 'p-2' };
    mockPrisma.enrollment.update.mockResolvedValue(updated);
    const res = await updateEnrollment('e-1', { ...validInput, purchaseId: 'p-2' }, 'right');
    expect(mockPrisma.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'e-1' },
      data: { ...validInput, purchaseId: 'p-2' },
    });
    expect(res).toEqual({ ok: true, data: updated });
  });

  it('returns 404 when the enrollment does not exist', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' });
    mockPrisma.enrollment.update.mockRejectedValue(err);
    const res = await updateEnrollment('nope', validInput, 'right');
    expect(res).toEqual({ ok: false, error: 'Enrollment not found', status: 404 });
  });
});

describe('deleteEnrollment', () => {
  it('rejects when admin secret is invalid', async () => {
    mockAssertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await deleteEnrollment('e-1', 'wrong');
    expect(res).toEqual({ ok: false, error: 'Unauthorized', status: 403 });
    expect(mockPrisma.enrollment.delete).not.toHaveBeenCalled();
  });

  it('deletes and returns null data', async () => {
    mockPrisma.enrollment.delete.mockResolvedValue(dbEnrollment);
    const res = await deleteEnrollment('e-1', 'right');
    expect(mockPrisma.enrollment.delete).toHaveBeenCalledWith({ where: { id: 'e-1' } });
    expect(res).toEqual({ ok: true, data: null });
  });

  it('returns 404 when the enrollment does not exist', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' });
    mockPrisma.enrollment.delete.mockRejectedValue(err);
    const res = await deleteEnrollment('nope', 'right');
    expect(res).toEqual({ ok: false, error: 'Enrollment not found', status: 404 });
  });
});
```

- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/actions/enrollments.test.ts`. Expected failure: `Failed to resolve import "./enrollments"` (the action file does not exist yet).

- [ ] Step: Implement minimal code. Create `src/actions/enrollments.ts`. `createEnrollment` queries by the Prisma compound-unique selector `userId_courseId` (the named `@@unique([userId, courseId])` — the old `findOne({ where: { userId, courseId } })`) and returns the existing row before creating, exactly like the controller. A `P2002` on create reproduces the old `ValidationError` 409+`field` branch (first `meta.target` column as `field`); other create errors map to 400. `P2025` on update/delete reproduces the controller's not-found branch (404).

```ts
'use server';

import { prisma } from '@/lib/prisma';
import { assertAdmin, UnauthorizedError } from '@/lib/auth';
import { ActionResult, ok, fail } from '@/domain/result';
import {
  enrollmentCreateSchema,
  type EnrollmentCreateInput,
} from '@/schemas/enrollment';
import type { Enrollment } from '@prisma/client';

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code?: unknown }).code as string | undefined;
  }
  return undefined;
}

function uniqueTargetField(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'meta' in error) {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    if (Array.isArray(target) && typeof target[0] === 'string') return target[0];
  }
  return undefined;
}

export async function createEnrollment(
  input: EnrollmentCreateInput,
): Promise<ActionResult<Enrollment>> {
  const parsed = enrollmentCreateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, 400, issue.path[0] as string | undefined);
  }

  const { userId, courseId } = parsed.data;
  try {
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return ok(existing);

    const enrollment = await prisma.enrollment.create({ data: parsed.data });
    return ok(enrollment);
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      return fail((error as Error).message, 409, uniqueTargetField(error));
    }
    return fail((error as Error).message, 400);
  }
}

export async function getEnrollments(): Promise<ActionResult<Enrollment[]>> {
  try {
    const enrollments = await prisma.enrollment.findMany();
    return ok(enrollments);
  } catch (error) {
    return fail((error as Error).message, 500);
  }
}

export async function getEnrollmentById(id: string): Promise<ActionResult<Enrollment>> {
  try {
    const enrollment = await prisma.enrollment.findUnique({ where: { id } });
    if (!enrollment) return fail('Enrollment not found', 404);
    return ok(enrollment);
  } catch (error) {
    return fail((error as Error).message, 500);
  }
}

export async function updateEnrollment(
  id: string,
  input: EnrollmentCreateInput,
  adminSecret: string,
): Promise<ActionResult<Enrollment>> {
  try {
    assertAdmin(adminSecret);
  } catch {
    return fail('Unauthorized', 403);
  }

  const parsed = enrollmentCreateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, 400, issue.path[0] as string | undefined);
  }

  try {
    const enrollment = await prisma.enrollment.update({
      where: { id },
      data: parsed.data,
    });
    return ok(enrollment);
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return fail('Enrollment not found', 404);
    return fail((error as Error).message, 500);
  }
}

export async function deleteEnrollment(
  id: string,
  adminSecret: string,
): Promise<ActionResult<null>> {
  try {
    assertAdmin(adminSecret);
  } catch {
    return fail('Unauthorized', 403);
  }

  try {
    await prisma.enrollment.delete({ where: { id } });
    return ok(null);
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return fail('Enrollment not found', 404);
    return fail((error as Error).message, 500);
  }
}
```

- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/actions/enrollments.test.ts`. Expected output: all enrollment tests green (e.g. `Test Files 1 passed`, `Tests 15 passed`).

- [ ] Step: Commit. `git add src/actions/enrollments.ts src/actions/enrollments.test.ts && git commit -m "feat: add enrollment server actions (find-or-return create, admin-gated update/delete)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

## Phase 6 — Server actions: Purchases + Webpay return route

This phase ports `ccemuc-api/src/controllers/purchase.controller.ts` to a single `'use server'` module, replacing the Koa REST endpoints with the canonical server-action signatures. It keeps full parity with the original flow (validate courses exist + have capacity, create-or-retrieve an unpaid purchase by `(userId, coursesIds)`, generate the `buyOrder`, sum prices, open a Webpay transaction with a return URL pointing at the Route Handler in Phase 6 (cont.)) while baking in the two locked improvements: (1) `confirmPurchase` runs the "mark paid → create enrollments (purchased + all core) → decrement capacity" sequence inside a **single `prisma.$transaction`** with a real **oversell guard** (conditional decrement; fail the whole transaction if a course is full), and (2) idempotency on `isPaid`. All actions return `ActionResult<T>`; admin reads/mutations are gated by `assertAdmin`. Every action Zod-validates its input. Prisma, Webpay, and nodemailer are mocked in tests so nothing touches a live DB or gateway.

> Coverage note: the legacy `purchase.controller.statusToken` (GET `/purchases/statusToken/:token`) is intentionally folded into `confirmPurchase` (the commit + status branch) and is NOT ported as a separate action.

### Task 25: createPurchase — validate, create-or-retrieve, open Webpay transaction

**Files:**
- Create: `app/src/actions/purchases.ts`
- Test: `app/src/actions/purchases.create.test.ts`

**Interfaces:**
- Consumes (from earlier tasks):
  - `src/lib/prisma.ts` → `prisma` (PrismaClient singleton; `prisma.course.findMany`, `prisma.purchase.findFirst`, `prisma.purchase.create`)
  - `src/lib/webpay.ts` → `createWebpayTransaction(buyOrder: string, sessionId: string, amount: number, returnUrl: string): Promise<{ token: string; url: string }>`
  - `src/domain/buyOrder.ts` → `generateBuyOrder(): string`
  - `src/domain/result.ts` → `ActionResult<T>`, `ok`, `fail`
  - `src/schemas/purchase.ts` → `purchaseCreateSchema`, `PurchaseCreateInput`
- Produces (later tasks rely on):
  - `createPurchase(input: PurchaseCreateInput): Promise<ActionResult<{ purchase: Purchase; webPayResponse?: { token: string; url: string } }>>`
  - module file `src/actions/purchases.ts` that subsequent tasks extend with the read/admin/confirm/email actions

Steps:

- [ ] Step: Write the failing test for `createPurchase`. Create `app/src/actions/purchases.create.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  course: { findMany: vi.fn() },
  purchase: { findFirst: vi.fn(), create: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const createWebpayTransaction = vi.fn();
vi.mock('@/lib/webpay', () => ({ createWebpayTransaction }));

vi.mock('@/domain/buyOrder', () => ({ generateBuyOrder: () => 'BUYORDER0000000000000000AB' }));

import { createPurchase } from './purchases';

const USER = '11111111-1111-1111-1111-111111111111';
const C1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const C2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WEBPAY_RETURN_URL = 'https://ccemuc.cl/api/webpay/return';
});

describe('createPurchase', () => {
  it('fails validation when coursesIds is empty', async () => {
    const res = await createPurchase({ userId: USER, coursesIds: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.field).toBe('coursesIds');
    }
    expect(prismaMock.course.findMany).not.toHaveBeenCalled();
  });

  it('fails with 400 when one or more courses do not exist', async () => {
    prismaMock.course.findMany.mockResolvedValue([{ id: C1, price: 1000, capacity: 10 }]);
    const res = await createPurchase({ userId: USER, coursesIds: [C1, C2] });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('One or more courses not found');
      expect(res.status).toBe(400);
    }
    expect(createWebpayTransaction).not.toHaveBeenCalled();
  });

  it('fails with 400 when one or more courses are full', async () => {
    prismaMock.course.findMany.mockResolvedValue([
      { id: C1, price: 1000, capacity: 10 },
      { id: C2, price: 2000, capacity: 0 },
    ]);
    const res = await createPurchase({ userId: USER, coursesIds: [C1, C2] });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('One or more courses are full');
      expect(res.status).toBe(400);
    }
  });

  it('creates a new purchase, sums prices, and opens a webpay transaction', async () => {
    prismaMock.course.findMany.mockResolvedValue([
      { id: C1, price: 1000, capacity: 10 },
      { id: C2, price: 2000, capacity: 5 },
    ]);
    prismaMock.purchase.findFirst.mockResolvedValue(null);
    const created = { id: 'pur-1', userId: USER, buyOrder: 'BUYORDER0000000000000000AB', isPaid: false, coursesIds: [C1, C2] };
    prismaMock.purchase.create.mockResolvedValue(created);
    createWebpayTransaction.mockResolvedValue({ token: 'tok-123', url: 'https://webpay/redirect' });

    const res = await createPurchase({ userId: USER, coursesIds: [C1, C2] });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.purchase).toEqual(created);
      expect(res.data.webPayResponse).toEqual({ token: 'tok-123', url: 'https://webpay/redirect' });
    }
    expect(prismaMock.purchase.create).toHaveBeenCalledWith({
      data: { userId: USER, coursesIds: [C1, C2], buyOrder: 'BUYORDER0000000000000000AB' },
    });
    expect(createWebpayTransaction).toHaveBeenCalledWith(
      'BUYORDER0000000000000000AB',
      USER,
      3000,
      'https://ccemuc.cl/api/webpay/return?purchaseId=pur-1',
    );
  });

  it('retrieves an existing unpaid purchase instead of creating a new one', async () => {
    prismaMock.course.findMany.mockResolvedValue([{ id: C1, price: 1000, capacity: 10 }]);
    const existing = { id: 'pur-9', userId: USER, buyOrder: 'OLD', isPaid: false, coursesIds: [C1] };
    prismaMock.purchase.findFirst.mockResolvedValue(existing);
    createWebpayTransaction.mockResolvedValue({ token: 'tok-9', url: 'https://webpay/9' });

    const res = await createPurchase({ userId: USER, coursesIds: [C1] });

    expect(prismaMock.purchase.create).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.purchase).toEqual(existing);
  });

  it('returns only the purchase (no webPayResponse) when it is already paid', async () => {
    prismaMock.course.findMany.mockResolvedValue([{ id: C1, price: 1000, capacity: 10 }]);
    const existing = { id: 'pur-paid', userId: USER, buyOrder: 'OLD', isPaid: true, coursesIds: [C1] };
    prismaMock.purchase.findFirst.mockResolvedValue(existing);

    const res = await createPurchase({ userId: USER, coursesIds: [C1] });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.purchase).toEqual(existing);
      expect(res.data.webPayResponse).toBeUndefined();
    }
    expect(createWebpayTransaction).not.toHaveBeenCalled();
  });
});
```

- [ ] Step: Run it, expect FAIL. `cd app && npx vitest run src/actions/purchases.create.test.ts`. Expected failure: `Failed to resolve import "./purchases"` / `No "createPurchase" export is defined` (the module does not exist yet).

- [ ] Step: Implement `createPurchase` (minimal, complete). Create `app/src/actions/purchases.ts`:

```ts
'use server';

import type { Prisma, Purchase } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createWebpayTransaction } from '@/lib/webpay';
import { generateBuyOrder } from '@/domain/buyOrder';
import { type ActionResult, ok, fail } from '@/domain/result';
import { purchaseCreateSchema, type PurchaseCreateInput } from '@/schemas/purchase';

function returnUrlFor(purchaseId: string): string {
  const base =
    process.env.WEBPAY_RETURN_URL ??
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/webpay/return`;
  return `${base}?purchaseId=${purchaseId}`;
}

export async function createPurchase(
  input: PurchaseCreateInput,
): Promise<ActionResult<{ purchase: Purchase; webPayResponse?: { token: string; url: string } }>> {
  const parsed = purchaseCreateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, 400, issue.path[0]?.toString());
  }
  const { userId, coursesIds } = parsed.data;

  // Validate all courses exist + have capacity (port of validatePurchase).
  const courses = await prisma.course.findMany({ where: { id: { in: coursesIds } } });
  if (courses.length !== coursesIds.length) {
    return fail('One or more courses not found', 400);
  }
  if (courses.some((c) => c.capacity <= 0)) {
    return fail('One or more courses are full', 400);
  }

  // Create-or-retrieve an unpaid purchase by (userId, coursesIds).
  let purchase = await prisma.purchase.findFirst({ where: { userId, coursesIds: { equals: coursesIds } } });
  if (!purchase) {
    purchase = await prisma.purchase.create({
      data: { userId, coursesIds, buyOrder: generateBuyOrder() },
    });
  }

  if (purchase.isPaid) {
    return ok({ purchase });
  }

  const totalAmount = courses.reduce((sum, c) => sum + c.price, 0);
  const webPayResponse = await createWebpayTransaction(
    purchase.buyOrder ?? generateBuyOrder(),
    purchase.userId,
    totalAmount,
    returnUrlFor(purchase.id),
  );

  return ok({ purchase, webPayResponse });
}

// Re-exported Prisma type alias used by later tasks in this module.
export type { Prisma, Purchase };
```

- [ ] Step: Run tests, expect PASS. `cd app && npx vitest run src/actions/purchases.create.test.ts`. Expected: `6 passed`.

- [ ] Step: Commit. `cd app && git add src/actions/purchases.ts src/actions/purchases.create.test.ts && git commit -m "feat: add createPurchase server action with course validation and webpay" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 26: Purchase reads + admin CRUD (getPurchases, getPurchaseById, getUserPurchases, updatePurchase, deletePurchase)

**Files:**
- Modify: `app/src/actions/purchases.ts`
- Test: `app/src/actions/purchases.crud.test.ts`

**Interfaces:**
- Consumes:
  - `src/lib/prisma.ts` → `prisma.purchase.findMany`, `prisma.purchase.findUnique`, `prisma.purchase.update`, `prisma.purchase.delete`
  - `src/lib/auth.ts` → `assertAdmin(secret: string): void` (throws on bad secret)
  - `src/domain/result.ts` → `ActionResult`, `ok`, `fail`
- Produces:
  - `getPurchases(adminSecret: string): Promise<ActionResult<Purchase[]>>`
  - `getPurchaseById(id: string): Promise<ActionResult<Purchase>>`
  - `getUserPurchases(userId: string): Promise<ActionResult<Purchase[]>>`
  - `updatePurchase(id: string, input: UpdatePurchaseInput, adminSecret: string): Promise<ActionResult<Purchase>>`
  - `deletePurchase(id: string, adminSecret: string): Promise<ActionResult<null>>`

Steps:

- [ ] Step: Write the failing test. Create `app/src/actions/purchases.crud.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  purchase: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const assertAdmin = vi.fn();
class UnauthorizedError extends Error {}
vi.mock('@/lib/auth', () => ({
  assertAdmin: (s: string) => assertAdmin(s),
  UnauthorizedError,
}));

import {
  getPurchases,
  getPurchaseById,
  getUserPurchases,
  updatePurchase,
  deletePurchase,
} from './purchases';

beforeEach(() => {
  vi.clearAllMocks();
  assertAdmin.mockReset();
});

describe('getPurchases (admin)', () => {
  it('rejects when admin secret is invalid', async () => {
    assertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await getPurchases('wrong');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
    expect(prismaMock.purchase.findMany).not.toHaveBeenCalled();
  });

  it('returns all purchases for a valid admin secret', async () => {
    const rows = [{ id: 'p1' }, { id: 'p2' }];
    prismaMock.purchase.findMany.mockResolvedValue(rows);
    const res = await getPurchases('right');
    expect(assertAdmin).toHaveBeenCalledWith('right');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual(rows);
  });
});

describe('getPurchaseById', () => {
  it('returns 404 when not found', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue(null);
    const res = await getPurchaseById('nope');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Purchase not found');
      expect(res.status).toBe(404);
    }
  });

  it('returns the purchase when found', async () => {
    const row = { id: 'p1' };
    prismaMock.purchase.findUnique.mockResolvedValue(row);
    const res = await getPurchaseById('p1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual(row);
  });
});

describe('getUserPurchases', () => {
  it('returns the user purchases', async () => {
    const rows = [{ id: 'p1', userId: 'u1' }];
    prismaMock.purchase.findMany.mockResolvedValue(rows);
    const res = await getUserPurchases('u1');
    expect(prismaMock.purchase.findMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual(rows);
  });
});

describe('updatePurchase (admin)', () => {
  it('rejects when admin secret invalid', async () => {
    assertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await updatePurchase('p1', { isPaid: true }, 'wrong');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
    expect(prismaMock.purchase.update).not.toHaveBeenCalled();
  });

  it('updates and returns the purchase', async () => {
    const row = { id: 'p1', isPaid: true };
    prismaMock.purchase.update.mockResolvedValue(row);
    const res = await updatePurchase('p1', { isPaid: true }, 'right');
    expect(prismaMock.purchase.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isPaid: true } });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual(row);
  });
});

describe('deletePurchase (admin)', () => {
  it('deletes and returns ok(null)', async () => {
    prismaMock.purchase.delete.mockResolvedValue({ id: 'p1' });
    const res = await deletePurchase('p1', 'right');
    expect(prismaMock.purchase.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toBeNull();
  });
});
```

- [ ] Step: Run it, expect FAIL. `cd app && npx vitest run src/actions/purchases.crud.test.ts`. Expected failure: `No "getPurchases" export is defined in module './purchases'` (and the other four exports).

- [ ] Step: Implement the read + admin CRUD actions. Append to `app/src/actions/purchases.ts` (add the `assertAdmin` import to the existing import block at the top, then append the functions):

Add these imports near the other imports at the top of the file:

```ts
import { assertAdmin } from '@/lib/auth';
import { updatePurchaseSchema, type UpdatePurchaseInput } from '@/schemas/purchase';
```

Append these functions at the end of `app/src/actions/purchases.ts`:

```ts
export async function getPurchases(adminSecret: string): Promise<ActionResult<Purchase[]>> {
  try {
    assertAdmin(adminSecret);
  } catch {
    return fail('Unauthorized', 403);
  }
  const purchases = await prisma.purchase.findMany();
  return ok(purchases);
}

export async function getPurchaseById(id: string): Promise<ActionResult<Purchase>> {
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) return fail('Purchase not found', 404);
  return ok(purchase);
}

export async function getUserPurchases(userId: string): Promise<ActionResult<Purchase[]>> {
  const purchases = await prisma.purchase.findMany({ where: { userId } });
  return ok(purchases);
}

export async function updatePurchase(
  id: string,
  input: UpdatePurchaseInput,
  adminSecret: string,
): Promise<ActionResult<Purchase>> {
  try {
    assertAdmin(adminSecret);
  } catch {
    return fail('Unauthorized', 403);
  }
  // Fix 9: validate the input with updatePurchaseSchema instead of casting.
  const parsed = updatePurchaseSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, 400, issue.path[0]?.toString());
  }
  try {
    const purchase = await prisma.purchase.update({
      where: { id },
      data: parsed.data,
    });
    return ok(purchase);
  } catch {
    return fail('Purchase not found', 404);
  }
}

export async function deletePurchase(id: string, adminSecret: string): Promise<ActionResult<null>> {
  try {
    assertAdmin(adminSecret);
  } catch {
    return fail('Unauthorized', 403);
  }
  try {
    await prisma.purchase.delete({ where: { id } });
    return ok(null);
  } catch {
    return fail('Purchase not found', 404);
  }
}
```

- [ ] Step: Run tests, expect PASS. `cd app && npx vitest run src/actions/purchases.crud.test.ts`. Expected: `9 passed`.

- [ ] Step: Commit. `cd app && git add src/actions/purchases.ts src/actions/purchases.crud.test.ts && git commit -m "feat: add purchase reads and admin CRUD server actions" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 27: confirmPurchase — atomic mark-paid + enroll (purchased + core) + capacity decrement with oversell guard

**Files:**
- Modify: `app/src/actions/purchases.ts`
- Test: `app/src/actions/purchases.confirm.test.ts`

**Interfaces:**
- Consumes:
  - `src/lib/prisma.ts` → `prisma.purchase.findUnique`, `prisma.$transaction(fn)`, and inside the transaction tx-scoped `tx.purchase.update`, `tx.course.findMany`, `tx.enrollment.findUnique`, `tx.enrollment.create`, `tx.course.updateMany`
  - `src/lib/webpay.ts` → `commitWebpayTransaction(tokenWs: string): Promise<{ status: string; [k: string]: unknown }>`
  - `src/domain/courseType.ts` → `CourseType` (`{ core, elective, workshop }`)
  - `src/domain/result.ts` → `ActionResult`, `ok`, `fail`
- Produces:
  - `confirmPurchase(purchaseId: string, tokenWs: string): Promise<ActionResult<{ purchase: Purchase; transactionStatus: unknown }>>`

This is the atomicity + oversell improvement. The original controller ran `changeIsPaidToTrue`, then `createEnrollments` (which looped enrollment-create + `updateCourseCapacity`) as separate sequential awaits with no transaction. Here the whole side-effect block runs in one `prisma.$transaction`. The oversell window is closed by decrementing capacity with a conditional `updateMany({ where: { id, capacity: { gt: 0 } }, data: { capacity: { decrement: 1 } } })` and asserting it affected one row — if it affected zero (course full under concurrency) we throw, which rolls back the entire transaction.

- [ ] Step: Write the failing test. Create `app/src/actions/purchases.confirm.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  purchase: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const commitWebpayTransaction = vi.fn();
vi.mock('@/lib/webpay', () => ({ commitWebpayTransaction }));

import { confirmPurchase } from './purchases';

const USER = 'u-1';
const PURCHASED = 'course-elective';
const CORE = 'course-core';

// Build a fake tx client whose enrollment.findUnique returns null (no existing)
// and whose course.updateMany reports 1 row affected (capacity available).
function makeTx(overrides: any = {}) {
  return {
    purchase: { update: vi.fn().mockResolvedValue({ id: 'p1', userId: USER, isPaid: true, coursesIds: [PURCHASED] }) },
    course: {
      findMany: vi.fn().mockResolvedValue([{ id: CORE }]), // core courses
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    enrollment: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'e1' }),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('confirmPurchase', () => {
  it('returns 404 when the purchase does not exist', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue(null);
    const res = await confirmPurchase('missing', 'tok');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('La compra no fue encontrada');
      expect(res.status).toBe(404);
    }
    expect(commitWebpayTransaction).not.toHaveBeenCalled();
  });

  it('returns 402 when the webpay commit errors', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: USER, isPaid: false, coursesIds: [PURCHASED] });
    commitWebpayTransaction.mockResolvedValue({ status: 'ERROR', error: 'boom' });
    const res = await confirmPurchase('p1', 'tok');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(402);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('is idempotent: returns ok WITHOUT committing or a transaction when already paid', async () => {
    const paid = { id: 'p1', userId: USER, isPaid: true, coursesIds: [PURCHASED] };
    prismaMock.purchase.findUnique.mockResolvedValue(paid);
    const res = await confirmPurchase('p1', 'tok');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.purchase).toEqual(paid);
      // Fix 7: a paid purchase short-circuits BEFORE commit, with a synthesized AUTHORIZED status.
      expect(res.data.transactionStatus).toEqual({ status: 'AUTHORIZED' });
    }
    expect(commitWebpayTransaction).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns 400 when the transaction status is not AUTHORIZED', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: USER, isPaid: false, coursesIds: [PURCHASED] });
    commitWebpayTransaction.mockResolvedValue({ status: 'FAILED' });
    const res = await confirmPurchase('p1', 'tok');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Transacción no autorizada');
      expect(res.status).toBe(400);
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('on AUTHORIZED runs ONE transaction: marks paid, enrolls purchased+core, decrements capacity', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: USER, isPaid: false, coursesIds: [PURCHASED] });
    commitWebpayTransaction.mockResolvedValue({ status: 'AUTHORIZED', amount: 1000 });

    const tx = makeTx();
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const res = await confirmPurchase('p1', 'tok');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.purchase.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isPaid: true } });
    // Enrolled in BOTH the purchased course and the core course.
    expect(tx.enrollment.create).toHaveBeenCalledTimes(2);
    const enrolledCourseIds = tx.enrollment.create.mock.calls.map((c: any[]) => c[0].data.courseId).sort();
    expect(enrolledCourseIds).toEqual([CORE, PURCHASED].sort());
    // Capacity decremented with the oversell guard (capacity > 0) for each new enrollment.
    expect(tx.course.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.course.updateMany).toHaveBeenCalledWith({
      where: { id: PURCHASED, capacity: { gt: 0 } },
      data: { capacity: { decrement: 1 } },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.transactionStatus).toEqual({ status: 'AUTHORIZED', amount: 1000 });
  });

  it('skips enrollment + capacity decrement when an enrollment already exists', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: USER, isPaid: false, coursesIds: [PURCHASED] });
    commitWebpayTransaction.mockResolvedValue({ status: 'AUTHORIZED' });

    const tx = makeTx({
      course: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      enrollment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'existing' }),
        create: vi.fn(),
      },
    });
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const res = await confirmPurchase('p1', 'tok');

    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.course.updateMany).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it('rolls back (fails) when a PURCHASED course is full at decrement time (oversell guard)', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: USER, isPaid: false, coursesIds: [PURCHASED] });
    commitWebpayTransaction.mockResolvedValue({ status: 'AUTHORIZED' });

    const tx = makeTx({
      course: {
        findMany: vi.fn().mockResolvedValue([]), // no core courses for this case
        updateMany: vi.fn().mockResolvedValue({ count: 0 }), // purchased course full -> 0 rows affected
      },
    });
    // $transaction propagates the thrown error (real Prisma would roll back).
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const res = await confirmPurchase('p1', 'tok');

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it('does NOT block confirmation when only a CORE course is full (core decrement never throws)', async () => {
    // Purchased course has capacity; the auto-enrolled CORE course is full (updateMany count 0)
    // but must not roll back the transaction.
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: USER, isPaid: false, coursesIds: [PURCHASED] });
    commitWebpayTransaction.mockResolvedValue({ status: 'AUTHORIZED' });

    const updateMany = vi
      .fn()
      // first call: the purchased course (capacity available)
      .mockResolvedValueOnce({ count: 1 })
      // second call: the full CORE course (0 rows affected) — must NOT throw
      .mockResolvedValueOnce({ count: 0 });

    const tx = makeTx({
      course: {
        findMany: vi.fn().mockResolvedValue([{ id: CORE }]),
        updateMany,
      },
      enrollment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'e1' }),
      },
    });
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const res = await confirmPurchase('p1', 'tok');

    expect(res.ok).toBe(true);
    expect(tx.enrollment.create).toHaveBeenCalledTimes(2); // purchased + core both enrolled
  });
});
```

- [ ] Step: Run it, expect FAIL. `cd app && npx vitest run src/actions/purchases.confirm.test.ts`. Expected failure: `No "confirmPurchase" export is defined in module './purchases'`.

- [ ] Step: Implement `confirmPurchase`. Add the `commitWebpayTransaction` and `CourseType` imports to the top of `app/src/actions/purchases.ts`:

```ts
import { commitWebpayTransaction } from '@/lib/webpay';
import { CourseType } from '@/domain/courseType';
```

(Update the existing `import { createWebpayTransaction } from '@/lib/webpay';` line to also import `commitWebpayTransaction`, i.e. `import { createWebpayTransaction, commitWebpayTransaction } from '@/lib/webpay';`.)

Append this function to `app/src/actions/purchases.ts`:

```ts
export async function confirmPurchase(
  purchaseId: string,
  tokenWs: string,
): Promise<ActionResult<{ purchase: Purchase; transactionStatus: unknown }>> {
  if (!tokenWs) {
    return fail('Transbank no devolvió el código de confirmación', 400);
  }

  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) {
    return fail('La compra no fue encontrada', 404);
  }

  // Fix 7: idempotent BEFORE committing — a double-submit on an already-paid purchase
  // short-circuits to ok() without re-committing the Webpay transaction or re-running
  // any side effects.
  if (purchase.isPaid) {
    return ok({ purchase, transactionStatus: { status: 'AUTHORIZED' } });
  }

  const transactionStatus = await commitWebpayTransaction(tokenWs);

  if (transactionStatus.status === 'ERROR') {
    return fail(String(transactionStatus.error ?? 'Error en la transacción'), 402);
  }

  if (transactionStatus.status !== 'AUTHORIZED') {
    return fail('Transacción no autorizada', 400);
  }

  try {
    // IMPROVEMENT: single atomic transaction (mark paid -> enroll -> decrement capacity).
    const updated = await prisma.$transaction(async (tx) => {
      const marked = await tx.purchase.update({ where: { id: purchase.id }, data: { isPaid: true } });

      // Enroll in the purchased courses PLUS every core course.
      const coreCourses = await tx.course.findMany({ where: { type: CourseType.core } });
      const coreIds = coreCourses.map((c) => c.id);
      const purchasedIds = new Set(purchase.coursesIds);
      const allCourseIds = Array.from(new Set([...coreIds, ...purchase.coursesIds]));

      for (const courseId of allCourseIds) {
        const existing = await tx.enrollment.findUnique({
          where: { userId_courseId: { userId: purchase.userId, courseId } },
        });
        if (existing) continue;

        await tx.enrollment.create({
          data: { userId: purchase.userId, courseId, purchaseId: purchase.id },
        });

        // Fix 6: conditional decrement closes the oversell window. The capacity guard
        // (`capacity > 0`) applies to BOTH, but only PURCHASED courses roll back the
        // transaction when full. CORE courses are auto-enrolled: decrement only if
        // capacity remains, and NEVER throw (a full core course must not block confirmation).
        const dec = await tx.course.updateMany({
          where: { id: courseId, capacity: { gt: 0 } },
          data: { capacity: { decrement: 1 } },
        });
        if (dec.count === 0 && purchasedIds.has(courseId)) {
          throw new Error('One or more courses are full');
        }
      }

      return marked;
    });

    return ok({ purchase: updated, transactionStatus });
  } catch (error) {
    return fail((error as Error).message, 400);
  }
}
```

- [ ] Step: Run tests, expect PASS. `cd app && npx vitest run src/actions/purchases.confirm.test.ts`. Expected: `8 passed`.

- [ ] Step: Commit. `cd app && git add src/actions/purchases.ts src/actions/purchases.confirm.test.ts && git commit -m "feat: add atomic confirmPurchase with oversell-safe capacity decrement" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 28: sendConfirmation — verify purchase exists, send email via mailer

**Files:**
- Create: `app/src/lib/confirmationEmail.tsx` (server-side email HTML builder; reused by Phase 9's `EmailConfirmation`)
- Modify: `app/src/actions/purchases.ts`
- Test: `app/src/actions/purchases.email.test.ts`

**Interfaces:**
- Consumes:
  - `src/lib/prisma.ts` → `prisma.purchase.findUnique`, `prisma.course.findMany`
  - `src/lib/mailer.ts` → `sendMail(to: string, subject: string, html: string): Promise<void>` (positional; nodemailer transport from env)
  - `src/lib/confirmationEmail.ts(x)` → `buildConfirmationEmailHtml({ id, courses }): string` (server-side HTML builder, created in this task — see step below — and reused by the Phase 9 `EmailConfirmation` component)
  - `src/schemas/purchase.ts` → `sendConfirmationSchema`, `SendConfirmationInput` (`{ purchaseId, email }` ONLY)
  - `src/domain/courseType.ts` → `CourseType` (to load the core courses)
  - `src/domain/result.ts` → `ActionResult`, `ok`, `fail`
- Produces:
  - `sendConfirmation(input: SendConfirmationInput): Promise<ActionResult<null>>`

Port of the controller's `sendConfirmation` + `sendEmail`, with the email HTML now built **server-side** (Fix 5): the client no longer renders or ships email markup. `sendConfirmation` accepts only `{ purchaseId, email }`; it loads the purchase, its purchased courses PLUS every core course, builds the HTML via `buildConfirmationEmailHtml({ id: purchaseId, courses })`, and calls `sendMail(email, 'Confirmación de compra', html)` (positional, Fix 4). `buildConfirmationEmailHtml` is created here in Phase 6 as a tiny server util (`src/lib/confirmationEmail.tsx`); the Phase 9 `EmailConfirmation` component imports/reuses it rather than redefining it.

- [ ] Step: Create the server-side email HTML builder `app/src/lib/confirmationEmail.tsx` (Fix 5 — built here in Phase 6; the Phase 9 `EmailConfirmation` component re-exports/reuses it). Pure string builder, no React/DB/network:

```tsx
// src/lib/confirmationEmail.tsx
import type { Course } from '@prisma/client';

export type EmailCourse = Pick<Course, 'title' | 'type' | 'week' | 'price'>;

export interface ConfirmationEmailInput {
  id: string;
  courses: EmailCourse[];
}

const LOGO_URL = 'https://web.ccemuc.cl/_next/static/media/logo.45d46028.png';

/**
 * Server-side replacement for the legacy <EmailConfirmation /> React component
 * (which the old frontend rendered with ReactDOMServer.renderToStaticMarkup and
 * POSTed to the API). The monolith builds the email HTML here, server-side, so
 * the client never renders or ships email markup. Called from sendConfirmation
 * (Phase 6) and re-exported by the Phase 9 mailConfirmation component.
 */
export function buildConfirmationEmailHtml({ id, courses }: ConfirmationEmailInput): string {
  const price = courses.reduce((sum, course) => sum + course.price, 0);

  const coreRows = courses
    .filter((course) => course.type === 'core')
    .map(
      (course, index) =>
        `<tr><td style="color:#666;">Módulo base ${index + 1}</td><td style="color:#333;font-weight:bold;">${course.title}</td></tr>`,
    )
    .join('');

  const otherRows = courses
    .filter((course) => course.type !== 'core')
    .map(
      (course) =>
        `<tr><td style="color:#666;">Semana ${course.week}</td><td style="color:#333;font-weight:bold;">${course.title}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Email Confirmation</title>
</head>
<body>
  <div style="background-color:#e9ecef;">
    <h1 style="margin:0;font-size:32px;font-weight:700;">Confirmante de pago</h1>
    <p style="margin:0;">Se ha confirmado el pago de tu inscripción.</p>
    <p style="margin:0;">Tu código de confirmación es: ${id}</p>
    <table width="100%">
      <tbody>
        <tr><td style="font-weight:bold;color:#666;">Cursos</td></tr>
        ${coreRows}
        ${otherRows}
        <tr><td style="font-weight:bold;color:#666;">Precio</td><td style="color:#333;font-weight:bold;">$${price}</td></tr>
      </tbody>
    </table>
    <p style="margin:0;"><a href="https://web.ccemuc.cl/" target="_blank">Congreso CCEMUC</a></p>
    <p style="margin:0;">Has recibido este correo por tu reciente compra en la página de CCEMUC. Si no has realizado ninguna compra, puedes eliminar este correo.</p>
  </div>
</body>
</html>`;
}
```

- [ ] Step: Write the failing test. Create `app/src/actions/purchases.email.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  purchase: { findUnique: vi.fn() },
  course: { findMany: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const sendMail = vi.fn();
vi.mock('@/lib/mailer', () => ({ sendMail }));

import { sendConfirmation } from './purchases';

const VALID = {
  purchaseId: 'p1',
  email: 'alumno@uc.cl',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendConfirmation', () => {
  it('fails Zod validation when email is malformed', async () => {
    const res = await sendConfirmation({ ...VALID, email: 'not-an-email' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.field).toBe('email');
    }
    expect(prismaMock.purchase.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the purchase does not exist', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue(null);
    const res = await sendConfirmation(VALID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Purchase not found');
      expect(res.status).toBe(404);
    }
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('builds the HTML server-side and sends with positional args, returns ok(null)', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1', coursesIds: ['c1'] });
    prismaMock.course.findMany.mockResolvedValue([
      { id: 'c1', title: 'Elec', type: 'elective', week: 1, price: 15000 },
      { id: 'core1', title: 'Base', type: 'core', week: 0, price: 0 },
    ]);
    sendMail.mockResolvedValue(undefined);
    const res = await sendConfirmation(VALID);
    // Fix 4: positional sendMail(to, subject, html) with a server-built HTML string.
    expect(sendMail).toHaveBeenCalledWith('alumno@uc.cl', 'Confirmación de compra', expect.any(String));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toBeNull();
  });

  it('returns 500 when the mailer throws', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1', coursesIds: ['c1'] });
    prismaMock.course.findMany.mockResolvedValue([]);
    sendMail.mockRejectedValue(new Error('smtp down'));
    const res = await sendConfirmation(VALID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(500);
  });
});
```

- [ ] Step: Run it, expect FAIL. `cd app && npx vitest run src/actions/purchases.email.test.ts`. Expected failure: `No "sendConfirmation" export is defined in module './purchases'`.

- [ ] Step: Implement `sendConfirmation`. Add to the top of `app/src/actions/purchases.ts`:

```ts
import { sendMail } from '@/lib/mailer';
import { buildConfirmationEmailHtml } from '@/lib/confirmationEmail';
import { sendConfirmationSchema, type SendConfirmationInput } from '@/schemas/purchase';
```

(Merge the schema import with the existing `import { purchaseCreateSchema, type PurchaseCreateInput } from '@/schemas/purchase';` line: `import { purchaseCreateSchema, type PurchaseCreateInput, sendConfirmationSchema, type SendConfirmationInput } from '@/schemas/purchase';`. `CourseType` is already imported for `confirmPurchase`.)

Append to `app/src/actions/purchases.ts` (Fix 5 — load purchase + courses, build HTML server-side; Fix 4 — positional `sendMail`):

```ts
export async function sendConfirmation(input: SendConfirmationInput): Promise<ActionResult<null>> {
  const parsed = sendConfirmationSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, 400, issue.path[0]?.toString());
  }
  const { purchaseId, email } = parsed.data;

  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return fail('Purchase not found', 404);

  try {
    // Load the purchased courses PLUS every core course (these are the courses the buyer is enrolled in).
    const coreCourses = await prisma.course.findMany({ where: { type: CourseType.core } });
    const purchasedCourses = await prisma.course.findMany({ where: { id: { in: purchase.coursesIds } } });
    const seen = new Set<string>();
    const courses = [...coreCourses, ...purchasedCourses].filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    const html = buildConfirmationEmailHtml({ id: purchaseId, courses });
    await sendMail(email, 'Confirmación de compra', html);
    return ok(null);
  } catch (error) {
    return fail((error as Error).message, 500);
  }
}
```

- [ ] Step: Run tests, expect PASS. `cd app && npx vitest run src/actions/purchases.email.test.ts`. Expected: `4 passed`.

- [ ] Step: Run the whole purchases suite to confirm no cross-file regressions. `cd app && npx vitest run src/actions/purchases.*.test.ts`. Expected: all files pass (`27 passed` total across the four test files).

- [ ] Step: Commit. `cd app && git add src/lib/confirmationEmail.tsx src/actions/purchases.ts src/actions/purchases.email.test.ts && git commit -m "feat: add server-side confirmation email builder + sendConfirmation action" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

## Phase 6 (cont.) — Webpay return Route Handler

The Transbank Webpay flow ends by redirecting the user's **browser** back to the merchant's configured `returnUrl` — and Transbank delivers `token_ws` as an HTTP **POST with a form body** (browsers also re-issue it as a GET on some abort paths). A Next.js Server Action cannot serve this: actions are not addressable URLs an external system can POST a form to, and they cannot be the target of a top-level browser navigation/redirect. So we need exactly one **Route Handler** at `src/app/api/webpay/return/route.ts` whose only job is to read `token_ws` + `purchaseId` (from the POST form body or the GET query string), then `NextResponse.redirect` the browser to the in-app `/confirmation` page (which calls the `confirmPurchase` server action), or to `/error` when Transbank signals an abort via `TBK_*` params. The handler performs no DB work itself — it is a thin redirect shim that bridges the external POST into the App Router.

### Task 29: Webpay return Route Handler — POST/GET, redirect to /confirmation or /error

**Files:**
- Create: `app/src/app/api/webpay/return/route.ts`
- Test: `app/src/app/api/webpay/return/route.test.ts`

**Interfaces:**
- Consumes:
  - `next/server` → `NextRequest`, `NextResponse` (`NextResponse.redirect(url, 303)`)
  - env: `NEXT_PUBLIC_BASE_URL` (base for building the absolute redirect target)
- Produces:
  - `export async function POST(req: NextRequest): Promise<NextResponse>`
  - `export async function GET(req: NextRequest): Promise<NextResponse>`
  - Redirect contract: success → `/confirmation?purchaseId=<id>&token_ws=<tok>`; Transbank abort (`TBK_TOKEN`/`TBK_ORDEN_COMPRA`/`TBK_ID_SESION` present, or no `token_ws`) → `/error?message=...` (preserving `purchaseId` when known)

The redirect target shape mirrors the legacy flow: `WEBPAY_RETURN_URL` pointed at the frontend `/confirmation` carrying `purchaseId` (stamped by `createWebpayTransaction`) + `token_ws`. In the monolith the return URL points at this handler (`/api/webpay/return?purchaseId=...`), and the handler forwards to `/confirmation`. The abort-param logic mirrors the legacy `confirmation/page.tsx`: if `TBK_*` are present (or `token_ws` is missing), the user aborted → send to `/error`.

- [ ] Step: Write the failing test. Create `app/src/app/api/webpay/return/route.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from './route';

const BASE = 'https://ccemuc.cl';

beforeEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = BASE;
});

function postReq(url: string, form: Record<string, string>): NextRequest {
  const body = new URLSearchParams(form).toString();
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

describe('Webpay return Route Handler — POST', () => {
  it('redirects to /confirmation with purchaseId + token_ws from the form body', async () => {
    const req = postReq(`${BASE}/api/webpay/return?purchaseId=pur-1`, { token_ws: 'tok-abc' });
    const res = await POST(req);
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/confirmation');
    expect(loc.searchParams.get('purchaseId')).toBe('pur-1');
    expect(loc.searchParams.get('token_ws')).toBe('tok-abc');
  });

  it('reads purchaseId from the form body if not in the query', async () => {
    const req = postReq(`${BASE}/api/webpay/return`, { token_ws: 'tok-xyz', purchaseId: 'pur-2' });
    const res = await POST(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/confirmation');
    expect(loc.searchParams.get('purchaseId')).toBe('pur-2');
    expect(loc.searchParams.get('token_ws')).toBe('tok-xyz');
  });

  it('redirects to /error when Transbank aborts (TBK_* present)', async () => {
    const req = postReq(`${BASE}/api/webpay/return?purchaseId=pur-3`, {
      TBK_TOKEN: 'abort',
      TBK_ORDEN_COMPRA: 'oc',
      TBK_ID_SESION: 'sid',
    });
    const res = await POST(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/error');
    expect(loc.searchParams.get('message')).toBe('Error en la compra');
    expect(loc.searchParams.get('purchaseId')).toBe('pur-3');
  });

  it('redirects to /error when token_ws is missing', async () => {
    const req = postReq(`${BASE}/api/webpay/return?purchaseId=pur-4`, {});
    const res = await POST(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/error');
  });
});

describe('Webpay return Route Handler — GET', () => {
  it('redirects to /confirmation reading params from the query string', async () => {
    const req = new NextRequest(`${BASE}/api/webpay/return?purchaseId=pur-5&token_ws=tok-get`);
    const res = await GET(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/confirmation');
    expect(loc.searchParams.get('purchaseId')).toBe('pur-5');
    expect(loc.searchParams.get('token_ws')).toBe('tok-get');
  });

  it('redirects to /error on a GET abort (TBK_TOKEN present)', async () => {
    const req = new NextRequest(`${BASE}/api/webpay/return?purchaseId=pur-6&TBK_TOKEN=abort`);
    const res = await GET(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/error');
  });
});
```

- [ ] Step: Run it, expect FAIL. `cd app && npx vitest run src/app/api/webpay/return/route.test.ts`. Expected failure: `Failed to resolve import "./route"` (the handler file does not exist yet).

- [ ] Step: Implement the Route Handler. Create `app/src/app/api/webpay/return/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

// Why a Route Handler (and not a Server Action): Transbank Webpay returns the
// browser to our configured returnUrl via an HTTP POST carrying token_ws in a
// form body (and re-issues a GET on some abort paths). A Server Action is not an
// addressable URL an external system can POST a form to, nor a valid target for a
// top-level browser navigation/redirect. This handler is a thin shim: it reads the
// params and redirects into the App Router; all DB work happens in the
// confirmPurchase server action invoked from /confirmation.

const ABORT_MESSAGE = 'Error en la compra';

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? '';
}

function redirectToConfirmation(purchaseId: string, tokenWs: string): NextResponse {
  const url = new URL('/confirmation', baseUrl());
  url.searchParams.set('purchaseId', purchaseId);
  url.searchParams.set('token_ws', tokenWs);
  // Fix 8: 303 See Other so the browser issues a GET to /confirmation after the POST return.
  return NextResponse.redirect(url, 303);
}

function redirectToError(purchaseId: string | null): NextResponse {
  const url = new URL('/error', baseUrl());
  url.searchParams.set('message', ABORT_MESSAGE);
  if (purchaseId) url.searchParams.set('purchaseId', purchaseId);
  // Fix 8: 303 See Other for the /error redirect as well.
  return NextResponse.redirect(url, 303);
}

function decide(params: URLSearchParams): NextResponse {
  const purchaseId = params.get('purchaseId');
  const tokenWs = params.get('token_ws');

  // Transbank abort signals: TBK_* params present, or no token at all.
  const aborted =
    params.has('TBK_TOKEN') || params.has('TBK_ORDEN_COMPRA') || params.has('TBK_ID_SESION');

  if (aborted || !tokenWs) {
    return redirectToError(purchaseId);
  }
  return redirectToConfirmation(purchaseId ?? '', tokenWs);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const params = new URLSearchParams(req.nextUrl.searchParams);
  const form = await req.formData().catch(() => null);
  if (form) {
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') params.set(key, value);
    }
  }
  return decide(params);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return decide(new URLSearchParams(req.nextUrl.searchParams));
}
```

- [ ] Step: Run tests, expect PASS. `cd app && npx vitest run src/app/api/webpay/return/route.test.ts`. Expected: `6 passed`.

- [ ] Step: Commit. `cd app && git add src/app/api/webpay/return/route.ts src/app/api/webpay/return/route.test.ts && git commit -m "feat: add Transbank webpay return Route Handler with redirect logic" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

## Phase 7 — Frontend shell

Port the visual shell of the monolith from `frontend/`: the root layout (Inter font + metadata), global CSS, Tailwind config (primary palette + Inter font stack), `next.config.mjs` (server runtime — NO `output: 'export'`, with `REGISTRATION_OPEN`/`NEXT_PUBLIC_BASE_URL` env and image config), the static JSON data and image dictionary, the `Header` (League Spartan, menu from `sections.json`), and the landing-page composition (`main.tsx` + all `mainPage/*` sections). We modernize the deprecated Next 13/14 APIs the original used: `<Link legacyBehavior>` becomes a plain `<Link>` (no inner `<a>`), and `<Image layout="responsive">` becomes `fill` with a sized wrapper or explicit `width`/`height` — every change is called out in its step. A render smoke test for `Header` (Vitest + `@testing-library/react`, deps added here) anchors the port. All user copy stays in Spanish.

These tasks assume Phase 1's scaffold already created `app/` with `package.json`, `tsconfig.json`, `vitest.config.ts`, the `@/* -> ./src/*` path alias, and `src/lib/prisma.ts`. They depend on `getCourses()` from the courses-actions task (consumed in Phase 7 (cont.), Task 35) and on the `Course` Prisma type.

### Task 30: Testing-library deps, Vitest jsdom env, Tailwind config + globals.css

**Files:**
- Modify: `/home/rodrigoogalde/Personal/CCemuc/app/package.json` (add deps)
- Modify: `/home/rodrigoogalde/Personal/CCemuc/app/vitest.config.ts` (jsdom + setup)
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/vitest.setup.ts`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/test/asset-stub.ts`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/tailwind.config.ts`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/postcss.config.mjs`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/globals.css`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/tailwind.config.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks beyond the Phase 1 scaffold (`vitest.config.ts`, `tsconfig.json`, npm).
- Produces: a jsdom test environment + `@testing-library/jest-dom` matchers available to every later React test in this section; `tailwind.config.ts` exporting `config` with `theme.extend.colors.primary` (the blue 50–950 scale) and the Inter `fontFamily.sans`/`fontFamily.body` stacks; `src/app/globals.css` consumed by `layout.tsx` in Task 31.

Steps:
- [ ] Step: Add dev/runtime deps for React testing and Tailwind. Run:
  `cd /home/rodrigoogalde/Personal/CCemuc/app && npm install -D @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/dom@^10 jsdom@^25 @vitejs/plugin-react@^4 tailwindcss@^3 postcss@^8 autoprefixer@^10`
  Expected: installs succeed, `package.json` devDependencies now list these.
- [ ] Step: Write the failing test for the Tailwind palette/fonts (the config is plain data, so this is a real unit test):
```ts
// tailwind.config.test.ts
import { describe, it, expect } from 'vitest';
import config from './tailwind.config';

describe('tailwind.config', () => {
  it('exposes the primary blue scale', () => {
    const primary = (config.theme?.extend?.colors as Record<string, Record<string, string>>).primary;
    expect(primary['500']).toBe('#3b82f6');
    expect(primary['950']).toBe('#172554');
  });

  it('uses Inter as the lead sans/body font', () => {
    const ff = config.theme?.extend?.fontFamily as Record<string, string[]>;
    expect(ff.sans[0]).toBe('Inter');
    expect(ff.body[0]).toBe('Inter');
  });

  it('scans src for class names', () => {
    expect(config.content).toContain('./src/**/*.{js,ts,jsx,tsx,mdx}');
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run tailwind.config.test.ts`. Expected failure: `Cannot find module './tailwind.config'` (file does not exist yet).
- [ ] Step: Create `tailwind.config.ts`. (Port note: the original kept `fontFamily` as a sibling of `theme` and split `content` across `pages/components/app`; we fold the Inter stacks into `theme.extend.fontFamily` and collapse `content` to one `src` glob — same effect, idiomatic Tailwind 3.)
```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const interStack = [
  'Inter',
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'Noto Sans',
  'sans-serif',
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
  'Noto Color Emoji',
];

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        primary: {
          '50': '#eff6ff',
          '100': '#dbeafe',
          '200': '#bfdbfe',
          '300': '#93c5fd',
          '400': '#60a5fa',
          '500': '#3b82f6',
          '600': '#2563eb',
          '700': '#1d4ed8',
          '800': '#1e40af',
          '900': '#1e3a8a',
          '950': '#172554',
        },
      },
      fontFamily: {
        body: interStack,
        sans: interStack,
      },
    },
  },
  plugins: [],
};

export default config;
```
- [ ] Step: Create `postcss.config.mjs` (ports `frontend/postcss.config.mjs`, Tailwind + Autoprefixer):
```js
// postcss.config.mjs
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```
- [ ] Step: Create `src/app/globals.css` — faithful port of `frontend/src/app/styles/globals.css` (kept verbatim except moving the file to `src/app/globals.css`; the remote Google-Fonts `@import`s stay for League Spartan/Lato/Open Sans/Space Grotesk used by ported components):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Lato:wght@400&family=Open+Sans:wght@300&display=swap');
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&display=swap");
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@100..900&display=swap');

.font-lato {
  font-family: 'Lato', sans-serif;
}

.font-open-sans {
  font-family: 'Open Sans', sans-serif;
}

.font-league-spartan {
  font-family: 'League Spartan', sans-serif;
}

body {
  background-color: #ffffff;
  overflow-x: hidden;
  font-family: "Space Grotesk", sans-serif;
}

.svg_main {
  width: 100%;
  height: 100%;
}

.text-xxl {
  font-size: 4.8em;
}

.bg-purple {
  background-color: #1b263a;
}

.bg-blue {
  background-color: #134ae9;
}

.bg-gray {
  background-color: #f9fbfb;
}

.Grotesk {
  font-family: "Space Grotesk", sans-serif;
}

.underline-blue {
  text-decoration: underline;
  text-decoration-color: #134ae9;
  text-decoration-thickness: 2px;
  text-underline-position: under;
}

.underline-white {
  text-decoration: underline;
  text-decoration-color: #fff;
  text-decoration-thickness: 2px;
  text-underline-position: under;
}

.underline-gray {
  text-decoration: underline;
  text-decoration-color: #adadad;
  text-decoration-thickness: 2px;
  text-underline-position: under;
}

.max-w-8xl {
  max-width: 90rem;
}

.max-w-9xl {
  max-width: 110rem;
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```
- [ ] Step: Create `vitest.setup.ts` (registers jest-dom matchers for all React tests):
```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
```
- [ ] Step: Create the image-asset stub `test/asset-stub.ts` (Fix 12 — unconditional; `*.png`/`*.jpg`/`*.svg` imports resolve here in tests):
```ts
// test/asset-stub.ts
export default { src: '/stub.png', height: 1, width: 1 };
```
- [ ] Step: Update `vitest.config.ts` to use the React plugin, jsdom env, and the setup file (preserve any existing test config from Phase 1; the key additions are `plugins`, `environment: 'jsdom'`, `setupFiles`):
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Fix 12: deterministically resolve image-asset imports to a tiny stub so component
    // tests never depend on the asset loader handling .png/.jpg/.svg.
    alias: [
      {
        find: /\.(png|jpe?g|svg)$/,
        replacement: new URL('./test/asset-stub.ts', import.meta.url).pathname,
      },
    ],
  },
});
```
- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run tailwind.config.test.ts`. Expected: 3 passed.
- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add package.json package-lock.json vitest.config.ts vitest.setup.ts test/asset-stub.ts tailwind.config.ts tailwind.config.test.ts postcss.config.mjs src/app/globals.css && git commit -m "feat: add jsdom test env, tailwind config and global styles" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 31: Root layout, next.config.mjs (server runtime + env), static data & image assets

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/layout.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/next.config.mjs`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/utils/sections.json`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/utils/universities.json`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/images/images.tsx`
- Copy (assets, binary — no edits): everything under `/home/rodrigoogalde/Personal/CCemuc/app/src/components/images/` (`Logo BW.png`, `generalInfo.png`, `cards/1..8.png`, `mainPage/**`)
- Modify: `/home/rodrigoogalde/Personal/CCemuc/app/.env.example` (add `REGISTRATION_OPEN`, `NEXT_PUBLIC_BASE_URL`)
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/images/images.test.ts`

**Interfaces:**
- Consumes: `src/app/globals.css` (from Task 30).
- Produces: `RootLayout` default export (server component, Inter font, `metadata = { title: 'CCEMUC' }`); `sections.json` (`{ sections: { title, link }[] }`) consumed by `Header` (Task 32); `universities.json` (`{ universidades: string[] }`) consumed by the registration form in a later phase; `courseImagesDictionary` default export (`Record<number, StaticImageData>`, keys 1–8) consumed by `moduleInfo.tsx` (Task 35); `next.config.mjs` with server runtime (no export) and `images.remotePatterns`/`unoptimized` as needed.

Steps:
- [ ] Step: Copy the binary image assets verbatim (Next resolves `import ... from '@/components/images/...'` to `StaticImageData`, so the files must exist). Run:
  `mkdir -p /home/rodrigoogalde/Personal/CCemuc/app/src/components/images && cp -R /home/rodrigoogalde/Personal/CCemuc/frontend/src/components/images/. /home/rodrigoogalde/Personal/CCemuc/app/src/components/images/ && rm -f /home/rodrigoogalde/Personal/CCemuc/app/src/components/images/images.tsx`
  Expected: `cards/`, `mainPage/`, `Logo BW.png`, `generalInfo.png` copied; the old `images.tsx` removed (re-created below).
- [ ] Step: Copy the static JSON data verbatim. Run:
  `mkdir -p /home/rodrigoogalde/Personal/CCemuc/app/src/utils && cp /home/rodrigoogalde/Personal/CCemuc/frontend/src/utils/sections.json /home/rodrigoogalde/Personal/CCemuc/app/src/utils/sections.json && cp /home/rodrigoogalde/Personal/CCemuc/frontend/src/utils/universities.json /home/rodrigoogalde/Personal/CCemuc/app/src/utils/universities.json`
  Expected: both JSON files present under `app/src/utils/`.
- [ ] Step: Write the failing test for the image dictionary (asserts keys 1–8 resolve to non-empty `src` strings; Next's static-import loader returns `StaticImageData` with a `src` under Vitest+`@vitejs/plugin-react`, which handles asset imports):
```ts
// src/components/images/images.test.ts
import { describe, it, expect } from 'vitest';
import courseImagesDictionary from './images';

describe('courseImagesDictionary', () => {
  it('maps card indexes 1..8 to an image with a src', () => {
    for (let i = 1; i <= 8; i++) {
      const img = courseImagesDictionary[i];
      expect(img).toBeDefined();
      const src = typeof img === 'string' ? img : img.src;
      expect(typeof src).toBe('string');
      expect(src.length).toBeGreaterThan(0);
    }
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/components/images/images.test.ts`. Expected failure: `Cannot find module './images'`.
- [ ] Step: Re-create `src/components/images/images.tsx` (faithful port of `frontend/src/components/images/images.tsx`):
```tsx
// src/components/images/images.tsx
import courseImage1 from '@/components/images/cards/1.png';
import courseImage2 from '@/components/images/cards/2.png';
import courseImage3 from '@/components/images/cards/3.png';
import courseImage4 from '@/components/images/cards/4.png';
import courseImage5 from '@/components/images/cards/5.png';
import courseImage6 from '@/components/images/cards/6.png';
import courseImage7 from '@/components/images/cards/7.png';
import courseImage8 from '@/components/images/cards/8.png';
import { StaticImageData } from 'next/image';

const courseImagesDictionary: { [key: string]: string | StaticImageData } = {
  1: courseImage1,
  2: courseImage2,
  3: courseImage3,
  4: courseImage4,
  5: courseImage5,
  6: courseImage6,
  7: courseImage7,
  8: courseImage8,
};

export default courseImagesDictionary;
```
- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/components/images/images.test.ts`. Expected: 1 passed. (Image-asset imports resolve deterministically to `test/asset-stub.ts` via the `test.alias` rule added in the Tailwind/jsdom task, so this passes without depending on the asset loader.)
- [ ] Step: Create `src/app/layout.tsx` (port of `frontend/src/app/layout.tsx`; `import './globals.css'` instead of `./styles/globals.css`; keep `lang="es"` to match the all-Spanish copy — port note: original used `lang="en"`, corrected to `es`):
```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CCEMUC',
  description: 'CCEMUC',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```
- [ ] Step: Create `next.config.mjs` (port note: DROP `output: 'export'` and `trailingSlash`/`missingSuspenseWithCSRBailout`/`dotenv`; the monolith runs on the Next server runtime. Keep `images.unoptimized: true` to keep the static-image dictionary behavior on Vercel without an image-optimization budget. Fix 11: DROP the `env:` passthrough — `pricing/page.tsx` reads `process.env.REGISTRATION_OPEN` server-side at request time, and `NEXT_PUBLIC_*` vars are exposed to the client automatically, so neither needs an `env` block):
```js
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```
- [ ] Step: Append the two front-end-relevant env keys to `.env.example` (the file already exists from Phase 1; add only these if absent):
```
REGISTRATION_OPEN=true
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```
- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add next.config.mjs src/app/layout.tsx src/utils/sections.json src/utils/universities.json src/components/images && git commit -m "feat: add root layout, server-runtime next config, static data and image assets" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"` then `git add .env.example && git commit -m "chore: add REGISTRATION_OPEN and NEXT_PUBLIC_BASE_URL to .env.example" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 32: Header component (League Spartan, menu from sections.json) + render smoke test

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/header.tsx`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/header.test.tsx`

**Interfaces:**
- Consumes: `sections.json` and the `Logo BW.png` asset (from Task 31).
- Produces: `Header` default export (client component) consumed by every page in Phase 10.

Steps:
- [ ] Step: Write the failing render/smoke test (Vitest + `@testing-library/react`). It mocks `next/font/google` (returns a stub `.className`) and `next/image` (renders a plain `<img>`), then asserts the brand, the CTA, and every nav item from `sections.json` render with correct hrefs:
```tsx
// src/components/header.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from './header';
import sections from '@/utils/sections.json';

vi.mock('next/font/google', () => ({
  League_Spartan: () => ({ className: 'league-spartan' }),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: unknown; alt: string }) => {
    const src =
      typeof props.src === 'string' ? props.src : (props.src as { src: string }).src;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={props.alt} />;
  },
}));

describe('Header', () => {
  it('renders the brand and the registration CTA', () => {
    render(<Header />);
    expect(screen.getByText('CCEM UC')).toBeInTheDocument();
    expect(
      screen.getByText('CONGRESO DE CIRUGÍA UC PARA ESTUDIANTES DE MEDICINA'),
    ).toBeInTheDocument();
    expect(screen.getByText('SÉ PARTE DEL CONGRESO')).toBeInTheDocument();
  });

  it('renders one link per section from sections.json with its href', () => {
    render(<Header />);
    for (const section of sections.sections) {
      const link = screen.getByRole('link', { name: section.title });
      expect(link).toHaveAttribute('href', section.link);
    }
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/components/header.test.tsx`. Expected failure: `Cannot find module './header'`.
- [ ] Step: Implement `src/components/header.tsx` (port of `frontend/src/components/header.tsx`. Port notes: (1) every `<Link ... legacyBehavior>` with an inner `<a>`/`<div>` becomes a plain `<Link>` whose className/content move onto the `Link` itself — removing the deprecated `legacyBehavior` and nested anchors; the CTA and each nav item are now single `<Link>` elements, which is what the test asserts via `getByRole('link')`; (2) keep the League Spartan font, the mobile menu toggle, and all Spanish copy verbatim):
```tsx
// src/components/header.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '@/components/images/Logo BW.png';
import { League_Spartan } from 'next/font/google';

import sections from '@/utils/sections.json';

const leagueSpartan = League_Spartan({ subsets: ['latin'] });

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header>
      <nav className="bg-black border-gray-200 px-4 lg:px-6 py-5">
        <div className="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl w-full py-2">
          <Link href="/" className="flex items-center">
            <div className="flex items-center">
              <Image
                src={logo}
                alt="logo"
                width={180}
                height={180}
                className="mr-3 h-12 w-12 md:h-24 md:w-24 lg:h-36 lg:w-36"
              />
            </div>
            <div className="flex flex-col ml-3">
              <span
                className={`text-2xl md:text-4xl lg:text-6xl xl:text-[80px] font-semibold whitespace-nowrap text-white ${leagueSpartan.className}`}
              >
                CCEM UC
              </span>
              <span className="text-xs md:text-sm lg:text-base xl:text-[12px] text-white">
                CONGRESO DE CIRUGÍA UC PARA ESTUDIANTES DE MEDICINA
              </span>
            </div>
          </Link>
          <div className="flex justify-center w-full lg:w-auto mt-4 lg:mt-0">
            <Link
              href="/pricing"
              className={`text-white bg-[#116D85] hover:bg-[#0E5A6E] focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm md:text-base lg:text-lg px-4 lg:px-5 py-2 lg:py-2.5 mr-2 focus:outline-none dark:focus:ring-gray-800 ${leagueSpartan.className}`}
            >
              SÉ PARTE DEL CONGRESO
            </Link>
          </div>
        </div>

        <div className="bg-black border-gray-200 items-center mx-auto max-w-screen-xl w-full flex flex-col justify-center">
          <div className="flex items-center lg:order-2">
            <button
              onClick={toggleMenu}
              type="button"
              className="inline-flex items-center p-2 ml-1 text-sm text-white rounded-lg lg:hidden hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
              aria-controls="mobile-menu-2"
              aria-expanded={isMenuOpen ? 'true' : 'false'}
            >
              <svg
                className={`w-6 h-6 ${isMenuOpen ? 'hidden' : 'block'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                ></path>
              </svg>
              <svg
                className={`w-6 h-6 ${isMenuOpen ? 'block' : 'hidden'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                ></path>
              </svg>
            </button>
          </div>
          <div
            className={`${isMenuOpen ? 'block' : 'hidden'} justify-between items-center w-full lg:flex lg:w-auto lg:order-1`}
            id="mobile-menu-2"
          >
            <ul className="flex flex-col mt-4 font-medium lg:flex-row lg:space-x-8 lg:mt-0">
              {sections.sections.map((section, index) => (
                <li key={index}>
                  <Link
                    href={section.link}
                    className="block py-2 pr-4 pl-3 text-white border-b border-gray-100 hover:bg-gray-500 lg:hover:bg-transparent lg:border-0 lg:p-0 dark:text-white dark:hover:bg-gray-700 dark:hover:text-gray-400 lg:dark:hover:bg-transparent dark:border-gray-700 cursor-pointer"
                    style={{ fontSize: '20px' }}
                  >
                    {section.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
```
- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/components/header.test.tsx`. Expected: 2 passed. (Note: `sections.json` has two items both linking to `/` — "¿Quiénes somos?" and "Galería" — but `getByRole('link', { name })` keys off the accessible name (text), so each lookup is unambiguous.)
- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add src/components/header.tsx src/components/header.test.tsx && git commit -m "feat: add Header with menu from sections.json and render smoke test" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 33: Landing-page sections — firstSection, countDown, announcement, modality, CcemSection

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mainPage/firstSection.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mainPage/countDownSection.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mainPage/announcementSection.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mainPage/modalitySection.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mainPage/CcemSection.tsx`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mainPage/firstSection.test.tsx`

**Interfaces:**
- Consumes: `mainPage/*` image assets (from Task 31).
- Produces: `FirstSection`, `Countdown`, `AnnouncementSection`, `ModalidadSection`, `CcemSection` default exports consumed by `main.tsx` (Task 34).

Steps:
- [ ] Step: Write the failing render test for `FirstSection` (the only section with a CTA Link worth asserting; mocks fonts/Image/Link):
```tsx
// src/components/mainPage/firstSection.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FirstSection from './firstSection';

vi.mock('next/font/google', () => ({
  League_Spartan: () => ({ className: 'league-spartan' }),
}));

describe('FirstSection', () => {
  it('renders the congress headline and a pricing CTA', () => {
    render(<FirstSection />);
    expect(screen.getByText('I° CONGRESO DE CIRUGÍA UC')).toBeInTheDocument();
    expect(screen.getByText('PARA ESTUDIANTES DE MEDICINA')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: '¡Sé parte del Congreso!' });
    expect(cta).toHaveAttribute('href', '/pricing');
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/components/mainPage/firstSection.test.tsx`. Expected failure: `Cannot find module './firstSection'`.
- [ ] Step: Create `firstSection.tsx` (port. Port notes: remove the stray `console.log(fondo.src)`; convert the `<Link legacyBehavior>` wrapping a `<div><a>` into a plain `<Link>` carrying the button styling — the CTA is now a single link element):
```tsx
// src/components/mainPage/firstSection.tsx
import React from 'react';
import fondo from '@/components/images/mainPage/fondo_1.jpeg';
import { League_Spartan } from 'next/font/google';
import Link from 'next/link';

const leagueSpartan = League_Spartan({ subsets: ['latin'] });

const FirstSection: React.FC = () => {
  return (
    <div>
      <div
        className="relative overflow-hidden rounded-lg bg-cover bg-no-repeat p-12 text-center"
        style={{
          backgroundImage: `url(${fondo.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          width: '100vw',
          height: '100vh',
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 top-0 h-full w-full overflow-hidden bg-fixed">
          <div className="flex h-full items-center justify-center">
            <div className="text-white">
              <h2
                className={`mb-1 text-4xl md:text-5xl lg:text-6xl xl:text-[80px] font-bold ${leagueSpartan.className}`}
              >
                I° CONGRESO DE CIRUGÍA UC
              </h2>
              <h2
                className={`mb-1 text-4xl md:text-5xl lg:text-6xl xl:text-[80px] font-bold ${leagueSpartan.className}`}
              >
                PARA ESTUDIANTES DE MEDICINA
              </h2>
              <h4 className="mb-6 text-lg md:text-xl lg:text-2xl xl:text-[30px]">
                El futuro de la cirugía: innovación y nuevas perspectivas
              </h4>
              <div className="flex justify-center w-full lg:w-auto">
                <Link
                  href="/pricing"
                  className={`text-white bg-[#116D85] hover:bg-[#0E5A6E] focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm md:text-base lg:text-lg px-4 lg:px-5 py-2 lg:py-2.5 mr-2 focus:outline-none dark:focus:ring-gray-800 ${leagueSpartan.className}`}
                >
                  ¡Sé parte del Congreso!
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstSection;
```
- [ ] Step: Create `countDownSection.tsx` (faithful port; client component because of `useEffect`/`useState`/`setInterval`. Port note: add `'use client'` — the original relied on the parent `main.tsx` being a client module, but each section now declares its own boundary):
```tsx
// src/components/mainPage/countDownSection.tsx
'use client';

import React, { useEffect, useState } from 'react';

type TimeLeft = {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
};

const Countdown: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  const calculateTimeLeft = (): TimeLeft => {
    const difference = +new Date('2024-08-31T00:00:00') - +new Date();
    let timeLeft: TimeLeft = { dias: 0, horas: 0, minutos: 0, segundos: 0 };

    if (difference > 0) {
      timeLeft = {
        dias: Math.floor(difference / (1000 * 60 * 60 * 24)),
        horas: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutos: Math.floor((difference / 1000 / 60) % 60),
        segundos: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) {
    return null;
  }

  const timerComponents: React.JSX.Element[] = [];

  (Object.keys(timeLeft) as (keyof TimeLeft)[]).forEach((interval) => {
    if (!timeLeft[interval]) {
      return;
    }

    timerComponents.push(
      <div key={interval} className="flex flex-col items-center mx-2">
        <div className="text-4xl md:text-6xl lg:text-8xl font-bold bg-black text-white rounded-md p-4">
          {timeLeft[interval]}
        </div>
        <div className="text-lg md:text-xl lg:text-2xl font-semibold mt-2">
          {interval.toUpperCase()}
        </div>
      </div>,
    );
  });

  return (
    <div className="flex flex-col items-center justify-center my-10">
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6">QUEDAN</h2>
      <div className="flex justify-center">
        {timerComponents.length ? timerComponents : <span>¡Ya comenzó!</span>}
      </div>
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mt-6">PARA EL CONGRESO</h2>
    </div>
  );
};

export default Countdown;
```
- [ ] Step: Create `announcementSection.tsx` (faithful port; the two announcements with images sized `width/height` — no deprecated API to change here):
```tsx
// src/components/mainPage/announcementSection.tsx
import React from 'react';
import Image from 'next/image';
import Foto1 from '@/components/images/mainPage/Foto Anuncio 1.png';
import Foto2 from '@/components/images/mainPage/Foto Anuncio 2.png';
import { Open_Sans, Lato } from 'next/font/google';

const openSans = Open_Sans({ subsets: ['latin'] });
const lato = Lato({
  subsets: ['latin'],
  weight: '700',
});

const announcements = [
  {
    id: 1,
    title: 'Bienvenidos al I° CCEM UC',
    date: '31/07/2014',
    description:
      '¡Bienvenidos al Primer Congreso de Cirugía UC para Estudiantes de Medicina! Nos complace darles la bienvenida a este evento único, donde la innovación y el aprendizaje se unen para ofrecer una experiencia enriquecedora y transformadora. Durante este congreso, tendrán la oportunidad de interactuar con destacados profesionales de la cirugía, participar en talleres prácticos, y explorar los últimos avances tecnológicos que están revolucionando el campo quirúrgico.',
    image: Foto1,
  },
  {
    id: 2,
    title: 'Ya están abiertas las inscripciones para la competencia científica',
    date: '31/07/2024',
    description: 'Toda la información está disponible en las bases que puedes encontrar aquí.',
    image: Foto2,
  },
];

const AnnouncementSection: React.FC = () => {
  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex justify-center mb-4">
        <h2 className="text-3xl font-bold text-[#00778B]">ANUNCIOS</h2>
      </div>
      <div className="flex justify-center mb-6">
        <hr className="w-full border-t-2 border-gray-300" />
      </div>

      <div className="flex flex-col space-y-8">
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-4"
          >
            <div className="w-full lg:w-1/4 flex justify-center">
              <Image
                src={announcement.image}
                alt={announcement.title}
                className="rounded-lg"
                width={350}
                height={350}
                style={{ maxWidth: '300px', maxHeight: '300px' }}
              />
            </div>
            <div className="w-full lg:w-2/3">
              <h3 className={`text-2xl font-bold ${lato.className}`}>{announcement.title}</h3>
              <p className={`text-gray-500 mb-2 ${lato.className}`}>{announcement.date}</p>
              <p className={`${openSans.className}`}>{announcement.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementSection;
```
- [ ] Step: Create `modalitySection.tsx` (faithful port — copy and inline styles preserved verbatim; no deprecated API):
```tsx
// src/components/mainPage/modalitySection.tsx
import React from 'react';
import fondo from '@/components/images/mainPage/fondo_2.jpeg';
import { League_Spartan, Lato, Open_Sans } from 'next/font/google';

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: '700',
});
const lato = Lato({
  subsets: ['latin'],
  weight: '700',
});
const openSans = Open_Sans({
  subsets: ['latin'],
  weight: '400',
});

const ModalidadSection: React.FC = () => {
  return (
    <div>
      <div>
        <div
          className="bg-cover"
          style={{
            backgroundImage: `url(${fondo.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: '729px',
          }}
        ></div>
      </div>
      <div className="max-w-8xl mx-auto p-6">
        <div className="flex justify-center mb-4">
          <h2
            className={`text-3xl font-bold text-[#00778B] ${leagueSpartan.className}`}
            style={{
              fontSize: '40px',
              fontWeight: 700,
              lineHeight: '60px',
              letterSpacing: '-0.02em',
              textAlign: 'left',
            }}
          >
            MODALIDAD
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row justify-center items-center space-y-8 lg:space-y-0 lg:space-x-8">
          <div className="flex flex-col items-center text-center lg:w-1/3">
            <h3
              className={`text-2xl font-bold text-gray-400 ${lato.className}`}
              style={{
                fontFamily: 'Lato, sans-serif',
                fontSize: '40px',
                fontWeight: 700,
                lineHeight: '60px',
                letterSpacing: '-0.02em',
                textAlign: 'left',
              }}
            >
              PRESENCIAL
            </h3>
            <ul className={`mt-2 text-gray-600 ${openSans.className}`}>
              <li>Módulo de Cirugía General e Innovación</li>
              <li>Clases Magistrales de cada Módulo optativo</li>
              <li>Workshops</li>
            </ul>
          </div>

          <div className="flex flex-col items-center text-center lg:w-1/3">
            <h3
              className={`text-2xl font-bold text-gray-400 ${lato.className}`}
              style={{
                fontSize: '40px',
                fontWeight: 700,
                lineHeight: '60px',
                letterSpacing: '-0.02em',
                textAlign: 'left',
              }}
            >
              ON-LINE
            </h3>
            <ul className={`mt-2 text-gray-600 ${openSans.className}`}>
              <li>Módulos optativos:</li>
              <li>• Cirugía Digestiva y Coloproctología</li>
              <li>• Cirugía de Trauma y Urología</li>
              <li>• Cirugía Plástica y Oncológica</li>
              <li>• Cirugía de Tórax, Cardíaca y Vascular</li>
            </ul>
          </div>

          <div className="flex flex-col items-center text-center lg:w-1/3">
            <h3
              className={`text-2xl font-bold text-gray-400 ${lato.className}`}
              style={{
                fontFamily: 'Lato, sans-serif',
                fontSize: '40px',
                fontWeight: 700,
                lineHeight: '60px',
                letterSpacing: '-0.02em',
                textAlign: 'left',
              }}
            >
              PRESENCIAL
            </h3>
            <ul className={`mt-2 text-gray-600 ${openSans.className}`}>
              <li>Mejores trabajos presentados en la</li>
              <li>Competencia Científica del Congreso</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalidadSection;
```
- [ ] Step: Create `CcemSection.tsx` (faithful port; sized `Image`, no deprecated API):
```tsx
// src/components/mainPage/CcemSection.tsx
import React from 'react';
import Image from 'next/image';
import surgicalImage from '@/components/images/mainPage/foto_2.png';
import { Lato } from 'next/font/google';

const lato = Lato({
  subsets: ['latin'],
  weight: '700',
});

const CcemSection: React.FC = () => {
  return (
    <div className="max-w-8xl mx-auto p-6 flex flex-col lg:flex-row items-center">
      <div className="lg:w-1/2 p-6">
        <h2 className={`text-3xl md:text-4xl lg:text-5xl font-bold text-[#00778B] ${lato.className}`}>
          ¿QUÉ PUEDO HACER EN EL CCEM UC 2024?
        </h2>
        <p className="mt-4 text-lg text-gray-700">
          ¡Bienvenidos al Primer Congreso de Cirugía UC para Estudiantes de Medicina! Nos complace
          darles la bienvenida a este evento único, donde la innovación y el aprendizaje se unen
          para ofrecer una experiencia enriquecedora y transformadora. Durante este congreso,
          tendrán la oportunidad de interactuar con destacados profesionales de la cirugía,
          participar en talleres prácticos, y explorar los últimos avances tecnológicos que están
          revolucionando el campo quirúrgico.
        </p>
      </div>

      <div className="lg:w-1/2 p-6">
        <Image
          src={surgicalImage}
          alt="Cirugía en el CCEM UC"
          className="rounded-lg object-cover"
          width={729}
          height={486}
        />
      </div>
    </div>
  );
};

export default CcemSection;
```
- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/components/mainPage/firstSection.test.tsx`. Expected: 1 passed.
- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add src/components/mainPage/firstSection.tsx src/components/mainPage/countDownSection.tsx src/components/mainPage/announcementSection.tsx src/components/mainPage/modalitySection.tsx src/components/mainPage/CcemSection.tsx src/components/mainPage/firstSection.test.tsx && git commit -m "feat: port landing hero, countdown, announcement, modality and ccem sections" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

### Task 34: Remaining landing sections + Main composer + InfoCard

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mainPage/datesSection.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mainPage/sponsorSection.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mainPage/organizationSection.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/main.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/InfoCard.tsx`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/main.test.tsx`

**Interfaces:**
- Consumes: the five sections from Task 33; `mainPage/*` + `generalInfo.png` assets (Task 31).
- Produces: `Main` default export (composes all 8 sections) consumed by `src/app/page.tsx` (Task 35); `InfoCard` default export (`{ text: string }`) consumed by `/about`, `/references`, `/schedule` (Task 35).

Steps:
- [ ] Step: Write the failing test for `Main` — it mocks every child section to a marker so we assert composition + ordering without rendering real fonts/images:
```tsx
// src/components/main.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/mainPage/firstSection', () => ({ default: () => <div>first</div> }));
vi.mock('@/components/mainPage/countDownSection', () => ({ default: () => <div>countdown</div> }));
vi.mock('@/components/mainPage/announcementSection', () => ({ default: () => <div>announcement</div> }));
vi.mock('@/components/mainPage/modalitySection', () => ({ default: () => <div>modality</div> }));
vi.mock('@/components/mainPage/CcemSection', () => ({ default: () => <div>ccem</div> }));
vi.mock('@/components/mainPage/datesSection', () => ({ default: () => <div>dates</div> }));
vi.mock('@/components/mainPage/sponsorSection', () => ({ default: () => <div>sponsor</div> }));
vi.mock('@/components/mainPage/organizationSection', () => ({ default: () => <div>organization</div> }));

import Main from './main';

describe('Main', () => {
  it('composes all eight landing sections in order', () => {
    render(<Main />);
    const order = ['first', 'countdown', 'announcement', 'modality', 'ccem', 'dates', 'sponsor', 'organization'];
    for (const marker of order) {
      expect(screen.getByText(marker)).toBeInTheDocument();
    }
    const html = document.body.innerHTML;
    let last = -1;
    for (const marker of order) {
      const idx = html.indexOf(marker);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/components/main.test.tsx`. Expected failure: `Cannot find module './main'`.
- [ ] Step: Create `datesSection.tsx` (faithful port. Port note: the original `<Image>` had `height={729}` but no `width` while not using `fill` — under the server runtime that warns; add the matching `width={729}` to satisfy the non-fill `Image` contract):
```tsx
// src/components/mainPage/datesSection.tsx
import React from 'react';
import fondo from '@/components/images/mainPage/calendario.png';
import Image from 'next/image';
import { Open_Sans, Lato } from 'next/font/google';

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: '400',
});
const lato = Lato({
  subsets: ['latin'],
  weight: '700',
});

const schedule = [
  {
    date: 'Sábado 31 de agosto',
    event: '1° Jornada presencial CCEM UC 2024',
  },
  {
    date: 'Lunes 02 de septiembre al miércoles 04 de septiembre',
    event: 'Módulo Cirugía Digestiva y Coloproctología\nMódulo Cirugía de Trauma y Urología',
  },
  {
    date: 'Sábado 07 de septiembre',
    event: '2° Jornada presencial CCEM UC 2024',
  },
  {
    date: 'Lunes 09 de septiembre al miércoles 11 de septiembre',
    event: 'Módulo Cirugía Plástica y Oncológica\nMódulo Cirugía de Tórax, Cardíaca y Vascular',
  },
  {
    date: 'Viernes 13 de septiembre',
    event: 'Competencia Científica CCEM UC',
  },
  {
    date: 'Sábado 14 de septiembre',
    event: '3° Jornada presencial CCEM UC 2024',
  },
];

const DatesSection: React.FC = () => {
  return (
    <div>
      <div className="flex justify-center mb-4">
        <h2 className="text-3xl font-bold text-[#00778B]">FECHAS</h2>
      </div>
      <div className="flex justify-center mb-6">
        <hr className="w-full border-t-2 border-gray-300" />
      </div>

      <div className="flex justify-center">
        <Image
          src={fondo}
          alt="Calendario CCEM UC"
          className="rounded-lg object-cover"
          width={729}
          height={729}
        />
      </div>
      <div className="max-w-8xl mx-auto p-6">
        {schedule.map((item, index) => (
          <div key={index} className="flex flex-col lg:flex-row mb-4">
            <div
              className={`lg:w-1/2 font-bold pr-4 ${lato.className} text-base md:text-lg lg:text-xl xl:text-2xl`}
            >
              {item.date}
            </div>
            <div
              className={`lg:w-1/2 whitespace-pre-line ${openSans.className} text-base md:text-lg lg:text-xl xl:text-2xl`}
            >
              {item.event}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DatesSection;
```
- [ ] Step: Create `sponsorSection.tsx` (faithful port; only sponsors 1 and 3 are shown, as in the original — sponsor2/4/5/6 imports were unused there and are dropped):
```tsx
// src/components/mainPage/sponsorSection.tsx
import React from 'react';
import Image from 'next/image';
import sponsor1 from '@/components/images/mainPage/sponsors/logo_auspiciador_1.png';
import sponsor3 from '@/components/images/mainPage/sponsors/logo_auspiciador_3.jpeg';
import { Open_Sans } from 'next/font/google';

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: '400',
});

const sponsors = [
  {
    name: 'Pontificia Universidad Católica de Chile',
    image: sponsor1,
  },
  {
    name: 'Sociedad de Cirujanos de Chile',
    image: sponsor3,
  },
];

const SponsorSection: React.FC = () => {
  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex justify-center mb-4">
        <h2 className="text-3xl font-bold text-[#00778B]">PATROCINADORES Y AUSPICIADORES</h2>
      </div>
      <div className="flex justify-center mb-6">
        <hr className="w-full border-t-2 border-gray-300" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {sponsors.map((sponsor, index) => (
          <div key={index} className="flex flex-col items-center text-center">
            <Image
              src={sponsor.image}
              alt={sponsor.name}
              className="rounded-lg"
              width={150}
              height={150}
            />
            <p className={`mt-4 text-lg ${openSans.className}`}>{sponsor.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SponsorSection;
```
- [ ] Step: Create `organizationSection.tsx` (faithful port; the unused `Lato` import from the original is dropped):
```tsx
// src/components/mainPage/organizationSection.tsx
import React from 'react';
import Image from 'next/image';
import sponsor1 from '@/components/images/mainPage/sponsors/logo_auspiciador_7.png';
import { Open_Sans } from 'next/font/google';

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: '400',
});

const OrganizationSection: React.FC = () => {
  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex justify-center mb-4">
        <h2 className="text-3xl font-bold text-[#00778B]">ORGANIZACIÓN</h2>
      </div>
      <div className="flex justify-center mb-6">
        <hr className="w-full border-t-2 border-gray-300" />
      </div>
      <div>
        <div className="flex flex-col items-center text-center">
          <Image
            src={sponsor1}
            alt="Pontificia Universidad Católica de Chile"
            className="rounded-lg"
            width={150}
            height={150}
          />
          <p className={`mt-4 text-lg ${openSans.className}`}>¡Síguenos en instagram @ccem.uc!</p>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSection;
```
- [ ] Step: Create `InfoCard.tsx` (port. Port note: replace the deprecated `<Image layout="responsive">` with `fill` inside a positioned, aspect-ratio wrapper — the modern equivalent of responsive fill):
```tsx
// src/components/InfoCard.tsx
import React from 'react';
import Image from 'next/image';
import generalInfo from '@/components/images/generalInfo.png';

interface InfoCardProps {
  text: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ text }) => {
  return (
    <div className="max-w-sm bg-[#116D85] border border-gray-200 rounded-[20px] shadow dark:bg-[#116D85] dark:border-gray-700">
      <div className="relative w-full aspect-square">
        <Image src={generalInfo} alt="Course Module" fill className="rounded-[20px] object-cover" />
      </div>
      <div className="flex items-center justify-center p-4">
        <p className="text-white text-lg text-center font-open-sans">{text}</p>
      </div>
    </div>
  );
};

export default InfoCard;
```
- [ ] Step: Create `main.tsx` (port. Port note: drop the `'use client'` directive — `Main` is now a pure composer with no state; the only interactive child, `Countdown`, declares its own client boundary in Task 33):
```tsx
// src/components/main.tsx
import FirstSection from '@/components/mainPage/firstSection';
import CountDown from '@/components/mainPage/countDownSection';
import AnnouncementSection from '@/components/mainPage/announcementSection';
import ModalidadSection from '@/components/mainPage/modalitySection';
import CcemSection from '@/components/mainPage/CcemSection';
import DatesSection from '@/components/mainPage/datesSection';
import SponsorSection from '@/components/mainPage/sponsorSection';
import OrganizationSection from '@/components/mainPage/organizationSection';

export default function Main() {
  return (
    <div>
      <FirstSection />
      <CountDown />
      <AnnouncementSection />
      <ModalidadSection />
      <CcemSection />
      <DatesSection />
      <SponsorSection />
      <OrganizationSection />
    </div>
  );
}
```
- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/components/main.test.tsx`. Expected: 1 passed.
- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add src/components/mainPage/datesSection.tsx src/components/mainPage/sponsorSection.tsx src/components/mainPage/organizationSection.tsx src/components/InfoCard.tsx src/components/main.tsx src/components/main.test.tsx && git commit -m "feat: port dates/sponsor/organization sections, InfoCard and Main composer" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

## Phase 7 (cont.) — Info pages & /modules

Wire the ported shell into real routes. The landing route (`src/app/page.tsx`) and the four info pages (`/about`, `/contact`, `/references`, `/schedule`) are static-copy server components that render `<Header />` plus their Spanish content (and `InfoCard` grids where applicable). The `/modules` route is the one data-driven page: in the static frontend it ran an `axios GET /courses` from a client `useEffect`; in the monolith it becomes a server component that awaits the `getCourses()` server action directly, unwraps the `ActionResult`, and maps the courses to `ResponsiveCard`s (filtering out workshops and week 4, exactly as before). A unit test verifies the course→card mapping with `getCourses` mocked, so no live DB is touched.

### Task 35: page.tsx, info pages, modulePage card + /modules server fetch

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/page.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/about/page.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/contact/page.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/references/page.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/schedule/page.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/modulePage/moduleInfo.tsx`
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/modules/page.tsx`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/modules/page.test.tsx`

**Interfaces:**
- Consumes: `Header` (Task 32), `Main` (Task 34), `InfoCard` (Task 34), `courseImagesDictionary` (Task 31); `getCourses(): Promise<ActionResult<Course[]>>` from `@/actions/courses` (courses-actions task) returning the Prisma `Course` (`id, title, module, type, price, capacity, features: Json|null, week, topics: string[]`).
- Produces: the route pages (default exports). `ResponsiveCard` default export (`{ title: string; extraInfo: string; imageIndex: number; topics: string[] }`).

Steps:
- [ ] Step: Write the failing test for the `/modules` page — mocks `@/actions/courses` so `getCourses` returns a canned `ok([...])`, mocks `Header`/`ResponsiveCard` to markers, and asserts (a) workshops and week-4 courses are filtered out, (b) the remaining courses map to cards with the right title/extraInfo. The page is an async server component, so we `await` it and render the resolved element:
```tsx
// src/app/modules/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/header', () => ({ default: () => <div>header</div> }));

vi.mock('@/components/modulePage/moduleInfo', () => ({
  default: ({ title, extraInfo }: { title: string; extraInfo: string }) => (
    <div data-testid="card">{`${title}|${extraInfo}`}</div>
  ),
}));

const getCourses = vi.fn();
vi.mock('@/actions/courses', () => ({ getCourses: () => getCourses() }));

import ModulePage from './page';

describe('/modules', () => {
  it('renders a card per non-workshop, non-week-4 course', async () => {
    getCourses.mockResolvedValue({
      ok: true,
      data: [
        { id: 'a', title: 'Cirugía General', type: 'core', week: 1, module: 1, topics: ['t1'], features: { Lugar: 'Aula 1' } },
        { id: 'b', title: 'Taller X', type: 'workshop', week: 2, module: 2, topics: [], features: { Lugar: 'Sala 2' } },
        { id: 'c', title: 'Competencia', type: 'elective', week: 4, module: 3, topics: [], features: { Lugar: 'Aula 3' } },
        { id: 'd', title: 'Cirugía Plástica', type: 'elective', week: 2, module: 5, topics: ['t2', 't3'], features: { Lugar: 'Online' } },
      ],
    });

    render(await ModulePage());

    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Cirugía General|Aula 1')).toBeInTheDocument();
    expect(screen.getByText('Cirugía Plástica|Online')).toBeInTheDocument();
    expect(screen.queryByText(/Taller X/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Competencia/)).not.toBeInTheDocument();
  });

  it('renders no cards when getCourses fails', async () => {
    getCourses.mockResolvedValue({ ok: false, error: 'boom', status: 500 });
    render(await ModulePage());
    expect(screen.queryAllByTestId('card')).toHaveLength(0);
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/app/modules/page.test.tsx`. Expected failure: `Cannot find module './page'` (and `@/actions/courses`/`@/components/modulePage/moduleInfo` not yet present).
- [ ] Step: Create `src/components/modulePage/moduleInfo.tsx` (`ResponsiveCard`; port. Port notes: replace `<Image layout="responsive">` with explicit `width`/`height` + responsive `className`; replace the `<Link legacyBehavior>`+`<a>` CTA with a plain styled `<Link>`; fix the invalid `stroke-linecap`/`stroke-linejoin`/`stroke-width` SVG attrs to camelCase JSX props; type props inline rather than importing the dropped `models.ts`):
```tsx
// src/components/modulePage/moduleInfo.tsx
import Image from 'next/image';
import Link from 'next/link';
import courseImagesDictionary from '@/components/images/images';

export interface ResponsiveCardProps {
  title: string;
  extraInfo: string;
  imageIndex: number;
  topics: string[];
}

const ResponsiveCard: React.FC<ResponsiveCardProps> = ({ title, extraInfo, imageIndex, topics }) => {
  return (
    <div className="max-w-sm bg-white border-3 border-gray-300 rounded-2xl shadow">
      <div className="overflow-hidden rounded-t-2xl">
        <Image
          src={courseImagesDictionary[imageIndex]}
          alt=""
          className="object-cover w-full h-auto"
          width={500}
          height={500}
        />
      </div>
      <div className="p-5 text-center">
        <h5 className="mb-2 text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-black font-lato">
          {title}
        </h5>
        <p className="mb-3 text-xl sm:text-xl md:text-2xl font-bold text-[#116D85] font-open-sans">
          {extraInfo}
        </p>
        <p className="mb-3 text-xl sm:text-xl md:text-xl font-lato font-bold">Temas de las clases</p>

        <ul className="text-left text-base sm:text-base md:text-base font-open-sans list-disc list-inside">
          {topics.map((topic, index) => (
            <li key={index} className="mb-1">
              {topic}
            </li>
          ))}
        </ul>

        <Link
          href="/pricing"
          className="inline-flex items-center px-3 py-2 text-lg font-open-sans font-medium text-center text-white bg-[#116D85] rounded-lg hover:bg-[#0e5b6e] focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-[#116D85] dark:hover:bg-[#0e5b6e] dark:focus:ring-blue-800"
        >
          ¿Te gusta? ¡Inscríbete!
          <svg
            className="rtl:rotate-180 w-3.5 h-3.5 ms-2"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 14 10"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M1 5h12m0 0L9 1m4 4L9 9"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
};

export default ResponsiveCard;
```
- [ ] Step: Create `src/app/modules/page.tsx` (port note: this is the load-bearing change — the client `useEffect` + `axios GET ${BACKEND_URL}/courses` is replaced by an async server component that awaits `getCourses()` and unwraps the `ActionResult`; on `!ok` we render an empty grid rather than crashing. The filter `type !== 'workshop' && week !== 4` and `features.Lugar`→`extraInfo` / `module`→`imageIndex` mapping are preserved verbatim. `features` is `Json | null` in Prisma, so guard the `Lugar` read):
```tsx
// src/app/modules/page.tsx
import React from 'react';
import Header from '@/components/header';
import ResponsiveCard from '@/components/modulePage/moduleInfo';
import { getCourses } from '@/actions/courses';

const ModulePage = async () => {
  const result = await getCourses();
  const courses = result.ok ? result.data : [];

  return (
    <div>
      <Header />
      <div className="max-w-8xl mx-auto p-6">
        <div className="flex justify-center mb-4">
          <h2 className="text-3xl font-bold text-[#00778B]">MÓDULOS</h2>
        </div>
        <div className="flex justify-center mb-6">
          <hr className="w-full border-t-2 border-gray-300" />
        </div>
      </div>
      <div className="px-8 sm:px-8 lg:px-8">
        <div className="max-w-7xl mx-auto grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses
            .filter((course) => course.type !== 'workshop' && course.week !== 4)
            .map((course) => {
              const features = (course.features ?? {}) as Record<string, string>;
              return (
                <ResponsiveCard
                  key={course.id}
                  title={course.title}
                  extraInfo={features.Lugar ?? ''}
                  imageIndex={course.module}
                  topics={course.topics}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default ModulePage;
```
- [ ] Step: Run tests, expect PASS. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run src/app/modules/page.test.tsx`. Expected: 2 passed.
- [ ] Step: Create `src/app/page.tsx` (faithful port of the landing route):
```tsx
// src/app/page.tsx
import Main from '@/components/main';
import Header from '@/components/header';

export default function Home() {
  return (
    <div>
      <Header />
      <Main />
    </div>
  );
}
```
- [ ] Step: Create `src/app/about/page.tsx` (faithful port — full COMPETENCIA CIENTÍFICA copy, FECHAS IMPORTANTES table, DOCUMENTOS `InfoCard` grid; all Spanish copy verbatim):
```tsx
// src/app/about/page.tsx
import React from 'react';
import Header from '@/components/header';
import InfoCard from '@/components/InfoCard';

const AboutPage: React.FC = () => {
  return (
    <div>
      <Header />
      <main className="max-w-8xl mx-auto p-6 font-open-sans">
        <div className="flex justify-center mb-4">
          <h2 className="text-3xl font-bold text-[#00778B]">COMPETENCIA CIENTÍFICA</h2>
        </div>
        <div className="flex justify-center mb-6">
          <hr className="w-full border-t-2 border-gray-300" />
        </div>

        <div className="text-lg text-gray-800">
          <p>¡Bienvenidos al Congreso de Cirugía para Estudiantes de Medicina! Este importante evento académico y científico tiene como objetivo principal facilitar un intercambio enriquecedor de conocimientos y experiencias clínicas entre los participantes. Para ello, contará con las siguientes categorías, pudiendo ser para trabajos de investigación o casos clínicos:</p>
          <ul className="list-disc ml-6 my-4">
            <li>Cirugía general y sus subespecialidades.</li>
            <li>Traumatología y ortopedia.</li>
            <li>Neurocirugía.</li>
            <li>Ginecología y obstetricia.</li>
            <li>Urología.</li>
            <li>Anestesiología y reanimación.</li>
          </ul>
          <p>La competencia no solo ofrece un espacio para que los estudiantes presenten y discutan sus hallazgos con médicos especialistas y colegas, sino que también promueve la investigación y la innovación en el campo médico. Este congreso es más que una reunión académica; es una oportunidad para que las jóvenes mentes médicas exploren nuevas ideas, mejoren sus habilidades investigativas y establezcan valiosas conexiones profesionales.</p>
          <p>En nombre del comité organizador, agradecemos sinceramente la participación y entusiasmo de todos los asistentes. Esperamos que este congreso sea un espacio fructífero y gratificante, lleno de descubrimientos significativos y colaboraciones prometedoras que contribuyan al avance continuo de la práctica médica.</p>
        </div>

        <div className="flex justify-center mb-8"></div>
        <div className="flex justify-center mb-4">
          <h2 className="text-3xl font-bold text-[#00778B]">FECHAS IMPORTANTES</h2>
        </div>
        <div className="flex justify-center mb-6">
          <hr className="w-full border-t-2 border-gray-300" />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 mt-6">
            <thead>
              <tr>
                <th className="border border-gray-300 p-2 text-left">Evento</th>
                <th className="border border-gray-300 p-2 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2">Publicación de bases:</td>
                <td className="border border-gray-300 p-2">Lunes 22 de Julio</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">Período de recepción de trabajos:</td>
                <td className="border border-gray-300 p-2">Jueves 1 de Agosto a Sábado 10 de Agosto o hasta alcanzar la cantidad de 100 trabajos</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">Revisión y selección de trabajos:</td>
                <td className="border border-gray-300 p-2">Lunes 12 a Viernes 23 de Agosto</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">Publicación trabajos seleccionados:</td>
                <td className="border border-gray-300 p-2">Lunes 26 de Agosto</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">Período de apelación:</td>
                <td className="border border-gray-300 p-2">Miércoles 28 de Agosto a Viernes 30 de Agosto (a las 23:59 hrs)</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">Fecha de presentación de trabajos (pósters):</td>
                <td className="border border-gray-300 p-2">Viernes 13 de Septiembre</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">Envío de certificados de participación:</td>
                <td className="border border-gray-300 p-2">Viernes 20 de Septiembre</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">Publicación libro resumen:</td>
                <td className="border border-gray-300 p-2">Viernes 20 de Septiembre</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">Período de solicitud de correcciones de certificados y libro resumen:</td>
                <td className="border border-gray-300 p-2">5 días hábiles desde la fecha de emisión</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mb-6"></div>
        <p>*El comité organizador se reserva el derecho a establecer fechas suplementarias para recepción y revisión de trabajos, las cuales serán debidamente informadas a los participantes</p>

        <div className="flex justify-center mb-8"></div>
        <div className="flex justify-center mb-4">
          <h2 className="text-3xl font-bold text-[#00778B]">DOCUMENTOS</h2>
        </div>
        <div className="flex justify-center mb-6">
          <hr className="w-full border-t-2 border-gray-300" />
        </div>

        <div className="px-8 sm:px-8 lg:px-8">
          <div className="max-w-7xl mx-auto grid gap-8 grid-cols-1 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3">
            <InfoCard text="Bases Competencia Científica" />
            <InfoCard text="Trabajos aceptados" />
            <InfoCard text="Distribución de Paneles" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AboutPage;
```
- [ ] Step: Create `src/app/contact/page.tsx` (faithful port):
```tsx
// src/app/contact/page.tsx
import React from 'react';
import Header from '@/components/header';

const Contact: React.FC = () => {
  return (
    <div>
      <Header />
      <div className="max-w-8xl mx-auto p-6">
        <div className="flex justify-center mb-4">
          <h2 className="text-3xl font-bold text-[#00778B]">CONTACTO</h2>
        </div>
        <div className="flex justify-center mb-6">
          <hr className="w-full border-t-2 border-gray-300" />
        </div>
        <div className="flex flex-col items-center space-y-4">
          <a href="mailto:contacto@ccemuc.cl" className="text-lg text-blue-600 hover:underline">
            contacto@ccemuc.cl
          </a>
          <a
            href="https://www.instagram.com/ccem.uc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg text-blue-600 hover:underline"
          >
            Instagram: ccem.uc
          </a>
        </div>
      </div>
    </div>
  );
};

export default Contact;
```
- [ ] Step: Create `src/app/references/page.tsx` (faithful port):
```tsx
// src/app/references/page.tsx
import React from 'react';
import Header from '@/components/header';
import InfoCard from '@/components/InfoCard';

const ReferencesPage = () => {
  return (
    <div>
      <Header />
      <div className="max-w-8xl mx-auto p-6">
        <div className="flex justify-center mb-4">
          <h2 className="text-3xl font-bold text-[#00778B]">CERTIFICADOS Y LIBROS</h2>
        </div>
        <div className="flex justify-center mb-6">
          <hr className="w-full border-t-2 border-gray-300" />
        </div>
      </div>

      <div className="px-8 sm:px-8 lg:px-8">
        <div className="max-w-7xl mx-auto grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          <InfoCard text="Certificados de asistencia" />
          <InfoCard text="Certificados de aprobación" />
          <InfoCard text="Certificados de presentación" />
          <InfoCard text="Libro de competencia científica" />
        </div>
      </div>
    </div>
  );
};

export default ReferencesPage;
```
- [ ] Step: Create `src/app/schedule/page.tsx` (faithful port):
```tsx
// src/app/schedule/page.tsx
import React from 'react';
import Header from '@/components/header';
import InfoCard from '@/components/InfoCard';

const SchedulePage = () => {
  return (
    <div>
      <Header />
      <div className="max-w-8xl mx-auto p-6">
        <div className="flex justify-center mb-4">
          <h2 className="text-3xl font-bold text-[#00778B]">CRONOGRAMAS</h2>
        </div>
        <div className="flex justify-center mb-6">
          <hr className="w-full border-t-2 border-gray-300" />
        </div>
      </div>

      <div className="px-8 sm:px-8 lg:px-8">
        <div className="max-w-7xl mx-auto grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          <InfoCard text="Sábado 31/08" />
          <InfoCard text="Sábado 07/09" />
          <InfoCard text="Sábado 14/09" />
          <InfoCard text="Semana 1" />
          <InfoCard text="Semana 2" />
          <InfoCard text="Semana 3" />
        </div>
      </div>
    </div>
  );
};

export default SchedulePage;
```
- [ ] Step: Run the full Phase 7 test set to confirm no regressions. Command: `cd /home/rodrigoogalde/Personal/CCemuc/app && npx vitest run tailwind.config.test.ts src/components/images/images.test.ts src/components/header.test.tsx src/components/mainPage/firstSection.test.tsx src/components/main.test.tsx src/app/modules/page.test.tsx`. Expected: all suites pass.
- [ ] Step: Commit. `cd /home/rodrigoogalde/Personal/CCemuc/app && git add src/app/page.tsx src/app/about/page.tsx src/app/contact/page.tsx src/app/references/page.tsx src/app/schedule/page.tsx src/components/modulePage/moduleInfo.tsx src/app/modules/page.tsx src/app/modules/page.test.tsx && git commit -m "feat: port landing, info pages and modules page (getCourses server fetch)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

## Phase 8 — Registration flow (/pricing + /form)

This phase ports the two-step public registration journey from the static frontend (`frontend/src/app/pricing/page.tsx` + `frontend/src/app/form/page.tsx`) into the monolith, replacing every `axios` → REST call with the server actions produced in earlier phases (`getCourses`, `getCourseById`, `getUserByRut`, `getUserById`, `createUser`, `getUserPurchases`, `createPurchase`). Three behavioral changes are baked in per the locked decisions: (1) the hardcoded `return` "No disponible" gate in `/pricing` becomes an env gate driven by `REGISTRATION_OPEN`; (2) the client-side `AUTH_TOKEN` / `Authorization: Bearer` header is removed entirely — admin gating now lives server-side, and these public actions need no secret (security win: no token ships to the browser); (3) RUT validation uses the single shared `src/domain/rut.ts` validator (which returns ENGLISH messages) instead of the duplicated `utils/rut.ts`; the form maps known RUT messages to Spanish for display via a small `RUT_MESSAGE_ES` map. The selection state machine (`handleSelectCourse`/`handleSelectPass`/`handleConfirmSelection` → `router.push('/form?w1id=&w2id=[&w3id=]')`), `localStorage('user_id')` preload, and the hidden-form POST redirect to Webpay (`redirectToWebPay`) are preserved verbatim.

Server Components cannot read `'use client'` page state, so both pages stay client components; the env gate value (`REGISTRATION_OPEN`) is read server-side and threaded into `/pricing` via a thin Server Component wrapper so the secret-free boolean is the only thing crossing the boundary. All tests mock the action modules with `vi.mock` so no live DB/gateway is needed; `next/navigation` and `localStorage` are stubbed.

### Task 36: Shared inscription components — `CourseModule`, `WeekSection`, `CourseInfo`

Port the three presentational/data inscription components. `CourseModule` and `WeekSection` are pure presentational (no network); `CourseInfo` reads the `w*id` URL params and resolves each course via the `getCourseById` action (replacing the per-id `axios GET /courses/:id` loop). Drop the dead `Course.description` field — the ported `Course` type comes from earlier phases and has no `description`.

**Files:**
- Create: `app/src/components/inscriptions/courseModule.tsx`
- Create: `app/src/components/inscriptions/weekSection.tsx`
- Create: `app/src/components/courseInfo.tsx`
- Reference existing (from Phase 7): `app/src/components/images/images.tsx`
- Test: `app/src/components/courseInfo.test.tsx`

**Interfaces:**
- Consumes: `getCourseById(id: string): Promise<ActionResult<Course>>` (from `src/actions/courses.ts`, Phase: courses); `Course` type (imported as `import type { Course } from '@/actions/courses'`, which re-exports the Prisma model — `{ id, title, module, type, price, capacity, features, week, topics }`, NO `description`); `EventsCardProps`, `WeekSectionProps` (port into a shared local props module — see step 1).
- Produces: `CourseModule: React.FC<EventsCardProps>`, `WeekSection: React.FC<WeekSectionProps>`, `CourseInfo: React.FC` (default exports), consumed by Tasks 37 & 38.

Steps:

- [ ] Step: Create the shared props/types module the components need. Write `app/src/components/inscriptions/types.ts`:
  ```ts
  import type { Course } from '@/actions/courses';

  export interface EventsCardProps {
    id: string;
    title: string;
    module: number;
    features: Record<string, string>;
    buttonText: string;
    actionOnClick: () => void;
    clicked?: boolean;
  }

  export interface WeekSectionProps {
    title: string;
    subtitle: string;
    courses: Course[];
    handleSelectCourse: (course: Course) => void;
    selectedWeek: Course | null;
    weekNumber: number;
  }
  ```

- [ ] Step: Fix 13 — do NOT re-create the course-image dictionary or re-copy the card assets here. The Phase 7 shell task already created `src/components/images/images.tsx` (default-exporting `courseImagesDictionary`, keys 1–8) and copied the card images under `src/components/images/cards/`. `CourseModule` below imports the existing `@/components/images/images`.

- [ ] Step: Write the failing test for `CourseInfo` (the only component with logic worth a test — it resolves URL params via the action). Write `app/src/components/courseInfo.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, waitFor } from '@testing-library/react';
  import { ok } from '@/domain/result';

  const getCourseById = vi.fn();
  vi.mock('@/actions/courses', () => ({ getCourseById: (id: string) => getCourseById(id) }));

  let params = new URLSearchParams();
  vi.mock('next/navigation', () => ({ useSearchParams: () => params }));

  import CourseInfo from './courseInfo';

  describe('CourseInfo', () => {
    beforeEach(() => {
      getCourseById.mockReset();
      params = new URLSearchParams('w1id=a&w2id=b');
    });

    it('resolves each w*id param via getCourseById and renders the titles', async () => {
      getCourseById.mockImplementation((id: string) =>
        Promise.resolve(ok({ id, title: id === 'a' ? 'Modulo A' : 'Modulo B', module: 1, features: {} })),
      );
      render(<CourseInfo />);
      await waitFor(() => {
        expect(screen.getByText('Modulo A')).toBeInTheDocument();
        expect(screen.getByText('Modulo B')).toBeInTheDocument();
      });
      expect(getCourseById).toHaveBeenCalledWith('a');
      expect(getCourseById).toHaveBeenCalledWith('b');
    });

    it('skips failed lookups and renders only the resolved courses', async () => {
      getCourseById.mockImplementation((id: string) =>
        id === 'a'
          ? Promise.resolve(ok({ id, title: 'Modulo A', module: 1, features: {} }))
          : Promise.resolve({ ok: false as const, error: 'Course not found', status: 404 }),
      );
      render(<CourseInfo />);
      await waitFor(() => expect(screen.getByText('Modulo A')).toBeInTheDocument());
      expect(screen.queryByText('Modulo B')).not.toBeInTheDocument();
    });
  });
  ```

- [ ] Step: Run it, expect FAIL. Command: `cd app && npx vitest run src/components/courseInfo.test.tsx`. Expected: failure `Failed to resolve import "./courseInfo"` (file does not exist yet).

- [ ] Step: Implement `app/src/components/courseInfo.tsx` (replaces the axios loop with `getCourseById`):
  ```tsx
  'use client';

  import React, { useState, useEffect } from 'react';
  import { useSearchParams } from 'next/navigation';
  import { getCourseById } from '@/actions/courses';
  import type { Course } from '@/actions/courses';

  const CourseInfo: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const searchParams = useSearchParams();

    useEffect(() => {
      const ids = [
        searchParams.get('w1id') ?? '',
        searchParams.get('w2id') ?? '',
        searchParams.get('w3id') ?? '',
      ].filter((id) => id !== '');

      let cancelled = false;
      (async () => {
        const resolved: Course[] = [];
        for (const id of ids) {
          const res = await getCourseById(id);
          if (res.ok) resolved.push(res.data);
        }
        if (!cancelled) setCourses(resolved);
      })();

      return () => {
        cancelled = true;
      };
    }, [searchParams]);

    return (
      <div>
        {courses.length > 0 ? (
          <div>
            <h2 className="text-lg mb-2">Estás inscribiendo:</h2>
            {courses.map((course) => (
              <div key={course.id}>
                <p className="text-base mb-1">{course.title}</p>
              </div>
            ))}
          </div>
        ) : (
          <h2 className="text-lg mb-8">Cargando...</h2>
        )}
      </div>
    );
  };

  export default CourseInfo;
  ```

- [ ] Step: Implement `app/src/components/inscriptions/courseModule.tsx` (pure port, `EventsCardProps` from local types):
  ```tsx
  import React from 'react';
  import Image from 'next/image';
  import courseImagesDictionary from '@/components/images/images';
  import type { EventsCardProps } from './types';

  const CourseModule: React.FC<EventsCardProps> = ({ title, module, features, buttonText, actionOnClick, clicked }) => {
    return (
      <div className="flex flex-col lg:flex-row border-2 border-gray-300 rounded-3xl p-4">
        <div className="flex-none w-full lg:w-1/4 mb-4 lg:mb-0">
          <div>
            <Image src={courseImagesDictionary[module]} alt="Course Module" className="rounded-3xl" layout="responsive" />
          </div>
        </div>
        <div className="flex-1 lg:ml-10">
          <div className="mb-4">
            <h1 className="font-league-spartan font-bold text-black uppercase text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-5xl">
              {title}
            </h1>
          </div>
          <div className="mb-4">
            {!clicked ? (
              <button
                className="align-middle select-none font-sans font-bold text-center uppercase transition-all disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none text-base md:text-lg lg:text-xl py-2 px-4 rounded-lg border border-blue-500 text-blue-500 hover:opacity-75 focus:ring focus:ring-blue-200 active:opacity-[0.85] block w-full mt-6 max-w-[180px]"
                type="button"
                onClick={actionOnClick}
              >
                {buttonText}
              </button>
            ) : (
              <button
                className="align-middle select-none font-sans font-bold text-center uppercase transition-all disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none text-base md:text-lg lg:text-xl py-2 px-4 rounded-lg border border-green-500 text-green-500 hover:opacity-75 focus:ring focus:ring-green-200 active:opacity-[0.85] block w-full mt-6 max-w-[180px]"
                type="button"
              >
                Seleccionado
              </button>
            )}
          </div>
          <div className="text-sm md:text-base lg:text-lg font-open-sans">
            <ul className="list-disc list-inside">
              {Object.entries(features).map(([key, value]) => (
                <li key={key}>
                  <b>{key}:</b> {value}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  export default CourseModule;
  ```

- [ ] Step: Implement `app/src/components/inscriptions/weekSection.tsx` (pure port):
  ```tsx
  import React from 'react';
  import CourseModule from '@/components/inscriptions/courseModule';
  import type { WeekSectionProps } from './types';

  const WeekSection: React.FC<WeekSectionProps> = ({ title, subtitle, courses, handleSelectCourse, selectedWeek, weekNumber }) => {
    return (
      <div>
        <div className="container mx-auto p-4">
          <div className="flex items-center mb-4">
            <h1 className="font-lato text-3xl md:text-4xl lg:text-5xl font-light text-[#6D6D6D]">{title}</h1>
            <h2 className="font-open-sans text-xl md:text-2xl lg:text-3xl font-light text-[#6D6D6D] ml-2">{subtitle}</h2>
          </div>
          <div className="grid gap-8">
            {courses
              .filter((event) => event.week === weekNumber)
              .map((event) => (
                <CourseModule
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  module={event.module}
                  features={(event.features ?? {}) as Record<string, string>}
                  buttonText={`${event.capacity} cupos disponibles`}
                  actionOnClick={() => handleSelectCourse(event)}
                  clicked={selectedWeek?.id === event.id}
                />
              ))}
          </div>
        </div>
      </div>
    );
  };

  export default WeekSection;
  ```

- [ ] Step: Run tests, expect PASS. Command: `cd app && npx vitest run src/components/courseInfo.test.tsx`. Expected: `2 passed`.

- [ ] Step: Commit.
  ```
  git add app/src/components/inscriptions/ app/src/components/courseInfo.tsx app/src/components/courseInfo.test.tsx && git commit -m "feat: port inscription components (CourseModule, WeekSection, CourseInfo) to server actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 37: `/pricing` page — env-gated selection wired to `getCourses()`

Port the pricing page. Replace `axios GET /courses` with the `getCourses()` action, and replace the hardcoded "No disponible" early `return` with a check on a `registrationOpen` prop derived server-side from `REGISTRATION_OPEN`. The pass/module selection state machine and `handleConfirmSelection` → `router.push('/form?...')` are preserved exactly. A thin Server Component wrapper (`page.tsx`) reads the env and renders the client component (`PricingClient`).

**Files:**
- Create: `app/src/app/pricing/page.tsx` (Server Component wrapper — reads env)
- Create: `app/src/app/pricing/PricingClient.tsx` (`'use client'` — the ported UI/state)
- Test: `app/src/app/pricing/PricingClient.test.tsx`

**Interfaces:**
- Consumes: `getCourses(): Promise<ActionResult<Course[]>>` (from `src/actions/courses.ts`); `Course` type; `WeekSection` (Task 36); `Header` (ported shell, Phase: landing/shell).
- Produces: `PricingClient: React.FC<{ registrationOpen: boolean }>` (consumed only by the wrapper); the `/form?w1id=&w2id=[&w3id=]` URL contract that Task 38 consumes.

Steps:

- [ ] Step: Write the failing test. Write `app/src/app/pricing/PricingClient.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, waitFor, fireEvent } from '@testing-library/react';
  import { ok } from '@/domain/result';

  const getCourses = vi.fn();
  vi.mock('@/actions/courses', () => ({ getCourses: () => getCourses() }));

  const push = vi.fn();
  vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

  vi.mock('@/components/header', () => ({ default: () => <div data-testid="header" /> }));

  import PricingClient from './PricingClient';

  const courses = [
    { id: 'c1', title: 'Sem1 A', module: 1, type: 'core', price: 0, capacity: 10, features: {}, week: 1, topics: [] },
    { id: 'c2', title: 'Sem2 A', module: 2, type: 'core', price: 0, capacity: 10, features: {}, week: 2, topics: [] },
    { id: 'w1', title: 'Workshop A', module: 3, type: 'workshop', price: 0, capacity: 10, features: {}, week: 3, topics: [] },
  ];

  describe('PricingClient', () => {
    beforeEach(() => {
      getCourses.mockReset();
      push.mockReset();
      getCourses.mockResolvedValue(ok(courses));
    });

    it('shows "No disponible" when registration is closed and does not fetch courses', () => {
      render(<PricingClient registrationOpen={false} />);
      expect(screen.getByText('No disponible')).toBeInTheDocument();
      expect(getCourses).not.toHaveBeenCalled();
    });

    it('fetches courses and shows the selection UI when registration is open', async () => {
      render(<PricingClient registrationOpen={true} />);
      await waitFor(() => expect(screen.getByText('INSCRIPCIONES')).toBeInTheDocument());
      expect(getCourses).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Selecciona tu pase')).toBeInTheDocument();
    });

    it('builds /form?w1id&w2id for a general pass (no workshop)', async () => {
      render(<PricingClient registrationOpen={true} />);
      await waitFor(() => expect(screen.getByText('INSCRIPCIONES')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Pase General Congreso'));
      fireEvent.click(screen.getByText('10 cupos disponibles', { selector: 'button' }));
      // week1 + week2 modules
      const buttons = screen.getAllByText('10 cupos disponibles');
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[1]);
      fireEvent.click(screen.getByText('Confirmar'));
      expect(push).toHaveBeenCalledWith('/form?w1id=c1&w2id=c2');
    });

    it('appends w3id when pass 2 (workshop) is selected', async () => {
      render(<PricingClient registrationOpen={true} />);
      await waitFor(() => expect(screen.getByText('INSCRIPCIONES')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Pase Congreso + Workshop'));
      const buttons = screen.getAllByText('10 cupos disponibles');
      // week1, week2, workshop modules each render one CourseModule button
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[1]);
      fireEvent.click(buttons[2]);
      fireEvent.click(screen.getByText('Confirmar'));
      expect(push).toHaveBeenCalledWith('/form?w1id=c1&w2id=c2&w3id=w1');
    });
  });
  ```

- [ ] Step: Run it, expect FAIL. Command: `cd app && npx vitest run src/app/pricing/PricingClient.test.tsx`. Expected: failure `Failed to resolve import "./PricingClient"`.

- [ ] Step: Implement the client component `app/src/app/pricing/PricingClient.tsx`. The env gate replaces the hardcoded `return`; `getCourses()` replaces the axios fetch; selection state and `handleConfirmSelection` are preserved:
  ```tsx
  'use client';

  import React, { useEffect, useState } from 'react';
  import { useRouter } from 'next/navigation';
  import Link from 'next/link';
  import Header from '@/components/header';
  import WeekSection from '@/components/inscriptions/weekSection';
  import { getCourses } from '@/actions/courses';
  import type { Course } from '@/actions/courses';

  const PricingClient: React.FC<{ registrationOpen: boolean }> = ({ registrationOpen }) => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [courseSelectedWeek1, setCourseSelectedWeek1] = useState<Course | null>(null);
    const [courseSelectedWeek2, setCourseSelectedWeek2] = useState<Course | null>(null);
    const [selectedWorkshop, setSelectedWorkshop] = useState<Course | null>(null);
    const [selectedPass, setSelectedPass] = useState(0);

    const router = useRouter();

    useEffect(() => {
      if (!registrationOpen) return;
      (async () => {
        const res = await getCourses();
        if (res.ok) setCourses(res.data);
      })();
    }, [registrationOpen]);

    const handleSelectCourse = (course: Course) => {
      if (course.week === 1) setCourseSelectedWeek1(course);
      else if (course.week === 2) setCourseSelectedWeek2(course);
      else if (course.type === 'workshop') setSelectedWorkshop(course);
    };

    const handleSelectPass = (buttonId: number) => {
      setSelectedPass(buttonId);
      if (selectedWorkshop != null) setSelectedWorkshop(null);
    };

    const handleConfirmSelection = () => {
      let url = `/form?w1id=${courseSelectedWeek1?.id}&w2id=${courseSelectedWeek2?.id}`;
      if (selectedPass === 2 || selectedWorkshop != null) {
        url += `&w3id=${selectedWorkshop?.id}`;
      }
      router.push(url);
    };

    const isAllCoursesSelected = () =>
      courseSelectedWeek1 != null &&
      courseSelectedWeek2 != null &&
      (selectedPass === 1 || (selectedPass === 2 && selectedWorkshop != null));

    if (!registrationOpen) {
      return (
        <div>
          <Header />
          <section className="bg-white dark:bg-gray-900">
            <div className="container flex items-center min-h-screen px-6 py-12 mx-auto">
              <div>
                <h1 className="mt-3 text-2xl font-semibold text-gray-800 dark:text-white md:text-3xl">No disponible</h1>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Lo sentimos, ya no esta disponible la inscripción de cursos</p>
                <div className="flex items-center mt-6 gap-x-3">
                  <Link href="/">
                    <button className="w-1/2 px-5 py-2 text-sm tracking-wide text-white transition-colors duration-200 bg-blue-500 rounded-lg shrink-0 sm:w-auto hover:bg-blue-600 dark:hover:bg-blue-500 dark:bg-blue-600">
                      Ir a inicio
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      );
    }

    if (courses.length === 0) {
      return (
        <div>
          <Header />
          <div className="min-h-screen overflow-auto flex items-center justify-center" style={{ background: '#edf2f7' }}>
            <section className="px-4 py-12">
              <div className="container mx-auto text-center">
                <h4 className="block antialiased tracking-normal font-sans text-4xl font-semibold leading-[1.3] text-blue-gray-900 mb-4">
                  Cargando cursos...
                </h4>
              </div>
            </section>
          </div>
        </div>
      );
    }

    return (
      <div>
        <Header />
        <div className="mt-10">
          <div className="flex justify-center mb-4">
            <h2 className="text-3xl font-bold text-[#00778B]">INSCRIPCIONES</h2>
          </div>
          <div className="flex justify-center mb-6">
            <hr className="w-full border-t-2 border-gray-300" />
          </div>
        </div>

        <div className="container mx-auto p-4">
          <div className="flex items-center mb-4">
            <h1 className="font-lato text-3xl md:text-4xl lg:text-5xl font-light text-[#6D6D6D]">Paso 1</h1>
            <h2 className="font-open-sans text-xl md:text-2xl lg:text-3xl font-light text-[#6D6D6D] ml-2">Selecciona tu pase</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              className={`bg-[#116D85] text-white py-2 px-6 rounded-[8px] transition-colors flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-4 ${selectedPass === 1 ? 'bg-green-500' : 'hover:bg-[#0E5B6D]'}`}
              onClick={() => handleSelectPass(1)}
            >
              <span className="font-open-sans text-base sm:text-lg md:text-2xl lg:text-2xl xl:text-2xl">Pase General Congreso</span>
              <span className="font-open-sans text-base sm:text-2lg md:text-2xl lg:text-2xl xl:text-2xl">$25.900</span>
            </button>
            <button
              className={`bg-[#116D85] text-white py-2 px-6 rounded-[8px] transition-colors flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-4 ${selectedPass === 2 ? 'bg-green-500' : 'hover:bg-[#0E5B6D]'}`}
              onClick={() => handleSelectPass(2)}
            >
              <span className="font-open-sans text-base sm:text-lg md:text-2xl lg:text-2xl xl:text-2xl">Pase Congreso + Workshop</span>
              <span className="font-open-sans text-base sm:text-2lg md:text-2xl lg:text-2xl xl:text-2xl">$28.900</span>
            </button>
          </div>
        </div>

        <div>
          <WeekSection title="Paso 2" subtitle="Selecciona tu módulo de la semana 1" courses={courses} handleSelectCourse={handleSelectCourse} selectedWeek={courseSelectedWeek1} weekNumber={1} />
          <WeekSection title="Paso 3" subtitle="Selecciona tu módulo de la semana 2" courses={courses} handleSelectCourse={handleSelectCourse} selectedWeek={courseSelectedWeek2} weekNumber={2} />
          <div>
            {selectedPass === 2 && (
              <WeekSection title="Paso 4" subtitle="Selecciona tu Workshop" courses={courses} handleSelectCourse={handleSelectCourse} selectedWeek={selectedWorkshop} weekNumber={3} />
            )}
          </div>
        </div>

        <div className="container mx-auto p-4">
          <div className="flex items-center mb-4">
            <h1 className="font-lato text-3xl md:text-4xl lg:text-5xl font-light text-[#6D6D6D]">Paso 5</h1>
            <h2 className="font-open-sans text-xl md:text-2xl lg:text-3xl font-light text-[#6D6D6D] ml-2">Procede al pago</h2>
          </div>
          <button
            onClick={handleConfirmSelection}
            className={`px-8 py-4 text-white font-semibold rounded-lg shadow-md focus:outline-none ${!isAllCoursesSelected() ? 'disabled cursor-not-allowed bg-gray-400' : 'bg-green-700 hover:bg-green-800'}`}
            disabled={!isAllCoursesSelected()}
          >
            Confirmar
          </button>
        </div>
      </div>
    );
  };

  export default PricingClient;
  ```

- [ ] Step: Implement the Server Component wrapper `app/src/app/pricing/page.tsx` (reads env server-side; only the boolean crosses to the client — `REGISTRATION_OPEN` defaults to open, matching `.env.example` default `'true'`):
  ```tsx
  import PricingClient from './PricingClient';

  export default function PricingPage() {
    const registrationOpen = (process.env.REGISTRATION_OPEN ?? 'true') !== 'false';
    return <PricingClient registrationOpen={registrationOpen} />;
  }
  ```

- [ ] Step: Run tests, expect PASS. Command: `cd app && npx vitest run src/app/pricing/PricingClient.test.tsx`. Expected: `4 passed`.

- [ ] Step: Commit.
  ```
  git add app/src/app/pricing/ && git commit -m "feat: port /pricing with REGISTRATION_OPEN env gate and getCourses action

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

### Task 38: `/form` page — identity + purchase creation via server actions (no client token)

Port the form page. Replace all five axios calls with server actions — `getUserById` (preload), `getUserByRut` (find by RUT), `createUser` (new user), `getUserPurchases` (already-paid check), `createPurchase` — and remove the `auth_token`/`Authorization: Bearer` plumbing entirely (security win: no secret reaches the browser; these public actions need none). RUT validation now uses the shared `src/domain/rut.ts`. `localStorage('user_id')` and the hidden-form `redirectToWebPay` POST are preserved. Two contract adjustments vs. the old REST flow: branches now read the `ActionResult` discriminated union (`res.ok`), and `getUserByRut` "not found" is `fail('User not found', 404)` (no exception) rather than an axios 404 throw. The free-order branch uses the canonical `createPurchase` shape: `res.data.purchase.id` (not the old double-nested `purchase.purchase.id`).

**Files:**
- Create: `app/src/app/form/page.tsx` (Server Component wrapper — Suspense boundary for `useSearchParams`)
- Create: `app/src/app/form/FormClient.tsx` (`'use client'` — ported UI/flow)
- Reference existing (from Phase 7): `app/src/utils/universities.json`
- Test: `app/src/app/form/FormClient.test.tsx`

**Interfaces:**
- Consumes: `getUserByRut(rut: string): Promise<ActionResult<User>>`; `getUserById(id: string): Promise<ActionResult<User>>`; `createUser(input: UserCreateInput): Promise<ActionResult<User>>`; `getUserPurchases(userId: string): Promise<ActionResult<Purchase[]>>`; `createPurchase(input: PurchaseCreateInput): Promise<ActionResult<{ purchase: Purchase; webPayResponse?: { token: string; url: string } }>>` (all from `src/actions/users.ts` & `src/actions/purchases.ts`); `isRut(rut: string): { status: boolean; message: string }` (from `src/domain/rut.ts`); `CourseInfo` (Task 36); `Header` (shell).
- Produces: `FormClient: React.FC` (consumed by the wrapper). No new exported contract.

Steps:

- [ ] Step: Fix 13 — do NOT re-create `src/utils/universities.json`; the Phase 7 shell task already created it. `FormClient` imports the existing `@/utils/universities.json`.

- [ ] Step: Write the failing test covering the branch matrix (new user → purchase+webpay redirect; existing user; already-paid → /error; free order → /confirmation; email 409 dup; RUT invalid). Write `app/src/app/form/FormClient.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import { ok, fail } from '@/domain/result';

  const getUserByRut = vi.fn();
  const getUserById = vi.fn();
  const createUser = vi.fn();
  vi.mock('@/actions/users', () => ({
    getUserByRut: (rut: string) => getUserByRut(rut),
    getUserById: (id: string) => getUserById(id),
    createUser: (input: unknown) => createUser(input),
  }));

  const getUserPurchases = vi.fn();
  const createPurchase = vi.fn();
  vi.mock('@/actions/purchases', () => ({
    getUserPurchases: (id: string) => getUserPurchases(id),
    createPurchase: (input: unknown) => createPurchase(input),
  }));

  const push = vi.fn();
  let params = new URLSearchParams('w1id=c1&w2id=c2');
  vi.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
    useSearchParams: () => params,
  }));

  vi.mock('@/components/header', () => ({ default: () => <div data-testid="header" /> }));
  vi.mock('@/components/courseInfo', () => ({ default: () => <div data-testid="courseinfo" /> }));

  import FormClient from './FormClient';

  const fillValidForm = () => {
    fireEvent.change(screen.getByPlaceholderText('Ingresa tus nombres'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByPlaceholderText('Ingresa tus apellidos'), { target: { value: 'Lovelace' } });
    fireEvent.change(screen.getByPlaceholderText('Ingresa tu RUT'), { target: { value: '11111111-1' } });
    fireEvent.change(screen.getByPlaceholderText('Ingresa tu correo'), { target: { value: 'ada@uc.cl' } });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Pontificia Universidad Católica de Chile' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '3' } });
  };

  describe('FormClient', () => {
    beforeEach(() => {
      [getUserByRut, getUserById, createUser, getUserPurchases, createPurchase, push].forEach((m) => m.mockReset());
      params = new URLSearchParams('w1id=c1&w2id=c2');
      const store: Record<string, string> = {};
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      });
      // jsdom does not implement form.submit; stub it.
      HTMLFormElement.prototype.submit = vi.fn();
    });

    it('blocks submit and shows an error when the RUT is invalid', async () => {
      render(<FormClient />);
      fillValidForm();
      fireEvent.change(screen.getByPlaceholderText('Ingresa tu RUT'), { target: { value: '12345678' } });
      fireEvent.click(screen.getByText('Inscribir y pagar'));
      // Fix 14: isRut returns English ('RUT must contain dashes'); the form maps it to Spanish for display.
      await waitFor(() => expect(screen.getByText('RUT debe contener guión')).toBeInTheDocument());
      expect(createPurchase).not.toHaveBeenCalled();
    });

    it('existing user (found by RUT) → skips createUser, no prior paid purchase → createPurchase → webpay redirect', async () => {
      getUserByRut.mockResolvedValue(ok({ id: 'u1', names: 'Ada' }));
      getUserPurchases.mockResolvedValue(ok([]));
      createPurchase.mockResolvedValue(ok({ purchase: { id: 'p1' }, webPayResponse: { token: 'tkn', url: 'https://wp.test/pay' } }));
      render(<FormClient />);
      fillValidForm();
      fireEvent.click(screen.getByText('Inscribir y pagar'));
      await waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ userId: 'u1', coursesIds: ['c1', 'c2'] }));
      expect(createUser).not.toHaveBeenCalled();
      expect(HTMLFormElement.prototype.submit).toHaveBeenCalled();
    });

    it('new user (RUT not found) → createUser → createPurchase', async () => {
      getUserByRut.mockResolvedValue(fail('User not found', 404));
      createUser.mockResolvedValue(ok({ id: 'u2' }));
      getUserPurchases.mockResolvedValue(ok([]));
      createPurchase.mockResolvedValue(ok({ purchase: { id: 'p2' }, webPayResponse: { token: 't', url: 'https://wp.test/pay' } }));
      render(<FormClient />);
      fillValidForm();
      fireEvent.click(screen.getByText('Inscribir y pagar'));
      await waitFor(() => expect(createUser).toHaveBeenCalled());
      expect(createPurchase).toHaveBeenCalledWith({ userId: 'u2', coursesIds: ['c1', 'c2'] });
    });

    it('already-paid → redirects to /error with alreadyPaid=true and does not create a purchase', async () => {
      getUserByRut.mockResolvedValue(ok({ id: 'u3' }));
      getUserPurchases.mockResolvedValue(ok([{ id: 'p3', isPaid: true }]));
      render(<FormClient />);
      fillValidForm();
      fireEvent.click(screen.getByText('Inscribir y pagar'));
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(push.mock.calls[0][0]).toContain('alreadyPaid=true');
      expect(push.mock.calls[0][0]).toContain('p3');
      expect(createPurchase).not.toHaveBeenCalled();
    });

    it('free order (no webPayResponse) → router.push to /confirmation with purchase id', async () => {
      getUserByRut.mockResolvedValue(ok({ id: 'u4' }));
      getUserPurchases.mockResolvedValue(ok([]));
      createPurchase.mockResolvedValue(ok({ purchase: { id: 'p4' } }));
      render(<FormClient />);
      fillValidForm();
      fireEvent.click(screen.getByText('Inscribir y pagar'));
      await waitFor(() => expect(push).toHaveBeenCalledWith('/confirmation/?purchaseId=p4'));
      expect(HTMLFormElement.prototype.submit).not.toHaveBeenCalled();
    });

    it('duplicate email (createUser → 409 on email) → alerts and stops', async () => {
      getUserByRut.mockResolvedValue(fail('User not found', 404));
      createUser.mockResolvedValue(fail('Email already registered', 409, 'email'));
      const alertSpy = vi.fn();
      vi.stubGlobal('alert', alertSpy);
      render(<FormClient />);
      fillValidForm();
      fireEvent.click(screen.getByText('Inscribir y pagar'));
      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(createPurchase).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] Step: Run it, expect FAIL. Command: `cd app && npx vitest run src/app/form/FormClient.test.tsx`. Expected: failure `Failed to resolve import "./FormClient"`.

- [ ] Step: Implement `app/src/app/form/FormClient.tsx`. All axios → actions; `ActionResult.ok` branching; shared `isRut`; no token; `localStorage` and `redirectToWebPay` preserved:
  ```tsx
  'use client';

  import React, { useState, useEffect } from 'react';
  import { useSearchParams, useRouter } from 'next/navigation';
  import Header from '@/components/header';
  import CourseInfo from '@/components/courseInfo';
  import { isRut } from '@/domain/rut';
  import { getUserByRut, getUserById, createUser } from '@/actions/users';
  import { getUserPurchases, createPurchase } from '@/actions/purchases';
  import universities from '@/utils/universities.json';

  // Fix 14: the shared validator (src/domain/rut.ts) returns ENGLISH messages; map the
  // known ones to Spanish for display. Unknown messages fall through unchanged.
  const RUT_MESSAGE_ES: Record<string, string> = {
    'RUT must not contain dots Format: XX.XXX.XXX-X': 'RUT no debe contener puntos. Formato: XX.XXX.XXX-X',
    'RUT must contain dashes': 'RUT debe contener guión',
    'RUT without DV must have 9 or 10 digits': 'El RUT sin dígito verificador debe tener 7 u 8 dígitos',
  };

  const translateRutMessage = (message: string): string => {
    if (message.startsWith('Invalid DV. Expected:')) {
      return message.replace('Invalid DV. Expected:', 'Dígito verificador inválido. Esperado:');
    }
    return RUT_MESSAGE_ES[message] ?? message;
  };

  const FormClient: React.FC = () => {
    const [name, setName] = useState('');
    const [showErrorName, setShowErrorName] = useState(false);
    const [lastName, setLastName] = useState('');
    const [showErrorLastName, setShowErrorLastName] = useState(false);
    const [email, setEmail] = useState('');
    const [showErrorEmail, setShowErrorEmail] = useState(false);
    const [rut, setRut] = useState('');
    const [showErrorRut, setShowErrorRut] = useState(false);
    const [errorMessageRut, setErrorMessageRut] = useState('');
    const [university, setUniversity] = useState('');
    const [showErrorUniversity, setShowErrorUniversity] = useState(false);
    const [year, setYear] = useState('');
    const [showErrorYear, setShowErrorYear] = useState(false);

    const [search, setSearch] = useState<string[]>([]);

    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
      const params = [
        searchParams.get('w1id') ?? '',
        searchParams.get('w2id') ?? '',
        searchParams.get('w3id') ?? '',
      ].filter((p) => p !== '');
      setSearch(params);
    }, [searchParams]);

    const preLoadInfoUser = async () => {
      const storedId = localStorage.getItem('user_id');
      if (!storedId) return;
      const res = await getUserById(storedId);
      if (res.ok) {
        const user = res.data;
        setName(user.names);
        setLastName(user.lastNames);
        setRut(user.rut);
        setEmail(user.email);
        setUniversity(user.university);
        setYear(String(user.carrerYear));
      } else if (res.status === 404) {
        localStorage.removeItem('user_id');
      }
    };

    useEffect(() => {
      preLoadInfoUser();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleError = () => {
      setShowErrorName(!name);
      setShowErrorLastName(!lastName);
      setShowErrorEmail(!email);
      setShowErrorRut(!rut);
      setShowErrorUniversity(!university);
      setShowErrorYear(!year);

      if (!rut) setErrorMessageRut('Falta tu RUT');

      const rutValidation = isRut(rut);
      if (!rutValidation.status) {
        setShowErrorRut(true);
        setErrorMessageRut(translateRutMessage(rutValidation.message));
      }

      if (!(name && lastName && email && rut && university && year && rutValidation.status)) {
        return;
      }

      sendForms();
    };

    const sendForms = async () => {
      let userId = await getUserIdFromRut(rut);
      if (userId === '') userId = await createUserAndGetId();
      if (userId === '') return;

      if (await checkIfUserAlreadyPaid(userId)) return;
      await createPurchaseAndRedirect(userId);
    };

    const getUserIdFromRut = async (value: string): Promise<string> => {
      const res = await getUserByRut(value);
      if (res.ok) {
        localStorage.setItem('user_id', res.data.id);
        return res.data.id;
      }
      // 404 (not found) is the expected "new user" branch.
      return '';
    };

    const createUserAndGetId = async (): Promise<string> => {
      const res = await createUser({
        names: name,
        lastNames: lastName,
        rut,
        email,
        university,
        carrerYear: Number(year),
      });
      if (res.ok) {
        localStorage.setItem('user_id', res.data.id);
        return res.data.id;
      }
      if (res.status === 409 && res.field === 'email') {
        alert('El correo ya se encuentra asociado a otro RUT registrado');
      }
      return '';
    };

    const checkIfUserAlreadyPaid = async (userId: string): Promise<boolean> => {
      const res = await getUserPurchases(userId);
      if (!res.ok) return false;
      const purchases = res.data;
      const paid = purchases.find((p) => p.isPaid);
      if (paid) {
        router.push(`/error/?message=Codigo de confirmacion ${paid.id}&alreadyPaid=true`);
        return true;
      }
      return false;
    };

    const createPurchaseAndRedirect = async (userId: string) => {
      const res = await createPurchase({ userId, coursesIds: search });
      if (!res.ok) {
        router.push(`/error/?message=${encodeURIComponent(res.error)}`);
        return;
      }
      const { purchase, webPayResponse } = res.data;
      if (webPayResponse) {
        redirectToWebPay(webPayResponse.url, webPayResponse.token);
      } else {
        router.push(`/confirmation/?purchaseId=${purchase.id}`);
      }
    };

    const redirectToWebPay = (url: string, token: string) => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url;
      const hiddenField = document.createElement('input');
      hiddenField.type = 'hidden';
      hiddenField.name = 'token_ws';
      hiddenField.value = token;
      form.appendChild(hiddenField);
      document.body.appendChild(form);
      form.submit();
    };

    return (
      <div>
        <Header />
        <div className="min-h-screen bg-gray-100 p-0 sm:p-12">
          <div className="mx-auto max-w-md px-6 py-12 bg-white border-0 shadow-lg sm:rounded-3xl">
            <h1 className="text-2xl font-bold mb-4">Inscripción a curso</h1>
            <div className="mb-8">
              <CourseInfo />
            </div>
            <form id="form" noValidate>
              <div className="relative z-0 w-full mb-5">
                <input
                  type="text"
                  name="name"
                  placeholder="Ingresa tus nombres"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={`pt-3 pb-2 block w-full px-0 mt-0 bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 ${showErrorName ? 'border-red-600' : 'border-gray-200'}`}
                />
                <span className={`text-sm ${showErrorName ? 'text-red-600' : 'hidden'}`}>Faltan tus nombres</span>
              </div>

              <div className="relative z-0 w-full mb-5">
                <input
                  type="text"
                  name="lastname"
                  placeholder="Ingresa tus apellidos"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className={`pt-3 pb-2 block w-full px-0 mt-0 bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 ${showErrorLastName ? 'border-red-600' : 'border-gray-200'}`}
                />
                <span className={`text-sm ${showErrorLastName ? 'text-red-600' : 'hidden'}`}>Faltan tus apellidos</span>
              </div>

              <div className="relative z-0 w-full mb-5">
                <input
                  type="text"
                  name="rut"
                  placeholder="Ingresa tu RUT"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  required
                  className={`pt-3 pb-2 block w-full px-0 mt-0 bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 ${showErrorRut ? 'border-red-600' : 'border-gray-200'}`}
                />
                <span className={`text-sm ${showErrorRut ? 'text-red-600' : 'hidden'}`}>{errorMessageRut}</span>
              </div>

              <div className="relative z-0 w-full mb-5">
                <input
                  type="email"
                  name="email"
                  placeholder="Ingresa tu correo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`pt-3 pb-2 block w-full px-0 mt-0 bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 ${showErrorEmail ? 'border-red-600' : 'border-gray-200'}`}
                />
                <span className={`text-sm ${showErrorEmail ? 'text-red-600' : 'hidden'}`}>Falta tu correo</span>
              </div>

              <div className="relative z-0 w-full mb-5">
                <select
                  name="university"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className={`pt-3 pb-2 block w-full px-0 mt-0 bg-transparent border-0 border-b-2 appearance-none focus:outline-none focus:ring-0 ${showErrorUniversity ? 'border-red-600' : 'border-gray-200'}`}
                >
                  <option value="" disabled hidden></option>
                  {universities.universidades.map((uni) => (
                    <option key={uni} value={uni}>
                      {uni}
                    </option>
                  ))}
                </select>
                {!university && (
                  <label className="absolute duration-300 top-3 -z-1 origin-0 text-gray-500">Selecciona tu Universidad</label>
                )}
                <span className={`text-sm ${showErrorUniversity ? 'text-red-600' : 'hidden'}`}>Falta tu Universidad</span>
              </div>

              <div className="relative z-0 w-full mb-5">
                <select
                  name="year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className={`pt-3 pb-2 block w-full px-0 mt-0 bg-transparent border-0 border-b-2 appearance-none z-1 focus:outline-none focus:ring-0 ${showErrorYear ? 'border-red-600' : 'border-gray-200'}`}
                >
                  <option value="" disabled hidden></option>
                  {['1', '2', '3', '4', '5', '6', '7'].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                {!year && (
                  <label className="absolute duration-300 top-3 -z-1 origin-0 text-gray-500">Selecciona el año de tu carrera</label>
                )}
                <span className={`text-sm ${showErrorYear ? 'text-red-600' : 'hidden'}`}>Falta seleccionar el año de tu carrera</span>
              </div>

              <button
                id="button"
                type="button"
                onClick={toggleError}
                className="w-full px-6 py-3 mt-3 text-lg text-white transition-all duration-150 ease-linear rounded-lg shadow outline-none bg-pink-500 hover:bg-pink-600 hover:shadow-lg focus:outline-none"
              >
                Inscribir y pagar
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  export default FormClient;
  ```

- [ ] Step: Implement the Server Component wrapper `app/src/app/form/page.tsx` (Suspense around the client component because it reads `useSearchParams`):
  ```tsx
  import { Suspense } from 'react';
  import FormClient from './FormClient';

  export default function FormPage() {
    return (
      <Suspense fallback={<h2 className="text-lg p-12">Cargando...</h2>}>
        <FormClient />
      </Suspense>
    );
  }
  ```

- [ ] Step: Run tests, expect PASS. Command: `cd app && npx vitest run src/app/form/FormClient.test.tsx`. Expected: `6 passed`.

- [ ] Step: Run the full Phase 8 suite to confirm no regressions. Command: `cd app && npx vitest run src/components/courseInfo.test.tsx src/app/pricing/PricingClient.test.tsx src/app/form/FormClient.test.tsx`. Expected: `3 files, 12 passed`.

- [ ] Step: Commit.
  ```
  git add app/src/app/form/ && git commit -m "feat: port /form flow to server actions, drop client AUTH_TOKEN, share RUT validator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Phase 9 — Confirmation + error pages

This phase ports the final two pages of the public purchase journey. After Transbank redirects the user to `/confirmation?purchaseId=&token_ws=` (the Route Handler at `src/app/api/webpay/return/route.ts` from an earlier phase forwards the browser here), the page calls `confirmPurchase`, then loads the purchase/courses/user via the existing actions, renders the `BuyInfo` summary, and fires the confirmation email exactly once.

A deliberate improvement over the legacy frontend: the legacy code rendered the email HTML in the browser with `ReactDOMServer.renderToStaticMarkup` and POSTed the markup string to the backend. In the monolith we move HTML building **server-side** — `sendConfirmation` (from the Phase that ports `src/actions/purchases.ts`) already accepts a `purchaseId` and builds/sends the email itself, so the client never renders or ships email HTML. We therefore port `EmailConfirmation` as a pure HTML-string builder that lives server-side and is exercised by `sendConfirmation`; we keep the `BuyInfo` summary component for the on-page render. The `<Suspense>`-wrapped `useSearchParams` reader, the `TBK_*` abort-to-error redirect, the `isMailSent` duplicate guard, and the "Reenviar correo" button are all preserved. The error page ports the `message` + `alreadyPaid` variant + "Volver a intentar" link.

This phase **consumes** signatures produced by earlier phases and does not redefine them:
- `src/domain/result.ts`: `ActionResult<T>`, `ok`, `fail`.
- `src/actions/purchases.ts`: `confirmPurchase(purchaseId, tokenWs): Promise<ActionResult<{ purchase: Purchase; transactionStatus: unknown }>>`, `getPurchaseById(id): Promise<ActionResult<Purchase>>`, `sendConfirmation(input: SendConfirmationInput): Promise<ActionResult<null>>`.
- `src/actions/courses.ts`: `getCourses(): Promise<ActionResult<Course[]>>`, `getCourseById(id): Promise<ActionResult<Course>>`.
- `src/actions/users.ts`: `getUserById(id): Promise<ActionResult<User>>`.
- Prisma model row types `Purchase`, `Course`, `User` from `@prisma/client`.
- `src/components/header` (ported in an earlier shell phase).

### Task 39: Port EmailConfirmation as a server-side HTML builder

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mailConfirmation.tsx` (re-exports `buildConfirmationEmailHtml` from the Phase 6 `src/lib/confirmationEmail.tsx`)
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/mailConfirmation.test.ts`

**Interfaces:**
- Consumes: `buildConfirmationEmailHtml` from `@/lib/confirmationEmail` (Phase 6); Prisma `Course` row type from `@prisma/client` (fields `id, title, type, week, price`).
- Produces: `src/components/mailConfirmation.tsx` exporting BOTH `buildConfirmationEmailHtml` (re-exported from the Phase 6 `src/lib/confirmationEmail.tsx`) and an `EmailConfirmation` React component that renders the same HTML via `dangerouslySetInnerHTML`. (Fix 5: the canonical builder lives in `src/lib/confirmationEmail.tsx`, created in Phase 6 and called by `sendConfirmation`; this Phase 9 component REUSES it rather than redefining, so there is a single source of truth for the email HTML.)

Fix 5: the email HTML builder `buildConfirmationEmailHtml` is the canonical server util created in Phase 6 (`src/lib/confirmationEmail.tsx`) and called by `sendConfirmation`. This Phase 9 component file re-exports it and wraps it in an `EmailConfirmation` React component (for any on-page/preview use), so the builder is defined once. The builder ports the legacy `EmailConfirmation` table layout: logo header, "Confirmante de pago", confirmation code, core courses listed as "Módulo base N", non-core courses as "Semana {week}", the summed price, and the CCEMUC footer. The legacy version pulled the logo from a hashed `_next` asset URL; we use the stable public logo URL on `web.ccemuc.cl`.

- [ ] Step: Write the failing test.
```ts
// src/components/mailConfirmation.test.ts
import { describe, it, expect } from 'vitest';
import { buildConfirmationEmailHtml } from './mailConfirmation';

describe('buildConfirmationEmailHtml', () => {
  const courses = [
    { title: 'Anatomía', type: 'core' as const, week: 0, price: 10000 },
    { title: 'Trauma', type: 'core' as const, week: 0, price: 0 },
    { title: 'Cirugía Semana 1', type: 'elective' as const, week: 1, price: 15000 },
    { title: 'Taller Suturas', type: 'workshop' as const, week: 2, price: 5000 },
  ];

  it('includes the confirmation code (purchase id)', () => {
    const html = buildConfirmationEmailHtml({ id: 'abc-123', courses });
    expect(html).toContain('Tu código de confirmación es: abc-123');
  });

  it('lists core courses as numbered "Módulo base" entries', () => {
    const html = buildConfirmationEmailHtml({ id: 'x', courses });
    expect(html).toContain('Módulo base 1');
    expect(html).toContain('Módulo base 2');
    expect(html).toContain('Anatomía');
    expect(html).toContain('Trauma');
  });

  it('lists non-core courses by week and keeps workshop', () => {
    const html = buildConfirmationEmailHtml({ id: 'x', courses });
    expect(html).toContain('Semana 1');
    expect(html).toContain('Cirugía Semana 1');
    expect(html).toContain('Semana 2');
    expect(html).toContain('Taller Suturas');
  });

  it('sums the total price', () => {
    const html = buildConfirmationEmailHtml({ id: 'x', courses });
    // 10000 + 0 + 15000 + 5000 = 30000
    expect(html).toContain('$30000');
  });

  it('renders a full HTML document with the CCEMUC footer', () => {
    const html = buildConfirmationEmailHtml({ id: 'x', courses: [] });
    expect(html).toContain('Confirmante de pago');
    expect(html).toContain('Has recibido este correo por tu reciente compra');
    expect(html).toContain('https://web.ccemuc.cl/');
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/components/mailConfirmation.test.ts`. Expected failure: `Failed to resolve import "./mailConfirmation"` / `buildConfirmationEmailHtml is not a function`.
- [ ] Step: Implement the component (Fix 5 — re-export the Phase 6 builder; add a React wrapper). The canonical `buildConfirmationEmailHtml` is defined in `src/lib/confirmationEmail.tsx` (Phase 6); here we re-export it and expose `EmailConfirmation` for completeness.
```tsx
// src/components/mailConfirmation.tsx
import React from 'react';
import {
  buildConfirmationEmailHtml,
  type ConfirmationEmailInput,
} from '@/lib/confirmationEmail';

// Re-export the single-source-of-truth builder so callers/tests can import it from here too.
export { buildConfirmationEmailHtml };
export type { ConfirmationEmailInput, EmailCourse } from '@/lib/confirmationEmail';

/**
 * React wrapper around the canonical server-side builder. The email itself is sent by
 * sendConfirmation (which calls buildConfirmationEmailHtml directly); this component
 * exists only for on-page preview/parity with the legacy <EmailConfirmation />.
 */
export const EmailConfirmation: React.FC<ConfirmationEmailInput> = (input) => {
  return <div dangerouslySetInnerHTML={{ __html: buildConfirmationEmailHtml(input) }} />;
};

export default EmailConfirmation;
```
- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/components/mailConfirmation.test.ts`. Expected: 5 passed.
- [ ] Step: Commit.
```
git add src/components/mailConfirmation.tsx src/components/mailConfirmation.test.ts && git commit -m "feat: add server-side confirmation email HTML builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 40: Port the BuyInfo on-page order summary

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/buyInfo.tsx`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/buyInfo.test.tsx`

**Interfaces:**
- Consumes: Prisma `Course`, `User` row types from `@prisma/client`.
- Produces: `BuyInfo` (default export) — `React.FC<{ courses: Course[]; user: User | null }>`. Renders the order summary (Cursos: base modules from `week === 0`, Semana 1 / Semana 2 picks, optional Workshop, summed Precio, Nombre, RUT, Correo). Shows "Cargando..." until both `courses` and `user` are present. Consumed by `src/app/confirmation/page.tsx`.

This is a presentational component rendered with React Testing Library. We faithfully port the legacy `buyInfo.tsx` layout but drop its stray `console.log` and the unused `formatPrice` null-string indirection (the price is always a number sum). Price is shown as `$<number>` mirroring legacy `formatPrice(price.toString())` which produced `$<value>` (the `toLocaleString` on a plain string is a no-op).

- [ ] Step: Write the failing test.
```tsx
// src/components/buyInfo.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BuyInfo from './buyInfo';
import type { Course, User } from '@prisma/client';

const user = {
  id: 'u1', names: 'Ada', lastNames: 'Lovelace', rut: '11.111.111-1',
  email: 'ada@example.com', university: 'UC', carrerYear: 3,
  createdAt: new Date(), updatedAt: new Date(),
} as User;

const courses = [
  { id: 'c0', title: 'Base A', module: 1, type: 'core', price: 10000, capacity: 5, features: null, week: 0, topics: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'c1', title: 'Elec 1', module: 2, type: 'elective', price: 15000, capacity: 5, features: null, week: 1, topics: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'c2', title: 'Elec 2', module: 3, type: 'elective', price: 5000, capacity: 5, features: null, week: 2, topics: [], createdAt: new Date(), updatedAt: new Date() },
] as unknown as Course[];

describe('BuyInfo', () => {
  it('shows loading when user is null', () => {
    render(<BuyInfo courses={courses} user={null} />);
    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  it('shows loading when courses are empty', () => {
    render(<BuyInfo courses={[]} user={user} />);
    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  it('renders courses, summed price and user details', () => {
    render(<BuyInfo courses={courses} user={user} />);
    expect(screen.getByText('Base A')).toBeTruthy();
    expect(screen.getByText('Elec 1')).toBeTruthy();
    expect(screen.getByText('Elec 2')).toBeTruthy();
    expect(screen.getByText('$30000')).toBeTruthy(); // 10000+15000+5000
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('11.111.111-1')).toBeTruthy();
    expect(screen.getByText('ada@example.com')).toBeTruthy();
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/components/buyInfo.test.tsx`. Expected failure: `Failed to resolve import "./buyInfo"`.
- [ ] Step: Implement the component (complete code).
```tsx
// src/components/buyInfo.tsx
import React from 'react';
import type { Course, User } from '@prisma/client';

const BuyInfo: React.FC<{ courses: Course[]; user: User | null }> = ({ courses, user }) => {
  if (courses.length === 0 || !user) {
    return <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">Cargando...</p>;
  }

  const courseWeek0 = courses.filter((course) => course.week === 0);
  const courseWeek1 = courses.find((course) => course.week === 1);
  const courseWeek2 = courses.find((course) => course.week === 2);
  const courseWorkshop = courses.find((course) => course.type === 'workshop');
  const price = courses.reduce((sum, course) => sum + course.price, 0);

  return (
    <div>
      <div className="space-y-4 sm:space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800 mb-6 md:mb-8">
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">Cursos</dt>
        </dl>
        {courseWeek0.map((course, index) => (
          <dl key={course.id} className="sm:flex items-center justify-between gap-4">
            <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-600"> Módulo Base {index + 1}</dt>
            <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{course.title}</dd>
          </dl>
        ))}
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-600"> Semana 1</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{courseWeek1?.title}</dd>
        </dl>
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-600"> Semana 2</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{courseWeek2?.title}</dd>
        </dl>
        {courseWorkshop && (
          <dl className="sm:flex items-center justify-between gap-4">
            <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-600"> Workshop</dt>
            <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{courseWorkshop.title}</dd>
          </dl>
        )}
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">Precio</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">${price}</dd>
        </dl>
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">Nombre</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{user.names} {user.lastNames}</dd>
        </dl>
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">RUT</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{user.rut}</dd>
        </dl>
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">Correo</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{user.email}</dd>
        </dl>
      </div>
    </div>
  );
};

export default BuyInfo;
```
- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/components/buyInfo.test.tsx`. Expected: 3 passed.
- [ ] Step: Commit.
```
git add src/components/buyInfo.tsx src/components/buyInfo.test.tsx && git commit -m "feat: port BuyInfo order summary component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 41: Extract the confirmation orchestration into a testable hook

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/inscriptions/useConfirmation.ts`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/components/inscriptions/useConfirmation.test.tsx`

**Interfaces:**
- Consumes: `confirmPurchase`, `getPurchaseById`, `sendConfirmation` from `src/actions/purchases.ts`; `getCourses`, `getCourseById` from `src/actions/courses.ts`; `getUserById` from `src/actions/users.ts`; Prisma `Course`, `User`, `Purchase` types.
- Produces: `useConfirmation(params: { tokenWs: string | null; purchaseId: string | null; aborted: boolean }): { confirmed: boolean; courses: Course[]; user: User | null; isMailSent: boolean; errorRedirect: string | null; resendEmail: () => Promise<void> }`. Consumed by `src/app/confirmation/page.tsx`.

We isolate all the async orchestration (the legacy `fetchData`/`confirmPurchase`/`getInfoPurchase`/`sendConfirmationEmail` chain) into a hook so the branches can be unit-tested with mocked actions and `renderHook`, without a router, DOM, or live DB. The page (next task) becomes a thin shell that reads params and renders. Branch behavior we preserve and test:
- success: `confirmPurchase` ok -> load purchase, its bought courses (`getCourseById` per id) + core courses (from `getCourses`, filtered `type === 'core'`) + user (`getUserById`) -> auto-send email once -> `isMailSent` true.
- confirm failure (`ok: false`): set `errorRedirect` to `/error?message=<error>&token_ws=&purchaseId=`. The legacy `status 402` ("Pago no realizado")/`400` ("Compra rechazada") messages now arrive as `fail(...).error` from the action, so we surface `result.error`.
- aborted (`TBK_*` present, no `token_ws`): `errorRedirect` to `/error?message=Error en la compra...`.
- duplicate email guard: a second auto-run does not re-send while `isMailSent` is true; `resendEmail()` always re-sends (powers the "Reenviar correo" button).

All actions are mocked with `vi.mock`, so no DB/gateway is touched.

- [ ] Step: Write the failing test.
```tsx
// src/components/inscriptions/useConfirmation.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ok, fail } from '@/domain/result';

vi.mock('@/actions/purchases', () => ({
  confirmPurchase: vi.fn(),
  getPurchaseById: vi.fn(),
  sendConfirmation: vi.fn(),
}));
vi.mock('@/actions/courses', () => ({
  getCourses: vi.fn(),
  getCourseById: vi.fn(),
}));
vi.mock('@/actions/users', () => ({
  getUserById: vi.fn(),
}));

import { confirmPurchase, getPurchaseById, sendConfirmation } from '@/actions/purchases';
import { getCourses, getCourseById } from '@/actions/courses';
import { getUserById } from '@/actions/users';
import { useConfirmation } from './useConfirmation';

const purchase = { id: 'p1', userId: 'u1', buyOrder: 'bo', isPaid: true, coursesIds: ['c1'], createdAt: new Date(), updatedAt: new Date() };
const coreCourse = { id: 'core1', title: 'Base', module: 1, type: 'core', price: 0, capacity: 5, features: null, week: 0, topics: [], createdAt: new Date(), updatedAt: new Date() };
const boughtCourse = { id: 'c1', title: 'Elec', module: 2, type: 'elective', price: 15000, capacity: 5, features: null, week: 1, topics: [], createdAt: new Date(), updatedAt: new Date() };
const user = { id: 'u1', names: 'Ada', lastNames: 'L', rut: '1-9', email: 'a@b.cl', university: 'UC', carrerYear: 3, createdAt: new Date(), updatedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
});

function mockSuccess() {
  vi.mocked(confirmPurchase).mockResolvedValue(ok({ purchase, transactionStatus: { status: 'AUTHORIZED' } }) as any);
  vi.mocked(getPurchaseById).mockResolvedValue(ok(purchase) as any);
  vi.mocked(getCourseById).mockResolvedValue(ok(boughtCourse) as any);
  vi.mocked(getCourses).mockResolvedValue(ok([coreCourse, boughtCourse]) as any);
  vi.mocked(getUserById).mockResolvedValue(ok(user) as any);
  vi.mocked(sendConfirmation).mockResolvedValue(ok(null) as any);
}

describe('useConfirmation', () => {
  it('confirms, loads info (core + bought + user) and sends email once', async () => {
    mockSuccess();
    const { result } = renderHook(() =>
      useConfirmation({ tokenWs: 'tok', purchaseId: 'p1', aborted: false }),
    );

    await waitFor(() => expect(result.current.confirmed).toBe(true));
    await waitFor(() => expect(result.current.isMailSent).toBe(true));

    expect(confirmPurchase).toHaveBeenCalledWith('p1', 'tok');
    // core + bought courses both present, deduped
    const ids = result.current.courses.map((c) => c.id).sort();
    expect(ids).toEqual(['c1', 'core1']);
    expect(result.current.user?.email).toBe('a@b.cl');
    expect(sendConfirmation).toHaveBeenCalledTimes(1);
    expect(sendConfirmation).toHaveBeenCalledWith({ purchaseId: 'p1', email: 'a@b.cl' });
    expect(result.current.errorRedirect).toBeNull();
  });

  it('sets errorRedirect when confirm fails, and does not send email', async () => {
    vi.mocked(confirmPurchase).mockResolvedValue(fail('Pago no realizado', 402) as any);
    const { result } = renderHook(() =>
      useConfirmation({ tokenWs: 'tok', purchaseId: 'p1', aborted: false }),
    );

    await waitFor(() => expect(result.current.errorRedirect).not.toBeNull());
    expect(result.current.errorRedirect).toContain('/error');
    expect(result.current.errorRedirect).toContain('message=Pago%20no%20realizado');
    expect(result.current.confirmed).toBe(false);
    expect(sendConfirmation).not.toHaveBeenCalled();
  });

  it('redirects to error on Transbank abort (no token)', async () => {
    const { result } = renderHook(() =>
      useConfirmation({ tokenWs: null, purchaseId: null, aborted: true }),
    );
    await waitFor(() => expect(result.current.errorRedirect).not.toBeNull());
    expect(result.current.errorRedirect).toContain('message=Error%20en%20la%20compra');
    expect(confirmPurchase).not.toHaveBeenCalled();
  });

  it('resendEmail re-sends even after isMailSent is true', async () => {
    mockSuccess();
    const { result } = renderHook(() =>
      useConfirmation({ tokenWs: 'tok', purchaseId: 'p1', aborted: false }),
    );
    await waitFor(() => expect(result.current.isMailSent).toBe(true));
    expect(sendConfirmation).toHaveBeenCalledTimes(1);

    await result.current.resendEmail();
    expect(sendConfirmation).toHaveBeenCalledTimes(2);
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/components/inscriptions/useConfirmation.test.tsx`. Expected failure: `Failed to resolve import "./useConfirmation"`.
- [ ] Step: Implement the hook (complete code).
```ts
// src/components/inscriptions/useConfirmation.ts
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Course, User } from '@prisma/client';
import { confirmPurchase, getPurchaseById, sendConfirmation } from '@/actions/purchases';
import { getCourses, getCourseById } from '@/actions/courses';
import { getUserById } from '@/actions/users';

interface UseConfirmationParams {
  tokenWs: string | null;
  purchaseId: string | null;
  aborted: boolean;
}

interface UseConfirmationResult {
  confirmed: boolean;
  courses: Course[];
  user: User | null;
  isMailSent: boolean;
  errorRedirect: string | null;
  resendEmail: () => Promise<void>;
}

function errorUrl(message: string, tokenWs: string | null, purchaseId: string | null): string {
  const params = new URLSearchParams({
    message,
    token_ws: tokenWs ?? '',
    purchaseId: purchaseId ?? '',
  });
  return `/error?${params.toString()}`;
}

export function useConfirmation({ tokenWs, purchaseId, aborted }: UseConfirmationParams): UseConfirmationResult {
  const [confirmed, setConfirmed] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isMailSent, setIsMailSent] = useState(false);
  const [errorRedirect, setErrorRedirect] = useState<string | null>(null);
  const ranRef = useRef(false);

  const sendEmail = useCallback(
    async (targetUser: User | null, loaded: Course[]) => {
      if (!purchaseId || !targetUser || targetUser.email === '') return;
      const result = await sendConfirmation({ purchaseId, email: targetUser.email });
      if (result.ok) setIsMailSent(true);
    },
    [purchaseId],
  );

  useEffect(() => {
    if (ranRef.current) return;

    if (aborted && !(tokenWs && purchaseId)) {
      ranRef.current = true;
      setErrorRedirect(errorUrl('Error en la compra', tokenWs, purchaseId));
      return;
    }

    if (!tokenWs || !purchaseId) return;
    ranRef.current = true;

    void (async () => {
      const confirmResult = await confirmPurchase(purchaseId, tokenWs);
      if (!confirmResult.ok) {
        setErrorRedirect(errorUrl(confirmResult.error, tokenWs, purchaseId));
        return;
      }
      setConfirmed(true);

      const purchaseResult = await getPurchaseById(purchaseId);
      if (!purchaseResult.ok) return;

      const loaded: Course[] = [];
      const seen = new Set<string>();
      const add = (course: Course) => {
        if (!seen.has(course.id)) {
          seen.add(course.id);
          loaded.push(course);
        }
      };

      for (const courseId of purchaseResult.data.coursesIds) {
        const courseResult = await getCourseById(courseId);
        if (courseResult.ok) add(courseResult.data);
      }

      const coursesResult = await getCourses();
      if (coursesResult.ok) {
        coursesResult.data.filter((c) => c.type === 'core').forEach(add);
      }

      const userResult = await getUserById(purchaseResult.data.userId);
      const loadedUser = userResult.ok ? userResult.data : null;

      setCourses(loaded);
      setUser(loadedUser);
      await sendEmail(loadedUser, loaded);
    })();
  }, [tokenWs, purchaseId, aborted, sendEmail]);

  const resendEmail = useCallback(async () => {
    await sendEmail(user, courses);
  }, [sendEmail, user, courses]);

  return { confirmed, courses, user, isMailSent, errorRedirect, resendEmail };
}
```
- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/components/inscriptions/useConfirmation.test.tsx`. Expected: 4 passed.
- [ ] Step: Commit.
```
git add src/components/inscriptions/useConfirmation.ts src/components/inscriptions/useConfirmation.test.tsx && git commit -m "feat: add useConfirmation hook orchestrating confirm/load/email

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 42: Port the /confirmation page

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/confirmation/page.tsx`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/confirmation/page.test.tsx`

**Interfaces:**
- Consumes: `useConfirmation` (Task 41), `BuyInfo` (Task 40), `src/components/header`, `useSearchParams`/`useRouter` from `next/navigation`.
- Produces: `OrderConfirmation` (default export) — the `/confirmation` route page.

The page is a thin `'use client'` shell: a `<Suspense>`-wrapped inner reads `token_ws`, `purchaseId`, and the `TBK_*` abort params via `useSearchParams`, passes them to `useConfirmation`, and renders. When the hook returns an `errorRedirect`, an effect calls `router.push` to it (preserving the legacy redirect-to-`/error` behavior). It shows "Tu número de orden es ..." when `confirmed`, the `BuyInfo` summary, a "Volver al inicio" link (clears `localStorage.user_id` as legacy did), and a "Reenviar correo" button wired to `resendEmail`. We mock `useConfirmation`, `next/navigation`, and `BuyInfo` so the test runs without a router/DB.

- [ ] Step: Write the failing test.
```tsx
// src/app/confirmation/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('token_ws=tok&purchaseId=p1'),
}));
vi.mock('@/components/header', () => ({ default: () => <div>HEADER</div> }));
vi.mock('@/components/buyInfo', () => ({ default: () => <div>BUYINFO</div> }));

const useConfirmation = vi.fn();
vi.mock('@/components/inscriptions/useConfirmation', () => ({
  useConfirmation: (...args: unknown[]) => useConfirmation(...args),
}));

import OrderConfirmation from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrderConfirmation page', () => {
  it('shows order number when confirmed and renders BuyInfo', () => {
    const resendEmail = vi.fn().mockResolvedValue(undefined);
    useConfirmation.mockReturnValue({
      confirmed: true, courses: [], user: null, isMailSent: true, errorRedirect: null, resendEmail,
    });
    render(<OrderConfirmation />);
    expect(screen.getByText('HEADER')).toBeTruthy();
    expect(screen.getByText(/Tu número de orden es/)).toBeTruthy();
    expect(screen.getByText('p1')).toBeTruthy();
    expect(screen.getByText('BUYINFO')).toBeTruthy();
  });

  it('shows the confirming message while not confirmed', () => {
    useConfirmation.mockReturnValue({
      confirmed: false, courses: [], user: null, isMailSent: false, errorRedirect: null, resendEmail: vi.fn(),
    });
    render(<OrderConfirmation />);
    expect(screen.getByText('Confirmando tu compra...')).toBeTruthy();
  });

  it('pushes to errorRedirect when present', () => {
    useConfirmation.mockReturnValue({
      confirmed: false, courses: [], user: null, isMailSent: false,
      errorRedirect: '/error?message=Pago%20no%20realizado&token_ws=tok&purchaseId=p1',
      resendEmail: vi.fn(),
    });
    render(<OrderConfirmation />);
    expect(push).toHaveBeenCalledWith('/error?message=Pago%20no%20realizado&token_ws=tok&purchaseId=p1');
  });

  it('"Reenviar correo" button calls resendEmail', () => {
    const resendEmail = vi.fn().mockResolvedValue(undefined);
    useConfirmation.mockReturnValue({
      confirmed: true, courses: [], user: null, isMailSent: true, errorRedirect: null, resendEmail,
    });
    render(<OrderConfirmation />);
    fireEvent.click(screen.getByText('Reenviar correo'));
    expect(resendEmail).toHaveBeenCalledTimes(1);
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/app/confirmation/page.test.tsx`. Expected failure: `Failed to resolve import "./page"`.
- [ ] Step: Implement the page (complete code).
```tsx
// src/app/confirmation/page.tsx
'use client';
import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import BuyInfo from '@/components/buyInfo';
import { useConfirmation } from '@/components/inscriptions/useConfirmation';

const ConfirmationContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenWs = searchParams.get('token_ws');
  const purchaseId = searchParams.get('purchaseId');
  const tbkToken = searchParams.get('TBK_TOKEN');
  const tbkOrden = searchParams.get('TBK_ORDEN_COMPRA');
  const tbkSesion = searchParams.get('TBK_ID_SESION');
  const aborted = Boolean((tbkToken && tbkOrden) || tbkSesion);

  const { confirmed, courses, user, errorRedirect, resendEmail } = useConfirmation({
    tokenWs,
    purchaseId,
    aborted,
  });

  useEffect(() => {
    if (errorRedirect) router.push(errorRedirect);
  }, [errorRedirect, router]);

  const removeLocalStorage = () => {
    localStorage.removeItem('user_id');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 2xl:px-0">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl mb-2">
        Confirmación de Orden
      </h2>
      {confirmed ? (
        <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">
          Tu número de orden es{' '}
          <a className="font-medium text-gray-900 dark:text-white hover:underline">{purchaseId}</a>{' '}
          . Recuerda que te llegará una copia al correo electrónico que hayas indicado en el formulario.
        </p>
      ) : (
        <div>
          <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">Confirmando tu compra...</p>
        </div>
      )}
      <BuyInfo courses={courses} user={user} />
      <div className="flex items-center space-x-4">
        <Link
          href="/"
          onClick={removeLocalStorage}
          className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800"
        >
          Volver al inicio
        </Link>
        <button
          type="button"
          onClick={() => {
            void resendEmail();
          }}
          className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800"
        >
          Reenviar correo
        </button>
      </div>
    </div>
  );
};

const OrderConfirmation: React.FC = () => {
  return (
    <div>
      <Header />
      <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
        <Suspense fallback={<p>Cargando...</p>}>
          <ConfirmationContent />
        </Suspense>
      </section>
    </div>
  );
};

export default OrderConfirmation;
```
- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/app/confirmation/page.test.tsx`. Expected: 4 passed.
- [ ] Step: Commit.
```
git add src/app/confirmation/page.tsx src/app/confirmation/page.test.tsx && git commit -m "feat: port /confirmation page using useConfirmation hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 43: Port the /error page

**Files:**
- Create: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/error/page.tsx`
- Test: `/home/rodrigoogalde/Personal/CCemuc/app/src/app/error/page.test.tsx`

**Interfaces:**
- Consumes: `src/components/header`, `useSearchParams` from `next/navigation`, `Link` from `next/link`.
- Produces: `OrderError` (default export) — the `/error` route page.

Faithful port of the legacy error page: reads the `message` query param and renders it; shows the "Ya has pagado un curso" heading when `alreadyPaid === 'true'`, otherwise the "Error en la compra" heading; always shows the static "Ha ocurrido un error en la compra" line and a "Volver a intentar" link to `/pricing`. We drop the legacy commented-out dead code (the unused `getInfoPurchase` and the resend block). All `useSearchParams` reads happen inside `<Suspense>` boundaries per the App Router requirement. We mock `next/navigation` so each test controls the params.

- [ ] Step: Write the failing test.
```tsx
// src/app/error/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let currentParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => currentParams,
}));
vi.mock('@/components/header', () => ({ default: () => <div>HEADER</div> }));

import OrderError from './page';

describe('OrderError page', () => {
  it('renders the message and default error heading', () => {
    currentParams = new URLSearchParams('message=Compra%20rechazada');
    render(<OrderError />);
    expect(screen.getByText('HEADER')).toBeTruthy();
    expect(screen.getByText('Error en la compra')).toBeTruthy();
    expect(screen.getByText('Compra rechazada')).toBeTruthy();
    expect(screen.getByText('Ha ocurrido un error en la compra')).toBeTruthy();
  });

  it('renders the alreadyPaid variant heading', () => {
    currentParams = new URLSearchParams('alreadyPaid=true');
    render(<OrderError />);
    expect(screen.getByText('Ya has pagado un curso')).toBeTruthy();
    expect(screen.queryByText('Error en la compra')).toBeNull();
  });

  it('renders a retry link back to /pricing', () => {
    currentParams = new URLSearchParams('');
    render(<OrderError />);
    const link = screen.getByText('Volver a intentar').closest('a');
    expect(link?.getAttribute('href')).toBe('/pricing');
  });
});
```
- [ ] Step: Run it, expect FAIL. Command: `npx vitest run src/app/error/page.test.tsx`. Expected failure: `Failed to resolve import "./page"`.
- [ ] Step: Implement the page (complete code).
```tsx
// src/app/error/page.tsx
'use client';
import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';

const ErrorHeading: React.FC = () => {
  const searchParams = useSearchParams();
  const alreadyPaid = searchParams.get('alreadyPaid');

  if (alreadyPaid === 'true') {
    return (
      <div className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl mb-2">
        <p>Ya has pagado un curso</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl mb-2">
        Error en la compra
      </h2>
    </div>
  );
};

const ErrorMessage: React.FC = () => {
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  return <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">{message}</p>;
};

const RetryButton: React.FC = () => {
  return (
    <div className="flex items-center space-x-4">
      <Link
        href="/pricing"
        className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800"
      >
        Volver a intentar
      </Link>
    </div>
  );
};

const OrderError: React.FC = () => {
  return (
    <div>
      <Header />
      <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
        <div className="mx-auto max-w-2xl px-4 2xl:px-0">
          <Suspense>
            <ErrorHeading />
          </Suspense>
          <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">
            Ha ocurrido un error en la compra
          </p>
          <Suspense fallback={<p>Loading...</p>}>
            <ErrorMessage />
          </Suspense>
          <Suspense>
            <RetryButton />
          </Suspense>
        </div>
      </section>
    </div>
  );
};

export default OrderError;
```
- [ ] Step: Run tests, expect PASS. Command: `npx vitest run src/app/error/page.test.tsx`. Expected: 3 passed.
- [ ] Step: Commit.
```
git add src/app/error/page.tsx src/app/error/page.test.tsx && git commit -m "feat: port /error page with alreadyPaid variant and retry link

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 10 — Admin parity, cleanup & Vercel deploy

The legacy Koa API guarded mutating routes with two shared-secret middlewares: `authMiddleware` (POST create/action routes, compared against `AUTH_TOKEN`) and `deleteAuthMiddleware` (DELETE routes, compared against `DELETE_AUTH_TOKEN`). In the monolith both collapse into a single server-side `assertAdmin(secret)` (built earlier against `ADMIN_SECRET`), called *inside* each admin-gated action so the secret never ships to the client. By this phase the actions already exist (Phases 4–12); this phase is a **parity audit + hardening pass**: it proves every admin-gated action rejects a missing/wrong secret and accepts the right one, then adds one optional Route Handler example showing how an external (non-server-action) admin client passes the secret via header.

The admin-gated surface (mirroring the legacy `authMiddleware`/`deleteAuthMiddleware` placement) is exactly: `createCourse`, `updateCourse`, `deleteCourse`, `updateUser` was open in legacy (PUT had no middleware) — keep `updateUser` open but `deleteUser` gated; `updateEnrollment` gated, `deleteEnrollment` gated; `getPurchases` (admin-only list), `updatePurchase`, `deletePurchase` gated. (Legacy gated POST `/purchases`/`/enrollments`/`/users` with `authMiddleware`, but the locked decisions keep public registration/purchase creation OPEN, so `createUser`/`createEnrollment`/`createPurchase` are NOT gated. This phase enforces the decision, not the legacy POST gating.)

> Rationale (deliberate divergence from legacy, where all PUTs were open): `updateUser` stays OPEN while `updateCourse`/`updateEnrollment`/`updatePurchase` are admin-gated, per the canonical signatures — the public registration/preload flow must be able to update a user without a secret, whereas course/enrollment/purchase mutations are admin-only.

### Task 44: Audit & enforce assertAdmin on every admin-gated action

**Files:**
- Modify (only if a check fails): `src/actions/courses.ts`, `src/actions/users.ts`, `src/actions/enrollments.ts`, `src/actions/purchases.ts` — but this is primarily a VERIFICATION task: assert (via grep/checklist) that every gated action already imports and calls `assertAdmin`, then run the full type/lint/test triad.
- Modify: `src/lib/auth.ts` (confirm signature; no behavior change expected)
- Test: `src/actions/admin-gating.test.ts` (new cross-action gating matrix)

**Interfaces:**
- Consumes: `assertAdmin(secret: string): void` from `src/lib/auth.ts` (throws on bad secret); `fail(error, status, field)` / `ok(data)` from `src/domain/result.ts`; the action signatures from `src/actions/*.ts` exactly as listed in the canonical signatures (`deleteCourse(id, adminSecret)`, `createCourse(input, adminSecret)`, `updateCourse(id, input, adminSecret)`, `deleteUser(id, adminSecret)`, `updateEnrollment(id, input, adminSecret)`, `deleteEnrollment(id, adminSecret)`, `getPurchases(adminSecret)`, `updatePurchase(id, input, adminSecret)`, `deletePurchase(id, adminSecret)`).
- Produces: a verified guarantee — every gated action returns `fail('Unauthorized', 403)` when the secret is missing/wrong, and proceeds otherwise. No new exported symbols.

- [ ] Confirm `src/lib/auth.ts` shape. Read it; it must export `assertAdmin` that throws when the secret mismatches `process.env.ADMIN_SECRET`. If it does not already throw a typed error the actions can map to `fail(..., 403)`, add one:
```ts
// src/lib/auth.ts
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function assertAdmin(secret: string): void {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || !secret || secret !== expected) {
    throw new UnauthorizedError('Unauthorized');
  }
}
```
- [ ] Write the failing cross-action gating test. It mocks Prisma so no DB is touched, sets `ADMIN_SECRET`, and asserts each gated action both REJECTS a bad/empty secret (`ok:false`, `status:403`) and does NOT short-circuit with 403 on the correct secret:
```ts
// src/actions/admin-gating.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// One shared in-memory mock for the Prisma singleton so gated reads/writes don't hit a DB.
vi.mock('../lib/prisma', () => {
  const model = {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'x' }),
    update: vi.fn().mockResolvedValue({ id: 'x' }),
    delete: vi.fn().mockResolvedValue({ id: 'x' }),
  };
  return { prisma: { course: model, user: model, enrollment: model, purchase: model } };
});

import { createCourse, updateCourse, deleteCourse } from './courses';
import { deleteUser } from './users';
import { updateEnrollment, deleteEnrollment } from './enrollments';
import { getPurchases, updatePurchase, deletePurchase } from './purchases';

beforeEach(() => {
  process.env.ADMIN_SECRET = 'sekret';
});

const BAD = '';
const GOOD = 'sekret';

// Each entry: a callable that takes the admin secret and returns the action promise.
const gated: Array<[string, (s: string) => Promise<{ ok: boolean; status?: number }>]> = [
  ['createCourse', (s) => createCourse({ title: 't', module: 1, type: 'core', price: 1, capacity: 1, week: 1, topics: [] } as never, s)],
  ['updateCourse', (s) => updateCourse('id', {} as never, s)],
  ['deleteCourse', (s) => deleteCourse('id', s)],
  ['deleteUser', (s) => deleteUser('id', s)],
  ['updateEnrollment', (s) => updateEnrollment('id', {} as never, s)],
  ['deleteEnrollment', (s) => deleteEnrollment('id', s)],
  ['getPurchases', (s) => getPurchases(s)],
  ['updatePurchase', (s) => updatePurchase('id', {}, s)],
  ['deletePurchase', (s) => deletePurchase('id', s)],
];

describe('admin gating matrix', () => {
  it.each(gated)('%s rejects a missing/wrong secret with 403', async (_name, call) => {
    const res = await call(BAD);
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.status).toBe(403);
  });

  it.each(gated)('%s does NOT 403 with the correct secret', async (_name, call) => {
    const res = await call(GOOD);
    // Either ok:true, or a non-403 failure (404/400) — never an auth rejection.
    if (res.ok === false) expect(res.status).not.toBe(403);
  });
});
```
- [ ] Run it, expect FAIL: `npx vitest run src/actions/admin-gating.test.ts`. Expected failure: at least one gated action does not yet wrap `assertAdmin` in a try/catch that maps `UnauthorizedError` to `fail('Unauthorized', 403)` (e.g. it throws instead of returning, or returns a different status), so the `it.each` rows error or assert-fail.
- [ ] Make each gated action enforce the guard. For every gated action, the body must start by calling `assertAdmin` and map the throw to a 403 result. Use this exact shape (shown for `deleteCourse`; apply the identical try/catch envelope to all nine gated actions, keeping their existing body inside the `try`):
```ts
// src/actions/courses.ts (excerpt — the gated actions)
'use server';
import { prisma } from '../lib/prisma';
import { assertAdmin, UnauthorizedError } from '../lib/auth';
import { ok, fail, type ActionResult } from '../domain/result';
import type { Course } from '@prisma/client';
import { courseCreateSchema, courseUpdateSchema } from '../schemas/course';

export async function createCourse(input: unknown, adminSecret: string): Promise<ActionResult<Course>> {
  try {
    assertAdmin(adminSecret);
    const parsed = courseCreateSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(issue.message, 400, String(issue.path[0] ?? ''));
    }
    const course = await prisma.course.create({ data: parsed.data });
    return ok(course);
  } catch (e) {
    if (e instanceof UnauthorizedError) return fail('Unauthorized', 403);
    return fail((e as Error).message, 500);
  }
}

export async function updateCourse(id: string, input: unknown, adminSecret: string): Promise<ActionResult<Course>> {
  try {
    assertAdmin(adminSecret);
    const parsed = courseUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(issue.message, 400, String(issue.path[0] ?? ''));
    }
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) return fail('Course not found', 404);
    const course = await prisma.course.update({ where: { id }, data: parsed.data });
    return ok(course);
  } catch (e) {
    if (e instanceof UnauthorizedError) return fail('Unauthorized', 403);
    return fail((e as Error).message, 500);
  }
}

export async function deleteCourse(id: string, adminSecret: string): Promise<ActionResult<null>> {
  try {
    assertAdmin(adminSecret);
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) return fail('Course not found', 404);
    await prisma.course.delete({ where: { id } });
    return ok(null);
  } catch (e) {
    if (e instanceof UnauthorizedError) return fail('Unauthorized', 403);
    return fail((e as Error).message, 500);
  }
}
```
Apply the same `assertAdmin(adminSecret)` first-line + `UnauthorizedError → fail('Unauthorized', 403)` catch to `deleteUser` (`src/actions/users.ts`), `updateEnrollment`/`deleteEnrollment` (`src/actions/enrollments.ts`), and `getPurchases`/`updatePurchase`/`deletePurchase` (`src/actions/purchases.ts`). Do not touch `createUser`, `createEnrollment`, `createPurchase`, `updateUser`, any `getCourses`/`getCourseById`/`getUsers`/`getUserById`/`getUserByRut`/`getEnrollments`/`getEnrollmentById`/`getPurchaseById`/`getUserPurchases`/`confirmPurchase`/`sendConfirmation` — those stay open per the locked decisions.
- [ ] Fix 17 — definitive verification (not conditional): assert every gated action imports and calls `assertAdmin`, then run the full triad. Run:
```bash
# Each gated action file must import assertAdmin and call it.
grep -L "assertAdmin" src/actions/courses.ts src/actions/users.ts src/actions/enrollments.ts src/actions/purchases.ts && echo "FAIL: a gated action file is missing assertAdmin" || echo "OK: all gated action files reference assertAdmin"
# Checklist: confirm a call site exists in each gated action (one per gated function).
grep -n "assertAdmin(" src/actions/courses.ts src/actions/users.ts src/actions/enrollments.ts src/actions/purchases.ts
# Full type/lint/test triad must pass.
npx tsc --noEmit && npm run lint && npx vitest run
```
Expected: the grep prints `OK: all gated action files reference assertAdmin`, every gated action shows an `assertAdmin(adminSecret)` call site, and `tsc --noEmit` / `npm run lint` / `npx vitest run` all exit 0.
- [ ] Run tests, expect PASS: `npx vitest run src/actions/admin-gating.test.ts`. Expected: all `it.each` rows green (9 reject-rows + 9 accept-rows).
- [ ] Commit:
```
git add src/lib/auth.ts src/actions/courses.ts src/actions/users.ts src/actions/enrollments.ts src/actions/purchases.ts src/actions/admin-gating.test.ts && git commit -m "feat: enforce assertAdmin on all admin-gated actions with 403 parity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 45: Optional admin Route Handler example (header-passed secret)

**Files:**
- Create: `src/app/api/admin/courses/route.ts` (Route Handler example for external admin clients)
- Test: `src/app/api/admin/courses/route.test.ts`

**Interfaces:**
- Consumes: `createCourse(input, adminSecret)` and `getCourses()` from `src/actions/courses.ts`; `ActionResult<T>` from `src/domain/result.ts`.
- Produces: `GET` and `POST` Route Handlers under `/api/admin/courses` that read the admin secret from the `x-admin-secret` header (the documented way an external, non-server-action admin client authenticates). No new exported symbols beyond the Next.js `GET`/`POST` handlers.

This is the ONE optional admin endpoint the scope allows: it demonstrates how an external admin client (not the bundled UI) hands the secret over HTTP. Server actions remain the primary surface; this handler simply forwards a header into the same gated action so there is exactly one authorization codepath (`assertAdmin` inside the action).

- [ ] Write the failing test. It mocks the actions module so no DB is hit, and asserts the handler maps header→`adminSecret` and the `ActionResult` status onto the HTTP response:
```ts
// src/app/api/admin/courses/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createCourse = vi.fn();
const getCourses = vi.fn();
vi.mock('../../../../actions/courses', () => ({ createCourse, getCourses }));

import { GET, POST } from './route';

beforeEach(() => {
  createCourse.mockReset();
  getCourses.mockReset();
});

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/admin/courses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('admin courses route handler', () => {
  it('POST without x-admin-secret -> 403 (action rejects empty secret)', async () => {
    createCourse.mockResolvedValue({ ok: false, error: 'Unauthorized', status: 403 });
    const res = await POST(req({ title: 't' }));
    expect(res.status).toBe(403);
    expect(createCourse).toHaveBeenCalledWith({ title: 't' }, '');
  });

  it('POST with x-admin-secret forwards the header to createCourse', async () => {
    createCourse.mockResolvedValue({ ok: true, data: { id: 'c1' } });
    const res = await POST(req({ title: 't' }, { 'x-admin-secret': 'sekret' }));
    expect(res.status).toBe(201);
    expect(createCourse).toHaveBeenCalledWith({ title: 't' }, 'sekret');
    expect(await res.json()).toEqual({ id: 'c1' });
  });

  it('GET returns the open course list (no secret needed)', async () => {
    getCourses.mockResolvedValue({ ok: true, data: [{ id: 'c1' }] });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'c1' }]);
  });
});
```
- [ ] Run it, expect FAIL: `npx vitest run src/app/api/admin/courses/route.test.ts`. Expected failure: `Cannot find module './route'` — the handler does not exist yet.
- [ ] Implement the Route Handler:
```ts
// src/app/api/admin/courses/route.ts
import { NextResponse } from 'next/server';
import { createCourse, getCourses } from '../../../../actions/courses';

// Open read parity with the public catalog (mirrors GET /courses).
export async function GET() {
  const result = await getCourses();
  if (!result.ok) {
    return NextResponse.json({ error: result.error, field: result.field }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 200 });
}

// External admin clients authenticate by sending the secret in the `x-admin-secret`
// header. We forward it straight into the gated action — assertAdmin is the single
// authorization codepath; the secret is never embedded in client code.
export async function POST(request: Request) {
  const adminSecret = request.headers.get('x-admin-secret') ?? '';
  const body = await request.json().catch(() => ({}));
  const result = await createCourse(body, adminSecret);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, field: result.field }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 201 });
}
```
- [ ] Run tests, expect PASS: `npx vitest run src/app/api/admin/courses/route.test.ts`. Expected: 3 passing tests.
- [ ] Commit:
```
git add src/app/api/admin/courses/route.ts src/app/api/admin/courses/route.test.ts && git commit -m "feat: add optional admin courses route handler with x-admin-secret header

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Phase 10 (cont.) — Cleanup & verification

A single verification task that proves the migration is internally consistent and carried over none of the dead code the decisions called out. This is a gate before deploy: it runs the full type/lint/test triad and asserts the explicit "do-not-port" list is absent.

### Task 46: Full verification — typecheck, lint, tests, dead-code & env audit

**Files:**
- Modify (only if a check fails): whichever file the failing check points at.
- No new production files. No test file (this task runs existing suites + greps).

**Interfaces:**
- Consumes: the complete `app/` tree from all prior phases.
- Produces: a green build gate — `tsc --noEmit`, `npm run lint`, and `npx vitest run` all pass; the dead-code/env audit greps all return empty (or only the intended single hit).

- [ ] Run the TypeScript typecheck: `npx tsc --noEmit`. Expected: exits 0, no output. If it errors, fix the reported file(s) before continuing — do not suppress with `// @ts-ignore`.
- [ ] Run the linter: `npm run lint`. Expected: `✔ No ESLint warnings or errors` (Next.js lint). Fix any reported issues.
- [ ] Run the full test suite: `npx vitest run`. Expected: all test files pass, 0 failed. (Real-DB integration tests, if any were marked, stay skipped unless their env flag is set — confirm they are skipped, not failing.)
- [ ] Audit: dead frontend util NOT ported. Run `! test -e src/utils/handleConfirmation.ts && echo OK-no-handleConfirmation`. Expected: prints `OK-no-handleConfirmation`. (The legacy `frontend/src/utils/handleConfirmation.ts` axios→`/purchases/:id/confirm` helper is replaced by the `confirmPurchase` server action + the webpay return route handler; it must not exist in `app/`.)
- [ ] Audit: stale `Course.description` NOT present. Run `! grep -rn "description" src/schemas/course.ts prisma/schema.prisma; grep -rn "description" src/ prisma/ || echo OK-no-description`. Expected: no `description` field on the Course model/schema (the model is `title, module, type, price, capacity, features, week, topics`). The grep should surface no Course-related `description`; UI copy fields named `description` in section JSON/components are fine — confirm none belong to the Course entity.
- [ ] Audit: hardcoded `BACKEND_URL` dropped. Run `! grep -rn "BACKEND_URL\|api.ccemuc.cl\|localhost:3000" src/ && echo OK-no-backend-url`. Expected: prints `OK-no-backend-url`. (In a monolith there is no external API base; the legacy `frontend/src/utils/config.ts` `const BACKEND_URL = 'https://api.ccemuc.cl'` and its `localhost:3000` comment must not be carried over. The only base URL allowed is `NEXT_PUBLIC_BASE_URL` used to derive the webpay return URL.)
- [ ] Audit: single RUT validator. Run `grep -rln "function isRut\|export function isRut\|getDV" src/`. Expected: exactly one file — `src/domain/rut.ts`. (The legacy `ccemuc-api/src/utils/rutValidator.ts` and any frontend copy collapse into one shared `src/domain/rut.ts` consumed by the user schema/actions.) If more than one file is listed, delete the duplicate and re-point imports.
- [ ] Audit: `.env.example` is complete. Run `for v in DATABASE_URL DIRECT_URL WEBPAY_ENVIRONMENT WEBPAY_COMMERCE_CODE WEBPAY_API_KEY WEBPAY_RETURN_URL EMAIL_HOST EMAIL_PORT EMAIL_USER EMAIL_PASS EMAIL_FROM ADMIN_SECRET REGISTRATION_OPEN NEXT_PUBLIC_BASE_URL; do grep -q "^$v=" .env.example || echo "MISSING $v"; done; echo done-env-audit`. Expected: prints only `done-env-audit` (no `MISSING` lines). If any are missing, add them to `.env.example` with placeholder values and a comment; confirm `REGISTRATION_OPEN=true` is the default.
- [ ] Audit: no real secrets committed. Run `! test -e .env || echo NOTE-local-env-present; git ls-files | grep -E "^\.env$" && echo "FAIL committed .env" || echo OK-env-ignored`. Expected: `OK-env-ignored` (a local `.env` may exist for dev but must be git-ignored; only `.env.example` is tracked).
- [ ] Commit (records the verified state; only if any audit fix was applied this task):
```
git add -A && git commit -m "chore: cleanup audit — drop dead code, single RUT validator, complete .env.example

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Phase 10 (cont.) — Vercel deploy (+ AWS migration note)

Checklist tasks (no TDD) to ship the monolith to Vercel on the Next.js serverless runtime against Neon Postgres, with env-switchable Transbank set to production. Each step gives exact settings/commands. The final task captures a forward-looking AWS migration note so the team knows what changes if they leave Vercel.

### Task 47: Connect repo to Vercel & configure project + build

**Files:**
- Modify: `app/package.json` (ensure `build` runs `prisma generate && prisma migrate deploy && next build`)
- Reference only: `app/next.config.mjs` (confirm NO `output: 'export'`), `app/prisma/schema.prisma`

**Interfaces:**
- Consumes: the committed `app/` repo (its own git repo per the locked decisions) pushed to GitHub.
- Produces: a Vercel Project bound to the `app/` repo whose build generates the Prisma client and applies migrations on every deploy.

- [ ] Confirm the production build pipeline. In `app/package.json`, the `build` script must be:
```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build",
    "start": "next start",
    "dev": "next dev",
    "lint": "next lint",
    "test": "vitest run"
  }
}
```
Verify `prisma` and `@prisma/client` are in `dependencies` (not only `devDependencies`) so `prisma migrate deploy` is available in the Vercel build. Confirm `next.config.mjs` does NOT contain `output: 'export'` (run `! grep -q "output" app/next.config.mjs && echo OK-no-export`).
- [ ] Push the `app/` repo to GitHub (the user wired the remote per the locked decisions). From `app/`: `git push -u origin main`. Confirm the latest commit (the Phase 10 cleanup & verification step) is on the remote.
- [ ] In the Vercel dashboard: New Project → Import Git Repository → select the `app/` repo. If the repo root IS the Next app, leave **Root Directory** as `./`. (If for any reason the Next app is nested, set Root Directory to that subfolder — but per the locked structure `app/` is the repo root, so `./`.)
- [ ] Set Framework Preset to **Next.js** (auto-detected). Leave **Build Command** as the default (`npm run build`, which now chains prisma generate + migrate deploy + next build) and **Install Command** as `npm install`. Output is the Next.js server runtime (serverless) — do not override to a static export.
- [ ] Do NOT deploy yet. Continue to Task 48 to set env vars first (a deploy without `DATABASE_URL`/`DIRECT_URL` will fail at `prisma migrate deploy`).

### Task 48: Set environment variables on Vercel (Neon, Transbank prod, email, admin)

**Files:**
- Reference only: `app/.env.example` (the canonical variable list to mirror into Vercel)

**Interfaces:**
- Consumes: `.env.example` from the Phase 10 cleanup & verification step (complete, audited).
- Produces: a Production (and Preview) env on Vercel where every required variable is present, Transbank is set to production, and Neon URLs are wired via the Vercel–Neon integration.

- [ ] Add the Neon integration: Vercel Project → Integrations → add **Neon**, connect/select the Neon project. This auto-populates `DATABASE_URL` (pooled, `-pooler` host, used by `@prisma/client` at runtime) and a direct URL. Confirm both exist in Vercel env. If the integration names the direct one differently, add `DIRECT_URL` manually pointing at the **non-pooled** Neon connection string (used by `prisma migrate deploy`).
- [ ] Verify the Prisma datasource matches: in `app/prisma/schema.prisma` the datasource block must read `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`. (Pooled for runtime queries; direct for migrations — the documented Neon + Prisma serverless pattern.)
- [ ] Set the base URL and webpay return URL. Add `NEXT_PUBLIC_BASE_URL=https://<your-vercel-domain>` and `WEBPAY_RETURN_URL=https://<your-vercel-domain>/api/webpay/return` (the Route Handler path — Transbank POSTs/redirects here; it cannot be a server action). Use the final production domain (custom domain if configured, else the `*.vercel.app` domain).
- [ ] Set Transbank to PRODUCTION. Add `WEBPAY_ENVIRONMENT=production`, `WEBPAY_COMMERCE_CODE=<production commerce code>`, `WEBPAY_API_KEY=<production api key>` (the real credentials issued by Transbank — these replace the integration creds used in dev). Double-check the env value is exactly `production` so `src/lib/webpay.ts` selects `Environment.Production`.
- [ ] Set the email/SMTP vars: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` (the production SMTP credentials used by `src/lib/mailer.ts` for the confirmation email).
- [ ] Set the admin secret and registration gate: `ADMIN_SECRET=<long random string>` (server-only — used by `assertAdmin`; never exposed to the client) and `REGISTRATION_OPEN=true` (the `/pricing` selection UI is gated on this instead of the legacy hardcoded "No disponible" early-return). Generate a strong secret, e.g. `openssl rand -hex 32`.
- [ ] Scope correctly: set all of the above for the **Production** environment, and replicate to **Preview** (Preview can point at a Neon branch DB and Transbank `integration` creds if you want preview deploys to avoid the live gateway). Confirm none of the secret vars are prefixed `NEXT_PUBLIC_` except `NEXT_PUBLIC_BASE_URL`.
- [ ] Trigger the first deploy: Vercel → Deployments → Redeploy (or push a commit). Watch the build log confirm `prisma generate` ran, `prisma migrate deploy` applied the migrations to Neon, and `next build` succeeded. If `migrate deploy` reports "No pending migrations", the schema is already current — that is fine.

### Task 49: Live smoke-test the public purchase flow + AWS migration note

**Files:**
- Reference only: `src/app/api/webpay/return/route.ts`, `src/actions/purchases.ts`, `src/actions/courses.ts`
- Modify (documentation): append the AWS note to `app/README.md` (or the repo's deployment doc) — this is the one written artifact this task produces.

**Interfaces:**
- Consumes: the live Vercel deployment from Tasks 47–48.
- Produces: a passed manual smoke-test of the live public flow, and a committed "Future: migrate to AWS" note.

- [ ] Smoke 1 — catalog reads. Visit `https://<domain>/pricing` and `https://<domain>/modules`. Expected: the seeded course catalog renders (course titles/prices), proving `getCourses()` and Neon connectivity work in production. Confirm the selection UI is visible (because `REGISTRATION_OPEN=true`), not the "No disponible" placeholder.
- [ ] Smoke 2 — registration. Complete the `/form` registration with a valid Chilean RUT (e.g. a real-format `XXXXXXXX-X`). Expected: success (creates or returns existing user). Then submit an INVALID RUT and a duplicate email. Expected: the action returns the 409 + field error shape and the form surfaces it (RUT validation + dup-email parity).
- [ ] Smoke 3 — purchase create. Select at least one course and proceed to pay. Expected: `createPurchase` returns `{ purchase, webPayResponse: { token, url } }` and the browser is redirected to the Transbank Webpay URL with `token_ws`. (This is the PRODUCTION gateway — use a real card or Transbank's production test path as agreed; be deliberate.)
- [ ] Smoke 4 — webpay return + confirm. Complete (or cancel) the Webpay payment. Expected: Transbank redirects to `https://<domain>/api/webpay/return?purchaseId=...` carrying `token_ws`; the Route Handler calls `confirmPurchase`, which (on AUTHORIZED) runs the `$transaction`: marks `isPaid=true`, creates enrollments including all `core` courses, and decrements capacity — atomically. Verify in Neon: the `Purchase.isPaid` is true, `Enrollment` rows exist for purchased + core courses, and the matching `Course.capacity` decremented by exactly the new enrollments. Re-hit the return URL (idempotency) and confirm no double enrollment / no further capacity decrement.
- [ ] Smoke 5 — confirmation email. Expected: the confirmation email is delivered to the registered address (via `sendConfirmation` / `src/lib/mailer.ts`). Check the inbox and the `EMAIL_FROM` sender.
- [ ] Smoke 6 — admin gating live. Call the gated path with no secret and confirm rejection: `curl -i -X POST https://<domain>/api/admin/courses -H 'content-type: application/json' -d '{"title":"x"}'`. Expected: HTTP `403 {"error":"Unauthorized"}`. Repeat with `-H 'x-admin-secret: <ADMIN_SECRET>'` and confirm it is accepted (201 or a non-403 validation error), proving the secret never needed to ship to the client.
- [ ] Write the AWS migration note. Append to `app/README.md`:
```md
## Future: migrating off Vercel to AWS

The monolith is a standard Next.js server app, so it is portable. Two AWS paths:

### Option A — Docker on EC2 behind nginx (mirrors the legacy ccemuc-api setup)
- Add a `Dockerfile` that runs `npm ci && npm run build` then `next start` (Node server,
  port 3000). This is the same shape as the old API container.
- Run it on EC2 (optionally via `docker compose`, like the legacy `docker-compose.pull.yml`
  that pulled the image from ECR Public). Push the image to ECR.
- Put nginx in front as a reverse proxy on :80/:443 (like the legacy `nginx/api.conf`
  proxying `api.ccemuc.cl` → `localhost:3000`), terminating TLS and forwarding to the
  Next server. The build step still needs `prisma generate` + `prisma migrate deploy`
  (run on container start or in CI before the image ships).
- Trade-off: you own scaling, TLS, and the host (the SSH `.pem` model the project already
  used). No serverless cold-start nuance, but no zero-ops either.

### Option B — AWS Amplify Hosting
- Amplify Hosting supports Next.js SSR/serverless directly from the Git repo, closest to the
  Vercel experience: connect the repo, set the same env vars, and let Amplify build with
  `npm run build`. Least migration effort; managed scaling and TLS.

### What stays the same either way
- **Neon Postgres is portable** — keep using it from EC2/Amplify with the same pooled
  `DATABASE_URL` + direct `DIRECT_URL`. No DB migration needed. (If you later want
  everything on AWS, RDS Postgres is a drop-in for the connection strings; Prisma schema
  and migrations are unchanged.)
- All env vars (`WEBPAY_*`, `EMAIL_*`, `ADMIN_SECRET`, `REGISTRATION_OPEN`,
  `NEXT_PUBLIC_BASE_URL`, `WEBPAY_RETURN_URL`) carry over verbatim — only the host of the
  return URL/base URL changes.
- Server actions and the `/api/webpay/return` Route Handler are framework features, not
  Vercel features; they work on any Next.js server runtime.
```
- [ ] Commit the note:
```
git add README.md && git commit -m "docs: add live smoke-test checklist results and AWS migration note

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
