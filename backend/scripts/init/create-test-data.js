import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('开始创建测试数据...\n');

    const factoryId = 'TEST_FACTORY_001';

    // 1. 创建工厂设备
    console.log('1. 创建工厂设备...');
    const equipment = await prisma.factoryEquipment.createMany({
      data: [
        {
          id: 'EQ001',
          factoryId,
          equipmentCode: 'PROC-001',
          equipmentName: '加工生产线A',
          equipmentType: '生产线',
          department: 'processing',
          status: 'active',
          location: '加工车间1号',
          specifications: JSON.stringify({
            capacity: '1000kg/h',
            power: '15kW',
            manufacturer: '设备制造商A'
          })
        },
        {
          id: 'EQ002',
          factoryId,
          equipmentCode: 'PROC-002',
          equipmentName: '加工生产线B',
          equipmentType: '生产线',
          department: 'processing',
          status: 'active',
          location: '加工车间2号',
          specifications: JSON.stringify({
            capacity: '800kg/h',
            power: '12kW',
            manufacturer: '设备制造商B'
          })
        },
        {
          id: 'EQ003',
          factoryId,
          equipmentCode: 'PACK-001',
          equipmentName: '包装机A',
          equipmentType: '包装设备',
          department: 'processing',
          status: 'active',
          location: '包装车间',
          specifications: JSON.stringify({
            capacity: '200包/min',
            power: '5kW'
          })
        },
        {
          id: 'EQ004',
          factoryId,
          equipmentCode: 'COOL-001',
          equipmentName: '冷藏设备',
          equipmentType: '冷藏',
          department: 'logistics',
          status: 'maintenance',
          location: '冷库1',
          specifications: JSON.stringify({
            capacity: '500吨',
            temperature: '-18°C'
          })
        }
      ],
      skipDuplicates: true
    });
    console.log(`   ✅ 创建了 ${equipment.count} 个设备`);

    // 2. 创建生产批次
    console.log('\n2. 创建生产批次...');
    const batches = await prisma.processingBatch.createMany({
      data: [
        {
          id: 'BATCH001',
          factoryId,
          batchNumber: 'BATCH_2025_001',
          productType: '冷冻鱼片',
          rawMaterials: JSON.stringify({
            fish: { type: '三文鱼', weight: 500, unit: 'kg' }
          }),
          startDate: new Date('2025-01-03T08:00:00'),
          endDate: new Date('2025-01-03T16:00:00'),
          status: 'completed',
          productionLine: '生产线A',
          supervisorId: 1,
          targetQuantity: 450,
          actualQuantity: 445,
          qualityGrade: 'A',
          notes: '正常生产,质量优秀'
        },
        {
          id: 'BATCH002',
          factoryId,
          batchNumber: 'BATCH_2025_002',
          productType: '冷冻虾仁',
          rawMaterials: JSON.stringify({
            shrimp: { type: '白虾', weight: 300, unit: 'kg' }
          }),
          startDate: new Date('2025-01-03T09:00:00'),
          status: 'in_progress',
          productionLine: '生产线B',
          supervisorId: 1,
          targetQuantity: 250,
          actualQuantity: 180,
          notes: '正在生产中'
        },
        {
          id: 'BATCH003',
          factoryId,
          batchNumber: 'BATCH_2025_003',
          productType: '冷冻鱼片',
          rawMaterials: JSON.stringify({
            fish: { type: '鳕鱼', weight: 400, unit: 'kg' }
          }),
          startDate: new Date('2025-01-02T08:00:00'),
          endDate: new Date('2025-01-02T17:00:00'),
          status: 'completed',
          productionLine: '生产线A',
          supervisorId: 1,
          targetQuantity: 350,
          actualQuantity: 340,
          qualityGrade: 'A',
          notes: '昨日生产'
        },
        {
          id: 'BATCH004',
          factoryId,
          batchNumber: 'BATCH_2025_004',
          productType: '冷冻虾仁',
          rawMaterials: JSON.stringify({
            shrimp: { type: '基围虾', weight: 200, unit: 'kg' }
          }),
          startDate: new Date('2025-01-03T10:00:00'),
          status: 'quality_check',
          productionLine: '生产线B',
          supervisorId: 1,
          targetQuantity: 170,
          actualQuantity: 165,
          notes: '正在质检中'
        },
        {
          id: 'BATCH005',
          factoryId,
          batchNumber: 'BATCH_2025_005',
          productType: '冷冻贝类',
          rawMaterials: JSON.stringify({
            shellfish: { type: '扇贝', weight: 150, unit: 'kg' }
          }),
          startDate: new Date('2025-01-01T08:00:00'),
          endDate: new Date('2025-01-01T15:00:00'),
          status: 'completed',
          productionLine: '生产线A',
          supervisorId: 1,
          targetQuantity: 120,
          actualQuantity: 115,
          qualityGrade: 'B',
          notes: '前天生产'
        }
      ],
      skipDuplicates: true
    });
    console.log(`   ✅ 创建了 ${batches.count} 个生产批次`);

    // 3. 创建质检记录
    console.log('\n3. 创建质检记录...');
    const inspections = await prisma.qualityInspection.createMany({
      data: [
        {
          id: 'QI001',
          batchId: 'BATCH001',
          factoryId,
          inspectorId: 1,
          inspectionType: 'final_product',
          inspectionDate: new Date('2025-01-03T16:00:00'),
          testItems: JSON.stringify({
            appearance: 'pass',
            freshness: 'pass',
            weight: 'pass',
            temperature: 'pass'
          }),
          overallResult: 'pass',
          qualityScore: 95.5,
          defectDetails: JSON.stringify([]),
          correctiveActions: '无',
          photos: JSON.stringify([])
        },
        {
          id: 'QI002',
          batchId: 'BATCH003',
          factoryId,
          inspectorId: 1,
          inspectionType: 'final_product',
          inspectionDate: new Date('2025-01-02T17:00:00'),
          testItems: JSON.stringify({
            appearance: 'pass',
            freshness: 'pass',
            weight: 'pass',
            temperature: 'pass'
          }),
          overallResult: 'pass',
          qualityScore: 92.0,
          defectDetails: JSON.stringify([]),
          correctiveActions: '无',
          photos: JSON.stringify([])
        },
        {
          id: 'QI003',
          batchId: 'BATCH004',
          factoryId,
          inspectorId: 1,
          inspectionType: 'final_product',
          inspectionDate: new Date('2025-01-03T14:30:00'),
          testItems: JSON.stringify({
            appearance: 'pass',
            freshness: 'pass',
            weight: 'conditional',
            temperature: 'pass'
          }),
          overallResult: 'conditional_pass',
          qualityScore: 85.0,
          defectDetails: JSON.stringify(['部分产品重量偏轻']),
          correctiveActions: '已挑选并重新分拣',
          photos: JSON.stringify([])
        }
      ],
      skipDuplicates: true
    });
    console.log(`   ✅ 创建了 ${inspections.count} 条质检记录`);

    // 4. 创建告警通知
    console.log('\n4. 创建告警通知...');
    const alerts = await prisma.alertNotification.createMany({
      data: [
        {
          id: 'ALERT001',
          factoryId,
          alertType: 'equipment',
          severity: 'medium',
          title: '冷藏设备温度异常',
          message: '冷库1温度上升至-15°C,已超过标准范围',
          sourceId: 'EQ004',
          sourceType: 'equipment',
          status: 'acknowledged',
          createdAt: new Date('2025-01-03T10:00:00')
        },
        {
          id: 'ALERT002',
          factoryId,
          alertType: 'quality',
          severity: 'low',
          title: '产品重量偏差',
          message: 'BATCH004批次部分产品重量低于目标值',
          sourceId: 'BATCH004',
          sourceType: 'batch',
          status: 'resolved',
          createdAt: new Date('2025-01-03T14:30:00'),
          resolvedAt: new Date('2025-01-03T15:00:00'),
          resolvedBy: 1,
          resolutionNotes: '已重新分拣,问题解决'
        },
        {
          id: 'ALERT003',
          factoryId,
          alertType: 'production',
          severity: 'critical',
          title: '生产线故障',
          message: '生产线B出现异常停机,需立即检修',
          sourceId: 'EQ002',
          sourceType: 'equipment',
          status: 'new',
          createdAt: new Date('2025-01-03T11:00:00')
        }
      ],
      skipDuplicates: true
    });
    console.log(`   ✅ 创建了 ${alerts.count} 条告警通知`);

    // 5. 创建设备监控数据
    console.log('\n5. 创建设备监控数据...');
    const monitoringData = await prisma.deviceMonitoringData.createMany({
      data: [
        {
          id: 'MON001',
          equipmentId: 'EQ001',
          factoryId,
          timestamp: new Date(),
          metrics: JSON.stringify({
            temperature: 22.5,
            humidity: 65,
            runningTime: 480,
            output: 445,
            powerConsumption: 72.5
          }),
          status: 'normal',
          alertTriggered: false,
          dataSource: 'auto'
        },
        {
          id: 'MON002',
          equipmentId: 'EQ002',
          factoryId,
          timestamp: new Date(),
          metrics: JSON.stringify({
            temperature: 23.0,
            humidity: 68,
            runningTime: 360,
            output: 180,
            powerConsumption: 43.2
          }),
          status: 'warning',
          alertTriggered: true,
          dataSource: 'auto'
        },
        {
          id: 'MON003',
          equipmentId: 'EQ004',
          factoryId,
          timestamp: new Date(),
          metrics: JSON.stringify({
            temperature: -15.0,
            humidity: 85,
            runningTime: 720,
            powerConsumption: 18.5
          }),
          status: 'warning',
          alertTriggered: true,
          dataSource: 'auto'
        }
      ],
      skipDuplicates: true
    });
    console.log(`   ✅ 创建了 ${monitoringData.count} 条监控数据`);

    // 6. 创建员工打卡记录 (根据schema调整)
    console.log('\n6. 创建员工打卡记录...');
    const timeclocks = await prisma.employeeTimeClock.createMany({
      data: [
        {
          id: 'TC001',
          factoryId,
          userId: 6, // proc_user
          clockType: 'clock_in',
          clockTime: new Date('2025-01-03T08:00:00'),
          status: 'normal',
          notes: '上班打卡'
        },
        {
          id: 'TC002',
          factoryId,
          userId: 6,
          clockType: 'clock_out',
          clockTime: new Date('2025-01-03T17:00:00'),
          status: 'normal',
          notes: '下班打卡'
        }
      ],
      skipDuplicates: true
    });
    console.log(`   ✅ 创建了 ${timeclocks.count} 条打卡记录`);

    console.log('\n✅ 核心测试数据创建完成!\n');
    console.log('📊 数据总结:');
    console.log(`   - 设备: 4 个 (已存在)`);
    console.log(`   - 生产批次: 5 个 (已存在)`);
    console.log(`   - 质检记录: 3 条 (已存在)`);
    console.log(`   - 告警通知: 3 条 (已存在)`);
    console.log(`   - 监控数据: 3 条 (已存在)`);
    console.log(`   - 打卡记录: ${timeclocks.count} 条 (新建)`);

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
