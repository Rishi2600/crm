# CRM — The Three Modules

Three features were built on top of the original CRM, one after the other. Each
one reuses what the previous one established, so they're easiest to read in
order.

| # | Module | What it answers | Commit |
|---|--------|-----------------|--------|
| 1 | **Dashboard Insights** | "How is my pipeline doing?" | `0a22c24` |
| 2 | **Follow-up** | "Who do I need to call, and when?" | `3d9c025` |
| 3 | **Leads** | "Who are these people, and what's their full story?" | (this change) |

---

## The one naming gotcha — read this first

The reference screenshots and this database use two words in opposite ways. The
column names were **not** renamed to match the screenshots, because the
Dashboard's KPI cards have counted by them since Module 1 and renaming would
have silently changed what every card means.

So only the **display labels** follow the screenshots:

| What the UI says | The actual column | Values |
|---|---|---|
| Status | `Contact.leadStage` | Fresh, Interested, Converted, Closed, Irrelevant |
| Sub-Status | `Contact.leadSubStatus` | Untouched, Contacted, Proposal Sent, Won, Lost, … |
| Temperature | `Contact.leadStatus` | Hot, Warm, Cold |
| Source | `Contact.leadSource` + `Contact.sourceName` | Campaign + "The Tribune" |

All of the translating happens in one file — `src/lib/leads.ts` — so no API
route or page ever touches a raw enum value.

---

## Module 1 — Dashboard Insights

**What it does.** Adds two tabs to the Dashboard: *Lead Insights* and *Follow-Up
Insights*. Each is a grid of KPI cards (Total Leads, Fresh Leads, Converted…)
plus a Trends graph, with a shared date-range filter.

**What it needed from the database.** None of the cards could be answered from
the columns that already existed, so three new ideas were added to `Contact`:

- `leadStage` — where the lead sits in the pipeline. This is the axis the cards
  count by.
- `leadSource` — where it came from. Kept **separate** from stage, because
  "Referred" describes an origin and can be true of a lead at *any* stage.
  Folding them together would make a referred-and-converted lead impossible to
  represent.
- `revivedAt` / `reEnquiryCount` — these are *transitions*, not states. A lead
  that was closed and reopened still sits at some stage, so neither could live
  in the stage enum either.

A new `FollowUp` table was also added here, which Module 2 then built on.

**The one idea worth remembering.** "Overdue" is never stored. It's worked out
at query time by comparing a pending follow-up's date to *now*. A stored flag
would be wrong the moment the clock passed it, and would need a nightly job to
stay honest.

**Files:** `src/app/api/insights/*`, `src/components/insights/*`,
`src/lib/insights.ts`, `src/types/insights.ts`

---

## Module 2 — Follow-up

**What it does.** A Follow-up page listing every scheduled touchpoint, with
count tiles, status pills, search/agent/date filters, and the three things an
agent does to a follow-up: mark it **Done** (with an outcome), write it off as
**Missed** / **Cancelled**, or **reschedule** it.

Until this module existed, nothing in the app could *create* a follow-up — only
the seed did — so the data the Module 1 cards counted had no way to grow.

**Derived, not stored (again).** Only four statuses are stored: Pending,
Completed, Missed, Cancelled. But the UI shows five:

- **Planned** = Pending, and its time hasn't come yet
- **Pending** = Pending, and its time has passed

A planned follow-up becomes pending on its own as the clock moves, with nothing
to run and nothing to update.

**Why `rescheduleCount` is a number, not a status.** A follow-up moved twice and
then completed is still *Completed* — the moves are history. As a status,
"Rescheduled" and "Completed" would be mutually exclusive, which isn't what they
mean. It's also why the "Rescheduled" pill count deliberately doesn't add up
with the others.

**The bug that was fixed here.** The pill filters and the From/To date filter
both constrain the same column. They were being merged with a plain object
spread, so whichever came last silently replaced the other — picking *Planned*
or *Pending* while a date range was set threw the date range away, in both the
list and the counts. They're now combined with `AND`, and each pill's count is
built from the exact same filter fragment the pill itself applies, so a count
can never describe a different set of rows than clicking it shows.

**Files:** `src/app/(app)/follow-ups/*`, `src/app/api/follow-ups/*`,
`src/lib/scope.ts`, `src/types/followups.ts`

---

## Module 3 — Leads

**What it does.** A Leads page with the KPI strip, the search and filter bar,
manual **Add Lead**, **CSV bulk upload**, status changes from the list, and a
full detail view behind each lead showing its complete history.

**A lead is a Contact, not a copy of one.** Leads read the same `contacts`
table the Contacts page does, through its lead-lifecycle columns. When a lead
converts it doesn't get re-keyed into a contact — it just changes status, and
every deal, task and follow-up already attached to it stays attached. Two
tables would have meant reconciling them forever.

### Status and Sub-Status

Sub-status is the second level under status, not a replacement for it. A lead at
*Fresh* can be *Untouched* or already *Contacted* — both still count on the
"Fresh Leads" card.

Which sub-statuses are legal under which status lives in **one** place,
`SUB_STATUS_BY_STATUS` in `src/lib/leads.ts`:

```
Fresh       → Untouched, Contacted, Not Reachable
Interested  → Callback Requested, Proposal Sent, Negotiating
Converted   → Won
Closed      → Lost, Dropped
Irrelevant  → Junk, Duplicate, Out of Area
```

That map is both what the dropdown is built from *and* what the API validates
against, so the two can't disagree. It deliberately isn't a database
constraint — Postgres can't express "this column's legal values depend on that
column", and the pairing is a business rule that changes more often than a
migration should.

Picking a status without naming a sub-status snaps it to that status's **first**
option. Without that, moving a lead to Converted would strand it on impossible
pairs like *Converted · Untouched*.

### The lead recording

> "as the lead's status changes, we need to request/prompt for a lead recording"

Every status change must carry a remark. This is enforced by the API, not by the
UI being polite about it: `PATCH /api/leads/[id]/status` is the **only** route
that can change a lead's status, and it returns `400` without a remark — whether
the request came from the prompt dialog or from `curl`.

That's what makes "every status change has a recorded reason" a property of the
system rather than a habit. The transition and its remark are written as **one
row**, so the timeline can never show a change whose reason went missing.

### Complete history

One table, `lead_history`, holds everything that ever happened to a lead:
created, status changed, reassigned, remark added, details edited, follow-up
scheduled.

It's deliberately **not** the existing `Activity` table. `Activity` stores a
single free-text message, so it can answer "what happened recently" but not
"what was this lead's status *before* the change". The Assignment Trail and the
status timeline both need that before/after pair.

One query, sliced three ways in the detail view:

- the whole thing → the timeline
- `type = Assigned` → the Assignment Trail
- newest entry with a remark → the "Last Lead Remark" panel

### CSV bulk upload

- **`GET /api/leads/bulk`** hands back the blank template. Serving it from the
  API rather than hard-coding it in the page means the columns the user fills in
  and the columns the importer reads change together.
- **`POST /api/leads/bulk`** imports it. Parsing happens on the *server* — the
  browser could do it faster, but then the client would decide what counts as a
  valid lead.
- Every row goes through **the same validation the Add Lead form uses**
  (`prepareLead`). A lead that arrives by file is held to exactly the checks a
  hand-typed one is.
- **Partial success is the point.** One bad row at line 400 must not discard the
  399 good ones, so each row gets its own small transaction and the response
  reports which rows were skipped and why.
- Row numbers in that report are the **real physical line numbers** in the file.
  This matters more than it sounds: blank lines get skipped and a quoted field
  can contain a newline, so counting by index drifts, and an off-by-a-few row
  number sends someone hunting through the wrong part of their spreadsheet.
- The parser (`src/lib/csv.ts`) is hand-written rather than a dependency. The one
  thing `split(",")` can't do is the thing real exports need: `"Aurangabad, MH"`,
  `"The ""Big"" Expo"`, and a UTF-8 BOM from Excel.

### Revival — a card that finally works

Moving a lead out of Closed/Irrelevant back into a live status stamps
`revivedAt`. That's the field the Dashboard's "Revived Leads" card counts, and
until this module nothing in the app ever set it — the card could only ever show
seeded numbers.

**Files:** `src/app/(app)/leads/*`, `src/app/api/leads/*`, `src/lib/leads.ts`,
`src/lib/leads.server.ts`, `src/lib/csv.ts`, `src/types/leads.ts`

---

## Why `leads.ts` is split in two

`src/lib/leads.ts` is **pure** — no prisma, no server-only imports. Both Leads
pages are client components and they read `SUB_STATUS_BY_STATUS` from it to
build their dropdowns, so anything that file imports gets bundled into the
browser.

Importing prisma there pulled its browser shim into the client bundle and added
about half a megabyte of dead code to the page. Anything that needs the database
now lives in `src/lib/leads.server.ts`.

---

## Money is in rupees

All amounts are **Indian Rupees**, formatted by one helper: `src/lib/currency.ts`.

Indian numbering, not Western. Money is grouped and shortened in **lakh**
(1,00,000) and **crore** (1,00,00,000):

| Amount | Compact — `formatINR` | Exact — `formatINRExact` |
|---|---|---|
| 45,000 | ₹45K | ₹45,000 |
| 4,50,000 | ₹4.5L | ₹4,50,000 |
| 45,00,000 | ₹45L | ₹45,00,000 |
| 2,40,00,000 | ₹2.4Cr | ₹2,40,00,000 |

Use the compact one for tiles, chart axes and table cells; the exact one for
tooltips and detail rows, where rounding ₹12,34,567 down to "₹12L" hides the
number somebody opened the tooltip to read.

**Why one file.** This replaced **four** copy-pasted `formatCurrency` helpers
(Dashboard, Deals, Contacts, Analytics) plus two more inside the chart
components. They had already drifted apart — one rendered "₹45k", the others
"₹45K" — which is the kind of small inconsistency that makes a product feel
unfinished.

**The open question.** Deal amounts are stored as `Decimal(12,2)` with **no
currency column**, so "rupees" is an app-wide assumption rather than a fact
about each row. That is fine for one market. Selling into a second currency
later means a migration plus going back through every historical deal to decide
what currency it was in — which is why adding the column now is much cheaper
than adding it later.

---

## Rules that hold across all three modules

**Owner scoping.** `resolveOwnerScope` in `src/lib/scope.ts` decides whose rows
you can see: ADMIN → everyone, MANAGER → self + direct reports (one level), a
rep → only their own. Every list scopes first, and an Agent filter narrows
*within* that scope rather than escaping it. Every single-row read and write
re-checks the owner, so knowing an id and navigating straight to a detail URL
doesn't get you past the list.

**Labels at the edge, enums inside.** Requests and responses speak display
labels ("Proposal Sent"); the enum values never leave the server. Each module's
lib file owns both directions of that translation, and builds the reverse map
*from* the forward one so they can't fall out of sync.

**Derived beats stored.** Overdue, Planned vs Pending, Lead Age — all computed on
read. Anything time-dependent that gets written down is wrong the moment the
clock moves past it.

**Counts must match what clicking shows.** A filter row's counts are measured
against every filter *except* the one that row selects, combined with `AND` so
nothing gets silently overwritten. Cross-cutting filters (Rescheduled,
Re-Enquired) aren't part of the partition, so those counts deliberately don't
sum to Total.

**One writer per concept.** Status changes have exactly one route. Follow-up
creation has exactly one route — which is why a follow-up booked from the Leads
page, the Contacts row button, or the Follow-up page all land on the lead's
timeline identically.

---

## Running it

```bash
npx prisma migrate deploy   # applies the migration files
npm run db:seed             # sample data
npm run dev
```

Two migrations were added by these modules:

- `20260911103000_add_follow_up_cancelled` — adds the `CANCELLED` follow-up
  status (Module 02)
- `20260912120000_add_lead_desk_and_history` — adds sub-status, lead score,
  source name and the `lead_history` table (Module 03)

Both are additive and safe on existing data.

### The seed is safe to re-run

It used to only **upsert** users and contacts while **creating** deals,
activities, follow-ups and history — so every re-run stacked another full set of
children on top of the last. A database seeded three times reported three times
the pipeline, and nothing looked obviously wrong, because each individual number
was plausible.

It now clears what it created before inserting again, in foreign-key-safe order.
Run it ten times and you get the same result.

⚠️ Because it deletes, **never point it at a database with real customer data.**
Users are upserted rather than deleted, so logins keep working.

The sample data is Indian to match the rupee formatting: Indian names, cities
and `+91` phone numbers, with deals spread from ₹60K to about ₹1.8Cr so that all
three formatting tiers (K / L / Cr) actually appear on screen.

### One thing the seed no longer does

It used to create deals with stage "Closed Won" but a status of Open or Lost —
a combination the app itself cannot produce. That made the Deals page and the
Dashboard report different totals for how much had been won. See
[LIFECYCLE-AUDIT.md](LIFECYCLE-AUDIT.md) for the details.

---

## Known problems

This document explains how the modules are meant to work.
**[LIFECYCLE-AUDIT.md](LIFECYCLE-AUDIT.md)** lists what is actually broken —
read it before building on this. The most urgent items are the placeholder
`JWT_SECRET`, the unfiltered `/api/dashboard`, and managers seeing different
numbers on different pages.
