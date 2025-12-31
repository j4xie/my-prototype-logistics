# 推送通知部署检查清单

## 部署前检查

### 前端检查

- [ ] **依赖安装**
  ```bash
  cd frontend/CretasFoodTrace
  npm install
  ```

- [ ] **配置验证**
  - [ ] 检查 `app.json` 中的 `expo.extra.eas.projectId`
  - [ ] 检查 `expo-notifications` 插件配置
  - [ ] 检查 Android 权限配置

- [ ] **类型检查**
  ```bash
  npm run typecheck
  ```

- [ ] **构建测试**
  ```bash
  npx expo prebuild --clean
  ```

### 后端检查

- [ ] **数据库迁移**
  - [ ] 运行 SQL 脚本创建 `device_registrations` 表
  - [ ] 验证表结构和索引

- [ ] **依赖配置**
  - [ ] 确保 `RestTemplate` Bean 已配置
  - [ ] 确保 `ObjectMapper` Bean 已配置

- [ ] **编译检查**
  ```bash
  cd backend-java
  mvn clean compile
  ```

- [ ] **单元测试**
  ```bash
  mvn test
  ```

---

## 部署步骤

### 1. 数据库部署

```bash
# 连接数据库
mysql -h 139.196.165.140 -u root -p

# 选择数据库
USE cretas_food_trace;

# 运行迁移脚本
source backend-java/src/main/resources/db/migration/V2025_12_31_1__create_device_registrations_table.sql;

# 验证表创建
SHOW TABLES LIKE 'device_registrations';
DESCRIBE device_registrations;
```

### 2. 后端部署

```bash
# 构建
cd backend-java
mvn clean package -DskipTests

# 部署到服务器
scp target/*.jar root@139.196.165.140:/www/wwwroot/cretas/

# 重启服务
ssh root@139.196.165.140 "bash /www/wwwroot/cretas/restart.sh"

# 验证服务
curl http://139.196.165.140:10010/api/mobile/health
```

### 3. 前端部署

```bash
cd frontend/CretasFoodTrace

# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

---

## 部署后验证

### 1. 健康检查

```bash
# 后端服务
curl http://139.196.165.140:10010/api/mobile/health

# 预期输出: {"status":"UP"}
```

### 2. API 测试

```bash
# 设置 Token
export ACCESS_TOKEN="your-access-token"
export FACTORY_ID="F001"

# 发送测试推送
curl -X POST "http://139.196.165.140:10010/api/mobile/${FACTORY_ID}/devices/test-notification" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"

# 预期输出: {"success":true,"message":"测试推送已发送"}
```

### 3. 前端验证

- [ ] 在真机上安装应用
- [ ] 登录账号
- [ ] 导航到 `PushNotificationTestScreen`
- [ ] 点击"注册设备"
- [ ] 点击"发送测试推送"
- [ ] 验证收到通知

---

## 监控设置

### 1. 日志监控

```bash
# 查看后端日志
ssh root@139.196.165.140
tail -f /www/wwwroot/cretas/logs/application.log | grep "PushNotification"
```

### 2. 数据库监控

```sql
-- 查看设备数量
SELECT COUNT(*) FROM device_registrations WHERE is_enabled = TRUE;

-- 查看最近注册的设备
SELECT * FROM device_registrations ORDER BY created_at DESC LIMIT 10;

-- 查看未活跃设备
SELECT COUNT(*) FROM device_registrations
WHERE last_active_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

---

## 回滚计划

### 如果出现问题

#### 前端回滚
```bash
# 回滚到上一个版本
eas build:list
eas build:rollback <build-id>
```

#### 后端回滚
```bash
# 停止服务
ssh root@139.196.165.140 "systemctl stop cretas-backend"

# 恢复旧版本
ssh root@139.196.165.140 "cp /www/wwwroot/cretas/backup/*.jar /www/wwwroot/cretas/"

# 启动服务
ssh root@139.196.165.140 "systemctl start cretas-backend"
```

#### 数据库回滚
```sql
-- 删除新表（如果需要）
DROP TABLE IF EXISTS device_registrations;
```

---

## 性能基准

### 预期指标

- **设备注册响应时间**: < 200ms
- **推送发送响应时间**: < 500ms（单条）
- **批量推送**: 100 条 < 2s
- **数据库查询**: < 50ms

### 监控命令

```bash
# 测试响应时间
time curl -X POST "http://139.196.165.140:10010/api/mobile/${FACTORY_ID}/devices/test-notification" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

---

## 故障排查

### 问题 1: 推送未收到

**检查清单**:
1. 设备是否已注册？
   ```bash
   curl -X GET "http://139.196.165.140:10010/api/mobile/${FACTORY_ID}/devices/list" \
     -H "Authorization: Bearer ${ACCESS_TOKEN}"
   ```

2. Push Token 是否有效？
   - 检查 Token 格式：`ExponentPushToken[...]` 或 `ExpoPushToken[...]`

3. 后端日志是否有错误？
   ```bash
   ssh root@139.196.165.140
   grep "ERROR" /www/wwwroot/cretas/logs/application.log | grep "Push"
   ```

### 问题 2: 设备注册失败

**检查清单**:
1. 数据库表是否存在？
   ```sql
   SHOW TABLES LIKE 'device_registrations';
   ```

2. 用户是否已登录？
   - 检查 JWT Token 是否有效

3. 工厂 ID 是否正确？

### 问题 3: 应用崩溃

**检查清单**:
1. 前端日志
   ```bash
   npx expo start
   # 查看终端输出
   ```

2. 依赖版本
   ```bash
   npm list expo-notifications
   npm list expo-device
   ```

---

## 联系人

- **DevOps**: devops@cretas.com
- **后端团队**: backend@cretas.com
- **前端团队**: frontend@cretas.com
- **紧急联系**: +86 138-xxxx-xxxx

---

## 签名确认

| 角色 | 姓名 | 签名 | 日期 |
|------|------|------|------|
| 开发负责人 | | | |
| 测试负责人 | | | |
| 运维负责人 | | | |
| 产品负责人 | | | |

---

**部署日期**: _____________
**部署人员**: _____________
**版本号**: 1.0.0
