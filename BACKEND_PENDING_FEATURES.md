# 后端待实现功能清单

**生成日期**: 2025-11-18
**状态**: 除 TimeClock API 外，其他功能均待实现
**前端代码量**: 4383行 API客户端代码
**后端已实现**: 仅 TimeClockController.java (1个控制器)

---

## 📊 总体情况

| 模块 | 前端API客户端 | 后端控制器 | API数量估算 | 完成度 |
|------|--------------|-----------|------------|--------|
| ✅ TimeClock | timeclockApiClient.ts | TimeClockController.java | 7 | 100% |
| ⏸️ AI分析 | aiApiClient.ts | - | ~10 | 另一个chat处理中 |
| ❌ 生产加工 | processingApiClient.ts | - | 13 | 0% |
| ❌ 原材料批次 | materialBatchApiClient.ts | - | 22 | 0% |
| ❌ 产品类型 | productTypeApiClient.ts | - | 12 | 0% |
| ❌ 用户管理 | userApiClient.ts | - | 14 | 0% |
| ❌ 原材料类型 | materialTypeApiClient.ts | - | ~10 | 0% |
| ❌ 原材料规格 | materialSpecApiClient.ts | - | 3 | 0% |
| ❌ 工种管理 | workTypeApiClient.ts | - | ~8 | 0% |
| ❌ 供应商管理 | supplierApiClient.ts | - | ~10 | 0% |
| ❌ 客户管理 | customerApiClient.ts | - | ~10 | 0% |
| ❌ 白名单管理 | whitelistApiClient.ts | - | ~8 | 0% |
| ❌ 生产计划 | productionPlanApiClient.ts | - | ~15 | 0% |
| ❌ 转化率管理 | conversionApiClient.ts | - | ~8 | 0% |
| ❌ Dashboard | dashboardApiClient.ts | - | 4 | 0% |
| ❌ 考勤统计 | attendanceApiClient.ts | - | ~5 | 0% |
| ❌ 工时统计 | timeStatsApiClient.ts | - | ~5 | 0% |
| ❌ 平台管理 | platformApiClient.ts | - | ~10 | 0% |
| ❌ 工厂设置 | factorySettingsApiClient.ts | - | ~8 | 0% |
| ❌ 员工管理 | employeeApiClient.ts | - | ~5 | 0% |
| **总计** | **26个文件** | **1个** | **~185 APIs** | **约5%** |

---

## 🔥 P0 - 紧急优先级（核心业务功能）

### 1. 原材料规格配置 ⭐⭐⭐
**API客户端**: `materialSpecApiClient.ts`
**工作量**: 1天
**用户需求**: 高（前端已完成）

#### 需要实现的API (3个)
```
GET    /api/mobile/{factoryId}/material-spec-config                - 获取规格配置
PUT    /api/mobile/{factoryId}/material-spec-config/{category}     - 更新规格
DELETE /api/mobile/{factoryId}/material-spec-config/{category}     - 重置为默认
```

#### 数据库表
```sql
CREATE TABLE material_spec_config (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  factory_id VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  specifications JSON NOT NULL,
  is_system_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_factory_category (factory_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 前端调用示例
- MaterialTypeManagementScreen.tsx
- MaterialSpecManagementScreen.tsx

---

### 2. 生产加工管理 ⭐⭐⭐
**API客户端**: `processingApiClient.ts`
**工作量**: 3-4天
**用户需求**: 高（核心业务）

#### 需要实现的API (13个)

**批次管理 (8个)**:
```
GET    /api/mobile/{factoryId}/processing/batches                     - 获取批次列表
POST   /api/mobile/{factoryId}/processing/batches                     - 创建批次
GET    /api/mobile/{factoryId}/processing/batches/{batchId}           - 获取批次详情
POST   /api/mobile/{factoryId}/processing/batches/{batchId}/start     - 开始生产
POST   /api/mobile/{factoryId}/processing/batches/{batchId}/complete  - 完成生产
POST   /api/mobile/{factoryId}/processing/batches/{batchId}/cancel    - 取消生产
POST   /api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption - 记录材料消耗
PUT    /api/mobile/{factoryId}/processing/batches/{batchId}           - 更新批次
```

**质检管理 (2个)**:
```
POST   /api/mobile/{factoryId}/processing/batches/{batchId}/quality-inspection - 创建质检记录
GET    /api/mobile/{factoryId}/processing/batches/{batchId}/quality-inspection - 获取质检记录
```

**其他 (3个)**:
```
GET    /api/mobile/{factoryId}/processing/materials/{materialId}/consumption-history - 材料消耗历史
GET    /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis - 成本分析数据
DELETE /api/mobile/{factoryId}/processing/batches/{batchId}           - 删除批次
```

#### 数据库表
```sql
CREATE TABLE processing_batch (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_number VARCHAR(50) NOT NULL UNIQUE,
  factory_id VARCHAR(50) NOT NULL,
  product_type VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  target_quantity DECIMAL(10,2) NOT NULL,
  actual_quantity DECIMAL(10,2),
  start_time DATETIME,
  end_time DATETIME,
  supervisor_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_factory_status (factory_id, status),
  INDEX idx_batch_number (batch_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE quality_inspection (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id BIGINT NOT NULL,
  inspector_id BIGINT NOT NULL,
  quality_grade VARCHAR(10),
  pass_rate DECIMAL(5,2),
  defect_rate DECIMAL(5,2),
  notes TEXT,
  inspection_time DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES processing_batch(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 3. 原材料批次管理 ⭐⭐⭐
**API客户端**: `materialBatchApiClient.ts`
**工作量**: 2-3天
**用户需求**: 高（核心业务）

#### 需要实现的API (22个)

**CRUD操作 (6个)**:
```
GET    /api/mobile/{factoryId}/material-batches                - 获取批次列表（分页）
POST   /api/mobile/{factoryId}/material-batches                - 创建批次
POST   /api/mobile/{factoryId}/material-batches/batch          - 批量创建
GET    /api/mobile/{factoryId}/material-batches/{batchId}      - 获取详情
PUT    /api/mobile/{factoryId}/material-batches/{batchId}      - 更新批次
DELETE /api/mobile/{factoryId}/material-batches/{batchId}      - 删除批次
```

**库存管理 (6个)**:
```
POST   /api/mobile/{factoryId}/material-batches/{batchId}/reserve    - 预留材料
POST   /api/mobile/{factoryId}/material-batches/{batchId}/release    - 释放预留
POST   /api/mobile/{factoryId}/material-batches/{batchId}/consume    - 消耗材料
GET    /api/mobile/{factoryId}/material-batches/{batchId}/history    - 使用历史
GET    /api/mobile/{factoryId}/material-batches/available            - 可用批次
GET    /api/mobile/{factoryId}/material-batches/expiring             - 即将过期
```

**查询与统计 (10个)**:
```
GET    /api/mobile/{factoryId}/material-batches/by-material/{materialId}  - 按材料查询
GET    /api/mobile/{factoryId}/material-batches/by-supplier/{supplierId}  - 按供应商查询
GET    /api/mobile/{factoryId}/material-batches/by-status/{status}        - 按状态查询
GET    /api/mobile/{factoryId}/material-batches/low-stock                 - 低库存批次
GET    /api/mobile/{factoryId}/material-batches/search                    - 搜索批次
GET    /api/mobile/{factoryId}/material-batches/stats                     - 统计数据
GET    /api/mobile/{factoryId}/material-batches/check-availability       - 检查可用性
POST   /api/mobile/{factoryId}/material-batches/batch-reserve             - 批量预留
PUT    /api/mobile/{factoryId}/material-batches/{batchId}/status          - 更新状态
GET    /api/mobile/{factoryId}/material-batches/summary                   - 汇总数据
```

#### 数据库表
```sql
CREATE TABLE material_batch (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_number VARCHAR(50) NOT NULL UNIQUE,
  factory_id VARCHAR(50) NOT NULL,
  material_type_id BIGINT NOT NULL,
  inbound_quantity DECIMAL(10,2) NOT NULL,
  remaining_quantity DECIMAL(10,2) NOT NULL,
  reserved_quantity DECIMAL(10,2) DEFAULT 0,
  used_quantity DECIMAL(10,2) DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  supplier_id BIGINT,
  inbound_date DATE NOT NULL,
  expiry_date DATE,
  production_date DATE,
  status VARCHAR(20) NOT NULL,
  quality_grade VARCHAR(10),
  storage_location VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_factory_material (factory_id, material_type_id),
  INDEX idx_status (status),
  INDEX idx_expiry (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 🟡 P1 - 高优先级（管理功能）

### 4. 产品类型管理 ⭐⭐
**API客户端**: `productTypeApiClient.ts`
**工作量**: 1-2天

#### 需要实现的API (12个)
```
GET    /api/mobile/{factoryId}/products/types                    - 获取列表
POST   /api/mobile/{factoryId}/products/types                    - 创建
GET    /api/mobile/{factoryId}/products/types/{id}               - 获取详情
PUT    /api/mobile/{factoryId}/products/types/{id}               - 更新
DELETE /api/mobile/{factoryId}/products/types/{id}               - 删除
GET    /api/mobile/{factoryId}/products/types/active             - 获取启用的
GET    /api/mobile/{factoryId}/products/types/category/{category} - 按类别查询
GET    /api/mobile/{factoryId}/products/types/search             - 搜索
GET    /api/mobile/{factoryId}/products/types/check-code         - 检查编码
GET    /api/mobile/{factoryId}/products/types/categories         - 获取分类
POST   /api/mobile/{factoryId}/products/types/init-defaults      - 初始化默认
PUT    /api/mobile/{factoryId}/products/types/batch/status       - 批量更新状态
```

---

### 5. 用户管理 ⭐⭐
**API客户端**: `userApiClient.ts`
**工作量**: 2天

#### 需要实现的API (14个)
```
GET    /api/{factoryId}/users                           - 获取用户列表（分页）
POST   /api/{factoryId}/users                           - 创建用户
GET    /api/{factoryId}/users/{userId}                  - 获取用户详情
PUT    /api/{factoryId}/users/{userId}                  - 更新用户信息
DELETE /api/{factoryId}/users/{userId}                  - 删除用户
PUT    /api/{factoryId}/users/{userId}/role             - 更新角色
PUT    /api/{factoryId}/users/{userId}/status           - 更新状态
PUT    /api/{factoryId}/users/{userId}/password         - 重置密码
GET    /api/{factoryId}/users/by-role/{roleCode}        - 按角色查询
GET    /api/{factoryId}/users/by-department/{dept}      - 按部门查询
GET    /api/{factoryId}/users/search                    - 搜索用户
GET    /api/{factoryId}/users/check-username            - 检查用户名
POST   /api/{factoryId}/users/batch                     - 批量创建
GET    /api/{factoryId}/users/roles                     - 获取角色列表
```

---

### 6. 供应商管理 ⭐
**API客户端**: `supplierApiClient.ts`
**工作量**: 1天

#### 需要实现的API (~10个)
```
GET    /api/mobile/{factoryId}/suppliers                - 获取列表
POST   /api/mobile/{factoryId}/suppliers                - 创建
GET    /api/mobile/{factoryId}/suppliers/{id}           - 获取详情
PUT    /api/mobile/{factoryId}/suppliers/{id}           - 更新
DELETE /api/mobile/{factoryId}/suppliers/{id}           - 删除
GET    /api/mobile/{factoryId}/suppliers/active         - 获取启用的
GET    /api/mobile/{factoryId}/suppliers/search         - 搜索
等...
```

---

### 7. 客户管理 ⭐
**API客户端**: `customerApiClient.ts`
**工作量**: 1天

类似供应商管理，约10个API

---

### 8. 白名单管理 ⭐
**API客户端**: `whitelistApiClient.ts`
**工作量**: 1天

#### 需要实现的API (~8个)
```
GET    /api/{factoryId}/whitelist                       - 获取列表
POST   /api/{factoryId}/whitelist                       - 添加
DELETE /api/{factoryId}/whitelist/{id}                  - 删除
等...
```

---

## 🟢 P2 - 中等优先级（辅助功能）

### 9. 生产计划管理
**API客户端**: `productionPlanApiClient.ts`
**工作量**: 2天
**API数量**: ~15个

---

### 10. 原材料类型管理
**API客户端**: `materialTypeApiClient.ts`
**工作量**: 1天
**API数量**: ~10个

---

### 11. 工种管理
**API客户端**: `workTypeApiClient.ts`
**工作量**: 1天
**API数量**: ~8个

---

### 12. 转化率管理
**API客户端**: `conversionApiClient.ts`
**工作量**: 1天
**API数量**: ~8个

---

### 13. Dashboard数据
**API客户端**: `dashboardApiClient.ts`
**工作量**: 1-2天
**API数量**: 4个

#### 需要实现的API
```
GET    /api/mobile/{factoryId}/processing/dashboard/overview         - 生产概览
GET    /api/mobile/{factoryId}/processing/dashboard/statistics       - 生产统计
GET    /api/mobile/{factoryId}/processing/dashboard/equipment        - 设备统计
GET    /api/mobile/{factoryId}/processing/dashboard/alerts           - 告警统计
```

---

### 14. 考勤统计
**API客户端**: `attendanceApiClient.ts`, `timeStatsApiClient.ts`
**工作量**: 1天
**API数量**: ~10个

---

### 15. 平台管理
**API客户端**: `platformApiClient.ts`
**工作量**: 2天
**API数量**: ~10个

---

### 16. 工厂设置
**API客户端**: `factorySettingsApiClient.ts`
**工作量**: 1天
**API数量**: ~8个

---

### 17. 员工管理
**API客户端**: `employeeApiClient.ts`
**工作量**: 1天
**API数量**: ~5个

---

## 📋 实现优先级建议

### 第一批（本周，5-7天）
1. ✅ **原材料规格配置** (1天) - P0，前端已完成
2. ✅ **产品类型管理** (1-2天) - P1，基础数据
3. ✅ **原材料类型管理** (1天) - P1，基础数据
4. ✅ **供应商管理** (1天) - P1，基础数据
5. ✅ **客户管理** (1天) - P1，基础数据

**预计工作量**: 5-7天

---

### 第二批（下周，7-10天）
1. ✅ **原材料批次管理** (2-3天) - P0，核心业务
2. ✅ **生产加工管理** (3-4天) - P0，核心业务
3. ✅ **工种管理** (1天) - P2
4. ✅ **转化率管理** (1天) - P2

**预计工作量**: 7-10天

---

### 第三批（第三周，5-7天）
1. ✅ **用户管理** (2天) - P1
2. ✅ **白名单管理** (1天) - P1
3. ✅ **生产计划管理** (2天) - P2
4. ✅ **Dashboard数据** (1-2天) - P2

**预计工作量**: 5-7天

---

### 第四批（第四周，3-5天）
1. ✅ **考勤统计** (1天) - P2
2. ✅ **平台管理** (2天) - P2
3. ✅ **工厂设置** (1天) - P2
4. ✅ **员工管理** (1天) - P2

**预计工作量**: 3-5天

---

## 📊 工作量总估算

| 批次 | 功能数 | 预计天数 | 累计天数 |
|------|--------|---------|---------|
| 第一批 | 5个 | 5-7天 | 5-7天 |
| 第二批 | 4个 | 7-10天 | 12-17天 |
| 第三批 | 4个 | 5-7天 | 17-24天 |
| 第四批 | 4个 | 3-5天 | 20-29天 |
| **总计** | **17个模块** | **20-29天** | **约1个月** |

**注意**:
- AI分析功能（~10个API）由另一个chat处理，不计入此清单
- 以上为单人全职开发的估算
- 如果多人并行开发，可缩短至2-3周

---

## 🚀 立即开始建议

基于用户需求和依赖关系，建议**立即开始实现第一批**：

### 优先级1: 原材料规格配置（1天）
- 前端已完成
- 用户急需
- 独立功能，无依赖

### 优先级2: 产品类型管理（1-2天）
- 基础数据，其他功能依赖
- 前端已完成
- 相对独立

### 优先级3: 供应商/客户管理（各1天）
- 基础数据
- 前端已完成
- 相对独立

---

## 📞 下一步行动

**您希望我立即开始实现哪个功能？**

建议选项：
1. **原材料规格配置** - 最快（1天），用户急需
2. **产品类型管理** - 基础数据，其他功能依赖
3. **供应商管理** - 基础数据，独立功能
4. **一次性实现第一批所有功能** - 5-7天完成基础数据管理

**或者您有其他优先级考虑？** 请告诉我！

---

**文档生成**: Claude (AI Assistant)
**审核**: Jietao Xie
**日期**: 2025-11-18
