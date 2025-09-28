/**
 * 添加测试用手机号到白名单
 * 支持集成测试所需的所有测试账号
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addTestWhitelist() {
  console.log('🔄 开始添加测试手机号到白名单...');

  const testPhoneNumbers = [
    {
      phoneNumber: '+86138000000001',
      purpose: 'system_developer_test',
      notes: '集成测试 - 系统开发者账号'
    },
    {
      phoneNumber: '+86138000000002', 
      purpose: 'platform_admin_test',
      notes: '集成测试 - 平台管理员账号'
    },
    {
      phoneNumber: '+86138000000003',
      purpose: 'factory_admin_test', 
      notes: '集成测试 - 工厂管理员账号'
    },
    {
      phoneNumber: '+86138000000004',
      purpose: 'process_operator_test',
      notes: '集成测试 - 加工操作员账号'
    },
    {
      phoneNumber: '+86138000000005',
      purpose: 'viewer_test',
      notes: '集成测试 - 查看者账号'
    },
    {
      phoneNumber: '+86138000000006',
      purpose: 'department_admin_test',
      notes: '集成测试 - 部门管理员账号'
    },
    {
      phoneNumber: '+86138000000007',
      purpose: 'permission_admin_test',
      notes: '集成测试 - 权限管理员账号'
    },
    {
      phoneNumber: '+86138000000008',
      purpose: 'cross_factory_test',
      notes: '集成测试 - 跨工厂测试账号'
    }
  ];

  try {
    // 获取测试工厂ID
    const testFactory = await prisma.factory.findFirst({
      where: { id: 'TEST_2024_001' }
    });

    if (!testFactory) {
      throw new Error('测试工厂 TEST_2024_001 不存在，请先创建工厂');
    }

    for (const phone of testPhoneNumbers) {
      // 检查是否已存在
      const existing = await prisma.userWhitelist.findUnique({
        where: { 
          factoryId_phoneNumber: {
            factoryId: testFactory.id,
            phoneNumber: phone.phoneNumber
          }
        }
      });

      if (existing) {
        console.log(`⚠️  ${phone.phoneNumber} 已在白名单中，跳过`);
        continue;
      }

      // 添加到白名单
      await prisma.userWhitelist.create({
        data: {
          factoryId: testFactory.id,
          phoneNumber: phone.phoneNumber,
          status: 'PENDING',
          addedByPlatformId: 1, // platform_admin
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年有效期
        }
      });

      console.log(`✅ 已添加: ${phone.phoneNumber} - ${phone.notes}`);
    }

    console.log('\\n🎉 测试白名单添加完成！');
    
    // 显示当前白名单状态
    const whitelistCount = await prisma.userWhitelist.count({
      where: { status: 'PENDING' }
    });
    
    console.log(`📊 当前白名单总数: ${whitelistCount} 个`);

  } catch (error) {
    console.error('❌ 添加白名单失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  addTestWhitelist().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

export default addTestWhitelist;