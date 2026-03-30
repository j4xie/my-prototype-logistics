# 六扇门食品 vs Cretas系统 — 深度评估报告

**日期**: 2026-03-18
**客户**: 昆山六扇门食品有限公司
**评估人**: Steven (技术), Claude Agent Team

---

## 一、总览

### 客户画像
- **行业**: 熟食加工（非标品为主）
- **规模**: 每SKU涉及30-40种辅料
- **现状**: 钉钉一搭 + WPS + 线下数据管理，数据孤岛
- **历史**: 3-4次传统ERP（金蝶等）均失败
- **核心诉求**: AI驱动中台，自然语言交互替代手工录入

### 匹配度总览

| 模块 | 覆盖度 | 核心能力 | 关键Gap | 改造工作量 |
|------|--------|---------|---------|-----------|
| **M1: 报工** | **高** | 扫码报工、审批、效率分析 | 三步扫码流程、工序出成率、工序工时 | 3-4周 |
| **M2: 进销存** | **高** | 全链路、FIFO推荐、动态库存 | 移动平均价、FIFO成本核算、BOM自动领料 | 4-5周 |
| **M3: BOM** | **中** | BOM CRUD、成本计算、供应链联动 | 实际vs计划用量追踪、版本管理、研发流程 | 5-6周 |
| **M4: 财务** | **中** | 应收应付完整、SmartBI看板 | 每批实际成本、SKU毛利率、移动均价联动 | 4-5周 (依赖M2/M3) |
| **M5: 订单** | **高** | 全生命周期、自动应收、订单驱动生产 | 客户定制化定价矩阵 | 2-3周 |
| **M6: 品控/FOD** | **中** | YOLO 6类检测(mAP50=0.922)、质检体系 | 摄像头集成、新类别训练、自动学习 | 8-12周 |
| **M7: 钉钉** | **无** | — | 全部从零构建 | 6-8周 |
| **M8: AI中台** | **高** | 310 tools、95%意图准确率、SmartBI | 词汇调优、定价规则学习 | 2-4周 |

**整体评估**: M1/M2/M5/M8 基础扎实，需针对性增强；M3/M4 核心Gap是"实际用量追踪"这一跨模块能力；M6 需要硬件集成开发；M7 需要全新构建但架构设计已明确。

---

## 二、逐模块详细分析

### M1: 报工模块 (Work Reporting) — 最优先

**覆盖度: 高**

#### 已有能力
| 能力 | 实现状态 | 关键文件 |
|------|---------|---------|
| 扫码报工 | 已实现 — 扫批次条码→加载批次信息→输入数量→提交 | `ScanReportScreen.tsx` + `BarcodeScannerModal` |
| 订单/产品/工序追踪 | 已实现 — ProcessTask关联productionRunId、productTypeId、workProcessId | `ProcessTask.java`, `ProcessWorkReportingController.java` |
| 工时统计 | 已实现 — 上下班打卡、休息时间、员工工时统计、日期范围查询 | `WorkSessionController.java` |
| 生产效率分析 | 已实现 — 员工排名、日效率趋势、产品工时分布、员工-工序交叉分析 | `ProductionAnalyticsServiceImpl.java` |
| 审批流程 | 已实现 — 待审批/批准/驳回/批量审批/冲销 | `ProcessWorkReportingController.java` |
| NFC打卡 | 已实现 | `NfcCheckinScreen.tsx` |
| 离线草稿 | 已实现 — 网络失败时本地保存 | `useDraftReportStore` |
| AI工具 (4个) | 已实现 — 打卡、日汇总、工时查询、进度查询 | `WorkReport*Tool.java` |

#### Gap分析
| Gap | 描述 | 优先级 | 工作量 |
|-----|------|--------|--------|
| **三步扫码流程** | 客户要: 扫人(工牌)→扫工序(工位码)→报产量。现有: 扫批次→报产量。NFC打卡是独立步骤，未整合进报工 | P0 | 1-2周 |
| **工序出成率** | BomItem有`yieldRate`，ProductionBatch有`yieldRate`，但无**逐工序投入产出追踪**。ProcessTask只有`plannedQuantity`和`completedQuantity`，缺`inputQuantity` | P0 | 1周 |
| **工序级工时** | WorkSession追踪员工总工时，但未直接关联到具体工序(ProcessTask) | P1 | 1周 |

#### 改造方案
1. **三步扫码**: 改造ScanReportScreen，增加扫人(NFC/二维码)→扫工位→报数量流程，将NFC打卡集成到报工中
2. **工序出成率**: ProcessTask Entity增加`inputQuantity`字段，新增计算逻辑: `yieldRate = completedQuantity / inputQuantity`
3. **工序工时**: WorkSession增加`processTaskId`外键，或新建`ProcessTaskTimeLog`表

---

### M2: 进销存 (Inventory Management) — 最优先

**覆盖度: 高**

#### 已有能力
| 能力 | 实现状态 | 关键文件 |
|------|---------|---------|
| 采购→入库→领用→成品→销售 全链路 | 已实现 — PO创建→收货自动建MaterialBatch→使用/消耗→成品入库→销售发货 | `PurchaseServiceImpl.java`, `MaterialBatchController.java` (26端点), `SalesServiceImpl.java` |
| 动态库存 | 已实现 — `useBatchQuantity`、`reserveBatchQuantity`、`releaseBatchQuantity`、`consumeReserved` 实时扣减 | `MaterialBatchService.java` |
| FIFO批次推荐 | 已实现 — `MaterialFifoRecommendTool` + `getFifoBatches()` 端点 | `MaterialFifoRecommendTool.java` |
| FEFO(先到期先出)分配 | 已实现 — `BomExpansionService.checkMaterialAvailability()` | `BomExpansionService.java` |
| 供应链编排 | 已实现 — 销售确认→库存检查→生产计划→BOM展开→采购建议 | `SupplyChainOrchestrator.java` |
| 事件驱动 | 已实现 — `SalesOrderConfirmedEvent`、`MaterialReceivedEvent` | 各Service |
| AI工具 (23个) | 已实现 — 入库、出库、查询、调整、预留、释放、FIFO推荐、库存汇总、过期预警等 | `ai/tool/impl/material/` |

#### Gap分析
| Gap | 描述 | 优先级 | 工作量 |
|-----|------|--------|--------|
| **移动平均价** | 未实现。MaterialBatch记录每批`unitPrice`，但无加权移动平均价计算。`inventory/valuation`端点可能用当前批次价，非移动平均 | P0 | 2周 |
| **FIFO成本核算** | FIFO批次推荐已有，但基于FIFO的**销售成本(COGS)计算**未实现 — 即按最旧批次价格计算出库成本 | P1 | 1周 |
| **BOM驱动自动领料** | BomExpansionService能展开BOM需求，MaterialInventoryOutboundTool能出库，但无"生产开始→BOM自动展开→自动扣库存"的自动化链路 | P0 | 1-2周 |

#### 改造方案
1. **移动平均价**: 新建`MaterialMovingAvgPriceService`，每次入库时重新计算: `新均价 = (现有数量×现均价 + 入库数量×入库价) / 总数量`。MaterialType增加`movingAvgPrice`字段
2. **FIFO成本核算**: 出库时按FIFO顺序消耗批次，记录成本到`MaterialOutboundCostLog`
3. **BOM自动领料**: `ProductionStartEvent`→`BomExpansionService.expandBOM()`→逐项自动调用`MaterialBatchService.consumeReserved()`

---

### M3: BOM / 研发表

**覆盖度: 中**

#### 已有能力
| 能力 | 实现状态 | 关键文件 |
|------|---------|---------|
| BOM CRUD | 已实现 — 物料项、人工费、制造费用 | `BomController.java` |
| BomItem字段 | materialTypeId、standardQuantity、yieldRate(0-100%)、unitPrice、taxRate、unit、排序 | `BomItem.java` |
| 成本计算 | 已实现 — `calculateProductCost()` 返回材料/人工/制造费总计 | `BomServiceImpl.java`, `BomCostSummaryDTO.java` |
| BOM展开 | 已实现 — 按生产数量展开所需物料(含废品率) | `BomExpansionService.java` |
| 供应链联动 | 已实现 — BOM展开→缺料→采购建议 | `ProcurementSuggestionService.java` |
| 成本差异工具 | 已实现 — BOM理论成本 vs 实际成本对比 | `ReportCostVarianceTool.java` |
| Web管理页面 | 已实现 | `web-admin/src/views/production/bom/`, `bom-unified/` |

#### Gap分析
| Gap | 描述 | 优先级 | 工作量 |
|-----|------|--------|--------|
| **实际用量追踪** | 核心Gap — 无`batch_material_consumption`表记录每批每项物料实际消耗。`ReportCostVarianceTool`的实际成本数据来源不明 | P0 | 2周 |
| **计划vs实际达成率** | 因无实际用量记录，无法计算"标准用量420kg，实际用量435kg，达成率96.6%" | P0 | (含在上条) |
| **BOM版本管理** | 无版本控制。熟食企业配方经常调整(季节/原料变化)，需保留历史版本 | P1 | 2-3周 |
| **研发流程** | 无试产批次、配方审批、新配方上线流程 | P2 | 2-3周 |
| **30-40辅料UI优化** | 数据模型支持无限项，但UI未针对大量辅料优化(批量导入、模板复制) | P1 | 1周 |

#### 改造方案
1. **实际用量追踪**: 新建`BatchMaterialConsumption`表 (production_batch_id, bom_item_id, planned_qty, actual_qty, variance)，报工时记录实际耗料
2. **达成率看板**: 基于实际用量数据，per-batch per-item 计算达成率，SmartBI出图
3. **BOM版本**: BomHeader增加`version`、`status`(DRAFT/ACTIVE/ARCHIVED)、`effectiveDate`
4. **批量导入**: 支持Excel导入BOM项(30-40行辅料)

---

### M4: 财务模块

**覆盖度: 中**

#### 已有能力
| 能力 | 实现状态 | 关键文件 |
|------|---------|---------|
| 应收应付管理 | **完整** — 录入、付款、调整、流水、账龄分析(6段)、信用额度 | `ArApController.java`, `ArApServiceImpl.java` |
| 自动挂账 | 已实现 — 销售发货自动创建应收，采购收货自动创建应付 | `SalesServiceImpl:261`, `PurchaseServiceImpl:334` |
| BOM理论成本 | 已实现 — 材料+人工+制造费 | `BomServiceImpl.java` |
| 成本差异报表 | 已实现 | `ReportCostVarianceTool.java` |
| SmartBI财务看板 | 已实现 — 毛利趋势、账龄可视化、P&L瀑布图、KPI记分卡 | `FinancialDashboardPBI.vue`, Python financial分析 |
| AI财务工具 | 已实现 — 图表生成、付款状态、开票、收款记录 | `Finance*Tool.java`, `Sales*Tool.java` |

#### Gap分析
| Gap | 描述 | 优先级 | 工作量 |
|-----|------|--------|--------|
| **每批实际生产成本** | 核心Gap — BOM给理论成本，但"批次#1234产品X实际花了Y元"无法算出（因缺实际耗料数据） | P0 | 2-3周 (依赖M3) |
| **SKU毛利率** | 收入有(SalesOrder)，理论成本有(BOM)，但实际成本缺失 → 毛利率 = 收入 - 实际成本 无法闭环 | P0 | 1周 (依赖上条) |
| **标准vs实际对比** | ReportCostVarianceTool存在但实际数据源不足 | P1 | 1周 |
| **移动均价联动** | 成本计算用BomItem固定unitPrice，非实际采购移动均价 | P1 | 1周 (依赖M2) |

#### 改造方案
> **M4的所有P0 Gap都依赖M2(移动均价)和M3(实际用量追踪)先完成。** 这是整个系统最关键的跨模块依赖。

1. **每批实际成本** = SUM(实际用料×移动均价) + 实际人工工时×时薪 + 制造费分摊
2. **SKU毛利率** = 销售收入 - 每批实际成本。按SKU聚合后出SmartBI看板
3. **标准vs实际**: BOM理论 vs 实际消耗，自动计算差异率

---

### M5: 订单模块

**覆盖度: 高**

#### 已有能力
| 能力 | 实现状态 | 关键文件 |
|------|---------|---------|
| 销售订单全生命周期 | 已实现 — DRAFT→CONFIRMED→DELIVERING→COMPLETED/CANCELLED | `SalesServiceImpl.java` |
| 自动生成应收 | 已实现 — 发货时自动调用`arApService.recordReceivable()` | `SalesServiceImpl:261` |
| 订单驱动生产 | 已实现 — 订单确认→库存检查→自动创建生产计划→BOM展开→采购建议 | `SupplyChainOrchestrator.java` |
| 多行明细 | 已实现 — SalesOrder含SalesOrderItem列表，每项有产品、数量、单价、折扣 | `SalesOrder.java`, `SalesOrderItem.java` |
| 发货管理 | 已实现 — 发货记录、按项追踪已发数量 | `SalesDeliveryRecord.java` |
| AI工具 (5个) | 已实现 — 发货、开票、收款、报表、付款状态 | `Sales*Tool.java` |

#### Gap分析
| Gap | 描述 | 优先级 | 工作量 |
|-----|------|--------|--------|
| **客户定制化定价** | SalesOrderItem.unitPrice是手动输入。客户需要: 每个客户×每个产品的定价矩阵（非标品，每批可能不同） | P1 | 1-2周 |
| **价格单管理** | 无价格单实体/服务。六扇门需要: 基准价 → 客户覆盖价 → 时效性定价 | P1 | 1周 |

#### 改造方案
1. **客户定价矩阵**: 新建`CustomerProductPrice`实体 (customerId, productTypeId, unitPrice, effectiveFrom, effectiveTo)
2. **自动填价**: 创建订单时自动查价格矩阵填入unitPrice，可手动覆盖
3. **价格管理UI**: web-admin新增价格管理页面

---

### M6: 品控/异物检测

**覆盖度: 中**

#### 已有能力
| 能力 | 实现状态 | 关键文件 |
|------|---------|---------|
| YOLO异物检测 | 已实现 — 6类(insect, color_anomaly, bone, glass, hair, mold)，ONNX推理，per-class阈值，class-aware NMS | `yolo_detector.py` |
| 检测API | 已实现 — `/detect`, `/detect-batch`, `/detect-base64`, `/status`, `/reload-model` | `routes.py` |
| 双层检测 | 已实现 — 高置信→拒绝，低置信→通过，中间→VL复审 | `detection_pipeline.py` |
| 质检体系 | 已实现 — 可配置质检项、产品/工序绑定、不合格品处置 | `QualityCheckItemController.java`, `QualityDispositionController.java` |
| AI质检工具 (6个) | 已实现 — 创建/执行/查询/更新/批量标记/关键项 | `Quality*Tool.java` |
| 训练基础设施 | 已有 — V1/V2/V3训练运行、数据采集脚本、阈值优化、标签审计 | `食品标注/training/` |
| 模型性能 | V2 mAP50=0.922 (最佳)，CPU推理~50ms | — |

#### Gap分析
| Gap | 描述 | 优先级 | 工作量 |
|-----|------|--------|--------|
| **传送带摄像头集成** | 核心Gap — API接受图片上传(POST /detect)，但无RTSP/ONVIF摄像头实时流接入、帧抓取调度器 | P0 | 3-4周 |
| **新检测类别** | 手套碎片(无此类)、异常脂肪(color_anomaly部分覆盖但非特异) — 需采集六扇门产线数据训练 | P0 | 2-3周(数据采集+训练) |
| **产品形态异常** | 当前检测"产品上的异物"，非"产品本身是否异常"。标准品vs异常品判断是另一模型 | P1 | 4+周 |
| **自动学习新品** | VL复审器当前是手动模式。无few-shot/zero-shot新产品自动识别 | P2 | 3-4周 |
| **VL成本** | YOLO CPU推理成本低，但双层VL fallback需要云API（按调用计费） | P2 | 评估 |

#### 改造方案
1. **摄像头集成**: Python端新建`CameraStreamService`，支持RTSP拉流→定时抓帧→调用检测API→异常推送
2. **新类别**: 到六扇门产线采集手套碎片、异常脂肪样本500+张，增量训练V4模型
3. **标准品识别**: 基于embedding similarity的参考图对比方案（非重新训练），前期可用VL模型做

---

### M7: 钉钉集成

**覆盖度: 无 — 全新构建**

#### 技术方案 (详见 `dingtalk-integration-plan.md`)

**架构决策**:
| 决策 | 选择 | 原因 |
|------|------|------|
| 消息接收模式 | **Stream Mode (WebSocket)** | 无需公网IP/域名/入站端口 |
| 应用类型 | 企业内部应用 | 完全访问企业数据 |
| 集成模式 | **Adapter模式** | DingTalkAdapter → 现有IntentExecutorService，无需改动310个Tool |
| 用户映射 | dingtalk_user_mapping表 | 钉钉用户→Cretas用户，继承角色权限 |

**核心流程**:
```
用户@机器人 "GPS牛腩入库42件"
  → DingTalk WebSocket Stream
  → DingTalkRobotCallbackHandler
  → DingTalkAdapterService (提取文本、映射用户)
  → IntentExecutorService.execute() (310 tools)
  → DingTalkResponseFormatter (Markdown/ActionCard)
  → 钉钉回复
```

**费用**: 需钉钉专业版 9,800元/年 (免费版10,000次/月不够用)

**开发分期**:

| 阶段 | 内容 | 工期 |
|------|------|------|
| Phase 1: 核心机器人 | Stream接入 + Adapter + 用户映射 + 回复格式化 | ~12.5天 |
| Phase 2: 审批数据 | 报销/审批/采购数据拉取 + 3个新Tool | ~9天 |
| Phase 3: 高级功能 | 互动卡片 + 主动推送 + 自助绑定 | ~11天 |
| **合计** | | **~32.5天 (6.5周)** |

---

### M8: AI中台

**覆盖度: 高**

#### 已有能力
| 能力 | 实现状态 | 关键文件 |
|------|---------|---------|
| AI意图引擎 | 已实现 — 8层识别(精确/短语/正则/关键词/语义/BERT/融合/LLM兜底) | `IntentExecutorServiceImpl.java` |
| Tool注册 | 310个Tool，20+领域，自动注册 | `ToolRegistry.java` |
| 意图准确率 | 生产环境95%+ | — |
| 自然语言操作 | 已实现 — 物料23个Tool覆盖入库/出库/查询/调整/FIFO等 | `ai/tool/impl/material/` |
| SmartBI分析 | 已实现 — Excel→自动分析→图表→AI解读→预测 | Python smartbi/ |
| 参数学习 | 已实现 — 从用户纠正中学习参数提取模式 | `ParameterExtractionLearningService.java` |
| 工作流学习 | 已实现 — 学习工作流模式 | `WorkflowLearningService.java` |
| 域过滤 | 已实现 — 按领域过滤Tool(136→33-39)，LLM延迟降41% | `LlmIntentFallbackClientImpl.java` |
| 成本控制 | 通义千问免费额度(8个模型×1M tokens) | — |

#### Gap分析
| Gap | 描述 | 优先级 | 工作量 |
|-----|------|--------|--------|
| **六扇门词汇调优** | BERT分类器259标签，可能不覆盖六扇门特有短语("GPS牛腩"、特有工序名) | P0 | 1-2周 |
| **定价规则学习** | 无从历史订单学习客户定价规则的机制 | P2 | 2-3周 |
| **智能补货建议** | 无基于历史消耗学习最优安全库存/补货点的功能 | P2 | 2周 |
| **钉钉桥接** | AI引擎无法从钉钉接收请求(需M7) | P0 (依赖M7) | — |

#### 改造方案
1. **词汇调优**: 在`ai_intent_config`表增加六扇门特有意图配置(3天)，测试&迭代(1周)
2. **定价规则**: 新建`PricingRuleLearningService`，分析历史订单数据推断定价逻辑
3. **补货建议**: 基于SmartBI预测模块，分析历史消耗→推荐安全库存量

---

## 三、跨模块依赖关系

```
                    M2: 移动平均价
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         M3: 实际       M4: 实际    M4: SKU
         用量追踪       生产成本    毛利率
              │          ▲          ▲
              └──────────┘          │
                                   │
         M1: 工序出成率 ──────────→ M4
         (每工序投入产出)          (人工成本)
                                   │
         M5: 客户定价 ────────────→ 收入
```

**关键发现**: **M3实际用量追踪**是整个系统最关键的缺失环节。没有它:
- M3 BOM达成率无法计算
- M4 每批实际成本无法算出
- M4 SKU毛利率无法闭环
- 六扇门最看重的"每SKU毛利率"功能就缺了底座

---

## 四、优先级建议

### 客户路线: 先报工→进销存→闭环→扩展

基于客户意愿和技术依赖，建议分4期:

#### 第一期: 报工+进销存 MVP (6-8周)
| 任务 | 工期 | 并行 |
|------|------|------|
| M1: 三步扫码报工 + 工序出成率 | 3周 | ✅ 可并行 |
| M2: 移动平均价 + BOM自动领料 | 3周 | ✅ 可并行 |
| M3: 实际用量追踪表 + 录入接口 | 2周 | ✅ 可并行 |
| M8: 六扇门词汇调优 + 意图配置 | 1.5周 | ✅ 可并行 |
| 集成测试 | 1周 | — |

**交付物**: 扫码报工、进销存全链路、BOM联动领料、AI自然语言操作

#### 第二期: 财务闭环 (4-5周)
| 任务 | 工期 | 前置 |
|------|------|------|
| M4: 每批实际成本计算 | 2-3周 | 依赖一期M2+M3 |
| M4: SKU毛利率看板 | 1周 | 依赖上条 |
| M5: 客户定价矩阵 | 2周 | 可并行 |
| M3: BOM达成率看板 | 1周 | 依赖一期M3 |

**交付物**: 每批实际成本、SKU毛利率、客户定价、BOM达成率

#### 第三期: 钉钉+品控 (8-10周)
| 任务 | 工期 | 并行 |
|------|------|------|
| M7: 钉钉Phase1+2 (机器人+审批) | 4-5周 | ✅ 可并行 |
| M6: 摄像头集成 + 新类别训练 | 5-7周 | ✅ 可并行 |

**交付物**: 钉钉自然语言交互、传送带异物检测

#### 第四期: 增强 (4-6周)
| 任务 | 工期 |
|------|------|
| M7: 钉钉Phase3 (互动卡片+推送) | 2周 |
| M6: 产品形态检测 + 自动学习 | 4周 |
| M3: BOM版本管理 + 研发流程 | 2-3周 |
| M8: 定价规则学习 + 智能补货 | 3-4周 |

---

## 五、风险清单

| 风险 | 等级 | 描述 | 缓解措施 |
|------|------|------|---------|
| **数据迁移** | 高 | 钉钉一搭+WPS数据格式杂乱，30-40辅料/SKU的BOM数据量大 | 先做数据mapping，提供Excel模板批量导入 |
| **非标品建模** | 中 | 每批产品配方可能微调，不是固定BOM | BOM版本管理 + 支持per-batch微调 |
| **AI词汇覆盖** | 中 | 六扇门有行业特有术语(GPS牛腩、特有工序名)，BERT可能未训练 | 部署前做词汇映射+意图配置，1-2周调优期 |
| **钉钉费用** | 低 | 免费版不够用，需专业版9,800元/年 | 提前告知客户，纳入报价 |
| **摄像头硬件** | 中 | 需在产线安装IP摄像头，涉及网络布线、固定安装 | 先用USB摄像头POC，再规模部署IP摄像头 |
| **VL模型成本** | 中 | 双层检测的VL fallback需云API调用费 | 优化YOLO阈值减少VL调用，或用本地VL模型 |
| **多工厂扩展** | 低 | 当前系统支持多工厂(factoryId隔离)，六扇门若有多工厂需确认 | 数据模型已支持 |

---

## 六、结论

**Cretas系统与六扇门需求的匹配度约70-75%**。

- **强匹配** (可直接使用): 进销存链路、订单管理、AI意图引擎、SmartBI分析
- **需增强** (已有基础): 报工流程、BOM管理、财务核算、异物检测
- **需新建** (无现有代码): 钉钉集成、摄像头实时流接入
- **关键突破口**: 实现"实际用量追踪"这一跨模块能力后，BOM达成率、实际成本、SKU毛利率三大高价值功能自然贯通

**预估总工期**: 2-3名开发者，20-24周完成全部4期。第一期(6-8周)即可交付报工+进销存MVP让客户用起来。
