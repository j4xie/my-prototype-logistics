# 18 — 宏见设计理念 + 用户视角观察 (Round 2 audit)

> Round 2 输出 (2026-05-15). 二次登录后 user-perspective 深探, 整合 R-HJ-Round1 没覆盖的设计理念维度.
>
> **方法**: 不再 broad mapping, 而是 user-first — 点击/拖动/hover/resize/键盘. 重点观察设计理念 + 隐藏功能.

---

## 1. 技术栈完整 reveal (Round 2 新发现)

### 1.1 前端 UI 库栈 (实测)

| 层 | 技术 | 实测证据 | 时代 |
|---|---|---|---|
| **UI 框架** | **Layui** (中国流行 UI 库) | `class="layui-layer"` `class="layui-icon"` 全栈使用 | 2014-至今 |
| **JS 库** | jQuery | `https://resource.hongjian.com/javascript/jquery.js` | 2006-至今 |
| **流程图** | **jsPlumb Toolkit** | `iframe.contentWindow.jsPlumb` object | 商业版/社区版 |
| **后端模板** | JSP (Java Server Pages) | 所有页面 `.jsp` 后缀 | 1999-至今 |
| **架构** | iframe 嵌套 (跨子域) | 6 层嵌套 iframe + `document.domain` 桥接 | 1990s frame |

**意义**: 宏见是**典型中国老 SaaS 栈** (Layui + jQuery + JSP + iframe), 跟 80% 国内传统 ERP (金蝶 K3 / 用友 NC 简版 / 速达) 同代. 现代 Vue/React/SPA 全无.

### 1.2 layui-layer Modal 系统 (Round 2 实测)

点击"升级日志" footer image 触发 layui-layer modal, 含 4 桌面级操作:

| Modal 组件 | 类名 | 功能 |
|---|---|---|
| 背景遮罩 | `layui-layer-shade` | 阻止背景交互 |
| 标题栏 | `layui-layer-title` | 显示标题 ("升级日志") |
| 内容 | `layui-layer-content` | iframe 嵌套加载内容 |
| **最小化** ⭐ | `layui-layer-min` | 缩小到 windows 角落 |
| **最大化** ⭐ | `layui-layer-max` | 全屏 |
| **关闭** | `layui-layer-close` | × 按钮 |
| **可拖动 resize** ⭐ | `layui-layer-resize` | 右下角拖动调整尺寸 |
| 设置窗口 | `layui-layer-setwin` | 操作集合 |

**关键 UX 发现**: Modal 是**桌面级 4 操作** (最小化/最大化/关闭/拖动 resize), 不是 mobile/tablet 模态. **意味宏见从设计起就是 PC desktop only**.

vs Cretas Expo + RN: BottomSheet (移动 native) — 完全不同范式.

### 1.3 dashboard = 10 独立 iframes (Round 2 重大发现) ⭐⭐⭐

实测 dashboard 工作台 (`crm.hongjian.com/crm/report/work.jsp`) 内**嵌套 10 个独立 iframe**, 每个统计卡片独立加载:

| iframe URL | 卡片 |
|---|---|
| `sale.hongjian.com/sale/stockout/salestockoutchart_index.jsp` | 销货 chart |
| `workflow.hongjian.com/workflow/workflowmy_index.jsp` | 待办审批 |
| `oa.hongjian.com/oa/task/mytaskmy_index.jsp` | 我的任务 |
| `stock.hongjian.com/stock/query/stockquerychart_index.jsp` | 库存 chart |
| `finance.hongjian.com/finance/account/paymaintain_index.jsp` | 应付 |
| `finance.hongjian.com/finance/report/payablestatisticreport_index.jsp` | 应付统计 |
| `warn.hongjian.com/warn/warneasylist.jsp` | 异常预警 |
| `main.hongjian.com/menu/menu_common_index.jsp` | 常用菜单 |
| `main.hongjian.com/menu/menu_last_index.jsp` | 最近浏览 |
| `main.hongjian.com/system/upgradelog/upgradelog_index.jsp` | 最近升级 |

**意义**:
- 每个卡片**独立 HTTP 请求 + iframe sandbox** = 彼此独立维护 + 独立部署
- **dashboard 加载 = 10 并发请求** (慢, 但并发可)
- **新增卡片只需加 iframe + URL** (插件式, 极易扩展)
- 跟现代 SPA "一个 endpoint 返回 dashboard config" 范式完全相反

**Cretas BentoGrid 对比**:
- Cretas: 1 endpoint + multiple data 一次性返回 + render
- 宏见: 10 独立 iframe + 10 独立子域 + 10 独立请求

**双向参考**:
- 宏见模式优势: 卡片独立维护 / 团队解耦 / 易扩展 (插一个 url 就行)
- Cretas 模式优势: 单页快速加载 / SPA 路由顺畅 / 移动友好

### 1.4 jsPlumb Toolkit (流程图引擎) — 只读模式

实测系统管理 → 工作流设置 → jsPlumb 节点:
- 节点 `class="w green jsplumb-droppable _jsPlumb_endpoint_anchor"` (jsPlumb endpoint 连线点)
- 节点 `position: absolute` + 固定 (x, y) 坐标 — 不是 CSS grid
- **节点 `isDraggable: false`** — 流程图是**只读 displayed**, 不是 admin 可编辑
- `iframe.contentWindow.jsPlumb` object 实际加载 — jsPlumb 库 active

**意味**:
- 宏见前台 = 只读流程图 (12 模块每个流程)
- admin 编辑流程图必须在另一个独立 page (推测 admin 后台或工程师/运维改 jsplumb config JSON)
- **不是真"客户自服务"** — admin 配置仍要工程介入

**vs Cretas C-APPROVAL-EDITOR-1 (规划)**: Cretas 计划做**真客户自服务的拖拽编辑器** (类似 LucidChart), 是 differentiation.

---

## 2. 移动端 viewport 测试 (Round 2 重大发现) ⭐⭐⭐

### 2.1 实测: 375 × 812 (iPhone X 尺寸)

| 维度 | 期望 (响应式) | 宏见实测 |
|---|---|---|
| 12 模块菜单 | 收起为汉堡菜单 | **12 个全部强制显示** |
| 横向滚动 | 无 | **horizontalScroll = true** (docScrollWidth 376 > viewport 375) |
| 字体大小 | 移动适配 | 不变 (PC 字号) |
| 按钮 hit area | 44pt+ | 不变 (PC 小尺寸) |
| layout | flex/grid 重排 | 不变 |

**结论**: 宏见**完全无移动端响应式** — 在手机上是"PC 网页缩小版", 用户必须**双指放大 + 左右滑动** 才能用.

### 2.2 战略意义

客户痛点 (F006 食品厂场景):
- 仓管员手机扫码入库 → 用宏见 H5 webview 慢 + 难点
- 销售员车间走访拍照 → 宏见 H5 不支持原生相机
- 老板手机查报表 → 宏见 H5 字小难看

**Cretas 优势**:
- ✅ Expo + RN 真原生 (Cretas independent)
- ✅ 角色路由分离 (10 角色独立 RN Stack)
- ✅ Bento Grid 自适应布局
- ✅ 原生扫码 / 拍照 / 推送 (无需 desktop 助手)

### 2.3 销售话术 (移动维度)

| 客户问 | 宏见真相 (实测) | 我们说 |
|---|---|---|
| "你们手机端好用吗?" | 宏见手机端是 PC 网页缩小, 双指放大 + 横滑 | "Cretas Expo + RN 真原生, 不是 H5 webview 缩小" |
| "我能不能手机扫码入库?" | 宏见需装 desktop 助手 + Windows | "我们 RN 原生扫码, 直接打开 app 即可" |
| "我老板能手机查报表吗?" | 宏见 H5 字小难看 | "SmartBI 移动适配 + AI 一句话出 chart" |

---

## 3. 设计理念 — "单据驱动 + 桌面优先 + 配置中台" 三原则

### 3.1 单据驱动 (vs Cretas AI 流驱动)

宏见**核心理念**: 任何业务都是**一张单据** + **状态机** + **凭证 hook**.
- 销售 → 销售单 → 销售出库单 → 销售退货单 (4+ 单据)
- 采购 → 请购单 → 核价单 → 采购底稿 → 采购订单 → 采购收货单 → 采购质检单 → 采购入库单 (8+ 单据)
- 库存 → 13 单据类型 (调整/出库/入库/报废/调拨/盘点/借出/借入 等)
- 财务 → 凭证 + 月结对账 + 结账

**优**: 审计追溯强 (每张单据都有 ID + 状态 + 操作日志 + 审批历史)
**劣**: 学习曲线陡 (用户必须学单据流程)

**Cretas AI 流驱动**: AIChat 一句话跨多步骤, 内部仍走单据 trigger 但用户**不需要学单据**.

### 3.2 桌面优先 (vs Cretas 移动+桌面双栈)

实测确认:
- modal 4 操作 (最小化/最大化/拖 resize) — 桌面级
- 移动端无响应式 — 强制 PC 体验
- WebSocket localhost desktop 助手 (打印/扫码) — 仅 Windows
- 12 模块横向菜单 + 高密度 dashboard — 大屏适配

**Cretas 双栈**:
- Web-Admin: Vue + 现代 SPA (PC 友好)
- RN App: 移动原生 (扫码/拍照/推送)
- Mall 小程序: 微信生态

### 3.3 配置中台 (vs Cretas AI 中台)

宏见配置中台:
- 每模块"参数设置" 子菜单 (各模块都有)
- 系统管理 工作流设置 + 资料定制 + 打印管理 + 看板管理
- release notes 显示 admin 端持续配置功能 (e.g. "销售界面高级配置-公式自定义")

**vs Cretas AI 中台**:
- AIChat + Skill + Tool — 用户通过 NL 操作, 配置由 AI 推理
- C-APPROVAL-1 + C-PRT-1 (Sprint 4) — 长期路线补配置中台

**互补战略**: Cretas Sprint 4-6 加配置中台后, 形成**"AI 中台 + 配置中台"双引擎** (vs 宏见单一配置中台).

---

## 4. 隐藏功能 / 边角观察 (Round 2 实测)

### 4.1 微信客服集成 (顶部 header iframe)
- 顶部 "微信客服" 是 iframe 嵌入 (推测加载第三方客服系统)
- 客户可一键找在线客服

**Cretas 应该考虑**: 在 Web-Admin 加"在线客服" iframe (跟 Cretas BD 团队聊).

### 4.2 公司编号 + 多租户 (login 必填)
- login 必填**公司编号 lyh01** + admin + 密码
- 不同公司编号 → 不同 schema (推测) 数据隔离

**Cretas 对应**: Factory 实体 (Cretas 是 factory_id 在 JWT). 类似但 Cretas 更轻量.

### 4.3 服务代码 159016 (footer 显示)
- footer "服务代码: 159016" — 推测是当前公司的售后追踪 ID
- 客户找售后报这个号

**Cretas 应该考虑**: Cretas 平台 ID 显示 (尾部 small text), 方便客户报问题.

### 4.4 帮助手册 → help.hongjian.com (子域)
- 顶部"帮助手册" 跳到独立 help.hongjian.com (类似 docs.* 子域)
- in-app 无 inline tooltip / guided tour

**Cretas 对应**: docs.cretas.com 路线? Cretas C-MIGRATE-1 已 ship 培训视频 7 章 25min, 比宏见 in-app 帮助强.

### 4.5 释放升级日志 in-app + footer 双入口
- dashboard 显示最近 10 条 (always visible)
- footer "升级日志" image click → modal 显示完整列表

**Cretas 应该实现 (U-FEED-1 已列 P1)**.

---

## 5. UX 反 pattern 观察 (跟 Round 1 对比)

### 5.1 信息密度过高 (确认 Round 1 W4)
- 销售单查询 37 字段 (压缩在 1 屏)
- 列表 8 列 + 行内 7 icon + 4 chip + 11 操作下拉
- dashboard 12 stats + 4×4 常用 + 4×2 最近 + 10 release notes
- 系统管理 16 子菜单 + 9 流程节点 同时显示

**意味**: 宏见**牺牲 UX 简洁性换取功能密度**. 适合**专业用户长期培训后**, 不适合新员工 onboard.

### 5.2 跨域 iframe 错误 (Round 2 仍 console 报错)
- console 持续 `SecurityError: Failed to read 'document' from "crm.hongjian.com" from "finance.hongjian.com"`
- 部分跨 iframe 通信失败 → 数据不 sync

**Cretas 优势**: SPA 单一域, 无跨域问题.

### 5.3 modal in iframe = 多层嵌套地狱 (Round 2 实测)
- modal "升级日志" 内部还有 iframe → 4 层嵌套 (主页 > modal layer > content iframe > content body)
- 销售单创建 = 6 层嵌套 (主页 > tab content iframe > workflow iframe > form route iframe > main form iframe > popup picker iframe)
- 浏览器**后退 / 前进** 在嵌套中混乱

**Cretas SPA**: 单一路由, 后退顺畅.

### 5.4 列表加载没 skeleton / loading state
- 实测列表点击后空白 → 加载完才 render (无 skeleton)
- UX_BORROW B-1.M3 (Skeleton) 是**针对宏见的反对 + Cretas 升级**

---

## 6. 设计理念 vs Cretas 综合对照表

| 维度 | 宏见设计理念 | Cretas 设计理念 | 谁胜? |
|---|---|---|---|
| 核心模式 | 单据驱动 + 状态机 | AI 流驱动 + 数据 + Skill | **互补** (Cretas 加单据底层) |
| 端 | PC 桌面 only | PC + RN + 微信小程序 | **Cretas 全胜** |
| UI 库 | Layui + jQuery (2010 年代) | Vue 3 + Pinia + Element-Plus / RN + Expo (2025) | **Cretas 全胜** |
| 架构 | iframe 跨子域 + JSP | SPA + JWT + REST | **Cretas 全胜** |
| 信息密度 | 高密度 (37 查询字段一屏) | BentoGrid + 分屏 | **Cretas 友好** |
| 学习曲线 | 陡峭 (1 月+) | 平缓 (5 分钟 AIChat) | **Cretas 全胜** |
| 配置中台 | 强 (工作流编辑器 + 打印模板) | 弱 (Sprint 4 计划) | **宏见胜** |
| 财务深度 | 强 (复式记账 + 7 凭证 hook) | 弱 (SmartBI + 应收应付) | **宏见胜** (但 Cretas 用户不需要) |
| BOM 工程级 | 强 (BOMID + 版本 + ECN) | 弱 (M-BOM-VER-1 P0 计划) | **宏见胜** (Cretas Sprint 4 补) |
| AI 中台 | 0 | 强 (AIChat + 18 Skill + 290 Tool) | **Cretas 全胜** |
| 食品溯源 | 0 (仅库存流水) | 强 (TraceFullTool 独家) | **Cretas 全胜** |
| YOLO 异物识别 | 0 | 强 (foreign_object_detection) | **Cretas 全胜** |
| 移动端 | 无响应式 (PC 网页缩小) | RN 真原生 | **Cretas 全胜** |
| 客户自服务配置 | 强 (admin 工作流 + 模板) | 弱 (BD + 工程响应) | **宏见胜** (Sprint 4-6 补) |

**总结**: Cretas 在 8 维度全胜, 宏见在 4 维度胜 (财务/BOM/配置/单据深度). **战略上互补不是替代** — Cretas Sprint 4-6 补宏见 4 项后接近平等, 但 Cretas AI/移动/食品溯源是宏见永远赶不上的差异化.

---

## 7. Round 2 新发现 → MUST_COPY 增量 (跟 Round 1 不重复)

| 优先级 | 项 | 工时 | 备注 |
|---|---|---|---|
| **P1** | dashboard 卡片插件式 (10 独立 endpoint 渲染) | 5d | 团队解耦 + 易扩展 |
| **P1** | layui-layer 桌面级 modal (最大化/最小化/拖 resize) | 3d | 大客户场景 (Web-Admin) |
| **P1** | 在线客服 iframe (Cretas BD 集成) | 1d | 减少客户找 BD 难度 |
| **P2** | jsPlumb 流程图 admin 编辑器 (跟 C-APPROVAL-EDITOR-1 配套) | 已估 15d | (含在 C-APPROVAL-EDITOR-1) |
| **P2** | 服务代码显示 (footer small) | 0.5d | 客户报问题方便 |
| **P3** | help.cretas.com 独立 docs 子域 | 5d | 长期 |

---

## 8. Round 2 完成度

✅ Layui + jQuery + jsPlumb + JSP 完整技术栈 reveal
✅ layui-layer modal 4 桌面级操作 (最大化/最小化/关闭/拖 resize)
✅ dashboard = **10 独立 iframe** 重大架构发现
✅ jsPlumb 流程图**只读** (不可拖, isDraggable: false)
✅ 移动端 viewport 测试 — **完全无响应式** (12 模块横向 + 水平滚动)
✅ 设计理念 3 原则提炼 (单据驱动 / 桌面优先 / 配置中台)
✅ 隐藏功能 5 项 (微信客服 / 公司编号 / 服务代码 / 帮助手册 / 升级日志双入口)
✅ UX 反 pattern 4 项确认
✅ 跟 Cretas 14 维度对照 (Cretas 8 胜 / 宏见 4 胜 / 互补战略)
✅ MUST_COPY 增量 6 项 (Round 2 独有, 跟 Round 1 不重复)
