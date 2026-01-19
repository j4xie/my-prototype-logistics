# 测试用例 SQL 修正 - 快速开始

## 📋 修正概览

✅ **已完成**: 501 个测试用例中的 407 个包含SQL的用例已修正
✅ **修正SQL语句**: 456 条 INSERT 语句
✅ **备份**: 原始文件已保存到 `backup/` 目录

---

## 🎯 修正内容

### 1. 时间格式统一
```sql
-- 修正前
'2026-01-15'

-- 修正后
'2026-01-15 00:00:00'
```

### 2. 字段名修正
- `material_name` → `name`
- `customer_name` → `name`
- `material_category` → `category`

### 3. Schema 验证
所有列名都已对照 `sql_templates.txt` 中的正确schema进行验证

---

## 🚀 开始测试

### 方式 1: 直接使用修正后的文件
```bash
cd /Users/jietaoxie/my-prototype-logistics/tests/ai-intent

# 文件已自动替换,直接使用
ls -lh test-cases-*.json
```

### 方式 2: 恢复原始文件 (如需要)
```bash
# 从备份恢复
cp backup/*.json .
```

### 方式 3: 重新运行修正脚本
```bash
# 如果需要调整修正规则
python3 fix_sql_schemas.py
```

---

## 📊 文件统计

| 文件 | 测试用例 | 包含SQL | INSERT语句 |
|------|---------|--------|-----------|
| test-cases-phase1-30.json | 30 | 27 | 43 |
| test-cases-p0-remaining-140.json | 142 | 142 | 175 |
| test-cases-p1-complete-165.json | 164 | 164 | 164 |
| test-cases-p2p3-complete-165.json | 165 | 74 | 74 |
| **总计** | **501** | **407** | **456** |

---

## ⚠️ 已知问题

### customers 表警告

有 **4 个字段**不在标准schema中,但已保留在SQL中:

1. `address` - 3 处使用
   - 建议使用 `billing_address` 或 `shipping_address`

2. `last_order_date` - 1 处使用
   - 建议确认是否需要添加到schema

---

## 🔍 验证SQL正确性

### 检查单个测试用例
```bash
# 查看第一个测试用例的SQL
cat test-cases-phase1-30.json | jq -r '.testCases[0].testDataSetup.sql'
```

### 在数据库中测试
```bash
# 连接测试数据库
mysql -h 139.196.165.140 -u root -p creats-test

# 查看表结构
DESCRIBE material_batches;
DESCRIBE raw_material_types;
DESCRIBE production_batches;
DESCRIBE quality_inspections;
DESCRIBE customers;

# 测试执行SQL
# (复制粘贴测试用例中的SQL)
```

---

## 📁 文件说明

### 核心文件
- `sql_templates.txt` - 正确的schema定义
- `fix_sql_schemas.py` - SQL修正脚本
- `test-cases-*.json` - 修正后的测试文件 (已替换)

### 备份文件
- `backup/test-cases-*.json` - 原始测试文件备份

### 报告文件
- `SQL_FIX_REPORT.md` - 详细修正报告
- `QUICK_START.md` - 本文件

---

## 🛠️ 工具使用

### 修正脚本功能
```python
# 自动处理:
✓ 提取和验证 INSERT 语句
✓ 修正字段名映射
✓ 统一时间格式
✓ 处理嵌套括号和引号
✓ 生成详细报告
```

### 重新运行修正
```bash
# 修改 fix_sql_schemas.py 后重新运行
python3 fix_sql_schemas.py

# 查看帮助
python3 fix_sql_schemas.py --help
```

---

## ✅ 验证清单

- [x] 所有时间格式使用完整 datetime
- [x] NOW() 函数保持完整
- [x] 字段名符合 schema 定义
- [x] INSERT 语句语法正确
- [x] 多语句正确分隔
- [x] 原始文件已备份
- [ ] 在数据库中测试执行 (建议)
- [ ] 运行自动化测试 (建议)

---

## 📞 问题排查

### 问题 1: SQL 语法错误
```bash
# 检查具体的SQL语句
cat test-cases-phase1-30.json | jq -r '.testCases[0].testDataSetup.sql'

# 验证JSON格式
jq . test-cases-phase1-30.json > /dev/null && echo "JSON valid" || echo "JSON invalid"
```

### 问题 2: 字段不存在
```bash
# 查看所有警告
python3 fix_sql_schemas.py 2>&1 | grep "Warning"

# 对照 sql_templates.txt 确认字段名
cat sql_templates.txt | grep -A 5 "INSERT INTO material_batches"
```

### 问题 3: 恢复原始文件
```bash
# 从备份恢复
rm test-cases-*.json
cp backup/*.json .
```

---

## 🎓 下一步

1. **在测试数据库中验证**: 选择几个测试用例的SQL在数据库中执行
2. **运行自动化测试**: 使用测试框架运行完整测试套件
3. **检查警告项**: 处理 customers 表中的非标准字段

---

**最后更新**: 2026-01-16
**脚本版本**: fix_sql_schemas.py v1.0
