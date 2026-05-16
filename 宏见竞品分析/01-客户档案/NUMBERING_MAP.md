# NUMBERING_MAP — Cretas 宏见竞品分析编号权威映射表

> **本文件作用**: 团队从此**不再纠结编号**的权威表。
>
> **背景**: v1 三套编号 (MUST_COPY.N# / FINAL_A.N# / BORROW_LIST 字母+数字) 互相冲突 (例: FINAL_A.N31 ≠ MUST_COPY.N31), MASTER v2 已提出业务域前缀方案 (§5.1), 此表是 **完整双向映射 + 使用指南**。
>
> **审计基线**: MUST_COPY 18 项 + UX_BORROW 23 项 + FINAL_A 47 条 + BORROW_LIST 71 项 + MASTER v2 已用 11 个新编号
>
> **覆盖**: 经去重后 **~95 个独立条目** (业务功能 ~67 + UX ~28)
>
> **维护**: 新增条目按 §5 指南扩号; 历史旧号永远保留, 仅在此表追溯。

---

## §1 业务域前缀定义 (9 个域 + 1 子域)

| 前缀 | 业务域 | 含义范围 | 子域举例 |
|---|---|---|---|
| **S** | Sales / CRM | 销售、客户管理、报价、订单、合同、客户跟踪 | S-MRP (销售分流), S-RD (研发样品), S-PRICE (客户价), S-CRM (客户跟踪), S-QUOTE (报价单), S-DEL (发货), S-RETURN (销售退货), S-PERF (业绩提成) |
| **P** | Procurement | 采购、请购、供应商、收货、入库前流程 | P-PO (采购订单), P-SPLIT (按供应商拆单), P-3PC (三价对比), P-RECV (收货流程), P-OVER (超收阈值), P-RETURN (采购退货), P-RFQ (询价) |
| **M** | Manufacturing | 生产、工序、报工、BOM 配方、生产计划 | M-WP (工序管理), M-BOM (BOM 配方), M-RPT (报工), M-PLAN (生产计划), M-EXP (BOM 展开), M-SHORTAGE (缺料分析), M-QR (扫码报工), M-CHECK (生产校验), M-WAGE (计件工资), M-BUG (生产 bug) |
| **W** | Warehouse / Inventory | 仓库、库存、批次、调拨、盘点、追溯 | W-INV (库存), W-FIFO (FIFO 出库), W-ABA (抄码品), W-TRACE (流水追溯), W-EXP (失效告警), W-TRANSFER (调拨), W-MULTI (多维筛选), W-COUNT (盘点), W-SCRAP (报废), W-BIN (多仓位), W-SN (序列号), W-BUG |
| **F** | Finance | 财务、应收、应付、开票、回款、凭证、成本 | F-AR (应收), F-AP (应付), F-INV (开票/发票 OCR), F-PAY (回款), F-VOUCHER (凭证), F-COST (成本核算), F-FX (汇率), F-DEPR (折旧), F-MULTI (多账户) |
| **H** | HR | 考勤、班次、请假、调休、报销、日报、签到 | H-ATT (考勤矩阵), H-SHIFT (班次), H-GPS (外勤签到), H-LEAVE (请假), H-OVT (调休), H-EXP (报销), H-DAILY (日报), H-DEVICE (考勤机), H-GEOFENCE (地理围栏) |
| **Q** | Quality | 质检、模板、附件、流程开关 | Q-TPL (质检模板), Q-FLOW (流程开关), Q-FAIL (不合格处置), Q-ATTACH (质检附件) |
| **C** | Common / 通用平台 | 平台级能力 (AI / 附件 / 权限 / 打印 / 设计 / 文档 / 导入 / 设备) | C-AI (AI 平台/钉钉), C-ATT (通用附件), C-RBAC (权限), C-PRT (打印), C-DESIGN (设计), C-DOC (文档/编号), C-MIGRATE (导入助手), C-APPROVAL (审批链), C-FEATURE (Feature Flag), C-DEVICE (设备 — 见 §1.1), C-LOGIN (登录限制), C-TAB (多 Tab) |
| **U** | UI / UX | 设计语言、交互模式、视觉规范 | U-NAV (业务流程图导航), U-ACT (行末操作下拉), U-FOOTER (Sticky Footer), U-MOBILE (移动 RN), U-WEB (Web Vue), U-VISUAL (视觉细节), U-FORM (表单), U-STATUS (状态反馈), U-CHIP (多层 chip) |

### §1.1 关于 E (设备) 前缀的归并决策

BORROW_LIST 原有 E1-E4 (设备 6 子模块 / 三色灯 / 工作时间表 / 点检),但**业务域前缀不单独立 E** —— 设备相关归入 **C-DEVICE** 子域。

理由:
1. 设备管理在客户口述中并非独立部门 (附在生产/质检场景下)
2. C-DEVICE 与 H-DEVICE (考勤机) 区分清楚 (前者是生产设备,后者是考勤硬件)
3. 减少前缀数量,避免低频前缀稀释认知

例: `C-DEVICE-LED` (三色灯) / `C-DEVICE-LIFE` (设备生命周期) / `C-DEVICE-INSP` (点检巡检)

### §1.2 关于"研发"(R)的归并决策

研发样品流程归 **S-RD** (Sales / Research & Development) 而非单独 R 前缀。理由: 研发样品在客户业务中是**销售前置环节** (样品 → BOM → 报价 → 销售单), 归 S 域更贴近真实业务流。

---

## §2 完整双向映射表

> 按新编号排序。**Status 标记**: ✅ 已 ship / 🟡 进行中 / 🟢 后端有缺前端 / ⚠️ 部分有 / ❌ 待开发 / ⛔ 完全空白
>
> **Priority 标记**: P0 (客户已催 / 已 bug) / P1 (会议主张) / P2 (顺便提) / P3 (备选)

### §2.1 S 域 — Sales / CRM (12 项)

| 新编号 | MUST_COPY | FINAL_A | BORROW_LIST | 项目名 + 简要 | Priority | Status |
|---|---|---|---|---|---|---|
| **S-MRP-1** | N31 | N6 (销售单三向分流) | S1 | 销售订单 → 三向分流 (生产/采购/外购) + 缺料分析统一视图 | P0 | ❌ |
| **S-QUOTE-1** | — | N4 | S2 | 报价单 → 销售单转化链路 (后端 OperationalQuote 全套, 缺前端 Screen) | P1 | 🟢 |
| **S-PRICE-1** | P1-5 | N2 | S3 | 同产品 × 多客户历史价记忆 (建单时按客户带历史价) | P1 | ❌ |
| **S-PRICE-2** | — | N1 | — | 销售单价默认 BOM 出厂价 + 允许人工修改 (May7-part2 L298-302) | P0 | ⚠️ |
| **S-CRM-1** | — | N7 | S4 | 客户跟踪记录 + 文件附件 (后端 CustomerTrackingRecord 全套, 缺 Service/Controller/前端) | P2 | 🟢 |
| **S-RBAC-1** | — | N5 | S5 | 业务员客户隔离 (订单级有 salesperson_id, Customer 表无 owner) | P1 | ⚠️ |
| **S-LIST-1** | — | N3 | S9 | 销售订单 4 状态 tab + 行末 6 按钮批量 (转生产/转采购/转外购/复制/取消/打印) | P0 | ⚠️ |
| **S-RD-1** | N48 | N52, N53, N54 | — | 研发样品 → BOM → 报价 链路 (SampleRequest + 审核工作流 + 自动生成 BOM + 推送报价任务) | P0 | ❌ |
| **S-CRM-2** | — | — | S6 | 客户撞重 + 申请争取审批 (大销售团队才需要) | P3 | ❌ |
| **S-PERF-1** | — | — | S7 | 业绩管理 + 提成自动计算 | P1 | ❌ |
| **S-PAY-MODE-1** | — | — | S8 | 月结对账单 (单单结 vs 月底汇总) | P2 | ❌ |
| **S-EXTRA-1** | — | — | S10 | 租赁/寄卖/借出/样品/微信网店 5 种销售形态 | P3 | ❌ 不抄 |
| **S-DEL-1** | — | N55 | — | 发货单 → 仓库确认 → 实发数量手填 (May10 L820-845) | P1 | ✅ |
| **S-RETURN-1** | — | N56 | P4 (套用框架) | 销售退货 (有实物/无实物, 退款金额) | P2 | ✅ |
| **S-EMP-1** | — | N8 | — | 业务员定额录入 (May7-part2 L262 "韩英飞队") | P3 | ✅ |

### §2.2 P 域 — Procurement (10 项)

| 新编号 | MUST_COPY | FINAL_A | BORROW_LIST | 项目名 + 简要 | Priority | Status |
|---|---|---|---|---|---|---|
| **P-PO-1** | — | N9 | — | 采购订单 PDF 打印 + 二维码 (#413 已 ship, 含 Barcode128 + BarcodeQRCode) | P0 | ✅ |
| **P-SCAN-1** | M3 (PDF + 扫码闭环) | N10 | — | 扫码入库流程闭环 (RN 扫码 → 跳入库单, 仓管员只录 2 字段, 拍照附件) | P0 | 🟡 |
| **P-RECV-1** | — | N11 | — | 收货数量分次显示列 (May7-part2 L51-56 第一次/第二次/...) | P0 | ⚠️ |
| **P-OVER-1** | — | N12 | — | 超收 30% 阈值 (May7-part2 L184, overReceiveRate BigDecimal 字段) | P0 | ✅ |
| **P-3PC-1** | — | N14 | — | 三价对比 DTO (BOM 标准/历史均价/当前采购价) MaterialPriceComparisonDTO 实装 | P1 | ✅ |
| **P-3PC-BUG-1** | M2 (三价对比刷新) | N15 | — | 三价对比新建后不刷新 bug (T3-14 test env seed blocker) | P0 | ❌ |
| **P-FIN-1** | P1-2 (采购财务审核 + 三价标红) | N16 | — | 采购订单财务审核 + 三价差异自动标红 | P1 | 🟢 |
| **P-DELIVERY-1** | — | N17 | — | 预计到货时间字段 (客户认可现有"期望交货时间" alias) | P2 | ✅ |
| **P-SUPPLIER-1** | — | N18 | — | 原料类型层加供应商关联 (May7-part2 L222-247 "原料 → 供应商关联") | P2 | ⚠️ |
| **P-SPLIT-1** | P1-4 | — | P1 | 采购订单按供应商拆单 (1 请购单 N 物料 3 供应商 → 3 张 PO 草稿) | P1 | ❌ |
| **P-FLOW-1** | — | — | P2 | 采购全链路 6 阶段 (请购→采购→收货→质检→入库→付款) | P1 | ⚠️ |
| **P-RFQ-1** | — | — | P3 | 采购协同 + 询价管理 (多供应商比价) | P3 | ❌ |
| **P-RETURN-1** | — | — | P4 | 采购退货 / 退换货 + 对账 | P1 | ⚠️ |
| **P-PAY-MODE-1** | — | — | P5 | 按订单结算 vs 多订单汇总对账 | P3 | ❌ |

### §2.3 M 域 — Manufacturing (12 项)

| 新编号 | MUST_COPY | FINAL_A | BORROW_LIST | 项目名 + 简要 | Priority | Status |
|---|---|---|---|---|---|---|
| **M-WP-1** | N24 | N24 | — | 工序管理 UI (新增/排序, 第四次会议 L66-95 walk-through) | P0 | 🟢 |
| **M-WP-2** | N25 | N25 | — | 产品 × 工序配置 UI (后端 ProductWorkProcess 齐全, 前端 0 Screen) | P0 | 🟢 |
| **M-BUG-1** | M1 (工序通用未关联) | N26 | — | 生产计划"通用 P 过来"未关联 bug (PR #567 partial, #622/#623 open) | P0 | 🟡 |
| **M-PLAN-1** | — | N27 | — | 生产计划确认 → 自动生成调拨单 (#293/orchestration 已 fix) | P0 | ✅ |
| **M-CHECK-1** | — | N28 | — | 生产开始前库存校验 (PR #305 已 fix) | P0 | ✅ |
| **M-WP-ORDER-1** | — | N29 | — | 按工序排生产计划 (非按品, 第一次会议关键架构决策) | P1 | ✅ |
| **M-QR-1** | — | N30 | M3 | 扫码签到 + 自动记录上下班 + 当天报工 (第一次会议) | P1 | ⚠️ |
| **M-RPT-BATCH-1** | — | N31 (注: FINAL_A 的 N31 ≠ MUST_COPY 的 N31) | M6 | 批量电脑报工 (统计员模式, TeamBatchReportScreen 完整) | P1 | ✅ |
| **M-BOM-1** | N32 | N32 | — | BOM 配方编辑 UI (工厂端, 物料从字典 select 非手写) | P0 | 🟢 |
| **M-BOM-2** | — | N33 | — | BOM 出成率 + 单份成品克数 (200g/58% = 250.58g 原料) PR #297 D2 已 ship | P0 | ✅ |
| **M-UNIT-1** | M5 (单位转换强校验) | N34 | — | g ↔ kg 单位自动折算 (PR #297/#312 D3 已 ship) | P0 | ✅ |
| **M-BUG-2** | M4 (BOM 物料选择器) | — | — | BOM 物料选择器 (从原料字典 select 不是手写) — 仅 spec D2, 与 M-BOM-1 合并 | P0 | ⚠️ |
| **M-EXP-1** | — | — | M1 | 物料需求按工序展开 (依赖 BomExpansion stub 修复) | P0 | ⚠️ |
| **M-SHORTAGE-1** | — | — | M2 | 缺料分析统一视图 (整合 4 处分散逻辑到 ShortageAnalysisService, 含在 S-MRP-1) | P0 | ❌ |
| **M-PICK-1** | — | — | M4 | 领料单按 BOM 自动展开 + 多列进度 (计划/申请/已领/未领/退料/实领) | P1 | ❌ |
| **M-STATUS-1** | — | — | M5 | 生产任务列表 4 列状态色编码 (生产/物料/审批/已交) — 与 S-LIST-1 配套 | P1 | ❌ |
| **M-RPT-LEADER-1** | P1-10 | — | M7 | 小组长代报工 (一次扫码代填全组 5-10 人 + 工资分摊) | P1 | ❌ |
| **M-WAGE-1** | — | — | M8 | 报工 → 计件工资自动联动 | P1 | ❌ |
| **M-BOM-VER-1** | — | N35 | M9 | 工程 BOM 版本管理 (BomChangeLog 仅日志, 无 BomVersion 实体) | P3 | ❌ |

### §2.4 W 域 — Warehouse / Inventory (11 项)

| 新编号 | MUST_COPY | FINAL_A | BORROW_LIST | 项目名 + 简要 | Priority | Status |
|---|---|---|---|---|---|---|
| **W-ABA-1** | N13 | N13 | — | 抄码品识别 (卤制品行业, 每箱重量不一; spec exact match `=== '抄码'` 不 includes) | P0 | ❌ |
| **W-RECV-FIELD-1** | — | N19 | — | 仓管员只录 2 字段 (收货数量 + 商品日期, 简化为老员工设计) | P0 | ⚠️ |
| **W-MULTI-1** | — | N21 | W1 | 分仓库存查询页 (线边仓 vs 总仓, FactoryWarehouse + WH-WKS/WH-LOG) | P1 | ✅ |
| **W-FIFO-1** | — | N22 | W3 | 调拨单批次选择 (非默认 FEFO, 客户可指定批次, PR #322 已 ship) | P1 | ✅ |
| **W-TRANSFER-1** | — | N23 | W8 | 手动调拨 (无销售订单时, PR #299 已 ship, InternalTransfer 实体) | P1 | ✅ |
| **W-INV-MULTI-1** | — | — | W1 | 多维度库存细分 (仓库×批号×供应商×失效日期, MaterialBatch 已支持) | P1 | ⚠️ |
| **W-FILTER-1** | — | — | W2 | 多维度联动筛选 17 列查询 (含库存价值/失效预警/上次入库/双税轨) | P1 | ❌ |
| **W-EXP-1** | — | — | W4 | 失效天数告警 UI (MaterialExpiringAlertTool 默认 7 天已有, 需配置 UI + 推送) | P1 | 🟢 |
| **W-TRACE-1** | P1-9 | — | W5 | 库存出入流水追溯 (每笔变动可点单号跳回源单据, MaterialBatchTransaction 缺业务来源字段) | P1 | ⚠️ |
| **W-COUNT-1** | — | — | W6 | 库存盘点 + 调整 (盘点表 + 差异调整流程) | P2 | ❌ |
| **W-LOAN-1** | — | — | W7 | 借入借出 4 单据 (借出/借回/还回/损耗) | P3 | ❌ |
| **W-SCRAP-1** | — | — | W8 | 产品报废 + 库存调拨 (不合格报废) | P2 | ❌ |
| **W-BIN-1** | — | — | W9 | 多仓位 bin-level (仓库内细分到货架位) | P3 | ❌ 不抄 |
| **W-SN-1** | — | — | W10 | 序列号 + 箱标 (SN 追踪 + 装箱标签) | P3 | ❌ 不抄 |

### §2.5 F 域 — Finance (10 项)

| 新编号 | MUST_COPY | FINAL_A | BORROW_LIST | 项目名 + 简要 | Priority | Status |
|---|---|---|---|---|---|---|
| **F-AR-1** | P1-1 (销售订单财务成本核算审核) | N36 | — | 销售订单财务审核 (拉 BOM 标准成本 + 历史生产成本 → 自动算总成本 + 利润) | P1 | 🟢 |
| **F-COST-HIDE-1** | — | N37 | — | 预估成本字段暂时隐藏 (May7-part2 L457-475, 避免与财务冲突) | P0 | ⚠️ |
| **F-INV-1** | P1-3 (开票申请 + 发票回写 + 收款流水) | N38 | F5 | 开票申请 + 发票回写 + 收款流水 (InvoiceRecord 后端有, 前端缺 UI, OCR 未对接) | P1 | 🟡 |
| **F-AR-AGING-1** | — | N39 | F1 | AR/AP 应收账款账龄分析 (6 桶 30/60/90/120/180/180+, 已 ship) | P1 | ✅ |
| **F-VOUCHER-SKU-1** | — | N40 | F2 | 会计凭证 (SKU 维度毛利, 第二次会议 "每批产品的毛利率") | P2 | ❌ |
| **F-VOUCHER-HOOK-1** | — | — | F3 | 单据 → 凭证 hook (销售单审批通过自动生成凭证) | P3 | ❌ |
| **F-FX-1** | — | — | F4 | 多币种 + 多账户 (出口客户) | P3 | ❌ 不抄 |
| **F-OCR-1** | — | N50 | — | 拍照 OCR 入账 (报销 / 发票, DashScopeVisionClient 存在但未对接) | P1 | ⚠️ |
| **F-DEPR-1** | — | — | F6 | 固定资产折旧 + 长期待摊费用 | P3 | ❌ 不抄 |
| **F-FX-RATE-1** | — | — | F7 | 汇率管理 (多币种业务汇率配置) | P3 | ❌ 不抄 |

### §2.6 H 域 — HR (10 项)

| 新编号 | MUST_COPY | FINAL_A | BORROW_LIST | 项目名 + 简要 | Priority | Status |
|---|---|---|---|---|---|---|
| **H-ATT-1** | P1-7 (月度考勤可视化矩阵) | — | H1 | 月度考勤可视化矩阵 (8 色 + 节日 badge, AttendanceMonthlyTool 后端有) | P1 | 🟢 |
| **H-SHIFT-1** | — | — | H2 | 6 班次打卡 (早/中/晚/三班倒/弹性/标准) | P1 | ❌ |
| **H-GPS-1** | — | — | H3 | 外勤签到 (GPS + 照片, 销售员/外勤员工出差打卡) | P1 | ❌ |
| **H-LEAVE-1** | P1-8a | — | H4 | 请假流程 (病假/事假/年假申请 + 审批) | P1 | ❌ |
| **H-OVT-1** | P1-8b | — | H5 | 调休流程 (加班调休 + 申请 + 余额) | P1 | ❌ |
| **H-EXP-1** | P1-8c | — | H6 | 报销流程 (报销单 + 发票附件 + 审批) | P1 | ❌ |
| **H-DAILY-1** | — | — | H7 | 工作日报 (员工日报 + 主管查看, Cretas WorkReport 已有部分) | P2 | ⚠️ |
| **H-DEVICE-1** | — | — | H8 | 考勤机硬件集成 (物理打卡机数据回传) | P3 | ❌ |
| **H-GEOFENCE-1** | — | — | H9 | 考勤地理围栏 (工厂 GPS 范围内才能打卡) | P3 | ❌ |
| **H-CHECKIN-1** | — | N30 | — | 扫码签到 + 自动记录上下班 (第一次会议核心场景, ProcessCheckinRecord + TimeClockRecord) | P1 | ⚠️ |

### §2.7 Q 域 — Quality (4 项)

| 新编号 | MUST_COPY | FINAL_A | BORROW_LIST | 项目名 + 简要 | Priority | Status |
|---|---|---|---|---|---|---|
| **Q-TPL-1** | — | N43 | Q1 | 质检项目和参数自定义模板 (QualityCheckItemBinding 已有, 前端 Screen 已 ship) | P2 | ✅ |
| **Q-FLOW-1** | — | — | Q2 | 质检流程可选关闭 (不需要质检的产品跳过流程) | P2 | ❌ |
| **Q-FAIL-1** | — | — | Q3 | 质检不合格 → 自动触发退货 / 报废流程 | P2 | ❌ |
| **Q-ATTACH-1** | — | — | Q4 | 质检附件上传 (手机端拍照 + 视频证据, 依赖 C-ATT-1) | P2 | ❌ |
| **Q-VL-1** | — | N41 | — | 摄像头异物识别 (金属探测仪上集成 YOLO, 第一次/第二次会议) | P1 | ✅ |
| **Q-VL-LEARN-1** | — | N42 | — | 摄像头自学习 (新品上架不需要重新训练, 第二次会议 11:40-11:42) | P2 | ⚠️ |

### §2.8 C 域 — Common / 通用平台 (15 项)

| 新编号 | MUST_COPY | FINAL_A | BORROW_LIST | 项目名 + 简要 | Priority | Status |
|---|---|---|---|---|---|---|
| **C-AI-1** | N49 (钉钉机器人 PoC) | N49 | — | 钉钉机器人 / 钉钉 API 接入 (第二次会议 hard demand, grep 0 hits in source) ⛔ 战略级 | P0 | ⛔ |
| **C-AI-2** | (Phase 0 修死代码) | — | — | AILayoutAssistant 接真 LLM (DecorationServiceImpl.java:207 仍 rule-based) | P0 | ❌ |
| **C-AI-CHAT-1** | — | N48 (AI 中台录入+查询) | — | AI 中台 / AIChat 8 SCENE_CONFIG (后端 19 Skill + ~354 Tool + Python SmartBI NL Query) | P0 | ✅ |
| **C-AI-CHAT-2** | — | N45 | — | AI 对话窗口入口 (新建计划旁有 AI 对话, 客户当时未用) | P2 | ✅ |
| **C-ATT-1** | N20 (通用 attachment 系统) | N20 | C1 | 通用 attachment 系统 (entityType + entityId + fileUrl + fileType + uploaderId, 5+ 业务接入) | P0 | ❌ |
| **C-RBAC-1** | N3 (RBAC 仓管隔离审计) | — | C4 (4 维度权限通用框架) | RBAC 销售/采购/仓管 严格隔离审计 (验证 PR #423 + R7-F2 13/13 PASS 完整性, canViewPrice store) | P0 | 🟡 |
| **C-PRT-1** | P1-6 (单据打印系统 + PDF 模板) | — | C2 | 单据打印系统 + 5 核心单据 PDF (销售/采购/报价/生产任务/领料) + 模板可视化 | P0 | 🟡 |
| **C-APPROVAL-1** | — | N47 (审批链动态配置) | C3 (金额分级审批规则引擎) | 审批链动态配置 (后端 ApprovalChainConfig 全套, 前端管理 UI 缺) | P0 | 🟢 |
| **C-FEATURE-1** | — | N51 (跨工厂行业模板) | C5 | 行业初始化 Feature Flag (IndustryTemplatePackage + FactoryFeatureConfig 全套已 ship) | P2 | ✅ |
| **C-LOGIN-1** | — | — | C6 | 登陆地点限制 (大型企业可限制登录 IP) | P3 | ❌ 不抄 |
| **C-TAB-1** | — | — | C7 | 多 Tab 工作台 (Web 端多任务并行, 仅 Cretas 出 Web 时需要) | P3 | ❌ |
| **C-CHIP-1** | — | N46 (行级状态色块 + 多层 chip) | C8 | 行级状态多层 chip 体系 (顶部 4-chip + 行内 5-chip, StatusBadge + StatusChipRow) | P1 | 🟡 |
| **C-CANVAS-1** | (Phase 0 修死代码) | — | — | PageEditor 1252 行挂导航 (nav 0 hits, 整体修复) | P0 | ❌ |
| **C-CANVAS-2** | (Phase 0 修死代码) | — | — | Canvas Tool Repository 统一 (pagedesign vs decoration 不一致) | P0 | ❌ |
| **C-DOC-1** | — | — | — | N# 重编 + NUMBERING_MAP.md (Sprint 0 输出, 本文件) | P0 | 🟡 |
| **C-DESIGN-1** | — | — | — | 双主线能力拆分表 (Tool/Skill/Screen/Entity 4 类 tag, 餐饮/食品厂/共享) | P0 | ❌ |
| **C-DESIGN-2** | — | — | — | 9 张数据表设计 + API 契约 (Sprint 0) | P0 | ❌ |
| **C-MIGRATE-1** | — | — | — | 产品导入助手 (Excel 模板一键导入 + 30 分钟培训视频 + 数据校验, v2.1 新增) | P0 | ❌ |
| **C-DEVICE-LIFE-1** | — | — | E1 | 设备 6 子模块 (管理/能耗/维修/巡检/保养/报废, 完整设备生命周期) | P3 | ❌ |
| **C-DEVICE-LED-1** | — | — | E2 | 设备列表三色灯 (绿/黄/红 一眼看异常) | P2 | ❌ |
| **C-DEVICE-SCHED-1** | — | — | E3 | 设备工作时间表 + 排班 (与 H-SHIFT-1 联动) | P3 | ❌ |
| **C-DEVICE-INSP-1** | — | — | E4 | 设备点检 / 巡检记录 (班前点检 + 定期巡检) | P2 | ❌ |

### §2.9 U 域 — UI / UX (28 项)

| 新编号 | MUST_COPY | UX_BORROW | BORROW_LIST | 项目名 + 简要 | Priority | Status |
|---|---|---|---|---|---|---|
| **U-NAV-1** | — | A-1 ⭐⭐⭐ | — | 业务流程图导航 (顶部可点击节点, 粉/绿/蓝色状态 + 数量徽章) | P0 | ❌ |
| **U-ACT-1** | — | A-2 ⭐⭐⭐ | — | 行末"操作 ▾"下拉收纳次要动作 (8-14 个动作 + AI 入口) | P0 | ⚠️ |
| **U-FOOTER-1** | — | A-3 ⭐⭐⭐ | U3 | Sticky Footer 实时合计 + 分页同栏 (共 N 条 / 金额 / 损耗 + AI 分析) | P0 | ❌ |
| **U-MOBILE-1** | — | B-1.M1 ⭐⭐ | C8 (移动端体现) | 行级状态色块 (整行底色浅粉/浅绿/浅黄表达 status) | P1 | ⚠️ |
| **U-MOBILE-2** | — | B-1.M2 ⭐⭐ | — | 多维 mini chip 状态 (5-7 个 chip 各代表一个维度) | P1 | ⚠️ |
| **U-MOBILE-3** | — | B-1.M3 ⭐⭐ | — | Skeleton 加载 (替代 ActivityIndicator) | P1 | ❌ |
| **U-MOBILE-4** | — | B-1.M4 ⭐⭐ | — | Toast 抽象 (替代原生 Alert.alert) | P1 | ❌ |
| **U-MOBILE-5** | — | B-1.M5 ⭐⭐ | — | Haptic feedback (按钮/提交/错误触觉反馈) | P1 | ❌ |
| **U-WEB-1** | — | B-2.W1 ⭐⭐ | — | 累积多 Tab 持久化 (一个 window 开 20+ tab 切换不丢上下文) | P2 | ❌ |
| **U-WEB-2** | — | B-2.W2 ⭐⭐ | U8 | 多维度联动筛选 + 左侧分类树 | P2 | ⚠️ |
| **U-WEB-3** | — | B-2.W3 ⭐⭐ | — | 权限矩阵编辑器 (员工 × 模块 × 权限点 3 维 checkbox) | P2 | ❌ |
| **U-WEB-4** | — | B-2.W4 ⭐⭐ | — | inline 分类树并排列表 (左侧 200px 持续可见树) | P2 | ⚠️ |
| **U-WEB-5** | — | B-2.W5 ⭐⭐ | — | 历史搜索记录自动联想 (localStorage + autocomplete) | P2 | ❌ |
| **U-VISUAL-1** | — | C-1.V1 ⭐ | — | 米黄底色暗示列分组 (BOM 表里"原料组/辅料组/包材组") | P2 | ❌ |
| **U-VISUAL-2** | — | C-1.V2 ⭐ | — | 字段后 ⓘ tooltip (复杂业务字段右侧小问号) | P2 | ❌ |
| **U-VISUAL-3** | — | C-1.V3 ⭐ | — | "当前节点: XXX"流程指示文字 (轻量步骤条) | P2 | ❌ |
| **U-VISUAL-4** | — | C-1.V4 ⭐ | — | 明显数字大字 + 单位小字层级 (金额/进度/完成率视觉权重) | P2 | ❌ |
| **U-VISUAL-5** | — | C-1.V5 ⭐ | — | 显式"自动计算"按钮 (工资场景让用户掌控刷新时机) | P3 | ❌ |
| **U-FORM-1** | — | C-2.F1 ⭐ | — | 多区域 6 区大行布局 (一行 6 区表达"做不做/谁负责/进度/物料/状态/操作") | P3 | ❌ |
| **U-FORM-2** | — | C-2.F2 ⭐ | — | 行内 QR 浮层 (列表行点 QR 图标弹出 QR + 单据说明) | P2 | ⚠️ |
| **U-FORM-3** | — | C-2.F3 ⭐ | — | 二次确认按钮带计时 (删除/撤销 3s 倒计时) | P2 | ❌ |
| **U-STATUS-1** | — | C-3.S1 ⭐ | — | 多维 Error/Warn 视觉重量级 (INFO/WARN/ERROR/CRITICAL 4 档) | P2 | ❌ |
| **U-STATUS-2** | — | C-3.S2 ⭐ | — | "已审核 by 张三 @ 2026-05-14"内嵌审批时间线 | P2 | ❌ |
| **U-BATCH-1** | — | — | U1 | 底部固定批量操作栏 (列表多选时底部 5-6 个批量按钮) | P1 | ❌ |
| **U-PROGRESS-1** | — | — | U7 | 数据可视化进度条 (行内 sparkline 显示百分比) | P2 | ❌ |
| **U-CHIP-1** | — | — | C8 | 行级状态多层 chip 体系 (与 C-CHIP-1 配对实现) | P1 | 🟡 |
| **U-AUDIT-1** | — | — | — | 列宽 / 详情盖住 audit (N44, May7 反复 UI feedback, PR #535 已部分修) | P0 | 🟡 |
| **U-WIN-1** | — | N60 | — | 大窗口尺寸优化 (整体界面放大, May7-part2 L266) | P2 | ⚠️ |

---

## §3 按业务域分组速查

> 不带 status 的精简列表, 团队日常按此快速定位项目所属域。

### §3.1 销售 / S 域 (15 项)
S-MRP-1 / S-QUOTE-1 / S-PRICE-1 / S-PRICE-2 / S-CRM-1 / S-CRM-2 / S-RBAC-1 / S-LIST-1 / S-RD-1 / S-PERF-1 / S-PAY-MODE-1 / S-EXTRA-1 / S-DEL-1 / S-RETURN-1 / S-EMP-1

### §3.2 采购 / P 域 (14 项)
P-PO-1 / P-SCAN-1 / P-RECV-1 / P-OVER-1 / P-3PC-1 / P-3PC-BUG-1 / P-FIN-1 / P-DELIVERY-1 / P-SUPPLIER-1 / P-SPLIT-1 / P-FLOW-1 / P-RFQ-1 / P-RETURN-1 / P-PAY-MODE-1

### §3.3 生产 / M 域 (19 项)
M-WP-1 / M-WP-2 / M-BUG-1 / M-PLAN-1 / M-CHECK-1 / M-WP-ORDER-1 / M-QR-1 / M-RPT-BATCH-1 / M-BOM-1 / M-BOM-2 / M-UNIT-1 / M-BUG-2 / M-EXP-1 / M-SHORTAGE-1 / M-PICK-1 / M-STATUS-1 / M-RPT-LEADER-1 / M-WAGE-1 / M-BOM-VER-1

### §3.4 库存 / W 域 (14 项)
W-ABA-1 / W-RECV-FIELD-1 / W-MULTI-1 / W-FIFO-1 / W-TRANSFER-1 / W-INV-MULTI-1 / W-FILTER-1 / W-EXP-1 / W-TRACE-1 / W-COUNT-1 / W-LOAN-1 / W-SCRAP-1 / W-BIN-1 / W-SN-1

### §3.5 财务 / F 域 (10 项)
F-AR-1 / F-COST-HIDE-1 / F-INV-1 / F-AR-AGING-1 / F-VOUCHER-SKU-1 / F-VOUCHER-HOOK-1 / F-FX-1 / F-OCR-1 / F-DEPR-1 / F-FX-RATE-1

### §3.6 HR / H 域 (10 项)
H-ATT-1 / H-SHIFT-1 / H-GPS-1 / H-LEAVE-1 / H-OVT-1 / H-EXP-1 / H-DAILY-1 / H-DEVICE-1 / H-GEOFENCE-1 / H-CHECKIN-1

### §3.7 质检 / Q 域 (6 项)
Q-TPL-1 / Q-FLOW-1 / Q-FAIL-1 / Q-ATTACH-1 / Q-VL-1 / Q-VL-LEARN-1

### §3.8 通用 / C 域 (22 项)
C-AI-1 / C-AI-2 / C-AI-CHAT-1 / C-AI-CHAT-2 / C-ATT-1 / C-RBAC-1 / C-PRT-1 / C-APPROVAL-1 / C-FEATURE-1 / C-LOGIN-1 / C-TAB-1 / C-CHIP-1 / C-CANVAS-1 / C-CANVAS-2 / C-DOC-1 / C-DESIGN-1 / C-DESIGN-2 / C-MIGRATE-1 / C-DEVICE-LIFE-1 / C-DEVICE-LED-1 / C-DEVICE-SCHED-1 / C-DEVICE-INSP-1

### §3.9 UI/UX / U 域 (28 项)
U-NAV-1 / U-ACT-1 / U-FOOTER-1 / U-MOBILE-1~5 / U-WEB-1~5 / U-VISUAL-1~5 / U-FORM-1~3 / U-STATUS-1~2 / U-BATCH-1 / U-PROGRESS-1 / U-CHIP-1 / U-AUDIT-1 / U-WIN-1

---

## §4 v1 → v2 编号差异表 (冲突项专项)

> 本节专门列出**编号曾经冲突 / 不一致**的项, 让历史追溯一目了然。

### §4.1 FINAL_A.N# 与 MUST_COPY.N# 同号不同义

| 旧号 | FINAL_A 含义 (47 客户需求) | MUST_COPY 含义 (18 必抄) | 新编号 (差异化解决) |
|---|---|---|---|
| **N31** | 批量电脑报工 (统计员模式, May10) | 销售订单 → 采购自动分流 (缺料判断) | M-RPT-BATCH-1 (FINAL_A.N31) + S-MRP-1 (MUST_COPY.N31) |
| **N48** | AI 中台 (录入 + 查询) | 研发样品 → BOM → 报价 链路 | C-AI-CHAT-1 (FINAL_A.N48) + S-RD-1 (MUST_COPY.N48) |

**根因**: FINAL_A.N# 是按章节 §A-§M 顺序连号的 47 条客户需求, MUST_COPY.N# 是 8 项 P0 + 5 修复 + 10 P1 的精选号; 两套号是独立体系, v1 互相借用导致同号歧义。

**v2 修正**: 统一改为业务域前缀, 一个项目只有一个新编号; 旧号在表中保留方便历史追溯。

### §4.2 MUST_COPY P1-* 与 BORROW_LIST 域字母-数字 双向追溯

| MUST_COPY P1 编号 | 项目名 | BORROW_LIST | 新编号 |
|---|---|---|---|
| P1-1 | 销售订单财务成本核算审核 | (NEW from FINAL_A.N36) | F-AR-1 |
| P1-2 | 采购订单财务审核 + 三价标红 | (NEW from FINAL_A.N16) | P-FIN-1 |
| P1-3 | 开票申请 + 发票回写 + 收款流水 | F5 | F-INV-1 |
| P1-4 | 采购订单按供应商拆单 | P1 | P-SPLIT-1 |
| P1-5 | 客户记忆价 | S3 | S-PRICE-1 |
| P1-6 | 单据打印系统 (含 PDF 模板) | C2 | C-PRT-1 |
| P1-7 | 月度考勤可视化矩阵 | H1 | H-ATT-1 |
| P1-8 | 请假/调休/报销流程 | H4-H6 | H-LEAVE-1 / H-OVT-1 / H-EXP-1 |
| P1-9 | 库存出入流水追溯 | W5 | W-TRACE-1 |
| P1-10 | 小组长代报工 | M7 | M-RPT-LEADER-1 |

### §4.3 MUST_COPY M1-M5 (Bug 修复) 与新编号

| MUST_COPY M# | 项目名 | 新编号 |
|---|---|---|
| M1 | 生产工序"通用 P 过来"未关联 bug | M-BUG-1 |
| M2 | 三价对比新建后不刷新 bug | P-3PC-BUG-1 |
| M3 | PDF 打印 + 扫码入库 RN 端 UI 串通 | P-SCAN-1 |
| M4 | BOM 物料选择器 (不是手写) | M-BUG-2 (与 M-BOM-1 合并实现) |
| M5 | 单位转换强校验 (g ↔ kg) | M-UNIT-1 |

### §4.4 MASTER v2 已用 11 个新编号 (必须保持一致)

v2 §5.2 + §5.4 + §6.1 + §9.1 已经使用以下 11 个新编号, **本文件严格保持一致**, 不重新命名:

| v2 已用 | 项目名 | 来源 |
|---|---|---|
| C-AI-1 | 钉钉机器人 PoC | MUST_COPY.N49 + BORROW_LIST 缺 |
| C-ATT-1 | 通用 attachment 系统 | MUST_COPY.N20 + BORROW_LIST.C1 |
| M-WP-1 | 工序管理前端 | MUST_COPY.N24 |
| M-WP-2 | 产品工序配置 | MUST_COPY.N25 |
| M-BOM-1 | BOM 配方编辑 UI | MUST_COPY.N32 |
| W-ABA-1 | 抄码品识别 | MUST_COPY.N13 |
| C-RBAC-1 | RBAC 仓管隔离审计 | MUST_COPY.N3 + BORROW_LIST.C4 |
| S-MRP-1 | 销售→采购自动分流 | MUST_COPY.N31 |
| S-RD-1 | 研发样品→BOM→报价 | MUST_COPY.N48 |
| U-NAV-1 | 业务流程图导航 | UX_BORROW.A-1 |
| U-ACT-1 | 行末"操作 ▾"下拉 | UX_BORROW.A-2 |
| U-FOOTER-1 | Sticky Footer 实时合计 | UX_BORROW.A-3 |

### §4.5 BORROW_LIST E1-E4 (设备) 归并到 C-DEVICE-*

| BORROW_LIST | 新编号 | 原因 |
|---|---|---|
| E1 | C-DEVICE-LIFE-1 | 设备非独立部门, 归 Common 子域 |
| E2 | C-DEVICE-LED-1 | 同上 |
| E3 | C-DEVICE-SCHED-1 | 同上, 与 H-SHIFT-1 联动 |
| E4 | C-DEVICE-INSP-1 | 同上 |

---

## §5 使用指南: 何时新增编号

### §5.1 新增项的判断逻辑

```
新需求 / 新发现项目 →
  ├─ 业务域明确? (S/P/M/W/F/H/Q/C/U)
  │   ├─ Yes → 子域明确? 例: 销售域内是 PRICE / CRM / RD / DEL / RETURN?
  │   │   ├─ Yes → 在 §2.x 表中查同子域已用编号, 取下一个序号
  │   │   │       例: S-PRICE-1 已用 → 新增叫 S-PRICE-2
  │   │   └─ No → 创建新子域, 例: S-NEW-1
  │   └─ No → 跨域? 通常归 C (通用) 或 重新审视
  └─ 是否仅 UI/UX 改造, 与业务功能无关?
      └─ Yes → 走 U 域, 按 NAV/ACT/FOOTER/MOBILE/WEB/VISUAL/FORM/STATUS/CHIP 分类
```

### §5.2 编号扩展示例

#### 例 1: 客户后续会议提出"客户分类 (VIP / 普通 / 一次性)"

- 业务域: Sales (S)
- 子域: CRM (S-CRM 已有 S-CRM-1 客户跟踪, S-CRM-2 客户撞重)
- 新增: **S-CRM-3** 客户分类管理

#### 例 2: 第二条 BOM 类型 (除工艺 BOM 外加销售 BOM)

- 业务域: Manufacturing (M)
- 子域: BOM (M-BOM-1 配方编辑, M-BOM-2 出成率算法)
- 新增: **M-BOM-3** 销售 BOM (含包装 + 物流成本)
- 也可: **M-SBOM-1** 全新子域, 若与配方 BOM 数据模型完全不同

#### 例 3: 新增 UX 模式 "面包屑导航"

- 业务域: UX (U)
- 子域: NAV (U-NAV-1 业务流程图导航)
- 新增: **U-NAV-2** 面包屑导航

### §5.3 命名规则

```
<前缀>-<子域>-<序号>

前缀: S/P/M/W/F/H/Q/C/U (1 字母)
子域: 2-7 字母, 大写, 业务含义清晰
       好: WP (Work Process), BOM, FIFO, ATT (Attendance), AI
       不好: TMP, MISC, XYZ, NEW
序号: 1, 2, 3, ... (同子域内顺序)

完整示例:
✅ S-MRP-1, M-WP-2, C-DEVICE-LIFE-1
❌ Sales-MRP-1 (前缀太长), S-1 (无子域), S-MISC-1 (子域不清)
```

### §5.4 何时 **不** 新增编号

- 已 ship 的项目重新审视(Verify 现状) → 不增号, 在原编号 status 列更新
- v1 多个旧号指向同一新项目(去重) → 不增号, 只在历史追溯保留旧号
- 跨域协作的 Skill / Tool → 不强行归一个前缀, 在 §2 表中用 "**含在 X-Y-Z 中**" 说明依赖关系(例: M-EXP-1 含在 S-MRP-1 实施中)

### §5.5 v2.x 后续 amend 流程

1. **修改本文件**: 在 §2 对应表添加新行 + §3 速查表追加 + 必要时 §4 差异表注明
2. **同步 MASTER v2 / MUST_COPY / FINAL_A**: 引用本文件做交叉指向
3. **PR commit message**: 引用本文件路径让团队跟得上, 例:
   `docs(numbering): add S-CRM-3 客户分类 / 同步 NUMBERING_MAP §2.1`

### §5.6 维护责任

- **MO (Master Organizer)**: 每周末巡检本文件, 确认与 MASTER v2 + MUST_COPY 一致
- **每个 Sprint 末**: 在 §2 表 status 列同步实际进展
- **客户会议后**: 24h 内将新需求加入本文件 (即使只是占位, 标 P2 + status ❌)
- **每个 Sprint 开始**: dispatch MO 前先 grep 本文件确认编号无冲突 (per memory `feedback_organizer_dispatch_must_grep_canonical_HOLD.md` HARD)

---

## §6 引用与历史追溯

### §6.1 文档地图

```
NUMBERING_MAP.md  ← 编号权威表 (本文件)
    ↓ 被引用
00-MASTER-PLAN-v2.md §5.1, §9.1 (已用 11 个新号, 必保持一致)
04-最终决策/MUST_COPY.md (待 N# 重编 → 本文件已 cover)
03-审计过程/FINAL_A_NEEDS_VS_CRETAS.md (47 条客户需求)
03-审计过程/BORROW_LIST.md (71 项竞品借鉴)
04-最终决策/UX_BORROW.md (23 项 UX 模式)
    ↓ 源数据
docs/会议内容/客户会议/ (4 次会议 + 全流程文档原始证据)
```

### §6.2 关键决策记录

| 决策 | 来源 | 影响 |
|---|---|---|
| 业务域前缀 9 个 (S/P/M/W/F/H/Q/C/U) | MASTER v2 §5.1 + 用户决策 #6 | 取代 v1 三套编号 |
| E (设备) 归并 C-DEVICE-* | 本文件 §1.1 | 减少前缀稀释 |
| 研发 (R) 归并 S-RD | 本文件 §1.2 | 贴合销售前置流程 |
| v2 已用 11 编号锁定 | MASTER v2 §5.2 + 用户决策 #6 | 不重新命名 |
| FINAL_A.N31/N48 冲突解决 | 本文件 §4.1 | 分配到独立新号 |
| MUST_COPY P1-* 与 BORROW_LIST 字母-数字 双追溯 | 本文件 §4.2 | 历史可查 |

### §6.3 维护历史

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-05-14 | v1.0 | 初版, 覆盖 MUST_COPY 18 + UX_BORROW 23 + FINAL_A 47 + BORROW_LIST 71 + MASTER v2 11 = ~95 独立条目, 完整双向映射 + §3 速查 + §4 冲突解决 + §5 使用指南 |
| 2026-05-15 | v1.1 | **R-HJ audit 增量** (+22 新条目 / +132d 工时), 详见 §7 |

---

## §7 总结

**本文件价值**: 让团队从此**一个项目对应一个编号**, 不再因 N31 / N48 等冲突号反复 ping pong.

**使用方式**:
- 看一个项目 → 在 §2 表查新编号 (按业务域定位最快)
- 看一个旧号 → 用 ctrl+F 搜旧号 (会跳到对应新编号行)
- 新增项目 → 按 §5 指南扩号
- 历史对照 → 看 §4 冲突解决专项

**核心约束**:
1. v2 已用 11 编号永远不改
2. 新号按业务域前缀 + 子域 + 序号 严格命名
3. 每周末 MO 巡检与 MASTER 一致性
4. 每客户会议后 24h 内同步新需求

**下一步行动**:
- Sprint 0 Week 1 Day 1-2 完成本文件 (本文件即此交付物)
- Sprint 0 Week 1 Day 3-5 输出"双主线能力拆分表" (C-DESIGN-1)
- Sprint 0 Week 2 Day 1-3 输出 9 表 schema + API 契约 (C-DESIGN-2)
- Sprint 0 Week 2 Day 4-5 输出产品导入助手 (C-MIGRATE-1)

---

## §7 R-HJ Audit 增量 (2026-05-15, v1.1)

> **来源**: `06-宏见测试账号深度审计/08-MUST-COPY-AUGMENT.md` (R-HJ chat 实测后整合)
>
> 这次实测发现 22 个主 MUST_COPY 没列的项目, 加 +132d 工时. 也升级 2 项 (M-BOM-VER-1 P3→P0, F-VOUCHER-HOOK-1 → P0 战略).

### §7.1 新增编号 — F 域 (1 项)

| 新编号 | 来源 | 项目名 | Priority | Status | 工时 |
|---|---|---|---|---|---|
| **F-VFLAG-1** | R-HJ audit | 凭证生成 hook (vflag 4 状态 + 7 凭证生成器 + 批量) | **P0 战略** | ❌ | 10d |

**注**: 此编号跟 F-VOUCHER-HOOK-1 (BORROW_LIST F3) 是同一概念的不同视角:
- F-VOUCHER-HOOK-1: 单据 → 凭证 hook (机制层)
- F-VFLAG-1: vflag 4 状态机 + 批量 generator (实现层)
- 二合一交付, 编号 F-VFLAG-1 优先 (实现细节具体)

### §7.2 升级现有编号 — 优先级调整

| 编号 | 原 Priority | **新 Priority** | 升级理由 |
|---|---|---|---|
| **M-BOM-VER-1** | P3 (不抄) | **P0 (Sprint 4 必上)** | R-HJ 实测宏见 BOM 是工程级 PLM-Lite, 已实装版本号 + ECN 变更. F006 配方迭代刚需. |
| **F-VOUCHER-HOOK-1** | (BORROW_LIST F3 隐含 P3) | **P0 战略** | 实测 7 种凭证生成器 + vflag 状态机, 是任何业务单据 → 财务的桥梁. |

### §7.3 新增编号 — U 域 (8 项)

| 新编号 | 来源 | 项目名 | Priority | 工时 |
|---|---|---|---|---|
| **U-FEED-1** | R-HJ | 释放升级日志 in-app feed (10 条 release notes 推送) | P1 | 2d |
| **U-MARKER-1** | R-HJ | 订单标记 7 色 (灰红黄绿蓝紫白, 行级用户自定义) | P1 | 1d |
| **U-VIEW-1** | R-HJ | 列表 view 5 模式切换 (标准/简易1/简易2/一维/二维) | P1 | 3d |
| **U-NEW-1** | R-HJ | 创建 4 模式 dropdown (普通/一维/二维/**BOM 展开**) | P1 | 4d |
| **U-ICON-1** | R-HJ | 行内 7 icon 工具集 (二维码/锁库存/复制/操作日志/回款/打印/标记) | P1 | 3d |
| **U-DEPT-1** | R-HJ | 部门切换 button row UX (考勤页 7 部门快捷切换) | P1 | 1d |
| **U-DOUBLECHIP-1** | R-HJ | 双 chip 加强可点性 (大小配对) | P2 | 0.5d |
| **U-CHIP-MULTI-1** | R-HJ | 行内多 chip 状态 (4 chip 垂直堆: 销售订单创建/进行中/未审核/未出库) | P1 | 1d |

### §7.4 新增编号 — W 域 (1 项)

| 新编号 | 来源 | 项目名 | Priority | 工时 |
|---|---|---|---|---|
| **W-CLASS-1** | R-HJ | 仓库分类枚举 10 类 (默认/样品/成品/半成品/原材料/辅材/报废/cable车间/FPC车间) | P1 | 1d |

### §7.5 新增编号 — S 域 (3 项)

| 新编号 | 来源 | 项目名 | Priority | 工时 |
|---|---|---|---|---|
| **S-LOCK-1** | R-HJ | 锁定/备货/缺料 3 维度 + 公式 (锁:0 备:1 缺:0 行内显示, 公式 缺=未出库-锁定-备货) | P0 | 1d |
| **S-CREDIT-1** | R-HJ | 客户信用管理 (信用额度+账期, 跟客户档案集成) | P2 | 5d |
| **S-OPP-1** | R-HJ | 商机管理 (lead/opportunity, 销售漏斗) | P2 | 8d |

### §7.6 新增编号 — P 域 (3 项)

| 新编号 | 来源 | 项目名 | Priority | 工时 |
|---|---|---|---|---|
| **P-NUCLEAR-1** | R-HJ | 核价单 (询价后定价审批, 三阶段询价→核价→采购) | P1 | 3d |
| **P-DRAFT-1** | R-HJ | 采购底稿状态 (草稿态明示, 不同于"未审核") | P1 | 1d |
| **P-IMPORT-1** | R-HJ | 采购类型 (正常采购 / 进口采购) | P1 | 1d |

### §7.7 新增编号 — M 域 (4 项)

| 新编号 | 来源 | 项目名 | Priority | 工时 |
|---|---|---|---|---|
| **M-WIP-1** | R-HJ | 在制品 (WIP) 状态管理 | P1 | 3d |
| **M-MATTREE-1** | R-HJ | 物料需求 tree 模式 (按分类展开, 多 SKU 场景) | P1 | 4d |
| **M-PREP-1** | R-HJ | 生产任务预备 (草稿态独立) | P1 | 2d |
| **M-DELIVERY-WARN-1** | R-HJ | 生产交货预警 dashboard (独立模块) | P1 | 3d |

### §7.8 新增编号 — Q 域 (3 项)

| 新编号 | 来源 | 项目名 | Priority | 工时 |
|---|---|---|---|---|
| **Q-MODE-1** | R-HJ | 全检/抽检 模式区分 (Q-TPL-1 增强) | P1 | 1d |
| **Q-RETURN-1** | R-HJ | 质检退回单 (退回采购/委外, 2 种) | P1 | 3d |
| **Q-9TYPE-1** | R-HJ | 9 类质检单据按来源分 (来料/过程/完工/委外/退回各分) | P2 | 4d |

### §7.9 新增编号 — H 域 (1 项)

| 新编号 | 来源 | 项目名 | Priority | 工时 |
|---|---|---|---|---|
| **H-DEPT-SWITCH-1** | R-HJ | 部门切换 button row (考勤页 7 部门快捷, 通用 UX) | P1 | (含在 U-DEPT-1) |

### §7.10 新增编号 — C 域 (5 项)

| 新编号 | 来源 | 项目名 | Priority | 工时 |
|---|---|---|---|---|
| **C-LINKARRAY-1** | R-HJ | linkListArray 跨业务关联 (8 类枚举: sale/sample/request/produce/outsource/stock/project/free) | P0 | 2d |
| **C-PRT-EDITOR-1** | R-HJ | C-PRT-1 前端 (打印模板可视化设计器, 配套 P0) | P0 | 10d |
| **C-APPROVAL-EDITOR-1** | R-HJ | C-APPROVAL-1 前端 (工作流可视化拖拽编辑器, 配套 P0) | P0 | 15d |
| **C-WF-RULE-1** | R-HJ | 流转规则引擎 (金额/部门/角色阈值, 配套 C-APPROVAL) | P1 | 8d |
| **C-OPINION-1** | R-HJ | 节点意见模板 (设置常用语库) | P1 | 2d |
| **C-VOUCHER-TPL-1** | R-HJ | 凭证模板系统 (保存为模板 + 一键生成) | P1 | 5d |
| **C-RELEASE-1** | R-HJ | 升级日志 in-app feed framework (跟 U-FEED-1 配套后端) | P1 | 1d |

### §7.11 P2 战略级新增编号

| 新编号 | 来源 | 项目名 | Priority | 工时 |
|---|---|---|---|---|
| **F-VOUCHER-2-1** | R-HJ | 复式记账凭证 (Voucher + VoucherEntry, 中国会计准则) | P2 | 15-20d |
| **F-PERIOD-1** | R-HJ | 期间结账 (月结/年结 + 锁定) | P2 | 8d |
| **F-3REPORT-1** | R-HJ | 报表三表 (资产负债/损益/现金流自动) | P2 | 12d |
| **C-CUSTOM-1** | R-HJ | 资料定制 (字段/公式 客户自定义) | P2 | 20d+ |

### §7.12 v1.1 增量统计

| 类别 | 数量 | 工时 |
|---|---|---|
| 新增 P0 战略 | 3 (F-VFLAG-1 / S-LOCK-1 / C-LINKARRAY-1) + 2 升级 (M-BOM-VER-1, F-VOUCHER-HOOK-1) | ~15d |
| 新增 P0 配套 | 2 (C-APPROVAL-EDITOR-1 / C-PRT-EDITOR-1) | 25d |
| 新增 P1 战术 | 18 项 (U/W/S/P/M/Q/C 各域) | ~52d |
| 新增 P2 选做 | 4 项 (大客户场景) | 55-65d |
| **合计** | **+27 项 / +147-167d** | (其中 ~132d 是 R-HJ-08-AUGMENT.md 已估, 多出 15-35d 是 §7 进一步细化) |

### §7.13 §3 速查表更新

§3 各域速查 (新增条目):

- §3.1 销售域 (15 → 18): + S-LOCK-1 / S-CREDIT-1 / S-OPP-1
- §3.2 采购域 (14 → 17): + P-NUCLEAR-1 / P-DRAFT-1 / P-IMPORT-1
- §3.3 生产域 (19 → 23): + M-WIP-1 / M-MATTREE-1 / M-PREP-1 / M-DELIVERY-WARN-1
- §3.4 库存域 (14 → 15): + W-CLASS-1
- §3.5 财务域 (10 → 14): + F-VFLAG-1 / F-VOUCHER-2-1 / F-PERIOD-1 / F-3REPORT-1
- §3.7 质检域 (6 → 9): + Q-MODE-1 / Q-RETURN-1 / Q-9TYPE-1
- §3.8 通用域 (22 → 29): + C-LINKARRAY-1 / C-PRT-EDITOR-1 / C-APPROVAL-EDITOR-1 / C-WF-RULE-1 / C-OPINION-1 / C-VOUCHER-TPL-1 / C-RELEASE-1 / C-CUSTOM-1
- §3.9 UI/UX 域 (28 → 36): + U-FEED-1 / U-MARKER-1 / U-VIEW-1 / U-NEW-1 / U-ICON-1 / U-DEPT-1 / U-DOUBLECHIP-1 / U-CHIP-MULTI-1

**总计: 95 → 122 独立条目** (+27 项, R-HJ audit 增量)

### §7.14 关键升级 — M-BOM-VER-1 详细 amend

原 NUMBERING_MAP §2.3 M 域:
```
| M-BOM-VER-1 | — | N35 | M9 | 工程 BOM 版本管理 (BomChangeLog 仅日志, 无 BomVersion 实体) | P3 | ❌ |
```

**升级为**:
```
| M-BOM-VER-1 | — | N35 | M9 | 工程 BOM 版本管理 (BOMID 独立 + 版本号 + 工作流状态 + ECN 变更) | **P0** (R-HJ 实测确认) | ❌ |
```

**M-BOM-VER-1 升级后工作量**:
- 5d (BOM 实体独立化)
- 5d (ECN 变更单 + 审批 + 影响范围 + 通知列表)
- 1d (列表汇总列: 工序数/物料数)
- 2d (4 批量操作: 修改/替换/删除/新增)
- 2d (BOM 反查: 物料 → BOM list)
- = 15d 总计 (vs 原 P3 估 0d)

---

## §8 文档地图更新 (v1.1)

```
NUMBERING_MAP.md  ← 编号权威表 (本文件, v1.1)
    ↓ 被引用
00-MASTER-PLAN-v2.md §5.1, §9.1 (已用 11 个新号, 必保持一致)
04-最终决策/MUST_COPY.md (待 N# 重编 → 本文件已 cover, **+22 增量 v1.1**)
03-审计过程/FINAL_A_NEEDS_VS_CRETAS.md (47 条客户需求)
03-审计过程/BORROW_LIST.md (71 项竞品借鉴)
04-最终决策/UX_BORROW.md (23 项 UX 模式)
06-宏见测试账号深度审计/ ⭐ NEW (2026-05-15 R-HJ audit, 35 文档 + 26 截图)
    ↓ 源数据
docs/会议内容/客户会议/ (4 次会议 + 全流程文档原始证据)
```

---

## §9 R-HJ Round 2-9 终极整合增量 (2026-05-15, v1.2)

> **来源**: `06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md` (Round 9 累计)
>
> **背景**: §7 (v1.1) 涵盖 R-HJ Round 1 (~22 编号). Round 2-9 又新增 ~33 编号, 现在总 IDs 累计 **128+ 独立条目** (业务 ~95 + UX ~33).
>
> **维护规则不变**: 一个项目对应一个编号, 旧号保留历史追溯.

### §9.1 新增编号 — S 域 Round 2-9 (11 项)

| 新编号 | 项目名 + 简要 | Priority | Status | 工时 | 来源 |
|---|---|---|---|---|---|
| **S-CRM-FULL-1** | Customer 扩展 22 字段 (税号/法人/客户状态11/重要程度4) | P1 | ❌ | 5d | R-HJ Round 4 |
| **S-CUSTOMER-TAB-1** | 客户档案 21 跟踪 tab (跟踪/微信/通话/谈话录音/邮件) | P1 | ❌ | 15d | R-HJ Round 4 |
| **S-CREDIT-1** | 客户信用管理 (额度+账期) | P2 | ❌ | 5d | R-HJ Round 1 |
| **S-INVOICE-CLIENT-1** | 客户级开票税率 17 档 + 发票类型 6 档 (含数电票) | P1 | ❌ | 2d | R-HJ Round 4 |
| **S-PROFIT-DETAIL-1** | 产品级销售利润详情页 (11 列) | P1 | ❌ | 2d | R-HJ Round 4 |
| **S-REMIND-1** | 收款提醒 → OA 任务集成 | P1 | ❌ | 3d | R-HJ Round 4 |
| **S-NEED-1** | 销售需求独立模块 | P1 | ❌ | 5d | R-HJ Round 7 |
| **S-PAYMENT-DATE-1** | 客户级对账日期 (1-31 号) | P1 | ❌ | 1d | R-HJ Round 4 |
| **S-REPORTS-PRESETS** | 销售 14+ 预置报表模板 | P1 | ❌ | 8d | R-HJ Round 5 |
| **S-SOURCE-1** | 客户来源 11 渠道分类 | P1 | ❌ | 1d | R-HJ Round 4 |
| **S-VIP-1** | VIP 4 分级 (含重要程度枚举) | P1 | ❌ | 1d | R-HJ Round 4 |
| **S-OPP-1** | 商机管理 (lead/opportunity 漏斗) | P2 | ❌ | 8d | R-HJ Round 5 |
| **S-COMPLAINT-1** | 售后服务投诉 12 字段 | P2 | ❌ | 4d | R-HJ Round 8 |
| **S-COMMISSION-1** | 合作伙伴佣金报表 (12 月统计) | P2 | ❌ | 5d | R-HJ Round 8 |
| **S-CALL-STAT-1** | 外呼通话统计 (15s/30s/60s/120s 多档) | P2 | ❌ | 8d | R-HJ Round 8 (需云硬件) |
| **S-STORE-REPLEN-1** | 门店补货 10 列 | P2 | ❌ | 5d | R-HJ Round 5 |

### §9.2 新增编号 — M 域 Round 2-9 (4 项)

| 新编号 | 项目名 | Priority | Status | 工时 | 来源 |
|---|---|---|---|---|---|
| **M-WP-CONDITION-1** | 工序条件路由 (材质=不锈钢→工序A) | P1 | ❌ | 5d | R-HJ Round 5 (engineering 子菜单) |
| **M-TECHNOLOGY-1** | 作业指导书 (数字化 SOP) | P1 | ❌ | 8d | R-HJ Round 5 |
| **M-APS-1** | 高级排产 (auto + 历史 + 派工 6 项) | P2 | ❌ | 15d | R-HJ Round 5 (生产 109 项里) |
| **M-MOULD-1** | 模具完整生命周期 (13 项) | P3 | ❌ | 12d | R-HJ Round 5 (mould 独立子域) |

### §9.3 新增编号 — Q 域 Round 2-9 (1 项)

| 新编号 | 项目名 | Priority | Status | 工时 | 来源 |
|---|---|---|---|---|---|
| **Q-PROCESS-1** | 工序质检不良 + 失败原因 + 处理结果闭环 | P1 | ❌ | 5d | R-HJ Round 5 (ProcedureQuality 独立子域 27 项) |

### §9.4 新增编号 — H 域 Round 2-9 (3 项, FULL 后缀变体)

| 新编号 | 项目名 | Priority | Status | 工时 | 来源 |
|---|---|---|---|---|---|
| **H-WAGE-FULL** | 工资管理 11 项 (社保/专项扣除/年度) | P1 | ❌ | 10d | R-HJ Round 5 (hr 76 项展开) |
| **H-ATT-FULL** | 考勤管理 11 项 (高级排班/异常分析) | P1 | ❌ | 10d | R-HJ Round 5 |
| **H-PARTNER-FULL** | 合作伙伴 4 项佣金管理 | P2 | ❌ | 5d | R-HJ Round 5 (代理/分销) |

注: `-FULL` 后缀表示"展开/完整版" — 跟同子域 `-1` 后缀的精简版并存. 例 `H-WAGE-FULL` (11 项) ≠ 隐含的 `H-WAGE-1` (M域 M-WAGE-1 单点计件).

### §9.5 新增编号 — C 域 Round 2-9 (15 项)

| 新编号 | 项目名 | Priority | Status | 工时 | 来源 |
|---|---|---|---|---|---|
| **C-CHECKPOWER-1** | RBAC 权限检查统一函数 (跟 jsonArray 1591 权限点配套) | P1 | ❌ | 3d | R-HJ Round 5 |
| **C-WF-RULE-1** | 流转规则引擎 (金额/部门/角色阈值) | P1 | ❌ | 10d | R-HJ Round 1 (已 §7 但同名 8d, v1.2 统一为 10d) |
| **C-WF-VAR-1** | 工作流系统变量库 ({#own}, 业务变量) | P1 | ❌ | 3d | R-HJ Round 4 |
| **C-LOG-AUDIT-1** | 系统操作日志独立子菜单 (5 列 + 查询导出) | P1 | ❌ | 3d | R-HJ Round 8 (log.hongjian.com) |
| **C-EXPORT-CENTER-1** | 数据导出规则中心 (跨 12 模块) | P1 | ❌ | 5d | R-HJ Round 8 (export.hongjian.com) |
| **C-IMPORT-CENTER-1** | 数据导入规则中心 (含校验/未导入/成功/失败) | P1 | ❌ | 5d | R-HJ Round 8 (import.hongjian.com) |
| **C-WIDGET-1** | dashboard 卡片插件式 (10 独立 endpoint 渲染) | P1 | ❌ | 5d | R-HJ Round 4 |
| **C-INLINE-CS-1** | 在线客服 iframe | P1 | ❌ | 1d | R-HJ Round 4 |
| **C-CRM-FULL** | 客户 50 项含商机 3 / 报表 6 / 资料定义 6 | P2 | ❌ | 15d | R-HJ Round 5 |
| **C-STORE-1** | 门店管理 5 子项 (餐饮 QHJ 升级) | P2 | ❌ | 5d | R-HJ Round 5 |
| **C-IMAGE-LIB-1** | 公共图片库 (跨企业共享) | P2 | ❌ | 3d | R-HJ Round 7 (publicimage.hongjian.com) |
| **C-FILE-DOMAIN-1** | 文件管理独立子域 | P2 | ❌ | 3d | R-HJ Round 7 (file.hongjian.com) |
| **C-TV-DASHBOARD-1** ⭐⭐⭐ | TV 大屏 Android app (HoanTV.apk 对照, 跟 SmartBI 集成) | P3 | ❌ | 15d | R-HJ Round 7 |
| **C-MENU-ENGINE-1** | menu.jsp?m=X 配置驱动菜单架构 | P3 | ❌ | 8d | R-HJ Round 5 (681 menu source) |
| **C-RBAC-FNO-1** | 细粒度 f_no 权限点 (1591 个) | P3 | ❌ | 15d | R-HJ Round 5 (jsonArray) |
| **C-MICROSERVICE-1** | 38 子域微服务架构 (Cretas 当前 monolith) | P3 战略 | ❌ | 长期 | R-HJ Round 7 (41 子域 mapping) |
| **C-WECHAT-DOMAIN-1** | 微信子域独立 (weixin.hongjian.com) | P3 | ❌ | 5d | R-HJ Round 8 (F006 用钉钉, 暂不需) |
| **C-PARTNER-DOMAIN-1** | 合作伙伴管理独立子域 | P3 | ❌ | 3d | R-HJ Round 5 |
| **C-DOCS-DOMAIN-1** | help.cretas.com 独立 docs 子域 | P3 | ❌ | 5d | R-HJ Round 7 |
| **C-SERVICE-CODE-1** | 服务代码显示 (footer small, 客户报问题方便) | P3 | ❌ | 0.5d | R-HJ Round 6 |

### §9.6 新增编号 — U 域 Round 2-9 (1 项)

| 新编号 | 项目名 | Priority | Status | 工时 | 来源 |
|---|---|---|---|---|---|
| **U-DESKTOP-MODAL-1** | layui-layer 桌面级 modal (4 操作: 最小化/最大化/拉伸/关闭) | P1 | ❌ | 3d | R-HJ Round 2 用户视角 |

### §9.7 编号统计累计 (v1.0 → v1.2)

| 版本 | 业务编号 | UX 编号 | 总计 | 工时 nominal |
|---|---|---|---|---|
| v1.0 (2026-05-14) | ~67 | ~28 | **~95** | ~84d (MUST_COPY 33 项) |
| v1.1 (R-HJ Round 1) | +14 | +8 | **+22 / 117 total** | +132d → 241d |
| **v1.2 (R-HJ Round 2-9)** | **+33** | **+1** | **+34 / 151 total** | **+157d → 429d nominal / 258d Claude** |

### §9.8 §3 速查表更新建议

各 §3.x 子域应追加上述新编号. 维护责任: MO 在 Sprint 0 末统一回填 §3 速查表 (本附录已包含 detail, §3 仅简单逗号 list 即可).

### §9.9 维护历史扩展

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-05-15 | v1.2 | **R-HJ Round 2-9 终极整合** (+33 业务 + 1 UX = +34 编号 / +157d). 总 151 编号 / 88 项 / 429d nominal / 258d Claude 加速. authoritative source: `06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md`. |

### §9.10 v1.2 决策清单

- ✅ S 域 +16 项 (CRM 扩展 11 + 大销售 5)
- ✅ M 域 +4 项 (工序条件 / SOP / APS / 模具)
- ✅ Q 域 +1 (工序质检闭环)
- ✅ H 域 +3 (FULL 后缀变体: 工资/考勤/合作伙伴)
- ✅ C 域 +20 (系统/平台战略级 15 + 配置中台 5)
- ✅ U 域 +1 (桌面级 modal)
- ⚠️ S-NEED-1 / S-OPP-1 编号确认无冲突 (子域 NEED / OPP 全新)
- ⚠️ C 域子域 BOARD (C-WIDGET-1) / STORE / EXPORT / IMPORT / IMAGE-LIB / FILE-DOMAIN / TV-DASHBOARD / MENU-ENGINE / RBAC-FNO / MICROSERVICE / WECHAT-DOMAIN / PARTNER-DOMAIN / DOCS-DOMAIN / SERVICE-CODE — 全新子域名, 跟 §1 通用平台子域举例兼容
- ⚠️ H-PARTNER-FULL — 合作伙伴本应归 C-PARTNER-DOMAIN-1 但宏见在 hr 子域下, 跟原归类保持; 客户视角可能两个都需要

---

**v1.1 (R-HJ Round 1) → v1.2 (R-HJ Round 2-9 终极整合) 完成 (2026-05-15)**.
