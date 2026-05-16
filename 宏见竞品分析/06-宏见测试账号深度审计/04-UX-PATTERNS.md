# 04 — UI/UX 模式 (≥10 模式从实测提炼)

> Phase 4 输出. 取代 UX_AUDIT_A_HONGJIAN.md 部分内容, 基于 active 实测.

---

## 1. 列表 / 筛选 模式 (5)

### UX-1. 高密度查询面板 (37 字段, 跨多种类型)
- **实测**: 销售单查询 = 12 文本 + 15 combobox + 4 数字范围 + 3 日期范围
- **特征**: combobox 联合状态 (如 "未收款+部分收款" 双态合并查询)
- **优**: 复杂业务条件可一次性精准查询
- **劣**: 新手望而却步 (UX 入门门槛高)
- **Cretas 对照**: ~10 字段, 简洁但精准度差
- **借鉴**: 加"高级筛选" toggle (默认隐藏 25+ 字段, 高级用户解锁)

### UX-2. 列表 view 切换 (5 模式 dropdown)
- **实测**: 销售单列表头有 dropdown — 标准 / 简易 1 / 简易 2 / 一维订单 / 二维订单
- **优**: 同一数据源多视角呈现, 适应不同 use case (财务看金额维度 vs 仓库看出库维度)
- **Cretas 对照**: RN 列表/卡片切换部分有, Web-Admin 缺
- **借鉴**: Cretas Web-Admin 可加"标准/简易/详细" 3 模式 + RN BentoGrid 多布局

### UX-3. 顶部新增 dropdown (4 模式)
- **实测**: 销售单"新增 ▼" — 普通 / 一维 / 二维 / **BOM 展开** ⭐
- **借鉴**: Cretas AIChat "建销售单" 可加 4 模式选 (普通 vs BOM 模式 = 配方反向算物料需求)

### UX-4. 状态色块快捷过滤行 (4 chip)
- **实测**: 销售单表头下 chip 行 — 未出 / 部分 / 已出 / 超量 (双 chip 配对加强可点性)
- **借鉴**: Cretas StatusBadge 升级 — 列表顶部加快捷 chip

### UX-5. 多维度联动筛选 + 分类树
- **实测**: 物料需求 tree 模式 (产品分类树 → 选物料 → 输出 list)
- **借鉴**: 多 SKU 场景, 移动端用 Drawer + 树, Web 用 left sidebar tree

---

## 2. 表格行设计 模式 (5)

### UX-6. 表头紧凑 8 列设计 (跨模块统一)
- **实测**: 销售/采购订单都是 8 列 (产品名/数量/价格/交货/金额/状态/备注/操作)
- **优**: 跨模块视觉一致, 用户认知迁移
- **Cretas 对照**: 列数浮动, 移动端列数减少
- **借鉴**: 跨模块统一 8 列 base 模板 + 模块加列扩展

### UX-7. 单据头行 + 子明细行 双层 (实测核心)
- **实测**: 销售单"单据头" (日期/单号/客户) + N 个"产品明细" (产品/数量/价格)
- **特征**: 单据头跨多产品行, 用淡背景区分
- **借鉴**: Cretas 列表加"分组 header"模式 (表格内嵌套)

### UX-8. 行内多 chip 状态 (4 个一行)
- **实测**: 销售单"销售订单创建 / 进行中 / 未审核 / 未出库" 4 chip 垂直堆
- **借鉴**: U-MOBILE-2 (UX_BORROW B-1.M2) 实测确认

### UX-9. 行末 7 icon 工具集
- **实测**: 销售单行内 — 二维码 / 锁库存 / 复制 / 操作日志 / 回款计划 / 打印 / 标记
- **借鉴**:
  - 二维码 → UX_BORROW C-2.F2 (U-FORM-2 行内 QR 浮层)
  - 标记 → U-CHIP-1 (订单标记色)
  - 复制 → 操作动线优化

### UX-10. 行末"操作 ▼" 11 项下拉 (UX_BORROW A-2 ⭐⭐⭐)
- **实测**: 销售单 — 查看修改/查看/修改/销售出库/销售退货/批量转组装/附加费用/销售利润/查询码/销售需求/更新销售数据/删除
- **行内显示利润** (¥21,876.12) — Cretas RBAC 全藏起来
- **借鉴**: U-ACT-1 直接源头, BottomSheet 顶部加"AI 触发"入口

---

## 3. 表单 模式 (5)

### UX-11. 工作流引擎包装 (顶部 toolbar + 节点意见)
- **实测**: 销售单创建 = 顶部 [提交/草稿/返回/审批历史] + 意见 textarea + 嵌套表单 iframe
- **借鉴**: Cretas 加"工作流 wrapper" 组件 (审批节点 vs 创建节点 vs 编辑节点 统一壳)

### UX-12. 默认 5 空行明细表 + 行间序号 (插入/删除 link)
- **实测**: 销售单明细默认 5 行, 序号下面有 2 个 link (插入/删除)
- **借鉴**: Cretas BOM/订单明细 改 5 行 default + 行间快捷操作

### UX-13. 关联价格刷新 + 批量税率 icon (inline helper)
- **实测**: 销售单 "税后单价" 旁 🔄, "发票税率" 旁 batch icon
- **借鉴**: Cretas 行内加 helper icon (智能填充)

### UX-14. popup picker (客户/产品/收货人)
- **实测**: 客户选择是右侧浮窗, 6 客户分页 + 搜索
- **借鉴**: Cretas 大数据集 (1000+ 客户) 改 popup, 减少 dropdown 加载时长

### UX-15. 复式记账行 (借/贷 双轨 + 亿/千 列组)
- **实测**: 财务凭证 5 行借贷分录, 借方/贷方分别列 + "亿/千" 组
- **借鉴**: Cretas 财务模块加复式记账 UI (P2 战略)

---

## 4. 导航 模式 (5)

### UX-16. 业务流程图 tab 自动生成 (UX_BORROW A-1 ⭐⭐⭐)
- **实测**: 12 模块每个 click 自动加 "流程图" tab + jsPlumb 7-14 节点
- **借鉴**: U-NAV-1 直接源头, 移动 BentoGrid 顶部 + Web horizontal bar

### UX-17. 多 Tab 系统底部 (UX_BORROW B-2.W1 ⭐⭐)
- **实测**: 工作台 / 流程图 / 销售订单 / 采购订单 / 出库单 ... 累积 (实测 6 tab, 推测无上限)
- **借鉴**: U-WEB-1 直接源头, Cretas Web-Admin 加 Tab Store + 持久化

### UX-18. 12 模块横向顶部菜单 (永久可见)
- **实测**: 12 模块 + "展开左侧栏▼" 切换
- **优**: 一目了然, 跨模块快切
- **劣**: 模块多了拥挤
- **Cretas 对照**: BottomTab + BentoGrid 现代得多, 不抄

### UX-19. 跨子域跳转 (5 子域)
- **实测**: 销售单点客户 → crm.hongjian.com / 点应收 → finance.hongjian.com / 点合同 → oa.hongjian.com
- **优**: 模块清晰
- **劣**: iframe 跨域 SecurityError + 浏览器后退混乱
- **借鉴**: Cretas SPA 路由保持优势, 不抄

### UX-20. 顶部固定 header (公司名 + 用户 + 16 消息 + 5 工具)
- **实测**: 公司名 (动态), admin (系统管理员), 16 (消息数 badge), 微信客服/工作台/消息/帮助/退出 5 工具
- **借鉴**: 加 "公司名 / 多租户" 显示 (Cretas 当前是 Factory 但 UI 不强调)

---

## 5. 状态反馈 模式 (3)

### UX-21. dashboard 12 stats 卡片 + 3 圆环
- **实测**: 工作台 — 12 stats (本月销售/采购/出入库/生产/报工/应付应收/库存) + 3 圆环 (库存成本/银行存款/欠款) + 异常预警
- **借鉴**: Cretas BentoGrid 已强, 借鉴 圆环 chart 形式

### UX-22. 异常预警 inline list (2 条 生产交期预警)
- **实测**: dashboard 异常预警: 2 条 生产交期预警
- **借鉴**: Cretas AIInsightCard 已强, 但**显示形式可学** (chip + 数字 + 一句话)

### UX-23. 释放升级日志 in-app feed (10 条)
- **实测**: dashboard 最近升级 10 条 release notes
- **借鉴**: Cretas 加 `/system/release-notes` 推送 — 客户感知"产品在更新"

---

## 6. 微交互 模式 (4)

### UX-24. 备货/锁定/缺口 行内显示 + tooltip 解释
- **实测**: "锁:0 备:1 缺:0" + tooltip "缺口 = 未出库 - 锁定 - 备货"
- **借鉴**: Cretas 加 tooltip 解释复杂业务字段 (UX_BORROW C-1.V2)

### UX-25. 订单标记 7 色 (灰红黄绿蓝紫白)
- **实测**: 销售单 / 采购单 / 库存单 都有"订单标记"7 色 combobox
- **借鉴**: U-CHIP 升级 — 行级用户自定义标记色

### UX-26. 两态 chip (大小配对加强可点性)
- **实测**: 状态色块过滤行 — "未出" + "未出库" 双 chip 同 link
- **借鉴**: 双链路同时展示 (Touch friendly)

### UX-27. 当前节点列 inline (workflow 状态)
- **实测**: 库存出库单列表有"当前节点"列 — 直接显示工作流步骤
- **借鉴**: U-VISUAL-3 (UX_BORROW C-1.V3) 实测确认

---

## 7. 总结 — 27 UX 模式分类

| 类别 | 模式数 | 主要 |
|---|---|---|
| 列表/筛选 | 5 | 高密度查询 / view 切换 / 状态 chip |
| 表格行 | 5 | 8 列统一 / 单据头+明细 / 11 操作下拉 |
| 表单 | 5 | 工作流包装 / popup picker / 复式记账 |
| 导航 | 5 | **业务流程图 tab** / **多 Tab 系统** / 跨子域 |
| 状态反馈 | 3 | dashboard / 异常预警 / 升级日志 |
| 微交互 | 4 | 备货公式 / 7 色标记 / 当前节点 inline |

**完整对应 UX_BORROW 23 项** + 新增 4 项 (UX-23 升级日志, UX-25 订单标记色, UX-26 双 chip, UX-27 当前节点 inline).

---

## 8. Cretas 应该抄的 UX (汇总, 跟 UX_BORROW 增量)

| 来自 | UX 模式 | UX_BORROW 编号 | 工时 |
|---|---|---|---|
| UX-16 | 业务流程图 tab | U-NAV-1 ⭐⭐⭐ | 6d (已估) |
| UX-10 | 行末操作 ▼ 11 项 | U-ACT-1 ⭐⭐⭐ | 6d (已估) |
| UX-17 | 多 Tab 系统 | U-WEB-1 ⭐⭐ | 5d (已估) |
| UX-23 | 升级日志 in-app feed | (新增 U-FEED-1) | 2d |
| UX-25 | 订单标记 7 色 | (新增 U-MARKER-1) | 1d |
| UX-26 | 双 chip 加强可点 | (UX_BORROW UX 微小升级) | 0.5d |
| UX-27 | 当前节点 inline | U-VISUAL-3 (实证) | 1d |
| UX-2 | 列表 view 5 模式 | (新增 U-VIEW-1) | 3d |
| UX-3 | 新增 4 模式 dropdown | (新增 U-NEW-1) | 2d |
| UX-9 | 行末 7 icon 工具集 | (UX_BORROW C-2.F2 升级) | 3d |

---

## 9. 完成度
✅ 27 UX 模式 (≥10 DoD)
✅ 6 大类 (列表/表格/表单/导航/状态/微交互)
✅ UX_BORROW 23 项全实证 + 4 项新增
✅ MUST_COPY 增量 10 项 (UX 维度)

---

## 10. Round 2 增量 (2026-05-15) — 新 UX 模式 (4 项)

### UX-28. Layui-layer 桌面级 Modal (Round 2 实测) ⭐
- **实测**: 升级日志 modal 含 4 操作: **最小化** + **最大化** + 关闭 + **可拖 resize 角**
- **特征**: 桌面应用风格 (Windows / macOS 模态), 不是移动 BottomSheet
- **vs Cretas**: BottomSheet 移动 native — 范式不同
- **借鉴**: Web-Admin 复杂场景 modal (大表单/详情) 加桌面级 4 操作
- **工时**: 3d (UX_BORROW 增量)

### UX-29. Dashboard 卡片 = N 独立 iframe (Round 2 重大架构发现) ⭐⭐
- **实测**: 工作台 dashboard 内嵌 **10 个独立 iframe** 每个统计卡片独立
- URL 例: `sale.hongjian.com/sale/stockout/salestockoutchart_index.jsp` (销货 chart)
- **优**: 卡片独立部署 / 团队解耦 / 易扩展 (新增卡片只需 url)
- **劣**: 加载慢 (10 并发请求 + iframe sandbox)
- **vs Cretas**: BentoGrid 单页 + 一次性返回所有数据
- **借鉴**: Cretas BentoGrid 加"插件式"模式 (custom widget URL), 给客户/合作方添加自定义卡片
- **工时**: 5d (BentoGrid 插件机制)

### UX-30. jsPlumb 流程图 (Round 2 实证只读 + Toolkit object) ⭐
- **实测**: jsPlumb library active in iframe, 节点 `position: absolute` + (x, y) 坐标
- **节点 `isDraggable: false`** — 流程图是只读 displayed, 不是 admin 编辑器
- **借鉴**: Cretas C-APPROVAL-EDITOR-1 (规划) 用 jsPlumb 库 — 跟宏见同栈但 Cretas 提供 admin **可编辑** 模式 (差异化)
- **工时**: 包含在 C-APPROVAL-EDITOR-1 (15d 已估)

### UX-31. 顶部 header iframe 嵌入 (微信客服) (Round 2 发现)
- **实测**: 顶部右侧"微信客服" 是 iframe 嵌入 (推测加载第三方客服系统)
- **借鉴**: Cretas Web-Admin 加"在线客服" iframe (Intercom / Zendesk / Cretas BD chat)
- **工时**: 1d

---

## 11. Round 2 增量后总览 (31 UX 模式)

| 类别 | Round 1 | **+ Round 2** | 合计 |
|---|---|---|---|
| 列表/筛选 | 5 | 0 | 5 |
| 表格行 | 5 | 0 | 5 |
| 表单 | 5 | 0 | 5 |
| 导航 | 5 | 0 | 5 |
| 状态反馈 | 3 | 0 | 3 |
| 微交互 | 4 | 0 | 4 |
| **架构 / 技术栈 (新)** | 0 | **4 (UX-28~31)** | 4 |
| **合计** | **27** | **+4** | **31** |
