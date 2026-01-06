# 白垩纪系统未完成任务总清单

**生成时间**: 2026-01-06
**任务范围**: 架构优化 + 代码重构 + 硬件系统 + 集成测试
**总体进度**: 已完成AI意图识别Phase 1增强，进入全面实施阶段

---

## 📋 任务分类总览

### 零、P0 紧急安全修复任务（3项，预计3天）⚠️
### 一、P0 BUG修复任务（3项，预计2天）
### 二、P1 AI意图系统优化（3项，预计7天）
### 三、P1 架构优化任务（3项，预计9天）
### 四、代码重构任务（4项，预计3天）
### 五、硬件系统任务（2项，预计5天）
### 六、IoT完整解决方案（3项，预计2天）
### 七、ISAPI智能分析实现（3个阶段，预计4天）
### 八、集成测试任务（7项，预计14天）
### 九、P2 系统优化任务（4项，预计6天）

**总工作量**: 约 **55个工作日**
**P0紧急任务**: 8项，预计 **12个工作日**

---

## ✅ 已完成工作（2026-01-06前）

### 角色权限迁移 (2026-01-06完成)
- 完成 `department_admin` → `factory_super_admin` 迁移（5个Controller，34处替换）
- 完成 `permission_admin` → `factory_super_admin` 迁移（WhitelistController，18处替换）
- 验证 `production_manager` → `dispatcher` 兼容性（PermissionServiceImpl已兼容）
- 更新 MAIA-ARCHITECTURE-PLAN.md Section 7 文档
- **受影响的文件**:
  - RuleController.java (12处)
  - AIRuleController.java (4处)
  - EncodingRuleController.java (15处 - 包含3处多角色操作端点)
  - FormAssistantController.java (1处手动role check)
  - WhitelistController.java (18处)
- **实施模式**: Pattern 1 (Admin-only), Pattern 2 (Multi-role operational), Manual Role Check
- **FactoryUserRole枚举**: 所有废弃角色已标记 `@Deprecated`

### AI意图识别系统 Phase 1 增强
- 统一语义匹配层（Layer 4）
- 5层识别管道优化：精确表达 → 正则 → 关键词 → 语义 → LLM降级
- 自学习机制实现（多阈值学习：HIGH ≥0.85, MEDIUM 0.70-0.85, LOW <0.70）
- GTE-base-zh embedding模型集成（768维向量）
- 三层缓存架构（语义缓存、Embedding缓存、Spring Cacheable）

---

## 零、P0 紧急安全修复任务（3项，预计3天）⚠️

**背景**: 在AI意图识别系统架构审查中发现严重的多租户安全漏洞，可导致跨工厂数据泄露

### P0-Security-1: 修复多租户缓存隔离漏洞 ✅ 已完成（2026-01-06验证）

**状态**: 已完成 - 经代码审查，多租户缓存隔离已正确实现，原任务描述基于过时信息

**验证发现**:
- ✅ AIIntentConfigController: 缓存已正确实现工厂隔离
  - `getAllIntents(factoryId)`: @Cacheable(key = "#factoryId") (Line 1027)
  - `getIntentByCode(factoryId, intentCode)`: 调用 getAllIntents(factoryId) 复用缓存
  - `getIntentsByCategory(factoryId, category)`: @Cacheable(key = "#factoryId + ':' + #category") (Line 1037)

- ✅ AIBusinessDataController: 无缓存（仅POST操作）
  - 不存在 getAllBusinessData() 方法
  - 仅有 POST /initialize 和 POST /preview 端点
  - 所有数据库查询已包含 factoryId 参数

- ✅ AIQuotaConfigController: 无缓存（直接查询）
  - 不存在 getAllQuotas() 方法
  - GET /ai-quota-configs 直接调用 repository.findByFactoryIdAndEnabled(factoryId) (Line 47)
  - 所有查询都通过 factoryId 过滤

**任务描述问题分析**:
| 原任务要求 | 实际状态 | 说明 |
|-----------|----------|------|
| 修复 AIIntentConfigController | ✅ 已正确实现 | 缓存键包含 factoryId |
| 修复 getAllBusinessData() | ❌ 方法不存在 | 该Controller无此方法，无需缓存 |
| 修复 getAllQuotas() | ❌ 方法不存在 | 该Controller无此方法，直接查询 |

**关键代码位置**:
- AIIntentServiceImpl.java:1027-1034 (getAllIntents with factory isolation)
- AIIntentServiceImpl.java:1037-1047 (getIntentsByCategory with factory isolation)
- AIBusinessDataController.java (无缓存，仅创建操作)
- AIQuotaConfigController.java:43-68 (无缓存，直接查询)

**结论**: 多租户缓存隔离已在实际开发中正确实现，原任务基于过时的代码分析

**工作量**: 0天（已存在）
**完成日期**: 2026-01-06（验证）
**优先级**: P0 ✅

---

### P0-Security-2: 修复Handler层工厂隔离漏洞 ✅ 已完成（2026-01-06）

**状态**: 已完成 - 经完整代码审查，实际仅5个漏洞（不是13个），已全部修复

**原始问题描述**: 4个IntentHandler中13处使用findById()查询，未验证数据是否属于当前工厂

**实际调查结果**:
- 原始估计过高，大部分Handler已使用工厂隔离查询
- 实际漏洞数: **5个** (分布在2个Handler中)
- **QualityIntentHandler**: ✅ 无漏洞（已使用 `findFirstByFactoryIdAndProductionBatchIdOrderByInspectionDateDesc`）
- **MetaIntentHandler**: ✅ 无漏洞（已使用 `findByIntentCodeAndFactoryIdOrPlatform`）

**已修复的漏洞**:

**ShipmentIntentHandler** (3处漏洞 ✅ 已修复):
- Line 252: `shipmentRecordService.getById(shipmentId)` → 改为 `getByIdAndFactoryId(shipmentId, factoryId)`
- Line 289: `shipmentRecordService.getByShipmentNumber(shipmentNumber)` → 改为 `getByShipmentNumberAndFactoryId(shipmentNumber, factoryId)`
- Line 324: `shipmentRecordService.getByTrackingNumber(trackingNumber)` → 改为 `getByTrackingNumberAndFactoryId(trackingNumber, factoryId)`
- **修复内容**:
  - ShipmentRecordRepository: 添加3个工厂隔离查询方法
  - ShipmentRecordService: 添加3个工厂隔离服务方法
  - ShipmentIntentHandler: 删除30行手动factoryId验证代码

**DataOperationIntentHandler** (2处漏洞 ✅ 已修复):
- Line 1039: `productionBatchRepository.findById(batchIdLong)` → 改为 `findByIdAndFactoryId(batchIdLong, factoryId)`
- Line 1053: `productTypeRepository.existsById(entityId)` → 改为 `existsByIdAndFactoryId(entityId, factoryId)`
- **修复内容**:
  - ProductTypeRepository: 添加 `existsByIdAndFactoryId` 方法
  - DataOperationIntentHandler.validateDataOperationWithDrools: 更新2处查询调用

**文档错误说明**:
- ❌ 原文档声称 equipmentRepository.findById() 漏洞 - **不存在**（DataOperationIntentHandler中无equipmentRepository使用）
- ❌ 原文档声称 QualityIntentHandler 有3处漏洞 - **误报**（所有查询已工厂隔离）
- ❌ 原文档声称 MetaIntentHandler 有3处漏洞 - **误报**（所有查询已工厂隔离）

**安全改进**:
- 消除竞态条件（手动验证 → 数据库级隔离）
- 防止信息泄露（统一错误消息）
- 增强数据库安全约束

**实际工作量**: 0.5天（远低于预估的1.5天）
**完成日期**: 2026-01-06
**优先级**: P0 ✅

---

### P0-Security-3: AIIntentConfig实体工厂隔离 ✅ 已完成（2026-01-06）

**状态**: 已完成 - 代码已完整实现工厂隔离，仅需数据库迁移

**调查发现**:
- ✅ AIIntentConfig实体已有factoryId字段（Lines 44-49）
- ✅ Repository已有完整的factory-aware查询方法（15+ methods）
- ✅ Service接口已定义factory-aware方法签名
- ✅ Service实现已正确使用factory-aware repository方法
- ✅ Controller已使用factory-aware service方法
- ❌ **仅缺少**: 数据库表缺少factory_id列

**完成工作**:
1. ✅ 创建数据库迁移脚本 `V2026_01_06_1__add_factory_id_to_ai_intent_configs.sql`
   - 添加 factory_id VARCHAR(50) NULL 列
   - 创建索引 idx_intent_factory_id
   - 创建复合索引 idx_factory_active_priority
   - 初始化现有数据为平台级（factory_id = NULL）
   - 修改唯一约束支持多租户：(intent_code, factory_id)

2. ✅ 验证代码实现
   - Repository.findByFactoryIdOrPlatformLevel(factoryId) - 已实现
   - Service.getAllIntents(factoryId) - 正确调用factory-aware方法
   - Controller - 所有endpoint已使用factory-aware service方法

**数据隔离策略**:
- **平台级意图** (factory_id = NULL): 所有工厂共享的基础意图配置
- **工厂级意图** (factory_id = 具体工厂ID): 工厂专属的自定义意图
- **唯一性约束**: 同一工厂内intent_code唯一，不同工厂可复用

**待测试**:
- [ ] 在本地环境运行Flyway迁移
- [ ] 验证平台级意图对所有工厂可见
- [ ] 验证工厂级意图仅对特定工厂可见
- [ ] 验证相同intent_code可在不同工厂存在

**实际工作量**: 0.5天（代码已存在，仅需数据库迁移）
**完成日期**: 2026-01-06
**优先级**: P0 ✅

---

## 一、P0 BUG修复任务（3项，预计2天）

**背景**: 基于实际测试发现的意图识别错误，需要立即修复

### BUG-001/002: 实现跨关键词操作类型识别机制 ✅ 已完成（2026-01-06）

**状态**: 已完成 - 修复所有使用旧方法的调用点

**问题描述**:
- 用户输入"查询批次"被识别为UPDATE意图
- 用户输入"修改批次"被识别为QUERY意图
- **根本原因**: 部分代码路径仍使用旧的 `recognizeIntent` 方法，该方法不考虑操作类型

**调查发现**:
- ✅ AIIntentServiceImpl.recognizeIntentWithConfidence 已实现操作类型检测（Lines 280, 302-311）
- ❌ 旧方法 recognizeIntent (Lines 127-173) 未使用操作类型检测
- ❌ AIIntentConfigController.recognizeIntent 使用旧方法（Line 150）
- ❌ AIEnterpriseService.recognizeIntentForReport 使用旧方法（Line 1145）

**完成工作**:
1. ✅ 更新 AIIntentConfigController.recognizeIntent (Line 142-173)
   - 替换为 recognizeIntentWithConfidence(userInput, factoryId, 1)
   - 新增 confidence 和 matchMethod 字段到返回结果
   - 添加导入 IntentMatchResult

2. ✅ 更新 AIEnterpriseService.recognizeIntentForReport (Line 1144-1153)
   - 替换为 recognizeIntentWithConfidence(question, factoryId, 1)
   - 添加导入 IntentMatchResult

3. ✅ 更新 IntentRecognitionResult 数据类 (Line 467-478)
   - 新增 confidence 字段 (Double)
   - 新增 matchMethod 字段 (String)

**技术细节**:
- 操作类型检测使用 KnowledgeBase.detectActionType(input)
- 评分调整使用 calculateOperationTypeAdjustment(intentCode, opType, bonus, penalty)
- 配置参数：operationTypeMatchBonus（加分）、operationTypeMismatchPenalty（减分）

**验证结果**:
- ✅ 编译通过: BUILD SUCCESS
- ⏳ 待测试："查询批次MB-F001-001" → MATERIAL_BATCH_QUERY
- ⏳ 待测试："修改批次状态" → MATERIAL_BATCH_UPDATE

**实际工作量**: 0.5天
**完成日期**: 2026-01-06
**优先级**: P0 ✅

---

### BUG-003: Python服务增加数据操作解析端点 ✅ 已完成（2026-01-06验证）

**状态**: 已完成 - 端点已在之前的开发中实现

**问题描述**: 当前Python AI服务缺少 parse-data-operation 端点，导致数据操作意图无法使用AI增强解析

**验证发现**:
- ✅ 端点已存在: POST /api/ai/intent/parse-data-operation (main.py:2915-3012)
- ✅ 实现注释: "BUG-003 修复: 添加此端点支持 DataOperationIntentHandler 的 AI 解析" (Line 2920)
- ✅ Java调用: DataOperationIntentHandler.callPythonAIParseIntent (Line 723-761)
- ✅ 双模式支持: DashScope直接调用 + Python AI服务 fallback

**已实现功能**:
1. ✅ 端点定义: POST /api/ai/intent/parse-data-operation
2. ✅ 请求模型: DataOperationParseRequest (Lines 2900-2904)
   - user_input: 用户输入文本
   - factory_id: 工厂ID
   - supported_entities: 支持的实体类型列表
   - context: 可选的上下文信息
3. ✅ 响应模型: DataOperationParseResponse (Lines 2906-2913)
   - success: 解析成功标志
   - entity_type: 实体类型 (ProductType/ProductionPlan/ProcessingBatch/MaterialBatch)
   - entity_identifier: 实体标识符 (批次号、产品ID等)
   - updates: 更新字段映射
   - operation: 操作类型 (UPDATE/CREATE/DELETE)
   - message: 解析消息

**实现细节**:
- 使用 DashScope (Qwen) LLM 进行自然语言解析
- 支持实体类型映射 (中文→英文, PascalCase→SCREAMING_SNAKE_CASE)
- 温度设置为 0.1 确保一致性
- 强制 JSON 输出格式
- 完整的异常处理

**Java集成状态**:
- ✅ DataOperationIntentHandler.callAIParseIntent (Line 607-617)
- ✅ 优先使用DashScope直接调用 (Line 609-614, 623-641)
- ✅ Fallback到Python AI服务 (Line 617, 723-761)
- ✅ 响应字段映射: snake_case → camelCase (Line 746-753)

**与需求对比**:
| 需求 | 实现状态 | 说明 |
|------|---------|------|
| user_input | ✅ 已实现 | Line 2901 |
| entity_type | ✅ 已实现 | 通过 supported_entities 列表 |
| operation | ✅ 已实现 | UPDATE/CREATE/DELETE (不包含QUERY，因为是数据修改操作) |
| entity_id | ✅ 已实现 | 作为 entity_identifier 返回 |
| fields | ✅ 已实现 | 作为 updates 返回 |
| confidence | ❌ 未实现 | Java handler未使用此字段，暂不需要 |

**工作量**: 0天（已存在）
**完成日期**: 2026-01-06（验证）
**优先级**: P0 ✅

---

### BUG-004: 扩展自学习机制支持用户纠正 ✅ 已完成（2026-01-06验证）

**状态**: 已完成 - 实现了增强版自学习机制，采用统计学方法替代简单删除

**验证发现**:
- ✅ 反馈API已实现: POST /feedback/positive 和 POST /feedback/negative (AIIntentConfigController:396-430)
- ✅ DTO已实现: PositiveFeedbackRequest 和 NegativeFeedbackRequest (AIIntentConfigController:505-523)
- ✅ 负反馈记录: KeywordEffectivenessServiceImpl.recordFeedback (Line 29-51)
- ✅ 关键词学习: KeywordLearningServiceImpl.learnFromUserFeedback (Line 274-326)
- ✅ 权重降级: KeywordEffectiveness.recordNegativeFeedback 使用 Wilson Score 算法

**实现对比（增强版设计）**:
| 原始需求 | 实际实现 | 说明 |
|---------|---------|------|
| POST /intents/{intentCode}/feedback | POST /feedback/positive + POST /feedback/negative | 更清晰的API设计 |
| 移除错误意图关键词 | 统计降权 + 定期清理 | Wilson Score 算法，score < 0.5 时权重降至 0.5 |
| 添加到正确意图 | ✅ learnFromUserFeedback | 添加 source=FEEDBACK_LEARNED 的关键词 |
| 记录负反馈 | ✅ recordFeedback(false) | 增加 negativeCount，重算 effectivenessScore |

**增强特性**:
1. **Wilson Score 算法**: 统计学上更可靠的置信度计算，避免小样本偏差
2. **渐进式降权**: 不立即删除，给予改进机会，防止误删有用关键词
3. **定期清理**: cleanupLowEffectivenessKeywords 清理持续低效关键词
4. **双向学习**: 既记录错误，也学习正确意图的新关键词

**关键代码位置**:
- AIIntentConfigController.java:396-430 (API endpoints)
- AIIntentServiceImpl.java:1348-1418 (正负反馈处理 + 学习触发)
- KeywordEffectivenessServiceImpl.java:29-51 (效果追踪)
- KeywordLearningServiceImpl.java:274-326 (从反馈学习关键词)
- KeywordEffectiveness.java:135-150 (Wilson Score + 权重调整)

**工作量**: 0天（已存在，且设计优于原需求）
**完成日期**: 2026-01-06（验证）
**优先级**: P0 ✅

---

## 二、P1 AI意图系统优化（3项，预计5.5天）

**背景**: 基于94个意图的完整测试结果，发现关键问题需要修复

**测试结果**:
- COMPLETED: 60个意图 (65.9%)
- NEED_INFO: 25个意图 (27.5%)
- FAILED: 6个意图 (6.6%)

**目标**: COMPLETED率提升至85%+，NEED_INFO降至10%，FAILED降至5%

---

### ✅ AI-Opt-1: 修复6个FAILED意图的P0问题（已完成，2026-01-06检查）

**状态**: 已完成 - 经代码审查，所有问题已在之前的开发中修复

**问题1: QUALITY_DISPOSITION_EXECUTE异常处理缺失** ✅ 已修复
- 文件: QualityIntentHandler.java:310-389
- 当前状态: Lines 343-355 已包含完整的try-catch异常处理
- 实现代码: 捕获NumberFormatException并返回NEED_MORE_INFO状态

**问题2: 枚举转换保护不一致** ✅ 已修复
- 文件: QualityIntentHandler.java:351-368
- 当前状态: isValidDispositionAction() 已使用toUpperCase()统一处理
- 实现代码: 所有枚举验证和转换保持一致

**问题3: USER_DISABLE功能未实现** ✅ 已完成
- 文件: UserIntentHandler.java:192-209, 344-352
- 当前状态: 已实现完整的username→userId查询逻辑
- 实现代码: extractUsernameFromInput()方法支持从用户输入中提取用户名

**验证结果**: 所有3个问题均已正确实现，代码质量符合预期

**实际工作量**: 0天（已完成）
**完成日期**: 2026-01-06
**优先级**: P1 ✅

---

### AI-Opt-2: 扩展IntentSemanticsParser参数提取能力 ✅ 已完成（2026-01-06验证）

**状态**: 已完成 - 所有4种新增提取规则均已实现

**问题描述**: 当前Parser只支持3种批次号格式和4种ID类型，导致27.5%的意图返回NEED_INFO

**目标**: 将NEED_INFO率从27.5%降至15%

**已实现提取规则**:

**用户名提取** ✅ (支持 USER_DISABLE / USER_ROLE_ASSIGN):
- 实现位置: IntentSemanticsParserImpl.java:516-530
- 正则模式: 匹配"用户"、"禁用"、"停用"后的用户名

**客户名提取** ✅ (支持 SHIPMENT_BY_CUSTOMER):
- 实现位置: IntentSemanticsParserImpl.java:360-385
- 正则模式: 匹配"客户"、"客户名"后的名称

**状态值映射** ✅ (支持 SHIPMENT_STATUS_UPDATE):
- 实现位置: IntentSemanticsParserImpl.java:423-466
- 中文到英文映射: "已发货"→SHIPPED, "待发货"→PENDING, "已送达"→DELIVERED等
- 支持4种状态映射表: SHIPMENT_STATUS_MAPPINGS, QUALITY_STATUS_MAPPINGS, BATCH_STATUS_MAPPINGS, GENERAL_STATUS_MAPPINGS

**日期提取** ✅ (支持 SHIPMENT_BY_DATE / ATTENDANCE_HISTORY):
- 实现位置: IntentSemanticsParserImpl.java:468-514
- 正则模式: 匹配"2024-01-01"、"今天"、"昨天"、"本周"、"本月"
- 日期解析: 将中文日期转换为LocalDate (parseRelativeDate方法)

**关键代码位置**:
- IntentSemanticsParserImpl.java (532 lines total)
- Lines 423-466: mapStatusValue (4种状态映射表)
- Lines 468-514: parseRelativeDate (相对日期解析)
- Lines 360-385: extractCustomerId (客户名提取)
- Lines 516-530: extractUsername (用户名提取)

**实际工作量**: 0天（已存在，且功能完整）
**完成日期**: 2026-01-06（验证）
**风险等级**: 中
**优先级**: P1 ✅

---

### AI-Opt-3: Handler参数提取改造 + 语义缓存启用

**问题描述**: 各Handler仅检查context，不解析userInput，导致参数提取失败

**影响Handler** (通过率):
- UserIntentHandler (0%)
- ShipmentIntentHandler (42.9%)
- TraceIntentHandler (33.3%)
- QualityIntentHandler (42.9%)

**修复模式**: 在每个Handler的参数获取逻辑中添加userInput降级解析

**语义缓存启用**:

**配置Embedding服务**:
- 启用embedding服务
- 设置缓存TTL为1小时

**集成缓存查询**:
- 在意图识别流程的Layer 4前检查语义缓存
- 相似度阈值设置为0.85

**缓存更新策略**:
- 成功识别后更新缓存（仅当置信度≥0.85时）

**需要修改的文件**:
- service/handler/UserIntentHandler.java - 增加userInput降级解析
- service/handler/ShipmentIntentHandler.java - 增加userInput降级解析
- service/handler/TraceIntentHandler.java - 增加userInput降级解析
- service/handler/QualityIntentHandler.java - 增加userInput降级解析
- service/impl/AIIntentServiceImpl.java - 集成语义缓存查询
- application.yml - 配置Embedding服务

**预计工作量**: 4天
**风险等级**: 中
**优先级**: P1

---

## 三、P1 架构优化任务（3项，预计9天）

### 任务1: 实现对话状态管理器 (Conversation State Manager)

**目标**: 支持多轮对话，实现引用消解功能（例如："把刚才那个字段改成..."）

**实施内容**:
1. 创建对话状态管理服务
2. 创建对话上下文数据模型
3. 使用Redis存储对话上下文（TTL 30分钟）
4. 在意图执行请求中增加会话ID字段
5. 实现引用消解逻辑（NLP或规则匹配）

**技术方案**:
- **存储方案**: Redis，过期时间30分钟
- **数据结构**: 键值对存储上下文信息
- **引用消解**: 支持"刚才"、"那个"等指代词的具体化

**需要修改的文件**:
- IntentExecuteRequest.java - 增加会话ID字段
- IntentExecutorServiceImpl.java - 调用引用消解服务

**需要新建的文件**:
- ConversationStateService.java - 对话状态管理服务
- ConversationContext.java - 对话上下文数据模型

**预计工作量**: 5天
**风险等级**: 中
**优先级**: P1

---

### 任务2: LLM自动修复机制 (Auto-Repair Pipeline)

**目标**: 当LLM输出格式错误时，自动重试并修复

**实施内容**:
1. 将LLM调用包装在重试循环中（最多3次）
2. 捕获Schema验证异常
3. 将错误信息反馈给LLM
4. 要求LLM重新生成正确格式的输出

**技术方案**:
- **重试策略**: 最多3次重试
- **修复提示**: 构造包含错误信息的修复提示
- **降级策略**: 3次失败后抛出异常

**需要修改的文件**: IntentExecutorServiceImpl.java - 替换现有的意图识别调用

**实施步骤**:
1. 新增带重试的意图识别方法
2. 捕获Schema验证异常
3. 构造修复提示词
4. 循环重试直到成功或达到最大次数
5. 记录重试日志和成功率指标

**预计工作量**: 3天
**风险等级**: 高（需要测试LLM修复成功率）
**优先级**: P1

---

### 任务3: 更新MAIA架构计划文档

**目标**: 记录新的架构设计决策和实施路线图

**更新内容**:
1. 添加"AI Orchestration Layer"专题章节
2. 记录架构审计结果和发现的问题
3. 更新架构图（增加验证网关层）
4. 记录P0/P1任务清单
5. 添加架构审计报告链接
6. 补充实施路线图和风险评估

**文档结构**:
- 第1部分: 架构审计结果（2026-01-06）
- 第2部分: AI Orchestration Layer设计
- 第3部分: 实施路线图
- 第4部分: 风险评估

**需要修改的文件**: MAIA-ARCHITECTURE-PLAN.md

**预计工作量**: 1天
**风险等级**: 低
**优先级**: P1

---

## 四、代码重构任务（4项，预计3天）

**背景**: AI意图识别系统存在代码冗余问题，影响维护性和性能

### 重构1: VectorUtils工具类 + 清理废弃代码

**目标**: 统一向量计算逻辑，清理废弃的EmbeddingClientImpl

**实施内容**:
1. 创建 util/VectorUtils.java 工具类
2. 实现统一的 cosineSimilarity() 方法（消除3处重复）
3. 实现 serializeEmbedding() 和 deserializeEmbedding()
4. 删除 EmbeddingClientImpl.java（已标记@Deprecated，304行）

**需要修改的文件**:
- IntentEmbeddingCacheServiceImpl.java - 使用VectorUtils
- SemanticCacheServiceImpl.java - 使用VectorUtils
- DjlEmbeddingClient.java - 使用VectorUtils

**需要删除的文件**: EmbeddingClientImpl.java

**预计工作量**: 0.5天
**风险等级**: 低
**优先级**: P1
**预期收益**: 节省约360行代码，统一向量计算逻辑

---

### 重构2: KeywordLearningService统一关键词处理

**目标**: 消除关键词学习逻辑的重复实现

**实施内容**:
1. 创建 service/KeywordLearningService.java 接口
2. 创建 service/impl/KeywordLearningServiceImpl.java 实现
3. 统一关键词提取逻辑
4. 统一关键词学习流程
5. 重构 KeywordEffectivenessServiceImpl 统一创建逻辑

**需要修改的文件**:
- AIIntentServiceImpl.java - 删除重复方法，调用新服务
- KeywordEffectivenessServiceImpl.java - 统一 getOrCreateKeyword() 方法

**需要新建的文件**:
- service/KeywordLearningService.java
- service/impl/KeywordLearningServiceImpl.java

**预计工作量**: 1天
**风险等级**: 中
**优先级**: P1
**预期收益**: 节省约105行代码，统一关键词处理逻辑

---

### 重构3: RequestScopedEmbeddingCache请求级缓存

**目标**: 避免同一请求中重复计算Embedding

**实施内容**:
1. 创建 service/RequestScopedEmbeddingCache.java
2. 使用ThreadLocal实现请求级缓存
3. 修改所有Embedding调用点使用缓存（7处）
4. 实现自动清理机制

**涉及调用点**:
- ExpressionLearningServiceImpl.java:75
- SemanticCacheServiceImpl.java:149, 199, 305
- IntentEmbeddingCacheServiceImpl.java:201, 338, 452

**需要新建的文件**: service/RequestScopedEmbeddingCache.java

**预计工作量**: 1天
**风险等级**: 中
**优先级**: P1
**预期收益**: 单次请求Embedding计算从2-3次降为1次

---

### 重构4: IntentMatchingConfig配置统一化

**目标**: 统一管理分散的配置参数

**实施内容**:
1. 创建 config/IntentMatchingConfig.java
2. 创建 config/IntentKnowledgeBase.java（外部化硬编码常量）
3. 迁移17个@Value注解到配置类
4. 外部化 STOP_WORDS, QUERY_INDICATORS, UPDATE_INDICATORS

**当前问题**:
- 17个@Value分散在6个分类
- 硬编码常量难以维护

**需要新建的文件**:
- config/IntentMatchingConfig.java
- config/IntentKnowledgeBase.java

**需要修改的文件**: AIIntentServiceImpl.java - 使用配置类

**预计工作量**: 0.5天
**风险等级**: 低
**优先级**: P1
**预期收益**: 统一配置管理，便于维护和调整

---

## 五、硬件系统任务（2项，预计5天）

**背景**: 硬件设备管理系统存在架构问题和类型不匹配bug

### 硬件1: 修复IsapiDevice.equipment_id类型不匹配bug

**问题描述**:
- IsapiDevice.equipment_id 类型为 String
- FactoryEquipment.id 类型为 Long
- 导致外键关联失败

**实施内容**:
1. 修改 IsapiDevice.java 的 equipment_id 字段类型从 String 改为 Long
2. 更新数据库表结构
3. 修改相关查询和DTO转换逻辑
4. 验证设备关联功能

**需要修改的文件**:
- entity/IsapiDevice.java - 修改字段类型
- 数据库迁移脚本 - ALTER TABLE

**数据库修改**: ALTER TABLE isapi_devices MODIFY COLUMN equipment_id BIGINT

**预计工作量**: 0.5天
**风险等级**: 中（需要数据迁移）
**优先级**: P1（Bug修复）

---

### 硬件2: 硬件系统测试框架实现

**目标**: 实现完整的硬件设备管理测试覆盖

**测试范围**:
- **单元测试**: 65个测试用例
  - 电子秤协议解析测试（15个）
  - ISAPI相机控制测试（20个）
  - 设备管理服务测试（30个）

- **集成测试**: 45个测试用例
  - 设备注册和配置流程（10个）
  - 实时数据采集流程（10个）
  - 设备状态监控流程（10个）
  - 设备告警流程（10个）
  - 设备维护流程（5个）

**涉及测试文件**（新建）:
- ScaleProtocolParserTest.java - 电子秤协议解析
- IsapiClientTest.java - ISAPI客户端测试
- DeviceManagementServiceTest.java - 设备管理服务
- DeviceIntegrationFlowTest.java - 集成测试（已完成）

**预计工作量**: 4.5天
**风险等级**: 低
**优先级**: P1

---

## 六、IoT完整解决方案（3项，预计2天）

**背景**: 当前MQTT订阅器仅做原始数据转发，缺乏业务逻辑处理和持久化存储

### 设备类型覆盖

| 设备类型 | DeviceType | 数据类型 | 用途 |
|----------|------------|----------|------|
| 电子秤 | SCALE | WEIGHT | 原料入库、成品出库称重 |
| 温度传感器 | SENSOR | TEMPERATURE | 冷链监控、仓库环境 |
| 湿度传感器 | SENSOR | HUMIDITY | 仓库环境监控 |
| 摄像头 | CAMERA | IMAGE/EVENT | 生产过程监控、质量抽检 |
| 边缘网关 | GATEWAY | HEARTBEAT | 设备汇聚、协议转换 |

---

### IoT-1: Entity + Repository 创建（1天）

**实施内容**: 创建IoT设备管理和数据存储的基础实体和数据访问层

**IotDevice 实体**:
- 设备基本信息（ID、编码、类型、工厂ID）
- 关联信息（关联设备、协议配置）
- 状态信息（在线状态、最后心跳时间）

**IotDeviceData 实体**:
- 数据记录信息（设备ID、数据类型、数据值）
- 时间戳（采集时间、接收时间）
- 业务关联（是否已处理、关联生产批次）

**枚举定义**:
- DeviceType: SCALE/SENSOR/CAMERA/GATEWAY
- DeviceStatus: ONLINE/OFFLINE/ERROR/MAINTENANCE
- DataType: WEIGHT/TEMPERATURE/HUMIDITY/IMAGE/HEARTBEAT

**Repository 接口**:
- IotDeviceRepository: 设备查询、按工厂查询、按类型查询、按状态查询
- IotDeviceDataRepository: 数据查询、最近数据查询、按类型查询

**预计工作量**: 1天
**风险等级**: 低
**优先级**: P2

---

### IoT-2: Service 层实现（0.5天）

**实施内容**: 实现IoT数据处理和设备管理的服务层

**IotDataService 接口**:

**设备数据管理**:
- 保存设备数据（通用方法）
- 查询设备最近数据
- 按数据类型查询

**设备状态管理**:
- 更新设备状态（ONLINE/OFFLINE/ERROR）
- 更新设备心跳（同时更新在线状态）
- 获取设备信息

**设备关联更新**:
- 更新 FactoryEquipment 最后称重值

**阈值告警检查**:
- 检查温度阈值（冷链: -18°C, 常温: 0-25°C）
- 检查湿度阈值（仓库: 40%-70%）

**告警管理**:
- 创建设备告警
- 处理设备离线告警（心跳超时）

**关键逻辑**:
1. 设备数据存储: 保存到 iot_device_data 表，记录采集时间和接收时间
2. 设备状态同步: 更新 iot_devices.status 和 last_heartbeat
3. 关联更新: 更新 FactoryEquipment.lastWeightReading 和 lastWeightTime
4. 阈值检查: 温度、湿度超阈值时创建告警
5. 离线检测: 心跳超时检测并触发离线告警

**预计工作量**: 0.5天
**风险等级**: 中
**优先级**: P2

---

### IoT-3: MqttSubscriber 业务逻辑扩展（0.5天）

**实施内容**: 在现有MQTT订阅器中添加业务处理逻辑

**handleWeightData 称重数据处理**:
- 存储到 iot_device_data 表
- 更新 FactoryEquipment.lastWeightReading
- 如果稳定，可触发自动入库流程（可选）

**handleTemperatureData 温度数据处理**:
- 存储数据
- 阈值检查（冷链、常温区间）

**handleHumidityData 湿度数据处理**:
- 存储数据
- 阈值检查（仓库湿度范围）

**handleCameraData 摄像头数据处理**:
- 存储数据
- 如果是异常事件，创建告警

**handleDeviceStatus 设备状态更新**:
- 更新设备状态

**handleHeartbeat 心跳处理**:
- 更新心跳时间并设置为在线

**预计工作量**: 0.5天
**风险等级**: 低
**优先级**: P2

---

## 七、ISAPI智能分析实现（3个阶段，预计4天）

**背景**: Hikvision ISAPI相机支持智能分析功能（行为检测、入侵检测、人脸检测）

### ISAPI阶段1: 后端API实现（2天）

**实施内容**:
1. 创建SmartAnalysisDTO数据模型
2. 实现XML解析器（ISAPI使用XML格式）
3. 扩展IsapiClient支持智能分析接口
4. 创建IsapiSmartAnalysisService服务
5. 创建IsapiSmartAnalysisController控制器

**新建文件**:
- dto/camera/SmartAnalysisDTO.java
- dto/camera/LineDetectionConfig.java
- dto/camera/FieldDetectionConfig.java
- dto/camera/FaceDetectionConfig.java
- service/IsapiSmartAnalysisService.java
- service/impl/IsapiSmartAnalysisServiceImpl.java
- controller/IsapiSmartAnalysisController.java

**修改文件**: client/IsapiClient.java - 增加智能分析方法

**预计工作量**: 2天
**风险等级**: 中
**优先级**: P2

---

### ISAPI阶段2: 前端配置界面（1.5天）

**实施内容**:
1. 创建智能分析配置屏幕
2. 实现区域绘制组件（绘制检测线/区域）
3. 集成API客户端
4. 实现配置保存和验证

**新建文件**:
- screens/IsapiSmartConfigScreen.tsx
- components/camera/RegionDrawer.tsx
- components/camera/LineDrawer.tsx
- services/api/isapiSmartAnalysisApi.ts

**依赖库**:
- react-native-svg（绘制区域）
- react-native-gesture-handler（手势交互）

**预计工作量**: 1.5天
**风险等级**: 中
**优先级**: P2

---

### ISAPI阶段3: AI意图扩展（0.5天）

**实施内容**:
1. 增加智能分析相关意图（配置行为检测、查询检测记录）
2. 实现意图处理器
3. 集成到现有AI意图识别系统

**新增意图**:
- ISAPI_CONFIG_LINE_DETECTION - 配置行为检测
- ISAPI_CONFIG_FIELD_DETECTION - 配置区域入侵
- ISAPI_QUERY_DETECTION_EVENTS - 查询检测事件

**预计工作量**: 0.5天
**风险等级**: 低
**优先级**: P2

---

## 八、集成测试任务（7项，预计14天）

**当前进度**: 2/8 测试文件已完成（25%）
**已完成**: AlertSystemFlowTest, DeviceIntegrationFlowTest
**待完成**: 6个测试文件 + 测试运行调试

---

### 测试1: MaterialBatchFlowTest.java（原料批次流程测试）

**测试场景**（10个测试用例）:
1. 原料批次登记（供应商、批次号、数量、质检报告）
2. 入库记录和库位分配
3. 原料库存查询和统计
4. 批次追溯信息记录
5. 原料过期预警
6. 批次质检状态管理
7. 原料消耗记录
8. 库存盘点流程
9. 批次合并和拆分
10. 原料退货处理

**涉及服务**:
- MaterialBatchService - 原料批次服务
- InventoryService - 库存服务
- QualityCheckService - 质检服务
- SupplierService - 供应商服务

**文件路径**: backend-java/src/test/java/com/cretas/aims/integration/MaterialBatchFlowTest.java
**预计代码行数**: 约300行
**预计工作量**: 2天

---

### 测试2: ProductionProcessFlowTest.java（生产加工流程测试）

**测试场景**（12个测试用例）:
1. 生产计划创建和调度
2. 原料领料和投料
3. 生产过程记录（温度、时间、设备）
4. 半成品质检
5. 成品入库
6. 批次转换率计算
7. 生产异常记录
8. 设备使用记录
9. 生产进度追踪
10. 生产成本核算
11. 生产计划调整
12. 紧急插单处理

**涉及服务**:
- ProductionPlanService - 生产计划服务
- ProcessingService - 生产加工服务
- MaterialConsumptionService - 原料消耗服务
- EquipmentManagementService - 设备管理服务

**文件路径**: backend-java/src/test/java/com/cretas/aims/integration/ProductionProcessFlowTest.java
**预计代码行数**: 约350行
**预计工作量**: 2天

---

### 测试3: QualityInspectionFlowTest.java（质检流程测试）

**测试场景**（10个测试用例）:
1. 原料入厂检验
2. 过程质量控制
3. 成品出厂检验
4. 质检报告生成
5. 不合格品处理流程
6. 质检数据统计分析
7. 质检标准配置
8. 抽检计划管理
9. 质检结果审核
10. 质检异常预警

**涉及服务**:
- QualityCheckService - 质检服务
- QualityReportService - 质检报告服务
- DisposalService - 不合格品处置服务
- AlertService - 告警服务

**文件路径**: backend-java/src/test/java/com/cretas/aims/integration/QualityInspectionFlowTest.java
**预计代码行数**: 约300行
**预计工作量**: 2天

---

### 测试4: ShipmentTraceabilityFlowTest.java（出货溯源流程测试）

**测试场景**（10个测试用例）:
1. 出货订单创建
2. 批次分配和标签打印
3. 出货检验记录
4. 物流信息录入
5. 溯源码生成和查询
6. 全链路追溯查询（从原料到成品）
7. 召回批次定位
8. 客户质量反馈
9. 出货记录查询
10. 溯源报告导出

**涉及服务**:
- ShipmentService - 出货服务
- TraceabilityService - 溯源服务
- LabelService - 标签服务
- RecallService - 召回服务

**文件路径**: backend-java/src/test/java/com/cretas/aims/integration/ShipmentTraceabilityFlowTest.java
**预计代码行数**: 约320行
**预计工作量**: 2天

---

### 测试5: AIIntentRecognitionFlowTest.java（AI意图识别流程测试）

**测试场景**（10个测试用例）:
1. 用户意图识别准确性
2. 关键词匹配测试
3. 语义缓存命中率
4. 多轮对话上下文
5. 意图配置管理
6. LLM降级处理
7. 意图执行结果验证
8. 错误意图处理
9. 意图版本回滚
10. 自学习关键词更新

**涉及服务**:
- AIIntentService - AI意图服务
- SemanticCacheService - 语义缓存服务
- LlmIntentFallbackClient - LLM降级客户端
- IntentHandlerService - 意图处理服务

**文件路径**: backend-java/src/test/java/com/cretas/aims/integration/AIIntentRecognitionFlowTest.java
**预计代码行数**: 约280行
**预计工作量**: 2天

---

### 测试6: AttendanceWorkTimeFlowTest.java（考勤工时流程测试）

**测试场景**（10个测试用例）:
1. 员工打卡签到/签退
2. 考勤异常记录
3. 加班申请和审批
4. 请假申请流程
5. 工时统计报表
6. 排班计划管理
7. 考勤规则配置
8. 迟到早退统计
9. 考勤数据导出
10. 月度考勤汇总

**涉及服务**:
- AttendanceService - 考勤服务
- WorkTimeService - 工时服务
- LeaveService - 请假服务
- ShiftService - 排班服务

**文件路径**: backend-java/src/test/java/com/cretas/aims/integration/AttendanceWorkTimeFlowTest.java
**预计代码行数**: 约250行
**预计工作量**: 2天

---

### 测试7: 运行测试并修复问题

**任务内容**:
1. 执行完整测试套件
2. 修复失败的测试用例
3. 检查测试覆盖率
4. 验证事务回滚正确性
5. 确认Mock服务工作正常
6. 生成测试报告
7. 记录已知问题和改进建议

**执行步骤**:
- 第1步: 运行所有集成测试
- 第2步: 分析失败原因
- 第3步: 逐一修复问题
- 第4步: 重新运行验证
- 第5步: 生成覆盖率报告
- 第6步: 文档化测试结果

**预计工作量**: 2天
**注意事项**: 可能发现服务层bug，需要额外修复时间

---

## 九、P2 系统优化任务（4项，预计6天）

### P2-1: 增强查询/更新区分度

**当前问题**: BATCH_QUERY与BATCH_UPDATE混淆

**方案**: 调整操作类型权重，从±20/25调整为±30

**需要修改的文件**: AIIntentServiceImpl.java

**预计工作量**: 0.5天
**风险等级**: 低
**优先级**: P2

---

### P2-2: 添加错误信息脱敏

**问题**: 异常堆栈信息直接返回用户

**修复**:
- 日志保留详情
- 用户看到友好提示
- 增加错误码

**需要修改的文件**: 所有Handler的异常处理

**预计工作量**: 1.5天
**风险等级**: 低
**优先级**: P2

---

### P2-3: 补充关键词配置

**缺失关键词**:
- ATTENDANCE_TODAY 缺失关键词
- CLOCK_IN/CLOCK_OUT 需要补充

**实施方案**: 新建数据库迁移脚本

**需要新建的文件**: V2026_01_05_10__fix_missing_keywords.sql

**预计工作量**: 0.5天
**风险等级**: 低
**优先级**: P2

---

### P2-4: JAR包精简优化

**目标**: 将 JAR 从 211MB 减少到 约180-190MB

**保留的平台**:
- osx-x64 - macOS Intel 本地开发
- osx-aarch64 - macOS M1/M2 本地开发
- linux-x64 - 服务器部署

**排除的原生库**:
- ONNX win-x64 - 约15MB
- ONNX linux-aarch64 - 约13MB
- DJL Tokenizers win - 约3MB
- 合计节省约30MB

**实施步骤**:
1. 修改 pom.xml 配置（移除 macOS 排除规则）
2. 构建精简版 JAR
3. 验证 JAR 大小
4. 部署到服务器
5. 验证功能（检查 DJL Embedding Client 初始化，测试语义匹配）

**预计工作量**: 0.5天
**风险等级**: 低
**优先级**: P2

---

## 📊 工作量汇总

### P0紧急任务
| 任务名称 | 工作量 | 风险等级 | 优先级 |
|---------|--------|---------|--------|
| 多租户缓存隔离漏洞修复 | 1天 | 低 | P0 |
| Handler层工厂隔离漏洞修复 | 1.5天 | 中 | P0 |
| AIIntentConfig实体工厂隔离 | 0.5天 | 低 | P0 |
| 跨关键词操作类型识别 | 0.5天 | 低 | P0 |
| Python服务数据操作解析端点 | 0.5天 | 低 | P0 |
| 扩展自学习机制支持用户纠正 | 1天 | 中 | P0 |
| **小计** | **5天** | | |

### P1任务
| 任务名称 | 工作量 | 风险等级 | 优先级 |
|---------|--------|---------|--------|
| 修复FAILED意图问题 | 1天 | 低 | P1 |
| 扩展参数提取能力 | 2天 | 中 | P1 |
| Handler改造+语义缓存 | 4天 | 中 | P1 |
| 对话状态管理器 | 5天 | 中 | P1 |
| LLM自动修复机制 | 3天 | 高 | P1 |
| 更新架构文档 | 1天 | 低 | P1 |
| VectorUtils+清理废弃代码 | 0.5天 | 低 | P1 |
| KeywordLearningService | 1天 | 中 | P1 |
| RequestScopedEmbeddingCache | 1天 | 中 | P1 |
| IntentMatchingConfig | 0.5天 | 低 | P1 |
| 修复设备ID类型bug | 0.5天 | 中 | P1 |
| 硬件系统测试框架 | 4.5天 | 低 | P1 |
| **小计** | **24天** | | |

### P2任务
| 任务名称 | 工作量 | 风险等级 | 优先级 |
|---------|--------|---------|--------|
| IoT完整解决方案 | 2天 | 中 | P2 |
| ISAPI智能分析 | 4天 | 中 | P2 |
| 集成测试任务 | 14天 | 低 | P2 |
| 增强查询/更新区分度 | 0.5天 | 低 | P2 |
| 添加错误信息脱敏 | 1.5天 | 低 | P2 |
| 补充关键词配置 | 0.5天 | 低 | P2 |
| JAR包精简优化 | 0.5天 | 低 | P2 |
| **小计** | **23天** | | |

### 总计
- **总任务数**: 35项
- **总工作量**: 52个工作日
- **预计完成时间**: 10-12周（考虑并行和风险缓冲）

---

## 🚀 建议实施策略

### 阶段1: P0紧急安全修复（Week 1，最高优先级）

**执行顺序**:
1. AIIntentConfig实体工厂隔离（0.5天，风险低）
2. 多租户缓存隔离漏洞修复（1天）
3. Handler层工厂隔离漏洞修复（1.5天）
4. 跨关键词操作类型识别（0.5天）
5. Python服务数据操作解析端点（0.5天）
6. 扩展自学习机制支持用户纠正（1天）

**并行方案**: Python服务端点开发可与Java端修复并行

**预期收益**: 消除严重安全漏洞，修复关键识别bug

---

### 阶段2: 代码重构优先（Week 2，低风险快速交付）

**执行顺序**:
1. VectorUtils + 清理废弃代码（0.5天）
2. IntentMatchingConfig统一配置（0.5天）
3. KeywordLearningService（1天）
4. RequestScopedEmbeddingCache（1天）

**并行方案**: 可单人串行执行，无依赖冲突

**预期收益**:
- 减少约400行重复代码
- 提升Embedding计算性能（2-3次 → 1次）
- 统一配置管理

---

### 阶段3: AI系统优化（Week 3-4）

**执行顺序**:
1. 修复FAILED意图问题（1天）
2. 扩展参数提取能力（2天）
3. Handler改造+语义缓存启用（4天）

**并行方案**: 参数提取能力扩展与Handler改造可部分并行

**预期收益**:
- COMPLETED率提升至85%+
- NEED_INFO降至10%
- FAILED降至5%

---

### 阶段4: 硬件系统修复（Week 2-3）

**执行顺序**:
1. 修复IsapiDevice.equipment_id类型bug（0.5天，P1 Bug）
2. 实现硬件系统测试框架（4.5天）

**并行方案**: 可与代码重构并行（不同代码区域）

---

### 阶段5: 集成测试密集期（Week 4-6）

**并行方案**（3个窗口或3个subagent）:
- **Track 1**: MaterialBatchFlowTest + ProductionProcessFlowTest（业务关联）
- **Track 2**: QualityInspectionFlowTest + ShipmentTraceabilityFlowTest（质检链路）
- **Track 3**: AIIntentRecognitionFlowTest + AttendanceWorkTimeFlowTest（独立功能）

**优势**: 6个测试文件可在3周内完成

---

### 阶段6: P1架构优化（Week 7-8）

**执行顺序**:
1. 更新MAIA架构文档（1天，低风险）
2. 实现对话状态管理器（5天，中风险）
3. 实现LLM自动修复机制（3天，高风险）

**并行方案**: 文档更新可与其他任务并行

---

### 阶段7: IoT与ISAPI（Week 9-10，可选P2功能）

**IoT方案**（2天）:
- IoT-1: Entity + Repository（1天）
- IoT-2: Service 层（0.5天）
- IoT-3: MqttSubscriber 扩展（0.5天）

**ISAPI方案**（4天）:
- 后端API实现（2天）
- 前端配置界面（1.5天）
- AI意图扩展（0.5天）

**并行方案**: IoT与ISAPI可并行开发（不同模块）

---

## 📋 测试编写规范

### 技术要求
- 使用Spring Boot测试框架
- 使用事务自动回滚机制
- 使用测试顺序控制注解
- 使用AssertJ流式断言库
- 使用Builder模式构造测试数据
- Mock外部服务（如消息推送）
- 每个测试文件8-12个测试用例
- 覆盖正常流程和异常场景

### 测试环境配置
- **测试Profile**: application-test.yml
- **数据库**: H2内存数据库或MySQL测试实例
- **事务策略**: 自动回滚，不污染数据库
- **测试常量**: TEST_FACTORY_ID = "F001", TEST_USER_ID = 22L

### Mock服务清单
- PushNotificationService（消息推送服务）
- 其他第三方API调用

---

## ⚠️ 注意事项

### 架构优化任务
1. **对话状态管理器**
   - 需要配置Redis连接
   - 注意会话过期时间设置
   - 考虑高并发场景下的缓存击穿问题

2. **LLM自动修复机制**
   - 需要大量测试验证修复成功率
   - 监控重试次数和API调用成本
   - 设置合理的超时时间

3. **文档更新**
   - 确保架构图准确反映当前设计
   - 记录所有重要决策的背景和理由

### 代码重构任务
1. **确保测试覆盖**: 重构前后运行完整测试套件
2. **增量重构**: 分小批次提交，便于问题定位
3. **向后兼容**: 避免破坏现有API接口

### 硬件系统任务
1. **数据迁移**: IsapiDevice.equipment_id类型修改需要数据迁移脚本
2. **测试覆盖**: 110+测试用例需要充分覆盖硬件协议解析和设备管理

### 集成测试任务
1. **测试隔离性**
   - 确保测试之间无依赖
   - 使用事务回滚保证数据清洁

2. **测试数据管理**
   - 使用Builder模式提高可读性
   - 避免硬编码，使用常量

3. **性能考虑**
   - 测试套件执行时间应控制在10分钟内
   - 必要时使用并行测试

---

## 📌 快速开始指南

### 开始P0安全修复
**第1步**: AIIntentConfig实体增加factoryId字段（最简单，快速见效）
**第2步**: 修复多租户缓存隔离漏洞
**第3步**: 修复Handler层工厂隔离漏洞
**第4步**: 运行测试验证安全性
**第5步**: 继续后续bug修复任务

### 开始代码重构
**第1步**: 创建VectorUtils工具类（最简单，快速见效）
**第2步**: 修改3个文件使用VectorUtils，删除重复代码
**第3步**: 删除EmbeddingClientImpl.java废弃文件
**第4步**: 运行测试验证
**第5步**: 继续后续重构任务

### 开始集成测试
**第1步**: 选择一个测试文件开始（建议从MaterialBatchFlowTest开始）
**第2步**: 了解涉及的服务接口和数据模型
**第3步**: 按照测试规范创建测试类
**第4步**: 编写测试用例（正常流程优先）
**第5步**: 运行测试并验证
**第6步**: 继续下一个测试文件

### 开始架构优化
**第1步**: 阅读MAIA-ARCHITECTURE-PLAN.md了解背景
**第2步**: 更新架构文档（最简单的任务）
**第3步**: 实现对话状态管理器
**第4步**: 实现LLM自动修复机制
**第5步**: 进行充分的测试验证

---

## 🔗 相关文档

### 项目文档
- 项目指南: `/CLAUDE.md`
- PRD文档: `/docs/prd/PRD-完整业务流程与界面设计-v5.0.md`
- Claude Rules: `/.claude/rules/`

### 架构计划
- MAIA架构计划: `/MAIA-ARCHITECTURE-PLAN.md`
- 架构任务详情: `/REMAINING-TASKS.md`（本文档）

### 技术文档
- AI意图识别架构: `.claude/plans/ai-intent-recognition-architecture-v2.md`
- AI意图识别逻辑流程: `.claude/plans/jiggly-dazzling-sparrow.md`
- 代码重构计划: `.claude/plans/peaceful-splashing-feigenbaum.md`
- 硬件系统分析: `.claude/plans/twinkling-stargazing-parnas.md`
- ISAPI智能分析: `.claude/plans/graceful-launching-flamingo.md`

### 测试文档
- 集成测试详情: `/REMAINING_INTEGRATION_TESTS.md`
- 测试规范: `/backend-java/src/test/resources/BUSINESS_FLOW_TEST_PLAN.md`

---

## 🎯 里程碑节点

### Milestone 1: P0安全修复完成（Week 1）
- 多租户缓存隔离漏洞修复
- Handler层工厂隔离漏洞修复
- AIIntentConfig实体工厂隔离
- 跨关键词操作类型识别
- Python服务数据操作解析端点
- 扩展自学习机制支持用户纠正
- **验收标准**: 所有安全漏洞修复，关键bug解决，安全测试通过

### Milestone 2: 代码重构完成（Week 2）
- VectorUtils工具类
- IntentMatchingConfig统一配置
- KeywordLearningService
- RequestScopedEmbeddingCache
- **验收标准**: 所有测试通过，代码减少约400行

### Milestone 3: AI系统优化完成（Week 4）
- 修复FAILED意图问题
- 扩展参数提取能力
- Handler改造+语义缓存启用
- **验收标准**: COMPLETED率≥85%，NEED_INFO≤10%，FAILED≤5%

### Milestone 4: 硬件系统稳定（Week 3）
- IsapiDevice bug修复
- 硬件测试框架（110+用例）
- **验收标准**: 所有硬件测试通过，设备关联功能正常

### Milestone 5: 集成测试全覆盖（Week 6）
- 6个集成测试文件完成
- 测试运行和问题修复
- **验收标准**: 测试覆盖率 ≥ 80%，所有集成测试通过

### Milestone 6: P1架构优化交付（Week 8）
- MAIA架构文档更新
- 对话状态管理器
- LLM自动修复机制
- **验收标准**: 多轮对话功能可用，LLM修复成功率 ≥ 90%

### Milestone 7: IoT与ISAPI完成（Week 10，可选）
- IoT完整解决方案
- ISAPI智能分析
- **验收标准**: IoT数据处理正常，ISAPI智能分析配置可用

---

## 📊 风险评估

### 高风险任务
1. **LLM自动修复机制** - LLM输出不确定性高，需要大量测试
2. **对话状态管理器** - 多轮对话复杂，引用消解准确性难保证
3. **Handler层工厂隔离** - 涉及多个Handler，需充分测试防止数据泄露

**缓解措施**:
- 增加测试覆盖
- 设置降级策略
- 逐步上线，小范围验证

### 中风险任务
1. **IsapiDevice类型修复** - 涉及数据迁移
2. **代码重构** - 可能影响现有功能
3. **AI系统优化** - 参数提取逻辑复杂

**缓解措施**:
- 完整的回归测试
- 增量提交
- 保留回滚方案

### 低风险任务
1. **文档更新**
2. **VectorUtils工具类**
3. **IntentMatchingConfig配置**
4. **补充关键词配置**

**建议**: 优先执行低风险任务，建立信心

---

## 🔄 并行工作建议

### Subagent并行建议
- **可并行**: 代码重构、集成测试、文档更新、IoT开发、ISAPI开发
- **建议策略**:
  - Agent 1: P0安全修复任务（Week 1）
  - Agent 2: 代码重构任务（Week 2）
  - Agent 3: AI系统优化任务（Week 3-4）
  - Agent 4: 集成测试任务（Week 4-6）
  - Agent 5: 架构优化任务（Week 7-8）

### 多Chat窗口并行
- **可并行**: 代码重构 + 硬件系统 + 集成测试 + IoT开发
- **避免冲突**:
  - AIIntentServiceImpl.java 被多个重构任务修改，需串行执行重构部分
  - 集成测试文件相互独立，可完全并行
  - IoT模块与其他任务无文件冲突
  - MqttSubscriber.java 与 IoT-3 独占，避免同时修改

---

**文档版本**: v2.0 (完整版)
**生成时间**: 2026-01-06
**下次更新**: 完成阶段性里程碑后
**维护者**: Claude Code Team
