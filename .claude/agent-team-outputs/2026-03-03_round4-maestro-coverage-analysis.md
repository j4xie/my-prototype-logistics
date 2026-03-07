# Round 4 Maestro E2E 测试覆盖分析

**日期**: 2026-03-03
**模式**: Full | 语言: Chinese
**增强**: Codebase grounding: ON | Fact-check: disabled | Browser: OFF

---

## 执行摘要

经过对50个Maestro E2E测试（Round 1-4）的交叉验证，实际覆盖状况如下：**Tracker内覆盖率69.3%**（142/205页面），**全应用覆盖率37.7%**（142/377个.tsx文件）。Round 4全部12个测试PASS（0 FAIL），但37个WARNED项中大部分属于选择器未命中或滚动不足，并非功能缺失。172个屏幕文件（platform/processing/management等目录）完全未被Tracker追踪，是覆盖率低的主因。

---

## 一、经核实的覆盖率数据

### 1.1 各角色覆盖率

| 角色 | COVERED | UNTESTED | Tracker总数 | 覆盖率 | 原始数据 | 修正说明 |
|------|---------|----------|-------------|--------|---------|---------|
| FA (工厂管理员) | 50 | 35 | 85 | **58.8%** | 63.9% (46/72) | 基数和覆盖数均有误 |
| WS (车间主管) | 13 | 9 | 22 | **59.1%** | 62.5% (15/24) | 分母偏差 |
| WM (仓储主管) | 24 | 8 | 32 | **75.0%** | 74.2% (23/31) | 基本准确 |
| QI (质检员) | 13 | 4 | 17 | **76.5%** | 76.5% (13/17) | 完全正确 |
| HR (HR管理员) | 19 | 2 | 21 | **90.5%** | 90.5% (19/21) | 完全正确 |
| DP (调度员) | 21 | 3 | 24 | **87.5%** | 85.7% (18/21) | 分母偏差 |
| **Tracker合计** | **142** | **63** | **205** | **69.3%** | 71.6% (136/190) | 基数全部偏低 |

### 1.2 全应用覆盖率

| 指标 | 值 | 说明 |
|------|-----|------|
| 全部.tsx屏幕文件 | **377** | `screens/`目录实际文件数 |
| 已覆盖页面 | 142 | Tracker中COVERED状态 |
| **全应用覆盖率** | **37.7%** | 142/377 |
| 未追踪屏幕目录 | platform(61), processing(39), management(22), smartbi(17), reports(16)等 | 共172+文件 |

### 1.3 完全未测试的角色

Tracker底部明确列出5个未测角色：operator (~10页面), sales_manager (~8), procurement_manager (~3), viewer (~4), platform_admin (~50+)。

---

## 二、37个WARNED项重新分类

### A类：滚动/导航不足（可修复，~16项）

| 测试 | WARNED项 | 原因 | 修复方案 |
|------|---------|------|---------|
| Test 39 | CostReport, TrendReport | 报表列表需更多swipe | 增加scrollUntilVisible |
| Test 44 | 全部8个ERP模块 | 管理grid需scrollUntilVisible | 使用scrollUntilVisible循环 |
| Test 45 | ResourceOverview | 需多次滚动 | 多段swipe |
| Test 47 | equipment items | 设备列表滚动不足 | 增加scroll |
| Test 43 | Executive, Sales, Finance | SmartBI入口需滚动+点击 | 滚动+更新selector |

**修复难度: 低**

### B类：选择器不匹配（可修复，~10项）

| 测试 | WARNED项 | 问题 | 修复方案 |
|------|---------|------|---------|
| Test 41 | ConversionAnalysis | "转化分析" vs 实际文本 | 更新regex |
| Test 46 | PersonnelReport, KPIReport, ForecastReport, AnomalyReport | **页面存在但selector未命中** | 验证实际文本，更新regex |
| Test 49 | BatchAssign | BatchAssignmentScreen.tsx存在 | 更新selector |
| Test 42 | DeptDetail, DeptAdd | 需先点击列表项/按钮 | 增加交互步骤 |
| Test 50 | Intent管理 | "意图管理"→"AI意图查看" | 更新selector |

**修复难度: 低-中**

### C类：功能未实现或不可自动化（暂不可修复，~11项）

| 测试 | WARNED项 | 原因 |
|------|---------|------|
| Test 41 | AlertHandle | 需要实际预警数据 |
| Test 48 | ShippingConfirm, TrackingDetail | 需要出库单数据 |
| Test 49 | AI分析, Leave(请假) | Leave页面不存在；AI分析需数据 |
| Test 49 | Anomaly | 依赖实时异常数据 |
| Test 50 | WorkReport, Rule, Return, Dept管理(部分) | 部分配置页面可能未完整实现 |

---

## 三、关键发现与分歧裁定

### 3.1 各方共识

| 共识点 | 最终判定 |
|--------|---------|
| Round 4全12测试PASS | **确认** |
| FA覆盖率最低，需优先提升 | **确认** (58.8%) |
| WS批次生命周期流程未深测 | **确认** (Test 08仅看列表) |
| `optional: true`掩盖真实失败 | **确认** — PASS不等于COVERED |
| 滚动问题是最大的可修复项 | **确认** |

### 3.2 关键分歧裁定

| 分歧 | 原始判定 | Critic判定 | 最终裁定 |
|------|---------|-----------|---------|
| Test 46四个报表"未实现" | C类不可修复 | 页面存在，B类selector问题 | **Critic正确** — PersonnelReport/KPIReport/ForecastReport/AnomalyReport均存在于`screens/reports/` |
| Test 49 BatchAssign | C类不可修复 | 页面存在 | **Critic正确** — `BatchAssignmentScreen.tsx`存在 |
| 覆盖率71.6% | 被引用 | 实际69.3% | **Critic正确** — 142/205 = 69.3% |
| Round 5可达90% | 宣称可达 | Tracker内80-85%较现实 | **Critic正确** |

---

## 四、置信度评估

| 指标 | 修正值 | 置信度 |
|------|--------|--------|
| Tracker覆盖率 69.3% | 142/205 | **高 (95%)** |
| 全应用覆盖率 37.7% | 142/377 | **高 (90%)** |
| WARNED可修复比例 ~70% | 26/37项 | **高 (85%)** |
| C类~11项不可修复 | — | **中 (70%)** |
| Round 5 Tracker达80-85% | — | **中 (60%)** |
| Round 5全应用达90% | — | **极低 (5%)** |

---

## 五、行动建议

### 立即执行（1-2天）

1. **修复A类滚动问题（16项）** — 投入产出比最高。对Test 44管理grid使用`scrollUntilVisible`；对Test 43 SmartBI使用多段滚动。预计Tracker覆盖+13项。

2. **修复B类选择器（10项）** — 对Test 46四个报表、Test 41转化分析、Test 49 BatchAssign逐个验证实际渲染文本，更新regex。预计+8项。

3. **消除`optional: true`假PASS** — 已确认存在的页面改为非optional，确保真正验证到。

### 短期执行（1-2周）

4. **WS批次生命周期深度测试** — BatchStart→BatchStage→BatchComplete。需预先创建测试数据。

5. **补全FA剩余35个UNTESTED** — 高优先：IoT设备(3), 退货订单(2), 编码规则(1)。

6. **新增platform_admin登录flow** — 61个页面，最大覆盖率杠杆点。

### 有条件执行

7. **扩展Tracker追踪范围** — 172个未追踪的.tsx文件需评估并有选择加入。

8. **数据依赖型测试** — AlertHandle、ShippingConfirm等需构建测试数据fixture。

---

## 六、Round 5测试提案（12个tests, 51-62）

| # | 名称 | 角色 | 覆盖页面 | 优先级 |
|---|------|------|---------|--------|
| 51 | WS批次操作-开始阶段 | WS | BatchStart, BatchStage | P1 |
| 52 | WS批次操作-完成分配 | WS | BatchComplete, WorkerAssign | P1 |
| 53 | WM检验入库 | WM | WHInspect, WHPutaway | P1 |
| 54 | WM发货确认 | WM | WHShipConfirm, WHTracking | P1 |
| 55 | WM库存高级 | WM | WHTransfer, LocationManage | P1 |
| 56 | HR AI分析+批量分配 | HR | StaffAIAnalysis, BatchAssignment | P1 |
| 57 | QI结果详情+分析 | QI | QIResult, QIAnalysis | P1 |
| 58 | Auth忘记密码 | 跨角色 | ForgotPassword, ResetPassword | P2 |
| 59 | FA物料批次详情 | FA | MaterialBatchDetail, MaterialTrace | P2 |
| 60 | SmartBI仪表板 | FA | ProductionDashboard, SalesDashboard | P2 |
| 61 | FA预测报表 | FA | ForecastReport, KPIDetail | P2 |
| 62 | WM告警处理 | WM | AlertDetail, AlertHandle | P2 |

---

## 七、待解决问题

1. SmartBI子页面实际UI文本需手动截图确认
2. Test 50中哪些配置页面真正已实现需验证navigation路由
3. platform_admin角色何时纳入测试
4. `optional: true`策略是否需要全面调整
5. 377个.tsx中有多少是独立可导航页面（vs 嵌入式组件）

---

## Round 4修复记录

| 测试 | 问题 | 修复 |
|------|------|------|
| Test 40 | `back`在WARNED后退出app | 改用tab重导航(`tapOn: "首页"`) |
| Test 47 | 设备管理stack隐藏tab+keyboard | 改用`back`+`hideKeyboard` |
| Test 48 | 出库tab名称错误 | `\u51FA\u5E93`→`\u51FA\u8D27`(出货) |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Browser explorer: OFF
- Total sources found: ~20+ (codebase files + COVERAGE-TRACKER)
- Key disagreements: 3 resolved (coverage numbers, report implementation, Round 5 target)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase grounding topic)
- Healer: all checks passed ✅
- Competitor profiles: N/A
