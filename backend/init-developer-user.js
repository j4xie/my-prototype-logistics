import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function initDeveloperUser() {
  try {
    // Check if factory exists
    const factory = await prisma.factory.findUnique({
      where: { id: 'TEST_2024_001' }
    });

    if (!factory) {
      console.log('Creating test factory...');
      await prisma.factory.create({
        data: {
          id: 'TEST_2024_001',
          name: '测试工厂',
          code: 'TEST001',
          address: '测试地址',
          contactPerson: '测试联系人',
          contactPhone: '13800138000',
          isActive: true
        }
      });
    }

    // Check if developer user already exists
    const existingDeveloper = await prisma.user.findFirst({
      where: { 
        username: 'developer',
        factoryId: 'TEST_2024_001'
      }
    });

    if (existingDeveloper) {
      console.log('Developer user already exists, updating password...');
      
      // Update password
      const hashedPassword = await bcrypt.hash('Dev@123456', 10);
      await prisma.user.update({
        where: { id: existingDeveloper.id },
        data: { 
          passwordHash: hashedPassword,
          isActive: true,
          roleCode: 'developer',
          roleLevel: 0
        }
      });
      
      console.log('Developer user password updated');
      return;
    }

    // Create developer user
    const hashedPassword = await bcrypt.hash('Dev@123456', 10);
    
    const developer = await prisma.user.create({
      data: {
        factoryId: 'TEST_2024_001',
        username: 'developer',
        passwordHash: hashedPassword,
        email: 'developer@heiniu.com',
        phone: '13800138001',
        fullName: '系统开发者',
        isActive: true,
        roleLevel: 0,
        roleCode: 'developer',
        permissions: []
      }
    });

    console.log('Developer user created successfully:', developer);
    
  } catch (error) {
    console.error('Error initializing developer user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initDeveloperUser();