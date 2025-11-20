# 数据库架构深度分析报告

**日期**: 2025-11-04
**分析范围**: cretas数据库全部36个表
**分析重点**: ID类型、字段冗余、表设计问题

---

## 📊 ID字段类型分布

### 当前状态

| ID类型 | 表数量 | 占比 | 最大值限制 |
|--------|--------|------|-----------|
| **int** | 24个表 | 66.7% | 21.4亿记录 |
| **bigint** | 10个表 | 27.8% | 922京记录 |
| **varchar(255)** | 2个表 | 5.6% | 255字符 |

### 详细清单

#### ✅ 使用 `int` 的表 (24个)
```
1. batch_equipment_usage
2. batch_work_sessions
3. customers
4. device_activations
5. employee_work_sessions
6. equipment
7. equipment_maintenance
8. factory_equipment
9. factory_settings
10. material_batch_adjustments
11. material_batches          ⚠️ 核心表
12. material_consumptions
13. material_product_conversions
14. platform_admins
15. processing_batches        ⚠️ 核心表
16. product_types
17. production_plan_batch_usage
18. production_plans          ⚠️ 核心表
19. raw_material_types
20. shipment_records
21. suppliers
22. users                     ⚠️ 核心表
23. whitelist
24. work_types
```

#### ✅ 使用 `bigint` 的表 (10个)
```
1. ai_analysis_results
2. ai_audit_logs
3. ai_quota_usage
4. ai_usage_log
5. equipment_usages
6. material_spec_config
7. production_batches         ⚠️ 与processing_batches类型不一致！
8. quality_inspections
9. system_logs
10. time_clock_records
```

#### ⚠️ 使用 `varchar(255)` 的表 (2个)
```
1. factories                  ⚠️ 核心表，外键引用多
2. sessions                   ⚠️ 性能敏感表
```

---

## 🔴 严重问题分析

### 问题1: 批次表ID类型不一致

**冲突**:
- `processing_batches.id` = **int**
- `production_batches.id` = **bigint**

**影响**:
- 两表功能相似，ID类型却不同
- 无法建立统一的批次接口
- JOIN操作需要类型转换

**业务影响**: 高
**技术债务**: 高

---

### 问题2: factories表使用varchar作为ID

**当前设计**:
```sql
factories.id = varchar(255)  -- 如 "F001"
```

**被引用表** (17个):
- users.factory_id
- material_batches.factory_id
- production_plans.factory_id
- customers.factory_id
- suppliers.factory_id
- equipment.factory_id
- sessions.factory_id
- ... 等等

**问题**:
1. **存储浪费**: varchar(255) 比 int 大10倍以上
2. **索引效率**: 字符串索引比整数索引慢
3. **JOIN性能**: 字符串比较比整数慢数倍
4. **内存占用**: 每个foreign key都占用更多内存

**但是**:
- 业务含义清晰 ("F001" 比 1 更直观)
- 已广泛使用，迁移成本极高

**建议**:
- **短期**: 保持现状，优化索引
- **长期**: 逐步迁移到整数ID + code字段分离

---

### 问题3: sessions表使用varchar作为ID

**当前设计**:
```sql
sessions.id = varchar(255)  -- UUID或token
```

**分析**:
- ✅ **合理**: Session ID通常是UUID或随机字符串
- ✅ **安全**: 不可预测性高
- ⚠️ **性能**: 索引查询较慢

**建议**: 保持现状 (这是合理的设计)

---

## ⚠️ material_batches 表字段冗余分析

### 数量相关字段 (7个字段！)

| 字段名 | 类型 | 含义 | 状态 |
|--------|------|------|------|
| `receipt_quantity` | decimal(10,2) | 收货数量 | ✅ 核心字段 |
| `initial_quantity` | decimal(10,2) | 初始数量 | ⚠️ 与receipt_quantity重复 |
| `current_quantity` | decimal(10,2) | 当前数量 | ⚠️ 应该计算：receipt - used |
| `remaining_quantity` | decimal(10,2) | 剩余数量 | ⚠️ 与current_quantity重复 |
| `total_quantity` | decimal(10,2) | 总数量 | ⚠️ 与receipt_quantity重复 |
| `used_quantity` | decimal(10,2) | 已用数量 | ✅ 核心字段 |
| `reserved_quantity` | decimal(10,2) | 预留数量 | ✅ 核心字段 |

### 价格/价值字段 (3个字段)

| 字段名 | 类型 | 含义 | 状态 |
|--------|------|------|------|
| `unit_price` | decimal(10,2) | 单价 | ✅ 核心字段 |
| `total_price` | decimal(10,2) | 总价 | ⚠️ 应该计算：unit_price × quantity |
| `total_value` | decimal(10,2) | 总价值 | ⚠️ 与total_price重复 |

### 重量字段 (2个字段)

| 字段名 | 类型 | 含义 | 状态 |
|--------|------|------|------|
| `weight_per_unit` | decimal(10,3) | 单位重量 | ✅ 核心字段 |
| `total_weight` | decimal(10,3) | 总重量 | ⚠️ 应该计算：weight_per_unit × quantity |

### 🎯 优化方案

**保留核心字段** (6个):
```sql
receipt_quantity      -- 收货数量
used_quantity         -- 已用数量
reserved_quantity     -- 预留数量
unit_price           -- 单价
weight_per_unit      -- 单位重量
quantity_unit        -- 数量单位
```

**删除冗余字段** (7个):
```sql
initial_quantity      -- 删除，等同于receipt_quantity
current_quantity      -- 删除，改为计算属性：receipt - used - reserved
remaining_quantity    -- 删除，等同于current_quantity
total_quantity        -- 删除，等同于receipt_quantity
total_price          -- 删除，改为计算属性：unit_price × receipt_quantity
total_value          -- 删除，与total_price重复
total_weight         -- 删除，改为计算属性：weight_per_unit × receipt_quantity
```

**实现计算属性** (Java实体):
```java
@Transient
public BigDecimal getCurrentQuantity() {
    return receiptQuantity.subtract(usedQuantity).subtract(reservedQuantity);
}

@Transient
public BigDecimal getTotalPrice() {
    return unitPrice != null ? unitPrice.multiply(receiptQuantity) : BigDecimal.ZERO;
}

@Transient
public BigDecimal getTotalWeight() {
    return weightPerUnit != null ? weightPerUnit.multiply(receiptQuantity) : BigDecimal.ZERO;
}
```

**收益**:
- 字段数减少: 13 → 6 (减少54%)
- 数据一致性提升: 无冗余数据不一致风险
- 维护成本降低: 只需更新核心字段
- 存储空间节省: 每条记录节省 ~28字节

---

## ⚠️ 批次表设计不一致问题

### processing_batches vs production_batches

| 对比项 | processing_batches | production_batches |
|--------|-------------------|-------------------|
| **ID类型** | int | bigint |
| **继承** | extends BaseEntity | 不继承 |
| **字段数** | 17个 | 30个 |
| **created_at** | 来自BaseEntity | 自己定义 |
| **updated_at** | 来自BaseEntity | 自己定义 |
| **业务逻辑** | 简单 | 复杂（有计算方法） |

### 🎯 统一方案

**选项1: 合并为单表** (推荐)
```sql
CREATE TABLE batches (
    id bigint PRIMARY KEY AUTO_INCREMENT,
    batch_type varchar(20) NOT NULL,  -- 'PROCESSING' or 'PRODUCTION'
    -- 共同字段
    -- ...
)
```

**优点**:
- 统一管理
- 类型安全
- 易于扩展

**缺点**:
- 需要数据迁移
- 部分字段可能为NULL

**选项2: 统一继承BaseEntity**
```java
@Entity
public class ProductionBatch extends BaseEntity {  // 改为继承BaseEntity
    // 删除created_at, updated_at字段定义
}
```

**优点**:
- 改动最小
- 代码一致

---

## 💡 迁移优先级建议

### 🔴 P0 - 立即修复 (1周)

1. **简化material_batches字段**
   - 影响: 中等
   - 风险: 低
   - 收益: 高

2. **统一批次表继承**
   - 影响: 小
   - 风险: 低
   - 收益: 中

### 🟠 P1 - 近期规划 (2-4周)

3. **添加软删除机制**
   - 影响: 全局
   - 风险: 中
   - 收益: 高

4. **优化factories.id索引**
   - 不改类型，但优化索引策略
   - 影响: 中
   - 风险: 低
   - 收益: 中

### 🟡 P2 - 中期规划 (1-3个月)

5. **int → bigint 迁移** (核心表)
   - 影响: 高
   - 风险: 高
   - 需要停机维护
   - 建议逐表迁移

6. **批次表合并** (如果必要)
   - 影响: 高
   - 风险: 高
   - 需要业务评估

### ❌ 不推荐立即执行

7. **factories.id varchar → bigint**
   - 影响: 极高 (17个表级联修改)
   - 风险: 极高
   - 迁移成本: 极高
   - **建议**: 保持现状，优化索引即可

---

## 🎯 第二阶段实施建议

基于风险和收益分析，建议第二阶段聚焦于：

### ✅ 立即执行 (安全且高收益)

1. **简化material_batches字段** ⭐⭐⭐⭐⭐
   - 删除7个冗余字段
   - 添加计算属性
   - 更新相关Service和DTO

2. **统一批次表继承BaseEntity** ⭐⭐⭐⭐
   - ProductionBatch改为继承BaseEntity
   - 统一ID类型为bigint
   - 删除重复的时间戳字段

3. **实现软删除机制** ⭐⭐⭐⭐⭐
   - BaseEntity添加deleted_at
   - 使用@SQLDelete和@Where
   - 所有Service改为软删除

### ⚠️ 谨慎评估 (需要详细规划)

4. **核心表int → bigint迁移**
   - 需要停机维护窗口
   - 需要充分测试
   - 建议分阶段执行

### ❌ 暂不执行 (风险过高)

5. **factories.id类型变更**
   - 影响17个表
   - 需要重大重构
   - 建议长期规划

---

## 📋 下一步行动

**建议立即开始**:
1. 简化material_batches字段 (1-2天)
2. 统一批次表设计 (1天)
3. 实现软删除机制 (2-3天)

**总工期**: 约1周
**风险等级**: 低-中
**预期收益**: 高

---

**是否继续执行这些安全且高收益的优化？**
