import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function updateDeveloperRole() {
  try {
    // Find existing developer user
    const developer = await prisma.user.findFirst({
      where: { 
        username: 'developer',
        factoryId: 'TEST_2024_001'
      }
    });

    if (developer) {
      console.log('Found developer user, updating password and activating...');
      
      // Update password and activate
      const hashedPassword = await bcrypt.hash('Dev@123456', 10);
      await prisma.user.update({
        where: { id: developer.id },
        data: { 
          passwordHash: hashedPassword,
          isActive: true,
          roleCode: 'factory_super_admin'  // Use existing role with full permissions
        }
      });
      
      console.log('Developer user updated successfully');
    } else {
      console.log('Developer user not found, creating new one...');
      
      // Create developer user with factory_super_admin role
      const hashedPassword = await bcrypt.hash('Dev@123456', 10);
      
      const newDeveloper = await prisma.user.create({
        data: {
          factoryId: 'TEST_2024_001',
          username: 'developer',
          passwordHash: hashedPassword,
          email: 'developer@heiniu.com',
          phone: '13800138001',
          fullName: '系统开发者',
          isActive: true,
          roleCode: 'factory_super_admin'
        }
      });

      console.log('Developer user created with factory_super_admin role:', newDeveloper);
    }
    
  } catch (error) {
    console.error('Error updating developer role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateDeveloperRole();