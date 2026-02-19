# AI意图功能权限控制总结

## 📋 修改概述

**修改日期**: 2026-01-07
**修改范围**: 后端AI意图功能权限控制
**涉及文件**:
- `AIIntentConfigController.java`
- `AIController.java`

---

## 🔐 权限控制策略

### 角色定义

| 角色代码 | 角色名称 | 权限范围 |
|---------|---------|---------|
| `SUPER_ADMIN` | 平台超级管理员 | 所有平台级功能 |
| `FACTORY_SUPER_ADMIN` | 工厂超级管理员 | 工厂内所有功能 |
| `FACTORY_ADMIN` | 工厂管理员 | 工厂管理功能 |
| 其他角色 | 普通用户 | 基础查询和使用功能 |

---

## ✅ 已添加权限控制的功能

### 1️⃣ AI意图配置管理 (`AIIntentConfigController`)

#### 🔴 **仅工厂管理员**（`FACTORY_SUPER_ADMIN` / `FACTORY_ADMIN`）

| API路径 | HTTP方法 | 功能说明 | 权限注解 |
|---------|---------|---------|---------|
| `/api/mobile/{factoryId}/ai-intents` | POST | 创建意图配置 | `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")` |
| `/api/mobile/{factoryId}/ai-intents/{intentCode}` | PUT | 更新意图配置 | `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")` |
| `/api/mobile/{factoryId}/ai-intents/{intentCode}/active` | PATCH | 启用/禁用意图 | `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")` |
| `/api/mobile/{factoryId}/ai-intents/{intentCode}` | DELETE | 删除意图配置 | `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")` |

#### 版本管理（仅工厂管理员）

| API路径 | HTTP方法 | 功能说明 | 权限注解 |
|---------|---------|---------|---------|
| `/api/mobile/{factoryId}/ai-intents/{intentCode}/rollback` | POST | 回滚单个意图 | `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")` |
| `/api/mobile/{factoryId}/ai-intents/rollback-all` | POST | 批量回滚工厂意图 | `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")` |

#### 系统管理（仅工厂管理员）

| API路径 | HTTP方法 | 功能说明 | 权限注解 |
|---------|---------|---------|---------|
| `/api/mobile/{factoryId}/ai-intents/cache/refresh` | POST | 刷新意图缓存 | `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")` |
| `/api/mobile/{factoryId}/ai-intents/cache/clear` | POST | 清除意图缓存 | `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")` |
| `/api/mobile/{factoryId}/ai-intents/keywords/cleanup` | POST | 清理低效关键词 | `@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")` |

---

### 2️⃣ AI配额管理 (`AIController`)

#### 🔴 **仅平台超级管理员**（`SUPER_ADMIN`）

| API路径 | HTTP方法 | 功能说明 | 权限注解 | 变更说明 |
|---------|---------|---------|---------|---------|
| `/api/mobile/{factoryId}/ai/quota` | PUT | 更新AI配额 | `@PreAuthorize("hasRole('SUPER_ADMIN')")` | ✅ 已移除TODO注释 |

---

## 🟢 开放给所有角色的功能

### 1️⃣ 意图查询（只读操作）

| API路径 | 功能说明 | 开放原因 |
|---------|---------|---------|
| `GET /ai-intents` | 获取所有意图配置 | 用户需要知道可用意图 |
| `GET /ai-intents/{intentCode}` | 获取单个意图详情 | 查看意图说明 |
| `GET /ai-intents/category/{category}` | 按分类获取意图 | 分类浏览 |
| `GET /ai-intents/sensitivity/{level}` | 按敏感度获取意图 | 敏感度筛选 |
| `GET /ai-intents/keyword-stats` | 关键词效果统计 | 数据分析 |
| `GET /ai-intents/{intentCode}/history` | 版本历史查询 | 历史追溯 |

### 2️⃣ 意图识别与执行

| API路径 | 功能说明 | 备注 |
|---------|---------|------|
| `POST /ai-intents/recognize` | 测试意图识别 | 所有用户可用 |
| `POST /ai-intents/recognize-all` | 识别所有匹配意图 | 所有用户可用 |
| `POST /ai-intents/execute` | 执行AI意图 | ⚠️ 内部有审批检查 |
| `POST /ai-intents/preview` | 预览意图执行 | 所有用户可用 |
| `POST /ai-intents/confirm/{confirmToken}` | 确认执行预览的意图 | 所有用户可用 |

### 3️⃣ 多轮对话（Layer 5）

| API路径 | 功能说明 |
|---------|---------|
| `POST /conversation/start` | 开始多轮对话 |
| `POST /conversation/{sessionId}/reply` | 继续对话 |
| `POST /conversation/{sessionId}/confirm` | 确认意图 |
| `POST /conversation/{sessionId}/cancel` | 取消对话 |
| `GET /conversation/{sessionId}` | 获取会话详情 |
| `GET /conversation/active` | 获取活跃会话 |
| `GET /conversation/stats` | 获取对话统计 |

### 4️⃣ AI分析功能

| API路径 | 功能说明 | 备注 |
|---------|---------|------|
| `POST /ai/analysis/cost/batch` | 批次成本分析 | 配额管理 |
| `POST /ai/analysis/cost/time-range` | 时间范围分析 | 配额管理 |
| `POST /ai/analysis/cost/compare` | 批次对比分析 | 配额管理 |
| `POST /ai/analysis/employee/{employeeId}` | 员工AI综合分析 | 配额管理 |
| `GET /ai/quota` | 查询配额信息 | 所有用户可查看 |
| `GET /ai/reports` | 获取报告列表 | 所有用户可查看 |

---

## 🔄 双重保护机制

### 1️⃣ API层级权限控制（`@PreAuthorize`）
- **拦截位置**: Controller方法入口
- **拦截时机**: 请求到达前
- **返回状态**: 403 Forbidden

### 2️⃣ 业务层级审批控制
- **检查位置**: `IntentExecutorService.execute()`
- **检查逻辑**: `AIIntentConfig.needsApproval()`
- **响应方式**: 返回 `needsApproval=true`

**示例流程**:
```
用户请求 → @PreAuthorize验证角色
         → 执行业务逻辑
         → 检查敏感度级别
         → 返回是否需要审批
```

---

## 📌 关键代码变更

### AIIntentConfigController.java

```java
// 1. 添加导入
import org.springframework.security.access.prepost.PreAuthorize;

// 2. 示例：创建意图配置
@PostMapping
@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")
@Operation(summary = "创建意图配置", description = "创建新的AI意图配置（仅工厂管理员）")
public ResponseEntity<ApiResponse<AIIntentConfig>> createIntent(...) {
    // ...
}

// 3. 示例：批量回滚
@PostMapping("/rollback-all")
@PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")
@Operation(summary = "批量回滚工厂意图", description = "回滚工厂的所有意图配置到上个版本（仅工厂管理员）")
public ResponseEntity<ApiResponse<...>> rollbackAllIntents(...) {
    // ...
}
```

### AIController.java

```java
// 1. 添加导入
import org.springframework.security.access.prepost.PreAuthorize;

// 2. 完善配额更新权限
@PutMapping("/quota")
@PreAuthorize("hasRole('SUPER_ADMIN')")
@Operation(summary = "更新AI配额", description = "平台管理员更新工厂的AI配额（仅限平台超级管理员）")
public ApiResponse<Void> updateQuota(...) {
    // ✅ 已移除TODO注释
    // ✅ Spring Security自动校验SUPER_ADMIN角色
}
```

---

## 🧪 测试建议

### 1️⃣ 权限验证测试

```bash
# 工厂管理员 - 应该成功
TOKEN="eyJhbGci..." # factory_super_admin token
curl -X POST "http://localhost:10010/api/mobile/F001/ai-intents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'

# 普通用户 - 应该返回 403
TOKEN="eyJhbGci..." # workshop_supervisor token
curl -X POST "http://localhost:10010/api/mobile/F001/ai-intents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 2️⃣ 配额更新测试

```bash
# 平台管理员 - 应该成功
TOKEN="eyJhbGci..." # super_admin token
curl -X PUT "http://localhost:10010/api/mobile/F001/ai/quota?newQuotaLimit=10000" \
  -H "Authorization: Bearer $TOKEN"

# 工厂管理员 - 应该返回 403
TOKEN="eyJhbGci..." # factory_admin token
curl -X PUT "http://localhost:10010/api/mobile/F001/ai/quota?newQuotaLimit=10000" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 权限矩阵总览

| 功能类别 | 子功能 | 工厂超管 | 工厂管理员 | 普通角色 | 平台超管 |
|---------|--------|---------|-----------|---------|---------|
| **意图配置** | 查询 | ✅ | ✅ | ✅ | ✅ |
| **意图配置** | 创建/更新/删除 | ✅ | ✅ | ❌ | ✅ |
| **版本管理** | 回滚 | ✅ | ✅ | ❌ | ✅ |
| **缓存管理** | 刷新/清除 | ✅ | ✅ | ❌ | ✅ |
| **关键词管理** | 清理 | ✅ | ✅ | ❌ | ✅ |
| **意图执行** | 执行/预览 | ✅ | ✅ | ✅ | ✅ |
| **多轮对话** | 所有操作 | ✅ | ✅ | ✅ | ✅ |
| **AI分析** | 成本/员工分析 | ✅ | ✅ | ✅ | ✅ |
| **配额管理** | 查询 | ✅ | ✅ | ✅ | ✅ |
| **配额管理** | 更新 | ❌ | ❌ | ❌ | ✅ |

---

## 🚀 后续优化建议

### 1️⃣ 细粒度权限控制

考虑引入权限点系统：
```java
@PreAuthorize("hasPermission(#factoryId, 'AI_INTENT_CREATE')")
```

### 2️⃣ 审计日志增强

在敏感操作中记录：
- 操作用户ID
- 操作时间
- 操作前后对比
- IP地址

### 3️⃣ 前端权限联动

前端根据用户角色动态显示/隐藏功能：
```typescript
// 示例
{userRole === 'FACTORY_ADMIN' && (
  <Button onPress={createIntent}>创建意图配置</Button>
)}
```

---

## 📝 总结

### ✅ 已完成
1. 为 **9个管理类API** 添加 `@PreAuthorize` 注解
2. 为 **1个平台级API** 添加 `SUPER_ADMIN` 权限控制
3. 移除所有 TODO 注释，完善权限检查逻辑
4. 更新 Swagger 文档描述，明确权限要求

### 🔒 安全保障
- **API层**: Spring Security 自动拦截未授权请求（403）
- **业务层**: 敏感操作需要审批（HIGH/CRITICAL级别意图）
- **数据层**: 租户隔离（factoryId 强制过滤）

### 📐 设计原则
- **最小权限原则**: 默认拒绝，显式授权
- **职责分离**: 工厂管理员管理工厂，平台管理员管理平台
- **透明可审计**: 所有权限检查可追溯

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-07
**维护者**: Cretas Team
