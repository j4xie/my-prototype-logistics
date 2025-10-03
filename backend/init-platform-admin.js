import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function initPlatformAdmin() {
  try {
    // Check if platform_admin already exists
    const existingAdmin = await prisma.platformAdmin.findUnique({
      where: { username: 'platform_admin' }
    });

    if (existingAdmin) {
      console.log('Platform admin already exists');
      
      // Update password to ensure it's correct
      const hashedPassword = await bcrypt.hash('admin@123456', 10);
      await prisma.platformAdmin.update({
        where: { username: 'platform_admin' },
        data: { passwordHash: hashedPassword }
      });
      
      console.log('Platform admin password updated');
      return;
    }

    // Create platform_admin user
    const hashedPassword = await bcrypt.hash('admin@123456', 10);
    
    const platformAdmin = await prisma.platformAdmin.create({
      data: {
        username: 'platform_admin',
        passwordHash: hashedPassword,
        email: 'admin@heiniu.com',
        fullName: '平台超级管理员',
        role: 'platform_super_admin'
      }
    });

    console.log('Platform admin created successfully:', platformAdmin);
    
  } catch (error) {
    console.error('Error initializing platform admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initPlatformAdmin();