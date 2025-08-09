import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const receiveSchema = z.object({
  items: z.array(z.object({
    variantId: z.string(),
    qty: z.number().int().positive(),
    note: z.string().optional(),
  })).min(1),
});

const adjustSchema = z.object({
  items: z.array(z.object({
    variantId: z.string(),
    qtyDelta: z.number().int().refine((n) => n !== 0, 'qtyDelta cannot be 0'),
    note: z.string().optional(),
  })).min(1),
});

// List stock movements with filters
router.get('/movements', requireAuth, async (req, res) => {
  const { variantId, type, from, to, q } = req.query as any;
  const where: any = {};
  if (variantId) where.variantId = variantId;
  if (type) where.type = type;
  if (from || to) where.createdAt = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined };
  if (q) where.note = { contains: q, mode: 'insensitive' };

  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { variant: { include: { product: true } }, refOrder: true, user: true },
  });
  res.json({ movements });
});

// Receive stock (IN)
router.post('/receive', requireAuth, async (req: any, res) => {
  const parsed = receiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { items } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const created: any[] = [];
    for (const it of items) {
      const mv = await tx.stockMovement.create({
        data: {
          variantId: it.variantId,
          type: 'IN',
          qty: it.qty,
          note: it.note,
          userId: req.user?.id,
        },
      });
      await tx.variant.update({ where: { id: it.variantId }, data: { stock: { increment: it.qty } } });
      created.push(mv);
    }
    return created;
  });

  res.status(201).json({ movements: result });
});

// Adjust stock (+/-) as ADJUST
router.post('/adjust', requireAuth, async (req: any, res) => {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { items } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const created: any[] = [];
    for (const it of items) {
      const mv = await tx.stockMovement.create({
        data: {
          variantId: it.variantId,
          type: 'ADJUST',
          qty: Math.abs(it.qtyDelta),
          note: it.note,
          userId: req.user?.id,
        },
      });
      await tx.variant.update({ where: { id: it.variantId }, data: { stock: { increment: it.qtyDelta } } });
      created.push(mv);
    }
    return created;
  });

  res.status(201).json({ movements: result });
});

// Low stock list
router.get('/low-stock', requireAuth, async (_req, res) => {
  const all = await prisma.variant.findMany({ include: { product: true } });
  const low = all.filter((v: any) => (v.lowStockThreshold ?? 0) > 0 && v.stock <= v.lowStockThreshold);
  res.json({ variants: low });
});

// Usage report (aggregate OUT by day)
router.get('/usage', requireAuth, async (req, res) => {
  const { from, to } = req.query as any;
  const where: any = { type: 'OUT' };
  if (from || to) where.createdAt = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined };
  const movements = await prisma.stockMovement.findMany({ where, orderBy: { createdAt: 'asc' } });
  const byDay: Record<string, number> = {};
  for (const m of movements) {
    const d = new Date(m.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDay[key] = (byDay[key] || 0) + m.qty;
  }
  res.json({ usage: byDay });
});

export default router;
