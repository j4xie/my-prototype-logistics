# Phase 2 端到端测试计划

**规划时间**: 2025-11-20  
**预计执行时间**: 18小时 (建议分3天完成)  
**目标通过率**: ≥85% (98/115 APIs)  

---

## 📊 测试范围总览

| Phase | 模块 | API数量 | 预计时间 | 优先级 | 依赖 |
|-------|------|---------|---------|--------|------|
| **2.1** | 原材料批次管理 | 28 | 4小时 | P0 | Phase 1完成 |
| **2.2** | 设备管理 | 25 | 3.5小时 | P0 | Phase 1完成 |
| **2.3** | 供应商管理 | 20 | 3小时 | P1 | Phase 2.1完成 |
| **2.4** | 用户管理 | 12 | 2小时 | P1 | Phase 1完成 |
| **2.5** | 部门管理 | 11 | 2小时 | P2 | Phase 1完成 |
| **2.6** | 质检管理 | 5 | 1.5小时 | P2 | Phase 1.4完成 |
| **2.7-2.8** | 类型管理 | 14 | 2小时 | P2 | Phase 1.4完成 |
| **合计** | **8个模块** | **115** | **18小时** | - | - |

---

## 🎯 Phase 2.1: 原材料批次管理 (P0 - 最高优先级)

### 基本信息
- **Controller**: `MaterialBatchController.java`
- **Base Path**: `/api/mobile/{factoryId}/material-batches`
- **API数量**: 28个端点
- **预计时间**: 4小时
- **测试脚本**: `tests/api/test_material_batches.sh`

### 为什么是P0
1. 核心业务功能 - 原材料管理是生产的基础
2. 前端已完成实现 - `MaterialBatchManagementScreen.tsx`
3. 用户已提出需求 - 在`backend/rn-update-tableandlogic.md`中

### API清单 (28个)

#### CRUD基础操作 (5个)
```bash
POST   /{factoryId}/material-batches              # 创建批次
PUT    /{factoryId}/material-batches/{batchId}    # 更新批次
DELETE /{factoryId}/material-batches/{batchId}    # 删除批次
GET    /{factoryId}/material-batches/{batchId}    # 获取详情
GET    /{factoryId}/material-batches              # 分页列表
  ?page=1&size=10
```

#### 查询与筛选 (6个)
```bash
GET /{factoryId}/material-batches/material-type/{typeId}  
  # 按类型查询
  
GET /{factoryId}/material-batches/status/{status}         
  # 按状态查询 (AVAILABLE, IN_USE, RESERVED, EXHAUSTED, EXPIRED)
  
GET /{factoryId}/material-batches/fifo/{typeId}
  ?requiredQuantity=100
  # FIFO查询 - 先进先出原则获取批次
  
GET /{factoryId}/material-batches/expiring
  ?days=3
  # 即将过期 (默认3天内)
  
GET /{factoryId}/material-batches/expired                 
  # 已过期批次列表
  
GET /{factoryId}/material-batches/{batchId}/usage-history 
  # 使用历史记录
```

#### 库存操作 (7个)
```bash
POST /{factoryId}/material-batches/{batchId}/use
  ?quantity=50
  # 使用材料 - 减少可用数量
  
POST /{factoryId}/material-batches/{batchId}/adjust
  ?newQuantity=100&reason=盘点调整
  # 调整数量 - 盘点、退货等
  
PUT  /{factoryId}/material-batches/{batchId}/status
  ?status=IN_USE
  # 更新状态
  
POST /{factoryId}/material-batches/{batchId}/reserve
  ?quantity=30&productionPlanId=P001
  # 预留材料 - 为生产计划预留
  
POST /{factoryId}/material-batches/{batchId}/release
  ?quantity=30&productionPlanId=P001
  # 释放预留 - 取消预留
  
POST /{factoryId}/material-batches/{batchId}/consume
  ?quantity=50&productionPlanId=P001
  # 消耗材料 - 实际使用并记录到生产计划
  
POST /{factoryId}/material-batches/handle-expired
  # 批量处理过期批次
```

#### 统计与报表 (5个)
```bash
GET /{factoryId}/material-batches/inventory/statistics
  # 库存统计 (按类型汇总)
  
GET /{factoryId}/material-batches/inventory/valuation     
  # 库存价值评估
  
GET /{factoryId}/material-batches/low-stock               
  # 低库存警告列表
  
GET /{factoryId}/material-batches/export                  
  # 导出报表 (Excel)
  
POST /{factoryId}/material-batches/batch                  
  # 批量创建批次
```

#### 转冻品功能 (2个) - 新增
```bash
POST /{factoryId}/material-batches/{batchId}/convert-to-frozen
  # 转冻品 - 鲜品转为冻品
  
POST /{factoryId}/material-batches/{batchId}/undo-frozen
  # 撤销转冻品 - 冻品恢复为鲜品
```

#### 其他 (3个)
```bash
GET  /{factoryId}/material-batches/search
  ?keyword=鱼&supplierName=供应商A
  # 高级搜索
  
POST /{factoryId}/material-batches/import
  # 批量导入 (Excel)
  
GET  /{factoryId}/material-batches/export/template
  # 下载导入模板
```

### 测试数据准备
```sql
-- 原料类型 (3个)
INSERT INTO raw_material_types (id, name, category) VALUES
  ('MT001', '鲜鱼', '海鲜'),
  ('MT002', '鸡胸肉', '肉类'),
  ('MT003', '大白菜', '蔬菜');

-- 供应商 (3个)
INSERT INTO suppliers (id, name, code) VALUES
  (1, '海鲜批发商A', 'SUP001'),
  (2, '肉类供应商B', 'SUP002'),
  (3, '蔬菜供应商C', 'SUP003');

-- 原材料批次 (10个)
INSERT INTO material_batches (batch_number, material_type_id, quantity, available_quantity, supplier_id, status, expiry_date) VALUES
  ('MB001', 'MT001', 500.00, 500.00, 1, 'AVAILABLE', '2025-11-25'),
  ('MB002', 'MT001', 300.00, 250.00, 1, 'IN_USE', '2025-11-23'),
  ('MB003', 'MT002', 200.00, 200.00, 2, 'AVAILABLE', '2025-12-10'),
  ('MB004', 'MT002', 150.00, 0.00, 2, 'EXHAUSTED', '2025-11-20'),
  ('MB005', 'MT003', 100.00, 0.00, 3, 'EXPIRED', '2025-11-15'),
  ('MB006', 'MT001', 400.00, 400.00, 1, 'AVAILABLE', '2025-11-22'),  -- 即将过期
  ('MB007', 'MT001', 350.00, 300.00, 1, 'RESERVED', '2025-11-30'),
  ('MB008', 'MT002', 180.00, 180.00, 2, 'AVAILABLE', '2025-12-05'),
  ('MB009', 'MT003', 120.00, 120.00, 3, 'AVAILABLE', '2025-12-01'),
  ('MB010', 'MT001', 250.00, 250.00, 1, 'AVAILABLE', '2025-11-28');
```

### 成功标准
- **最低通过**: 24/28 (85%)
- **目标通过**: 26/28 (93%)
- **完美通过**: 28/28 (100%)

### 重点测试项
1. **FIFO逻辑** - 验证先进先出算法正确性
2. **库存准确性** - quantity vs available_quantity
3. **状态转换** - AVAILABLE → IN_USE → EXHAUSTED
4. **过期管理** - 自动识别过期批次
5. **转冻品功能** - 数据一致性

---

## 🔧 Phase 2.2: 设备管理 (P0)

### 基本信息
- **Controller**: `EquipmentController.java`
- **Base Path**: `/api/mobile/{factoryId}/equipment`
- **API数量**: 25个端点
- **预计时间**: 3.5小时

### API清单 (25个)

#### CRUD基础操作 (5个)
```bash
POST   /{factoryId}/equipment                    # 创建设备
PUT    /{factoryId}/equipment/{equipmentId}      # 更新设备
DELETE /{factoryId}/equipment/{equipmentId}      # 删除设备
GET    /{factoryId}/equipment/{equipmentId}      # 获取详情
GET    /{factoryId}/equipment?page=1&size=10     # 分页列表
```

#### 查询与筛选 (4个)
```bash
GET /{factoryId}/equipment/status/{status}           
  # 按状态查询 (idle, running, maintenance, scrapped)
  
GET /{factoryId}/equipment/type/{type}               
  # 按类型查询
  
GET /{factoryId}/equipment/search?keyword=搅拌机     
  # 搜索设备
  
GET /{factoryId}/equipment/needing-maintenance       
  # 需要维护的设备
```

#### 设备操作 (6个)
```bash
PUT  /{factoryId}/equipment/{equipmentId}/status
  ?status=running
  # 更新状态
  
POST /{factoryId}/equipment/{equipmentId}/start                     
  # 启动设备
  
POST /{factoryId}/equipment/{equipmentId}/stop
  ?runningHours=8
  # 停止设备
  
POST /{factoryId}/equipment/{equipmentId}/maintenance
  ?maintenanceDate=2025-11-20&cost=500
  # 记录维护
  
POST /{factoryId}/equipment/{equipmentId}/scrap
  ?reason=老化报废
  # 报废设备
  
GET  /{factoryId}/equipment/expiring-warranty
  ?daysAhead=30
  # 保修即将到期
```

#### 统计与分析 (7个)
```bash
GET /{factoryId}/equipment/{equipmentId}/statistics
  # 设备统计信息
  
GET /{factoryId}/equipment/{equipmentId}/usage-history
  # 使用历史
  
GET /{factoryId}/equipment/{equipmentId}/maintenance-history
  # 维护历史
  
GET /{factoryId}/equipment/{equipmentId}/depreciated-value
  # 折旧后价值
  
GET /{factoryId}/equipment/{equipmentId}/efficiency-report
  ?startDate=2025-11-01&endDate=2025-11-20
  # 效率报告
  
GET /{factoryId}/equipment/{equipmentId}/oee
  ?startDate=2025-11-01&endDate=2025-11-20
  # OEE计算 (Overall Equipment Effectiveness)
  
GET /{factoryId}/equipment/overall-statistics
  # 工厂设备总体统计
```

#### 导入导出 (3个)
```bash
POST /{factoryId}/equipment/import               # 批量导入
GET  /{factoryId}/equipment/export               # 导出设备列表
GET  /{factoryId}/equipment/export/template      # 下载导入模板
```

### 测试数据准备
```sql
-- 设备 (6个)
INSERT INTO equipment (name, type, status, purchase_price, purchase_date) VALUES
  ('搅拌机-01', '搅拌设备', 'idle', 50000.00, '2024-01-01'),
  ('搅拌机-02', '搅拌设备', 'running', 50000.00, '2024-01-01'),
  ('切割机-01', '切割设备', 'idle', 80000.00, '2024-02-01'),
  ('包装机-01', '包装设备', 'running', 120000.00, '2024-03-01'),
  ('冷藏柜-01', '冷藏设备', 'maintenance', 30000.00, '2024-01-15'),
  ('废旧设备-01', '搅拌设备', 'scrapped', 50000.00, '2023-01-01');

-- 维护记录 (3条)
INSERT INTO equipment_maintenance (equipment_id, maintenance_date, cost) VALUES
  (5, '2025-11-15', 500.00),
  (1, '2025-10-01', 300.00),
  (3, '2025-09-15', 450.00);
```

### 成功标准
- **最低通过**: 21/25 (84%)
- **目标通过**: 23/25 (92%)

### 重点测试项
1. **设备状态机** - 状态转换正确性
2. **OEE计算** - 设备综合效率算法
3. **维护提醒** - 基于使用时长的维护触发
4. **折旧计算** - 固定资产折旧算法

---

## 📦 Phase 2.3-2.8: 其他模块 (简化说明)

### Phase 2.3: 供应商管理 (P1 - 3小时)
- **API数量**: 20个
- **重点**: CRUD、评级管理、供货历史、Excel导入导出

### Phase 2.4: 用户管理 (P1 - 2小时)
- **API数量**: 12个
- **重点**: CRUD、角色权限、激活/停用、密码管理

### Phase 2.5: 部门管理 (P2 - 2小时)
- **API数量**: 11个
- **重点**: CRUD、树形结构、活跃部门查询

### Phase 2.6: 质检管理 (P2 - 1.5小时)
- **API数量**: 5个 (Phase 1已测1个)
- **重点**: CRUD、关联生产批次、质检结果

### Phase 2.7-2.8: 类型管理 (P2 - 2小时)
- **API数量**: 14个 (Phase 1已测2个)
- **重点**: 产品类型和原料类型的CRUD、分类查询

---

## 🚀 执行步骤

### Day 1: P0模块 (7.5小时)
1. **上午** (4小时): Phase 2.1 原材料批次管理
   - 准备测试数据 (30分钟)
   - 创建测试脚本 (1小时)
   - 执行测试 (2小时)
   - 分析结果 (30分钟)

2. **下午** (3.5小时): Phase 2.2 设备管理
   - 准备测试数据 (20分钟)
   - 创建测试脚本 (50分钟)
   - 执行测试 (1.5小时)
   - 分析结果 (30分钟)

### Day 2: P1模块 (5小时)
1. **上午** (3小时): Phase 2.3 供应商管理
2. **下午** (2小时): Phase 2.4 用户管理

### Day 3: P2模块 + 报告 (5.5小时)
1. **上午** (3.5小时): Phase 2.5, 2.6, 2.7-2.8
2. **下午** (2小时): 汇总报告、更新文档

---

## 📈 成功指标

### 整体目标
- **Phase 2通过率**: ≥85% (98/115 APIs)
- **P0模块通过率**: ≥85% (原材料、设备)
- **P1模块通过率**: ≥83% (供应商、用户)
- **P2模块通过率**: ≥80% (部门、质检、类型)

### 质量标准
1. 所有CRUD操作正常
2. 查询和筛选功能准确
3. 业务逻辑正确 (FIFO、OEE等)
4. 权限控制有效
5. 数据一致性保证

---

## 📝 交付物

### 测试脚本 (7个)
- `tests/api/test_material_batches.sh`
- `tests/api/test_equipment.sh`
- `tests/api/test_suppliers.sh`
- `tests/api/test_users.sh`
- `tests/api/test_departments.sh`
- `tests/api/test_quality_inspections.sh`
- `tests/api/test_types_management.sh`

### 测试报告 (8个)
- `test-reports/phase2.1-material-batches-report.md`
- `test-reports/phase2.2-equipment-report.md`
- `test-reports/phase2.3-suppliers-report.md`
- `test-reports/phase2.4-users-report.md`
- `test-reports/phase2.5-departments-report.md`
- `test-reports/phase2.6-quality-report.md`
- `test-reports/phase2.7-types-report.md`
- `test-reports/PHASE2_COMPLETE_E2E_REPORT.md` (综合报告)

### 测试数据
- `tests/data/prepare_phase2_test_data.sql`

---

## 🎯 下一步

1. ✅ **Issue #2已修复** - 批次创建API正常
2. ⏳ **开始Phase 2.1** - 原材料批次管理测试
3. ⏳ **准备测试数据** - 创建SQL脚本

**预计开始时间**: 准备就绪后立即开始  
**预计完成时间**: 3个工作日

---

**报告生成时间**: 2025-11-20 20:30  
**报告版本**: v1.0.0  
**规划人**: Claude Code
