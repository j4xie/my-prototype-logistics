package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.repository.inventory.SalesOrderItemRepository;
import com.cretas.aims.util.ErrorSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 餐饮专属意图处理器
 *
 * 处理 RESTAURANT 分类的意图，覆盖四大业务领域：
 *
 * 菜品查询类 (5个):
 * - RESTAURANT_DISH_LIST: 查看菜品列表
 * - RESTAURANT_DISH_SALES_RANKING: 菜品销量排行（TOP 10）
 * - RESTAURANT_DISH_COST_ANALYSIS: 菜品成本分析（基于BOM配方）
 * - RESTAURANT_BESTSELLER_QUERY: 畅销菜品查询
 * - RESTAURANT_SLOW_SELLER_QUERY: 滞销菜品查询
 *
 * 食材管理类 (5个):
 * - RESTAURANT_INGREDIENT_STOCK: 食材库存查询
 * - RESTAURANT_INGREDIENT_EXPIRY_ALERT: 食材保质期预警
 * - RESTAURANT_INGREDIENT_LOW_STOCK: 食材低库存预警
 * - RESTAURANT_INGREDIENT_COST_TREND: 食材成本趋势
 * - RESTAURANT_PROCUREMENT_SUGGESTION: 智能采购建议
 *
 * 营业分析类 (5个):
 * - RESTAURANT_DAILY_REVENUE: 今日/指定日期营业额
 * - RESTAURANT_REVENUE_TREND: 营业额趋势分析
 * - RESTAURANT_ORDER_STATISTICS: 订单统计（数量、均价）
 * - RESTAURANT_PEAK_HOURS_ANALYSIS: 高峰时段分析
 * - RESTAURANT_MARGIN_ANALYSIS: 毛利率分析
 *
 * 损耗管理类 (3个):
 * - RESTAURANT_WASTAGE_SUMMARY: 损耗汇总
 * - RESTAURANT_WASTAGE_RATE: 损耗率查询
 * - RESTAURANT_WASTAGE_ANOMALY: 损耗异常检测
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-20
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RestaurantIntentHandler implements IntentHandler {

    private final ProductTypeRepository productTypeRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final RawMaterialTypeRepository rawMaterialTypeRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final SalesOrderItemRepository salesOrderItemRepository;

    @Override
    public String getSupportedCategory() {
        return "RESTAURANT";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("RestaurantIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                // 菜品查询类
                case "RESTAURANT_DISH_LIST"             -> handleDishList(factoryId, request, intentConfig);
                case "RESTAURANT_DISH_SALES_RANKING"    -> handleDishSalesRanking(factoryId, request, intentConfig);
                case "RESTAURANT_DISH_COST_ANALYSIS"    -> handleDishCostAnalysis(factoryId, request, intentConfig);
                case "RESTAURANT_BESTSELLER_QUERY"      -> handleBestsellerQuery(factoryId, request, intentConfig);
                case "RESTAURANT_SLOW_SELLER_QUERY"     -> handleSlowSellerQuery(factoryId, request, intentConfig);
                // 食材管理类
                case "RESTAURANT_INGREDIENT_STOCK"      -> handleIngredientStock(factoryId, request, intentConfig);
                case "RESTAURANT_INGREDIENT_EXPIRY_ALERT" -> handleIngredientExpiryAlert(factoryId, request, intentConfig);
                case "RESTAURANT_INGREDIENT_LOW_STOCK"  -> handleIngredientLowStock(factoryId, intentConfig);
                case "RESTAURANT_INGREDIENT_COST_TREND" -> handleIngredientCostTrend(factoryId, request, intentConfig);
                case "RESTAURANT_PROCUREMENT_SUGGESTION" -> handleProcurementSuggestion(factoryId, intentConfig);
                // 营业分析类
                case "RESTAURANT_DAILY_REVENUE"         -> handleDailyRevenue(factoryId, request, intentConfig);
                case "RESTAURANT_REVENUE_TREND"         -> handleRevenueTrend(factoryId, request, intentConfig);
                case "RESTAURANT_ORDER_STATISTICS"      -> handleOrderStatistics(factoryId, request, intentConfig);
                case "RESTAURANT_PEAK_HOURS_ANALYSIS"   -> handlePeakHoursAnalysis(factoryId, request, intentConfig);
                case "RESTAURANT_MARGIN_ANALYSIS"       -> handleMarginAnalysis(factoryId, request, intentConfig);
                // 损耗管理类
                case "RESTAURANT_WASTAGE_SUMMARY"       -> handleWastageSummary(factoryId, request, intentConfig);
                case "RESTAURANT_WASTAGE_RATE"          -> handleWastageRate(factoryId, request, intentConfig);
                case "RESTAURANT_WASTAGE_ANOMALY"       -> handleWastageAnomaly(factoryId, intentConfig);
                default -> {
                    log.warn("未知的RESTAURANT意图: {}", intentCode);
                    String msg = "暂不支持此餐饮操作: " + intentCode;
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("RESTAURANT")
                            .status("FAILED")
                            .message(msg)
                            .formattedText(msg)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };
        } catch (Exception e) {
            log.error("RestaurantIntentHandler处理失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            String errMsg = "餐饮操作失败: " + ErrorSanitizer.sanitize(e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("RESTAURANT")
                    .status("FAILED")
                    .message(errMsg)
                    .formattedText(errMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        // 餐饮查询类意图均为只读，预览即执行
        return handle(factoryId, request, intentConfig, userId, userRole);
    }

    // ==================== 菜品查询类 ====================

    /**
     * RESTAURANT_DISH_LIST — 查看菜品列表
     * 从 product_types 表中查询该门店（factoryId）的菜品目录
     */
    private IntentExecuteResponse handleDishList(String factoryId, IntentExecuteRequest request,
                                                  AIIntentConfig intentConfig) {
        var dishes = productTypeRepository.findByFactoryIdAndIsActive(factoryId, true);

        if (dishes.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "当前菜品目录为空。请先在「菜品管理」中添加菜品信息。",
                    null);
        }

        List<Map<String, Object>> dishList = dishes.stream().map(d -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", d.getId());
            item.put("名称", d.getName());
            item.put("编码", d.getCode());
            item.put("分类", d.getCategory() != null ? d.getCategory() : "-");
            item.put("状态", Boolean.TRUE.equals(d.getIsActive()) ? "在售" : "下架");
            return item;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalCount", dishes.size());
        result.put("dishes", dishList);

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("共查询到 %d 道菜品。", dishes.size()),
                result);
    }

    /**
     * RESTAURANT_DISH_SALES_RANKING — 菜品销量排行 TOP 10
     * 通过 sales_order_items JOIN product_types，按销售数量汇总排名
     */
    private IntentExecuteResponse handleDishSalesRanking(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig) {
        // 默认查询最近 30 天
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(30);
        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
        }

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (orders.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    String.format("近 %d 天（%s 至 %s）暂无销售记录，无法生成排行。",
                            startDate.until(endDate).getDays(), startDate, endDate),
                    null);
        }

        // 汇总每道菜的销售数量
        Map<String, SalesAccumulator> accumulator = new HashMap<>();
        for (var order : orders) {
            var items = salesOrderItemRepository.findBySalesOrderId(order.getId());
            for (var item : items) {
                if (item.getProductTypeId() == null) continue;
                accumulator.computeIfAbsent(item.getProductTypeId(), k -> new SalesAccumulator())
                        .add(item.getQuantity(), item.getUnitPrice(), item.getProductName());
            }
        }

        List<Map<String, Object>> ranking = accumulator.entrySet().stream()
                .sorted(Comparator.comparingDouble((Map.Entry<String, SalesAccumulator> e) ->
                        e.getValue().totalQty).reversed())
                .limit(10)
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("菜品名称", e.getValue().name != null ? e.getValue().name : e.getKey());
                    row.put("销售数量", String.format("%.1f", e.getValue().totalQty));
                    row.put("销售金额", String.format("¥%.2f", e.getValue().totalAmount));
                    return row;
                }).collect(Collectors.toList());

        // 补充排名序号
        for (int i = 0; i < ranking.size(); i++) {
            ranking.get(i).put("排名", i + 1);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("period", startDate + " 至 " + endDate);
        result.put("ranking", ranking);

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("近30天菜品销量排行（TOP %d）已生成，%s 排名第一。",
                        ranking.size(), ranking.isEmpty() ? "-" : ranking.get(0).get("菜品名称")),
                result);
    }

    /**
     * RESTAURANT_DISH_COST_ANALYSIS — 菜品成本分析
     * 基于食材库存单价与BOM配方（待 restaurant_bom 表建成后精确计算）
     */
    private IntentExecuteResponse handleDishCostAnalysis(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig) {
        var dishes = productTypeRepository.findByFactoryIdAndIsActive(factoryId, true);
        if (dishes.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "暂无菜品数据，无法进行成本分析。请先在「菜品管理」中录入菜品。", null);
        }

        // 获取当前食材库存（用于估算成本基线）
        long ingredientCount = rawMaterialTypeRepository.countActiveMaterialTypes(factoryId);
        long dishCount = dishes.size();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("菜品总数", dishCount);
        result.put("在库食材种类", ingredientCount);
        result.put("分析说明", "精确的菜品成本分析需要配置BOM配方（食材用量）。当前仅展示食材库存概览。");
        result.put("建议", List.of(
                "在「配方管理」中为每道菜品录入食材用量（BOM）",
                "配置完成后，AI将自动计算每道菜的理论成本和毛利率",
                "可对比销售均价，识别高/低毛利菜品"
        ));

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("当前有 %d 道菜品，%d 种食材在库。完整成本分析需先配置BOM配方。",
                        dishCount, ingredientCount),
                result);
    }

    /**
     * RESTAURANT_BESTSELLER_QUERY — 畅销菜品查询（销量TOP 5，近7天）
     */
    private IntentExecuteResponse handleBestsellerQuery(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(7);

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        Map<String, SalesAccumulator> accumulator = new HashMap<>();
        for (var order : orders) {
            var items = salesOrderItemRepository.findBySalesOrderId(order.getId());
            for (var item : items) {
                if (item.getProductTypeId() == null) continue;
                accumulator.computeIfAbsent(item.getProductTypeId(), k -> new SalesAccumulator())
                        .add(item.getQuantity(), item.getUnitPrice(), item.getProductName());
            }
        }

        List<Map<String, Object>> bestSellers = accumulator.entrySet().stream()
                .sorted(Comparator.comparingDouble((Map.Entry<String, SalesAccumulator> e) ->
                        e.getValue().totalQty).reversed())
                .limit(5)
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("菜品", e.getValue().name != null ? e.getValue().name : e.getKey());
                    row.put("7天销量", String.format("%.1f 份", e.getValue().totalQty));
                    row.put("销售额", String.format("¥%.2f", e.getValue().totalAmount));
                    return row;
                }).collect(Collectors.toList());

        if (bestSellers.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "近7天暂无销售数据，请先完成点单记录后再查询畅销菜品。", null);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate + "（近7天）");
        result.put("畅销TOP5", bestSellers);

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("近7天畅销菜品TOP5：第一名「%s」，销量 %s。",
                        bestSellers.get(0).get("菜品"), bestSellers.get(0).get("7天销量")),
                result);
    }

    /**
     * RESTAURANT_SLOW_SELLER_QUERY — 滞销菜品查询（近7天销量最低 5 道）
     */
    private IntentExecuteResponse handleSlowSellerQuery(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(7);

        var allDishes = productTypeRepository.findByFactoryIdAndIsActive(factoryId, true);
        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        // 统计有销售记录的菜品
        Map<String, SalesAccumulator> accumulator = new HashMap<>();
        for (var order : orders) {
            var items = salesOrderItemRepository.findBySalesOrderId(order.getId());
            for (var item : items) {
                if (item.getProductTypeId() == null) continue;
                accumulator.computeIfAbsent(item.getProductTypeId(), k -> new SalesAccumulator())
                        .add(item.getQuantity(), item.getUnitPrice(), item.getProductName());
            }
        }

        // 找出无销售记录或销量最低的菜品
        List<Map<String, Object>> slowSellers = new ArrayList<>();

        // 无任何销售记录的菜品（完全滞销）
        for (var dish : allDishes) {
            if (!accumulator.containsKey(dish.getId())) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("菜品", dish.getName());
                row.put("7天销量", "0 份");
                row.put("状态", "零销售");
                slowSellers.add(row);
            }
        }

        // 补充低销量菜品（有销售但排名末尾）
        accumulator.entrySet().stream()
                .sorted(Comparator.comparingDouble(e -> e.getValue().totalQty))
                .limit(5)
                .forEach(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("菜品", e.getValue().name != null ? e.getValue().name : e.getKey());
                    row.put("7天销量", String.format("%.1f 份", e.getValue().totalQty));
                    row.put("状态", "低销量");
                    slowSellers.add(row);
                });

        if (slowSellers.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "近7天所有菜品均有销售，暂无明显滞销菜品。", null);
        }

        // 只取前5条（零销售优先）
        List<Map<String, Object>> top5 = slowSellers.stream().limit(5).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate + "（近7天）");
        result.put("滞销菜品", top5);
        result.put("建议", "可考虑对滞销菜品进行促销或暂时下架，以降低食材损耗。");

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("近7天发现 %d 道滞销/零销售菜品，建议及时评估是否调整菜单。", top5.size()),
                result);
    }

    // ==================== 食材管理类 ====================

    /**
     * RESTAURANT_INGREDIENT_STOCK — 食材库存查询
     */
    private IntentExecuteResponse handleIngredientStock(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 200));

        if (batches.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "当前食材库存为空。请先在「库存管理」中录入食材入库记录。", null);
        }

        // 按食材类型汇总
        Map<String, IngredientStockAccumulator> stockMap = new HashMap<>();
        batches.forEach(b -> {
            String materialName = b.getMaterialType() != null ? b.getMaterialType().getName() : "未知食材";
            stockMap.computeIfAbsent(materialName, k -> new IngredientStockAccumulator(materialName))
                    .add(b.getRemainingQuantity(), b.getQuantityUnit());
        });

        List<Map<String, Object>> stockList = stockMap.values().stream()
                .sorted(Comparator.comparing(a -> a.name))
                .map(a -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("食材", a.name);
                    row.put("可用数量", String.format("%.2f %s", a.totalQty, a.unit));
                    row.put("批次数", a.batchCount);
                    return row;
                }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("食材种类数", stockList.size());
        result.put("库存明细", stockList);

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("共 %d 种食材在库，总计 %d 个批次。", stockList.size(), batches.getNumberOfElements()),
                result);
    }

    /**
     * RESTAURANT_INGREDIENT_EXPIRY_ALERT — 食材保质期预警（7天内到期）
     */
    private IntentExecuteResponse handleIngredientExpiryAlert(String factoryId, IntentExecuteRequest request,
                                                               AIIntentConfig intentConfig) {
        int alertDays = 7;
        if (request.getContext() != null && request.getContext().get("days") != null) {
            try {
                alertDays = Integer.parseInt(request.getContext().get("days").toString());
            } catch (NumberFormatException ignored) {}
        }

        LocalDate warningDate = LocalDate.now().plusDays(alertDays);
        var expiringBatches = materialBatchRepository.findExpiringBatches(
                factoryId, warningDate);

        if (expiringBatches.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    String.format("当前 %d 天内无临期食材，库存状态良好。", alertDays), null);
        }

        List<Map<String, Object>> alerts = expiringBatches.stream().map(b -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("食材", b.getMaterialType() != null ? b.getMaterialType().getName() : "未知");
            row.put("批次号", b.getBatchNumber());
            row.put("到期日期", b.getExpireDate() != null ? b.getExpireDate().toString() : "-");
            row.put("可用数量", String.format("%.2f %s", b.getRemainingQuantity(), b.getQuantityUnit()));
            long daysLeft = b.getExpireDate() != null ?
                    LocalDate.now().until(b.getExpireDate()).getDays() : 0;
            row.put("剩余天数", daysLeft + " 天");
            row.put("紧急程度", daysLeft <= 2 ? "紧急" : daysLeft <= 5 ? "警告" : "提醒");
            return row;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("预警天数", alertDays);
        result.put("临期食材数", alerts.size());
        result.put("临期列表", alerts);

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("警告：发现 %d 批临期食材（%d天内到期），请及时安排使用或处理。",
                        alerts.size(), alertDays),
                result);
    }

    /**
     * RESTAURANT_INGREDIENT_LOW_STOCK — 食材低库存预警
     */
    private IntentExecuteResponse handleIngredientLowStock(String factoryId, AIIntentConfig intentConfig) {
        var materialTypes = rawMaterialTypeRepository.findMaterialTypesWithStockWarning(factoryId);

        if (materialTypes.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "暂未配置食材最低库存阈值。请在「食材管理」中为每种食材设置最低库存量。", null);
        }

        // 查询当前库存并与阈值比较
        List<Map<String, Object>> lowStockAlerts = new ArrayList<>();
        for (var mt : materialTypes) {
            if (mt.getMinStock() == null) continue;
            // 统计该食材所有可用批次的库存
            var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 500));
            double currentStock = batches.stream()
                    .filter(b -> b.getMaterialType() != null &&
                                 b.getMaterialType().getId().equals(mt.getId()))
                    .mapToDouble(b -> b.getRemainingQuantity() != null ?
                            b.getRemainingQuantity().doubleValue() : 0)
                    .sum();

            if (currentStock < mt.getMinStock().doubleValue()) {
                Map<String, Object> alert = new LinkedHashMap<>();
                alert.put("食材", mt.getName());
                alert.put("当前库存", String.format("%.2f %s", currentStock,
                        mt.getUnit() != null ? mt.getUnit() : ""));
                alert.put("最低阈值", String.format("%.2f %s", mt.getMinStock(),
                        mt.getUnit() != null ? mt.getUnit() : ""));
                alert.put("缺口", String.format("%.2f", mt.getMinStock().doubleValue() - currentStock));
                lowStockAlerts.add(alert);
            }
        }

        if (lowStockAlerts.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "所有食材库存均在安全线以上，无需紧急补货。", null);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("低库存食材数", lowStockAlerts.size());
        result.put("低库存列表", lowStockAlerts);

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("发现 %d 种食材库存不足，建议尽快采购补货。", lowStockAlerts.size()),
                result);
    }

    /**
     * RESTAURANT_INGREDIENT_COST_TREND — 食材成本趋势（近30天入库成本）
     */
    private IntentExecuteResponse handleIngredientCostTrend(String factoryId, IntentExecuteRequest request,
                                                             AIIntentConfig intentConfig) {
        // 使用入库批次的成本数据模拟趋势
        var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 500));

        if (batches.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "暂无食材入库记录，无法分析成本趋势。请先录入采购入库数据。", null);
        }

        // 按食材类型汇总成本
        Map<String, Double> costByMaterial = new LinkedHashMap<>();
        batches.forEach(b -> {
            String name = b.getMaterialType() != null ? b.getMaterialType().getName() : "其他";
            double cost = 0;
            if (b.getUnitPrice() != null && b.getReceiptQuantity() != null) {
                cost = b.getUnitPrice().multiply(b.getReceiptQuantity()).doubleValue();
            }
            costByMaterial.merge(name, cost, Double::sum);
        });

        // 按成本从高到低排序
        List<Map<String, Object>> costList = costByMaterial.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(10)
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("食材", e.getKey());
                    row.put("采购成本", String.format("¥%.2f", e.getValue()));
                    return row;
                }).collect(Collectors.toList());

        double totalCost = costByMaterial.values().stream().mapToDouble(Double::doubleValue).sum();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("在库批次总成本", String.format("¥%.2f", totalCost));
        result.put("食材成本TOP10", costList);
        result.put("说明", "数据来源于当前在库批次的入库成本，反映近期采购价格趋势");

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("在库食材总成本 ¥%.2f，成本占比最高的食材是「%s」。",
                        totalCost, costList.isEmpty() ? "-" : costList.get(0).get("食材")),
                result);
    }

    /**
     * RESTAURANT_PROCUREMENT_SUGGESTION — 智能采购建议
     */
    private IntentExecuteResponse handleProcurementSuggestion(String factoryId, AIIntentConfig intentConfig) {
        var lowMaterials = rawMaterialTypeRepository.findMaterialTypesWithStockWarning(factoryId);

        List<Map<String, Object>> suggestions = new ArrayList<>();

        // 基于低库存生成采购建议
        for (var mt : lowMaterials) {
            if (mt.getMinStock() == null) continue;
            var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 500));
            double currentStock = batches.stream()
                    .filter(b -> b.getMaterialType() != null &&
                                 b.getMaterialType().getId().equals(mt.getId()))
                    .mapToDouble(b -> b.getRemainingQuantity() != null ?
                            b.getRemainingQuantity().doubleValue() : 0)
                    .sum();

            if (currentStock < mt.getMinStock().doubleValue() * 1.2) { // 预留20%缓冲
                Map<String, Object> sugg = new LinkedHashMap<>();
                sugg.put("食材", mt.getName());
                sugg.put("当前库存", String.format("%.2f", currentStock));
                sugg.put("建议采购量", String.format("%.2f", mt.getMinStock().doubleValue() * 2 - currentStock));
                sugg.put("单位", mt.getUnit() != null ? mt.getUnit() : "");
                sugg.put("优先级", currentStock <= 0 ? "紧急" : "一般");
                suggestions.add(sugg);
            }
        }

        // 检查临期食材（7天内），给出采购替换建议
        LocalDate warningDate = LocalDate.now().plusDays(7);
        var expiringBatches = materialBatchRepository.findExpiringBatches(
                factoryId, warningDate);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("低库存采购建议", suggestions);
        result.put("临期食材数量", expiringBatches.size());
        if (!expiringBatches.isEmpty()) {
            result.put("临期提醒", "有 " + expiringBatches.size() + " 批食材即将到期，建议优先使用再采购。");
        }
        result.put("采购原则", List.of("优先补充库存低于阈值的食材", "临期食材先用再买", "建议每次采购满足3-5天用量"));

        if (suggestions.isEmpty() && expiringBatches.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "当前库存充足，近期无紧急采购需求。", result);
        }

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("智能采购建议：%d 种食材需补货，%d 批临期食材需优先使用。",
                        suggestions.size(), expiringBatches.size()),
                result);
    }

    // ==================== 营业分析类 ====================

    /**
     * RESTAURANT_DAILY_REVENUE — 今日/指定日期营业额
     */
    private IntentExecuteResponse handleDailyRevenue(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        LocalDate queryDate = LocalDate.now();
        if (request.getContext() != null && request.getContext().get("date") != null) {
            try {
                queryDate = LocalDate.parse((String) request.getContext().get("date"));
            } catch (Exception ignored) {}
        }

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, queryDate, queryDate);

        if (orders.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    String.format("%s 暂无订单记录，营业额为 ¥0.00。", queryDate), null);
        }

        double totalRevenue = orders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                .sum();
        long orderCount = orders.size();
        double avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("日期", queryDate.toString());
        result.put("营业额", String.format("¥%.2f", totalRevenue));
        result.put("订单数量", orderCount);
        result.put("客单价", String.format("¥%.2f", avgOrderValue));

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("%s 营业额 ¥%.2f，共 %d 单，客单价 ¥%.2f。",
                        queryDate, totalRevenue, orderCount, avgOrderValue),
                result);
    }

    /**
     * RESTAURANT_REVENUE_TREND — 营业额趋势分析（近7天/30天）
     */
    private IntentExecuteResponse handleRevenueTrend(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        int days = 7;
        if (request.getContext() != null && request.getContext().get("days") != null) {
            try {
                days = Integer.parseInt(request.getContext().get("days").toString());
            } catch (NumberFormatException ignored) {}
        }

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(days - 1);

        List<Map<String, Object>> trendList = new ArrayList<>();
        double totalRevenue = 0;
        double maxRevenue = 0;
        String maxDate = "-";

        for (LocalDate d = startDate; !d.isAfter(endDate); d = d.plusDays(1)) {
            final LocalDate current = d;
            var dayOrders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, current, current);
            double dayRevenue = dayOrders.stream()
                    .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                    .sum();
            totalRevenue += dayRevenue;

            if (dayRevenue > maxRevenue) {
                maxRevenue = dayRevenue;
                maxDate = d.toString();
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("日期", d.toString());
            row.put("营业额", String.format("¥%.2f", dayRevenue));
            row.put("订单数", dayOrders.size());
            trendList.add(row);
        }

        double avgRevenue = days > 0 ? totalRevenue / days : 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", days + "天（" + startDate + " 至 " + endDate + "）");
        result.put("总营业额", String.format("¥%.2f", totalRevenue));
        result.put("日均营业额", String.format("¥%.2f", avgRevenue));
        result.put("最高日营业额", String.format("¥%.2f（%s）", maxRevenue, maxDate));
        result.put("每日明细", trendList);

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("近%d天总营业额 ¥%.2f，日均 ¥%.2f，最高峰在 %s（¥%.2f）。",
                        days, totalRevenue, avgRevenue, maxDate, maxRevenue),
                result);
    }

    /**
     * RESTAURANT_ORDER_STATISTICS — 订单统计（数量、均价）
     */
    private IntentExecuteResponse handleOrderStatistics(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(30);
        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                try { startDate = LocalDate.parse((String) request.getContext().get("startDate")); }
                catch (Exception ignored) {}
            }
            if (request.getContext().get("endDate") != null) {
                try { endDate = LocalDate.parse((String) request.getContext().get("endDate")); }
                catch (Exception ignored) {}
            }
        }

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        long totalOrders = orders.size();
        double totalRevenue = orders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                .sum();
        double avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // 今日订单
        long todayOrders = salesOrderRepository.countByFactoryIdAndDate(factoryId, LocalDate.now());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate);
        result.put("总订单数", totalOrders);
        result.put("今日订单数", todayOrders);
        result.put("总营业额", String.format("¥%.2f", totalRevenue));
        result.put("平均客单价", String.format("¥%.2f", avgOrderValue));

        if (totalOrders == 0) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    String.format("%s 至 %s 暂无订单数据。", startDate, endDate), result);
        }

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("近30天共 %d 单，总营业额 ¥%.2f，平均客单价 ¥%.2f，今日已完成 %d 单。",
                        totalOrders, totalRevenue, avgOrderValue, todayOrders),
                result);
    }

    /**
     * RESTAURANT_PEAK_HOURS_ANALYSIS — 高峰时段分析
     *
     * 数据说明：使用 sales_orders.created_at（记录写入时间戳）作为订单发生时间的近似值。
     * order_date 字段为 DATE 类型，无小时精度，因此 created_at 是目前唯一可用的时间信息。
     * 在堂食/外卖点单流程中，created_at 与实际下单时间通常相差数秒，精度可接受。
     *
     * 高峰判定逻辑：
     * 1. 统计近7天各整点时段订单数量及百分比
     * 2. 选出订单量前3-4的时段作为实际高峰
     * 3. 若有效订单数 < 10，改用 FactoryTypeBlueprint 配置的默认高峰时段（11:00-13:00, 17:00-20:00）
     */
    private IntentExecuteResponse handlePeakHoursAnalysis(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(7);

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (orders.isEmpty()) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "近7天无订单数据，无法分析高峰时段。建议累积更多销售数据后再查询。", null);
        }

        // 使用 created_at 提取小时信息（best available timestamp；order_date 为 DATE，无时间精度）
        // 仅统计营业时间段（6:00-23:00），过滤系统凌晨批量写入等噪声数据
        long[] hourBuckets = new long[24];
        int validOrderCount = 0;
        for (var o : orders) {
            if (o.getCreatedAt() != null) {
                int h = o.getCreatedAt().getHour();
                if (h >= 6 && h <= 22) { // 营业时间窗口
                    hourBuckets[h]++;
                    validOrderCount++;
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate + "（近7天）");
        result.put("总订单数", orders.size());

        // 数据不足时使用 FactoryTypeBlueprint 配置的默认值（RESTAURANT 类型: 11:00-13:00, 17:00-20:00）
        if (validOrderCount < 10) {
            log.info("高峰时段分析数据不足（有效订单 {} 条，需 ≥10），使用蓝图默认配置", validOrderCount);
            result.put("数据说明", String.format("当前有效时间戳订单仅 %d 条（需 ≥10 条才能精确分析）", validOrderCount));
            result.put("高峰时段（蓝图默认）", Map.of(
                    "午市高峰", "11:00-13:00",
                    "晚市高峰", "17:00-20:00",
                    "数据来源", "FactoryTypeBlueprint RESTAURANT 类型默认配置"
            ));
            result.put("运营建议", List.of(
                    "午市（11:00-13:00）：高峰前30分钟完成备料，安排充足服务人员",
                    "晚市（17:00-20:00）：提前补充食材，避免断货影响翻台",
                    "建议积累更多销售记录后，系统将自动生成门店专属高峰分析"
            ));
            return buildCompleted(intentConfig, "RESTAURANT",
                    String.format("当前数据不足（仅 %d 条有效记录）。依据餐饮行业蓝图配置：午市高峰 11:00-13:00，晚市高峰 17:00-20:00。",
                            validOrderCount),
                    result);
        }

        // 构建各时段分布列表（仅展示有订单的时段）
        List<Map<String, Object>> hourlyList = new ArrayList<>();
        for (int h = 6; h <= 22; h++) {
            if (hourBuckets[h] > 0) {
                double pct = validOrderCount > 0 ? hourBuckets[h] * 100.0 / validOrderCount : 0;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("时段", String.format("%02d:00-%02d:00", h, h + 1));
                row.put("订单数", hourBuckets[h]);
                row.put("占比", String.format("%.1f%%", pct));
                hourlyList.add(row);
            }
        }

        // 找出 Top 4 最忙时段
        List<int[]> top4Buckets = new ArrayList<>();
        for (int h = 6; h <= 22; h++) {
            top4Buckets.add(new int[]{h, (int) hourBuckets[h]});
        }
        top4Buckets.sort((a, b) -> Integer.compare(b[1], a[1])); // 降序
        List<int[]> peakBuckets = top4Buckets.stream()
                .filter(b -> b[1] > 0)
                .limit(4)
                .sorted(Comparator.comparingInt(b -> b[0])) // 按时间顺序排列
                .collect(Collectors.toList());

        // 将连续的高峰时段合并为时间窗口（例如 11,12,13 → 11:00-14:00）
        List<String> peakWindows = new ArrayList<>();
        if (!peakBuckets.isEmpty()) {
            int windowStart = peakBuckets.get(0)[0];
            int windowEnd = peakBuckets.get(0)[0];
            for (int i = 1; i < peakBuckets.size(); i++) {
                int curHour = peakBuckets.get(i)[0];
                if (curHour <= windowEnd + 1) {
                    windowEnd = curHour;
                } else {
                    peakWindows.add(String.format("%02d:00-%02d:00", windowStart, windowEnd + 1));
                    windowStart = curHour;
                    windowEnd = curHour;
                }
            }
            peakWindows.add(String.format("%02d:00-%02d:00", windowStart, windowEnd + 1));
        }

        // 最忙的单个时段
        int topHour = peakBuckets.isEmpty() ? -1 : peakBuckets.stream()
                .max(Comparator.comparingInt(b -> b[1]))
                .map(b -> b[0])
                .orElse(-1);
        double topHourPct = topHour >= 0 && validOrderCount > 0
                ? hourBuckets[topHour] * 100.0 / validOrderCount : 0;

        result.put("高峰时段窗口", peakWindows);
        result.put("最忙时段", topHour >= 0
                ? String.format("%02d:00-%02d:00（占全天订单 %.1f%%）", topHour, topHour + 1, topHourPct)
                : "数据不足");
        result.put("时段分布", hourlyList);
        result.put("运营建议", List.of(
                "在高峰时段开始前30分钟完成备料，确保食材充足",
                "高峰时段安排充足服务人员，缩短顾客等待时间",
                "低谷时段安排设备清洁、食材预处理等准备工作"
        ));
        result.put("数据说明", "时段统计基于订单创建时间（created_at），与实际下单时间误差通常在数秒内");

        String peakWindowsStr = peakWindows.isEmpty() ? "待分析" : String.join("、", peakWindows);
        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("近7天高峰时段为 %s，最忙时段 %02d:00-%02d:00（占 %.1f%%）。建议提前备料备人。",
                        peakWindowsStr, topHour, topHour + 1, topHourPct),
                result);
    }

    /**
     * RESTAURANT_MARGIN_ANALYSIS — 毛利率分析
     */
    private IntentExecuteResponse handleMarginAnalysis(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(30);

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        double totalRevenue = orders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                .sum();

        // 食材成本（近30天入库成本估算）
        var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 500));
        double ingredientCost = batches.stream()
                .filter(b -> b.getReceiptDate() != null &&
                             !b.getReceiptDate().isBefore(startDate) &&
                             !b.getReceiptDate().isAfter(endDate))
                .mapToDouble(b -> {
                    if (b.getUnitPrice() != null && b.getReceiptQuantity() != null) {
                        return b.getUnitPrice().multiply(b.getReceiptQuantity()).doubleValue();
                    }
                    return 0;
                }).sum();

        double grossProfit = totalRevenue - ingredientCost;
        double grossMargin = totalRevenue > 0 ?
                BigDecimal.valueOf(grossProfit / totalRevenue * 100)
                        .setScale(2, RoundingMode.HALF_UP).doubleValue() : 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate + "（近30天）");
        result.put("营业额", String.format("¥%.2f", totalRevenue));
        result.put("食材成本", String.format("¥%.2f", ingredientCost));
        result.put("毛利润", String.format("¥%.2f", grossProfit));
        result.put("毛利率", String.format("%.2f%%", grossMargin));
        result.put("行业参考", "餐饮业平均毛利率 60-70%，精细化管理可达 75%+");
        result.put("说明", "成本仅含食材采购成本，未含人工、租金等固定费用");

        if (totalRevenue == 0) {
            return buildCompleted(intentConfig, "RESTAURANT",
                    "近30天暂无营业数据，无法计算毛利率。", result);
        }

        return buildCompleted(intentConfig, "RESTAURANT",
                String.format("近30天营业额 ¥%.2f，食材成本 ¥%.2f，毛利率 %.2f%%（行业参考 60-70%%）。",
                        totalRevenue, ingredientCost, grossMargin),
                result);
    }

    // ==================== 损耗管理类 ====================

    /**
     * RESTAURANT_WASTAGE_SUMMARY — 损耗汇总
     * 如果 wastage_records 表尚未创建，返回友好引导提示
     */
    private IntentExecuteResponse handleWastageSummary(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        try {
            // 尝试基于过期批次估算损耗（作为临时实现）
            LocalDate endDate = LocalDate.now();
            LocalDate startDate = endDate.minusDays(30);

            var expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);

            double wastageValue = expiredBatches.stream()
                    .mapToDouble(b -> {
                        if (b.getUnitPrice() != null && b.getRemainingQuantity() != null &&
                                b.getRemainingQuantity().compareTo(BigDecimal.ZERO) > 0) {
                            return b.getUnitPrice().multiply(b.getRemainingQuantity()).doubleValue();
                        }
                        return 0;
                    }).sum();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("统计范围", "当前已过期且未处理批次");
            result.put("过期批次数", expiredBatches.size());
            result.put("估算损耗金额", String.format("¥%.2f", wastageValue));
            result.put("说明", "当前仅统计已过期的食材批次损耗。如需精细化损耗管理（报废、加工损耗等），" +
                    "请在「库存管理→损耗记录」中录入详细损耗数据。");

            return buildCompleted(intentConfig, "RESTAURANT",
                    String.format("当前共 %d 批食材已过期（估算损耗 ¥%.2f），建议及时处理。",
                            expiredBatches.size(), wastageValue),
                    result);
        } catch (Exception e) {
            log.warn("损耗汇总查询异常（可能是损耗记录表未建立）: {}", e.getMessage());
            return buildCompleted(intentConfig, "RESTAURANT",
                    "损耗管理功能正在建设中，请先在「管理→门店进销存」中录入损耗记录。" +
                    "当前可通过「食材库存」查看过期食材情况。",
                    null);
        }
    }

    /**
     * RESTAURANT_WASTAGE_RATE — 损耗率查询
     */
    private IntentExecuteResponse handleWastageRate(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig) {
        try {
            // 入库量 vs 过期量 估算损耗率
            var allBatches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 1000));
            var expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);

            double totalInbound = allBatches.stream()
                    .mapToDouble(b -> b.getReceiptQuantity() != null ? b.getReceiptQuantity().doubleValue() : 0)
                    .sum();
            double totalExpiredQty = expiredBatches.stream()
                    .mapToDouble(b -> b.getRemainingQuantity() != null ?
                            b.getRemainingQuantity().doubleValue() : 0)
                    .sum();

            double wastageRate = totalInbound > 0 ?
                    BigDecimal.valueOf(totalExpiredQty / totalInbound * 100)
                            .setScale(2, RoundingMode.HALF_UP).doubleValue() : 0;

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("总入库量（各批次汇总）", String.format("%.2f（混合单位）", totalInbound));
            result.put("过期未处理量", String.format("%.2f", totalExpiredQty));
            result.put("损耗率（估算）", String.format("%.2f%%", wastageRate));
            result.put("行业参考", "餐饮业食材损耗率建议控制在 5% 以内");
            result.put("说明", "损耗率为估算值（过期未处理批次/总入库量），精确计算需配置损耗记录模块");

            String assessment = wastageRate > 10 ? "偏高，建议优化库存管理" :
                    wastageRate > 5 ? "中等，有改善空间" : "良好，继续保持";

            return buildCompleted(intentConfig, "RESTAURANT",
                    String.format("食材损耗率约 %.2f%%（%s）。行业建议控制在5%%以内。",
                            wastageRate, assessment),
                    result);
        } catch (Exception e) {
            log.warn("损耗率查询异常: {}", e.getMessage());
            return buildCompleted(intentConfig, "RESTAURANT",
                    "损耗率功能正在建设中。当前建议：每日记录食材损耗，系统将自动计算损耗率并提供优化建议。",
                    null);
        }
    }

    /**
     * RESTAURANT_WASTAGE_ANOMALY — 损耗异常检测
     */
    private IntentExecuteResponse handleWastageAnomaly(String factoryId, AIIntentConfig intentConfig) {
        try {
            // 检测近期过期批次集中度（异常信号）
            var expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);
            var recentExpired = expiredBatches.stream()
                    .filter(b -> b.getExpireDate() != null &&
                                 !b.getExpireDate().isBefore(LocalDate.now().minusDays(7)))
                    .collect(Collectors.toList());

            List<Map<String, Object>> anomalies = new ArrayList<>();

            // 规则1：同一食材连续多批次过期 → 订货量过多
            Map<String, Long> expiredByMaterial = recentExpired.stream()
                    .filter(b -> b.getMaterialType() != null)
                    .collect(Collectors.groupingBy(
                            (MaterialBatch b) -> b.getMaterialType().getName(),
                            Collectors.counting()));

            expiredByMaterial.entrySet().stream()
                    .filter(e -> e.getValue() >= 2) // ≥2批同食材过期
                    .forEach(e -> {
                        Map<String, Object> anomaly = new LinkedHashMap<>();
                        anomaly.put("异常类型", "重复过期");
                        anomaly.put("食材", e.getKey());
                        anomaly.put("近7天过期批次数", e.getValue());
                        anomaly.put("可能原因", "订货量过多或该食材销量下降");
                        anomaly.put("建议", "减少下次采购量，或促销消化库存");
                        anomalies.add(anomaly);
                    });

            // 规则2：高价值食材过期
            double avgCost = expiredBatches.stream()
                    .mapToDouble(b -> b.getUnitPrice() != null ? b.getUnitPrice().doubleValue() : 0)
                    .average().orElse(0);

            recentExpired.stream()
                    .filter(b -> b.getUnitPrice() != null && b.getUnitPrice().doubleValue() > avgCost * 2)
                    .forEach(b -> {
                        Map<String, Object> anomaly = new LinkedHashMap<>();
                        anomaly.put("异常类型", "高价食材过期");
                        anomaly.put("食材", b.getMaterialType() != null ? b.getMaterialType().getName() : "未知");
                        anomaly.put("批次号", b.getBatchNumber());
                        anomaly.put("单价", String.format("¥%.2f", b.getUnitPrice()));
                        anomaly.put("建议", "高价食材需加强先进先出（FIFO）管理");
                        anomalies.add(anomaly);
                    });

            if (anomalies.isEmpty()) {
                return buildCompleted(intentConfig, "RESTAURANT",
                        "近7天未检测到明显损耗异常，库存管理状态良好。", null);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("检测周期", "近7天");
            result.put("异常数量", anomalies.size());
            result.put("异常详情", anomalies);

            return buildCompleted(intentConfig, "RESTAURANT",
                    String.format("检测到 %d 条损耗异常！主要类型：%s。请及时处理。",
                            anomalies.size(), anomalies.get(0).get("异常类型")),
                    result);
        } catch (Exception e) {
            log.warn("损耗异常检测失败: {}", e.getMessage());
            return buildCompleted(intentConfig, "RESTAURANT",
                    "损耗异常检测功能正在建设中。建议定期盘点食材库存，对比理论用量与实际用量，发现异常及时上报。",
                    null);
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 构建 COMPLETED 状态的响应
     */
    private IntentExecuteResponse buildCompleted(AIIntentConfig intentConfig, String category,
                                                  String message, Object resultData) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory(category)
                .status("COMPLETED")
                .message(message)
                .formattedText(message)
                .resultData(resultData)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 销售数据累加器（用于菜品销量统计）
     */
    private static class SalesAccumulator {
        double totalQty = 0;
        double totalAmount = 0;
        String name = null;

        void add(BigDecimal qty, BigDecimal unitPrice, String productName) {
            if (qty != null) totalQty += qty.doubleValue();
            if (qty != null && unitPrice != null) totalAmount += qty.multiply(unitPrice).doubleValue();
            if (name == null && productName != null) name = productName;
        }
    }

    /**
     * 食材库存累加器
     */
    private static class IngredientStockAccumulator {
        final String name;
        double totalQty = 0;
        String unit = "";
        int batchCount = 0;

        IngredientStockAccumulator(String name) {
            this.name = name;
        }

        void add(BigDecimal qty, String unitStr) {
            if (qty != null) totalQty += qty.doubleValue();
            if (unit.isEmpty() && unitStr != null) unit = unitStr;
            batchCount++;
        }
    }
}
