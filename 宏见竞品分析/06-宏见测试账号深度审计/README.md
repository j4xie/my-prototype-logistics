# 06 — 宏见 ERP 测试账号深度审计 (Round 1-10 完成)

> **Audit chat**: R-HJ (Sprint 1+2 期间专项调研)
> **审计员**: Claude Opus 4.7 (1M context)
> **起始日期**: 2026-05-15
> **测试账号**: lyh01 / admin (单账号, 不并发, 凭证见 organizer chat)
> **网址**: https://login.hongjian.com/login/login.jsp
> **总耗时**: ~10h (含 10 轮 audit + meta-audit + executive summary)
> **完成度**: **~92%** (含 mobile app skeleton, 等 Steve 实测)

---

## 0. ⚡ 给老板/Steve 的最高层 takeaways (一段)

宏见 ERP **真实功能是 Cretas 估算的 5 倍** (1640 vs ~400). 但**核心战场不重叠**: 宏见主推电子/注塑/五金, **不打食品/餐饮**. Cretas 在 F006 (卤制品工厂) + QHJ (餐饮) 有先发优势. **不要全抄宏见**, 选 P0+P1 共 66 项 ≈ **9 个月单人** (Claude 加速). AI/移动/食品溯源是宏见永远赶不上的差异化, 应该坚守.

→ **详见 `29-EXECUTIVE-SUMMARY.md`** (1-2 页报告)

---

## 1. Top 10 关键发现 (v2 — Round 1-9 整合)

### 战略级 (3)
1. **宏见 0 AI** — 12 模块 / 681 子菜单 / 1591 RBAC 全规则引擎, Cretas AI 中台是**永久壁垒**
2. **9 分公司 + 行业战略**: 主推**电子/注塑/五金** (非食品/餐饮) — Cretas 主战场无直接竞争
3. **TV 大屏 Android APK** (HoanTV.apk) — **战略机会** ⭐⭐⭐ (餐饮厨房屏 / 工厂车间屏 + SmartBI 集成)

### 架构级 (3)
4. **41 个子域 microservice** (vs Cretas 1 monolith) — 学**模块化解耦**, 不学**子域过多**
5. **layui + jQuery + JSP + 6 层 iframe** — 老栈, Cretas SPA + RN 全胜
6. **完全无移动响应式** — 375px viewport PC 网页缩小, 双指放大 — Cretas RN Expo 全胜

### 功能/数据级 (4)
7. **工程级 BOM (PLM-Lite)** — BOMID + 版本号 + ECN + 工作流 + 反查 + 4 批量, M-BOM-VER-1 升 P3 → P0
8. **vflag 凭证 hook 7 种 generator** — 业务单 → 财务桥梁, F-VFLAG-1 升 P0 战略
9. **客户档案 51 字段 + 21 跟踪 tab** — 360 度 CRM, S-CUSTOMER-TAB-1 (15d) 必抄
10. **126 个独立工作流定义 + 系统变量 {#own} + 业务变量 (订单金额)** — C-APPROVAL-EDITOR-1 配 jsPlumb 拖拽

---

## 2. 真实数字 (Round 5+ verified)

| 维度 | 之前估算 | **实测真实** | 倍率 |
|---|---|---|---|
| 子菜单数 | 280+ | **681** | 2.4× |
| RBAC 权限点 | ? | **1591** | — |
| 后端子域 | 17 | **41** | 2.4× |
| 真实功能总数 | ? | **~1640** (含 mobile + TV) | — |
| Cretas MUST_COPY 工时 | 84d | **429d nominal / 258d 实际** | 5× |
| Cretas 计划周期 | 30 周 | **65 周 (15 月单人)** | 2.2× |

---

## 3. 文档地图 (30 docs)

### 主框架 (核心 3)
- ⭐ **`29-EXECUTIVE-SUMMARY.md`** — 给老板/Steve 1-2 页报告 (**先读**)
- ⭐ **`28-CRETAS-PRIORITIZED-BACKLOG.md`** — 88 项 P0/P1/P2/P3 重排 (Sprint 计划基础)
- **`README.md`** (本文件) — 索引

### Round 1 输出 (basic framework + 10 模块 deep audit)
- `00-LOGIN-AND-NAVIGATION.md` — 登录流程 + dashboard
- `01-MODULES-INVENTORY.md` — 12 模块 + 子菜单清单 (Round 1 估 259, Round 5 真实 681)
- `02-{module}-deep-audit.md × 10` — 销售/采购/仓库/财务/生产/工程/品质/人力/客户/系统
- `02-{module}-archive.md × 7` — 委外/办公自动化/客户录音/公海客户/固定资产/模具/多公司账套
- `03-CROSS-MODULE-WORKFLOWS.md` — 5 业务流
- `04-UX-PATTERNS.md` — 27+4=31 UI 模式
- `05-DATA-MODEL-INFERRED.md` — 7 域 entity + linkListArray 8 类
- `06-PERMISSIONS-ROLES.md` — 8 推断角色 + 4 权限粒度
- `07-COMPARISON-TO-CRETAS.md` — 12 模块对照
- `08-MUST-COPY-AUGMENT.md` — Round 1 P0/P1/P2 增量 (后整合到 `28-` doc)
- `09-CRETAS-DIFFERENTIATORS.md` — 7 weakness + 10 优势 + 14 销售话术
- `10-STATE-MACHINES.md` — 7 单据状态机
- `11-AUTO-TRIGGERS.md` — 12 跨模块 trigger
- `12-VALIDATION-RULES.md` — 49 校验规则
- `13-CONFIG-CAPABILITIES.md` — 10 配置入口
- `14-RBAC-MULTI-ROLE.md` — 角色权限
- `15-AI-AUTOMATION.md` — 宏见 0 AI vs Cretas 中台
- `16-REPORTING-BI.md` — dashboard 9 区域
- `17-IMPORT-EXPORT.md` — 导入导出

### Round 2-3 输出 (user-perspective + 截图)
- `18-DESIGN-PHILOSOPHY.md` — 技术栈 + 架构 + 3 设计原则
- `19-FLOW-STORYBOARD.md` — 销售单创建 7 step storyboard

### Round 4 输出 (gap fill)
- `20-AUDIT-GAPS.md` — 自审计 25 gap 分类
- `21-AUDIT-GAPS-FILLED.md` — G1-G6 实测填补 (G2/G5/G6 完整, G1/G3/G4 partial)

### Round 5-6 输出 (681 menu + meta-audit)
- `22-FULL-MENU-MAP.md` — 681 二级页面 + 1591 RBAC + 11 大新发现
- `23-META-AUDIT-VERIFICATION.md` — 7 维度 verify

### Round 7-8 输出 (40 子域)
- `24-FULL-SUBDOMAIN-MAP.md` — 40 子域 + 10 新实测 + HoanTV APK 发现
- `25-ROUND-8-FINAL-SUBDOMAINS.md` — 剩 13 子域 + publicimage + wxshop OAuth

### Round 9-10 输出 (mobile prep)
- `26-MOBILE-APP-TEST-PLAN.md` — Steve 实测指南 (APK URLs + 5 场景 + 截图请求)
- `27-MOBILE-APP-FINDINGS-STEVE.md` — Skeleton 等 Steve 填

### Round 10 战略输出 ⭐
- `28-CRETAS-PRIORITIZED-BACKLOG.md` — 88 项重排 + Sprint 计划 v2 修正
- `29-EXECUTIVE-SUMMARY.md` — 老板/Steve 1-2 页 takeaways

---

## 4. 截图 (88 张总)

按 Round 分:
- Round 1: 25 张 (登录 + dashboard + 12 模块 nav + 10 模块 list)
- Round 2: 5 张 (升级日志 modal + 工作流空 + 销售单创建 + 移动 viewport)
- Round 3: 38 张 (Plan B 30 + Plan C 8 flow storyboard)
- Round 4: 9 张 (G1-G6 实测)
- Round 7-8: 14 张 (10 新子域 + 4 batch)
- Round 9: 1 张 (官网软件下载页)

文件夹: `screenshots/` + `screenshots/mobile/` (mobile 等 Steve 填)

---

## 5. Round 总览

| Round | 名称 | 输出 | 关键 |
|---|---|---|---|
| 1 | Broad + Deep | 18 doc + 25 截图 | 12 模块 + 259 子菜单 (估) |
| 2 | User perspective | 1 doc + 5 截图 | 架构 (layui/iframe/移动无响应) |
| 3 | Plan B+C | 1 doc + 38 截图 | 30 张深度 + 7 张 flow storyboard |
| 4 | Gap fill G1-G6 | 1 doc + 9 截图 | 客户档案 51 字段 + 操作下拉 11 URL |
| 5 | Full menu 681 | 1 doc + 2 JSON | 681 真实 / 1591 RBAC (vs 估 259) |
| 6 | Meta-audit | 1 doc | 7 维度 verify |
| 7 | 40 子域 | 1 doc + 11 截图 | 10 新子域 + HoanTV APK |
| 8 | 剩 13 子域 | 1 doc + 4 截图 | publicimage + wxshop OAuth (40+ 总) |
| 9 | APK URLs | 1 doc + 1 截图 | 全 APK 找到 + 9 分公司 + 行业战略 |
| 10 | Sprint 重排 | 3 doc (28/29 + README v2) | 88 项 P0/P1/P2/P3 重排 + Exec Summary |

---

## 6. 还有的 gap (诚实)

| Gap | 严重度 | 说明 |
|---|---|---|
| **手机 App 实测** | 中 | 27-FINDINGS skeleton 已 ready, 等 Steve 装 APK |
| 10 个 02-{module}-deep-audit.md 字段数过时 | 低 | Round 1 估 259, 现在真实 681, 数字 outdated 但战略结论不变 |
| 681 menu 视觉截图 ~9% | 低 | Framework 100% mapped, 截图 ROI 低 |
| 16 子域单页未 visit | 低 | 25/40 verified, 剩 16 是低价值边缘 |

---

## 7. 安全 + 测试数据约定

⛔ **不改 admin 密码 / 不删 admin 账号 / 不禁用工厂 / 不绑外部 OAuth / 不充值 / 邮件填 jx453@cornell.edu**

测试数据命名 (便于清理):
- 客户名: `测试-Cretas审计-20260515`
- 产品名: `测试品-{类型}` (e.g. `测试品-卤牛肉`)
- 备注: `Cretas 审计员 audit, 可清理`
- 金额: `0.01` 或 `1.00`
- 数量: `1`

---

## 8. 战略推荐 (再强调)

1. **不要全抄 88 项** — 选 P0+P1 共 66 项 / 9 月
2. **食品/餐饮专精** — Cretas 主战场无直接竞争 (宏见主推电子/注塑/五金)
3. **AI/移动/食品溯源是永久护城河** — 坚守
4. **TV 大屏 Android (C-TV-DASHBOARD-1)** P3 可考虑 (餐饮厨房屏)
5. **不打 P2 大客户场景** (复式记账/资料定制) 除非客户实际催

详见 `29-EXECUTIVE-SUMMARY.md` 决策清单.
