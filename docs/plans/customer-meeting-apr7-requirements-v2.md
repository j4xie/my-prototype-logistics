# 客户需求 v2 — 画布配置驱动的工厂适配方案

**版本**: v2.0
**更新日期**: 2026-04-07
**前置版本**: `customer-meeting-apr7-requirements.md` (v1)
**核心变化**: 将所有需求按"工厂通用必改 / 画布可配置 / 工厂自定义"三类重新归类，并对接现有画布/AI Tool/Skill 系统

---

## 0. v2 核心理念

**v1 的问题**: v1 把六扇门客户的需求当作"统一改造方案"，但现实是**每个工厂的需求都不一样**。如果硬编码六扇门的字段，下一个客户来又要改一遍。

**v2 的答案**:
> **客户需求 = 画布配置 × AI Tool 适配**

把所有可变的部分（字段、菜单、工作流、Tool 启用）下沉到**画布配置系统**，让每个工厂能通过画布自助配置；AI Tool 和 Skill 在执行时**读取当前工厂的画布配置**动态适配执行逻辑。

**三类需求**:
- 🔴 **A 类 = 工厂通用必改**: 所有工厂都需要的基础设施改造（数据模型/Bug 修复/共性功能）
- 🟡 **B 类 = 画布可配置（系统级模板）**: 平台预设模板，工厂可启用/调整
- 🟢 **C 类 = 工厂自定义（per-factory 配置）**: 工厂用画布自己配，平台不硬编码

---

## 1. 画布系统现状（基础事实）

### 1.1 已就绪 ✅

| 系统 | 状态 | 说明 |
|------|------|------|
| `LowcodePageConfig` | ✅ 工厂级 + 角色级 | 支持 (page_id, factory_id, role_code) 三维定制 |
| `FormTemplate` (Formily Schema) | ✅ 字段级配置 | factory_id + 版本管理 + AI 生成支持 |
| `FactoryFeatureConfig` | ✅ 模块开关 | enabled + 任意 JSON 配置 |
| `AIIntentConfig` | ✅ **已有 factory_id** | 工厂级意图-Tool 绑定就绪 |
| `Bom.bomStructure` (JSON) | ✅ 灵活结构 | 已支持原辅料包材分组 |
| 183 个实体 | ✅ factory_id 全覆盖 | 数据隔离基础完备 |
| `DynamicEntityForm.vue` | ✅ 已存在 | 但只在客户/产品页用 |
| `ToolExecutor.execute(context)` | ✅ 接收 factoryId | 但 ToolRegistry 全局注册 |

### 1.2 缺口 ❌

| 缺口 | 影响 | 优先级 |
|------|------|-------|
| **前端表单普遍硬编码** | 销售订单/采购订单/生产计划等页面字段写死，没接 FormTemplate API | P0 |
| **`SmartBiSkill` 无 factory_id** | Skill 全局共享，无法 per-factory 编排 | P1 |
| **`ToolRegistry` 无工厂启用/禁用** | 所有 Tool 全局可用 | P1 |
| **`FactoryFeatureConfig` 前端无 store** | 模块开关后端有，前端无机制读取 | P0 |
| **无 PageType.WORKFLOW** | 工作流编排页缺失 | P2 |
| **DynamicEntityForm 未接 FormTemplate API** | 组件就绪但未连接后端 | P0 |

---

## 2. 需求三类划分总览

### 2.1 🔴 A 类 — 工厂通用必改（硬编码改造，所有工厂受益）

| # | 需求 | 模块 | 改造范围 |
|---|------|------|---------|
| A1 | 销售订单同品项去重 | sales | 后端校验 + 前端过滤 |
| A2 | 销售订单"产品大类"真正隔离 | basic data | 后端 query 加 category 过滤 |
| A3 | 生产计划必须关联销售订单 | production | 实体加字段 + 必填校验 |
| A4 | PC (生产日期批次) 字段强制 | warehouse / batch | 实体加 `pc_code` + 出库带 PC |
| A5 | 入库必须有发起单 | warehouse | 后端权限拦截 + UI 引导 |
| A6 | 销售订单成为业务中心（开票/出库/收款/采购全联动） | sales | 详情页加 4 个 tab 组件 |
| A7 | 物料消耗追踪（报工时记录原料用量） | production | ProductionReport 加 material_consumption 子表 |
| A8 | 主原料定点追踪（采购单关联销售单） | purchase | PurchaseOrder 加 sales_order_id |
| A9 | 双仓体系（物流仓+车间仓） | warehouse | Warehouse 加 type 字段 + 调拨规则 |
| A10 | 销售订单状态字段补齐（收款/开票/运输状态） | sales | 实体加 3 个状态字段 |
| A11 | 出库批次多选（凑货） | warehouse | 出库单明细支持 1 产品 N 批次 |
| A12 | 收款多次记录（定金+尾款） | finance | PaymentRecord 已有，UI 联动 |

### 2.2 🟡 B 类 — 画布可配置（系统级模板，平台预设 6 套食品工厂模板）

| # | 模板名 | 涉及模块 | 配置形式 |
|---|--------|---------|---------|
| B1 | "熟食加工厂"模板 | 全局 | FactoryFeatureConfig 预设 + FormTemplate 预设 |
| B2 | "鲜肉切割厂"模板 | 全局 | 同上 |
| B3 | "海鲜冷冻厂"模板 | 全局 | 同上 |
| B4 | "调味品工厂"模板 | 全局 | 同上 |
| B5 | "中央厨房"模板 | 全局 | 同上 |
| B6 | "通用食品厂"模板 | 全局 | 同上 |

每套模板包含: 默认菜单结构 + 默认表单字段 + 默认 BOM 结构 + 默认 AI 意图绑定 + 默认 Skill 编排

### 2.3 🟢 C 类 — 工厂自定义（per-factory 画布配置）

| # | 可配置项 | 配置入口 | 配置存储 |
|---|---------|---------|---------|
| C1 | 销售订单字段（显隐/必填/默认值） | 画布 PageType.FORM 编辑器 | FormTemplate (entityType=SALES_ORDER) |
| C2 | 研发样品字段 | 画布 FORM 编辑器 | FormTemplate (entityType=RD_SAMPLE) |
| C3 | BOM 字段 | 画布 FORM 编辑器 | FormTemplate (entityType=BOM) |
| C4 | 模块菜单显隐 | 画布 LIST/DASHBOARD 编辑器 | LowcodePageConfig + FactoryFeatureConfig |
| C5 | 工序定义 (工序大类+单位) | 基础数据维护页 | ProcessStep + ProcessCategory 表 (已有 factory_id) |
| C6 | 报工流程定制（按工序 / 按产品 / 按批次） | 画布 WORKFLOW 编辑器（待新增） | LowcodePageConfig.config (JSON) |
| C7 | AI 意图 → Tool 绑定 | 系统管理 → AI意图配置 | AIIntentConfig (已 per-factory) |
| C8 | 工厂特色 Skill 编排 | 系统管理 → Skill 配置 | SmartBiSkill (待加 factory_id) |
| C9 | 仪表板布局（首页快捷入口） | 画布 DASHBOARD 编辑器 | LowcodePageConfig (page_id=home) |
| C10 | 每个角色的菜单可见性 | 画布按 role_code 配 | LowcodePageConfig (role_code 维度) |

---

## 3. 详细需求 — 按模块拆解（v1 内容 + v2 配置化设计）

### 3.1 研发样品 — [04:20 - 17:00]

#### 🔴 必改 (A 类)

| # | 改动 | 理由 |
|---|------|------|
| A1.1 | 实体添加追踪记录子表 `RDSampleTrackingRecord` | 客户必需，所有食品厂都要 |
| A1.2 | 添加 `转化至成品库` 动作 → 自动创建 BOM 记录 | 业务闭环必需 |

#### 🟡 系统模板 (B 类)

平台预设模板里，研发样品默认字段:
- 业务员、客户期望价格、样品编码、样品名称、成品规格
- 产品级别(A/B/C)、产品状态、研发状态、储存方式
- 关联客户、客户性质
- 客户最新要求、样品图片

#### 🟢 工厂可配 (C 类)

工厂可以通过画布自由调整：
- 添加/删除字段（如：海鲜厂可加"温区"字段，调味品厂可加"配方等级"）
- 字段必填规则
- 字段下拉选项（如"研发状态"可定义自己的枚举）
- 字段显隐条件（如"产品级别=A"时显示某些额外字段）
- 追踪记录的字段集

**画布扩展点**: `FormTemplate(entityType="RD_SAMPLE", factory_id=...)` 已就绪，前端 `RDSampleForm.vue` 需改造为 `<DynamicEntityForm entityType="RD_SAMPLE" />`

#### AI Tool 适配 (跨A/B/C)

```java
@Component
public class RDSampleCreateTool extends AbstractBusinessTool {
    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) {
        // 1. 读取该工厂的 FormTemplate (RD_SAMPLE)
        FormTemplate tmpl = formTemplateService.getByFactoryAndEntity(factoryId, "RD_SAMPLE");

        // 2. 用模板验证 params (按 schema 校验必填/类型/枚举)
        formValidator.validate(params, tmpl.getSchema());

        // 3. 创建实体（动态字段写入 metadata JSON 列）
        RDSample sample = rdSampleService.createWithDynamicFields(factoryId, params);
        return buildSimpleResult("研发样品已创建", sample);
    }
}
```

---

### 3.2 BOM / 报模 — [17:00 - 28:00]

#### 🔴 必改 (A 类)

| # | 改动 |
|---|------|
| A2.1 | BOM 物料表前端拆 3 块（原料/辅料/包材 3 个 tab） |
| A2.2 | BOM 头部添加"出成率(总体)"字段（不再按物料拆分出成率） |
| A2.3 | BOM 实体添加 `BomTrackingRecord` 子表（物料变更痕迹） |
| A2.4 | 物料表添加 `material_type` 枚举: RAW(原料)/AUXILIARY(辅料)/PACKAGING(包材)/SEASONING(调味品) |
| A2.5 | 多税率支持: BOM 行的税率由 `material_type` 决定 (原料 9%, 辅料/包材 13%) |

#### 🟡 系统模板 (B 类)

平台预设的 BOM 结构:
```yaml
bom_template:
  header_fields: [is_active, bom_type, customer, owner, product, unit, prices, total_yield, tax_rate]
  material_groups:
    - type: RAW         # 原料 (主料)
      tax_rate_default: 9
    - type: AUXILIARY   # 辅料
      tax_rate_default: 13
    - type: PACKAGING   # 包材
      tax_rate_default: 13
  labor_section: { enabled: true, custom_processes_allowed: true }
  overhead_section: { enabled: true, items: [房租, 水电, 燃气, 毛利, 运费] }
```

#### 🟢 工厂可配 (C 类)

- 工厂可以**新增物料分组**（如调味品厂多加一组"调味料"）
- 每个分组可定义自己的字段集（如包材组可加"印刷版费"字段）
- 工艺成本部分可自定义工序模板
- 均摊费用项可增删

**画布扩展点**: `FormTemplate(entityType="BOM", factory_id=...)` 的 schema 支持嵌套数组结构。

#### AI Tool 适配

```java
public class BomCreateTool extends AbstractBusinessTool {
    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) {
        FormTemplate tmpl = formTemplateService.getByFactoryAndEntity(factoryId, "BOM");
        // tmpl.schema 定义了该工厂的 material_groups 结构
        // 如果是六扇门，包含 RAW + AUXILIARY + PACKAGING 三组
        // 如果是调味品厂，可能多一组 SEASONING

        Map<String, List<MaterialEntry>> grouped = parseGroupedMaterials(params, tmpl);

        Bom bom = bomService.createWithGroupedMaterials(factoryId, grouped);

        // 自动计算各组小计 + 总成本
        bomCostCalculator.recalc(bom);

        return buildSimpleResult("BOM已创建", bom);
    }
}
```

---

### 3.3 销售订单 — [31:00 - 49:30]

#### 🔴 必改 (A 类)

| # | 改动 |
|---|------|
| A3.1 | 订单明细字段补全 (specification/box_quantity/unit_price 自动带出) ✅ 部分已做 |
| A3.2 | 同产品在同订单不允许重复（前后端校验） |
| A3.3 | 销售订单详情页改造为"业务中心"，加 4 个 tab: 开票申请 / 销售出库 / 收款单 / 采购订单 |
| A3.4 | 订单状态字段补齐: `payment_status` / `invoice_status` / `delivery_status` |
| A3.5 | 订单金额按状态联动: 未出库显示订单金额 / 出库后显示出库金额 |
| A3.6 | 列表页加 6 个智能筛选 tab: 未出库 / 部分出库 / 未收款 / 部分收款 / 已完成 / 全部 |

#### 🟡 系统模板 (B 类)

平台预设销售订单标准字段:
```yaml
sales_order_template:
  header_fields:
    - 订单号(自动) | 客户(去 UUID) | 销售员
    - 联系方式(可选) | 预计交货日期 | 订单备注
    - 是否含运费 | 运费 | 其他附加费用
  item_fields:
    - 产品 | 规格 | 数量 | 单位 | 单价 | 折扣 | 箱数 | 备注
  附件: 预订合同PDF
  状态字段: payment_status / invoice_status / delivery_status
```

#### 🟢 工厂可配 (C 类)

- 添加自定义字段（餐饮厂: "预订餐数", 海鲜厂: "活鲜温区"）
- 字段必填规则
- 字段是否参与去重校验
- 列表页列显隐
- 智能筛选 tab 自定义

**画布扩展点**:
- `FormTemplate(entityType="SALES_ORDER")` — 表单字段
- `LowcodePageConfig(page_id="sales_order_list", page_type=LIST)` — 列表配置
- `LowcodePageConfig(page_id="sales_order_detail", page_type=DETAIL)` — 详情页 tab 配置

#### AI Tool 适配

```java
public class SalesOrderCreateTool extends AbstractBusinessTool {
    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) {
        FormTemplate tmpl = formTemplateService.getByFactoryAndEntity(factoryId, "SALES_ORDER");

        // 校验通用必改逻辑：同产品去重
        validateNoDuplicateProducts(params.get("items"));

        // 校验工厂自定义字段
        formValidator.validate(params, tmpl.getSchema());

        SalesOrder order = salesOrderService.createWithDynamicFields(factoryId, params);

        // 自动初始化三种状态
        order.setPaymentStatus(PaymentStatus.PENDING);
        order.setInvoiceStatus(InvoiceStatus.PENDING);
        order.setDeliveryStatus(DeliveryStatus.PENDING);

        return buildSimpleResult("销售订单已创建", order);
    }
}
```

---

### 3.4 生产计划 + 报工 — [64:00 - 82:00]

#### 🔴 必改 (A 类)

| # | 改动 |
|---|------|
| A4.1 | `ProductionPlan` 加 `sales_order_id` 字段（必填）+ `sales_order_item_id` |
| A4.2 | `ProductionReport` 加 `material_consumption` 子表（记录原料实际用量） |
| A4.3 | `ProductionReport` 加 `production_date` 作为 PC 批次 |
| A4.4 | `ProductionReport` 加 `output_pc_code`（自动生成 PC 编码） |
| A4.5 | 报工支持累积上报（多次报工，accumulate quantity） |
| A4.6 | 工序认领模式（去除强制指派主管） |

#### 🟡 系统模板 (B 类)

平台预设生产报工模板（**关键设计**: 支持 3 种报工模式）:

```yaml
production_report_modes:
  mode_1_per_process:
    name: "按工序报工"
    description: "工序为最小单位，一个工序一个报工记录"
    use_case: "六扇门食品（无固定产线）"
    fields:
      - process_id, output_qty, material_consumption[], pc_code, work_minutes

  mode_2_per_product:
    name: "按产品报工"
    description: "整批产品做完一次性报工"
    use_case: "标品工厂"
    fields:
      - product_id, output_qty, total_material[], pc_code

  mode_3_per_batch:
    name: "按批次报工"
    description: "MES 风格，按生产批次累积"
    use_case: "饮料厂、调味品厂"
    fields:
      - batch_id, hourly_outputs[], material_consumption[]
```

#### 🟢 工厂可配 (C 类)

- 工厂选择哪种报工模式（mode_1/2/3）
- 自定义工序列表
- 自定义工序组（按车间分组）
- 是否启用扫码工人签到
- 是否启用拍照凭证

**画布扩展点**:
- `FactoryFeatureConfig(module_id="production_report")` 存模式选择
- `FormTemplate(entityType="PRODUCTION_REPORT")` 存字段定制

#### AI Tool 适配

```java
public class ProductionReportSubmitTool extends AbstractBusinessTool {
    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) {
        // 读取该工厂的报工模式
        FactoryFeatureConfig cfg = featureConfigService.get(factoryId, "production_report");
        String mode = (String) cfg.getConfig().get("mode");

        switch (mode) {
            case "mode_1_per_process":
                return reportPerProcess(factoryId, params);
            case "mode_2_per_product":
                return reportPerProduct(factoryId, params);
            case "mode_3_per_batch":
                return reportPerBatch(factoryId, params);
        }
    }

    private Map<String, Object> reportPerProcess(String factoryId, Map<String, Object> params) {
        // 六扇门模式：按工序累积
        ProductionReport report = productionReportService.createOrAccumulate(
            factoryId,
            (String) params.get("process_id"),
            new BigDecimal((String) params.get("output_qty")),
            params.get("material_consumption")
        );
        return buildSimpleResult("报工成功", report);
    }
}
```

---

### 3.5 仓库管理 — [82:00 - 85:00]

#### 🔴 必改 (A 类)

| # | 改动 |
|---|------|
| A5.1 | `Warehouse` 实体加 `warehouse_type` 枚举: LOGISTICS(物流仓) / WORKSHOP(车间仓) |
| A5.2 | 入库单类型枚举: PURCHASE / SALES_RETURN / GIFT / TRANSFER / STOCKTAKING |
| A5.3 | 入库权限拦截: 非 STOCKTAKING 类型必须有 `source_doc_id` |
| A5.4 | `MaterialBatch` 加 `pc_code`（生产日期批次）+ `production_date` |
| A5.5 | 出库单 FIFO 推荐: 自动按 `production_date` 升序建议批次 |
| A5.6 | 车间仓"当天清仓"定时任务（晚上自动把剩料退回物流仓） |

#### 🟡 系统模板 (B 类)

平台预设 3 种仓库布局:
```yaml
warehouse_topologies:
  single:
    name: "单仓"
    description: "小厂，所有物料一个仓"

  dual:
    name: "双仓 (物流+车间)"
    description: "六扇门模式：物流仓长期存储，车间仓当天清仓"
    auto_clear: true
    clear_time: "20:00"

  multi:
    name: "多仓 (按物料类型)"
    description: "原料仓 + 辅料仓 + 包材仓 + 成品仓 + 车间仓"
```

#### 🟢 工厂可配 (C 类)

- 选择仓库拓扑（single/dual/multi）
- 自定义仓库列表
- 配置自动清仓时间
- 配置 FIFO 严格模式（强制 vs 建议）
- 自定义入库单类型

#### AI Tool 适配

```java
public class WarehouseInboundTool extends AbstractBusinessTool {
    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) {
        // 读取工厂仓库拓扑
        FactoryFeatureConfig cfg = featureConfigService.get(factoryId, "warehouse");
        String topology = (String) cfg.getConfig().get("topology");

        // 读取入库类型
        String inboundType = (String) params.get("type");

        // 校验：非盘点必须有 source_doc_id
        if (!"STOCKTAKING".equals(inboundType) && params.get("source_doc_id") == null) {
            throw new BusinessException("入库必须有发起单（采购单/退货单/赠品单等）");
        }

        InboundRecord record = warehouseService.inbound(factoryId, params);

        // 自动生成 PC 批次
        record.setPcCode(generatePcCode(record.getProductionDate()));

        return buildSimpleResult("入库成功", record);
    }
}
```

---

### 3.6 采购订单 — [49:30 - 52:00]

#### 🔴 必改 (A 类)

| # | 改动 |
|---|------|
| A6.1 | `PurchaseOrder` 加 `sales_order_id`（可选关联） |
| A6.2 | 主原料定点追踪报表: 哪批料用到哪个销售订单 |
| A6.3 | "防多采"提醒: 关联销售订单后，超量采购警告 |

#### 🟢 工厂可配 (C 类)

- 哪些物料类型必须关联销售订单（默认: RAW + 单价>X的物料）
- 多采阈值百分比（默认 10%）
- 采购单字段定制

---

### 3.7 开票申请 + 收款 — [52:00 - 60:00]

#### 🔴 必改 (A 类)

| # | 改动 |
|---|------|
| A7.1 | `InvoiceApplication` 实体已有，需补审批流 + 上传发票 PDF 字段 |
| A7.2 | 申请单按税率自动分组（9% 原料 / 13% 加工费） |
| A7.3 | 客户开票资料自动带出 |
| A7.4 | `PaymentRecord` 已有，UI 联动到销售订单详情页 |

#### 🟢 工厂可配 (C 类)

- 财务审批节点数（1级/2级/3级审批）
- 多账户配置
- 收款类型（预付/月结/分批）

---

### 3.8 基础数据 — [28:00 - 31:00]

#### 🔴 必改 (A 类)

| # | 改动 |
|---|------|
| A8.1 | 产品大类查询过滤 bug 修复（选成品别看到原料） |
| A8.2 | 产品大类按 `category` 字段做严格隔离 |

#### 🟢 工厂可配 (C 类)

- 产品大类列表自定义（系统默认: 成品/原料/辅料/包材/调味品/半成品）
- 每类显示哪些字段（C1-C2 同款）

---

### 3.9 周转耗材 — [55:00 - 57:00]

#### 🟡 系统模板 (B 类) — 选用插件

把"周转筐管理"做成**可启用插件**:
```yaml
rental_module:
  enabled_for: ["六扇门", "其他需要周转筐的工厂"]
  description: "周转筐借出/归还/赔偿管理"
  fields: [crate_id, customer, borrowed_qty, returned_qty, deposit, status]
```

工厂在 `FactoryFeatureConfig` 启用 `rental_module=true` → 销售订单自动出现"周转筐"区。

---

## 4. 画布配置扩展设计

### 4.1 现有 PageType 利用 + 扩展

| PageType | 现有 | 用途 | 改造 |
|----------|------|------|------|
| HOME | ✅ | 工厂首页 | 已支持，C9 用 |
| DASHBOARD | ✅ | 仪表板 | 已支持 |
| FORM | ✅ | 表单页 | **重点改造**：所有表单页统一接 DynamicEntityForm |
| LIST | ✅ | 列表页 | 加列显隐 + 智能筛选 tab 配置 |
| DETAIL | ✅ | 详情页 | 加 tab 联动配置（销售订单业务中心模式）|
| **WORKFLOW** | ❌ 新增 | 工作流编排 | P2 需求，做生产报工/审批流定制 |
| **REPORT** | ❌ 新增 | 自定义报表 | P2 需求，对接 SmartBI |

### 4.2 FormTemplate 扩展

现有 `FormTemplate` 已支持:
- factory_id + entityType + Formily Schema
- 版本管理 + 回滚

需要补充:
- entityType 枚举扩展: 加 `RD_SAMPLE`, `BOM`, `SALES_ORDER`, `PURCHASE_ORDER`, `PRODUCTION_PLAN`, `PRODUCTION_REPORT`, `INBOUND`, `OUTBOUND`, `INVOICE_APPLICATION`, `PAYMENT_RECORD`, `WAREHOUSE`...
- schema 支持 `material_groups` 嵌套结构（用于 BOM）
- schema 支持 `field_groups` 折叠分组
- schema 支持 `condition_show` 条件显示规则

### 4.3 SmartBiSkill 升级（必改）

```sql
-- 数据库迁移
ALTER TABLE smart_bi_skill ADD COLUMN factory_id VARCHAR(64);
ALTER TABLE smart_bi_skill ADD COLUMN version INT DEFAULT 1;
ALTER TABLE smart_bi_skill ADD COLUMN previous_snapshot JSONB;
CREATE INDEX idx_skill_factory ON smart_bi_skill(factory_id);
```

`SkillRegistry` 加载逻辑改造:
1. 全局 Skill (factory_id IS NULL) — 平台预设
2. 工厂 Skill (factory_id = current) — 工厂自定义
3. 同名时，工厂 Skill 覆盖全局

### 4.4 ToolRegistry 工厂适配（必改）

新增接口方法：

```java
public interface ToolExecutor {
    // 现有方法...

    // 新增
    default boolean isEnabledForFactory(String factoryId) {
        return true;  // 默认全工厂启用
    }

    default Map<String, Object> enrichParamsForFactory(
        String factoryId,
        Map<String, Object> params
    ) {
        return params;  // 默认不修改
    }
}
```

`ToolRegistry.getExecutor(name)` 改为 `getExecutorForFactory(name, factoryId)`，自动过滤禁用的 Tool。

### 4.5 AIIntentConfig 已就绪 ✅

直接使用现有 factory_id 字段实现工厂级意图绑定:
```sql
-- 六扇门工厂的"创建研发样品"意图
INSERT INTO ai_intent_config (factory_id, intent_code, intent_name, tool_name, keywords)
VALUES ('F006', 'RD_SAMPLE_CREATE', '创建研发样品', 'rd_sample_create_tool',
        '["新建样品","录入研发","新研发"]');

-- 普通工厂用通用 Tool
INSERT INTO ai_intent_config (factory_id, intent_code, intent_name, tool_name)
VALUES (NULL, 'RD_SAMPLE_CREATE', '创建研发样品', 'rd_sample_basic_create_tool');
```

---

## 5. 实施路线图

### Phase 1 — 基础配置化打通 (Week 1-2)

**目标**: 让画布系统真正可用，前端表单接入 FormTemplate

| Day | 任务 | 类型 |
|-----|------|------|
| 1-2 | 前端 `useFactoryFeatureStore` Pinia store | A |
| 2-3 | 销售订单 list.vue 改用 `<DynamicEntityForm entityType="SALES_ORDER">` | A |
| 3-4 | 完成 A1-A12 必改项（同步 v1 文档列表） | A |
| 5 | 平台预设 6 套食品工厂模板 (B1-B6) | B |
| 6-7 | FormTemplate API 完善 + 前端 schema 加载逻辑 | A |
| 8-10 | DynamicEntityForm 支持嵌套 material_groups 结构 | A |

### Phase 2 — AI Tool 工厂适配 (Week 3)

**目标**: Tool 和 Skill 能读工厂配置动态执行

| Day | 任务 | 类型 |
|-----|------|------|
| 11-12 | `ToolExecutor` 接口加 isEnabledForFactory + enrichParams | A |
| 12-13 | `ToolRegistry.getExecutorForFactory` 实现 | A |
| 13-14 | `SmartBiSkill` 加 factory_id + version 数据库迁移 | A |
| 14-15 | `SkillRegistry` 工厂级加载逻辑 | A |
| 15 | 改造 5 个核心 Tool 读 FormTemplate 验证 (RD/BOM/SO/PO/PR) | A |

### Phase 3 — 六扇门客户落地 (Week 4)

**目标**: 把六扇门的需求作为"画布配置实例"落地，验证整套架构

| Day | 任务 |
|-----|------|
| 16 | 创建 F006 工厂的 FactoryFeatureConfig（启用模块） |
| 17 | 创建 F006 的 FormTemplate（研发/BOM/销售订单字段定制） |
| 17 | 创建 F006 的 LowcodePageConfig（首页快捷入口 + 列表筛选） |
| 18 | 创建 F006 的 AIIntentConfig（六扇门特色意图） |
| 19 | 创建 F006 的 SmartBiSkill（如"批次三拆"Skill） |
| 20 | 端到端验证 + 文档 |

### Phase 4 — 高级能力 (Week 5+)

| 任务 | 优先级 |
|------|-------|
| PageType.WORKFLOW 工作流编排器 | P2 |
| PageType.REPORT 报表编辑器 | P2 |
| Skill DAG 执行图持久化 | P2 |
| 周转耗材插件 | P2 |
| 数字大屏 | P2 |

---

## 6. 关键架构决策

### 6.1 为什么选 FormTemplate (Formily Schema) 而不是自研 DSL

- ✅ Formily 是阿里成熟方案，社区文档完整
- ✅ 已支持嵌套 / 条件响应式 / 校验规则
- ✅ 实体已就绪，前端 DynamicEntityForm 已部分集成
- ❌ 学习成本（团队需熟悉 Formily Schema）

**决策**: 用 Formily，扩展时只补 entityType 枚举和前端组件库

### 6.2 为什么 AI Tool 在执行时读 FormTemplate

- 让 LLM 不需要硬编码字段，直接根据 schema 校验
- 支持工厂自定义字段（动态生成参数）
- AI 调用 Tool 时，schema 也作为 LLM 的提示词，提高准确率

### 6.3 为什么不在 LowcodePageConfig 直接存字段配置

- LowcodePageConfig 是**页面级**配置（布局/主题/数据绑定）
- FormTemplate 是**实体级**配置（字段/校验/默认值）
- **职责分离**: 一个表单页可以用同一个 FormTemplate，但 LowcodePageConfig 决定它在哪个页面、布局如何

### 6.4 为什么 ToolRegistry 不按工厂分别注册

- Tool 是 Spring Bean，全局注册成本最低
- 通过 `isEnabledForFactory` 方法做运行时过滤更灵活
- 避免 Spring 容器膨胀（300+ Tool × 100+ 工厂 = 3万 Bean）

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Formily 学习曲线 | 团队效率 | 先做 5 个核心实体的模板，边做边学 |
| 现有硬编码表单工作量大 | 工期延长 | 优先改销售订单/BOM/研发，其他后续 |
| FormTemplate 性能 (每次表单加载查DB) | 用户体验 | Redis 缓存 + 版本号 ETag |
| 工厂配置错误导致数据不一致 | 数据风险 | Schema 校验 + 版本管理 + 一键回滚 |
| 客户不会用画布编辑器 | 落地慢 | AI 辅助生成 (FormTemplate.source=AI_ASSISTANT) |
| Tool 配置版本与代码版本不匹配 | 运行时错误 | Tool 加 schema_version 字段 |

---

## 8. 立即执行项 (本周内)

按优先级排序，下次开发立即可做:

1. ✅ **已完成**: 销售订单明细 specification/box_quantity 字段补全
2. 🔴 **马上做**: A8.1 产品大类查询过滤 bug 修复（影响所有工厂）
3. 🔴 **马上做**: A3.2 销售订单同产品去重校验
4. 🔴 **马上做**: A3.4 销售订单 3 个状态字段 (payment/invoice/delivery)
5. 🔴 **马上做**: A4.1 ProductionPlan 加 sales_order_id 必填字段
6. 🔴 **马上做**: A4.4 ProductionReport 加 pc_code + production_date
7. 🟡 **本周做**: 前端 useFactoryFeatureStore 创建
8. 🟡 **本周做**: DynamicEntityForm 接入 FormTemplate API
9. 🟡 **本周做**: 销售订单 list.vue 试点改用 DynamicEntityForm

---

## 9. v1 → v2 变化对照表

| v1 内容 | v2 处理 |
|---------|---------|
| "改销售订单字段" | 拆为：A1 必改字段补全 + C1 工厂可配字段定制 |
| "改 BOM 字段" | 拆为：A2 物料分组拆 3 块 + C3 工厂可定制字段 |
| "改报工流程" | 拆为：A4 PC 批次必改 + C6 工厂可选 3 种报工模式 |
| "六扇门要做的全部" | 重新归类: A 类全工厂受益 + B 类系统模板 + C 类六扇门特定配置 |
| "硬编码改造" | 改为"画布配置 + AI Tool 适配"驱动 |
| "时间估算 4 周" | 仍 4 周，但 Phase 1 已经把基础打通后，新工厂上线只需配置不需开发 |

---

## 10. 总结：v2 的核心承诺

> **不要为客户硬编码，要让客户能自己配。** AI Tool 永远读最新画布配置执行。

**对开发团队**: 一次性投入 4 周建好画布 + Tool 适配框架，后续每个新工厂只需 2-5 天配置即可上线。

**对销售团队**: 演示时不再说"我们能改"，而是说"工厂自己用画布编辑器配，5 分钟就能改字段"。

**对客户**: 真正的"低代码 + AI" — 不会写代码也能定制 ERP，AI 助手帮你生成画布配置。

---

**文档版本**: v2.0
**创建时间**: 2026-04-07
**作者**: Claude Code (基于会议录像 + 画布架构调研)
**前置阅读**: `customer-meeting-apr7-requirements.md` (v1)
**关联文档**:
- `/backend/java/cretas-api/src/main/java/com/cretas/aims/entity/LowcodePageConfig.java`
- `/backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FormTemplate.java`
- `/backend/java/cretas-api/src/main/java/com/cretas/aims/entity/FactoryFeatureConfig.java`
- `/backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/AIIntentConfig.java`
