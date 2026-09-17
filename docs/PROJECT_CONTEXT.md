# CRM — Complete Project Context

> **What this file is.** A self-contained briefing on the `crm` codebase, written
> so an assistant with no memory of earlier sessions can work on it as
> effectively as the one that wrote it. Everything below was checked against the
> code, the git history and the live database at commit **`4fe3637`**
> (17 September 2026). Sections 1, 2, 4–6, 11, 12 and 16–19 were then updated
> for the shadcn/ui refactor on branch **`feat/shadcn-ui`**. Where something is
> broken or unfinished, it says so plainly — see §17.

**Contents**
1. What this is · 2. Stack · 3. Running it · 4. Repository layout ·
5. Architecture · 6. Design system · 7. Domain model (**read first**) ·
8. Database · 9. Roles & permissions · 10. API reference · 11. Pages ·
12. Shared code · 13. Business rules · 14. Seed data · 15. Metric definitions ·
16. History · 17. Known problems · 18. Conventions · 19. Notes for whoever picks
this up

---

## 1. What this is

A sales CRM for an **Indian** sales team. All money is in **rupees (₹)**.

The flow it supports: leads arrive (typed in, or imported from CSV) → agents work
them, changing status and recording why → they book follow-up calls → converted
leads carry deals through a forward-only pipeline → dashboards report on all of
it.

- **Repo:** `https://github.com/Rishi2600/crm`, branch `main`.
  Local path `/home/rishi/Projects/crm`.
- **Owner:** Rishi (git user `Rishi2600`). Works in VS Code with the Claude Code
  extension, and in the Claude Code CLI. Commits are made by the owner, not by
  the assistant.
- **Single company.** There is no multi-tenancy.
- **Reference product.** The Leads module was modelled on screenshots of an
  existing Indian CRM (lead names like "MANISH KUMAR", source "The Tribune",
  status "New / Untouched"). The owner said the screenshots were reference
  only — this project's own conventions win where they disagree.

**Current state:** everything committed, working tree clean. Type-checks and
production-builds clean. There are **no automated tests**. The UI was moved
onto shadcn/ui on branch **`feat/shadcn-ui`** (plan and decisions in
`docs/UI_REFACTOR_PLAN.md`); that branch is not merged into `main`. No API,
schema or business rule changed in it.

---

## 2. Stack

| Piece | Version / choice |
|---|---|
| Next.js (App Router) | 14.1.0 |
| React | 18.3.1 |
| TypeScript | 5.9.3, `strict: true`, path alias `@/*` → `./src/*` |
| Prisma + `@prisma/client` | 5.22.0 |
| Database | PostgreSQL on **Neon** (pooled connection) |
| Tailwind CSS | 3.4.19 |
| Auth | `jose` 5.10 (HS256 JWT) + `bcryptjs` |
| UI primitives | **shadcn/ui** (style `new-york`, base colour neutral, CSS variables) on **Radix** (`@radix-ui/react-*`); config in `components.json` |
| UI helpers | class-variance-authority, clsx + tailwind-merge (`cn()`), tailwindcss-animate |
| Toasts | sonner 2 (no `next-themes`) |
| Calendar | react-day-picker **9** (not 10) |
| Command palette | cmdk |
| Charts | recharts 2.15.4, wrapped by the shadcn `chart` component |
| Animation | framer-motion 11.18.2 |
| Icons | lucide-react 0.363.0 |
| Seed runner | tsx |
| Node on the dev machine | 24.21.0 |

Not present: test framework, ESLint config (`npm run lint` prompts to create
one, so lint has never run), CI, request-validation library, rate limiting,
logging or monitoring library.

---

## 3. Running it

### Environment (`.env`, gitignored)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs login tokens |
| `JWT_EXPIRES_IN` | Token lifetime, `7d` |
| `NEXT_PUBLIC_APP_URL` | App base URL |

The owner's local `.env` points at a **Neon** database
(`ep-bitter-math-…-pooler.c-2.us-east-1.aws.neon.tech`). Its `JWT_SECRET` is
still the placeholder copied from `.env.example` — a value committed to the repo.

### Commands

```bash
npm install
npx prisma migrate deploy   # apply migrations
npx prisma generate         # regenerate the client — `npm run dev` does NOT do this; `npm run build` does
npm run db:seed             # sample data — DESTRUCTIVE, safe to re-run (see §14)
npm run dev                 # http://localhost:3000
```

| Script | Runs |
|---|---|
| `dev` | `next dev` |
| `build` | `prisma generate && next build` |
| `start` | `next start` |
| `lint` | `next lint` (unconfigured) |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` |
| `db:push` | `prisma db push` |
| `db:studio` | `prisma studio` |
| `db:seed` | `tsx prisma/seed.ts` |

### Logins created by the seed

Password for all: **`password123`**

| Email | Name | Role | Reports to |
|---|---|---|---|
| `admin@crm.com` | Sarah Ahmed | ADMIN | — (outside the tree) |
| `usman@crm.com` | Usman Tariq | MANAGER | — |
| `ali@crm.com` | Ali Hassan | SALES_REP | Usman |
| `fatima@crm.com` | Fatima Khan | SALES_REP | Usman |
| `hamza@crm.com` | Hamza Iqbal | SALES_REP | Usman |
| `priya@crm.com` | Priya Nair | MANAGER | — |
| `rohit@crm.com` | Rohit Menon | SALES_REP | Priya |

The login page shows `admin@crm.com · password123` as a demo hint.

### Environment gotchas

- **Neon suspends idle databases.** The first request after a quiet spell can
  fail with *"Can't reach database server"*. That is a cold start, not a code
  bug — retry.
- **Ad-hoc `tsx` scripts don't load `.env` by themselves.** A script run this way
  failed with *"Environment variable not found: DATABASE_URL"*. Run
  `set -a; . ./.env; set +a` first. The seed was always run that way during
  development.
- **Prisma logs every query in development** (`src/lib/prisma.ts`), so the dev
  console is noisy.
- **`tsconfig.tsbuildinfo` is tracked in git** even though it's a build cache.
  `.gitignore` lists it, but that has no effect until it's untracked with
  `git rm --cached tsconfig.tsbuildinfo`. Running `tsc` or `next build` modifies
  it; restore with `git checkout -- tsconfig.tsbuildinfo`.

---

## 4. Repository layout

```
crm/
├── README.md                     setup, logins, pages, known gaps
├── components.json               shadcn/ui settings (new-york, neutral, lucide, aliases)
├── docs/
│   ├── PROJECT_CONTEXT.md        this file
│   ├── MODULES.md                the three feature modules and the reasoning behind them
│   ├── LIFECYCLE-AUDIT.md        end-to-end walkthrough against the real DB + findings
│   ├── RBAC.md                   roles, permissions, the inter-team fix
│   └── UI_REFACTOR_PLAN.md       the shadcn/ui refactor: findings, decisions, checklist
├── prisma/
│   ├── schema.prisma             10 models, 18 enums
│   ├── seed.ts                   idempotent, destructive sample data
│   └── migrations/               9 hand-written SQL migrations
├── next.config.js                empty — no custom config, no security headers
├── tailwind.config.js            shadcn colour tokens, radius, Inter + JetBrains Mono, tailwindcss-animate
└── src/
    ├── middleware.ts             JWT check on every non-static path; sets x-user-* headers
    ├── app/
    │   ├── layout.tsx            Toast + Confirm providers; pre-paint theme script
    │   ├── globals.css           Inter import (first!), colour tokens (light/.dark), focus ring
    │   ├── page.tsx              marketing landing page (see §17: behind auth)
    │   ├── (auth)/login/         login page (no shell)
    │   ├── (app)/                every signed-in page; layout.tsx wraps them in AppShell
    │   │   ├── dashboard/        Lead / Follow-Up / Deal insight tabs
    │   │   ├── leads/            lead list + leads/[id] detail
    │   │   ├── contacts/         contact list
    │   │   ├── deals/            kanban pipeline
    │   │   ├── follow-ups/       follow-up list
    │   │   ├── tasks/            task list
    │   │   └── analytics/        analytics dashboard
    │   └── api/                  23 route handlers (see §10)
    ├── components/
    │   ├── ui/                   shadcn/ui primitives (copied source; see §6)
    │   ├── common/               the app's own shared components (see §6)
    │   ├── layout/               AppShell, AppSidebar, CommandMenu, PageHeader, ThemeToggle, nav.ts
    │   ├── cards/                ActivityFeed
    │   ├── charts/               AreaTrendChart, DealsChart, GroupedBarChart, PipelineChart,
    │   │                         RevenueChart, TrendsChart
    │   ├── insights/             DateRangeFilter, InsightsPanel, InsightsTabs
    │   └── leads/                LeadStatusFields
    ├── hooks/
    │   └── use-mobile.tsx        phone-width check used by the shadcn sidebar
    ├── lib/
    │   ├── auth.ts               sign/verify JWT, extract token
    │   ├── prisma.ts             singleton client
    │   ├── scope.ts              THE permission rule + date helpers
    │   ├── insights.ts           trend-graph time bucketing
    │   ├── leads.ts              lead label↔enum maps, pairing rule — CLIENT-SAFE
    │   ├── leads.server.ts       prepareLead() — needs the database
    │   ├── csv.ts                hand-written RFC-4180 parser
    │   ├── currency.ts           formatINR / formatINRExact
    │   └── utils.ts              cn() — merges Tailwind classes
    └── types/                    analytics, contacts, dashboard, deals, followups,
                                  insights, leads, tasks
```

---

## 5. Architecture

### Request flow

1. **Login.** `POST /api/auth/login` checks the password with bcrypt and signs a
   JWT containing `{ userId, email, role }`. It returns `{ token, user }` **and**
   sets an `httpOnly` cookie `auth-token` (7 days, `sameSite: lax`, `secure` in
   production).
2. **Client storage.** The login page saves `crm-token` and `crm-user` to
   `localStorage`. Every page's `fetch` sends `Authorization: Bearer <crm-token>`.
   Browser navigation is authenticated by the cookie.
3. **Middleware** (`src/middleware.ts`) runs on every path except static assets.
   Only paths starting with `/login` or `/api/auth/login` are public. A token is
   taken from the Bearer header, falling back to the cookie. Missing or invalid →
   `401` JSON for `/api/*`, redirect to `/login` for pages. Valid → the request
   continues with headers **`x-user-id`**, **`x-user-email`**, **`x-user-role`**
   copied from the token. Middleware never checks roles.
4. **Route handlers** read `x-user-id` / `x-user-role` and do all authorization
   themselves (§9).

### Frontend data fetching

Every page is a `"use client"` component that fetches in `useEffect`. There are
no server components fetching data and no data library (no SWR / React Query).
The one server component in the shell, `src/app/(app)/layout.tsx`, reads only
the `sidebar_state` cookie (so the sidebar opens in the state the user left
it); that cookie read makes the signed-in routes dynamic (λ) in `next build`.
Each page redirects to `/login` if `crm-token` is missing from `localStorage`.

The Dashboard fetches `/api/dashboard` **lazily** — only when the Deal Insights
tab is first opened, since the page lands on Lead Insights.

Search boxes debounce by 400 ms and deliberately skip their mount-time run,
because the filter effect already fetched on first load. This pattern is
repeated in Contacts, Deals, Tasks, Follow-ups and Leads.

### API conventions

- **Success:** `{ success: true, message, data }`. Lists add
  `page, limit, total, totalPages`, and newer lists add a `summary` of counts.
- **Error:** `{ error, message }`, where `error` is one of `Bad Request` (400),
  `Unauthorized` (401), `Forbidden` (403), `Not Found` (404),
  `Internal Server Error` (500).
- **Unique violations** (Prisma `P2002`) are turned into a clean 400
  *"… already exists"*.
- **Display labels, never enums.** Requests and responses use human strings
  (`"Proposal Sent"`, `"Closed Won"`, `"Hot"`). Each module converts to and from
  enum values internally, and builds its reverse map from the forward one so the
  two can't drift apart.
- **Pagination:** `page` ≥ 1, `limit` clamped to 1–100 (default 20), using
  Prisma `skip`/`take`.
- **Caching:** newer routes declare `export const dynamic = "force-dynamic"`.
  Thirteen routes don't. Four of those — `analytics/dashboard`, `companies`,
  `deals/pipeline`, `users/assignable` — print harmless *"Dynamic server usage"*
  messages during `next build`. The rest only handle writes, so they're dynamic
  regardless.
- **Validation** is hand-written in each route, and happens before the first
  database write.

---

## 6. Design system

The UI is built on **shadcn/ui** (style `new-york`, neutral greys, one blue
accent). The look follows a reference dashboard design: hairline borders, no
shadows, one card per block, metric strips divided by hairlines, and a blue
ramp for every chart and progress bar.

### Colour tokens (`src/app/globals.css`)

Tokens hold **bare HSL channels** (`0 0% 98%`); `tailwind.config.js` wraps them
in `hsl()` so opacity modifiers such as `bg-primary/10` work.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--background` | `#fafafa` | `#080808` | page |
| `--card`, `--popover` | `#ffffff` | `#161616` | cards, menus, dialogs |
| `--foreground` | `#0a0a0a` | `#fafafa` | text |
| `--muted`, `--secondary`, `--accent` | `#f5f5f5` | `#262626` | subtle fills, hover |
| `--muted-foreground` | `#737373` | `#a1a1a1` | secondary text |
| `--border`, `--input` | `#e5e5e5` | `#262626` | hairlines, field borders |
| `--primary`, `--ring` | `#155dfc` | `#155dfc` | buttons, focus ring, active states |
| `--destructive` | `#dc2626` | `#dc2626` | destructive *fills* |
| `--chart-1` … `--chart-5` | `#155dfc` `#2b7fff` `#8ec5ff` `#1447e6` `#193cb8` | same | charts, progress bars (single-series charts use chart-1) |
| `--chart-axis` | `#737373` | `#626262` | chart axis labels (`fill-axis`) |
| `--sidebar-*` | white panel | `#161616` panel | the sidebar |
| `--radius` | `0.625rem` | | corner radius scale |

**Semantic colours** keep finished values (not HSL channels) and lighten in the
dark theme so small text stays readable:

| Variable | Light | Dark | Tailwind class |
|---|---|---|---|
| `--text-faint` | `#cccccc` | `#525252` | `text-faint`, `bg-faint` |
| `--green` | `#16a34a` | `#4ade80` | `text-success` |
| `--red` | `#dc2626` | `#f87171` | `text-danger` (red **text**; `destructive` is for fills) |
| `--live` | `#22c55e` | `#4ade80` | `bg-live` |

The old names `--bg`, `--bg-subtle`, `--bg-card`, `--text` and `--text-muted`
are gone, and `--border` is now shadcn's token (HSL channels).

**Status colours** all live in `src/components/common/statusColors.ts`:

- Deal stages: Qualification chart-3, Proposal chart-2, Negotiation chart-1,
  Closed Won green. Deal status (derived on the board): Won green, Open grey.
- Lead status: Fresh chart-1 blue, Interested amber `#d97706`, Converted green,
  Closed red, Irrelevant faint.
- Follow-up status: Planned grey, Pending amber, Done green, Missed red,
  Cancelled faint.
- Temperature: Hot red, Warm amber, Cold grey. Task priority: High red,
  Medium amber, Low grey.

Amber has no theme token yet; it is the one hex value kept in that file.

### Theme

- Dark mode is still the class `.dark` on `<html>`, saved in `localStorage`
  under `crm-theme`, applied before first paint by an inline script in
  `layout.tsx`. There is no `next-themes`.
- `ThemeToggle.tsx` exports `useThemeToggle()` (used by the sidebar's user
  menu) and the standalone button used on the login and landing pages. The
  switch animates as a circle expanding from the button; the overlay colours
  `#fafafa` / `#080808` are hard-coded to match the backgrounds.
- The sonner `Toaster` follows the `.dark` class through a MutationObserver.
- `:root` and `.dark` set `color-scheme`, so native controls (the time picker,
  scrollbars) follow the theme.
- Font: **Inter**. Its Google Fonts `@import` must be the first rule in
  `globals.css`; before the refactor it sat below the Tailwind directives, the
  browser ignored it, and the app actually rendered in the system font.

### Styling idiom

- Colour comes from **token classes** (`bg-card`, `text-muted-foreground`,
  `border`, `text-danger`). Conditional classes go through `cn()` from
  `src/lib/utils.ts`.
- **Inline styles only for values computed at runtime**: bar widths, a dot
  colour looked up from `statusColors.ts`, a chart height, a Dialog's
  `maxWidth`.
- **No shadows.** Blocks are separated by hairline borders.

### Page shell

- `src/app/(app)/layout.tsx` (server) reads the `sidebar_state` cookie and
  renders `AppShell` (client): `SidebarProvider` → `PageHeaderProvider` →
  `AppSidebar` + `SidebarInset`.
- **`AppSidebar`** (`variant="inset"`, collapses to icons with the top-bar
  button or Ctrl/Cmd+B; on phones it becomes a sheet): brand block, the nav list from `nav.ts` (Dashboard, Leads,
  Contacts, Deals, Follow-up, Tasks, Analytics), a Search entry, and a user
  menu with name, email and role (from `crm-user`), the theme switch, and
  **Sign out** (same behaviour as before — see §17 item 3). The active item is
  matched by path prefix, so `/leads/<id>` keeps **Leads** highlighted. Every
  item is shown to every role.
- **Top bar**: sidebar toggle, the page's title, the page's actions, and a
  search button. Pages fill it with
  `<PageHeader title={…}>actions</PageHeader>`, which portals into two slot
  elements. List pages show "Title · count"; the create buttons (New Deal, Add
  Lead, Bulk Upload, New Follow-Up, New Contact, New Task) live here, with
  their labels hidden on phones.
- **`CommandMenu`** (Ctrl/Cmd+K, or the Search entries) jumps between pages. It
  searches nothing else.
- Content sits in `p-4 md:p-6`.

### Tables

- The shadcn `Table` inside `rounded-xl border bg-card`; the header row sits on
  `bg-muted/40`. Each table has a minimum width and scrolls sideways inside its
  card on narrow screens.
- The first cell shows `InitialsAvatar` plus **`RevealOnHover`**. Only the name
  or title shows at rest; the other details slide open when the row is hovered
  or keyboard-focused. The owner's rules still hold:
  - **The name is plain text, not a link.** Each table has its own way to open
    a record.
  - **The expansion must be smooth.** It animates `grid-template-rows` from
    `0fr` to `1fr` over 300 ms, with a 200 ms opacity fade — not `max-height`,
    which stalled partway and looked janky.
  - Each row carries the class **`group/row`** — a *named* group, so it can't
    collide with a plain `group`.
- Statuses are `StatusBadge`s. Row actions sit in a `RowActionsMenu` ("…"):
  Leads (Open, Change status, Schedule follow-up; the status cell stays
  clickable and the open chevron stays), Follow-ups (Mark as Done / Missed /
  Cancelled, or Set outcome on Done rows; Reschedule), Tasks (Change status,
  Delete). Contacts has a single Schedule follow-up button.
- Loading shows `TableSkeletonRows`; empty shows `TableMessageRow`.
- `PaginationFooter`: "Page X of Y · Count: N" with first / previous / next /
  last. Page sizes are fixed: Leads 20, Follow-ups 20, Contacts 10. Tasks shows
  "Showing N of M" only (see §17 item 32).

### Primitives (`src/components/ui`)

shadcn/ui source copied into the repo: `alert-dialog`, `avatar`, `badge`,
`button`, `calendar`, `card`, `chart`, `command`, `dialog`, `dropdown-menu`,
`input`, `label`, `popover`, `progress`, `select`, `separator`, `sheet`,
`sidebar`, `skeleton`, `sonner`, `table`, `tabs`, `textarea`, `tooltip`.

Local edits are listed in a comment at the top of each file: shadow classes
removed everywhere; `badge` renders a `<span>`; `calendar`'s Tailwind-v4-only
classes rewritten for v3; `chart`'s tooltip takes a `valueFormatter` and shows
zeros, and axis labels use `fill-axis`; `progress`'s track uses the border
colour; `tabs` triggers get a border when active; `command`'s dialog has a
hidden title; `sonner.tsx` is hand-written (no `next-themes`).

### Shared components (`src/components/common`)

| Component | Notes |
|---|---|
| `Select` | Radix select with the old props (`value`, `onChange`, `options`, `placeholder`, `className`, `align`, `id`). An option whose value is `""` works through a sentinel. A value that matches no option shows the placeholder. |
| `DatePicker` | Popover + calendar. Value is `"YYYY-MM-DD"` or `""`, parsed as a local date. Has a "Clear date" button and an `id`. |
| `Dialog` | Radix dialog. Props: `open`, `onClose`, `title`, `description`, `footer`, `maxWidth` (default `480px`). Escape and backdrop close it. |
| `ConfirmDialog` | `const confirm = useConfirm(); if (await confirm({ title, message, danger })) …` — an AlertDialog, so a backdrop click doesn't dismiss it. |
| `Toast` | `const { showToast } = useToast(); showToast(msg, "success" \| "error" \| "info")` — sonner, 3.5 s, click to dismiss. |
| `RevealOnHover` | `<RevealOnHover primary={name}><RevealLine tone="muted"\|"faint">…</RevealLine></RevealOnHover>`. Renders no wrapper if given no children. |
| `SectionCard` | Card with `title`, `description`, `action` (controls on the right). |
| `MetricStrip` | One card divided into cells: `metrics[{ label, value, icon?, change? }]`, `perRow` (2–8), `loading`, `compact` (for text values). `change` draws a green/red line with an arrow. |
| `ErrorBanner` | The inline error style. |
| `StatusBadge` | Outlined badge with a coloured dot. |
| `FormField` | Label above a control, optional hint. |
| `SearchInput` | Input with a search icon. |
| `FilterPills` | Pill buttons with counts (Leads, Follow-ups). |
| `SegmentedToggle` | Two- or three-way toggle (Analytics ranking). |
| `PaginationFooter`, `RowActionsMenu`, `TableStates`, `ScoreBar`, `InitialsAvatar` | See Tables. |
| `FollowUpFields` | Date, time and optional notes fields shared by every follow-up form. |

Also: `components/leads/LeadStatusFields` (the status prompt's body, shared by
the lead list and detail pages) and `components/charts/AreaTrendChart` (the one
gradient area chart: Revenue, Trends, Analytics).

Skeletons are drawn in the final shape of each block; `LoadingState` and the
old `MetricCard` / `InsightCard` tiles were deleted.

**Hydration:** Radix mounts its portals on the client itself, so the old
`mounted` guards are gone. `PageHeader`'s slots are empty on the first render,
so server and client markup match.

### Adding a primitive

1. `yes n | npx shadcn@latest add <name>` — the `yes n` answers "no" to every
   "overwrite?" prompt. **Never run `shadcn init`**: this CLI only offers
   Tailwind v4 presets.
2. `git diff tailwind.config.js src/app/globals.css` — `add sidebar` once
   rewrote both; restore them if touched.
3. Check `package.json`: `add sonner` pulls in `next-themes`, and `add calendar`
   pulls in react-day-picker 10 and date-fns. This repo uses neither.
4. Remove shadow classes, rewrite any Tailwind-v4-only syntax, and list the
   local edits in a comment at the top of the file.
5. Add it in the same commit as the first code that uses it.

---

## 7. Domain model — read this before touching leads

### A lead *is* a contact

The Leads page and the Contacts page read the **same `contacts` table**.
Converting a lead changes its status; nothing is copied or re-keyed. Every deal,
task and follow-up attached to the person stays attached.

### A contact has several independent fields that sound alike

| Column | What it means | Values |
|---|---|---|
| `status` (`ContactStatus`) | lifecycle — **dead: nothing in the app ever writes it** | ACTIVE, INACTIVE, LEAD |
| `leadStatus` (`LeadStatus`) | sales temperature | HOT, WARM, COLD |
| `leadStage` (`LeadStage`) | pipeline position — **what the KPI cards count** | FRESH, INTERESTED, CONVERTED, CLOSED, IRRELEVANT |
| `leadSubStatus` (`LeadSubStatus`) | second level under `leadStage` | 12 values, see below |
| `leadSource` (`LeadSource`) | coarse origin | DIRECT, REFERRAL, WEBSITE, CAMPAIGN, EVENT, OTHER |
| `sourceName` | specific origin, free text | e.g. "The Tribune" |
| `leadScore` | 0–100, set by hand | integer |
| `revivedAt` | when the lead last came back from Closed/Irrelevant | timestamp |
| `reEnquiryCount` | times the lead enquired again | integer — **never incremented by app code** |

### ⚠️ The naming trap

The reference screenshots call the pipeline position **"Status"** and the
High/grade value **"Lead Stage"**. This schema uses those two words the other
way round. The columns were **not renamed**, because the Dashboard's KPI cards
have counted by `leadStage` since Module 1 and renaming would have silently
changed what they mean. Only the labels on screen follow the screenshots:

| On screen | Actual column |
|---|---|
| Leads pages: **Status** | `leadStage` |
| Leads pages: **Sub-Status** | `leadSubStatus` |
| Leads pages: **Temperature** | `leadStatus` |
| Leads pages: **Source** | `leadSource` + `sourceName` |
| Contacts page / API: **status** | `leadStatus` ← Hot/Warm/Cold, *not* pipeline |
| Analytics: **Active Leads** | count of **OPEN deals** ← not leads at all |

All lead label translation happens in `src/lib/leads.ts`; the explanation lives
at the top of `src/types/leads.ts`.

### Which sub-statuses belong to which status

Defined once, in `SUB_STATUS_BY_STATUS` in `src/lib/leads.ts`. The dropdowns are
built from it and the API validates against it, so the two can't disagree. It is
**not** a database constraint. The **first** option in each row is the default
when a status changes without a sub-status being named.

| Status | Sub-statuses (first = default) |
|---|---|
| Fresh | **Untouched**, Contacted, Not Reachable |
| Interested | **Callback Requested**, Proposal Sent, Negotiating |
| Converted | **Won** |
| Closed | **Lost**, Dropped |
| Irrelevant | **Junk**, Duplicate, Out of Area |

### Deals

- `stage` moves **forward only**: Qualification → Proposal → Negotiation →
  Closed Won. Moving backward is refused.
- `status` is OPEN, WON or LOST. Moving to Closed Won sets `status = WON` and
  `closedAt = now`.
- There is **no "Closed Lost" stage**, and nothing in the app ever sets
  `status = LOST`. Lost deals exist only because the seed creates them.
- `amount` is `Decimal(12,2)`, treated as INR. There is no currency column.
- `probability` is 0–100.

### Follow-ups

- **Stored** status: PENDING, COMPLETED, MISSED, CANCELLED.
- **Shown** status: **Planned** (pending, time still ahead), **Pending**
  (pending, time already passed — the Dashboard calls this "Overdue"), **Done**,
  **Missed**, **Cancelled**. Planned vs Pending is worked out on every read,
  never stored.
- `rescheduleCount` is a counter, not a status. A follow-up rescheduled twice
  and then completed is still Completed.
- `outcome` (Connected, Not Connected, Interested, Not Interested, Callback
  Requested, Converted) is only allowed on completed follow-ups.

### Tasks

- A task has `assignedTo` and `createdBy`, but **no owner field**.
- `type` is STANDARD or MEETING. A meeting's details live in `TaskActivity`; the
  contacts attending live in `TaskAttendee`.
- Status: TODO, IN_PROGRESS, COMPLETED. Priority: HIGH, MEDIUM, LOW.

### History and activity — two different things

- **`LeadHistory`** is the structured timeline for one lead: created, status
  changed, assigned, remark added, details updated, follow-up scheduled. It
  stores before/after values as display labels, plus an optional remark.
- **`Activity`** is the Dashboard's company-wide "Recent Activity" feed. It
  stores a single free-text `message` and points at its record without a foreign
  key. The Dashboard reads it, but **no application code ever writes to it** —
  every row comes from the seed.

---

## 8. Database

All foreign keys are `ON DELETE RESTRICT` — nothing cascades. Children must be
deleted before their parents. Table and column names are snake_case in the
database, mapped from camelCase in Prisma.

### Models

**User** (`users`) — `id`, `name`, `email` (unique), `password` (bcrypt), `role`
(`UserRole`, default SALES_REP), `status` (`Status`, default ACTIVE),
`managerId` → User (self-relation named `ManagerHierarchy`), `createdAt`,
`updatedAt`. Has many contacts, deals, activities, assigned tasks, created
tasks, task activities, follow-ups and lead-history entries.

**Company** (`companies`) — `id`, `companyName`, `industry`, `website`,
timestamps. Has many contacts. Created on the fly by name (case-insensitive
match) whenever a contact or lead is saved.

**Contact** (`contacts`) — `id`, `firstName`, `lastName`, `email` (**unique**),
`phone`, `companyId` → Company, `location`, `leadStatus` (default WARM),
`isFavourite`, `ownerId` → User, `status` (`ContactStatus`, default ACTIVE),
timestamps, `leadStage` (default FRESH), `leadSource` (default DIRECT),
`revivedAt`, `reEnquiryCount` (default 0), `leadSubStatus` (default UNTOUCHED),
`leadScore` (default 0), `sourceName`. Has many deals, task attendances,
follow-ups and history entries.
Indexes: email, companyId, ownerId, createdAt, firstName, lastName, leadStage,
leadSource, revivedAt, leadSubStatus, leadScore.

**Deal** (`deals`) — `id`, `title`, `contactId`, `ownerId`, `amount`
`Decimal(12,2)`, `stage` (default QUALIFICATION), `status` (default OPEN),
`probability` (default 0), `expectedCloseDate`, `closedAt`, timestamps.
Indexes: ownerId, contactId, stage, status, expectedCloseDate, createdAt,
closedAt, amount.

**Activity** (`activities`) — `id`, `userId`, `activityType`, `entityType`,
`entityId` (no foreign key), `message`, `createdAt`.

**Task** (`tasks`) — `id`, `title`, `description`, `priority` (default MEDIUM),
`status` (default TODO), `type` (default STANDARD), `dueDate`, `relatedDealId` →
Deal, `assignedTo` → User (relation `TaskAssignee`), `createdBy` → User
(relation `TaskCreator`), timestamps.
Indexes: assignedTo, createdBy, status, dueDate, relatedDealId.

**TaskActivity** (`task_activities`) — `id`, `taskId`, `activityType`
(MEETING, CALL, FOLLOW_UP), `meetingDate`, `meetingTime` (`"HH:mm"` string),
`location`, `notes`, `createdBy`, `createdAt`. Named this way to avoid clashing
with `Activity`.

**TaskAttendee** (`task_attendees`) — `id`, `taskId`, `contactId`, `createdAt`.
Unique on (taskId, contactId).

**FollowUp** (`follow_ups`) — `id`, `contactId`, `dealId` (optional), `ownerId`,
`scheduledAt`, `completedAt`, `status` (default PENDING), `outcome`, `notes`,
`rescheduleCount` (default 0), timestamps.
Indexes: contactId, dealId, ownerId, status, scheduledAt, completedAt.

**LeadHistory** (`lead_history`) — `id`, `contactId`, `userId` (who did it),
`type`, `fromValue`, `toValue`, `remark`, `createdAt`.
Indexes: (contactId, createdAt) composite, and type.

### Enums

`UserRole` ADMIN · MANAGER · SALES_REP
`Status` ACTIVE · INACTIVE
`ContactStatus` ACTIVE · INACTIVE · LEAD
`LeadStatus` HOT · WARM · COLD
`LeadStage` FRESH · INTERESTED · CONVERTED · CLOSED · IRRELEVANT
`LeadSource` DIRECT · REFERRAL · WEBSITE · CAMPAIGN · EVENT · OTHER
`LeadSubStatus` UNTOUCHED · CONTACTED · NOT_REACHABLE · CALLBACK_REQUESTED ·
PROPOSAL_SENT · NEGOTIATING · WON · LOST · DROPPED · JUNK · DUPLICATE ·
OUT_OF_AREA
`LeadHistoryType` CREATED · STATUS_CHANGED · ASSIGNED · REMARK_ADDED ·
DETAILS_UPDATED · FOLLOW_UP_SCHEDULED
`FollowUpStatus` PENDING · COMPLETED · MISSED · CANCELLED
`FollowUpOutcome` CONNECTED · NOT_CONNECTED · INTERESTED · NOT_INTERESTED ·
CALLBACK_REQUESTED · CONVERTED
`DealStatus` OPEN · WON · LOST
`DealStage` QUALIFICATION · PROPOSAL · NEGOTIATION · CLOSED_WON
`ActivityType` DEAL_CREATED · DEAL_UPDATED · MEETING_SCHEDULED ·
CONTACT_UPDATED · EMAIL_SENT · TASK_COMPLETED · NOTE_ADDED
`EntityType` DEAL · CONTACT · TASK · USER
`TaskStatus` TODO · IN_PROGRESS · COMPLETED
`TaskPriority` HIGH · MEDIUM · LOW
`TaskType` STANDARD · MEETING
`TaskActivityType` MEETING · CALL · FOLLOW_UP

### Migrations (in order)

| Migration | Adds |
|---|---|
| `20260629120133_initial_migration` | base schema |
| `20260629121314_migration_2` | drops the activities → deals foreign key, which is why `Activity` has no FK |
| `20260705073011_add_companies_and_lead_status` | companies, `leadStatus` |
| `20260710135634_add_deal_probability_and_indexes` | deal probability, indexes |
| `20260713081429_add_tasks_activities_hierarchy` | tasks, task activities/attendees, manager hierarchy |
| `20260713211923_add_deal_closed_at` | `deals.closed_at` |
| `20260911094500_add_lead_lifecycle_and_follow_ups` | lead stage/source/revived/re-enquiry, `follow_ups` |
| `20260911103000_add_follow_up_cancelled` | `CANCELLED` follow-up status |
| `20260912120000_add_lead_desk_and_history` | sub-status, lead score, source name, `lead_history` |

The last three are hand-written SQL. `prisma migrate diff` against the live Neon
database reports **no difference**. The Neon database had been three migrations
behind until they were applied on 12 September 2026 — so **any other environment
is probably behind too**.

### Rules the data must follow

- `stage = CLOSED_WON` exactly when `status = WON`.
- A WON deal always has `closedAt`; no other deal has one.
- A follow-up only has an `outcome` when its status is COMPLETED.
- A lead's sub-status must belong to its status — enforced by the API only, not
  the database.
- Contact emails are unique across the whole database.

---

## 9. Roles & permissions

Full write-up in `docs/RBAC.md`.

### The model

- **The role decides how wide your view is. The reporting tree (`managerId`)
  decides whose records are in it.** Being a Manager gives you nobody by itself;
  you see a rep's records because that rep's `managerId` points at you.
- Roles are **not ranked** in code. Every check is an equality test
  (`userRole === "ADMIN"`); there is no ordering table.
- The tree is **exactly one level deep.** Every `managerId` lookup is a single
  flat `WHERE managerId = me`. A manager of managers does not see the reps
  beneath those managers.
- Nothing ties the tree to roles. A SALES_REP can be given direct reports.
- The Admin has no manager and no reports; Admin simply bypasses filtering.

### The one rule — `src/lib/scope.ts`

```ts
resolveOwnerScope(userId, role)
//   ADMIN   → undefined             (no restriction)
//   MANAGER → [self, ...direct reports]   (reports re-read from the database on every request)
//   else    → [self]

ownerWhere(ids)        // → {} or { ownerId: { in: ids } }   — for list queries
isInScope(ids, owner)  // → true if ids is undefined or includes owner — for single records
```

Sixteen route files use it. **Reads and writes ask the same question**, so a
user can never be allowed to change a record they aren't allowed to see.

For tasks, "yours" means the assignee **or** the creator is in scope.

### What each role can do

| | ADMIN | MANAGER | SALES_REP |
|---|---|---|---|
| Read and write leads, contacts, deals, follow-ups, tasks | all | self + direct reports | own only |
| Dashboard Insights, Analytics | all | team | own |
| **`/api/dashboard`** (Deal Insights tab) | **everything** | **everything** | **everything** ← not scoped |
| Companies list | all | all | all |
| Assign an owner or assignee | anyone | self + direct reports | self only |
| Filter a list by agent | anyone | only within scope (else 403) | only self |

### Seed counts that prove it (live database)

| User | Leads | Contacts | Insights | Pipeline deals |
|---|---|---|---|---|
| admin | 30 | 30 | 30 | 48 |
| usman | 18 | 18 | 18 | 30 |
| priya | 6 | 6 | 6 | 6 |
| ali (rep) | 6 | 6 | 6 | 12 |
| rohit (rep) | 6 | 6 | 6 | 6 |

Pipeline counts exclude LOST deals.

### The inter-team fix (commit `3b65ac0`)

**Before the fix**, eight write endpoints used this check:

```ts
const isElevated = userRole === "ADMIN" || userRole === "MANAGER";
if (!isOwner && !isElevated) → 403
```

It never looked at *whose* record it was. So any manager could edit any record
in the company — including records the read endpoints refused to show them.
This was proven live: a manager got `403` reading a lead and then passed
authorization writing to that same lead. On top of that, `/api/contacts` and
`/api/deals/pipeline` showed managers the whole company, record IDs included —
which handed them exactly the IDs needed.

**Every one of those checks now reads:**

```ts
const ownerIds = await resolveOwnerScope(userId, userRole);
if (!isInScope(ownerIds, record.ownerId)) → 403
```

This change touched 8 write endpoints and 2 read endpoints. Two more
(`/api/tasks`, `/api/analytics/dashboard`) were switched to the shared helper
with no change in behaviour. The owner chose **"scope everything to team"** over
two alternatives: fixing writes only, or treating managers as company-wide. The
second team (Priya → Rohit) was added to the seed so that team isolation could
actually be tested.

**How it was verified:** Usman got `403` on every read and write against Rohit's
lead, follow-up, deal and task, including deleting the task. Priya could still
work on Rohit's records, Usman could still work on his own team's, and the admin
and reps were unaffected.

---

## 10. API reference

Every route requires a valid token unless marked public. "Scoped" means it
applies §9.

### Auth
| Method & path | Details |
|---|---|
| `POST /api/auth/login` | **Public.** Body `{ email, password }`. 400 if either is missing; 401 `"Invalid credentials"` for an unknown, INACTIVE or wrong-password user. 200 `{ token, user: { id, name, email, role } }`, and sets the `auth-token` cookie. |
| `POST /api/auth/logout` | Deletes the cookie. **Nothing in the UI calls this.** |

### Users & companies
| Method & path | Details |
|---|---|
| `GET /api/users/assignable` | People you can assign work to. Admin: every ACTIVE user plus self. Others: self plus ACTIVE direct reports. Returns `{ success, data: [{ id, name, email }] }`. |
| `GET /api/companies` | Every company, unfiltered. **Nothing in the UI calls this.** |

### Dashboard & reporting
| Method & path | Details |
|---|---|
| `GET /api/dashboard` | **Ignores who is asking — no scoping at all.** Returns `revenue { amount, growth }`, `activeDeals`, `contacts`, `conversionRate`, `revenueGraph` and `dealsGraph` (6 months), `pipeline` by stage, and the latest 10 `activities`. |
| `GET /api/analytics/dashboard?from&to&sort=revenue\|deals` | Scoped. Returns `kpis { averageDealSize, winRate, salesCycle, activeLeads }`, `revenueTrend`, `growth`, `salesFunnel` ("Leads" = total contacts, then the four stages), and `topPerformers` (top 10). |
| `GET /api/insights/summary?tab=lead\|followup&from&to` | Scoped. KPI tiles. Lead tiles count by `createdAt`, except Revived, which counts by `revivedAt`. Follow-up tiles count by `scheduledAt`, except Due Today, which ignores the date range. |
| `GET /api/insights/trends?metric=leads\|followUps\|deals&granularity=daily\|weekly\|monthly&from&to` | Scoped. Returns `{ metric, granularity, from, to, points: [{ date, label, value }] }`. At most 400 points. |

### Leads
| Method & path | Details |
|---|---|
| `GET /api/leads` | Scoped. Query: `search` (name — including "First Last" — email, phone, company, source name), `status`, `subStatus`, `source` (all as display labels), `agent` (403 if outside your scope), `location` (contains), `minScore`, `maxScore`, `from`, `to` (createdAt), `reEnquired=true`, `sort=createdAt\|createdAtAsc\|name\|leadScore`, `page`, `limit`. Returns rows plus `summary { total, fresh, interested, converted, closed, irrelevant, reEnquired }`. The summary ignores the status and re-enquired filters, so each pill's count matches what clicking it shows. |
| `POST /api/leads` | Body: `firstName`*, `lastName`*, `email`*, `phone`, `companyName`, `location`, `status`, `subStatus`, `temperature`, `source`, `sourceName`, `leadScore`, `ownerId`, `remark`. Validation lives in `prepareLead()`. Writes the contact and a `CREATED` history entry in one transaction. |
| `GET /api/leads/bulk` | Downloads the CSV template: First Name, Last Name, Email, Phone, Company, Location, Status, Sub-Status, Temperature, Source, Source Name, Lead Score. |
| `POST /api/leads/bulk` | Body `{ csv: "<file text>" }`, at most **500 rows**. Returns `{ created, failed, errors: [{ row, name, reason }] }` with status 200 even when some rows fail. Details in §13. |
| `GET /api/leads/[id]` | Scoped (403 outside scope). The lead plus `history` (newest first), `assignmentTrail`, `lastRemark`, `lastFollowUpAt` (latest completed) and `nextFollowUpAt` (soonest upcoming pending). |
| `PATCH /api/leads/[id]` | Scoped. Edit details: name, email, phone, company, location, temperature, source, source name, score, `ownerId`. **Status is not editable here.** Logs `DETAILS_UPDATED` naming the changed fields, and `ASSIGNED` when the owner changes. |
| `PATCH /api/leads/[id]/status` | Scoped. Body `{ status?, subStatus?, remark }` — **the remark is required.** The only route that can change a lead's status. 400 if the pair is invalid or nothing actually changes. Coming back from Closed or Irrelevant stamps `revivedAt` and the response includes `revived: true`. |
| `POST /api/leads/[id]/remarks` | Scoped. Body `{ remark }`, 1–2000 characters. Writes `REMARK_ADDED`. |

### Follow-ups
| Method & path | Details |
|---|---|
| `GET /api/follow-ups` | Scoped. Query: `search`, `filter=all\|planned\|pending\|done\|missed\|cancelled\|rescheduled`, `agent`, `from`, `to` (scheduledAt), `sort=scheduledAt\|scheduledAtAsc\|createdAt`, `page`, `limit`. The default `scheduledAt` sorts **newest first**, despite a code comment saying "soonest first". Filters are combined with `AND` so a pill filter can't overwrite the date range. Returns rows plus `summary`. |
| `POST /api/follow-ups` | Body: `contactId`*, `scheduledDate`* (`YYYY-MM-DD`), `scheduledTime` (`HH:mm`, default 09:00), `notes`, `dealId` (must belong to the same contact), `ownerId`. Also writes a `FOLLOW_UP_SCHEDULED` history entry on the lead, in the same transaction. |
| `PATCH /api/follow-ups/[id]` | Scoped. Body: `status` (Pending, Done, Missed or Cancelled), `outcome` (only when Done), `notes`, `scheduledDate` and `scheduledTime` (rescheduling increments the counter and resets the follow-up to PENDING). Done sets `completedAt`; leaving Done clears it. **These changes are not written to the lead's history.** |

### Contacts
| Method & path | Details |
|---|---|
| `GET /api/contacts?search&page&limit&sort=name\|dealValue\|createdAt` | Scoped. `dealValue` is the total of the contact's non-LOST deals. Sorting by `dealValue` loads **every** match into memory. `status` in the response is Hot/Warm/Cold. |
| `POST /api/contacts` | Body: `firstName`*, `lastName`*, `email`*, `phone`, `companyName`, `location`, `leadStatus` (Hot, Warm or Cold; default Warm), `isFavourite`, `ownerId`. |
| — | **No update or delete endpoint exists.** A comment in the tasks delete route mentions contacts being "blocked if deals exist" — that describes an intended rule that was never built. |

### Deals
| Method & path | Details |
|---|---|
| `POST /api/deals` | Body: `title`*, `contactId`*, `amount`* (0 or more), `stage` (default Qualification), `probability` (0–100), `expectedCloseDate`, `ownerId`. |
| `GET /api/deals/pipeline?search&sort=amount\|expectedCloseDate\|createdAt` | Scoped. **Leaves out LOST deals.** Returns `summary [{ stage, count, totalAmount }]` (always all four stages) and a flat `pipeline` list of cards. |
| `PATCH /api/deals/[id]/stage` | Scoped. Body `{ stage: "<label>" }`. Forward-only (400 otherwise). Closed Won also sets status WON and `closedAt`. |
| — | **No list-all, update or delete endpoint.** A deal's amount, title and close date can never be changed after creation. |

### Tasks
| Method & path | Details |
|---|---|
| `GET /api/tasks?search&status&page&limit` | Scoped by assignee or creator. `status` accepts `all`, `todo`, `inprogress`, `completed` and several spellings of each (`"to do"`, `"in-progress"`…). |
| `POST /api/tasks` | Body: `title`*, `dueDate`*, `assignedTo`*, `description`, `priority` (High, Medium or Low; default Medium), `relatedDealId`, `type` (Standard or Meeting). A meeting also takes `meetingDate`, `meetingTime`, `location` and `notes`, which are saved as a `TaskActivity`. The assignee must be yourself, one of your direct reports, or — for an Admin — anyone. |
| `PATCH /api/tasks/[id]/status` | Scoped. Body `{ status: "To Do" \| "In Progress" \| "Completed" }`. |
| `POST /api/tasks/[id]/attendees` | Scoped. Body `{ attendees: [contactIds] }`, must not be empty, and every ID must be a real contact. It **adds** attendees (duplicates are skipped) — there is no way to remove one. |
| `DELETE /api/tasks/[id]` | Scoped. Deletes the task along with its attendees and meeting details, in one transaction. **The only delete endpoint in the entire app.** |

---

## 11. Pages

| Route | What it does | Calls |
|---|---|---|
| `/` | Marketing landing page: "One workspace for your entire pipeline." Feature list covers Contacts, Pipeline, Tasks and Analytics — not Leads or Follow-ups. Shows made-up stats including **"$284.5K"**. About 195 of its lines are an older, commented-out version. No shell. | — |
| `/login` | Branded panel plus a card with email and password (Enter submits), demo credentials shown. Saves `crm-token` and `crm-user`, then goes to `/dashboard`. No shell. | login |
| `/dashboard` | Top bar: greeting, date, "Live". Three tabs: **Lead Insights** and **Follow-Up Insights** (a 9-cell metric strip, a date-range filter with presets from Today to This year plus Custom, and a Trends area chart with a metric and granularity picker — one shared panel, so the date range survives switching between them), and **Deal Insights** (a 4-cell strip — Total Revenue with its change vs last month, Active Deals, Contacts, Conversion Rate — then the revenue area chart, pipeline progress bars, the activity feed and deals-per-month bars; fetched only when first opened). | insights/*, dashboard |
| `/leads` | Top bar: Bulk Upload, Add Lead. An 8-cell metric strip covering every lead you can access (the filters don't affect it). Filters: search, Sub-Status, Source, Agent, Location, From/To. Pills: ALL, FRESH, INTERESTED, CONVERTED, CLOSED, IRRELEVANT, RE-ENQUIRED — these *are* the status filter — with Sort beside them. Table: initials + name (details on hover), status badge and sub-status (click to change), score bar, next follow-up with a Schedule button, agent, source, a row menu (Open, Change status, Schedule follow-up) and an open chevron. Dialogs: **Add Lead**, **Bulk Upload** (download template, pick file, see per-row report), **Change status** (remark required), **Schedule follow-up**. | leads, leads/bulk, leads/[id]/status, follow-ups, insights/summary, users/assignable |
| `/leads/[id]` | Top bar: "← Leads". Header card: initials, name, ID, created date, clickable status, agent, buttons (Assignment Trail, History, Add Remark, Follow-up, Edit). A 6-cell strip: Lead Age, Temperature, Source Name, Re-Enquired, Last Follow-up, Lead Score. Personal Details grid, Last Lead Remark, the 5 most recent activity entries (plus "View all"). Dialogs for history, status change, edit (including reassigning the agent), add remark, and follow-up. | leads/[id], leads/[id]/*, follow-ups, users/assignable |
| `/contacts` | Top bar: New Contact. Search, sort (Name, Deal Value, Newest), pagination (10 per page). Table: initials + name (email on hover), company, location, deal value, temperature labelled "status", favourite star (display only), and a schedule-follow-up button. Dialogs: **New Contact**, **Schedule follow-up**. | contacts, follow-ups |
| `/deals` | Top bar: New Deal. Kanban board: four stage columns with a stage dot, count, total, and a "+" (Qualification, Proposal and Negotiation only) that opens New Deal preset to that stage. Cards: contact initials, title, contact, a Won/Open badge derived from the stage (the endpoint returns no status), probability bar, close date, amount. Drag and drop moves a deal forward; moving backward shows an error toast and invalid columns dim while dragging. Search, sort. Dialog: **New Deal** — its amount field still says **"Amount ($)"**. | deals/pipeline, deals, deals/[id]/stage |
| `/follow-ups` | Top bar: New Follow-Up. A 7-cell strip (Total, Planned, Pending, Rescheduled, Cancelled, Done, Missed), search, Agent, From/To, pills with sort beside them. Table: initials + lead (company, deal and notes on hover), agent, scheduled time (red when overdue, with the move count), status badge with outcome, and a row menu: Mark as Done / Missed / Cancelled (or Set outcome on Done rows) and Reschedule. Dialogs: **New Follow-Up**, **Reschedule**. | follow-ups, follow-ups/[id], users/assignable, contacts |
| `/tasks` | Top bar: New Task. Filter tabs: All, To Do, In Progress, Completed. Search. Table: title (description on hover), assignee initials, related deal, priority badge, due date, a status dropdown, and a row menu (Change status, Delete — asks for confirmation). Footer: "Showing N of M" (at most 50 load). Dialog: **New Task** — title, description, priority, due date, assignee. It cannot create a meeting, although the API can (§17 item 33). | tasks, tasks/[id], tasks/[id]/status, users/assignable |
| `/analytics` | From/To filter with Apply. A 4-cell strip: Average Deal Size, Win Rate, Sales Cycle (days), Active Leads. Revenue trend area chart; deals and contacts growth as grouped bars. Sales funnel of deals that have **reached** each stage — worked out in the browser by adding each stage's count to every later one, since deals only move forward — with each stage's share of the one before, and "Leads (contacts)" shown beside it rather than as its top. Top performers with initials, a By Revenue / By Deals Closed toggle (re-fetches) and bars relative to the leader. | analytics/dashboard |

---

## 12. Shared code (`src/lib`)

- **`auth.ts`** — `signToken`, `verifyToken`, `extractToken` (Bearer header
  first, then cookie), `getCurrentUser` (reads the cookie; unused).
  **Falls back to the hard-coded secret `"fallback-secret-change-in-production"`
  when `JWT_SECRET` is unset.**
- **`prisma.ts`** — a single shared client (kept on `globalThis` outside
  production), logging queries in development.
- **`scope.ts`** — `resolveOwnerScope`, `ownerWhere`, `isInScope`, plus date
  helpers: `startOfDay`, `endOfDay`, `toISODate`, `parseDateParam(v,
  "start"|"end")` (an `end` date covers the whole day), and
  `parseDateTime(date, time)` (time defaults to 09:00; returns `undefined` if
  invalid). Dates use the **server's** timezone.
- **`insights.ts`** — trend bucketing: `MAX_BUCKETS = 400`, `defaultRange`,
  `startOfBucket`, `formatBucketLabel`, `countBuckets`, `bucketByDate`.
- **`leads.ts`** — label↔enum maps for status, sub-status, temperature, source
  and history type; `SUB_STATUS_BY_STATUS`, `defaultSubStatusFor`, `isValidPair`,
  `parseLeadScore` (clamps to 0–100, `undefined` if not a number),
  `leadAgeDays`, the shared `leadSelect` query shape, `shapeLead`,
  `shapeHistory`.
  **Must stay free of server-only imports.** The client Leads pages import it,
  and importing prisma here once pulled roughly half a megabyte of dead code
  into the browser bundle.
- **`leads.server.ts`** — `prepareLead(body, userId, role)`, the single
  validator used by both Add Lead and CSV import. It checks required fields and
  email format, the status/sub-status pair, temperature, source and score; finds
  or creates the company; and checks the owner is allowed.
- **`csv.ts`** — `parseCsv(text) → { headers, rows: [{ line, values }] }`.
  Handles quoted fields, `""` escapes, commas and line breaks inside quotes,
  CRLF, and Excel's leading BOM. Skips blank rows. Header names are normalised
  (`"First Name"` → `firstname`). `line` is the **physical line number** in the
  file, tracked while scanning.
- **`currency.ts`** — `formatINR(n)` gives the compact form (₹850, ₹12K,
  ₹4.5L, ₹2.4Cr); `formatINRExact(n)` gives Indian digit grouping
  (₹12,34,567). This replaced four copy-pasted `$` formatters. The seed imports
  it too.
- **`utils.ts`** — `cn(...classes)`: joins class names with clsx and resolves
  Tailwind conflicts with tailwind-merge (the later class wins).
- **`src/hooks/use-mobile.tsx`** — `useIsMobile()`, used by the shadcn
  sidebar to switch to a sheet below 768 px.

---

## 13. Business rules

1. **Every lead status change needs a remark**, and the API enforces it. The
   change and its remark are saved as a single history row.
2. **A sub-status must belong to its status**, per `SUB_STATUS_BY_STATUS`.
3. **Reviving a lead** (from Closed or Irrelevant back into a live status)
   stamps `revivedAt`. That field feeds the Dashboard's "Revived Leads" tile —
   and until this rule existed, nothing ever set it.
4. **Deals only move forward.** Reaching Closed Won sets status WON and
   `closedAt`.
5. **Time-based states are worked out on read, never stored:** Overdue, Planned
   vs Pending, Lead Age.
6. **Follow-up outcome** is only allowed on completed follow-ups. Rescheduling
   increments the counter and resets the follow-up to Pending. Done sets
   `completedAt`; leaving Done clears it.
7. **A follow-up linked to a deal** must use a deal belonging to the same
   contact.
8. **Assigning an owner:** yourself, or anyone if you're an Admin, otherwise
   only your direct reports.
9. **Companies are found or created by name**, ignoring case.
10. **CSV import:**
    - Wrong template (missing first name, last name or email columns) → the
      whole file is rejected with one message.
    - Existing emails are looked up in a single query, and duplicates within the
      file are caught too.
    - Every row goes through `prepareLead`.
    - Each row is saved in its own transaction, so one bad row doesn't sink the
      rest.
    - At most 500 rows.
    - The report uses physical line numbers.
11. **Filter counts match what you see.** Counts are calculated with every
    filter except the one that row of pills controls, and combined with `AND`.
    Re-Enquired and Rescheduled overlap with the other categories, so those
    counts don't add up to Total.
12. **Money is INR** throughout — an assumption across the whole app, not stored
    on each row.

---

## 14. Seed data (`prisma/seed.ts`)

- **Idempotent and destructive.** It first deletes lead history, follow-ups,
  task attendees, task activities, tasks, activities, deals, contacts and
  companies, in that order because of the foreign keys. Users are upserted
  rather than deleted, so their IDs — and existing logins — survive a reseed.
  **Never run it against real data.**
- **Indian data:** company names on `.in` domains, Indian names and cities
  ("Aurangabad, MH", "Patna, BR", …), `+91` phone numbers (these look
  repetitive: `+91-9000000000`, `+91-9000011111`, …), and source names such as
  "The Tribune".
- **Owners rotate** across admin, ali, fatima, hamza and rohit. Usman and Priya
  own nothing themselves.

**Current contents (live):**

| Table | Rows |
|---|---|
| users | 7 |
| companies | 10 |
| contacts / leads | 30 — Fresh 12, Interested 6, Converted 6, Closed 3, Irrelevant 3 |
| deals | 60 — WON 24 (₹8,82,00,000), OPEN 24 (₹8,10,40,000), LOST 12 (₹3,17,60,000). Amounts ₹60,000 – ₹1,79,40,000 |
| follow-ups | 60 — Pending 36, Completed 14, Missed 5, Cancelled 5 |
| tasks | 6 (5 standard, 1 meeting) |
| task activities / attendees | 1 / 1 |
| activities | 18 |
| lead history | 64 |

**Deliberate seed choices:**

- Every deal that isn't WON gets an open stage only. An earlier version
  produced 10 "Closed Won but not WON" deals worth ₹3.07 Cr, which made the
  Deals page and the Dashboard disagree about how much had been won.
- Follow-ups dated in the future are always PENDING.
- Only completed follow-ups have an outcome.
- Every status change in the history carries a remark, because the app itself
  requires one.
- History timestamps are relative to each lead's own creation date.
- Deal amounts deliberately span all three rupee formats (K, L and Cr).

---

## 15. Metric definitions — and where they disagree

| Metric | Where | Formula |
|---|---|---|
| Total Revenue | Dashboard (Deal tab) | sum of WON deals, **all companies' data, unscoped** |
| Growth | Dashboard | this month vs last month; **shows +100% when last month was 0** |
| Revenue graph | Dashboard | WON deals grouped by **`createdAt`** month |
| Revenue trend | Analytics | WON deals grouped by **`closedAt`** month |
| Conversion Rate | Dashboard | WON ÷ **all** deals (open ones included) |
| Win Rate | Analytics | WON ÷ (WON + LOST). Currently 66.7%. Because nothing in the app can mark a deal LOST, **real usage will push this toward 100%** |
| Active Leads | Analytics | count of **OPEN deals** |
| Sales funnel "Leads" | Analytics | total **contacts** |
| Average Deal Size | Analytics | WON revenue ÷ WON count |
| Sales Cycle | Analytics | average days from `createdAt` to `closedAt` for WON deals |
| Lead tiles | Insights | windowed by `createdAt`; Revived by `revivedAt` |
| Overdue | Insights | PENDING and past due. **Ignores the selected date range** — same kind of bug that was fixed in the follow-up list |
| Due Today | Insights | deliberately ignores the date range |
| Re-Enquired | Insights, Leads | `reEnquiryCount > 0` — **only ever set by the seed** |

---

## 16. History

| When | Commit | What |
|---|---|---|
| 7 Jul 2026 | `d83dbe7` | Initial commit |
| 10–14 Jul | `cb49f2d`…`07b1043` | Theme toggle, deals pipeline logic and page, tasks schema and section, analytics |
| 18–27 Jul | `354bb76`…`64e2ded` | Reusable dropdown, date picker, loading spinner, auth page redesign, dashboard caching fix, seed, search fix, double-render fix, reusable dialog, create-contact and create-deal forms, toast notifications, task delete endpoint and confirm dialog, hydration fix, forward-only deal rule with toast |
| 11 Sep | `0a22c24` | **Module 1 — Dashboard Insights** (Lead and Follow-Up tabs, KPI tiles, Trends graph, date filter, lead-lifecycle columns, follow-ups table) |
| 12 Sep | `3d9c025` | **Module 2 — Follow-up page** (interrupted in a VS Code session, then finished; fixed the pill-filter vs date-range overwrite bug) |
| 12 Sep | `483b535` | **Module 3 — Leads** (list, detail, CSV import, required remark, history, second-level status) |
| 12 Sep | `7dd1b73` | Switched to INR, seed made idempotent and Indian, three migrations applied to Neon, seed deal-stage fix, README and audit docs |
| 12 Sep | `b149a79` | Leads table: name only, details on hover, name not clickable, smooth expansion |
| 13 Sep | `3b65ac0` | **Permissions:** team scoping for managers on every route; second team added to seed; `docs/RBAC.md` |
| 16 Sep | `4fe3637` | `RevealOnHover` component shared by the Leads, Follow-up, Contacts and Tasks tables |
| 17 Sep | `5c31476` | This file |
| 17 Sep | `dff6a3b` onward, branch `feat/shadcn-ui` | **UI refactor to shadcn/ui**: tokens, shared shell with collapsible sidebar and top bar, every page rebuilt; no API, schema or rule changes. Plan, decisions and checklist in `docs/UI_REFACTOR_PLAN.md`. Not merged. |

---

## 17. Known problems

Everything here was found and reported during development, and is **still
open** unless marked otherwise. They're roughly in order of how much they
matter.

### Security

1. **`JWT_SECRET`.** The local `.env` uses the placeholder committed in
   `.env.example`, and `src/lib/auth.ts` falls back to a hard-coded string if
   the variable is missing. Either way, anyone who has seen the repo could
   create a valid Admin token.
2. **`/api/dashboard` isn't scoped.** Every user, including a junior rep, sees
   company-wide revenue, deal and contact counts, the pipeline and recent
   activity. It's the only data endpoint left without scoping.
3. **Sign out doesn't end the session.** Sign out (in the sidebar's user menu) removes the
   `localStorage` entries and tries to clear the `auth-token` cookie from
   JavaScript — but that cookie is `httpOnly`, which JavaScript cannot touch,
   and the `/api/auth/logout` endpoint that could clear it is never called. The
   cookie stays valid for up to 7 days. *(Found from the code while writing this
   file; not tested in a browser.)*
4. **Roles and account status are frozen into the token for 7 days.** Nothing
   re-reads them from the database. Demoting someone, or setting them INACTIVE,
   only takes effect when their token expires. There's no way to revoke a
   session.
5. The token is also kept in `localStorage`, where any injected script could
   read it — which undoes the protection of the `httpOnly` cookie.
6. **No limit on login attempts.** The login route also answers faster for
   unknown emails, because it skips the password check — so response times
   reveal which emails have accounts.
7. **No security headers** (`next.config.js` is empty).
8. **Permissions are coarse.** Any rep can bulk-import 500 leads; there's no
   user-management screen; nothing checks that a `managerId` points at a
   manager; the hierarchy is one level deep; there's no log of who viewed what.

### Numbers that are wrong or can't change

9. **Deals can never be marked lost** (no Closed Lost stage), so the win rate
   drifts toward 100%.
10. **`reEnquiryCount` is never increased by the app** — it's seed-only.
    Meanwhile a known email re-submitting through the form or CSV is simply
    rejected as a duplicate.
11. **The Recent Activity feed is never written by the app** — seed-only.
12. **Overdue ignores the date range** (`api/insights/summary`, around line
    160).
13. Metric definitions disagree between pages — see §15.

### Missing features

14. No way to edit or delete contacts or deals. No way to delete leads. Task
    attendees can be added but never removed.
15. No data export anywhere (CSV *import* exists).
16. **A follow-up's later changes don't reach the lead's history.** Booking one
    is recorded; rescheduling or completing it isn't.
17. Nothing reminds anyone about upcoming follow-ups.
18. Password reset and invitations don't exist.

### Scale and structure

19. **Search can't use indexes.** It matches text with `ILIKE '%term%'` in 32
    conditions across six routes, so every search scans the whole table. Trigram (GIN)
    indexes would fix it.
20. Sorting contacts by deal value loads every matching contact into memory.
21. No currency column. No multi-tenancy. No optimistic locking — two people
    editing the same record means the last save wins. No soft delete.
22. Dates are bucketed in the server's timezone.

### Housekeeping

23. **Two leftover dollar signs** the INR switch missed: `"$284.5K"` on the
    landing page (`src/app/page.tsx:292`) and the `"Amount ($)"` placeholder on
    the Deals page (`src/app/(app)/deals/page.tsx:380`).
24. **The landing page is only visible when logged in.** Middleware doesn't
    treat `/` as public, so logged-out visitors are sent to `/login`. Its copy
    and numbers are also out of date.
25. Most dates are formatted with `"en-US"`, not `"en-IN"`.
26. Unused code: the `/api/companies` and `/api/auth/logout` endpoints, and
    large commented-out blocks in `src/app/page.tsx` and
    `api/dashboard/route.ts`. (`ComingSoon` was deleted in the UI refactor.)
27. Misleading comments: tasks delete mentions a contacts rule that was never
    built; the follow-up list says "soonest first" but sorts newest first.
28. No tests, no ESLint config, no CI, no monitoring — 22 route files just write
    to `console.error`.
29. `tsconfig.tsbuildinfo` is tracked in git.
30. **No person has reviewed the UI in a browser.** The shadcn/ui refactor was
    checked with headless Chrome: screenshots of every page in both themes, at
    desktop and phone width, with no console errors, plus scripted checks of
    the hover reveal, row menus, the Set outcome submenu, the backward-drag
    toast and sign-in. Screenshots are not a review; see the refactor report
    for what to click through. Rows are vertically centred, so other columns
    shift slightly while a row expands.

### Found during the UI refactor

31. **Creating a deal straight into Closed Won leaves it half-won.**
    `POST /api/deals` saves the stage only, so the deal keeps status OPEN and
    no `closedAt`; moving a deal into Closed Won (`PATCH …/stage`) sets both.
    Such deals are missing from Sales Cycle and Revenue Trend. The New Deal
    dialog still offers Closed Won; the board's "+" buttons deliberately don't.
32. **The Tasks page loads at most 50 tasks** (`limit=50`) and never asks for
    another page, although the API supports `page`. Its footer says
    "Showing N of M" so the cut-off is visible.
33. **Meeting tasks can't be created from the UI.** The API accepts
    `type: "Meeting"` with date, time and location, but the New Task dialog has
    never had those fields.
34. **The page font changed.** Inter now actually loads (see §6, Theme), so
    text looks different from before the refactor even where nothing else
    changed.

**Fix order suggested in earlier sessions:** replace `JWT_SECRET` → scope
`/api/dashboard` → re-read role and status on each request → add Closed Lost →
record follow-up changes in lead history → then editing/deleting contacts and
deals, export, tests and linting.

---

## 18. Conventions for code in this repo

- **Comments explain *why*, at length.** Important caveats are marked
  `FLAG:` in new or rewritten files (older files still use a 🚩 emoji; don't
  mass-edit them). No emojis in code, tests or scripts. Match that density;
  new code without it will stand out.
- **One rule, one place.** Permission scoping goes through `lib/scope.ts`,
  money through `lib/currency.ts`, lead labels through `lib/leads.ts`, table
  hover rows through `RevealOnHover`. This codebase has already paid for copies
  drifting apart three times — currency formatting, the scope rule, and the
  hover rows.
- **Route handler shape:** read `x-user-id` (401 if missing) → validate
  everything → fetch the record (404) → check scope (403) → apply business
  rules (400) → write, in a transaction if more than one row → respond with
  `{ success, message, data }`. Wrap it all in a try/catch that logs
  `console.error("[METHOD /api/path]", error)` and returns a 500.
- **Display labels at the API edge; enums stay inside.**
- **Work out time-based values when reading; don't store them.**
- **Count filters with `AND`** — never merge two conditions on the same column
  with an object spread.
- New GET routes declare `export const dynamic = "force-dynamic"`.
- Files meant for the browser must not import `prisma` or `*.server.ts`.
- Route files may only export HTTP handlers and route settings. Shared helpers
  belong in `src/lib`.
- **Pages:** `"use client"`, live under `src/app/(app)/` so they get the shell,
  set the top bar with `<PageHeader>`, draw skeletons in the final shape,
  show errors with `ErrorBanner`, have empty-state text, report results with
  `useToast`, and put forms in `Dialog` with `FormField` labels.
- **Styling:** token classes, never inline colours; inline styles only for
  values computed at runtime; no shadows. `src/components/ui` holds shadcn
  primitives (with their local edits noted at the top); `src/components/common`
  holds the app's own shared components. Add primitives as described in §6.
- **Status colours** come from `components/common/statusColors.ts`, never a
  page-local map.
- Migrations are hand-written SQL. Check them with
  `prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma`.
- Keep the seed idempotent, and never let it create data the app itself
  couldn't produce.

---

## 19. Notes for whoever picks this up

### How the owner likes to work

- Asks for explanations in **plain, simple language**, and sometimes explicitly
  "from first principles" — building up from the basic question rather than
  describing the code.
- Sometimes asks for **an audit first, with no code changes**. When they do,
  report only; don't edit.
- Expects **existing conventions to be kept**, and treats reference screenshots
  as guidance, not specification.
- **Makes their own commits.** Don't commit or push unless asked. For the
  shadcn/ui refactor they allowed commits and pushes on `feat/shadcn-ui` only —
  never to `main`, no PRs, no force-pushes.
- Asks for things to be documented in simple words when a piece of work
  finishes.

### Decisions the owner made

- Managers are **scoped to their own team everywhere** — chosen over "fix
  writes only" and "managers see the whole company".
- Lead names in tables are **not clickable**, and show **no underline**.
- The hover expansion must be **smooth**.
- Money is **INR**, and the seed data is Indian.
- The same hover-row treatment applies to **every** table with the stacked
  layout.
- **UI refactor decisions** (all in `docs/UI_REFACTOR_PLAN.md`): a funnel of
  deals that reached each stage with Leads shown separately; kanban "+" on the
  three open stages only; no previous-period line on Trends (it would need an
  extra request); fixed page sizes with first/previous/next/last; the confirm
  dialog can't be dismissed by clicking the backdrop; toasts dismiss on click;
  the blue chart ramp in §6; the Closed Won create bug recorded, not fixed.
- Stay on Next 14.1 / React 18 / Tailwind 3.4, keep the `.dark` +
  `crm-theme` theme mechanism and Inter, and don't copy code, names or
  branding from paid shadcn template kits.

### Corrections worth learning from

- The first INR conversion searched for `$`-formatting code and missed two
  plain strings (§17 item 23). Search for literal text too.
- A first edit to the Leads table left two stray closing tags, because a search
  for a less-indented `</div>` matched inside a more-indented one. Type-checking
  caught it. Match whole blocks exactly rather than searching for boundaries.
- Some early permission tests proved nothing: the validation that failed ran
  *before* the ownership check, and one test record was owned by the very user
  making the request. When testing authorization, check which check runs first
  and who owns the record.
- An earlier summary said sign-out clears the cookie. It doesn't (§17 item 3).
- The Contacts page's "status" is temperature, not pipeline position.

### Things to keep in mind

- **Verifying changes:** `set -a; . ./.env; set +a`, then
  `npx tsc --noEmit` and `npx next build` (four "Dynamic server usage" lines are
  expected). For UI changes, check that Tailwind v3 can generate every class:
  `require("tailwindcss/lib/lib/setupContextUtils").createContext(resolveConfig(config)).getClassOrder([...])`
  returns `null` for a class it doesn't know. shadcn snippets written for
  Tailwind v4 (`**:`, `has-focus:`, `shadow-xs`) are the usual culprits. After
  a build, restore `tsconfig.tsbuildinfo`. Stop any running `next dev`/`next
  start` before building — they share `.next`.
- **Testing permissions without changing data:** send a request that will fail
  a business rule *after* the ownership check. A 400 means authorization passed;
  a 403 means it didn't. Log in as Usman and try one of Rohit's records.
- **Throwaway database:** Docker is available on the dev machine and was used
  for a disposable `postgres:16-alpine` (container and image removed
  afterwards).
- The dev server holds port 3000 — stop it when you're done so the owner's own
  `npm run dev` can start.
- **Headless Chrome** (`google-chrome`) is installed and can be driven over the
  DevTools protocol (Node 24 has a built-in WebSocket) for screenshots and
  console errors: log in through `/api/auth/login`, set the `auth-token` cookie
  and the `crm-token` / `crm-user` / `crm-theme` localStorage keys, then visit
  pages on a `next start` server. CSS `:hover` needs a real
  `Input.dispatchMouseEvent`; Radix menus open on `pointerdown`, not `click`.
  Screenshots are still not a person's review — say what the owner should look
  at.
- The reference CRM showed saved-filter tabs, Campaign, Channel and Lead Score
  filters, Call Logs, Inbox and Organizations. None of those were built.
