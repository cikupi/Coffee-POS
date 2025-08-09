import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

function parseRange(query: any) {
  const { from, to } = query as any;
  const createdAt = from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined;
  return createdAt;
}

// Sales summary: totals, counts, avg ticket
router.get('/sales', requireAuth, async (req, res) => {
  const createdAt = parseRange(req.query);
  const where: any = { status: 'COMPLETED', ...(createdAt ? { createdAt } : {}) };
  const [sum, count] = await Promise.all([
    prisma.order.aggregate({ _sum: { subtotal: true, discount: true, total: true, paid: true }, where }),
    prisma.order.count({ where }),
  ]);
  const totals = sum._sum;
  res.json({
    count,
    subtotal: Number(totals.subtotal || 0),
    discount: Number(totals.discount || 0),
    total: Number(totals.total || 0),
    paid: Number(totals.paid || 0),
    avgTicket: count ? Number(totals.total || 0) / count : 0,
  });
});

// Revenue by day
router.get('/revenue', requireAuth, async (req, res) => {
  const createdAt = parseRange(req.query);
  const where: any = { status: 'COMPLETED', ...(createdAt ? { createdAt } : {}) };
  const orders = await prisma.order.findMany({ where, orderBy: { createdAt: 'asc' }, select: { total: true, createdAt: true } });
  const byDay: Record<string, number> = {};
  for (const o of orders) {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDay[key] = (byDay[key] || 0) + Number(o.total);
  }
  res.json({ revenue: byDay });
});

// Bestsellers by variant (and product)
router.get('/bestsellers', requireAuth, async (req, res) => {
  const createdAt = parseRange(req.query);
  const limit = Math.min(Number((req.query as any).limit || 10), 50);
  const items = await prisma.orderItem.findMany({
    where: {
      order: { status: 'COMPLETED', ...(createdAt ? { createdAt } : {}) },
    },
    include: { variant: { include: { product: true } } },
  });
  const map = new Map<string, { name: string; variant: string; qty: number; revenue: number }>();
  for (const it of items) {
    const key = it.variantId;
    const qty = it.qty;
    const amount = Number(it.price) * it.qty - Number(it.discount || 0);
    const name = it.variant.product.name;
    const variant = it.variant.label;
    const cur = map.get(key) || { name, variant, qty: 0, revenue: 0 };
    cur.qty += qty;
    cur.revenue += amount;
    map.set(key, cur);
  }
  const arr = Array.from(map.entries()).map(([variantId, v]) => ({ variantId, ...v }));
  arr.sort((a, b) => b.qty - a.qty);
  res.json({ bestsellers: arr.slice(0, limit) });
});

// CSV export of completed orders
router.get('/sales/export', requireAuth, async (req, res) => {
  const createdAt = parseRange(req.query);
  const orders = await prisma.order.findMany({
    where: { status: 'COMPLETED', ...(createdAt ? { createdAt } : {}) },
    include: { items: { include: { variant: { include: { product: true } } } }, cashier: true, customer: true },
    orderBy: { createdAt: 'asc' },
  });
  const header = [
    'date','code','cashier','customer','dineType','subtotal','discount','total','paid','paymentType','itemProduct','itemVariant','itemQty','itemPrice','itemDiscount'
  ];
  const lines = [header.join(',')];
  for (const o of orders) {
    for (const it of o.items) {
      const row = [
        new Date(o.createdAt).toISOString(),
        o.code,
        o.cashier.name,
        o.customer?.name || '',
        o.dineType,
        String(o.subtotal),
        String(o.discount),
        String(o.total),
        String(o.paid),
        o.paymentType,
        it.variant.product.name,
        it.variant.label,
        String(it.qty),
        String(it.price),
        String(it.discount || 0),
      ].map((v) => `"${String(v).replace(/"/g, '""')}` + `"`).join(',');
      lines.push(row);
    }
  }
  const csv = lines.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sales.csv"');
  res.send(csv);
});

// Profit & margin
router.get('/profit', requireAuth, async (req, res) => {
  const createdAt = parseRange(req.query);
  const items = await prisma.orderItem.findMany({
    where: { order: { status: 'COMPLETED', ...(createdAt ? { createdAt } : {}) } },
    select: ({ qty: true, price: true, cost: true, discount: true } as any),
  }) as any[];
  let revenue = 0;
  let cost = 0;
  for (const it of items) {
    const lineGross = Number(it.price) * it.qty;
    const lineDiscount = Number(it.discount || 0);
    const lineRevenue = Math.max(0, lineGross - lineDiscount);
    const lineCost = Number(it.cost || 0) * it.qty;
    revenue += lineRevenue;
    cost += lineCost;
  }
  const profit = revenue - cost;
  const margin = revenue > 0 ? profit / revenue : 0;
  res.json({ revenue, cost, profit, margin });
});

// Totals by payment type
router.get('/payments', requireAuth, async (req, res) => {
  const createdAt = parseRange(req.query);
  const where: any = { status: 'COMPLETED', ...(createdAt ? { createdAt } : {}) };
  const groups = await (prisma as any).order.groupBy({
    by: ['paymentType'],
    _sum: { paid: true },
    where,
  });
  const totals: Record<string, number> = {};
  for (const g of groups) {
    totals[g.paymentType] = Number(g._sum?.paid || 0);
  }
  res.json({ totals });
});

// Total accumulated customer deposits (current balance sum)
router.get('/deposit-total', requireAuth, async (_req, res) => {
  const agg = await prisma.customer.aggregate({ _sum: { deposit: true } as any }) as any;
  const total = Number(agg?._sum?.deposit || 0);
  res.json({ total });
});

export default router;
