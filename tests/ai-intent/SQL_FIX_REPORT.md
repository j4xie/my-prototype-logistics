# SQL Schema 修正报告

**生成时间**: 2026-01-16
**修正工具**: fix_sql_schemas.py

---

## 修正概览

### 文件处理统计

| 文件名 | 测试用例数 | 状态 |
|--------|-----------|------|
| test-cases-phase1-30.json | 30 | ✓ 已修正 |
| test-cases-p0-remaining-140.json | 142 | ✓ 已修正 |
| test-cases-p1-complete-165.json | 164 | ✓ 已修正 |
| test-cases-p2p3-complete-165.json | 165 | ✓ 已修正 |
| **总计** | **501** | **✓ 完成** |

---

## 修正规则

### 1. Schema 验证

基于 `sql_templates.txt` 中的正确schema进行验证:

#### material_batches (24个字段)
```
id, created_at, deleted_at, updated_at, batch_number, created_by,
expire_date, factory_id, last_used_at, material_type_id, notes,
production_date, purchase_date, quality_certificate, quantity_unit,
inbound_date, receipt_quantity, reserved_quantity, status,
storage_location, supplier_id, unit_price, used_quantity, weight_per_unit
```

#### raw_material_types (17个字段)
```
id, created_at, deleted_at, updated_at, category, code, created_by,
factory_id, is_active, max_stock, min_stock, name, notes,
shelf_life_days, storage_type, unit, unit_price
```

#### production_batches (38个字段)
```
id, created_at, deleted_at, updated_at, actual_quantity, batch_number,
created_by, defect_quantity, efficiency, end_time, equipment_cost,
equipment_id, equipment_name, factory_id, good_quantity, labor_cost,
material_cost, notes, other_cost, planned_quantity, product_name,
product_type_id, production_plan_id, quality_status, quantity,
start_time, status, supervisor_id, supervisor_name, total_cost, unit,
unit_cost, work_duration_minutes, worker_count, yield_rate,
photo_completed_stages, photo_required, sop_config_id
```

#### quality_inspections (14个字段)
```
id, created_at, deleted_at, updated_at, factory_id, fail_count,
inspection_date, inspector_id, notes, pass_count, pass_rate,
production_batch_id, result, sample_size
```

#### customers (28个字段)
```
id, created_at, deleted_at, updated_at, billing_address, business_license,
code, contact_email, contact_name, contact_person, contact_phone,
created_by, credit_limit, current_balance, customer_code, email,
factory_id, industry, is_active, name, notes, payment_terms, phone,
rating, rating_notes, shipping_address, tax_number, type
```

---

### 2. 字段名修正

| 错误字段名 | 正确字段名 |
|-----------|-----------|
| material_name | name |
| customer_name | name |
| material_category | category |

---

### 3. 时间格式修正

**修正前**:
```sql
'2026-01-15'
```

**修正后**:
```sql
'2026-01-15 00:00:00'
```

所有日期字段统一使用完整的 `YYYY-MM-DD HH:MM:SS` 格式。

---

### 4. 不存在字段处理

以下字段不在正确的schema中,已标记警告但保留在SQL中(可能需要手动检查):

- `address` (在 customers 表中,3处)
- `last_order_date` (在 customers 表中,1处)

---

## 修正示例

### 示例 1: material_batches

**修正前**:
```sql
INSERT INTO material_batches (id, batch_number, material_type_id, factory_id, receipt_quantity, quantity_unit, used_quantity, reserved_quantity, status, created_by, inbound_date, created_at, updated_at)
VALUES ('MB_TEST_001', 'BATCH-20260115-001', 'MT_FISH_001', 'F001', 500.00, 'kg', 0.00, 0.00, 'AVAILABLE', 1, '2026-01-15', NOW(), NOW())
```

**修正后**:
```sql
INSERT INTO material_batches (id, batch_number, material_type_id, factory_id, receipt_quantity, quantity_unit, used_quantity, reserved_quantity, status, created_by, inbound_date, created_at, updated_at)
VALUES ('MB_TEST_001', 'BATCH-20260115-001', 'MT_FISH_001', 'F001', 500.00, 'kg', 0.00, 0.00, 'AVAILABLE', 1, '2026-01-15 00:00:00', NOW(), NOW())
```

**变更**: 时间格式从 `'2026-01-15'` 修正为 `'2026-01-15 00:00:00'`

---

### 示例 2: production_batches

**修正前**:
```sql
INSERT INTO production_batches (id, batch_number, factory_id, product_type_id, product_name, quantity, unit, status, start_time, created_at, updated_at)
VALUES (9001, 'PB-20260115-001', 'F001', 'PT_001', '冷冻带鱼段', 1000.00, 'kg', 'IN_PROGRESS', '2026-01-15 08:00:00', NOW(), NOW())
```

**修正后**:
```sql
INSERT INTO production_batches (id, batch_number, factory_id, product_type_id, product_name, quantity, unit, status, start_time, created_at, updated_at)
VALUES (9001, 'PB-20260115-001', 'F001', 'PT_001', '冷冻带鱼段', 1000.00, 'kg', 'IN_PROGRESS', '2026-01-15 08:00:00', NOW(), NOW())
```

**变更**: 保持正确格式,无需修改

---

## 备份说明

原始文件已备份到 `backup/` 目录:
```
backup/test-cases-phase1-30.json
backup/test-cases-p0-remaining-140.json
backup/test-cases-p1-complete-165.json
backup/test-cases-p2p3-complete-165.json
```

如需恢复原始文件:
```bash
cp backup/*.json .
```

---

## 验证建议

### 1. 数据库连接测试
```bash
# 测试连接
mysql -h 139.196.165.140 -u root -p creats-test

# 验证表结构
DESCRIBE material_batches;
DESCRIBE raw_material_types;
DESCRIBE production_batches;
DESCRIBE quality_inspections;
DESCRIBE customers;
```

### 2. SQL 语法测试

从修正后的测试文件中提取一条SQL并在测试数据库中执行:
```bash
# 提取第一条测试SQL
cat test-cases-phase1-30.json | jq -r '.testCases[0].testDataSetup.sql'

# 在数据库中测试执行
```

### 3. 自动化测试

运行测试套件验证所有修正后的SQL:
```bash
# 假设有测试运行器
./run-tests.sh test-cases-phase1-30.json
```

---

## 注意事项

### ⚠️ 手动检查项

1. **customers 表中的 address 字段**
   - 出现在 3 个测试用例中
   - 字段不在标准schema中
   - 建议检查是否应该使用 `billing_address` 或 `shipping_address`

2. **customers 表中的 last_order_date 字段**
   - 出现在 1 个测试用例中
   - 字段不在标准schema中
   - 建议确认是否需要添加此字段到schema或删除

### ✅ 已验证项

1. ✓ 所有INSERT语句的列名都经过schema验证
2. ✓ 时间格式统一使用完整datetime格式
3. ✓ NOW()函数保持完整
4. ✓ 多语句SQL正确分隔
5. ✓ 字符串引号正确转义

---

## 工具说明

**修正脚本**: `fix_sql_schemas.py`

功能:
- 自动提取和验证INSERT语句中的列名
- 修正字段名映射关系
- 统一时间格式
- 处理嵌套括号和引号
- 生成详细的修正报告

使用方法:
```bash
python3 fix_sql_schemas.py
```

---

## 修正完成

✓ 所有 501 个测试用例的SQL已成功修正
✓ 原始文件已备份到 backup/ 目录
✓ 修正后的文件已替换原文件
✓ 可以开始运行测试验证

---

**报告生成**: fix_sql_schemas.py
**最后更新**: 2026-01-16
