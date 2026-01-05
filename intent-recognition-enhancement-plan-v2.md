# 意图识别增强方案 V2：确认+Fallback+主动学习（基于GPT-5.2反馈优化）

> ⚠️ **实施状态说明** (2026-01-04 更新)
>
> | 模块 | 状态 | 说明 |
> |------|------|------|
> | Phase 1-4 (确认机制+Fallback+学习) | ✅ 已完成 | 见 `ai相关改造.md` |
> | LangChain 集成 (第八、九章) | ❌ 不实施 | 经评估后认为过度工程，当前系统仅需单轮意图分类，无需复杂 Agent/Chain/Tool 编排 |
>
> 详细评估见 `ai意图问题以及对应解决方案.md` 第五章"不推荐方案"。

## 一、问题解答

### 1.1 TEXTOIR - 新意图发现

**更新评估**：⭐⭐⭐⭐（需要新意图发现时适用）

**适用场景**：
- ✅ 用户频繁使用某些表达但无法匹配到现有意图
- ✅ 需要发现业务中的新需求模式
- ✅ 支持系统的自进化能力

**集成方式**：
1. 定期分析规则匹配失败+LLM兜底的案例
2. 使用TEXTOIR的意图发现算法识别新意图模式
3. 生成新意图建议，管理员审核后添加

**触发条件**：
- 同一类表达累计失败超过N次（如10次）
- LLM解析出新的意图类型（不在现有配置中）
- 用户反馈"都不是"的频率较高

### 1.2 精确中文实体抽取（N-LTP）

**什么是精确中文实体抽取？**

**当前系统**（基于正则表达式）：
- 批次号识别：使用正则表达式匹配固定格式（如"批次001"），无法处理复杂表达
- 人名识别：只能匹配常见姓氏（如张、王、李）的简单人名，无法识别复杂称呼

**精确实体抽取能做什么**：
1. **复杂命名实体识别**：
   - "优质带鱼段500g装" → 识别为产品名称
   - "张三经理" → 识别为人名+职位
   - "山东省青岛市某食品公司" → 识别为地址+机构名

2. **语义角色标注**：
   - "张三把批次B001的产量改成1000"
   - → 主体：张三，动作：改，对象：批次B001，属性：产量，值：1000

**何时需要**：
- 用户输入包含复杂中文产品描述、地名、人名等
- 当前正则表达式无法准确匹配，导致实体提取失败
- 需要支持更自然的中文表达

### 1.3 LangChain - 复杂LLM工作流

**什么是LangChain**：一个用于构建复杂LLM应用的框架，支持工具调用、Agent能力、链式推理等。

**何时需要**：
- 需要多次LLM调用的链式推理
- 需要工具调用（查数据库、API等外部工具）
- 需要Agent能力（LLM自主决策和选择操作）
- 需要复杂的Prompt管理和多轮对话

**当前判断**：对于简单的意图识别和实体抽取，当前不需要LangChain。详细分析见第八章"多轮对话需求分析"和第九章"LangChain集成方案"。

## 二、确认策略优化（基于GPT-5.2反馈）

### 2.1 核心原则：不要每次都确认

**关键改进**：
- ❌ **错误做法**：每次都问"您是想XXX吗？"
- ✅ **正确做法**：只在不确定/高风险时确认

### 2.2 三层决策逻辑

#### 第一层：系统自己做（不调用LLM）

**包括**：
- ✅ 规则匹配（关键词/正则）得到一个"最可能意图"
- ✅ 权限检查、敏感度判断、是否需要审批/确认的判断
- ✅ 这些都是"确定性逻辑"，不需要LLM

#### 第二层：调用LLM（结构化解析）

**当前已有的两类**：
1. **DATA_OP**：需要LLM把自然语言解析成"要改哪个实体、改哪些字段、改成什么值"
2. **FORM**：需要LLM把自然语言解析成"要新增/修改哪些字段、类型、校验规则"等

**特点**：把话翻译成结构化动作，LLM很合适

#### 第三层：不调用LLM但仍可能失败

**两种情况**：
1. 规则匹配没命中：直接"未识别"
2. 匹配命中了但该分类没有可执行处理链路：会"暂不支持"

### 2.3 置信度/歧义触发确认（核心改进）

#### 强信号 → 直接执行（无需确认）

**条件（同时满足）**：
- ✅ 命中关键词数量 >= 3
- ✅ 领先第二名很多（top1置信度 - top2置信度 > 0.3）
- ✅ 意图优先级 >= 80（高优先级）
- ✅ 命中词明确且具体（不是泛化词）

**示例**：
- 用户输入："把批次BATCH-001的计划产量改成1000"
- 匹配：QUANTITY_ADJUST（命中"批次"、"产量"、"改成"、"1000"，置信度0.95）
- 结果：直接进入后续处理（DATA_OP可直接进入预览或执行）

#### 弱信号 → 弹出澄清（候选意图选择）

**条件（满足其一）**：
- ⚠️ 只命中1个泛化词（如"改"、"调整"、"把"）
- ⚠️ 多个意图分数接近（top2置信度差 < 0.1）
- ⚠️ 命中的词太通用

**澄清方式**：给用户2~3个候选意图让他选（或"都不是"）

**示例**：
- 用户输入："调整一下"
- 匹配：QUANTITY_ADJUST(0.55)、BATCH_UPDATE(0.52)、STATUS_CHANGE(0.48)
- 澄清："请选择您的意图：1)调整数量 2)更新批次信息 3)变更状态 4)都不是"

#### 低置信度 → 直接Fallback

**条件**：
- ❌ 置信度 < 0.5
- ❌ 规则匹配失败（未匹配到任何意图）

### 2.4 高风险意图永远需要确认

**条件**：
- 🔒 敏感度级别 = HIGH 或 CRITICAL
- 🔒 意图分类 = DATA_OP 或 SYSTEM（数据操作或系统配置）

**流程**：
1. 先预览（告诉用户将修改什么）
2. 用户确认
3. 再执行

**示例**：
- 用户输入："批量删除这些批次"
- 匹配：BATCH_DELETE（CRITICAL级别）
- 预览："⚠️ 将删除以下批次：[批次列表]，此操作不可恢复"
- 必须用户确认才能继续

### 2.5 用户否认才走LLM兜底

**流程**：
1. 用户点"不是/都不是/我不是这个意思"
2. 调用LLM做"意图分类/重路由"（不是直接执行）
3. LLM给出：
   - 更合适的意图类别
   - 置信度
   - 需要的补充信息（缺少批次号/产品编号等）
4. 如果仍然不确定：继续问一个最小澄清问题（例如"您要改的是批次还是产品？"）

## 三、澄清问题设计（不是简单问"对不对"）

### 3.1 澄清问题类型

#### 类型1：候选意图选择

**格式要求**：
澄清文本以"请选择您的意图："开头，后面依次列出2-3个候选意图，每个意图包含编号、意图名称和简短示例，最后提供"都不是"选项。格式为：编号后跟右括号，然后是意图名称，接着是短横线和示例文本。

**格式模板**：
- 开头："请选择您的意图："
- 选项1："1) [意图1名称] - [简短示例]"
- 选项2："2) [意图2名称] - [简短示例]"
- 选项3："3) [意图3名称] - [简短示例]"
- 最后："4) 都不是"

**示例**：
- 用户输入："调整一下"
- 澄清："请选择您的意图：1)调整数量 - 例如：把产量改成1000  2)更新批次信息 - 例如：修改批次状态  3)变更状态 - 例如：完成批次  4)都不是"

#### 类型2：补充信息询问

**格式要求**：
澄清文本以"要[意图名称]，请提供[缺失信息]："开头，后面给出示例，格式为"例如：[示例]"。

**格式模板**：
- "要[意图名称]，请提供[缺失信息]："
- "例如：[示例]"

**示例**：
- 用户输入："改成1000"（缺少批次号）
- 澄清："要调整数量，请提供批次号：例如：BATCH-001"

#### 类型3：歧义澄清

**格式要求**：
澄清文本以"请确认："开头，后面列出两个可能的理解，用"还是"连接，最后以问号结尾。

**格式模板**：
- "请确认：[可能的理解1] 还是 [可能的理解2]？"

**示例**：
- 用户输入："改一下"
- 澄清："请确认：修改批次信息 还是 修改产品信息？"

### 3.2 澄清问题设计原则

1. **最小化问题**：只问最关键的歧义点
2. **提供示例**：每个选项都给出具体示例
3. **允许跳过**：提供"都不是"选项
4. **上下文感知**：基于之前的对话历史

## 四、记录字段完善（基于GPT-5.2反馈）

### 4.1 关键记录字段（确保可复盘）

**必须记录的信息**：

1. **原始输入**
   - 用户输入的完整文本
   - 用户角色/工厂（用于发现不同角色话术差异）

2. **规则匹配详情**
   - Top-N候选意图（含各自命中分数/命中词）
   - 匹配方法（KEYWORD/REGEX）
   - 置信度分数

3. **用户交互**
   - 系统给的澄清问题/候选项
   - 用户的选择（确认/否认/选择哪个）
   - 澄清轮次

4. **LLM兜底信息**（如果触发）
   - LLM输出的意图
   - LLM的置信度
   - LLM建议的补充信息

5. **执行结果**
   - 最终执行的意图
   - 是否执行成功
   - 失败原因（缺少标识、权限不足、LLM解析失败等）

### 4.2 错误归因分析

**每周/每两周做一次错误归因**：

#### 1. 规则漏召回
**现象**：用户用了新同义词/新说法 → 规则匹配失败

**解决方案**：
- 补关键词
- 补正则
- 补同义词表

**示例**：
- 失败案例："调一下产量"
- 分析：用户用了"调"而不是"调整"
- 优化：在QUANTITY_ADJUST的关键词中添加"调"

#### 2. 规则误召回
**现象**：泛化词导致误命中

**解决方案**：
- 降低泛化词权重
- 加负例条件
- 提高需要命中的关键实体词门槛

**示例**：
- 失败案例："看一下"被误识别为QUANTITY_ADJUST（因为包含"看"字？）
- 分析：泛化词"看"导致误命中
- 优化：提高QUANTITY_ADJUST需要匹配的关键词数量（从1个提高到2个）

#### 3. 表达歧义
**现象**：本来就一语多义

**解决方案**：
- 保留为"必须澄清"的场景
- 不要硬靠规则或LLM猜
- 设计更好的澄清问题

**示例**：
- 用户输入："改一下"
- 分析：本身就有歧义（改什么？）
- 优化：为这类表达设计多轮澄清流程

## 五、日志字段表（更新版）

### 5.1 意图匹配记录表（intent_match_records）

**表名**：intent_match_records  
**用途**：记录每次意图识别的完整过程，包括规则匹配结果、澄清交互、LLM兜底信息、执行结果等，用于错误归因分析和规则优化。

**字段列表**：

**主键**：
- `id`：字符串类型（36字符），主键，唯一标识每条记录

**用户输入信息**：
- `user_input`：文本类型，必填，存储用户原始输入内容
- `user_input_length`：整数类型，记录输入文本长度
- `factory_id`：字符串类型（50字符），必填，工厂ID
- `user_id`：长整型，用户ID
- `user_role`：字符串类型（50字符），用户角色
- `session_id`：字符串类型（50字符），会话ID，用于多轮对话关联

**规则匹配结果**：
- `top_candidates`：JSON类型，必填，存储Top-N候选意图及分数。格式示例：包含多个对象，每个对象包含意图代码、匹配分数、置信度、匹配到的关键词列表。例如：意图代码为QUANTITY_ADJUST时，分数为3，置信度为0.75，匹配的关键词包括"调整"、"数量"、"产量"
- `matched_intent_code`：字符串类型（50字符），最终匹配的意图代码
- `matched_intent_name`：字符串类型（100字符），意图名称
- `matched_intent_category`：字符串类型（50字符），意图分类（如DATA_OP、FORM等）
- `match_method`：字符串类型（20字符），匹配方法：KEYWORD（关键词匹配）、REGEX（正则匹配）、LLM（LLM解析）
- `match_score`：整数类型，关键词匹配分数
- `confidence_score`：小数类型（5位整数，4位小数），置信度分数，范围0-1
- `priority`：整数类型，意图优先级
- `sensitivity_level`：字符串类型（20字符），敏感度级别（如LOW、MEDIUM、HIGH、CRITICAL）

**匹配详情**：
- `matched_keywords`：JSON类型，匹配到的关键词列表
- `matched_regex`：字符串类型（500字符），匹配到的正则表达式（如果使用正则匹配）
- `is_strong_signal`：布尔类型，是否为强信号（可直接执行，无需确认）
- `is_ambiguous`：布尔类型，是否歧义（需要澄清）

**澄清交互信息**：
- `clarification_required`：布尔类型，是否需要澄清
- `clarification_question`：文本类型，系统给用户的澄清问题
- `clarification_options`：JSON类型，澄清选项（如果是候选选择类型）。格式示例：包含多个对象，每个对象包含选项编号、意图代码、标签、示例。例如：选项1对应QUANTITY_ADJUST意图，标签为"调整数量"，示例为"把产量改成1000"
- `clarification_round`：整数类型，默认值为0，澄清轮次
- `user_selection`：整数类型，用户选择的选项编号（如果是候选选择）
- `user_confirmed`：布尔类型，用户是否确认
- `user_denied`：布尔类型，用户是否否认
- `user_feedback_time`：日期时间类型，用户反馈时间

**LLM兜底信息**（如果触发了LLM解析）：
- `llm_called`：布尔类型，默认值为false，是否调用了LLM
- `llm_called_reason`：字符串类型（100字符），调用LLM的原因：LOW_CONFIDENCE（低置信度）、USER_DENIAL（用户否认）、NO_MATCH（无匹配）等
- `llm_parsed_intent_code`：字符串类型（50字符），LLM解析出的意图代码
- `llm_parsed_intent_name`：字符串类型（100字符），LLM解析出的意图名称
- `llm_confidence`：小数类型（5位整数，4位小数），LLM解析的置信度
- `llm_suggested_missing_info`：JSON类型，LLM建议的缺失信息。格式示例：包含缺失字段列表和建议文本。例如：缺失字段为"批次号"，建议为"请提供批次号，例如：BATCH-001"
- `llm_response_time_ms`：整数类型，LLM响应时间（毫秒）
- `llm_cost`：小数类型（10位整数，6位小数），LLM调用成本

**执行结果**：
- `execution_status`：字符串类型（20字符），执行状态：SUCCESS（成功）、FAILED（失败）、PENDING_APPROVAL（待审批）、NOT_EXECUTED（未执行）
- `execution_result`：JSON类型，执行结果详情
- `execution_error_type`：字符串类型（50字符），错误类型：MISSING_IDENTIFIER（缺少标识符）、PERMISSION_DENIED（权限不足）、LLM_PARSE_FAILED（LLM解析失败）等
- `execution_error_message`：文本类型，错误消息详情
- `execution_time_ms`：整数类型，执行耗时（毫秒）

**学习标记**：
- `is_learning_case`：布尔类型，默认值为false，是否为学习案例（规则匹配失败但LLM成功解析的情况）
- `error_attribution`：字符串类型（50字符），错误归因类型：MISSING_RECALL（规则漏召回）、FALSE_POSITIVE（规则误召回）、AMBIGUITY（表达歧义）等
- `optimization_suggestion_id`：字符串类型（36字符），关联的优化建议ID

**时间戳**：
- `created_at`：日期时间类型，默认值为当前时间，记录创建时间
- `updated_at`：日期时间类型，默认值为当前时间，每次更新时自动更新，记录最后更新时间

**索引**：
- `idx_factory_user`：工厂ID和用户ID的联合索引
- `idx_intent_code`：意图代码索引
- `idx_match_method`：匹配方法索引
- `idx_confidence`：置信度分数索引
- `idx_learning_case`：学习案例标记索引
- `idx_error_attribution`：错误归因类型索引
- `idx_created_at`：创建时间索引
- `idx_session`：会话ID索引

**表配置**：使用InnoDB存储引擎，字符集为utf8mb4，排序规则为utf8mb4_unicode_ci

### 5.2 错误归因统计表（error_attribution_statistics）

**表名**：error_attribution_statistics  
**用途**：按意图代码、错误归因类型、日期统计错误次数，存储错误样本和优化建议，用于规则优化和效果跟踪。

**字段列表**：

**主键**：
- `id`：字符串类型（36字符），主键，唯一标识每条记录

**统计维度**：
- `intent_code`：字符串类型（50字符），意图代码（如果错误与特定意图相关）
- `error_attribution`：字符串类型（50字符），必填，错误归因类型（如MISSING_RECALL、FALSE_POSITIVE、AMBIGUITY等）
- `date`：日期类型，必填，统计日期

**统计数据**：
- `total_errors`：整数类型，默认值为0，总错误次数
- `error_samples`：JSON类型，错误样本（前10个）。格式示例：包含多个对象，每个对象包含用户输入和错误原因。例如：用户输入为"调一下产量"时，原因为"用了新同义词'调'"；用户输入为"看一下"时，原因为"泛化词'看'导致误命中"

**优化建议**：
- `suggested_keywords`：JSON类型，建议添加的关键词列表
- `suggested_regex`：JSON类型，建议添加的正则表达式列表
- `suggested_negative_examples`：JSON类型，建议添加的负例列表（用于减少误召回）

**优化效果**：
- `improvement_rate`：小数类型（5位整数，4位小数），改进率（优化后的效果提升百分比）

**时间戳**：
- `created_at`：日期时间类型，默认值为当前时间，记录创建时间
- `updated_at`：日期时间类型，默认值为当前时间，每次更新时自动更新，记录最后更新时间

**索引**：
- `uk_intent_attribution_date`：唯一索引，基于意图代码、错误归因类型、统计日期的联合唯一约束（同一意图同一错误类型同一日期只能有一条统计记录）
- `idx_date`：统计日期索引

**表配置**：使用InnoDB存储引擎，字符集为utf8mb4，排序规则为utf8mb4_unicode_ci

## 六、实施优先级（更新）

### Phase 1：基础确认机制（1-2周）
1. ✅ 实现置信度计算（包含Top-N候选）
2. ✅ 实现强信号/弱信号判断
3. ✅ 实现候选意图澄清（不是简单问"对不对"）
4. ✅ 记录完整匹配信息（Top-N候选、澄清问题、用户选择）

### Phase 2：智能确认策略（1周）
1. ✅ 实现高风险意图强制确认+预览
2. ✅ 实现低置信度直接Fallback
3. ✅ 实现用户否认后的LLM重路由

### Phase 3：Fallback和学习机制（1-2周）
1. ✅ 实现LLM兜底和记录
2. ✅ 实现学习案例标记
3. ✅ 实现错误归因分析

### Phase 4：规则优化系统（2-3周）
1. ⏳ 实现每周自动错误归因分析
2. ⏳ 实现规则优化建议生成
3. ⏳ 实现管理员审核和自动更新

---

## 十、实施进度跟踪

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
| B3 候选意图选择UI | ⏳ 待开始 | 前端交互组件 (需前端开发配合) |
| B4 澄清问题生成 | ✅ 已完成 | `generateClarificationQuestion()` 调用 LLM + 模板降级 |
| B5 意图匹配记录埋点 | ✅ 已完成 | `saveIntentMatchRecord()` 在所有返回路径记录 |

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

### Phase C: 学习机制 ⏳ 待开始

| 任务 | 状态 | 预计内容 |
|------|------|----------|
| C1 错误归因统计表 | ⏳ 待开始 | 按意图/日期/错误类型聚合 |
| C2 定期分析任务 | ⏳ 待开始 | 每周自动分析失败案例 |
| C3 优化建议报告 | ⏳ 待开始 | 自动生成规则优化建议 |

## 七、关键改进点总结

### 7.1 不要每次都确认
- ✅ 强信号直接执行
- ✅ 弱信号才澄清
- ✅ 低置信度直接Fallback

### 7.2 澄清问题不是简单问"对不对"
- ✅ 提供2-3个候选意图让用户选
- ✅ 每个选项给出示例
- ✅ 允许"都不是"

### 7.3 记录要足够可复盘
- ✅ 记录Top-N候选意图
- ✅ 记录澄清问题和用户选择
- ✅ 记录LLM兜底信息
- ✅ 记录错误归因

### 7.4 错误归因要定期做
- ✅ 规则漏召回 → 补关键词/正则
- ✅ 规则误召回 → 降低泛化词权重/加负例
- ✅ 表达歧义 → 保留为必须澄清场景

## 八、多轮对话需求分析与方案选择

### 8.1 当前系统能力

**已有能力**：
- ✅ Session管理（session_id、对话历史）
- ✅ 对话历史持久化（Redis、AsyncStorage）
- ✅ 简单的多轮对话支持（follow-up）

### 8.2 需求层次分析

#### 层次1：简单多轮对话（直接对接Qwen API即可）⭐推荐

**需求**：
- 维护对话历史（之前说了什么）
- 上下文理解（"改成1000"需要知道前面说过"要改产量"）

**Qwen API原生支持**：
- ✅ Qwen API原生支持messages数组（包含role: system/user/assistant）
- ✅ 可以传入历史消息，模型会自动理解上下文
- ✅ 简单、直接、性能好、成本低

**实现方式**：
- 使用现有的session管理机制（Redis或数据库存储对话历史）
- 在调用Qwen API时传入完整的messages数组（包含历史对话）
- 每次对话后更新session中的对话历史
- 对话历史包含role: system/user/assistant的消息序列

**适用场景**：
- ✅ 简单的上下文记忆
- ✅ 单次LLM调用
- ✅ 不需要复杂的工具调用
- ✅ **满足80%的多轮对话需求**

**结论**：**对于简单到中等复杂度的多轮对话，直接对接Qwen API完全够用！** ⭐

#### 层次2：复杂多轮对话（需要LangChain）

**需求**：
- 多步骤推理链（需要多次LLM调用）
- 工具调用（需要调用数据库、API等外部工具）
- Agent能力（LLM自主决定下一步操作）
- 复杂的Prompt管理（多模板、动态生成）

**LangChain的价值**：
- ✅ ConversationBufferMemory、ConversationSummaryMemory等记忆管理
- ✅ Tool、Agent工具调用框架
- ✅ Chain、SequentialChain链式调用
- ✅ Retry、Fallback错误处理

**实现方式**：
- 使用LangChain的Agent框架，定义多个工具（Tools）
- 每个工具封装一个数据查询操作（如查询批次信息、查询质量数据等）
- Agent可以根据用户问题自主选择需要调用哪些工具
- 支持多步骤推理链：先调用工具获取数据，再调用LLM分析，最后生成报告
- 使用ConversationBufferMemory或ConversationSummaryMemory管理对话历史

**适用场景**：
- ✅ 需要多次LLM调用（链式推理）
- ✅ 需要工具调用（查数据库、调用API）
- ✅ Agent系统（LLM自主决策）
- ✅ 复杂的Prompt工程

**结论**：**对于复杂多轮对话，LangChain会很有帮助！**

### 8.3 渐进式引入策略（推荐）

#### 阶段1：直接对接Qwen API（当前阶段）⭐推荐

**优点**：
- ✅ 简单直接，无需引入额外框架
- ✅ 性能好（减少中间层）
- ✅ 成本低（不引入额外依赖）
- ✅ 完全满足简单到中等复杂度的多轮对话

**实施步骤**：
1. 使用现有的session管理机制
2. 在调用Qwen API时传入完整messages数组
3. 保存对话历史到Redis或数据库
4. **先实现这个，观察实际需求**

#### 阶段2：按需引入LangChain（如果需要复杂功能）

**触发条件**（满足以下任一条件时）：
1. ✅ 需要多次LLM调用（链式推理）
2. ✅ 需要工具调用（查数据库、API）
3. ✅ 需要Agent能力（LLM自主决策）
4. ✅ 简单的Qwen API对接无法满足需求

**迁移策略**：
- 保留Qwen作为底层LLM
- 使用LangChain的Memory管理对话历史
- 使用LangChain的Agent/Tool处理复杂工作流
- **渐进式迁移，不影响现有功能**

### 8.4 最终建议

**对于多轮对话系统**：

1. **首选：直接对接Qwen API** ⭐⭐⭐⭐⭐
   - 简单、直接、性能好
   - 完全满足简单到中等复杂度的多轮对话
   - 无需引入额外框架
   - **推荐作为第一阶段的实现方案**

2. **按需引入LangChain** ⭐⭐⭐
   - 只在需要复杂功能时引入
   - 工具调用、Agent、链式推理等高级功能
   - 可以渐进式引入，不影响现有代码

3. **混合方案** ⭐⭐⭐⭐
   - 简单场景：直接用Qwen API
   - 复杂场景：使用LangChain包装Qwen API
   - 灵活切换，最佳实践

**实施建议**：
- ✅ **先直接用Qwen API实现多轮对话**（满足80%需求）
- ✅ **观察实际使用情况**（是否需要复杂功能）
- ✅ **按需引入LangChain**（只引入需要的功能，不是全部）

**参考资源**：
- Qwen API文档：https://help.aliyun.com/zh/model-studio/
- LangChain文档：https://python.langchain.com/
- LangChain + Qwen集成：https://python.langchain.com/docs/integrations/llms/qwen

### 8.5 决策树：何时需要LangChain

**判断流程**：

**步骤1：评估多轮对话复杂度**
- 只需要简单的上下文记忆（前面说了什么） → **直接使用Qwen API** ✅
- 需要复杂的对话管理（总结历史、长期记忆） → 考虑LangChain

**步骤2：评估工具调用需求**
- 不需要调用外部工具 → **直接使用Qwen API** ✅
- 需要调用数据库、API等工具 → **需要LangChain** ✅

**步骤3：评估推理复杂度**
- 单次LLM调用即可完成 → **直接使用Qwen API** ✅
- 需要多次LLM调用的链式推理 → **需要LangChain** ✅

**步骤4：评估Agent能力需求**
- 不需要LLM自主决策 → **直接使用Qwen API** ✅
- 需要LLM自主选择工具和操作 → **需要LangChain** ✅

**最终决策**：
- **满足所有"直接使用Qwen API"条件** → 第一阶段：直接对接Qwen API
- **满足任一"需要LangChain"条件** → 第二阶段：引入LangChain

## 九、LangChain 集成方案（面向成本/质量/批次分析的多工具多轮对话）

### 9.1 目标与边界

- **目标**：把“成本分析 / 质量分析 / 批次分析（含日期范围）”从“固定流程 + 手写数据拼装”升级为“可复用工具集 + 可控的多轮澄清 + 可观测的执行链路”，支持用户用更自然的方式提问与追问。
- **边界**：LangChain **不替代**现有 Java 业务聚合与权限体系；LangChain 的职责是 **编排**（选择工具/澄清/分步推理/总结），最终数据仍来自后端受控接口。
- **原则**：
  - **少传原始明细**：默认“先摘要、再按需细钻”。避免一次性把全库数据塞给模型（成本、延迟、风险都高）。
  - **工具优先**：模型不凭空猜数据，只能通过工具获取。
  - **高风险问题先澄清**：涉及“范围（日期/批次集）/维度（成本 or 质量）/粒度（工厂级 or 批次级）”时必须确认或补充信息。

### 9.2 为什么这块“值得用 LangChain”（结合当前代码现状）

我们现在已经具备“多表数据聚合 + 单次 LLM 分析”的能力（例如 `ProcessingServiceImpl.getEnhancedBatchCostAnalysis()` 会拉取批次、原材料消耗、设备、人工、质检、加工环节等多类数据）。问题在于：

- **分析类型越多，固定流程越碎**：成本/质量/批次对比/按日期范围/按维度聚合，会导致 Java/AI 服务里出现越来越多相似但不同的“查询-拼装-Prompt-调用LLM”分支。
- **用户提问更自由**：用户不会严格按“选择页面功能”提问，常见会混合：时间范围 + 维度 + 对比 + 追问。用 LangChain 的价值在于：
  - 把“澄清/分步/选择工具/多轮记忆”标准化；
  - 把“工具集合”沉淀为可复用能力，减少每新增一种分析就大改代码的成本。

### 9.3 总体架构（推荐：LangChain 在 Python AI 服务层）

- **入口**：保留现有 Java 侧 AI 入口（如 AIController/AIEnterpriseService），继续做权限、配额、审计、缓存判断。
- **编排层**：在 `backend-java/backend-ai-chat`（Python FastAPI AI 服务）新增/扩展一个“分析编排”入口：由 LangChain 驱动。
- **数据工具层**：由 LangChain Tools 调用 **Java 后端的受控查询接口**（或调用 Python 内部已有的、等价的聚合接口）。
- **LLM**：底层模型优先使用 **Qwen API**；LangChain 只是编排框架，不绑定具体模型。

一句话：**Java 管“权限/配额/数据接口”，Python(LangChain) 管“对话/工具编排/分步推理/输出”**。

### 9.4 工具（Tools）清单设计（按“先粗后细”的数据获取策略）

#### 9.4.1 基础工具（必须）

- **获取工厂概览指标（按日期范围）**
  - 输入：factoryId, startDate, endDate, dimension(可选)
  - 输出：生产总量、良品率、总成本（分项）、异常TopN（可先由后端算）
  - 用途：用户先问“这个月整体怎么样”

- **获取批次列表（按日期范围 + 过滤条件）**
  - 输入：factoryId, startDate, endDate, filters(产品/状态/质检结果…)
  - 输出：批次id/批次号/产品/时间/关键指标（成本、良品率、异常标记）
  - 用途：支撑对比、下钻、排序

- **获取单批次增强分析数据（摘要版）**
  - 输入：factoryId, batchId
  - 输出：`getEnhancedBatchCostAnalysis` 的“摘要裁剪版”（只保留关键字段、TopN 明细）
  - 用途：默认不把所有明细给模型，先让模型判断“还缺什么”

- **获取单批次增强分析数据（明细版）**
  - 输入：factoryId, batchId, detailLevel
  - 输出：必要时才拉全量（材料/设备/人工/质检/工序）
  - 用途：深挖原因定位、出具可解释证据

#### 9.4.2 质量分析工具（建议）

- **质量趋势（按天/周）**
  - 输入：factoryId, startDate, endDate
  - 输出：每日检验数、合格率、缺陷类型分布（可选）

- **质量异常归因（TopN）**
  - 输入：factoryId, startDate, endDate
  - 输出：不合格原因TopN、关联产品TopN、关联供应商TopN、关联工序TopN（尽量由后端聚合）

#### 9.4.3 成本分析工具（建议）

- **成本分解（按维度聚合）**
  - 输入：factoryId, startDate, endDate, groupBy(产品/供应商/设备/人员/批次)
  - 输出：分组后的成本分项与贡献度

#### 9.4.4 批次对比工具（建议）

- **批次对比（2-10个批次）**
  - 输入：factoryId, batchIds[], compareDims(成本/质量/效率…)
  - 输出：对比表 + 差异最大项 + 证据链接（字段路径/明细索引）

> 备注：工具的输出建议带上 **data_version、聚合口径说明、样本量**，避免模型误解口径。

#### 9.4.5 工具接口契约表（建议落到“后端受控 API”）

本节给出一份**可直接按表落地**的“工具 = 后端 API + 入参 + 出参口径 + 成本策略”清单，目标是：
- 让 LangChain 工具调用有稳定契约，避免“模型输出变了 → 后端全崩”；
- 让**数据口径统一**（同一指标在不同工具里不打架）；
- 让**成本/配额可控**（范围越大，先摘要、再下钻）。

说明：
- 下面的“API Path”是建议命名（不强制与当前路由一致），可用现有接口包一层做兼容。
- 所有 API 都必须透传并校验：`factoryId`、`userId`、`role`、`Authorization`。
- 所有响应建议统一带：`dataVersion`、`calculationNotes`、`sampleSize`、`timeRange`。

##### 工具 1：工厂概览（按日期范围）

- **Tool Name**：`factory_overview`
- **API Path**：`GET /api/mobile/{factoryId}/ai-data/overview`
- **输入**：
  - `startDate`、`endDate`（必填，ISO日期）
  - `dimension`（可选：overall/production/cost/quality）
- **输出（建议字段）**：
  - `timeRange: {startDate, endDate}`
  - `batchCount`
  - `production: {totalPlanned, totalActual, yieldRateAvg}`
  - `cost: {total, material, labor, equipment, other}`
  - `quality: {inspectionCount, passRateAvg, defectRateAvg}`
  - `topAnomalies[]`（Top3：异常类型、影响、证据key）
- **配额建议**：
  - 基础：1
  - 大范围（>30天）：先提示用户确认范围或改为抽样

##### 工具 2：批次列表（按日期范围 + 过滤）

- **Tool Name**：`batch_list`
- **API Path**：`GET /api/mobile/{factoryId}/ai-data/batches`
- **输入**：
  - `startDate`、`endDate`
  - `filters`（可选：productTypeId/status/qualityResult/minCost/maxCost…）
  - `sortBy`（cost/yieldRate/passRate/startTime…）
  - `limit`（默认 50，上限 200）
- **输出**：
  - `items[]`：
    - `batchId`、`batchNumber`、`productName`
    - `startTime`、`endTime`、`status`
    - `costSummary: {total, material, labor, equipment}`
    - `qualitySummary: {inspectionCount, passRateAvg}`
    - `flags[]`（例如：HIGH_COST/LOW_YIELD/QUALITY_RISK）
  - `total`
- **配额建议**：
  - 仅列表：0.2（或不计）
  - 如果返回包含聚合统计：0.5

##### 工具 3：单批次摘要（默认工具，先用它）

- **Tool Name**：`batch_summary`
- **API Path**：`GET /api/mobile/{factoryId}/ai-data/batches/{batchId}/summary`
- **输入**：`batchId`
- **输出**：
  - `batchInfo`（批次号、产品、产量、时间、状态）
  - `planComparison`（计划 vs 实际）
  - `costSummary`（总成本及分项）
  - `qualitySummary`（检验次数、平均合格率、主要不合格原因Top3）
  - `materialTop[]`（Top5 原料消耗/成本贡献）
  - `laborTop[]`（Top5 人员/工时/成本贡献）
  - `equipmentTop[]`（Top5 设备/时长/成本贡献）
  - `stageTop[]`（Top3 工序：耗时/损耗异常）
  - `evidenceKeys[]`（可用于后续明细下钻的 key）
- **配额建议**：1

##### 工具 4：单批次明细下钻（按需、可分片）

- **Tool Name**：`batch_detail`
- **API Path**：`GET /api/mobile/{factoryId}/ai-data/batches/{batchId}/detail`
- **输入**：
  - `detailLevel`（required：materials/labor/equipment/quality/stages/all）
  - `limitPerSection`（默认 100，上限 500）
- **输出**：
  - `materials[]` / `laborSessions[]` / `equipmentUsages[]` / `qualityInspections[]` / `stages[]`
  - 每个数组都要提供 `count`、`sampled`（是否抽样）、`truncated`（是否截断）
- **配额建议**：
  - 单维度：1
  - all：2-3（视数据量）

##### 工具 5：质量趋势（按天/周）

- **Tool Name**：`quality_trend`
- **API Path**：`GET /api/mobile/{factoryId}/ai-data/quality/trend`
- **输入**：`startDate`、`endDate`、`granularity`（day/week）
- **输出**：
  - `series[]: {date, inspectionCount, passRateAvg, defectRate}`
  - `topFailureReasons[]`
- **配额建议**：1

##### 工具 6：成本分解（按维度聚合）

- **Tool Name**：`cost_breakdown`
- **API Path**：`GET /api/mobile/{factoryId}/ai-data/cost/breakdown`
- **输入**：
  - `startDate`、`endDate`
  - `groupBy`（product/supplier/equipment/person/batch）
  - `metric`（total/material/labor/equipment）
  - `limit`（默认 20）
- **输出**：
  - `groups[]: {key, name, metricValue, contributionPct, breakdown{...}}`
  - `notes`（口径说明）
- **配额建议**：1-2（按 groupBy 的复杂度）

##### 工具 7：批次对比（2-10 个批次）

- **Tool Name**：`batch_compare`
- **API Path**：`POST /api/mobile/{factoryId}/ai-data/batches/compare`
- **输入**：
  - `batchIds[]`（2-10）
  - `compareDims[]`（cost/quality/efficiency/yield）
- **输出**：
  - `matrix`（对比表）
  - `diffHighlights[]`（差异最大项）
  - `evidenceRefs[]`（指向摘要/明细字段路径）
- **配额建议**：2（取决于 batchIds 数量）

##### 工具 8：相似批次检索（可选，但对“原因归因”很有价值）

- **Tool Name**：`batch_similar_search`
- **API Path**：`GET /api/mobile/{factoryId}/ai-data/batches/similar`
- **输入**：
  - `batchId`（基准批次）
  - `startDate`、`endDate`（检索范围）
  - `similarBy`（productName/materialMix/equipment/quality）
  - `limit`（默认 10）
- **输出**：
  - `items[]: {batchId, batchNumber, similarityScore, keyReasons[]}`
- **配额建议**：1

#### 9.4.6 Tool 输出“口径”统一规则（强制）

- **统一时间范围**：所有日期范围工具输出必须包含 `timeRange`。
- **统一成本分项**：`material/labor/equipment/other/total`，缺失用 0，并给 `calculationNotes`。
- **统一合格率**：passRate 使用 0-100 的百分比或 0-1 的比例必须固定一种（推荐 0-100）。
- **统一抽样标记**：任何截断/抽样必须显式返回 `sampled/truncated`，避免模型误判“全量=事实”。

### 9.5 多轮对话与澄清策略（面向“范围大、歧义大”的分析问题）

#### 9.5.1 必须澄清的字段（缺一不可）

- **时间范围**：startDate/endDate（若缺失，默认“近7天”，并提示用户可修改）
- **分析对象**：工厂整体 vs 单批次 vs 批次集合
- **分析维度**：成本 / 质量 / 效率 / 综合（允许用户选 1-2 个优先）
- **输出形式**：结论概览 vs 证据明细 vs 可执行建议（默认：概览+3条建议+证据摘要）

#### 9.5.2 澄清方式（最小问题，不问“对不对”）

- **候选项选择**：给 2-3 个明确选项（含示例）
- **缺失信息补齐**：只问缺失项（例如“要分析哪段时间？给个开始/结束日期”）
- **大范围确认**：当预计会扫描批次很多时，先让用户确认范围（避免成本爆炸）

### 9.6 输出结构（让结果“可落地、可追溯”）

建议对所有分析类回复，输出统一结构（无论展示给用户还是给前端）：

- **结论摘要**：3-5条（可量化）
- **证据点**：每条结论附 1-3 个证据（数据来自哪个工具、哪个字段）
- **异常TopN**：成本/质量/效率各 Top3
- **建议**：可执行动作 + 预期收益 + 风险提示
- **可继续追问建议**：2-3个引导问题（多轮对话入口）

### 9.7 安全、权限、配额与成本控制（必须落地）

- **权限**：所有工具调用都必须携带用户身份（token/userId/role/factoryId），并由 Java 后端校验。
- **配额**：
  - “澄清/选择题”不消耗或低消耗；
  - “大范围分析（扫描批次多）”按批次数或按工具调用次数计费；
  - “明细版数据下钻”单独计费（因为数据量与价值更高）。
- **成本控制策略**：
  - 默认先调用“概览/摘要”工具；
  - 只有在需要证据或用户追问时，才调用“明细”工具；
  - 对时间范围工具增加“批次上限”，超过上限先提示用户缩小范围或改为抽样分析。
- **审计**：记录每次工具调用的：参数摘要、耗时、返回数据量、是否触发明细、LLM token、最终结论摘要。

### 9.8 落地路线图（建议 3 步）

#### Step A：先把“成本分析（单批次）”接入 LangChain（最小闭环）

- 复用现有 `getEnhancedBatchCostAnalysis`，先做“摘要版工具”
- LangChain 负责：多轮追问、证据引用、需要时再下钻明细
- 验收：同一批次能做 3 轮追问（为什么高、如何降、证据在哪）

#### Step B：接入“日期范围成本分析/质量分析”

- 工具：批次列表、工厂概览、趋势、异常TopN
- 强制澄清：时间范围 + 维度 + 范围大小确认
- 验收：30天范围可在可控成本下输出“概览+证据摘要”

#### Step C：批次对比 + Agent 化（工具自动选择）

- 工具：对比、相似批次检索、异常归因
- 支持用户自然语言：“对比这周最差的3个批次，找共同原因”
- 验收：模型能先选工具、再给结论、再给证据点

### 9.9 “需要 LangChain 的程度”判定（给决策用）

当满足以下任一项，就说明 LangChain 价值明显：

- **工具数量 ≥ 6** 且用户问题需要动态选择工具（我们当前已经接近/达到）
- **需要多轮澄清**（日期范围、维度、范围大小）且希望标准化交互
- **需要分步推理**（先概览→再下钻→再对比→再给建议）
- **希望把能力沉淀成可复用组件**（新增分析类型主要靠新增工具，而非改流程）

### 9.10 验收指标（上线后两周内可量化）

- **澄清率**：需要澄清的请求占比（目标：合理，不追求越低越好）
- **一次命中率**：不澄清也正确的占比（目标逐周提升）
- **平均工具调用数**：每次请求调用多少工具（目标：先摘要后明细，整体可控）
- **平均成本**：按配额/金额统计（目标：范围越大成本越高但可预期）
- **用户追问完成率**：用户追问能否得到答案而非报错（目标：>90%）

### 9.11 基于现有 Python 后端的集成实现指南

#### 9.11.1 现有代码现状分析

**Python AI 服务位置**：`backend-java/backend-ai-chat/scripts/main.py`

**已有能力**：
- 已使用 OpenAI SDK（兼容 DashScope）调用阿里云通义千问（Qwen）
- 已有完整的 `query_qwen()` 函数封装，支持普通模式和思考模式（thinking mode）
- 已有 `query_qwen_with_thinking()` 函数，支持流式响应收集思考过程
- 已配置 DASHSCOPE_API_KEY、DASHSCOPE_BASE_URL、DASHSCOPE_MODEL 等环境变量
- 已有 `/api/ai/chat` 端点，用于成本分析，接收 CostAnalysisRequest，返回分析结果
- 使用 FastAPI 框架，已配置 CORS 中间件

**缺失项**：
- 尚未安装 LangChain 相关依赖包
- 没有工具调用（Tool）机制
- 没有 Agent 编排能力
- 没有对话记忆管理（虽然已有 session_id，但没有持久化对话历史）

#### 9.11.2 集成策略（最小改动原则）

**核心原则**：不破坏现有功能，渐进式添加新能力

**策略一：复用现有 Qwen 调用封装**
- 不替换现有的 `query_qwen()` 函数
- 使用 LangChain 的 ChatOpenAI 类，配置 base_url 和 api_key 指向 DashScope（与现有配置一致）
- 或使用 LangChain 的 ChatModel 接口，包装现有的 `query_qwen()` 函数，将返回结果转换为 LangChain 期望的格式
- 这样可以利用现有的错误处理、思考模式支持等成熟逻辑

**策略二：新增端点而非替换**
- 保留现有的 `/api/ai/chat` 端点，继续服务现有的成本分析需求
- 新增 `/api/ai/analysis/orchestrate` 端点，专门用于 LangChain 驱动的多工具分析
- 前端可以根据分析类型选择调用哪个端点，实现平滑过渡

**策略三：工具层通过 HTTP 调用 Java 后端**
- LangChain Tools 不直接访问数据库，保持数据访问的受控性
- 所有数据查询工具都调用 Java 后端提供的受控 API（如 `/api/mobile/{factoryId}/ai-data/...`）
- 这样保持了权限校验、配额控制、审计日志等安全控制逻辑在 Java 层统一管理

#### 9.11.3 依赖项添加

**需要在 `requirements.txt` 中添加**：
- langchain：LangChain 核心库
- langchain-openai：用于 ChatOpenAI 类（虽然我们用 Qwen，但可以通过 base_url 配置兼容）
- langchain-community：包含更多社区工具和集成
- langchain-core：核心抽象和接口

**注意**：由于现有代码使用 OpenAI SDK 兼容模式调用 DashScope，LangChain 的 ChatOpenAI 类可以直接配置 base_url 和 api_key 指向 DashScope，无需额外适配。

#### 9.11.4 架构调整建议

**现有架构**：
- Java 后端（权限/配额/审计/缓存） → 调用 Python AI 服务 `/api/ai/chat` → Python 调用 Qwen API → 返回结果

**新架构（LangChain 集成后）**：
- Java 后端（权限/配额/审计/缓存） → 调用 Python AI 服务 `/api/ai/analysis/orchestrate` → LangChain Agent 编排 → 根据需要调用多个 Tools → Tools 调用 Java 后端数据接口 → Agent 调用 Qwen API 分析 → 返回结构化结果

**关键点**：
- LangChain Agent 运行在 Python 服务中
- Tools 通过 HTTP 请求调用 Java 后端（保持权限控制）
- Qwen API 调用仍然通过 LangChain 的 LLM 接口，但底层复用现有配置

#### 9.11.5 实现步骤建议

**第一阶段：准备工作**
1. 在 `requirements.txt` 中添加 LangChain 相关依赖
2. 安装依赖，验证不影响现有 `/api/ai/chat` 端点
3. 创建新的 Python 模块文件（如 `langchain_orchestrator.py`），用于封装 LangChain 相关逻辑

**第二阶段：LLM 封装**
1. 创建函数将现有的 Qwen 调用封装成 LangChain 的 ChatModel 接口
2. 或者直接使用 LangChain 的 ChatOpenAI 类，配置 base_url 为 DashScope 地址，api_key 从环境变量读取
3. 确保思考模式（thinking mode）可以正常传递（可能需要自定义或使用 LangChain 的 extra_body 参数）

**第三阶段：工具定义**
1. 定义所有需要的 Tools（如获取批次信息、获取成本数据、获取质量数据等），参考9.4节的工具清单
2. 每个 Tool 都是异步函数，内部通过 httpx.AsyncClient 调用 Java 后端 API
3. 为每个 Tool 编写清晰的 description，描述工具的功能、输入参数、输出格式，帮助 LLM 正确选择工具

**第四阶段：Agent 初始化**
1. 选择合适的 Agent 类型（建议使用 `conversational-react-description`，支持多轮对话）
2. 配置 Memory（使用 ConversationBufferMemory 或 ConversationSummaryMemory）
3. 将 Tools 和 LLM 组装成 Agent

**第五阶段：端点实现**
1. 在 `main.py` 中新增 `/api/ai/analysis/orchestrate` 端点
2. 接收请求参数：factoryId、userInput、sessionId（可选）、analysisType（可选）
3. 调用 LangChain Agent 处理请求
4. 返回结构化结果（包含结论、证据、建议等）

**第六阶段：对话历史管理**
1. 使用 Redis 或数据库存储对话历史（对应 sessionId）
2. Agent 的 Memory 从存储中恢复历史消息
3. 每次对话后更新存储

#### 9.11.6 关键实现细节

**Qwen API 集成**：
- LangChain 的 ChatOpenAI 类支持通过 base_url 参数指向 DashScope 兼容端点
- api_key 从环境变量 DASHSCOPE_API_KEY 读取
- model 参数使用环境变量 DASHSCOPE_MODEL（默认 qwen-plus）
- 思考模式（thinking mode）可能需要通过 extra_body 参数传递，或使用自定义的 LLM 包装类

**工具调用**：
- 所有工具都是异步函数（async def）
- 工具内部使用 httpx.AsyncClient 调用 Java 后端 API
- 工具必须处理错误情况，返回明确的错误信息给 Agent
- 工具返回的数据应该包含数据版本、计算口径等元信息

**Agent 配置**：
- Agent 类型选择：conversational-react-description 适合多轮对话和工具调用
- Memory 配置：对于长对话，使用 ConversationSummaryMemory 可以压缩历史，避免 token 爆炸
- Temperature 设置：建议 0.3-0.5，保证分析结果稳定可靠
- Max iterations：限制 Agent 的最大工具调用次数，避免死循环

**错误处理**：
- Agent 调用失败时，回退到简单的 Qwen API 调用（类似现有的 fallback 机制）
- 工具调用失败时，Agent 应该能够识别并尝试其他工具或询问用户
- 记录详细的错误日志，便于调试和优化

#### 9.11.7 测试策略

**单元测试**：
- 测试每个 Tool 是否能正确调用 Java 后端 API
- 测试 LLM 封装是否能正确调用 Qwen API
- 测试 Agent 能否正确选择工具

**集成测试**：
- 测试完整流程：用户提问 → Agent 选择工具 → 工具调用 → LLM 分析 → 返回结果
- 测试多轮对话：连续提问是否能保持上下文
- 测试错误场景：工具失败、LLM 失败等情况的处理

**性能测试**：
- 测试工具调用的并发性能
- 测试 Agent 响应的延迟
- 测试对话历史管理的性能

#### 9.11.8 与现有代码的兼容性

**保持向后兼容**：
- 现有的 `/api/ai/chat` 端点继续工作，不受影响
- 现有的 `query_qwen()` 函数可以被 LangChain 的 LLM 封装复用
- 现有的环境变量配置可以直接使用

**逐步迁移**：
- 新功能优先使用 LangChain 端点
- 现有功能可以继续使用传统端点
- 根据使用情况逐步迁移到 LangChain 端点

**统一配置**：
- LangChain 的 LLM 配置使用现有的 DASHSCOPE_API_KEY、DASHSCOPE_MODEL 等环境变量
- 避免重复配置，保持配置一致性


