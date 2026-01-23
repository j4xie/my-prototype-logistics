# CretasFoodTrace 多租户AI平台架构融合决策文档

> **版本**: v2.0
> **日期**: 2026-01-06
> **核心定位**: 多租户食品溯源AI平台
> **决策原则**: 六大架构模式的有机融合，而非单一选择

---

## 目录

1. [系统现状分析](#1-系统现状分析)
2. [六大架构模式详解](#2-六大架构模式详解)
3. [架构优劣矩阵对比](#3-架构优劣矩阵对比)
4. [融合架构设计方案](#4-融合架构设计方案)
5. [功能模块与架构映射](#5-功能模块与架构映射)
6. [实施路径与风险评估](#6-实施路径与风险评估)

---

## 1. 系统现状分析

### 1.1 技术栈概览

| 层级 | 技术选型 | 规模指标 |
|------|----------|----------|
| **后端框架** | Spring Boot 2.7.15 (单体) | 79 Service, 104 Repository |
| **数据库** | MySQL 8.0 (单实例) | 135 JPA Entity |
| **缓存** | Redis + 内存二级缓存 | 双层降级策略 |
| **向量引擎** | DJL + gte-base-zh | 768维向量 |
| **前端** | Expo 53 + TypeScript | 590文件, 301屏幕 |
| **IoT** | MQTT + ISAPI + 智能秤 | 5品牌设备适配 |

### 1.2 多租户AI核心功能

```
┌─────────────────────────────────────────────────────────────┐
│                    5层意图识别架构                           │
├─────────────────────────────────────────────────────────────┤
│  L1: SHA256精确缓存 ──→ 命中率 ~40%                         │
│  L2: 正则表达式匹配 ──→ 命中率 ~15%                         │
│  L3: 关键词加权匹配 ──→ 命中率 ~25%                         │
│  L4: DJL语义向量匹配 ──→ 命中率 ~15%                        │
│  L5: LLM推理兜底 ──→ 命中率 ~5% (qwen-plus)                │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 当前架构约束

| 约束项 | 现状 | 影响 |
|--------|------|------|
| **分布式基础设施** | 无 (无Spring Cloud/Nacos/K8s) | 无法水平扩展 |
| **消息队列** | 无 | AI任务无法异步解耦 |
| **租户隔离** | JPA @Filter + AOP | 存在3个P0安全漏洞 |
| **团队规模** | <10人 | 研究表明适合模块化单体 |

### 1.4 已识别的P0安全漏洞

1. **Controller层 factoryId 未透传** - 部分接口缺少租户参数
2. **缓存Key缺少租户维度** - `intent:sha256:xxx` 应为 `intent:F001:sha256:xxx`
3. **意图识别缺少工厂过滤** - 查询时未添加 factoryId 条件

---

## 2. 六大架构模式详解

### 2.1 分布式多Agent架构 (Distributed Multi-Agent)

**核心理念**: 多个自治Agent协作完成复杂任务

```
┌──────────────────────────────────────────────────────────────┐
│                    分布式多Agent架构                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐                │
│   │ Intent  │    │ Form    │    │ Query   │                │
│   │ Agent   │    │ Agent   │    │ Agent   │                │
│   └────┬────┘    └────┬────┘    └────┬────┘                │
│        │              │              │                       │
│        └──────────────┼──────────────┘                       │
│                       │                                      │
│              ┌────────▼────────┐                            │
│              │  Orchestrator   │ ◄── 中央协调器              │
│              │    Agent        │                            │
│              └────────┬────────┘                            │
│                       │                                      │
│              ┌────────▼────────┐                            │
│              │  Shared Memory  │ ◄── Redis/Vector DB        │
│              └─────────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

**适用场景**:
- 复杂意图需要多步推理
- AI分析报告生成
- 跨模块协调任务

**CretasFoodTrace映射**:
- 12个Intent Handler 可演化为独立Agent
- FormIntentHandler、ScaleIntentHandler、CameraIntentHandler等

---

### 2.2 面向服务架构 (SOA)

**核心理念**: 松耦合服务通过标准协议通信

```
┌──────────────────────────────────────────────────────────────┐
│                      SOA 架构                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │  Auth       │  │  Intent     │  │  IoT        │        │
│   │  Service    │  │  Service    │  │  Service    │        │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│          │                │                │                 │
│          └────────────────┼────────────────┘                 │
│                           │                                  │
│                  ┌────────▼────────┐                        │
│                  │   ESB / API     │ ◄── 企业服务总线        │
│                  │   Gateway       │                        │
│                  └────────┬────────┘                        │
│                           │                                  │
│                  ┌────────▼────────┐                        │
│                  │  Service        │                        │
│                  │  Registry       │                        │
│                  └─────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
```

**适用场景**:
- 多系统集成 (ERP、WMS等)
- 标准化接口暴露
- 企业级服务治理

**CretasFoodTrace映射**:
- 66个Controller可按业务域划分为逻辑服务
- `/api/mobile/{factoryId}/*` 已具备多租户路由雏形

---

### 2.3 组件化/模块化架构 (Modular Monolith)

**核心理念**: 单体应用内部按业务领域划分自治模块

```
┌──────────────────────────────────────────────────────────────┐
│                   模块化单体架构                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                 Application Layer                    │   │
│   ├─────────────────────────────────────────────────────┤   │
│   │                                                      │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│   │  │ 生产模块  │  │ 质量模块  │  │ AI模块   │          │   │
│   │  │          │  │          │  │          │          │   │
│   │  │ ·批次管理 │  │ ·质检记录 │  │ ·意图识别 │          │   │
│   │  │ ·排程计划 │  │ ·处置审批 │  │ ·表单生成 │          │   │
│   │  │ ·IoT集成  │  │ ·追溯查询 │  │ ·智能分析 │          │   │
│   │  └──────────┘  └──────────┘  └──────────┘          │   │
│   │                                                      │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│   │  │ 设备模块  │  │ 人员模块  │  │ 报表模块  │          │   │
│   │  └──────────┘  └──────────┘  └──────────┘          │   │
│   │                                                      │   │
│   ├─────────────────────────────────────────────────────┤   │
│   │             Shared Kernel (公共内核)                 │   │
│   │  · BaseEntity · TenantContext · EventBus           │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**适用场景**:
- 团队规模 <10人
- 需要快速迭代
- 未来可能拆分微服务

**CretasFoodTrace映射**:
- 79个Service可按领域重组为6个核心模块
- 当前已有 `service/impl/` 扁平结构，需重构为模块包

---

### 2.4 事件驱动架构 (Event-Driven / CQRS)

**核心理念**: 通过事件解耦组件，支持CQRS读写分离

```
┌──────────────────────────────────────────────────────────────┐
│                   事件驱动架构 (CQRS)                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐              ┌─────────────┐              │
│   │   Command   │              │    Query    │              │
│   │   Handler   │              │   Handler   │              │
│   └──────┬──────┘              └──────┬──────┘              │
│          │                            │                      │
│          ▼                            │                      │
│   ┌─────────────┐              ┌──────▼──────┐              │
│   │   Write     │   ─Event─►   │    Read     │              │
│   │   Model     │              │    Model    │              │
│   └──────┬──────┘              └─────────────┘              │
│          │                                                   │
│          ▼                                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   Event Bus                          │   │
│   │  · IntentRecognizedEvent  · BatchCreatedEvent       │   │
│   │  · QualityCheckedEvent    · AlertTriggeredEvent     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**适用场景**:
- AI意图识别后的异步处理
- 审计追溯 (Event Sourcing)
- 高吞吐量读写分离

**CretasFoodTrace映射**:
- 意图识别 → 表单生成 → 数据提交 可编排为事件链
- 质量检测 → 异常处置 → 通知推送 适合事件驱动

---

### 2.5 解释器模式 (Interpreter Pattern)

**核心理念**: DSL/规则引擎驱动的灵活业务逻辑

```
┌──────────────────────────────────────────────────────────────┐
│                    解释器模式架构                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  Rule Engine                         │   │
│   │                                                      │   │
│   │   "查询原料库存"  ──parse──►  AST                    │   │
│   │                                                      │   │
│   │   ┌─────────────────────────────────────────┐       │   │
│   │   │  Expression Tree                         │       │   │
│   │   │                                          │       │   │
│   │   │       [Intent: QUERY]                    │       │   │
│   │   │           /      \                       │       │   │
│   │   │    [Entity]    [Action]                  │       │   │
│   │   │       │           │                      │       │   │
│   │   │   "原料"      "库存查询"                 │       │   │
│   │   └─────────────────────────────────────────┘       │   │
│   │                                                      │   │
│   │   ──evaluate──►  IntentResult                       │   │
│   │                                                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  DSL Examples                        │   │
│   │                                                      │   │
│   │   intent "MATERIAL_QUERY" {                         │   │
│   │     keywords: ["原料", "库存", "查询"]              │   │
│   │     entity: "MaterialBatch"                         │   │
│   │     action: "list"                                  │   │
│   │     params: { factoryId: $context.factoryId }       │   │
│   │   }                                                  │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**适用场景**:
- 意图识别规则配置化
- 动态表单Schema生成
- 多租户差异化业务规则

**CretasFoodTrace映射**:
- 94个Intent配置 → DSL化管理
- FormSchema生成 → 模板解释器
- 转换率计算 → 表达式引擎

---

### 2.6 微服务架构 (Microservices)

**核心理念**: 完全独立部署的细粒度服务

```
┌──────────────────────────────────────────────────────────────┐
│                    微服务架构                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│   │ Auth    │  │ Intent  │  │ IoT     │  │ Report  │       │
│   │ Service │  │ Service │  │ Service │  │ Service │       │
│   │ (独立DB) │  │ (独立DB) │  │ (独立DB) │  │ (独立DB) │       │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│        │            │            │            │              │
│        └────────────┼────────────┼────────────┘              │
│                     │            │                           │
│            ┌────────▼────────────▼────────┐                 │
│            │      API Gateway             │                 │
│            │   (Kong / Spring Cloud GW)   │                 │
│            └──────────────┬───────────────┘                 │
│                           │                                  │
│            ┌──────────────▼───────────────┐                 │
│            │     Service Mesh             │                 │
│            │   (Istio / Linkerd)          │                 │
│            └──────────────────────────────┘                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**适用场景**:
- 大规模团队 (>50人)
- 服务需要独立扩缩容
- 多语言技术栈

**CretasFoodTrace映射**:
- **当前不适用** - 团队<10人，运维成本过高
- **未来预留** - AI服务可作为首个拆分候选

---

## 3. 架构优劣矩阵对比

### 3.1 六大架构横向对比

| 评估维度 | 分布式Agent | SOA | 模块化单体 | 事件驱动 | 解释器模式 | 微服务 |
|----------|:-----------:|:---:|:----------:|:--------:|:----------:|:------:|
| **开发复杂度** | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |
| **运维复杂度** | ★★★★☆ | ★★★☆☆ | ★☆☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ | ★★★★★ |
| **扩展性** | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★★★ |
| **多租户支持** | ★★★☆☆ | ★★★★☆ | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★★★☆ |
| **AI集成友好度** | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ | ★★★★☆ |
| **团队<10人适配** | ★★☆☆☆ | ★★★☆☆ | ★★★★★ | ★★★★☆ | ★★★★☆ | ★☆☆☆☆ |
| **当前改造成本** | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ |

> ★ 越多表示该维度表现越好 (复杂度项 ★ 少为佳)

---

### 3.2 各架构优劣详细分析

#### 3.2.1 分布式多Agent架构

| 优势 | 劣势 |
|------|------|
| ✅ AI任务天然适配Agent模式 | ❌ 需要分布式协调 (Orchestrator) |
| ✅ 支持复杂多步推理 | ❌ Agent间通信成本高 |
| ✅ 可独立扩展单个Agent | ❌ 调试困难 (分布式追踪) |
| ✅ 符合LLM+Agent趋势 | ❌ 需要共享内存 (Redis/VectorDB) |

**CretasFoodTrace适配度**: ★★★★☆ (80%)
- 12个IntentHandler可演化为Agent
- 但当前无分布式基础设施支撑

---

#### 3.2.2 SOA架构

| 优势 | 劣势 |
|------|------|
| ✅ 清晰的服务边界 | ❌ ESB成为单点瓶颈 |
| ✅ 标准化接口便于集成 | ❌ 服务治理复杂 |
| ✅ 适合企业级场景 | ❌ 过度设计风险 |
| ✅ 支持异构系统集成 | ❌ 服务编排开销大 |

**CretasFoodTrace适配度**: ★★★☆☆ (60%)
- 66个Controller可逻辑划分
- 但过重，不适合当前规模

---

#### 3.2.3 模块化单体架构

| 优势 | 劣势 |
|------|------|
| ✅ 开发部署简单 | ❌ 无法独立扩展模块 |
| ✅ 事务一致性容易保证 | ❌ 模块边界可能被侵蚀 |
| ✅ 调试方便 | ❌ 单体性能瓶颈 |
| ✅ 团队<10人最佳选择 | ❌ 技术债务累积风险 |
| ✅ 未来可渐进式拆分 | |

**CretasFoodTrace适配度**: ★★★★★ (95%)
- 完美匹配当前团队规模
- 79个Service重组为6个模块即可

---

#### 3.2.4 事件驱动架构

| 优势 | 劣势 |
|------|------|
| ✅ 解耦组件间依赖 | ❌ 事件顺序难保证 |
| ✅ 支持异步处理 | ❌ 最终一致性复杂 |
| ✅ 审计追溯友好 | ❌ 事件风暴设计成本 |
| ✅ 高吞吐量 | ❌ 需要消息中间件 |
| ✅ CQRS读写分离 | |

**CretasFoodTrace适配度**: ★★★★☆ (85%)
- 意图识别→表单生成→数据提交 天然事件链
- 可用Spring ApplicationEvent起步

---

#### 3.2.5 解释器模式

| 优势 | 劣势 |
|------|------|
| ✅ 业务规则配置化 | ❌ DSL设计成本 |
| ✅ 多租户差异化 | ❌ 性能开销 (解析执行) |
| ✅ 非技术人员可配置 | ❌ 表达能力有限 |
| ✅ 意图规则动态更新 | ❌ 复杂逻辑难表达 |

**CretasFoodTrace适配度**: ★★★★☆ (80%)
- 94个Intent配置 → DSL管理
- 转换率公式 → 表达式引擎

---

#### 3.2.6 微服务架构

| 优势 | 劣势 |
|------|------|
| ✅ 独立部署扩缩容 | ❌ 运维成本极高 |
| ✅ 技术栈自由 | ❌ 分布式事务难 |
| ✅ 故障隔离 | ❌ 服务调用链路长 |
| ✅ 团队自治 | ❌ 需要K8s/ServiceMesh |

**CretasFoodTrace适配度**: ★☆☆☆☆ (20%)
- **当前完全不适用**
- 团队<10人，运维成本不可接受
- 无分布式基础设施

---

### 3.3 多租户AI场景特定对比

| 场景 | 最优架构 | 次优架构 | 不推荐 |
|------|----------|----------|--------|
| **意图识别** | 解释器 + 事件驱动 | 分布式Agent | 纯微服务 |
| **表单生成** | 解释器模式 | 模块化 | SOA |
| **设备集成** | 模块化 + 事件驱动 | SOA | 分布式Agent |
| **租户隔离** | 模块化内核 | SOA服务化 | 纯事件驱动 |
| **AI分析报告** | 分布式Agent | 事件驱动 | 纯模块化 |
| **审计追溯** | 事件驱动(CQRS) | 模块化 | 微服务 |

---

## 4. 融合架构设计方案

### 4.1 融合策略：MEAI架构 (Modular Event-driven AI Architecture)

基于优劣矩阵分析，推荐采用**四层融合架构**：

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MEAI 融合架构 (四层)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Layer 4: AI Agent Layer (分布式Agent - 20%)                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ Intent   │ │ Form     │ │ Analysis │ │ IoT      │       │   │
│  │  │ Agent    │ │ Agent    │ │ Agent    │ │ Agent    │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Layer 3: Event Bus Layer (事件驱动 - 25%)                   │   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────┐     │   │
│  │  │              Spring ApplicationEvent                │     │   │
│  │  │  · IntentRecognizedEvent  · FormGeneratedEvent     │     │   │
│  │  │  · BatchCreatedEvent      · AlertTriggeredEvent    │     │   │
│  │  └────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Layer 2: Rule Engine Layer (解释器模式 - 20%)               │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │   │
│  │  │ Intent DSL  │  │ Form Schema │  │ Expression  │         │   │
│  │  │ Interpreter │  │ Template    │  │ Evaluator   │         │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Layer 1: Modular Monolith Layer (模块化单体 - 35%)          │   │
│  │                                                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ 生产模块  │ │ 质量模块  │ │ AI模块   │ │ IoT模块  │       │   │
│  │  │          │ │          │ │          │ │          │       │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │       │   │
│  │  │ Repo     │ │ Repo     │ │ Repo     │ │ Repo     │       │   │
│  │  │ Entity   │ │ Entity   │ │ Entity   │ │ Entity   │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │           Shared Kernel (多租户内核)                  │   │   │
│  │  │  · TenantContext · BaseEntity · EventPublisher       │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 各层融合比例与职责

| 层级 | 架构模式 | 融合比例 | 核心职责 |
|------|----------|----------|----------|
| **Layer 1** | 模块化单体 | 35% | 业务逻辑、数据持久化、租户隔离 |
| **Layer 2** | 解释器模式 | 20% | Intent DSL、Schema模板、规则引擎 |
| **Layer 3** | 事件驱动 | 25% | 模块解耦、异步处理、审计追溯 |
| **Layer 4** | 分布式Agent | 20% | AI编排、多步推理、智能分析 |

**注意**: SOA (0%) 和 微服务 (0%) 当前不纳入融合，作为未来扩展预留。

---

### 4.3 融合架构核心组件

#### 4.3.1 多租户内核 (Tenant Kernel)

```java
// 租户上下文 - 贯穿所有层级
@Component
public class TenantContext {
    private static final ThreadLocal<String> FACTORY_ID = new ThreadLocal<>();

    public static void setFactoryId(String factoryId) {
        FACTORY_ID.set(factoryId);
    }

    public static String getFactoryId() {
        String factoryId = FACTORY_ID.get();
        if (factoryId == null) {
            throw new TenantNotSetException("租户上下文未设置");
        }
        return factoryId;
    }
}

// 租户感知缓存Key生成
public String buildCacheKey(String prefix, String key) {
    return String.format("%s:%s:%s", prefix, TenantContext.getFactoryId(), key);
}
```

#### 4.3.2 事件总线 (Event Bus)

```java
// 领域事件基类
public abstract class DomainEvent {
    private final String factoryId;
    private final LocalDateTime occurredAt;
    private final String eventId;

    protected DomainEvent() {
        this.factoryId = TenantContext.getFactoryId();
        this.occurredAt = LocalDateTime.now();
        this.eventId = UUID.randomUUID().toString();
    }
}

// 意图识别完成事件
public class IntentRecognizedEvent extends DomainEvent {
    private final String intentCode;
    private final String userInput;
    private final Map<String, Object> parameters;
    private final String recognitionLayer; // L1-L5
}

// 事件发布
@Service
public class IntentService {
    @Autowired
    private ApplicationEventPublisher eventPublisher;

    public IntentResult recognize(String userInput) {
        IntentResult result = doRecognize(userInput);
        eventPublisher.publishEvent(new IntentRecognizedEvent(result));
        return result;
    }
}
```

#### 4.3.3 Intent DSL 解释器

```java
// Intent 配置 DSL
public class IntentDSL {
    private String code;
    private List<String> keywords;
    private String entityType;
    private String actionType;
    private Map<String, String> parameterMappings;
    private String condition; // SpEL表达式
}

// DSL 解释器
@Component
public class IntentInterpreter {
    @Autowired
    private SpelExpressionParser parser;

    public boolean evaluate(IntentDSL dsl, IntentContext context) {
        if (dsl.getCondition() != null) {
            Expression exp = parser.parseExpression(dsl.getCondition());
            return exp.getValue(context, Boolean.class);
        }
        return true;
    }

    public Map<String, Object> extractParameters(IntentDSL dsl, IntentContext ctx) {
        Map<String, Object> params = new HashMap<>();
        dsl.getParameterMappings().forEach((key, expr) -> {
            Expression exp = parser.parseExpression(expr);
            params.put(key, exp.getValue(ctx));
        });
        return params;
    }
}
```

#### 4.3.4 Agent 编排器

```java
// Agent 接口
public interface AIAgent {
    String getAgentName();
    AgentCapability getCapability();
    AgentResult execute(AgentContext context);
}

// Agent 编排器
@Service
public class AgentOrchestrator {
    private final Map<String, AIAgent> agents;

    public OrchestratorResult orchestrate(String intentCode, Map<String, Object> params) {
        // 1. 确定需要的Agent链
        List<AIAgent> agentChain = resolveAgentChain(intentCode);

        // 2. 顺序或并行执行
        AgentContext context = new AgentContext(TenantContext.getFactoryId(), params);
        for (AIAgent agent : agentChain) {
            AgentResult result = agent.execute(context);
            context.addResult(agent.getAgentName(), result);

            if (result.shouldStop()) {
                break;
            }
        }

        return context.buildFinalResult();
    }
}
```

---

### 4.4 模块划分方案

基于79个Service重组为6个核心业务模块：

```
backend-java/src/main/java/com/cretas/aims/
├── module/
│   ├── production/          # 生产模块 (15 Services)
│   │   ├── batch/           # 批次管理
│   │   ├── schedule/        # 排程计划
│   │   └── process/         # 加工流程
│   │
│   ├── quality/             # 质量模块 (12 Services)
│   │   ├── inspection/      # 质检记录
│   │   ├── disposition/     # 处置管理
│   │   └── traceability/    # 追溯查询
│   │
│   ├── ai/                  # AI模块 (18 Services)
│   │   ├── intent/          # 意图识别
│   │   ├── form/            # 表单生成
│   │   ├── analysis/        # 智能分析
│   │   └── agent/           # Agent编排
│   │
│   ├── iot/                 # IoT模块 (10 Services)
│   │   ├── camera/          # 摄像头
│   │   ├── scale/           # 电子秤
│   │   └── mqtt/            # MQTT网关
│   │
│   ├── organization/        # 组织模块 (14 Services)
│   │   ├── factory/         # 工厂管理
│   │   ├── department/      # 部门管理
│   │   └── user/            # 用户管理
│   │
│   └── report/              # 报表模块 (10 Services)
│       ├── dashboard/       # 仪表盘
│       └── export/          # 导出功能
│
├── shared/                  # 共享内核
│   ├── tenant/              # 多租户
│   ├── event/               # 事件总线
│   ├── dsl/                 # DSL解释器
│   └── cache/               # 缓存抽象
│
└── infrastructure/          # 基础设施
    ├── config/              # 配置类
    ├── security/            # 安全
    └── integration/         # 外部集成
```

---

## 5. 功能模块与架构映射

### 5.1 5层意图识别架构映射

| 识别层 | 当前实现 | 融合架构位置 | 优化方向 |
|--------|----------|--------------|----------|
| **L1 SHA256缓存** | Redis + 内存 | Layer 1 (模块化) + Layer 3 (事件) | 增加租户维度Key |
| **L2 正则匹配** | Java Pattern | Layer 2 (解释器DSL) | DSL配置化 |
| **L3 关键词匹配** | 加权算法 | Layer 2 (解释器DSL) | 自学习权重调整 |
| **L4 语义向量** | DJL + gte-base-zh | Layer 4 (Agent) | Vector Agent封装 |
| **L5 LLM推理** | qwen-plus | Layer 4 (Agent) | LLM Agent + Fallback |

### 5.2 核心业务流程架构映射

#### 5.2.1 原料入库流程

```
用户输入 "入库原料"
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Intent Agent                                          │
│  ─────────────────────                                          │
│  IntentAgent.recognize("入库原料")                              │
│      → L1-L5 逐层识别                                           │
│      → 发布 IntentRecognizedEvent                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Event Bus                                             │
│  ───────────────────                                            │
│  @EventListener IntentRecognizedEvent                           │
│      → 路由到 FormAgent                                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Rule Engine                                           │
│  ─────────────────────                                          │
│  FormSchemaInterpreter.generate(MATERIAL_BATCH_CREATE)          │
│      → 解析DSL模板                                              │
│      → 动态生成表单Schema                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Modular Monolith                                      │
│  ──────────────────────────                                     │
│  ProductionModule.MaterialBatchService.create(dto)              │
│      → TenantContext.getFactoryId()                             │
│      → Repository.save()                                        │
│      → 发布 BatchCreatedEvent                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2.2 质量检测流程

```
检测完成 → 发现异常
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: QualityModule                                         │
│  ─────────────────────────                                      │
│  QualityCheckService.submitResult(checkResult)                  │
│      → 判断 isAbnormal                                          │
│      → 发布 QualityAbnormalEvent                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Event Bus                                             │
│  ───────────────────                                            │
│  @EventListener QualityAbnormalEvent                            │
│      → 创建 DisposalRecord (待处置)                             │
│      → 发布 AlertTriggeredEvent                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Analysis Agent                                        │
│  ─────────────────────────                                      │
│  QualityAnalysisAgent.analyze(abnormalData)                     │
│      → 调用LLM分析原因                                          │
│      → 生成处置建议                                             │
│      → 推送通知给审批人                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 多租户隔离架构映射

| 隔离层级 | 实现位置 | 融合架构组件 | 备注 |
|----------|----------|--------------|------|
| **API路由** | Controller | Layer 1 模块化 | `/{factoryId}/` 路径 |
| **数据过滤** | Repository | Layer 1 Shared Kernel | JPA @Filter |
| **缓存隔离** | CacheService | Layer 1 Shared Kernel | TenantCacheKey |
| **事件隔离** | EventBus | Layer 3 事件驱动 | Event.factoryId |
| **Agent隔离** | Orchestrator | Layer 4 Agent | AgentContext.factoryId |
| **DSL隔离** | Interpreter | Layer 2 解释器 | DSL.factoryId scope |

---

## 6. 实施路径与风险评估

### 6.1 实施阶段规划

```
┌─────────────────────────────────────────────────────────────────┐
│                     实施路径 (3个阶段)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: 基础夯实                                              │
│  ─────────────────                                              │
│  · 修复3个P0安全漏洞                                            │
│  · 建立TenantContext多租户内核                                  │
│  · 引入Spring ApplicationEvent事件总线                          │
│  · 重构Service为6个模块包结构                                   │
│                                                                 │
│  Phase 2: 规则引擎                                              │
│  ─────────────────                                              │
│  · Intent DSL配置化                                             │
│  · FormSchema模板引擎                                           │
│  · SpEL表达式求值器                                             │
│  · 租户级规则隔离                                               │
│                                                                 │
│  Phase 3: Agent升级                                             │
│  ─────────────────                                              │
│  · Intent Handler演化为Agent                                    │
│  · Agent编排器实现                                              │
│  · 多Agent协作流程                                              │
│  · 分布式追踪集成                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 风险评估矩阵

| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|:----:|:----:|----------|
| **模块边界被侵蚀** | 中 | 高 | 严格代码审查 + ArchUnit测试 |
| **事件顺序问题** | 中 | 中 | 事件编号 + 幂等处理 |
| **DSL表达能力不足** | 低 | 中 | 预留代码扩展点 |
| **Agent调用链过长** | 低 | 高 | 设置超时 + 熔断 |
| **多租户数据泄露** | 低 | 极高 | TenantContext强制检查 + 单元测试 |

### 6.3 技术债务清单

| 债务项 | 优先级 | 关联架构层 | 解决方案 |
|--------|:------:|------------|----------|
| Controller factoryId透传 | P0 | Layer 1 | AOP统一拦截 |
| 缓存Key租户维度 | P0 | Layer 1 | TenantCacheKeyGenerator |
| 意图查询工厂过滤 | P0 | Layer 1 | BaseRepository租户感知 |
| Service包结构扁平 | P1 | Layer 1 | 按模块重组 |
| 无事件总线 | P1 | Layer 3 | Spring Event + @Async |
| Intent硬编码 | P2 | Layer 2 | DSL配置化 |

---

## 附录

### A. 参考资料

1. Microsoft Azure Multi-Tenant AI Architecture Guide
2. AWS Multi-Tenant GenAI Reference Architecture
3. Confluent: 4 Patterns for Event-Driven Multi-Agent Systems
4. 研究数据: 42% 微服务采用者回归到更大单元

### B. 融合架构决策记录 (ADR)

**ADR-001**: 选择模块化单体而非微服务
- **决策**: 采用模块化单体作为基础架构
- **原因**: 团队<10人，无分布式基础设施，运维成本优先
- **后果**: 未来拆分需要额外改造，但当前阶段收益最大

**ADR-002**: 使用Spring ApplicationEvent而非消息队列
- **决策**: 进程内事件总线起步
- **原因**: 无需引入MQ运维成本，单体内事件足够
- **后果**: 跨服务事件需要未来升级

**ADR-003**: Agent编排采用同步调用
- **决策**: Agent链同步执行
- **原因**: 简化调试，当前AI负载可控
- **后果**: 高并发场景需要异步改造

### C. 术语表

| 术语 | 定义 |
|------|------|
| **MEAI** | Modular Event-driven AI Architecture，本文提出的融合架构名称 |
| **TenantContext** | 多租户上下文，存储当前请求的工厂ID |
| **Intent DSL** | 意图配置领域特定语言 |
| **Agent Orchestrator** | AI Agent编排器，负责调度多个Agent协作 |

---

> **文档维护**: 本文档应随架构演进持续更新
> **最后更新**: 2026-01-06
