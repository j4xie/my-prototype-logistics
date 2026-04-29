# 47. 定时任务 + 可观测

> **🟡 R18 QA Smoke (2026-04-17 07:07)**: /F001/cron-configs + /system/cron-logs 全 **404** (V2 roadmap per memory §99.2). Cron 跑在 backend 但 UI observability 未实装. ShedLock memory `project_shedlock_deploy_safety.md` 证明 47 ECS 的 @Scheduled 已 locked.

**来源**: R4 Agent 4
**耗时**: 15 min

---

## 47.1 系统定时任务清单 (`@Scheduled`)

| 任务 | cron | 用途 |
|------|------|------|
| ActiveLearningScheduler | 0 0 2 * * ? | AI 模型再训练 |
| AnomalyDetectionScheduler | 0 */5 * * * ? | 每 5min 异常检测 |
| InventoryExpiryScheduler | 0 0 8 * * ? | 每日 8:00 扫即将过期 |
| MonthlyFinanceClose | 0 0 0 1 * ? | 每月 1 日自动月结提示 |
| PosOrderSync | 0 */10 * * * ? | 每 10 min POS 订单同步 |
| TraceabilityQRRefresh | - | QR 定时生成 |

---

## 47.2 执行日志查询

### ⚠️ 前置确认 (R5 审计)
`/system/cron-logs` UI **可能未实装**. 若不存在:
- 大部分此节跳过
- 只测: 任务**能定时执行** (通过后端日志 `journalctl -u cretas-backend | grep Scheduled`)
- 标 "⚠️ V2 roadmap: 运维可观测 UI"

### 入口 (若已实装)
`/system/cron-logs`

### 字段
- 任务名
- 上次执行时间
- 执行状态: SUCCESS / FAILED
- 耗时
- 下次执行时间
- 错误详情 (如失败)

---

## 47.3 手动触发测试

### ⚠️ 前置确认
`/system/cron-jobs` UI **可能未实装**. 若不存在整节跳过, 改由运维 ssh 执行:
```bash
ssh root@47.100.235.168 "systemctl restart cretas-backend"
# 或通过 actuator
curl -X POST http://localhost:10010/actuator/scheduledtasks
```

### 步骤 (若已实装)
1. admin 进 `/system/cron-jobs`
2. 列表找某任务
3. 点 "**立即执行**" (仅 admin 可)
4. 观察日志实时更新

### ✅ PASS
- 点击后任务立即排入队列
- 执行完后状态变 SUCCESS
- 可在日志看完整执行过程

### ❌ FAIL
- 无手动触发入口
- 无实时反馈

---

## 47.4 失败通知

### 测试
1. 人为注入故障 (如临时关闭 LLM API)
2. 等 ActiveLearningScheduler 执行
3. 应失败

### ✅ PASS
- 日志记 ERROR + stack
- 发邮件/钉钉告警给 admin
- 失败重试 3 次后进死信队列

---

## 47.5 分布式锁 (多实例)

### 背景
ShedLock 防止多实例同时执行同一 cron

### 测试
- 如果后端有 2+ 实例
- 同一 cron 时刻, 只 1 实例执行
- 其他实例跳过 + 日志 "lock held"

---

## 47.6 Checklist (8 项)

| # | 测试 | 勾选 |
|---|------|------|
| 1 | Cron 任务列表加载 | ☐ |
| 2 | 执行历史查询 | ☐ ⭐ |
| 3 | 下次执行时间显示 | ☐ |
| 4 | 手动触发按钮 | ☐ |
| 5 | 手动触发后日志实时 | ☐ |
| 6 | 失败自动告警 | ☐ ⭐ |
| 7 | 失败重试 3 次 | ☐ |
| 8 | 多实例分布式锁 | ☐ |
