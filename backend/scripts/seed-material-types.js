import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MATERIAL_TYPES = [
  // 鱼类
  { name: '鲈鱼', category: '鱼类', unit: 'kg', description: '常见淡水鱼，肉质鲜嫩' },
  { name: '带鱼', category: '鱼类', unit: 'kg', description: '海水鱼，适合冷冻加工' },
  { name: '三文鱼', category: '鱼类', unit: 'kg', description: '高端鱼类，富含omega-3' },
  { name: '金枪鱼', category: '鱼类', unit: 'kg', description: '深海鱼类' },
  { name: '鳕鱼', category: '鱼类', unit: 'kg', description: '白肉鱼，适合鱼片加工' },
  { name: '鲤鱼', category: '鱼类', unit: 'kg', description: '淡水鱼' },
  { name: '草鱼', category: '鱼类', unit: 'kg', description: '常见淡水鱼' },
  { name: '黑鱼', category: '鱼类', unit: 'kg', description: '肉质紧实' },
  // 虾蟹类
  { name: '虾', category: '虾蟹类', unit: 'kg', description: '海虾、河虾等' },
  { name: '蟹', category: '虾蟹类', unit: 'kg', description: '螃蟹类' },
  // 其他
  { name: '贝类', category: '贝类', unit: 'kg', description: '扇贝、蛤蜊等' },
  { name: '鱿鱼', category: '头足类', unit: 'kg', description: '鱿鱼、墨鱼等' },
  { name: '章鱼', category: '头足类', unit: 'kg', description: '八爪鱼' },
];

async function seedMaterialTypes() {
  try {
    const factoryId = 'TEST_2024_001';

    // 获取第一个用户作为创建者
    let user = await prisma.user.findFirst({
      where: { factoryId },
    });

    // 如果没有工厂用户，使用平台用户
    if (!user) {
      const platformAdmin = await prisma.platformAdmin.findFirst();
      if (platformAdmin) {
        // 使用平台管理员ID，但设置正确的factoryId
        console.log(`使用平台管理员作为创建者`);
        user = { id: platformAdmin.id };
      } else {
        console.error('❌ No user found');
        return;
      }
    }

    console.log(`🌱 Seeding material types for factory: ${factoryId}`);
    console.log(`👤 Creator ID: ${user.id}`);

    let created = 0;
    let skipped = 0;

    for (const material of MATERIAL_TYPES) {
      try {
        await prisma.rawMaterialType.create({
          data: {
            factoryId,
            ...material,
            createdBy: user.id,
          },
        });
        created++;
        console.log(`  ✅ ${material.name}`);
      } catch (error) {
        if (error.code === 'P2002') {
          // 唯一约束冲突，说明已存在
          skipped++;
          console.log(`  ⏭️  ${material.name} (已存在)`);
        } else {
          throw error;
        }
      }
    }

    console.log(`\n✅ Seed complete!`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${MATERIAL_TYPES.length}`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedMaterialTypes();
