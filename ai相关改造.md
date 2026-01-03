# 意图识别增强方案 V2 评估报告

## 一、方案概述

用户方案文档: `/Users/jietaoxie/my-prototype-logistics/intent-recognition-enhancement-plan-v2.md`

核心目标:
1. 确认策略优化 - 不是每次都确认，而是基于置信度决策
2. 澄清问题设计 - 候选意图选择，不是简单问"对不对"
3. 完整记录日志 - 支持错误归因和规则优化
4. LLM Fallback - 规则匹配失败后的智能兜底
5. LangChain集成 - 支持复杂多轮对话和工具调用

---

## 二、当前代码现状分析

### 2.1 Java 后端意图识别系统

| 功能 | 现状 | 评估 |
|------|------|------|
| **意图配置表** | ✅ 完整 | AIIntentConfig Entity + SQL迁移 |
| **两层匹配逻辑** | ✅ 已实现 | 正则优先 + 关键词评分 |
| **置信度计算** | ✅ 已完成 | IntentMatchResult DTO + 强/弱信号判断 |
| **LLM Fallback** | ✅ 已完成 | LlmIntentFallbackClient + Python端点集成 |
| **意图匹配记录** | ✅ 已完成 | intent_match_records表 + Entity + Repository |
| **澄清机制** | ⚠️ 部分 | confirm端点标记TODO |
| **处理器** | ⚠️ 部分 | 只有DATA_OP和FORM处理器 |

**关键文件**:
- `/backend-java/src/main/java/com/cretas/aims/entity/config/AIIntentConfig.java`
- `/backend-java/src/main/java/com/cretas/aims/service/impl/AIIntentServiceImpl.java`
- `/backend-java/src/main/java/com/cretas/aims/service/impl/IntentExecutorServiceImpl.java`
- `/backend-java/src/main/java/com/cretas/aims/controller/AIIntentConfigController.java`

### 2.2 Python AI 服务现状

| 功能 | 现状 | 评估 |
|------|------|------|
| **Qwen调用封装** | ✅ 完整 | 支持思考模式、流式返回 |
| **端点数量** | ✅ 23个 | 覆盖分析、表单、调度等 |
| **Session管理** | ⚠️ 基础 | 只返回session_id，无历史管理 |
| **工具定义** | ❌ 缺失 | 无标准化Tool格式 |
| **Agent能力** | ❌ 缺失 | 无自动工具调用循环 |
| **对话历史** | ❌ 缺失 | 无多轮对话上下文管理 |

**关键文件**:
- `/backend-java/backend-ai-chat/scripts/main.py` (2569行)
- `/backend-java/backend-ai-chat/requirements.txt`

---

## 三、方案可行性评估

### 3.1 各阶段难度评估

| Phase | 方案描述 | 工作量 | 依赖 |
|-------|---------|--------|------|
| **Phase 1** | 基础确认机制 | 2周 | 无 |
| **Phase 2** | 智能确认策略 | 1周 | Phase 1 |
| **Phase 3** | Fallback和学习机制 | 2周 | Phase 1-2 |
| **Phase 4** | 规则优化系统 | 3周 | Phase 1-3 |
| **LangChain** | 复杂多轮对话 | 4-6周 | 可独立 |

### 3.2 各功能实现差距

#### 确认策略优化 (Phase 1-2)
```
现状: recognizeIntent() 只返回 Optional<AIIntentConfig>
差距:
  - 缺少 IntentMatchResult DTO (含 topCandidates, confidence, matchMethod)
  - 缺少强信号/弱信号判断逻辑
  - 缺少候选意图选择的前端交互
改动量: 中等 (约500行Java代码)
```

#### 意图匹配记录 (Phase 1)
```
现状: 无独立记录表，仅ai_audit_logs
差距:
  - 需创建 intent_match_records 表 (40+字段)
  - 需创建 error_attribution_statistics 表
  - 需在 AIIntentService 中埋点记录
改动量: 中等 (SQL迁移 + 200行Java)
```

#### LLM Fallback (Phase 2)
```
现状: 硬编码 return "followup"
差距:
  - 需调用 Python AI 服务 /api/ai/intent/classify 端点
  - 需实现 LLM 意图重路由逻辑
  - 需处理用户否认后的澄清问题
改动量: 中等 (Python端点 + Java调用 ~400行)
```

#### 澄清机制 (Phase 2)
```
现状: confirm 端点返回 "暂未实现"
差距:
  - 需实现预览数据的 Redis 缓存
  - 需实现 confirmToken 生成和校验
  - 需设计澄清问题格式规范
改动量: 中等 (~300行Java)
```

### 3.3 LangChain 集成评估

**可行性评分: 7/10**

| 维度 | 评分 | 说明 |
|------|------|------|
| 技术兼容性 | 9/10 | Qwen 兼容 OpenAI 格式，LangChain 原生支持 |
| 开发工作量 | 6/10 | 需 4-6 周，工具系统最复杂 |
| 迁移风险 | 7/10 | 可渐进式迁移，不破坏现有功能 |
| 团队学习曲线 | 6/10 | 需学习 Agent/Tool 概念 |

**建议**:
- Phase 1-3 优先用简单 Qwen API (满足80%需求)
- Phase 4 后按需引入 LangChain

---

## 四、推荐实施计划

### 阶段 A: 核心增强 (3周) - 优先实施

#### A1. 置信度返回 (3天)
修改文件:
- `AIIntentServiceImpl.java` - 添加 IntentMatchResult DTO
- `AIIntentController.java` - 修改响应格式

核心改动:
```java
// 新增 DTO
class IntentMatchResult {
    AIIntentConfig config;
    List<CandidateIntent> topCandidates;  // Top-N
    double confidence;  // 0-1
    String matchMethod;  // KEYWORD/REGEX
    List<String> matchedKeywords;
    boolean isStrongSignal;
}
```

#### A2. 意图匹配记录表 (3天)
新增文件:
- `V2026_01_03_1__intent_match_records.sql`
- `IntentMatchRecord.java` (Entity)
- `IntentMatchRecordRepository.java`

关键字段 (参考方案5.1节):
- user_input, matched_intent_code, confidence_score
- top_candidates (JSON), clarification_question
- llm_called, execution_status, error_attribution

#### A3. LLM Fallback 端点 (4天)
Python端新增:
- `/api/ai/intent/classify` - 意图分类兜底
- `/api/ai/intent/clarify` - 生成澄清问题

Java端修改:
- `AIEnterpriseService.determineIntentType()` - 调用LLM

#### A4. 澄清交互实现 (4天)
修改文件:
- `IntentExecutorServiceImpl.java` - 实现 confirm 方法
- 新增 Redis 缓存预览数据逻辑

### 阶段 B: 智能策略 (2周) - 第二优先

#### B1. 强信号/弱信号判断
```java
boolean isStrongSignal = matchedKeywords >= 3
    && (top1Confidence - top2Confidence) > 0.3
    && priority >= 80;
```

#### B2. 高风险意图强制确认
```java
if (sensitivity == HIGH || sensitivity == CRITICAL) {
    return preview(factoryId, request);  // 先预览
}
```

#### B3. 候选意图选择UI
- 前端增加选择组件
- 后端返回 2-3 个候选意图

### 阶段 C: 学习机制 (2周) - 可选

#### C1. 错误归因统计表
- 按意图/日期/错误类型聚合
- 记录规则优化建议

#### C2. 定期分析任务
- 每周自动分析失败案例
- 生成优化建议报告

### 阶段 D: LangChain集成 (4-6周) - 长期

仅当以下条件满足时启动:
- 需要工具调用 (查数据库、API)
- 需要多步骤推理链
- 需要 Agent 自主决策

---

## 五、关键文件清单

### 需修改的文件
| 文件 | 改动 |
|------|------|
| `AIIntentServiceImpl.java` | 置信度返回、记录埋点 |
| `IntentExecutorServiceImpl.java` | confirm实现 |
| `AIEnterpriseService.java` | LLM Fallback调用 |
| `AIIntentConfigController.java` | 响应格式 |
| `main.py` (Python) | 新增 classify/clarify 端点 |

### 需新增的文件
| 文件 | 说明 |
|------|------|
| `IntentMatchResult.java` | 匹配结果DTO |
| `IntentMatchRecord.java` | 记录Entity |
| `IntentMatchRecordRepository.java` | 数据访问 |
| `V2026_01_03_1__intent_match_records.sql` | 记录表 |
| `V2026_01_03_2__error_attribution_statistics.sql` | 统计表 |

---

## 六、并行工作建议

### Subagent 并行建议
- 可并行: ✅ 有限度
- 建议:
  - Agent 1: Java 后端 (置信度 + 记录表)
  - Agent 2: Python AI 服务 (LLM Fallback 端点)

### 多 Chat 并行建议
- 可并行: ✅
- 分配:
  - Chat 1: Java 后端 Phase A1-A4
  - Chat 2: Python AI 服务改造
- 注意: 接口契约需先确定

---

## 七、风险评估

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| 现有功能破坏 | 中 | 渐进式改造，保留原接口 |
| LLM调用成本 | 中 | 只在Fallback时调用，设置配额 |
| 记录表性能 | 低 | 异步写入，定期归档 |
| 前端适配 | 中 | 提供明确的接口文档 |

---

## 八、结论与建议

### 方案评估结论
用户方案设计完善，但需要**分阶段实施**:

1. **Phase 1-2 (确认机制)**: 建议立即开始，改动量可控
2. **Phase 3 (Fallback)**: 建议在 Phase 1-2 后实施
3. **Phase 4 (规则优化)**: 可选，看实际效果决定
4. **LangChain**: 不建议立即引入，待需求明确后再评估

### 推荐首批实施项
1. ✅ A1 置信度返回 (3天)
2. ✅ A2 意图匹配记录表 (3天)
3. ✅ A3 LLM Fallback 端点 (4天)

**总工期**: 约 2 周可完成核心增强

---

## 九、实施进度跟踪

### Phase A: 核心增强 ✅ 已完成 (2026-01-02)

| 任务 | 状态 | 完成内容 |
|------|------|----------|
| A1 置信度返回 | ✅ 已完成 | `IntentMatchResult` DTO, 强/弱信号判断, `recognizeIntentWithConfidence()` |
| A2 意图匹配记录表 | ✅ 已完成 | `V2026_01_02_1__intent_match_records.sql`, `IntentMatchRecord` Entity, Repository |
| A3 LLM Fallback 端点 | ✅ 已完成 | Python `/api/ai/intent/classify`, `/api/ai/intent/clarify`, `/api/ai/intent/health` |
| A4 Java LLM 集成 | ✅ 已完成 | `LlmIntentFallbackClient` 接口, `LlmIntentFallbackClientImpl`, `AIIntentServiceImpl.tryLlmFallback()` |

**新增文件清单**:
- `backend-java/src/main/java/com/cretas/aims/dto/intent/IntentMatchResult.java`
- `backend-java/src/main/java/com/cretas/aims/entity/intent/IntentMatchRecord.java`
- `backend-java/src/main/java/com/cretas/aims/entity/intent/IntentOptimizationSuggestion.java`
- `backend-java/src/main/java/com/cretas/aims/repository/IntentMatchRecordRepository.java`
- `backend-java/src/main/java/com/cretas/aims/repository/IntentOptimizationSuggestionRepository.java`
- `backend-java/src/main/java/com/cretas/aims/service/LlmIntentFallbackClient.java`
- `backend-java/src/main/java/com/cretas/aims/service/impl/LlmIntentFallbackClientImpl.java`
- `backend-java/src/main/resources/db/migration/V2026_01_02_1__intent_match_records.sql`

**配置项**:
```properties
cretas.ai.intent.llm-fallback.enabled=true
cretas.ai.intent.llm-fallback.confidence-threshold=0.3
cretas.ai.service.url=http://localhost:8085
```

---

### Phase B: 智能策略 ✅ 已完成 (2026-01-02)

| 任务 | 状态 | 完成内容 |
|------|------|----------|
| B1 强信号/弱信号判断 | ✅ 已完成 | 已集成到 `AIIntentServiceImpl.isStrongSignal()` |
| B2 高风险意图强制确认 | ✅ 已完成 | 已集成到 `determineRequiresConfirmation()` |
| B3 候选意图选择UI | ✅ 已完成 | 前端 IntentCandidateSelector 组件 + API 客户端方法 |
| B4 澄清问题生成 | ✅ 已完成 | `generateClarificationQuestion()` 调用 LLM + 模板降级 |
| B5 意图匹配记录埋点 | ✅ 已完成 | `saveIntentMatchRecord()` 在所有返回路径记录 |

**B3 候选意图选择UI 实现** (2026-01-02):
- 前端组件: `IntentCandidateSelector.tsx` - Modal 弹窗展示 Top-N 候选意图
- 类型定义: `intent.ts` - 完整 TypeScript 类型 (CandidateIntent, IntentMatchResult, IntentExecuteResponse)
- API 客户端: `aiApiClient.ts` - 新增 `recognizeIntent()`, `confirmIntentSelection()`, `executeIntent()`
- 组件导出: `src/components/ai/index.ts` - 统一导出 AI 组件和类型

**B3 新增文件清单**:
- `frontend/CretasFoodTrace/src/types/intent.ts`
- `frontend/CretasFoodTrace/src/components/ai/IntentCandidateSelector.tsx`
- `frontend/CretasFoodTrace/src/components/ai/index.ts`

**B4/B5 新增配置项**:
```properties
cretas.ai.intent.llm-clarification.enabled=true
cretas.ai.intent.recording.enabled=true
```

**B4 澄清问题生成实现**:
- `generateClarificationQuestion(userInput, factoryId, candidates)` - LLM 调用 + 模板降级
- `generateTemplateClarificationQuestion(candidates)` - 模板生成备选
- 优先使用 LLM 生成自然语言澄清问题，失败时使用模板

**B5 意图匹配记录埋点实现**:
- `saveIntentMatchRecord()` 方法完整实现
- 在 `recognizeIntentWithConfidence` 和 `tryLlmFallback` 所有返回路径调用
- 记录字段：用户输入、匹配意图、置信度、候选列表、LLM调用标记等

---

### Phase C: 学习机制 ✅ 已完成 (2026-01-02)

| 任务 | 状态 | 完成内容 |
|------|------|----------|
| C1 错误归因统计表 | ✅ 已完成 | `ErrorAttributionStatistics` Entity + Repository, `V2026_01_02_2__error_attribution_statistics.sql` |
| C2 定期分析任务 | ✅ 已完成 | `ErrorAttributionAnalysisScheduler` - 定时聚合/分析/清理/建议生成 |
| C3 优化建议报告API | ✅ 已完成 | `IntentAnalysisController` - 完整的统计/趋势/模式识别/建议管理API |

**C1 错误归因统计表**:
- `ErrorAttributionStatistics.java` - 每日统计聚合 Entity
- `ErrorAttributionStatisticsRepository.java` - 统计数据访问
- 统计字段: 总请求、成功匹配、LLM调用、各错误归因类型数量等

**C2 定期分析任务**:
- `ErrorAttributionAnalysisScheduler.java` - Spring @Scheduled 定时任务
- 每日凌晨1点: 聚合昨日统计数据
- 每周一凌晨2点: 生成周度分析报告
- 每日凌晨3点: 清理过期数据
- 每日凌晨4点: 生成优化建议
- 支持手动触发: `triggerAggregation()`, `triggerWeeklyReport()`, `triggerSuggestionGeneration()`

**C3 优化建议报告API** (`IntentAnalysisController`):
```
统计数据:
  GET /api/mobile/{factoryId}/intent-analysis/statistics
  GET /api/mobile/{factoryId}/intent-analysis/statistics/{date}

趋势分析:
  GET /api/mobile/{factoryId}/intent-analysis/trends/match-rate
  GET /api/mobile/{factoryId}/intent-analysis/trends/llm-fallback
  GET /api/mobile/{factoryId}/intent-analysis/trends/error-attribution

错误模式识别:
  GET /api/mobile/{factoryId}/intent-analysis/patterns/failures
  GET /api/mobile/{factoryId}/intent-analysis/patterns/ambiguous
  GET /api/mobile/{factoryId}/intent-analysis/patterns/missing-rules

优化建议管理:
  GET /api/mobile/{factoryId}/intent-analysis/suggestions
  GET /api/mobile/{factoryId}/intent-analysis/suggestions/high-impact
  POST /api/mobile/{factoryId}/intent-analysis/suggestions/{id}/apply
  POST /api/mobile/{factoryId}/intent-analysis/suggestions/{id}/reject

报告生成:
  GET /api/mobile/{factoryId}/intent-analysis/reports/weekly
  GET /api/mobile/{factoryId}/intent-analysis/dashboard

管理操作:
  POST /api/mobile/{factoryId}/intent-analysis/admin/aggregate
  POST /api/mobile/{factoryId}/intent-analysis/admin/generate-suggestions
  GET /api/mobile/{factoryId}/intent-analysis/admin/scheduler-status
```

**C2/C3 配置项**:
```properties
cretas.ai.intent.scheduler.enabled=true
cretas.ai.intent.analysis.retention-days=30
cretas.ai.intent.statistics.retention-days=365
cretas.ai.intent.suggestion.analysis-days=7
```

**Phase C 新增文件清单**:
- `backend-java/src/main/java/com/cretas/aims/entity/intent/ErrorAttributionStatistics.java`
- `backend-java/src/main/java/com/cretas/aims/repository/ErrorAttributionStatisticsRepository.java`
- `backend-java/src/main/java/com/cretas/aims/service/ErrorAttributionAnalysisService.java`
- `backend-java/src/main/java/com/cretas/aims/service/impl/ErrorAttributionAnalysisServiceImpl.java`
- `backend-java/src/main/java/com/cretas/aims/scheduler/ErrorAttributionAnalysisScheduler.java`
- `backend-java/src/main/java/com/cretas/aims/controller/IntentAnalysisController.java`
- `backend-java/src/main/resources/db/migration/V2026_01_02_2__error_attribution_statistics.sql`

---

### Phase D: LangChain集成 ⏳ 未开始

仅当以下条件满足时启动:
- 需要工具调用 (查数据库、API)
- 需要多步骤推理链
- 需要 Agent 自主决策
