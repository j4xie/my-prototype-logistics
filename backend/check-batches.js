import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const batches = await prisma.processingBatch.findMany({
  take: 5,
  orderBy: { createdAt: 'desc' },
  include: { supervisor: { select: { fullName: true } } }
});

console.log('📦 Recent batches:', batches.length);
batches.forEach(b => {
  console.log(`  ✅ ${b.batchNumber} | ${b.productType || '待定'} | ${b.supervisor?.fullName || '无'}`);
});

await prisma.$disconnect();
