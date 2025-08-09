# Coffee POS Monorepo

Monorepo aplikasi POS:
- Frontend: `apps/frontend` (Next.js)
- Backend: `apps/backend` (Express + Prisma)
- Database: Postgres

## Arsitektur
- Frontend memanggil API via `NEXT_PUBLIC_API_BASE`.
- Backend membaca `DATABASE_URL` dan menerapkan CORS via `CORS_ORIGIN` (mendukung multi-origin dipisah koma).
- Endpoint health: `/api/health`.

---

## Deploy Cepat (Managed)
Rekomendasi: Frontend di Vercel, Backend di Railway, Database di Neon/Supabase.

### 1) Siapkan Database (Neon / Supabase)
- Buat project Postgres dan salin `DATABASE_URL` (contoh: `postgres://USER:PASS@HOST:5432/DB?sslmode=require`).

### 2) Deploy Backend (Railway)
1. Railway → New Project → Deploy from GitHub → pilih repo (root).
2. Set Root Directory ke `apps/backend` (Project → Settings → Build).
3. Set Environment Variables:
   - `DATABASE_URL` = dari Neon/Supabase
   - `JWT_SECRET` = string acak kuat
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = `https://your-frontend.vercel.app` (bisa multi: pisahkan dengan koma)
4. Build commands (bila perlu): `npm ci && npx prisma generate && npm run build`
5. Start command: `npm run start` (atau `node dist/server.js` sesuai package)
6. Jalankan migrasi (Railway Shell): `npx prisma migrate deploy`
7. Catat URL backend, mis. `https://pos-api.up.railway.app`
8. Verifikasi: buka `https://pos-api.up.railway.app/api/health`

### 3) Deploy Frontend (Vercel)
1. Vercel → New Project → Import GitHub repo.
2. Root Directory: `apps/frontend`.
3. Environment Variables:
   - `NEXT_PUBLIC_API_BASE` = URL backend Railway, mis. `https://pos-api.up.railway.app`
4. Deploy → dapat domain, contoh `https://your-frontend.vercel.app`.

### 4) Sinkronkan CORS
- Pastikan `CORS_ORIGIN` di backend berisi domain Vercel (atau beberapa origin dipisah koma).

---

## Variabel Environment

### Backend (`apps/backend/.env.example`)
```
DATABASE_URL=
PORT=4000
JWT_SECRET=
NODE_ENV=production
CORS_ORIGIN=
```

### Frontend (`apps/frontend/.env.local.example`)
```
NEXT_PUBLIC_API_BASE=
```

---

## Verifikasi Fitur setelah Deploy
- Login di frontend, token tersimpan sebagai `pos_token`.
- Kasir:
  - Tambah pelanggan inline (fitur “Tambah”).
  - Pembayaran DEPOSIT: jika saldo kurang, transaksi tetap jalan; deposit pelanggan menjadi minus.
- Riwayat: Refund berjalan ke endpoint backend.
- Struk: Tampilkan "Sisa Deposit" hanya saat metode pembayaran DEPOSIT.

---

## Jalankan secara lokal
- Backend: `cd apps/backend && npm i && npm run dev`
- Frontend: `cd apps/frontend && npm i && npm run dev`
- Env lokal:
  - Backend: salin `.env.example` ke `.env`
  - Frontend: salin `.env.local.example` ke `.env.local`

---

## Catatan
- CORS: Set `CORS_ORIGIN` untuk domain produksi (mendukung multi origin).
- Prisma: Gunakan `npx prisma migrate deploy` di produksi.
- Backup DB: aktifkan backup via Neon/Supabase.
