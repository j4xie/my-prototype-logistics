# Phase 2 成本核算系统 - 后端需求文档

> 创建时间: 2025-10-03
> 状态: ✅ 已完成实现（上一会话）
> 前端实现: ✅ Phase 2 完成
> 文档版本: 1.0

## 📋 文档概述

本文档记录 Phase 2 成本核算系统的后端实现需求。**注意：后端API已在上一会话中全部实现完成**，本文档仅作为实施记录和参考。

---

## ✅ 已实现的后端功能

### 1. 原料接收管理

#### API 端点
```
POST /api/mobile/processing/material-receipt
```

#### 请求参数
```typescript
{
  rawMaterialCategory: string,      // 原材料品类（鱼类名称）
  rawMaterialWeight: number,         // 重量(kg)
  rawMaterialCost: number,           // 成本(元)
  productCategory: 'fresh' | 'frozen', // 产品类别
  expectedPrice?: number,            // 预期售价(元/kg，可选)
  notes?: string                     // 备注
}
```

#### 响应数据
```typescript
{
  success: true,
  data: {
    id: string,
    batchNumber: string,            // 批次号（自动生成）
    factoryId: string,
    rawMaterialCategory: string,
    rawMaterialWeight: number,
    rawMaterialCost: number,
    productCategory: string,
    expectedPrice?: number,
    status: 'pending',              // 初始状态
    createdAt: string,
    // ... 其他字段
  }
}
```

#### 业务逻辑
- 自动生成唯一批次号 (格式: `BATCH_YYYYMMDD_XXXXX`)
- 记录原材料接收时间
- 初始化批次状态为 `pending`
- 关联当前工厂ID和操作员工ID

---

### 2. 员工打卡系统（CCR成本计算）

#### 2.1 上班打卡

**API 端点**
```
POST /api/mobile/processing/work-session/clock-in
```

**请求参数**
```typescript
{
  batchId: string,                  // 加工批次ID
  workTypeId?: string,              // 工种ID（可选）
  notes?: string                    // 备注
}
```

**响应数据**
```typescript
{
  success: true,
  data: {
    id: string,
    batchId: string,
    userId: number,
    startTime: string,              // ISO 8601格式
    ccrRate: number,                // CCR成本率(元/分钟)
    // user, batch关联数据
  }
}
```

**业务逻辑**
- 检查员工是否已有进行中的工作会话（防止重复打卡）
- 从用户信息获取月工资和预期工作分钟数
- 计算CCR成本率: `CCR = 月工资 ÷ 预期工作分钟数`
- 创建新的工作会话记录
- 设置 `startTime` 为当前时间
- `endTime` 设为 NULL（进行中）

---

#### 2.2 下班打卡

**API 端点**
```
POST /api/mobile/processing/work-session/clock-out
```

**请求参数**
```typescript
{
  sessionId?: string,               // 工作会话ID（可选，不传则自动查找）
  processedQuantity?: number,       // 加工数量（可选）
  notes?: string                    // 备注
}
```

**响应数据**
```typescript
{
  success: true,
  data: {
    id: string,
    batchId: string,
    userId: number,
    startTime: string,
    endTime: string,                // 下班时间
    totalMinutes: number,           // 总工作分钟数
    ccrRate: number,
    laborCost: number,              // 人工成本 = CCR × totalMinutes
    processedQuantity?: number,
    // ... 关联数据
  }
}
```

**业务逻辑**
- 查找当前员工进行中的工作会话
- 设置 `endTime` 为当前时间
- 计算 `totalMinutes` = (endTime - startTime) / 60000
- 计算 `laborCost` = ccrRate × totalMinutes
- 更新 `processedQuantity`（如提供）
- 触发批次成本重新计算

---

#### 2.3 查询进行中的工作会话

**API 端点**
```
GET /api/mobile/processing/work-session/active
```

**响应数据**
```typescript
{
  success: true,
  data: {
    id: string,
    batchId: string,
    userId: number,
    startTime: string,
    ccrRate: number,
    // ... 完整工作会话数据
  } | null  // 如果没有进行中的会话则返回null
}
```

**业务逻辑**
- 查询当前用户的工作会话
- 条件: `endTime IS NULL` (进行中)
- 包含关联的批次信息和用户信息

---

### 3. 设备使用管理

#### 3.1 开始使用设备

**API 端点**
```
POST /api/mobile/processing/equipment-usage/start
```

**请求参数**
```typescript
{
  batchId: string,                  // 加工批次ID
  equipmentId: string,              // 设备ID
  notes?: string                    // 备注
}
```

**响应数据**
```typescript
{
  success: true,
  data: {
    id: string,
    batchId: string,
    equipmentId: string,
    startTime: string,
    hourlyRate: number,             // 设备小时成本
    // equipment, batch关联数据
  }
}
```

**业务逻辑**
- 检查设备是否已在使用中
- 从设备信息获取 `hourlyOperationCost`
- 创建设备使用记录
- 设置 `startTime` 为当前时间
- `endTime` 设为 NULL（使用中）

---

#### 3.2 结束使用设备

**API 端点**
```
POST /api/mobile/processing/equipment-usage/end
```

**请求参数**
```typescript
{
  usageId?: string,                 // 使用记录ID（可选）
  notes?: string                    // 备注
}
```

**响应数据**
```typescript
{
  success: true,
  data: {
    id: string,
    batchId: string,
    equipmentId: string,
    startTime: string,
    endTime: string,
    totalMinutes: number,
    hourlyRate: number,
    equipmentCost: number,          // 设备成本 = (hourlyRate/60) × totalMinutes
    // ... 关联数据
  }
}
```

**业务逻辑**
- 查找设备的进行中使用记录
- 设置 `endTime` 为当前时间
- 计算 `totalMinutes` = (endTime - startTime) / 60000
- 计算 `equipmentCost` = (hourlyRate / 60) × totalMinutes
- 触发批次成本重新计算

---

#### 3.3 获取设备列表

**API 端点**
```
GET /api/mobile/processing/equipment
```

**查询参数**
```typescript
{
  factoryId?: string,               // 工厂ID（可选）
  type?: string,                    // 设备类型（可选）
  status?: string                   // 设备状态（可选）
}
```

**响应数据**
```typescript
{
  success: true,
  data: [
    {
      id: string,
      equipmentCode: string,        // 设备编号
      equipmentName: string,        // 设备名称
      type: string,                 // 设备类型
      status: 'idle' | 'in_use' | 'maintenance',
      hourlyOperationCost: number,  // 小时成本
      factoryId: string,
      // ... 其他字段
    }
  ]
}
```

---

#### 3.4 获取设备进行中使用记录

**API 端点**
```
GET /api/mobile/processing/equipment/:equipmentId/active-usage
```

**响应数据**
```typescript
{
  success: true,
  data: {
    id: string,
    equipmentId: string,
    batchId: string,
    startTime: string,
    hourlyRate: number,
    // ... 完整使用记录
  } | null
}
```

---

### 4. 成本分析系统

#### 4.1 获取批次成本分析

**API 端点**
```
GET /api/mobile/processing/batches/:batchId/cost-analysis
```

**响应数据**
```typescript
{
  success: true,
  data: {
    batch: {
      id: string,
      batchNumber: string,
      rawMaterialCategory: string,
      rawMaterialWeight: number,
      rawMaterialCost: number,
      expectedPrice?: number,
      // ... 批次信息
    },

    laborStats: {
      totalEmployees: number,       // 参与员工数
      totalMinutes: number,         // 总工时（分钟）
      totalCost: number,            // 总人工成本
      sessions: [                   // 工作会话明细
        {
          id: string,
          user: { fullName, department },
          startTime: string,
          endTime: string,
          totalMinutes: number,
          ccrRate: number,
          laborCost: number,
        }
      ]
    },

    equipmentStats: {
      totalEquipment: number,       // 使用设备数
      totalMinutes: number,         // 总使用时长（分钟）
      totalCost: number,            // 总设备成本
      usages: [                     // 设备使用明细
        {
          id: string,
          equipment: { equipmentCode, equipmentName },
          startTime: string,
          endTime: string,
          totalMinutes: number,
          hourlyRate: number,
          equipmentCost: number,
        }
      ]
    },

    costBreakdown: {
      rawMaterialCost: number,
      rawMaterialPercentage: string, // "45.5%"
      laborCost: number,
      laborPercentage: string,       // "30.2%"
      equipmentCost: number,
      equipmentPercentage: string,   // "15.3%"
      otherCosts: number,
      otherCostsPercentage: string,  // "9.0%"
      totalCost: number,
    },

    profitAnalysis: {
      expectedRevenue?: number,      // 预期收入（如有expectedPrice）
      profitMargin?: number,         // 利润
      profitMarginPercentage?: string, // "15.5%"
      breakEvenPrice?: number,       // 盈亏平衡价（元/kg）
    }
  }
}
```

**业务逻辑**
- 查询批次基本信息
- 汇总所有工作会话的人工成本
- 汇总所有设备使用记录的设备成本
- 计算总成本和各项成本占比
- 如有预期售价，计算利润分析
- 计算盈亏平衡价: `总成本 ÷ 原材料重量`

---

#### 4.2 重新计算批次成本

**API 端点**
```
POST /api/mobile/processing/batches/:batchId/recalculate-cost
```

**响应数据**
```typescript
{
  success: true,
  data: {
    // 同 4.1 的响应结构
  }
}
```

**业务逻辑**
- 重新查询并计算所有成本项
- 更新批次的缓存成本数据（如有）
- 返回最新的成本分析结果

---

#### 4.3 导出成本报告

**API 端点**
```
POST /api/mobile/processing/batches/:batchId/export
```

**请求参数**
```typescript
{
  format: 'excel' | 'pdf',
  includeLaborDetails: boolean,
  includeEquipmentDetails: boolean,
  includeCostBreakdown: boolean,
}
```

**响应数据**
```typescript
{
  success: true,
  data: {
    downloadUrl: string,            // 下载链接
    filename: string,               // 文件名
    expiresAt: string,              // 过期时间
  }
}
```

**业务逻辑**（Phase 3 实现）
- 根据 `format` 生成Excel或PDF文件
- 包含指定的明细数据
- 上传到临时存储（或云存储）
- 返回可下载的URL（有效期24小时）

---

#### 4.4 获取批次列表

**API 端点**
```
GET /api/mobile/processing/batches
```

**查询参数**
```typescript
{
  factoryId?: string,
  status?: string,                  // 'pending' | 'processing' | 'completed'
  dateFrom?: string,                // ISO 8601日期
  dateTo?: string,
  limit?: number,
  offset?: number,
}
```

**响应数据**
```typescript
{
  success: true,
  data: {
    batches: [
      {
        id: string,
        batchNumber: string,
        rawMaterialCategory: string,
        rawMaterialWeight: number,
        rawMaterialCost: number,
        status: string,
        totalCost?: number,         // 如已计算
        createdAt: string,
      }
    ],
    total: number,
    limit: number,
    offset: number,
  }
}
```

---

## 📊 数据库表结构

### 1. processing_batches (加工批次)
```sql
CREATE TABLE processing_batches (
  id VARCHAR(36) PRIMARY KEY,
  batch_number VARCHAR(100) UNIQUE NOT NULL,
  factory_id VARCHAR(36) NOT NULL,

  -- 原材料信息
  raw_material_category VARCHAR(255) NOT NULL,
  raw_material_weight DECIMAL(10,2) NOT NULL,
  raw_material_cost DECIMAL(10,2) NOT NULL,

  -- 产品信息
  product_category ENUM('fresh', 'frozen') NOT NULL,
  expected_price DECIMAL(10,2),

  -- 成本汇总
  total_labor_cost DECIMAL(10,2) DEFAULT 0,
  total_equipment_cost DECIMAL(10,2) DEFAULT 0,
  total_other_costs DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) GENERATED ALWAYS AS (
    raw_material_cost + total_labor_cost + total_equipment_cost + total_other_costs
  ) STORED,

  -- 状态
  status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
  notes TEXT,

  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,
  INDEX idx_batch_number (batch_number),
  INDEX idx_factory_status (factory_id, status),
  INDEX idx_created_at (created_at)
);
```

---

### 2. work_sessions (工作会话)
```sql
CREATE TABLE work_sessions (
  id VARCHAR(36) PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL,
  user_id INT NOT NULL,
  work_type_id VARCHAR(36),

  -- 时间信息
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  total_minutes INT GENERATED ALWAYS AS (
    TIMESTAMPDIFF(MINUTE, start_time, end_time)
  ) STORED,

  -- 成本信息
  ccr_rate DECIMAL(10,4) NOT NULL,  -- CCR成本率(元/分钟)
  labor_cost DECIMAL(10,2) GENERATED ALWAYS AS (
    ccr_rate * total_minutes
  ) STORED,

  -- 加工信息
  processed_quantity INT,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (batch_id) REFERENCES processing_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (work_type_id) REFERENCES work_types(id) ON DELETE SET NULL,

  INDEX idx_batch_user (batch_id, user_id),
  INDEX idx_active_sessions (user_id, end_time),
  INDEX idx_start_time (start_time)
);
```

---

### 3. equipment_usage (设备使用记录)
```sql
CREATE TABLE equipment_usage (
  id VARCHAR(36) PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL,
  equipment_id VARCHAR(36) NOT NULL,

  -- 时间信息
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  total_minutes INT GENERATED ALWAYS AS (
    TIMESTAMPDIFF(MINUTE, start_time, end_time)
  ) STORED,

  -- 成本信息
  hourly_rate DECIMAL(10,2) NOT NULL,  -- 设备小时成本
  equipment_cost DECIMAL(10,2) GENERATED ALWAYS AS (
    (hourly_rate / 60) * total_minutes
  ) STORED,

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (batch_id) REFERENCES processing_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (equipment_id) REFERENCES factory_equipment(id) ON DELETE CASCADE,

  INDEX idx_batch_equipment (batch_id, equipment_id),
  INDEX idx_active_usage (equipment_id, end_time),
  INDEX idx_start_time (start_time)
);
```

---

### 4. factory_equipment (工厂设备)
```sql
CREATE TABLE factory_equipment (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(36) NOT NULL,

  equipment_code VARCHAR(100) UNIQUE NOT NULL,
  equipment_name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,

  -- 成本信息
  hourly_operation_cost DECIMAL(10,2) NOT NULL,  -- 小时运行成本
  purchase_cost DECIMAL(12,2),                   -- 采购成本
  maintenance_cost_yearly DECIMAL(10,2),         // 年维护成本

  -- 状态信息
  status ENUM('idle', 'in_use', 'maintenance', 'retired') DEFAULT 'idle',
  location VARCHAR(255),

  -- 时间戳
  purchase_date DATE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,

  INDEX idx_factory_status (factory_id, status),
  INDEX idx_equipment_code (equipment_code),
  INDEX idx_type (type)
);
```

---

### 5. work_types (工种定义)
```sql
CREATE TABLE work_types (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(36),

  work_type_code VARCHAR(50) NOT NULL,
  work_type_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- 标准工时和成本
  standard_hours_per_day DECIMAL(4,2) DEFAULT 8,
  suggested_hourly_rate DECIMAL(10,2),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,

  UNIQUE KEY uk_factory_code (factory_id, work_type_code),
  INDEX idx_active (is_active)
);
```

---

## 🔄 触发器和存储过程

### 1. 自动更新批次总成本
```sql
CREATE TRIGGER update_batch_total_cost
AFTER INSERT OR UPDATE ON work_sessions
FOR EACH ROW
BEGIN
  UPDATE processing_batches
  SET total_labor_cost = (
    SELECT COALESCE(SUM(labor_cost), 0)
    FROM work_sessions
    WHERE batch_id = NEW.batch_id AND end_time IS NOT NULL
  )
  WHERE id = NEW.batch_id;
END;

CREATE TRIGGER update_batch_equipment_cost
AFTER INSERT OR UPDATE ON equipment_usage
FOR EACH ROW
BEGIN
  UPDATE processing_batches
  SET total_equipment_cost = (
    SELECT COALESCE(SUM(equipment_cost), 0)
    FROM equipment_usage
    WHERE batch_id = NEW.batch_id AND end_time IS NOT NULL
  )
  WHERE id = NEW.batch_id;
END;
```

---

### 2. 自动生成批次号
```sql
CREATE TRIGGER generate_batch_number
BEFORE INSERT ON processing_batches
FOR EACH ROW
BEGIN
  IF NEW.batch_number IS NULL THEN
    SET NEW.batch_number = CONCAT(
      'BATCH_',
      DATE_FORMAT(NOW(), '%Y%m%d'),
      '_',
      LPAD(
        (SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number, -5) AS UNSIGNED)), 0) + 1
         FROM processing_batches
         WHERE batch_number LIKE CONCAT('BATCH_', DATE_FORMAT(NOW(), '%Y%m%d'), '_%')),
        5,
        '0'
      )
    );
  END IF;
END;
```

---

## 🔐 权限和安全

### 所需权限
- `processing:create` - 创建加工批次
- `processing:read` - 查看加工数据
- `processing:update` - 更新加工信息
- `processing:delete` - 删除加工记录
- `processing:clock` - 员工打卡
- `processing:equipment` - 设备使用管理
- `processing:cost_analysis` - 成本分析查看
- `processing:export` - 数据导出

### 中间件验证
所有API端点都应用以下中间件：
1. `mobileAuthMiddleware` - 验证移动端身份
2. `checkPermission([permissions])` - 验证权限
3. `validateRequest(schema)` - 验证请求参数（Zod）

---

## 📈 性能优化

### 1. 数据库索引
- `batch_number` - 唯一索引，快速查询
- `(factory_id, status)` - 组合索引，工厂批次列表查询
- `(user_id, end_time)` - 查询进行中的工作会话
- `(equipment_id, end_time)` - 查询设备使用状态

### 2. 计算字段优化
- 使用 `GENERATED ALWAYS AS ... STORED` 预计算:
  - `total_minutes` - 总分钟数
  - `labor_cost` - 人工成本
  - `equipment_cost` - 设备成本
  - `total_cost` - 总成本

### 3. 缓存策略
- 成本分析结果缓存（5分钟有效期）
- 设备列表缓存（10分钟有效期）
- 批次列表缓存（按状态分别缓存）

---

## 📝 待实现功能（Phase 3）

### 1. 数据导出功能
- Excel格式导出（使用 `exceljs`）
- PDF格式导出（使用 `pdfkit` 或 `puppeteer`）
- 临时文件存储和清理
- 下载链接过期管理

### 2. 批量操作
- 批量打卡（多人同时上班/下班）
- 批量设备启停
- 批次批量状态更新

### 3. 统计分析
- 工厂总体成本趋势分析
- 员工效率分析
- 设备利用率分析
- 成本预测模型

---

## 🐛 已知问题和改进

### 1. CCR计算优化
**当前实现**: 从用户信息直接获取月工资和预期工时
**改进建议**:
- 支持动态CCR调整（加班、节假日）
- 支持不同工种的不同CCR率
- 历史CCR变化记录

### 2. 设备成本计算
**当前实现**: 仅使用小时运行成本
**改进建议**:
- 考虑设备折旧成本
- 考虑维护成本摊销
- 动态调整设备成本率

### 3. 成本分类
**当前实现**: 原材料、人工、设备、其他
**改进建议**:
- 更细粒度的成本分类
- 间接成本分摊
- 税费和管理费计算

---

## 🚀 部署清单

### 1. 数据库迁移
```bash
npx prisma migrate dev --name add_cost_accounting_tables
npx prisma generate
```

### 2. 环境变量
```env
# 已有配置
DATABASE_URL=...
JWT_SECRET=...

# Phase 2 新增（可选）
ENABLE_COST_CACHE=true
COST_CACHE_TTL=300        # 5分钟
EXPORT_FILE_TTL=86400     # 24小时
```

### 3. 种子数据
```bash
npm run seed:equipment    # 初始化设备数据
npm run seed:work-types   # 初始化工种数据
```

---

## 📞 技术支持

**后端实现参考**: 上一会话的完整实现
**前端实现**: [PHASE2_COST_ACCOUNTING_IMPLEMENTATION.md](../frontend/CretasFoodTrace/PHASE2_COST_ACCOUNTING_IMPLEMENTATION.md)
**数据库Schema**: `backend/prisma/schema.prisma`

---

**文档版本**: 1.0
**最后更新**: 2025-10-03
**状态**: ✅ 后端已完成，前端已完成，文档已整理
