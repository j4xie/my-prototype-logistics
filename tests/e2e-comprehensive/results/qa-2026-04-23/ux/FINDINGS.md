# UX Audit Findings — 2026-04-23

**Tenant**: qhj_prod (RES_3101_009, 餐饮租户, POS 数据=2025 全年 ¥20.6M/140K 单)
**Tool**: Playwright headless 1600×1000 + fullPage 截图, 隔离 chromium.launch
**Scope**: 5 页 — 经营驾驶舱 / 财务分析 / 餐饮v2 / 趋势分析 / 销售订单

总 findings: **18 条** (按严重度排序)

---

## 🔴 P0 — 严重 (影响客户第一印象或造成错误商业判断)

### 1. 财务分析 顶部 KPI 全 0 + **误报预警** vs 底部模板分析 ¥3.22 亿
**现象**: `/smart-bi/finance` 顶部 "毛利润 0元 / 净利润 0元 / 毛利率 0.0% / 净利率 0.0%", 预警提醒 "毛利率低于行业基准 (食品加工行业基准为 25-35%)" — 实际底部 TemplateGrid 显示 **¥3.22 亿营收 / ¥3.10 亿成本 / 8.42% 营业利润率** 真实数据.
**影响**: 用户打开第一眼以为生意糟糕/数据缺失 → 可能滑走不看底部; 预警触发"低于基准"是**基于 0 数据的虚假告警**.
**根因**: 顶部 KPI 走老路径 (finance_data 表), 未迁到 Gold. Gold flip 只做了概览 (Dashboard), 没做 Finance 深度.
**建议**:
- 短期: 顶部 KPI 默认载入时间范围 (本年或最近 1 年), 不要进页就空.
- 中期: 预警逻辑添加 "若营收=0 则不发预警" 守卫.
- 长期: 顶部 KPI 切换为读 Gold `agg_daily` (扩展现有 Gold flip).

### 2. 经营驾驶舱 顶部 KPI = 4,500 / 1.6万 vs 底部 TemplateGrid 利润 ¥3.62 亿
**现象**: 顶部 "本月销售额 4,500" — 对一个月营收 ¥1.7M 的 8 店连锁, 这个数不可能.
**影响**: 误导性数据, 用户以为生意崩了.
**根因**: 顶部老数据源 (smart_bi_sales_data 或类似 Java 表) 没同步到 POS 数据.
**建议**: 同 #1, 上移 Gold 数据到顶部 KPI.

### 3. 经营驾驶舱 "产品类别占比" 饼图显示 **数字 ID** 1001/1002/1003 而非中文类别名
**现象**: `按类别排行` chart 标签是 "李四/王五/张三" (人名), `产品类别占比` pie slice 标签是 "1001.0 / 1002.0 / 1003.0 / 1002.0 / 44.4" (数字 ID).
**影响**: 客户看不懂图表 → **产品可用性崩溃**.
**根因**: 数据预处理层把产品类别 ID 直接 exposed, 没 JOIN 到 dim_product_category 取中文名.
**建议**: 图表渲染前 resolve ID → display name; 或后端查询时 JOIN dim 表.

### 4. 餐饮 v2 UI 暴露 **开发内部代号** "邓总救命组合" / "Week 2+3"
**现象**:
- Header: `餐饮 SmartBI V2 — 邓总救命组合 [Week 2+3]`
- Empty state: `选择 upload → 点'跑 V2 分析' → 查看邓总救命组合`
**影响**: 客户困惑"谁是邓总? 为什么要救命?", 破坏产品专业感. 这是 prod-shipping 内部玩笑残留, **P0 必须清理**.
**建议**: 全局搜索替换 "邓总救命组合" → "餐饮综合分析" 或类似中性名; "Week 2+3" tag 删除或替换为版本号.

### 5. 我自己的 Trends Gold POS trend card 默认不显示 (UX self-goal)
**现象**: `/analytics/trends` 默认 period = '近7天' → 近7天 qhj 无数据 → `goldTrend=null` → card 隐藏 → 用户看到的还是 3 个 0 值老图 + "暂无生产数据" alert. 必须手动切换到 "2025 全年" 才能看到本 session 新加的 POS 趋势.
**影响**: 新功能**默认不可见**, 90% 用户永远看不到.
**根因**: 我今日 commit `2a3ef3859` 的默认 period 设计问题.
**建议**:
- loadGoldTrend 实现类似 sales/orders 卡片的 **fallback 链**: 先 week → 若 empty 则 month → 若 empty 则 2025全年.
- 或 period 选择器默认改为 "近90天" 提高命中率.

---

## 🟡 P1 — 体验劣化 (用户能用但困惑/碍眼)

### 6. 经营驾驶舱 "订单数量/活跃客户" 显示 `--` (无数据占位符) + 不解释
**现象**: 4 KPI 中 2 个数字 / 2 个 `--`. 下方有"暂无数据"小字, 但为啥前两个有数据后两个没有, 用户懵.
**建议**: 要么全显 OR 全 `--` (数据一致性); 要么 `--` 下附"需上传订单/客户数据以启用" hint.

### 7. 财务分析 顶部 "储值卡消耗分析" 显示 ¥0 + summary "查询 20000 订单无储值卡相关"
**现象**: 底部 templateCard 显示 ¥0 + 无图表 + summary 冗长技术术语.
**建议**: 空状态 copy 改 "本期间暂无储值卡消费记录 (堂食/外带直接结账)" — 业务语言.

### 8. 财务分析 顶部 "团购渠道分析" 显示 `¥7,313,617万` 单位混乱
**现象**: 数字 "7,313,617万" 意思是 7 千 3 百万万? 还是 ¥7,313,617 (7.3 百万)? 
**根因**: 后端返回值已是"万"单位, 前端又加"万"后缀.
**建议**: 后端返原始元数, 前端统一 formatNumberCN 决定万/亿单位.

### 9. 餐饮 v2 实时 KPI 看板 默认日期 = 本月 → 空 state
**现象**: 我加的 KPI strip 默认 range `2026-04-01 → 2026-04-23` → qhj 本月无数据 → 显 "所选区间无 POS 数据".
**建议**: 同 #5, fallback 链 or 默认切到"近 90 天" / "上一年同期".

### 10. 销售订单 对 restaurant tenant 整页 **共 0 条记录** + 空表格 占 60% 高度
**现象**: qhj 没 B2B 销售订单, 表格完全空. 顶部我的 POS 概览卡做了"安慰", 但表格仍空占版面.
**建议**:
- 方案 A: restaurant tenant 访问时把空表格折叠, 默认展开 POS 概览.
- 方案 B: 菜单不显示 `销售订单` 给 restaurant tenant (类似 Canvas 模块权限).

### 11. 趋势分析 对 restaurant tenant: 3 个 0 值 chart (生产/质量/成本) 占据 70% 屏幕
**现象**: manufacturing 专用图表对 restaurant tenant 毫无意义但占满屏.
**建议**: tenant type=RESTAURANT 时直接隐藏这 3 个 chart, 显示 Gold POS trend.

### 12. 财务分析 初始 "开始日期/结束日期" 为空 + 刷新按钮孤立
**现象**: 日期范围未选, 但 KPI 已经显 0; "刷新" 按钮浮在右上角与内容断开.
**建议**: 默认填入本年起始 → 今日, 打开就有数.

### 13. 餐饮 v2 期间硬编码 = `2026-02` / 子行业 = `火锅` / 门店 placeholder = `鼎鲜火锅·义乌`
**现象**: 所有 demo 数据写死, 根本不匹配 qhj (2025 青花椒连锁).
**建议**: 
- 期间 默认取最新 upload 月.
- 子行业 根据 POS 菜品模式探测 (川菜/火锅/快餐).
- 门店 placeholder 改 "例: 青花椒大丸百货店" (租户相关).

### 14. 趋势分析 网络空闲耗时 7.8s (其他页 1-2s)
**现象**: `tIdle=7802ms` 明显慢. 用户等待期间页面有骨架屏 / 空 chart / 白屏.
**根因**: 未查明, 可能 template embeddings 预热或多个 template 查询串行.
**建议**: 网络 waterfall 分析; 多个 template 查询可并行.

---

## 🟢 P2 — 细节打磨

### 15. Dashboard "Gold 预览" 按钮 orange/warning 色调突兀
**现象**: 右上按钮群 "刷新数据" (blue primary) / "AI 问答" (green) / **"Gold 预览" (orange warning)** 色彩不一致.
**建议**: "Gold 预览" 改 blue/plain, 或与 "AI 问答" 同样绿.

### 16. 餐饮 v2 empty state 图大 + 引导语简陋
**现象**: 占据半屏高度的大型 empty-state illustration + 单句引导.
**建议**: 压缩 empty 高度或改为顶部 alert bar + 下方直接 list recent uploads.

### 17. 所有 TemplateCard 标题文字末尾跟着 "来源: 2026/4/21" 日期字符 — 干扰阅读
**现象**: `"热销菜品 Top N 来源: 2026/4/21"` 挤在一个标题栏.
**建议**: 日期移到 card footer 小字或 hover tooltip.

### 18. 经营驾驶舱 "区域销售分布" 占一整行 但只显 "暂无区域销售数据"
**现象**: 空状态 section 占一行, 浪费空间.
**建议**: 空状态时折叠为单行 alert 或整体隐藏.

---

## 优先修复清单 (工作量估算)

| 优先 | 问题 | 改动估算 |
|---|---|---|
| P0-1 | Finance 顶部 KPI 迁 Gold | 1-2 天 (复用 FinanceAnalysisServiceImpl 已有 Gold path) |
| P0-2 | Dashboard 顶部 KPI 迁 Gold | 已完成 (SMARTBI_GOLD_READ_PRIMARY_ENABLED=true), 但 **"本月 4500" 是 legacy 路径漏网**. 查 buildFromFinanceSummary 本月返 null 时是否回 legacy |
| P0-3 | 类别 ID → 中文名 resolve | 0.5-1 天 (JOIN dim_product_category) |
| P0-4 | 清 "邓总救命组合" + "Week 2+3" | 0.5 天 (grep+替换) |
| P0-5 | Trends+RestaurantV2 KPI 默认 range fallback 链 | 0.5 天 (抽 helper hook) |
| P1 项 | 逐个修, 总量 | 3-4 天 |

---

## 截图参考
- `dashboard.png / dashboard-viewport.png` — P0-2, P0-3 证据
- `finance.png / finance-viewport.png` — P0-1, P1-7, P1-8 证据
- `rest_v2.png / rest_v2-viewport.png` — P0-4, P0-5, P1-9, P1-13 证据
- `trends.png / trends-viewport.png` — P0-5, P1-11, P1-14 证据
- `orders.png / orders-viewport.png` — P1-10 证据
- `tablet-dashboard.png` — 1024×768 layout OK, 无横向溢出

## 自动检测性能数据

| 页 | tDom | tIdle | tTotal | 评估 |
|---|---|---|---|---|
| dashboard | 251ms | 2118ms | 8137ms | ✅ |
| finance | 259ms | 1777ms | 7805ms | ✅ |
| rest_v2 | 241ms | 1658ms | 7685ms | ✅ |
| **trends** | 248ms | **7802ms** | **13819ms** | ⚠️ 慢 |
| orders | 244ms | 1500ms | 7524ms | ✅ |
