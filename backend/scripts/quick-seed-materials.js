import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MATERIALS = [
  { name: '鲈鱼', category: '鱼类' }, { name: '带鱼', category: '鱼类' },
  { name: '三文鱼', category: '鱼类' }, { name: '金枪鱼', category: '鱼类' },
  { name: '鳕鱼', category: '鱼类' }, { name: '鲤鱼', category: '鱼类' },
  { name: '草鱼', category: '鱼类' }, { name: '黑鱼', category: '鱼类' },
  { name: '虾', category: '虾蟹类' }, { name: '蟹', category: '虾蟹类' },
  { name: '贝类', category: '贝类' }, { name: '鱿鱼', category: '头足类' },
  { name: '章鱼', category: '头足类' },
];

for (const m of MATERIALS) {
  try {
    await prisma.rawMaterialType.create({
      data: { factoryId: 'TEST_2024_001', ...m, unit: 'kg', createdBy: null }
    });
    console.log(\`✅ \${m.name}\`);
  } catch (e) {
    if (e.code === 'P2002') console.log(\`⏭️  \${m.name}\`);
  }
}
await prisma.\$disconnect();
