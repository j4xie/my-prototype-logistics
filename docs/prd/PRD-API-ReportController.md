# PRD-API-ReportController

**控制器**: ReportController
**基础路径**: `/api/mobile/{factoryId}/reports`
**功能**: 报表统计管理
**端点数量**: 20个
**文档版本**: v1.0.0
**最后更新**: 2025-01-20

---

## 📋 目录

- [控制器概览](#控制器概览)
- [API端点列表](#api端点列表)
- [详细API文档](#详细api文档)
  - [1. 仪表盘统计](#1-仪表盘统计)
  - [2. 基础报表](#2-基础报表)
  - [3. 分析报表](#3-分析报表)
  - [4. 高级功能](#4-高级功能)
  - [5. 导出功能](#5-导出功能)
  - [6. 自定义报表](#6-自定义报表)
- [前端集成指南](#前端集成指南)
- [业务规则](#业务规则)
- [错误处理](#错误处理)

---

## 控制器概览

### 核心功能
ReportController提供**全方位的报表统计与分析功能**，支持7大类基础报表、4种高级分析、实时数据监控、多格式导出等企业级报表需求。

### 技术特点
- **多维度统计**: 生产、库存、财务、质量、设备、人员、销售7大维度
- **智能分析**: 成本分析、效率分析、趋势分析、异常检测
- **实时数据**: 工厂运营实时监控
- **灵活导出**: Excel、PDF多格式支持
- **预测能力**: 基于历史数据的预测分析
- **自定义报表**: 支持自定义参数生成报表

### 业务价值
- 为管理层提供全面的经营数据分析
- 支持数据驱动的决策制定
- 实时监控工厂运营状态
- 发现异常和优化机会
- 预测未来趋势

---

## API端点列表

### 1. 仪表盘统计 (1个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| GET | `/dashboard` | 获取综合仪表盘统计 | 工厂用户 |

### 2. 基础报表 (7个)
| 方法 | 路径 | 功能 | 参数 |
|------|------|------|------|
| GET | `/production` | 生产报表 | startDate, endDate |
| GET | `/inventory` | 库存报表 | date (可选) |
| GET | `/finance` | 财务报表 | startDate, endDate |
| GET | `/quality` | 质量报表 | startDate, endDate |
| GET | `/equipment` | 设备报表 | date (可选) |
| GET | `/personnel` | 人员报表 | date (可选) |
| GET | `/sales` | 销售报表 | startDate, endDate |

### 3. 分析报表 (4个)
| 方法 | 路径 | 功能 | 参数 |
|------|------|------|------|
| GET | `/cost-analysis` | 成本分析 | startDate, endDate |
| GET | `/efficiency-analysis` | 效率分析 | startDate, endDate |
| GET | `/trend-analysis` | 趋势分析 | type, period |
| GET | `/period-comparison` | 周期对比 | period1Start/End, period2Start/End |

### 4. 高级功能 (4个)
| 方法 | 路径 | 功能 | 参数 |
|------|------|------|------|
| GET | `/kpi` | KPI指标 | date (可选) |
| GET | `/forecast` | 预测报表 | type, days |
| GET | `/anomalies` | 异常报告 | startDate, endDate (可选) |
| GET | `/realtime` | 实时数据 | - |

### 5. 导出功能 (2个)
| 方法 | 路径 | 功能 | 格式 |
|------|------|------|------|
| GET | `/export/excel` | Excel导出 | .xlsx |
| GET | `/export/pdf` | PDF导出 | .pdf |

### 6. 自定义报表 (1个)
| 方法 | 路径 | 功能 | 参数 |
|------|------|------|------|
| POST | `/custom` | 自定义报表 | 动态参数 |

---

## 详细API文档

## 1. 仪表盘统计

### 1.1 获取报表仪表盘统计

**接口定义**
```
GET /api/mobile/{factoryId}/reports/dashboard
```

**功能描述**
获取工厂的综合仪表盘统计数据，包含7大维度的实时统计、近期趋势、告警信息。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应数据结构**
```typescript
interface DashboardStatistics {
  // 生产统计
  productionStats: {
    totalPlans: number;         // 总生产计划数
    activePlans: number;        // 进行中计划
    completedPlans: number;     // 已完成计划
    totalOutput: number;        // 总产量
    monthlyOutput: number;      // 月度产量
    completionRate: number;     // 完成率 (0.0-1.0)
    efficiency: number;         // 生产效率
  };

  // 库存统计
  inventoryStats: {
    totalMaterials: number;     // 物料种类数
    totalBatches: number;       // 批次总数
    totalValue: number;         // 库存总价值
    expiringBatches: number;    // 即将过期批次
    expiredBatches: number;     // 已过期批次
    lowStockItems: number;      // 低库存物料
    turnoverRate: number;       // 周转率
  };

  // 财务统计
  financeStats: {
    totalRevenue: number;       // 总收入
    totalCost: number;          // 总成本
    totalProfit: number;        // 总利润
    monthlyRevenue: number;     // 月度收入
    monthlyCost: number;        // 月度成本
    monthlyProfit: number;      // 月度利润
    profitMargin: number;       // 利润率
    accountsReceivable: number; // 应收账款
    accountsPayable: number;    // 应付账款
  };

  // 人员统计
  personnelStats: {
    totalEmployees: number;     // 总员工数
    activeEmployees: number;    // 在职员工
    departmentCount: number;    // 部门数
    totalSalary: number;        // 总薪资
    averageSalary: number;      // 平均薪资
    attendanceRate: number;     // 出勤率
    todayPresent: number;       // 今日到岗
    todayAbsent: number;        // 今日缺勤
  };

  // 设备统计
  equipmentStats: {
    totalEquipment: number;     // 设备总数
    runningEquipment: number;   // 运行中设备
    idleEquipment: number;      // 闲置设备
    maintenanceEquipment: number; // 维护中设备
    utilizationRate: number;    // 利用率
    availability: number;       // 可用率
    needsMaintenance: number;   // 需要维护的设备
  };

  // 质量统计
  qualityStats: {
    totalProduction: number;    // 总产量
    qualifiedProduction: number;// 合格产量
    defectiveProduction: number;// 不合格产量
    qualityRate: number;        // 合格率
    qualityIssues: number;      // 质量问题数
    resolvedIssues: number;     // 已解决问题
    firstPassRate: number;      // 一次通过率
  };

  // 趋势统计
  trendStats: {
    dailyProduction: DailyTrend[];  // 日产量趋势
    dailyRevenue: DailyTrend[];     // 日收入趋势
    dailyCost: DailyTrend[];        // 日成本趋势
    dailyQuality: DailyTrend[];     // 日质量趋势
    monthlyComparison: {            // 月度对比
      [key: string]: number;
    };
  };

  // 告警信息
  alerts: Array<{
    type: string;       // 告警类型
    level: string;      // 告警级别: info/warning/error/critical
    message: string;    // 告警消息
    targetId: string;   // 目标ID
    targetName: string; // 目标名称
    date: string;       // 告警日期
  }>;
}

interface DailyTrend {
  date: string;         // 日期
  value: number;        // 数值
  changeRate: number;   // 变化率
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "productionStats": {
      "totalPlans": 150,
      "activePlans": 25,
      "completedPlans": 125,
      "totalOutput": 50000.00,
      "monthlyOutput": 8500.00,
      "completionRate": 0.833,
      "efficiency": 0.92
    },
    "inventoryStats": {
      "totalMaterials": 85,
      "totalBatches": 320,
      "totalValue": 1250000.00,
      "expiringBatches": 5,
      "expiredBatches": 2,
      "lowStockItems": 8,
      "turnoverRate": 4.5
    },
    "financeStats": {
      "totalRevenue": 5000000.00,
      "totalCost": 3200000.00,
      "totalProfit": 1800000.00,
      "monthlyRevenue": 850000.00,
      "monthlyCost": 520000.00,
      "monthlyProfit": 330000.00,
      "profitMargin": 0.36,
      "accountsReceivable": 450000.00,
      "accountsPayable": 280000.00
    },
    "personnelStats": {
      "totalEmployees": 120,
      "activeEmployees": 115,
      "departmentCount": 8,
      "totalSalary": 650000.00,
      "averageSalary": 5652.17,
      "attendanceRate": 0.96,
      "todayPresent": 110,
      "todayAbsent": 5
    },
    "equipmentStats": {
      "totalEquipment": 45,
      "runningEquipment": 38,
      "idleEquipment": 5,
      "maintenanceEquipment": 2,
      "utilizationRate": 0.844,
      "availability": 0.956,
      "needsMaintenance": 3
    },
    "qualityStats": {
      "totalProduction": 50000.00,
      "qualifiedProduction": 48500.00,
      "defectiveProduction": 1500.00,
      "qualityRate": 0.97,
      "qualityIssues": 15,
      "resolvedIssues": 12,
      "firstPassRate": 0.94
    },
    "trendStats": {
      "dailyProduction": [
        {
          "date": "2025-01-15",
          "value": 1200.00,
          "changeRate": 0.05
        },
        {
          "date": "2025-01-16",
          "value": 1250.00,
          "changeRate": 0.042
        }
      ],
      "dailyRevenue": [...],
      "dailyCost": [...],
      "dailyQuality": [...],
      "monthlyComparison": {
        "2024-12": 45000.00,
        "2025-01": 50000.00
      }
    },
    "alerts": [
      {
        "type": "inventory",
        "level": "warning",
        "message": "原料A库存不足",
        "targetId": "MAT_001",
        "targetName": "原料A",
        "date": "2025-01-20"
      },
      {
        "type": "equipment",
        "level": "error",
        "message": "设备E01需要紧急维护",
        "targetId": "EQP_001",
        "targetName": "设备E01",
        "date": "2025-01-20"
      }
    ]
  },
  "timestamp": "2025-01-20T10:30:00"
}
```

**业务规则**
- 统计数据基于工厂当前所有有效数据
- 月度数据默认为当前自然月
- 趋势数据默认返回最近7天
- 告警信息按级别排序，最高级别在前
- 财务数据精确到小数点后2位

---

## 2. 基础报表

### 2.1 生产报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/production?startDate={startDate}&endDate={endDate}
```

**功能描述**
获取指定日期范围的生产报表，包含生产计划执行情况、产量统计、效率分析等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| startDate | LocalDate | Query | 是 | 开始日期 (YYYY-MM-DD) |
| endDate | LocalDate | Query | 是 | 结束日期 (YYYY-MM-DD) |

**响应数据结构**
```typescript
interface ProductionReport {
  // 总体概况
  summary: {
    totalPlans: number;           // 总计划数
    completedPlans: number;       // 完成计划数
    inProgressPlans: number;      // 进行中计划
    cancelledPlans: number;       // 取消计划
    totalPlannedOutput: number;   // 计划总产量
    totalActualOutput: number;    // 实际总产量
    completionRate: number;       // 完成率
    outputAchievementRate: number;// 产量达成率
  };

  // 按产品类型统计
  byProductType: Array<{
    productTypeId: string;
    productTypeName: string;
    plannedQuantity: number;
    actualQuantity: number;
    achievementRate: number;
    planCount: number;
  }>;

  // 按时间统计 (日/周/月)
  byTimePeriod: Array<{
    period: string;             // 时间周期
    outputQuantity: number;     // 产量
    planCount: number;          // 计划数
    efficiency: number;         // 效率
  }>;

  // 生产效率分析
  efficiency: {
    averageEfficiency: number;   // 平均效率
    bestDay: {
      date: string;
      efficiency: number;
    };
    worstDay: {
      date: string;
      efficiency: number;
    };
  };

  // Top产品
  topProducts: Array<{
    productTypeId: string;
    productTypeName: string;
    totalOutput: number;
    rank: number;
  }>;
}
```

**业务规则**
- 日期范围不能超过90天
- 时间周期根据日期范围自动选择：≤7天为日，≤30天为周，>30天为月
- 效率 = 实际产量 / 计划产量
- Top产品默认返回前10名

---

### 2.2 库存报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/inventory?date={date}
```

**功能描述**
获取指定日期的库存报表，包含库存汇总、库龄分析、周转率等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| date | LocalDate | Query | 否 | 报表日期，默认今天 |

**响应数据结构**
```typescript
interface InventoryReport {
  // 库存汇总
  summary: {
    totalMaterialTypes: number;   // 物料种类数
    totalBatches: number;         // 批次总数
    totalQuantity: number;        // 总库存数量
    totalValue: number;           // 总库存价值
    averageAge: number;           // 平均库龄(天)
  };

  // 按物料类型统计
  byMaterialType: Array<{
    materialTypeId: string;
    materialTypeName: string;
    batchCount: number;
    totalQuantity: number;
    totalValue: number;
    oldestBatchAge: number;
  }>;

  // 库龄分析
  ageAnalysis: {
    fresh: { count: number; value: number };      // 0-7天
    normal: { count: number; value: number };     // 8-30天
    aging: { count: number; value: number };      // 31-90天
    old: { count: number; value: number };        // >90天
  };

  // 库存预警
  warnings: {
    expiringSoon: Array<{           // 即将过期 (<7天)
      batchNumber: string;
      materialTypeName: string;
      quantity: number;
      expiryDate: string;
      daysUntilExpiry: number;
    }>;
    expired: Array<{                // 已过期
      batchNumber: string;
      materialTypeName: string;
      quantity: number;
      expiryDate: string;
    }>;
    lowStock: Array<{               // 低库存
      materialTypeId: string;
      materialTypeName: string;
      currentQuantity: number;
      minimumQuantity: number;
      deficit: number;
    }>;
  };

  // 周转率分析
  turnover: {
    overall: number;                // 整体周转率
    byCategory: Array<{
      category: string;
      turnoverRate: number;
    }>;
  };
}
```

**业务规则**
- 库龄从入库日期开始计算
- 周转率 = 出库总量 / 平均库存量 (30天)
- 低库存: 当前库存 < 最小库存要求
- 即将过期: 剩余有效期 < 7天

---

### 2.3 财务报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/finance?startDate={startDate}&endDate={endDate}
```

**功能描述**
获取指定日期范围的财务报表，包含收入、成本、利润分析等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| startDate | LocalDate | Query | 是 | 开始日期 |
| endDate | LocalDate | Query | 是 | 结束日期 |

**响应数据结构**
```typescript
interface FinanceReport {
  // 总体概况
  summary: {
    totalRevenue: number;       // 总收入
    totalCost: number;          // 总成本
    totalProfit: number;        // 总利润
    profitMargin: number;       // 利润率
    roi: number;                // 投资回报率
  };

  // 收入分析
  revenue: {
    productSales: number;       // 产品销售收入
    otherIncome: number;        // 其他收入
    byProductType: Array<{
      productTypeId: string;
      productTypeName: string;
      revenue: number;
      percentage: number;
    }>;
    byCustomer: Array<{
      customerId: string;
      customerName: string;
      revenue: number;
      percentage: number;
    }>;
  };

  // 成本分析
  cost: {
    rawMaterials: number;       // 原材料成本
    labor: number;              // 人工成本
    equipment: number;          // 设备成本
    overhead: number;           // 管理费用
    other: number;              // 其他成本
    breakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };

  // 利润分析
  profit: {
    grossProfit: number;        // 毛利润
    operatingProfit: number;    // 营业利润
    netProfit: number;          // 净利润
    grossMargin: number;        // 毛利率
    operatingMargin: number;    // 营业利润率
    netMargin: number;          // 净利率
  };

  // 应收应付
  accountsManagement: {
    accountsReceivable: number; // 应收账款
    accountsPayable: number;    // 应付账款
    netCashFlow: number;        // 净现金流
    overdueReceivables: number; // 逾期应收
    overduePayables: number;    // 逾期应付
  };

  // 趋势数据
  trend: Array<{
    date: string;
    revenue: number;
    cost: number;
    profit: number;
  }>;
}
```

**业务规则**
- 所有金额保留2位小数
- 利润率 = (总利润 / 总收入) × 100%
- ROI = (净利润 / 总成本) × 100%
- 按收入金额降序排列

---

### 2.4 质量报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/quality?startDate={startDate}&endDate={endDate}
```

**功能描述**
获取指定日期范围的质量报表，包含质检记录、合格率、不良品分析等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| startDate | LocalDate | Query | 是 | 开始日期 |
| endDate | LocalDate | Query | 是 | 结束日期 |

**响应数据结构**
```typescript
interface QualityReport {
  // 总体概况
  summary: {
    totalInspections: number;     // 总质检次数
    totalProduction: number;      // 总产量
    qualifiedQuantity: number;    // 合格数量
    defectiveQuantity: number;    // 不合格数量
    qualityRate: number;          // 合格率
    firstPassRate: number;        // 一次通过率
    defectRate: number;           // 缺陷率
  };

  // 按产品类型统计
  byProductType: Array<{
    productTypeId: string;
    productTypeName: string;
    inspectionCount: number;
    qualifiedCount: number;
    defectiveCount: number;
    qualityRate: number;
  }>;

  // 不良品分析
  defectAnalysis: {
    topDefectTypes: Array<{
      defectType: string;
      defectName: string;
      count: number;
      percentage: number;
    }>;
    bySeverity: {
      critical: number;           // 严重
      major: number;              // 主要
      minor: number;              // 次要
    };
  };

  // 质检员绩效
  inspectorPerformance: Array<{
    inspectorId: string;
    inspectorName: string;
    inspectionCount: number;
    avgInspectionTime: number;    // 平均质检时间(分钟)
    findDefectRate: number;       // 发现缺陷率
  }>;

  // 趋势分析
  trend: Array<{
    date: string;
    inspectionCount: number;
    qualityRate: number;
    defectiveCount: number;
  }>;

  // 质量改进建议
  improvements: Array<{
    area: string;                 // 改进领域
    priority: string;             // 优先级: high/medium/low
    description: string;          // 描述
    expectedImpact: number;       // 预期影响(质量率提升)
  }>;
}
```

**业务规则**
- 合格率 = (合格数量 / 总产量) × 100%
- 一次通过率 = (一次质检合格数 / 总质检数) × 100%
- 缺陷率 = (不合格数量 / 总产量) × 100%
- Top缺陷类型按出现频次排序

---

### 2.5 设备报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/equipment?date={date}
```

**功能描述**
获取设备运行统计报表，包含设备状态、利用率、维护记录等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| date | LocalDate | Query | 否 | 报表日期，默认今天 |

**响应数据结构**
```typescript
interface EquipmentReport {
  // 设备概况
  summary: {
    totalEquipment: number;         // 设备总数
    runningCount: number;           // 运行中
    idleCount: number;              // 闲置
    maintenanceCount: number;       // 维护中
    brokenCount: number;            // 故障
    utilizationRate: number;        // 利用率
    availability: number;           // 可用率
  };

  // 设备状态详情
  equipmentList: Array<{
    equipmentId: string;
    equipmentName: string;
    equipmentCode: string;
    status: string;                 // running/idle/maintenance/broken
    runningHours: number;           // 运行时长(小时)
    utilizationRate: number;        // 利用率
    lastMaintenanceDate: string;    // 上次维护日期
    nextMaintenanceDate: string;    // 下次维护日期
  }>;

  // 维护记录
  maintenance: {
    completed: number;              // 已完成维护
    scheduled: number;              // 计划维护
    overdue: number;                // 逾期维护
    recentRecords: Array<{
      equipmentId: string;
      equipmentName: string;
      maintenanceType: string;
      completedDate: string;
      cost: number;
    }>;
  };

  // 故障分析
  failures: {
    totalFailures: number;
    mtbf: number;                   // 平均故障间隔时间(小时)
    mttr: number;                   // 平均修复时间(小时)
    byEquipment: Array<{
      equipmentId: string;
      equipmentName: string;
      failureCount: number;
      downtimeHours: number;
    }>;
  };

  // 需要关注的设备
  alerts: Array<{
    equipmentId: string;
    equipmentName: string;
    alertType: string;              // overdue_maintenance/high_usage/frequent_failure
    description: string;
    priority: string;
  }>;
}
```

**业务规则**
- 利用率 = (运行时间 / 总时间) × 100%
- 可用率 = ((总时间 - 故障时间) / 总时间) × 100%
- MTBF (Mean Time Between Failures): 平均故障间隔时间
- MTTR (Mean Time To Repair): 平均修复时间

---

### 2.6 人员报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/personnel?date={date}
```

**功能描述**
获取人员统计报表，包含人员概况、考勤统计、薪资分析等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| date | LocalDate | Query | 否 | 报表日期，默认今天 |

**响应数据结构**
```typescript
interface PersonnelReport {
  // 人员概况
  summary: {
    totalEmployees: number;       // 总员工数
    activeEmployees: number;      // 在职员工
    departmentCount: number;      // 部门数
    newHires: number;             // 新入职(本月)
    resignations: number;         // 离职(本月)
    turnoverRate: number;         // 离职率
  };

  // 按部门统计
  byDepartment: Array<{
    departmentId: string;
    departmentName: string;
    employeeCount: number;
    attendanceRate: number;       // 出勤率
    avgSalary: number;            // 平均薪资
  }>;

  // 考勤统计
  attendance: {
    todayPresent: number;         // 今日到岗
    todayAbsent: number;          // 今日缺勤
    todayLate: number;            // 今日迟到
    todayEarlyLeave: number;      // 今日早退
    monthlyAttendanceRate: number;// 月度出勤率
    topAttenders: Array<{         // 全勤员工
      userId: number;
      userName: string;
      presentDays: number;
    }>;
  };

  // 薪资分析
  salary: {
    totalSalary: number;          // 总薪资
    averageSalary: number;        // 平均薪资
    medianSalary: number;         // 中位数薪资
    byRange: Array<{
      range: string;              // 薪资区间
      count: number;
      percentage: number;
    }>;
    byDepartment: Array<{
      departmentName: string;
      totalSalary: number;
      avgSalary: number;
    }>;
  };

  // 工作效率
  efficiency: {
    avgWorkHours: number;         // 平均工时
    productivityScore: number;    // 生产力评分
    topPerformers: Array<{
      userId: number;
      userName: string;
      departmentName: string;
      score: number;
    }>;
  };
}
```

**业务规则**
- 离职率 = (离职人数 / 平均在职人数) × 100%
- 出勤率 = (实际出勤天数 / 应出勤天数) × 100%
- 薪资数据脱敏处理，仅显示统计值

---

### 2.7 销售报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/sales?startDate={startDate}&endDate={endDate}
```

**功能描述**
获取指定日期范围的销售报表，包含销售额、客户分析、产品销售排名等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| startDate | LocalDate | Query | 是 | 开始日期 |
| endDate | LocalDate | Query | 是 | 结束日期 |

**响应数据结构**
```typescript
interface SalesReport {
  // 销售概况
  summary: {
    totalOrders: number;          // 总订单数
    totalSales: number;           // 总销售额
    totalQuantity: number;        // 总销售数量
    averageOrderValue: number;    // 平均订单金额
    completedOrders: number;      // 已完成订单
    pendingOrders: number;        // 待处理订单
    cancelledOrders: number;      // 取消订单
    completionRate: number;       // 订单完成率
  };

  // 按产品类型统计
  byProductType: Array<{
    productTypeId: string;
    productTypeName: string;
    orderCount: number;
    totalSales: number;
    totalQuantity: number;
    percentage: number;           // 销售额占比
  }>;

  // 客户分析
  customers: {
    totalCustomers: number;       // 总客户数
    newCustomers: number;         // 新客户
    repeatCustomers: number;      // 回头客
    topCustomers: Array<{
      customerId: string;
      customerName: string;
      orderCount: number;
      totalSales: number;
      avgOrderValue: number;
    }>;
  };

  // 销售趋势
  trend: Array<{
    date: string;
    orderCount: number;
    salesAmount: number;
    avgOrderValue: number;
  }>;

  // 区域分析
  byRegion: Array<{
    region: string;
    orderCount: number;
    totalSales: number;
    percentage: number;
  }>;

  // 销售渠道
  byChannel: Array<{
    channel: string;              // online/offline/dealer
    orderCount: number;
    totalSales: number;
    percentage: number;
  }>;
}
```

**业务规则**
- 销售额包含已完成和进行中的订单
- 平均订单金额 = 总销售额 / 订单数
- 订单完成率 = (已完成订单 / 总订单) × 100%
- Top客户按销售额排序，返回前20名

---

## 3. 分析报表

### 3.1 成本分析报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/cost-analysis?startDate={startDate}&endDate={endDate}
```

**功能描述**
深度分析指定日期范围的成本构成，包含原材料、人工、设备、管理费用等多维度成本分析。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| startDate | LocalDate | Query | 是 | 开始日期 |
| endDate | LocalDate | Query | 是 | 结束日期 |

**响应数据结构**
```typescript
interface CostAnalysisReport {
  // 总体成本
  summary: {
    totalCost: number;            // 总成本
    unitCost: number;             // 单位成本
    costPerDay: number;           // 日均成本
    budgetUsage: number;          // 预算使用率
  };

  // 成本构成
  breakdown: {
    rawMaterials: {               // 原材料成本
      amount: number;
      percentage: number;
      topItems: Array<{
        materialId: string;
        materialName: string;
        cost: number;
        percentage: number;
      }>;
    };
    labor: {                      // 人工成本
      amount: number;
      percentage: number;
      breakdown: {
        salary: number;
        overtime: number;
        benefits: number;
      };
    };
    equipment: {                  // 设备成本
      amount: number;
      percentage: number;
      breakdown: {
        depreciation: number;     // 折旧
        maintenance: number;      // 维护
        energy: number;           // 能耗
      };
    };
    overhead: {                   // 管理费用
      amount: number;
      percentage: number;
      breakdown: {
        utilities: number;        // 水电费
        rent: number;             // 租金
        administrative: number;   // 行政费用
        other: number;
      };
    };
  };

  // 成本趋势
  trend: Array<{
    date: string;
    totalCost: number;
    rawMaterialsCost: number;
    laborCost: number;
    equipmentCost: number;
    overheadCost: number;
  }>;

  // 成本异常
  anomalies: Array<{
    date: string;
    category: string;
    amount: number;
    deviation: number;            // 偏离正常值百分比
    reason: string;
  }>;

  // 成本优化建议
  optimizations: Array<{
    category: string;
    currentCost: number;
    targetCost: number;
    potentialSaving: number;
    recommendation: string;
    priority: string;
  }>;
}
```

**业务规则**
- 单位成本 = 总成本 / 总产量
- 预算使用率 = (实际成本 / 预算成本) × 100%
- 成本异常定义: 偏离平均值 > 20%
- 优化建议按潜在节省金额排序

---

### 3.2 效率分析报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/efficiency-analysis?startDate={startDate}&endDate={endDate}
```

**功能描述**
分析生产效率指标，包含人员效率、设备效率、生产周期等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| startDate | LocalDate | Query | 是 | 开始日期 |
| endDate | LocalDate | Query | 是 | 结束日期 |

**响应数据结构**
```typescript
interface EfficiencyAnalysisReport {
  // 综合效率指标
  overall: {
    oee: number;                  // 设备综合效率 (Overall Equipment Effectiveness)
    productivity: number;         // 生产力
    throughput: number;           // 产出率
    cycleTime: number;            // 平均生产周期(小时)
    leadTime: number;             // 平均交付周期(天)
  };

  // 人员效率
  laborEfficiency: {
    outputPerEmployee: number;    // 人均产量
    outputPerHour: number;        // 工时产量
    laborProductivity: number;    // 劳动生产率
    topPerformers: Array<{
      userId: number;
      userName: string;
      output: number;
      efficiency: number;
    }>;
  };

  // 设备效率
  equipmentEfficiency: {
    avgUtilizationRate: number;   // 平均利用率
    avgAvailability: number;      // 平均可用率
    avgPerformance: number;       // 平均性能
    byEquipment: Array<{
      equipmentId: string;
      equipmentName: string;
      utilizationRate: number;
      availability: number;
      performance: number;
      oee: number;
    }>;
  };

  // 生产周期分析
  cycleTimeAnalysis: {
    avgCycleTime: number;
    shortestCycle: number;
    longestCycle: number;
    byProductType: Array<{
      productTypeId: string;
      productTypeName: string;
      avgCycleTime: number;
      standardCycleTime: number;
      variance: number;
    }>;
  };

  // 瓶颈分析
  bottlenecks: Array<{
    stage: string;                // 生产阶段
    avgWaitTime: number;          // 平均等待时间
    utilizationRate: number;
    impactScore: number;          // 影响评分
    recommendation: string;
  }>;

  // 效率趋势
  trend: Array<{
    date: string;
    oee: number;
    productivity: number;
    cycleTime: number;
  }>;
}
```

**业务规则**
- OEE = 可用率 × 性能率 × 质量率
- 生产力 = 实际产量 / 标准产量
- 周期时间: 从开始到完成的总时间
- 瓶颈: 利用率 > 85% 的环节

---

### 3.3 趋势分析报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/trend-analysis?type={type}&period={period}
```

**功能描述**
分析生产经营趋势，支持多种分析类型和时间周期。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| type | String | Query | 是 | 分析类型: production/revenue/cost/quality/efficiency |
| period | Integer | Query | 是 | 时间周期(天): 7/30/90/365 |

**响应数据结构**
```typescript
interface TrendAnalysisReport {
  // 趋势数据
  trendData: Array<{
    date: string;
    value: number;
    movingAverage: number;        // 移动平均
    changeRate: number;           // 变化率
  }>;

  // 统计分析
  statistics: {
    average: number;              // 平均值
    maximum: number;              // 最大值
    minimum: number;              // 最小值
    median: number;               // 中位数
    standardDeviation: number;    // 标准差
    variance: number;             // 方差
  };

  // 趋势特征
  characteristics: {
    overallTrend: string;         // overall: increasing/decreasing/stable
    volatility: string;           // high/medium/low
    seasonality: boolean;         // 是否有季节性
    cycleLength: number;          // 周期长度(天)
  };

  // 关键点
  keyPoints: {
    peaks: Array<{                // 峰值点
      date: string;
      value: number;
      reason: string;
    }>;
    valleys: Array<{              // 谷值点
      date: string;
      value: number;
      reason: string;
    }>;
    inflectionPoints: Array<{     // 拐点
      date: string;
      value: number;
      change: string;
    }>;
  };

  // 预测
  forecast: {
    nextPeriod: {
      predictedValue: number;
      confidenceInterval: {
        lower: number;
        upper: number;
      };
      confidence: number;         // 置信度
    };
  };
}
```

**业务规则**
- 移动平均: 7天移动平均
- 趋势判断: 基于线性回归斜率
- 波动性: 基于标准差/平均值比率
- 预测: 基于历史数据的时间序列分析

---

### 3.4 周期对比报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/period-comparison?period1Start={p1Start}&period1End={p1End}&period2Start={p2Start}&period2End={p2End}
```

**功能描述**
对比两个时间周期的数据，分析变化和差异。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| period1Start | LocalDate | Query | 是 | 期间1开始日期 |
| period1End | LocalDate | Query | 是 | 期间1结束日期 |
| period2Start | LocalDate | Query | 是 | 期间2开始日期 |
| period2End | LocalDate | Query | 是 | 期间2结束日期 |

**响应数据结构**
```typescript
interface PeriodComparisonReport {
  // 期间信息
  periods: {
    period1: { start: string; end: string; days: number };
    period2: { start: string; end: string; days: number };
  };

  // 生产对比
  production: {
    period1: { output: number; planCount: number; efficiency: number };
    period2: { output: number; planCount: number; efficiency: number };
    changes: {
      outputChange: number;       // 绝对变化
      outputChangeRate: number;   // 变化率
      efficiencyChange: number;
    };
  };

  // 财务对比
  finance: {
    period1: { revenue: number; cost: number; profit: number };
    period2: { revenue: number; cost: number; profit: number };
    changes: {
      revenueChangeRate: number;
      costChangeRate: number;
      profitChangeRate: number;
    };
  };

  // 质量对比
  quality: {
    period1: { qualityRate: number; defectCount: number };
    period2: { qualityRate: number; defectCount: number };
    changes: {
      qualityRateChange: number;
      defectCountChange: number;
    };
  };

  // 人员对比
  personnel: {
    period1: { employeeCount: number; attendanceRate: number };
    period2: { employeeCount: number; attendanceRate: number };
    changes: {
      employeeCountChange: number;
      attendanceRateChange: number;
    };
  };

  // 设备对比
  equipment: {
    period1: { utilizationRate: number; availability: number };
    period2: { utilizationRate: number; availability: number };
    changes: {
      utilizationRateChange: number;
      availabilityChange: number;
    };
  };

  // 综合评估
  assessment: {
    overallChange: string;        // improved/declined/stable
    keyImprovements: string[];    // 主要改进点
    keyDeclines: string[];        // 主要下降点
    recommendations: string[];    // 建议
  };
}
```

**业务规则**
- 两个期间的天数应相近(差异 < 20%)
- 变化率 = ((期间2 - 期间1) / 期间1) × 100%
- 改进/下降判断阈值: ±5%
- 综合评估基于加权评分

---

## 4. 高级功能

### 4.1 KPI指标

**接口定义**
```
GET /api/mobile/{factoryId}/reports/kpi?date={date}
```

**功能描述**
获取关键绩效指标(Key Performance Indicators)，涵盖生产、财务、质量、人员等核心指标。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| date | LocalDate | Query | 否 | 指标日期，默认今天 |

**响应数据结构**
```typescript
interface KPIMetrics {
  // 生产KPI
  production: {
    outputTarget: { value: number; target: number; achievement: number };
    efficiency: { value: number; target: number; status: string };
    oee: { value: number; target: number; status: string };
    cycleTime: { value: number; target: number; status: string };
  };

  // 财务KPI
  finance: {
    revenue: { value: number; target: number; achievement: number };
    profitMargin: { value: number; target: number; status: string };
    roi: { value: number; target: number; status: string };
    costPerUnit: { value: number; target: number; status: string };
  };

  // 质量KPI
  quality: {
    qualityRate: { value: number; target: number; status: string };
    firstPassRate: { value: number; target: number; status: string };
    defectRate: { value: number; target: number; status: string };
    customerComplaintRate: { value: number; target: number; status: string };
  };

  // 人员KPI
  personnel: {
    attendanceRate: { value: number; target: number; status: string };
    turnoverRate: { value: number; target: number; status: string };
    productivityPerEmployee: { value: number; target: number; status: string };
    trainingCompletion: { value: number; target: number; status: string };
  };

  // 库存KPI
  inventory: {
    turnoverRate: { value: number; target: number; status: string };
    stockAccuracy: { value: number; target: number; status: string };
    expiryRate: { value: number; target: number; status: string };
  };

  // 综合评分
  overallScore: {
    score: number;                // 0-100
    grade: string;                // A/B/C/D/F
    ranking: number;              // 在同行业中的排名
  };
}
```

**业务规则**
- Status: excellent (>110%), good (90-110%), warning (70-90%), poor (<70%)
- 达成率 = (实际值 / 目标值) × 100%
- 综合评分基于各项KPI加权平均
- 等级: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

---

### 4.2 预测报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/forecast?type={type}&days={days}
```

**功能描述**
基于历史数据的预测分析，支持产量、销售、成本等多种预测类型。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| type | String | Query | 是 | 预测类型: production/sales/cost/demand |
| days | Integer | Query | 是 | 预测天数: 7/14/30/60/90 |

**响应数据结构**
```typescript
interface ForecastReport {
  // 预测数据
  forecast: Array<{
    date: string;
    predictedValue: number;
    confidenceInterval: {
      lower: number;              // 置信区间下限
      upper: number;              // 置信区间上限
    };
    confidence: number;           // 置信度 (0-1)
  }>;

  // 历史数据
  historical: Array<{
    date: string;
    actualValue: number;
  }>;

  // 模型信息
  model: {
    algorithm: string;            // 算法: linear/arima/exponential_smoothing
    accuracy: number;             // 准确度
    mape: number;                 // 平均绝对百分比误差
    rmse: number;                 // 均方根误差
  };

  // 趋势分析
  trends: {
    shortTerm: string;            // 短期趋势: increasing/decreasing/stable
    longTerm: string;             // 长期趋势
    seasonality: {
      detected: boolean;
      period: number;
    };
  };

  // 影响因素
  factors: Array<{
    factor: string;
    impact: number;               // 影响程度 (-1 to 1)
    description: string;
  }>;

  // 建议
  recommendations: Array<{
    category: string;
    recommendation: string;
    priority: string;
  }>;
}
```

**业务规则**
- 预测基于至少90天的历史数据
- MAPE < 10%: 高精度, 10-20%: 中等, >20%: 低精度
- 置信区间: 95%置信度
- 季节性检测: 至少需要2个完整周期的数据

---

### 4.3 异常报告

**接口定义**
```
GET /api/mobile/{factoryId}/reports/anomalies?startDate={startDate}&endDate={endDate}
```

**功能描述**
检测并报告异常情况，包含数据异常、业务异常、设备异常等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| startDate | LocalDate | Query | 否 | 开始日期，默认30天前 |
| endDate | LocalDate | Query | 否 | 结束日期，默认今天 |

**响应数据结构**
```typescript
interface AnomalyReport {
  // 异常汇总
  summary: {
    totalAnomalies: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byCategory: {
      production: number;
      quality: number;
      equipment: number;
      inventory: number;
      personnel: number;
    };
  };

  // 异常详情
  anomalies: Array<{
    id: string;
    category: string;             // production/quality/equipment/inventory/personnel
    severity: string;             // critical/high/medium/low
    type: string;                 // 异常类型
    description: string;
    detectedDate: string;
    affectedArea: string;
    metrics: {
      expectedValue: number;
      actualValue: number;
      deviation: number;          // 偏离程度
    };
    potentialImpact: {
      financial: number;          // 潜在财务影响
      operational: string;        // 运营影响描述
    };
    status: string;               // new/investigating/resolved
    recommendations: string[];
  }>;

  // 异常模式
  patterns: Array<{
    pattern: string;
    frequency: number;            // 出现频率
    associatedFactors: string[];
    recommendation: string;
  }>;

  // 根因分析
  rootCauses: Array<{
    cause: string;
    affectedAnomalies: number;
    likelihood: number;           // 可能性 (0-1)
    actionRequired: string;
  }>;
}
```

**业务规则**
- 异常检测基于统计方法(3-sigma规则)
- 严重程度基于偏离程度和潜在影响
- 自动关联相关异常发现模式
- 建议优先解决critical和high级别异常

---

### 4.4 实时数据

**接口定义**
```
GET /api/mobile/{factoryId}/reports/realtime
```

**功能描述**
获取工厂实时运营数据，用于监控当前状态。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应数据结构**
```typescript
interface RealtimeReportData {
  timestamp: string;              // 数据时间戳

  // 实时生产
  production: {
    currentOutput: number;        // 当前产量
    todayOutput: number;          // 今日产量
    todayTarget: number;          // 今日目标
    achievement: number;          // 达成率
    activeBatches: number;        // 进行中批次
    currentEfficiency: number;    // 当前效率
  };

  // 实时设备状态
  equipment: {
    totalOnline: number;          // 在线设备
    running: number;              // 运行中
    idle: number;                 // 闲置
    alarm: number;                // 告警
    utilizationRate: number;      // 实时利用率
  };

  // 实时人员
  personnel: {
    currentOnShift: number;       // 当前在岗
    totalScheduled: number;       // 计划人数
    lateArrivals: number;         // 迟到
    earlyLeaves: number;          // 早退
  };

  // 实时质量
  quality: {
    todayInspections: number;     // 今日质检
    todayQualified: number;       // 今日合格
    todayDefective: number;       // 今日不合格
    currentQualityRate: number;   // 当前合格率
  };

  // 实时告警
  activeAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    time: string;
  }>;

  // 实时趋势(最近24小时)
  hourlyTrend: Array<{
    hour: string;
    output: number;
    efficiency: number;
    qualityRate: number;
  }>;
}
```

**业务规则**
- 数据每5分钟更新一次
- 趋势数据显示最近24小时
- 告警按时间倒序排列
- 仅返回当前激活的告警

---

## 5. 导出功能

### 5.1 导出Excel报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/export/excel?reportType={type}&startDate={startDate}&endDate={endDate}
```

**功能描述**
导出指定类型的报表为Excel文件。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| reportType | String | Query | 是 | 报表类型: production/inventory/finance/quality/equipment/personnel/sales |
| startDate | LocalDate | Query | 是 | 开始日期 |
| endDate | LocalDate | Query | 是 | 结束日期 |

**响应**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="report_{type}_{date}.xlsx"`
- 二进制Excel文件流

**Excel内容结构**
1. **封面页**: 报表标题、日期范围、生成时间
2. **汇总页**: 关键指标汇总
3. **明细页**: 详细数据列表
4. **图表页**: 数据可视化图表
5. **说明页**: 指标说明和计算公式

**业务规则**
- 单次导出数据量不超过10万条
- 自动应用样式和格式
- 包含数据验证和公式
- 支持数据透视表

---

### 5.2 导出PDF报表

**接口定义**
```
GET /api/mobile/{factoryId}/reports/export/pdf?reportType={type}&startDate={startDate}&endDate={endDate}
```

**功能描述**
导出指定类型的报表为PDF文件，适合打印和存档。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| reportType | String | Query | 是 | 报表类型 |
| startDate | LocalDate | Query | 是 | 开始日期 |
| endDate | LocalDate | Query | 是 | 结束日期 |

**响应**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="report_{type}_{date}.pdf"`
- 二进制PDF文件流

**PDF内容结构**
1. **封面**: 公司Logo、报表标题、日期范围
2. **目录**: 各章节导航
3. **摘要**: 执行摘要
4. **详细内容**: 分章节展示
5. **图表**: 数据可视化
6. **附录**: 说明和备注

**业务规则**
- 支持A4和Letter纸张
- 自动分页和页码
- 包含页眉页脚
- 支持目录书签

---

## 6. 自定义报表

### 6.1 获取自定义报表

**接口定义**
```
POST /api/mobile/{factoryId}/reports/custom
```

**功能描述**
根据自定义参数生成报表，支持灵活的数据筛选和聚合。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| parameters | Map | Body | 是 | 自定义参数 |

**请求Body示例**
```json
{
  "reportName": "自定义生产成本分析",
  "dateRange": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-20"
  },
  "dimensions": ["productType", "department", "date"],
  "metrics": ["totalCost", "unitCost", "rawMaterialCost", "laborCost"],
  "filters": {
    "productTypeId": ["PROD_001", "PROD_002"],
    "departmentId": ["DEPT_001"],
    "minCost": 1000.00
  },
  "groupBy": "productType",
  "sortBy": "totalCost",
  "sortOrder": "desc",
  "limit": 100,
  "includeChart": true,
  "chartType": "bar"
}
```

**响应数据结构**
```typescript
interface CustomReport {
  reportInfo: {
    reportName: string;
    generatedAt: string;
    dateRange: {
      startDate: string;
      endDate: string;
    };
  };

  summary: {
    totalRecords: number;
    [key: string]: any;         // 动态汇总字段
  };

  data: Array<{
    [key: string]: any;         // 动态数据字段
  }>;

  aggregations: {
    [metric: string]: {
      sum: number;
      avg: number;
      min: number;
      max: number;
      count: number;
    };
  };

  chartData?: {
    type: string;
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  };
}
```

**业务规则**
- 最多支持5个维度
- 最多支持10个指标
- 单次查询返回最多10000条记录
- 复杂查询可能需要较长时间

---

## 前端集成指南

### API客户端封装

```typescript
// reportApiClient.ts
import { apiClient } from './apiClient';
import type {
  DashboardStatistics,
  ProductionReport,
  InventoryReport,
  FinanceReport,
  QualityReport,
  EquipmentReport,
  PersonnelReport,
  SalesReport,
  CostAnalysisReport,
  EfficiencyAnalysisReport,
  TrendAnalysisReport,
  PeriodComparisonReport,
  KPIMetrics,
  ForecastReport,
  AnomalyReport,
  RealtimeReportData,
  CustomReport,
} from '../types/report';

export const reportApiClient = {
  // 1. 仪表盘统计
  getDashboardStatistics: async (
    factoryId: string
  ): Promise<DashboardStatistics> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/dashboard`);
  },

  // 2. 基础报表
  getProductionReport: async (
    factoryId: string,
    startDate: string,
    endDate: string
  ): Promise<ProductionReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/production`, {
      params: { startDate, endDate },
    });
  },

  getInventoryReport: async (
    factoryId: string,
    date?: string
  ): Promise<InventoryReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/inventory`, {
      params: date ? { date } : {},
    });
  },

  getFinanceReport: async (
    factoryId: string,
    startDate: string,
    endDate: string
  ): Promise<FinanceReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/finance`, {
      params: { startDate, endDate },
    });
  },

  getQualityReport: async (
    factoryId: string,
    startDate: string,
    endDate: string
  ): Promise<QualityReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/quality`, {
      params: { startDate, endDate },
    });
  },

  getEquipmentReport: async (
    factoryId: string,
    date?: string
  ): Promise<EquipmentReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/equipment`, {
      params: date ? { date } : {},
    });
  },

  getPersonnelReport: async (
    factoryId: string,
    date?: string
  ): Promise<PersonnelReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/personnel`, {
      params: date ? { date } : {},
    });
  },

  getSalesReport: async (
    factoryId: string,
    startDate: string,
    endDate: string
  ): Promise<SalesReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/sales`, {
      params: { startDate, endDate },
    });
  },

  // 3. 分析报表
  getCostAnalysisReport: async (
    factoryId: string,
    startDate: string,
    endDate: string
  ): Promise<CostAnalysisReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/cost-analysis`, {
      params: { startDate, endDate },
    });
  },

  getEfficiencyAnalysisReport: async (
    factoryId: string,
    startDate: string,
    endDate: string
  ): Promise<EfficiencyAnalysisReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/efficiency-analysis`, {
      params: { startDate, endDate },
    });
  },

  getTrendAnalysisReport: async (
    factoryId: string,
    type: string,
    period: number
  ): Promise<TrendAnalysisReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/trend-analysis`, {
      params: { type, period },
    });
  },

  getPeriodComparisonReport: async (
    factoryId: string,
    period1Start: string,
    period1End: string,
    period2Start: string,
    period2End: string
  ): Promise<PeriodComparisonReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/period-comparison`, {
      params: { period1Start, period1End, period2Start, period2End },
    });
  },

  // 4. 高级功能
  getKPIMetrics: async (
    factoryId: string,
    date?: string
  ): Promise<KPIMetrics> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/kpi`, {
      params: date ? { date } : {},
    });
  },

  getForecastReport: async (
    factoryId: string,
    type: string,
    days: number
  ): Promise<ForecastReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/forecast`, {
      params: { type, days },
    });
  },

  getAnomalyReport: async (
    factoryId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AnomalyReport> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/anomalies`, {
      params: { startDate, endDate },
    });
  },

  getRealtimeData: async (factoryId: string): Promise<RealtimeReportData> => {
    return apiClient.get(`/api/mobile/${factoryId}/reports/realtime`);
  },

  // 5. 导出功能
  exportExcelReport: (
    factoryId: string,
    reportType: string,
    startDate: string,
    endDate: string
  ): string => {
    return `${apiClient.baseURL}/api/mobile/${factoryId}/reports/export/excel?reportType=${reportType}&startDate=${startDate}&endDate=${endDate}`;
  },

  exportPdfReport: (
    factoryId: string,
    reportType: string,
    startDate: string,
    endDate: string
  ): string => {
    return `${apiClient.baseURL}/api/mobile/${factoryId}/reports/export/pdf?reportType=${reportType}&startDate=${startDate}&endDate=${endDate}`;
  },

  // 6. 自定义报表
  getCustomReport: async (
    factoryId: string,
    parameters: Record<string, any>
  ): Promise<CustomReport> => {
    return apiClient.post(`/api/mobile/${factoryId}/reports/custom`, parameters);
  },
};
```

### React Native使用示例

#### 1. 仪表盘统计页面

```typescript
// DashboardScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { reportApiClient } from '../services/api/reportApiClient';
import type { DashboardStatistics } from '../types/report';

export const DashboardScreen: React.FC = () => {
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      const factoryId = 'CRETAS_2024_001';
      const data = await reportApiClient.getDashboardStatistics(factoryId);
      setStats(data);
    } catch (error) {
      console.error('加载仪表盘失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* 生产统计 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>生产统计</Title>
          <Paragraph>今日产量: {stats?.productionStats.monthlyOutput} kg</Paragraph>
          <Paragraph>完成率: {(stats?.productionStats.completionRate * 100).toFixed(1)}%</Paragraph>
          <Paragraph>生产效率: {(stats?.productionStats.efficiency * 100).toFixed(1)}%</Paragraph>
        </Card.Content>
      </Card>

      {/* 库存统计 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>库存统计</Title>
          <Paragraph>库存总价值: ¥{stats?.inventoryStats.totalValue.toFixed(2)}</Paragraph>
          <Paragraph>即将过期: {stats?.inventoryStats.expiringBatches} 批次</Paragraph>
          <Paragraph>低库存: {stats?.inventoryStats.lowStockItems} 项</Paragraph>
        </Card.Content>
      </Card>

      {/* 财务统计 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>财务统计</Title>
          <Paragraph>月度收入: ¥{stats?.financeStats.monthlyRevenue.toFixed(2)}</Paragraph>
          <Paragraph>月度利润: ¥{stats?.financeStats.monthlyProfit.toFixed(2)}</Paragraph>
          <Paragraph>利润率: {(stats?.financeStats.profitMargin * 100).toFixed(1)}%</Paragraph>
        </Card.Content>
      </Card>

      {/* 告警信息 */}
      {stats?.alerts && stats.alerts.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>最新告警</Title>
            {stats.alerts.map((alert, index) => (
              <Paragraph key={index} style={styles.alert}>
                [{alert.level.toUpperCase()}] {alert.message}
              </Paragraph>
            ))}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 8,
  },
  alert: {
    color: '#d32f2f',
    marginTop: 4,
  },
});
```

#### 2. 报表导出功能

```typescript
// ReportExportScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import { Button, TextInput, SegmentedButtons } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { reportApiClient } from '../services/api/reportApiClient';

export const ReportExportScreen: React.FC = () => {
  const [reportType, setReportType] = useState('production');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [format, setFormat] = useState<'excel' | 'pdf'>('excel');

  const handleExport = async () => {
    const factoryId = 'CRETAS_2024_001';
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const url = format === 'excel'
      ? reportApiClient.exportExcelReport(factoryId, reportType, startStr, endStr)
      : reportApiClient.exportPdfReport(factoryId, reportType, startStr, endStr);

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        Alert.alert('成功', '报表下载已开始');
      } else {
        Alert.alert('错误', '无法打开下载链接');
      }
    } catch (error) {
      console.error('导出失败:', error);
      Alert.alert('错误', '报表导出失败');
    }
  };

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={reportType}
        onValueChange={setReportType}
        buttons={[
          { value: 'production', label: '生产' },
          { value: 'finance', label: '财务' },
          { value: 'quality', label: '质量' },
        ]}
        style={styles.segment}
      />

      <SegmentedButtons
        value={format}
        onValueChange={(value) => setFormat(value as 'excel' | 'pdf')}
        buttons={[
          { value: 'excel', label: 'Excel' },
          { value: 'pdf', label: 'PDF' },
        ]}
        style={styles.segment}
      />

      <Button mode="contained" onPress={handleExport} style={styles.button}>
        导出报表
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  segment: {
    marginBottom: 16,
  },
  button: {
    marginTop: 24,
  },
});
```

---

## 业务规则

### 1. 数据权限
- 工厂管理员: 查看本工厂所有报表
- 部门管理员: 查看本部门相关报表
- 普通用户: 查看授权的报表

### 2. 数据安全
- 财务数据仅对财务角色和管理员可见
- 人员薪资数据脱敏处理
- 敏感报表需要二次验证

### 3. 性能优化
- 大数据量报表采用分页加载
- 复杂报表异步生成
- 实时数据采用缓存机制(5分钟)
- 导出功能限制单次数据量

### 4. 数据质量
- 统计数据每日凌晨自动更新
- 异常数据标记并通知
- 历史数据自动归档(保留2年)

---

## 错误处理

### 错误码定义

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 4001 | 日期范围无效 | 检查日期格式和范围 |
| 4002 | 报表类型不支持 | 使用正确的报表类型 |
| 4003 | 数据量过大 | 缩小日期范围或分页查询 |
| 4004 | 参数验证失败 | 检查请求参数 |
| 5001 | 报表生成失败 | 稍后重试或联系管理员 |
| 5002 | 导出失败 | 检查服务器状态 |
| 5003 | 数据源异常 | 联系技术支持 |

### 错误处理示例

```typescript
try {
  const report = await reportApiClient.getProductionReport(
    factoryId,
    startDate,
    endDate
  );
  setReportData(report);
} catch (error: any) {
  if (error.code === 4003) {
    Alert.alert('提示', '数据量过大，请缩小日期范围');
  } else if (error.code === 5001) {
    Alert.alert('错误', '报表生成失败，请稍后重试');
  } else {
    Alert.alert('错误', error.message || '加载失败');
  }
}
```

---

## 总结

ReportController提供了**全面的报表统计与分析功能**，包含:

✅ **20个API端点**: 覆盖7大基础报表、4种高级分析、实时监控、导出功能
✅ **多维度数据**: 生产、库存、财务、质量、设备、人员、销售全方位统计
✅ **智能分析**: 成本分析、效率分析、趋势预测、异常检测
✅ **灵活导出**: Excel、PDF多格式支持
✅ **实时监控**: 工厂运营实时数据
✅ **自定义报表**: 支持灵活的参数配置

这套报表系统为管理层提供了**数据驱动决策**的完整工具链。
