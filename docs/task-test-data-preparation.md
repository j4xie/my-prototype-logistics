/**
 * 食品溯源系统 - 测试数据准备指南
 * @version 1.5.2
 * @module auth
 */

# 食品溯源系统集成测试数据准备指南

**创建日期**: 2025-07-25
**应用日期**: 2025-07-26
**责任团队**: 测试数据团队

## 1. 概述

本文档提供集成测试环境中测试数据的准备方法和标准，包括基础数据集、特定场景数据和测试账户配置等内容。测试数据主要用于验证系统各模块间的交互和协作，确保MVP功能在端到端流程中正常工作。

## 2. 数据准备原则

1. **真实性原则**: 数据应尽量接近真实业务场景
2. **完整性原则**: 数据应覆盖所有测试场景需求
3. **隔离性原则**: 不同测试间的数据应相互隔离
4. **安全性原则**: 所有生产数据必须经过脱敏处理
5. **可重现原则**: 测试数据应可被脚本重新生成

## 3. 基础测试数据集

### 3.1 用户账户数据

#### 系统用户数据

| 用户类型 | 数量 | 数据特点 |
|---------|------|---------|
| 系统管理员 | 5 | 具有所有系统权限 |
| 企业管理员 | 20 | 每个企业1-2个管理员账户 |
| 普通用户 | 50 | 基本权限，分属不同企业 |
| 只读用户 | 20 | 仅查看权限，无修改权限 |
| 特殊权限用户 | 5 | 特定功能模块的专有权限 |

#### 用户数据字段规范

```json
{
  "user_id": "UUID格式",
  "username": "test_user_[编号]",
  "email": "test[编号]@example.com",
  "phone": "+86-13800[6位随机数]",
  "role_id": "对应角色ID",
  "company_id": "关联企业ID",
  "status": "active/inactive/pending",
  "created_at": "2025-01-01至今的随机日期",
  "last_login": "创建日期之后的随机日期",
  "password_hash": "固定测试密码的哈希值",
  "verification_status": "verified/unverified"
}
```

#### 用户数据生成命令

```bash
# 生成系统管理员账户
node scripts/generate-test-data.js --type=admin --count=5 --output=admin_users.json

# 生成企业管理员账户
node scripts/generate-test-data.js --type=company_admin --count=20 --output=company_admin_users.json

# 生成普通用户账户
node scripts/generate-test-data.js --type=normal_user --count=50 --output=normal_users.json

# 生成只读用户账户
node scripts/generate-test-data.js --type=readonly_user --count=20 --output=readonly_users.json

# 生成特殊权限用户账户
node scripts/generate-test-data.js --type=special_user --count=5 --output=special_users.json
```

### 3.2 企业账户数据

#### 企业数据结构

| 企业类型 | 数量 | 数据特点 |
|---------|------|---------|
| 农业生产企业 | 10 | 上游生产企业，产品为农产品 |
| 食品加工企业 | 15 | 中游加工企业，处理农产品 |
| 食品分销企业 | 15 | 下游分销企业，分销成品 |
| 零售企业 | 10 | 终端零售商，面向消费者 |

#### 企业数据字段规范

```json
{
  "company_id": "UUID格式",
  "company_name": "测试企业[编号]",
  "company_type": "producer/processor/distributor/retailer",
  "registration_number": "GST[10位随机数]",
  "address": {
    "province": "随机省份",
    "city": "随机城市",
    "detail": "随机街道地址"
  },
  "contact_person": "联系人[编号]",
  "contact_phone": "+86-13900[6位随机数]",
  "contact_email": "company[编号]@example.com",
  "verification_status": "verified/pending/rejected",
  "created_at": "2025-01-01至今的随机日期",
  "updated_at": "创建日期之后的随机日期",
  "status": "active/inactive"
}
```

#### 企业数据生成命令

```bash
# 生成农业生产企业数据
node scripts/generate-test-data.js --type=producer_company --count=10 --output=producer_companies.json

# 生成食品加工企业数据
node scripts/generate-test-data.js --type=processor_company --count=15 --output=processor_companies.json

# 生成食品分销企业数据
node scripts/generate-test-data.js --type=distributor_company --count=15 --output=distributor_companies.json

# 生成零售企业数据
node scripts/generate-test-data.js --type=retailer_company --count=10 --output=retailer_companies.json
```

### 3.3 溯源记录数据

#### 溯源记录数据结构

| 记录类型 | 数量 | 数据特点 |
|---------|------|---------|
| 生产记录 | 1,500 | 上游企业的原料生产记录 |
| 加工记录 | 2,000 | 中游企业的加工流程记录 |
| 物流记录 | 1,000 | 物流和运输环节记录 |
| 销售记录 | 500 | 终端销售和流通记录 |

#### 溯源记录字段规范

```json
{
  "record_id": "UUID格式",
  "record_type": "production/processing/logistics/sales",
  "batch_number": "BATCH[8位随机字母数字]",
  "product_name": "测试产品[编号]",
  "quantity": "10-1000的随机数",
  "unit": "kg/ton/box/piece",
  "company_id": "关联企业ID",
  "operator_id": "关联用户ID",
  "timestamp": "2025-01-01至今的随机日期时间",
  "location": {
    "longitude": "随机经度值",
    "latitude": "随机纬度值",
    "address": "随机地址描述"
  },
  "previous_records": ["关联的上游记录ID列表"],
  "next_records": ["关联的下游记录ID列表"],
  "attributes": {
    "温度": "随机温度值",
    "湿度": "随机湿度值",
    "质检结果": "合格/不合格",
    "其他属性": "随机值"
  },
  "attachments": [
    {
      "attachment_id": "UUID格式",
      "name": "附件名称",
      "type": "image/document/video",
      "url": "附件URL",
      "size": "文件大小",
      "upload_time": "上传时间"
    }
  ],
  "status": "active/archived/deleted"
}
```

#### 溯源记录数据生成命令

```bash
# 生成生产记录数据
node scripts/generate-test-data.js --type=production_record --count=1500 --output=production_records.json

# 生成加工记录数据
node scripts/generate-test-data.js --type=processing_record --count=2000 --output=processing_records.json

# 生成物流记录数据
node scripts/generate-test-data.js --type=logistics_record --count=1000 --output=logistics_records.json

# 生成销售记录数据
node scripts/generate-test-data.js --type=sales_record --count=500 --output=sales_records.json
```

### 3.4 溯源链数据

#### 溯源链数据结构

| 溯源链类型 | 数量 | 数据特点 |
|-----------|------|---------|
| 完整溯源链 | 100 | 从生产到销售的完整记录链 |
| 部分溯源链 | 150 | 仅包含部分环节的记录链 |
| 多源溯源链 | 50 | 包含多个原料来源的记录链 |

#### 溯源链生成命令

```bash
# 生成完整溯源链数据
node scripts/generate-test-data.js --type=complete_chain --count=100 --output=complete_chains.json

# 生成部分溯源链数据
node scripts/generate-test-data.js --type=partial_chain --count=150 --output=partial_chains.json

# 生成多源溯源链数据
node scripts/generate-test-data.js --type=multi_source_chain --count=50 --output=multi_source_chains.json
```

## 4. 特定场景测试数据

### 4.1 离线操作测试数据

#### 离线操作场景描述

模拟用户在网络不可用情况下进行的操作，包括创建新记录、修改已有记录等，以及网络恢复后的数据同步过程。

#### 离线数据准备步骤

1. 创建基础溯源记录数据（100条）
2. 准备离线创建的新记录数据（50条）
3. 准备离线修改的记录数据（30条）
4. 配置数据同步冲突场景（20条）

#### 数据生成命令

```bash
# 生成离线操作基础数据
node scripts/generate-test-data.js --type=offline_base --count=100 --output=offline_base_records.json

# 生成离线创建记录数据
node scripts/generate-test-data.js --type=offline_new --count=50 --output=offline_new_records.json

# 生成离线修改记录数据
node scripts/generate-test-data.js --type=offline_modified --count=30 --output=offline_modified_records.json

# 生成同步冲突数据
node scripts/generate-test-data.js --type=sync_conflict --count=20 --output=sync_conflict_records.json
```

### 4.2 冲突解决测试数据

#### 冲突场景描述

模拟多用户同时编辑同一记录，或离线编辑与在线编辑同一记录产生的数据冲突，以及系统解决冲突的过程。

#### 冲突数据准备步骤

1. 创建基础共享记录数据（50条）
2. 准备用户A的修改版本（50条）
3. 准备用户B的修改版本（50条，与用户A修改相冲突）
4. 配置自动解决规则和手动解决场景

#### 数据生成命令

```bash
# 生成冲突测试基础数据
node scripts/generate-test-data.js --type=conflict_base --count=50 --output=conflict_base_records.json

# 生成用户A的修改版本
node scripts/generate-test-data.js --type=conflict_user_a --count=50 --base=conflict_base_records.json --output=conflict_user_a_records.json

# 生成用户B的修改版本
node scripts/generate-test-data.js --type=conflict_user_b --count=50 --base=conflict_base_records.json --output=conflict_user_b_records.json
```

### 4.3 大批量操作测试数据

#### 大批量场景描述

模拟系统处理大量数据的场景，如批量导入、导出、查询等操作，测试系统在高负载下的性能和稳定性。

#### 大批量数据准备步骤

1. 准备大批量导入数据（10,000条）
2. 准备大批量查询测试数据（50,000条）
3. 配置分页查询和实时加载场景

#### 数据生成命令

```bash
# 生成大批量导入测试数据
node scripts/generate-test-data.js --type=bulk_import --count=10000 --output=bulk_import_records.json

# 生成大批量查询测试数据
node scripts/generate-test-data.js --type=bulk_query --count=50000 --output=bulk_query_records.json
```

### 4.4 跨企业共享测试数据

#### 跨企业共享场景描述

模拟企业间共享溯源记录的场景，包括授权访问、限制访问、撤销访问等权限控制场景。

#### 跨企业数据准备步骤

1. 准备源企业的溯源记录（200条）
2. 配置目标企业的访问权限（10种权限组合）
3. 准备权限变更场景数据

#### 数据生成命令

```bash
# 生成跨企业共享基础数据
node scripts/generate-test-data.js --type=cross_company_records --count=200 --output=cross_company_records.json

# 生成企业访问权限配置
node scripts/generate-test-data.js --type=company_permissions --count=10 --output=company_permissions.json
```

## 5. 测试账户配置

### 5.1 通用测试账户

| 账户类型 | 用户名 | 密码 | 权限说明 |
|---------|-------|------|---------|
| 超级管理员 | admin | Test@12345 | 系统全部权限 |
| 只读管理员 | readonly_admin | Test@12345 | 系统只读权限 |
| 测试用户 | test_user | Test@12345 | 基本用户权限 |

### 5.2 场景专用测试账户

| 场景 | 用户名 | 密码 | 账户说明 |
|------|-------|------|---------|
| 认证测试 | auth_test | Test@12345 | 用于认证流程测试 |
| 权限测试 | permission_test | Test@12345 | 用于权限变更测试 |
| 企业管理测试 | company_admin_test | Test@12345 | 用于企业管理测试 |
| 溯源记录测试 | record_test | Test@12345 | 用于溯源记录管理测试 |
| 离线测试 | offline_test | Test@12345 | 用于离线功能测试 |

### 5.3 特殊状态测试账户

| 状态 | 用户名 | 密码 | 状态说明 |
|------|-------|------|---------|
| 待验证账户 | unverified_user | Test@12345 | 注册未验证状态 |
| 锁定账户 | locked_user | Test@12345 | 账户被临时锁定 |
| 禁用账户 | disabled_user | Test@12345 | 账户被管理员禁用 |
| 过期账户 | expired_user | Test@12345 | 账户已过期需续期 |

## 6. 数据导入与重置

### 6.1 数据导入流程

1. **准备环境**
   ```bash
   # 停止应用服务
   sudo systemctl stop traceability-app
   
   # 备份当前数据库
   pg_dump -U postgres -d traceability_test > backup_before_import.sql
   ```

2. **导入数据**
   ```bash
   # 清空测试数据库
   psql -U postgres -d traceability_test -c "TRUNCATE TABLE users, companies, trace_records, ... CASCADE;"
   
   # 导入基础数据
   node scripts/import-test-data.js --config=integration_test_config.json
   ```

3. **验证数据**
   ```bash
   # 验证数据导入结果
   node scripts/verify-test-data.js --config=integration_test_config.json
   ```

4. **启动服务**
   ```bash
   # 重启应用服务
   sudo systemctl start traceability-app
   ```

### 6.2 数据重置流程

```bash
# 执行数据重置脚本
node scripts/reset-test-data.js --config=integration_test_config.json

# 或者从备份恢复
psql -U postgres -d traceability_test < backup_before_import.sql
```

## 7. 数据验证方法

### 7.1 自动化验证

```bash
# 运行数据验证脚本
node scripts/validate-test-data.js --type=all

# 验证特定类型数据
node scripts/validate-test-data.js --type=users
node scripts/validate-test-data.js --type=companies
node scripts/validate-test-data.js --type=records
```

### 7.2 手动验证检查点

1. **用户数据验证**
   - 登录测试账户，确认权限设置正确
   - 验证用户关联关系正确

2. **企业数据验证**
   - 检查企业信息是否完整
   - 验证企业用户关联关系

3. **溯源记录验证**
   - 检查溯源记录内容完整性
   - 验证记录间的关联关系
   - 测试记录查询功能

## 8. 数据安全与隐私

### 8.1 数据脱敏规则

| 数据类型 | 脱敏方法 | 示例 |
|---------|---------|------|
| 姓名 | 替换为测试名称 | 真实姓名"张三" → 测试名称"测试用户123" |
| 电话号码 | 使用固定前缀+随机数 | 真实号码 → +86-13800123456 |
| 邮箱 | 使用测试域名 | 真实邮箱 → test123@example.com |
| 地址 | 使用通用描述+随机编号 | 真实地址 → 测试街道123号 |
| 身份证号 | 完全随机生成 | 随机18位数字和X |

### 8.2 脱敏处理脚本

```bash
# 对生产数据进行脱敏处理
node scripts/data-anonymizer.js --input=production_dump.json --output=anonymized_data.json --config=anonymize_rules.json
```

## 9. 附录

### 9.1 数据生成脚本使用说明

```
用法: node scripts/generate-test-data.js [选项]

选项:
  --type=TYPE       指定要生成的数据类型
  --count=NUMBER    指定要生成的数据数量
  --output=FILE     指定输出文件路径
  --base=FILE       指定基础数据文件（可选）
  --config=FILE     指定配置文件（可选）
  --seed=NUMBER     指定随机种子（可选）

示例:
  node scripts/generate-test-data.js --type=normal_user --count=50 --output=normal_users.json
```

### 9.2 常见问题与解决方案

1. **数据导入失败**
   - 问题: 数据导入过程中出现约束冲突
   - 解决: 检查外键关系，确保先导入基础表数据

2. **数据不完整**
   - 问题: 生成的数据缺少某些字段
   - 解决: 检查配置文件是否完整，更新数据模板

3. **数据生成缓慢**
   - 问题: 大量数据生成耗时长
   - 解决: 使用批处理模式，或分阶段生成数据

---

*文档版本: 1.0*  
*创建者: 测试数据团队*  
*审核者: 集成测试主管* 