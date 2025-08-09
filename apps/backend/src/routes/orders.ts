import { Router } from 'express';
import { OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const createOrderSchema = z.object({
  customerId: z.string().optional(),
  dineType: z.enum(['DINE_IN', 'TAKEAWAY']).default('TAKEAWAY'),
  discount: z.number().nonnegative().default(0),
  paymentType: z.enum(['CASH', 'QRIS', 'CARD', 'DEPOSIT']),
  paid: z.number().nonnegative(),
  note: z.string().optional(),
  items: z.array(z.object({
    variantId: z.string(),
    qty: z.number().int().positive(),
    discount: z.number().nonnegative().default(0),
  })).min(1),
});

function makeOrderCode() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `POS-${yy}${mm}${dd}-${hh}${mi}${ss}-${Math.floor(Math.random()*90+10)}`;
}

// List orders
router.get('/', requireAuth, async (req, res) => {
  const { status, q, from, to } = req.query as any;
  const where: any = {};
  if (status) where.status = status;
  if (q) where.code = { contains: q, mode: 'insensitive' };
  if (from || to) where.createdAt = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined };
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { variant: { include: { product: true } } } }, cashier: true, customer: true },
  });
  res.json({ orders });
});

// Get order
router.get('/:id', requireAuth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: { include: { variant: { include: { product: true } } } }, cashier: true, customer: true } });
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json({ order });
});

// Edit order (limited fields)
const editOrderSchema = z.object({
  note: z.string().optional(),
});

router.patch('/:id', requireAuth, async (req, res) => {
  const parsed = editOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const body = parsed.data;
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Not found' });
  // Allow editing only if not refunded/cancelled
  if ((order as any).status === 'REFUNDED' || (order as any).status === 'CANCELLED') {
    return res.status(400).json({ error: 'Cannot edit a refunded/cancelled order' });
  }
  const updated = await prisma.order.update({ where: { id: order.id }, data: { note: body.note } });
  res.json({ order: updated });
});

// Full refund an order
router.post('/:id/refund', requireAuth, async (req: any, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!order) return res.status(404).json({ error: 'Not found' });
  if ((order as any).status === 'REFUNDED') return res.status(400).json({ error: 'Order already refunded' });
  if ((order as any).status === 'CANCELLED') return res.status(400).json({ error: 'Order is cancelled' });

  const refunded = await prisma.$transaction(async (tx) => {
    // Restock items and log IN movements
    for (const item of order.items) {
      await tx.variant.update({ where: { id: item.variantId }, data: { stock: { increment: item.qty } } });
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          type: 'IN',
          qty: item.qty,
          refOrderId: order.id,
          userId: req.user.sub,
          note: `Refund ${order.code}`,
        },
      });
    }
    // Reverse deposit if used
    if ((order as any).paymentType === 'DEPOSIT' && order.customerId) {
      await (tx as any).customer.update({ where: { id: order.customerId }, data: { deposit: { increment: Number(order.total) } } });
    }
    // Revert points if granted
    if (order.customerId) {
      const points = Math.floor(Number(order.total) / 10000);
      if (points > 0) {
        await tx.customer.update({ where: { id: order.customerId }, data: { points: { decrement: points } } });
      }
    }
    // Update order status
    const upd = await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUNDED } });
    return upd;
  });

  res.json({ order: refunded });
});
// Create order (checkout)
router.post('/', requireAuth, async (req: any, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  // Require active shift for this cashier
  const activeShift = await prisma.shift.findFirst({ where: { cashierId: req.user.sub, closedAt: null } });
  if (!activeShift) return res.status(400).json({ error: 'No active shift. Please open a shift first.' });

  // Fetch variants for pricing and stock
  const variants = await prisma.variant.findMany({ where: { id: { in: data.items.map(i => i.variantId) } }, include: { product: true } });
  const vMap = new Map(variants.map(v => [v.id, v]));

  // Compute subtotal and validate stock
  let subtotal = 0;
  for (const item of data.items) {
    const v = vMap.get(item.variantId);
    if (!v) return res.status(400).json({ error: `Variant not found: ${item.variantId}` });
    if (v.stock < item.qty) return res.status(400).json({ error: `Stock not enough for ${v.product.name} - ${v.label}` });
    const line = Number(v.price) * item.qty - (item.discount || 0);
    subtotal += line;
  }
  const total = Math.max(0, subtotal - (data.discount || 0));

  // Handle payment rules
  let effectivePaid = data.paid;
  let customerForDeposit: { id: string; deposit: any } | null = null;
  if (data.paymentType === 'DEPOSIT') {
    if (!data.customerId) return res.status(400).json({ error: 'Customer is required for deposit payment' });
    const cAny = await prisma.customer.findUnique({ where: { id: data.customerId } }) as any;
    if (!cAny) return res.status(400).json({ error: 'Customer not found' });
    // Allow deposit to go negative: proceed even if balance is insufficient
    customerForDeposit = { id: cAny.id, deposit: cAny.deposit };
    effectivePaid = Number(total);
  } else {
    if (data.paid < total) return res.status(400).json({ error: 'Paid amount is less than total' });
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        code: makeOrderCode(),
        cashier: { connect: { id: req.user.sub } },
        customer: data.customerId ? { connect: { id: data.customerId } } : undefined,
        shift: { connect: { id: activeShift.id } },
        status: 'COMPLETED',
        dineType: data.dineType,
        discount: data.discount,
        subtotal,
        total,
        paid: effectivePaid,
        note: data.note,
        paymentType: data.paymentType as any,
        items: {
          create: data.items.map((i) => ({
            variantId: i.variantId,
            qty: i.qty,
            price: Number(vMap.get(i.variantId)!.price),
            cost: Number((vMap.get(i.variantId) as any)!.cost || 0),
            discount: i.discount || 0,
          }))
        }
      },
      include: { items: { include: { variant: { include: { product: true } } } }, cashier: true, customer: true }
    });
    // After order is created, decrement stock and log stock movements
    for (const item of data.items) {
      await tx.variant.update({ where: { id: item.variantId }, data: { stock: { decrement: item.qty } } });
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          type: 'OUT',
          qty: item.qty,
          refOrderId: created.id,
          userId: req.user.sub,
          note: `Order ${created.code}`,
        },
      });
    }
    // If using deposit, deduct customer deposit by total
    if (data.paymentType === 'DEPOSIT' && customerForDeposit) {
      await (tx as any).customer.update({ where: { id: customerForDeposit.id }, data: { deposit: { decrement: total } } });
    }
    // Reward points accrual: 1 point per Rp 10,000 of total
    if (created.customerId) {
      const points = Math.floor(Number(created.total) / 10000);
      if (points > 0) {
        await tx.customer.update({ where: { id: created.customerId }, data: { points: { increment: points } } });
      }
    }
    return created;
  });

  res.status(201).json({ order });
});

export default router;
