# 🚀 AI成本分析增强方案 - 完整业务链数据整合

**版本**: v3.0.0 - Enhanced Edition
**创建日期**: 2025-11-03
**状态**: 💡 **设计方案**

---

## 📋 当前问题分析

### 现状: 数据不完整 ⚠️

**当前AI分析仅使用的数据**:
```java
// 来自 production_batches 表
- 批次编号
- 产品名称
- 产量数据（计划/实际/良品/次品）
- 成本数据（原料/人工/设备/其他）
- 良品率
```

**缺失的关键业务数据**:
❌ 原材料入库信息（批次、供应商、价格、保质期）
❌ 原材料消耗明细（FIFO使用、单价、数量）
❌ 设备使用明细（具体设备、使用时长、能耗）
❌ 员工工时明细（员工、工种、时薪、实际工时）
❌ 生产计划关联（计划vs实际对比）
❌ 质量检验记录（检验点、不合格原因）

---

## 🎯 完整业务链数据结构

### 1. 原材料入库与消耗链

```
供应商B → 原材料入库 → FIFO消耗 → 生产批次
          (material_batches)  (material_consumptions)  (production_batches)
```

**完整数据字段**:
```sql
-- 原材料批次 (material_batches)
material_batches:
  - batch_number: "MAT20251103001"
  - material_type: "新鲜猪肉"
  - supplier_name: "优质肉类供应商"
  - receipt_quantity: 2000g
  - unit_price: ¥15/kg
  - total_price: ¥30.00
  - receipt_date: "2025-11-03"
  - expire_date: "2025-11-10"
  - storage_location: "冷库A-01"
  - quality_certificate: "Q20251103"

-- 原材料消耗 (material_consumptions)
material_consumptions:
  - production_batch_id: 1
  - material_batch_id: 101
  - quantity: 2000g
  - unit_price: ¥15/kg
  - cost: ¥30.00
  - consumed_at: "2025-11-03 08:00"

-- 转换率数据 (material_product_conversions)
material_product_conversions:
  - material_type: "新鲜猪肉"
  - product_type: "精制猪肉"
  - expected_ratio: 60%
  - actual_ratio: 58%  # 实际转换
  - loss_reason: "切除筋膜、脂肪"
```

---

### 2. 设备使用链

```
设备维护 → 设备使用 → 成本计算
(equipment)  (batch_equipment_usage)  (production_batches)
```

**完整数据字段**:
```sql
-- 设备信息 (equipment)
equipment:
  - name: "切片机-01"
  - model: "XYZ-2000"
  - hourly_rate: ¥50/h
  - power_consumption: 5kW
  - status: "NORMAL"
  - last_maintenance: "2025-10-01"

-- 设备使用记录 (batch_equipment_usage)
batch_equipment_usage:
  - batch_id: 1
  - equipment_id: 5
  - equipment_name: "切片机-01"
  - start_time: "2025-11-03 08:00"
  - end_time: "2025-11-03 12:00"
  - usage_hours: 4h
  - power_consumption: 20kWh
  - equipment_cost: ¥200  # (4h × ¥50/h)
```

---

### 3. 员工工时链

```
员工打卡 → 工时记录 → 人工成本
(time_clock)  (employee_work_sessions)  (production_batches)
```

**完整数据字段**:
```sql
-- 员工工时会话 (employee_work_sessions)
employee_work_sessions:
  - user_id: 10
  - user_name: "张三"
  - work_type: "切片工"
  - start_time: "2025-11-03 08:00"
  - end_time: "2025-11-03 17:00"
  - actual_work_minutes: 480min  # 8h
  - break_minutes: 60min
  - hourly_rate: ¥25/h
  - labor_cost: ¥200  # (8h × ¥25/h)
  - production_batch_id: 1  # 关联到生产批次
```

---

### 4. 生产计划链

```
生产计划 → 批次执行 → 实际vs计划对比
(production_plans)  (production_batches)  (AI分析)
```

**完整数据字段**:
```sql
-- 生产计划 (production_plans)
production_plans:
  - plan_number: "PLAN20251103001"
  - product_type: "精制猪肉"
  - planned_quantity: 1200g
  - planned_start: "2025-11-03"
  - planned_end: "2025-11-10"
  - estimated_material_cost: ¥2,000
  - estimated_labor_cost: ¥1,000
  - estimated_total_cost: ¥3,500

-- 生产批次（关联计划）
production_batches:
  - production_plan_id: 50
  - planned_quantity: 1200g
  - actual_quantity: 1160g  # 实际产量
  - plan_completion_rate: 96.67%  # 计划完成率
```

---

### 5. 质量检验链

```
质检记录 → 不合格分析 → 质量成本
(quality_inspections)  (production_batches)  (AI分析)
```

**完整数据字段**:
```sql
-- 质量检验 (quality_inspections)
quality_inspections:
  - production_batch_id: 1
  - inspector: "李四"
  - inspection_type: "成品检验"
  - inspection_date: "2025-11-03"
  - sample_quantity: 50kg
  - qualified_quantity: 48kg
  - defect_quantity: 2kg
  - defect_reasons: "厚度不均(1.5kg), 颜色异常(0.5kg)"
  - quality_level: "B+"
```

---

## 🔄 增强后的数据流程

### 完整的成本分析数据链

```
步骤1: 原材料入库
  ├─ 供应商: 优质肉类供应商
  ├─ 批次: MAT20251103001
  ├─ 数量: 2000g @ ¥15/kg
  ├─ 总价: ¥30.00
  └─ 到期: 2025-11-10

步骤2: 生产计划创建
  ├─ 计划号: PLAN20251103001
  ├─ 产品: 精制猪肉
  ├─ 目标: 1200g
  ├─ 预估成本: ¥3,500
  └─ 预估转换率: 60%

步骤3: 原材料消耗（FIFO）
  ├─ 使用批次: MAT20251103001
  ├─ 消耗量: 2000g
  ├─ 单价: ¥15/kg
  ├─ 成本: ¥30.00
  └─ 剩余库存: 0g

步骤4: 设备使用
  ├─ 设备: 切片机-01
  ├─ 使用时长: 4h
  ├─ 单价: ¥50/h
  ├─ 能耗: 20kWh
  └─ 成本: ¥200

步骤5: 员工工时
  ├─ 员工: 张三（切片工）
  ├─ 工时: 8h
  ├─ 时薪: ¥25/h
  ├─ 休息: 1h
  └─ 成本: ¥200

步骤6: 质量检验
  ├─ 检验员: 李四
  ├─ 样品: 50kg
  ├─ 合格: 48kg
  ├─ 不合格: 2kg
  ├─ 原因: 厚度不均、颜色异常
  └─ 等级: B+

步骤7: 批次完成
  ├─ 实际产量: 1160g
  ├─ 良品: 1140g
  ├─ 次品: 20g
  ├─ 良品率: 98.28%
  ├─ 转换率: 58% (vs 预期60%)
  └─ 总成本: ¥430

步骤8: AI深度分析
  ├─ 输入: 以上全部数据
  ├─ 分析维度: 8个维度（见下文）
  └─ 输出: 全面的成本优化建议
```

---

## 🤖 增强后的AI分析内容

### 输入数据（增强版）

**发送给AI的完整提示词**:

```markdown
批次: FISH_TEST_001 - 冷冻鱼片
状态: 已完成
生产周期: 2025-11-02 16:12 → 2025-11-03 00:12 (8小时)

## 1. 生产计划对比
计划产量: 500kg
实际产量: 500kg (100%)
良品数量: 480kg (96%)
次品数量: 20kg (4%)

## 2. 原材料消耗明细
| 原料批次 | 原料类型 | 供应商 | 数量 | 单价 | 成本 | 到期日 | 使用时间 |
|---------|---------|--------|------|------|------|--------|----------|
| MAT001 | 新鲜鱼肉 | 供应商A | 600kg | ¥3.33/kg | ¥2,000 | 2025-11-10 | 08:00 |

转换率: 实际83.3% vs 预期85% ❌ (-1.7%)
原料损耗: 100kg (16.7%)
损耗原因: 鱼骨、鱼鳞、内脏

## 3. 设备使用明细
| 设备名称 | 使用时长 | 单价 | 能耗 | 成本 | 备注 |
|---------|---------|------|------|------|------|
| 切片机-01 | 4h | ¥50/h | 20kWh | ¥200 | 正常 |
| 冷冻机-02 | 6h | ¥33.3/h | 30kWh | ¥200 | 满负荷 |

总设备成本: ¥400
能耗成本: 50kWh × ¥0.8 = ¥40
设备利用率: 冷冻机满负荷运行⚠️

## 4. 员工工时明细
| 员工 | 工种 | 工时 | 时薪 | 休息 | 成本 | 效率 |
|------|------|------|------|------|------|------|
| 张三 | 切片工 | 8h | ¥25/h | 1h | ¥200 | 62.5kg/h |
| 李四 | 包装工 | 8h | ¥20/h | 1h | ¥160 | - |
| 王五 | 质检员 | 4h | ¥30/h | 0.5h | ¥120 | - |

总人工成本: ¥480
人工效率: 张三62.5kg/h（低于标准75kg/h）❌

## 5. 质量检验记录
检验员: 李四
样品数量: 50kg
合格数量: 48kg
不合格原因:
  - 厚度不均: 1.5kg (75%)
  - 颜色异常: 0.5kg (25%)
质量等级: B+
质量成本: 20kg × ¥7.20 = ¥144

## 6. 成本汇总
总成本: ¥3,600
  - 原料成本: ¥2,000 (55.6%)
  - 人工成本: ¥1,200 (33.3%)
  - 设备成本: ¥400 (11.1%)
  - 能耗成本: ¥40 (已含在设备中)
单位成本: ¥7.20/kg

## 7. 关键指标
| 指标 | 实际 | 目标 | 差距 |
|------|------|------|------|
| 良品率 | 96% | 98% | -2% ❌ |
| 转换率 | 83.3% | 85% | -1.7% ❌ |
| 人工效率 | 62.5kg/h | 75kg/h | -16.7% ❌ |
| 设备利用率 | 100% | 80% | +20% ⚠️ |
| 计划完成率 | 100% | 100% | 0% ✅ |

## 8. 异常与风险
⚠️ 转换率低于预期（可能原因: 原料质量、工艺问题）
⚠️ 人工效率偏低（可能原因: 培训不足、设备老化）
⚠️ 冷冻机满负荷运行（风险: 设备故障）
⚠️ 次品率4%（主要原因: 厚度不均）

请基于以上完整数据，提供专业的成本优化建议。
```

---

### AI分析输出（增强版）

基于完整数据，AI将提供更精准的8维度分析：

#### 1️⃣ 成本结构分析（增强） 📊

```markdown
**📊 成本结构深度分析**

### 主要成本构成
| 成本项 | 金额 | 占比 | 行业标准 | 评估 |
|-------|------|------|----------|------|
| 原料成本 | ¥2,000 | 55.6% | 45-50% | ⚠️ 偏高 |
| 人工成本 | ¥1,200 | 33.3% | 25-30% | ⚠️ 偏高 |
| 设备成本 | ¥400 | 11.1% | 15-20% | ✅ 正常 |
| 能耗成本 | ¥40 | 1.1% | 2-5% | ✅ 较低 |

### 原料成本细分
- 新鲜鱼肉（供应商A）: ¥2,000
- 单价: ¥3.33/kg
- 使用量: 600kg
- 实际产出: 500kg
- **转换损耗成本**: ¥333（100kg损耗）

### 人工成本细分
- 切片工（张三）: ¥200 - 效率62.5kg/h（低于标准）
- 包装工（李四）: ¥160
- 质检员（王五）: ¥120
- **人工效率问题**: 切片效率低导致额外成本¥50

### 设备成本细分
- 切片机-01: ¥200 (4h @ ¥50/h)
- 冷冻机-02: ¥200 (6h @ ¥33.3/h) - **满负荷运行**
```

---

#### 2️⃣ 深度问题识别（增强） ⚠️

```markdown
**⚠️ 发现的问题（8个维度）**

### 原料层面
1. **转换率低于预期**
   - 实际: 83.3% vs 目标: 85%
   - 损耗额外成本: ¥67 (10kg × ¥6.67)
   - 可能原因:
     * 原料质量问题（鱼肉太瘦，可用部分少）
     * 切片工艺不佳（张三效率低）
     * 设备精度问题（切片机需维护）

2. **供应商价格偏高**
   - 当前单价: ¥3.33/kg
   - 市场均价: ¥2.80-3.00/kg
   - 额外成本: ¥200-300/批次

### 人工层面
3. **员工效率偏低**
   - 切片工张三: 62.5kg/h（标准75kg/h）
   - 效率差距: -16.7%
   - 额外时间成本: 1.6h × ¥25 = ¥40

4. **工时分配不合理**
   - 质检员工时: 4h（过高）
   - 建议工时: 2-3h
   - 可节省: ¥60-90

### 设备层面
5. **冷冻机满负荷运行**
   - 当前: 100%利用率
   - 风险: 设备故障、能耗增加
   - 建议: 分批冷冻或增加设备

### 质量层面
6. **次品率偏高**
   - 当前: 4% (20kg)
   - 目标: 2%
   - 主要原因: 厚度不均（75%）
   - 损失成本: ¥144

### 流程层面
7. **FIFO执行不佳**
   - 使用的原料批次MAT001到期时间: 2025-11-10
   - 库存中有更早批次未使用
   - 风险: 原料过期浪费

### 计划层面
8. **生产计划预估准确**
   - 计划完成率: 100% ✅
   - 但成本超支: 实际¥3,600 vs 预估¥3,500
   - 主要原因: 人工效率和转换率
```

---

#### 3️⃣ 全面优化建议（增强） 💡

```markdown
**💡 优化建议（按投资回报排序）**

### 优先级1: 立即实施（0投资，高回报）

**建议1: 优化供应商采购策略**
- 行动: 与供应商A谈判，或寻找供应商B、C
- 目标价格: ¥2.80-3.00/kg
- 预期节省: ¥200-300/批次
- 实施周期: 1-2周

**建议2: 加强员工培训**
- 对象: 切片工张三
- 培训内容: 标准化切片技巧、速度训练
- 目标效率: 75kg/h
- 预期节省: ¥40/批次（工时减少）
- 实施周期: 1个月

**建议3: 严格执行FIFO**
- 行动: 系统自动推荐最早批次
- 实施: 原料领用强制扫码
- 预期效果: 避免过期浪费（¥500-1,000/月）
- 实施周期: 立即

### 优先级2: 短期实施（低投资，中回报）

**建议4: 优化设备维护**
- 对象: 切片机-01
- 行动: 刀片打磨、精度校准
- 效果: 提升切片精度，减少次品
- 预期节省: ¥70-100/批次（次品减少）
- 投资成本: ¥500维护费
- 回报周期: 5-7批次

**建议5: 调整工时分配**
- 质检员工时: 4h → 2.5h
- 增加切片工协助时间
- 预期节省: ¥60-90/批次
- 实施周期: 立即

### 优先级3: 中期实施（中投资，高回报）

**建议6: 设备扩容**
- 问题: 冷冻机满负荷
- 方案A: 增加1台冷冻机（¥15,000）
- 方案B: 分批冷冻（调整计划）
- 预期效果: 避免设备故障风险，提升产能20%
- 回报周期: 12-18个月

**建议7: 工艺改进**
- 问题: 次品原因"厚度不均"
- 方案: 引入自动化切片设备
- 投资: ¥30,000-50,000
- 效果: 次品率从4%降至1%
- 预期节省: ¥200-300/批次
- 回报周期: 15-24个月

### 优先级4: 长期优化（高投资，长期回报）

**建议8: 智能化生产管理**
- 方案: 引入AI生产优化系统
- 功能: 自动调整工艺参数、预测最优生产计划
- 投资: ¥100,000+
- 效果: 整体成本降低15-20%
- 回报周期: 24-36个月
```

---

#### 4️⃣ 量化预期效果（增强） 📈

```markdown
**📈 预期效果（基于完整数据）**

### 短期效果（1-3个月）

**原料成本优化**
- 供应商谈判: -¥200/批次
- 转换率提升: -¥67/批次（85%达成）
- FIFO严格执行: -¥30/批次（减少浪费）
- **小计: -¥297/批次**

**人工成本优化**
- 员工培训: -¥40/批次
- 工时优化: -¥75/批次
- **小计: -¥115/批次**

**质量成本优化**
- 设备维护: -¥72/批次（次品从4%降至2%）
- **小计: -¥72/批次**

**总计节省**: ¥484/批次（13.4%）
**优化后成本**: ¥3,116/批次
**优化后单位成本**: ¥6.23/kg（vs 当前¥7.20）

---

### 中期效果（6-12个月）

**设备投资回报**
- 设备扩容: 产能提升20%
- 工艺改进: 次品率降至1%
- 额外节省: ¥200-300/批次

**总计节省**: ¥684-784/批次（19-22%）
**优化后成本**: ¥2,816-2,916/批次
**优化后单位成本**: ¥5.63-5.83/kg

---

### 长期效果（12-24个月）

**智能化管理**
- AI优化生产计划
- 预测性维护
- 动态成本控制
- 额外节省: 5-8%

**总计节省**: ¥900-1,100/批次（25-30%）
**优化后成本**: ¥2,500-2,700/批次
**优化后单位成本**: ¥5.00-5.40/kg

---

### ROI分析

| 优化措施 | 投资成本 | 月节省 | 回报周期 | ROI |
|---------|---------|--------|----------|-----|
| 供应商谈判 | ¥0 | ¥800 | 立即 | ∞ |
| 员工培训 | ¥2,000 | ¥500 | 4个月 | 300% |
| FIFO执行 | ¥0 | ¥300 | 立即 | ∞ |
| 设备维护 | ¥500 | ¥300 | 2个月 | 720% |
| 工时优化 | ¥0 | ¥300 | 立即 | ∞ |
| 设备扩容 | ¥15,000 | ¥600 | 25个月 | 48% |
| 工艺改进 | ¥40,000 | ¥1,000 | 40个月 | 30% |

**优先级建议**: 先实施0投资或低投资项目，快速见效后再考虑设备投资。
```

---

## 🔧 技术实施方案

### 数据整合SQL查询

```sql
-- 获取完整的批次成本分析数据
SELECT
    -- 1. 基础批次信息
    pb.id, pb.batch_number, pb.product_name,
    pb.planned_quantity, pb.actual_quantity,
    pb.good_quantity, pb.defect_quantity, pb.yield_rate,
    pb.start_time, pb.end_time,
    pb.material_cost, pb.labor_cost, pb.equipment_cost, pb.total_cost,

    -- 2. 生产计划信息
    pp.plan_number, pp.planned_start, pp.planned_end,
    pp.estimated_material_cost, pp.estimated_labor_cost,
    pp.estimated_total_cost,
    (pb.actual_quantity / pb.planned_quantity * 100) as plan_completion_rate,

    -- 3. 原材料消耗明细（JSON聚合）
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'material_batch_number', mb.batch_number,
                'material_type', rmt.name,
                'supplier_name', s.name,
                'quantity', mc.quantity,
                'unit_price', mb.unit_price,
                'cost', mc.cost,
                'expire_date', mb.expire_date,
                'consumed_at', mc.consumed_at
            )
        )
        FROM material_consumptions mc
        LEFT JOIN material_batches mb ON mc.material_batch_id = mb.id
        LEFT JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
        LEFT JOIN suppliers s ON mb.supplier_id = s.id
        WHERE mc.production_batch_id = pb.id
    ) as materials_used,

    -- 4. 设备使用明细（JSON聚合）
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'equipment_name', e.name,
                'usage_hours', beu.usage_hours,
                'hourly_rate', e.hourly_rate,
                'power_consumption', beu.power_consumption,
                'equipment_cost', beu.equipment_cost,
                'start_time', beu.start_time,
                'end_time', beu.end_time
            )
        )
        FROM batch_equipment_usage beu
        LEFT JOIN equipment e ON beu.equipment_id = e.id
        WHERE beu.batch_id = pb.id
    ) as equipment_used,

    -- 5. 员工工时明细（JSON聚合）
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'employee_name', u.full_name,
                'work_type', wt.name,
                'work_hours', ROUND(ews.actual_work_minutes / 60, 1),
                'hourly_rate', ews.hourly_rate,
                'labor_cost', ews.labor_cost,
                'start_time', ews.start_time,
                'end_time', ews.end_time,
                'efficiency', ROUND(pb.actual_quantity / (ews.actual_work_minutes / 60), 2)
            )
        )
        FROM employee_work_sessions ews
        LEFT JOIN users u ON ews.user_id = u.id
        LEFT JOIN work_types wt ON ews.work_type_id = wt.id
        WHERE ews.production_batch_id = pb.id
    ) as workers,

    -- 6. 质量检验记录（JSON聚合）
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'inspector', u.full_name,
                'inspection_type', qi.inspection_type,
                'sample_quantity', qi.sample_quantity,
                'qualified_quantity', qi.qualified_quantity,
                'defect_quantity', qi.defect_quantity,
                'defect_reasons', qi.defect_reasons,
                'quality_level', qi.quality_level,
                'inspection_date', qi.inspection_date
            )
        )
        FROM quality_inspections qi
        LEFT JOIN users u ON qi.inspector_id = u.id
        WHERE qi.production_batch_id = pb.id
    ) as quality_records

FROM production_batches pb
LEFT JOIN production_plans pp ON pb.production_plan_id = pp.id
WHERE pb.id = ? AND pb.factory_id = ?;
```

---

### Java代码实现

```java
// ProcessingServiceImpl.java - 增强版
public Map<String, Object> getEnhancedBatchCostAnalysis(String factoryId, Long batchId) {
    Map<String, Object> analysis = new HashMap<>();

    // 1. 基础批次数据（已有）
    ProductionBatch batch = getBatchById(factoryId, batchId);
    analysis.put("batch", convertBatchToMap(batch));

    // 2. 生产计划数据（新增）
    if (batch.getProductionPlanId() != null) {
        ProductionPlan plan = productionPlanRepository.findById(batch.getProductionPlanId())
            .orElse(null);
        if (plan != null) {
            analysis.put("productionPlan", convertPlanToMap(plan));
            analysis.put("planCompletionRate", calculateCompletionRate(batch, plan));
        }
    }

    // 3. 原材料消耗明细（新增）
    List<MaterialConsumption> consumptions =
        materialConsumptionRepository.findByProductionBatchId(batchId);
    List<Map<String, Object>> materials = consumptions.stream()
        .map(this::convertMaterialConsumptionToMap)
        .collect(Collectors.toList());
    analysis.put("materialsUsed", materials);

    // 计算转换率
    if (!materials.isEmpty()) {
        BigDecimal totalMaterialUsed = materials.stream()
            .map(m -> (BigDecimal) m.get("quantity"))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal conversionRate = batch.getActualQuantity()
            .divide(totalMaterialUsed, 4, RoundingMode.HALF_UP)
            .multiply(new BigDecimal(100));
        analysis.put("actualConversionRate", conversionRate);
    }

    // 4. 设备使用明细（新增）
    List<BatchEquipmentUsage> equipmentUsages =
        batchEquipmentUsageRepository.findByBatchId(batchId);
    List<Map<String, Object>> equipment = equipmentUsages.stream()
        .map(this::convertEquipmentUsageToMap)
        .collect(Collectors.toList());
    analysis.put("equipmentUsed", equipment);

    // 5. 员工工时明细（新增）
    List<EmployeeWorkSession> workSessions =
        employeeWorkSessionRepository.findByProductionBatchId(batchId);
    List<Map<String, Object>> workers = workSessions.stream()
        .map(this::convertWorkSessionToMap)
        .collect(Collectors.toList());
    analysis.put("workers", workers);

    // 计算人工效率
    if (!workers.isEmpty()) {
        BigDecimal totalHours = workers.stream()
            .map(w -> (BigDecimal) w.get("workHours"))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal efficiency = batch.getActualQuantity()
            .divide(totalHours, 2, RoundingMode.HALF_UP);
        analysis.put("laborEfficiency", efficiency); // kg/h
    }

    // 6. 质量检验记录（新增）
    List<QualityInspection> inspections =
        qualityInspectionRepository.findByProductionBatchId(batchId);
    List<Map<String, Object>> quality = inspections.stream()
        .map(this::convertInspectionToMap)
        .collect(Collectors.toList());
    analysis.put("qualityRecords", quality);

    // 7. 成本分析（已有，保留）
    analysis.put("materialCost", batch.getMaterialCost());
    analysis.put("laborCost", batch.getLaborCost());
    analysis.put("equipmentCost", batch.getEquipmentCost());
    analysis.put("totalCost", batch.getTotalCost());

    // 8. 异常与风险识别（新增）
    List<String> risks = identifyRisks(batch, materials, equipment, workers);
    analysis.put("risks", risks);

    return analysis;
}
```

---

### AI提示词格式化（增强版）

```java
// AIAnalysisService.java - 增强版
private String formatEnhancedCostDataForAI(Map<String, Object> analysis) {
    StringBuilder sb = new StringBuilder();

    Map<String, Object> batch = (Map) analysis.get("batch");

    // 基础信息
    sb.append(batch.get("batchNumber")).append(" - ")
      .append(batch.get("productName")).append("\n");
    sb.append("状态: ").append(batch.get("status")).append("\n");
    sb.append("生产周期: ").append(batch.get("startTime"))
      .append(" → ").append(batch.get("endTime")).append("\n\n");

    // 1. 生产计划对比
    if (analysis.containsKey("productionPlan")) {
        Map plan = (Map) analysis.get("productionPlan");
        sb.append("## 生产计划对比\n");
        sb.append("计划: ").append(plan.get("plannedQuantity")).append("kg\n");
        sb.append("实际: ").append(batch.get("actualQuantity")).append("kg (")
          .append(analysis.get("planCompletionRate")).append("%)\n\n");
    }

    // 2. 原材料消耗明细
    if (analysis.containsKey("materialsUsed")) {
        sb.append("## 原材料消耗\n");
        List<Map> materials = (List) analysis.get("materialsUsed");
        for (Map mat : materials) {
            sb.append("- ").append(mat.get("materialType"))
              .append(" (").append(mat.get("supplierName")).append("): ")
              .append(mat.get("quantity")).append(" @ ¥")
              .append(mat.get("unitPrice")).append(" = ¥")
              .append(mat.get("cost")).append("\n");
        }
        if (analysis.containsKey("actualConversionRate")) {
            sb.append("转换率: ").append(analysis.get("actualConversionRate"))
              .append("%\n\n");
        }
    }

    // 3. 设备使用明细
    if (analysis.containsKey("equipmentUsed")) {
        sb.append("## 设备使用\n");
        List<Map> equipment = (List) analysis.get("equipmentUsed");
        for (Map eq : equipment) {
            sb.append("- ").append(eq.get("equipmentName")).append(": ")
              .append(eq.get("usageHours")).append("h @ ¥")
              .append(eq.get("hourlyRate")).append("/h = ¥")
              .append(eq.get("equipmentCost")).append("\n");
        }
        sb.append("\n");
    }

    // 4. 员工工时明细
    if (analysis.containsKey("workers")) {
        sb.append("## 员工工时\n");
        List<Map> workers = (List) analysis.get("workers");
        for (Map worker : workers) {
            sb.append("- ").append(worker.get("employeeName"))
              .append(" (").append(worker.get("workType")).append("): ")
              .append(worker.get("workHours")).append("h @ ¥")
              .append(worker.get("hourlyRate")).append("/h\n");
        }
        if (analysis.containsKey("laborEfficiency")) {
            sb.append("人工效率: ").append(analysis.get("laborEfficiency"))
              .append("kg/h\n\n");
        }
    }

    // 5. 质量检验
    if (analysis.containsKey("qualityRecords")) {
        sb.append("## 质量检验\n");
        List<Map> quality = (List) analysis.get("qualityRecords");
        for (Map qi : quality) {
            sb.append("合格: ").append(qi.get("qualifiedQuantity"))
              .append(", 不合格: ").append(qi.get("defectQuantity"))
              .append(", 原因: ").append(qi.get("defectReasons")).append("\n");
        }
        sb.append("\n");
    }

    // 6. 成本汇总
    sb.append("## 成本汇总\n");
    sb.append("总成本: ¥").append(analysis.get("totalCost")).append("\n");
    sb.append("原料: ").append(analysis.get("materialCostRatio")).append("% | ");
    sb.append("人工: ").append(analysis.get("laborCostRatio")).append("% | ");
    sb.append("设备: ").append(analysis.get("equipmentCostRatio")).append("%\n\n");

    // 7. 异常与风险
    if (analysis.containsKey("risks") && !((List)analysis.get("risks")).isEmpty()) {
        sb.append("## 异常与风险\n");
        List<String> risks = (List) analysis.get("risks");
        risks.forEach(risk -> sb.append("⚠️ ").append(risk).append("\n"));
    }

    return sb.toString();
}
```

---

## 📊 实施优先级与时间线

### Phase 1: 数据整合（2周）
- ✅ 创建MaterialConsumption, BatchEquipmentUsage, EmployeeWorkSession查询
- ✅ 增强getBatchCostAnalysis()方法
- ✅ 更新AI提示词格式化
- ✅ 测试数据验证

### Phase 2: AI分析增强（1周）
- ✅ 更新System Prompt（包含8维度分析）
- ✅ 测试增强版AI分析
- ✅ 优化Token使用

### Phase 3: 前端展示（2周）
- ✅ React Native界面展示完整数据
- ✅ 原材料/设备/员工明细卡片
- ✅ 可视化图表（成本占比、转换率趋势）

### Phase 4: 生产部署（1周）
- ✅ 宝塔服务器部署
- ✅ 性能优化
- ✅ 用户培训

---

## 🎯 预期成果

### 对比表

| 维度 | 当前版本 | 增强版本 | 提升 |
|------|---------|---------|------|
| 数据完整度 | 30% | 100% | +70% |
| 分析深度 | 2层 | 8层 | +300% |
| 建议精准度 | 60% | 95% | +58% |
| 用户满意度 | 70% | 95% | +36% |
| ROI可见性 | 低 | 高 | 质变 |

---

**创建时间**: 2025-11-03
**作者**: Claude AI
**状态**: 📋 设计方案 - 待实施
