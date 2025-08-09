import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'KASIR', 'BARISTA'])
});

// List users (ADMIN)
router.get('/', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true } });
  res.json({ users });
});

// Create user (ADMIN)
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = userSchema.extend({ password: z.string().min(6) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, email, phone, role, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'Email already exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, phone, role, password: hash } });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
});

// Update user (ADMIN)
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = req.params.id;
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, email, phone, role } = parsed.data;
  const user = await prisma.user.update({ where: { id }, data: { name, email, phone, role } });
  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
});

// Delete user (ADMIN)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = req.params.id;
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
});

// Reset password (ADMIN)
router.patch('/:id/reset-password', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = req.params.id;
  const schema = z.object({ password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const hash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({ where: { id }, data: { password: hash } });
  res.json({ ok: true });
});

// Profile (self)
router.get('/profile/me', requireAuth, async (req: AuthRequest, res) => {
  const id = req.user!.sub;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true, role: true } });
  res.json({ user });
});

router.put('/profile/me', requireAuth, async (req: AuthRequest, res) => {
  const id = req.user!.sub;
  const schema = z.object({ name: z.string().min(2), phone: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, phone } = parsed.data;
  const user = await prisma.user.update({ where: { id }, data: { name, phone } });
  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
});

router.patch('/profile/change-password', requireAuth, async (req: AuthRequest, res) => {
  const id = req.user!.sub;
  const schema = z.object({ currentPassword: z.string().min(6), newPassword: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { currentPassword, newPassword } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) return res.status(400).json({ error: 'Current password incorrect' });
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { password: hash } });
  res.json({ ok: true });
});

export default router;
