# 服务器数据导入与前端集成测试指南
# Server Data Import & Frontend Integration Testing Guide

**最后更新**: 2025-11-22
**状态**: 测试数据准备完成，等待执行
**服务器地址**: 139.196.165.140:10010

---

## 📋 目录 (Table of Contents)

1. [快速开始](#快速开始)
2. [SQL数据导入步骤](#sql数据导入步骤)
3. [数据验证](#数据验证)
4. [前端集成测试](#前端集成测试)
5. [故障排除](#故障排除)

---

## 快速开始

### 方式1️⃣: 通过phpMyAdmin导入（推荐新手）

**步骤1**: 访问服务器phpMyAdmin
```
地址: http://139.196.165.140:888/phpmyadmin
用户名: root
密码: [服务器密码]
```

**步骤2**: 选择数据库 `cretas_db`

**步骤3**: 点击 **导入(Import)** 标签页

**步骤4**: 上传文件 `server_complete_test_data.sql`
- 在本地找到: `/Users/jietaoxie/my-prototype-logistics/server_complete_test_data.sql`
- 上传到phpMyAdmin

**步骤5**: 点击执行(Go)

**预期结果**: 屏幕显示绿色 "✅ 服务器完整测试数据导入成功！"

---

### 方式2️⃣: 通过宝塔终端导入（推荐快速）

**步骤1**: 登录宝塔面板
```
地址: https://139.196.165.140:16435/a96c4c2e
```

**步骤2**: 打开终端(SSH终端)

**步骤3**: 执行以下命令下载SQL文件到服务器
```bash
# 通过scp上传SQL文件到服务器
scp /Users/jietaoxie/my-prototype-logistics/server_complete_test_data.sql root@139.196.165.140:/www/wwwroot/project/
```

**步骤4**: 在宝塔终端执行以下命令导入数据
```bash
# 方式A: 使用mysql命令直接导入（推荐）
mysql -u root cretas_db < /www/wwwroot/project/server_complete_test_data.sql

# 方式B: 使用mysql客户端逐步执行
mysql -u root
# 然后在提示符下输入
use cretas_db;
source /www/wwwroot/project/server_complete_test_data.sql;
```

**预期输出**:
```
Query OK, 3 rows affected (X.XXs)
✅ 用户和密码
Count
3
✅ 产品类型
Count
6
...
✅ 服务器完整测试数据导入成功！
🔐 可用的测试账号和密码:
super_admin / 123456
```

---

## SQL数据导入步骤

### 第1部分: 更新用户密码
```sql
UPDATE users
SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username IN ('super_admin', 'dept_admin', 'operator1');

UPDATE platform_admins
SET password_hash = '$2b$12$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse'
WHERE username = 'platform_admin';
```

**说明**:
- 密码哈希对应明文密码: `123456`
- 更新现有用户账号，不创建新用户
- 影响行数: 4 (3 factory users + 1 platform admin)

---

### 第2部分: 产品类型 (Product Types)
```sql
INSERT IGNORE INTO product_types
(id, factory_id, name, code, category, unit, is_active, shelf_life_days, created_at, updated_at)
VALUES
('PT001', 'F001', '冷冻鱼片', 'PT001', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT002', 'F001', '冷冻虾仁', 'PT002', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT003', 'F001', '冷冻鱼块', 'PT003', '海鲜', '公斤', 1, 365, NOW(), NOW()),
('PT004', 'F001', '冷冻鸡肉', 'PT004', '肉类', '公斤', 1, 180, NOW(), NOW()),
('PT005', 'F001', '速冻蔬菜', 'PT005', '蔬菜', '公斤', 1, 180, NOW(), NOW()),
('FISH-001', 'F001', '鲈鱼片', 'FISH-001', '鱼片类', '公斤', 1, 365, NOW(), NOW());
```

**插入结果**: 6条产品类型记录

---

### 第3部分: 原料类型 (Raw Material Types)
```sql
INSERT IGNORE INTO raw_material_types
(id, factory_id, name, code, category, unit, storage_type, is_active, shelf_life_days, created_at, updated_at)
VALUES
('RMT001', 'F001', '鲜活鱼', 'RMT001', '海鲜', '公斤', '冷藏', 1, 3, NOW(), NOW()),
('RMT002', 'F001', '冷冻虾', 'RMT002', '海鲜', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('RMT003', 'F001', '鲜鸡肉', 'RMT003', '肉类', '公斤', '冷藏', 1, 7, NOW(), NOW()),
('RMT004', 'F001', '食盐', 'RMT004', '调料', '公斤', '常温', 1, 730, NOW(), NOW()),
('RMT005', 'F001', '新鲜蔬菜', 'RMT005', '蔬菜', '公斤', '冷藏', 1, 5, NOW(), NOW()),
('DY', 'F001', '带鱼', 'DY', '海水鱼', '公斤', '冷冻', 1, 365, NOW(), NOW()),
('LY', 'F001', '鲈鱼', 'LY', '淡水鱼', '公斤', '冷藏', 1, 7, NOW(), NOW());
```

**插入结果**: 7条原料类型记录

---

### 第4部分: 部门 (Departments)
```sql
INSERT IGNORE INTO departments
(id, factory_id, name, code, is_active, display_order, created_at, updated_at)
VALUES
(1, 'F001', '养殖部门', 'FARMING', 1, 1, NOW(), NOW()),
(2, 'F001', '加工部门', 'PROCESSING', 1, 2, NOW(), NOW()),
(3, 'F001', '物流部门', 'LOGISTICS', 1, 3, NOW(), NOW()),
(4, 'F001', '质量部门', 'QUALITY', 1, 4, NOW(), NOW()),
(5, 'F001', '管理部门', 'MANAGEMENT', 1, 5, NOW(), NOW()),
(10, 'F001', '加工部', 'DEPT_PROC', 1, 1, NOW(), NOW()),
(11, 'F001', '质检部', 'DEPT_QC', 1, 2, NOW(), NOW()),
(12, 'F001', '仓储部', 'DEPT_WARE', 1, 3, NOW(), NOW()),
(13, 'F001', '管理部', 'DEPT_MGMT', 1, 4, NOW(), NOW());
```

**插入结果**: 9条部门记录

---

### 第5部分: 供应商 (Suppliers)
```sql
INSERT IGNORE INTO suppliers
(id, factory_id, name, contact_person, contact_phone, contact_email, address, is_active, rating, created_at, updated_at)
VALUES
(100, 'F001', '海洋渔业有限公司', '张三', '13800138001', 'zhangsan@ocean.com', '浙江省舟山市', 1, 5, NOW(), NOW()),
(101, 'F001', '新鲜禽肉批发', '李四', '13800138002', 'lisi@poultry.com', '山东省济南市', 1, 4, NOW(), NOW()),
(102, 'F001', '绿色蔬菜基地', '王五', '13800138003', 'wangwu@veg.com', '江苏省南京市', 1, 4, NOW(), NOW()),
(103, 'F001', '优质调料供应商', '赵六', '13800138004', 'zhaoliu@spice.com', '广东省广州市', 1, 5, NOW(), NOW());
```

**插入结果**: 4条供应商记录

---

### 第6部分: 客户 (Customers)
```sql
INSERT IGNORE INTO customers
(id, factory_id, name, contact_person, contact_phone, contact_email, type, is_active, rating, created_at, updated_at)
VALUES
(100, 'F001', '大型连锁超市A', '陈经理', '13900139001', 'chen@supermarket-a.com', '零售', 1, 5, NOW(), NOW()),
(101, 'F001', '酒店集团B', '刘经理', '13900139002', 'liu@hotel-b.com', '餐饮', 1, 5, NOW(), NOW()),
(102, 'F001', '食品批发市场C', '周经理', '13900139003', 'zhou@market-c.com', '批发', 1, 5, NOW(), NOW()),
(103, 'F001', '连锁餐厅D', '吴经理', '13900139004', 'wu@restaurant-d.com', '餐饮', 1, 4, NOW(), NOW());
```

**插入结果**: 4条客户记录

---

## 数据验证

导入完成后，执行以下验证查询确保数据完整:

### 验证用户账号
```sql
SELECT username, role_code, is_active FROM users
WHERE username IN ('super_admin', 'dept_admin', 'operator1');
```

**预期结果** (3行):
```
| username    | role_code                | is_active |
|-------------|--------------------------|-----------|
| super_admin | factory_super_admin      | 1         |
| dept_admin  | department_admin         | 1         |
| operator1   | operator                 | 1         |
```

---

### 验证产品类型
```sql
SELECT id, name, category, shelf_life_days FROM product_types
WHERE factory_id='F001'
ORDER BY id;
```

**预期结果** (6行):
```
| id      | name       | category | shelf_life_days |
|---------|------------|----------|-----------------|
| FISH-001| 鲈鱼片     | 鱼片类   | 365            |
| PT001   | 冷冻鱼片   | 海鲜     | 365            |
| PT002   | 冷冻虾仁   | 海鲜     | 365            |
| PT003   | 冷冻鱼块   | 海鲜     | 365            |
| PT004   | 冷冻鸡肉   | 肉类     | 180            |
| PT005   | 速冻蔬菜   | 蔬菜     | 180            |
```

---

### 验证原料类型
```sql
SELECT id, name, storage_type, shelf_life_days FROM raw_material_types
WHERE factory_id='F001'
ORDER BY id;
```

**预期结果** (7行):
```
| id     | name       | storage_type | shelf_life_days |
|--------|------------|--------------|-----------------|
| DY     | 带鱼       | 冷冻         | 365            |
| LY     | 鲈鱼       | 冷藏         | 7              |
| RMT001 | 鲜活鱼     | 冷藏         | 3              |
| RMT002 | 冷冻虾     | 冷冻         | 365            |
| RMT003 | 鲜鸡肉     | 冷藏         | 7              |
| RMT004 | 食盐       | 常温         | 730            |
| RMT005 | 新鲜蔬菜   | 冷藏         | 5              |
```

---

### 验证部门
```sql
SELECT id, name, code FROM departments
WHERE factory_id='F001'
ORDER BY id;
```

**预期结果** (9行 - 包括功能部门和操作部门)

---

### 验证供应商和客户数量
```sql
SELECT 'Suppliers' AS Type, COUNT(*) AS Count FROM suppliers WHERE factory_id='F001'
UNION ALL
SELECT 'Customers', COUNT(*) FROM customers WHERE factory_id='F001';
```

**预期结果**:
```
| Type      | Count |
|-----------|-------|
| Customers | 4     |
| Suppliers | 4     |
```

---

## 前端集成测试

### 前置条件检查
```bash
# 1. 确认后端服务运行（应该返回200状态码）
curl http://139.196.165.140:10010/api/mobile/health

# 2. 检查数据库连接（应该看到初始化成功）
curl -s http://139.196.165.140:10010/api/mobile/CRETAS_2024_001/status
```

---

### 启动前端应用
```bash
# 1. 进入前端目录
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 2. 安装依赖（如果还没有）
npm install

# 3. 启动Expo开发服务器
npm start

# 或使用以下命令清除缓存后启动
npx expo start --clear

# 预期输出: Expo Metro Bundler on port 3010
```

---

### 登录测试流程

#### 测试账号信息
```
┌─────────────────────────────────────────────────────────────┐
│              可用的测试账号和密码                              │
├─────────────────┬──────────────────────────────────────────┤
│ 账号            │ 密码      │ 角色                          │
├─────────────────┼──────────┼────────────────────────────┤
│ super_admin     │ 123456   │ 工厂超级管理员                │
│ dept_admin      │ 123456   │ 部门管理员                    │
│ operator1       │ 123456   │ 操作员                        │
│ platform_admin  │ 123456   │ 平台管理员                    │
└─────────────────┴──────────┴────────────────────────────┘
```

---

#### 步骤1: 打开应用
1. 在Expo客户端（手机或模拟器）中扫描二维码或选择"Run on...(Android/iOS)"
2. 应该看到登录屏幕

---

#### 步骤2: 测试工厂用户登录（super_admin）
```
输入: super_admin
密码: 123456
点击: 登录
```

**预期结果**:
- ✅ 登录成功，收到访问令牌
- ✅ 显示工厂首页或仪表盘
- ✅ 显示账户信息: "工厂超级管理员"

---

#### 步骤3: 测试不同角色登录（dept_admin）
```
1. 在设置中或菜单中选择"退出登录"
2. 输入: dept_admin
3. 密码: 123456
4. 点击: 登录
```

**预期结果**:
- ✅ 登录成功
- ✅ 显示权限受限的仪表盘（仅显示该部门的数据）
- ✅ 某些管理功能不可用（权限限制）

---

#### 步骤4: 检查导入的业务数据
登录后，在应用中验证以下数据是否可见:

```
导航菜单 → 生产管理 → 产品列表
├─ 冷冻鱼片 (PT001)
├─ 冷冻虾仁 (PT002)
├─ 冷冻鱼块 (PT003)
├─ 冷冻鸡肉 (PT004)
├─ 速冻蔬菜 (PT005)
└─ 鲈鱼片 (FISH-001)

导航菜单 → 原料管理 → 原料类型
├─ 鲜活鱼 (RMT001)
├─ 冷冻虾 (RMT002)
├─ 鲜鸡肉 (RMT003)
├─ 食盐 (RMT004)
└─ 新鲜蔬菜 (RMT005)

导航菜单 → 采购管理 → 供应商
├─ 海洋渔业有限公司
├─ 新鲜禽肉批发
├─ 绿色蔬菜基地
└─ 优质调料供应商

导航菜单 → 销售管理 → 客户
├─ 大型连锁超市A
├─ 酒店集团B
├─ 食品批发市场C
└─ 连锁餐厅D
```

---

#### 步骤5: 验证API数据同步
打开浏览器开发者工具(DevTools)，查看网络请求:

```javascript
// 检查以下API是否返回200状态码和正确的数据

GET /api/mobile/F001/product-types
// 应返回: { data: [...6个产品] }

GET /api/mobile/F001/raw-material-types
// 应返回: { data: [...7个原料] }

GET /api/mobile/F001/suppliers
// 应返回: { data: [...4个供应商] }

GET /api/mobile/F001/customers
// 应返回: { data: [...4个客户] }

GET /api/mobile/F001/departments
// 应返回: { data: [...9个部门] }
```

---

## 故障排除

### 问题1: SQL导入失败 - "Table 不存在"

**原因**: 表结构在服务器上与脚本不匹配

**解决方案**:
```bash
# 1. 检查表是否存在
mysql -u root cretas_db -e "SHOW TABLES;"

# 2. 检查特定表的结构
mysql -u root cretas_db -e "DESCRIBE product_types;"

# 3. 如果表不存在，运行数据库初始化脚本
mysql -u root cretas_db < /path/to/schema.sql
```

---

### 问题2: 登录失败 - "Password Error"

**原因**: 密码哈希未正确更新

**解决方案**:
```bash
# 1. 验证密码哈希是否正确
mysql -u root cretas_db -e "SELECT username, password_hash FROM users WHERE username='super_admin';"

# 2. 手动更新密码（如果不正确）
mysql -u root cretas_db -e "UPDATE users SET password_hash='$2b\$12\$kNRuzD4ZSBttEir6cbwlteBTw7kq2lyz6aQnrwac1sn4i/eTLaRse' WHERE username='super_admin';"

# 3. 测试登录
curl -X POST "http://139.196.165.140:10010/api/mobile/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"super_admin","password":"123456"}'
```

---

### 问题3: 前端无法连接后端

**原因**: 网络配置或后端未运行

**解决方案**:
```bash
# 1. 检查后端是否运行
curl -s http://139.196.165.140:10010/api/mobile/health

# 2. 检查网络连接
ping 139.196.165.140

# 3. 在模拟器中，检查IP配置（Android使用10.0.2.2）
# 在config.ts中：
const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:10010'  // Android模拟器
  : 'http://139.196.165.140:10010'

# 4. 重启后端服务
ssh root@139.196.165.140
ps aux | grep java | grep -v grep | awk '{print $2}' | xargs kill -9
cd /www/wwwroot/project && nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > cretas-backend.log 2>&1 &
```

---

### 问题4: 应用崩溃 - "Cannot read property 'data' of undefined"

**原因**: API返回数据格式不正确

**解决方案**:
```javascript
// 在frontend/src/services/apiClient.ts中添加错误处理
try {
  const response = await api.get('/api/mobile/F001/product-types');
  console.log('API Response:', response);

  // 验证数据格式
  if (!response.data || !Array.isArray(response.data)) {
    throw new Error('Invalid API response format');
  }

  setProducts(response.data);
} catch (error) {
  console.error('API Error:', error);
  // 显示用户友好的错误提示
}
```

---

### 问题5: 数据未显示在应用中

**原因**: 可能是权限限制或缓存问题

**解决方案**:
```bash
# 1. 清除应用缓存
npx expo start --clear

# 2. 检查登录用户的权限
mysql -u root cretas_db -e "SELECT username, role_code FROM users WHERE username='super_admin';"

# 3. 验证API返回正确的数据
curl -H "Authorization: Bearer {access_token}" \
  http://139.196.165.140:10010/api/mobile/F001/product-types

# 4. 重启应用（热重载可能不够）
```

---

## 下一步行动 (Next Steps)

### ✅ 已完成
- [x] 后端服务部署 (139.196.165.140:10010)
- [x] 认证系统配置
- [x] 密码重置 (所有测试账号)
- [x] SQL测试数据脚本生成
- [x] 数据验证查询准备

### 📋 待完成
- [ ] 执行SQL数据导入脚本
- [ ] 验证所有数据正确插入
- [ ] 启动前端应用并测试登录
- [ ] 验证业务数据在应用中正确显示
- [ ] 完整的端到端集成测试
- [ ] 添加更多业务数据（可选）:
  - 原料批次 (material_batches)
  - 加工批次 (processing_batches)
  - 质检记录 (quality_inspections)
  - 生产计划 (production_plans)

---

## 📞 技术支持

如有任何问题，请参考:
1. **后端日志**: `/www/wwwroot/project/cretas-backend.log`
2. **数据库状态**: 在phpMyAdmin中检查表结构和数据
3. **前端错误**: 打开Expo DevTools查看控制台错误信息

**服务器信息**:
- API基础URL: `http://139.196.165.140:10010`
- 数据库: `cretas_db` (user: root)
- 宝塔面板: `https://139.196.165.140:16435/a96c4c2e`

---

## 参考文档

- [AUTH_INTEGRATION_SUMMARY.md](./AUTH_INTEGRATION_SUMMARY.md) - 认证系统详细文档
- [API_INTEGRATION_COMPLETE.md](./API_INTEGRATION_COMPLETE.md) - API实现完整报告
- [SERVER_DIAGNOSIS_REPORT.md](./SERVER_DIAGNOSIS_REPORT.md) - 服务器诊断报告
- [QUICK_START.md](./QUICK_START.md) - 项目快速入门
