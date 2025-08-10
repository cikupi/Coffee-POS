import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './prisma';

import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import productsRoutes from './routes/products';
import ordersRoutes from './routes/orders';
import shiftsRoutes from './routes/shifts';
import inventoryRoutes from './routes/inventory';
import customersRoutes from './routes/customers';
import reportsRoutes from './routes/reports';
import settingsRoutes from './routes/settings';

dotenv.config();

const app = express();

// Allow configuring CORS via env. Support comma-separated list + Vercel preview domains.
const corsEnv = process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const allowedOrigins = corsEnv.split(',').map(s => s.trim()).filter(Boolean);
// Regex for Vercel domains (any subdomain depth) and localhost
const vercelRegex = /^https?:\/\/([a-z0-9-]+\.)*vercel\.app$/i;
const localhostRegex = /^https?:\/\/localhost(:\d+)?$/i;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server / curl
    const isAllowed =
      allowedOrigins.includes(origin) ||
      vercelRegex.test(origin) ||
      localhostRegex.test(origin);
    if (isAllowed) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 204,
}));

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});
// Alias for deployment checks
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

// Public health for CORS/browser quick check
app.get('/api/public/health', (_req, res) => {
  res.json({ ok: true, public: true, service: 'backend', time: new Date().toISOString() });
});

// DB health check
app.get('/api/public/health/db', async (_req, res) => {
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - t0;
    res.json({ ok: true, db: 'up', latency_ms: ms, time: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'DB error' });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);

export default app;
