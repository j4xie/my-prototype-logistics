#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function migrateRoleValues() {
  console.log('🔄 开始迁移角色值...\n');
  
  try {
    // 更新所有 roleCode 为 'super_admin' 的用户
    const result = await prisma.$executeRaw`
      UPDATE users 
      SET role_code = 'factory_super_admin' 
      WHERE role_code = 'super_admin'
    `;
    
    console.log(`✅ 已更新 ${result} 个用户的角色值`);
    
    // 查询更新后的用户
    const updatedUsers = await prisma.user.findMany({
      where: {
        roleCode: 'factory_super_admin'
      },
      select: {
        id: true,
        username: true,
        factoryId: true,
        roleCode: true
      }
    });
    
    console.log('\n更新后的用户列表:');
    updatedUsers.forEach(user => {
      console.log(`  - ${user.username} (工厂: ${user.factoryId}) - 角色: ${user.roleCode}`);
    });
    
    console.log('\n✨ 角色值迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行迁移
migrateRoleValues().catch(console.error);