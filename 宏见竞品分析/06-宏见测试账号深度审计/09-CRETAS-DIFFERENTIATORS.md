# 09 — Cretas 差异化卖点 (宏见做得烂的)

> Phase 4 输出. 实测后**确认** Cretas 比宏见强的 + 宏见显著做得烂的, 给销售弹药.

---

## 1. 宏见明显做得烂的 (5 大 weakness)

### W1. 老 web 架构 (jQuery + JSP + iframe)
- **实测证据**:
  - 静态资源用 `https://resource.hongjian.com/javascript/jquery.js` (10 年前技术栈)
  - JSP 服务端渲染 (login.jsp / index.jsp / 各模块 list.jsp)
  - **15+ 个 iframe 嵌套** (销售单创建页有 6 层 iframe)
  - 跨域 SecurityError (console 实测): `crm.hongjian.com → finance.hongjian.com 跨 iframe 失败`
- **客户痛点**:
  - 切换模块加载慢 (每次 iframe full reload)
  - 移动端体验差 (H5 webview, 非原生)
  - 浏览器后退/前进混乱 (iframe 内导航)
  - 部分功能跨域失败 → 数据无法 sync
- **Cretas 优势**: SPA + JWT + RN 原生
- **销售话术**: "宏见点 1 个客户名要等 3 个 iframe 加载, 我们 SPA 瞬间响应"

### W2. 本地 desktop 助手依赖 (打印/扫码)
- **实测证据**: console 持续报错 `WebSocket connection to 'wss://localhost.hongjian.com:38580/' failed: ERR_CONNECTION_REFUSED`
- **意味**: 打印机/扫码枪/U盾需要装宏见 desktop 助手才能用
- **客户痛点**:
  - 仅 Windows (估计)
  - 安装麻烦 + 防火墙问题
  - macOS / Linux 用户被排除
- **Cretas 优势**: Web 浏览器 API + Expo 原生 (无 desktop 依赖)
- **销售话术**: "宏见装个打印机要装 desktop 助手, 我们手机直接连蓝牙打印机"

### W3. AI 几乎为零
- **实测**: 12 模块 + 280 子菜单, **没有 AIChat / 智能推荐 / 自然语言查询**
- 接近的是: 异常预警 (规则触发, 不是 AI), 三价标红 (规则), 工作流自动 (规则)
- **客户痛点**:
  - 销售员要学 33 字段才能建销售单
  - 仓管员要找 8 个菜单才能知道今天该收哪些货
  - 财务要点 7 次才能生成凭证
- **Cretas 优势**: AIChat + 18 Skill + 290 Tool + SmartBI NL Query
- **销售话术**: "宏见培训 1 个月, 我们 AI 一句话说人话即可 — 5 分钟上手"

### W4. UI 拥挤 + 高密度信息
- **实测证据**:
  - 销售单查询 37 字段 (压缩在小区域)
  - 列表表头 8 列 (移动端不可读)
  - 12 模块顶部菜单 + 25-31 子菜单
  - 12 stats dashboard + 4×4 常用菜单 + 4×2 最近浏览 + 10 release notes (信息密度爆炸)
- **客户痛点**:
  - 新员工 onboard 困难 (找不到自己要的功能)
  - 移动端体验灾难 (H5 webview 缩放查看)
  - 视觉疲劳
- **Cretas 优势**: BentoGrid + 角色路由分离 + Neo Minimal 设计
- **销售话术**: "宏见 1 个屏幕 50 个字段, 我们 BentoGrid 按角色个性化 — 销售员看销售单, 仓管员看入库单"

### W6. **完全无移动响应式** ⭐⭐⭐ (Round 2 实测)
- **实测证据 (Round 2)**:
  - 在 375 × 812 (iPhone X 尺寸) viewport 下: 12 模块菜单**全部强制显示** (visibleMenuCount: 12)
  - **horizontalScroll: true** (docScrollWidth 376 > viewport 375) — 必须左右滑动
  - **isResponsive: false** — 字体 / hit area / layout 全部不变
  - 用户必须**双指放大 + 横滑** 才能用
- **客户痛点 (F006 卤制品工厂)**:
  - 仓管员手机扫码入库 → 宏见 H5 慢 + 难点
  - 销售员车间走访拍照 → 宏见无原生相机
  - 老板手机查报表 → 宏见 H5 字小难看
- **Cretas 优势**: Expo + RN 真原生 + 角色路由分离
- **销售话术**: "宏见手机端是 PC 网页缩小, 我们 RN 真原生; 您仓管员手机扫码顺畅, 不用装 desktop 助手"

### W7. **layui + jQuery + JSP 老栈 + 6 层 iframe** ⭐⭐ (Round 2 确认)
- **实测证据 (Round 2)**:
  - UI 库: Layui (中国 2014 年代框架)
  - JS: jQuery (2006-) + JSP (1999-) 服务端渲染
  - 销售单创建 = **6 层嵌套 iframe** (主页 > tab > workflow > form route > main form > popup picker)
  - dashboard = **10 独立 iframe** 加载 (每卡片 1 iframe)
  - console 持续 SecurityError (跨 iframe 通信失败)
- **客户痛点**:
  - 浏览器后退 / 前进 在嵌套中混乱
  - 部分功能跨域失败 → 数据不 sync
  - 加载慢 (每个 iframe 独立 HTTP)
- **Cretas 优势**: SPA 单一域 + Vue 3 / RN + JWT 无状态 + REST
- **销售话术**: "宏见点 1 个客户名要等 6 层 iframe 加载, 我们 SPA 0.1 秒响应"

### W5. 财务模块过重 (对中小客户)
- **实测**: 财务 21 子菜单 + 复式记账 + 7 凭证 hook + 期间结账 + 固定资产折旧 + 长期待摊 + 32 币种 + 14 支付方式
- **客户痛点 (F006 卤制品工厂)**:
  - 不需要复式记账 (没专职会计)
  - 不需要长期待摊 (业务简单)
  - 不需要 32 币种 (内贸单一)
  - 不需要 14 支付方式 (现金/微信/月结即可)
- **Cretas 优势**: SmartBI 数据分析 + 应收账龄 (轻量级 + AI)
- **销售话术**: "宏见财务太重, 适合上市公司; 我们 SmartBI + 应收应付 简单清晰, 不需要专职会计"

---

## 2. Cretas 实测确认的优势 (10 项)

### S1. **AI 中台 (AIChat + Skill + Tool)** ⭐⭐⭐
- **Cretas**: AIChat 8 SCENE + 18 Skill + 290 Tool + SlotFilling LLM 多轮 + sessionId
- **宏见**: 0 — 完全没有
- **战略**: 这是 Cretas 最大壁垒

### S2. **食品溯源 (TraceFullTool 独家)** ⭐⭐⭐
- **Cretas**: TraceFullTool / TraceBatchTool / 摄像头 ISAPI
- **宏见**: 没有食品溯源 (只有库存流水)
- **客户**: 给盒马山姆 / 沃尔玛审计直接出数据

### S3. **YOLO 异物识别** ⭐⭐
- **Cretas**: foreign_object_detection/ 已实装
- **宏见**: 0 — 摄像头管理但无 AI 识别
- **客户**: 食品厂 HACCP 合规

### S4. **现代 UI (Neo Minimal + BentoGrid)** ⭐⭐
- **Cretas**: 移动 Bento Grid + RN 原生
- **宏见**: jQuery + iframe + 拥挤
- **客户**: 新员工 onboard 1 周 vs 1 月

### S5. **角色路由分离 (10 角色独立 Navigator)** ⭐⭐
- **Cretas**: 销售员 / 仓管员 / 财务 各自独立 RN Stack
- **宏见**: 单一 12 模块横向菜单, 角色权限隐藏
- **客户**: 角色专精, 减少认知负担

### S6. **canViewPrice 价格保护 (35-view defense)** ⭐
- **Cretas**: PR #423 + #520, 35 view RBAC
- **宏见**: 推测有, 但销售单"操作 ▼"行内显示利润 ¥21,876.12 (admin 视角)
- **客户**: 仓管员严格隔离价格

### S7. **JWT 无状态 + 跨平台** ⭐
- **Cretas**: JWT + Expo + RN
- **宏见**: cookie + iframe 跨域
- **客户**: 移动端原生 + 跨域稳定

### S8. **SmartBI NL Query** ⭐⭐
- **Cretas**: 自然语言查 BI (一句话生 chart)
- **宏见**: 静态报表 + 高密度 dashboard
- **客户**: 老板"5 月谁迟到最多" 一句话即可

### S9. **AIInsightCard + AIAlertsScreen** ⭐
- **Cretas**: 主动推送异常
- **宏见**: 异常预警 list (被动看)
- **客户**: 业务异常自动推

### S10. **行业模板 + Feature Flag (C-FEATURE-1)** ⭐
- **Cretas**: IndustryTemplatePackage + FactoryFeatureConfig
- **宏见**: "功能扩展" 子菜单 (推测类似)
- **客户**: 新行业 onboard 不用从 0 开发

---

## 3. 销售话术弹药包 (10 句)

| 场景 | 话术 |
|---|---|
| 客户问 "我能不能像金蝶那样建凭证?" | "我们 Phase 2 上凭证 hook (vflag), Phase 3 上复式记账; 当前业务流自动入账 SmartBI 出报表更轻量." |
| 客户问 "我能不能用 AI 一句话建销售单?" | "可以, 我们 AIChat 已实装 8 场景 + 18 Skill, 销售员说 '给客户 X 下 5 箱牛肉' 即可." |
| 客户问 "你们的 AI 能记住我之前问的吗?" | "可以, 我们 PR #596 ship 了 SlotFilling LLM 多轮对话 + sessionId 端到端." |
| 客户问 "你们 BOM 能管多版本吗?" | "ASAP+1 月 (Sprint 4) 我们 ship M-BOM-VER-1 实体独立化 + ECN 变更." |
| 客户问 "你们能跟我们的钉钉对接吗?" | "Sprint 4 (4 周内) 钉钉机器人 PoC, 复用我们现有 AIChat 全套能力." |
| 客户问 "你们的工序流转怎么用?" | "Sprint 2 (2 周) 工序管理 UI, 后端早就 ship 了." |
| 客户问 "宏见有 12 模块, 你们呢?" | "我们按角色拆 — 销售员只看销售模块, 仓管员只看库存. 不必学 12 个模块." |
| 客户问 "你们怎么扫码入库?" | "RN 原生扫码, 不需要装 desktop 助手. 我们 PR #413 ship 了 PDF + QR 标签." |
| 客户问 "你们的财务跟金蝶/用友怎么对接?" | "通过 vflag 凭证 hook (Sprint 3 ship), 业务单 → 自动财务凭证, 不重复建设." |
| 客户问 "你们移动端真的好用吗?" | "Expo + RN 真原生, 不是 H5 webview. 宏见手机端是网页 webview, 我们是真 app." |

---

## 4. 弱化宏见的话术 (避免显得攻击)

| 客户问 | 我们说 | (内心知道但不说) |
|---|---|---|
| "宏见也能做 ERP 啊" | "宏见是传统 ERP, 我们是 AI + 业务流; 互补, 看场景选." | (jQuery + iframe, 移动端难用) |
| "宏见 12 模块挺全" | "全功能 ERP 学习成本高; 我们按角色个性化, onboard 5 分钟 vs 1 月." | (信息过载, 客户找不到功能) |
| "宏见的财务很专业" | "宏见财务深, 适合上市公司; 您 (F006 卤制品工厂) 用 SmartBI 应收应付 + 钉钉推送 即可." | (用户用不到 80%) |
| "宏见也有 AI" | "宏见有规则引擎 (异常预警/三价标红), 我们是真 LLM (自然语言一句话完成业务)." | (实测 0 AI) |

---

## 5. 给销售总监的总结

宏见 ERP 的真相 (审计后):
- **是**: 成熟全功能 ERP, 适合大客户 + 上市公司 + 财务专业团队
- **不是**: 移动友好 / AI 智能 / 现代 UX / 食品溯源专精
- **F006 卤制品工厂选我们的理由**:
  1. AI 让现场员工不需要学 ERP
  2. 食品溯源给盒马山姆审计直接出
  3. 移动原生让车间扫码顺畅
  4. RBAC 价格保护更细
  5. 钉钉机器人 (Sprint 4) 让微信群直接调用 AI
  6. SmartBI 让老板一句话出报表
- **大型集团客户长期路线 (Sprint 4-6+)**: 加凭证 hook + BOM 工程级 + 工作流引擎 + 报表三表 — 弥合差距, 但仍然 AI 优先

---

## 6. 完成度
✅ 5 大宏见 weakness (有实测证据)
✅ 10 项 Cretas 优势 (含 AI / 食品溯源 / 异物识别 / RN 原生 / SmartBI 等)
✅ 10 句销售话术弹药
✅ 4 句弱化宏见的话术
✅ 销售总监总结
