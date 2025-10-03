import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createRealDeveloper() {
  try {
    // Delete existing developer if exists
    await prisma.user.deleteMany({
      where: { 
        username: 'developer',
        factoryId: 'TEST_2024_001'
      }
    });

    // Create developer user with special marker
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
        roleCode: 'factory_super_admin',
        position: 'SYSTEM_DEVELOPER' // Special marker
      }
    });

    console.log('Developer user created successfully:', developer);
    
  } catch (error) {
    console.error('Error creating developer:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createRealDeveloper();