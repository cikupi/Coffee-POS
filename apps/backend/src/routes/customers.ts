import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6).optional(),
  email: z.string().email().optional(),
});

// List customers with search and pagination
router.get('/', requireAuth, async (req, res) => {
  const { q, skip = '0', take = '50' } = req.query as Record<string, string>;
  const where: any = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      }
    : undefined;
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: Number(skip) || 0,
      take: Math.min(Number(take) || 50, 100),
    }),
    prisma.customer.count({ where }),
  ]);
  res.json({ customers, total });
});

// Get single customer
router.get('/:id', requireAuth, async (req, res) => {
  const c = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({ customer: c });
});

// Create customer
router.post('/', requireAuth, async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // unique phone/email handled by DB; catch and report
  try {
    const customer = await prisma.customer.create({ data: parsed.data });
    res.status(201).json({ customer });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Phone or email already exists' });
    }
    throw e;
  }
});

// Update customer
router.put('/:id', requireAuth, async (req, res) => {
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: parsed.data });
    res.json({ customer });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Phone or email already exists' });
    }
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'Not found' });
    }
    throw e;
  }
});

// Delete customer (ADMIN)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    throw e;
  }
});

// Adjust reward points
router.post('/:id/points', requireAuth, async (req, res) => {
  const schema = z.object({ delta: z.number().int() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { delta } = parsed.data as any;
  const updated = await prisma.customer.update({
    where: { id: req.params.id },
    data: { points: { increment: delta } },
  });
  res.json({ customer: updated });
});

// Adjust deposit balance (accepts positive for top-up, negative for withdrawal)
router.post('/:id/deposit', requireAuth, async (req, res) => {
  const schema = z.object({ delta: z.number() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { delta } = parsed.data as any;
  try {
    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: { deposit: { increment: delta } } as any,
    });
    res.json({ customer: updated });
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    throw e;
  }
});

export default router;
