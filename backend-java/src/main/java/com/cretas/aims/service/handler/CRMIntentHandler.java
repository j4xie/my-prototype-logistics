package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.customer.CustomerDTO;
import com.cretas.aims.dto.supplier.SupplierDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.CustomerService;
import com.cretas.aims.service.SupplierService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 客户/供应商意图处理器
 *
 * 处理 CRM 分类的意图:
 * - CUSTOMER_LIST: 客户列表
 * - CUSTOMER_SEARCH: 客户搜索
 * - CUSTOMER_STATS: 客户统计
 * - CUSTOMER_BY_TYPE: 按类型查询客户
 * - CUSTOMER_ACTIVE: 活跃客户
 * - CUSTOMER_PURCHASE_HISTORY: 客户购买历史
 * - SUPPLIER_LIST: 供应商列表
 * - SUPPLIER_SEARCH: 供应商搜索
 * - SUPPLIER_EVALUATE: 供应商评估
 * - SUPPLIER_BY_CATEGORY: 按类别供应商
 * - SUPPLIER_ACTIVE: 活跃供应商
 * - SUPPLIER_RANKING: 供应商排名
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CRMIntentHandler implements IntentHandler {

    private final CustomerService customerService;
    private final SupplierService supplierService;

    @Override
    public String getSupportedCategory() {
        return "CRM";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("CRMIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                // 客户相关
                case "CUSTOMER_LIST" -> handleCustomerList(factoryId, request, intentConfig);
                case "CUSTOMER_SEARCH" -> handleCustomerSearch(factoryId, request, intentConfig);
                case "CUSTOMER_STATS" -> handleCustomerStats(factoryId, intentConfig);
                case "CUSTOMER_BY_TYPE" -> handleCustomerByType(factoryId, request, intentConfig);
                case "CUSTOMER_ACTIVE" -> handleActiveCustomers(factoryId, intentConfig);
                case "CUSTOMER_PURCHASE_HISTORY" -> handleCustomerPurchaseHistory(factoryId, request, intentConfig);
                // 供应商相关
                case "SUPPLIER_LIST" -> handleSupplierList(factoryId, request, intentConfig);
                case "SUPPLIER_SEARCH" -> handleSupplierSearch(factoryId, request, intentConfig);
                case "SUPPLIER_EVALUATE" -> handleSupplierEvaluate(factoryId, request, intentConfig);
                case "SUPPLIER_BY_CATEGORY" -> handleSupplierByCategory(factoryId, request, intentConfig);
                case "SUPPLIER_ACTIVE" -> handleActiveSuppliers(factoryId, intentConfig);
                case "SUPPLIER_RANKING" -> handleSupplierRanking(factoryId, request, intentConfig);
                default -> {
                    log.warn("未知的CRM意图: {}", intentCode);
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("CRM")
                            .status("FAILED")
                            .message("暂不支持此客户/供应商操作: " + intentCode)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };

        } catch (Exception e) {
            log.error("CRMIntentHandler处理失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CRM")
                    .status("FAILED")
                    .message("客户/供应商操作失败: " + e.getMessage())
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    // ======================== 客户相关 ========================

    /**
     * 客户列表
     */
    private IntentExecuteResponse handleCustomerList(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        int page = 1;
        int size = 20;

        if (request.getContext() != null) {
            page = (int) request.getContext().getOrDefault("page", 1);
            size = (int) request.getContext().getOrDefault("size", 20);
        }

        PageRequest pageRequest = PageRequest.of(page, size);
        PageResponse<CustomerDTO> customers = customerService.getCustomerList(factoryId, pageRequest);

        Map<String, Object> result = new HashMap<>();
        result.put("customers", customers.getContent());
        result.put("total", customers.getTotalElements());
        result.put("page", page);
        result.put("size", size);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("查询到 " + customers.getTotalElements() + " 个客户")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 客户搜索
     */
    private IntentExecuteResponse handleCustomerSearch(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("keyword") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CRM")
                    .status("NEED_INPUT")
                    .message("请提供搜索关键词 (keyword)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String keyword = (String) request.getContext().get("keyword");
        List<CustomerDTO> customers = customerService.searchCustomersByName(factoryId, keyword);

        Map<String, Object> result = new HashMap<>();
        result.put("customers", customers);
        result.put("keyword", keyword);
        result.put("total", customers.size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("搜索到 " + customers.size() + " 个客户")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 客户统计
     */
    private IntentExecuteResponse handleCustomerStats(String factoryId, AIIntentConfig intentConfig) {
        // 获取客户列表并计算统计信息
        PageRequest pageRequest = PageRequest.of(1, 1000); // 获取所有客户
        PageResponse<CustomerDTO> allCustomers = customerService.getCustomerList(factoryId, pageRequest);
        List<CustomerDTO> activeCustomers = customerService.getActiveCustomers(factoryId);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCustomers", allCustomers.getTotalElements());
        stats.put("activeCustomers", activeCustomers.size());
        stats.put("inactiveCustomers", allCustomers.getTotalElements() - activeCustomers.size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("客户统计：总计 " + allCustomers.getTotalElements() + " 个，活跃 " + activeCustomers.size() + " 个")
                .resultData(stats)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 按类型查询客户
     */
    private IntentExecuteResponse handleCustomerByType(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("type") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CRM")
                    .status("NEED_INPUT")
                    .message("请提供客户类型 (type)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String type = (String) request.getContext().get("type");
        List<CustomerDTO> customers = customerService.getCustomersByType(factoryId, type);

        Map<String, Object> result = new HashMap<>();
        result.put("customers", customers);
        result.put("type", type);
        result.put("total", customers.size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("类型[" + type + "]客户共 " + customers.size() + " 个")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 活跃客户
     */
    private IntentExecuteResponse handleActiveCustomers(String factoryId, AIIntentConfig intentConfig) {
        List<CustomerDTO> customers = customerService.getActiveCustomers(factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("customers", customers);
        result.put("total", customers.size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("活跃客户共 " + customers.size() + " 个")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 客户购买历史
     */
    private IntentExecuteResponse handleCustomerPurchaseHistory(String factoryId, IntentExecuteRequest request,
                                                                  AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("customerId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CRM")
                    .status("NEED_INPUT")
                    .message("请提供客户ID (customerId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String customerId = (String) request.getContext().get("customerId");
        List<Map<String, Object>> history = customerService.getCustomerPurchaseHistory(factoryId, customerId);

        Map<String, Object> result = new HashMap<>();
        result.put("customerId", customerId);
        result.put("history", history);
        result.put("totalRecords", history.size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("查询到 " + history.size() + " 条购买记录")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ======================== 供应商相关 ========================

    /**
     * 供应商列表
     */
    private IntentExecuteResponse handleSupplierList(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        int page = 1;
        int size = 20;

        if (request.getContext() != null) {
            page = (int) request.getContext().getOrDefault("page", 1);
            size = (int) request.getContext().getOrDefault("size", 20);
        }

        PageRequest pageRequest = PageRequest.of(page, size);
        PageResponse<SupplierDTO> suppliers = supplierService.getSupplierList(factoryId, pageRequest);

        Map<String, Object> result = new HashMap<>();
        result.put("suppliers", suppliers.getContent());
        result.put("total", suppliers.getTotalElements());
        result.put("page", page);
        result.put("size", size);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("查询到 " + suppliers.getTotalElements() + " 个供应商")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 供应商搜索
     */
    private IntentExecuteResponse handleSupplierSearch(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("keyword") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CRM")
                    .status("NEED_INPUT")
                    .message("请提供搜索关键词 (keyword)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String keyword = (String) request.getContext().get("keyword");
        List<SupplierDTO> suppliers = supplierService.searchSuppliersByName(factoryId, keyword);

        Map<String, Object> result = new HashMap<>();
        result.put("suppliers", suppliers);
        result.put("keyword", keyword);
        result.put("total", suppliers.size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("搜索到 " + suppliers.size() + " 个供应商")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 供应商评估
     */
    private IntentExecuteResponse handleSupplierEvaluate(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig) {
        // 获取所有活跃供应商并按评分排序
        List<SupplierDTO> suppliers = supplierService.getActiveSuppliers(factoryId);

        // 按评分降序排序
        List<SupplierDTO> evaluated = suppliers.stream()
                .filter(s -> s.getRating() != null)
                .sorted(Comparator.comparing(SupplierDTO::getRating).reversed())
                .toList();

        // 计算平均评分
        double avgRating = evaluated.stream()
                .mapToInt(SupplierDTO::getRating)
                .average()
                .orElse(0.0);

        // 统计各评级数量
        long highRating = evaluated.stream().filter(s -> s.getRating() >= 4).count();
        long mediumRating = evaluated.stream().filter(s -> s.getRating() >= 2 && s.getRating() < 4).count();
        long lowRating = evaluated.stream().filter(s -> s.getRating() < 2).count();

        Map<String, Object> result = new HashMap<>();
        result.put("suppliers", evaluated);
        result.put("total", evaluated.size());
        result.put("averageRating", String.format("%.2f", avgRating));
        result.put("highRatingCount", highRating);
        result.put("mediumRatingCount", mediumRating);
        result.put("lowRatingCount", lowRating);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("供应商评估完成，平均评分: " + String.format("%.2f", avgRating))
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 按类别查询供应商
     */
    private IntentExecuteResponse handleSupplierByCategory(String factoryId, IntentExecuteRequest request,
                                                             AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("materialType") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("CRM")
                    .status("NEED_INPUT")
                    .message("请提供原料类型 (materialType)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String materialType = (String) request.getContext().get("materialType");
        List<SupplierDTO> suppliers = supplierService.getSuppliersByMaterialType(factoryId, materialType);

        Map<String, Object> result = new HashMap<>();
        result.put("suppliers", suppliers);
        result.put("materialType", materialType);
        result.put("total", suppliers.size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("原料类型[" + materialType + "]供应商共 " + suppliers.size() + " 个")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 活跃供应商
     */
    private IntentExecuteResponse handleActiveSuppliers(String factoryId, AIIntentConfig intentConfig) {
        List<SupplierDTO> suppliers = supplierService.getActiveSuppliers(factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("suppliers", suppliers);
        result.put("total", suppliers.size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("活跃供应商共 " + suppliers.size() + " 个")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 供应商排名
     */
    private IntentExecuteResponse handleSupplierRanking(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig) {
        int limit = 10;
        if (request.getContext() != null) {
            limit = (int) request.getContext().getOrDefault("limit", 10);
        }

        List<SupplierDTO> suppliers = supplierService.getActiveSuppliers(factoryId);

        // 按总订单金额排序
        List<Map<String, Object>> ranking = suppliers.stream()
                .filter(s -> s.getTotalAmount() != null)
                .sorted(Comparator.comparing(SupplierDTO::getTotalAmount).reversed())
                .limit(limit)
                .map(s -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("supplierId", s.getId());
                    item.put("name", s.getName());
                    item.put("suppliedMaterials", s.getSuppliedMaterials());
                    item.put("rating", s.getRating());
                    item.put("totalOrders", s.getTotalOrders());
                    item.put("totalAmount", s.getTotalAmount());
                    return item;
                })
                .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("ranking", ranking);
        result.put("limit", limit);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CRM")
                .status("COMPLETED")
                .message("供应商排名 TOP " + ranking.size())
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .status("PREVIEW")
                .message("客户/供应商意图预览功能")
                .executedAt(LocalDateTime.now())
                .build();
    }
}
