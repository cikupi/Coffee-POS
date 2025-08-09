const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Users
  const password = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@coffee.local' },
    update: {},
    create: { name: 'Admin', email: 'admin@coffee.local', password, role: 'ADMIN' }
  });
  await prisma.user.upsert({
    where: { email: 'kasir@coffee.local' },
    update: {},
    create: { name: 'Kasir', email: 'kasir@coffee.local', password, role: 'KASIR' }
  });
  await prisma.user.upsert({
    where: { email: 'barista@coffee.local' },
    update: {},
    create: { name: 'Barista', email: 'barista@coffee.local', password, role: 'BARISTA' }
  });

  // Products & Variants
  const americano = await prisma.product.upsert({
    where: { name: 'Americano' },
    update: {},
    create: {
      name: 'Americano',
      category: 'Coffee',
      description: 'Espresso with hot water',
      variants: {
        create: [
          { label: 'Hot - M', price: 20000, stock: 100 },
          { label: 'Iced - M', price: 22000, stock: 100 }
        ]
      }
    }
  });

  const latte = await prisma.product.upsert({
    where: { name: 'Caffe Latte' },
    update: {},
    create: {
      name: 'Caffe Latte',
      category: 'Coffee',
      description: 'Espresso with milk',
      variants: {
        create: [
          { label: 'Hot - M', price: 28000, stock: 100 },
          { label: 'Iced - M', price: 30000, stock: 100 }
        ]
      }
    }
  });

  console.log('Seed completed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
