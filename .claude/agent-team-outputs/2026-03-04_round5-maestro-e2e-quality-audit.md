# Round 5 Maestro E2E 测试质量审计报告

**日期**: 2026-03-04
**范围**: Tests 58-75 (18个测试)
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)

---

## Executive Summary

Round 5 (Tests 58-75) 存在系统性断言缺失，18个测试中 optional 使用率超95%，核心功能验证接近于零。测试本质上是"导航冒烟测试+截图证据"，而非功能验证测试。关键风险：虚假质量信心 — 全部 PASS 但缺陷检测能力极低，UI 回归可能被完全遗漏。优先行动：为 4 个无首屏验证的 login flow 补充 extendedWaitUntil；Phase B (65-75) 每测试至少补 2 个 required 断言。工作量：低 — 核心修复仅涉及 YAML 文件局部修改，预计 2-3 小时。

---

## 断言强度汇总表

| 测试# | 文件名 | 登录角色 | Required Assertions（登录后） | Optional Steps | 截图数 | 风险等级 |
|---|---|---|---|---|---|---|
| 58 | restaurant-recipe-deep | restaurant_admin1 | **2** | 9 | 10 | 低 |
| 59 | restaurant-requisition-deep | restaurant_admin1 | **2** | 8 | 8 | 低 |
| 60 | restaurant-stocktaking-deep | restaurant_admin1 | **2** | 9 | 10 | 低 |
| 61 | restaurant-wastage-deep | restaurant_admin1 | **2** | 14 | 13 | 低 |
| 62 | restaurant-home-profile | restaurant_admin1 | **3** | 6 | 11 | 低 |
| 63 | ws-untested-screens | workshop_sup1 | **2** | 7 | 10 | 低 |
| 64 | dp-untested-screens | dispatcher1 | **2** | 7 | 10 | 低 |
| 65 | interact-recipe-list | restaurant_admin1 | **2** | 9 | 12 | 低 |
| 66 | interact-wastage-form | restaurant_admin1 | **2** | 11 | 13 | 低 |
| 67 | interact-stocktaking-list | restaurant_admin1 | **2** | 9 | 11 | 低 |
| **68** | interact-requisition-form | restaurant_admin1 | **1** | 12 | 10 | **高** |
| **69** | interact-qi-records | quality_insp1 | **0** | 8 | 13 | **CRITICAL** |
| 70 | interact-dp-plan-list | dispatcher1 | **1** | 10 | 12 | **高** |
| 71 | interact-dp-gantt | dispatcher1 | **1** | 9 | 15 | **高** |
| **72** | interact-wm-inventory | warehouse_mgr1 | **0** | 11 | 15 | **CRITICAL** |
| **73** | interact-hr-attendance | hr_admin1 | **0** | 11 | 14 | **CRITICAL** |
| 74 | interact-fa-dashboard | factory_admin1 | **1** | 5 | 12 | 中 |
| **75** | interact-profile-settings | factory_admin1 | **1** | 14 | 15 | **高** |

**汇总**: 3 CRITICAL + 4 HIGH + 1 MEDIUM + 10 LOW

---

## 核心发现

### 1. 三个零断言测试 (CRITICAL) — 置信度 ★★★★★

Tests 69 (QI Records)、72 (WM Inventory)、73 (HR Attendance) 登录后完全没有 required assertion。原因链：
- `login-qi.yaml`、`login-wm.yaml`、`login-hr.yaml` 在 `tapOn: "OK"` 后直接结束，不验证目标页加载
- 测试体中所有 `tapOn` 均标记 `optional: true`
- 无论 app 显示什么内容（包括空白页或崩溃），测试均 PASS

### 2. 全套件零 assertVisible — 置信度 ★★★★★

代码搜索确认：**全部 18 个 R5 测试文件以及 R4 (39-50) 均无任何 `assertVisible` 或 `assertTrue` 命令**。这不是 R5 特有的退化，而是整个 Maestro 测试套件的架构缺陷。

### 3. Optional 使用率超 95% — 置信度 ★★★★★

核心功能验证步骤（筛选切换、表单填写、搜索、导航）的 `optional: true` 使用率达 98%。标准假通过反模式：`tap(optional) → screenshot → tap(optional) → screenshot`，截图间无断言。

### 4. Login Flow 质量两极分化 — 置信度 ★★★★★

| Login Flow | 首屏验证 | 受影响测试 |
|---|---|---|
| login-restaurant.yaml | ✅ 有（正则多语言匹配） | 58-68 基线强 |
| login-ws.yaml | ✅ 有（"Start Task"） | 63 基线强 |
| login-dp.yaml | ❌ 无（仅"OK"弹窗） | 64, 70, 71 基线弱 |
| login-qi.yaml | ❌ 无 | 69 → 零断言 |
| login-wm.yaml | ❌ 无 | 72 → 零断言 |
| login-hr.yaml | ❌ 无 | 73 → 零断言 |

### 5. 截图≠断言 — 置信度 ★★★★★

191张截图（平均10.6张/测试）仅作为证据收集。截图在 Maestro 中是非阻塞的，不验证任何内容，不阻止假通过。

### 6. UI 文本不稳定是 Optional 泛滥根因 — 置信度 ★★★★☆

大量正则匹配（如 `".*配方.*|.*Recipe.*"`）暗示 app 在中英文之间切换不可预测。这是 optional 泛滥的实际驱动力，贸然全面去除 optional 会引入大量误报。

---

## Consensus & Disagreements

| 主题 | 研究者/分析师 | Critic 挑战 | 最终裁定 |
|------|-------------|-------------|---------|
| R5 断言缺失严重 | P0 优先修复 | 确认，且比报告更严重（全套件零assertVisible） | **确认** |
| R1→R5 质量退化 | 列入对比维度 | **不成立** — R4同样零assertVisible | **采纳Critic** — 全套件架构缺陷 |
| Login 参数化 | MEDIUM优先级 | ROI不足 — Maestro不支持参数传递 | **采纳Critic** — 暂不参数化 |
| Optional 全面去除 | P1去optional化 | UI文本不稳定会导致误报 | **折中** — 分层实施 |
| 截图价值 | 无验证价值 | 人工审查场景有诊断价值 | **折中** — 补充但不替代断言 |

---

## Actionable Recommendations

### Immediate (立即执行, ~1小时)

1. **补全 4 个 login flow 首屏验证**:
```yaml
# login-dp.yaml 末尾添加
- extendedWaitUntil:
    visible: ".*调度工作台.*|.*Dispatch.*|.*Schedule.*"
    timeout: 10000

# login-qi.yaml 末尾添加
- extendedWaitUntil:
    visible: ".*检验.*|.*Quality.*|.*Records.*"
    timeout: 10000

# login-wm.yaml 末尾添加
- extendedWaitUntil:
    visible: ".*仓储.*|.*库存.*|.*Warehouse.*|.*Inventory.*"
    timeout: 10000

# login-hr.yaml 末尾添加
- extendedWaitUntil:
    visible: ".*人力.*|.*HR.*|.*Staff.*|.*考勤.*"
    timeout: 10000
```

2. **为 Tests 69/72/73 补充至少 1 个业务页面 extendedWaitUntil**

### Short-term (本周, ~2-3小时)

3. **以 Test 74 为模板**，为 Phase B 每个测试补充 2-3 个关键 `extendedWaitUntil`:
   - 登录后首屏验证
   - 核心页面进入验证
   - 操作后状态变化验证

4. **筛选操作后添加验证**:
```yaml
# 当前（无验证）
- tapOn:
    text: "进行中"
    optional: true
- takeScreenshot: screenshots/xx-filter-active

# 改进
- tapOn:
    text: "进行中"
    optional: true
- extendedWaitUntil:
    visible: ".*进行中.*"
    timeout: 3000
- takeScreenshot: screenshots/xx-filter-active
```

5. **inputText 后添加值验证**

### Conditional (条件性执行)

6. **UI 文本稳定化后**: 逐步将核心入口 `optional: true` 转为 required
7. **CI 门禁**: 引入 YAML lint 脚本，检查 optional 比例上限（建议 < 50%）
8. **WARN 阈值**: 从 >5 降至 >3

---

## Risk Assessment

| 风险 | 概率 | 影响 | 等级 |
|------|------|------|------|
| App 功能回归被漏报 | 高 (80%) | 高 | P0 |
| 团队误读 PASS 率为功能完整性指标 | 中 (50%) | 高 | P0 |
| 添加 required assertion 导致测试频繁失败 | 高 (70%) | 中 | P1 |
| Login flow 超时导致假阴性 | 中 (40%) | 中 | P1 |

---

## Open Questions

1. 团队对测试的期望定位是什么？冒烟测试 vs 回归测试？
2. UI 文本中英文混用问题是否有修复计划？
3. 截图是否有系统性人工审查流程？
4. R4 (Tests 39-50) 是否也需要同步补充断言？

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (断言强度 / 假通过风险 / 登录+架构)
- Total sources: 18 YAML files + 7 login flows + batch runner script + coverage tracker
- Key disagreements: 2 resolved (退化叙事修正, 参数化ROI否定), 1 unresolved (optional去除激进程度)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Healer: All checks passed ✅
