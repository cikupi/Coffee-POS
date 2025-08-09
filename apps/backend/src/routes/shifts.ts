import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Get current active shift for logged-in cashier
router.get('/current', requireAuth, async (req: any, res) => {
  const shift = await prisma.shift.findFirst({ where: { cashierId: req.user.sub, closedAt: null } });
  res.json({ shift });
});

// Open shift
router.post('/open', requireAuth, async (req: any, res) => {
  const schema = z.object({ openingCash: z.number().nonnegative(), notes: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.shift.findFirst({ where: { cashierId: req.user.sub, closedAt: null } });
  if (existing) return res.status(400).json({ error: 'Shift already open' });

  const shift = await prisma.shift.create({
    data: {
      cashier: { connect: { id: req.user.sub } },
      openingCash: parsed.data.openingCash,
      notes: parsed.data.notes,
    }
  });
  res.status(201).json({ shift });
});

// Close shift
router.post('/close', requireAuth, async (req: any, res) => {
  const schema = z.object({ closingCash: z.number().nonnegative(), notes: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const shift = await prisma.shift.findFirst({ where: { cashierId: req.user.sub, closedAt: null } });
  if (!shift) return res.status(400).json({ error: 'No active shift' });

  const updated = await prisma.shift.update({ where: { id: shift.id }, data: { closedAt: new Date(), closingCash: parsed.data.closingCash, notes: parsed.data.notes } });
  res.json({ shift: updated });
});

export default router;
