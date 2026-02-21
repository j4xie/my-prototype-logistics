# 生产报工 BI 页面 + reportType Bug 修复

## Context

Phase 2 报工闭环已完成验证（手动完成、自动完成、SmartBI 同步全链路 PASS）。
验证中发现两个问题：
1. **reportType 映射 bug**: 提交报工用 `"PRODUCTION_PROGRESS"`，同步服务用常量 `"PROGRESS"` 做严格匹配 → 进度报工被错误归入工时汇总表
2. **缺少生产报工 BI 页面**: SmartBI 同步数据（生产进度/工时/人效）写入了 smartbi_db，但 web-admin 没有独立页面展示，用户要求与财务经理的 FinanceAnalysis 分开

---

## Part 1: Bug 修复 — reportType 映射

### 问题
`ProductionReportSyncServiceImpl.java:153`:
```java
boolean isProgress = ProductionReport.ReportType.PROGRESS.equals(reportType);
```
`ReportType.PROGRESS = "PROGRESS"`，但多个入口可能写入 `"PRODUCTION_PROGRESS"` 等变体 → 不匹配时全部归入 HOURS 表。

### 修复
**文件**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/ProductionReportSyncServiceImpl.java`

改 3 处：
1. **行 153** `syncReportType()`: `boolean isProgress = reportType != null && reportType.toUpperCase().contains("PROGRESS");`
2. **行 296** `syncWorkerEfficiency()`: `if (r.getReportType() != null && r.getReportType().toUpperCase().contains("PROGRESS"))`
3. **行 298**: `else if (r.getReportType() != null && r.getReportType().toUpperCase().contains("HOURS"))`

---

## Part 2: 新增生产报工 BI 页面

### 2.1 新建页面

**新文件**: `web-admin/src/views/smart-bi/ProductionReportBI.vue` (~400行)

**参考**: `SalesAnalysis.vue` 的模式，但区别：
- **数据源**: 仅显示 `detectedTableType === 'AUTO_PRODUCTION'` 的上传
- **3 个 Tab**: 生产进度 / 工时汇总 / 人效汇总（按 sheetName 匹配）
- **无 system data fallback**: 只从 SmartBI 三表读取
- **"立即同步"按钮**: 调用 `POST /{factoryId}/work-reporting/sync-smartbi` 触发手动同步
- **空状态**: 如无 AUTO_PRODUCTION 数据，提示"暂无报工分析数据"+ 同步按钮

**复用组件**:
- `DynamicChartRenderer.vue` — 渲染 ECharts
- `SmartBIEmptyState.vue` — 空状态
- `ChartTypeSelector.vue` — 图表类型切换

**复用 API**:
- `getUploadHistory()` → 过滤 `tableType === 'AUTO_PRODUCTION'`
- `getUploadTableData(uploadId)` → 取原始数据
- `getDynamicAnalysis(uploadId)` → 取缓存分析
- `batchBuildCharts()` / `recommendChart()` → Python 图表生成
- `post(/{factoryId}/work-reporting/sync-smartbi)` → 手动同步

**页面结构**:
```
<el-container>
  <el-header> "生产报工分析" 标题 + 同步按钮 + 刷新按钮 </el-header>
  <el-tabs v-model="activeTab">
    <el-tab-pane label="生产进度" name="progress">
      KPI cards (产出/合格/不良率/报告人数)
      Charts (bar/line/pie from enrichment)
    </el-tab-pane>
    <el-tab-pane label="工时汇总" name="hours">
      KPI cards (总工时/总人数/操作量)
      Charts
    </el-tab-pane>
    <el-tab-pane label="人效汇总" name="efficiency">
      KPI cards (人效/不良率/产出)
      Charts
    </el-tab-pane>
  </el-tabs>
</el-container>
```

### 2.2 添加路由

**文件**: `web-admin/src/router/modules/smartbi.ts`

在 `sales` 路由后（行 31）添加:
```typescript
{
  path: 'production-report',
  name: 'SmartBIProductionReport',
  component: () => import('@/views/smart-bi/ProductionReportBI.vue'),
  meta: { requiresAuth: true, title: '生产报工分析', icon: 'Histogram', module: 'analytics' },
},
```

### 2.3 添加侧边栏入口

**文件**: `web-admin/src/components/layout/AppSidebar.vue`

在「预定义报表」组（行 183 附近）添加:
```typescript
{ path: '/smart-bi/production-report', title: '生产报工分析', icon: 'Histogram', module: 'analytics',
  roles: ['factory_super_admin', 'dispatcher', 'workshop_supervisor', 'platform_admin'] },
```

**不添加到** `financeManagerMenu`（行 43-50）→ 财务经理看不到。

### 2.4 权限调整

**文件**: `web-admin/src/store/modules/permission.ts`

行 95: `workshop_supervisor.analytics: '-'` → `'r'`

给车间主任 SmartBI 只读权限（目前是无权限）。

---

## 文件总结

| # | 文件 | 操作 | 改动量 |
|---|------|------|--------|
| 1 | `ProductionReportSyncServiceImpl.java` | 修改 | 3 行 |
| 2 | `ProductionReportBI.vue` | **新建** | ~400 行 |
| 3 | `smartbi.ts` (router) | 修改 | +5 行 |
| 4 | `AppSidebar.vue` | 修改 | +1 行 |
| 5 | `permission.ts` | 修改 | 1 行 |

---

## 验证方案

### Bug fix 验证
1. 构建 JAR，启动 `pg,dev` (端口 10011)
2. 提交 reportType=`PRODUCTION_PROGRESS` 的报工
3. 触发 `POST /sync-smartbi`
4. 检查 `smartbi_db.smart_bi_pg_excel_uploads` → sheetName 应为"生产进度汇总"（不是"工时汇总"）

### Vue 页面验证
1. `npm run dev` 启动 Vite
2. factory_admin1 登录 → 侧边栏「智能BI」→「生产报工分析」可见
3. 页面加载 → 显示 AUTO_PRODUCTION 数据的 3 个 Tab
4. finance_manager 登录 → 侧边栏无此入口
5. workshop_sup1 登录 → 可访问此页面

### 并行工作建议
- **Subagent**: ✅ 后端 bug fix 和前端页面完全独立
- **多Chat**: ✅ Java 和 Vue 不同目录，零冲突

---

# Phase 3: AI/LLM 增强 (后续)

## P1: 智能采购建议 (~1.5天)

### P1.1 供应商自动推荐
**问题**: `ProcurementSuggestionService.generateSuggestions()` 创建 DRAFT PO 时 `supplierId="PENDING"`，采购员需手动选择。

**方案**: 新增 `SmartProcurementService`，在生成 DRAFT PO 后自动匹配最佳供应商。

**新文件**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/orchestration/SmartProcurementService.java`

```java
@Service
public class SmartProcurementService {

    // 为每种缺料推荐 top-3 供应商
    public List<SupplierRecommendation> recommendSuppliers(String factoryId, String materialTypeId, LocalDate neededBy) {
        // 1. findByFactoryIdAndSuppliedMaterialsContaining(factoryId, materialName) — 已有
        // 2. 过滤: supplier.deliveryDays <= daysBetween(now, neededBy)
        // 3. 排序: rating DESC, deliveryDays ASC
        // 4. 返回 top-3，附带: 历史价格、交货天数、评级
    }

    // 查询近6个月同一物料的平均采购单价
    public BigDecimal getHistoricalPrice(String factoryId, String materialTypeId) {
        // MaterialBatchRepository: 新增 avgUnitPriceByMaterialType 查询
    }

    // 增强 DRAFT PO: 自动填充推荐供应商 + 建议单价
    public void enrichDraftPO(PurchaseOrder po) {
        // 1. 从 PO items 获取 materialTypeId
        // 2. recommendSuppliers() → 取第1名填入 po.supplierId
        // 3. getHistoricalPrice() → 填入 item.unitPrice
        // 4. 设置 expectedDeliveryDate = now + supplier.deliveryDays
        // 5. remark 追加推荐理由
    }
}
```

**复用**:
- `SupplierRepository.findByFactoryIdAndSuppliedMaterialsContaining()` — 已有
- `SupplierRepository.findTopSuppliersByRating()` — 已有
- `Supplier.deliveryDays` / `Supplier.rating` — 已有字段

**新增 Repository 查询**:
- `MaterialBatchRepository`: `@Query("SELECT AVG(mb.unitPrice) FROM MaterialBatch mb WHERE mb.factoryId = :factoryId AND mb.materialTypeId = :materialTypeId AND mb.receiptDate > :since AND mb.unitPrice > 0")`

### P1.2 采购建议端点
**修改文件**: `PurchaseController.java` (或新建 `SmartProcurementController.java`)

```
GET /api/mobile/{factoryId}/procurement/suggestions
    → 返回当前所有 DRAFT+AUTO 采购单，附带供应商推荐列表

POST /api/mobile/{factoryId}/procurement/suggestions/{poId}/apply-recommendation
    → 用户确认采纳推荐的供应商和价格
```

### P1.3 集成到 SupplyChainOrchestrator
**修改文件**: `SupplyChainOrchestrator.java`

在 `onSalesOrderConfirmed()` → `generateSuggestions()` 之后，调用:
```java
smartProcurementService.enrichDraftPO(po);  // 自动填充供应商+价格
```

### P1.4 前端展示（RN）
**修改文件**: `PurchaseOrderDetailScreen.tsx`

- DRAFT 状态的 AUTO 采购单显示 "AI推荐" 标签
- 显示推荐供应商列表（top-3），含评级星星、交货天数、历史均价
- "采纳推荐" 按钮 → 调用 apply-recommendation API

---

## P2: 报工异常检测 (~1天)

### P2.1 异常检测逻辑
**修改文件**: `WorkReportingServiceImpl.java`

在 `getSummary()` 中新增异常检测:

```java
// 在现有 summary 基础上追加:
List<Map<String, Object>> anomalies = detectAnomalies(factoryId);
summary.put("anomalies", anomalies);
```

```java
private List<Map<String, Object>> detectAnomalies(String factoryId) {
    List<Map<String, Object>> anomalies = new ArrayList<>();

    // 1. 良品率异常: todayYieldRate < 阈值 (默认85%)
    BigDecimal yieldRate = calculateTodayYieldRate(factoryId);
    if (yieldRate != null && yieldRate.compareTo(new BigDecimal("85")) < 0) {
        anomalies.add(Map.of(
            "type", "YIELD_RATE_LOW",
            "severity", yieldRate.compareTo(new BigDecimal("70")) < 0 ? "CRITICAL" : "WARNING",
            "value", yieldRate,
            "threshold", 85,
            "message", "今日良品率 " + yieldRate + "% 低于阈值 85%"
        ));
    }

    // 2. 产量偏差: 今日产量 vs 7天均值偏差 >30%
    BigDecimal todayOutput = getTodayOutput(factoryId);
    BigDecimal weeklyAvg = getWeeklyAverage(factoryId);
    if (todayOutput != null && weeklyAvg != null && weeklyAvg.compareTo(BigDecimal.ZERO) > 0) {
        BigDecimal deviation = todayOutput.subtract(weeklyAvg)
            .divide(weeklyAvg, 2, RoundingMode.HALF_UP)
            .multiply(new BigDecimal("100"));
        if (deviation.abs().compareTo(new BigDecimal("30")) > 0) {
            anomalies.add(Map.of(
                "type", "OUTPUT_DEVIATION",
                "severity", deviation.abs().compareTo(new BigDecimal("50")) > 0 ? "CRITICAL" : "WARNING",
                "value", todayOutput,
                "weeklyAvg", weeklyAvg,
                "deviation", deviation,
                "message", "今日产量偏差 " + deviation + "% (vs 7日均值)"
            ));
        }
    }

    return anomalies;
}
```

### P2.2 AI 根因分析端点
**新增端点**: `WorkReportingController.java`

```
POST /api/mobile/{factoryId}/work-reporting/anomaly-analysis
Body: { anomalyType, context (recent reports, yield data) }
```

内部调用 Python `/api/chat/general-analysis`:
```java
// 构建 prompt: "以下是生产报工数据异常情况：{anomaly}。最近7天的报工数据如下：{weeklyData}。请分析可能的原因并给出改进建议。"
```

### P2.3 前端异常展示
**修改文件**: `FAHomeScreen.tsx`

在报工速览卡片下方新增异常提示:
- WARNING → 黄色条带，文字提示
- CRITICAL → 红色条带，带"AI分析"按钮
- 点击 "AI分析" → 调用 anomaly-analysis → 弹窗显示 LLM 根因分析

---

## P3: 餐饮意图路由 (~1.5天)

### P3.1 新增餐饮意图定义
**修改文件**: 数据库 `intent_definitions` 表 (新 SQL seed)

| intentCode | intentName | category | 映射到已有 handler |
|---|---|---|---|
| MENU_QUERY | 菜品查询 | CRM | → 复用 ProductType 查询 |
| INGREDIENT_STOCK | 食材库存查询 | MATERIAL | → 复用 MaterialBatch 查询 |
| DAILY_SALES_SUMMARY | 每日营业汇总 | REPORT | → 复用 SalesOrder 聚合 |
| FOOD_COST_ANALYSIS | 食材成本分析 | REPORT | → 新增: 采购额/营业额=食材成本率 |
| SUPPLIER_RECOMMEND | 供应商推荐 | CRM | → 调用 P1 的 SmartProcurementService |
| LOW_STOCK_ALERT | 库存预警查看 | MATERIAL | → 复用 findLowStockMaterials |
| PURCHASE_SUGGESTION | 采购建议查看 | MATERIAL | → 调用 P1 的 suggestions 端点 |

### P3.2 Handler 扩展
**修改文件**: `MaterialIntentHandler.java`

新增 case:
- `INGREDIENT_STOCK` → 查询 `MaterialBatchRepository.sumQuantityByMaterialType(factoryId)` + 过滤 restaurant 食材类别
- `LOW_STOCK_ALERT` → 调用 `findLowStockMaterials(factoryId)` → 格式化返回

**修改文件**: `CRMIntentHandler.java`

新增 case:
- `MENU_QUERY` → 查询 `ProductTypeRepository.findByFactoryId(factoryId)` → 按 category 分组
- `SUPPLIER_RECOMMEND` → 调用 `SmartProcurementService.recommendSuppliers()`

**修改文件**: `ReportIntentHandler.java`

新增 case:
- `DAILY_SALES_SUMMARY` → `SalesOrderRepository.findByFactoryIdAndDateRange(factoryId, today, today)` → 汇总
- `FOOD_COST_ANALYSIS` → 采购总额 / 销售总额 计算食材成本率

### P3.3 意图路由映射
**修改文件**: `IntentExecutorServiceImpl.java`

在 `INTENT_CODE_HANDLER_OVERRIDE` 中添加:
```java
Map.entry("MENU_QUERY", "CRM"),
Map.entry("INGREDIENT_STOCK", "MATERIAL"),
Map.entry("DAILY_SALES_SUMMARY", "REPORT"),
Map.entry("FOOD_COST_ANALYSIS", "REPORT"),
Map.entry("SUPPLIER_RECOMMEND", "CRM"),
Map.entry("LOW_STOCK_ALERT", "MATERIAL"),
Map.entry("PURCHASE_SUGGESTION", "MATERIAL"),
```

### P3.4 LLM 消歧增强
**修改文件**: `IntentDisambiguationService.java` (或 TwoStageIntentService)

在 LLM 消歧 prompt 中增加餐饮意图描述:
```
- MENU_QUERY: 用户询问菜品/菜单信息（"有哪些菜"、"菜单价格"）
- INGREDIENT_STOCK: 用户询问食材/原料库存（"鸡肉还有多少"、"食材够不够"）
- DAILY_SALES_SUMMARY: 用户询问当日营业额/订单量（"今天卖了多少"、"营业额"）
- FOOD_COST_ANALYSIS: 用户询问食材成本占比（"食材成本率"、"成本控制"）
```

### P3.5 意图测试数据
**修改文件**: `tests/intent-routing-e2e-150.py`

新增餐饮场景测试用例 (~20 条):
```python
# 餐饮意图路由测试
("宫保鸡丁多少钱", "MENU_QUERY"),
("鸡胸肉库存还有多少", "INGREDIENT_STOCK"),
("今天营业额多少", "DAILY_SALES_SUMMARY"),
("这个月食材成本率是多少", "FOOD_COST_ANALYSIS"),
("哪个供应商鸡肉便宜", "SUPPLIER_RECOMMEND"),
("哪些食材快没了", "LOW_STOCK_ALERT"),
```

---

## P4: AI 仪表盘洞察 (~1天)

### P4.1 智能洞察生成端点
**新增端点**: `SmartBIAnalysisController.java`

```
POST /api/mobile/{factoryId}/smart-bi/ai-insights
Body: { metrics: { revenue, profitMargin, yieldRate, lowStockCount, pendingApprovals }, factoryType }
→ 调用 Python /api/chat/general-analysis
→ 返回 3-5 条 actionable insights
```

Java 端构建 prompt:
```
你是一位{factoryType == RESTAURANT ? "餐饮业" : "食品加工业"}经营顾问。
当前工厂运营数据如下：
- 本月营收: {revenue}
- 利润率: {profitMargin}%
- 今日良品率: {yieldRate}%（仅工厂）
- 库存预警: {lowStockCount} 种物料低于安全库存
- 待审批报工: {pendingApprovals} 条（仅工厂）

请根据以上数据，给出 3-5 条简洁的经营建议，每条包含：
1. 类型 (risk/opportunity/action)
2. 严重程度 (high/medium/low)
3. 建议内容 (一句话)
4. 具体措施 (一句话)

以 JSON 数组返回。
```

### P4.2 前端洞察卡片
**修改文件**: `FAHomeScreen.tsx`

- 首页底部新增 "AI 洞察" section
- 调用 `POST /smart-bi/ai-insights` (每天每工厂缓存一次)
- 卡片样式: risk→红色, opportunity→绿色, action→蓝色
- 可折叠/展开，默认显示前3条

### P4.3 缓存策略
- Java 端使用 `SmartBiAnalysisCache` 表（已有）
- cache key: `ai-insights:{factoryId}:{date}`
- TTL: 24小时
- 用户可手动刷新（重新调用 LLM）

---

## 文件总结

### 新文件 (2):
| # | 文件 | 类型 |
|---|------|------|
| 1 | `service/orchestration/SmartProcurementService.java` | Java 服务 |
| 2 | `database/seed_restaurant_intents.sql` | SQL 种子 |

### 修改文件 (12):
| # | 文件 | 变更 |
|---|------|------|
| 1 | `ProcurementSuggestionService.java` | 调用 SmartProcurementService.enrichDraftPO() |
| 2 | `SupplyChainOrchestrator.java` | 注入 SmartProcurementService, 生成后自动增强 |
| 3 | `MaterialBatchRepository.java` | +avgUnitPriceByMaterialType 查询 |
| 4 | `WorkReportingServiceImpl.java` | +detectAnomalies() 方法 |
| 5 | `WorkReportingController.java` | +POST anomaly-analysis 端点 |
| 6 | `IntentExecutorServiceImpl.java` | +7 个餐饮意图 override 映射 |
| 7 | `MaterialIntentHandler.java` | +INGREDIENT_STOCK, +LOW_STOCK_ALERT case |
| 8 | `CRMIntentHandler.java` | +MENU_QUERY, +SUPPLIER_RECOMMEND case |
| 9 | `ReportIntentHandler.java` | +DAILY_SALES_SUMMARY, +FOOD_COST_ANALYSIS case |
| 10 | `SmartBIAnalysisController.java` | +POST ai-insights 端点 |
| 11 | `FAHomeScreen.tsx` | +异常提示 + AI 洞察 section |
| 12 | `PurchaseOrderDetailScreen.tsx` | +AI 推荐供应商展示 |

---

## 执行顺序

```
P1 (智能采购):
  P1.1 SmartProcurementService → P1.2 端点 → P1.3 集成 Orchestrator → P1.4 前端

P2 (异常检测):
  P2.1 detectAnomalies() → P2.2 anomaly-analysis 端点 → P2.3 前端展示

P3 (餐饮意图):
  P3.1 SQL seed → P3.2 Handler 扩展 → P3.3 Override 映射 → P3.4 消歧增强 → P3.5 测试

P4 (AI洞察):
  P4.1 ai-insights 端点 → P4.2 前端卡片 → P4.3 缓存
```

**P1+P2 后端与 P3 SQL/Handler 可并行**（不同文件）
**P4 前端依赖 P2 完成**（共改 FAHomeScreen.tsx）

---

## 验证方案

### P1 验证
1. 构建 JAR，启动 `pg,dev`
2. 创建销售订单 → 确认 → 检查自动生成的 DRAFT PO
3. 验证 PO 中 supplierId 不再是 "PENDING"，unitPrice 不再是 0
4. GET /procurement/suggestions 返回推荐列表

### P2 验证
1. 提交低良品率报工 (goodQty << outputQty)
2. GET /work-reporting/summary → anomalies 数组包含 YIELD_RATE_LOW
3. POST /anomaly-analysis → 返回 LLM 分析文本

### P3 验证
1. 执行 seed_restaurant_intents.sql
2. restaurant_admin1 登录 → AI 对话
3. 输入 "鸡胸肉还有多少" → 返回食材库存数据
4. 输入 "今天营业额" → 返回当日销售汇总
5. 运行 intent-routing-e2e-150.py → 新增用例全 PASS

### P4 验证
1. factory_admin1 登录 → 首页加载
2. 底部显示 AI 洞察卡片 (3-5条)
3. 刷新后走缓存（不重复调用 LLM）
4. restaurant_admin1 登录 → 洞察内容为餐饮视角
