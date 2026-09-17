# UI refactor plan: shadcn/ui

Branch `feat/shadcn-ui`. Scope is UI only: no changes to `src/app/api/**`,
`prisma/**`, `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/scope.ts`,
`src/lib/leads.server.ts`, or any business rule. Every page keeps its current
API calls.

Status: **approved — implementing end to end.**

**Owner decisions** (17 Sep 2026): go with every recommendation in §4, and run
all phases in one pass without stopping between them.

| # | Decision |
|---|---|
| Q1 | Funnel of deals that have reached each stage (running total, largest first); "Leads" shown separately |
| Q2 | "+" buttons on Qualification, Proposal and Negotiation only |
| Q3 | No recommendation was given, so the previous-period line is **left out**: it would add a request, and pages keep their current API calls |
| Q4 | Keep today's fixed page sizes; add first/previous/next/last; Tasks footer shows a count only |
| Q5 | ConfirmDialog on AlertDialog (no backdrop-click dismissal) |
| Q6 | Keep click-to-dismiss on toasts |
| Q7 | chart-1 #155dfc, chart-2 #2b7fff, chart-3 #8ec5ff, chart-4 #1447e6, chart-5 #193cb8 |
| Q8 | Record the Closed Won create bug in §17 during Phase 11 |

---

## 1. Findings

### 1.1 Starting point

- `docs/PROJECT_CONTEXT.md` was untracked. On the owner's instruction it is now
  the branch's first commit (`5c31476`).
- **No shadcn foundation exists.** There is no `components.json`, no
  `src/lib/utils.ts`, no `src/hooks/`, no shadcn tokens in `globals.css`, no
  colour mapping and no `darkMode` in `tailwind.config.js`.
- The `brand` and `surface` colour scales in `tailwind.config.js` are unused
  (0 references), so they are safe to delete.
- No reference screenshots are present (`docs/ui-reference/` does not exist).
  The prompt's written description is used as the specification. The live
  demo was not fetched, to avoid borrowing its code or naming.
- Installed versions: tailwindcss 3.4.19, recharts 2.15.4, framer-motion
  11.18.2, lucide-react 0.363.0, React 18.3.1, Next 14.1.0. No Radix, clsx or
  cva packages are installed yet.

### 1.2 Pages

| Page | Lines | Shared components used | Shell | Tables / dialogs | Charts | Motion | Inline `var(--…)` |
|---|---|---|---|---|---|---|---|
| `/` landing | 388 (179 commented out) | ThemeToggle | none | — | — | framer | 62 |
| `/login` | 214 | ThemeToggle | none | — | — | framer | 29 |
| `/dashboard` | 198 | MetricCard, RevenueChart, PipelineChart, ActivityFeed, InsightsTabs, InsightsPanel, LoadingState | Sidebar + `ml-52` | — | hand-drawn bars (`dealsGraph`) + components | — | 14 |
| `/leads` | 1004 | InsightCard, RevealOnHover, Select ×10, DatePicker ×3, Dialog ×4, LoadingState, Toast | Sidebar + `ml-52` | grid table ×1, 4 dialogs | — | — | 95 |
| `/leads/[id]` | 741 | Select ×5, DatePicker, Dialog ×9, LoadingState, Toast | **shell rendered 3 times** (loading, error, main) | 5 dialogs | — | — | 83 |
| `/contacts` | 465 | RevealOnHover, Select ×2, DatePicker, Dialog ×2, LoadingState, Toast | Sidebar + `ml-52` | grid table, 2 dialogs | — | — | 68 |
| `/deals` | 438 | Select ×3, DatePicker, Dialog, LoadingState, Toast | Sidebar + `ml-52` | kanban, 1 dialog | — | — | 40 |
| `/follow-ups` | 608 | RevealOnHover, Select ×5, DatePicker ×4, Dialog ×2, LoadingState, Toast | Sidebar + `ml-52` | grid table, 2 dialogs | — | — | 68 |
| `/tasks` | 389 | RevealOnHover, Select ×3, DatePicker, Dialog, LoadingState, Toast, ConfirmDialog | Sidebar + `ml-52` | grid table, 1 dialog | — | — | 40 |
| `/analytics` | 238 | Select, DatePicker ×2, LoadingState | **shell rendered 3 times** | — | recharts (line, bar) | — | 65 |

- **Tables** are CSS-grid rows (`grid-cols-12`), not `<table>` elements.
- **No page portals directly.** Every portal lives inside a shared component.
- **Top bars:**
  - Dashboard: a greeting with the user's first name, today's date, and a "Live"
    indicator.
  - Leads, Contacts, Deals, Follow-up and Tasks: "Title · count".
  - Analytics: "Analytics".
  - Lead detail: a "← Leads" back button.
  - Every top bar also holds `ThemeToggle`.
- **Hard-coded hex colours:** status colours `#2563eb` and `#d97706`; the
  favourite star `#d97706`.

### 1.3 Components

| Component | Lines | `var(--…)` | Notes | Used by |
|---|---|---|---|---|
| cards/ActivityFeed | 58 | 10 | | dashboard |
| cards/MetricCard | 41 | 7 | | dashboard |
| charts/PipelineChart | 49 | 11 | hand-drawn progress bars | dashboard |
| charts/RevenueChart | 43 | 14 | recharts line | dashboard |
| charts/TrendsChart | 149 | 16 | recharts; contains two `Select`s | InsightsPanel |
| insights/DateRangeFilter | 126 | 1 | `Select` + 2 `DatePicker`s | InsightsPanel |
| insights/InsightCard | 52 | 12 | KPI tile | InsightsPanel, leads |
| insights/InsightsPanel | 240 | 7 | fetches summary and trends | dashboard |
| insights/InsightsTabs | 49 | 5 | tablist | dashboard |
| layout/Sidebar | 113 | 9 | nav + sign out | 9 pages |
| layout/ThemeToggle | 94 | 1 | framer circle reveal; **hard-codes `#ffffff` / `#0a0a0a` to match `--bg`** | 11 files |
| layout/ComingSoon | 70 | 14 | **unused** | — |
| ui/* (7 files) | — | — | detailed in §1.4 | — |

### 1.4 The seven custom `ui/` components: API and behaviours to keep

**`Select`** — default export. Also exports `SelectOption`, which nothing
imports.
- Props: `value`, `onChange(value)`, `options: {label, value}[]`,
  `placeholder = "Select..."`, `className` (applied to the wrapper, used for
  width: 13 call sites), `align: "left" | "right"` (5 call sites).
- 32 call sites.
- **Empty-string option values are used at four call sites:** "All agents" on
  Leads and on Follow-ups, "All sub-statuses" and "All sources" on Leads. Radix
  Select does not allow an item with `value=""`, so the replacement maps `""` to
  an internal sentinel and back, keeping the external API unchanged.
- **Shows the placeholder when `value` matches no option.** Follow-ups relies on
  this for "Mark as" (`value=""`, no `""` option) and "Set outcome".
- **"Mark as" is used as an action menu.** Its value stays `""` and every pick
  fires a PATCH. Radix supports this: the value never changes, so each
  selection is a change event.
- **Re-picking the current option fires `onChange` today.** Radix only fires on
  an actual change. The only affected place is "Set outcome": re-picking the
  outcome a follow-up already has will no longer send a redundant PATCH.

**`DatePicker`** — default export.
- Props: `value` (`"YYYY-MM-DD"` or `""`), `onChange`,
  `placeholder = "Select date"`, `className`.
- 15 call sites, 6 of which pass a width.
- Behaviours to keep:
  - picking a day closes the calendar
  - a "Clear date" button appears when a value is set, and sends `""`
  - dates are local (no timezone shift)
  - the display format is en-US ("Sep 12, 2026")
  - weeks start on Sunday
  - no minimum or maximum date

**`Dialog`** — default export.
- Props: `open`, `onClose`, `title`, `description?`, `children`, `footer?`,
  `maxWidth = "480px"`.
- 16 call sites. `maxWidth` values used: `560px` ×4, `400px` ×1.
- Behaviours to keep:
  - Escape closes it; clicking the backdrop closes it
  - body scroll is locked while open
  - an X close button with `aria-label="Close"`
  - the body scrolls within `max-h-[70vh]`
  - the footer is right-aligned on a subtle background
  - ConfirmDialog passes `null` children

**`ConfirmDialog`** — default export `ConfirmProvider`, plus `useConfirm()`.
- `confirm({ title, message, confirmLabel?, cancelLabel?, danger? })` returns
  `Promise<boolean>`.
- Escape, Cancel and a backdrop click all resolve `false`.
- Throws if used outside the provider.
- One call site: Tasks delete, with `danger`.

**`Toast`** — default export `ToastProvider`, plus `useToast()` returning
`{ showToast(message, type = "success") }`, where `type` is success, error or
info.
- 28 calls: 14 errors, 0 info.
- Behaviours to keep: bottom-right; each type has its own icon; toasts
  auto-dismiss after 3.5 s; **clicking a toast dismisses it**; throws if used
  outside the provider.

**`LoadingState`** — default export (`label?`, `size = 22`,
`variant: "block" | "inline"`), plus the named export `Spinner`, which only
LoadingState uses. 8 call sites: 3 `block`, 4 `inline`, 1 with a label.

**`RevealOnHover`** — default export (`primary`, `children?`), plus
`RevealLine` (`tone: "muted" | "faint"`). Requires `group/row` on the row.
4 call sites, 6 `RevealLine`s.

**Imports to update in Phase 2:** 12 files. The only internal dependency is
ConfirmDialog → Dialog.

### 1.5 Getting shadcn source that works on Tailwind v3

This was tested in a throwaway copy of the repo in a temp directory; nothing on
the branch was touched.

- **`npx shadcn@latest` is version 4.21.0.** It detects this project correctly
  (`tailwindVersion v3`, Next 14.1, `rsc: true`, `src/` directory).
- **Do not run `init`.**
  - With an existing `components.json`, it exits.
  - Without one, it only offers the new v4 presets (Nova, Vega, Maia and so on,
    with the Geist font). `new-york` is not among them.
  - Phase 1 therefore writes the whole foundation by hand.
- **`add` works.** With a hand-written `components.json` (`style: new-york`), it
  serves the older Tailwind-v3 registry: `React.forwardRef`,
  `focus-visible:outline-none`, `h-9` and so on.
- **The generated classes were checked with Tailwind v3 itself.** Using
  Tailwind's own class parser (`getClassOrder`, the method Prettier's Tailwind
  plugin uses) against the Phase-1 target config, 29 generated primitives plus
  `use-mobile` were tested. **Only `calendar.tsx` contains v4-only classes:**
  `shadow-xs`, bare `has-focus:`, and `rtl:**:[…]`.
  - `has-[…]` in `sidebar.tsx` is valid (Tailwind 3.4).
  - The `in-[` matches were false alarms, part of `origin-[--radix-…]` — the
    CSS-variable shorthand Tailwind has supported since 3.3.
  - The other patterns the prompt listed (`@theme`, `oklch`,
    `outline-hidden`, `rounded-xs`, `field-sizing`, unbracketed `data-*`,
    `not-[`, `@container`) did not appear.
- **The CLI rewrites `tailwind.config.js` wholesale.** It reformats the file,
  **strips its comments**, and adds only the sidebar colours. It also appends
  variables to `globals.css`. After every `add`, restore both files, because
  Phase 1 already provides every token.
- **Dependency problems with `add`:**
  - **`sonner` pulls in `next-themes`** (`ui/sonner.tsx` imports `useTheme`).
    Write `ui/sonner.tsx` by hand, reading the existing `.dark` class, and
    install only `sonner@^2`. Never run `add sonner`.
  - **`calendar` installs `react-day-picker@latest` (version 10) and adds
    `date-fns` directly.** The generated calendar is written for the version 9
    API (`getDefaultClassNames`, `DayButton`). It type-checked against both 9.14
    and 10.0.1 in the probe. **Pin `react-day-picker@^9`.** Remove the direct
    `date-fns` dependency, since no generated file imports it (react-day-picker
    brings its own). Rewrite the three v4-only classes in v3 syntax.
  - **`chart`** pins `recharts@2.15.4`, the version already installed. The
    generated `chart.tsx` type-checks against it.
  - **`lucide-react` was not upgraded** by the CLI, and every icon the generated
    files import exists in 0.363.0 (confirmed by type-checking).
  - Everything else is on React 18: the `@radix-ui/*` packages, `cmdk@1`,
    `class-variance-authority`. None needs an install script, which matters
    because npm 11 blocks install scripts by default.

### 1.6 Collisions

- **Filename case (blocking).** `add select` and `add dialog` create
  `select.tsx` and `dialog.tsx` next to `Select.tsx` and `Dialog.tsx`.
  **TypeScript rejects this even on Linux** (`TS1149` / `TS1261`: file names
  differing only in case), and `command.tsx` itself imports
  `@/components/ui/dialog`. **Phase 2 must be finished before any primitive is
  added.**
- **`--border` (blocking for Phase 1).** `var(--border)` appears **141 times in
  26 files**. 126 of those are the `"1px solid var(--border)"` shorthand, which
  needs a finished colour. shadcn's `--border` holds bare HSL numbers; taking
  over the name would make those borders silently disappear. Hence the
  temporary `--ui-border`.
- **All legacy variables together:** 725 inline `var(--…)` usages in `src`:
  `--text-muted` 172, `--text` 169, `--border` 141, `--bg-subtle` 91, `--bg` 55,
  `--bg-card` 35, `--red` 33, `--text-faint` 24, `--green` 6, `--live` 3.

### 1.7 Other findings

- **The Inter font has never loaded.** In the built CSS, the Google Fonts
  `@import` sits at character 14,164 of 16,028, after all of Tailwind's output.
  Browsers ignore an `@import` that isn't at the top, so the app has been
  showing the system font (except where Inter is installed locally). Phase 1
  moves the import to the top as instructed — **expect a visible font change.**
- **ThemeToggle's hard-coded colours** have to follow the new backgrounds
  (`#fafafa` / `#080808`), or the theme-switch animation will flash the wrong
  colour. This is part of Phase 1.
- **Global CSS:** a `:focus-visible` outline and a `* { margin:0; padding:0 }`
  reset. shadcn components set `focus-visible:outline-none`, which wins on
  specificity, so recolouring the global outline to the ring colour avoids
  double focus indicators while keeping focus visible on elements not yet
  converted. The reset duplicates Tailwind's own; it moves into `@layer base`.
- **Tasks has no pagination.** It always requests `limit=50` and sends no
  `page`, so any task beyond the 50th can't be reached.
- **New bug, not in §17:** choosing "Closed Won" in today's New Deal form calls
  `POST /api/deals` with that stage, and the route sets neither
  `status = WON` nor `closedAt`. The result is the "Closed Won but not won"
  state that §8 says must never exist. The API is out of scope, so this is
  recorded here, not fixed — but it affects §2 (kanban add button).
- **Section numbers in the prompt don't match the doc.** In
  `PROJECT_CONTEXT.md`, conventions are **§18** (the prompt says §19), file
  layout is **§4** (the prompt says §18), and the component table is in **§6**
  (the prompt says §12; §12 covers `src/lib`). Phase 11 updates §4, §6, §12,
  §18 and §19 as their content requires.

### 1.8 Shell: route group (recommended)

Move the seven signed-in pages into `src/app/(app)/`, with a shared
`src/app/(app)/layout.tsx` that renders the sidebar and top bar.

Why:
- **URLs don't change**, and there's nothing path-dependent to break:
  - every import uses the `@/` alias
  - middleware matches URLs, not files
  - Tailwind's content glob `./src/app/**` already covers subfolders
  - the repo already has an `(auth)` group
  - the only file-path references are in docs
- **One shell instance.** It doesn't remount on navigation, so the sidebar's
  collapsed state and the command palette persist without a flash.
- **It removes the duplicated shell** in `leads/[id]` and `analytics`, each of
  which currently renders three copies.
- **The wrapper approach** would mean touching every page's loading, error and
  main branches, and the sidebar would still remount on every navigation.

**Per-page title and controls.** Titles are dynamic (counts, the greeting, the
back button), so a title looked up from the URL would lose information. The
layout will provide two slot elements in the top bar (title, and page controls)
through context, using callback refs. A page renders
`<PageHeader title={…}>{controls}</PageHeader>`, which portals into those slots.
The controls stay part of the page's own React tree, so they always reflect
live page state — no copying of state into context, and no
`document.getElementById`.

---

## 2. Data mapping

Every element below is built only from fields the named endpoint already
returns.

| Reference element | CRM equivalent | Source (endpoint → fields) |
|---|---|---|
| Metric strip, Deal Insights | Total Revenue, Active Deals, Contacts, Conversion Rate | `GET /api/dashboard` → `revenue.amount`, `activeDeals`, `contacts`, `conversionRate`. **Only Total Revenue has a change line** (`revenue.growth` vs last month). *(This endpoint is unscoped — §17 #2 — unchanged.)* |
| Metric strip, Lead / Follow-Up Insights | the 9 KPI tiles on each tab | `GET /api/insights/summary?tab=lead\|followup` → `kpis.*`. No previous values, so **no change lines**. |
| Metric strip, Leads page | 8 lead KPIs | the same summary endpoint, no date range (as today) |
| Metric strip, Follow-ups page | Total, Planned, Pending, Rescheduled, Cancelled, Done, Missed | `GET /api/follow-ups` → `summary.*` |
| Metric strip, Analytics | Average Deal Size, Win Rate, Sales Cycle, Active Leads | `GET /api/analytics/dashboard` → `kpis.*`. No change lines. "Active Leads" keeps its label even though it counts open deals (§7). |
| Metric strip, lead detail | Lead Age, Temperature, Source Name, Re-Enquired, Last Follow-up, Lead Score | `GET /api/leads/[id]` |
| Gradient area chart | Trends graph | `GET /api/insights/trends` → `points[{date,label,value}]` |
| | Dashboard revenue | `GET /api/dashboard` → `revenueGraph[{month,value}]` |
| | Analytics revenue trend | `GET /api/analytics/dashboard` → `revenueTrend[{month,amount}]` |
| Previous-period line | Trends only | **Possible:** a second call to the same endpoint, with `from`/`to` moved back by the length of the range. The response returns `from`/`to`, so default ranges can be shifted too. **Needs approval — see Q3.** |
| Grouped bars + legend + tooltip | deals vs contacts per month | `GET /api/analytics/dashboard` → `growth[{month,deals,contacts}]` |
| Single-series bars | deals created per month | `GET /api/dashboard` → `dealsGraph[{month,value}]` (today's hand-drawn bars) |
| Thin progress bars | pipeline by stage | `GET /api/dashboard` → `pipeline[{stage,count,amount}]` |
| | lead score | `leadScore` (0–100) |
| | deal probability | `probability` (0–100) |
| Tapering funnel with % pills | deal stages | `GET /api/analytics/dashboard` → `salesFunnel`. **These are counts of where deals are now**, not how many reached each stage (live: Qualification 8, Proposal 8, Negotiation 8, Closed Won 24), under a "Leads" step that counts contacts (30). **They don't taper — see Q1.** |
| Leaderboard | top performers | `GET /api/analytics/dashboard` → `topPerformers[{name,closedDeals,revenue}]`. Bars relative to the top performer under the current sort (no quotas). Avatar initials from `name`. |
| Kanban column header | stage dot, name, count, total, add button | `GET /api/deals/pipeline` → `summary[{stage,count,totalAmount}]`. Dot colour from a stage map. The add button opens the existing New Deal dialog preset to that stage (the dialog already has `stage` state) — **see Q2.** |
| Kanban card | avatar, title, subtitle, probability, date, amount, status | `pipeline[{id,title,amount,contactName,expectedCloseDate,probability,stage}]`. Avatar and subtitle from `contactName`. Status badge **derived from stage** (Closed Won → Won, otherwise Open) because the endpoint returns no status; LOST deals are excluded by the endpoint. **No agent shown** — the endpoint doesn't return one. |
| Table: Leads | avatar + name (hover reveal), status + sub-status badge, score bar, next follow-up, agent, source | `GET /api/leads` rows; footer from `page`, `totalPages`, `total` |
| Table: Follow-ups | avatar + lead (hover reveal), agent, scheduled (red when overdue), status + outcome badge | `GET /api/follow-ups` rows + footer |
| Table: Contacts | avatar + name (hover reveal), company, location, deal value, temperature badge, favourite star (display only) | `GET /api/contacts` rows + footer (limit 10) |
| Table: Tasks | title (hover reveal), assignee avatar, related deal, priority badge, due date, status | `GET /api/tasks` rows. **No pagination** → the footer shows a count only. |
| Row-actions menu | Leads: Open, Change status, Schedule follow-up | existing handlers `router.push`, `openStatus`, `openFollowUp` |
| | Follow-ups: Mark as Done / Missed / Cancelled, Set outcome (Done rows only), Reschedule | `patchFollowUp`, the reschedule dialog |
| | Contacts: Schedule follow-up | `openFollowUp` |
| | Tasks: Change status, Delete (with confirm) | `handleStatusChange`, `handleDeleteTask` |
| Table footer | "Page X of Y", first/previous/next/last | the existing `page` parameter only. Rows per page — **see Q4.** |
| Activity feed | recent activity | `GET /api/dashboard` → `activities` |
| Sidebar user card | name, email, role | `localStorage["crm-user"]` (already stored at login) |
| Command palette | jump between pages | static list of nav items; no data |
| Brand block | "CRM" | static |

**Left out** because no data exists:
- marketing spend, cost per lead, campaigns, attribution (the "Campaign" lead
  source is a label, not a campaign record)
- revenue against target, goals, quotas
- AI insights, customer health
- region badges, deal-health badges
- drag-to-reorder, row checkboxes, bulk actions
- export, "Customize" layout
- change lines on every metric except Total Revenue
- an agent on kanban cards

---

## 3. Phases

**Rules for every phase:**
- Re-read each file from disk before editing it.
- Tick the checklist items here in the same commit as the work.
- Commit at about 200 changed lines, or at each self-contained change,
  whichever comes first — never in a state that fails `tsc`.
- Before every commit: `npx tsc --noEmit`, then
  `git checkout -- tsconfig.tsbuildinfo`, then stage explicit paths only.
- At the end of each phase, and before any commit touching
  `tailwind.config.js`, `globals.css`, `layout.tsx` or `next.config.js`:
  `set -a; . ./.env; set +a`, then `npx next build`, then restore
  `tsconfig.tsbuildinfo`.
- Push after every commit.
- ~~Report at the end of each phase, and wait for "continue".~~ The owner asked
  for one end-to-end pass; the build check still runs at every phase end.

### Phase 1: Foundation

- [x] `components.json`: new-york, `rsc: true`, `tsx: true`, Tailwind config
  `tailwind.config.js`, CSS `src/app/globals.css`, base colour neutral, CSS
  variables on, no prefix; aliases `@/components`, `@/components/ui`,
  `@/lib/utils`, `@/lib`, `@/hooks`; icon library lucide.
- [x] `src/lib/utils.ts`: the `cn()` helper.
- [x] Install `class-variance-authority`, `clsx`, `tailwind-merge@^2`,
  `tailwindcss-animate`.
- [x] `tailwind.config.js`:
  - `darkMode: ["class"]`
  - colours as `hsl(var(--token))` for background, foreground, card, popover,
    primary, secondary, muted, accent, destructive, input and ring, with
    `border: "hsl(var(--ui-border))"` and a `FLAG:` comment
  - `chart.1`–`chart.5`
  - the sidebar colours (`--sidebar-background`, `--sidebar-foreground`,
    `-primary`, `-primary-foreground`, `-accent`, `-accent-foreground`,
    `-border`, `-ring`)
  - `borderRadius` `xl` / `lg` / `md` / `sm` from `--radius`
  - accordion keyframes and animations
  - the `tailwindcss-animate` plugin
  - remove the `brand` and `surface` scales; keep `fontFamily`
- [x] `globals.css`:
  - move the Google Fonts `@import` above the `@tailwind` directives
  - add the token blocks below
  - base layer: `* { @apply border-border }`, and `body` with
    `bg-background text-foreground`
  - move the `*` reset into `@layer base`
  - recolour the global `:focus-visible` outline to `hsl(var(--ring))`
- [x] Legacy alias block, marked `FLAG:` as temporary, in both themes:
  - `--bg: hsl(var(--background))`
  - `--bg-subtle: hsl(var(--muted))`
  - `--bg-card: hsl(var(--card))`
  - `--border: hsl(var(--ui-border))`
  - `--text: hsl(var(--foreground))`
  - `--text-muted: hsl(var(--muted-foreground))`
  - `--text-faint`, `--green`, `--red` and `--live` keep their own values; dark
    `--text-faint` becomes `#525252`.
- [x] `src/components/layout/ThemeToggle.tsx`: overlay colours become `#fafafa`
  (light) and `#080808` (dark), with a `FLAG:` comment tying them to
  `globals.css`.
- [x] Verify: tsc, build. Owner checks both themes for the new palette and the
  Inter font.

**Tokens** — HSL channel values; `*` marks values the prompt didn't specify,
chosen here and open to review:

| Token | Light | Dark |
|---|---|---|
| `--background` | `0 0% 98%` (#fafafa) | `0 0% 3.1%` (#080808) |
| `--foreground` | `0 0% 3.9%`* (#0a0a0a) | `0 0% 98%` (#fafafa) |
| `--card`, `--popover` | `0 0% 100%` | `0 0% 8.6%` (#161616) |
| `--card-foreground`, `--popover-foreground` | `0 0% 3.9%`* | `0 0% 98%` |
| `--muted`, `--accent`, `--secondary`* | `0 0% 96.1%` (#f5f5f5) | `0 0% 14.9%` (#262626) |
| `--muted-foreground` | `0 0% 45.1%` (#737373) | `0 0% 63.1%` (#a1a1a1) |
| `--accent-foreground`, `--secondary-foreground`* | `0 0% 9%` | `0 0% 98%` |
| `--ui-border`, `--input` | `0 0% 89.8%` (#e5e5e5) | `0 0% 14.9%` (#262626) |
| `--primary`, `--ring` | `221.3 97.5% 53.5%` (#155dfc) | same |
| `--primary-foreground`* | `0 0% 100%` | `0 0% 100%` |
| `--destructive` | `0 72.2% 50.6%` (#dc2626) | same |
| `--destructive-foreground`* | `0 0% 98%` | `0 0% 98%` |
| `--chart-1` … `--chart-5` | #155dfc, #2b7fff, #8ec5ff, #1447e6, #193cb8 (Q7) | same |
| `--sidebar-background` | `0 0% 100%` | `0 0% 8.6%` |
| `--sidebar-foreground`* | `0 0% 3.9%` | `0 0% 98%` |
| `--sidebar-accent` | `0 0% 96.1%`* | `0 0% 14.9%` (active nav item) |
| `--sidebar-accent-foreground`* | `0 0% 9%` | `0 0% 98%` |
| `--sidebar-border` | `0 0% 89.8%`* | `0 0% 14.9%` |
| `--sidebar-primary`, `--sidebar-ring` | #155dfc | #155dfc |
| `--sidebar-primary-foreground`* | `0 0% 100%` | `0 0% 100%` |
| `--radius` | `0.625rem` | |

The faint axis-label colour (#626262 dark) will be applied as a chart-only
colour when charts are built.

### Phase 2: Clear the `ui/` folder

- [x] `git mv` Select, DatePicker, Dialog, ConfirmDialog, Toast, LoadingState
  and RevealOnHover from `src/components/ui/` to `src/components/common/`.
- [x] Update imports in the 12 files that use them:
  - `app/layout.tsx`
  - the pages: analytics, contacts, dashboard, deals, follow-ups, leads,
    `leads/[id]`, tasks
  - components: `charts/TrendsChart`, `insights/DateRangeFilter`, and
    `common/ConfirmDialog` (which imports `Dialog`)
- [x] Verify: tsc and build. Behaviour is unchanged. This is one commit; pure
  moves don't count towards the line limit.

### Phase 3: Primitives and shared components

Each primitive is added in the same commit as the component that first uses it.
**The order matters:** Radix Dialog marks everything outside itself as
non-interactive, so the hand-built Select and DatePicker panels would stop
working inside a Radix dialog. Select and DatePicker therefore move to Radix
first.

**For every primitive added:**
- Run `npx shadcn@latest add <name>`.
- Restore `tailwind.config.js` and `globals.css`.
- Check the new file for v4-only syntax.
- Remove `shadow` from `card.tsx` and any other primitive where it appears.

**Checklist:**
- [x] **Select** — primitives `select`. Rebuild `common/Select`: same props;
  `""` ↔ sentinel mapping; `align="right"` → `align="end"`; `className` sets
  the width; placeholder when nothing matches.
- [x] **DatePicker** — primitives `button`, `popover`, and `calendar`
  (**hand-fixed for v3; pin `react-day-picker@^9`; remove the direct
  `date-fns` dependency**). Rebuild `common/DatePicker`: string ↔ local `Date`,
  closes on pick, keeps "Clear date", same display format, Sunday first.
- [x] **Dialog** — primitive `dialog`. Rebuild `common/Dialog`: same props;
  `maxWidth` as an inline style (a genuinely dynamic value); X button labelled
  "Close"; scrollable body; footer; body omitted when `children` is null; no
  `aria-describedby` warning when there's no description.
- [x] **ConfirmDialog** — primitive `alert-dialog`. Rebuild on AlertDialog with
  the same `useConfirm` API; `danger` uses the destructive button (**see Q5**).
- [ ] **Toast** — hand-written `ui/sonner.tsx` (no `next-themes`; watches the
  `.dark` class with a MutationObserver; no shadows), and install `sonner@^2`.
  Rebuild `common/Toast` with the same API; `showToast` maps to
  success/error/info; 3.5 s; bottom-right; **clicking dismisses it**, kept by
  rendering each toast with a click handler (**see Q6**).
- [ ] **LoadingState** — primitive `skeleton`. Same API: `block` renders stacked
  skeleton bars, `inline` renders a single-row skeleton, and `label` stays as
  muted text. `Spinner` stays exported.
- [ ] **RevealOnHover** — token classes only; behaviour unchanged.
- [ ] Remove the manual `mounted` guards the Radix portals made unnecessary.
- [ ] Verify: tsc, build. Owner opens every dialog and every Select/DatePicker
  inside a dialog, in both themes, and triggers a toast and the delete-task
  confirm.

### Phase 4: App shell

Primitives: `sidebar` (which brings `use-mobile`, `sheet`, `separator`,
`tooltip`, `input`, `skeleton`), `dropdown-menu`, `avatar`, and `command`.

- [ ] `git mv` the dashboard, leads, contacts, deals, follow-ups, tasks and
  analytics pages into `src/app/(app)/`. This is a pure move; the URLs stay the
  same.
- [ ] `src/app/(app)/layout.tsx` + `components/layout/AppShell.tsx`:
  `SidebarProvider` → `AppSidebar` (`variant="inset"`, `collapsible="icon"`) +
  `SidebarInset` → top bar + page.
- [ ] `components/layout/AppSidebar.tsx`:
  - a static "CRM" brand block
  - the current nav items and labels, in the current order, with prefix-based
    active state
  - at the bottom: a search entry and a user card (`crm-user` name, email and
    role) opening a menu with a theme toggle and **Sign out, which behaves
    exactly as today**
- [ ] `components/layout/PageHeader.tsx`: the slot context, plus
  `<PageHeader title>{controls}</PageHeader>`.
- [ ] Top bar: sidebar toggle, separator, title slot, controls slot, search
  button.
- [ ] `components/layout/CommandMenu.tsx`: navigation only, opened with
  Cmd/Ctrl+K, from the search button, or from the sidebar search entry.
- [ ] Refactor `ThemeToggle`'s logic into a hook that the user-menu item can
  call. The login and landing pages keep their standalone button.
- [ ] In each moved page: remove its `<Sidebar />`, the `ml-52` wrapper and its
  own top bar, and move the top-bar content into `<PageHeader>`:
  - Dashboard: greeting, date and "Live"
  - list pages: "Title · count"
  - Analytics: "Analytics"
  - lead detail: the back button
  - the triple shells in `leads/[id]` and `analytics` become single ones
- [ ] Delete `components/layout/Sidebar.tsx` once nothing imports it.
- [ ] Verify: tsc, build. **Commits in the middle of this phase can show a
  doubled or missing sidebar — check only at the end.** Owner checks:
  collapse/expand (including Cmd/Ctrl+B), mobile sheet, active item on
  `/leads/<id>`, Cmd/Ctrl+K, the user menu, theme toggle and sign out, in both
  themes.

### Phase 5: Dashboard

- [ ] `InsightsTabs` → shadcn `tabs`, keeping the same values and lazy Deal
  fetch.
- [ ] Deal Insights metric strip (change line on Total Revenue only).
- [ ] `RevenueChart` → gradient area chart using `ChartContainer`.
- [ ] Deals-per-month bars → the Chart component.
- [ ] `PipelineChart` → thin progress bars.
- [ ] `ActivityFeed` → card.
- [ ] `InsightsPanel` metric strips for the 9-tile tabs; one card, with cells
  wrapping over two rows.
- [ ] `DateRangeFilter`, and `TrendsChart` → area chart (previous-period line
  only if Q3 is approved).
- [ ] `MetricCard` and `InsightCard` → the metric-strip cell component, or
  deleted if unused.
- [ ] Skeletons in the final shape for each block.
- [ ] Verify, then report.

### Phase 6: Deals

- [ ] Kanban columns (dot, name, count, total, add button per Q2) and cards
  (avatar, title, subtitle, probability bar, date and amount rows, status badge
  from stage).
- [ ] Drag and drop, and the backward-move error toast, **unchanged**.
- [ ] Controls: search and sort; New Deal dialog converted to `input`, `label`
  and `button` (the "Amount ($)" placeholder stays — §17 #23).
- [ ] Skeleton columns.
- [ ] Verify, then report.

### Phase 7: Leads

- [ ] **List:** metric strip; filter bar; pills; `table` primitive with avatar +
  RevealOnHover names (still plain text), status badge with dot, score bar,
  next follow-up with Schedule, agent, source; row-actions `dropdown-menu`
  (Open, Change status, Schedule follow-up), while the Status cell stays
  clickable; footer.
- [ ] **List dialogs:** Add Lead, Bulk Upload (file input, template download,
  report), Change status, Schedule follow-up.
- [ ] **Detail:** header card; metric strip; Personal Details; Last Lead Remark;
  recent activity; all five dialogs, including history and the assignment
  trail.
- [ ] Skeletons.
- [ ] Verify, then report.

### Phase 8: Follow-ups, Contacts, Tasks

- [ ] **Follow-ups:** metric strip, pills, filters, table, row actions (Mark as,
  Set outcome, Reschedule), footer, both dialogs.
- [ ] **Contacts:** controls, table (favourite star stays display-only),
  row action, footer, both dialogs.
- [ ] **Tasks:** filter tabs, table, status select, delete with confirm, count
  footer, New Task dialog (including meeting fields).
- [ ] Skeletons.
- [ ] Verify, then report.

### Phase 9: Analytics

- [ ] Date range controls, metric strip, revenue area chart, grouped bars
  (deals vs contacts), funnel per Q1, leaderboard with a sort toggle.
- [ ] Skeletons.
- [ ] Verify, then report.

### Phase 10: Login and landing

- [ ] Login: shadcn `card`, `input`, `label`, `button`; the demo hint; framer
  motion as it is today; no shell.
- [ ] Landing: token classes and shadcn buttons; no shell. Its `$284.5K`,
  outdated copy and auth-only visibility are §17 items and stay as they are.
- [ ] Verify, then report.

### Phase 11: Clean-up

- [ ] Confirm zero `var(--bg|--bg-subtle|--bg-card|--border|--text|--text-muted)`
  remain.
- [ ] Remove the alias block.
- [ ] Rename `--ui-border` back to `--border` in `globals.css` and
  `tailwind.config.js`.
- [ ] Delete unused code, searching before each deletion: `ComingSoon`, the old
  cards, `Spinner` if unused, any `common/` component nothing imports.
- [ ] `docs/PROJECT_CONTEXT.md`:
  - §4 layout: `(app)` group, `components/common`, `hooks`, `components.json`
  - §6 design system: tokens, the styling convention, shell, tables, component
    inventory
  - §12 `utils.ts`
  - §18 conventions: token classes instead of inline colours;
    `components/ui` holds shadcn primitives and `components/common` holds our
    own components; `FLAG:` comments; how to add a primitive (§1.5)
  - §19 notes
  - §17: the tasks 50-row cap, and the Closed Won create bug if Q8 says yes
- [ ] Final tsc and build; closing report listing everything left out for lack
  of data.

---

## 4. Risks and open questions

### Questions for the owner

- **Q1 — Funnel.** The funnel data doesn't taper (counts of where deals are
  now; Closed Won 24 against Qualification 8), and the "Leads" step counts
  contacts, not deals.
  - **Recommended:** a funnel of **deals that have reached each stage**,
    calculated in the browser by adding each stage's count to every later
    stage's (so Qualification 48, Proposal 40, Negotiation 32, Closed Won 24).
    This is honest because deals only move forward. "Leads" would be shown as a
    separate figure above it, not as the funnel's top.
  - Caveat: a deal created directly at a later stage never counted at the
    earlier ones.
  - **Alternative:** plain stage bars instead of a funnel.
- **Q2 — Kanban "+" buttons.**
  - **Recommended:** only on Qualification, Proposal and Negotiation. A "+" on
    Closed Won would make the create bug in §1.7 one click away.
  - **Alternative:** on all four columns, matching today's form, where Closed Won
    can already be chosen.
- **Q3 — Previous-period line on Trends.** It needs a second request to the same
  endpoint with the range moved back. Approve, or leave it out?
- **Q4 — Rows per page.** A selector would change only the value of the existing
  `limit` parameter.
  - **Recommended:** keep today's fixed sizes (Leads 20, Follow-ups 20,
    Contacts 10) with first/previous/next/last buttons.
  - Tasks can't paginate without sending a new `page` parameter, so its footer
    shows a count only.
- **Q5 — Confirm dialog on AlertDialog.** Radix AlertDialog deliberately
  **doesn't close on a backdrop click**; Escape and Cancel still work. Today's
  confirm does close on a backdrop click.
  - **Recommended:** accept this — it's the standard accessible behaviour for
    destructive confirmations.
  - **Alternative:** build it on Dialog to keep backdrop dismissal.
- **Q6 — Click to dismiss toasts.** Sonner doesn't do this by default.
  **Recommended:** keep it, by rendering each toast with a click handler, so
  existing behaviour is preserved.
- **Q7 — Chart colour order.** Is chart-1 the lightest blue (#8ec5ff, in the
  prompt's listed order), or should chart-1 be the primary blue (#155dfc) so
  single-series charts use the main colour? **Recommended:** chart-1 = #155dfc,
  then #2b7fff, #8ec5ff, #1447e6, #193cb8.
- **Q8 — The Closed Won create bug** (§1.7). Record it in §17 during Phase 11?
  Fixing it is outside this branch's scope.

### Risks

- **No visual verification is possible here.** Each phase report will list
  exactly what to click, in both themes.
- **Sidebar width.** shadcn's default is 16rem; today's sidebar is 13rem, so the
  12-column tables get about 3rem narrower. The width can be tuned through the
  sidebar's CSS variable if needed.
- **The `sidebar_state` cookie.** The shadcn sidebar writes it. The `(app)`
  layout can read it on the server to render the right collapsed state first
  time and avoid a flash; it has no effect on authentication.
- **The font change** (§1.7) is visible from Phase 1 onward.
- **Mid-migration.** Pages that haven't been converted rely on the legacy alias
  block from Phase 1 through Phase 10, so the `--border` rename must wait until
  all 141 uses are gone.
- **The CLI** can overwrite `tailwind.config.js` and `globals.css`, and add
  unwanted dependencies. Each `add` is followed by a diff review
  (`git diff package.json tailwind.config.js src/app/globals.css`).
- **npm 11** blocks install scripts. None of the new packages need one; the
  existing Prisma `postinstall` is unaffected because it isn't reinstalled.
