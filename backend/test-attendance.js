import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAttendance() {
  try {
    console.log('=== 测试在岗人员统计 ===\n');

    const factoryId = 'CRETAS_2024_001';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. 查看今天的打卡记录
    console.log('1. 查询今日打卡记录:');
    const clockRecords = await prisma.employeeTimeClock.findMany({
      where: {
        factoryId,
        clockTime: {
          gte: today
        }
      },
      orderBy: { clockTime: 'desc' }
    });
    console.log(`   找到 ${clockRecords.length} 条打卡记录`);
    clockRecords.forEach(r => {
      console.log(`   - 用户${r.userId}: ${r.clockType} at ${r.clockTime.toLocaleString()}`);
    });

    // 2. 创建测试打卡数据
    console.log('\n2. 创建测试打卡数据:');

    // 获取工厂的用户
    const users = await prisma.factoryUser.findMany({
      where: { factoryId },
      take: 3,
      select: { id: true, username: true }
    });

    if (users.length === 0) {
      console.log('   ⚠️ 没有找到工厂用户，无法创建测试数据');
    } else {
      console.log(`   找到 ${users.length} 个用户`);

      // 为前2个用户创建上班打卡
      for (let i = 0; i < Math.min(2, users.length); i++) {
        const user = users[i];
        const clockTime = new Date();
        clockTime.setHours(8 + i, 0, 0, 0); // 8:00, 9:00

        await prisma.employeeTimeClock.create({
          data: {
            userId: user.id,
            factoryId,
            clockType: 'clock_in',
            clockTime,
            status: 'normal',
            location: '工厂大门',
            deviceId: 'TEST_DEVICE'
          }
        });
        console.log(`   ✅ ${user.username} 打卡上班 at ${clockTime.toLocaleTimeString()}`);
      }

      // 为第1个用户创建下班打卡
      if (users.length > 0) {
        const user = users[0];
        const clockTime = new Date();
        clockTime.setHours(18, 0, 0, 0); // 18:00

        await prisma.employeeTimeClock.create({
          data: {
            userId: user.id,
            factoryId,
            clockType: 'clock_out',
            clockTime,
            status: 'normal',
            location: '工厂大门',
            deviceId: 'TEST_DEVICE'
          }
        });
        console.log(`   ✅ ${user.username} 打卡下班 at ${clockTime.toLocaleTimeString()}`);
      }
    }

    // 3. 统计在岗人员
    console.log('\n3. 统计在岗人员:');
    const clockIns = await prisma.employeeTimeClock.groupBy({
      by: ['userId'],
      where: {
        factoryId,
        clockTime: { gte: today },
        clockType: 'clock_in'
      }
    });

    const clockOuts = await prisma.employeeTimeClock.groupBy({
      by: ['userId'],
      where: {
        factoryId,
        clockTime: { gte: today },
        clockType: 'clock_out'
      }
    });

    const clockOutUserIds = new Set(clockOuts.map(c => c.userId));
    const onDutyUsers = clockIns.filter(c => !clockOutUserIds.has(c.userId));

    console.log(`   上班打卡: ${clockIns.length} 人`);
    console.log(`   下班打卡: ${clockOuts.length} 人`);
    console.log(`   在岗人员: ${onDutyUsers.length} 人`);

    // 4. 总员工数
    const totalWorkers = await prisma.factoryUser.count({
      where: { factoryId }
    });
    console.log(`   总员工数: ${totalWorkers} 人`);

    console.log('\n✅ 测试完成！');
    console.log(`\n预期显示: ${onDutyUsers.length} / ${totalWorkers}`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAttendance();
