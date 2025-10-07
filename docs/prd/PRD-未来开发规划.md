# 白垩纪食品溯源系统 - 未来开发规划 (Roadmap)

**文档版本**: v1.0
**创建日期**: 2025-01-05
**规划周期**: 2025 Q1 - 2026 Q4
**当前状态**: Phase 0-3 已完成 ✅

---

## 📋 目录

1. [项目现状回顾](#项目现状回顾)
2. [Gap分析总结](#gap分析总结)
3. [Phase 4: 供应链与库存管理](#phase-4-供应链与库存管理) (2025 Q1)
4. [Phase 5: 食品安全合规](#phase-5-食品安全合规) (2025 Q2)
5. [Phase 6: 冷链与包装](#phase-6-冷链与包装) (2025 Q3)
6. [Phase 7: 质量改进与完善](#phase-7-质量改进与完善) (2025 Q4)
7. [Phase 8+: 业务拓展](#phase-8-业务拓展) (2026+)
8. [技术架构演进](#技术架构演进)
9. [资源需求与预算](#资源需求与预算)

---

## 📊 项目现状回顾

### ✅ Phase 0-3 已完成功能 (2024 Q4)

#### Phase 1: 认证与权限系统
- ✅ 统一登录系统（平台用户+工厂用户）
- ✅ 两阶段注册（手机验证+信息完善）
- ✅ 生物识别登录（指纹/Face ID）
- ✅ 设备绑定与管理
- ✅ 7级角色权限体系（platform_admin → factory_super_admin → permission_admin → department_admin → operator → viewer → unactivated）
- ✅ 批量权限检查
- ✅ 白名单管理

#### Phase 2: 生产执行系统 (MES核心)
- ✅ 原料接收管理
- ✅ 生产批次管理（批次创建、流程控制、时间线）
- ✅ 质量检验（三阶段质检：原料/过程/成品）
- ✅ 员工打卡系统（GPS验证、照片打卡）
- ✅ 工时统计（日/周/月统计）
- ✅ 工作时段管理（批次关联工时）
- ✅ 设备实时监控
- ✅ 设备使用与成本核算
- ✅ 成本核算系统（原料成本+人工成本+设备成本）
- ✅ AI成本分析（DeepSeek LLM集成）
- ✅ 告警系统（质量/设备/生产告警）
- ✅ 仪表板系统（生产/质量/成本/设备/告警）

#### Phase 3: 系统管理与发布
- ✅ 应用激活管理
- ✅ 报表生成与导出（PDF/Excel/CSV）
- ✅ 系统日志与审计
- ✅ API访问日志
- ✅ 移动端优化（相机/GPS/离线功能规划）

### 📈 当前系统能力

**技术栈**:
- 前端: React Native 0.76+ / Expo 53+
- 后端: Node.js 18+ / Express.js / Prisma ORM
- 数据库: MySQL 8.0+ (可迁移PostgreSQL)
- AI: DeepSeek LLM

**核心指标**:
- 数据库表: 30+ 张核心表
- API端点: 80+ 个移动端API
- 用户角色: 7级权限体系
- 功能模块: 8大核心模块

---

## 🔍 Gap分析总结

基于对真实食品加工厂业务流程的调研，我们发现当前系统在以下方面存在**重要缺失**：

### ❌ 严重缺失功能（P0优先级）

| 功能模块 | 缺失原因 | 业务影响 | 法规要求 |
|---------|---------|---------|---------|
| **库存管理系统** | 完全缺失 | 无法进行库存追踪和FIFO管理 | ⚠️ 必须 |
| **食品安全合规** | 部分支持 | 无法满足HACCP/GMP认证 | 🔴 强制 |
| **保质期管理** | 完全缺失 | 无法防止过期产品流通 | ⚠️ 必须 |

### ⚠️ 重要缺失功能（P1优先级）

| 功能模块 | 缺失原因 | 业务影响 |
|---------|---------|---------|
| **供应链管理** | 完全缺失 | 业务流程不完整（缺少采购、销售） |
| **冷链温度监控** | 完全缺失 | 无法追溯温度历史 |
| **产品包装与标签** | 完全缺失 | 无法生成追溯码 |

### 💡 改进建议功能（P2优先级）

| 功能模块 | 缺失原因 | 业务价值 |
|---------|---------|---------|
| **客户投诉管理** | 完全缺失 | 质量改进闭环 |
| **Web管理后台** | 完全缺失 | 提升管理效率 |

### 系统定位调整

**当前定位**: 生产执行系统（MES）
**目标定位**: **MES + 轻量化ERP + QMS(质量管理)**

```
白垩纪溯源系统 3.0
├── MES (生产执行) - Phase 1-3 已完成 ✅
├── SCM (供应链管理) - Phase 4 新增 🆕
├── QMS (质量与合规) - Phase 5 新增 🆕
└── WMS (仓储管理) - Phase 4-6 新增 🆕
```

---

## 🚀 Phase 4: 供应链与库存管理

**时间周期**: 2025年1月 - 2025年3月 (12周)
**核心目标**: 补齐业务闭环，实现采购-生产-销售全流程管理
**优先级**: 🔴 P0（最高优先级）

### 4.1 库存管理系统 ⭐⭐⭐⭐⭐

#### 功能清单

**基础库存管理**:
- ✅ 库存主数据管理（原料/半成品/成品/包装材料）
- ✅ 多仓库管理（原料仓、成品仓、冷库）
- ✅ 库存分区管理（仓库内位置管理）
- ✅ 批次库存管理（每批次独立追踪）

**库存操作**:
- ✅ 入库管理（采购入库、生产入库、退货入库）
- ✅ 出库管理（生产领用、销售出库、报废出库）
- ✅ 库存调整（盘盈、盘亏、调拨）
- ✅ 库存转移（仓库间转移）

**FIFO与保质期**:
- ✅ 先进先出（FIFO）自动排序
- ✅ 保质期自动计算（生产日期+保质期天数）
- ✅ 过期预警（7天/3天/1天多级预警）
- ✅ 近效期产品标识
- ✅ 过期产品自动隔离

**库存盘点**:
- ✅ 盘点计划创建
- ✅ 移动端盘点录入（扫码盘点）
- ✅ 盘点差异分析
- ✅ 盘点结果确认与调整

**库存预警**:
- ✅ 安全库存设置
- ✅ 低库存预警
- ✅ 超库存预警
- ✅ 呆滞库存分析

#### 数据库设计

```sql
-- 仓库管理表
CREATE TABLE warehouses (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  warehouse_code VARCHAR(50) NOT NULL,
  warehouse_name VARCHAR(255) NOT NULL,
  warehouse_type ENUM('raw_material', 'finished_product', 'cold_storage', 'packaging') NOT NULL,
  temperature_range VARCHAR(50), -- 温度范围 "-18°C ~ -20°C"
  humidity_range VARCHAR(50),    -- 湿度范围 "60% ~ 80%"
  capacity DECIMAL(12,2),        -- 容量（立方米）
  current_usage DECIMAL(12,2) DEFAULT 0,
  manager_id INT,
  location VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,
  FOREIGN KEY (manager_id) REFERENCES users(id),
  UNIQUE KEY unique_factory_warehouse (factory_id, warehouse_code),
  INDEX idx_type (warehouse_type),
  INDEX idx_factory_active (factory_id, is_active)
);

-- 库存主表
CREATE TABLE inventory_stocks (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  item_type ENUM('raw_material', 'semi_finished', 'finished_product', 'packaging') NOT NULL,
  item_code VARCHAR(100) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  batch_number VARCHAR(100),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL,
  location VARCHAR(100),        -- 库位 "A区-01-03"

  -- 成本信息
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(12,2),

  -- 日期信息
  production_date DATE,
  expiry_date DATE,
  shelf_life_days INT,          -- 保质期天数
  days_to_expiry INT GENERATED ALWAYS AS (DATEDIFF(expiry_date, CURRENT_DATE)) STORED,

  -- 状态信息
  status ENUM('in_stock', 'reserved', 'out_of_stock', 'expired', 'quarantine') DEFAULT 'in_stock',

  -- 关联信息
  reference_type VARCHAR(50),   -- 'purchase_order', 'production_batch'
  reference_id VARCHAR(36),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  UNIQUE KEY unique_stock (factory_id, warehouse_id, item_code, batch_number),
  INDEX idx_batch_expiry (batch_number, expiry_date),
  INDEX idx_factory_item (factory_id, item_code),
  INDEX idx_status (status),
  INDEX idx_expiry_warning (days_to_expiry, status)
);

-- 库存变动记录表
CREATE TABLE inventory_transactions (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  stock_id VARCHAR(36) NOT NULL,
  transaction_type ENUM('in', 'out', 'adjust', 'transfer', 'freeze', 'unfreeze') NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  quantity_before DECIMAL(10,2) NOT NULL,
  quantity_after DECIMAL(10,2) NOT NULL,

  -- 关联信息
  reference_type VARCHAR(50),   -- 'purchase_order', 'sales_order', 'production_batch', 'stocktaking'
  reference_id VARCHAR(36),
  reference_number VARCHAR(100),

  -- 转移信息（仅transfer类型）
  from_warehouse_id VARCHAR(36),
  to_warehouse_id VARCHAR(36),

  operator_id INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (stock_id) REFERENCES inventory_stocks(id),
  FOREIGN KEY (operator_id) REFERENCES users(id),
  INDEX idx_stock_transaction (stock_id, created_at),
  INDEX idx_factory_date (factory_id, created_at),
  INDEX idx_reference (reference_type, reference_id)
);

-- 库存盘点表
CREATE TABLE inventory_stocktakings (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  stocktaking_number VARCHAR(100) UNIQUE NOT NULL,
  warehouse_id VARCHAR(36),     -- NULL表示全部仓库盘点
  stocktaking_type ENUM('full', 'partial', 'cycle') NOT NULL,
  status ENUM('draft', 'in_progress', 'completed', 'cancelled') DEFAULT 'draft',

  planned_date DATE NOT NULL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,

  total_items INT DEFAULT 0,
  counted_items INT DEFAULT 0,
  difference_items INT DEFAULT 0,

  created_by INT NOT NULL,
  approved_by INT,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_factory_status (factory_id, status),
  INDEX idx_planned_date (planned_date)
);

-- 库存盘点明细表
CREATE TABLE inventory_stocktaking_items (
  id VARCHAR(36) PRIMARY KEY,
  stocktaking_id VARCHAR(36) NOT NULL,
  stock_id VARCHAR(36) NOT NULL,

  system_quantity DECIMAL(10,2) NOT NULL,  -- 系统数量
  actual_quantity DECIMAL(10,2),           -- 实际数量
  difference_quantity DECIMAL(10,2),       -- 差异数量

  status ENUM('pending', 'counted', 'adjusted') DEFAULT 'pending',
  counter_id INT,
  counted_at TIMESTAMP,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (stocktaking_id) REFERENCES inventory_stocktakings(id) ON DELETE CASCADE,
  FOREIGN KEY (stock_id) REFERENCES inventory_stocks(id),
  FOREIGN KEY (counter_id) REFERENCES users(id),
  INDEX idx_stocktaking (stocktaking_id),
  INDEX idx_status (status)
);

-- 安全库存设置表
CREATE TABLE inventory_safety_stocks (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  item_code VARCHAR(100) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_type ENUM('raw_material', 'semi_finished', 'finished_product', 'packaging') NOT NULL,

  safety_stock_min DECIMAL(10,2) NOT NULL,  -- 安全库存下限
  safety_stock_max DECIMAL(10,2),           -- 安全库存上限
  reorder_point DECIMAL(10,2),              -- 再订货点

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  UNIQUE KEY unique_factory_item (factory_id, item_code),
  INDEX idx_factory_type (factory_id, item_type)
);
```

#### API端点设计

```
# 仓库管理
GET    /api/mobile/warehouses                          - 仓库列表
POST   /api/mobile/warehouses                          - 创建仓库
GET    /api/mobile/warehouses/:id                      - 仓库详情
PUT    /api/mobile/warehouses/:id                      - 更新仓库
GET    /api/mobile/warehouses/:id/stocks               - 仓库库存列表
GET    /api/mobile/warehouses/:id/capacity             - 仓库容量分析

# 库存查询
GET    /api/mobile/inventory/stocks                    - 库存列表（FIFO排序）
GET    /api/mobile/inventory/stocks/:id                - 库存详情
GET    /api/mobile/inventory/stocks/:id/history        - 库存变动历史
GET    /api/mobile/inventory/summary                   - 库存汇总统计
GET    /api/mobile/inventory/by-item/:itemCode         - 按物料查询库存
GET    /api/mobile/inventory/by-batch/:batchNumber     - 按批次查询库存

# 库存预警
GET    /api/mobile/inventory/alerts/low-stock          - 低库存预警
GET    /api/mobile/inventory/alerts/expiring           - 即将过期预警（7天内）
GET    /api/mobile/inventory/alerts/expired            - 已过期库存
GET    /api/mobile/inventory/alerts/slow-moving        - 呆滞库存分析

# 库存操作
POST   /api/mobile/inventory/in                        - 入库
POST   /api/mobile/inventory/out                       - 出库
POST   /api/mobile/inventory/adjust                    - 库存调整
POST   /api/mobile/inventory/transfer                  - 库存转移
POST   /api/mobile/inventory/freeze                    - 冻结库存
POST   /api/mobile/inventory/unfreeze                  - 解冻库存
POST   /api/mobile/inventory/dispose                   - 处理过期/报废

# 库存盘点
POST   /api/mobile/inventory/stocktaking               - 创建盘点计划
GET    /api/mobile/inventory/stocktaking               - 盘点计划列表
GET    /api/mobile/inventory/stocktaking/:id           - 盘点详情
POST   /api/mobile/inventory/stocktaking/:id/start     - 开始盘点
POST   /api/mobile/inventory/stocktaking/:id/count     - 记录盘点数量
POST   /api/mobile/inventory/stocktaking/:id/complete  - 完成盘点
GET    /api/mobile/inventory/stocktaking/:id/diff      - 盘点差异报告

# 安全库存
GET    /api/mobile/inventory/safety-stocks             - 安全库存设置列表
POST   /api/mobile/inventory/safety-stocks             - 设置安全库存
PUT    /api/mobile/inventory/safety-stocks/:id         - 更新安全库存
```

#### 业务流程

```
采购入库流程:
采购订单 → 采购收货 → 质量检验 → 合格入库 → 创建库存记录 → FIFO排序

生产领用流程:
创建生产批次 → FIFO自动选择原料 → 出库审批 → 库存扣减 → 生产投料

销售出库流程:
销售订单 → FIFO自动选择成品 → 出库拣货 → 库存扣减 → 发货

库存盘点流程:
创建盘点计划 → 冻结库存 → 扫码盘点 → 差异分析 → 账务调整 → 解冻库存
```

#### 工作量估算
- 数据库设计与实现: 1周
- 后端API开发: 2周
- 前端UI开发: 2周
- 测试与优化: 1周
- **总计**: 6周

---

### 4.2 供应商与采购管理 ⭐⭐⭐⭐

#### 功能清单

**供应商管理**:
- ✅ 供应商档案管理
- ✅ 供应商分类（原料/包装/设备）
- ✅ 供应商评级（A/B/C/黑名单）
- ✅ 供应商资质管理（HACCP/ISO22000证书）
- ✅ 供应商绩效评估

**采购管理**:
- ✅ 采购需求计划（PR）
- ✅ 采购订单管理（PO）
- ✅ 采购收货与验收
- ✅ 采购退货管理
- ✅ 应付账款管理

**采购分析**:
- ✅ 采购成本分析
- ✅ 供应商供货分析
- ✅ 采购周期分析

#### 数据库设计

```sql
-- 供应商管理表
CREATE TABLE suppliers (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  supplier_code VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100),

  -- 联系信息
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  address TEXT,

  -- 分类信息
  supplier_type ENUM('raw_material', 'packaging', 'equipment', 'service') NOT NULL,
  product_categories JSON,      -- ["水产品", "冷冻食品"]

  -- 评级信息
  rating ENUM('A', 'B', 'C', 'blacklist') DEFAULT 'B',
  rating_score DECIMAL(3,2),    -- 评分 0-100
  last_rating_date DATE,

  -- 财务信息
  credit_days INT DEFAULT 30,   -- 账期天数
  credit_limit DECIMAL(12,2),   -- 信用额度

  -- 认证信息
  certifications JSON,           -- {"HACCP": true, "ISO22000": true, "license": "SC123..."}
  license_expiry_date DATE,

  -- 状态信息
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  approved_by INT,
  approved_at TIMESTAMP,

  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id),
  UNIQUE KEY unique_factory_supplier (factory_id, supplier_code),
  INDEX idx_type (supplier_type),
  INDEX idx_rating (rating),
  INDEX idx_active (is_active)
);

-- 采购订单主表
CREATE TABLE purchase_orders (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  po_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id VARCHAR(36) NOT NULL,

  order_type ENUM('standard', 'urgent', 'blanket') DEFAULT 'standard',
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  actual_delivery_date DATE,

  status ENUM('draft', 'submitted', 'confirmed', 'receiving', 'completed', 'cancelled') DEFAULT 'draft',

  -- 金额信息
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  currency VARCHAR(10) DEFAULT 'CNY',

  -- 收货信息
  delivery_address TEXT,
  warehouse_id VARCHAR(36),

  -- 审批信息
  created_by INT NOT NULL,
  approved_by INT,
  approved_at TIMESTAMP,

  notes TEXT,
  attachments JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_factory_status (factory_id, status),
  INDEX idx_supplier (supplier_id),
  INDEX idx_order_date (order_date)
);

-- 采购订单明细表
CREATE TABLE purchase_order_items (
  id VARCHAR(36) PRIMARY KEY,
  po_id VARCHAR(36) NOT NULL,

  item_code VARCHAR(100) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_type ENUM('raw_material', 'packaging', 'equipment', 'other') NOT NULL,
  specification VARCHAR(500),

  quantity DECIMAL(10,2) NOT NULL,
  received_quantity DECIMAL(10,2) DEFAULT 0,
  unit VARCHAR(20) NOT NULL,

  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0.13,
  total_price DECIMAL(12,2),

  expected_delivery_date DATE,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  INDEX idx_po_item (po_id, item_code)
);

-- 采购收货记录表
CREATE TABLE purchase_receipts (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  receipt_number VARCHAR(100) UNIQUE NOT NULL,
  po_id VARCHAR(36) NOT NULL,
  supplier_id VARCHAR(36) NOT NULL,

  receipt_date DATE NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,

  status ENUM('pending_inspection', 'inspecting', 'accepted', 'rejected', 'partial_accepted') DEFAULT 'pending_inspection',

  received_by INT NOT NULL,
  inspected_by INT,
  inspection_notes TEXT,

  photos JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (received_by) REFERENCES users(id),
  FOREIGN KEY (inspected_by) REFERENCES users(id),
  INDEX idx_factory_date (factory_id, receipt_date),
  INDEX idx_po (po_id),
  INDEX idx_status (status)
);

-- 采购收货明细表
CREATE TABLE purchase_receipt_items (
  id VARCHAR(36) PRIMARY KEY,
  receipt_id VARCHAR(36) NOT NULL,
  po_item_id VARCHAR(36) NOT NULL,

  ordered_quantity DECIMAL(10,2) NOT NULL,
  received_quantity DECIMAL(10,2) NOT NULL,
  accepted_quantity DECIMAL(10,2) DEFAULT 0,
  rejected_quantity DECIMAL(10,2) DEFAULT 0,

  unit VARCHAR(20) NOT NULL,

  quality_status ENUM('pass', 'fail', 'conditional_pass') DEFAULT 'pass',
  reject_reason TEXT,

  batch_number VARCHAR(100),
  production_date DATE,
  expiry_date DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (receipt_id) REFERENCES purchase_receipts(id) ON DELETE CASCADE,
  FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id),
  INDEX idx_receipt (receipt_id),
  INDEX idx_batch (batch_number)
);

-- 供应商绩效评估表
CREATE TABLE supplier_performance (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  supplier_id VARCHAR(36) NOT NULL,
  evaluation_period VARCHAR(20) NOT NULL,  -- "2025-Q1"

  -- 评估指标
  quality_score DECIMAL(5,2),       -- 质量评分 0-100
  delivery_score DECIMAL(5,2),      -- 交付评分 0-100
  price_score DECIMAL(5,2),         -- 价格评分 0-100
  service_score DECIMAL(5,2),       -- 服务评分 0-100
  overall_score DECIMAL(5,2),       -- 综合评分 0-100

  -- 统计数据
  total_orders INT DEFAULT 0,
  on_time_deliveries INT DEFAULT 0,
  quality_issues INT DEFAULT 0,

  evaluator_id INT,
  evaluation_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (evaluator_id) REFERENCES users(id),
  UNIQUE KEY unique_supplier_period (supplier_id, evaluation_period),
  INDEX idx_factory_period (factory_id, evaluation_period)
);
```

#### API端点设计

```
# 供应商管理
GET    /api/mobile/suppliers                           - 供应商列表
POST   /api/mobile/suppliers                           - 创建供应商
GET    /api/mobile/suppliers/:id                       - 供应商详情
PUT    /api/mobile/suppliers/:id                       - 更新供应商
POST   /api/mobile/suppliers/:id/approve               - 审批供应商
GET    /api/mobile/suppliers/:id/performance           - 供应商绩效
POST   /api/mobile/suppliers/:id/blacklist             - 加入黑名单

# 采购订单
POST   /api/mobile/purchase/orders                     - 创建采购订单
GET    /api/mobile/purchase/orders                     - 采购订单列表
GET    /api/mobile/purchase/orders/:id                 - 订单详情
PUT    /api/mobile/purchase/orders/:id                 - 更新订单
POST   /api/mobile/purchase/orders/:id/submit          - 提交审批
POST   /api/mobile/purchase/orders/:id/approve         - 审批订单
POST   /api/mobile/purchase/orders/:id/cancel          - 取消订单

# 采购收货
POST   /api/mobile/purchase/receipts                   - 创建收货记录
GET    /api/mobile/purchase/receipts                   - 收货记录列表
GET    /api/mobile/purchase/receipts/:id               - 收货详情
POST   /api/mobile/purchase/receipts/:id/inspect       - 质检收货
POST   /api/mobile/purchase/receipts/:id/accept        - 接受收货
POST   /api/mobile/purchase/receipts/:id/reject        - 拒绝收货
GET    /api/mobile/purchase/pending-receipts           - 待收货列表

# 采购分析
GET    /api/mobile/purchase/analysis/cost              - 采购成本分析
GET    /api/mobile/purchase/analysis/supplier          - 供应商分析
GET    /api/mobile/purchase/analysis/category          - 品类分析
```

#### 工作量估算
- 数据库设计与实现: 1周
- 后端API开发: 1.5周
- 前端UI开发: 1.5周
- 测试与优化: 1周
- **总计**: 5周

---

### 4.3 客户与销售管理 ⭐⭐⭐⭐

#### 功能清单

**客户管理**:
- ✅ 客户档案管理
- ✅ 客户分类（经销商/零售商/终端用户）
- ✅ 客户信用额度管理
- ✅ 客户送货地址管理

**销售管理**:
- ✅ 销售订单管理
- ✅ 销售发货管理
- ✅ 销售退货管理
- ✅ 应收账款管理

**销售分析**:
- ✅ 销售额统计
- ✅ 客户销售排名
- ✅ 产品销售排名

#### 数据库设计

```sql
-- 客户管理表
CREATE TABLE customers (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  customer_code VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100),

  -- 联系信息
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),

  -- 分类信息
  customer_type ENUM('distributor', 'retailer', 'end_user', 'export') NOT NULL,
  customer_level ENUM('VIP', 'A', 'B', 'C') DEFAULT 'B',

  -- 财务信息
  credit_days INT DEFAULT 30,
  credit_limit DECIMAL(12,2),
  current_receivable DECIMAL(12,2) DEFAULT 0,

  -- 状态信息
  is_active BOOLEAN DEFAULT true,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,
  UNIQUE KEY unique_factory_customer (factory_id, customer_code),
  INDEX idx_type (customer_type),
  INDEX idx_level (customer_level)
);

-- 客户送货地址表
CREATE TABLE customer_addresses (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,

  address_name VARCHAR(100),    -- "北京总部", "上海分公司"
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  province VARCHAR(50),
  city VARCHAR(50),
  district VARCHAR(50),
  detailed_address TEXT,
  postal_code VARCHAR(20),

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_customer (customer_id),
  INDEX idx_default (customer_id, is_default)
);

-- 销售订单主表
CREATE TABLE sales_orders (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  so_number VARCHAR(100) UNIQUE NOT NULL,
  customer_id VARCHAR(36) NOT NULL,

  order_type ENUM('standard', 'urgent', 'sample') DEFAULT 'standard',
  order_date DATE NOT NULL,
  delivery_date DATE,
  actual_delivery_date DATE,

  status ENUM('pending', 'confirmed', 'picking', 'shipped', 'delivered', 'completed', 'cancelled') DEFAULT 'pending',

  -- 金额信息
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  currency VARCHAR(10) DEFAULT 'CNY',

  -- 收货信息
  delivery_address_id VARCHAR(36),
  delivery_address TEXT,

  -- 审批信息
  created_by INT NOT NULL,
  approved_by INT,
  approved_at TIMESTAMP,

  notes TEXT,
  attachments JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (delivery_address_id) REFERENCES customer_addresses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_factory_status (factory_id, status),
  INDEX idx_customer (customer_id),
  INDEX idx_order_date (order_date)
);

-- 销售订单明细表
CREATE TABLE sales_order_items (
  id VARCHAR(36) PRIMARY KEY,
  so_id VARCHAR(36) NOT NULL,

  item_code VARCHAR(100) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  specification VARCHAR(500),

  quantity DECIMAL(10,2) NOT NULL,
  shipped_quantity DECIMAL(10,2) DEFAULT 0,
  unit VARCHAR(20) NOT NULL,

  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0.13,
  total_price DECIMAL(12,2),

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  INDEX idx_so_item (so_id, item_code)
);

-- 销售发货记录表
CREATE TABLE sales_shipments (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  shipment_number VARCHAR(100) UNIQUE NOT NULL,
  so_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,

  shipment_date DATE NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,

  status ENUM('preparing', 'shipped', 'in_transit', 'delivered', 'cancelled') DEFAULT 'preparing',

  -- 物流信息
  carrier VARCHAR(100),
  tracking_number VARCHAR(100),
  vehicle_number VARCHAR(50),
  driver_name VARCHAR(100),
  driver_phone VARCHAR(20),

  shipped_by INT NOT NULL,

  notes TEXT,
  photos JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (so_id) REFERENCES sales_orders(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (shipped_by) REFERENCES users(id),
  INDEX idx_factory_date (factory_id, shipment_date),
  INDEX idx_so (so_id),
  INDEX idx_status (status)
);

-- 销售发货明细表
CREATE TABLE sales_shipment_items (
  id VARCHAR(36) PRIMARY KEY,
  shipment_id VARCHAR(36) NOT NULL,
  so_item_id VARCHAR(36) NOT NULL,

  ordered_quantity DECIMAL(10,2) NOT NULL,
  shipped_quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,

  batch_number VARCHAR(100),
  production_date DATE,
  expiry_date DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (shipment_id) REFERENCES sales_shipments(id) ON DELETE CASCADE,
  FOREIGN KEY (so_item_id) REFERENCES sales_order_items(id),
  INDEX idx_shipment (shipment_id),
  INDEX idx_batch (batch_number)
);
```

#### API端点设计

```
# 客户管理
GET    /api/mobile/customers                           - 客户列表
POST   /api/mobile/customers                           - 创建客户
GET    /api/mobile/customers/:id                       - 客户详情
PUT    /api/mobile/customers/:id                       - 更新客户
GET    /api/mobile/customers/:id/addresses             - 客户地址列表
POST   /api/mobile/customers/:id/addresses             - 添加地址

# 销售订单
POST   /api/mobile/sales/orders                        - 创建销售订单
GET    /api/mobile/sales/orders                        - 销售订单列表
GET    /api/mobile/sales/orders/:id                    - 订单详情
PUT    /api/mobile/sales/orders/:id                    - 更新订单
POST   /api/mobile/sales/orders/:id/confirm            - 确认订单
POST   /api/mobile/sales/orders/:id/cancel             - 取消订单

# 销售发货
POST   /api/mobile/sales/shipments                     - 创建发货记录
GET    /api/mobile/sales/shipments                     - 发货记录列表
GET    /api/mobile/sales/shipments/:id                 - 发货详情
POST   /api/mobile/sales/shipments/:id/ship            - 确认发货
POST   /api/mobile/sales/shipments/:id/deliver         - 确认送达
GET    /api/mobile/sales/pending-shipments             - 待发货列表

# 销售分析
GET    /api/mobile/sales/analysis/revenue              - 销售额分析
GET    /api/mobile/sales/analysis/customer             - 客户分析
GET    /api/mobile/sales/analysis/product              - 产品销售分析
```

#### 工作量估算
- 数据库设计与实现: 0.5周
- 后端API开发: 1周
- 前端UI开发: 1周
- 测试与优化: 0.5周
- **总计**: 3周

---

### Phase 4 总结

**总工作量**: 14周 (约3.5个月)
**核心交付物**:
1. ✅ 完整的库存管理系统（FIFO、保质期、盘点）
2. ✅ 供应商与采购管理系统
3. ✅ 客户与销售管理系统
4. ✅ 业务闭环打通（采购→生产→销售）

**系统升级**:
- 从MES → MES + SCM
- 新增50+张数据库表
- 新增100+ API端点
- 实现完整业务流程追溯

---

## 🛡️ Phase 5: 食品安全合规

**时间周期**: 2025年4月 - 2025年6月 (12周)
**核心目标**: 满足HACCP/GMP/ISO22000法规要求
**优先级**: 🔴 P0（法规强制要求）

### 5.1 HACCP关键控制点管理 ⭐⭐⭐⭐⭐

#### 功能清单

**HACCP七大原理实现**:
1. ✅ 危害分析（Hazard Analysis）
2. ✅ 确定关键控制点（CCP）
3. ✅ 建立关键限值（Critical Limits）
4. ✅ 建立监控程序（Monitoring）
5. ✅ 建立纠正措施（Corrective Actions）
6. ✅ 建立验证程序（Verification）
7. ✅ 建立记录保持程序（Record Keeping）

**关键控制点类型**:
- ✅ 原料接收温度控制
- ✅ 加工过程温度/时间控制
- ✅ 冷却温度控制
- ✅ 金属检测
- ✅ 杀菌/消毒控制
- ✅ 成品检验

#### 数据库设计

```sql
-- HACCP计划表
CREATE TABLE haccp_plans (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  product_category VARCHAR(100),
  version VARCHAR(20) NOT NULL,

  status ENUM('draft', 'active', 'archived') DEFAULT 'draft',

  effective_date DATE,
  review_date DATE,
  next_review_date DATE,

  created_by INT,
  approved_by INT,
  approved_at TIMESTAMP,

  plan_document JSON,  -- HACCP计划完整内容

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  INDEX idx_factory_status (factory_id, status)
);

-- HACCP关键控制点定义表
CREATE TABLE haccp_ccps (
  id VARCHAR(36) PRIMARY KEY,
  haccp_plan_id VARCHAR(36) NOT NULL,
  factory_id VARCHAR(50) NOT NULL,

  ccp_number VARCHAR(20) NOT NULL,  -- "CCP-1", "CCP-2"
  ccp_name VARCHAR(255) NOT NULL,
  process_step VARCHAR(255),

  ccp_type ENUM(
    'receiving_temp',
    'cooking_temp',
    'cooling_temp',
    'cold_storage_temp',
    'metal_detection',
    'pasteurization',
    'ph_control',
    'water_activity',
    'chemical_residue'
  ) NOT NULL,

  -- 关键限值
  critical_limit_min DECIMAL(10,2),
  critical_limit_max DECIMAL(10,2),
  unit VARCHAR(20),

  -- 监控频率
  monitoring_frequency VARCHAR(100),  -- "每2小时", "每批次"
  monitoring_method TEXT,

  -- 纠正措施
  corrective_actions TEXT,

  -- 验证程序
  verification_procedure TEXT,
  verification_frequency VARCHAR(100),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (haccp_plan_id) REFERENCES haccp_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  INDEX idx_plan (haccp_plan_id),
  INDEX idx_type (ccp_type)
);

-- HACCP监控记录表
CREATE TABLE haccp_monitoring_records (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  ccp_id VARCHAR(36) NOT NULL,
  batch_id VARCHAR(36),  -- 可能关联生产批次

  monitoring_time TIMESTAMP NOT NULL,
  measured_value DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20),

  critical_limit_min DECIMAL(10,2),
  critical_limit_max DECIMAL(10,2),
  is_within_limit BOOLEAN GENERATED ALWAYS AS (
    measured_value BETWEEN critical_limit_min AND critical_limit_max
  ) STORED,

  -- 不符合时的处理
  deviation_detected BOOLEAN DEFAULT false,
  corrective_action_taken TEXT,
  corrective_action_by INT,

  monitoring_person INT NOT NULL,
  verified_by INT,
  verified_at TIMESTAMP,

  notes TEXT,
  photos JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (ccp_id) REFERENCES haccp_ccps(id),
  FOREIGN KEY (batch_id) REFERENCES processing_batches(id),
  FOREIGN KEY (monitoring_person) REFERENCES users(id),
  FOREIGN KEY (corrective_action_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id),
  INDEX idx_ccp_time (ccp_id, monitoring_time),
  INDEX idx_batch (batch_id),
  INDEX idx_deviation (deviation_detected, factory_id)
);

-- HACCP验证记录表
CREATE TABLE haccp_verification_records (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  haccp_plan_id VARCHAR(36) NOT NULL,

  verification_type ENUM(
    'calibration',          -- 设备校准
    'records_review',       -- 记录审查
    'product_testing',      -- 产品检测
    'system_audit'          -- 体系审核
  ) NOT NULL,

  verification_date DATE NOT NULL,

  verification_result ENUM('pass', 'fail', 'observation') NOT NULL,
  findings TEXT,
  corrective_actions TEXT,

  verified_by INT NOT NULL,

  attachments JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (haccp_plan_id) REFERENCES haccp_plans(id),
  FOREIGN KEY (verified_by) REFERENCES users(id),
  INDEX idx_factory_date (factory_id, verification_date),
  INDEX idx_result (verification_result)
);
```

#### API端点设计

```
# HACCP计划管理
GET    /api/mobile/compliance/haccp/plans              - HACCP计划列表
POST   /api/mobile/compliance/haccp/plans              - 创建HACCP计划
GET    /api/mobile/compliance/haccp/plans/:id          - 计划详情
PUT    /api/mobile/compliance/haccp/plans/:id          - 更新计划
POST   /api/mobile/compliance/haccp/plans/:id/approve  - 审批计划

# CCP管理
GET    /api/mobile/compliance/haccp/ccps               - CCP列表
POST   /api/mobile/compliance/haccp/ccps               - 创建CCP
GET    /api/mobile/compliance/haccp/ccps/:id           - CCP详情
PUT    /api/mobile/compliance/haccp/ccps/:id           - 更新CCP

# CCP监控
POST   /api/mobile/compliance/haccp/monitoring         - 记录CCP监控数据
GET    /api/mobile/compliance/haccp/monitoring         - 监控记录列表
GET    /api/mobile/compliance/haccp/monitoring/:id     - 监控详情
GET    /api/mobile/compliance/haccp/deviations         - 偏差记录
POST   /api/mobile/compliance/haccp/corrective-action  - 记录纠正措施

# HACCP验证
POST   /api/mobile/compliance/haccp/verification       - 记录验证结果
GET    /api/mobile/compliance/haccp/verification       - 验证记录列表
GET    /api/mobile/compliance/haccp/audit-trail        - 审计追踪

# HACCP报告
GET    /api/mobile/compliance/haccp/reports/monthly    - 月度HACCP报告
GET    /api/mobile/compliance/haccp/reports/ccp-summary - CCP汇总报告
```

#### 工作量估算
- 数据库设计与实现: 1周
- 后端API开发: 1.5周
- 前端UI开发: 1.5周
- 测试与优化: 1周
- **总计**: 5周

---

### 5.2 GMP卫生管理 ⭐⭐⭐⭐⭐

#### 功能清单

**卫生消毒管理**:
- ✅ 车间消毒记录
- ✅ 设备清洗消毒
- ✅ 人员卫生管理
- ✅ 车辆消毒记录

**虫害防治管理**:
- ✅ 虫害检查记录
- ✅ 虫害防治措施
- ✅ 外部服务商管理

**环境监测**:
- ✅ 空气质量监测
- ✅ 水质监测
- ✅ 表面微生物监测

#### 数据库设计

```sql
-- 卫生消毒记录表
CREATE TABLE sanitation_records (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  record_number VARCHAR(100) UNIQUE NOT NULL,

  sanitation_type ENUM('equipment', 'facility', 'personnel', 'vehicle') NOT NULL,

  -- 消毒对象
  area VARCHAR(100),              -- "加工车间A区"
  equipment_id VARCHAR(36),       -- 设备ID (如果是设备消毒)
  vehicle_number VARCHAR(50),     -- 车牌号 (如果是车辆消毒)

  -- 消毒方法
  sanitation_method VARCHAR(100), -- "75%酒精喷洒", "紫外线消毒"
  disinfectant_name VARCHAR(100),
  disinfectant_concentration VARCHAR(50),

  -- 执行信息
  performed_by INT NOT NULL,
  performed_at TIMESTAMP NOT NULL,
  duration_minutes INT,

  -- 验证信息
  verified_by INT,
  verified_at TIMESTAMP,
  verification_method VARCHAR(100),

  status ENUM('completed', 'failed', 'pending_verification') NOT NULL,
  failure_reason TEXT,

  notes TEXT,
  photos JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (equipment_id) REFERENCES factory_equipment(id),
  FOREIGN KEY (performed_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id),
  INDEX idx_factory_date (factory_id, performed_at),
  INDEX idx_type (sanitation_type),
  INDEX idx_area (factory_id, area)
);

-- 虫害防治记录表
CREATE TABLE pest_control_records (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  record_number VARCHAR(100) UNIQUE NOT NULL,

  inspection_date DATE NOT NULL,
  inspection_type ENUM('routine', 'complaint', 'follow_up') NOT NULL,

  -- 检查区域
  areas_inspected JSON,  -- ["原料仓", "加工车间", "成品仓", "办公区"]

  -- 虫害发现
  pest_found BOOLEAN DEFAULT false,
  pest_types JSON,       -- ["蟑螂", "老鼠", "飞虫"]
  pest_level ENUM('none', 'low', 'medium', 'high') DEFAULT 'none',
  infestation_areas JSON,

  -- 防治措施
  control_measures_taken TEXT,
  chemicals_used JSON,   -- [{"name": "杀虫剂A", "dosage": "100ml"}]
  traps_installed INT,
  traps_checked INT,

  -- 跟进
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,
  follow_up_notes TEXT,

  -- 执行人
  inspector_name VARCHAR(100),  -- 可能是外部服务商
  inspector_company VARCHAR(255),
  inspector_license VARCHAR(100),
  internal_supervisor INT,

  photos JSON,
  report_attachment VARCHAR(500),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (internal_supervisor) REFERENCES users(id),
  INDEX idx_factory_date (factory_id, inspection_date),
  INDEX idx_pest_found (pest_found),
  INDEX idx_follow_up (follow_up_required, follow_up_date)
);

-- 环境监测记录表
CREATE TABLE environmental_monitoring_records (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,

  monitoring_type ENUM('air_quality', 'water_quality', 'surface_microbe', 'noise_level') NOT NULL,
  monitoring_point VARCHAR(100) NOT NULL,  -- "加工车间A区", "水源1号"

  monitoring_date DATE NOT NULL,

  -- 监测指标（JSON格式，根据类型不同）
  test_parameters JSON,
  /* 示例:
  空气质量: {"particulate_matter": 50, "bacteria_count": 100, "temperature": 22, "humidity": 65}
  水质: {"ph": 7.0, "chlorine": 0.5, "bacteria_count": 0}
  表面微生物: {"bacteria_count": 10, "e_coli": 0}
  */

  -- 标准限值
  standard_limits JSON,
  compliance_status ENUM('pass', 'fail', 'marginal') NOT NULL,

  -- 执行信息
  tested_by INT,
  lab_name VARCHAR(255),  -- 如果是外部实验室
  test_report_number VARCHAR(100),

  -- 不合格处理
  corrective_actions TEXT,
  retest_required BOOLEAN DEFAULT false,
  retest_date DATE,

  attachments JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (tested_by) REFERENCES users(id),
  INDEX idx_factory_type_date (factory_id, monitoring_type, monitoring_date),
  INDEX idx_compliance (compliance_status)
);

-- 员工健康证管理表
CREATE TABLE employee_health_certificates (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT NOT NULL,

  certificate_number VARCHAR(100) UNIQUE NOT NULL,
  certificate_type ENUM('health', 'hygiene_training') NOT NULL,

  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  issuing_authority VARCHAR(255),

  certificate_photo VARCHAR(500),

  status ENUM('valid', 'expiring', 'expired') GENERATED ALWAYS AS (
    CASE
      WHEN expiry_date < CURRENT_DATE THEN 'expired'
      WHEN DATEDIFF(expiry_date, CURRENT_DATE) <= 30 THEN 'expiring'
      ELSE 'valid'
    END
  ) STORED,

  days_to_expiry INT GENERATED ALWAYS AS (DATEDIFF(expiry_date, CURRENT_DATE)) STORED,

  verified_by INT,
  verified_at TIMESTAMP,

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES users(id),
  INDEX idx_user_type (user_id, certificate_type),
  INDEX idx_expiry (expiry_date),
  INDEX idx_status (status)
);
```

#### API端点设计

```
# 卫生消毒管理
POST   /api/mobile/compliance/sanitation              - 记录消毒
GET    /api/mobile/compliance/sanitation              - 消毒记录列表
GET    /api/mobile/compliance/sanitation/:id          - 消毒详情
GET    /api/mobile/compliance/sanitation/schedule     - 消毒计划
POST   /api/mobile/compliance/sanitation/:id/verify   - 验证消毒

# 虫害防治
POST   /api/mobile/compliance/pest-control            - 记录虫害检查
GET    /api/mobile/compliance/pest-control            - 虫害记录列表
GET    /api/mobile/compliance/pest-control/:id        - 虫害详情
GET    /api/mobile/compliance/pest-control/alerts     - 虫害预警
POST   /api/mobile/compliance/pest-control/:id/follow-up - 跟进处理

# 环境监测
POST   /api/mobile/compliance/environmental           - 记录环境监测
GET    /api/mobile/compliance/environmental           - 监测记录列表
GET    /api/mobile/compliance/environmental/:id       - 监测详情
GET    /api/mobile/compliance/environmental/non-compliant - 不合格记录

# 健康证管理
GET    /api/mobile/employees/health-certificates      - 健康证列表
POST   /api/mobile/employees/health-certificates      - 上传健康证
GET    /api/mobile/employees/certificates-expiring    - 即将过期健康证
PUT    /api/mobile/employees/health-certificates/:id  - 更新健康证
```

#### 工作量估算
- 数据库设计与实现: 1周
- 后端API开发: 1.5周
- 前端UI开发: 1.5周
- 测试与优化: 1周
- **总计**: 5周

---

### 5.3 产品召回管理 ⭐⭐⭐⭐

#### 功能清单

**召回流程管理**:
- ✅ 召回发起与审批
- ✅ 召回批次追溯
- ✅ 客户通知管理
- ✅ 召回进度跟踪
- ✅ 政府报告

**召回级别**:
- Class I (一级召回): 严重健康危害
- Class II (二级召回): 中等健康危害
- Class III (三级召回): 轻微健康危害

#### 数据库设计

```sql
-- 产品召回管理表
CREATE TABLE product_recalls (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  recall_number VARCHAR(100) UNIQUE NOT NULL,

  -- 召回产品信息
  product_name VARCHAR(255) NOT NULL,
  product_code VARCHAR(100),
  batch_numbers JSON NOT NULL,  -- 涉及的批次号列表

  -- 召回原因
  recall_reason TEXT NOT NULL,
  recall_category ENUM(
    'microbiological',    -- 微生物污染
    'chemical',           -- 化学污染
    'physical',           -- 物理危害（异物）
    'allergen',           -- 过敏原
    'mislabeling',        -- 标签错误
    'other'
  ) NOT NULL,

  -- 召回级别
  recall_level ENUM('class_i', 'class_ii', 'class_iii') NOT NULL,
  health_hazard_evaluation TEXT,

  -- 数量统计
  quantity_produced DECIMAL(10,2) NOT NULL,
  quantity_distributed DECIMAL(10,2) NOT NULL,
  quantity_recalled DECIMAL(10,2) DEFAULT 0,
  recall_completion_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN quantity_distributed > 0
    THEN (quantity_recalled / quantity_distributed) * 100
    ELSE 0 END
  ) STORED,

  -- 时间信息
  recall_initiation_date DATE NOT NULL,
  recall_completion_date DATE,

  -- 状态信息
  status ENUM('initiated', 'in_progress', 'completed', 'terminated') DEFAULT 'initiated',

  -- 通知信息
  customer_notification_sent BOOLEAN DEFAULT false,
  public_announcement_made BOOLEAN DEFAULT false,
  authority_reported BOOLEAN DEFAULT false,
  authority_report_number VARCHAR(100),

  -- 处理措施
  disposal_method ENUM('destroy', 'rework', 'relabel', 'return') NOT NULL,
  disposal_completion BOOLEAN DEFAULT false,

  -- 责任人
  initiated_by INT NOT NULL,
  approved_by INT,
  approved_at TIMESTAMP,

  root_cause_analysis TEXT,
  preventive_actions TEXT,

  attachments JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (initiated_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_factory_status (factory_id, status),
  INDEX idx_recall_date (recall_initiation_date),
  INDEX idx_level (recall_level)
);

-- 召回客户通知记录表
CREATE TABLE recall_notifications (
  id VARCHAR(36) PRIMARY KEY,
  recall_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,

  notification_type ENUM('email', 'phone', 'letter', 'visit') NOT NULL,
  notification_date DATE NOT NULL,

  quantity_to_recall DECIMAL(10,2),
  quantity_returned DECIMAL(10,2) DEFAULT 0,

  customer_response ENUM('acknowledged', 'returned', 'no_response', 'refused') DEFAULT 'no_response',
  response_date DATE,

  notified_by INT NOT NULL,

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (recall_id) REFERENCES product_recalls(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (notified_by) REFERENCES users(id),
  INDEX idx_recall_customer (recall_id, customer_id),
  INDEX idx_response (customer_response)
);

-- 召回产品回收记录表
CREATE TABLE recall_recovery_records (
  id VARCHAR(36) PRIMARY KEY,
  recall_id VARCHAR(36) NOT NULL,

  recovery_date DATE NOT NULL,
  customer_id VARCHAR(36),

  batch_number VARCHAR(100),
  quantity_recovered DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20),

  recovery_location VARCHAR(255),

  disposal_method ENUM('destroy', 'rework', 'relabel', 'return_supplier') NOT NULL,
  disposal_date DATE,
  disposal_confirmation VARCHAR(500),  -- 销毁证明文件路径

  recovered_by INT NOT NULL,

  photos JSON,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (recall_id) REFERENCES product_recalls(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (recovered_by) REFERENCES users(id),
  INDEX idx_recall_date (recall_id, recovery_date),
  INDEX idx_batch (batch_number)
);
```

#### API端点设计

```
# 产品召回管理
POST   /api/mobile/compliance/recalls                 - 发起召回
GET    /api/mobile/compliance/recalls                 - 召回列表
GET    /api/mobile/compliance/recalls/:id             - 召回详情
PUT    /api/mobile/compliance/recalls/:id             - 更新召回信息
POST   /api/mobile/compliance/recalls/:id/approve     - 审批召回
POST   /api/mobile/compliance/recalls/:id/complete    - 完成召回

# 客户通知
POST   /api/mobile/compliance/recalls/:id/notify      - 通知客户
GET    /api/mobile/compliance/recalls/:id/notifications - 通知记录
PUT    /api/mobile/compliance/recalls/:id/notifications/:nid - 更新通知状态

# 产品回收
POST   /api/mobile/compliance/recalls/:id/recovery    - 记录产品回收
GET    /api/mobile/compliance/recalls/:id/recovery    - 回收记录列表
GET    /api/mobile/compliance/recalls/:id/progress    - 召回进度

# 政府报告
POST   /api/mobile/compliance/recalls/:id/report-authority - 向监管部门报告
GET    /api/mobile/compliance/recalls/reports         - 召回报告
```

#### 工作量估算
- 数据库设计与实现: 0.5周
- 后端API开发: 1周
- 前端UI开发: 1周
- 测试与优化: 0.5周
- **总计**: 3周

---

### Phase 5 总结

**总工作量**: 13周 (约3个月)
**核心交付物**:
1. ✅ 完整的HACCP管理系统
2. ✅ GMP卫生管理系统
3. ✅ 产品召回管理系统
4. ✅ 员工健康证管理
5. ✅ 满足ISO22000认证要求

**法规合规**:
- ✅ 符合《食品安全法》
- ✅ 符合HACCP七大原理
- ✅ 符合GMP良好生产规范
- ✅ 可通过ISO22000认证审核

---

## 🌡️ Phase 6: 冷链与包装

**时间周期**: 2025年7月 - 2025年9月 (12周)
**核心目标**: 完善温度追溯和产品包装管理
**优先级**: 🟠 P1（重要功能）

### 6.1 温度监控与冷链追溯 ⭐⭐⭐⭐

#### 功能清单

**温度监控**:
- ✅ 冷库温度实时监控
- ✅ 运输车辆温度监控
- ✅ 生产区域温度监控
- ✅ 温度异常自动告警

**冷链追溯**:
- ✅ 批次冷链温度历史
- ✅ 温度曲线图
- ✅ 冷链中断记录
- ✅ 冷链完整性验证

#### 数据库设计

```sql
-- 温度监控设备表
CREATE TABLE temperature_sensors (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  sensor_code VARCHAR(50) NOT NULL,
  sensor_name VARCHAR(255) NOT NULL,

  device_type ENUM('cold_storage', 'freezer', 'vehicle', 'production_area', 'incubator') NOT NULL,
  location VARCHAR(255),
  warehouse_id VARCHAR(36),

  temperature_limit_min DECIMAL(5,2) NOT NULL,
  temperature_limit_max DECIMAL(5,2) NOT NULL,
  humidity_limit_min DECIMAL(5,2),
  humidity_limit_max DECIMAL(5,2),

  monitoring_interval INT DEFAULT 300,  -- 监控间隔（秒），默认5分钟

  is_active BOOLEAN DEFAULT true,
  last_report_time TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  UNIQUE KEY unique_factory_sensor (factory_id, sensor_code),
  INDEX idx_type (device_type),
  INDEX idx_active (is_active)
);

-- 温度记录表
CREATE TABLE temperature_records (
  id VARCHAR(36) PRIMARY KEY,
  sensor_id VARCHAR(36) NOT NULL,
  factory_id VARCHAR(50) NOT NULL,

  temperature DECIMAL(5,2) NOT NULL,
  humidity DECIMAL(5,2),

  temperature_limit_min DECIMAL(5,2) NOT NULL,
  temperature_limit_max DECIMAL(5,2) NOT NULL,

  is_within_range BOOLEAN GENERATED ALWAYS AS (
    temperature BETWEEN temperature_limit_min AND temperature_limit_max
  ) STORED,

  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (sensor_id) REFERENCES temperature_sensors(id) ON DELETE CASCADE,
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  INDEX idx_sensor_time (sensor_id, recorded_at),
  INDEX idx_out_of_range (is_within_range, factory_id, recorded_at)
) PARTITION BY RANGE (YEAR(recorded_at)) (
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION p2027 VALUES LESS THAN (2028),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 温度告警表
CREATE TABLE temperature_alerts (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  sensor_id VARCHAR(36) NOT NULL,
  temperature_record_id VARCHAR(36) NOT NULL,

  alert_type ENUM('too_high', 'too_low', 'sensor_fault', 'data_missing') NOT NULL,
  severity ENUM('warning', 'critical') NOT NULL,

  temperature DECIMAL(5,2),
  threshold_violated DECIMAL(5,2),
  duration_minutes INT,  -- 告警持续时长

  status ENUM('active', 'acknowledged', 'resolved', 'false_alarm') DEFAULT 'active',

  acknowledged_by INT,
  acknowledged_at TIMESTAMP,

  resolved_by INT,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,

  notification_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (sensor_id) REFERENCES temperature_sensors(id),
  FOREIGN KEY (temperature_record_id) REFERENCES temperature_records(id) ON DELETE CASCADE,
  FOREIGN KEY (acknowledged_by) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id),
  INDEX idx_factory_status (factory_id, status),
  INDEX idx_sensor_status (sensor_id, status),
  INDEX idx_severity (severity, status)
);

-- 冷链追溯记录表
CREATE TABLE cold_chain_traces (
  id VARCHAR(36) PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL,
  factory_id VARCHAR(50) NOT NULL,

  trace_type ENUM('storage', 'transport', 'production') NOT NULL,

  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_minutes INT,

  sensor_id VARCHAR(36),
  location VARCHAR(255),

  avg_temperature DECIMAL(5,2),
  min_temperature DECIMAL(5,2),
  max_temperature DECIMAL(5,2),

  temperature_violations INT DEFAULT 0,
  cold_chain_intact BOOLEAN DEFAULT true,

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (batch_id) REFERENCES processing_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (sensor_id) REFERENCES temperature_sensors(id),
  INDEX idx_batch (batch_id),
  INDEX idx_type_time (trace_type, start_time)
);
```

#### API端点设计

```
# 温度传感器管理
GET    /api/mobile/temperature/sensors                - 传感器列表
POST   /api/mobile/temperature/sensors                - 添加传感器
GET    /api/mobile/temperature/sensors/:id            - 传感器详情
PUT    /api/mobile/temperature/sensors/:id            - 更新传感器

# 温度监控
POST   /api/mobile/temperature/record                 - 上报温度数据
GET    /api/mobile/temperature/realtime               - 实时温度监控
GET    /api/mobile/temperature/sensors/:id/current    - 传感器当前温度
GET    /api/mobile/temperature/sensors/:id/history    - 温度历史曲线
GET    /api/mobile/temperature/sensors/:id/statistics - 温度统计

# 温度告警
GET    /api/mobile/temperature/alerts                 - 温度告警列表
GET    /api/mobile/temperature/alerts/active          - 活动告警
POST   /api/mobile/temperature/alerts/:id/acknowledge - 确认告警
POST   /api/mobile/temperature/alerts/:id/resolve     - 解决告警

# 冷链追溯
GET    /api/mobile/cold-chain/trace/:batchId          - 批次冷链追溯
GET    /api/mobile/cold-chain/verify/:batchId         - 冷链完整性验证
POST   /api/mobile/cold-chain/trace                   - 创建冷链记录
GET    /api/mobile/cold-chain/report/:batchId         - 冷链报告
```

#### 工作量估算
- 数据库设计与实现: 1周
- 后端API开发: 1.5周
- 前端UI开发: 1.5周
- 测试与优化: 1周
- **总计**: 5周

---

### 6.2 产品包装与追溯码管理 ⭐⭐⭐⭐

#### 功能清单

**包装管理**:
- ✅ 包装记录创建
- ✅ 追溯码生成（二维码/条形码）
- ✅ 标签打印
- ✅ 包装批次管理

**追溯查询（公开接口）**:
- ✅ 扫码追溯查询
- ✅ 完整追溯信息展示
- ✅ 防伪验证

#### 数据库设计

```sql
-- 产品包装记录表
CREATE TABLE product_packages (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  batch_id VARCHAR(36) NOT NULL,

  package_code VARCHAR(100) UNIQUE NOT NULL,  -- 包装码（唯一）
  qr_code_content TEXT,                       -- 二维码内容（JSON）
  qr_code_url VARCHAR(500),                   -- 二维码图片URL
  barcode VARCHAR(100),                       -- 条形码

  package_type ENUM('box', 'bag', 'carton', 'pallet', 'individual') NOT NULL,
  package_level ENUM('primary', 'secondary', 'tertiary') NOT NULL,  -- 包装层级

  net_weight DECIMAL(10,2),
  gross_weight DECIMAL(10,2),
  unit VARCHAR(20),

  pieces_per_package INT,  -- 每包件数

  production_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  shelf_life_days INT,

  packaging_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  packaged_by INT NOT NULL,

  status ENUM('packed', 'in_stock', 'shipped', 'sold') DEFAULT 'packed',

  parent_package_id VARCHAR(36),  -- 父包装ID（用于多级包装）

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (batch_id) REFERENCES processing_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (packaged_by) REFERENCES users(id),
  FOREIGN KEY (parent_package_id) REFERENCES product_packages(id),
  INDEX idx_batch_package (batch_id, package_code),
  INDEX idx_status (status),
  INDEX idx_qr_lookup (package_code)
);

-- 标签模板表
CREATE TABLE label_templates (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,

  template_name VARCHAR(255) NOT NULL,
  template_code VARCHAR(50) NOT NULL,
  product_category VARCHAR(100),

  label_type ENUM('product_label', 'batch_label', 'pallet_label') NOT NULL,

  -- 标签内容配置（JSON格式）
  label_fields JSON NOT NULL,
  /* 示例:
  {
    "productName": true,
    "batchNumber": true,
    "productionDate": true,
    "expiryDate": true,
    "netWeight": true,
    "ingredients": true,
    "nutritionFacts": true,
    "qrCode": true,
    "barcode": true,
    "manufacturer": true,
    "license": true
  }
  */

  -- 二维码配置
  qr_code_format ENUM('url', 'json', 'custom') DEFAULT 'url',
  qr_code_base_url VARCHAR(500),  -- "https://trace.cretas.com/p/"

  -- 模板文件
  template_file_url VARCHAR(500),

  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY unique_factory_template (factory_id, template_code),
  INDEX idx_category (product_category)
);

-- 追溯查询日志表（公开接口访问记录）
CREATE TABLE trace_query_logs (
  id VARCHAR(36) PRIMARY KEY,
  package_code VARCHAR(100) NOT NULL,

  query_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  query_ip VARCHAR(45),
  query_location VARCHAR(255),  -- 查询地理位置
  user_agent TEXT,

  query_result ENUM('success', 'not_found', 'expired', 'recalled') NOT NULL,

  INDEX idx_package (package_code, query_time),
  INDEX idx_time (query_time)
) PARTITION BY RANGE (YEAR(query_time)) (
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION p2027 VALUES LESS THAN (2028),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

#### API端点设计

```
# 包装管理
POST   /api/mobile/packaging/packages                 - 创建包装记录
GET    /api/mobile/packaging/packages                 - 包装记录列表
GET    /api/mobile/packaging/packages/:id             - 包装详情
PUT    /api/mobile/packaging/packages/:id             - 更新包装
GET    /api/mobile/packaging/packages/:batchId        - 批次包装列表

# 追溯码生成
POST   /api/mobile/packaging/generate-qrcode          - 生成追溯二维码
POST   /api/mobile/packaging/batch-generate           - 批量生成二维码
GET    /api/mobile/packaging/qrcode/:packageCode      - 获取二维码图片

# 标签模板
GET    /api/mobile/packaging/templates                - 标签模板列表
POST   /api/mobile/packaging/templates                - 创建标签模板
GET    /api/mobile/packaging/templates/:id            - 模板详情
PUT    /api/mobile/packaging/templates/:id            - 更新模板
POST   /api/mobile/packaging/print-label              - 打印标签

# 追溯查询（公开接口 - 无需认证）
GET    /api/public/trace/:packageCode                 - 扫码追溯查询
GET    /api/public/trace/:packageCode/simple          - 简化追溯信息
POST   /api/public/trace/verify                       - 防伪验证

# 追溯统计
GET    /api/mobile/packaging/query-statistics         - 查询统计
GET    /api/mobile/packaging/hot-products             - 热门查询产品
```

#### 追溯码内容设计

```json
{
  "v": "1.0",
  "packageCode": "PKG-FAC001-20250105-001",
  "product": {
    "name": "冷冻三文鱼切片",
    "code": "PROD-SALMON-500G",
    "specification": "500g/袋",
    "category": "frozen_seafood"
  },
  "batch": {
    "batchNumber": "BATCH-FAC001-20250105-001",
    "productionDate": "2025-01-05",
    "expiryDate": "2026-01-05",
    "shelfLifeDays": 365
  },
  "factory": {
    "id": "FAC001",
    "name": "白垩纪食品加工厂",
    "license": "SC12345678901234",
    "address": "XX省XX市XX区",
    "phone": "400-xxx-xxxx"
  },
  "traceability": {
    "rawMaterial": {
      "supplier": "XX水产供应商",
      "receiptDate": "2025-01-04",
      "batch": "SUP-20250104-001",
      "qualityGrade": "A",
      "origin": "挪威"
    },
    "production": {
      "supervisor": "张三",
      "processingLine": "Line-A",
      "startTime": "2025-01-05 08:00:00",
      "endTime": "2025-01-05 16:30:00"
    },
    "quality": {
      "inspector": "李四",
      "inspectionDate": "2025-01-05",
      "result": "pass",
      "score": 98
    },
    "coldChain": {
      "storageTemp": "-18°C ~ -20°C",
      "violations": 0,
      "intact": true
    }
  },
  "certifications": ["HACCP", "ISO22000"],
  "qrGeneratedAt": "2025-01-05T17:00:00Z"
}
```

#### 工作量估算
- 数据库设计与实现: 0.5周
- 后端API开发: 1.5周
- 前端UI开发: 1.5周
- 公开追溯页面开发: 1周
- 测试与优化: 0.5周
- **总计**: 5周

---

### Phase 6 总结

**总工作量**: 10周 (约2.5个月)
**核心交付物**:
1. ✅ 完整的温度监控系统
2. ✅ 冷链追溯功能
3. ✅ 产品包装管理
4. ✅ 追溯码生成与查询
5. ✅ 公开追溯页面

**业务价值**:
- ✅ 完整的冷链追溯能力
- ✅ 消费者可扫码查询产品信息
- ✅ 满足冷链食品监管要求

---

## 📈 Phase 7: 质量改进与完善

**时间周期**: 2025年10月 - 2025年12月 (12周)
**核心目标**: 完善质量管理体系，开发Web管理后台
**优先级**: 🟡 P2（改进优化）

### 7.1 客户投诉与质量反馈 ⭐⭐⭐

#### 功能清单

**投诉管理**:
- ✅ 投诉记录与分类
- ✅ 投诉处理流程
- ✅ 根因分析（RCA）
- ✅ 纠正预防措施（CAPA）

**质量改进**:
- ✅ 投诉统计分析
- ✅ 质量趋势分析
- ✅ 8D报告生成

#### 数据库设计

```sql
-- 客户投诉表
CREATE TABLE customer_complaints (
  id VARCHAR(36) PRIMARY KEY,
  factory_id VARCHAR(50) NOT NULL,
  complaint_number VARCHAR(100) UNIQUE NOT NULL,

  customer_id VARCHAR(36),
  customer_name VARCHAR(255),
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),

  -- 产品信息
  product_name VARCHAR(255),
  product_code VARCHAR(100),
  batch_number VARCHAR(100),
  package_code VARCHAR(100),
  purchase_date DATE,

  -- 投诉信息
  complaint_type ENUM('quality', 'packaging', 'foreign_object', 'taste', 'smell', 'color', 'texture', 'expiry', 'other') NOT NULL,
  severity ENUM('critical', 'major', 'minor') NOT NULL,
  complaint_source ENUM('phone', 'email', 'social_media', 'in_person', 'third_party') NOT NULL,

  description TEXT NOT NULL,
  photos JSON,

  received_date DATE NOT NULL,
  received_by INT NOT NULL,

  -- 处理流程
  status ENUM('new', 'assigned', 'investigating', 'resolved', 'closed', 'escalated') DEFAULT 'new',
  assigned_to INT,
  assigned_at TIMESTAMP,

  -- 根因分析
  root_cause_analysis TEXT,
  fishbone_diagram VARCHAR(500),  -- 鱼骨图文件路径
  five_whys TEXT,

  -- 纠正预防措施 (CAPA)
  corrective_action TEXT,
  corrective_action_deadline DATE,
  corrective_action_responsible INT,
  corrective_action_completed BOOLEAN DEFAULT false,

  preventive_action TEXT,
  preventive_action_deadline DATE,
  preventive_action_responsible INT,
  preventive_action_completed BOOLEAN DEFAULT false,

  -- 客户响应
  customer_response_required BOOLEAN DEFAULT true,
  customer_response_sent BOOLEAN DEFAULT false,
  customer_satisfied ENUM('yes', 'no', 'partial', 'unknown'),

  -- 关闭信息
  resolved_date DATE,
  resolved_by INT,
  resolution_notes TEXT,
  closed_date DATE,

  -- 成本影响
  financial_impact DECIMAL(10,2),
  compensation_provided DECIMAL(10,2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (received_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id),
  INDEX idx_factory_status (factory_id, status),
  INDEX idx_severity (severity, status),
  INDEX idx_batch (batch_number)
);

-- 投诉处理跟进表
CREATE TABLE complaint_follow_ups (
  id VARCHAR(36) PRIMARY KEY,
  complaint_id VARCHAR(36) NOT NULL,

  follow_up_date DATE NOT NULL,
  follow_up_type ENUM('internal_investigation', 'customer_communication', 'corrective_action', 'verification', 'other') NOT NULL,

  description TEXT NOT NULL,
  action_taken TEXT,
  next_steps TEXT,

  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (complaint_id) REFERENCES customer_complaints(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_complaint_date (complaint_id, follow_up_date)
);

-- 8D报告表
CREATE TABLE complaint_8d_reports (
  id VARCHAR(36) PRIMARY KEY,
  complaint_id VARCHAR(36) NOT NULL,
  factory_id VARCHAR(50) NOT NULL,

  report_number VARCHAR(100) UNIQUE NOT NULL,

  -- D1: Team Formation (组建团队)
  team_members JSON,
  team_leader INT,

  -- D2: Problem Description (问题描述)
  problem_description TEXT,
  problem_photos JSON,

  -- D3: Containment Actions (遏制措施)
  containment_actions TEXT,
  containment_date DATE,

  -- D4: Root Cause Analysis (根因分析)
  root_cause TEXT,
  analysis_method ENUM('5_whys', 'fishbone', 'fault_tree', 'other'),

  -- D5: Corrective Actions (纠正措施)
  corrective_actions TEXT,

  -- D6: Implement Corrective Actions (实施纠正措施)
  implementation_plan TEXT,
  implementation_date DATE,

  -- D7: Preventive Actions (预防措施)
  preventive_actions TEXT,

  -- D8: Congratulate the Team (表彰团队)
  completion_date DATE,
  effectiveness_verified BOOLEAN DEFAULT false,
  lessons_learned TEXT,

  status ENUM('in_progress', 'completed') DEFAULT 'in_progress',

  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (complaint_id) REFERENCES customer_complaints(id),
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (team_leader) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_complaint (complaint_id),
  INDEX idx_status (status)
);
```

#### API端点设计

```
# 投诉管理
POST   /api/mobile/complaints                         - 创建投诉
GET    /api/mobile/complaints                         - 投诉列表
GET    /api/mobile/complaints/:id                     - 投诉详情
PUT    /api/mobile/complaints/:id                     - 更新投诉
POST   /api/mobile/complaints/:id/assign              - 分配处理人
POST   /api/mobile/complaints/:id/close               - 关闭投诉

# 投诉处理
POST   /api/mobile/complaints/:id/follow-up           - 添加跟进记录
POST   /api/mobile/complaints/:id/root-cause          - 记录根因分析
POST   /api/mobile/complaints/:id/capa                - 记录CAPA
POST   /api/mobile/complaints/:id/response            - 回复客户

# 8D报告
POST   /api/mobile/complaints/:id/8d-report           - 创建8D报告
GET    /api/mobile/complaints/:id/8d-report           - 获取8D报告
PUT    /api/mobile/complaints/:id/8d-report/:rid      - 更新8D报告
POST   /api/mobile/complaints/:id/8d-report/:rid/complete - 完成8D

# 投诉分析
GET    /api/mobile/complaints/statistics              - 投诉统计
GET    /api/mobile/complaints/analysis/trend          - 投诉趋势
GET    /api/mobile/complaints/analysis/pareto         - 帕累托分析
GET    /api/mobile/complaints/analysis/cost           - 投诉成本分析
```

#### 工作量估算
- 数据库设计与实现: 0.5周
- 后端API开发: 1周
- 前端UI开发: 1.5周
- 测试与优化: 0.5周
- **总计**: 3.5周

---

### 7.2 Web管理后台 ⭐⭐⭐⭐

#### 功能清单

**平台管理功能**:
- ✅ 工厂管理（创建、编辑、停用）
- ✅ 用户管理（跨工厂用户管理）
- ✅ 权限配置
- ✅ 系统配置

**数据分析功能**:
- ✅ 多维度数据分析
- ✅ 可视化图表
- ✅ 报表导出
- ✅ 数据导入

**优势**:
- 大屏展示更友好
- 批量操作更高效
- 复杂查询更方便

#### 技术栈

```
前端: Next.js 14+ / React 18+ / TypeScript
UI库: Ant Design / Material-UI
图表: ECharts / Recharts
状态管理: Zustand / React Query
```

#### 核心页面

```
/admin
├── /dashboard              # 仪表板
├── /factories              # 工厂管理
├── /users                  # 用户管理
├── /batches                # 批次管理
├── /inventory              # 库存管理
├── /purchase               # 采购管理
├── /sales                  # 销售管理
├── /quality                # 质量管理
├── /compliance             # 合规管理
├── /reports                # 报表中心
└── /settings               # 系统设置
```

#### 工作量估算
- 项目架构搭建: 1周
- 核心页面开发: 4周
- 数据可视化: 1周
- 测试与优化: 1周
- **总计**: 7周

---

### Phase 7 总结

**总工作量**: 10.5周 (约2.5个月)
**核心交付物**:
1. ✅ 完整的投诉管理系统
2. ✅ 8D报告功能
3. ✅ Web管理后台
4. ✅ 数据分析增强

---

## 🚀 Phase 8+: 业务拓展

**时间周期**: 2026年1月 - 2026年12月
**核心目标**: 扩展业务模块，实现全产业链追溯
**优先级**: 🟢 P3（业务拓展）

### 8.1 养殖模块 (2026 Q1-Q2)

**功能清单**:
- ✅ 养殖场管理
- ✅ 养殖批次管理
- ✅ 饲料管理
- ✅ 水质监测
- ✅ 疫病管理
- ✅ 养殖日志

**工作量**: 8-10周

---

### 8.2 物流模块 (2026 Q2-Q3)

**功能清单**:
- ✅ 物流订单管理
- ✅ 车辆管理
- ✅ 运输跟踪（GPS）
- ✅ 运输温度监控
- ✅ 签收管理
- ✅ 运费结算

**工作量**: 6-8周

---

### 8.3 区块链溯源 (2026 Q4)

**功能清单**:
- ✅ 区块链节点部署
- ✅ 关键数据上链
- ✅ 智能合约
- ✅ 防篡改验证
- ✅ 联盟链管理

**技术选型**:
- Hyperledger Fabric / 蚂蚁链 / 腾讯云区块链

**工作量**: 8-10周

---

## 🏗️ 技术架构演进

### 当前架构 (Phase 0-3)

```
移动端 (React Native)
      ↓
后端API (Node.js + Express)
      ↓
数据库 (MySQL 8.0+)
```

### 目标架构 (Phase 8+)

```
┌─────────────────────────────────────────────────────┐
│              客户端层                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │   iOS    │  │ Android  │  │   Web    │           │
│  │  Mobile  │  │  Mobile  │  │  Admin   │           │
│  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS/REST API
                      ↓
┌─────────────────────────────────────────────────────┐
│              应用服务层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Mobile  │  │   Web    │  │  Report  │           │
│  │   API    │  │   API    │  │  Service │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │   Auth   │  │  Queue   │  │  Cache   │           │
│  │  Service │  │  (Bull)  │  │  (Redis) │           │
│  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────┬───────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────┐
│              数据存储层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  MySQL   │  │  Redis   │  │   OSS    │           │
│  │ (业务数据)│  │  (缓存)  │  │ (文件)   │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐                         │
│  │   ES     │  │   区块链  │                         │
│  │ (日志)   │  │ (关键数据)│                         │
│  └──────────┘  └──────────┘                         │
└─────────────────────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────┐
│              外部服务层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ DeepSeek │  │   短信    │  │   支付   │           │
│  │   LLM    │  │  服务    │  │  服务    │           │
│  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────┘
```

### 技术升级规划

**Phase 4-5**:
- 引入Redis缓存
- 引入消息队列（Bull）
- 数据库读写分离

**Phase 6-7**:
- 引入Elasticsearch（日志分析）
- 对象存储（OSS）
- CDN加速

**Phase 8+**:
- 微服务架构
- 区块链集成
- 大数据分析平台

---

## 💰 资源需求与预算

### Phase 4 (2025 Q1)

**人力需求**:
- 后端开发: 2人 × 3个月 = 6人月
- 前端开发: 2人 × 3个月 = 6人月
- 测试工程师: 1人 × 3个月 = 3人月
- **总计**: 15人月

**成本估算**:
- 人力成本: 约¥300,000 - ¥450,000
- 服务器成本: 约¥5,000/月
- 第三方服务: 约¥3,000/月

---

### Phase 5 (2025 Q2)

**人力需求**:
- 后端开发: 2人 × 3个月 = 6人月
- 前端开发: 2人 × 3个月 = 6人月
- 测试工程师: 1人 × 3个月 = 3人月
- **总计**: 15人月

**成本估算**:
- 人力成本: 约¥300,000 - ¥450,000
- HACCP认证咨询: 约¥50,000
- ISO22000认证: 约¥80,000

---

### Phase 6 (2025 Q3)

**人力需求**:
- 后端开发: 1.5人 × 2.5个月 = 3.75人月
- 前端开发: 1.5人 × 2.5个月 = 3.75人月
- 测试工程师: 1人 × 2.5个月 = 2.5人月
- **总计**: 10人月

**成本估算**:
- 人力成本: 约¥200,000 - ¥300,000
- 温度传感器硬件: 约¥30,000 - ¥50,000

---

### Phase 7 (2025 Q4)

**人力需求**:
- 后端开发: 1人 × 2.5个月 = 2.5人月
- 前端开发: 2人 × 2.5个月 = 5人月
- 测试工程师: 1人 × 2.5个月 = 2.5人月
- **总计**: 10人月

**成本估算**:
- 人力成本: 约¥200,000 - ¥300,000

---

### 2025年度总预算

**人力投入**: 50人月
**人力成本**: ¥1,000,000 - ¥1,500,000
**硬件成本**: ¥30,000 - ¥50,000
**服务器成本**: ¥60,000/年
**认证成本**: ¥130,000
**第三方服务**: ¥36,000/年

**总预算**: 约¥1,256,000 - ¥1,776,000

---

## 📊 里程碑与交付物

### 2025 Q1 (Phase 4)
- ✅ 库存管理系统上线
- ✅ 供应链管理系统上线
- ✅ FIFO和保质期管理上线
- **交付物**: 库存+供应链完整模块

### 2025 Q2 (Phase 5)
- ✅ HACCP系统上线
- ✅ GMP管理系统上线
- ✅ 产品召回系统上线
- ✅ 通过ISO22000认证预审
- **交付物**: 食品安全合规完整模块

### 2025 Q3 (Phase 6)
- ✅ 温度监控系统上线
- ✅ 冷链追溯上线
- ✅ 产品包装与追溯码上线
- ✅ 公开追溯页面上线
- **交付物**: 冷链+包装完整模块

### 2025 Q4 (Phase 7)
- ✅ 客户投诉系统上线
- ✅ Web管理后台上线
- ✅ 系统优化与性能提升
- **交付物**: Web后台+质量改进模块

### 2026 Q1-Q4 (Phase 8+)
- ✅ 养殖模块上线
- ✅ 物流模块上线
- ✅ 区块链溯源上线
- **交付物**: 全产业链追溯平台

---

## 🎯 总结

### 系统演进路径

```
Phase 0-3 (已完成)
↓
MES生产执行系统
↓
Phase 4 (2025 Q1)
↓
MES + SCM供应链管理
↓
Phase 5 (2025 Q2)
↓
MES + SCM + QMS质量管理
↓
Phase 6 (2025 Q3)
↓
MES + SCM + QMS + 冷链追溯
↓
Phase 7 (2025 Q4)
↓
MES + SCM + QMS + Web管理后台
↓
Phase 8+ (2026)
↓
全产业链追溯平台 + 区块链
```

### 核心价值

**对工厂**:
- ✅ 完整的生产管理系统
- ✅ 符合食品安全法规
- ✅ 降低运营成本
- ✅ 提升产品质量
- ✅ 提高管理效率

**对消费者**:
- ✅ 扫码查询完整追溯信息
- ✅ 确保食品安全
- ✅ 增强品牌信任

**对行业**:
- ✅ 推动食品行业数字化转型
- ✅ 提升食品安全管理水平
- ✅ 建立行业标准

---

**文档结束**

*本文档为白垩纪食品溯源系统未来发展规划，将根据实际开发进度和市场需求动态调整。*
