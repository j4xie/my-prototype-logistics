# Cretas 食品溯源系统 — 前端/业务/用户体验 三维优化方案

> 生成日期: 2026-02-12
> 研究主题: 基于行业对标评估，制定前端、业务、用户体验优化方案
> 方法论: Agent Team Full Mode (3研究员并行 → 分析师 → 批评者 → 整合者)
> 关键约束: **单人开发者**，原型 Demo 阶段，非大规模上线

---

## 执行摘要

Steve 应在未来 3 周（~82 小时）内完成 15 项高 ROI 优化，跳过分析师建议的 60% 基础设施重写（EPCIS 合规、LangGraph 迁移、数据仓库），聚焦于投资人可直接感知的 quick wins：null bug 修复、KeepAlive 状态保持、demo 数据预填充、ElTour 演示引导、图表骨架加载、KPI 渲染优化。预期评分从 4.13 提升至 4.35/5.0。

---

## 最终优先级列表（15项，按 ROI 排序）

### P0: Day 1-2 必修 Bug（3.5h）

| # | 任务 | 工时 | Demo 价值 | 维度 | 核心文件 |
|---|------|:---:|:---:|------|------|
| 1 | **Upload Selector null bug** — `null (11 Sheets)` → 文件名+日期 | 1h | ★★★★★ | 前端 | `SmartBIAnalysis.vue` L18 |
| 2 | **Console.log 清理** — 40处 debug 语句 | 0.5h | ★★★★ | 前端 | `smartbi.ts`, `SmartBIAnalysis.vue` |
| 3 | **KeepAlive 加 AppLayout** — Tab/路由切换不丢 ECharts 状态 | 2h | ★★★★ | 前端 | `AppSidebar.vue`, `router/index.ts` |

### P1: Day 3-5 Demo 准备（26h）

| # | 任务 | 工时 | Demo 价值 | 维度 | 核心文件 |
|---|------|:---:|:---:|------|------|
| 4 | **Demo 数据预填充** — 零等待冷启动 | 4h | ★★★★★ | UX | `SmartBIAnalysis.vue`, 缓存机制 |
| 5 | **ElTour 演示引导** — 投资人 3-5 分钟看懂产品 | 8h | ★★★★★ | UX | `SmartBIAnalysis.vue`, 新增引导组件 |
| 6 | **ECharts 按需引入** — 首屏 -500KB | 2h | ★★★ | 前端 | chart components, `main.ts` |
| 7 | **SmartBIAnalysis 拆分 P1** — 3952 行单体组件提取子组件 | 12h | ★★★★ | 前端 | 新增 `ChartDashboard.vue`, `KPISummary.vue` |

### P2: Week 2 UX 打磨（25h）

| # | 任务 | 工时 | Demo 价值 | 维度 | 核心文件 |
|---|------|:---:|:---:|------|------|
| 8 | **KPI 空值安全 + benchmark** — 缺数据时不崩溃 | 3h | ★★★ | 前端 | `KPICard.vue`, `smartbi.ts` |
| 9 | **移动端零状态 UI** — 空列表 → 引导卡片 | 8h | ★★★★ | UX | 各角色 HomeScreen (8个) |
| 10 | **图表骨架加载** — Spinner → 脉冲占位符 | 4h | ★★★ | 前端 | 新增 `ChartSkeleton.vue` |
| 11 | **后端健康检查 + Python 降级** — 静默容错 | 6h | ★★★★ | 业务 | `PythonSmartBIClient.java` |
| 12 | **AI 分析 prompt 质量调优** — 洞察更专业 | 4h | ★★★★ | 业务 | `insight_generator.py` |

### P3: Week 3 完善度（16h）

| # | 任务 | 工时 | Demo 价值 | 维度 | 核心文件 |
|---|------|:---:|:---:|------|------|
| 13 | **错误消息人性化 + 重试** — 422/500 → 中文引导 | 6h | ★★★ | UX | `smartbi.ts`, `AIQuery.vue` |
| 14 | **图表标题/KPI 名称智能化** — 去除 `_2` 后缀 | 4h | ★★★ | UX | `smartbi.ts:humanizeColumnName()` |
| 15 | **Demo 预设场景 + 视频循环** — 可复现的投资人展示 | 6h | ★★★★ | UX | 新增 `demo-config.json` |

**总计: ~82 小时 ≈ 15 工作日（3 周 @ 25h/周）**

---

## 周级实施计划

### Week 1: Quick Wins + Demo 核心（~27h）

| 天 | 任务 | 产出 |
|----|------|------|
| Mon | P0 全部: null bug + console 清理 + KeepAlive | 消除"粗糙感" |
| Tue | Demo 预填充 (4h) + ElTour 开始 (4h) | 零等待冷启动 |
| Wed | ElTour 完成 (4h) + ECharts 按需引入 (2h) | 投资人看得懂 |
| Thu-Fri | SmartBIAnalysis 拆分 Phase 1 (12h) | 代码可维护性 |

**Week 1 验收**: 投资人可在 3 分钟内完成 SmartBI 全流程 demo，Tab 切换不丢状态

### Week 2: UX 打磨 + 后端稳定（~25h）

| 天 | 任务 | 产出 |
|----|------|------|
| Mon | KPI 空值安全 (3h) + 移动端零状态开始 (5h) | 无崩溃 |
| Tue | 移动端零状态完成 (3h) + 图表骨架 (4h) | 加载体感提升 |
| Wed | 后端健康检查 + Python 降级 (6h) | 稳定性 |
| Thu | AI prompt 质量调优 (4h) | 分析更专业 |

**Week 2 验收**: 全 8 角色移动端无空白页，SmartBI 图表有骨架加载动画

### Week 3: 完善 + Demo Ready（~16h）

| 天 | 任务 | 产出 |
|----|------|------|
| Mon | 错误消息人性化 (6h) | 用户友好 |
| Tue | 标题/KPI 智能化 (4h) | 数据可读性 |
| Wed | Demo 预设场景 (6h) | 可复现展示 |
| Thu-Fri | 全量冒烟测试 + 部署远程服务器 | 上线就绪 |

**Week 3 验收**: 完整 demo 视频录制，远程服务器可访问

---

## 明确不做的事项

| 分析师建议 | 决定 | 理由 |
|-----------|------|------|
| S3: EPCIS 2.0 合规 | **❌ 砍掉** | 投资人不看合规细节，用 PPT 架构图替代 |
| S3: GB/T 46453 数字标签 | **❌ 砍掉** | 2027 年才强制，非 MVP 必需 |
| S3: 金蝶 K/3 ERP 对接 | **❌ 砍掉** | 需要金蝶测试环境，单人开发者无法谈判 |
| S4: LangGraph 替换 AI 链路 | **❌ 砍掉** | 现有 4000 行 Java AI 链路稳定运行，替换风险极高 |
| S4: 数据仓库 DWH + Redis | **❌ 砍掉** | PostgreSQL 够用，不为 demo 引入新基础设施 |
| S4: Dashboard 后端持久化 | **❌ 延后** | localStorage 对 demo 足够 |
| IoT + 区块链 | **❌ 远期** | 需要硬件设备和联盟链基础设施 |
| 数字孪生 | **❌ 远期** | 20+ 周工作量，非原型阶段任务 |

---

## 成功指标（3 周后）

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|--------|--------|----------|
| Upload Selector 显示 | `null (11 Sheets)` | 文件名 + 日期 | 视觉检查 |
| SmartBI Demo 全流程时间 | 4min (手动上传+等待) | <3min (预填充+引导) | 录屏计时 |
| Tab 切换状态保持 | 丢失 (ECharts 重建) | 保持 (KeepAlive) | 切换测试 |
| 首屏加载 | ~2.1s (ECharts 全量) | ~1.2s (按需引入) | Lighthouse |
| Console debug 输出 | 40+ 条 | 0 条 | F12 检查 |
| 空状态页面 | 全零/空白 | 引导卡片 | 8 角色遍历 |

---

## 一句话结论

**砍掉 60% 的基础设施重写，用 82 小时聚焦 15 项 quick wins（null 修复 → KeepAlive → demo 预填充 → ElTour 引导 → 骨架加载 → AI prompt 调优），3 周内将投资人 demo 评分从 4.13 提升至 4.35。**

---

## 研究过程

### Process Note
- Mode: Full
- Researchers deployed: 3 (前端技术 / 业务逻辑 / 用户体验)
- Total sources found: 30+
- Key disagreements: 2 resolved (资源估算: 5人→1人, 合规优先级: P0→砍掉)
- Phases completed: Research → Analysis → Critique → Integration

### 研究员发现汇总
- **R1 前端**: 8 findings — Vue 3 KeepAlive, ECharts WebGL, Element Plus KPI, RN FlashList, 渐进式加载
- **R2 业务**: 8 findings — GS1 EPCIS, GB标准, 金蝶ERP, LangGraph, SmartBI竞品, IoT区块链
- **R3 UX**: 8 findings — 零状态设计, 标题简化, 渐进披露, 错误消息, 入门教程, 移动端优化

### 分析师 vs 批评者关键分歧

| 议题 | 分析师 | 批评者 | 最终决定 |
|------|--------|--------|----------|
| 总工时 | 40 人周 (5人×8周) | 15 工作日 (1人×3周) | **采纳批评者** |
| S1 评分提升 | +0.23 | +0.10~0.15 | **+0.15 (折中)** |
| S3 合规标准 | P0 优先级 | 完全砍掉 | **砍掉，PPT 替代** |
| S4 LangGraph | 渐进替换 | 绝对不碰 | **不碰，保持现有** |
| 低挂果实 | 未提及 | 6 项 (<20h) | **全部纳入 P0-P1** |

---

*报告由 Agent Team 5 阶段工作流生成*
