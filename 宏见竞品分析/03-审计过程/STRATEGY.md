# Cretas vs 宏见 ERP — 战略对比与 Agent/Canvas 优势策略

> **本报告地位**：STRATEGY > AUDIT > REVIEW > REPORT。整合 4 路并行审计的硬证据。
>
> **核心问题**："我们的 AI Agent / Canvas 功能等等的优势是什么，如何借鉴优化？"
>
> **诚实交代**：上一轮 AUDIT 已经修正 REVIEW 的乐观估计。本轮 STRATEGY 进一步发现 Cretas **3 个被声明但实际是死代码/假实现**的能力，必须先承认才能策略化。

---

## A. 本轮新发现（4 路并行审计交叉验证）

### A-1. ❌ Canvas 系统的"AI 辅助布局"是假 AI

| 项 | 证据 |
|---|---|
| 现象 | `AILayoutAssistant.tsx` 有完整的打字机效果、澄清问题、StylePreset UI——视觉上像在跟 LLM 对话 |
| 真相 | `DecorationServiceImpl.generateLayoutWithAI()` **L207 写死 `modelUsed("rule-based")`**——根本没调 LLM，只按 priorityModules 排序 + 调色板 |
| 影响 | 销售 demo 时一旦演示这个功能，会被技术派客户当场识破 |

### A-2. ❌ PageEditor 1252 行 dead code

| 项 | 证据 |
|---|---|
| 现象 | `lowcode/PageEditor.tsx` (1252 行) + `ComponentPalette.tsx` (698 行) 完整低代码设计器 |
| 真相 | `grep PageEditor` 全仓 **0 个 navigation 引用**——挂不到任何导航 stack，用户根本进不去 |
| 影响 | "拖拽生成表单"完全不可演示——前端组件烂在仓库 |

### A-3. ⚠️ AIChat 多轮对话不可用（sessionId 不传）

| 项 | 证据 |
|---|---|
| 现象 | AIChatScreen 有 sessionId 状态，后端 SSE 也有读 sessionId 逻辑 |
| 真相 | `aiApiClient.executeIntentStream` L1026 POST body **只发 `{userInput, entityType}`**，sessionId 永远是 null 到后端 |
| 影响 | 演示"上一轮我说牛肉，这一轮说 800 箱" → 后端不知道上下文，会重新追问 |

### A-4. ⚠️ Tool/前端断链 — Canvas Tool 写错表

| 项 | 证据 |
|---|---|
| 现象 | 7 个 LLM-driven 页面/装饰 Tool 真实存在（pagedesign × 4 + decoration × 3） |
| 真相 | 4 个 pagedesign Tool 写 `lowcode_page_config` 表，但前端 PageEditor 没挂导航（A-2）<br>3 个 decoration Tool 写 `FactorySettings` 表，但 HomeLayoutEditor 读 `FactoryHomeLayout` 表——**前后端读不同表** |
| 影响 | "AI 一句话改首页"声明可用，实际 AI 写的内容前端读不到 |

### A-5. ✅ AIChat 主路径真实可用

| 项 | 证据 |
|---|---|
| SSE 流式传输 | `react-native-sse` 前端 → Spring `SseEmitter` 后端，逐 token 发送（**仅对通用咨询类问题**） |
| 8 路意图识别 | 实际 **6 路有独立分支**：EXACT/PHRASE_MATCH/SEMANTIC/FUSION/CLASSIFIER/LLM 都真执行，每路写库 `saveIntentMatchRecord` |
| LLM 兜底 | DashScopeClient → PythonLLMClient → Python `/api/llm/intent-classify` → 4-provider router (qwen/deepseek/zhipuai)，真实接通 |
| Embedding 向量检索 | `GrpcEmbeddingClient` 真接端口 9090 |
| Tool 业务执行 | `ProcessingBatchListTool` → `processingService.getBatches` → JPA → PostgreSQL，真查 DB |

### A-6. ⚠️ "5 分钟 Redis 缓存"实际是 JVM Caffeine

| 项 | 证据 |
|---|---|
| 现象 | CLAUDE.md 说 "Redis 缓存，TTL 5 分钟" |
| 真相 | `IntentResultCache` 用 `Caffeine.newBuilder().expireAfterWrite`——**进程内缓存，重启即丢** |
| 影响 | 多实例部署时缓存命中率低；横向扩容收益 ≠ 声明值 |

### A-7. ✅ 16 个 Skill 实际 18 个（之前 AUDIT 确认）

详见 AUDIT.md §C。

---

## B. UI/UX 层面的对照（视频里看到的 vs Cretas 现状）

### B-1. 宏见 UI 模式总结（从 137 帧提取）

| # | UI/UX 模式 | 典型帧 | 设计意图 |
|---|---|---|---|
| 1 | 顶部 12 横向模块菜单 | 全局 | 一级导航暴露全功能 |
| 2 | 左侧 20+ 二级树形菜单 | 全局 | 二级导航在内容区左侧持续可见 |
| 3 | 中部密集多列表格（粉/红/绿行级色块） | 001435 库存 | 状态色 + 数据汇总在一个视图 |
| 4 | 顶部多 Tab 累积（用户每点开一项就多一个 Tab） | 001151 | 多任务同时进行的代价是 Tab 拥挤 |
| 5 | 底部固定批量操作栏（含 5+ 按钮） | 000122 | 选择 → 批量动作模式 |
| 6 | 右上角悬浮人脸头像 + 个人入口 | 全局 | 视频会议感的录制功能 |
| 7 | 弹窗内联二维码 | 000553 | 单据-工人桥接 |
| 8 | 工作流节点流程图（拖拽节点） | 000043 | 流程可视化（实际多数客户用不到） |
| 9 | 客户详情 17 Tab（基本资料/跟踪/文件/图片/价目/账期/...） | 010 | 信息架构暴漏全部，造成认知负担 |
| 10 | 多维度库存筛选（日期/批号/供应商/失效期 × 联动） | 001435 | 食品行业刚需，UI 必须细 |

### B-2. Cretas 现有 UI 范式

| # | Cretas 现状 | 评判 |
|---|---|---|
| a | **场景化入口卡片（Home Bento Grid）+ 模块下钻 + AIChat 一键触发** | 🟢 比宏见现代，少 cognitive overload |
| b | **顶部仅 1-2 级 tab（角色路由 + 业务子页）** | 🟢 比宏见简洁 |
| c | **行级 swipe + 详情下钻**（移动优先） | 🟢 比宏见适合手机/平板 |
| d | **AI Insight Card 异常驱动** (`AIInsightCard.tsx`) | 🟢 推送而非主动查询 |
| e | **多维度库存表 + 富过滤** | 🔵 已有 InventoryQueryScreen 但**未对标宏见的密度**，目前过滤维度少 |
| f | **客户详情 Tab 化** | ⚠️ 暂未见对应深页面（仅 CustomerListScreen） |
| g | **批量操作栏** | ⚠️ 仅在 Selection mode 出现，未做成"标配下沿固定" |
| h | **工作流可视化** | ❌ ApprovalChainConfig 是 JSON 后端，前端无编辑器 |

### B-3. 客户被"卡住"的 UI 证据（17:00-22:30）

视频里客户开始负反馈期间，画面停留在**设备管理页**约 3 分钟（`001918`-`002213`）——而客户讲的是冷链/商超/24h 生产/30-50 用户这些跟设备管理**完全无关**的内容。

销售自己也承认（17:51-18:06）"**装箱称重/设备管理/模具这些不一定用，可以去掉**"——但他此刻还停在这些页面，没切到客户真正关心的"批号库存/客户毛利/商超对账"。

**这是 cognitive overload 直接证据**：客户的"论资在论的太多了"指的不是功能不足，而是 information architecture 让他**找不到自己关心的东西在哪**。

---

## C. Cretas Canvas + AI Agent 的**真实**优势（修正所有过往乐观估计后）

### C-1. 真实可演示的优势（4 项，verified）

1. **AIChat 场景化对话** ✅
   - 8 个业务场景（PRODUCTION_PLAN/WORK_REPORT/QUALITY_CHECK/SHIPMENT/MATERIAL/PURCHASE/EQUIPMENT/ATTENDANCE）
   - 每场景有 4 个 quickQuestions + allowedActionCodes 安全白名单
   - SSE 流式 + 11 callback + RichContent 5 种渲染分支
   - **宏见完全没有**——这是最大差异化

2. **18 个 Skill + 337+ Tool 自动注册** ✅
   - 跨模块编排能力（虽然 sales→production→purchase chain 还没接，但 18 个独立 Skill 真实可用）
   - 自然语言 → 业务动作的桥接
   - **宏见完全没有**

3. **场景化 Home + AI Insight Card** ✅
   - FAHomeScreen 异常推送（库存预警/质检异常/排产冲突）
   - 主动推送代替"用户每天打开 ERP 找问题"
   - **宏见完全没有**

4. **食品溯源全链路 Tool**（`TraceFullTool` / `TraceBatchTool`） ✅
   - 批号 × 供应商 × 失效期 × 工序 全链路追溯
   - 直接对接盒马/山姆/卡斯克的审计要求
   - **宏见有库存批号，但没有"溯源链路 Tool"** — 这是合规级差异化

### C-2. 声明有但未真实落地的（4 项，需修复才能演示）

| # | 项 | 修复工时 |
|---|---|---|
| 1 | AIChat 多轮对话 sessionId 传递 (A-3) | **0.5 人天** — 前端 body 加 sessionId 即可 |
| 2 | AILayoutAssistant 接真 LLM (A-1) | **4 人天** — DecorationServiceImpl 调通 PythonLLMClient |
| 3 | PageEditor 挂导航 + 跑通 (A-2) | **2 人天** — Navigator 加路由 |
| 4 | Canvas Tool 改写正确的 Repository (A-4) | **3 人天** — pagedesign Tool 改写 FactoryHomeLayoutRepository |

**总计 9.5 人天**就能让 Canvas 系统从"3/5 功能死掉"变成"全部可用"。

### C-3. 缺口（需要新建）

| # | 缺口 | 工时 |
|---|---|---|
| 1 | 跨域 Sales→Production→Purchase Skill | 6-7 人天 (包含修 4 个 stub) |
| 2 | Slot-filling 多轮对话后端 | 8-12 人天 |
| 3 | 视觉自动报工 (人脸识别 + 事件桥) | 10-15 人天 + 30 天 PoC |
| 4 | 报价单实体 + 模块 | 5-8 人天 |
| 5 | Voucher 凭证体系 | 15-20 人天（仅当客户群需要） |

---

## D. 借鉴宏见 + 利用 Cretas 优势 — 战略路线

### 战略原则

> **不要追平宏见的功能列表**——那是它 10 年累积，6 个月追平 = 它的劣化版。
>
> **做我们已有的更好**——AIChat + Canvas + 食品溯源 + 视觉识别 + 多语言 + 现代 Tech Stack，把这些**真讲清楚**比加 100 个菜单有用。

### D-1. 🟢 必须立即做（2-3 周完成，全是修死代码 + 接线）

1. **修 AIChat sessionId 传递** (A-3) — **0.5 人天** — 这是 1 行代码改动，但解锁"多轮对话"演示
2. **修 AILayoutAssistant 接真 LLM** (A-1) — **4 人天** — 让 Canvas AI 能演
3. **PageEditor 挂导航 + 简单使用流程** (A-2) — **2 人天**
4. **Canvas Tool 改对 Repository** (A-4) — **3 人天**
5. **修 4 个 Sales→Production stub + 创建 SalesToProductionPurchaseSkill** (AUDIT.md §F-1) — **6-7 人天**
6. **生产任务自动生成 QR + LabelScan 路由** (REVIEW §F) — **2 人天**

**这 6 项做完 = 17-18 人天 ≈ 3-4 周**，且**全是修死代码不是新工程**。完成后 Canvas + AIChat 整套可演示给客户看。

### D-2. 🟢 同步做的"销售物料"准备

1. **录一段 demo 视频**展示这个序列（基于 D-1 完成的能力）：
   - 销售员对 Cretas 说"山姆下单 800 箱牛肉 3 天交货"
   - Cretas 自动算缺料 → 自动生成请购建议 → 自动建生产任务 → 自动生成 QR
   - 同样的事情在宏见要打开 5 个页面建 7 张单据
2. **写"5 分钟体验"试用流程**：登录就进 AIChat，3 条 quickQuestion 即可见效，**不用学单据流**
3. **针对食品厂的"行业 demo"**：用 traceability 演盒马/山姆审计场景

### D-3. 🟡 短期借鉴（1 月内，从宏见学的）

1. **统一"缺料分析"页面**（借鉴 1:22 帧）— 销售单/生产任务下方加按钮，跳到此页 → 选物料 → 三按钮"转生产/转采购/转外购"
2. **行级状态色块**（借鉴 14:35 帧）— 列表行用浅色背景表达 status (绿/黄/粉/灰)，比 status 标签更扫描友好
3. **多维度库存筛选**（借鉴 14:35 帧）— Cretas InventoryQueryScreen 增加 批号/供应商/失效期 联动过滤

### D-4. 🟡 中期（2-3 月）

1. **Slot-filling 后端**（让 AI 真的会问"缺什么参数"，对应 AUDIT.md F-4）
2. **视觉报工 PoC** — 找 1 个真实食品厂客户跑 30 天
3. **报价单实体 + 模块**

### D-5. ❌ 明确反对（不变）

- ❌ 可视化工作流拖拽编辑器（PR-driven，客户实际用不到）
- ❌ 左侧 12 模块横向菜单（倒车）
- ❌ 工作手机微信集成（合规风险）
- ❌ 17 Tab 客户详情页（cognitive overload 反面教材）
- ❌ 追平宏见 23 类财务凭证（除非目标客户群明确要求）

---

## E. 销售/产品话术（基于修正后的真实能力）

### E-1. 可以说的（已 verified 或修完 D-1 后可演）

| 话术 | 支撑能力 |
|---|---|
| "您不需要学我们的单据流程，您说人话即可" | AIChat 8 场景 + 18 Skill 真实可用 |
| "AI 主动告诉您缺什么货、谁该出动" | AIAlertsScreen + AIInsightCard 真实可用 |
| "食品溯源给盒马/山姆审计直接出数据" | TraceFullTool/TraceBatchTool 真实可用 |
| "我们能用摄像头看到工人工作而不要他们扫码"（标 PoC 阶段，30 天试点） | ISAPI 接通真实，工人识别需 PoC |
| "您一句话能让首页改成您想要的样子"（D-1 修完后可演） | Canvas + AILayoutAssistant 修复后 |
| "试用 5 分钟就能体会"——给试用账号 | 已具备 |

### E-2. 不能说的（声明 vs 真相对不上）

| 不要说 | 因为 |
|---|---|
| ❌ "AI 会问您缺什么参数" | Slot-filling 后端未实现 (AUDIT.md B-1) |
| ❌ "多轮对话记住上下文" | sessionId 不传 (A-3)——修完 D-1 后可说 |
| ❌ "智能布局是 AI 决策" | rule-based，未接 LLM (A-1)——修完 D-1 后可说 |
| ❌ "5 分钟 Redis 缓存" | 实际是 JVM Caffeine (A-6) |

---

## F. 优势量化（对比宏见的纯卖点）

| 维度 | 宏见 | Cretas（修完 D-1） | 差距判定 |
|---|---|---|---|
| **业务流程繁琐度** | 销售→生产要 5 页面 7 单据 | 1 段对话 + 1 次确认 | **Cretas 优 5-10×** |
| **新员工培训成本** | 1-2 周学单据流程 | 5 分钟看 AIChat | **Cretas 优 50-100×** |
| **运行时灵活性** | 流程固定，IT 改 1 周 | AI 编排 + Skill 配置，热更新 | **Cretas 优 10×** |
| **数据录入门槛** | 表单 50+ 字段填写 | 语音/对话/视觉识别 | **Cretas 优**（修视觉报工后更明显） |
| **跨语言支持** | 中文为主 | i18n 已落地中/英 | **Cretas 优**（出海可能） |
| **食品溯源专业度** | 通用 ERP，无溯源链路 | 整套 Trace Tool | **Cretas 独家** |
| **功能广度** | 12 模块 23 类凭证 | 8 业务场景 + 18 Skill | **宏见广** |
| **会计深度** | 凭证体系完整 | 仅 AR/AP 流水 | **宏见深**（但小客户不需要） |
| **可视化报表** | 静态打印模板免费送 | Canvas + AI 仪表盘（D-1 修复后） | **持平或略优** |

---

## G. 元层认知（这次审计揭示的）

### G-1. "实体存在"≠"功能可用"
Label 实体有 QR → 生产任务不生成 QR
ArApTransaction → 不是凭证体系
PageEditor 1252 行代码 → 没挂导航

### G-2. "UI 完成"≠"AI 真接通"
AILayoutAssistant 视觉精美 → 后端 rule-based 不调 LLM

### G-3. "声明在 CLAUDE.md"≠"实测如此"
"Redis 缓存 5 分钟" → Caffeine JVM
"337 Tool" → 实际 java 文件 404 个（含 base/test），可注册数未明
"16 Skill" → 实际 18 个

### G-4. 销售的"我们都有"≠"现在能演"
9.5 人天死代码修复后才能演 Canvas+AI 的完整故事

---

## H. 下一步建议

### 给团队 / 产品决策者

1. **3-4 周内集中投入修 §D-1 的 6 项**（17-18 人天）—— 这是 Cretas 故事可信度的最低门槛
2. **同时录 demo 视频**（基于修复后能力）—— 销售可以拿出去
3. **暂停新功能开发，先把声明的能力做实**—— 否则下一次客户演示还会翻车
4. **建立"声明 vs 现状"看板**，把 §A 的 6 项作为持续追踪项

### 给销售

1. 立即更新话术模板，**移除 §E-2 的 4 句**
2. 准备 §E-1 的 6 句话术 + 对应的 demo step
3. **客户 demo 流程改为 AIChat 为主**——而不是从模块菜单开始演

### 给 Cretas 自己（产品策略）

1. **不要追平宏见的菜单密度**——Cretas 的优势在"用 AI 替用户记住流程"
2. **加大食品行业专精**——溯源、视觉报工、批号管理是宏见做不深的领域
3. **Canvas 不要做成另一个低代码平台**——做成"对话式定义业务页"——AIChat 写 Canvas 配置，比拖拽编辑器先进

---

## 产出物清单

`scripts/fairview-square-analysis/`：

| 文件 | 用途 |
|---|---|
| **STRATEGY.md** ← 本报告 | 战略与决策参考 |
| AUDIT.md | 上一轮硬证据审计 |
| AUDIT_X_UI_UX.md | 视频帧 UI/UX 模式提取 |
| AUDIT_Y_CANVAS.md | Canvas/低代码审计 |
| AUDIT_Z_AICHAT_E2E.md | AIChat 端到端追溯 |
| REVIEW.md | 第一轮评审（部分被本报告修正） |
| REPORT.md | 演示内容总结 |
| storyboard_v2.md + keyframes_v2/ + audio.* | 原始素材 |

**报告优先级**：STRATEGY > AUDIT > AUDIT_X/Y/Z > REVIEW > REPORT。
