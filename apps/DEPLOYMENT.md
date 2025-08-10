# Coffee POS — Deployment Guide

Monorepo contains:
- `apps/backend` — Express + Prisma + PostgreSQL
- `apps/frontend` — Next.js (App Router) + Tailwind

Follow either the Provider Deploy steps (recommended) or Local Build verification.

---

## 1) Environment Variables

Backend (`apps/backend/.env`):
- `DATABASE_URL` — Postgres URL (Neon/Supabase/Railway Plugin)
- `JWT_SECRET` — strong random string
- `NODE_ENV` — `production`
- `CORS_ORIGIN` — frontend domains (comma-separated supported)
- `PORT` — optional (default 4000)

Frontend (`apps/frontend/.env.local`):
- `NEXT_PUBLIC_API_BASE` — public backend URL

Samples:
- Backend: see `apps/backend/.env.example`
- Frontend: see `apps/frontend/ENV.EXAMPLE.txt`

---

## 2) Deploy Backend (Railway)

1. Create new Railway Project → Deploy from GitHub.
2. Set Root Directory to `apps/backend`.
3. Build Command:
   ```bash
   npm ci && npx prisma generate && npm run build
   ```
4. Start Command:
   ```bash
   npm run start
   ```
5. Add Environment Variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `CORS_ORIGIN=https://your-frontend.vercel.app` (add more with commas if needed)
   - `PORT=4000` (optional)
6. Run Prisma migrations (Service → Shell):
   ```bash
   npx prisma migrate deploy
   ```
7. Health Check:
   - Open `https://<railway-backend-url>/api/health` → should return `{ ok: true, service: "backend" }`.

Notes:
- `CORS_ORIGIN` accepts multiple domains, comma-separated. Example:
  `https://your-frontend.vercel.app,https://staging-your-frontend.vercel.app,http://localhost:3000`
- If using Railway Postgres Plugin, use the provided `DATABASE_URL`.
- Optional seed: `npm run prisma:seed`.

---

## 3) Deploy Frontend (Vercel)

1. Import GitHub repository to Vercel.
2. Set Project Directory to `apps/frontend`.
3. Build Command (default for Next.js):
   ```bash
   npm run build
   ```
4. Environment Variable:
   - `NEXT_PUBLIC_API_BASE=https://<railway-backend-url>`
5. Ensure Backend `CORS_ORIGIN` includes your Vercel domain(s).

After deploy, open the Vercel URL and verify login and key flows.

---

## 4) Local Verification (Optional but Recommended)

Backend (in `apps/backend`):
```bash
npm i
npx prisma generate
# For local DB apply migrations (only if safe):
# npx prisma migrate deploy
npm run build
npm run start   # or npm run dev for development
```

Frontend (in `apps/frontend`):
```bash
npm i
npm run build
npm run start   # or npm run dev for development
```

Ensure `.env` and `.env.local` are correctly set:
- Backend listens on `PORT` (default 4000)
- Frontend `NEXT_PUBLIC_API_BASE` points to backend URL.

---

## 5) Smoke Test Checklist

- [ ] Backend health: `GET /api/health` returns OK
- [ ] Login with seeded users (see repo root `README.md`)
- [ ] Create order → stock decreases, reward points accrue
- [ ] Reports: Sales & Bestsellers render
- [ ] ADMIN-only actions (Backup/Restore) gated correctly

---

## 6) Troubleshooting

- Prisma type errors after schema change: `npx prisma generate` then restart backend.
- DB connection issues: verify `DATABASE_URL` and DB service is running.
- 401/403: verify login and role.
- Frontend build warnings: `next.config.ts` is configured to ignore type/lint build blockers; fix iteratively.
