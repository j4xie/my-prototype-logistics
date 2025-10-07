import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EMPLOYEES = [
  { username: 'zhangsan', fullName: '张三', department: 'processing', role: 'operator' },
  { username: 'lisi', fullName: '李四', department: 'processing', role: 'operator' },
  { username: 'wangwu', fullName: '王五', department: 'processing', role: 'department_admin' },
  { username: 'zhaoliu', fullName: '赵六', department: 'processing', role: 'operator' },
  { username: 'qianqi', fullName: '钱七', department: 'management', role: 'factory_super_admin' },
];

const password = await bcrypt.hash('123456', 10);

for (const emp of EMPLOYEES) {
  try {
    await prisma.user.create({
      data: {
        factoryId: 'TEST_2024_001',
        username: emp.username,
        passwordHash: password,
        email: `${emp.username}@test.com`,
        fullName: emp.fullName,
        department: emp.department,
        roleCode: emp.role,
        isActive: true,
      }
    });
    console.log('Added:', emp.fullName);
  } catch (e) {
    if (e.code === 'P2002') console.log('Exists:', emp.fullName);
    else console.error('Error:', emp.fullName, e.message);
  }
}

await prisma.$disconnect();
console.log('Done!');
