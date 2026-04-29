# 45. 触发链 E2E + 失败恢复

> **🟡 R18 QA Smoke (2026-04-17 07:07)**: /F001/trigger-chains **404** (V2 roadmap per memory §99.2). 配置 UI + 触发日志未实装 at factory 层级. Canvas-E2E-R1-R7 memory 已深度验证过 TriggerChain 执行.

**来源**: R4 Agent 4 — 触发链覆盖仅 20%, 失败恢复 0%
**耗时**: 30 min

---

## 45.1 系统触发链清单 (数据库存)

| Event | 触发器 | 链路步骤 | 错误策略 |
|-------|--------|---------|---------|
| SalesOrderFinanceApprovedEvent | SO FINANCE_APPROVED | 库存检查 → 预留 → 排产/采购建议 | CONTINUE |
| BatchCompletedEvent | 生产完工 | 扣料 → 成品批次 → 质检任务 | CONTINUE |
| MaterialReceivedEvent | 原料到货 | 重新检查 PP 物料齐套 | CONTINUE |
| SalesOrderConfirmedEvent | SO CONFIRMED | 仅记录日志 | CONTINUE |
| InvoiceIssuedEvent | 发票开具 | AR 更新 + 对账 | - |
| ProductionAlertEvent | 质检异常 | 异常处理 + 阻止下游 | - |

**⚠️ 默认禁用**: `factory_trigger_chains.isActive=false`, 需 admin 开启.

---

## 45.2 链路 1: SO FINANCE_APPROVED 库存检查

### 步骤
1. 配置: 确保 `/system/trigger-chains` 开启此链
2. 创建 SO 1000 kg (超出成品库存)
3. finance 审核通过

### ✅ PASS
- **步骤执行顺序**: (⚠️ `/system/trigger-chain-logs` UI **不存在**, 改为后端日志)
  ```bash
  ssh root@47.100.235.168 "tail -100 /www/wwwroot/cretas/cretas-prod.log | grep TriggerChain"
  ```
  应看到:
  - `TriggerChain: event SalesOrderFinanceApprovedEvent received for factory F001`
  - `Step 1 (库存检查): 缺 500 kg`
  - `Step 2 (采购建议): created PO draft PO-xxxxx`
  - `Step 3 (通知): sent to sales@F001`
- SO 详情 Tab "采购订单" 显示自动生成的 PO draft
- **消息中心**有新通知

### ❌ FAIL
- 3 步只执行 1-2 → 触发链中断 (错误处理策略问题)
- 无采购建议 → Orchestrator 未关联

---

## 45.3 链路 2: 生产完工 → 扣料/成品/质检

### 步骤 (§06.6 基础上)
生产报工审批通过后, 自动:
1. 原料扣减 (按 BOM)
2. 成品批次生成
3. 质检任务自动创建

### 验证
- 原料批次数量 = 旧值 - BOM 消耗 ✅
- 新成品批次 sourceType=PRODUCTION ✅
- `/quality/inspections` 列表多 1 条 `PENDING`

---

## 45.4 ⭐ 链路失败恢复 (P0 缺口)

### 测试方法 (注入故障具体步骤)
1. 方式 A — 改错 API endpoint:
   ```bash
   ssh root@47.100.235.168 "sed -i 's|/api/purchase/suggest|/api/purchase/suggest-BROKEN|' /www/wwwroot/cretas/application-prod.yml && systemctl restart cretas-backend"
   ```
2. 方式 B — 暂停 Python 服务 (若采购建议走 Python):
   ```bash
   ssh root@47.100.235.168 "systemctl stop cretas-python"
   # 测完再启: systemctl start cretas-python
   ```
3. 方式 C — DB 级模拟: 把采购建议服务用的表 RENAME 临时失效

4. 故障就位后, finance 审核 SO

### ✅ PASS (期望)
- 主事务**成功** (SO FINANCE_APPROVED 持久化)
- 失败步骤**回滚局部** (TriggerChainExecutor @Transactional REQUIRES_NEW)
- 日志 ERROR: "联动失败(不影响审批状态)"
- **通知运维** (发告警/邮件)
- 失败链路可**手动重试** (管理后台)

### ❌ FAIL
- 主事务被连带回滚 (最严重: 审批操作丢失)
- 无告警, 失败无声无息
- 无重试入口, 数据永不一致

---

## 45.5 循环触发防护 (P1 缺口)

### 测试
Canvas 配置:
- 事件 A → 触发 B
- 事件 B → 触发 A (循环)

### ✅ PASS
- Canvas 校验阻止保存 (图结构循环检测)
- 或运行时深度 > 5 终止 + 告警

### ❌ FAIL
- 配置成功, 死循环 → 后端栈溢出

---

## 45.6 触发链执行日志

### 入口
`/system/trigger-chain-logs` (或 `/system/audit`)

### 必备字段
- 触发时间 / 事件类型 / 工厂
- 执行步骤 (每步: 名称/耗时/结果)
- 整体状态: SUCCESS / PARTIAL / FAILED
- 失败步骤的 error stack
- 关联业务实体 (如 SO ID)

---

## 45.7 Checklist (12 项)

| # | 测试 | 勾选 |
|---|------|------|
| 1 | 链路 1 库存检查执行 | ☐ ⭐ |
| 2 | 链路 1 采购建议自动创建 | ☐ ⭐ |
| 3 | 链路 1 通知推送 | ☐ |
| 4 | 链路 2 原料 BOM 扣减 | ☐ ⭐ |
| 5 | 链路 2 成品批次生成 | ☐ |
| 6 | 链路 2 质检任务自动 | ☐ ⭐ |
| 7 | 链路 3 MaterialReceived 重算 | ☐ |
| 8 | 失败恢复: 主事务不回滚 | ☐ ⭐⭐ |
| 9 | 失败告警 + 重试入口 | ☐ ⭐ |
| 10 | 循环触发检测 | ☐ |
| 11 | 执行日志可查询 | ☐ |
| 12 | 失败步骤 error stack 可见 | ☐ |
