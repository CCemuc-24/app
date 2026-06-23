# Phase 10 (Tasks 44–49) Implementation Report

## Per-task SHAs

| Task | Description | SHA |
|------|-------------|-----|
| T44 | audit: verify assertAdmin guards on all admin-gated actions; add deletePurchase rejection test | 5b95898 |
| T45 | feat: add admin Route Handler GET/POST /api/admin/courses with header-passed secret | 683eb61 |
| T45-fix | fix: resolve TS2345 in admin/courses route.test.ts (NextRequest RequestInit signal type) | f308074 |
| T46 | chore: Task 46 full verification pass — tsc clean, lint warns-only, 38 tests/201 pass, build green | b38d0b2 |
| T47-49 | docs: add DEPLOY.md runbook covering Vercel config, env vars, smoke test, and AWS migration | 948ffa6 |

---

## Task 44 — assertAdmin Audit

### Gated actions verified

All nine admin-gated actions already had `try { assertAdmin(adminSecret) } catch { return fail('Unauthorized', 403) }` in place:

| Action | File |
|--------|------|
| `createCourse` | `src/actions/courses.ts` |
| `updateCourse` | `src/actions/courses.ts` |
| `deleteCourse` | `src/actions/courses.ts` |
| `deleteUser` | `src/actions/users.ts` |
| `updateEnrollment` | `src/actions/enrollments.ts` |
| `deleteEnrollment` | `src/actions/enrollments.ts` |
| `getPurchases` | `src/actions/purchases.ts` |
| `updatePurchase` | `src/actions/purchases.ts` |
| `deletePurchase` | `src/actions/purchases.ts` |

### Rejection tests status before T44

All actions had `assertAdmin`-throws-403 tests except `deletePurchase`, which only had
the success case. Added the missing test to `src/actions/purchases.crud.test.ts`.

### updateUser — intentionally NOT gated

`updateUser` has no `assertAdmin` call by design. This is a deliberate divergence from
the legacy where all PUTs were admin-only. The current design allows public profile
updates; the task brief explicitly preserves this.

---

## Task 45 — Admin Route Handler

Created `src/app/api/admin/courses/route.ts`:
- `GET /api/admin/courses` — lists courses (delegates to `getCourses`)
- `POST /api/admin/courses` — creates a course (delegates to `createCourse`, passes `x-admin-secret` header value as the `adminSecret` arg)

The handler never bypasses the gate: `createCourse` calls `assertAdmin()` itself.

Created `src/app/api/admin/courses/route.test.ts` — 6 tests:
1. GET 200 success
2. GET 500 when action fails
3. POST 201 success with valid secret
4. POST 403 when secret missing/wrong
5. POST 400 on invalid JSON
6. POST 400 on Zod validation error

Route appears in build output: `ƒ /api/admin/courses`

---

## Task 46 — Full Verification Results

### tsc --noEmit
```
TSC_CLEAN
```
(0 errors after the RequestInit fix applied in f308074)

### npm run lint
```
Warnings only — @typescript-eslint/no-unused-vars in test destructures (pre-existing)
0 Errors
```

### npm run test
```
Test Files  38 passed (38)
      Tests  201 passed (201)
```
(194 pre-existing + 7 new: 1 deletePurchase rejection test in T44, 6 admin route tests in T45)

### npm run build
```
✓ Generating static pages (13/13)
Route (app)                                 Size  First Load JS
┌ ○ /                                    4.07 kB         115 kB
├ ○ /_not-found                            993 B         103 kB
├ ○ /about                                2.1 kB         113 kB
├ ƒ /api/admin/courses                     127 B         103 kB
├ ƒ /api/webpay/return                     127 B         103 kB
├ ○ /confirmation                           4 kB         115 kB
├ ○ /contact                             1.85 kB         112 kB
├ ○ /error                               2.29 kB         113 kB
├ ○ /form                                5.12 kB         116 kB
├ ƒ /modules                              3.2 kB         114 kB
├ ƒ /pricing                             5.47 kB         116 kB
├ ○ /references                           2.1 kB         113 kB
└ ○ /schedule                             2.1 kB         113 kB
```

### Dead-code / env audit

| Check | Result |
|-------|--------|
| `handleConfirmation` in src/ | CLEAN — no matches |
| `Course.description` / `.description` on course usage | CLEAN — no matches |
| `BACKEND_URL` in src/ | CLEAN — no matches |
| `AUTH_TOKEN` in src/ | CLEAN — no matches |
| `axios` imports in src/ | CLEAN — no matches |
| RUT validator files | Exactly 1: `src/domain/rut.ts` |
| `process.env.*` vs `.env.example` | All 13 app env vars are documented in `.env.example`; `NODE_ENV` is a Node built-in (no entry needed); `DATABASE_URL`/`DIRECT_URL` are Prisma-only (no `process.env.X` in `src/`) |

---

## Tasks 47–49 — DEPLOY.md

Created `/home/rodrigoogalde/Personal/CCemuc/app/DEPLOY.md` — operator runbook covering:

- **Task 47 (Vercel project config)**: Root directory `app/`, Next.js preset, Node 20, `postinstall` auto-runs `prisma generate`, manual `prisma migrate deploy` instruction for schema changes.
- **Task 48 (env vars)**: Full table with `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) from Neon, `WEBPAY_ENVIRONMENT=production` + `WEBPAY_COMMERCE_CODE` + `WEBPAY_API_KEY`, `WEBPAY_RETURN_URL`, `EMAIL_*`, `ADMIN_SECRET` (server-only, secret), `REGISTRATION_OPEN`, `NEXT_PUBLIC_BASE_URL`. Secret/public annotations + pre-go-live checklist.
- **Task 49 (smoke test)**: Manual checklist for the full public purchase flow: `/modules` → `/pricing` → `/form` → Webpay production redirect → `/confirmation` → email received. Plus admin Route Handler curl examples and post-smoke DB checks.
- **Task 49 (AWS migration note)**: EC2 + Docker + nginx (mirrors legacy) vs Amplify Hosting; Neon/Postgres is portable — only env vars change.

All Vercel connection, env setup, and live smoke-test steps are clearly marked as **operator-only**.

---

## Concerns / Notes

- The T45 TSC fix (f308074) was committed as a separate commit (not amended) per the rules.
- Lint warnings (`no-unused-vars` in test files) are all pre-existing and in test code only — not actionable.
- `updateUser` is deliberately not admin-gated per the plan; this is confirmed and documented.
- DEPLOY.md is in `app/` root for easy discovery; it is not deployed as a web page.
