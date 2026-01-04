# AI 意图系统问题及解决方案

> 文档创建时间: 2026-01-04
> 最后更新: 2026-01-04 15:35
> 状态: 持续更新中

---

## 一、问题清单总览

| BUG ID | 问题描述 | 严重程度 | 状态 | 影响范围 |
|--------|----------|----------|------|----------|
| BUG-001 | 查询类输入被误识别为更新类意图 | 高 | ✅ 已修复 | 用户体验 |
| BUG-002 | 带ID的查询被误识别为 BATCH_UPDATE | 高 | ✅ 已修复 | 数据安全 |
| BUG-003 | AI 解析端点缺失导致 DATA_OP 意图失败 | 高 | ✅ 已修复 | 功能阻断 |
| BUG-004 | 无意义输入直接拒绝而非二次询问 | 中 | ✅ 已修复 | 用户体验 |
| BUG-005 | 单字符输入未触发二次确认 | 中 | ✅ 已修复 | 用户体验 |
| BUG-006 | LLM Fallback 响应过慢 (4-6秒) | 中 | ⏳ 优化中 | 性能 |

### 修复记录

#### BUG-001 & BUG-002 修复 (2026-01-04)
- **问题**: 查询类输入 (如"最近还剩多少材料啊"、"查询批次MB-F001-001的库存") 被误识别为 MATERIAL_UPDATE
- **根因**:
  1. MATERIAL_BATCH_QUERY 意图缺少关键词 "材料"、"还剩"、"多少" 等
  2. 交叉关键词权重机制虽然检测到了 QUERY 类型操作词，但由于 MATERIAL_BATCH_QUERY 没有匹配到任何关键词，无法受益于权重调整
- **修复内容**:
  1. 更新数据库 `ai_intent_configs` 表，为 MATERIAL_BATCH_QUERY 添加关键词: `["查询原料", "原料批次", "原材料库存", "原料库存", "查看原料", "原料列表", "材料", "原料", "库存", "还剩", "多少", "剩余", "有多少"]`
  2. 交叉关键词权重机制已在 AIIntentServiceImpl 中实现 (QUERY_INDICATORS +20 分, UPDATE_INDICATORS -20 分)
- **验证结果**:
  - "最近还剩多少材料啊" → `MATERIAL_BATCH_QUERY` ✅
  - "查询批次MB-F001-001的库存" → `MATERIAL_BATCH_QUERY` ✅

#### BUG-003 修复 (2026-01-04)
- **问题**: 输入"把产品PT-F001-001单价改成50元"返回"AI解析意图失败: 无响应"
- **根因**:
  1. Python AI 服务缺少 `/api/ai/intent/parse-data-operation` 端点
  2. Python 返回 snake_case 字段 (entity_type)，Java 期望 camelCase (entityType)
  3. ENTITY_ALIASES 缺少 PascalCase 形式 (ProductType → PRODUCT_TYPE)
  4. findByFactoryIdAndCode 按 code 查找，但 PT-F001-001 是 ID
- **修复文件**:
  1. `backend-ai-chat/scripts/main.py` - 添加 parse-data-operation 端点
  2. `DataOperationIntentHandler.java` - 添加字段名映射、ENTITY_ALIASES PascalCase 支持、优先按 ID 查找实体
- **验证结果**: "把产品PT-F001-001单价改成50元" → `COMPLETED: 成功更新了 带鱼段_updated` ✅

#### BUG-004 修复 (2026-01-04)
- **修复文件**: `IntentExecutorServiceImpl.java`
- **修复内容**: 当规则+LLM都无法识别意图时，返回 `NEED_CLARIFICATION` 而非 `NOT_RECOGNIZED`，并提供常用操作建议
- **验证结果**: 输入 "asdfghjkl" → 返回 status=NEED_CLARIFICATION + 5个建议操作

#### BUG-005 修复 (2026-01-04)
- **修复文件**: `IntentExecutorServiceImpl.java` (与 BUG-004 同一修复)
- **修复内容**: 单字符输入走 LLM fallback 后无法识别，触发 NEED_CLARIFICATION
- **验证结果**: 输入 "查" → 返回 status=NEED_CLARIFICATION + 默认建议列表

---

## 二、详细问题分析

### BUG-001: 查询类输入被误识别为更新类意图

**问题表现**: 用户输入"最近还剩多少材料啊"时，系统识别为 MATERIAL_UPDATE（更新意图），而非期望的 MATERIAL_BATCH_QUERY（查询意图），最终导致"AI解析意图失败: 无响应"。

**根因分析**:
1. 关键词匹配逻辑中，"材料"同时出现在查询和更新意图的关键词库中
2. 更新意图的优先级（priority）配置可能高于查询意图
3. 系统缺少"查询意图优先"的判断逻辑

**解决方案**:
- **方案A（推荐）**: 调整数据库中意图优先级配置，将所有查询类意图（QUERY、LIST）的优先级提升至95，更新类意图降至80
- **方案B**: 在匹配逻辑中增加查询意图优先判断，当用户输入包含"查询、查看、多少、还剩、有几、列表、统计"等关键词时，优先匹配查询类意图
- **方案C**: 关键词去重，将通用词汇（如"材料"）从更新意图的关键词中移除

---

### BUG-002: 带ID的查询被误识别为 BATCH_UPDATE

**问题表现**: 用户输入"查询批次MB-F001-001的库存"时，被识别为 BATCH_UPDATE 而非 MATERIAL_BATCH_QUERY。

**根因分析**:
1. 输入中包含批次号 "MB-F001-001"，触发了批次相关的关键词匹配
2. BATCH_UPDATE 意图的关键词可能包含"批次"
3. 系统未能正确识别"查询"作为主要操作动词

**解决方案**: 添加操作动词权重机制，优先根据用户输入中的操作动词（查询、查看、获取 vs 修改、更新、编辑）确定意图类型，再结合实体关键词进行匹配。

---

### BUG-003: AI 解析端点缺失导致 DATA_OP 意图失败

**问题表现**: 用户输入"把产品单价改成50元"等数据操作请求时，返回"AI解析意图失败: 无响应"。

**根因分析**:
1. Java后端的 DataOperationIntentHandler 调用了 `/api/ai/intent/parse-data-operation` 端点
2. 该端点在 Python AI 服务中不存在
3. 请求返回 404 或超时，被捕获后返回 null，触发错误消息

**解决方案**: 在 Python AI 服务中添加 `/api/ai/intent/parse-data-operation` 端点，该端点负责解析用户输入中的实体类型（ProductType、ProductionPlan等）、实体标识符、需要更新的字段和值。

---

### BUG-004: 无意义输入直接拒绝而非二次询问

**问题表现**: 用户输入"asdfghjkl"时，系统直接返回 NOT_RECOGNIZED，而非询问澄清问题。

**根因分析（详细代码级分析）**:

1. **执行流程**: IntentExecutorServiceImpl.execute() 调用 AIIntentServiceImpl.recognizeIntentWithConfidence()，先进行规则匹配（正则+关键词），无匹配时调用 tryLlmFallback()，LLM 也无法匹配时返回空结果，最终检查 hasMatch() 为 false 时直接返回 NOT_RECOGNIZED

2. **核心问题**: IntentExecutorServiceImpl 第72-88行，当 matchResult.hasMatch() 为 false 时，直接返回 NOT_RECOGNIZED 响应，**完全没有检查 clarificationQuestion 字段**，也没有尝试生成澄清问题

3. **LLM 服务依赖**: 如果 Python AI 服务不可用（健康检查失败），则 tryLlmFallback() 不会调用 AI 服务，直接返回空结果，导致无法生成智能澄清问题

4. **缺少备选方案**: 系统应该在无法匹配时提供默认的澄清问题或热门意图列表供用户选择

**解决方案**:
- 在 IntentExecutorServiceImpl.execute() 方法中，当无匹配时不直接返回 NOT_RECOGNIZED，而是返回 NEED_CLARIFICATION 状态
- 调用 LLM 生成友好的澄清问题，或使用模板生成默认问题（如"您可以尝试：1. 查询原料库存 2. 查看质检项目..."）
- 同时返回热门意图列表（suggestedIntents）供前端展示

---

### BUG-005: 单字符输入未触发二次确认

**问题表现**: 用户输入"查"时，被直接匹配到 TRACE_FULL（溯源查询）意图并执行，而非询问用户具体想查询什么。

**根因分析（详细代码级分析）**:

1. **匹配流程**: "查"单字符匹配到了 TRACE_FULL 意图的关键词，匹配得分计算为 1个关键词 × 10 + 优先级，如果优先级为80，总分达90

2. **信号强度判断**: AIIntentServiceImpl.isStrongSignal() 方法有三个条件（AND 关系）：
   - 条件1: 匹配关键词 >= 3 个 → "查"只匹配1个，**不满足**
   - 条件2: 与第二候选的置信度差距 > 0.3 → 只有1个候选，**满足**
   - 条件3: 优先级 >= 80 → 取决于配置

3. **确认需求判断**: determineRequiresConfirmation() 在弱信号或敏感操作时返回 true，生成 clarificationQuestion

4. **核心问题**: IntentExecutorServiceImpl 收到包含 requiresConfirmation=true 和 clarificationQuestion 的结果后，**完全忽略了这两个字段**，直接进行权限检查和执行，没有返回澄清问题给用户

5. **停用词问题**: "查"被定义为停用词（STOP_WORDS 列表中），但关键词匹配逻辑没有检查停用词，导致无意义的单字符被匹配

**解决方案**:
- **首要修复**: 在 IntentExecutorServiceImpl.execute() 方法中，添加对 requiresConfirmation 字段的检查，当为 true 时返回 PENDING_CONFIRMATION 状态和 clarificationQuestion
- **辅助优化**: 在 isStrongSignal() 方法中增加单字符和停用词的特殊检查，防止过度匹配
- **输入校验**: 添加最小输入长度校验（建议 >= 2 字符），过短输入直接返回澄清问题

---

### BUG-006: LLM Fallback 响应过慢 (4-6秒)

**问题表现**: 关键词匹配路径响应时间 80-150ms，而 LLM Fallback 路径响应时间 4000-7000ms，慢30-50倍。

**根因分析**:
1. 每次请求创建新的 HTTP 连接，无连接池复用
2. 请求体包含全部 84+ 个意图配置（约45KB），LLM 处理长 context 耗时
3. 可能存在双重 LLM 调用（分类 + 澄清）
4. 健康检查过于严格，仅 HTTP 200 才视为健康，超时或网络抖动会导致失败

**解决方案**: 详见下方"LLM 优化方案"章节

---

## 三、二次确认机制触发失败详细分析

### 3.1 机制设计与实际表现的差距

二次确认机制（Clarification Mechanism）在代码中已经实现了相关数据结构和字段，但在执行流程中未被正确使用。

**设计意图**:
- IntentMatchResult 包含 requiresConfirmation 和 clarificationQuestion 字段
- 当意图识别置信度低、敏感度高或信号弱时，应设置 requiresConfirmation=true
- 前端收到确认请求后展示澄清问题，让用户确认或选择

**实际表现**:
- IntentExecutorServiceImpl.execute() 方法只检查 hasMatch()，不检查 requiresConfirmation
- 即使底层正确设置了 requiresConfirmation=true，执行层也会忽略它
- 用户看不到任何澄清问题，意图直接被执行或被拒绝

### 3.2 触发条件应该被满足的场景

| 场景 | 当前行为 | 应有行为 | 原因 |
|------|---------|---------|------|
| "asdfghjkl"（无意义） | NOT_RECOGNIZED | PENDING_CONFIRMATION | 应提供意图列表让用户选择 |
| "查"（单字符） | 直接执行 TRACE_FULL | PENDING_CONFIRMATION | 敏感意图 + 弱信号 + 单字符 |
| "我要"（停用词组合） | 直接执行 | PENDING_CONFIRMATION | 关键词少 + 歧义大 |
| 敏感度 HIGH/CRITICAL | 直接执行 | PENDING_CONFIRMATION | 配置规则要求确认 |
| 置信度 < 0.7（LLM返回） | 直接执行 | PENDING_CONFIRMATION | LLM 本身的不确定性 |
| 多个候选置信度接近 | 直接执行 | PENDING_CONFIRMATION | 无法区分首选 |

### 3.3 修复优先级

| 优先级 | 问题 | 修复位置 | 影响 |
|--------|------|---------|------|
| **P0** | 单字符未询问澄清 | IntentExecutorServiceImpl.execute() | 用户无法确认，可能执行错误操作 |
| **P1** | 无意义输入无澄清 | IntentExecutorServiceImpl + AIIntentServiceImpl | 用户不知道系统支持什么操作 |
| **P1** | LLM 不可用时失败 | LlmIntentFallbackClientImpl.isHealthy() | 依赖 Python 服务可用性 |
| **P2** | 单字符关键词过度匹配 | AIIntentServiceImpl | 低质量匹配被选中 |
| **P2** | 缺少响应格式支持 | IntentExecuteResponse | 前端无法准确判断是否显示澄清 |

---

## 四、LLM 优化方案（行业调研）

基于对 2024-2025 年 LLM 意图识别系统最佳实践的调研，以下是可行的优化方案。

### 4.1 混合意图分类架构（推荐）

**原理**: 采用双阶段架构，第一阶段使用 Embedding 向量检索找出 Top 10 候选意图，第二阶段仅把这些候选传给 LLM 进行精确分类。

**预期效果**:
- LLM 调用量减少 70-80%
- 响应延迟降低 50%
- 成本降低 60%+

**实现难度**: 中等（2-3周）

**开源工具**: Rasa（原生支持 LLM + RAG 意图分类）、LangChain（提供完整 RAG 管道）

---

### 4.2 语义缓存（Semantic Caching）

**原理**: 使用 Redis 等工具对 LLM 查询结果进行语义级别的缓存。当新查询与缓存查询的语义相似度超过阈值（如 0.85）时，直接返回缓存结果。

**预期效果**:
- API 成本节省 90%（Redis 官方数据）
- 相同/相似查询响应时间 < 10ms
- 减少 LLM 负载

**实现难度**: 简单（1周）

**开源工具**: Redis LangCache、RedisVL SemanticCache、LiteLLM Caching

---

### 4.3 Prompt 压缩（LLMLingua）

**原理**: 使用小型语言模型（如 GPT2-small 或 LLaMA-7B）识别并移除 Prompt 中不重要的 token，压缩后再发送给主 LLM。

**关键技术**:
- LLMLingua-2: 比原版快 3-6 倍，支持跨域数据
- LongLLMLingua: 解决"lost in the middle"问题，RAG 性能提升 21.4%

**预期效果**:
- 压缩率高达 20 倍
- 性能损失最小
- LinkedIn 实测：30% prompt 压缩，推理速度显著提升

**实现难度**: 中等（1-2周）

**开源工具**: Microsoft LLMLingua（GitHub 5k+ stars）

---

### 4.4 置信度阈值 + 澄清问题生成

**置信度分级策略**:
- 置信度 > 0.8: 直接执行意图
- 置信度 0.6-0.8: 二次确认
- 置信度 < 0.6: 生成澄清问题

**澄清问题生成方法**:
- **AT-CoT（推荐）**: 先预测歧义类型，再生成对应澄清问题，BERTScore 达 82
- Chain-of-Thought: 标准推理链，BERTScore 80
- Direct Prompting: 直接生成，BERTScore 78.8

**实测效果**: AmbiSQL 数据集上，模糊查询准确率从 42.5% 提升至 92.5%（+117%）

**实现难度**: 中等（2周）

---

### 4.5 异步批处理 + 连接池优化

**连接池配置建议**:
- 数据库连接池: pool_size=20, max_overflow=10, pool_timeout=30
- LLM API 配置: timeout=60秒（默认5秒太短）, max_retries=3, batch_size=5

**批处理策略**:
- 实时查询: 单次调用，超时 30s
- 批量处理: Together AI Batch API 提供 50% 折扣
- 异步库: AsyncOpenAI, AsyncAnthropic

**预期效果**:
- 延迟降低 50-200ms/连接
- 吞吐量提升 3-5 倍
- 批处理成本降低 50%

**实现难度**: 简单-中等（1-2周）

---

### 4.6 RAG 切片策略优化

**NVIDIA 2024 基准测试结果**:
- Page-level chunking 准确率最高（0.648）
- Factoid 查询: 256-512 tokens 最佳
- 分析型查询: 1024+ tokens 最佳

**意图识别场景推荐**:
- 意图描述: 固定大小（256-512 tokens）
- 关键词库: 语义切片（按意图分组）
- 对话历史: 滑动窗口 + 10-20% overlap
- 知识库: Agentic chunking（基于用户行为动态调整）

---

### 4.7 向量数据库选型

| 场景 | 推荐方案 | 理由 |
|------|----------|------|
| 原型开发（<1M 向量） | ChromaDB | 简单 API，零运维 |
| 生产环境（1-50M） | Qdrant 或 Milvus | 高性能，开源，成本低 |
| 企业级（50M+） | Pinecone | 全托管，零运维 |

**成本对比（10M 向量）**: Milvus ~$500/月，Pinecone ~$1,200/月

---

### 4.8 Embedding 模型选择

| 模型 | 维度 | 特点 | 适用场景 |
|------|------|------|----------|
| OpenAI text-embedding-3-large | 256/1024/3072 | 性能最佳，可调维度 | 商业项目，高精度需求 |
| Cohere Embed v3 | 1024 | 100+ 语言支持 | 多语言场景 |
| Jina Embeddings v3 | 可变 | 8192 token，89 语言，开源 | 长文本，开源项目 |
| Sentence-BERT | 768 | 开源，速度快 | 成本敏感型项目 |

---

## 五、实施优先级矩阵

| 优先级 | 方案 | 预期 ROI | 实现周期 | 依赖 |
|--------|------|----------|----------|------|
| **P0** | 修复二次确认机制 | 用户体验质变 | 1天 | 无 |
| **P0** | 添加 parse-data-operation 端点 | 修复 DATA_OP 功能 | 2小时 | Python 服务 |
| **P0** | 调整查询/更新意图优先级 | 修复误识别 | 1小时 | 数据库 |
| **P1** | 语义缓存 | 90% API 成本节省 | 1周 | Redis |
| **P1** | 混合意图分类（Embedding 预筛选） | 70% 调用量减少 | 2-3周 | 向量数据库 |
| **P2** | Prompt 压缩 | 30% 进一步成本优化 | 1-2周 | LLMLingua |
| **P2** | 异步批处理优化 | 吞吐量提升 3-5x | 1-2周 | 无 |
| **P3** | RAG 完整改造 | 整体提升 50%+ | 2-4周 | 向量数据库 |

---

## 六、测试验证要点

### 修复后验证用例

1. **BUG-001/002 验证**: 输入"最近还剩多少材料啊"和"查询批次MB-F001-001的库存"，期望返回查询类意图（MATERIAL_BATCH_QUERY），而非更新类

2. **BUG-003 验证**: 输入"把产品单价改成50元"，期望 status = COMPLETED，不再出现"AI解析意图失败"

3. **BUG-004 验证**: 输入"asdfghjkl"，期望 status = NEED_CLARIFICATION，clarificationQuestion 包含可选操作列表

4. **BUG-005 验证**: 输入"查"，期望 status = PENDING_CONFIRMATION 或 NEED_CLARIFICATION，clarificationQuestion 询问具体查询对象

5. **性能验证**: LLM Fallback 路径响应时间从 4-6秒 降至 1-2秒

---

## 七、已完成功能模块

### 7.1 MQTT IoT 设备数据服务 (2026-01-04 完成)

**功能概述**: 基于 EMQX Broker 的完整 IoT 设备数据接收与处理服务，支持电子秤、温度传感器、湿度传感器、摄像头等多种设备类型。

**技术架构**:
- **消息中间件**: EMQX 5.4.1 (MQTT Broker)
- **集成方式**: Spring Integration MQTT
- **主题格式**: `cretas/{factoryId}/device/{deviceId}/{messageType}`
- **消息类型**: data / status / heartbeat

**新建文件** (10个):

| 文件 | 说明 |
|------|------|
| `entity/iot/DeviceType.java` | 设备类型枚举: SCALE, SENSOR, CAMERA, GATEWAY |
| `entity/iot/DeviceStatus.java` | 设备状态枚举: ONLINE, OFFLINE, ERROR, MAINTENANCE |
| `entity/iot/DataType.java` | 数据类型枚举: WEIGHT, TEMPERATURE, HUMIDITY, IMAGE |
| `entity/iot/IotDevice.java` | IoT 设备实体 (对应 iot_devices 表) |
| `entity/iot/IotDeviceData.java` | 设备数据记录实体 (对应 iot_device_data 表) |
| `repository/IotDeviceRepository.java` | 设备数据访问层 |
| `repository/IotDeviceDataRepository.java` | 数据记录访问层 |
| `service/IotDataService.java` | IoT 数据服务接口 |
| `service/impl/IotDataServiceImpl.java` | IoT 数据服务实现 |

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `service/mqtt/MqttSubscriber.java` | 实现全部 TODO 业务逻辑 |

**支持的设备与处理逻辑**:

| 设备类型 | 数据类型 | 处理逻辑 |
|----------|----------|----------|
| 电子秤 | WEIGHT | 存储数据 + 更新 FactoryEquipment.lastWeightReading |
| 温度传感器 | TEMPERATURE | 存储数据 + 阈值告警 (冷链 -18°C, 常温 0-25°C) |
| 湿度传感器 | HUMIDITY | 存储数据 + 阈值告警 (40%-70%) |
| 摄像头 | IMAGE | 存储事件 + 异常检测告警 (MOTION_DETECTED, ANOMALY) |

**启用方式**:
```yaml
# application.yml
mqtt:
  enabled: true
  broker: tcp://localhost:1883
  topics:
    - cretas/+/device/+/data
    - cretas/+/device/+/status
    - cretas/+/device/+/heartbeat
```

**测试命令**:
```bash
# 发送称重数据
mosquitto_pub -h localhost -p 1883 \
  -t "cretas/F001/device/SCALE-001/data" \
  -m '{"type":"WEIGHT","data":{"weight":25.5,"unit":"kg","stable":true}}'

# 发送温度数据 (冷链超温告警)
mosquitto_pub -t "cretas/F001/device/TEMP-001/data" \
  -m '{"type":"TEMPERATURE","data":{"temperature":-15.5}}'
```

---

## 八、参考资料

### RAG 和意图识别
- RAGFlow - Rise and Evolution 2024
- Comprehensive Survey of RAG (arXiv 2410.12837)
- The 2025 Guide to RAG - EdenAI

### 意图分类
- Intent Detection in the Age of LLMs (arXiv 2410.01627)
- Rasa LLM Intent Classification
- 5 Tips to Optimize LLM Intent Classification - Voiceflow

### 多轮对话和置信度
- Balancing Accuracy in Multi-Turn Intent Classification (arXiv 2411.12307)
- ProMISe Dataset - Amazon Science
- SAGE-Agent Clarification (arXiv 2511.08798)

### Embedding 模型
- Best Embedding Models Comparison - MyScale
- Mastering Intent Classification with Embeddings

### Prompt 压缩
- LLMLingua - Microsoft Research
- Prompt Compression Survey (arXiv 2410.12388)

### 缓存和性能
- Redis Semantic Caching
- RedisVL LLM Cache
- LiteLLM Caching

### 向量数据库
- Vector Database Comparison 2025
- Best Vector Databases for RAG - LangCopilot

### Chunking 策略
- Chunking in RAG - Stack Overflow
- Weaviate Chunking Strategies
- Best Chunking Strategies 2025 - Firecrawl

### 澄清问题生成
- Teaching AI to Clarify
- AmbigChat System
- AT-CoT Clarification Generation (arXiv 2504.12113)

---

*文档持续更新中，请关注 Git 提交历史*
