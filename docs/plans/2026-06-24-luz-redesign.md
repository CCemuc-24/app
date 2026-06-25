# Luz Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the entire CCEM UC site to the approved **«Luz»** direction (surgical-teal on sterile white, Space Grotesk + Inter + Space Mono, the «incision» signature), adopting **shadcn/ui** components and **lucide-react** icons, without changing any behavior or breaking existing tests.

**Architecture:** Centralize the design in Tailwind v4 theme tokens (`globals.css`) mapped to shadcn CSS variables, load the three fonts via `next/font`, and build two shared primitives (`IncisionDivider`, `SectionHeading`) that replace the repeated `text-3xl teal + <hr>` pattern. Then migrate the UI **incrementally, file by file** — chrome → landing → inner pages → registration → confirmation — keeping legacy CSS utilities alive until their last consumer is migrated, and finishing with a cleanup + full verification sweep. The source of truth for every visual decision is `docs/design/luz-design-system.md`.

**Tech Stack:** Next.js 15 (App Router, `src/`), React 19, TypeScript (strict), Tailwind CSS v4 (`@tailwindcss/postcss`), shadcn/ui (`new-york`, Tailwind v4, RSC), `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, Vitest.

## Global Constraints

These apply to **every** task; each task's requirements implicitly include this section.

- **Design source of truth:** `docs/design/luz-design-system.md`. Every color/type/spacing decision derives from it. Do not invent new colors outside the documented palette.
- **No behavior changes.** This is a reskin. Server actions, routing, data flow, and component props/signatures stay identical unless a step says otherwise.
- **Preserve all copy strings currently asserted by tests.** Specifically keep verbatim: `CCEM UC`, `CONGRESO DE CIRUGÍA UC PARA ESTUDIANTES DE MEDICINA`, `SÉ PARTE DEL CONGRESO` (header); `I° CONGRESO DE CIRUGÍA UC`, `PARA ESTUDIANTES DE MEDICINA`, `¡Sé parte del Congreso!` (hero); `INSCRIPCIONES`, `Selecciona tu pase`, `Pase General Congreso`, `Pase Congreso + Workshop`, `Confirmar`, `${capacity} cupos disponibles`, `Seleccionado` (pricing/CourseModule); `Inscribir y pagar` + input placeholders `Ingresa tus nombres/apellidos/RUT/correo` (form); `Tu número de orden es`, `Confirmando tu compra...`, `Reenviar correo`, `Volver al inicio` (confirmation); `Cargando...`, summed price `${price}` format (buyInfo). The 8 landing sections keep their mocked render markers and order.
- **Native form controls stay native.** `src/app/form/FormClient.tsx` MUST keep native `<input>` (use shadcn `Input`, which renders a native `<input>`) and native `<select>` (do **not** replace with shadcn `Select` — the test relies on `combobox` role + `fireEvent.change`). Keep both `<select>`s as styled native elements.
- **Legacy CSS lives until its last consumer is migrated.** Keep the custom utilities (`max-w-8xl`, `max-w-9xl`, `.font-lato`, `.font-open-sans`, `.font-league-spartan`, and the rest of the legacy block) in `globals.css` through the whole migration; only remove unused ones in the final cleanup task.
- **Fonts via `next/font` only.** Remove the `@import url('https://fonts.googleapis.com/...')` lines from `globals.css`. Components must not import fonts via `@import`; they use the `font-display` / `font-sans` / `font-mono` Tailwind utilities (backed by `--font-*` theme tokens) or the legacy `.font-*` classes (which now alias the new fonts).
- **TypeScript strict** must pass: `npx tsc --noEmit` clean after every task.
- **Tests stay green:** `npm run test` passes after every task. When a step intentionally changes asserted copy/markup, update that test in the SAME task, test-first.
- **Visual gate:** every task that changes rendered output ends with a headless-Chrome screenshot of the affected route(s), reviewed before commit (see "Screenshot helper" below). A picture is the acceptance check for a reskin.
- **Copy stays in Spanish.**
- **Commits:** Conventional Commits, **one commit per task**, ending with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Out of scope:** the `/desing` lookbook page stays as a living reference until the final cleanup task decides its fate. Do not migrate `src/app/desing/page.tsx`.

### Screenshot helper

The dev server must be running once for the whole plan: `npm run dev` (background). Then any task verifies a route with:

```bash
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1440,2200 --screenshot=/tmp/luz-<name>.png "http://localhost:3000/<route>"
```

Open `/tmp/luz-<name>.png` and confirm it matches the Luz direction (sterile background, teal primary, Space Grotesk headings, incision dividers, no clashing fonts, no empty calendar). On WSL, `google-chrome` is at `/usr/bin/google-chrome`.

## File Structure

```
docs/design/luz-design-system.md      # design spec (already written; committed in Task 1)
docs/plans/2026-06-24-luz-redesign.md  # this plan
components.json                        # NEW — shadcn config
src/lib/utils.ts                       # NEW — cn() helper
src/components/ui/                     # NEW — shadcn primitives (button, card, input, label, select, table, separator, badge)
src/components/luz/IncisionDivider.tsx # NEW — signature divider
src/components/luz/SectionHeading.tsx  # NEW — eyebrow + title + incision
src/app/globals.css                    # REWRITE — Luz tokens + shadcn vars + legacy block
src/app/layout.tsx                     # REWRITE — three fonts via next/font
src/components/header.tsx              # restyle
src/components/mainPage/*.tsx          # restyle all 8 sections
src/components/InfoCard.tsx            # restyle
src/components/modulePage/moduleInfo.tsx # restyle
src/app/{about,contact,references,schedule,modules}/page.tsx # restyle
src/app/pricing/PricingClient.tsx      # restyle pass buttons
src/components/inscriptions/{weekSection,courseModule}.tsx   # restyle
src/app/form/FormClient.tsx            # restyle (native controls kept)
src/components/courseInfo.tsx          # restyle
src/app/confirmation/page.tsx          # restyle
src/app/error/page.tsx                 # restyle
src/components/buyInfo.tsx             # restyle
```

## Phase Overview

| Phase | Theme | Outcome |
|-------|-------|---------|
| 0 | Foundation | design doc committed, shadcn + deps + tokens + fonts in place; site still renders |
| 1 | Shared primitives | `IncisionDivider`, `SectionHeading` + incision CSS |
| 2 | Chrome | Header reskinned (lucide menu) |
| 3 | Landing | all 8 mainPage sections reskinned; empty calendar removed |
| 4 | Inner pages | InfoCard, moduleInfo, about/contact/references/schedule/modules |
| 5 | Registration | pricing buttons, weekSection, courseModule, form, courseInfo |
| 6 | Confirmation | confirmation, error, buyInfo |
| 7 | Cleanup & verify | remove dead CSS/fonts, full build+test+screenshot sweep |

---

## Phase 0 — Foundation

### Task 1: Commit the design system document

**Files:**
- Create (already written): `docs/design/luz-design-system.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the committed design spec every later task references.

- [ ] **Step 1: Confirm the doc exists and reads correctly**

Run: `sed -n '1,40p' docs/design/luz-design-system.md`
Expected: the «Luz» heading, palette table, typography table.

- [ ] **Step 2: Commit**

```bash
git add docs/design/luz-design-system.md docs/plans/2026-06-24-luz-redesign.md
git commit -m "docs: add Luz design system + redesign plan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Install dependencies and scaffold shadcn/ui

**Files:**
- Create: `src/lib/utils.ts`
- Create: `components.json`
- Modify: `package.json` (deps added by installs)
- Create: `src/components/ui/{button,card,input,label,select,table,separator,badge}.tsx` (via shadcn CLI)

**Interfaces:**
- Consumes: nothing.
- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/utils`; shadcn primitives importable from `@/components/ui/*`; `lucide-react` icons available.

- [ ] **Step 1: Install runtime deps**

```bash
npm install clsx tailwind-merge class-variance-authority lucide-react
npm install -D tw-animate-css
```
If npm errors on React 19 peer deps, retry with `--legacy-peer-deps`.
Expected: installs succeed; `package.json` lists the five packages.

- [ ] **Step 2: Create the `cn` helper**

`src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 4: Add shadcn components**

```bash
npx shadcn@latest add button card input label select table separator badge --yes
```
If the CLI insists on init, run `npx shadcn@latest init --yes` first (accept defaults), then re-run the `add`. After adding, **revert any CLI edits to `src/app/globals.css`** — Task 3 authors that file explicitly (`git checkout src/app/globals.css` if the CLI touched it, since Task 3 rewrites it anyway).
Expected: files appear under `src/components/ui/`. Radix deps (`@radix-ui/react-slot`, `-label`, `-select`, `-separator`) installed automatically.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (ui components reference `@/lib/utils` which now exists).

- [ ] **Step 6: Commit**

```bash
git add components.json src/lib/utils.ts src/components/ui package.json package-lock.json
git commit -m "feat: scaffold shadcn/ui (new-york, tailwind v4) + lucide

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Author Luz theme tokens and load fonts

**Files:**
- Modify (rewrite): `src/app/globals.css`
- Modify (rewrite): `src/app/layout.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind utilities `bg-background text-foreground bg-primary text-primary-foreground border-border bg-secondary bg-muted text-muted-foreground bg-destructive ring-ring`; font utilities `font-sans` (Inter), `font-display` (Space Grotesk), `font-mono` (Space Mono); the surgical-teal `*-primary-{50..950}` ramp; the `.luz-incision*` classes (defined here, used in Phase 1). CSS vars `--font-inter`, `--font-space-grotesk`, `--font-space-mono` set on `<html>`.

- [ ] **Step 1: Rewrite `src/app/globals.css`**

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

/* ---- Luz design tokens — see docs/design/luz-design-system.md ---- */
:root {
  --radius: 0.625rem;

  --background: #f4f7f6;
  --foreground: #0a3b3b;
  --card: #ffffff;
  --card-foreground: #0a3b3b;
  --popover: #ffffff;
  --popover-foreground: #0a3b3b;
  --primary: #0f6e6e;
  --primary-foreground: #ffffff;
  --secondary: #e3f1ed;
  --secondary-foreground: #0a3b3b;
  --muted: #ecf1f0;
  --muted-foreground: #5d716e;
  --accent: #e3f1ed;
  --accent-foreground: #0a3b3b;
  --destructive: #e2483d;
  --destructive-foreground: #ffffff;
  --border: #e1eae8;
  --input: #d7e2e0;
  --ring: #0f6e6e;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-display: var(--font-space-grotesk), system-ui, sans-serif;
  --font-mono: var(--font-space-mono), ui-monospace, monospace;
}

/* Surgical-teal primary ramp — replaces the old blue scale.
   Still consumed by legacy bg-primary-700 (confirmation/error) until migrated. */
@theme {
  --color-primary-50: #ecf6f5;
  --color-primary-100: #cfeae7;
  --color-primary-200: #a3d5d0;
  --color-primary-300: #6fbab4;
  --color-primary-400: #3e9a94;
  --color-primary-500: #1c807a;
  --color-primary-600: #0f6e6e;
  --color-primary-700: #0c5a57;
  --color-primary-800: #0a3b3b;
  --color-primary-900: #073030;
  --color-primary-950: #052424;
}

/* ---- Legacy utilities (kept until their last consumer is migrated; pruned in cleanup) ---- */
.font-lato { font-family: var(--font-inter), sans-serif; }
.font-open-sans { font-family: var(--font-inter), sans-serif; }
.font-league-spartan { font-family: var(--font-space-grotesk), sans-serif; }
.Grotesk { font-family: var(--font-space-grotesk), sans-serif; }
.max-w-8xl { max-width: 90rem; }
.max-w-9xl { max-width: 110rem; }
.text-xxl { font-size: 4.8em; }
.bg-purple { background-color: #1b263a; }
.bg-blue { background-color: #134ae9; }
.bg-gray { background-color: #f9fbfb; }
.svg_main { width: 100%; height: 100%; }
.underline-blue { text-decoration: underline; text-decoration-color: #134ae9; text-decoration-thickness: 2px; text-underline-position: under; }
.underline-white { text-decoration: underline; text-decoration-color: #fff; text-decoration-thickness: 2px; text-underline-position: under; }
.underline-gray { text-decoration: underline; text-decoration-color: #adadad; text-decoration-thickness: 2px; text-underline-position: under; }
@layer utilities { .text-balance { text-wrap: balance; } }

/* ---- Signature: the incision (used by IncisionDivider in Phase 1) ---- */
.luz-incision { display: flex; align-items: center; position: relative; height: 14px; }
.luz-incision--center { justify-content: center; }
.luz-incision-line { display: block; height: 2px; width: 200px; background: var(--primary); transform-origin: left; }
.luz-incision--center .luz-incision-line { transform-origin: center; }
.luz-incision-tick { width: 11px; height: 11px; background: var(--destructive); transform: rotate(45deg); margin-left: -5px; flex: none; }

@media (prefers-reduced-motion: no-preference) {
  .luz-incision-line { animation: luz-cut 1s cubic-bezier(0.7, 0, 0.2, 1) both; }
  .luz-incision-tick { animation: luz-tick 0.3s ease-out 0.9s both; }
}
@keyframes luz-cut { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes luz-tick { from { opacity: 0; transform: rotate(45deg) scale(0); } to { opacity: 1; transform: rotate(45deg) scale(1); } }

@layer base {
  * { border-color: var(--border); }
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: var(--font-inter), system-ui, sans-serif;
    overflow-x: hidden;
  }
}
```

- [ ] **Step 2: Rewrite `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter, Space_Grotesk, Space_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CCEM UC',
  description: 'I° Congreso de Cirugía UC para Estudiantes de Medicina',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Type-check and test**

Run: `npx tsc --noEmit && npm run test`
Expected: tsc clean; all tests pass (token/font changes don't touch asserted text).

- [ ] **Step 4: Visual gate — landing still renders (not yet restyled, but sterile bg + new fonts)**

Run the screenshot helper for `/` (`/tmp/luz-foundation.png`). Expected: page loads, background is sterile `#f4f7f6`, body text in Inter; no console-fatal errors. Components still use legacy classes — that's fine.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: Luz theme tokens + Space Grotesk/Inter/Space Mono fonts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1 — Shared primitives

### Task 4: IncisionDivider and SectionHeading

**Files:**
- Create: `src/components/luz/IncisionDivider.tsx`
- Create: `src/components/luz/SectionHeading.tsx`
- Create: `src/components/luz/SectionHeading.test.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`; `.luz-incision*` CSS from Task 3.
- Produces:
  - `IncisionDivider({ align?: 'left' | 'center'; className?: string }): JSX` from `@/components/luz/IncisionDivider`.
  - `SectionHeading({ eyebrow?: string; title: string; align?: 'left' | 'center'; className?: string }): JSX` from `@/components/luz/SectionHeading` — renders `eyebrow` (mono uppercase, primary) above an `<h2>` title (font-display) above an `IncisionDivider`.

- [ ] **Step 1: Write the failing test** — `src/components/luz/SectionHeading.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionHeading } from './SectionHeading';

describe('SectionHeading', () => {
  it('renders the title as a heading and the eyebrow when given', () => {
    render(<SectionHeading eyebrow="ANUNCIOS" title="Lo último" />);
    expect(screen.getByRole('heading', { name: 'Lo último' })).toBeInTheDocument();
    expect(screen.getByText('ANUNCIOS')).toBeInTheDocument();
  });

  it('omits the eyebrow when not provided', () => {
    render(<SectionHeading title="Solo título" />);
    expect(screen.getByRole('heading', { name: 'Solo título' })).toBeInTheDocument();
    expect(screen.queryByText('ANUNCIOS')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm run test -- SectionHeading`
Expected: FAIL — cannot find `./SectionHeading`.

- [ ] **Step 3: Create `IncisionDivider.tsx`**

```tsx
import { cn } from '@/lib/utils';

export function IncisionDivider({
  align = 'left',
  className,
}: {
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn('luz-incision', align === 'center' && 'luz-incision--center', className)}
      aria-hidden="true"
    >
      <span className="luz-incision-line" />
      <span className="luz-incision-tick" />
    </div>
  );
}
```

- [ ] **Step 4: Create `SectionHeading.tsx`**

```tsx
import { cn } from '@/lib/utils';
import { IncisionDivider } from './IncisionDivider';

export function SectionHeading({
  eyebrow,
  title,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn('mb-10 flex flex-col', align === 'center' && 'items-center text-center', className)}
    >
      {eyebrow && (
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      )}
      <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      <IncisionDivider align={align} className="mt-5" />
    </div>
  );
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm run test -- SectionHeading`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/luz
git commit -m "feat: add Luz IncisionDivider + SectionHeading primitives

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Chrome

### Task 5: Reskin the Header

**Files:**
- Modify (rewrite): `src/components/header.tsx`

**Interfaces:**
- Consumes: `sections.json`; `cn`; shadcn `Button`; lucide `Menu`, `X`. Keeps the `Logo BW.png` import and `sections.json` map.
- Produces: same public component (`export default Header`) — no prop changes. Keeps text `CCEM UC`, `CONGRESO DE CIRUGÍA UC PARA ESTUDIANTES DE MEDICINA`, `SÉ PARTE DEL CONGRESO`, and one link per section with its href.

Keep `header.test.tsx` green (it asserts the three strings + per-section links). The test mocks `next/font/google`'s `League_Spartan`; after removing that import the mock is simply unused — leave the test file unchanged.

- [ ] **Step 1: Rewrite `src/components/header.tsx`**

```tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import logo from '@/components/images/Logo BW.png';
import sections from '@/utils/sections.json';
import { cn } from '@/lib/utils';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src={logo} alt="CCEM UC" width={48} height={48} className="h-10 w-10 invert" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-xl font-semibold tracking-tight text-primary">
              CCEM UC
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              CONGRESO DE CIRUGÍA UC PARA ESTUDIANTES DE MEDICINA
            </span>
          </span>
        </Link>

        <ul className="hidden items-center gap-7 lg:flex">
          {sections.sections.map((section, index) => (
            <li key={index}>
              <Link
                href={section.link}
                className="text-sm text-foreground/80 transition-colors hover:text-primary"
              >
                {section.title}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="hidden rounded-lg bg-primary px-5 py-2.5 font-mono text-xs uppercase tracking-[0.1em] text-primary-foreground transition-colors hover:bg-primary-700 sm:inline-block"
          >
            SÉ PARTE DEL CONGRESO
          </Link>
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-foreground hover:bg-muted lg:hidden"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      <div className={cn('border-t border-border lg:hidden', isMenuOpen ? 'block' : 'hidden')}>
        <ul className="mx-auto flex max-w-7xl flex-col px-6 py-2">
          {sections.sections.map((section, index) => (
            <li key={index}>
              <Link
                href={section.link}
                className="block py-2 text-foreground/80 transition-colors hover:text-primary"
              >
                {section.title}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/pricing"
              className="mt-2 block rounded-lg bg-primary px-5 py-2.5 text-center font-mono text-xs uppercase tracking-[0.1em] text-primary-foreground sm:hidden"
            >
              SÉ PARTE DEL CONGRESO
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
};

export default Header;
```

Note: `SÉ PARTE DEL CONGRESO` appears twice (desktop + mobile-only fallback). `header.test.tsx` uses `getByText`, which requires a single match — verify in Step 2. If it fails on multiple matches, remove the mobile-only duplicate (the desktop one is `sm:inline-block`, hidden < sm but still in the DOM, so it is the single match; the mobile `<li>` link is `sm:hidden`). Both are in the DOM → two matches. **To keep one match: drop the mobile `<li>` CTA** and rely on the desktop CTA (visible from `sm` up; on `<sm` the menu still lists the section links). Implement without the mobile CTA `<li>`.

- [ ] **Step 2: Run the header test**

Run: `npm run test -- header`
Expected: PASS. If it fails with "multiple elements with text SÉ PARTE DEL CONGRESO", remove the mobile-only CTA `<li>` and re-run.

- [ ] **Step 3: Type-check + visual gate**

Run: `npx tsc --noEmit` then screenshot `/` (`/tmp/luz-header.png`). Expected: sterile sticky header, teal `CCEM UC` wordmark in Space Grotesk, hairline bottom border, nav links, teal CTA; logo visible (the `invert` turns the white-on-transparent logo dark on light bg — confirm; if it disappears, drop `invert`).

- [ ] **Step 4: Commit**

```bash
git add src/components/header.tsx
git commit -m "feat: reskin header to Luz (sticky sterile bar, lucide menu)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Landing sections

> All landing tasks: keep the component's default export name and the markers the `main.test.tsx` relies on (the section renders content). Use `SectionHeading` for section titles, `font-display` for headings, `font-mono` for data, and replace `<hr>`/empty imagery with incision/structure.

### Task 6: Hero (firstSection)

**Files:**
- Modify (rewrite): `src/components/mainPage/firstSection.tsx`

**Interfaces:**
- Consumes: hero background `@/components/images/mainPage/fondo_1.jpeg`; lucide `ArrowRight`. Keeps strings `I° CONGRESO DE CIRUGÍA UC`, `PARA ESTUDIANTES DE MEDICINA`, CTA `¡Sé parte del Congreso!` → `/pricing`.
- Produces: same default export. `firstSection.test.tsx` stays green unchanged.

The Luz hero is light and airy (not a dark photo wall). Use the surgical photo as a small framed accent on the right at `lg`, text-left on a sterile background; keep it single-column/centered on mobile.

- [ ] **Step 1: Rewrite `src/components/mainPage/firstSection.tsx`**

```tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import fondo from '@/components/images/mainPage/fondo_1.jpeg';
import { IncisionDivider } from '@/components/luz/IncisionDivider';

const FirstSection: React.FC = () => {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div>
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.18em] text-primary">
            I Congreso · 31 ago — 14 sep 2024 · Santiago
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.03] tracking-tight text-foreground md:text-5xl xl:text-6xl">
            I° CONGRESO DE CIRUGÍA UC
            <br />
            <span className="text-primary">PARA ESTUDIANTES DE MEDICINA</span>
          </h1>
          <IncisionDivider className="my-8" />
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            El futuro de la cirugía: innovación y nuevas perspectivas.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 font-medium text-primary-foreground transition-colors hover:bg-primary-700"
            >
              ¡Sé parte del Congreso!
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/modules"
              className="inline-flex items-center rounded-lg border border-border px-6 py-3.5 font-medium text-foreground transition-colors hover:bg-muted"
            >
              Ver módulos
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-muted-foreground">
            <span><b className="text-primary">04</b> módulos</span>
            <span className="h-3.5 w-px bg-border" />
            <span><b className="text-primary">02</b> workshops</span>
            <span className="h-3.5 w-px bg-border" />
            <span><b className="text-primary">01</b> competencia científica</span>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <div className="overflow-hidden rounded-xl border border-border">
            <Image src={fondo} alt="Cirugía en el CCEM UC" className="h-[520px] w-full object-cover" priority />
          </div>
        </div>
      </div>
    </section>
  );
};

export default FirstSection;
```

- [ ] **Step 2: Run hero + main tests**

Run: `npm run test -- firstSection main`
Expected: PASS (headline lines, CTA href, composition order all intact).

- [ ] **Step 3: Type-check + visual gate**

Run: `npx tsc --noEmit` then screenshot `/` (`/tmp/luz-hero.png`). Expected: airy sterile hero, mono eyebrow, Space Grotesk headline with second line in teal, incision divider, framed photo at right.

- [ ] **Step 4: Commit**

```bash
git add src/components/mainPage/firstSection.tsx
git commit -m "feat: reskin hero to Luz (airy, incision, framed photo)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Countdown + Announcements

**Files:**
- Modify (rewrite): `src/components/mainPage/countDownSection.tsx`
- Modify (rewrite): `src/components/mainPage/announcementSection.tsx`

**Interfaces:**
- Consumes: `SectionHeading`; existing `Foto Anuncio 1/2.png`. Countdown keeps its `'use client'` + timer logic and the strings `QUEDAN` / `PARA EL CONGRESO` / `¡Ya comenzó!`.
- Produces: same default exports. No tests on these files.

- [ ] **Step 1: Rewrite `countDownSection.tsx`** — keep all timer logic; restyle the boxes to sterile cards with teal mono numerals.

```tsx
'use client';

import React, { useEffect, useState } from 'react';

type TimeLeft = { dias: number; horas: number; minutos: number; segundos: number };

const Countdown: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  const calculateTimeLeft = (): TimeLeft => {
    const difference = +new Date('2024-08-31T00:00:00') - +new Date();
    let result: TimeLeft = { dias: 0, horas: 0, minutos: 0, segundos: 0 };
    if (difference > 0) {
      result = {
        dias: Math.floor(difference / (1000 * 60 * 60 * 24)),
        horas: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutos: Math.floor((difference / 1000 / 60) % 60),
        segundos: Math.floor((difference / 1000) % 60),
      };
    }
    return result;
  };

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) return null;

  const boxes = (Object.keys(timeLeft) as (keyof TimeLeft)[])
    .filter((k) => timeLeft[k])
    .map((interval) => (
      <div key={interval} className="flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-border bg-card font-mono text-3xl font-bold text-primary md:h-24 md:w-24 md:text-4xl">
          {timeLeft[interval]}
        </div>
        <div className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {interval}
        </div>
      </div>
    ));

  return (
    <section className="mx-auto flex max-w-7xl flex-col items-center px-6 py-16">
      <h2 className="mb-8 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        QUEDAN
      </h2>
      <div className="flex justify-center gap-4">
        {boxes.length ? boxes : <span className="text-muted-foreground">¡Ya comenzó!</span>}
      </div>
      <h2 className="mt-8 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        PARA EL CONGRESO
      </h2>
    </section>
  );
};

export default Countdown;
```

- [ ] **Step 2: Rewrite `announcementSection.tsx`** — use `SectionHeading` (eyebrow `ANUNCIOS`), cards with hairline borders and mono dates.

```tsx
import React from 'react';
import Image from 'next/image';
import Foto1 from '@/components/images/mainPage/Foto Anuncio 1.png';
import Foto2 from '@/components/images/mainPage/Foto Anuncio 2.png';
import { SectionHeading } from '@/components/luz/SectionHeading';

const announcements = [
  {
    id: 1,
    title: 'Bienvenidos al I° CCEM UC',
    date: '31/07/2024',
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
    <section className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeading eyebrow="Novedades" title="Anuncios" />
      <div className="flex flex-col gap-6">
        {announcements.map((a) => (
          <article
            key={a.id}
            className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 lg:flex-row lg:items-center"
          >
            <Image
              src={a.image}
              alt={a.title}
              width={300}
              height={300}
              className="h-48 w-full rounded-lg object-cover lg:h-40 lg:w-56"
            />
            <div className="flex-1">
              <p className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-primary">{a.date}</p>
              <h3 className="font-display text-xl font-semibold text-foreground">{a.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{a.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default AnnouncementSection;
```

- [ ] **Step 3: Test + type-check + visual gate**

Run: `npm run test -- main && npx tsc --noEmit`; screenshot `/` (`/tmp/luz-countdown.png`). Expected: countdown cards (or "¡Ya comenzó!" since the date is past), Anuncios section with `SectionHeading` + incision, hairline cards.

- [ ] **Step 4: Commit**

```bash
git add src/components/mainPage/countDownSection.tsx src/components/mainPage/announcementSection.tsx
git commit -m "feat: reskin countdown + announcements to Luz

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Modality + CCEM sections

**Files:**
- Modify (rewrite): `src/components/mainPage/modalitySection.tsx`
- Modify (rewrite): `src/components/mainPage/CcemSection.tsx`

**Interfaces:**
- Consumes: `SectionHeading`; `fondo_2.jpeg` (modality banner), `foto_2.png` (ccem). Keeps all list copy.
- Produces: same default exports. No tests.

Modality currently has broken inline `text-align:left` inside centered containers and a duplicated `PRESENCIAL` heading — fix by using three clean columns with correct labels (`Presencial`, `On-line`, `Presencial`) and no inline style hacks.

- [ ] **Step 1: Rewrite `modalitySection.tsx`**

```tsx
import React from 'react';
import Image from 'next/image';
import fondo from '@/components/images/mainPage/fondo_2.jpeg';
import { SectionHeading } from '@/components/luz/SectionHeading';

const columns = [
  {
    label: 'Presencial',
    items: ['Módulo de Cirugía General e Innovación', 'Clases magistrales de cada módulo optativo', 'Workshops'],
  },
  {
    label: 'On-line',
    items: [
      'Módulos optativos:',
      'Cirugía Digestiva y Coloproctología',
      'Cirugía de Trauma y Urología',
      'Cirugía Plástica y Oncológica',
      'Cirugía de Tórax, Cardíaca y Vascular',
    ],
  },
  {
    label: 'Presencial',
    items: ['Mejores trabajos presentados en la', 'Competencia Científica del Congreso'],
  },
];

const ModalidadSection: React.FC = () => {
  return (
    <section>
      <div className="relative h-72 w-full overflow-hidden border-y border-border md:h-96">
        <Image src={fondo} alt="" fill className="object-cover" />
      </div>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading eyebrow="Cómo se vive" title="Modalidad" align="left" />
        <div className="grid gap-8 md:grid-cols-3">
          {columns.map((col, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-display text-xl font-semibold uppercase tracking-tight text-primary">
                {col.label}
              </h3>
              <ul className="mt-4 space-y-1.5 text-muted-foreground">
                {col.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ModalidadSection;
```

- [ ] **Step 2: Rewrite `CcemSection.tsx`**

```tsx
import React from 'react';
import Image from 'next/image';
import surgicalImage from '@/components/images/mainPage/foto_2.png';
import { IncisionDivider } from '@/components/luz/IncisionDivider';

const CcemSection: React.FC = () => {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 py-16 lg:flex-row">
      <div className="lg:w-1/2">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          ¿Qué puedo hacer en el CCEM UC 2024?
        </h2>
        <IncisionDivider className="my-6" />
        <p className="text-lg leading-relaxed text-muted-foreground">
          ¡Bienvenidos al Primer Congreso de Cirugía UC para Estudiantes de Medicina! Nos complace
          darles la bienvenida a este evento único, donde la innovación y el aprendizaje se unen para
          ofrecer una experiencia enriquecedora y transformadora. Durante este congreso, tendrán la
          oportunidad de interactuar con destacados profesionales de la cirugía, participar en
          talleres prácticos, y explorar los últimos avances tecnológicos que están revolucionando el
          campo quirúrgico.
        </p>
      </div>
      <div className="lg:w-1/2">
        <Image
          src={surgicalImage}
          alt="Cirugía en el CCEM UC"
          width={729}
          height={486}
          className="w-full rounded-xl border border-border object-cover"
        />
      </div>
    </section>
  );
};

export default CcemSection;
```

- [ ] **Step 3: Test + type-check + visual gate**

Run: `npm run test -- main && npx tsc --noEmit`; screenshot `/` (`/tmp/luz-modality.png`). Expected: modality banner + three clean columns (no broken alignment), CCEM section with incision.

- [ ] **Step 4: Commit**

```bash
git add src/components/mainPage/modalitySection.tsx src/components/mainPage/CcemSection.tsx
git commit -m "feat: reskin modality + ccem sections to Luz (fix broken alignment)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Dates + Sponsors + Organization

**Files:**
- Modify (rewrite): `src/components/mainPage/datesSection.tsx`
- Modify (rewrite): `src/components/mainPage/sponsorSection.tsx`
- Modify (rewrite): `src/components/mainPage/organizationSection.tsx`

**Interfaces:**
- Consumes: `SectionHeading`; lucide `Instagram`; sponsor images. **Removes** the empty-calendar image import (`calendario.png`) — replaced by a clean schedule list with mono dates + incision rows.
- Produces: same default exports. No tests.

- [ ] **Step 1: Rewrite `datesSection.tsx`** (drop the calendar image; keep the `schedule` data)

```tsx
import React from 'react';
import { SectionHeading } from '@/components/luz/SectionHeading';

const schedule = [
  { date: 'Sábado 31 de agosto', event: '1° Jornada presencial CCEM UC 2024' },
  {
    date: 'Lun 02 — Mié 04 de septiembre',
    event: 'Módulo Cirugía Digestiva y Coloproctología\nMódulo Cirugía de Trauma y Urología',
  },
  { date: 'Sábado 07 de septiembre', event: '2° Jornada presencial CCEM UC 2024' },
  {
    date: 'Lun 09 — Mié 11 de septiembre',
    event: 'Módulo Cirugía Plástica y Oncológica\nMódulo Cirugía de Tórax, Cardíaca y Vascular',
  },
  { date: 'Viernes 13 de septiembre', event: 'Competencia Científica CCEM UC' },
  { date: 'Sábado 14 de septiembre', event: '3° Jornada presencial CCEM UC 2024' },
];

const DatesSection: React.FC = () => {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <SectionHeading eyebrow="Calendario" title="Fechas" />
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {schedule.map((item, index) => (
          <div
            key={index}
            className="grid gap-2 border-b border-border px-6 py-5 last:border-b-0 md:grid-cols-[0.9fr_1.1fr] md:items-center"
          >
            <span className="font-mono text-sm uppercase tracking-[0.08em] text-primary">{item.date}</span>
            <span className="whitespace-pre-line font-display font-medium text-foreground">{item.event}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DatesSection;
```

- [ ] **Step 2: Rewrite `sponsorSection.tsx`** (use `SectionHeading`, sterile cards)

```tsx
import React from 'react';
import Image from 'next/image';
import sponsor1 from '@/components/images/mainPage/sponsors/logo_auspiciador_1.png';
import sponsor3 from '@/components/images/mainPage/sponsors/logo_auspiciador_3.jpeg';
import { SectionHeading } from '@/components/luz/SectionHeading';

const sponsors = [
  { name: 'Pontificia Universidad Católica de Chile', image: sponsor1 },
  { name: 'Sociedad de Cirujanos de Chile', image: sponsor3 },
];

const SponsorSection: React.FC = () => {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeading eyebrow="Con el respaldo de" title="Patrocinadores y auspiciadores" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {sponsors.map((sponsor, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center"
          >
            <Image src={sponsor.image} alt={sponsor.name} width={120} height={120} className="h-24 w-24 object-contain" />
            <p className="text-muted-foreground">{sponsor.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SponsorSection;
```

- [ ] **Step 3: Rewrite `organizationSection.tsx`** (lucide Instagram)

```tsx
import React from 'react';
import Image from 'next/image';
import { Instagram } from 'lucide-react';
import sponsor1 from '@/components/images/mainPage/sponsors/logo_auspiciador_7.png';
import { SectionHeading } from '@/components/luz/SectionHeading';

const OrganizationSection: React.FC = () => {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-4">
      <SectionHeading eyebrow="Quién lo organiza" title="Organización" />
      <div className="flex flex-col items-center gap-4 text-center">
        <Image src={sponsor1} alt="Organización CCEM UC" width={120} height={120} className="h-24 w-24 object-contain" />
        <a
          href="https://www.instagram.com/ccem.uc"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-primary transition-colors hover:text-primary-700"
        >
          <Instagram className="h-4 w-4" />
          ¡Síguenos en Instagram @ccem.uc!
        </a>
      </div>
    </section>
  );
};

export default OrganizationSection;
```

- [ ] **Step 4: Test + type-check + full landing visual gate**

Run: `npm run test -- main && npx tsc --noEmit`; screenshot `/` (`/tmp/luz-landing-full.png`). Expected: Fechas as a clean mono list (no empty calendar), sponsor + organization cards, Instagram link with icon. Scroll-review the whole landing in the screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/components/mainPage/datesSection.tsx src/components/mainPage/sponsorSection.tsx src/components/mainPage/organizationSection.tsx
git commit -m "feat: reskin dates/sponsors/organization to Luz; drop empty calendar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Inner content pages

### Task 10: InfoCard + ResponsiveCard (moduleInfo)

**Files:**
- Modify (rewrite): `src/components/InfoCard.tsx`
- Modify (rewrite): `src/components/modulePage/moduleInfo.tsx`

**Interfaces:**
- Consumes: shadcn `Card`-style classes (use `bg-card border border-border rounded-xl`); lucide `FileText`, `ArrowRight`; `courseImagesDictionary`. `InfoCard` keeps prop `{ text: string }`. `ResponsiveCard` keeps props `{ title, extraInfo, imageIndex, topics }`.
- Produces: same default exports + the exported `ResponsiveCardProps` interface (unchanged). `modules/page.test.tsx` mocks `moduleInfo`, so internal markup changes are safe.

- [ ] **Step 1: Rewrite `InfoCard.tsx`** (sterile document card; drop the generic photo, use a lucide icon)

```tsx
import React from 'react';
import { FileText } from 'lucide-react';

interface InfoCardProps {
  text: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ text }) => {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary">
      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-secondary text-primary">
        <FileText className="h-6 w-6" />
      </span>
      <p className="font-display font-medium text-foreground">{text}</p>
    </div>
  );
};

export default InfoCard;
```

- [ ] **Step 2: Rewrite `moduleInfo.tsx`** (sterile module card; keep CTA link to `/pricing`)

```tsx
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import courseImagesDictionary from '@/components/images/images';

export interface ResponsiveCardProps {
  title: string;
  extraInfo: string;
  imageIndex: number;
  topics: string[];
}

const ResponsiveCard: React.FC<ResponsiveCardProps> = ({ title, extraInfo, imageIndex, topics }) => {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Image
        src={courseImagesDictionary[imageIndex]}
        alt=""
        width={500}
        height={500}
        className="h-44 w-full object-cover"
      />
      <div className="flex flex-1 flex-col p-6">
        <h5 className="font-display text-xl font-semibold tracking-tight text-foreground">{title}</h5>
        {extraInfo && <p className="mt-1 font-mono text-sm text-primary">{extraInfo}</p>}
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Temas de las clases
        </p>
        <ul className="mt-2 flex-1 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {topics.map((topic, index) => (
            <li key={index}>{topic}</li>
          ))}
        </ul>
        <Link
          href="/pricing"
          className="mt-5 inline-flex items-center gap-2 self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-700"
        >
          ¿Te gusta? ¡Inscríbete!
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

export default ResponsiveCard;
```

- [ ] **Step 3: Test + type-check + visual gate**

Run: `npm run test -- modules && npx tsc --noEmit`; screenshot `/modules` (`/tmp/luz-modules.png`) and `/references` (`/tmp/luz-references.png`). Expected: sterile module cards + document cards with icons.

- [ ] **Step 4: Commit**

```bash
git add src/components/InfoCard.tsx src/components/modulePage/moduleInfo.tsx
git commit -m "feat: reskin InfoCard + module card to Luz

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: about / contact / references / schedule / modules pages

**Files:**
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/contact/page.tsx`
- Modify: `src/app/references/page.tsx`
- Modify: `src/app/schedule/page.tsx`
- Modify: `src/app/modules/page.tsx`

**Interfaces:**
- Consumes: `SectionHeading`; shadcn `Table` (about's dates table); lucide `Mail`, `Instagram`. Each page keeps `<Header />` and its content/copy.
- Produces: same default exports. `modules/page.test.tsx` keeps passing (it mocks Header + moduleInfo and asserts card count). The shared page wrapper replaces every `text-3xl font-bold text-[#00778B]` + `<hr>` with `SectionHeading`.

- [ ] **Step 1: Rewrite `about/page.tsx`** — wrap with `SectionHeading`s and the shadcn `Table` for "Fechas importantes". Keep all paragraph + list + table copy verbatim.

```tsx
import React from 'react';
import Header from '@/components/header';
import InfoCard from '@/components/InfoCard';
import { SectionHeading } from '@/components/luz/SectionHeading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const importantDates: [string, string][] = [
  ['Publicación de bases:', 'Lunes 22 de Julio'],
  ['Período de recepción de trabajos:', 'Jueves 1 de Agosto a Sábado 10 de Agosto o hasta alcanzar la cantidad de 100 trabajos'],
  ['Revisión y selección de trabajos:', 'Lunes 12 a Viernes 23 de Agosto'],
  ['Publicación trabajos seleccionados:', 'Lunes 26 de Agosto'],
  ['Período de apelación:', 'Miércoles 28 de Agosto a Viernes 30 de Agosto (a las 23:59 hrs)'],
  ['Fecha de presentación de trabajos (pósters):', 'Viernes 13 de Septiembre'],
  ['Envío de certificados de participación:', 'Viernes 20 de Septiembre'],
  ['Publicación libro resumen:', 'Viernes 20 de Septiembre'],
  ['Período de solicitud de correcciones de certificados y libro resumen:', '5 días hábiles desde la fecha de emisión'],
];

const AboutPage: React.FC = () => {
  return (
    <div>
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <SectionHeading eyebrow="Presenta tu trabajo" title="Competencia científica" align="left" />
        <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
          <p>¡Bienvenidos al Congreso de Cirugía para Estudiantes de Medicina! Este importante evento académico y científico tiene como objetivo principal facilitar un intercambio enriquecedor de conocimientos y experiencias clínicas entre los participantes. Para ello, contará con las siguientes categorías, pudiendo ser para trabajos de investigación o casos clínicos:</p>
          <ul className="ml-6 list-disc space-y-1">
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

        <div className="mt-16">
          <SectionHeading eyebrow="Agenda" title="Fechas importantes" align="left" />
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importantDates.map(([evento, fecha], i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-foreground">{evento}</TableCell>
                    <TableCell className="text-muted-foreground">{fecha}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            *El comité organizador se reserva el derecho a establecer fechas suplementarias para recepción y revisión de trabajos, las cuales serán debidamente informadas a los participantes
          </p>
        </div>

        <div className="mt-16">
          <SectionHeading eyebrow="Para descargar" title="Documentos" align="left" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

- [ ] **Step 2: Rewrite `contact/page.tsx`** (lucide icons, sterile)

```tsx
import React from 'react';
import Header from '@/components/header';
import { Mail, Instagram } from 'lucide-react';
import { SectionHeading } from '@/components/luz/SectionHeading';

const Contact: React.FC = () => {
  return (
    <div>
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <SectionHeading eyebrow="Hablemos" title="Contacto" />
        <div className="flex flex-col items-center gap-4">
          <a
            href="mailto:contacto@ccemuc.cl"
            className="inline-flex items-center gap-2 text-lg text-primary transition-colors hover:text-primary-700"
          >
            <Mail className="h-5 w-5" />
            contacto@ccemuc.cl
          </a>
          <a
            href="https://www.instagram.com/ccem.uc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-lg text-primary transition-colors hover:text-primary-700"
          >
            <Instagram className="h-5 w-5" />
            Instagram: ccem.uc
          </a>
        </div>
      </div>
    </div>
  );
};

export default Contact;
```

- [ ] **Step 3: Rewrite `references/page.tsx`**

```tsx
import React from 'react';
import Header from '@/components/header';
import InfoCard from '@/components/InfoCard';
import { SectionHeading } from '@/components/luz/SectionHeading';

const ReferencesPage = () => {
  return (
    <div>
      <Header />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeading eyebrow="Tu participación" title="Certificados y libros" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

- [ ] **Step 4: Rewrite `schedule/page.tsx`**

```tsx
import React from 'react';
import Header from '@/components/header';
import InfoCard from '@/components/InfoCard';
import { SectionHeading } from '@/components/luz/SectionHeading';

const SchedulePage = () => {
  return (
    <div>
      <Header />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeading eyebrow="Organiza tu congreso" title="Cronogramas" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

- [ ] **Step 5: Rewrite the `modules/page.tsx` wrapper** (keep `dynamic`, `getCourses`, filter; swap header block for `SectionHeading`)

```tsx
import React from 'react';
import Header from '@/components/header';
import ResponsiveCard from '@/components/modulePage/moduleInfo';
import { SectionHeading } from '@/components/luz/SectionHeading';
import { getCourses } from '@/actions/courses';

export const dynamic = 'force-dynamic';

const ModulePage = async () => {
  const result = await getCourses();
  const courses = result.ok ? result.data : [];

  return (
    <div>
      <Header />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeading eyebrow="Aprende cirugía" title="Módulos" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

- [ ] **Step 6: Test + type-check + visual gate**

Run: `npm run test -- modules && npx tsc --noEmit`; screenshot `/about`, `/contact`, `/references`, `/schedule`, `/modules`. Expected: every inner page uses `SectionHeading` + incision (no teal-bold + `<hr>`), about's table is the shadcn Table.

- [ ] **Step 7: Commit**

```bash
git add src/app/about/page.tsx src/app/contact/page.tsx src/app/references/page.tsx src/app/schedule/page.tsx src/app/modules/page.tsx
git commit -m "feat: reskin info pages to Luz (SectionHeading, shadcn table, lucide)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Registration flow

### Task 12: Pricing passes + WeekSection + CourseModule

**Files:**
- Modify: `src/app/pricing/PricingClient.tsx`
- Modify (rewrite): `src/components/inscriptions/weekSection.tsx`
- Modify (rewrite): `src/components/inscriptions/courseModule.tsx`

**Interfaces:**
- Consumes: `SectionHeading`; shadcn `Badge`; lucide `Check`, `Users`, `ArrowRight`; `courseImagesDictionary`. 
- Produces: same default exports + props (`WeekSectionProps`, `EventsCardProps` unchanged). `PricingClient.test.tsx` keeps passing — preserve `INSCRIPCIONES`, `Selecciona tu pase`, `Pase General Congreso`, `Pase Congreso + Workshop`, `Confirmar`, and CourseModule button text `${capacity} cupos disponibles` / `Seleccionado`. Keep the selected-pass green highlight intent but use teal tokens (`ring-primary`, `bg-primary/10`) instead of `bg-green-500`.

- [ ] **Step 1: Edit `PricingClient.tsx`** — replace the inline-styled blocks. Keep all logic/strings. Specific edits:
  - Replace the `INSCRIPCIONES` heading block (the `text-3xl font-bold text-[#00778B]` + `<hr>`) with `<SectionHeading eyebrow="Asegura tu cupo" title="INSCRIPCIONES" />` (keep the exact word `INSCRIPCIONES`). Add `import { SectionHeading } from '@/components/luz/SectionHeading';`.
  - "Paso N" step headers: keep the text, restyle to `font-display`:
    ```tsx
    <div className="mb-4 flex items-baseline gap-3">
      <h1 className="font-display text-3xl font-semibold text-primary md:text-4xl">Paso 1</h1>
      <h2 className="text-xl text-muted-foreground md:text-2xl">Selecciona tu pase</h2>
    </div>
    ```
    (apply the same pattern to Paso 5 / "Procede al pago").
  - Pass buttons: replace the two pass `<button>`s' className with a token version; selected state uses teal, not green:
    ```tsx
    className={cn(
      'flex flex-col items-center justify-between gap-2 rounded-xl border bg-card p-6 text-left transition-colors sm:flex-row sm:gap-4',
      selectedPass === 1 ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary',
    )}
    ```
    (use `selectedPass === 2` for the second). Inside, set the title in `font-display text-lg md:text-2xl text-foreground` and the price in `font-mono text-xl md:text-2xl text-primary`. Add `import { cn } from '@/lib/utils';`.
  - "Confirmar" button: keep text; restyle:
    ```tsx
    className={cn(
      'rounded-lg px-8 py-4 font-medium text-primary-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
      !isAllCoursesSelected() ? 'cursor-not-allowed bg-muted-foreground/40' : 'bg-primary hover:bg-primary-700',
    )}
    ```
  - The "No disponible" and "Cargando cursos..." branches: replace `bg-blue-500`/blue button with `bg-primary hover:bg-primary-700`, and headings to `font-display text-foreground`. Keep texts `No disponible`, `Ir a inicio`, `Cargando cursos...`.

- [ ] **Step 2: Rewrite `weekSection.tsx`** (step header in `font-display`; keep `title`/`subtitle` props/strings)

```tsx
import React from 'react';
import CourseModule from '@/components/inscriptions/courseModule';
import type { WeekSectionProps } from './types';

const WeekSection: React.FC<WeekSectionProps> = ({ title, subtitle, courses, handleSelectCourse, selectedWeek, weekNumber }) => {
  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="font-display text-3xl font-semibold text-primary md:text-4xl">{title}</h1>
        <h2 className="text-xl text-muted-foreground md:text-2xl">{subtitle}</h2>
      </div>
      <div className="grid gap-6">
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
  );
};

export default WeekSection;
```

- [ ] **Step 3: Rewrite `courseModule.tsx`** (sterile card; keep button texts `${capacity} cupos disponibles` and `Seleccionado`)

```tsx
import React from 'react';
import Image from 'next/image';
import { Check, Users } from 'lucide-react';
import courseImagesDictionary from '@/components/images/images';
import { cn } from '@/lib/utils';
import type { EventsCardProps } from './types';

const CourseModule: React.FC<EventsCardProps> = ({ title, module, features, buttonText, actionOnClick, clicked }) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 rounded-2xl border bg-card p-5 lg:flex-row',
        clicked ? 'border-primary ring-2 ring-primary' : 'border-border',
      )}
    >
      <Image
        src={courseImagesDictionary[module]}
        alt=""
        width={300}
        height={300}
        className="h-48 w-full flex-none rounded-2xl object-cover lg:h-auto lg:w-1/4"
      />
      <div className="flex-1">
        <h3 className="font-display text-2xl font-semibold uppercase tracking-tight text-foreground md:text-3xl">
          {title}
        </h3>
        <ul className="mt-3 space-y-1 text-muted-foreground">
          {Object.entries(features).map(([key, value]) => (
            <li key={key}>
              <b className="text-foreground">{key}:</b> {value}
            </li>
          ))}
        </ul>
        {!clicked ? (
          <button
            type="button"
            onClick={actionOnClick}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 font-medium text-primary transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Users className="h-4 w-4" />
            {buttonText}
          </button>
        ) : (
          <button
            type="button"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground"
          >
            <Check className="h-4 w-4" />
            Seleccionado
          </button>
        )}
      </div>
    </div>
  );
};

export default CourseModule;
```

- [ ] **Step 4: Test + type-check + visual gate**

Run: `npm run test -- PricingClient && npx tsc --noEmit`; screenshot `/pricing` (`/tmp/luz-pricing.png`). Expected: SectionHeading INSCRIPCIONES, teal pass cards (selected = teal ring), sterile course cards, teal Confirmar. All 4 PricingClient tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/pricing/PricingClient.tsx src/components/inscriptions/weekSection.tsx src/components/inscriptions/courseModule.tsx
git commit -m "feat: reskin pricing + course selection to Luz (teal select state)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Registration form + CourseInfo

**Files:**
- Modify: `src/app/form/FormClient.tsx`
- Modify (rewrite): `src/components/courseInfo.tsx`

**Interfaces:**
- Consumes: shadcn `Input`, `Label`, `Button`; `cn`. **Native `<select>` kept** (styled with tokens). Keeps placeholders `Ingresa tus nombres/apellidos/RUT/correo`, button `Inscribir y pagar`, and all error strings + logic.
- Produces: same default exports. `FormClient.test.tsx` and `courseInfo.test.tsx` stay green.

- [ ] **Step 1: Edit `FormClient.tsx`** — keep ALL hooks/handlers/strings. Only change the JSX `return (...)`:
  - Add imports: `import { Input } from '@/components/ui/input';`, `import { Label } from '@/components/ui/label';`, `import { Button } from '@/components/ui/button';`, `import { cn } from '@/lib/utils';`.
  - Replace the outer container + card:
    ```tsx
    <div>
      <Header />
      <div className="min-h-screen bg-background px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card px-6 py-10 shadow-sm sm:px-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Inscripción a curso</h1>
          <div className="mb-8 mt-2">
            <CourseInfo />
          </div>
          <form id="form" noValidate className="space-y-5">
            {/* fields below */}
          </form>
        </div>
      </div>
    </div>
    ```
  - Each text field becomes (example for name; repeat for lastname/rut/email with their existing placeholders, values, onChange, and error spans/messages unchanged):
    ```tsx
    <div>
      <Input
        type="text"
        name="name"
        placeholder="Ingresa tus nombres"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        aria-invalid={showErrorName}
        className={cn(showErrorName && 'border-destructive')}
      />
      <span className={cn('mt-1 block text-sm text-destructive', !showErrorName && 'hidden')}>Faltan tus nombres</span>
    </div>
    ```
    Use placeholders exactly: `Ingresa tus nombres`, `Ingresa tus apellidos`, `Ingresa tu RUT`, `Ingresa tu correo`. RUT error uses `{errorMessageRut}`; email uses `Falta tu correo`; lastname uses `Faltan tus apellidos`.
  - The two `<select>`s stay **native** (do not use shadcn Select). Restyle with tokens and keep their options + labels + error spans:
    ```tsx
    <div>
      <select
        name="university"
        value={university}
        onChange={(e) => setUniversity(e.target.value)}
        className={cn(
          'h-10 w-full rounded-lg border bg-card px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
          showErrorUniversity ? 'border-destructive' : 'border-input',
        )}
      >
        <option value="" disabled hidden></option>
        {universities.universidades.map((uni) => (
          <option key={uni} value={uni}>{uni}</option>
        ))}
      </select>
      {!university && <Label className="mt-1 block text-muted-foreground">Selecciona tu Universidad</Label>}
      <span className={cn('mt-1 block text-sm text-destructive', !showErrorUniversity && 'hidden')}>Falta tu Universidad</span>
    </div>
    ```
    Repeat for `year` (options `['1'..'7']`, label `Selecciona el año de tu carrera`, error `Falta seleccionar el año de tu carrera`).
  - Submit button (keep text + `onClick={toggleError}`):
    ```tsx
    <Button type="button" onClick={toggleError} className="w-full">Inscribir y pagar</Button>
    ```

- [ ] **Step 2: Rewrite `courseInfo.tsx`** (keep logic + `Cargando...` + titles; restyle list)

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

  if (courses.length === 0) {
    return <h2 className="text-muted-foreground">Cargando...</h2>;
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-4">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-primary">Estás inscribiendo</p>
      <ul className="space-y-1">
        {courses.map((course) => (
          <li key={course.id} className="text-foreground">{course.title}</li>
        ))}
      </ul>
    </div>
  );
};

export default CourseInfo;
```

- [ ] **Step 3: Test + type-check + visual gate**

Run: `npm run test -- FormClient courseInfo && npx tsc --noEmit`; screenshot `/form?w1id=x&w2id=y` (`/tmp/luz-form.png`). Expected: sterile card form, shadcn inputs, native selects styled, teal submit. All FormClient + courseInfo tests pass (placeholders, comboboxes, button text intact).

- [ ] **Step 4: Commit**

```bash
git add src/app/form/FormClient.tsx src/components/courseInfo.tsx
git commit -m "feat: reskin registration form + courseInfo to Luz (native selects kept)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 — Confirmation

### Task 14: Confirmation + Error + BuyInfo

**Files:**
- Modify (rewrite): `src/app/confirmation/page.tsx`
- Modify (rewrite): `src/app/error/page.tsx`
- Modify (rewrite): `src/components/buyInfo.tsx`

**Interfaces:**
- Consumes: shadcn `Button`; lucide `CheckCircle2`, `AlertTriangle`; `useConfirmation`, `BuyInfo`. Keep `'use client'`, `Suspense`, all `useConfirmation`/`useSearchParams` logic and strings.
- Produces: same default exports. `confirmation/page.test.tsx` and `buyInfo.test.tsx` stay green — preserve `Tu número de orden es`, `Confirmando tu compra...`, `Reenviar correo`, `Volver al inicio`, `${purchaseId}`, and buyInfo's `Cargando...`, course titles, `${price}` (no thousands separator), name/rut/email.

- [ ] **Step 1: Rewrite `confirmation/page.tsx`** (keep logic; restyle; swap `bg-primary-700` Links/buttons for token classes; keep texts)

```tsx
'use client';
import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
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

  const { confirmed, courses, user, errorRedirect, resendEmail } = useConfirmation({ tokenWs, purchaseId, aborted });

  useEffect(() => {
    if (errorRedirect) router.push(errorRedirect);
  }, [errorRedirect, router]);

  const removeLocalStorage = () => localStorage.removeItem('user_id');

  return (
    <div className="mx-auto max-w-2xl px-6">
      <div className="mb-2 flex items-center gap-3">
        {confirmed && <CheckCircle2 className="h-7 w-7 text-primary" />}
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Confirmación de Orden</h2>
      </div>
      {confirmed ? (
        <p className="mb-8 text-muted-foreground">
          Tu número de orden es <span className="font-mono font-medium text-foreground">{purchaseId}</span>. Recuerda que te llegará una copia al correo electrónico que hayas indicado en el formulario.
        </p>
      ) : (
        <p className="mb-8 text-muted-foreground">Confirmando tu compra...</p>
      )}
      <BuyInfo courses={courses} user={user} />
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          onClick={removeLocalStorage}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-700"
        >
          Volver al inicio
        </Link>
        <button
          type="button"
          onClick={() => void resendEmail()}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
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
      <section className="bg-background py-12 md:py-16">
        <Suspense fallback={<p className="px-6">Cargando...</p>}>
          <ConfirmationContent />
        </Suspense>
      </section>
    </div>
  );
};

export default OrderConfirmation;
```

- [ ] **Step 2: Rewrite `error/page.tsx`** (keep logic + strings; lucide AlertTriangle; token classes)

```tsx
'use client';
import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import Header from '@/components/header';

const ErrorHeading: React.FC = () => {
  const searchParams = useSearchParams();
  const alreadyPaid = searchParams.get('alreadyPaid');
  if (alreadyPaid === 'true') {
    return <p className="font-display text-2xl font-semibold text-foreground">Ya has pagado un curso</p>;
  }
  return <h2 className="font-display text-2xl font-semibold text-foreground">Error en la compra</h2>;
};

const ErrorMessage: React.FC = () => {
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  return <p className="mb-8 text-muted-foreground">{message}</p>;
};

const RetryButton: React.FC = () => (
  <Link
    href="/pricing"
    className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-700"
  >
    Volver a intentar
  </Link>
);

const OrderError: React.FC = () => {
  return (
    <div>
      <Header />
      <section className="bg-background py-12 md:py-16">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-2 flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-7 w-7" />
            <Suspense>
              <ErrorHeading />
            </Suspense>
          </div>
          <p className="mb-8 text-muted-foreground">Ha ocurrido un error en la compra</p>
          <Suspense fallback={<p>Cargando...</p>}>
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

Note: the `text-destructive` wrapper colors the icon + heading; the heading itself sets `text-foreground`, which overrides for the text — acceptable (red icon, dark heading). Keep `Error en la compra` / `Ya has pagado un curso` verbatim.

- [ ] **Step 3: Rewrite `buyInfo.tsx`** (keep logic + all strings + `${price}`; restyle container)

```tsx
import React from 'react';
import type { Course, User } from '@prisma/client';

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <dl className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-b-0">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-end font-medium text-foreground">{value}</dd>
  </dl>
);

const BuyInfo: React.FC<{ courses: Course[]; user: User | null }> = ({ courses, user }) => {
  if (courses.length === 0 || !user) {
    return <p className="mb-8 text-muted-foreground">Cargando...</p>;
  }

  const courseWeek0 = courses.filter((c) => c.week === 0);
  const courseWeek1 = courses.find((c) => c.week === 1);
  const courseWeek2 = courses.find((c) => c.week === 2);
  const courseWorkshop = courses.find((c) => c.type === 'workshop');
  const price = courses.reduce((sum, c) => sum + c.price, 0);

  return (
    <div className="mb-8 rounded-xl border border-border bg-card p-6">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">Cursos</p>
      {courseWeek0.map((course, index) => (
        <Row key={course.id} label={`Módulo Base ${index + 1}`} value={course.title} />
      ))}
      <Row label="Semana 1" value={courseWeek1?.title} />
      <Row label="Semana 2" value={courseWeek2?.title} />
      {courseWorkshop && <Row label="Workshop" value={courseWorkshop.title} />}
      <Row label="Precio" value={`$${price}`} />
      <Row label="Nombre" value={`${user.names} ${user.lastNames}`} />
      <Row label="RUT" value={user.rut} />
      <Row label="Correo" value={user.email} />
    </div>
  );
};

export default BuyInfo;
```

- [ ] **Step 4: Test + type-check + visual gate**

Run: `npm run test -- confirmation buyInfo && npx tsc --noEmit`; screenshot `/confirmation?purchaseId=p1` and `/error?message=Pago%20no%20realizado` (`/tmp/luz-confirmation.png`, `/tmp/luz-error.png`). Expected: sterile confirmation with check icon + teal/outline buttons; error with red alert icon. All confirmation + buyInfo tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/confirmation/page.tsx src/app/error/page.tsx src/components/buyInfo.tsx
git commit -m "feat: reskin confirmation + error + buyInfo to Luz

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7 — Cleanup & verification

### Task 15: Prune dead CSS, full build, and final sweep

**Files:**
- Modify: `src/app/globals.css` (remove now-unused legacy utilities)
- (Decision) `src/app/desing/page.tsx`

**Interfaces:**
- Consumes: the fully migrated app.
- Produces: a clean `globals.css` with only the tokens, the teal ramp, the `.luz-incision*` classes, the font aliases still referenced, and `max-w-8xl` if still used; a green `npm run build` + `npm run test`.

- [ ] **Step 1: Find remaining legacy-class usages**

```bash
grep -rnoE "font-lato|font-open-sans|font-league-spartan|Grotesk|max-w-8xl|max-w-9xl|bg-purple|bg-blue|bg-gray|underline-(blue|white|gray)|text-xxl|svg_main" src/ --include=*.tsx | grep -v "src/app/desing"
```
Expected: list of files still using each class. Any class with **zero** hits (outside `/desing`) is safe to delete from `globals.css`.

- [ ] **Step 2: Remove the unused legacy utilities from `globals.css`**

Delete every legacy utility rule that Step 1 showed as unused (keep the ones still referenced, plus `.luz-incision*`, the token blocks, and the teal ramp). Keep the font-alias classes only if still referenced. Re-run the grep to confirm no class you deleted is still used.

- [ ] **Step 3: Decide on `/desing`**

The `/desing` lookbook may use legacy classes and is internal. Default: **keep it** as a living reference (it is self-contained with its own scoped CSS and does not affect production). If it now references a deleted legacy class, either restore that one class or delete `src/app/desing/page.tsx`. State which you chose in the commit body.

- [ ] **Step 4: Full verification**

```bash
npm run test
npx tsc --noEmit
npm run build
```
Expected: all tests pass; tsc clean; production build succeeds.

- [ ] **Step 5: Whole-site screenshot sweep**

Screenshot each route and review against `docs/design/luz-design-system.md`: `/`, `/modules`, `/about`, `/contact`, `/references`, `/schedule`, `/pricing`, `/form?w1id=x&w2id=y`, `/confirmation?purchaseId=p1`, `/error?message=test`. Confirm: one consistent type system (Space Grotesk / Inter / Space Mono), sterile teal palette everywhere, incision dividers instead of `<hr>`, no empty calendar, no leftover pink/blue/`#00778B` accents.

```bash
grep -rnoE "#00778B|#116D85|bg-pink|bg-blue-500|text-blue-600|border-gray-300" src/ --include=*.tsx | grep -v "src/app/desing"
```
Expected: no production matches (all migrated). Fix any stragglers, re-run tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: prune dead CSS + final Luz verification sweep

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Palette/type/tokens → Task 3 + design doc (Task 1). ✓
- shadcn/ui + lucide + dependency added → Task 2 (deps, components.json, ui components). ✓
- Design document with all info → Task 1 (`docs/design/luz-design-system.md`). ✓
- Every page/component migrated → Tasks 5–14 cover header, 8 landing sections, InfoCard, moduleInfo, about/contact/references/schedule/modules, pricing/weekSection/courseModule, form/courseInfo, confirmation/error/buyInfo. ✓
- Follow `docs/` plan conventions (Global Constraints, phased, TDD-ish, conventional commits + trailer) → matches `docs/plans/2026-06-23-monolith-migration.md`. ✓
- Cleanup of legacy CSS/fonts → Task 15. ✓

**Type/string consistency:** `IncisionDivider`/`SectionHeading` signatures defined in Task 4 are used unchanged in Tasks 6–14. `cn` (Task 2) used throughout. shadcn imports (`@/components/ui/*`) all from Task 2's `add`. Preserved-string list in Global Constraints matches each task's notes.

**Placeholder scan:** every code step includes complete file content or exact edit instructions with code. shadcn `ui/*` files are CLI-generated (Task 2) — not placeholders.

**Known risks flagged inline:** header double-CTA match (Task 5 Step 1 note), logo `invert` on light bg (Task 5 Step 3), native selects must stay native (Global Constraints + Task 13).
