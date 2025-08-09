import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional()
});

const variantSchema = z.object({
  label: z.string().min(1),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().optional(),
  sku: z.string().optional(),
  stock: z.number().int().nonnegative().default(0)
});

async function generateUniqueSku(): Promise<string> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid similar chars
  function random(n: number) {
    let s = '';
    for (let i = 0; i < n; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const sku = `V-${random(4)}-${random(4)}`;
    const exists = await prisma.variant.findUnique({ where: { sku } as any });
    if (!exists) return sku;
  }
  // Fallback with timestamp
  return `V-${Date.now()}`;
}

// List products with variants (ALL roles)
router.get('/', requireAuth, async (req, res) => {
  const category = (req.query.category as string | undefined)?.trim();
  const where = category ? { category } : undefined;
  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { variants: { orderBy: { createdAt: 'asc' } } }
  });
  res.json({ products });
});

// Distinct categories (ALL roles)
router.get('/categories', requireAuth, async (_req, res) => {
  const categories = await prisma.product.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
  res.json({ categories: categories.map((c) => c.category) });
});

// Get single product
router.get('/:id', requireAuth, async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id }, include: { variants: true } });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ product: p });
});

// Create product (ADMIN)
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = productSchema.extend({ variants: z.array(variantSchema).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { variants = [], ...data } = parsed.data as any;
  // prepare variants: ensure cost default and auto SKU
  const prepared = await Promise.all(
    variants.map(async (v: any) => ({
      label: v.label,
      price: v.price,
      cost: typeof v.cost === 'number' ? v.cost : 0,
      sku: v.sku && v.sku.trim() !== '' ? v.sku : await generateUniqueSku(),
      stock: typeof v.stock === 'number' ? v.stock : 0,
    }))
  );
  const product = await prisma.product.create({ data: { ...data, variants: { create: prepared } }, include: { variants: true } });
  res.status(201).json({ product });
});

// Update product (ADMIN)
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data, include: { variants: true } });
  res.json({ product });
});

// Delete product (ADMIN)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Add variant to product (ADMIN)
router.post('/:id/variants', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = variantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data, productId: req.params.id };
  if (typeof data.cost === 'undefined') data.cost = 0;
  if (!data.sku || String(data.sku).trim() === '') data.sku = await generateUniqueSku();
  const v = await prisma.variant.create({ data });
  res.status(201).json({ variant: v });
});

// Update variant (ADMIN)
router.put('/variants/:variantId', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = variantSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const v = await prisma.variant.update({ where: { id: req.params.variantId }, data: parsed.data as any });
  res.json({ variant: v });
});

// Delete variant (ADMIN)
router.delete('/variants/:variantId', requireAuth, requireRole('ADMIN'), async (req, res) => {
  await prisma.variant.delete({ where: { id: req.params.variantId } });
  res.json({ ok: true });
});

// Adjust stock (ADMIN) - supports set or delta
router.patch('/variants/:variantId/stock', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const schema = z.object({ set: z.number().int().nonnegative().optional(), delta: z.number().int().optional() }).refine((d) => d.set !== undefined || d.delta !== undefined, { message: 'Provide set or delta' });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { set, delta } = parsed.data as any;
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.variant.findUnique({ where: { id: req.params.variantId } });
    if (!current) throw new Error('Variant not found');
    const newStock = set !== undefined ? set : Math.max(0, current.stock + (delta || 0));
    return tx.variant.update({ where: { id: req.params.variantId }, data: { stock: newStock } });
  });
  res.json({ variant: updated });
});

export default router;

// Backfill SKUs for existing variants without SKU (ADMIN)
router.post('/variants/assign-sku', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const missing = await prisma.variant.findMany({ where: { sku: null }, select: { id: true } });
  let updated = 0;
  for (const row of missing) {
    // retry a few times to avoid rare collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const sku = await generateUniqueSku();
      try {
        await prisma.variant.update({ where: { id: row.id }, data: { sku } });
        updated++;
        break;
      } catch (_e) {
        // unique constraint failed; retry
      }
    }
  }
  res.json({ updated, totalMissing: missing.length });
});
