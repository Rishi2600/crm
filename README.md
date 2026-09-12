# CRM

A sales CRM for an Indian sales team: leads come in, agents work them through
follow-up calls, and the ones that convert become deals. Built with Next.js 14
(App Router), Prisma and PostgreSQL.

All money is in **Indian Rupees (₹)**.

---

## Getting started

You need Node 18+ and a PostgreSQL database (local, or hosted like Neon).

**1. Install**

```bash
npm install
```

**2. Set up your environment**

Copy the example file and fill it in:

```bash
cp .env.example .env
```

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `JWT_SECRET` | Signs login tokens. **Must be your own random value** — generate one with `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | How long a login lasts, e.g. `7d` |
| `NEXT_PUBLIC_APP_URL` | Where the app runs, e.g. `http://localhost:3000` |

> ⚠️ Do not ship the `JWT_SECRET` that comes with `.env.example`. It is a
> placeholder committed to this repo, so anyone who has seen the repo could
> forge a login token. Replace it before any deploy.

**3. Create the tables**

```bash
npx prisma migrate deploy    # applies the migration files as-is
npx prisma generate          # regenerates the typed database client
```

Use `npx prisma migrate dev` instead if you are changing `schema.prisma` and
want a new migration created for you.

**4. Fill it with sample data** (optional but recommended)

```bash
npm run db:seed
```

This gives you 30 leads with history, 60 deals, 60 follow-ups and 6 tasks.

**It is safe to run more than once.** The seed clears what it previously
created before inserting again, so you always end up with the same amount of
data instead of doubling it. Because of that, **never run it against a database
with real customer data** — it deletes leads, contacts, deals, tasks and
follow-ups.

**5. Start it**

```bash
npm run dev          # http://localhost:3000
```

### Logins created by the seed

All use the password `password123`.

| Email | Role | What they can see |
|---|---|---|
| `admin@crm.com` | Admin | Everything |
| `usman@crm.com` | Manager | Their own records + their team's |
| `ali@crm.com` | Sales Rep | Only their own records |
| `fatima@crm.com` | Sales Rep | Only their own records |
| `hamza@crm.com` | Sales Rep | Only their own records |

---

## What's in it

| Page | What it's for |
|---|---|
| **Dashboard** | Revenue and pipeline summary, plus Lead and Follow-Up insight tabs |
| **Leads** | The lead desk — add, import, filter, change status, open a lead's full history |
| **Contacts** | The same people, viewed as a contact list |
| **Deals** | Pipeline board; drag a deal to move it forward a stage |
| **Follow-up** | Every scheduled call, and marking them done / missed / rescheduled |
| **Tasks** | To-dos and meetings |
| **Analytics** | Win rate, average deal size, sales cycle, top performers |

---

## Commands

```bash
npm run dev          # start the dev server
npm run build        # production build (runs prisma generate first)
npm run start        # serve the production build
npm run db:seed      # reset and reload sample data
npm run db:studio    # browse the database in a GUI
npm run db:migrate   # create + apply a new migration during development
```

---

## Documentation

- **[docs/MODULES.md](docs/MODULES.md)** — how the three feature modules work
  and why they were built the way they were. Start here if you are changing
  code.
- **[docs/LIFECYCLE-AUDIT.md](docs/LIFECYCLE-AUDIT.md)** — a walk through the
  whole product lifecycle, what was verified working, and the known problems
  that are still open.

## Known gaps worth reading before you build on this

The audit document has the full list with file references. The short version:

1. Replace `JWT_SECRET` before deploying.
2. `/api/dashboard` has no permission filtering — every user sees company-wide
   revenue.
3. A manager sees different totals on the Leads page than on the Contacts page.
4. Deals cannot be marked lost, so the win rate will drift to 100%.
5. Contacts and deals cannot be edited or deleted, and there is no data export.
6. There are no automated tests and no ESLint config.
