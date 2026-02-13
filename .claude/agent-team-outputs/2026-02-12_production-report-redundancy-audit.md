# 模块化生产报工系统 — 冗余风险评估报告

**日期**: 2026-02-12
**Mode**: Full (3 Researchers + Analyst + Critic + Integrator)

---

## Executive Summary

三个团队的分析表明原方案过度设计（14个新文件，2500行代码）。共识：复用已有控制器、表单框架、SmartBI管道。核心分歧：ProcessingController膨胀问题（Critic建议拆分WorkReportingController，置信度95%）和JSONB替代结构化表问题（Critic指出数据建模错误，置信度98%）。推荐折中方案：~14个文件（含新建+修改）+ 结构化表（production_reports）+ 独立控制器 + 动态表单复用。

---

## Consensus (所有Agent一致同意)

| 组件 | 结论 |
|------|------|
| batch_work_sessions复用签到 | 加`checkin_method`列即可，不新建worker_checkins表 |
| Formily DynamicForm复用 | 不新建DynamicFormRenderer，已覆盖99% |
| SmartBI管道完全复用 | enrichment流程零修改 |
| IntentKnowledgeBase补充 | +3-4条映射即可 |
| PhotoEvidenceCapture/draftReportStore/fieldVisibilityStore | 全部直接复用 |

## Key Disagreements & Resolutions

### 1. ProcessingController合并 → **拒绝** (95%)
- 已1084行+10个依赖，继续塞代码是反模式
- **决定**: 新建 `WorkReportingController` (~250行)

### 2. customFields JSONB替代结构化表 → **拒绝** (98%)
- 查询/聚合/类型安全全面受损
- **决定**: 保留独立 `production_reports` 表（结构化列+JSONB扩展）

### 3. ScanReportScreen多模式合并 → **拒绝** (85%)
- 条件分支膨胀，维护困难
- **决定**: 提取 `useReportWorkflow` hook + 新建 `DynamicReportScreen`

### 4. 单张审计表覆盖全工作流 → **拒绝** (92%)
- 审计追踪 ≠ 业务查询
- **决定**: production_reports(业务) + 现有审计机制

### 5. form_templates加列 → **拒绝** (65%)
- 语义污染
- **决定**: 用 `entityType` 枚举机制区分

### 6. batch_work_sessions复用 → **有条件同意** (70%)
- 需确认batch_id是否可为空

## Revised File List

### 后端 (Java) — 新建
| 文件 | 行数 | 说明 |
|------|------|------|
| WorkReportingController.java | 250 | 签到+报工+查询+审批 |
| WorkReportingServiceImpl.java | 180 | 业务逻辑 |
| WorkReportIntentHandler.java | 100 | AI意图处理 |
| ProductionReport.java (entity) | 80 | JPA实体 |
| ProductionReportRepository.java | 60 | 含聚合查询 |
| WorkReportDTO.java | 90 | 请求+响应DTO |
| migration_production_reports.sql | 40 | 表定义+ALTER |

### 后端 (Java) — 修改
| 文件 | 改动 |
|------|------|
| IntentKnowledgeBase.java | +30行 |
| IntentExecutorServiceImpl.java | +5行 |
| BatchWorkSession.java | +checkinMethod字段 |

### 前端 (RN) — 新建
| 文件 | 行数 | 说明 |
|------|------|------|
| DynamicReportScreen.tsx | 150 | 统一动态报工屏幕 |
| useReportWorkflow.ts | 80 | 工作流逻辑hook |
| workReporting.ts (types) | 60 | TypeScript类型 |
| workReportingApiClient.ts | 50 | API客户端 |

### 前端 (RN) — 修改
| 文件 | 改动 |
|------|------|
| WSHomeStackNavigator.tsx | +3个路由 |
| WSHomeScreen.tsx | +3个快捷入口 |
| navigation.ts | +类型定义 |

### Python — 新建
| 文件 | 行数 | 说明 |
|------|------|------|
| production_report_analytics.py | 80 | 报工数据统计路由 |

## Quantitative Comparison

| 指标 | 原方案 | 优化方案 | 节省 |
|------|--------|---------|------|
| 新建文件 | 14 | 12 (8 Java + 4 RN) | -14% |
| 新建数据库表 | 3张(~45列) | 1张(~12列) + 1列ALTER | -73%列数 |
| 新增代码行 | ~2500 | ~1220 | -51% |
| 修改文件 | 8 | 6 | -25% |

## Open Questions
1. batch_id在签到阶段是否可为空？
2. 报工审批流程（1级还是多级）？
3. 历史报工修改策略（覆盖/版本）？
4. 员工数据隔离（行级权限）？

## Confidence Levels
| 组件 | 置信度 |
|------|--------|
| 新建WorkReportingController | 95% |
| 保留production_reports结构化表 | 98% |
| useReportWorkflow hook | 85% |
| batch_work_sessions复用 | 70% |
| SmartBI管道复用 | 90% |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 20+
- Key disagreements: 6 identified, 6 resolved
- Phases completed: Research → Analysis → Critique → Integration
