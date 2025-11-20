# TimeStats vs TimeClock 职责边界说明

**文档版本**: v1.0
**创建日期**: 2025-11-19
**目的**: 明确timeStatsApiClient和timeclockApiClient的职责边界，防止功能混淆

---

## 📋 快速参考

| 需求 | 使用API Client | 典型方法 |
|------|---------------|----------|
| 员工打卡上班 | timeclockApiClient | clockIn() |
| 员工打卡下班 | timeclockApiClient | clockOut() |
| 查询今日打卡记录 | timeclockApiClient | getTodayRecords() |
| 查询打卡历史 | timeclockApiClient | getAttendanceHistory() |
| 计算工时统计 | timeStatsApiClient | getEmployeeTimeStats() |
| 部门效率分析 | timeStatsApiClient | getDepartmentTimeStats() |
| 加班时间计算 | timeStatsApiClient | calculateOvertimeHours() |
| 员工绩效排名 | timeStatsApiClient | getTopPerformers() |

---

## 🎯 核心区别

### timeclockApiClient - 打卡操作层

**职责**: 考勤打卡的CRUD操作（Create, Read, Update, Delete）

**关键特征**:
- ✅ **操作型**: 执行具体的打卡动作
- ✅ **实时性**: 记录当前时刻的考勤事件
- ✅ **事务性**: 每次调用产生一条考勤记录
- ✅ **面向操作员**: 主要给普通员工使用

**典型场景**:
```typescript
// 员工上班打卡
await timeclockApiClient.clockIn({
  userId: 123,
  location: { lat: 31.2304, lng: 121.4737 },
  device: 'mobile-app'
});

// 员工下班打卡
await timeclockApiClient.clockOut({
  userId: 123
});

// 查询今日打卡状态
const todayRecords = await timeclockApiClient.getTodayRecords(
  'F001', // factoryId
  123    // userId
);
```

---

### timeStatsApiClient - 统计分析层

**职责**: 基于打卡数据的统计分析和报表生成

**关键特征**:
- ✅ **分析型**: 聚合和计算已有数据
- ✅ **历史性**: 分析过去一段时间的趋势
- ✅ **只读性**: 不产生新的考勤记录
- ✅ **面向管理者**: 主要给经理、HR、管理员使用

**典型场景**:
```typescript
// 查询员工本月工时统计
const stats = await timeStatsApiClient.getEmployeeTimeStats(
  123, // employeeId
  { startDate: '2025-11-01', endDate: '2025-11-30' }
);

// 查询生产部效率报告
const efficiency = await timeStatsApiClient.getEfficiencyReport({
  department: '生产部',
  period: 'month'
});

// 计算员工加班时间
const overtime = await timeStatsApiClient.calculateOvertimeHours({
  employeeId: 123,
  month: '2025-11'
});

// 获取本月绩效Top 10
const topPerformers = await timeStatsApiClient.getTopPerformers(10);
```

---

## 🏗️ 架构关系

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Screens                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  TimeClockScreen          AttendanceStatisticsScreen    │
│  (打卡界面)                (工时统计界面)                  │
│       ↓                            ↓                     │
│  timeclockApiClient       timeStatsApiClient            │
│  - clockIn()              - getEmployeeTimeStats()      │
│  - clockOut()             - getDepartmentTimeStats()    │
│  - getTodayRecords()      - getEfficiencyReport()       │
│                                                           │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                     Backend Layer                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  TimeClockController         (TimeStatsController)       │
│  /timeclock/*                /time-stats/* (待实现)      │
│  - POST /clock-in            - GET /employee/{id}        │
│  - POST /clock-out           - GET /department/{dept}    │
│  - GET /today                - GET /efficiency-report    │
│                                                           │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    Database Layer                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  TimeClockRepository                                     │
│  - save()                                                │
│  - findByUserIdAndDate()                                │
│  - findByFactoryId()                                     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**数据流向**:
1. **写入流**: 员工打卡 → timeclockApiClient → TimeClockController → TimeClockRepository → Database
2. **读取流**: 查询统计 → timeStatsApiClient → (TimeStatsController) → TimeClockRepository → Database
3. **关键点**: 两者都基于同一数据源（TimeClockRecord表），但用途不同

---

## 📦 API详细对比

### timeclockApiClient (11个API)

#### 打卡操作 (4个)
| API方法 | HTTP | 路径 | 功能 | 返回值 |
|---------|------|------|------|--------|
| clockIn() | POST | /timeclock/clock-in | 上班打卡 | 打卡记录ID |
| clockOut() | POST | /timeclock/clock-out | 下班打卡 | 打卡记录ID |
| breakStart() | POST | /timeclock/break-start | 休息开始 | 记录ID |
| breakEnd() | POST | /timeclock/break-end | 休息结束 | 记录ID |

#### 查询操作 (4个)
| API方法 | HTTP | 路径 | 功能 | 返回值 |
|---------|------|------|------|--------|
| getTodayRecords() | GET | /timeclock/today | 查询今日记录 | 记录列表 |
| getStatusByUserId() | GET | /timeclock/status/{userId} | 查询打卡状态 | 状态对象 |
| getAttendanceHistory() | GET | /timeclock/history | 查询历史记录 | 分页记录 |
| getDepartmentAttendance() | GET | /timeclock/department/{dept} | 部门考勤 | 部门记录 |

#### 统计操作 (3个 - 基础统计)
| API方法 | HTTP | 路径 | 功能 | 返回值 |
|---------|------|------|------|--------|
| getAttendanceStatistics() | GET | /timeclock/statistics | 基础考勤统计 | 统计数据 |
| exportAttendanceRecords() | GET | /timeclock/export | 导出考勤记录 | Excel文件 |
| importAttendanceRecords() | POST | /timeclock/import | 导入考勤记录 | 导入结果 |

---

### timeStatsApiClient (17个API)

#### 员工维度统计 (3个)
| API方法 | HTTP | 路径 | 功能 | 返回值 |
|---------|------|------|------|--------|
| getEmployeeTimeStats() | GET | /time-stats/employee/{id} | 员工工时统计 | 工时详情 |
| getTopPerformers() | GET | /time-stats/top-performers | 绩效排名Top N | 排名列表 |
| calculateOvertimeHours() | POST | /time-stats/calculate-overtime | 计算加班时间 | 加班详情 |

#### 部门维度统计 (2个)
| API方法 | HTTP | 路径 | 功能 | 返回值 |
|---------|------|------|------|--------|
| getDepartmentTimeStats() | GET | /time-stats/department/{dept} | 部门工时统计 | 部门数据 |
| getEfficiencyReport() | GET | /time-stats/efficiency-report | 效率报告 | 报告数据 |

#### 工种维度统计 (1个)
| API方法 | HTTP | 路径 | 功能 | 返回值 |
|---------|------|------|------|--------|
| getWorkTypeTimeStats() | GET | /time-stats/work-type/{id} | 工种工时统计 | 工种数据 |

#### 时间维度统计 (3个)
| API方法 | HTTP | 路径 | 功能 | 返回值 |
|---------|------|------|------|--------|
| getDailyStats() | GET | /time-stats/daily | 每日统计 | 日统计 |
| getWeeklyStats() | GET | /time-stats/weekly | 每周统计 | 周统计 |
| getMonthlyStats() | GET | /time-stats/monthly | 每月统计 | 月统计 |

#### CRUD操作 (5个 - 用于自定义统计记录)
| API方法 | HTTP | 路径 | 功能 | 返回值 |
|---------|------|------|------|--------|
| getTimeStats() | GET | /time-stats | 查询统计记录 | 记录列表 |
| createTimeRecord() | POST | /time-stats | 创建统计记录 | 记录ID |
| getTimeRecordById() | GET | /time-stats/{id} | 查询单条记录 | 记录详情 |
| updateTimeRecord() | PUT | /time-stats/{id} | 更新统计记录 | 更新结果 |
| deleteTimeRecord() | DELETE | /time-stats/{id} | 删除统计记录 | 删除结果 |

#### 数据操作 (2个)
| API方法 | HTTP | 路径 | 功能 | 返回值 |
|---------|------|------|------|--------|
| exportTimeStats() | GET | /time-stats/export | 导出统计数据 | Excel文件 |
| importTimeRecords() | POST | /time-stats/import | 导入统计记录 | 导入结果 |

#### ❌ 已废弃 (1个)
| API方法 | 废弃日期 | 替代方案 | 原因 |
|---------|----------|----------|------|
| getCostAnalysis() | 2025-11-19 | processingApiClient.getTimeRangeCostAnalysis() | 职责不符 |

---

## 🔍 职责边界细则

### 什么属于TimeClock？

**核心原则**: 如果操作直接产生或修改考勤打卡记录，属于TimeClock

**包含功能**:
- ✅ 打卡操作（上班、下班、休息开始、休息结束）
- ✅ 打卡记录查询（今日、历史、状态）
- ✅ 打卡记录修改（补卡、更正）
- ✅ 打卡记录删除（异常记录）
- ✅ 基础考勤统计（出勤率、迟到次数、早退次数）
- ✅ 打卡记录导入导出（原始记录级别）

**不包含功能**:
- ❌ 工时统计分析（→ TimeStats）
- ❌ 部门效率对比（→ TimeStats）
- ❌ 员工绩效排名（→ TimeStats）
- ❌ 加班时间计算（→ TimeStats）
- ❌ 成本分析（→ Processing）

---

### 什么属于TimeStats？

**核心原则**: 如果操作是基于考勤数据的聚合分析，不产生新记录，属于TimeStats

**包含功能**:
- ✅ 工时统计（员工、部门、工种）
- ✅ 效率分析（日、周、月）
- ✅ 绩效排名（Top N）
- ✅ 加班计算（加班时长、加班费）
- ✅ 趋势分析（出勤趋势、效率趋势）
- ✅ 对比分析（部门对比、员工对比）
- ✅ 统计报表导出（汇总级别）

**不包含功能**:
- ❌ 打卡操作（→ TimeClock）
- ❌ 打卡记录修改（→ TimeClock）
- ❌ 成本分析（→ Processing）
- ❌ 薪资计算（→ 未来的Payroll模块）

---

## ⚠️ 常见混淆场景

### 场景1: 查询员工今日出勤情况

**错误做法** ❌:
```typescript
// 不应该用TimeStats查询实时打卡状态
const stats = await timeStatsApiClient.getEmployeeTimeStats(123, {
  startDate: '2025-11-19',
  endDate: '2025-11-19'
});
```

**正确做法** ✅:
```typescript
// 应该用TimeClock查询今日打卡记录
const records = await timeclockApiClient.getTodayRecords('F001', 123);
```

**原因**: 实时查询打卡状态属于操作层，不是分析层

---

### 场景2: 计算员工本月工时

**错误做法** ❌:
```typescript
// 不应该用TimeClock手动计算工时
const history = await timeclockApiClient.getAttendanceHistory({
  userId: 123,
  startDate: '2025-11-01',
  endDate: '2025-11-30'
});
// 然后在前端计算总工时 ← 这是错误的
const totalHours = history.reduce((sum, record) => sum + record.hours, 0);
```

**正确做法** ✅:
```typescript
// 应该用TimeStats直接获取统计结果
const stats = await timeStatsApiClient.getEmployeeTimeStats(123, {
  startDate: '2025-11-01',
  endDate: '2025-11-30'
});
console.log(stats.totalWorkHours); // 后端已计算好
```

**原因**: 工时统计应由后端完成，前端不应重复计算逻辑

---

### 场景3: 导出考勤数据

**何时用TimeClock**:
```typescript
// 导出原始打卡记录（含详细时间、地点）
const file = await timeclockApiClient.exportAttendanceRecords({
  startDate: '2025-11-01',
  endDate: '2025-11-30',
  format: 'detailed' // 详细记录
});
```

**何时用TimeStats**:
```typescript
// 导出统计汇总（只含工时总计、出勤率）
const file = await timeStatsApiClient.exportTimeStats({
  startDate: '2025-11-01',
  endDate: '2025-11-30',
  format: 'summary' // 汇总统计
});
```

**区别**: 详细记录 vs 汇总统计

---

### 场景4: 基础考勤统计 vs 高级工时分析

**基础统计（TimeClock）**:
```typescript
// timeclockApiClient.getAttendanceStatistics()
{
  "totalDays": 22,
  "attendedDays": 20,
  "lateDays": 2,
  "earlyLeaveDays": 1,
  "attendanceRate": 90.9
}
```

**高级分析（TimeStats）**:
```typescript
// timeStatsApiClient.getEmployeeTimeStats()
{
  "totalWorkHours": 176.5,
  "regularHours": 160,
  "overtimeHours": 16.5,
  "efficiency": 95.2,
  "ranking": 3,
  "departmentAverage": 165.3,
  "weeklyTrend": [...]
}
```

**判断标准**:
- 如果只需要出勤天数、迟到次数 → TimeClock
- 如果需要工时计算、效率排名、趋势分析 → TimeStats

---

## 🚫 禁止的职责混淆

### timeclockApiClient 禁止包含的功能

❌ **成本分析**:
```typescript
// ❌ 错误 - 成本分析不属于考勤模块
timeclockApiClient.getCostAnalysis()

// ✅ 正确 - 应该在Processing模块
processingApiClient.getTimeRangeCostAnalysis()
```

❌ **薪资计算**:
```typescript
// ❌ 错误 - 薪资计算属于独立模块
timeclockApiClient.calculateSalary()

// ✅ 正确 - 未来应该创建payrollApiClient
payrollApiClient.calculateSalary()
```

❌ **生产统计**:
```typescript
// ❌ 错误 - 生产数据不属于考勤
timeclockApiClient.getProductionStats()

// ✅ 正确 - 应该在Processing模块
processingApiClient.getProductionStatistics()
```

---

### timeStatsApiClient 禁止包含的功能

❌ **打卡操作**:
```typescript
// ❌ 错误 - 统计模块不应该执行打卡
timeStatsApiClient.clockIn()

// ✅ 正确 - 打卡在操作层
timeclockApiClient.clockIn()
```

❌ **记录修改**:
```typescript
// ❌ 错误 - 统计模块不应该修改原始记录
timeStatsApiClient.updateAttendanceRecord()

// ✅ 正确 - 修改操作在操作层
timeclockApiClient.updateRecord()
```

❌ **成本分析** (已废弃):
```typescript
// ❌ 错误 - 成本分析不属于时间统计
timeStatsApiClient.getCostAnalysis() // 已标记@deprecated

// ✅ 正确 - 成本分析在Processing模块
processingApiClient.getTimeRangeCostAnalysis()
```

---

## 📊 使用Screen分配

### TimeClockScreen.tsx

**主要使用**: timeclockApiClient

**典型调用**:
```typescript
// 打卡操作
const handleClockIn = async () => {
  await timeclockApiClient.clockIn({
    userId: user.id,
    location: currentLocation,
    device: 'mobile-app'
  });
};

// 查询今日状态
const loadTodayStatus = async () => {
  const records = await timeclockApiClient.getTodayRecords(
    factoryId,
    user.id
  );
  setTodayRecords(records);
};
```

**不应该调用**: timeStatsApiClient（这个Screen只管打卡，不管统计）

---

### AttendanceStatisticsScreen.tsx

**主要使用**: timeStatsApiClient

**典型调用**:
```typescript
// 加载工时统计
const loadStats = async () => {
  const stats = await timeStatsApiClient.getEmployeeTimeStats(
    user.id,
    { startDate, endDate }
  );
  setStats(stats);
};

// 加载效率报告
const loadEfficiency = async () => {
  const report = await timeStatsApiClient.getEfficiencyReport({
    department: user.department,
    period: 'month'
  });
  setReport(report);
};
```

**可以调用**: timeclockApiClient.getAttendanceHistory() - 查看原始记录作为参考

---

### AttendanceHistoryScreen.tsx

**主要使用**: timeclockApiClient

**典型调用**:
```typescript
// 查询历史记录
const loadHistory = async () => {
  const history = await timeclockApiClient.getAttendanceHistory({
    userId: user.id,
    startDate,
    endDate,
    page,
    limit
  });
  setHistory(history);
};
```

**不应该调用**: timeStatsApiClient（这个Screen展示原始记录，不展示统计）

---

## 🔮 未来扩展规划

### Phase 4 后端实现

**TimeClockController** (已实现 ✅):
- 路径: `/api/mobile/{factoryId}/timeclock/*`
- 11个端点已完整实现
- 数据库: TimeClockRepository

**TimeStatsController** (待实现 ⚠️):
- 路径: `/api/mobile/{factoryId}/time-stats/*`
- 17个端点待实现
- 优先级: P1 (高)
- 预计工时: 5-7天

**实现顺序**:
1. **Week 1**: 基础统计API（员工、部门、工种）
2. **Week 2**: 时间维度API（日、周、月）+ 高级分析（效率、排名）

---

### 潜在新模块

**PayrollApiClient** (薪资管理):
- 职责: 基于工时计算薪资
- 依赖: TimeStats数据
- 优先级: P3 (Phase 5)

**LeaveApiClient** (请假管理):
- 职责: 请假申请、审批、扣减
- 与TimeClock集成: 请假期间不强制打卡
- 优先级: P2 (Phase 4)

---

## 📝 决策树

当你不确定使用哪个API Client时，按此决策树判断:

```
问题: 我需要...

├─ 执行打卡操作？
│   └─ 是 → timeclockApiClient
│
├─ 查询今日/实时打卡状态？
│   └─ 是 → timeclockApiClient
│
├─ 修改/删除打卡记录？
│   └─ 是 → timeclockApiClient
│
├─ 计算工时/加班/效率？
│   └─ 是 → timeStatsApiClient
│
├─ 生成统计报表/排名？
│   └─ 是 → timeStatsApiClient
│
├─ 分析成本？
│   └─ 是 → processingApiClient
│
└─ 计算薪资？
    └─ 是 → (未来) payrollApiClient
```

---

## 📚 相关文档

- [API_CLIENT_INDEX.md](./API_CLIENT_INDEX.md) - 所有API Client索引
- [API_CONFLICT_RESOLUTION_SOP.md](./API_CONFLICT_RESOLUTION_SOP.md) - 冲突处理标准流程
- [timeclockApiClient.ts](./timeclockApiClient.ts) - TimeClock API实现
- [timeStatsApiClient.ts](./timeStatsApiClient.ts) - TimeStats API实现

---

## 🆘 常见问题

### Q: 为什么要区分TimeClock和TimeStats？

**A**: 遵循"关注点分离"原则:
- **TimeClock**: 操作层，负责数据的增删改查
- **TimeStats**: 分析层，负责数据的聚合统计

这样可以:
1. 代码职责清晰，易于维护
2. 后端可以分别优化（操作性能 vs 分析性能）
3. 便于团队分工（操作功能 vs 统计功能）

### Q: getAttendanceStatistics在TimeClock中，不应该在TimeStats吗？

**A**: 这是"基础统计" vs "高级分析"的区别:
- **TimeClock.getAttendanceStatistics()**: 简单聚合（出勤天数、迟到次数），实时计算
- **TimeStats.getEmployeeTimeStats()**: 复杂分析（工时计算、效率评分、趋势分析），离线计算

基础统计保留在TimeClock是为了快速查询，不需要启动复杂的分析流程。

### Q: 如果需要同时查询打卡记录和工时统计怎么办？

**A**: 两种方案:

**方案1: 分别调用**（推荐）
```typescript
const [records, stats] = await Promise.all([
  timeclockApiClient.getAttendanceHistory({ userId, startDate, endDate }),
  timeStatsApiClient.getEmployeeTimeStats(userId, { startDate, endDate })
]);
```

**方案2: 后端提供组合API**（未来考虑）
```typescript
// 未来可能添加
const combined = await timeclockApiClient.getAttendanceWithStats({
  userId, startDate, endDate
});
```

### Q: TimeStats后端未实现，前端怎么办？

**A**: Phase 1-3策略:
1. 前端完整实现timeStatsApiClient接口
2. 在`backend/rn-update-tableandlogic.md`记录后端需求
3. 使用mock数据进行前端开发
4. Phase 4后端实现时直接对接

**当前状态**: ⚠️ TimeStatsController待实现，优先级P1

---

**文档维护**: 每次修改TimeClock或TimeStats API时必须更新此文档
**Review周期**: 每月Review一次
**最后更新**: 2025-11-19
