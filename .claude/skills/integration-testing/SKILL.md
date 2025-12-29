---
name: integration-testing
description: 运行后端和前端集成测试，检查 API 和 UI 交互。包含 E2E 测试执行、结果分析、失败诊断。使用此 Skill 来验证系统功能完整性，运行端到端测试，或调试集成问题。
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# 集成测试 Skill

在 Cretas 食品溯源系统中运行完整的集成测试。

## 测试脚本位置

```
/Users/jietaoxie/my-prototype-logistics/tests/api/
├── test_authentication.sh          # 8 种角色认证测试
├── test_phase2_1_material_batches.sh  # 原材料批次 CRUD
├── test_phase2_2_equipment.sh      # 设备管理
├── test_phase2_3_suppliers.sh      # 供应商管理
├── test_dashboard.sh               # 仪表板 API
└── ... (20+ 个测试脚本)
```

## 执行步骤

### 1. 检查后端服务状态

```bash
# 检查端口 10010 是否有服务运行
lsof -i :10010

# 检查服务状态（通过登录接口验证）
curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | grep -q "code" && echo "后端服务正常"
```

### 2. 启动后端服务（如果未运行）

```bash
cd /Users/jietaoxie/my-prototype-logistics/backend-java

# 编译并启动
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home \
mvn clean package -DskipTests -q

# 后台启动
nohup mvn spring-boot:run > /tmp/backend.log 2>&1 &

# 等待启动完成（约 10-15 秒）
sleep 15

# 验证启动成功
curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" -d '{}' | grep -q "code" && echo "后端已就绪"
```

### 3. 运行 API 测试

```bash
cd /Users/jietaoxie/my-prototype-logistics/tests/api

# 运行认证测试
bash test_authentication.sh 2>&1 | tee /tmp/auth_test.log

# 运行材料批次测试
bash test_phase2_1_material_batches.sh 2>&1 | tee /tmp/material_test.log

# 运行设备管理测试
bash test_phase2_2_equipment.sh 2>&1 | tee /tmp/equipment_test.log

# 运行供应商测试
bash test_phase2_3_suppliers.sh 2>&1 | tee /tmp/suppliers_test.log

# 运行仪表板测试
bash test_dashboard.sh 2>&1 | tee /tmp/dashboard_test.log
```

### 4. 分析测试结果

```bash
# 检查失败的测试
grep -i "FAIL\|ERROR\|failed" /tmp/*.log | head -30

# 统计通过/失败
echo "=== 测试结果统计 ==="
grep -c "PASS\|SUCCESS\|通过" /tmp/*.log 2>/dev/null || echo "0 passed"
grep -c "FAIL\|ERROR\|失败" /tmp/*.log 2>/dev/null || echo "0 failed"

# 检查 HTTP 状态码
grep -E "HTTP/[0-9.]+ [0-9]+" /tmp/*.log | sort | uniq -c
```

### 5. 快速健康检查

```bash
# 一键检查所有核心 API
endpoints=(
  "http://localhost:10010/api/mobile/health"
  "http://localhost:10010/api/mobile/CRETAS_2024_001/dashboard/stats"
  "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches"
)

for endpoint in "${endpoints[@]}"; do
  echo "Testing: $endpoint"
  curl -s -w "HTTP %{http_code}\n" -o /dev/null "$endpoint"
done
```

## 常见问题排查

| 症状 | 可能原因 | 解决方案 |
|------|----------|----------|
| 后端启动超时 | MySQL 未运行 | `mysql.server start` |
| 端口 10010 被占用 | 旧进程未退出 | `lsof -i :10010 \| awk 'NR>1 {print $2}' \| xargs kill -9` |
| API 返回 401 | JWT token 过期 | 重新登录获取新 token |
| 连接超时 | 防火墙/网络问题 | 检查网络设置 |
| 数据库错误 | 数据库连接失败 | 检查 MySQL 服务和配置 |

## 远程服务器测试

如需测试生产服务器（139.196.165.140）：

```bash
# 检查远程服务器状态
curl -s -X POST http://139.196.165.140:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" -d '{}' | grep -q "code" && echo "远程服务器正常"

# 运行测试时指定远程服务器
export API_BASE_URL="http://139.196.165.140:10010"
bash test_authentication.sh
```

## 测试账号

**所有账号密码**: `123456`

### 主要测试账号

| 账号 | 角色 | 说明 |
|------|------|------|
| platform_admin | super_admin | 平台超级管理员 |
| factory_admin1 | factory_super_admin | 工厂超管 1 |
| factory_admin2 | factory_super_admin | 工厂超管 2 |
| factory_admin3 | factory_super_admin | 工厂超管 3 |
| operator1 | operator | 操作员 1 |
| operator2 | operator | 操作员 2 |
| operator3 | operator | 操作员 3 |

### 其他测试账号

| 账号 | 角色 | 部门 |
|------|------|------|
| perm_admin | permission_admin | management |
| proc_admin | department_admin | processing |
| farm_admin | department_admin | farming |
| logi_admin | department_admin | logistics |
| proc_user | operator | processing |

## 参考

- 后端代码: `backend-java/src/main/java/com/cretas/aims/controller/`
- 测试脚本: `tests/api/`
- API 文档: 参见 Apifox 或 Swagger UI
