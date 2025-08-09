# Backend (Express + Prisma)

Service backend untuk Coffee POS.

## Environment Variables

Wajib diatur saat deploy:
- `DATABASE_URL` — URL Postgres (Neon/Supabase/Plugin Railway)
- `JWT_SECRET` — string acak kuat
- `NODE_ENV` — `production`
- `CORS_ORIGIN` — domain frontend (Vercel). Bisa multi, pisahkan dengan koma
- `PORT` — opsional (default 4000)

## Build & Run

- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npm run start`

## Endpoint Kesehatan

- `GET /api/health` → `{ ok: true, service: "backend" }`

---

# Deploy ke Railway

1) Buat Project → "Deploy from GitHub" → pilih repo ini.
2) Set Root Directory ke `apps/backend` (Project → Settings → Build).
3) Set Commands (Settings → Build & Deploy):
   - Build: `npm ci && npx prisma generate && npm run build`
   - Start: `npm run start`
4) Tambah Environment Variables (Service → Variables):
   - `DATABASE_URL` = dari Neon/Supabase/Plugin Railway
   - `JWT_SECRET` = string acak kuat
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = `https://your-frontend.vercel.app` (bisa beberapa, pisahkan koma)
   - `PORT` = `4000` (opsional)
5) Jalankan migrasi Prisma (Service → Shell):
   - `npx prisma migrate deploy`
6) Verifikasi URL publik Railway:
   - Buka `https://<railway-backend-url>/api/health` → harus OK.

## Catatan
- `CORS_ORIGIN` mendukung multi-origin: contoh
  - `https://your-frontend.vercel.app,https://staging-your-frontend.vercel.app,http://localhost:3000`
- Jika DB dari Railway plugin, gunakan `DATABASE_URL` yang disediakan plugin.
- Untuk seed (jika ada): `npm run prisma:seed`

---

## Quick Deploy

- Deploy Backend ke Railway:
  
  [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new?template=https://github.com/cikupi/Coffee-POS&plugins=postgresql&root=apps/backend)
