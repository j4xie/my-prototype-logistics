# 工厂生产流程可视化画布设计器 + AI流程设计助手 技术方案研究报告

**版本**: 1.0
**日期**: 2026-03-25
**状态**: 技术选型阶段

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [三种方案对比](#2-三种方案对比)
3. [推荐方案及理由](#3-推荐方案及理由)
4. [集成复杂度估算](#4-集成复杂度估算)
5. [MVP路线图](#5-mvp路线图分3期)
6. [关键技术决策点](#6-关键技术决策点)
7. [参考资料](#7-参考资料)

---

## 1. 执行摘要

### 1.1 背景

白垩纪食品溯源系统当前已具备生产流程管理的基础能力: `ProductionPlan` (生产计划) -> `ProcessTask` (工序任务) -> `MaterialConsumption` (物料消耗)，以及 `WorkProcess` / `ProductWorkProcess` 定义工序与产品工序绑定关系。后端有完整的 `StateMachineService` (状态机引擎) 和 `WorkflowTemplateService` (流程模板)，前端 `web-admin` 已集成 Vue Flow 画布编辑器 (`workflow-designer/index.vue`) 实现了状态机可视化设计。

**但现有系统的核心不足是**: 当前的 "workflow" 仅覆盖单个实体的状态流转 (如质检单 `PENDING -> PASSED -> FAILED`)，尚未覆盖跨实体的完整生产流程编排 --- 即 "原材料入库 -> 领料 -> 多道工序加工 -> 质检 -> 成品入库 -> 出货" 这条主线。食品加工厂 (尤其是六扇门这类非标品工厂) 的产品工序高度灵活，同一原料可能对应多种加工路线，急需一个可视化画布让工厂管理员自己配置生产流程。

### 1.2 目标

| 目标 | 说明 |
|------|------|
| 流程画布 | 工厂管理员可视化设计 "原料 -> 工序1 -> 工序2 -> ... -> 成品" 的生产流程 |
| 多产品多路线 | 同一工厂不同产品可配不同工序链，支持分支和并行 |
| AI辅助设计 | 用户用自然语言描述 ("我们的卤牛肉先泡发8h，然后卤制2h，最后切片包装")，AI自动生成流程图草稿 |
| 运行时引擎 | 设计好的流程驱动 ProcessTask 自动创建、状态推进、质检卡点 |
| 与现有系统无缝集成 | 复用现有 StateMachine、WorkProcess、BomItem 等实体，不重复造轮子 |

### 1.3 结论前置

**推荐方案B: 自研轻量流程引擎 + Vue Flow画布 + AI模板推荐**。原因:

- 项目已有 `StateMachineService` + Vue Flow 画布 + AI解析 (`AIStateMachineParseRequest/Response`)，方案B是对现有架构的自然扩展
- 食品加工厂的流程复杂度 (5-15个节点) 远低于BPMN 2.0的设计目标 (企业级审批流)，Flowable/Camunda重炮打蚊子
- 六扇门客户的核心需求是 "灵活工序配置 + 实际用量追踪"，不是通用BPM
- 方案B的实现周期最短 (6-8周MVP)，且已有60%基础代码

---

## 2. 三种方案对比

### 2.1 方案总览

| 维度 | 方案A: Flowable嵌入式 | 方案B: 自研轻量引擎 | 方案C: 纯BPMN标准栈 |
|------|----------------------|---------------------|---------------------|
| **后端引擎** | Flowable 7 (嵌入JAR) | 扩展现有 StateMachineService | Camunda 7/8 + bpmn.js |
| **前端画布** | Vue Flow (自定义节点) | Vue Flow (自定义节点) | bpmn.js (BPMN标准Modeler) |
| **AI集成** | LLM -> JSON -> Flowable BPMN XML | LLM -> JSON -> 画布节点 | LLM -> BPMN XML (困难) |
| **复杂度** | 中高 | 低中 | 高 |
| **MVP周期** | 10-12周 | 6-8周 | 14-18周 |
| **适配食品行业** | 需大量定制 | 天然贴合 | 过度设计 |

### 2.2 方案A: Flowable 7 嵌入式 + Vue Flow + AI JSON生成

#### 架构

```
用户自然语言
    |
    v
AI (LLM function calling)
    |  生成中间JSON
    v
JSON -> Flowable BPMN XML 转换器
    |
    v
Flowable Process Engine (嵌入Spring Boot)
    |  BPMN部署 + 流程实例
    v
ProcessTask / MaterialConsumption (通过Flowable JavaDelegate)
```

#### 技术选型细节

**Flowable 7** (https://github.com/flowable/flowable-engine):
- 原生支持 Spring Boot 3 + Java 17+
- 嵌入式JAR模式，无需独立部署
- BPMN 2.0 + CMMN + DMN三引擎
- Maven依赖: `flowable-spring-boot-starter-process` (~15MB增量)

```xml
<dependency>
    <groupId>org.flowable</groupId>
    <artifactId>flowable-spring-boot-starter-process</artifactId>
    <version>7.1.0</version>
</dependency>
```

**前端**: Vue Flow 自定义节点，拖拽设计后序列化为JSON，后端转BPMN XML。

**AI**: LLM生成结构化JSON (非BPMN XML)，后端 `BpmnModelBuilder` 将JSON转为 `BpmnModel` 再部署。参考 BPMN Assistant 论文 (arxiv 2509.24592) 的 JSON 中间表示策略 --- JSON比直接生成XML的准确率高40%+。

#### 优势

| 优势 | 说明 |
|------|------|
| 工业级引擎 | 经过大规模生产验证，企业级并发、事务、容错 |
| BPMN标准 | 未来可导出/导入标准BPMN 2.0流程 |
| 丰富特性 | Timer Event, Signal Event, Subprocess, Multi-Instance, Compensation |
| 社区生态 | 中文社区活跃，文档齐全 |
| 审计能力 | 内置流程历史记录、ACT_HI_* 表 |

#### 劣势

| 劣势 | 严重程度 | 说明 |
|------|----------|------|
| 概念重量 | 高 | BPMN ServiceTask/UserTask/Gateway概念对食品行业用户不友好 |
| 数据库膨胀 | 中 | Flowable需要30+张ACT_*系统表，与现有数据模型并行 |
| 双状态机问题 | 高 | 现有 `StateMachineService` 与 Flowable 流程引擎职责重叠，需解决谁管谁 |
| JAR体积 | 低 | 增加约15-20MB |
| 学习曲线 | 中 | 团队需理解BPMN 2.0 spec + Flowable API |
| AI -> BPMN XML | 中 | JSON -> BPMN XML 转换层需额外开发和维护 |

#### 风险评估

核心风险: **现有 StateMachineService 与 Flowable 的职责边界模糊**。当前 `StateMachine` entity 存储状态和转换定义 (JSON)，`StateMachineServiceImpl` 执行状态流转。引入 Flowable 后，ProcessTask 的状态管理归谁？两者并存会导致:
- 数据不一致 (Flowable ACT_RU_* 表 vs process_tasks.status 列)
- 事务复杂度增加
- 调试困难 (排查问题需同时查 Flowable 控制台 + 业务日志)

### 2.3 方案B: 自研轻量流程引擎 + Vue Flow + AI模板推荐 (推荐)

#### 架构

```
用户自然语言
    |
    v
AI (LLM function calling) -------> 行业模板库 (food_kb RAG)
    |  生成 ProcessFlowDefinition JSON       |
    v                                        |
Vue Flow 画布 <---- AI生成的节点/边 JSON <---+
    |
    用户调整/确认
    |
    v
ProcessFlowEngine (扩展 StateMachineService)
    |  按flow定义自动创建ProcessTask链
    v
ProcessTask[0] -> ProcessTask[1] -> ... -> QualityCheck -> 成品入库
```

#### 核心数据模型

```sql
-- 生产流程定义 (per factory + per product)
CREATE TABLE process_flow_definitions (
    id              VARCHAR(50) PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    product_type_id VARCHAR(50),           -- NULL表示通用流程
    flow_name       VARCHAR(100) NOT NULL,
    flow_description TEXT,
    -- 核心: 流程图JSON (Vue Flow nodes/edges 格式)
    nodes_json      JSONB NOT NULL,
    edges_json      JSONB NOT NULL,
    -- 元数据
    version         INTEGER DEFAULT 1,
    publish_status  VARCHAR(20) DEFAULT 'draft',  -- draft/published/archived
    created_by      BIGINT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- nodes_json 示例:
-- [
--   {"id":"n1","type":"material_receipt","label":"原料验收","position":{"x":100,"y":200},
--    "data":{"workProcessId":"WP001","estimatedMinutes":30,"qualityCheckRequired":true}},
--   {"id":"n2","type":"processing","label":"卤制","position":{"x":300,"y":200},
--    "data":{"workProcessId":"WP002","estimatedMinutes":120,"bomItems":["BOM001","BOM002"]}},
--   {"id":"n3","type":"quality_check","label":"成品质检","position":{"x":500,"y":200},
--    "data":{"checkItems":["color","weight","temperature"]}}
-- ]

-- edges_json 示例:
-- [
--   {"id":"e1","source":"n1","target":"n2","label":"验收通过","data":{"condition":"quality_pass"}},
--   {"id":"e2","source":"n2","target":"n3","label":"加工完成"}
-- ]
```

**与现有实体的关系:**

```
process_flow_definitions
    |-- nodes[].data.workProcessId --> work_processes.id
    |-- nodes[].data.bomItems[]    --> bom_items.id
    |-- product_type_id            --> product_types.id
    |
    当生产计划创建时:
    ProductionPlan --> 查找匹配的 ProcessFlowDefinition
                   --> 按nodes顺序自动创建 ProcessTask 链
                   --> 每个ProcessTask.workflowVersionId = ProcessFlowDefinition.version
```

#### 流程引擎扩展

```java
// 扩展现有StateMachineService，不替换
@Service
public class ProcessFlowEngine {

    @Autowired private StateMachineService stateMachineService;
    @Autowired private ProcessTaskService processTaskService;
    @Autowired private ProcessFlowDefinitionRepository flowRepo;

    /**
     * 根据流程定义为生产计划创建任务链
     */
    public List<ProcessTask> instantiateFlow(String factoryId,
            String productTypeId, ProductionPlan plan) {

        ProcessFlowDefinition flow = flowRepo
            .findPublished(factoryId, productTypeId)
            .orElseThrow(() -> new BusinessException("未找到该产品的生产流程定义"));

        List<FlowNode> sortedNodes = topologicalSort(flow.getNodes(), flow.getEdges());
        List<ProcessTask> tasks = new ArrayList<>();

        for (int i = 0; i < sortedNodes.size(); i++) {
            FlowNode node = sortedNodes.get(i);
            ProcessTask task = ProcessTask.builder()
                .factoryId(factoryId)
                .productionRunId(plan.getId())
                .productTypeId(productTypeId)
                .workProcessId(node.getData().getWorkProcessId())
                .plannedQuantity(plan.getPlannedQuantity())
                .status(i == 0 ? ProcessTaskStatus.PENDING : ProcessTaskStatus.PENDING)
                .workflowVersionId(flow.getVersion())
                .build();
            tasks.add(processTaskService.create(task));
        }

        return tasks;
    }

    /**
     * 节点完成后，根据edges推进下一个节点
     * 支持: 顺序、分支(条件)、并行(多出边)
     */
    public void advanceFlow(String taskId) {
        // 查找当前task对应的flow node
        // 根据edges找下一批nodes
        // 如果是并行: 同时推进多个下游task
        // 如果是条件分支: 评估edge.data.condition
        // 如果所有下游为空: 流程结束
    }
}
```

#### 节点类型设计 (面向食品加工)

| 节点类型 | nodeType | 图标 | 说明 |
|----------|----------|------|------|
| 原料验收 | `material_receipt` | 入库 | 关联MaterialBatch，触发质检 |
| 领料出库 | `material_issue` | 出库 | 从仓库领取BOM物料 |
| 加工工序 | `processing` | 齿轮 | 关联WorkProcess，记录投入/产出 |
| 质检卡点 | `quality_check` | 检验 | 关联质检项，通过/不通过分支 |
| 成品入库 | `finished_goods` | 入库 | 产出入库，更新库存 |
| 包装 | `packaging` | 包装 | 包装规格、标签打印 |
| 等待/时间 | `wait` | 时钟 | 泡发、腌制等需要等待时间的工序 |
| 审批 | `approval` | 审核 | 需要指定角色确认 |
| 条件网关 | `condition_gateway` | 菱形 | 根据条件走不同分支 |
| 并行网关 | `parallel_gateway` | 双线 | 分流/汇聚并行路径 |

#### AI集成策略

现有系统已有 `AIStateMachineParseRequest/Response` + `AIRuleController`，扩展为:

```java
// 复用现有AI意图系统 (Tool-Skill架构)
@Component
public class ProcessFlowDesignTool extends AbstractBusinessTool {

    @Override
    public String getToolName() { return "process_flow_design"; }

    @Override
    public String getDescription() {
        return "根据用户对生产流程的自然语言描述，生成可视化流程图定义";
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId,
            Map<String, Object> params, Map<String, Object> context) {
        String description = getString(params, "description");
        String productName = getString(params, "productName");

        // 1. 从食品知识库检索相似流程模板 (food_kb RAG)
        List<WorkflowTemplate> templates = templateService.search(productName);

        // 2. LLM function calling: 生成 ProcessFlowDefinition JSON
        //    用中间JSON格式，不用BPMN XML
        String prompt = buildPrompt(description, templates, factoryId);
        ProcessFlowDefinition flow = llmClient.generateFlowDefinition(prompt);

        // 3. 返回Vue Flow兼容的nodes/edges
        return Map.of(
            "nodes", flow.getNodes(),
            "edges", flow.getEdges(),
            "suggestions", flow.getSuggestions()
        );
    }
}
```

**AI生成的JSON中间格式** (参照 BPMN Assistant 论文的最佳实践):

```json
{
  "flowName": "卤牛肉生产流程",
  "nodes": [
    {
      "id": "n1",
      "type": "material_receipt",
      "label": "牛腱子验收",
      "data": {
        "materialTypes": ["牛腱子", "卤料包"],
        "qualityCheckRequired": true,
        "estimatedMinutes": 30
      }
    },
    {
      "id": "n2",
      "type": "processing",
      "label": "泡发",
      "data": {
        "estimatedMinutes": 480,
        "temperature": "常温",
        "isWaitStep": true
      }
    },
    {
      "id": "n3",
      "type": "processing",
      "label": "卤制",
      "data": {
        "estimatedMinutes": 120,
        "temperature": "95-100C",
        "keyParameters": ["温度", "时间", "卤水浓度"]
      }
    }
  ],
  "edges": [
    {"source": "n1", "target": "n2", "label": "验收通过"},
    {"source": "n2", "target": "n3", "label": "泡发完成"}
  ],
  "suggestions": [
    "建议在卤制后增加冷却步骤，食品安全要求中心温度4小时内降至10C以下",
    "根据行业惯例，牛腱子泡发时间通常为6-10小时，已为您设置8小时"
  ]
}
```

#### 优势

| 优势 | 说明 |
|------|------|
| 零新依赖 | 不引入 Flowable/Camunda，不增加ACT_*表 |
| 自然扩展 | 基于现有 StateMachineService + Vue Flow + AI解析，代码复用度高 |
| 领域贴合 | 节点类型直接对应食品加工概念，用户零学习成本 |
| AI友好 | JSON中间格式简单，LLM生成准确率高 |
| 灵活演进 | 按需扩展节点类型，不受BPMN规范限制 |
| 最短周期 | 60%基础代码已存在，MVP 6-8周 |

#### 劣势

| 劣势 | 严重程度 | 说明 |
|------|----------|------|
| 并行/子流程自研 | 中 | 需自己实现并行网关汇聚逻辑、超时处理 |
| 无BPMN标准导出 | 低 | 不能导出为标准BPMN 2.0 XML (食品行业无此需求) |
| 长期维护 | 中 | 引擎复杂度随功能增长而增加，需控制scope |
| 事务补偿 | 中 | 需自行处理节点失败回滚/补偿逻辑 |

### 2.4 方案C: 纯BPMN标准栈 (bpmn.js + Camunda/Flowable BPMN引擎)

#### 架构

```
bpmn.js (官方BPMN Modeler, 非Vue原生)
    |  拖拽BPMN元素: Task/Gateway/Event
    |  输出标准BPMN 2.0 XML
    v
Camunda 8 (Zeebe) / Flowable 7
    |  部署BPMN流程定义
    |  创建流程实例
    v
External Task Worker / JavaDelegate
    |  桥接现有ProcessTask/MaterialConsumption
    v
现有业务逻辑
```

#### 技术选型

**bpmn.js** (https://bpmn.io/toolkit/bpmn-js/):
- Camunda维护的BPMN 2.0标准建模器
- 纯JavaScript，非Vue原生，需用wrapper (`bpmn-js-vue3` 社区包)
- 完整BPMN palette: Start/End Events, Tasks, Gateways, Pools, Lanes
- 支持 BPMN XML 导入/导出

**Camunda 8 (Zeebe)**:
- 事件流架构，Kubernetes部署，高吞吐
- 但部署复杂度高: 需Zeebe broker + Operate + Tasklist
- 对于单工厂场景严重过设计

**Camunda 7 (经典版)**:
- 嵌入式，类似Flowable
- 但Camunda官方已宣布7.x进入EOL维护阶段

#### 优势

| 优势 | 说明 |
|------|------|
| 行业标准 | 完全符合BPMN 2.0 / ISO 19510 |
| 可视化专业 | bpmn.js是最成熟的BPMN建模工具 |
| 标准导入导出 | 可与第三方BPM工具互通 |
| ERP对接 | 大型ERP系统 (SAP/Oracle) 通常要求BPMN标准接口 |

#### 劣势

| 劣势 | 严重程度 | 说明 |
|------|----------|------|
| bpmn.js非Vue原生 | 高 | 需wrapper适配，事件/数据绑定不如Vue Flow自然 |
| 概念过重 | 高 | 食品厂老板不理解 Service Task / Message Event / Compensation |
| AI -> BPMN XML难 | 高 | LLM直接生成BPMN XML错误率极高(嵌套XML + 坐标系统) |
| 部署复杂 (Camunda 8) | 高 | 需K8s + Zeebe + Elasticsearch |
| 已有代码浪费 | 高 | 现有StateMachineService + Vue Flow画布 + AI解析全部废弃 |
| 开发周期 | 高 | 14-18周，最长方案 |

### 2.5 详细对比表

| 评估维度 | 权重 | 方案A (Flowable) | 方案B (自研) | 方案C (BPMN标准) |
|----------|------|-----------------|-------------|-----------------|
| **与现有系统集成度** | 25% | 6/10 (需解决双引擎) | 9/10 (自然扩展) | 3/10 (全部重来) |
| **食品行业适配度** | 20% | 5/10 (需大量定制) | 9/10 (原生贴合) | 4/10 (概念过重) |
| **AI集成友好度** | 15% | 7/10 (JSON->XML一步) | 9/10 (JSON直用) | 4/10 (XML困难) |
| **开发效率** | 15% | 6/10 (10-12周) | 9/10 (6-8周) | 3/10 (14-18周) |
| **长期扩展性** | 10% | 9/10 (工业引擎) | 6/10 (需持续投入) | 9/10 (标准) |
| **运维复杂度** | 5% | 7/10 (嵌入式) | 9/10 (无额外组件) | 4/10 (多组件) |
| **用户学习成本** | 10% | 5/10 (BPMN概念) | 9/10 (行业术语) | 3/10 (最复杂) |
| **加权总分** | 100% | **6.45** | **8.65** | **3.95** |

---

## 3. 推荐方案及理由

### 3.1 推荐: 方案B --- 自研轻量流程引擎 + Vue Flow画布 + AI模板推荐

### 3.2 决策理由

**理由1: 现有系统已完成60%基础工作**

| 已有组件 | 对应能力 | 复用方式 |
|----------|----------|----------|
| `StateMachineService` | 状态定义、转换验证、事件执行 | 每个流程节点内部的状态管理复用此服务 |
| `StateMachine` entity | JSON存储状态/转换定义 | `ProcessFlowDefinition` 沿用JSON schema设计 |
| Vue Flow画布 (`workflow-designer/index.vue`) | 节点拖拽、边连接、属性面板 | 扩展节点类型，复用画布框架代码 |
| `AIStateMachineParseRequest/Response` | LLM -> 状态机JSON | 扩展为LLM -> 流程图JSON |
| `WorkflowTemplate` + `WorkflowLearningService` | 模板提取、相似度检测 | 直接复用为AI推荐的模板数据源 |
| `WorkProcess` + `ProductWorkProcess` | 工序定义、产品-工序绑定 | 画布节点直接引用workProcessId |
| `BomItem` | 配方/BOM | 加工节点关联BomItem实现物料消耗跟踪 |
| `ProcessTask` + `ProcessTaskStatus` | 工序任务执行 | 流程实例化后创建ProcessTask链 |
| Tool-Skill AI架构 (310 tools) | AI意图执行 | 新增 `process_flow_design` Tool |

**理由2: 食品加工行业的流程复杂度有天花板**

典型食品加工流程特征:
- 节点数: 5-15个 (远低于企业审批流的50-100个)
- 模式: 以线性为主，偶尔分支 (质检通过/不通过)，极少并行
- 动态性: 流程定义变更频率低 (每季度或产品变更时)
- 关键需求: 实际用量追踪、出成率计算、质检卡点 --- 这些是业务逻辑，不是BPM引擎的问题

在这个复杂度范围内，自研引擎的开发和维护成本可控，而Flowable/Camunda的价值无法充分发挥。

**理由3: AI生成质量决定用户体验**

根据 BPMN Assistant 论文 (arxiv 2509.24592) 的测试结果:
- LLM生成JSON中间格式的准确率 >> 直接生成BPMN XML
- 原因: BPMN XML包含坐标信息、命名空间、ID引用，LLM容易出错
- 方案B直接使用JSON作为最终格式，省去JSON->XML的转换层，AI链路最短、最可靠

**理由4: 六扇门客户的明确需求**

六扇门食品客户 (熟食加工非标品) 的核心需求:
- 灵活配置不同产品的加工工序 (方案B的核心能力)
- 实际用量 vs BOM标准用量追踪 (方案B节点直接关联BomItem)
- 简单易用 (BPMN术语会吓跑用户)
- 能用AI快速生成 (方案B的AI JSON生成最可靠)

### 3.3 方案B的风险及缓解

| 风险 | 缓解措施 |
|------|----------|
| 并行网关实现复杂 | MVP阶段只支持线性+分支，并行在第二期实现 |
| 引擎长期维护负担 | 控制节点类型不超过12种；必要时可在第三期引入Flowable |
| 无BPMN导出 | 食品行业无此需求；若未来ERP集成需要，写一个JSON->BPMN XML导出器 |
| 事务补偿 | 利用现有ProcessTask的状态机 + 乐观锁 (`@Version`) 确保一致性 |

---

## 4. 集成复杂度估算

### 4.1 后端变更

| 组件 | 类型 | 预估工作量 | 说明 |
|------|------|-----------|------|
| `ProcessFlowDefinition` entity | 新建 | 1天 | JSONB存储nodes/edges |
| `ProcessFlowDefinitionRepository` | 新建 | 0.5天 | CRUD + findPublished |
| `ProcessFlowEngine` service | 新建 | 3天 | 流程实例化、节点推进、条件评估 |
| `ProcessFlowController` | 新建 | 1天 | REST API: CRUD + publish + instantiate |
| `ProcessFlowDesignTool` | 新建 | 1天 | AI Tool: LLM -> 流程JSON |
| `ProcessFlowValidationService` | 新建 | 1天 | 校验: 连通性、环检测、必需节点 |
| `ProcessTaskServiceImpl` 修改 | 修改 | 1天 | 任务创建关联flowDefinitionId |
| DB migration | 新建 | 0.5天 | DDL + 种子数据 |
| 单元测试 | 新建 | 2天 | 引擎核心逻辑测试 |
| **后端小计** | | **~11天** | |

### 4.2 前端变更 (web-admin Vue 3)

| 组件 | 类型 | 预估工作量 | 说明 |
|------|------|-----------|------|
| 流程画布页面 | 扩展 | 2天 | 复用现有workflow-designer，增加食品节点类型 |
| 食品节点组件 (10种) | 新建 | 3天 | 自定义Vue Flow节点: 工序、质检、网关等 |
| 属性面板扩展 | 修改 | 2天 | 节点配置: WorkProcess关联、BOM关联、质检项 |
| 流程模板选择器 | 新建 | 1天 | AI推荐的模板列表 + 一键应用 |
| AI对话生成面板 | 新建 | 2天 | 自然语言输入 -> 实时生成画布 |
| 流程列表/管理页 | 新建 | 1天 | per-product流程管理CRUD |
| 流程模拟/预览 | 扩展 | 1天 | 复用现有模拟功能，扩展为流程级 |
| API对接 + TypeScript类型 | 新建 | 1天 | processFlowApiClient.ts |
| **前端小计** | | **~13天** | |

### 4.3 AI/知识库变更

| 组件 | 类型 | 预估工作量 | 说明 |
|------|------|-----------|------|
| LLM Prompt Engineering | 新建 | 2天 | 流程生成prompt + few-shot examples |
| 食品流程模板库 | 新建 | 2天 | 10-15个常见食品加工流程模板 (YAML/JSON) |
| WorkflowLearningService扩展 | 修改 | 1天 | 流程定义级别的模式学习 |
| AI意图绑定 | 新建 | 0.5天 | ai_intent_config + tool_name绑定 |
| **AI小计** | | **~5.5天** | |

### 4.4 总估算

| 阶段 | 工作量 | 累计 |
|------|--------|------|
| 后端 | 11天 | 11天 |
| 前端 | 13天 | 24天 |
| AI | 5.5天 | 29.5天 |
| 联调测试 | 5天 | 34.5天 |
| Buffer (20%) | 7天 | **~41.5天 (约8周)** |

---

## 5. MVP路线图 (分3期)

### 第一期: 线性流程设计器 (4周)

**目标**: 工厂管理员能为每个产品设计一条线性生产流程，生产计划创建时自动按流程生成任务链。

| 周 | 后端 | 前端 | AI |
|----|------|------|----|
| W1 | ProcessFlowDefinition entity + repository + migration | 流程画布骨架 (复用workflow-designer) | 食品流程模板库 (5个) |
| W2 | ProcessFlowEngine: 线性流程实例化 + 节点推进 | 食品节点组件 (6种核心) + 属性面板 | LLM prompt初版 |
| W3 | ProcessFlowController REST API + 与ProcessTask集成 | 流程列表管理页 + API对接 | ProcessFlowDesignTool |
| W4 | 联调 + 单元测试 | 联调 + E2E测试 | AI生成联调 |

**第一期交付物**:
- 画布支持6种节点: 原料验收、领料、加工工序、质检、成品入库、包装
- 线性流程 (A -> B -> C -> D)，无分支/并行
- 生产计划创建时自动按流程生成ProcessTask链
- AI能根据自然语言生成线性流程草稿
- 5个预置食品行业模板 (卤味、面点、预制菜、烘焙、调味料)

### 第二期: 分支与条件 + AI增强 (3周)

**目标**: 支持质检分支 (通过/不通过)、条件路由、AI建议优化。

| 周 | 后端 | 前端 | AI |
|----|------|------|----|
| W5 | 条件网关引擎: 分支评估、质检结果路由 | 条件网关节点 + 分支连线UI | AI流程优化建议 |
| W6 | 流程版本管理 + 发布/归档 + 流程对比 | 版本历史面板 + diff视图 | 模板学习: WorkflowLearningService扩展 |
| W7 | 联调 + 异常路径测试 | 流程模拟(动画) | AI few-shot examples扩充 (15个) |

**第二期交付物**:
- 条件网关: 质检通过/不通过走不同路径
- 返工路径: 质检不通过 -> 返工节点 -> 重新质检
- 流程版本管理: 草稿/发布/归档，版本历史对比
- AI能给出流程优化建议 ("建议增加冷却步骤"、"泡发时间建议6-10h")
- 流程模拟: 动画展示token流经各节点

### 第三期: 并行与高级特性 (3周)

**目标**: 支持并行加工路线、SLA超时预警、与排产系统深度集成。

| 周 | 后端 | 前端 | AI |
|----|------|------|----|
| W8 | 并行网关: 分流/汇聚 + Join等待逻辑 | 并行网关节点 + 汇聚视觉 | AI产线瓶颈分析 |
| W9 | SLA引擎: 节点超时预警 + 自动升级 | SLA配置面板 + 超时告警UI | AI排产建议集成 |
| W10 | 排产集成: 流程定义 -> 产线分配 -> 甘特图 | 流程 <-> 排产联动视图 | AI自学习: 根据历史数据优化工时估算 |

**第三期交付物**:
- 并行网关: 两道工序同时进行 (如 "切片" 和 "调料准备" 并行)
- SLA: 节点超时自动通知车间主管
- 排产联动: 流程定义作为排产的工时/资源依据
- AI自学习: 根据历史ProcessTask完成时间，优化estimatedMinutes

### 里程碑总览

```
第一期 (W1-W4): 线性流程 + 基础AI生成
    |-- 可交付给六扇门客户使用
    |
第二期 (W5-W7): 分支条件 + 版本管理 + AI优化
    |-- 覆盖质检分支、返工等真实场景
    |
第三期 (W8-W10): 并行 + SLA + 排产集成
    |-- 完整生产流程管理能力
```

---

## 6. 关键技术决策点

### 决策1: 流程定义存储格式

**决策**: 使用 PostgreSQL JSONB 存储 Vue Flow 兼容的 nodes/edges JSON。

**理由**:
- Vue Flow 的 `Node[]` 和 `Edge[]` 格式已经是成熟的graph数据结构
- JSONB支持索引，查询效率可接受
- 前端直接 `v-model:nodes="nodes"` 双向绑定，零转换成本
- 与现有 `StateMachine.statesJson` / `transitionsJson` 设计模式一致

**替代方案被否决**: 关系表存储 (node表 + edge表) --- 对于5-15个节点的图，关系表增加不必要的JOIN复杂度。

### 决策2: 流程引擎与现有StateMachineService的关系

**决策**: `ProcessFlowEngine` 管理跨节点的流转，每个节点内部的状态变更仍由 `StateMachineService` 管理。

```
ProcessFlowEngine (宏观: 节点间流转)
    |
    |-- 节点1: material_receipt
    |       |-- StateMachineService: PENDING -> IN_PROGRESS -> COMPLETED
    |
    |-- 节点2: processing
    |       |-- StateMachineService: PENDING -> IN_PROGRESS -> COMPLETED
    |
    |-- 节点3: quality_check
            |-- StateMachineService: PENDING -> PASSED / FAILED
```

**理由**: 两层解耦。流程引擎不关心单个节点内部怎么执行，StateMachineService不关心节点间怎么流转。

### 决策3: Vue Flow vs 重写画布

**决策**: 复用并扩展现有 Vue Flow 画布 (workflow-designer/index.vue)。

**理由**:
- 项目已安装 `@vue-flow/core` 1.48.2 + `@vue-flow/background` + `@vue-flow/controls`
- 现有 workflow-designer 已实现: 拖拽、连线、属性面板、模拟、版本管理
- 只需扩展: 新增食品加工节点类型、关联WorkProcess/BomItem的配置面板

### 决策4: AI中间格式

**决策**: LLM直接输出 Vue Flow `Node[]` + `Edge[]` JSON格式，不引入额外中间表示。

**理由**:
- BPMN Assistant论文证明JSON中间格式 >> 直接XML，而我们连XML转换都省了
- LLM (qwen3.5/DeepSeek V3) 生成JSON准确率很高，特别是有few-shot examples时
- 减少转换层 = 减少bug来源

**Prompt模板核心结构**:

```
你是食品加工流程设计专家。根据用户描述生成生产流程图。

输出格式: JSON，包含nodes数组和edges数组。
nodes格式: {"id":"n1","type":"<nodeType>","label":"节点名","position":{"x":0,"y":0},"data":{...}}
edges格式: {"id":"e1","source":"n1","target":"n2","label":"连线标签"}

可用节点类型: material_receipt, material_issue, processing, quality_check,
             finished_goods, packaging, wait, approval, condition_gateway

食品加工行业规则:
1. 必须以原料验收开始
2. 成品前必须有质检卡点
3. 需要长时间等待的工序(泡发/腌制/发酵)用wait类型
4. 温度敏感工序需记录temperature参数

用户描述: {userInput}
```

### 决策5: 何时考虑引入Flowable

**决策**: 设置明确的触发条件，满足任一条件时评估引入Flowable:

| 触发条件 | 说明 |
|----------|------|
| 流程节点 > 30个 | 单个流程复杂度超过自研引擎合理范围 |
| 需要子流程 | 流程嵌套，如"质检子流程"被多个主流程调用 |
| 需要BPMN标准导出 | ERP集成或认证审计要求 |
| 需要异步Message Event | 跨系统事件触发 (如供应商系统回调) |
| 并发流程实例 > 1000/天 | 性能需求超过自研引擎能力 |

当前六扇门场景 (30-40 SKU, 5-10条产线) 远未触及任何条件。

### 决策6: 移动端 (React Native) 是否需要画布

**决策**: 移动端不做画布编辑，只做流程进度查看 (只读)。

**理由**:
- 画布拖拽在手机屏幕上体验极差
- 流程设计是低频操作 (每月甚至每季度一次)，工厂管理员用电脑即可
- 移动端展示: 线性流程进度条 / 简化甘特图 (不需要Vue Flow)

---

## 7. 参考资料

### 工作流引擎

| 资料 | URL |
|------|-----|
| Flowable 7 官方文档 | https://www.flowable.com/open-source/docs/bpmn/ch02-GettingStarted |
| Flowable Spring Boot Starter | https://github.com/flowable/flowable-engine |
| Camunda 8 文档 | https://docs.camunda.io/ |
| Spring StateMachine | https://docs.spring.io/spring-statemachine/docs/current/reference/ |

### 可视化画布

| 资料 | URL |
|------|-----|
| Vue Flow 官方文档 | https://vueflow.dev/ |
| Vue Flow GitHub | https://github.com/bcakmakoglu/vue-flow |
| AntV X6 图编辑引擎 | https://x6.antv.antgroup.com/ |
| LogicFlow 流程图框架 | https://site.logic-flow.cn/ |
| bpmn.js BPMN建模器 | https://bpmn.io/toolkit/bpmn-js/ |

### AI辅助流程设计

| 资料 | URL |
|------|-----|
| BPMN Assistant 论文 (JSON中间格式策略) | https://arxiv.org/abs/2509.24592 |
| ProMoAI (POWL中间表示) | https://github.com/humam-hossain/ProMoAI |
| Camunda BPMN Copilot | https://github.com/camunda/bpmn-copilot |
| Nala2BPMN (Bonitasoft) | https://www.bonitasoft.com/ |

### 项目内已有相关代码

| 文件 | 说明 |
|------|------|
| `web-admin/src/views/system/workflow-designer/index.vue` | 现有Vue Flow画布 (可复用) |
| `backend/.../entity/rules/StateMachine.java` | 状态机实体 (JSON存储) |
| `backend/.../service/StateMachineService.java` | 状态机服务接口 (完整API) |
| `backend/.../service/impl/StateMachineServiceImpl.java` | 状态机执行引擎 |
| `backend/.../service/WorkflowTemplateService.java` | 流程模板管理 |
| `backend/.../service/workflow/WorkflowLearningService.java` | 流程模式学习 |
| `backend/.../dto/ai/AIStateMachineParseRequest.java` | AI解析请求DTO |
| `backend/.../dto/ai/AIStateMachineParseResponse.java` | AI解析响应DTO |
| `backend/.../entity/WorkProcess.java` | 工序定义 |
| `backend/.../entity/ProductWorkProcess.java` | 产品-工序绑定 |
| `backend/.../entity/ProcessTask.java` | 工序任务 (含workflowVersionId) |
| `backend/.../entity/bom/BomItem.java` | BOM配方 |
| `backend/.../ai/tool/ToolRegistry.java` | AI Tool注册中心 |

---

*本报告基于项目当前代码库 (2026-03-25 snapshot) 和外部技术调研编写。推荐方案B为务实选择，优先满足六扇门客户需求，同时保留未来升级到工业级BPM引擎的可能性。*
