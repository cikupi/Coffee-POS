import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const upsertSchema = z.record(z.string(), z.unknown());

async function getAllSettingsKV() {
  const rows = await prisma.setting.findMany();
  const map: Record<string, any> = {};
  for (const r of rows) map[r.key] = r.value as any;
  return map;
}

// Get all settings (any authenticated user)
router.get('/', requireAuth, async (_req, res) => {
  const map = await getAllSettingsKV();
  res.json({ settings: map });
});

// Get single key
router.get('/key/:key', requireAuth, async (req, res) => {
  const row = await prisma.setting.findUnique({ where: { key: req.params.key } });
  res.json({ key: req.params.key, value: row?.value ?? null });
});

// Upsert multiple settings (ADMIN)
router.put('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data as Record<string, any>;
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(data)) {
      await tx.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
  });
  const map = await getAllSettingsKV();
  res.json({ settings: map });
});

// Export simple backup (ADMIN)
router.get('/backup', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  // Collect core entities (avoid huge tables like stock movements/orders for this simple backup)
  const [settings, products, variants, customers] = await Promise.all([
    prisma.setting.findMany(),
    prisma.product.findMany(),
    prisma.variant.findMany(),
    prisma.customer.findMany(),
  ]);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { settings, products, variants, customers },
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="pos-backup-${Date.now()}.json"`);
  res.status(200).send(JSON.stringify(payload, null, 2));
});

const restoreSchema = z.object({
  version: z.number(),
  data: z.object({
    settings: z.array(z.object({ key: z.string(), value: z.any() })).optional().default([]),
    products: z.array(z.any()).optional().default([]),
    variants: z.array(z.any()).optional().default([]),
    customers: z.array(z.any()).optional().default([]),
  }),
});

// Import simple backup (ADMIN)
router.post('/restore', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = restoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { data } = parsed.data;

  await prisma.$transaction(async (tx) => {
    // Settings upsert
    for (const s of data.settings) {
      await tx.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: { key: s.key, value: s.value } });
    }
    // Products upsert by id if present, else create new ids
    for (const p of data.products) {
      if (p.id) {
        await tx.product.upsert({ where: { id: p.id }, update: { name: p.name, category: p.category, description: p.description, imageUrl: p.imageUrl, isActive: p.isActive }, create: p });
      } else {
        await tx.product.create({ data: { name: p.name, category: p.category, description: p.description ?? null, imageUrl: p.imageUrl ?? null, isActive: p.isActive ?? true } });
      }
    }
    // Variants upsert
    for (const v of data.variants) {
      const base = { label: v.label ?? v.name, price: v.price, sku: v.sku ?? null, stock: v.stock ?? 0, productId: v.productId };
      if (v.id) {
        await tx.variant.upsert({ where: { id: v.id }, update: base, create: { id: v.id, ...base } as any });
      } else if (v.productId) {
        await tx.variant.create({ data: base as any });
      }
    }
    // Customers upsert (by phone if provided else by id)
    for (const c of data.customers) {
      const where = c.id ? { id: c.id } : (c.phone ? { phone: c.phone } : null);
      if (where) {
        // @ts-ignore dynamic where shape
        await tx.customer.upsert({ where, update: { name: c.name, phone: c.phone, email: c.email, points: c.points ?? 0 }, create: { name: c.name, phone: c.phone ?? null, email: c.email ?? null, points: c.points ?? 0 } });
      } else {
        await tx.customer.create({ data: { name: c.name, phone: c.phone ?? null, email: c.email ?? null, points: c.points ?? 0 } });
      }
    }
  });

  res.json({ ok: true });
});

export default router;
