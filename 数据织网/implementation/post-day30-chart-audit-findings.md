# Web-Admin 图表/KPI 质量审计发现

**版本**: v1
**日期**: 2026-04-28
**触发**: Day 23-30 完成 + post-review 修复 ship 后, 用户要求"审核图表质量和内容,
看看是否又出现 X/Y 轴数值为 0 或图表内容没有任何体现的问题".
**审计人**: Playwright 真实窗口 (Chart quality deep audit subagent)
**环境**: `http://139.196.165.140:8097/` (test) → 47:8084 Python + 47:10011 Java test
**账号**: `factory_admin1 / 123456` (factory_super_admin / F001)

---

## 0. 范围 + 总体统计

- 扫描页面: **18 个** (+10+ 二级路由)
- 图表实例: **~20 个 echarts** + **~35 个 KPI 卡**
- 截图: `web-admin/.playwright-mcp/audit-01..17.png`
- 发现问题: **2 P0 + 5 P1 + 6 P2 = 13 项**

> ⚠️ **副作用**: 审计期间发现 **测试环境 Java backend (10011) 进程是 down 状态**, subagent
> 手工 `restart-test.sh` 拉起后才登入. 即 test Java backend 可能挂了一段时间无人发现.

---

## 1. P0 / Critical (真后端 bug, 用户能感知数字明显错误)

### P0-1 `/smart-bi/finance` 利润分析图表数据严重错乱

**症状**:
- API: `GET /api/mobile/F001/smart-bi/analysis/finance?analysisType=profit`
- 响应:
  ```json
  {
    "period": "2026-02",
    "revenue": 95497.69,
    "cost": -1870214.47,
    "grossProfit": 1965712.16,
    "grossMargin": 2058.39,
    "metrics": [{"GROSS_MARGIN": {"value": null}}]
  }
  ```

**多重 bug**:
1. **营业成本是负值** (业务上应该是正值, 用于从 revenue 减去)
2. **grossProfit 公式**: 1,965,712 = 95,497 − (−1,870,214) — 因为 cost 已被取负, 所以加法变减法
3. **grossMargin: 2058.39%** — 远超合理上限 100%
4. **同字段两值不一致**: 顶部 `metrics[].GROSS_MARGIN.value: null` (UI 显 "N/A") vs 图表
   `grossMargin: 2058.39` — 同一指标两套
5. **单点伪趋势**: `period` 单值 `"2026-02"`, 但页面用 echarts 折线图表达"利润趋势" — 1 个数据点的"趋势"无意义

**截图**: `audit-14-smartbi-finance.png` 右轴可见"毛利率 2500%"

**推测根因**:
- (a) cost 数据源 CR/DR 符号错位 (会计借贷方向被反转入库) → 落地是负数
- (b) ETL/aggregator 落地时 `* 100` 重复 (e.g. 0.20 → 20 → 2058) → 越界
- (c) 缺校验: `grossMargin > 100% 或 grossMargin < -100% 应触发 reject 或 cap`

**修复路径建议**:
1. 找到该 API 的服务实现 (`SmartBIAnalysisService` Java 或 Python)
2. 看 cost 字段的来源 — 是否走 `fact_finance_voucher.credit_amount - debit_amount`
3. 看 grossMargin 计算 — 是否乘错系数
4. 加 sanity check: `grossMargin = grossProfit / revenue`, 任一负值或 abs > 1.0 拒返
5. 加单测覆盖 cost 负值场景

**ETA**: 2-3h backend exploration + 修复 + 测试

---

### P0-2 `/finance/reports` vs `/finance/costs` KPI 自相矛盾

**症状**:
- `/finance/costs` 顶部 KPI: 应收 ¥2,346,500 / 应付 ¥474,000 / 净额 ¥1,872,500 (有数据)
- `/finance/reports` 顶部 KPI: 总收入 ¥0 / 总成本 ¥0 / 毛利 ¥0 / 利润率 0% (默认 2026-03-28~04-27)
- 数据库内 22 条 finance 交易 (含 Apr 17/18 多条 ¥4500/5000/38000) 都在该日期范围内

**两套 SQL 口径走的是不同表/方法**:
- finance/costs 看起来读 `ar_payment_record` + `ap_payment_record` 之类的实际单据表
- finance/reports 看起来读 `fact_finance_voucher` 但 SUM=0 → 要么 voucher 表没数据,
  要么 SQL filter 排除掉了所有行

**截图**: `audit-09-finance-reports.png`

**推测根因**:
- (a) finance/reports SQL 用 `subject_id = ...` 筛选会计科目 但 prod 数据没填该字段
- (b) finance/reports 走"已审核 voucher"才计入, 但 22 条交易都是未审核状态
- (c) finance/reports 看的是 fact 表而 finance/costs 看的是 raw 表, ETL 没把 raw 写入 fact

**修复路径建议**:
1. 确认两端点的 SQL 实现, 比对 WHERE 子句
2. 选一个口径作为 single source of truth
3. 另一端点改读同一来源 OR 加文档注释说明"两端点口径不同 (实际 vs 已确认)"

**ETA**: 1-2h SQL audit + 决策 + 改 1 个端点

---

## 2. P1 / Important (用户体验问题, FE bug)

### P1-1 "合格率"指标在两页口径不一致

- 首页 `/dashboard` 质量统计 → 合格率 **63.13%** (基于历史)
- KPI 看板 `/analytics/kpi` → 一次合格率 (FPY) **0.0%** (目标 90%, 红色 X)

**截图**: `audit-01-dashboard.png` vs `audit-04-kpi.png`

**根因**: 一个用月度/季度累计数据, 一个用今日数据. 但 UI 标签都叫"合格率", 用户困惑.

**修复**:
- KPI 看板改 label "今日 FPY" + 加副标题 "(近 30 天 X%)"
- OR 首页改用同一时间窗
- 优先 (a), 不破坏首页

---

### P1-2 `/analytics/trends` 趋势图极度稀疏

- `productionTrend`: 31 天数据全 0
- `costTrend`: 31 天数据全 0
- `qualityTrend`: 31 天中仅 04-17/04-18 两天有数据 (passRate 68.33 / 47.5), 其余 29 天 0
- `materialTrend`: **空数组 `[]`**
- `equipmentTrend`: **空数组 `[]`**

**截图**: `audit-03-trends.png` 显 3 张"孤立尖刺"折线

**根因**: 后端 padding 策略不一致 (有的填 0, 有的返空数组). FE 渲染既无空状态也无聚合.

**修复**:
- 后端: 统一 trend 端点返 31 天 padded array OR 仅有数据天 (二选一文档化)
- FE: `if (allValues === 0)` → 降级为"近 30 天暂无生产数据"
- 加聚合提示"有数据天数: 2 / 31"

---

### P1-3 + P1-4 `/production-analytics/{production,efficiency}` 4+4 echarts 空骨架无降级

**症状**:
- 4 个 KPI 卡全 0 (总产出 / 良率 / 不良率 / 报工数)
- 4 张 echarts 渲染 **纯空白图表 + 仅图例**, 无 "暂无数据" 占位
- 工序产出分布: 显示一个空灰色环 (echarts 默认 placeholder), 视觉像加载失败
- 员工×工序热力图: 显示 0/100 颜色条但**没有任何 cell**

**截图**: `audit-07-prod-analytics.png` + `audit-08-efficiency.png`

**根因**: FE 缺 `if (data.length === 0) showEmpty` 分支. 真实空状态参考
`/analytics/production-report` 的"暂无生产数据"卡片设计.

**修复**: 在 echarts container 加 `<el-empty v-if="!hasData" description="暂无生产数据" />`,
data check 走 `series[0].data.every(v => v === 0 || v == null)`.

**ETA**: ~1h 改 2 个 view 文件

---

### P1-5 `/smart-bi/dashboard` 经营驾驶舱矛盾 + camelCase 泄漏

- 顶部提示 "本月暂无销售数据,已自动显示 2025全年 的历史数据"
- 但 4 个 KPI 卡仍显占位 "此分析需上传含 date / net_amount 的数据"
- 模板分析下方 4 个卡使用了 2025 全年数据 (峰值 ¥6107)
- 数据卡片有字段名 **`troughValue`** (英文 camelCase 直接显示) → 应译"谷值"

**截图**: `audit-11-smartbi-dashboard.png`

**根因**:
- 数据加载策略不一致: 顶部 KPI 走当月 (空), 下方模板走 2025 全年 (有数据)
- i18n 表缺 `troughValue` → `谷值` 映射

**修复**:
- 数据来源统一到 fallback 的"2025 全年", 整页一致
- i18n 表加缺译

---

## 3. P2 / Minor (本地化 + 表格冗余 + spinner 不消失)

### P2-1 枚举值未本地化 (跨多页)

| 页面 | 列 | 显示 | 应显 |
|---|---|---|---|
| `/equipment/alerts` | 告警类型 | `PERFORMANCE_LOW` | 性能下降 |
| `/finance/costs` | 类型 | `AR_ADJUSTMENT` (其他行已是中文 "应收开票") | 应收调整 |
| `/analytics/supply-chain` | 状态 | `PARTIAL_RECEIVED` (其他状态已中文) | 部分到货 |

**根因**: i18n 表缺这几个 key, FE fallback 到 raw enum.

---

### P2-2 设备告警表格列冗余

- 列"设备名称"与"告警信息"内容完全相同 (e.g. 都是 "1号车间柯力 XK3190-A12 电子秤")
- 全 2492 条告警都这样 → message 字段从未填充, FE fallback 到设备名称

**修复**: 后端告警生成补 message 字段; 或 FE 隐藏 message 列直到 message 非空.

---

### P2-3 `/analytics/ai-reports` 异常检测 spinner 不消失

- 加载完后显示"暂无异常"但旋转 spinner 仍可见
- **截图**: `audit-17-ai-reports.png`

**根因**: loading state 没在 catch/finally 重置.

---

### P2-4 `/warehouse/material-price-trend` 仅 1 物料

- 显示 "共 1 种物料: 鲍鱼 ¥10.00 / 库存量 - / 最近入库价 -"
- 但 F001 实际有 22 个物料批次. material aggregator 只查到 1 条

**根因**: 不属于图表 bug 但是数据完整性问题. 需查 material_price_avg 计算逻辑.

---

### P2-5 `/analytics/alert-dashboard` 一行基线值 "-"

- "良率下降 65.27 低于阈值 90.00 / 当前值 65.3 / **基线值 -**"
- 阈值=90 是基线但 baseline 列空.

**根因**: 基线列绑错字段 OR 数据没生成. 单行问题, 影响小.

---

### P2-6 SmartBI Sales `/smart-bi/sales` 默认数据源不正确

- factory_admin1 打开页, 默认数据源是评价/星级 Excel (评价下载2025.07.01-2025.09.30_xxx.xlsx)
- AI 洞察明确说"未检测到数值型指标字段"
- 4 个图均空

**根因**: 用户上传错误 Excel + 页面没引导切换数据源.

**修复**: 加"该数据源不含数值列, 请切换"提示 + 自动切到第一个含数值列的数据源.

---

## 4. 跨页面共性问题

### CR-1 图表空数据降级缺失

`/production-analytics/{production,efficiency}` 共 8 张 echarts 渲染纯空骨架 + 灰色 placeholder ring,
没有任何"暂无数据"提示. 真实空状态参考 `/analytics/production-report` 的卡片式空状态.

**影响**: 用户视觉上以为系统坏了/在加载.

**修复**: 统一 `<EChartsRenderer>` 组件加内置 `:show-empty="series[0].data.every(v => !v)"` prop.

---

### CR-2 同指标多页口径不一致

| 指标 | 页面 A | 页面 B | 矛盾 |
|---|---|---|---|
| 合格率 | Dashboard 63.13% (历史) | KPI 看板 0% (今日) | 标签都叫"合格率" |
| 应收/应付 | finance/costs 有数 | finance/reports 全 0 | 同范围 22 条交易 |
| 告警数 | Dashboard 1241 | Equipment 2492 | Scheduling 15 |

**修复**: 起一个**指标定义文档** (e.g. `数据织网/metrics-glossary.md`), 标注每个 KPI 的:
- 来源表
- 时间窗
- 聚合方式
- 责任开发者

---

### CR-3 i18n / displayLabel 不全

至少 3 个域 (告警类型 / 财务类型 / 采购状态) 含未翻译枚举.
camelCase 字段名直接泄漏到 UI (`troughValue`, equipmentId, startTime, batchNumber).

**修复**: 集中加 i18n 漏译 (1-2h) + FE 字段渲染时强制走 `displayLabel(field)`.

---

## 5. 副作用: Test Java backend down 提醒

Audit subagent 报告: 登入前 test 环境 Java (10011) 进程 down. 手工 `restart-test.sh`
拉起后才能继续. 这意味着该进程**可能挂了一段时间没人发现**.

**修复路径**:
- 加 systemd 自启 (类似 prod cretas-backend 已经走 systemd)
- OR 加 watchdog 脚本 cron 监控 + 自动 restart
- 加监控 alert (端点 health check 失败 → 通知)

参考: `.claude/rules/server-operations.md` 已记录 prod cretas-backend.service 的 systemd 配置;
test 环境跟进类似设置.

**ETA**: 30 min 配 systemd + 10min 测试

---

## 6. 优先级建议

| 优先级 | 项 | 建议责任方 | ETA |
|---|---|---|---|
| **P0-must-fix-now** | P0-1 利润分析数据错乱 (用户能直接感知) | Backend dev + ETL owner | 2-3 工作日 |
| **P0-must-fix-now** | P0-2 finance/reports 全 0 矛盾 | Backend dev | 1-2 工作日 |
| **P1-next-sprint** | P1-3 + P1-4 production-analytics 空状态降级 | Frontend dev | 1 工作日 |
| **P1-next-sprint** | P1-1 合格率口径定义 | Cross-functional + glossary | 0.5 工作日 |
| **P1-next-sprint** | P1-2 trend padding 不一致 | Backend dev | 0.5 工作日 |
| **P1-housekeeping** | P1-5 smart-bi/dashboard troughValue + 数据策略 | Frontend dev + i18n | 0.5 工作日 |
| **P2-housekeeping** | P2-1 至 P2-6 + Test Java systemd | Backend + DevOps | 1 工作日 |

**Total backlog**: ~7-8 工作日 全部修完.

**最要紧 5 项**:
1. P0-1 利润分析 2058% 毛利率
2. P0-2 财务报表全 0 矛盾
3. P1-3 production-analytics 空状态降级
4. P1-4 efficiency 空状态降级
5. P1-1 合格率口径

---

## 7. 后续行动卡

- [ ] **P0-1**: 排查 SmartBIAnalysisService → cost 字段来源 → grossMargin 计算 → 加 sanity check + 单测
- [ ] **P0-2**: 比对 finance/reports vs finance/costs 两端点 SQL → 选 single source → 改一端点
- [ ] **P1-3 + P1-4**: production-analytics + efficiency 加 `<el-empty>` 空状态降级
- [ ] **P1-1**: 起 metrics-glossary.md, 锁定"合格率"定义 (今日/月度)
- [ ] **P1-2**: trend padding 策略统一
- [ ] **P1-5**: smart-bi/dashboard 数据策略 + i18n troughValue
- [ ] **P2-1**: 集中加 i18n 漏译 (PERFORMANCE_LOW / AR_ADJUSTMENT / PARTIAL_RECEIVED)
- [ ] **P2-2~P2-6**: housekeeping
- [ ] **副作用**: test Java backend 加 systemd 自启 + watchdog (30min)

---

## 8. 参考

- 完整截图: `web-admin/.playwright-mcp/audit-01..17.png`
- 跑 audit 用的 prompt: 本 chat 中 "Chart quality deep audit" subagent 调用
- 相关 ADR: `数据织网/implementation/post-day30-architecture-gap.md` (Day 23-30 架构缺口)
- 项目根: `C:\Users\Steve\my-prototype-logistics`
- Audit 时分支: `e2e/v1-framework`
- 部署目标: test (web-admin 139:8097, Python 47:8084, Java 47:10011)

**作者**: Claude Opus 4.7 + Chart audit subagent
**审阅状态**: 待评审
