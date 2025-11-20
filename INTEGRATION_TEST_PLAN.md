# 白垩纪食品溯源系统 - 完整集成测试计划

**生成时间**: 2025-11-20
**测试范围**: 19个功能模块，200+ API端点
**测试优先级**: P0 (核心) → P1 (高) → P2 (中) → P3 (低)

---

## 📋 测试总览

### 测试统计
- **总模块数**: 19个
- **测试用例数**: 约150个
- **预计测试时间**: 8-10小时
- **已完成**: 2个模块 (Dashboard统计、告警统计)
- **待测试**: 17个模块

### 测试环境
- **后端**: `http://localhost:10010`
- **数据库**: MySQL `cretas_db`
- **测试工厂**: `CRETAS_2024_001`
- **测试用户**: 需要真实的认证token

---

## 🎯 P0 优先级 - 核心业务流程

### 模块1: 认证与授权模块 ⏳

#### 测试用例 P0-1: 统一登录测试

**测试目标**: 验证平台管理员和工厂用户都能成功登录

**测试步骤**:

```bash
# 测试1.1: 平台管理员登录
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "platform_admin",
    "password": "Admin@123456",
    "deviceId": "test-device-001"
  }'

# 预期结果:
# {
#   "code": 200,
#   "success": true,
#   "data": {
#     "accessToken": "eyJ...",
#     "refreshToken": "eyJ...",
#     "userType": "platform_admin",
#     "userInfo": {
#       "id": 1,
#       "username": "platform_admin",
#       "role": "platform_admin"
#     }
#   }
# }

# 测试1.2: 工厂管理员登录
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "factory_admin",
    "password": "Admin@123456",
    "deviceId": "test-device-002",
    "factoryId": "CRETAS_2024_001"
  }'

# 预期结果:
# {
#   "code": 200,
#   "success": true,
#   "data": {
#     "accessToken": "eyJ...",
#     "refreshToken": "eyJ...",
#     "userType": "factory_user",
#     "factoryId": "CRETAS_2024_001",
#     "userInfo": {
#       "id": 2,
#       "username": "factory_admin",
#       "role": "factory_admin"
#     }
#   }
# }

# 测试1.3: 错误的密码
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "platform_admin",
    "password": "WrongPassword",
    "deviceId": "test-device-003"
  }'

# 预期结果:
# {
#   "code": 401,
#   "success": false,
#   "message": "用户名或密码错误"
# }
```

**验证点**:
- ✅ 平台管理员登录成功返回token
- ✅ 工厂用户登录成功返回token和factoryId
- ✅ 错误密码返回401
- ✅ token有效期正确（accessToken: 2h, refreshToken: 7d）

**数据准备**:
```sql
-- 确保测试用户存在
SELECT id, username, role FROM users WHERE username IN ('platform_admin', 'factory_admin');
```

---

#### 测试用例 P0-2: 刷新令牌测试

**测试目标**: 验证refreshToken能正确刷新accessToken

**测试步骤**:

```bash
# 1. 先登录获取refreshToken
REFRESH_TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin","password":"Admin@123456","deviceId":"test-device-004"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['refreshToken'])")

# 2. 使用refreshToken刷新accessToken
curl -X POST "http://localhost:10010/api/mobile/auth/refresh?refreshToken=$REFRESH_TOKEN" \
  -H "Content-Type: application/json"

# 预期结果:
# {
#   "code": 200,
#   "success": true,
#   "data": {
#     "accessToken": "eyJ...",  # 新的accessToken
#     "refreshToken": "eyJ...", # 新的refreshToken
#     "expiresIn": 7200
#   }
# }
```

**验证点**:
- ✅ refreshToken能成功刷新
- ✅ 返回新的accessToken和refreshToken
- ✅ 过期的refreshToken返回401

---

### 模块2: 生产加工模块 ⏳

#### 测试用例 P0-3: 创建生产批次

**测试目标**: 验证能成功创建生产批次

**测试步骤**:

```bash
# 1. 先登录获取token
ACCESS_TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin","password":"Admin@123456","deviceId":"test-device-005"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])")

# 2. 创建生产批次
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/processing/batches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "batchNumber": "TEST-BATCH-'$(date +%s)'",
    "productName": "三文鱼切片",
    "productType": "冷冻水产",
    "plannedQuantity": 500,
    "unit": "kg",
    "supervisorId": 2,
    "notes": "集成测试批次"
  }'

# 预期结果:
# {
#   "code": 200,
#   "success": true,
#   "data": {
#     "id": "uuid-xxx",
#     "batchNumber": "TEST-BATCH-xxx",
#     "status": "planning",
#     "productName": "三文鱼切片",
#     "plannedQuantity": 500,
#     "createdAt": "2025-11-20T16:10:00"
#   }
# }
```

**验证点**:
- ✅ 批次创建成功返回ID
- ✅ 初始状态为`planning`
- ✅ 批次号唯一（重复创建应返回错误）
- ✅ 必填字段验证（缺少字段返回400）

---

#### 测试用例 P0-4: 批次列表查询

**测试目标**: 验证批次列表分页和筛选功能

**测试步骤**:

```bash
# 1. 查询所有批次
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/processing/batches?page=1&size=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 预期结果:
# {
#   "code": 200,
#   "data": {
#     "items": [...],
#     "total": 17,
#     "page": 1,
#     "size": 10,
#     "totalPages": 2
#   }
# }

# 2. 按状态筛选
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/processing/batches?status=planning" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 预期结果: 返回所有planning状态的批次

# 3. 按日期范围查询
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/processing/batches?startDate=2025-11-01&endDate=2025-11-20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 预期结果: 返回11月1日到20日创建的批次
```

**验证点**:
- ✅ 分页参数正确生效
- ✅ 状态筛选准确
- ✅ 日期范围查询正确
- ✅ 返回的批次数据完整（包含所有关键字段）

---

#### 测试用例 P0-5: 批次状态流转

**测试目标**: 验证批次状态能正确从planning → in_progress → completed

**测试步骤**:

```bash
# 1. 获取一个planning状态的批次ID
BATCH_ID=$(curl -s -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/processing/batches?status=planning&size=1" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['items'][0]['id'])")

# 2. 开始生产
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/processing/batches/$BATCH_ID/start" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 预期结果:
# {
#   "code": 200,
#   "data": {
#     "id": "xxx",
#     "status": "in_progress",
#     "startTime": "2025-11-20T16:15:00"
#   }
# }

# 3. 完成生产
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/processing/batches/$BATCH_ID/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actualQuantity": 480,
    "notes": "生产完成"
  }'

# 预期结果:
# {
#   "code": 200,
#   "data": {
#     "id": "xxx",
#     "status": "completed",
#     "actualQuantity": 480,
#     "completedTime": "2025-11-20T16:20:00"
#   }
# }
```

**验证点**:
- ✅ planning → in_progress 状态转换成功
- ✅ in_progress → completed 状态转换成功
- ✅ 不能跳过状态（如planning直接变completed应返回错误）
- ✅ 已完成的批次不能再次开始

---

#### 测试用例 P0-6: Dashboard趋势分析 ✅

**已完成** - 在之前的测试中已验证：
- ✅ 生产趋势 (metric=production)
- ✅ 质量趋势 (metric=quality)
- ✅ 设备趋势 (metric=equipment)
- ✅ 告警仪表盘

---

### 模块3: 质量检验模块 ⏳

#### 测试用例 P0-7: 创建质检记录

**测试目标**: 验证能为批次创建质检记录

**测试步骤**:

```bash
# 1. 获取一个completed状态的批次
BATCH_ID=$(curl -s -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/processing/batches?status=completed&size=1" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['items'][0]['id'])")

# 2. 创建质检记录
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/quality-inspections \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "'$BATCH_ID'",
    "inspectorId": 3,
    "inspectionDate": "2025-11-20",
    "sampleSize": 10,
    "defectCount": 0,
    "result": "合格",
    "notes": "质检通过，产品符合标准"
  }'

# 预期结果:
# {
#   "code": 200,
#   "data": {
#     "id": "xxx",
#     "batchId": "xxx",
#     "result": "合格",
#     "inspectionDate": "2025-11-20",
#     "defectCount": 0
#   }
# }
```

**验证点**:
- ✅ 质检记录创建成功
- ✅ 关联到正确的批次
- ✅ 质检结果正确保存
- ✅ 同一批次可以有多条质检记录

---

#### 测试用例 P0-8: 质检列表查询

**测试目标**: 验证质检记录查询和统计

**测试步骤**:

```bash
# 1. 查询所有质检记录
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/quality-inspections?page=1&size=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 2. 按结果筛选（只看合格的）
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/quality-inspections?result=合格" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 3. 按批次查询
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/quality-inspections?batchId=$BATCH_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 4. 质检统计（合格率）
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/quality-inspections/statistics?startDate=2025-11-01&endDate=2025-11-20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 预期结果:
# {
#   "data": {
#     "totalInspections": 10,
#     "passedCount": 9,
#     "failedCount": 1,
#     "passRate": 90.0
#   }
# }
```

**验证点**:
- ✅ 质检列表查询成功
- ✅ 结果筛选准确
- ✅ 批次关联查询正确
- ✅ 统计数据准确（合格率计算正确）

---

### 模块4: 设备告警模块 ⏳

#### 测试用例 P0-9: 告警统计 ✅

**已完成** - 在之前的测试中已验证：
- ✅ 告警总数统计
- ✅ 按严重程度分类
- ✅ 按类型分类
- ✅ 7天趋势数据
- ✅ 平均响应时间计算

---

#### 测试用例 P0-10: 忽略告警 ⏳

**测试目标**: 验证告警可以被正确忽略并记录原因

**测试步骤**:

```bash
# 1. 获取一个ACTIVE状态的告警ID
ALERT_ID=$(curl -s -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment-alerts/statistics" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(1)")  # 使用测试数据中的告警ID=1

# 2. 忽略告警
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/alerts/$ALERT_ID/ignore" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "设备已完成维修，该告警可忽略"
  }'

# 预期结果:
# {
#   "code": 200,
#   "data": {
#     "id": 1,
#     "status": "IGNORED",
#     "ignoredAt": "2025-11-20T16:25:00",
#     "ignoredBy": "factory_admin",
#     "ignoreReason": "设备已完成维修，该告警可忽略"
#   }
# }

# 3. 验证数据库
mysql -u root cretas_db -e "
  SELECT id, status, ignored_at, ignored_by_name, ignore_reason
  FROM equipment_alerts
  WHERE id = $ALERT_ID;
"

# 预期结果: status=IGNORED, ignored_at有值, ignored_by_name='factory_admin'
```

**验证点**:
- ✅ 告警状态变为IGNORED
- ✅ 忽略时间和操作人正确记录
- ✅ 忽略原因保存成功
- ✅ 已忽略的告警不能再次忽略

---

## 🎯 P1 优先级 - 主要功能

### 模块5: 用户管理模块 ⏳

#### 测试用例 P1-1: 用户列表查询

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/users?page=1&size=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**验证点**:
- ✅ 用户列表返回完整
- ✅ 分页参数生效
- ✅ 用户角色显示正确

---

#### 测试用例 P1-2: 创建用户

```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/users \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_operator_'$(date +%s)'",
    "password": "Test@123456",
    "realName": "测试操作员",
    "phone": "13800138001",
    "role": "operator",
    "departmentId": 1
  }'
```

**验证点**:
- ✅ 用户创建成功
- ✅ 用户名唯一性验证
- ✅ 密码强度验证
- ✅ 角色权限正确分配

---

#### 测试用例 P1-3: 更新用户

```bash
curl -X PUT http://localhost:10010/api/mobile/CRETAS_2024_001/users/{userId} \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "realName": "测试操作员(已修改)",
    "phone": "13900139001",
    "isActive": true
  }'
```

**验证点**:
- ✅ 用户信息更新成功
- ✅ 状态切换正常
- ✅ 不能修改其他工厂的用户

---

### 模块6: 考勤打卡模块 ⏳

#### 测试用例 P1-4: 上班打卡

```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/timeclock/clock-in \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 2,
    "workTypeId": 1,
    "location": {
      "latitude": 31.2304,
      "longitude": 121.4737,
      "address": "上海市徐汇区"
    },
    "deviceInfo": {
      "deviceId": "test-device-006",
      "deviceModel": "iPhone 13",
      "osVersion": "iOS 16.0"
    }
  }'
```

**预期结果**:
```json
{
  "code": 200,
  "data": {
    "recordId": "xxx",
    "clockInTime": "2025-11-20T08:00:00",
    "status": "on_time",
    "location": {...}
  }
}
```

**验证点**:
- ✅ 打卡记录创建成功
- ✅ GPS位置正确记录
- ✅ 上班时间判断准确（迟到/准时）
- ✅ 同一天不能重复打上班卡

---

#### 测试用例 P1-5: 下班打卡

```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/timeclock/clock-out \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 2,
    "location": {
      "latitude": 31.2304,
      "longitude": 121.4737
    }
  }'
```

**验证点**:
- ✅ 下班打卡成功
- ✅ 工作时长自动计算
- ✅ 必须先上班打卡才能下班打卡

---

#### 测试用例 P1-6: 今日打卡记录查询

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/timeclock/today?userId=2" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**预期结果**:
```json
{
  "code": 200,
  "data": {
    "recordId": "xxx",
    "clockInTime": "2025-11-20T08:00:00",
    "clockOutTime": "2025-11-20T17:30:00",
    "workHours": 9.5,
    "status": "completed"
  }
}
```

**验证点**:
- ✅ 返回今日打卡记录
- ✅ 如果未打卡返回null或空对象
- ✅ 工作时长计算正确

---

#### 测试用例 P1-7: 考勤统计

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/timestats/personal?userId=2&startDate=2025-11-01&endDate=2025-11-20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**预期结果**:
```json
{
  "data": {
    "totalDays": 20,
    "attendedDays": 18,
    "absentDays": 2,
    "lateDays": 1,
    "totalWorkHours": 162.5,
    "avgWorkHours": 9.03
  }
}
```

**验证点**:
- ✅ 考勤天数统计准确
- ✅ 迟到天数计算正确
- ✅ 总工时计算准确

---

### 模块7: 客户管理模块 ⏳

#### 测试用例 P1-8: 客户列表查询

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/customers/list?page=1&size=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**验证点**:
- ✅ 客户列表返回完整
- ✅ 客户等级显示正确
- ✅ 分页和搜索功能正常

---

#### 测试用例 P1-9: 客户Excel导入

**准备测试文件**: `/tmp/customers_import_test.xlsx`

```bash
# 1. 下载模板
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/customers/export/template" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o /tmp/customer_template.xlsx

# 2. 导入客户数据
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/customers/import" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@/tmp/customers_import_test.xlsx"
```

**预期结果**:
```json
{
  "code": 200,
  "data": {
    "totalCount": 10,
    "successCount": 9,
    "failureCount": 1,
    "successData": [...],
    "failureDetails": [
      {"rowNumber": 5, "reason": "手机号格式错误"}
    ]
  }
}
```

**验证点**:
- ✅ Excel文件解析成功
- ✅ 数据验证准确（手机号、邮箱格式）
- ✅ 重复数据检测
- ✅ 失败记录详细说明原因

---

### 模块8-9: 供应商和原料管理 ⏳

#### 测试用例 P1-10: 供应商列表

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/suppliers?page=1&size=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 测试用例 P1-11: 原料批次列表

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches?page=1&size=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 测试用例 P1-12: 库存调整

```bash
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches/{batchId}/adjust" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adjustType": "in",
    "quantity": 100,
    "reason": "采购入库",
    "notes": "新采购三文鱼"
  }'
```

**验证点**:
- ✅ 库存数量正确调整
- ✅ 调整记录保存
- ✅ 库存不能为负数

---

## 🎯 P2 优先级 - 扩展功能

### 模块10-14: 工厂/部门/产品/转换率/AI ⏳

#### 测试用例 P2-1: 工厂列表 (Platform Admin)

```bash
curl -X GET "http://localhost:10010/api/platform/factories" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN"
```

#### 测试用例 P2-2: 创建工厂

```bash
curl -X POST "http://localhost:10010/api/platform/factories" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试工厂_'$(date +%s)'",
    "industry": "食品加工",
    "address": "上海市浦东新区",
    "contactName": "张三",
    "contactPhone": "13800138000"
  }'
```

#### 测试用例 P2-3: 获取工厂设置

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/settings" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 测试用例 P2-4: 部门列表

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/departments" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 测试用例 P2-5: 产品类型列表

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/product-types" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 测试用例 P2-6: 转换率列表

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/conversions" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 测试用例 P2-7: AI成本分析

```bash
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analyze" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "xxx",
    "analysisType": "cost",
    "parameters": {}
  }'
```

**验证点**:
- ✅ AI分析请求成功
- ✅ 配额消耗正确记录
- ✅ 分析结果格式正确

---

## 🎯 P3 优先级 - 辅助功能

### 模块15-19: 报表/白名单/系统管理 ⏳

#### 测试用例 P3-1: 生产报表

```bash
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/reports/production?startDate=2025-11-01&endDate=2025-11-20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 测试用例 P3-2: 系统健康检查

```bash
curl -X GET "http://localhost:10010/api/mobile/health"
```

**预期结果**:
```json
{
  "status": "UP",
  "components": {
    "database": "UP",
    "diskSpace": "UP",
    "redis": "DOWN"
  }
}
```

---

## 📝 测试数据准备脚本

### SQL准备脚本

```sql
-- 1. 确保测试工厂存在
INSERT INTO factories (id, name, industry, address, is_active, created_at, updated_at)
VALUES ('CRETAS_2024_001', '测试工厂', '食品加工', '上海市', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2. 确保测试用户存在
INSERT INTO users (username, password, real_name, role, factory_id, is_active)
VALUES
  ('factory_admin', '$2a$10$...', '工厂管理员', 'factory_admin', 'CRETAS_2024_001', 1),
  ('test_operator', '$2a$10$...', '测试操作员', 'operator', 'CRETAS_2024_001', 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 3. 创建测试部门
INSERT INTO departments (factory_id, name, description)
VALUES ('CRETAS_2024_001', '生产部', '负责产品生产')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 4. 添加测试设备
INSERT INTO equipment (factory_id, name, type, status)
VALUES
  ('CRETAS_2024_001', '切片机-001', '切片设备', 'normal'),
  ('CRETAS_2024_001', '冷冻箱-001', '冷冻设备', 'normal')
ON DUPLICATE KEY UPDATE updated_at = NOW();
```

---

## 🚀 执行测试的步骤

### 阶段1: 准备环境 (30分钟)

1. ✅ 启动后端服务
2. ✅ 执行SQL准备脚本
3. ✅ 创建测试数据文件（Excel模板）
4. ✅ 获取测试用户token

### 阶段2: P0核心测试 (2小时)

1. ⏳ 认证模块 (2个测试用例)
2. ⏳ 生产加工模块 (5个测试用例)
3. ⏳ 质检模块 (2个测试用例)
4. ⏳ 设备告警模块 (2个测试用例) - 部分已完成

### 阶段3: P1主要功能测试 (3小时)

5. ⏳ 用户管理 (3个测试用例)
6. ⏳ 考勤打卡 (4个测试用例)
7. ⏳ 客户管理 (2个测试用例)
8. ⏳ 供应商管理 (1个测试用例)
9. ⏳ 原料管理 (2个测试用例)

### 阶段4: P2扩展功能测试 (2小时)

10-14. ⏳ 工厂/部门/产品/转换率/AI模块

### 阶段5: P3辅助功能测试 (1小时)

15-19. ⏳ 报表/白名单/系统管理模块

### 阶段6: 生成测试报告 (30分钟)

- 汇总所有测试结果
- 记录失败用例和Bug
- 生成测试覆盖率报告

---

## 📊 测试报告格式

### 报告模板

```markdown
# 集成测试报告

**测试时间**: 2025-11-20
**测试环境**: localhost:10010
**测试人**: Claude Code

## 测试汇总
- 总测试用例: 150个
- 通过: 145个 (96.7%)
- 失败: 5个 (3.3%)
- 跳过: 0个

## 失败用例
1. [P1-2] 创建用户 - 密码强度验证失败
   - 原因: 正则表达式不匹配
   - 修复建议: 更新密码验证规则

## 测试覆盖率
- 核心模块: 100%
- 主要功能: 95%
- 扩展功能: 85%
- 辅助功能: 70%
```

---

## 🎯 下一步行动

现在开始执行测试，建议顺序：

1. **立即开始** P0-1: 认证模块测试（获取token）
2. **然后执行** P0-3 到 P0-5: 生产加工模块核心功能
3. **接着执行** P0-7, P0-8: 质检模块
4. **最后执行** P0-10: 忽略告警功能（需要token）

**预计完成时间**: P0模块约2小时

---

**文档生成**: 2025-11-20
**准备就绪**: 可以开始执行测试
