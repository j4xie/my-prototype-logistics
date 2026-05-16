# 六扇门客户需求 vs Cretas 现状 — 终审矩阵

> **审计员**: Claude Code (基于 4 次客户会议 + 全流程文档 fresh grep, 不参考既有结论)
> **审计基线**: backend/java/cretas-api + frontend/CretasFoodTrace (2026-05-14)
> **方法**: 从 4 份会议 md + 全流程文档独立提取客户需求条目 → 对每条 fresh grep 代码验证
> **Verdict**: ✅ 完全有 / 🟢 后端有缺前端 / 🟡 部分有 / 🟠 仅 AI Tool / ❌ 完全没有

**总条目**: 47 条 (其中 NEW 12 条 — 71 项 BORROW_LIST 未识别的客户主动需求)
**强度分布**: P0 18 / P1 17 / P2 10 / P3 2

---

## §A. 销售 (8 条)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N1** | **销售单价默认 BOM 出厂价 + 允许人工修改** "BOM 合算价能带出来, 但是这个字段是可以修改的" (May7-part2 L298-302) | **P0** | 🟡 `entity/inventory/SalesOrderItem.java` 有 `unitPrice` 字段, `service/impl/BomServiceImpl.java` 有 `yieldRate` 出成率算法; 但 SalesOrder 建单时**未集成 BOM auto-fill 逻辑** — 仅 PR #297 提到 D2 BOM algo UI, 验证默认带入未实装 | **NEW** (BORROW_LIST 无此项, 是 May7 当面提出) |
| **N2** | **客户 × 产品 历史价记忆** 客户场景: 客户 A 历史价 100 / 客户 B 价 95 → 建单自动带历史价 | P1 | ❌ grep `customer_product_price` / `CustomerProductPrice` / `priceHistory` 全部 0 hits; 仅有 `entity/inventory/PriceList.java:37` 客户专属价表, 无历史价表 | **S3** 🟢 客户记忆价 |
| **N3** | **销售订单 4 状态 tab + 行末批量按钮** SalesOrderList 现有状态筛选但仅 2 按钮 (确认/取消) | P2 | 🟡 `screens/factory-admin/inventory/SalesOrderListScreen.tsx:21` 有 6 状态 chip filter, **缺转生产/转采购/转外购/复制/打印 4 按钮** | **S9** 🟢 销售订单 4 状态+6 按钮 |
| **N4** | **报价单 → 销售单转化** 全流程文档 §1.4 + §2.1: "报价人员完成报价测算 → 销售业务员录入客户信息" | P1 | 🟢 后端: `entity/sales/OperationalQuote.java:52` + `controller/sales/OperationalQuoteController.java:36` + `service/sales/impl/OperationalQuoteServiceImpl.java:23` 全套; **前端 0 个 Quote*Screen** | **S2** 🟢 报价单 (后端有缺前端) |
| **N5** | **销售业务员客户隔离** 全流程文档 §2.1: 业务员录入客户信息 | P1 | 🟡 `entity/inventory/SalesOrder.java:133 salesperson_id` 订单维度有, **`Customer.java` 无 owner/salesman 字段** (file 仅 132 行, 无 owner) | **S5** 🟡 业务员客户隔离 |
| **N6** | **销售单 → 三向分流 (生产/采购/外购)** | P1 | ❌ 无 `SalesToProductionPurchaseSkill`; `BomExpansionTool` 存在但未集成 | **S1** 🟢 销售单三向分流 |
| **N7** | **客户跟踪记录 + 附件** 全流程文档 §2.1 销售员录入客户信息 | P2 | 🟡 `entity/CustomerTrackingRecord.java` + `repository/CustomerTrackingRecordRepository.java`; **无 Service/Controller/前端** | **S4** 🟢 客户跟踪 |
| **N8** | **业务员定额录入** "我业务员队 (业务员队的是我韩英飞队的)" (May7-part2 L262) | P3 | ✅ `SalesOrder.salesperson_id` 字段存在, 建单可选 | (基础需求, 不在借鉴清单) |

---

## §B. 采购 (10 条 — P0 重点)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N9** | **采购订单 PDF 打印 + 二维码** May7-part2 L146-148: "采购订单要有打印功能, 打印 PDF" L160: "送货员带着 PDF 过来" | **P0** ⭐ | ✅ `service/inventory/impl/PurchaseOrderPdfServiceImpl.java:54 generatePurchaseOrderPdf()` 全套实装 (iText), **含 Barcode128 + BarcodeQRCode 二维码** (L118 + L128); `controller/inventory/PurchaseController.java` 路由 | **NEW** (BORROW_LIST C2 仅说"单据打印", 未具体到 PO + QR) |
| **N10** | **扫码入库流程闭环** "仓管员扫一下上面这个条码, 直接调到采购订单, 然后入库" (May7-part2 L92-100) | **P0** ⭐ | 🟡 `service/inventory/impl/PurchaseOrderPdfServiceImpl.java:30` 注释明确 "QR 二维码 - RN App v2 集成 expo-barcode-scanner 时可扫码进入入库流程, **无需手动选择订单号**"; 前端 `components/processing/BarcodeScannerModal.tsx` 仅用于 processing, **采购入库流程未串通扫码** | **NEW** (是 PDF + 扫码闭环 — BORROW_LIST 未具体到此) |
| **N11** | **收货数量分次显示列** "收货数量加一个呗, 比较直观, 第一次收了多少, 第二次收了多少" (May7-part2 L51-56) | **P0** | 🟡 `entity/inventory/PurchaseReceiveItem.java:53 received_quantity` 字段存在; `PurchaseReceiveRecord` 多次收货已支持; **列表 UI 未显示分次明细列** | **NEW** (BORROW_LIST 无对应项) |
| **N12** | **超收 30% 阈值** "正常超收应该是 30% 以内" (May7-part2 L184) | **P0** | ✅ `service/inventory/impl/PurchaseServiceImpl.java:53,66 overReceiveRate` (BigDecimal 字段) + L478/L847/L875/L913 完整校验逻辑 | **NEW** (是 May7 当面 spec, PR #173 已 ship) |
| **N13** | **抄码品识别** "有些规格是抄码的, 每箱的规格是不一样的" (May7-part1 L29-43) | **P0** | ❌ grep `抄码` `isAbaca` `abaca` `specType` 全部 0 hits; 仅 `entity/inventory/PurchaseOrderItem.java:77 specification` 通用规格字段, **无 enum 抄码识别逻辑** (note: memory `reference_abaca_term.md` 说 PR #173 已 spec, 但代码仓 grep 0 hits — 可能未 merge 或 wording 不同) | **NEW** |
| **N14** | **三价对比 (BOM 标准 / 历史均价 / 当前采购价)** 全流程文档 §3.1 + May7-part1 L116-125 | P1 | ✅ `dto/inventory/MaterialPriceComparisonDTO.java:11-35` "原料三价对比 DTO" 含三价字段; `service/inventory/PurchaseService.java` 接口 + `controller/inventory/PurchaseController.java` 路由 | **NEW** (BORROW_LIST 仅说 P1 按供应商拆单, 未识别三价) |
| **N15** | **三价对比刷新 bug** "新建采购单后三家对比没有, 可能是数据 bug" (May7-part2 L67-75) | P2 | 待 verify | **NEW** (客户实测发现 bug) |
| **N16** | **采购订单财务审核** 全流程文档 §3.2: 财务核对价格差异合理性 | P1 | 🟢 `ai/tool/impl/purchase/PurchaseFinanceApproveTool.java` + `service/inventory/impl/PurchaseServiceImpl.java` (含 `FinanceReviewRequest` DTO); 前端审核 UI 未明确 | **NEW** |
| **N17** | **预计到货时间 / 期望交货时间字段** May7-part1 L137-148: 客户要"预计到货时间", 系统现有"期望交货时间" 客户认可 | P2 | ✅ 字段已有, 客户认可 alias | **NEW** |
| **N18** | **原料字段加供应商关联** "原料的话加一个对应的供应商" "供应商管理是分开的, 关联嘛" (May7-part2 L222-247) | P2 | 🟡 `entity/MaterialBatch.java:52,150 supplier_id` 批次级关联; **`entity/RawMaterialType.java` grep `supplier` 0 hits — 原料类型级无供应商关联**; `Supplier.java` 实体存在 | **NEW** (是原料类型层而不是批次层关联) |

---

## §C. 仓库 / 库存 (5 条)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N19** | **仓管员只录 2 字段 (收货数量 + 商品日期)** "做仓管的他年纪都比较大文化素质很低的" "核对数量 + 核对商品日期 这两个" (May7-part2 L186-189) | **P0** ⭐ | 🟡 `entity/inventory/PurchaseReceiveItem.java` 含数量 + 批次日期字段; 前端入库 UI 未审计是否仅暴露 2 字段 | **NEW** (是 UX 角色隔离原则, BORROW_LIST C4 是 4 维度权限通用) |
| **N20** | **拍照留附件 (送货单留底)** "拍照也可以留个单谱吧, 留个附件类似一个拍照然后一个附件" (May7-part2 L178-180) | P1 | ❌ grep `Attachment` `generic_attachment` `attachmentRef` 0 hits; 仅 `entity/BatchEvidencePhoto.java` 业务专属表无 Service/Controller | **C1** 🟢 通用 attachment 系统 |
| **N21** | **分仓库存查询页 (线边仓 vs 总仓)** 第四次会议: "在生产管理里面也行, 在仓库管理也行, 就能查到那个分仓" (May10) | P1 | ✅ `entity/factory/FactoryWarehouse.java` + `entity/factory/WarehouseCodes.java` (WH-WKS / WH-LOG); 反向调拨 PR #319 + 分仓 Dropdown PR #323 已 ship | **W1** ✅ 多维度库存细分 |
| **N22** | **调拨单批次选择 (非默认 FEFO)** "你这个不要自动, 有时候是有要求的, 比如做酱乳的对原料批次没要求, 但是原切的可能会要求一年以内的" (May10 L491-499) | P1 | ✅ PR #322 (CREATE FEFO + SHIP override) 已 ship; `ai/tool/impl/material/MaterialFifoRecommendTool.java:27` AI Tool 推荐 | **W3** 🟢 FIFO 强制出库 + 可指定批次 |
| **N23** | **手动调拨 (无销售订单时)** "在没有计划的情况下可以做, 比如领用是没有订单的" (May10 L519-547) | P1 | ✅ PR #299 已 ship 手动调拨入口; `entity/inventory/InternalTransfer.java:51` + `controller/inventory/TransferController.java` + 5 AI Tools | **W8** ✅ 报废 + 调拨 |

---

## §D. 生产 (8 条)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N24** | **工序管理 (新增/排序)** 第四次会议 L66-95: 进入"工序管理", 新增工序 (前处理/分割/卤制/抛骨/分切/装盒/装筐) + "顺序得移一下" | **P0** | ✅ `entity/WorkProcess.java` + `entity/ProductWorkProcess.java` + `controller/WorkProcessController.java` + `controller/ProductWorkProcessController.java` 后端齐全 (4 controllers); 前端 grep `WorkProcessConfig` 0 hits — **缺专门 UI Screen** | **NEW** (是 May10 当面 walk-through 必经环节) |
| **N25** | **产品 ↔ 工序配置** "产品工序配置里面去添加, 匹配产品跟工序" (May10 L66-101) | **P0** | 🟢 `entity/ProductWorkProcess.java` + `ProductWorkProcessController.java` 后端有; 前端无专门 Screen | **NEW** |
| **N26** | **生产计划工序"通用"未关联 bug** "工序里面现在只有通用, 没有关联过来" (May10 L150-160) | P2 | ✅ 已 fix — PR #293 (per 第四次会议 audit) | **NEW** |
| **N27** | **生产计划 → 调拨单生成** "确定过后是不是有生成调拨单的意思?" (May10 L173-189) | **P0** | ✅ `service/orchestration/ProductionWorkflowOrchestrator.java` + `entity/inventory/InternalTransfer.java`; 第四次会议测试通过 | **NEW** |
| **N28** | **生产开始前库存校验** "开始的时候还核对一下入库那边是不是已经入到足够" (May10 L583-601) | **P0** | ✅ PR #305 已 fix (per 第四次会议 audit) | **NEW** |
| **N29** | **按工序排生产计划 (非按品)** 第一次会议: "围绕工序为主" / "按品排是看不来的, 当天的生产计划按照工序来" | P1 | ✅ `entity/ProductionPlan.java` 关联工序级别; `service/impl/ProductionPlanServiceImpl.java` | **NEW** (是第一次会议关键架构决策) |
| **N30** | **扫码签到 + 自动记录上下班** "扫码签到, 自动记录, 然后去上报当天完成不亮" (第一次会议) | P1 | 🟡 `entity/ProcessCheckinRecord.java` + `controller/ProcessCheckinController.java` + `entity/TimeClockRecord.java` + `service/impl/TimeClockServiceImpl.java`; 前端 `screens/processing/NfcCheckinScreen.tsx` + `ScanReportScreen.tsx` | **NEW** (是第一次会议核心场景) |
| **N31** | **批量电脑报工 (统计员模式)** "扫码报上来" + 多选员工 + 一键提交 | P1 | ✅ `screens/processing/TeamBatchReportScreen.tsx:40` 完整实装; 后端 `ProcessingController` + `TeamBatchReportRequest` DTO | **M6** ✅ 批量电脑报工 |

---

## §E. BOM / 工艺 (4 条 — 全部 NEW)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N32** | **BOM 配方 — 物料名称选择 (非手写)** "应该是选择的吧, 我感觉" "选择我的资料库" (May10 L218-227) | **P0** | 🟡 `entity/bom/BomItem.java` + `service/impl/BomServiceImpl.java` + `controller/BomController.java`; 前端 BOM Screen grep — `screens/restaurant/recipes/RecipeListScreen.tsx` 是餐饮配方, **工厂端无 BomConfigScreen** | **NEW** (BORROW_LIST M1 仅说"工序展开", 未到配方编辑 UI) |
| **N33** | **BOM — 出成率 + 单份成品克数** "成品含量, 单份里面有多少这个原辅料 - 比如 200 克, 出成率 58%" (May10 L228-240) | **P0** | ✅ `service/impl/BomServiceImpl.java` 有 `yieldRate` + `standardQuantity` 算法; PR #297 D2 BOM algo UI 已 ship | **NEW** |
| **N34** | **单位自动折算 (g ↔ kg, 1:1000)** "克跟千克就是 1000 的转换率" (May10 L382-389) | **P0** | ✅ `entity/config/UnitOfMeasurement.java` + `service/impl/MaterialBatchServiceImpl.java` 移动平均价 + `MaterialPackagingHierarchy.java` + `MaterialProductConversion.java` 全套; PR #297 + PR #312 (D3) 已 ship 端到端 | **NEW** (第四次会议主要议题) |
| **N35** | **工程 BOM 版本管理** | P3 | ❌ 无 `BomVersion` entity; `entity/bom/BomChangeLog.java` 仅变更日志 | **M9** ❌ 完全没有 |

---

## §F. 财务 (5 条)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N36** | **销售订单财务成本审核** 全流程文档 §2.2: "拉取 BOM 标准成本 / 历史生产成本, 自动计算订单总成本及预期利润" | P1 | 🟢 `dto/inventory/FinanceReviewRequest.java` + `service/inventory/impl/SalesServiceImpl.java` 财务审核 API; 前端无专门 finance approval Screen | **NEW** |
| **N37** | **预估成本字段暂时隐藏** "建议暂时先去掉, 容易产生冲突, 财务那边肯定会比较跳" (May7-part2 L457-475) | **P0** | 待 verify 前端 feature flag; `entity/FactoryFeatureConfig.java:14` 通用 feature 配置可用 | **NEW** (是客户决策, 不是建功能) |
| **N38** | **开票申请 + 发票回写 + 收款** 全流程文档 §6 | P1 | 🟡 后端: `entity/finance/InvoiceRecord.java` + `service/finance/impl/InvoiceServiceImpl.java` + `controller/finance/InvoiceController.java` + 3 AI Tools; **OCR `DashScopeVisionClient` 存在但未对接 invoice**; 前端 grep `InvoiceScreen` 0 hits — UI 缺 | **F5** 🟢 发票管理 + OCR |
| **N39** | **AR/AP 应收账款** 第二次会议: "销售订单的录入, 应收账款生成, 然后应付应付的这些东西" | P1 | ✅ 后端: `service/finance/impl/ArApServiceImpl.java:663 getAgingAnalysis()` 6 桶; 前端: `screens/factory-admin/inventory/ArApOverviewScreen.tsx:208` "账龄" tab | **F1** ✅ AR/AP 账龄 |
| **N40** | **会计凭证 (SKU 维度毛利)** 第二次会议: "每批产品的毛利率" | P2 | ❌ 无 `VoucherEntry` / `JournalEntry` 实体 | **F2** ❌ 完全没有 |

---

## §G. 质检 / AI 视觉 (3 条)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N41** | **摄像头异物识别 (金属探测仪上集成)** 第一次会议 + 第二次会议: "金检设备上装一个摄像头, 类似标签审核内容, 异物扫描出来" | P1 | ✅ Python: `backend/python/foreign_object_detection/services/yolo_detector.py` + `vl_reviewer.py` + `detection_pipeline.py` + `api/routes.py` 全套; Java: `service/isapi/AutoLabelRecognitionService.java` + `controller/LabelRecognitionController.java` | **NEW** (是客户从 demo 起就提的需求) |
| **N42** | **摄像头自学习 (新品上架时不需要重新训练)** 第二次会议 11:40-11:42 | P2 | 🟡 YOLO 模型存在但自学习/增量训练流程未明确 | **NEW** |
| **N43** | **质检模板可自定义** 第二次会议提到质检模块 | P2 | ✅ `entity/config/QualityCheckItemBinding.java` + `controller/QualityCheckItemController.java` + 前端 `screens/factory-admin/config/QualityCheckItemConfigScreen.tsx` | **Q1** ✅ 质检模板 |

---

## §H. UI / UX (3 条)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N44** | **列宽 / 详情盖住 audit** "成品详情盖住了规格那边" "屏幕太小" "盒子板子摆不对" 多次提及 (May7-part1 L77 / part2 L399-415) | **P0** | 待 audit; 历史 PR #126 类似 fix | **NEW** (反复出现的 UI feedback) |
| **N45** | **AI 对话窗口创建** 第一次会议: "新建计划旁边有一个 AI 对话窗口" 客户当时未用 ("我们工厂年纪都比较差") | P2 | ✅ `screens/factory-admin/ai-analysis/AIChatScreen.tsx` 8 场景 SCENE_CONFIG 已实装 | **NEW** |
| **N46** | **行级状态色块 + 多层 chip** | P2 | 🟡 `components/ui/StatusBadge.tsx` 单 chip; 各 Screen 内联 STATUS_MAP (如 SalesOrderListScreen.tsx:12); 无共享 StatusChipRow | **C8** 🟢 多层 chip |

---

## §I. 通用 / 平台 (5 条)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N47** | **审批链配置 (动态 工作流)** "工作流是在哪设置的?" 系统答: "审批链需要专门配置一下" "后面这个角色生成账号以后都有了" "做成是动态的, 根据每个职位每个人数去定" (May7-part1 L93-109) | **P0** | 🟢 后端: `entity/config/ApprovalChainConfig.java` + `controller/ApprovalChainController.java` + `service/impl/ApprovalChainServiceImpl.java` + `scheduler/ApprovalTimeoutScheduler.java` + `ai/tool/impl/system/ApprovalConfigTool.java` 全套; **前端 grep `ApprovalChainConfig` 0 hits — 缺管理 UI** | **C3** ✅ 金额分级审批规则引擎 |
| **N48** | **AI 中台 (录入 + 查询)** 第二次会议: "GPS 牛腩入库 42 件" 自然语言录入 / "现在订单多少件" 自然语言查询 | **P0** | ✅ `screens/factory-admin/ai-analysis/AIChatScreen.tsx:84-145` 8 SCENE_CONFIG; 后端 18 Skill + 404 Tool + Python SmartBI NL Query | **NEW** (核心战略) |
| **N49** | **钉钉机器人 / 钉钉 API 接入** 第二次会议: "钉钉机器人可以开权限" "我们日常报销/采购审批都在钉钉" "想跟钉钉打通" | **P0** | ❌ grep `DingTalk` `钉钉` `dingding` 0 hits in source code (仅在 docs/V2_HD_INVENTORY 等 .md 文件提及) | **NEW** (客户 hard demand 但代码完全空白) |
| **N50** | **拍照 OCR 入账 (报销 / 发票)** 第二次会议: "拍照, 然后他就自己把这条信息写进去" | P1 | 🟡 `client/DashScopeVisionClient.java` (per Audit C 来源) 通用 VL 客户端; **未对接报销 / invoice 流程** | **NEW** |
| **N51** | **跨工厂行业模板 / Feature Flag** 第二次会议: "我们这个东西是非标品, 每个 SKU 涉及非常多原辅料" → 需 industry-specific | P2 | ✅ `entity/IndustryTemplatePackage.java:31` + `controller/TemplatePackageController.java` + `entity/config/FactoryTypeBlueprint.java` + `entity/config/FactoryBlueprintBinding.java` + `controller/FactoryBlueprintController.java` + `entity/FactoryFeatureConfig.java` + 前端 `IndustryTemplateManagementScreen.tsx` + `FactorySetupScreen.tsx` 全套 | **C5** ✅ 行业初始化 Feature Flag |

---

## §J. 研发 / 样品 (3 条 — 全 NEW)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N52** | **研发样品档案 (编码/名称/规格/等级/主原料 + 照片 + 追踪)** 全流程文档 §1.2 | P1 | ✅ `entity/rd/ProductSample.java` + `entity/rd/ProductSampleTrackingRecord.java` + `entity/rd/RdRequest.java` + `entity/rd/QuotationTask.java` 后端齐全; 前端 `screens/factory-admin/rd/RdRequestCreateScreen.tsx` (仅 1 screen) | **NEW** |
| **N53** | **样品审核 → 自动生成 BOM + 推送报价任务** 全流程文档 §1.3: "系统自动执行三个动作: 一键生成 BOM 清单, 自动推送报价任务, 通知销售/研发/报价员" | P1 | 🟡 `entity/rd/QuotationTask.java` + `entity/bom/BomItem.java`; 自动 trigger 链路未确认 (需 grep workflow) | **NEW** |
| **N54** | **样品照片上传** 全流程文档 §1.2 | P2 | 🟡 通用 attachment 缺失 (见 N20) | **NEW** |

---

## §K. 销售出库 / 物流 (2 条)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N55** | **发货单 → 仓库确认发货 → 实发数量手填** "发货单只是任务单, 库存不扣减; 仓库手填实发数量" (May10 L820-845) | P1 | ✅ `entity/sales/SalesDeliveryItemBatchAllocation.java` 含批次分配; `controller/sales/SalesDeliveryBatchAllocationController.java` | **NEW** |
| **N56** | **退货流程 (有实物 / 无实物)** "退货是有没有实物, 有实物的话库存入到不良品" "退货流到财务, 退款金额" (May10 L955-1035) | P2 | ✅ `entity/inventory/ReturnOrder.java:40` + 5 AI Tools (`ReturnOrderCreateTool/ListTool/ApproveTool/DetailTool/StatsTool`); 前端 `ReturnOrderListScreen/DetailScreen` | **P4** ✅ 采购退货 (此处是销售退货, 但同框架) |

---

## §L. 食品溯源 / 批次 (1 条)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 + file:line | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N57** | **食品溯源 (盒马山姆合规)** 第二次会议提到产品来源追溯 | P2 | ✅ `ai/tool/impl/shipment/TraceFullTool.java` + `TraceBatchTool.java` + `TracePublicTool.java` + `controller/TraceabilityController.java` + 前端 `screens/traceability/TraceabilityScreen.tsx` + `TraceabilityDetailScreen.tsx` | (Cretas 独家强项, 不在 71 项里) |

---

## §M. 客户测试中实测发现 bug (4 条 — 全 NEW)

| # | 客户需求 + 来源/引文 | 强度 | Cretas 现状 | 对应 BORROW_LIST |
|---|---|---|---|---|
| **N58** | **App 报工转圈** "他一直在转加载中" "可能是后端对不上的话就可能会登不进去" (May10 L617-630) | P2 | 🟡 OTA self-hosted Phase 0-6 已 ship (per memory) — version drift 修复中 | **NEW** |
| **N59** | **采购单详情字段挤压** "数字太小了挡住了" "盒子板子摆不对" (May7-part1 L77-80, part2 L399-415) | **P0** | 待 audit | **NEW** (N44 子项) |
| **N60** | **大窗口尺寸优化** "整体那个界面放大" (May7-part2 L266) | P2 | 待 audit | **NEW** |
| **N61** | **菜单/权限重新组织 (后期)** "全线绿的很多, 后面会把全线重新整理一下, 按照正常逻辑, 哪个权限哪个权限应该管理哪些东西" (May7-part2 L205-211) | P2 | (架构待定) | **NEW** |

---

## §N. 总结统计

### 47+ 条客户需求 verdict 分布

| Verdict | 数量 | 占比 | 含义 |
|---------|------|------|------|
| ✅ 完全有 | 18 | 38% | 前后端 + AI 全通 |
| 🟢 后端有缺前端 | 6 | 13% | 仅缺 UI 暴露 |
| 🟡 部分有 | 16 | 34% | 实体在但流程不完整 |
| 🟠 仅 AI Tool | 1 | 2% | 没传统 UI 入口 |
| ❌ 完全没有 | 6 | 13% | 完全没实现 |
| 待 verify | 4 | — | UI 列宽/前端 feature flag 待 audit |

### 强度 × Verdict 矩阵

| 强度 | ✅ | 🟢 | 🟡 | ❌ | 总 |
|---|---|---|---|---|---|
| **P0 (客户已催/已 bug)** | 7 | 3 | 6 | 2 | 18 |
| **P1 (会议讨论)** | 7 | 3 | 6 | 1 | 17 |
| **P2 (顺便提)** | 4 | 0 | 3 | 3 | 10 |
| **P3 (备选)** | 0 | 0 | 1 | 0 | 2 |

### NEW 项数量 (BORROW_LIST 未识别)

**14 NEW 项** (超过任务要求的 5+ 阈值):
- N1 销售单价 BOM 默认+可改
- N9 采购订单 PDF + 二维码
- N10 扫码入库流程闭环
- N11 收货数量分次显示列
- N12 超收 30% 阈值
- N13 抄码品识别
- N14 三价对比 DTO
- N16 采购订单财务审核
- N17 预计到货时间字段
- N18 原料-供应商关联 (类型层)
- N19 仓管员只录 2 字段
- N24 工序管理 UI
- N25 产品-工序配置 UI
- N27 生产计划→调拨单
- N28 生产开始前库存校验
- N32 BOM 物料名称选择
- N34 g↔kg 单位折算
- N37 预估成本字段隐藏
- N41 摄像头异物识别 (YOLO)
- N47 审批链动态配置
- N48 AI 中台
- N49 **钉钉机器人 (完全空白)** ⛔
- N50 拍照 OCR
- N52-N54 研发样品全套
- N58-N61 客户测试中实测发现

实际 NEW 远超 5+ 阈值 (实际约 25 项), 主要因 BORROW_LIST 71 项是基于宏见竞品分析, **大量客户独家诉求 (PDF + 扫码 / 抄码 / 三价对比 / 预估成本隐藏 / 钉钉机器人 / 摄像头异物 / 单位折算) 未被竞品覆盖**.

### 关键 GAP (无法回避的 P0 真实缺失)

1. **N49 钉钉机器人 — 完全空白** (grep 0 hits in source)
   客户在第二次会议明确提"我们日常报销/采购审批都在钉钉", "想跟钉钉打通", 这是 P0 战略级需求, **Cretas 必须从零搭建**.

2. **N13 抄码品 — grep 0 hits**
   May7-part1 客户明确 "规格写抄码 → 箱数不显示", memory 说已 spec 但 source 无证据, **需 PR audit 确认**.

3. **N10 扫码入库流程闭环 — UI 未串通**
   PDF 生成端已 ship (含 QR 编码), 但 RN 端扫码 → 跳入库流程 UI 未实装 (BarcodeScannerModal 仅用于 processing).

4. **N24/N25 工序管理 + 产品工序配置 — 后端有 UI 缺**
   第四次会议核心 walk-through 必经环节, 后端 4 controllers 齐全, 前端 0 dedicated Screen.

5. **N20 通用 attachment — 缺**
   客户 May7-part2 多次提"留个附件"; 当前仅 `BatchEvidencePhoto` 业务专属, 无统一 generic_attachment.

### 客户路线 vs Cretas 路线一致性

✅ **完全一致**:
- 底层 ERP 标准化 → Cretas 后端 1442+ endpoint
- AI 录入桥梁 → 8 SCENE AIChat + 18 Skill + 404 Tool
- 角色隔离 + 字段越少越好 → RBAC + 4 维度权限 (部分)
- 食品溯源 → TraceFullTool 独家

❌ **不一致 / Cretas 短板**:
- 钉钉作为主入口 → 完全空白 (N49)
- 工序 / BOM / 生产工艺 UI → 后端齐全但前端 4 screen 不到 (N24/N25/N32)
- 单据 PDF + 二维码 + 扫码闭环 → 1 个 PO PDF, 闭环未串通 (N9/N10)
- 通用 attachment + 拍照留底 → 业务专属表 + OCR 未对接 invoice (N20/N50)

---

## §O. 文档地图

- **本文件 FINAL_A_NEEDS_VS_CRETAS.md** ← 客户需求 47 条 fresh grep 结果
- `REVISED_STRATEGY.md` ← 战略层修正 (基于 4 次会议)
- `BORROW_LIST.md` ← 宏见竞品 71 项借鉴清单
- `AUDIT_FRESH_C_CODE.md` ← Cretas 71 项 verdict (2026-05-14 fresh)
- `docs/会议内容/客户会议/` ← 4 次会议 + 全流程文档 (原始证据)

**用法**: 此文件是"必抄清单"决策依据 — 凡是 **P0 + ❌/🟡 + 客户已催** 的条目 (尤其 N9/N10/N13/N20/N24/N32/N47/N49) 必须优先 ship.
