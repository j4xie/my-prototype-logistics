# UX_AUDIT_B_CRETAS — Cretas Frontend UI/UX 设计语言盘点

> **目的**: 配对 Audit A (宏见 ERP 视频 137 帧), 盘点 Cretas 当前 React Native 前端**已有的 UI 基础设施**, 用 8 节对应 Audit A 的 8 类视觉/交互结构, 让我们知道**新空白** vs **复用空间**。
>
> **方法**: 遍历 `frontend/CretasFoodTrace/src/` (theme/components/screens/navigation), 每条主张引用 `file:line` 证据 + Verdict (✅ 已有 / 🟡 部分有 / ❌ 完全无)。
>
> **结论先行**: Cretas 已是一套**"原生 + 移动优先 + 角色化 + AI 嵌入"**的设计语言, 但 Audit A 暴露的"密集表格 + 工序流转 sidepanel + 浮动 action drawer + 17-tab 子页 + 行级 RED 警告"等**桌面/密集**模式**几乎全无**。Cretas 长在"卡片 + Tab 底栏 + Bento 拖拽 + 语音 AI", 短在"密集列表 + 矩阵权限 + 多级流程图"。

---

## §1. Cretas 当前视觉语言

| 项目 | 值 | 证据 |
|------|-----|------|
| 主色 (primary) | `#1890FF` (iOS Blue) | `src/theme/index.ts:6` |
| 辅色 (secondary) | `#5856D6` (iOS Indigo) | `theme/index.ts:7` |
| 强调色 (accent / tertiary) | `#FF2D55` (iOS Pink) | `theme/index.ts:8` |
| 成功 / 警告 / 错误 / 信息 | `#34C759` / `#FFCC00` / `#FF3B30` / `#007AFF` (iOS 全套) | `theme/index.ts:21-24` |
| 文字层级 | `#1F2937` (Gray-900) / `#6B7280` (Gray-500) / `#9CA3AF` (Gray-400) | `theme/index.ts:16-18` |
| 字号 | NeoButton: small 13 / medium 15 / large 17 (iOS 标准) | `components/ui/NeoButton.tsx:54-59` |
| 间距系统 | xs 4 / s 8 / m 12 / l 16 / xl 24 / xxl 32 / section 40 | `theme/index.ts:87-94` |
| 圆角系统 | xs 4 / s 8 (按钮) / m 12 (卡片) / l 16 (大卡片) / round 999 (徽章) | `theme/index.ts:95-102` |
| 阴影 | small/medium/large 三档 iOS soft shadow + Android elevation | `theme/index.ts:104-144` |
| 主题文件 | 集中在 `src/theme/index.ts` (单文件) + `theme.d.ts` 扩展类型 | - |
| UI 库 | React Native Paper (MD3LightTheme 扩展) + 自定义 Neo 组件 | `theme/index.ts:1`, `components/ui/NeoCard.tsx:3` |
| 自定义组件 | `NeoButton` (5 variant)、`NeoCard` (3 variant)、`StatusBadge` (5 variant)、`ScreenWrapper` | `components/ui/index.ts` |

**Verdict**: ✅ 已有 — Cretas 是**"Neo Minimal iOS Style"** 设计令牌系统 (theme/index.ts:4 注释), tokens 完整 (颜色 / 间距 / 圆角 / 阴影 / 字号 全套), Light theme only (无 dark mode)。

**与 Audit A 对比**: 宏见用**白底 + 灰文字 + 蓝/绿/红/粉 多色斑块** (frame:000003 KPI 卡片), Cretas 调色板**更现代**, 但 Audit A 的"全表 pink 行底色"(frame:000116)、"RED 字体行警告"(frame:001353)、"绿/粉/蓝色节点分类"(frame:001333) 是**视觉级别警告语言**, Cretas 目前只有 StatusBadge **块级**徽章 (`StatusBadge.tsx:13-20`) 没有**行级背景着色**, 这是个**新空白**。

---

## §2. Cretas 信息架构

| 元素 | 现状 | 证据 |
|------|------|------|
| 顶层导航 | Stack (Login → RoleBasedNavigator) | `navigation/AppNavigator.tsx:38,164` |
| 角色路由分离 | 10 个角色独立 Navigator (factory-admin / hr-admin / workshop-supervisor / warehouse-manager / dispatcher / quality-inspector / operator / sales-manager / procurement-manager / viewer) | `AppNavigator.tsx:84-131` |
| Tab 导航位置 | **底部 BottomTab** (createBottomTabNavigator) | `FactoryAdminTabNavigator.tsx:7,30-53` |
| Factory Admin Tab 数量 | **6 个 Tab** (首页 / AI分析 / 报表 / 智能分析 / 管理 / 我的) | `FactoryAdminTabNavigator.tsx:56-131` |
| Tab 动态显隐 | 基于 `useFactoryFeatureStore.isScreenEnabled()` (餐饮场景隐藏报表) | `FactoryAdminTabNavigator.tsx:33,82` |
| 各角色独立 Tab Navigator | WarehouseManager / WorkshopSupervisor / HR 各自 TabNavigator | `navigation/` 同名 *.tsx |
| Drawer 导航 | ❌ 无 (全 RN Paper Drawer, 仅 BottomSheet) | - |
| 面包屑 | ❌ 无 | - |
| Header | RN Paper `Appbar.Header` + `Appbar.BackAction` (列表页), 自定义彩色 header (FAHome/WHHome) | `SalesOrderListScreen.tsx:86-90`, `WHHomeScreen.tsx:478-493` |

**Verdict**: 🟡 部分有 — 角色路由分离 ✅ 完善, 6-Tab 底栏 ✅ 标准, 但**横向多 tab 累加** (Audit A frame:000133-001215 累计 16+ tab, 见 `AUDIT_X_UI_UX.md:18,49`) **完全无**, 也无**多级面包屑** (传统 Web ERP 常见)。Cretas 走**纯移动 Stack**, 无桌面"上下文持续保留"机制。

**关键差异**: 宏见的 17-tab 客户详情子页 (frame:001052) Cretas 无对应模式, 这是**密集功能聚合**典型空白。

---

## §3. Cretas 列表组件

| 元素 | 现状 | 证据 |
|------|------|------|
| 主要列表组件 | **ScrollView + map** 居多, **FlatList** 仅 11 处 | grep 全仓 |
| StatusBadge (块级状态徽章) | ✅ `components/ui/StatusBadge.tsx` 5 variant (success/warning/error/info/default) | `StatusBadge.tsx:5-20` |
| 行级背景色块 | 🟡 仅卡片头部 `statusBadge` 局部色块 (无整行底色) | `WHInboundListScreen.tsx:325-334` |
| 列表行布局 | Surface/Card 卡式: cardHeader(标号+状态) → infoRow×N (label-value) → cardFooter(时间+action) | `WHInboundListScreen.tsx:322-371`, `WHHomeScreen.tsx:404-446`, `SalesOrderListScreen.tsx:55-81` |
| 进度条 | `ProgressBar` (react-native-paper) 用于 20 个 Reports / Processing 屏幕 | `ProductionReportScreen.tsx`, `MaterialBatchManagementScreen.tsx` |
| 排序交互 | ❌ 无统一 sort header 抽象 | - |
| 筛选交互 | Chip + SegmentedButtons (RN Paper) — 水平滚动 Chip 标签 + 三段切换 | `WHInboundListScreen.tsx:260-310`, `SalesOrderListScreen.tsx:93-103` |
| 搜索栏 | `Searchbar` (RN Paper) | `WHInboundListScreen.tsx:252-258` |
| BulkActionBar (批量操作栏) | ❌ **完全无** (全仓只有 ProductTypeSchemaConfigModal/ModulePropsEditor 用 `selectMode`, 非业务列表) | grep `BulkActionBar` = 0 matches |
| QuickActionsGrid | ✅ `components/common/QuickActionsGrid.tsx` 用户可配置快捷网格 + 首次使用 GuideBubble | `QuickActionsGrid.tsx:1-100` |
| 空状态 | ✅ `EmptyStateCard` 图标 + 标题 + 描述 + 引导按钮 | `components/common/EmptyStateCard.tsx:1-93` |

**Verdict**: 🟡 部分有 — **卡片式列表**是 Cretas 主战场 (WHInbound/SalesOrder/WHHome 全一致 pattern), 但 Audit A 的"**密集 Web 表格 + 行级 RED 警告 + 浮动 multi-action drawer**" (frame:001353, 000607-000637) **完全无**。

**关键空白**:
- **行级全行背景色** (frame:000116 全表 pink 行底色) — Cretas 只有局部色块
- **BulkActionBar** — 0 业务实现
- **右侧悬浮多动作菜单** (8-10 项 hover 弹出, frame:000607) — Cretas 当前是**底部 fixed Button** 或**行末单一 chevron**
- **密集 11-17 列宽表 + 底部汇总行** (frame:000336-000359, 001215) — Cretas 全部是"label-value 竖向 infoRow"

---

## §4. Cretas 表单

| 元素 | 现状 | 证据 |
|------|------|------|
| 表单库 | **Formily** (`@formily/core` + `@formily/react`) + 4 处 `react-hook-form` 散用 | `formily/core/DynamicForm.tsx:11-12`, grep |
| DynamicForm | ✅ Schema-driven (FormSchema → SchemaField → FormItem) + Rule Hooks + AIAssistantButton | `formily/core/DynamicForm.tsx:73-90` |
| 注册组件 | Input / NumberInput / Select / Switch / DatePicker / FormItem (Formily x-component) | `formily/components/index.ts` |
| 业务 Schema | 5 个: materialBatch / purchaseOrder / qualityCheck / rawMaterialType / scaleConfiguration | `formily/schemas/index.ts` |
| 字段联动 | ✅ Formily `onFieldValueChange` + `x-reactions` + 服务端 RuleConfig (`useRuleHooks`) | `DynamicForm.tsx:17-19` |
| Sticky footer 实时汇总 | ❌ 无 (Audit A frame:000949 工资编辑右侧"汇总 ¥40000"实时汇总模式 — 缺) | - |
| 文件 / 拍照上传 | ✅ `expo-image-picker` + `PhotoEvidenceCapture` 组件 (8 处使用) | `components/processing/PhotoEvidenceCapture.tsx` |
| 验证错误提示 | ✅ `ValidationCorrectionModal` (AI 辅助纠错) | `components/form/ValidationCorrectionModal.tsx` |
| AI 表单助手 | ✅ `AIAssistantButton` 触发智能字段填充 | `formily/components/AIAssistantButton.tsx` |
| ClarificationDialog | ✅ AI 二次澄清弹窗 (多轮 slot filling) | `components/ai/ClarificationDialog.tsx` |
| MissingFieldsPrompt | ✅ AI 检测缺失字段并 inline 提示 | `components/ai/MissingFieldsPrompt.tsx`, `components/form/MissingFieldsPrompt.tsx` |

**Verdict**: ✅ 已有 — **AI-First 动态表单**是 Cretas 强项, Formily Schema + AI 字段填充 + Clarification 全栈完整, 比 Audit A 静态多列编辑表 (frame:000745) 智能得多。

**关键空白**: **Sticky 实时汇总 footer** (frame:000949 工资 / frame:001215 销售退货底部 ¥6525.30 总数 122) 在 Cretas 多步表单 (`ThreeStepReportScreen.tsx`) 中**没有抽象组件**, 需要新增。

---

## §5. Cretas 弹窗

| 元素 | 现状 | 证据 |
|------|------|------|
| Modal | RN Paper `Modal` + 自定义 Modal — 15+ 处使用 | grep |
| BottomSheet 抽象组件 | 🟡 `AddItemSheet` 是 FAHome 局部组件 (无全局抽象) | `screens/factory-admin/home/components/AddItemSheet.tsx` |
| Drawer (左/右侧抽屉) | ❌ 无 (无 react-navigation-drawer) | - |
| TemplateCommandSheet | ✅ AI Chat 命令模板浮层 | `components/ai/TemplateCommandSheet.tsx` |
| BarcodeScannerModal | ✅ 全屏 modal 扫描条码 | `components/processing/BarcodeScannerModal.tsx` |
| 弹窗内嵌 QR | ❌ 无 (Audit A frame:000809 行级图标点击展开 QR 浮层 — 缺) | - |
| ModulePropsEditor | ✅ Bento 模块配置弹窗 | `screens/factory-admin/home/components/ModulePropsEditor.tsx` |
| TutorialOverlay | ✅ 首次使用引导 spotlight | `components/common/TutorialOverlay.tsx` |

**Verdict**: 🟡 部分有 — Modal 散用, **没有抽象 `<Sheet>`/`<Drawer>`/`<Popover>` 统一组件**, BentoGrid 的 `AddItemSheet` 是孤岛实现, **需要通用 BottomSheet 组件**。Audit A 的"行内 QR 弹出"(frame:000809) Cretas 当前无。

---

## §6. Cretas 状态反馈

| 元素 | 现状 | 证据 |
|------|------|------|
| Loading 全屏 | `ActivityIndicator size="large"` + 文字 (统一 pattern) | `FAHomeScreen.tsx:242-251`, `WHInboundListScreen.tsx:198-210` |
| Skeleton 骨架屏 | ❌ **完全无** (grep `Skeleton` = 0 业务实现) | - |
| Shimmer | ❌ 无 | - |
| Toast | ❌ 无 (使用原生 `Alert.alert`, 14+ 处) | grep `Alert.alert` 全仓 |
| Snackbar | 🟡 仅 Formily `DynamicForm` 内部用 (`react-native-paper`) | `formily/core/DynamicForm.tsx:10` |
| Error Boundary | ❌ 无组件级 ErrorBoundary, 仅 `utils/errorHandler.ts` 全局 catch | `utils/errorHandler.ts` |
| EmptyStateCard | ✅ 通用空状态 (icon + title + 描述 + 引导按钮) | `EmptyStateCard.tsx` |
| OfflineIndicator | ✅ 网络离线红条提示 | `components/common/OfflineIndicator.tsx` |
| NotificationBadge | ✅ 数字徽章 | `components/common/NotificationBadge.tsx` |
| Error 弹窗 | 自定义 retry view (cloud-off icon + 错误 + 重试 btn) — 重复实现 4+ 处 | `WHHomeScreen.tsx:461-473`, `FAHomeScreen.tsx:255-269` |

**Verdict**: 🟡 部分有 — **Loading + Empty + Offline** 完整, 但 **Toast/Snackbar/Skeleton 缺失**, 全靠 `Alert.alert` 原生弹窗 (体验粗糙)。Audit A frame:001107 "出错 modal (红 X 图标 + 出现错误标题 + 红字说明 + 确认按钮)" Cretas 是用 `Alert.alert` 兜底, **没有定制 ErrorModal 组件**。

**关键空白**:
- **Skeleton 加载屏** — 0 业务实现 (全部用 ActivityIndicator)
- **Toast** — 0 抽象 (替代 Alert.alert)

---

## §7. Cretas 操作动线

| 元素 | 现状 | 证据 |
|------|------|------|
| 创建按钮位置 | **顶部 actionBar** (`actionBar` row 含"新建入库 + 扫码入库"两个 Button) | `WHInboundListScreen.tsx:230-249` |
| FAB (Floating Action Button) | 🟡 10 处使用 (MaterialTypeManagement/PurchaseOrderList/Wastage/Recipe/FAManagement/processing 等), 非统一抽象 | grep `FAB` |
| 返回模式 | RN Paper `Appbar.BackAction` 标准返回 | `SalesOrderListScreen.tsx:87` |
| 工作流 Stepper | 🟡 `ThreeStepReportScreen.tsx` 自实现 `step` state (1/2/3) + 顶部步骤指示器 | `ThreeStepReportScreen.tsx:38` |
| Timeline 时间线 | 🟡 仅出现在 service/processing api client 命名, **无 UI 抽象** | grep `Timeline` 主要在 api client |
| 工序流转可视化 | ❌ **完全无** (Audit A frame:000443 工作流配置 flowchart designer, frame:001333 销售流程 flowchart, frame:001736 采购流程 flowchart — 全部缺) | - |
| TaskGuide 流程引导 | 🟡 `TaskGuideScreen/Step2/Step3` 多步引导 | `screens/workshop-supervisor/home/TaskGuide*Screen.tsx` |
| WelcomeHeader | ✅ FAHome 主页欢迎卡片 + edit-layout 入口 | `screens/factory-admin/home/components/WelcomeHeader.tsx` |
| Cancel/Confirm 按钮 | DRAFT 状态 inline 2 按钮 (确认 + 取消) — `SalesOrderListScreen.tsx:73-78` | - |

**Verdict**: 🟡 部分有 — Stepper/TaskGuide 散布, **没有统一 Stepper/Timeline 组件**。**工序流转/审批流可视化** (Audit A 3 个 flowchart 帧, 见 `AUDIT_X_UI_UX.md:21,38,46`) Cretas **完全无**, 是关键空白 (因为 Cretas 是食品溯源系统, 工序流转/批次溯源**理应**有可视化, 但目前只有列表)。

---

## §8. Cretas 微交互

| 元素 | 现状 | 证据 |
|------|------|------|
| Long press | ✅ FAHome Bento 拖拽编辑入口 + AIInsightCard `onLongPress` | `FAHomeScreen.tsx:192,204`, `AIInsightCard.tsx:38` |
| Swipe | 🟡 SegmentedButtons 三段切换 (RN Paper 内置, 非自定义 swipe) | - |
| Pull-to-refresh | ✅ `RefreshControl` 全部列表页统一 | `FAHomeScreen.tsx:276-282`, `WHHomeScreen.tsx:498-503` |
| Haptic feedback | ❌ **完全无** (grep `Haptics` 仅 test setup) | - |
| Voice input | ✅ `VoiceMicButton` (脉冲动画 + 录音 + 语音识别) — AI Chat 默认大号居中麦克风 (P1 设计) | `components/common/VoiceMicButton.tsx:31-50`, `AIChatScreen.tsx:849-855,889-916` |
| Voice waveform | ✅ `components/voice/VoiceWaveform.tsx` | - |
| Voice 浮层 | ✅ `VoiceAssistantOverlay` + `VoiceChatBubble` | `components/voice/VoiceAssistantOverlay.tsx`, `VoiceChatBubble.tsx` |
| ShakingCard 编辑抖动 | ✅ FAHome 编辑模式所有模块抖动 (iOS 主屏 app 抖删 inspiration) | `screens/factory-admin/home/components/ShakingCard.tsx` |
| Bento Grid 拖拽 | ✅ `BentoGridEditor` `react-native-gesture-handler` + `react-native-reanimated` 拖拽排序 + 大小调整 (1x1/2x1/1x2/2x2) | `BentoGridEditor.tsx:16-22,56-63` |
| RichContentRenderer | ✅ 渲染 4 种结构: LIST (5 列限制移动端) / DETAIL / STATS / CONFIRM (PREVIEW 预览) — AI 回复结构化数据自动 detect | `components/ai/RichContentRenderer.tsx:11-77` |
| QuickActionCardGrid | ✅ AI Chat 场景化快捷问题卡片 | `components/ai/QuickActionCardGrid.tsx` |
| AIModeIndicator | ✅ 实时输入检测深/快模式 + small/medium variant | `components/ai/AIModeIndicator.tsx`, `AIChatScreen.tsx:838-844` |
| FeedbackWidget | ✅ AI 回答下方点赞/点踩反馈 + Food KB metadata | `components/ai/FeedbackWidget.tsx` |
| AI Chat UI | ✅ ScrollView 消息流 + KeyboardAvoidingView + LinearGradient send 按钮 + Voice-first 默认态 | `AIChatScreen.tsx:812-919` |
| AIInsightCard 首页推送 | ✅ FAHome 顶部 LinearGradient + 状态 badge (success/loading) + 指标 row | `FAHomeScreen.tsx:184-195`, `AIInsightCard.tsx:33-82` |
| 配额提示横幅 | ✅ AI Chat 顶部 quotaBanner | `AIChatScreen.tsx:802-809` |
| ClarificationDialog 富 | ✅ AI 多轮澄清, 含 IntentCandidateSelector | `components/ai/IntentCandidateSelector.tsx` |

**Verdict**: ✅ 已有 — **AI / 语音 / Bento 拖拽**是 Cretas 三大杀手锏, 比传统 ERP (Audit A) 现代得多。**Haptic 是唯一明显空白**。

**关键优势 vs Audit A**:
- **语音优先**: Cretas AI Chat 默认大号居中麦克风 (`AIChatScreen.tsx:889-916`), Audit A 全帧 0 语音输入
- **Bento Grid 拖拽编辑**: Cretas 首页用户可拖拽自定义 (`BentoGridEditor.tsx`), Audit A 是固定 dashboard
- **RichContentRenderer**: AI 回答自动渲染表/卡/统计 (`RichContentRenderer.tsx:26-58`), Audit A 是纯文字 + 静态报表
- **ShakingCard**: iOS 风格编辑抖动, Audit A 是右键菜单
- **AIInsight 首页主动推送**: Cretas FAHome 头部主动 AI 推荐 + 健康指标, Audit A 是被动查询

---

## 综合判定: Cretas 已有 vs Audit A 空白对照表

| 模式 | Cretas | Audit A (宏见) | 行动建议 |
|------|--------|---------------|---------|
| iOS 风格调色板 | ✅ 完整 | 🟡 多色斑块, 不一致 | 保留 Cretas |
| 行级全行背景色 (警告/状态) | ❌ 无 | ✅ pink/red 行底色 | **新增 RowBackgroundVariant** |
| 横向多 tab 累加 (16+) | ❌ 无 | ✅ 浏览器式 17-tab | **不抄** (移动端不适合) |
| FlatList + Card 列表 | ✅ 标准 | 🟡 wide table | 保留 Cretas |
| BulkActionBar | ❌ 无 | 🟡 有但视频未展开 | **新增** |
| 密集 11-17 列宽表 + footer 汇总 | ❌ 无 | ✅ 11-17 列宽表 | **不抄 + 用 RichContent 横向滚动表替代** |
| 浮动多 action drawer (8-10 项 hover 弹出) | ❌ 无 | ✅ 行末 hover | **移动端用 BottomSheet 长按弹出** |
| Formily AI-First 动态表单 | ✅ 完整 | ❌ 静态表单 | **Cretas 领先** |
| Sticky 实时汇总 footer | ❌ 无 | ✅ 工资/订单底部汇总 | **新增 StickyFooterSummary** |
| 工序/审批/采购 flowchart 可视化 | ❌ 无 | ✅ 3 帧 flowchart | **新增 WorkflowVisualizer** |
| QR 行内浮层 | ❌ 无 | ✅ frame:000809 | **新增 InlineQRPopover** |
| Skeleton 加载 | ❌ 无 | ❌ 无 | **新增 SkeletonScreen** |
| Toast 抽象 | ❌ 无 (用 Alert) | ❌ 无 | **新增 Toast (替代 Alert)** |
| 权限矩阵编辑器 (frame:001408,001639) | ❌ 无 | ✅ 大量复选框 | **新增 PermissionMatrix** (或保留管理用 Web) |
| Voice 优先输入 | ✅ AIChat 默认大麦克风 | ❌ 无 | **Cretas 领先** |
| Bento Grid 拖拽 | ✅ 完整 | ❌ 固定 dashboard | **Cretas 领先** |
| RichContentRenderer (AI 结构化回复) | ✅ 4 种 | ❌ 纯文字 | **Cretas 领先** |
| Haptic feedback | ❌ 无 | ❌ 无 | **新增 HapticManager** |

---

## 关键文件索引 (绝对路径)

**Theme / Design Tokens**:
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\theme\index.ts` (主题入口)

**通用 UI 组件**:
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ui\NeoCard.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ui\NeoButton.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ui\StatusBadge.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ui\ScreenWrapper.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\common\EmptyStateCard.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\common\QuickActionsGrid.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\common\VoiceMicButton.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\common\OfflineIndicator.tsx`

**AI 相关**:
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\ai-analysis\AIChatScreen.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ai\RichContentRenderer.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ai\AIModeIndicator.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ai\FeedbackWidget.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ai\ClarificationDialog.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\ai\QuickActionCardGrid.tsx`

**Navigator**:
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\navigation\AppNavigator.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\navigation\FactoryAdminTabNavigator.tsx`

**Home / Bento Grid 编辑**:
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\FAHomeScreen.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\HomeLayoutEditorScreen.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\components\BentoGridEditor.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\components\AIInsightCard.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\home\components\ShakingCard.tsx`

**列表页 (典型 pattern)**:
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\warehouse\home\WHHomeScreen.tsx` (Surface Card + SegmentedButtons + Stats grid)
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\warehouse\inbound\WHInboundListScreen.tsx` (Header + actionBar + Searchbar + Chip filter + Card list + 底部 stats)
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\factory-admin\inventory\SalesOrderListScreen.tsx` (FlatList + Card + 状态 Chip + DRAFT 行内 actions)
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\screens\processing\ThreeStepReportScreen.tsx` (Stepper 1-2-3 自实现)

**Formily 动态表单**:
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\formily\core\DynamicForm.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\formily\components\AIAssistantButton.tsx`

**SmartBI / 图表**:
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\smartbi\KPICardGrid.tsx`
- `C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\src\components\charts\` (GaugeChart, HeatmapChart, WaterfallChart)

---

## 结论 (一句话)

**Cretas 是"AI + 语音 + Bento + 移动卡片"现代 ERP, 而 Audit A 是"密集 Web 表格 + 流程图 + 浮动菜单 + 权限矩阵"传统 ERP** — 两者**互补**, 不冲突。Cretas 需要补的是: ① 行级状态色块, ② BulkAction/StickyFooter/Skeleton/Toast 抽象, ③ Workflow flowchart 可视化, ④ Haptic feedback。不需要抄的是: 17-tab 累加 / 11-17 列宽表 / 桌面菜单。
