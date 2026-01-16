# PRD需求与API映射表

**用途**: 对照PRD需求，快速找到对应的API
**更新时间**: 2025-01-18

---

## 🎯 核心业务流程映射

### PRD 4.1 - 7天完整业务周期

| PRD步骤 | API端点 | 说明 | Phase |
|---------|---------|------|-------|
| **Day 1: 原材料入库** |
| 供应商送货 | `GET /api/mobile/{factoryId}/suppliers/active` | 选择供应商 | P1 |
| 质检验收 | `POST /api/mobile/{factoryId}/processing/quality/inspections` | 提交质检 | P0 |
| 入库登记 | `POST /api/mobile/{factoryId}/material-batches` | 创建批次 | P0 |
| FIFO标记 | `GET /api/mobile/{factoryId}/material-batches/fifo/{id}` | FIFO推荐 | P0 |
| **Day 1: 创建计划** |
| 智能预估 | `POST /api/mobile/{factoryId}/conversions/calculate/material-requirement` | 计算原料需求 | P0 |
| 库存检查 | `GET /api/mobile/{factoryId}/material-batches/material-type/{id}` | 查询可用库存 | P0 |
| 创建计划 | `POST /api/mobile/{factoryId}/production-plans` | 创建生产计划 | P0 |
| 预留库存 | `POST /api/mobile/{factoryId}/material-batches/{id}/reserve` | 预留原料 | P0 |
| **Day 2: 开始生产** |
| 员工打卡 | `POST /api/mobile/{factoryId}/time-clocks/check-in` | 上班打卡 | P1 |
| 开始生产 | `POST /api/mobile/{factoryId}/processing/batches/{id}/start` | 开始 | P0 |
| 记录消耗 | `POST /api/mobile/{factoryId}/processing/batches/{id}/material-consumption` | 记录消耗 | P0 |
| 库存扣减 | `POST /api/mobile/{factoryId}/material-batches/{id}/use` | 使用原料 | P0 |
| 员工下班 | `POST /api/mobile/{factoryId}/time-clocks/clock-out` | 下班打卡 | P1 |
| **Day 8: 完成生产** |
| 完成生产 | `POST /api/mobile/{factoryId}/processing/batches/{id}/complete` | 完成 | P0 |
| 成本计算 | `GET /api/mobile/{factoryId}/time-stats/monthly` | 获取工时 | P1 |
| **Day 9: AI分析** |
| AI分析 | `POST /api/mobile/analysis/ai` | AI分析 | ⚠️ 缺失 |

---

## 📋 PRD功能模块映射

### PRD 3.1 - 认证授权模块

| PRD功能 | API端点 | 实现状态 |
|---------|---------|---------|
| 3.1.1 统一登录 | `POST /api/mobile/auth/unified-login` | ✅ 已实现 |
| 3.1.2 两阶段注册 | `POST /api/mobile/auth/register-phase-one` | ✅ 已实现 |
| 3.1.2 两阶段注册 | `POST /api/mobile/auth/register-phase-two` | ✅ 已实现 |
| 3.1.3 Token管理 | `POST /api/mobile/auth/refresh` | ✅ 已实现 |
| 3.1.4 会话管理 | `POST /api/mobile/auth/logout` | ✅ 已实现 |
| 3.1.5 设备绑定 | `POST /api/mobile/activation/activate` | 📋 待实现 |

### PRD 3.2 - 用户管理

| PRD功能 | API端点 | 实现状态 |
|---------|---------|---------|
| 用户CRUD | `GET/POST/PUT/DELETE /api/{factoryId}/users` | 📋 待实现 |
| 角色管理 | `PUT /api/{factoryId}/users/{id}/role` | 📋 待实现 |
| 用户激活 | `POST /api/{factoryId}/users/{id}/activate` | 📋 待实现 |

### PRD 4.2 - 原材料入库

| PRD功能 | API端点 | 实现状态 |
|---------|---------|---------|
| 15字段入库 | `POST /api/mobile/{factoryId}/material-batches` | 📋 待实现 |
| FIFO推荐 | `GET /api/mobile/{factoryId}/material-batches/fifo/{id}` | 📋 待实现 |
| 到期预警 | `GET /api/mobile/{factoryId}/material-batches/expiring` | 📋 待实现 |
| 过期处理 | `POST /api/mobile/{factoryId}/material-batches/handle-expired` | 📋 待实现 |
| 新鲜/冻货 | ⚠️ 在MaterialBatch模型的storageType字段 | - |

### PRD 4.3 - 生产计划

| PRD功能 | API端点 | 实现状态 |
|---------|---------|---------|
| 智能预估原料 | `POST /api/mobile/{factoryId}/conversions/calculate/material-requirement` | 📋 待实现 |
| 库存充足检查 | `GET /api/mobile/{factoryId}/material-batches/material-type/{id}` | 📋 待实现 |
| FIFO自动推荐 | `GET /api/mobile/{factoryId}/material-batches/fifo/{id}` | 📋 待实现 |
| 创建计划 | `POST /api/mobile/{factoryId}/production-plans` | 📋 待实现 |
| 今日计划 | `GET /api/mobile/{factoryId}/production-plans/today` | 📋 待实现 |

### PRD 4.4 - 成本分析

| PRD功能 | API端点 | 实现状态 |
|---------|---------|---------|
| 原料成本 | ⚠️ 在ProcessingBatch中计算 | - |
| 人工成本 | `GET /api/mobile/{factoryId}/time-stats/monthly` | 📋 待实现 |
| 设备成本 | ⚠️ 手动录入，无API | - |
| AI分析 | ⚠️ `POST /api/mobile/analysis/ai` | ⚠️ 缺失 |

### PRD 4.5 - 员工打卡

| PRD功能 | API端点 | 实现状态 |
|---------|---------|---------|
| 上班打卡 | `POST /api/mobile/{factoryId}/time-clocks/check-in` | 📋 待实现 |
| 下班打卡 | `POST /api/mobile/{factoryId}/time-clocks/clock-out` | 📋 待实现 |
| GPS验证 | ⚠️ 在ClockInRequest的location字段 | - |
| 打卡历史 | ⚠️ 需要确认具体API | ⚠️ 可能缺失 |
| 工时统计 | `GET /api/mobile/{factoryId}/time-stats/daily` | 📋 待实现 |

---

## ⚠️ 发现的问题

### 1. 缺失的关键API

| PRD需求 | 缺失API | 影响 |
|---------|---------|------|
| AI智能分析 | `POST /api/mobile/analysis/ai` | 🔴 高 - PRD核心功能 |
| 打卡历史查询 | `GET /api/mobile/{factoryId}/time-clocks/records` | 🟡 中 - 需要确认 |
| 成本分析详情 | ⚠️ 可能在ProcessingBatch中 | 🟡 中 - 需要确认 |

### 2. 可能用不上的API

| API | 原因 | 建议 |
|-----|------|------|
| 批量创建原材料批次 | PRD中原料一次一批入库 | ⏸️ 可延后 |
| 产品/原料类型批量操作 | MVP数据量小 | ⏸️ 可延后 |
| 部分高级统计API | PRD只要基础统计 | ⏸️ 可延后 |

---

## 📊 API覆盖度分析

| PRD章节 | 需求数 | 对应API数 | 覆盖率 |
|---------|--------|-----------|--------|
| 3.1 认证授权 | 7 | 7 | 100% ✅ |
| 3.2 用户管理 | 10 | 14 | 140% ✅ |
| 4.2 原材料入库 | 8 | 14 | 175% ✅ |
| 4.3 生产计划 | 10 | 12 | 120% ✅ |
| 4.4 成本分析 | 5 | 3 | 60% ⚠️ |
| 4.5 员工打卡 | 6 | 14 | 233% ✅ |
| 5.x 配置管理 | 30 | 51 | 170% ✅ |

**总体覆盖率**: 约130%（API数量充足，部分模块有冗余）

---

## 🔗 快速链接

- [MVP API参考](./mvp-api-reference.md)
- [MVP数据模型](./mvp-models.md)
- [PRD文档](../prd/)

---

**文档说明**: 本映射表帮助开发者理解API与PRD需求的对应关系，标注了实现状态和可能的问题。
