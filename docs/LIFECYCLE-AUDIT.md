# Lifecycle Audit

I walked the product end to end against the **real** database (the hosted Neon
one in `.env`), not a test copy. This is what I did, what worked, and what is
still broken.

Date: 12 September 2026.

---

## First: the database was three migrations behind

Before anything could be tested, the real database turned out to be missing the
last three migrations. That means **none** of the last three features had ever
existed in this database — no lead lifecycle columns, no follow-ups table, no
lead history.

Applied all three. They are additive (new columns with defaults, new tables), so
nothing existing was touched. Then checked for drift:

```
npx prisma migrate diff ... → "No difference detected."
```

So the migration files and `schema.prisma` now describe exactly the same
database. Worth knowing: if you have other environments, they are probably
behind too.

---

## The walkthrough

Each step below was run as a real API call and the result checked in the
database afterwards.

| # | Step | Result |
|---|---|---|
| 1 | Log in as admin, manager and rep | ✅ all three; wrong password → 401 |
| 2 | Add a lead by hand | ✅ created, timeline opened with a "Created" entry |
| 3 | Move its status **without** a remark | ✅ correctly refused (400) |
| 4 | Move its status **with** a remark | ✅ moved, remark saved onto that exact change |
| 5 | Put an illegal status pair (Fresh + Won) | ✅ correctly refused, with the valid options listed |
| 6 | Book a follow-up | ✅ created, and it appeared on the lead's timeline |
| 7 | Reschedule it | ✅ moved, reschedule counter went up |
| 8 | Mark it done, then set an outcome | ✅ both saved |
| 9 | Convert the lead | ✅ status Converted · Won |
| 10 | Create a ₹48.5L deal on it | ✅ created |
| 11 | Advance the deal a stage | ✅ moved to Proposal |
| 12 | Try to drag the deal **backward** | ✅ correctly refused (400) |
| 13 | Close the deal as won | ✅ closed, and `closedAt` set automatically |
| 14 | Create a task with no due date | ✅ correctly refused (400) |
| 15 | Create a task, progress it, complete it, delete it | ✅ all four |
| 16 | Close the lead, then revive it | ✅ revival detected, `revivedAt` stamped |
| 17 | Import leads from CSV (2 good rows, 1 bad) | ✅ 2 imported, 1 skipped with the right row number |
| 18 | Load all 9 pages | ✅ all returned 200 |

The lead's history at the end read as a complete story:

```
Created              Fresh · Untouched          "Enquired via the print ad"
Status Changed       Fresh → Interested         "Sent the 3-year quote, reviewing with their CFO"
Follow-up Scheduled  Sep 18, 2026, 11:00 AM     "CFO review call"
Status Changed       Interested → Converted     "Signed the 3-year contract"
Status Changed       Converted → Closed         "Project shelved after the budget freeze"
Status Changed       Closed → Interested        "Budget reinstated, they called back"
```

No server errors appeared in the logs during the entire run.

---

## Do the numbers agree with each other?

This is the test that matters most, because a CRM that shows two different
answers to the same question stops being trusted.

**Leads page vs the Dashboard's Lead Insights** — every figure matched:

| | Leads page | Dashboard | |
|---|---|---|---|
| Total | 32 | 32 | ✅ |
| Fresh | 13 | 13 | ✅ |
| Converted | 6 | 6 | ✅ |
| Closed | 3 | 3 | ✅ |
| Irrelevant | 3 | 3 | ✅ |
| Re-Enquired | 8 | 8 | ✅ |

**Follow-up page vs the Dashboard's Follow-Up Insights** — also all matched
(Total 60, Done 14, Missed 5, Cancelled 5, Rescheduled 12).

---

## What I found broken

### 1. A manager sees two different lead counts

Logged in as the manager, on the **same data**:

| Page | Count |
|---|---|
| Leads | **22** |
| Contacts | **31** |
| Dashboard Insights | **22** |

Leads and Contacts are the *same database table*. The difference is that
`/api/contacts` and `/api/deals/pipeline` let a manager see the whole company,
while every newer route limits them to their own team.

Nothing is crashing — the two sides simply disagree about what a manager is
allowed to see. Somebody has to decide which answer is right, and then all the
routes should use `src/lib/scope.ts`.

### 2. Everyone sees company-wide revenue on the dashboard

Confirmed live. Admin, manager and junior sales rep all got the identical
figure from `/api/dashboard`:

```
₹9,30,50,000  ← same number for all three roles
```

`src/app/api/dashboard/route.ts` never looks at who is asking. A rep opening
the app sees total company revenue, the full pipeline, and the biggest deals.

### 3. Seeded deals were in an impossible state (fixed)

The audit turned up a real data bug. **10 deals** worth **₹3.07 Cr** had
stage = "Closed Won" but status ≠ "Won".

The app cannot produce that: when you drag a deal to Closed Won, the endpoint
sets its status to Won at the same time. Only the seed could create it, because
its list of random stages included "Closed Won" and got applied to open and
lost deals too.

The visible symptom was two pages disagreeing about how much had been won:

| | Before | After |
|---|---|---|
| Deals page, "Closed Won" column | ₹11.75 Cr | ₹8.82 Cr |
| Dashboard, won revenue | ₹9.30 Cr | ₹8.82 Cr |
| Agree? | ❌ | ✅ |

Fixed in `prisma/seed.ts` — non-won deals now only get open stages. I also
checked the two related invariants, both clean: no won deal is missing its
`closedAt`, and no unwon deal has one.

### 4. A follow-up's later changes don't reach the lead's timeline

When you book a follow-up, the lead's history records it. But if you then
**reschedule** it or **mark it done**, the lead's timeline never hears about it.
In the walkthrough above, the timeline still shows the original 18 September
slot even though the call was moved to the 22nd and then completed.

The follow-up record itself is correct — this is only about the lead's history
being advertised as "complete" when it isn't. Small fix in the follow-up update
route; not done yet because it wasn't part of the requested work.

### 5. The win rate will quietly become 100%

Right now it reads **67.6%**, which looks fine. It is only that healthy because
the seed inserts 12 lost deals.

No screen in the app can mark a deal as lost — `DealStage` has no "Closed Lost",
and nothing writes `status = LOST`. So every deal a real salesperson creates can
only end up Won or stay Open, and the win rate climbs toward 100% as seed data
is outnumbered by real data.

---

## What is still unverified

**I could not visually check the pages in a browser** — no browser tool was
available in this session. What I can say:

- All 9 pages returned HTTP 200. Next.js renders these components on the server
  too, so a crash while rendering would have produced a 500 instead.
- Every API call the pages make was tested directly and returned correct data.
- The money formatter was checked value by value, and the compiled browser
  bundle contains `₹` and no leftover `$` formatting.

What that does **not** prove is that every dialog opens, every dropdown behaves,
and the layout holds at small widths. Someone should click through it once.

---

## Suggested order of fixing

1. Replace `JWT_SECRET` with a real random value. (One minute, and it is the
   difference between "secure" and "anyone can log in as admin".)
2. Add permission filtering to `/api/dashboard`.
3. Decide what a manager sees, and make all routes agree.
4. Add "Closed Lost" so the win rate means something.
5. Record follow-up reschedules and completions on the lead's timeline.
6. Then the bigger items in [MODULES.md](MODULES.md): editing and deleting
   contacts and deals, data export, tests, and an ESLint config.
