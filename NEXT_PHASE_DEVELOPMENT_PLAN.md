# 后续开发计划 - 基于正确业务逻辑

## 📊 当前状态

### ✅ 已完成的功能

1. **原材料类型管理**
   - ✅ MaterialTypeSelector 组件
   - ✅ 获取原材料类型列表 API
   - ✅ 创建原材料类型 API
   - ✅ 快捷添加功能

2. **生产计划基础框架**
   - ✅ 生产计划列表查看
   - ✅ 生产计划创建界面
   - ✅ 产品类型选择
   - ✅ 商家选择
   - ✅ 简单预估逻辑（前端）

3. **数据库模型**
   - ✅ RawMaterialType (原材料类型)
   - ✅ ProductType (产品类型)
   - ✅ MaterialProductConversion (转换率)
   - ✅ Merchant (商家)
   - ✅ ProductionPlan (生产计划)
   - ✅ MaterialConsumption (原材料消耗)
   - ✅ ShipmentRecord (出货记录)

---

## 🚧 需要实现的核心功能

### 第1优先级: 库存管理系统

#### 功能1: 原材料入库 ⭐ 最优先

**当前状态**: 界面已做好（你提到的）
**需要补充**:

##### 后端API
```javascript
// POST /api/mobile/materials/inbound
export const createMaterialInbound = async (req, res, next) => {
  // 1. 记录入库记录
  // 2. 更新库存总量 (MaterialStock表)
  // 3. 返回新的库存状态
}

// GET /api/mobile/materials/inbound
export const getMaterialInbounds = async (req, res, next) => {
  // 查询入库历史记录
}

// GET /api/mobile/materials/stock
export const getMaterialStock = async (req, res, next) => {
  // 查询当前库存状态
  // 返回: 总量、已分配、可用
}
```

##### 数据库表补充
```prisma
model MaterialInbound {
  id            String   @id @default(uuid())
  factoryId     String
  materialTypeId String
  quantity      Decimal  @db.Decimal(10, 2)
  merchantId    String?  // 供应商
  inboundDate   DateTime @db.Date
  unitPrice     Decimal? @db.Decimal(10, 2)
  totalCost     Decimal? @db.Decimal(12, 2)
  batchNumber   String?  // 入库批次号
  notes         String?  @db.Text
  createdBy     Int
  createdAt     DateTime @default(now())

  factory      Factory          @relation(...)
  materialType RawMaterialType  @relation(...)
  merchant     Merchant?        @relation(...)
  creator      User             @relation(...)
}

model MaterialStock {
  id                 String   @id @default(uuid())
  factoryId          String
  materialTypeId     String
  totalQuantity      Decimal  @db.Decimal(10, 2)  // 总库存
  reservedQuantity   Decimal  @default(0) @db.Decimal(10, 2)  // 已分配
  availableQuantity  Decimal  @db.Decimal(10, 2)  // 可用 = 总-已分配
  lastInboundDate    DateTime?
  lastUpdated        DateTime @updatedAt

  factory      Factory         @relation(...)
  materialType RawMaterialType @relation(...)

  @@unique([factoryId, materialTypeId])
}
```

---

#### 功能2: 生产计划自动计算原材料消耗

**需要实现**:

##### 后端逻辑增强
```javascript
// 创建生产计划时
export const createProductionPlan = async (req, res, next) => {
  const { productTypeId, plannedQuantity, merchantId } = req.body;

  // 1. 查询产品类型
  const productType = await prisma.productType.findUnique({
    where: { id: productTypeId },
    include: { conversionRates: true }  // 包含转换率配置
  });

  // 2. 查询转换率配置
  const conversion = await prisma.materialProductConversion.findFirst({
    where: {
      productTypeId: productTypeId,
      // 找到对应的原材料转换率
    },
    include: {
      materialType: true
    }
  });

  if (!conversion) {
    throw new Error('未配置该产品的转换率，请先配置');
  }

  // 3. 计算预估原材料消耗
  const estimatedMaterialUsage = plannedQuantity / (conversion.conversionRate / 100);

  // 考虑损耗率
  const withWastage = estimatedMaterialUsage * (1 + (conversion.wastageRate / 100 || 0));

  // 4. 检查库存是否充足
  const stock = await prisma.materialStock.findFirst({
    where: {
      factoryId,
      materialTypeId: conversion.materialTypeId
    }
  });

  if (!stock || stock.availableQuantity < withWastage) {
    return res.status(400).json({
      success: false,
      message: `库存不足。需要: ${withWastage}kg, 可用: ${stock?.availableQuantity || 0}kg`
    });
  }

  // 5. 创建生产计划
  const plan = await prisma.productionPlan.create({
    data: {
      factoryId,
      productTypeId,
      merchantId,
      plannedQuantity,
      estimatedMaterialUsage: withWastage,  // 保存预估消耗
      status: 'pending',
      createdBy: req.user.id,
      // ... 其他字段
    }
  });

  // 6. 虚拟扣减库存（保留库存）
  await prisma.materialStock.update({
    where: {
      factoryId_materialTypeId: {
        factoryId,
        materialTypeId: conversion.materialTypeId
      }
    },
    data: {
      reservedQuantity: { increment: withWastage },
      availableQuantity: { decrement: withWastage }
    }
  });

  // 7. 返回结果
  res.json(createSuccessResponse(plan, '生产计划创建成功'));
};
```

##### 前端界面增强
```typescript
// ProductionPlanManagementScreen.tsx

// 实时显示预估和库存
useEffect(() => {
  if (formData.productTypeId && formData.plannedQuantity) {
    // 调用后端API实时计算
    fetchEstimate();
  }
}, [formData.productTypeId, formData.plannedQuantity]);

const fetchEstimate = async () => {
  const res = await productionPlanApiClient.estimateMaterialUsage({
    productTypeId: formData.productTypeId,
    plannedQuantity: formData.plannedQuantity
  });

  setEstimatedUsage(res.data);
  setStockStatus(res.data.stockStatus);
};

// 显示界面
┌─────────────────────────────┐
│ 计划产量: 500 kg            │
│                             │
│ 💡 系统自动计算:            │
│ ┌─────────────────────────┐ │
│ │ 原材料: 鲈鱼            │ │
│ │ 预估消耗: 1000 kg       │ │
│ │ 转换率: 50%             │ │
│ │ 损耗率: 5%              │ │
│ │ 含损耗: 1050 kg         │ │
│ │                         │ │
│ │ 库存状态:               │ │
│ │ 总库存: 2000 kg         │ │
│ │ 已分配: 0 kg            │ │
│ │ 可用: 2000 kg           │ │
│ │ 扣除后: 950 kg ✓       │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

### 第2优先级: 每日生产记录

#### 功能3: 员工每日记录生产量

**需要实现**:

##### 数据库表
```prisma
model DailyProductionRecord {
  id                String   @id @default(uuid())
  productionPlanId  String
  productionDate    DateTime @db.Date
  dailyQuantity     Decimal  @db.Decimal(10, 2)  // 当日产量
  workHours         Decimal? @db.Decimal(4, 2)   // 工作时长
  workersCount      Int?     // 工人数量
  userId            Int      // 记录员工
  issues            Json?    // 流程问题
  notes             String?  @db.Text
  createdAt         DateTime @default(now())

  productionPlan ProductionPlan @relation(...)
  user           User           @relation(...)

  @@index([productionPlanId, productionDate])
  @@index([userId, productionDate])
}
```

##### 后端API
```javascript
// POST /api/mobile/production-plans/:id/daily-record
export const createDailyRecord = async (req, res, next) => {
  const { id } = req.params;  // 生产计划ID
  const { dailyQuantity, workHours, issues, notes } = req.body;

  // 1. 创建每日记录
  const record = await prisma.dailyProductionRecord.create({
    data: {
      productionPlanId: id,
      productionDate: new Date(),
      dailyQuantity,
      workHours,
      userId: req.user.id,
      issues,
      notes
    }
  });

  // 2. 更新生产计划的累计产量
  const plan = await prisma.productionPlan.findUnique({
    where: { id },
    include: {
      _count: {
        select: { dailyRecords: true }
      }
    }
  });

  // 计算累计产量
  const totalProduced = await prisma.dailyProductionRecord.aggregate({
    where: { productionPlanId: id },
    _sum: { dailyQuantity: true }
  });

  await prisma.productionPlan.update({
    where: { id },
    data: {
      actualQuantity: totalProduced._sum.dailyQuantity
    }
  });

  // 3. 检查是否完成
  if (totalProduced._sum.dailyQuantity >= plan.plannedQuantity) {
    // 自动标记为完成
    await prisma.productionPlan.update({
      where: { id },
      data: { status: 'completed' }
    });
  }

  res.json(createSuccessResponse(record, '每日记录保存成功'));
};

// GET /api/mobile/production-plans/:id/daily-records
export const getDailyRecords = async (req, res, next) => {
  // 查询某个生产计划的每日记录
};
```

##### 前端界面
```typescript
// DailyProductionRecordScreen.tsx (新建)

export default function DailyProductionRecordScreen() {
  return (
    <ScrollView>
      <Card>
        <Card.Title title="今日生产记录" />
        <Card.Content>
          <TextInput
            label="今日产量 (kg) *"
            keyboardType="numeric"
            value={dailyQuantity}
            onChangeText={setDailyQuantity}
          />

          <TextInput
            label="工作时长 (小时)"
            keyboardType="numeric"
            value={workHours}
            onChangeText={setWorkHours}
          />

          <Text>流程问题</Text>
          <Checkbox.Item label="原材料质量问题" />
          <Checkbox.Item label="设备故障" />
          <Checkbox.Item label="人手不足" />
          <Checkbox.Item label="无问题" />

          <TextInput
            label="备注"
            multiline
            numberOfLines={3}
          />

          <Button mode="contained" onPress={handleSubmit}>
            提交记录
          </Button>
        </Card.Content>
      </Card>

      {/* 显示历史记录 */}
      <Card>
        <Card.Title title="历史记录" />
        <Card.Content>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>日期</DataTable.Title>
              <DataTable.Title numeric>产量</DataTable.Title>
              <DataTable.Title numeric>工时</DataTable.Title>
            </DataTable.Header>

            {dailyRecords.map(record => (
              <DataTable.Row key={record.id}>
                <DataTable.Cell>{record.date}</DataTable.Cell>
                <DataTable.Cell numeric>{record.quantity}kg</DataTable.Cell>
                <DataTable.Cell numeric>{record.hours}h</DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>

          <Divider />

          <View style={styles.summary}>
            <Text>累计产量: {totalQuantity}kg</Text>
            <Text>完成率: {completionRate}%</Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
```

---

### 第3优先级: 库存盘点和差异分析

#### 功能4: 库存盘点

**需要实现**:

##### 后端API
```javascript
// POST /api/mobile/production-plans/:id/stock-check
export const stockCheck = async (req, res, next) => {
  const { id } = req.params;
  const { actualStock } = req.body;  // 实际盘点的库存

  const plan = await prisma.productionPlan.findUnique({
    where: { id },
    include: {
      productType: {
        include: {
          conversionRates: {
            include: { materialType: true }
          }
        }
      }
    }
  });

  // 1. 获取理论库存
  const materialType = plan.productType.conversionRates[0]?.materialType;
  const stock = await prisma.materialStock.findFirst({
    where: {
      factoryId: plan.factoryId,
      materialTypeId: materialType.id
    }
  });

  // 计算理论剩余
  const theoreticalRemaining = stock.totalQuantity - stock.reservedQuantity;

  // 2. 计算差异
  const difference = actualStock - theoreticalRemaining;

  // 3. 分析结果
  let analysis = {};
  if (difference < 0) {
    // 实际库存少 → 生产浪费
    analysis = {
      type: 'wastage',
      amount: Math.abs(difference),
      message: `生产过程中浪费了 ${Math.abs(difference)}kg 原材料`,
      suggestion: '建议填写缺料报告，分析浪费原因'
    };
  } else if (difference > 0) {
    // 实际库存多 → 转换率设置偏高
    analysis = {
      type: 'algorithm_error',
      amount: difference,
      message: `实际消耗少于预估 ${difference}kg`,
      suggestion: '建议调整转换率算法，当前设置偏高'
    };
  } else {
    analysis = {
      type: 'perfect',
      amount: 0,
      message: '实际库存与理论库存一致',
      suggestion: '转换率设置准确，继续保持'
    };
  }

  // 4. 记录盘点结果
  await prisma.stockCheckRecord.create({
    data: {
      productionPlanId: id,
      materialTypeId: materialType.id,
      theoreticalStock: theoreticalRemaining,
      actualStock,
      difference,
      analysisType: analysis.type,
      checkedBy: req.user.id,
      checkedAt: new Date()
    }
  });

  res.json(createSuccessResponse({
    theoretical: theoreticalRemaining,
    actual: actualStock,
    difference,
    analysis
  }, '库存盘点完成'));
};
```

##### 前端界面
```typescript
// StockCheckScreen.tsx (新建)

┌─────────────────────────────────┐
│ 库存盘点                         │
├─────────────────────────────────┤
│ 批次: #2025051                  │
│ 原材料: 鲈鱼                    │
│                                 │
│ 理论库存:                       │
│ ┌─────────────────────────────┐ │
│ │ 总库存: 2000 kg             │ │
│ │ 本批次预估: 1000 kg         │ │
│ │ 理论剩余: 1000 kg           │ │
│ └─────────────────────────────┘ │
│                                 │
│ 实际盘点 *                      │
│ ┌─────────────────────────────┐ │
│ │ 950                         │ │ ← 输入实际值
│ └─────────────────────────────┘ │
│                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ 自动分析结果                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ ┌─────────────────────────────┐ │
│ │ ⚠️ 库存差异: -50 kg         │ │
│ │                             │ │
│ │ 分析: 实际库存少于理论库存   │ │
│ │                             │ │
│ │ 结论: 生产过程中浪费了50kg  │ │
│ │       原材料                │ │
│ │                             │ │
│ │ 浪费率: 5%                  │ │
│ │                             │ │
│ │ 建议:                       │ │
│ │ 1. 填写缺料报告             │ │
│ │ 2. 调查浪费原因             │ │
│ │ 3. 加强员工培训             │ │
│ └─────────────────────────────┘ │
│                                 │
│ [取消]  [确认并生成报告]        │
└─────────────────────────────────┘
```

---

#### 功能5: 缺料报告

**需要实现**:

##### 数据库表
```prisma
model MaterialShortageReport {
  id                String   @id @default(uuid())
  productionPlanId  String
  materialTypeId    String
  shortageQuantity  Decimal  @db.Decimal(10, 2)
  shortageType      String   // wastage / spoilage / quality_issue
  reason            String   @db.Text
  improvementPlan   String?  @db.Text
  reportDate        DateTime @default(now())
  reportedBy        Int
  status            String   @default("pending")  // pending / reviewed / resolved

  productionPlan ProductionPlan  @relation(...)
  materialType   RawMaterialType @relation(...)
  reporter       User            @relation(...)
}
```

##### 后端API
```javascript
// POST /api/mobile/material-shortage-reports
export const createShortageReport = async (req, res, next) => {
  const {
    productionPlanId,
    materialTypeId,
    shortageQuantity,
    shortageType,
    reason,
    improvementPlan
  } = req.body;

  const report = await prisma.materialShortageReport.create({
    data: {
      productionPlanId,
      materialTypeId,
      shortageQuantity,
      shortageType,
      reason,
      improvementPlan,
      reportedBy: req.user.id
    }
  });

  // 记录到系统日志，用于后续分析
  await prisma.systemLog.create({
    data: {
      level: 'warn',
      category: 'material_shortage',
      message: `原材料短缺: ${shortageQuantity}kg`,
      details: { reportId: report.id },
      userId: req.user.id
    }
  });

  res.json(createSuccessResponse(report, '缺料报告已提交'));
};
```

##### 前端界面
```typescript
// MaterialShortageReportScreen.tsx (新建)

┌─────────────────────────────────┐
│ 缺料报告                         │
├─────────────────────────────────┤
│ 批次: #2025051                  │
│ 原材料: 鲈鱼                    │
│                                 │
│ 缺少数量 (kg) *                 │
│ ┌─────────────────────────────┐ │
│ │ 50                          │ │ ← 自动填入
│ └─────────────────────────────┘ │
│                                 │
│ 缺少原因 *                      │
│ ┌─────────────────────────────┐ │
│ │ ☑ 边角料浪费                │ │
│ │ ☐ 原材料腐坏                │ │
│ │ ☐ 质量不合格丢弃            │ │
│ │ ☐ 加工失误                  │ │
│ │ ☐ 其他原因                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ 详细说明 *                      │
│ ┌─────────────────────────────┐ │
│ │ 鱼头、鱼尾、鱼骨等边角料     │ │
│ │ 约占总重量5%                │ │
│ └─────────────────────────────┘ │
│                                 │
│ 改进措施                        │
│ ┌─────────────────────────────┐ │
│ │ 1. 研究边角料再利用方案     │ │
│ │ 2. 开发鱼骨、鱼头副产品     │ │
│ │ 3. 调整转换率算法(50%→48%)  │ │
│ └─────────────────────────────┘ │
│                                 │
│        [取消]  [提交报告]       │
└─────────────────────────────────┘
```

---

### 第4优先级: 数据分析和报表

#### 功能6: 综合数据分析仪表板

**需要实现**:

##### 后端分析API
```javascript
// GET /api/mobile/analytics/production-efficiency
export const getProductionEfficiency = async (req, res, next) => {
  const { startDate, endDate } = req.query;
  const factoryId = req.user.factoryId;

  // 1. 查询时间段内的生产计划
  const plans = await prisma.productionPlan.findMany({
    where: {
      factoryId,
      createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
    },
    include: {
      dailyRecords: true,
      materialConsumptions: true,
      shortageReports: true
    }
  });

  // 2. 统计分析
  const analysis = {
    // 产量分析
    totalPlanned: sum(plans, 'plannedQuantity'),
    totalActual: sum(plans, 'actualQuantity'),
    completionRate: ...,

    // 原材料分析
    totalEstimatedMaterial: sum(plans, 'estimatedMaterialUsage'),
    totalActualMaterial: sum(plans, 'actualMaterialUsed'),
    materialWastage: ...,
    wastageRate: ...,

    // 每日效率
    dailyAverages: ...,
    bestDay: ...,
    worstDay: ...,

    // 问题统计
    totalIssues: count(plans.dailyRecords, 'issues'),
    issuesByType: groupBy(...),

    // 成本分析
    totalMaterialCost: ...,
    totalWastageCost: ...,
    potentialSavings: ...
  };

  res.json(createSuccessResponse(analysis, '分析完成'));
};
```

##### 前端仪表板
```typescript
// AnalyticsDashboardScreen.tsx

┌─────────────────────────────────┐
│ 📊 生产效率分析                  │
├─────────────────────────────────┤
│ 时间: 2025-10月                 │
│                                 │
│ 产量统计                         │
│ ┌─────────────────────────────┐ │
│ │ 计划总产量: 5000 kg         │ │
│ │ 实际总产量: 4850 kg         │ │
│ │ 完成率: 97%                 │ │
│ │ 差异: -150 kg (-3%)         │ │
│ └─────────────────────────────┘ │
│                                 │
│ 原材料效率                       │
│ ┌─────────────────────────────┐ │
│ │ 预估消耗: 10000 kg          │ │
│ │ 实际消耗: 10200 kg          │ │
│ │ 浪费: 200 kg (2%)           │ │
│ │ 浪费成本: ¥800              │ │
│ └─────────────────────────────┘ │
│                                 │
│ 每日效率趋势                     │
│ ┌─────────────────────────────┐ │
│ │  kg                         │ │
│ │ 150│    ●                   │ │
│ │    │   ●●  ●                │ │
│ │ 100│  ●  ● ●●               │ │
│ │    │ ●     ● ●              │ │
│ │  50│●           ●           │ │
│ │    └─────────────────       │ │
│ │     1 5 10 15 20 25 30 日  │ │
│ └─────────────────────────────┘ │
│                                 │
│ 问题统计                         │
│ ┌─────────────────────────────┐ │
│ │ 总问题数: 15次              │ │
│ │ • 原材料问题: 5次           │ │
│ │ • 设备故障: 3次             │ │
│ │ • 人手不足: 7次             │ │
│ └─────────────────────────────┘ │
│                                 │
│ 💡 改进建议                     │
│ ┌─────────────────────────────┐ │
│ │ 1. 转换率调整: 50% → 48%    │ │
│ │ 2. 增加设备维护频率          │ │
│ │ 3. 优化排班，增加人手        │ │
│ └─────────────────────────────┘ │
│                                 │
│ [导出Excel] [打印报告]          │
└─────────────────────────────────┘
```

---

## 📅 开发时间线

### Phase 2A: 库存管理 (1周)
- [ ] 原材料入库后端API
- [ ] MaterialStock 表和逻辑
- [ ] 库存查询API
- [ ] 前端入库界面完善（已有）

### Phase 2B: 生产计划增强 (1周)
- [ ] 自动计算原材料消耗
- [ ] 虚拟扣减库存逻辑
- [ ] 库存充足检查
- [ ] 前端实时预估显示

### Phase 2C: 每日生产记录 (1周)
- [ ] DailyProductionRecord 表
- [ ] 每日记录API
- [ ] 累计产量自动计算
- [ ] 前端每日记录界面
- [ ] 历史记录查看

### Phase 2D: 盘点和分析 (1周)
- [ ] 库存盘点API
- [ ] 差异分析算法
- [ ] 缺料报告API和表
- [ ] 前端盘点界面
- [ ] 前端缺料报告界面

### Phase 2E: 数据分析 (1周)
- [ ] 综合分析API
- [ ] 趋势分析算法
- [ ] 报表生成
- [ ] 前端仪表板
- [ ] 数据可视化

---

## 🎯 立即可以做的事情

### 现在就能测试的功能

1. **原材料类型管理** ✅
   - 查看原材料列表
   - 快速添加新类型
   - 搜索和选择

2. **生产计划查看** ✅
   - 查看计划列表
   - 按状态筛选

### 需要完善才能完整测试

1. **生产计划创建** (需要完善自动计算)
2. **每日记录** (需要新建界面)
3. **库存盘点** (需要新建功能)
4. **数据分析** (需要新建仪表板)

---

## 🎬 完整实例演示（基于当前可用功能）

### 测试步骤

```bash
# 1. 启动后端
cd backend
npm run dev

# 2. 启动前端
cd frontend/CretasFoodTrace
npx expo start

# 3. 登录测试
用户: super_admin
密码: 123456

# 4. 测试MaterialTypeSelector
导航: 管理 → 生产计划管理 → 新建
点击产品类型 → 可以看到MaterialTypeSelector

# 5. 测试快捷添加
滚动到底部 → 点击"➕ 添加新原材料类型"
输入: 石斑鱼
分类: 鱼类
保存 → 验证是否成功
```

---

## 📝 总结

### 已完成 ✅
- MaterialTypeSelector 组件及快捷添加功能
- 原材料类型管理API
- 生产计划基础框架

### 待开发 🚧
- 库存管理系统（入库、查询、更新）
- 生产计划自动计算原材料消耗
- 每日生产记录功能
- 库存盘点和差异分析
- 缺料报告功能
- 数据分析仪表板

### 核心价值 🎯
通过这套系统可以:
1. 精准追踪库存
2. 量化生产浪费
3. 优化转换率算法
4. 降低生产成本
5. 提供决策依据

---

**下一步建议**: 优先实现"库存管理系统"和"生产计划自动计算"，这两个是核心基础功能。
