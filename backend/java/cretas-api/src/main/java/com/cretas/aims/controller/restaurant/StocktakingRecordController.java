package com.cretas.aims.controller.restaurant;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.restaurant.StocktakingRecord;
import com.cretas.aims.repository.restaurant.StocktakingRecordRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 库存盘点管理 Controller
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/restaurant/stocktaking")
@RequiredArgsConstructor
@Tag(name = "餐饮-盘点管理")
public class StocktakingRecordController {

    private final StocktakingRecordRepository stocktakingRepository;

    // ==================== 列表查询 ====================

    @GetMapping
    @Operation(summary = "盘点记录列表", description = "支持按状态筛选")
    public ApiResponse<Page<StocktakingRecord>> list(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(Math.max(0, page - 1), size);

        if (status != null) {
            StocktakingRecord.Status s = StocktakingRecord.Status.valueOf(status);
            return ApiResponse.success(
                    stocktakingRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, s, pageable));
        }
        return ApiResponse.success(
                stocktakingRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable));
    }

    // ==================== 详情 ====================

    @GetMapping("/{recordId}")
    @Operation(summary = "盘点记录详情")
    public ApiResponse<StocktakingRecord> detail(
            @PathVariable String factoryId,
            @PathVariable String recordId) {
        return stocktakingRepository.findByIdAndFactoryId(recordId, factoryId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("盘点记录不存在: " + recordId));
    }

    // ==================== 创建 ====================

    @PostMapping
    @Operation(summary = "创建盘点单", description = "创建食材盘点单，自动读取系统库存")
    public ApiResponse<StocktakingRecord> create(
            @PathVariable String factoryId,
            @RequestAttribute("userId") @Parameter(hidden = true) Long userId,
            @RequestBody @Valid StocktakingRecord record) {
        log.info("创建盘点单: factoryId={}, materialId={}", factoryId, record.getRawMaterialTypeId());

        // 检查是否已有该食材的进行中盘点
        if (stocktakingRepository.existsByFactoryIdAndRawMaterialTypeIdAndStatus(
                factoryId, record.getRawMaterialTypeId(), StocktakingRecord.Status.IN_PROGRESS)) {
            return ApiResponse.error("该食材已有进行中的盘点单，请先完成或取消");
        }

        record.setId(null);
        record.setFactoryId(factoryId);
        record.setCountedBy(userId);
        record.setStatus(StocktakingRecord.Status.IN_PROGRESS);
        if (record.getStocktakingDate() == null) {
            record.setStocktakingDate(LocalDate.now());
        }

        // 自动生成单号
        long todayCount = stocktakingRepository.countByFactoryIdAndDate(factoryId, record.getStocktakingDate());
        String dateStr = record.getStocktakingDate().toString().replace("-", "");
        record.setStocktakingNumber(String.format("STK-%s-%03d", dateStr, todayCount + 1));

        StocktakingRecord saved = stocktakingRepository.save(record);
        return ApiResponse.success("盘点单创建成功", saved);
    }

    // ==================== 完成盘点 ====================

    @PostMapping("/{recordId}/complete")
    @Operation(summary = "完成盘点", description = "录入实盘数量并计算差异")
    public ApiResponse<StocktakingRecord> complete(
            @PathVariable String factoryId,
            @PathVariable String recordId,
            @RequestAttribute("userId") @Parameter(hidden = true) Long userId,
            @RequestBody Map<String, Object> body) {
        return stocktakingRepository.findByIdAndFactoryId(recordId, factoryId)
                .map(record -> {
                    if (record.getStatus() != StocktakingRecord.Status.IN_PROGRESS) {
                        return ApiResponse.<StocktakingRecord>error("只有进行中的盘点单可以完成");
                    }
                    if (body == null || !body.containsKey("actualQuantity")) {
                        return ApiResponse.<StocktakingRecord>error("请填写实盘数量 (actualQuantity)");
                    }

                    record.setActualQuantity(new BigDecimal(body.get("actualQuantity").toString()));
                    record.setVerifiedBy(userId);
                    record.setCompletedAt(LocalDateTime.now());
                    record.setStatus(StocktakingRecord.Status.COMPLETED);

                    if (body.containsKey("adjustmentReason")) {
                        record.setAdjustmentReason(body.get("adjustmentReason").toString());
                    }

                    // 自动计算差异
                    record.calculateDifference();

                    StocktakingRecord updated = stocktakingRepository.save(record);
                    return ApiResponse.success("盘点完成", updated);
                })
                .orElse(ApiResponse.error("盘点记录不存在: " + recordId));
    }

    // ==================== 取消 ====================

    @PostMapping("/{recordId}/cancel")
    @Operation(summary = "取消盘点")
    public ApiResponse<StocktakingRecord> cancel(
            @PathVariable String factoryId,
            @PathVariable String recordId) {
        return stocktakingRepository.findByIdAndFactoryId(recordId, factoryId)
                .map(record -> {
                    if (record.getStatus() != StocktakingRecord.Status.IN_PROGRESS) {
                        return ApiResponse.<StocktakingRecord>error("只有进行中的盘点单可以取消");
                    }
                    record.setStatus(StocktakingRecord.Status.CANCELLED);
                    StocktakingRecord updated = stocktakingRepository.save(record);
                    return ApiResponse.success("盘点已取消", updated);
                })
                .orElse(ApiResponse.error("盘点记录不存在: " + recordId));
    }

    // ==================== 最新盘点汇总 ====================

    @GetMapping("/latest-summary")
    @Operation(summary = "最新盘点汇总", description = "最近一次完成盘点的差异统计")
    public ApiResponse<Map<String, Object>> latestSummary(@PathVariable String factoryId) {
        Optional<LocalDate> latestDate = stocktakingRepository.findLatestCompletedDate(factoryId);
        if (latestDate.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("latestDate", null);
            empty.put("message", "暂无已完成的盘点记录");
            return ApiResponse.success(empty);
        }

        LocalDate date = latestDate.get();
        List<Object[]> summaryRows = stocktakingRepository.getSummaryByDate(factoryId, date);

        List<Map<String, Object>> items = summaryRows.stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("differenceType", row[0]);
            m.put("count", row[1]);
            m.put("totalDifferenceAmount", row[2]);
            return m;
        }).collect(Collectors.toList());

        // 最近几条完成的盘点明细
        List<StocktakingRecord> latestRecords = stocktakingRepository.findLatestCompleted(
                factoryId, PageRequest.of(0, 10));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("latestDate", date.toString());
        result.put("summary", items);
        result.put("recentRecords", latestRecords);
        return ApiResponse.success(result);
    }
}
