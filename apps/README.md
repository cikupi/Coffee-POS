# POS System (Backend + Frontend)

Monorepo apps for a coffee shop POS. Backend (Express + Prisma + PostgreSQL) and Frontend (Next.js App Router + Tailwind).

## Features

- Inventory, Products, Orders with stock movements
- Customer management with reward points accrual on checkout
- Reports: Sales summary and Bestsellers
- App Settings (branding, tax) + JSON Backup/Restore (ADMIN only)
- Auth with roles: ADMIN, KASIR, BARISTA
- Responsive UI for dashboard, cashier, customers, menu, settings, users, profile

## Requirements

- Node.js 18+
- PostgreSQL 14+ (local or remote)

## Environment

Backend sample: `apps/backend/.env.example` (copy to `.env`)

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coffee_pos?schema=public"
PORT=4000
JWT_SECRET="replace-with-strong-secret"
NODE_ENV=development
```

Frontend sample: `apps/frontend/ENV.EXAMPLE.txt` (copy to `.env.local`)

```
NEXT_PUBLIC_API_BASE=http://localhost:4000
```

Note: `.env.example` files may be ignored by .gitignore. We provided `ENV.EXAMPLE.txt` for the frontend to avoid ignore rules.

## First Run (Development)

1) Backend
- Install deps: `npm i` (run from repo root if using a single package.json workspace, or inside `apps/backend` if separate)
- Create DB and apply Prisma schema:
  - Set `DATABASE_URL` in `apps/backend/.env`
  - From `apps/backend`: `npx prisma migrate deploy` (or `npx prisma migrate dev`)
  - Generate client: `npx prisma generate`
- Seed initial data (users + menu):
  - From `apps/backend`: `node prisma/seed.js`
- Start server: from `apps/backend` run `npm run dev` (or `ts-node src/server.ts` depending on scripts)

2) Frontend
- Set `NEXT_PUBLIC_API_BASE` in `apps/frontend/.env.local` (e.g., `http://localhost:4000`)
- Install deps and run dev server (from `apps/frontend`):
  - `npm i`
  - `npm run dev`

3) Login Accounts (from seed)
- admin@coffee.local / password123 (ADMIN)
- kasir@coffee.local / password123 (KASIR)
- barista@coffee.local / password123 (BARISTA)

## Key Endpoints

- Settings: `GET /api/settings`, `GET /api/settings/key/:key`, `PUT /api/settings`
- Backup/Restore (ADMIN): `GET /api/settings/backup`, `POST /api/settings/restore`
- Reports: `GET /api/reports/sales`, `GET /api/reports/bestsellers`
- Orders: `POST /api/orders`, `GET /api/orders`
- Products: `GET /api/products`, `POST /api/products`, variant routes etc.
- Customers: CRUD endpoints

## Notes

- Reward points accrual: 1 point per Rp 10,000 of order total (integer floor).
- Backup/restore includes settings, products, variants, customers.
- Some pages/actions are restricted by role; ADMIN-only controls (e.g., backup/import) are hidden in UI if not admin.

## Deployment

- Ensure proper `DATABASE_URL`, `JWT_SECRET`, and `NEXT_PUBLIC_API_BASE` for production.
- Build frontend: from `apps/frontend` `npm run build`
- Build/start backend per your process (e.g., `npm run build && npm run start`).
- Consider reverse proxy for serving frontend and backend on same domain or CORS setup.

## Troubleshooting

- Prisma type errors after schema change: run `npx prisma generate` and restart backend.
- Database connection issues: verify `DATABASE_URL` and that Postgres is running.
- 401/403 errors: check login and role.
