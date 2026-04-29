# 99. 遗留问题追踪 (R1-R6 六轮审计汇总)

**作用**: 六轮审计 (R1→R6) 发现的所有**待确认 / 后端未实装 / V2 roadmap** 项集中管理
**更新策略**: 每次测试后用实际结果更新本表, 已解决的划掉, 新发现的加进来
**负责人**: QA Lead + Backend Lead 联合

> **§13 vs §99 分工**:
> - **§13** = 对**客户**交付时的已知边界 + V2 roadmap (带客户话术).
> - **§99 (本文)** = 对**内部** QA/Backend Lead 的遗留追踪表, 带 curl 验证脚本 + 工作量估算.
> - 客户演示用 §13, 内部 standup/sprint planning 用 §99. 两边同一 V2 项不重复解释, 互相指引.

---

## 99.1 处理策略总览

遗留问题分 4 类, 对应不同处理方式:

| 类型 | 处理方式 | 时效 |
|------|---------|------|
| **A. 需 curl 验证的** | 跑 curl 命令, 5 min 内确认存在/不存在 | **立即** (测试前) |
| **B. 后端未实装 (UI/API)** | 开 JIRA / 加到 V2 roadmap | 1-4 周 |
| **C. 前端缺展示** | 开发补 + 小 sprint 补 | 2 周 |
| **D. 安全/合规待专业评估** | 渗透测试外部团队 | 1 个月 |

---

## 99.2 遗留问题清单 (16 项)

### 类 A — 立即 curl 验证 (5 项)

| # | 问题 | 来源 | curl 命令 | 结论更新 |
|---|------|------|---------|---------|
| 1 | Whitelist 单对象 POST 是否实装 | R6 §48.2 | `curl -X POST .../api/mobile/whitelist -d '{"phone":"13800000001","name":"test","factoryId":"F001"}'` | ☐ 待测 → 结果: __________ |
| 2 | smartbi-config 全局路径 vs 工厂路径 | R6 §50.13 | 两种路径都试, 看哪个 200 | ☐ 待测 → 结果: __________ |
| 3 | `/system/cron-logs` endpoint 是否存在 | R5 §47.2 | `curl .../api/mobile/system/cron-logs` | ☐ 待测 → 结果: __________ |
| 4 | `/system/trigger-chain-logs` 是否存在 | R6 §45.2 | `curl .../api/mobile/system/trigger-chain-logs` | ☐ 待测 → 结果: __________ |
| 5 | FactorySettings lazy-init 默认值字段 | R4 §48.3 | `curl .../api/mobile/F001/settings/full` | ☐ 待测 → 结果: __________ |

### 类 B — 后端未实装 / V2 roadmap (6 项)

| # | 问题 | 来源 | 当前状态 | V2 计划 |
|---|------|------|---------|--------|
| 6 | 生产领料 UI (`/production/material-requisitions`) | R1 §13.1.1 | 后端 API 有, 前端无 | V2 补前端 |
| 7 | `/rd/samples/{id}/request-quotation` endpoint | R1 §13.1.2 | 前端按钮存在, 后端缺 | V2 补后端 |
| 8 | 到货扫码 UI (`/procurement/receipts`) | R1 §13.1.5 | 只有手动输入 | V2 接入扫码枪 |
| 9 | SO 成本分项拆解 (BOM+历史+实际) | R1 §13.1.4 | 只显示总利润 | V2 补面板 |
| 10 | 生产任务从 SO 自动触发 | R1 §13.1.6 | 需手动创建 | V2 接入 TriggerChain |
| 11 | Cron 可观测 UI (`/system/cron-logs`) | R5/R6 §47 | 只后端日志 | V2 补 UI |

### 类 C — 前端生效待确认 (3 项)

| # | 问题 | 来源 | 验证方法 | 结论 |
|---|------|------|---------|------|
| 12 | Canvas 权限矩阵运行时生效 | R5 §49.5.5 | 配置 operator 禁审核 + 登 operator 看按钮 | ☐ 待测 |
| 13 | SpEL 规则热更新是否真热 (无需 reload) | R4 §46.2 | 配置规则 + 新开标签测 | ☐ 待测 |
| 14 | permission_admin 角色归属 (属 admin 类?) | R6 §49.2 | grep PermissionService + 登 permission_admin 看菜单 | ☐ 待测 |

### 类 D — 安全/合规待专业评估 (2 项)

| # | 问题 | 来源 | 评估方式 | 优先级 |
|---|------|------|---------|--------|
| 15 | SpEL 沙盒是否完整 (非仅黑名单) | R5 §46.6 | 外部渗透测试 + 注入 `T(Runtime) / @ / Class.forName` | 🔴 P0 (安全漏洞风险) |
| 16 | 跨工厂越权完整性审计 | R5 §35 | 安全渗透外包 | 🔴 P0 |

---

## 99.3 立即执行: 类 A 验证脚本

```bash
#!/bin/bash
# 流程实际测试/99-verify-pending.sh
# 跑一次确认 5 个类 A 问题

TOKEN=$(curl -s -X POST https://www.cretaceousfuture.com/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}' \
  | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['token'])")

echo "=== #1 Whitelist 单对象 ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST "https://www.cretaceousfuture.com/api/mobile/whitelist" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800099999","name":"R6 verify","factoryId":"F001"}'
# 预期 200/409 = 实装; 404/405 = 未实装

echo "=== #2 smartbi-config (全局 vs 工厂) ==="
curl -s -o /dev/null -w "  全局: HTTP %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "https://www.cretaceousfuture.com/api/mobile/smartbi-config/thresholds?factoryId=F001"
curl -s -o /dev/null -w "  工厂: HTTP %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "https://www.cretaceousfuture.com/api/mobile/F001/smartbi-config/thresholds"

echo "=== #3 cron-logs ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "https://www.cretaceousfuture.com/api/mobile/system/cron-logs"

echo "=== #4 trigger-chain-logs ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "https://www.cretaceousfuture.com/api/mobile/system/trigger-chain-logs"

echo "=== #5 FactorySettings lazy-init ==="
curl -s "https://www.cretaceousfuture.com/api/mobile/F001/settings/full" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    data = d.get('data', {})
    print(f'  language: {data.get(\"language\", \"❌缺\")}')
    print(f'  timezone: {data.get(\"timezone\", \"❌缺\")}')
    print(f'  currency: {data.get(\"currency\", \"❌缺\")}')
except:
    print('  解析失败 (可能 404)')
"
```

跑完后回填到 §99.2 对应行, 2 分钟搞定类 A.

---

## 99.4 类 B 处理: 进 V2 Roadmap

所有类 B 项的共同处理:
1. 在 GitHub Issues 开 tag `v2-roadmap`
2. 标 priority (P0/P1/P2)
3. 分配给对应开发 (前端/后端)
4. 里程碑绑定 V2.0 发布
5. 客户交付说明书**明确标注**: "以下功能属 V2 增强, V1 手动/跳过处理"

### V2 Roadmap 模板 (供产品经理填)

```markdown
# V2.0 增强清单 (R6 审计遗留)

## 必做 (P0)
- [ ] 生产领料 UI (#6) — 2 周
- [ ] SO 成本分项拆解 (#9) — 1 周
- [ ] SpEL 沙盒安全 (#15) — 3 周 ⭐⭐⭐

## 建议做 (P1)
- [ ] 到货扫码 (#8) — 1 周
- [ ] Cron 可观测 UI (#11) — 1 周
- [ ] `request-quotation` endpoint (#7) — 3 天

## 优化 (P2)
- [ ] 生产自动触发 (#10) — 2 周 (接 TriggerChain)

总工作量: ~10 周 / 2 人
```

---

## 99.5 类 C 处理: 测试时验证

### 处理流程
每次测试跑到相关节时:
1. 先看 99.2 类 C 表格该项是否 ☐ 待测
2. 照该节操作一遍
3. 回填 ☑ 通过 / ❌ 失败 + 具体现象
4. ❌ 的转类 B 进 V2 roadmap

### 示例
```markdown
| 12 | Canvas 权限矩阵 | ... | ☑ 2026-04-17 测: 配 operator 禁审后按钮消失 ✅ |
```

---

## 99.6 类 D 处理: 安全渗透外包

### 推荐流程
1. 找第三方安全公司 (如阿里云安全/腾讯云渗透)
2. 给**生产副本环境** (不是真实 prod)
3. 提供测试账号 + 本手册 §35 安全测试作为指导
4. 1 个月内出报告
5. 报告中 P0/P1 作为下一 sprint 修复目标

### 参考预算
- 基础渗透: ¥30,000 - 50,000 / 次
- 合规认证 (ISO27001): ¥100,000+

---

## 99.7 闭环管理

### 状态流
```
发现 → ☐ 待确认 → (跑验证) → ☑ 通过 / ❌ 失败
                              ↓
                              开 JIRA → 修复 → ☑ 已解决 → 从本表移除
```

### 每月 review
- 第 1 周: 跑 99.3 脚本更新类 A 状态
- 第 2 周: 类 B 进 V2 sprint planning
- 第 3 周: 类 C 测试时验证
- 第 4 周: 类 D 外部渗透结果追踪

### 6 个月目标
- 类 A 归零 (全部确认)
- 类 B < 5 (V2 完成大部分)
- 类 C 归零 (全部验证)
- 类 D 拿到渗透报告

---

## 99.8 追加新发现

若测试中发现**新的待确认项**, 按此格式加:

```markdown
| 17 | [问题描述] | [来源章节] | [验证方式] | ☐ 待测 / ☑ 已解决 / ❌ 需修 |
```

---

## 99.9 当前累计统计

| 类 | 数量 | 已解决 | 比例 |
|---|------|-------|------|
| A 待 curl | 5 | 0 | 0% |
| B V2 roadmap | 6 | 0 | 0% |
| C 测试时验证 | 3 | 0 | 0% |
| D 安全外包 | 2 | 0 | 0% |
| **总** | **16** | **0** | **0%** |

**目标**: 交付前把类 A (5 项) 全部确认, 类 C (3 项) 全部验证 → 总解决率 **≥ 50%**.
