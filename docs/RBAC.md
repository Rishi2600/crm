# Who can see and do what

There are three roles — **Admin**, **Manager**, **Sales Rep** — plus a
reporting tree built from the `managerId` field on each user.

Two things are easy to confuse, so it's worth saying plainly:

- **The role** decides *how wide* your view is.
- **The reporting tree** decides *whose records* are in it.

Being a Manager does not by itself give you anybody. You see a rep's records
because that rep's `managerId` points at you.

---

## The rule

One function answers it for the whole app: `resolveOwnerScope()` in
`src/lib/scope.ts`.

| Role | Can see and act on |
|---|---|
| **Admin** | Everything in the company |
| **Manager** | Their own records + their **direct reports'** records |
| **Sales Rep** | Only their own records |

"Direct reports" means exactly one level. A manager of managers sees the
managers under them but **not** the people under those managers. That's a known
limitation, not an accident — walking the full tree needs a recursive query.

For tasks, "yours" means you're the assignee **or** the creator, since tasks
have no owner field.

---

## What changed, and why

Reading and writing used to ask two different questions.

**Reading** asked the right one: *is this record owned by me or my team?*

**Writing** asked a lazier one: *is this person a manager at all?*

```js
// the old check, copy-pasted into eight files
const isElevated = userRole === "ADMIN" || userRole === "MANAGER";
if (!isOwner && !isElevated) → 403
```

Nothing there mentions *whose* record it is. So any manager could edit any
record in the company, including other managers' teams — even records the read
endpoints correctly refused to show them. A manager could be told "you are not
authorized to view this lead" and still change its status.

It was worse than it sounds, because the **Contacts** page showed a manager
every contact in the company along with its ID — and leads and contacts are the
same table. One page leaked the IDs, another left the doors unlocked.

Both sides now ask the same question:

```js
const ownerIds = await resolveOwnerScope(userId, userRole);
if (!isInScope(ownerIds, record.ownerId)) → 403
```

### Endpoints that changed

**Writes** — were "any manager", now team-scoped:

`PATCH /api/leads/[id]` · `PATCH /api/leads/[id]/status` ·
`POST /api/leads/[id]/remarks` · `PATCH /api/follow-ups/[id]` ·
`PATCH /api/deals/[id]/stage` · `DELETE /api/tasks/[id]` ·
`PATCH /api/tasks/[id]/status` · `POST /api/tasks/[id]/attendees`

**Reads** — showed managers the whole company, now team-scoped:

`GET /api/contacts` · `GET /api/deals/pipeline`

**Refactors, no behaviour change** — these were already correct but kept their
own private copy of the rule, which is how the versions drifted apart in the
first place:

`GET /api/tasks` · `GET /api/analytics/dashboard`

Sixteen routes now share the one definition.

---

## What this looks like day to day

A manager who used to see 30 contacts and 48 deals now sees only their team's.
That is the intended change: the wider numbers were the bug, not the feature.

Admins are unaffected. Reps are unaffected.

---

## Still open

**`/api/dashboard` has no scoping at all.** It never even looks at who is
asking, so every user — including the most junior rep — sees company-wide
revenue, open pipeline and the top deals. It is now the *only* endpoint without
scoping, which makes it both the most glaring hole and a small fix of exactly
the same shape as the ones above.

**Roles are frozen in the login token for 7 days.** Nothing re-reads a user's
role or status from the database. Deactivating someone does not log them out,
and demoting an admin does not take effect until their token expires. There is
no way to revoke a session.

**No permissions below the role level.** You cannot express "reps may not
export" or "only admins see revenue" without adding another role check to
another route — which is the pattern that produced this bug.

---

## Testing it

The seed creates **two separate teams** specifically so team isolation can be
tested. Before, every record belonged either to Usman's team or the admin, so
there was no second team to be blocked from and the bug could not be reproduced
without faking it.

```
Usman Tariq (Manager)          Priya Nair (Manager)
├── Ali Hassan                 └── Rohit Menon
├── Fatima Khan
└── Hamza Iqbal

Sarah Ahmed (Admin) — outside the tree, sees everything
```

All accounts use the password `password123`.

The check that matters: log in as Usman and try to touch one of Rohit's leads.
Reading and writing should both give you `403`. Priya should be able to do both.
