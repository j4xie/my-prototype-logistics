package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.MaterialConsumption;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.MaterialConsumptionRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 原材料消耗记录控制器
 *
 * 提供原材料消耗记录的查询功能
 * 路径：/api/mobile/{factoryId}/processing/material-consumptions
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-23
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/processing/material-consumptions")
@RequiredArgsConstructor
@Tag(name = "原材料消耗记录管理", description = "原材料消耗记录查询API")
public class MaterialConsumptionController {

    private final MaterialConsumptionRepository consumptionRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final UserRepository userRepository;

    /**
     * 1. 获取消耗记录列表（分页）
     */
    @GetMapping
    @Operation(summary = "获取消耗记录列表", description = "分页查询原材料消耗记录")
    public ApiResponse<PageResponse<Map<String, Object>>> getConsumptions(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "生产批次ID") Long productionBatchId,
            @RequestParam(required = false) @Parameter(description = "原材料批次ID") String batchId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") int page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页数量") int size) {

        log.info("获取消耗记录列表: factoryId={}, productionBatchId={}, batchId={}",
                factoryId, productionBatchId, batchId);

        List<MaterialConsumption> consumptions = consumptionRepository.findByFactoryId(factoryId);

        // 过滤
        if (productionBatchId != null) {
            consumptions = consumptions.stream()
                    .filter(c -> productionBatchId.equals(c.getProductionBatchId()))
                    .collect(Collectors.toList());
        }
        if (batchId != null) {
            consumptions = consumptions.stream()
                    .filter(c -> batchId.equals(c.getBatchId()))
                    .collect(Collectors.toList());
        }

        // 排序（按消耗时间倒序）
        consumptions.sort((a, b) -> {
            if (a.getConsumptionTime() == null) return 1;
            if (b.getConsumptionTime() == null) return -1;
            return b.getConsumptionTime().compareTo(a.getConsumptionTime());
        });

        // 分页
        int totalElements = consumptions.size();
        int totalPages = (int) Math.ceil((double) totalElements / size);
        int fromIndex = (page - 1) * size;
        int toIndex = Math.min(fromIndex + size, totalElements);

        List<MaterialConsumption> pageContent = fromIndex < totalElements
                ? consumptions.subList(fromIndex, toIndex)
                : Collections.emptyList();

        // 转换为 Map 并添加额外信息
        List<Map<String, Object>> enrichedContent = enrichConsumptions(pageContent);

        PageResponse<Map<String, Object>> pageResponse = new PageResponse<>();
        pageResponse.setContent(enrichedContent);
        pageResponse.setTotalElements((long) totalElements);
        pageResponse.setTotalPages(totalPages);
        pageResponse.setSize(size);
        pageResponse.setPage(page);
        pageResponse.setCurrentPage(page);
        pageResponse.setFirst(page == 1);
        pageResponse.setLast(page >= totalPages);

        return ApiResponse.success(pageResponse);
    }

    /**
     * 2. 获取单条消耗记录详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取消耗记录详情", description = "根据ID获取单条消耗记录")
    public ApiResponse<Map<String, Object>> getConsumptionById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "记录ID") Integer id) {

        log.info("获取消耗记录详情: factoryId={}, id={}", factoryId, id);

        Optional<MaterialConsumption> optConsumption = consumptionRepository.findById(id);
        if (optConsumption.isEmpty()) {
            return ApiResponse.error(404, "消耗记录不存在");
        }

        MaterialConsumption consumption = optConsumption.get();
        if (!factoryId.equals(consumption.getFactoryId())) {
            return ApiResponse.error(403, "无权访问该记录");
        }

        Map<String, Object> enriched = enrichConsumption(consumption);
        return ApiResponse.success(enriched);
    }

    /**
     * 3. 获取生产批次的消耗记录
     */
    @GetMapping("/batch/{productionBatchId}")
    @Operation(summary = "获取生产批次的消耗记录", description = "根据生产批次ID查询所有消耗记录")
    public ApiResponse<List<Map<String, Object>>> getConsumptionsByBatch(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "生产批次ID") Long productionBatchId) {

        log.info("获取生产批次消耗记录: factoryId={}, productionBatchId={}", factoryId, productionBatchId);

        List<MaterialConsumption> consumptions = consumptionRepository.findByProductionBatchId(productionBatchId);

        // 过滤只属于该工厂的记录
        consumptions = consumptions.stream()
                .filter(c -> factoryId.equals(c.getFactoryId()))
                .collect(Collectors.toList());

        List<Map<String, Object>> enriched = enrichConsumptions(consumptions);
        return ApiResponse.success(enriched);
    }

    /**
     * 4. 获取原材料批次的消耗记录
     */
    @GetMapping("/material-batch/{batchId}")
    @Operation(summary = "获取原材料批次的消耗记录", description = "根据原材料批次ID查询所有消耗记录")
    public ApiResponse<List<Map<String, Object>>> getConsumptionsByMaterialBatch(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "原材料批次ID") String batchId) {

        log.info("获取原材料批次消耗记录: factoryId={}, batchId={}", factoryId, batchId);

        List<MaterialConsumption> all = consumptionRepository.findByFactoryId(factoryId);
        List<MaterialConsumption> consumptions = all.stream()
                .filter(c -> batchId.equals(c.getBatchId()))
                .collect(Collectors.toList());

        List<Map<String, Object>> enriched = enrichConsumptions(consumptions);
        return ApiResponse.success(enriched);
    }

    /**
     * 5. 获取时间范围内的消耗记录
     */
    @GetMapping("/time-range")
    @Operation(summary = "获取时间范围消耗记录", description = "根据时间范围查询消耗记录")
    public ApiResponse<List<Map<String, Object>>> getConsumptionsByTimeRange(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "开始日期")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @Parameter(description = "结束日期")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        log.info("获取时间范围消耗记录: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);

        LocalDateTime startTime = startDate.atStartOfDay();
        LocalDateTime endTime = endDate.atTime(LocalTime.MAX);

        List<MaterialConsumption> consumptions = consumptionRepository.findByTimeRange(
                factoryId, startTime, endTime);

        List<Map<String, Object>> enriched = enrichConsumptions(consumptions);
        return ApiResponse.success(enriched);
    }

    /**
     * 6. 获取消耗统计
     */
    @GetMapping("/stats")
    @Operation(summary = "获取消耗统计", description = "获取原材料消耗统计数据")
    public ApiResponse<Map<String, Object>> getConsumptionStats(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "生产批次ID") Long productionBatchId,
            @RequestParam(required = false) @Parameter(description = "开始日期")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @Parameter(description = "结束日期")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        log.info("获取消耗统计: factoryId={}, productionBatchId={}", factoryId, productionBatchId);

        List<MaterialConsumption> consumptions;

        if (startDate != null && endDate != null) {
            LocalDateTime startTime = startDate.atStartOfDay();
            LocalDateTime endTime = endDate.atTime(LocalTime.MAX);
            consumptions = consumptionRepository.findByTimeRange(factoryId, startTime, endTime);
        } else {
            consumptions = consumptionRepository.findByFactoryId(factoryId);
        }

        if (productionBatchId != null) {
            consumptions = consumptions.stream()
                    .filter(c -> productionBatchId.equals(c.getProductionBatchId()))
                    .collect(Collectors.toList());
        }

        // 计算统计
        BigDecimal totalQuantity = consumptions.stream()
                .map(MaterialConsumption::getQuantity)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCost = consumptions.stream()
                .map(MaterialConsumption::getTotalCost)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 按材料类型分组统计（优化：批量查询避免 N+1）
        Set<String> batchIds = consumptions.stream()
                .map(MaterialConsumption::getBatchId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, MaterialBatch> batchMap = batchIds.isEmpty() ? Collections.emptyMap() :
                materialBatchRepository.findAllById(batchIds).stream()
                        .collect(Collectors.toMap(MaterialBatch::getId, Function.identity()));

        Map<String, Map<String, BigDecimal>> byMaterialType = new HashMap<>();
        for (MaterialConsumption c : consumptions) {
            String batchId = c.getBatchId();
            if (batchId != null) {
                MaterialBatch batch = batchMap.get(batchId);
                String materialTypeName = (batch != null && batch.getMaterialTypeId() != null)
                        ? batch.getMaterialTypeId() : "未知材料";

                byMaterialType.computeIfAbsent(materialTypeName, k -> {
                    Map<String, BigDecimal> m = new HashMap<>();
                    m.put("quantity", BigDecimal.ZERO);
                    m.put("cost", BigDecimal.ZERO);
                    return m;
                });

                Map<String, BigDecimal> stats = byMaterialType.get(materialTypeName);
                if (c.getQuantity() != null) {
                    stats.put("quantity", stats.get("quantity").add(c.getQuantity()));
                }
                if (c.getTotalCost() != null) {
                    stats.put("cost", stats.get("cost").add(c.getTotalCost()));
                }
            }
        }

        List<Map<String, Object>> byMaterialTypeList = byMaterialType.entrySet().stream()
                .map(e -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("materialTypeName", e.getKey());
                    item.put("quantity", e.getValue().get("quantity"));
                    item.put("cost", e.getValue().get("cost"));
                    return item;
                })
                .collect(Collectors.toList());

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalQuantity", totalQuantity);
        stats.put("totalCost", totalCost);
        stats.put("consumptionCount", consumptions.size());
        stats.put("byMaterialType", byMaterialTypeList);

        return ApiResponse.success(stats);
    }

    /**
     * 7. 获取生产批次的消耗成本汇总
     */
    @GetMapping("/batch/{productionBatchId}/cost")
    @Operation(summary = "获取批次消耗成本", description = "获取生产批次的原材料消耗成本汇总")
    public ApiResponse<Map<String, Object>> getBatchConsumptionCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "生产批次ID") Long productionBatchId) {

        log.info("获取批次消耗成本: factoryId={}, productionBatchId={}", factoryId, productionBatchId);

        List<MaterialConsumption> consumptions = consumptionRepository.findByProductionBatchId(productionBatchId);

        // 过滤只属于该工厂的记录
        consumptions = consumptions.stream()
                .filter(c -> factoryId.equals(c.getFactoryId()))
                .collect(Collectors.toList());

        BigDecimal totalCost = consumptions.stream()
                .map(MaterialConsumption::getTotalCost)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalQuantity = consumptions.stream()
                .map(MaterialConsumption::getQuantity)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new HashMap<>();
        result.put("totalCost", totalCost);
        result.put("totalQuantity", totalQuantity);
        result.put("recordCount", consumptions.size());

        return ApiResponse.success(result);
    }

    // ========== 辅助方法 ==========

    /**
     * 丰富消耗记录列表（添加关联信息）
     * 优化：使用批量查询避免 N+1 问题
     */
    private List<Map<String, Object>> enrichConsumptions(List<MaterialConsumption> consumptions) {
        if (consumptions.isEmpty()) {
            return Collections.emptyList();
        }

        // 批量查询原材料批次信息
        Set<String> batchIds = consumptions.stream()
                .map(MaterialConsumption::getBatchId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, MaterialBatch> batchMap = batchIds.isEmpty() ? Collections.emptyMap() :
                materialBatchRepository.findAllById(batchIds).stream()
                        .collect(Collectors.toMap(MaterialBatch::getId, Function.identity()));

        // 批量查询记录人信息
        Set<Long> userIds = consumptions.stream()
                .map(MaterialConsumption::getRecordedBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, User> userMap = userIds.isEmpty() ? Collections.emptyMap() :
                userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity()));

        // 使用预加载的 Map 进行丰富
        return consumptions.stream()
                .map(c -> enrichConsumptionWithMaps(c, batchMap, userMap))
                .collect(Collectors.toList());
    }

    /**
     * 丰富单条消耗记录（添加关联信息）
     * 用于单条记录查询场景
     * 注意：单条记录查询场景下，直接查询是可接受的，因为只有 1-2 次查询
     */
    private Map<String, Object> enrichConsumption(MaterialConsumption c) {
        // 对于单条记录，使用 enrichConsumptions 批量方法以保持一致性
        List<Map<String, Object>> result = enrichConsumptions(Collections.singletonList(c));
        return result.isEmpty() ? new HashMap<>() : result.get(0);
    }

    /**
     * 使用预加载的 Map 丰富消耗记录
     */
    private Map<String, Object> enrichConsumptionWithMaps(
            MaterialConsumption c,
            Map<String, MaterialBatch> batchMap,
            Map<Long, User> userMap) {

        Map<String, Object> map = new HashMap<>();
        map.put("id", c.getId());
        map.put("factoryId", c.getFactoryId());
        map.put("productionPlanId", c.getProductionPlanId());
        map.put("productionBatchId", c.getProductionBatchId());
        map.put("batchId", c.getBatchId());
        map.put("quantity", c.getQuantity());
        map.put("unitPrice", c.getUnitPrice());
        map.put("totalCost", c.getTotalCost());
        map.put("consumptionTime", c.getConsumptionTime());
        map.put("consumedAt", c.getConsumedAt());
        map.put("recordedBy", c.getRecordedBy());
        map.put("notes", c.getNotes());
        map.put("createdAt", c.getCreatedAt());
        map.put("updatedAt", c.getUpdatedAt());

        // 添加原材料批次名称（从预加载的 Map 中获取）
        if (c.getBatchId() != null) {
            MaterialBatch batch = batchMap.get(c.getBatchId());
            if (batch != null) {
                map.put("batchNumber", batch.getBatchNumber());
                map.put("materialTypeId", batch.getMaterialTypeId());
            }
        }

        // 添加记录人名称（从预加载的 Map 中获取）
        if (c.getRecordedBy() != null) {
            User user = userMap.get(c.getRecordedBy());
            if (user != null) {
                map.put("recorderName", user.getFullName() != null ? user.getFullName() : user.getUsername());
            }
        }

        return map;
    }
}
