# CRM Dashboard

A full-stack CRM dashboard built with **Next.js 14**, **TypeScript**, **Prisma**, and **PostgreSQL**.

## Tech Stack

| Layer      | Technology            |
|------------|-----------------------|
| Framework  | Next.js 14 (App Router) |
| Language   | TypeScript            |
| Database   | PostgreSQL            |
| ORM        | Prisma                |
| Auth       | JWT via `jose`        |
| Charts     | Recharts              |
| Styling    | Tailwind CSS          |
| Deployment | Vercel + Neon/Supabase |

---

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd crm-dashboard
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection string and JWT secret:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/crm_dashboard"
JWT_SECRET="your-super-secret-key"
```

### 3. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed
```

### 4. Start Dev Server

```bash
npm run dev
```

Visit `http://localhost:3000`

**Demo login:**
- Email: `admin@crm.com`
- Password: `password123`

---

## Project Structure

```
crm-dashboard/
├── prisma/
│   ├── schema.prisma          # Database schema (5 tables)
│   └── seed.ts                # Sample data seeder
├── src/
│   ├── app/
│   │   ├── (auth)/login/      # Login page
│   │   ├── dashboard/         # Dashboard page
│   │   └── api/
│   │       ├── auth/login/    # POST /api/auth/login
│   │       ├── auth/logout/   # POST /api/auth/logout
│   │       └── dashboard/     # GET  /api/dashboard
│   ├── components/
│   │   ├── cards/             # MetricCard, ActivityFeed
│   │   ├── charts/            # RevenueChart, PipelineChart
│   │   └── layout/            # Sidebar
│   ├── lib/
│   │   ├── prisma.ts          # Prisma singleton
│   │   └── auth.ts            # JWT sign/verify utilities
│   ├── middleware.ts           # Route protection
│   └── types/
│       └── dashboard.ts       # Shared TypeScript types
```

---

## API Reference

### `POST /api/auth/login`
**Body:** `{ email, password }`
**Returns:** `{ token, user: { id, name, email, role } }`

### `GET /api/dashboard`
**Auth:** `Authorization: Bearer <token>`
**Returns:**
```json
{
  "revenue":        { "amount": 232000, "growth": 12.5 },
  "activeDeals":    4,
  "contacts":       5,
  "conversionRate": 54.5,
  "revenueGraph":   [{ "month": "Jan", "value": 45000 }, ...],
  "dealsGraph":     [{ "month": "Jan", "value": 2 }, ...],
  "pipeline":       [{ "stage": "Proposal", "count": 2, "amount": 95000 }, ...],
  "activities":     [{ "id": "...", "message": "...", "user": {...} }, ...]
}
```

---

## Database Schema

| Table       | Key Columns                                              |
|-------------|----------------------------------------------------------|
| `users`     | id, name, email, password, role, status                  |
| `contacts`  | id, first_name, last_name, email, company, owner_id      |
| `deals`     | id, title, amount, stage, status, contact_id, owner_id   |
| `activities`| id, user_id, activity_type, entity_type, message         |
| `tasks`     | id, title, assigned_to, status, due_date                 |

---

## Deployment

### Vercel + Neon (Recommended)

1. Create a [Neon](https://neon.tech) PostgreSQL database
2. Push to GitHub
3. Import into [Vercel](https://vercel.com)
4. Add environment variables:
   - `DATABASE_URL` (from Neon)
   - `JWT_SECRET` (random 32-char string)
5. Run migrations: `npx prisma migrate deploy`

---

## Future Modules

- `/contacts` — Contact management CRUD
- `/deals` — Deal pipeline with Kanban view
- `/activities` — Full activity log with filters
- `/tasks` — Task management with assignments
