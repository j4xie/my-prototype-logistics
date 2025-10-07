import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('=== 检查用户数据 ===');
    const users = await prisma.factoryUser.findMany({
      where: { username: 'processing_admin' },
      select: { id: true, username: true, factoryId: true, roleCode: true }
    });
    console.log('用户信息:', JSON.stringify(users, null, 2));

    console.log('\n=== 检查批次数据 ===');
    const batches = await prisma.processingBatch.findMany({
      select: {
        id: true,
        batchNumber: true,
        factoryId: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    console.log(`找到 ${batches.length} 个批次`);
    batches.forEach(b => {
      console.log(`- ${b.batchNumber}: factoryId=${b.factoryId}, status=${b.status}`);
    });

    if (users.length > 0 && batches.length > 0) {
      const userFactoryId = users[0].factoryId;
      const matchingBatches = batches.filter(b => b.factoryId === userFactoryId);
      console.log(`\n用户factoryId: ${userFactoryId}`);
      console.log(`匹配的批次数: ${matchingBatches.length}`);
    }

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
