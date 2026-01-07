package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.traceability.TraceabilityDTO;
import com.cretas.aims.entity.ShipmentRecord;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.ShipmentRecordService;
import com.cretas.aims.service.TraceabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import com.cretas.aims.util.ErrorSanitizer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 出货与溯源意图处理器
 *
 * 处理 SHIPMENT 分类的意图:
 * - SHIPMENT_CREATE: 创建出货记录
 * - SHIPMENT_QUERY: 查询出货记录
 * - SHIPMENT_UPDATE: 更新出货信息
 * - SHIPMENT_STATUS_UPDATE: 更新出货状态
 * - SHIPMENT_STATS: 出货统计
 * - TRACE_BATCH: 批次溯源查询
 * - TRACE_FULL: 完整链路溯源
 * - TRACE_PUBLIC: 公开溯源查询
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ShipmentIntentHandler implements IntentHandler {

    private final ShipmentRecordService shipmentRecordService;
    private final TraceabilityService traceabilityService;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    public String getSupportedCategory() {
        return "SHIPMENT";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("ShipmentIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "SHIPMENT_CREATE" -> handleShipmentCreate(factoryId, request, intentConfig, userId);
                case "SHIPMENT_QUERY" -> handleShipmentQuery(factoryId, request, intentConfig);
                case "SHIPMENT_UPDATE" -> handleShipmentUpdate(factoryId, request, intentConfig, userId);
                case "SHIPMENT_STATUS_UPDATE" -> handleStatusUpdate(factoryId, request, intentConfig, userId);
                case "SHIPMENT_STATS" -> handleShipmentStats(factoryId, intentConfig);
                case "SHIPMENT_BY_CUSTOMER" -> handleQueryByCustomer(factoryId, request, intentConfig);
                case "SHIPMENT_BY_DATE" -> handleQueryByDateRange(factoryId, request, intentConfig);
                case "TRACE_BATCH" -> handleTraceBatch(factoryId, request, intentConfig);
                case "TRACE_FULL" -> handleTraceFull(factoryId, request, intentConfig);
                case "TRACE_PUBLIC" -> handleTracePublic(request, intentConfig);
                default -> {
                    log.warn("未知的SHIPMENT意图: {}", intentCode);
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("SHIPMENT")
                            .status("FAILED")
                            .message("暂不支持此出货操作: " + intentCode)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };

        } catch (Exception e) {
            log.error("ShipmentIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .status("FAILED")
                    .message("执行失败: " + ErrorSanitizer.sanitize(e))
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 创建出货记录
     */
    private IntentExecuteResponse handleShipmentCreate(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig, Long userId) {
        if (request.getContext() == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供出货信息。\n必填: customerId, productName, quantity, unit\n" +
                            "可选: unitPrice, shipmentDate, deliveryAddress, logisticsCompany, trackingNumber")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        Map<String, Object> ctx = request.getContext();

        // 必填字段检查
        String customerId = getStringFromContext(ctx, "customerId");
        String productName = getStringFromContext(ctx, "productName");
        BigDecimal quantity = getBigDecimalFromContext(ctx, "quantity");
        String unit = getStringFromContext(ctx, "unit");

        if (customerId == null || productName == null || quantity == null || unit == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("缺少必填字段。需要: customerId, productName, quantity, unit")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 构建出货记录
        ShipmentRecord shipment = new ShipmentRecord();
        shipment.setFactoryId(factoryId);
        shipment.setCustomerId(customerId);
        shipment.setProductName(productName);
        shipment.setQuantity(quantity);
        shipment.setUnit(unit);
        shipment.setRecordedBy(userId);

        // 可选字段
        BigDecimal unitPrice = getBigDecimalFromContext(ctx, "unitPrice");
        if (unitPrice != null) shipment.setUnitPrice(unitPrice);

        String orderNumber = getStringFromContext(ctx, "orderNumber");
        if (orderNumber != null) shipment.setOrderNumber(orderNumber);

        String shipmentDateStr = getStringFromContext(ctx, "shipmentDate");
        if (shipmentDateStr != null) {
            shipment.setShipmentDate(LocalDate.parse(shipmentDateStr, DATE_FORMATTER));
        } else {
            shipment.setShipmentDate(LocalDate.now());
        }

        String deliveryAddress = getStringFromContext(ctx, "deliveryAddress");
        if (deliveryAddress != null) shipment.setDeliveryAddress(deliveryAddress);

        String logisticsCompany = getStringFromContext(ctx, "logisticsCompany");
        if (logisticsCompany != null) shipment.setLogisticsCompany(logisticsCompany);

        String trackingNumber = getStringFromContext(ctx, "trackingNumber");
        if (trackingNumber != null) shipment.setTrackingNumber(trackingNumber);

        String notes = getStringFromContext(ctx, "notes");
        if (notes != null) shipment.setNotes(notes);

        // 创建出货记录
        ShipmentRecord created = shipmentRecordService.createShipment(shipment);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SHIPMENT")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("出货记录创建成功: " + created.getShipmentNumber())
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("ShipmentRecord")
                                .entityId(created.getId())
                                .entityName(created.getShipmentNumber())
                                .action("CREATED")
                                .changes(Map.of(
                                        "productName", productName,
                                        "quantity", quantity.toString(),
                                        "status", "pending"
                                ))
                                .build()
                ))
                .resultData(Map.of(
                        "shipmentId", created.getId(),
                        "shipmentNumber", created.getShipmentNumber(),
                        "status", created.getStatus()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("UPDATE_STATUS")
                                .actionName("更新出货状态")
                                .description("将出货状态更新为已发货")
                                .endpoint("/api/mobile/" + factoryId + "/shipments/" + created.getId() + "/status")
                                .build()
                ))
                .build();
    }

    /**
     * 查询出货记录
     */
    private IntentExecuteResponse handleShipmentQuery(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        String shipmentId = null;
        String shipmentNumber = null;
        String trackingNumber = null;
        String status = null;
        int page = 0;
        int size = 10;

        if (request.getContext() != null) {
            Map<String, Object> ctx = request.getContext();
            shipmentId = getStringFromContext(ctx, "shipmentId");
            shipmentNumber = getStringFromContext(ctx, "shipmentNumber");
            trackingNumber = getStringFromContext(ctx, "trackingNumber");
            status = getStringFromContext(ctx, "status");

            Integer pageNum = getIntegerFromContext(ctx, "page");
            Integer pageSize = getIntegerFromContext(ctx, "size");
            if (pageNum != null) page = pageNum;
            if (pageSize != null) size = pageSize;
        }

        // 按ID查询
        if (shipmentId != null) {
            Optional<ShipmentRecord> record = shipmentRecordService.getById(shipmentId);
            if (record.isEmpty()) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("未找到出货记录: " + shipmentId)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            // 工厂隔离验证
            if (!factoryId.equals(record.get().getFactoryId())) {
                log.warn("工厂隔离校验失败: 请求factoryId={}, 记录factoryId={}", factoryId, record.get().getFactoryId());
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("未找到出货记录: " + shipmentId)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SHIPMENT")
                    .status("COMPLETED")
                    .message("出货记录查询成功")
                    .resultData(Map.of("shipment", record.get()))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 按出货单号查询
        if (shipmentNumber != null) {
            Optional<ShipmentRecord> record = shipmentRecordService.getByShipmentNumber(shipmentNumber);
            if (record.isEmpty()) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("未找到出货单: " + shipmentNumber)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            // 工厂隔离验证
            if (!factoryId.equals(record.get().getFactoryId())) {
                log.warn("工厂隔离校验失败: 请求factoryId={}, 记录factoryId={}", factoryId, record.get().getFactoryId());
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("未找到出货单: " + shipmentNumber)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("COMPLETED")
                    .message("出货记录查询成功")
                    .resultData(Map.of("shipment", record.get()))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 按物流单号查询
        if (trackingNumber != null) {
            Optional<ShipmentRecord> record = shipmentRecordService.getByTrackingNumber(trackingNumber);
            if (record.isEmpty()) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("未找到物流单号: " + trackingNumber)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            // 工厂隔离验证
            if (!factoryId.equals(record.get().getFactoryId())) {
                log.warn("工厂隔离校验失败: 请求factoryId={}, 记录factoryId={}", factoryId, record.get().getFactoryId());
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("未找到物流单号: " + trackingNumber)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("COMPLETED")
                    .message("物流查询成功")
                    .resultData(Map.of("shipment", record.get()))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 列表查询
        Page<ShipmentRecord> records;
        if (status != null) {
            records = shipmentRecordService.getByFactoryIdAndStatus(factoryId, status, page, size);
        } else {
            records = shipmentRecordService.getByFactoryId(factoryId, page, size);
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SHIPMENT")
                .status("COMPLETED")
                .message("查询到" + records.getTotalElements() + "条出货记录")
                .resultData(Map.of(
                        "shipments", records.getContent(),
                        "totalElements", records.getTotalElements(),
                        "totalPages", records.getTotalPages(),
                        "currentPage", page
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 更新出货信息
     */
    private IntentExecuteResponse handleShipmentUpdate(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig, Long userId) {
        if (request.getContext() == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供出货记录ID和更新内容")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        Map<String, Object> ctx = request.getContext();
        String shipmentId = getStringFromContext(ctx, "shipmentId");

        if (shipmentId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供出货记录ID (shipmentId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 构建更新数据
        ShipmentRecord updateData = new ShipmentRecord();

        String productName = getStringFromContext(ctx, "productName");
        if (productName != null) updateData.setProductName(productName);

        BigDecimal quantity = getBigDecimalFromContext(ctx, "quantity");
        if (quantity != null) updateData.setQuantity(quantity);

        BigDecimal unitPrice = getBigDecimalFromContext(ctx, "unitPrice");
        if (unitPrice != null) updateData.setUnitPrice(unitPrice);

        String logisticsCompany = getStringFromContext(ctx, "logisticsCompany");
        if (logisticsCompany != null) updateData.setLogisticsCompany(logisticsCompany);

        String trackingNumber = getStringFromContext(ctx, "trackingNumber");
        if (trackingNumber != null) updateData.setTrackingNumber(trackingNumber);

        String deliveryAddress = getStringFromContext(ctx, "deliveryAddress");
        if (deliveryAddress != null) updateData.setDeliveryAddress(deliveryAddress);

        String notes = getStringFromContext(ctx, "notes");
        if (notes != null) updateData.setNotes(notes);

        ShipmentRecord updated = shipmentRecordService.updateShipment(shipmentId, updateData);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SHIPMENT")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("出货记录更新成功: " + updated.getShipmentNumber())
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("ShipmentRecord")
                                .entityId(shipmentId)
                                .entityName(updated.getShipmentNumber())
                                .action("UPDATED")
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 更新出货状态
     */
    private IntentExecuteResponse handleStatusUpdate(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig, Long userId) {
        if (request.getContext() == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供出货记录ID和新状态。\n有效状态: pending(待发货), shipped(已发货), delivered(已送达), returned(已退回)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        Map<String, Object> ctx = request.getContext();
        String shipmentId = getStringFromContext(ctx, "shipmentId");
        String newStatus = getStringFromContext(ctx, "status");

        if (shipmentId == null || newStatus == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供 shipmentId 和 status")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 验证状态值
        if (!isValidStatus(newStatus)) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("FAILED")
                    .message("无效的状态值: " + newStatus + "。有效值: pending, shipped, delivered, returned")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        ShipmentRecord updated = shipmentRecordService.updateStatus(shipmentId, newStatus);
        String statusDesc = getStatusDescription(newStatus);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SHIPMENT")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("出货状态已更新为: " + statusDesc)
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("ShipmentRecord")
                                .entityId(shipmentId)
                                .entityName(updated.getShipmentNumber())
                                .action("STATUS_UPDATED")
                                .changes(Map.of("newStatus", newStatus))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 出货统计
     */
    private IntentExecuteResponse handleShipmentStats(String factoryId, AIIntentConfig intentConfig) {
        long total = shipmentRecordService.countByFactoryId(factoryId);
        long pending = shipmentRecordService.countByStatus(factoryId, "pending");
        long shipped = shipmentRecordService.countByStatus(factoryId, "shipped");
        long delivered = shipmentRecordService.countByStatus(factoryId, "delivered");
        long returned = shipmentRecordService.countByStatus(factoryId, "returned");

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SHIPMENT")
                .status("COMPLETED")
                .message("出货统计: 总计" + total + "条, 待发货" + pending + ", 已发货" + shipped + ", 已送达" + delivered)
                .resultData(Map.of(
                        "total", total,
                        "pending", pending,
                        "shipped", shipped,
                        "delivered", delivered,
                        "returned", returned
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 按客户查询
     */
    private IntentExecuteResponse handleQueryByCustomer(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        String customerId = null;
        if (request.getContext() != null) {
            customerId = getStringFromContext(request.getContext(), "customerId");
        }

        if (customerId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供客户ID (customerId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        List<ShipmentRecord> records = shipmentRecordService.getByCustomer(factoryId, customerId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SHIPMENT")
                .status("COMPLETED")
                .message("客户出货记录: 共" + records.size() + "条")
                .resultData(Map.of(
                        "shipments", records,
                        "count", records.size(),
                        "customerId", customerId
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 按日期范围查询
     */
    private IntentExecuteResponse handleQueryByDateRange(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        if (request.getContext() == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供查询日期范围 (startDate, endDate)，格式: yyyy-MM-dd")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        Map<String, Object> ctx = request.getContext();
        String startDateStr = getStringFromContext(ctx, "startDate");
        String endDateStr = getStringFromContext(ctx, "endDate");

        if (startDateStr == null || endDateStr == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供 startDate 和 endDate")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        LocalDate startDate = LocalDate.parse(startDateStr, DATE_FORMATTER);
        LocalDate endDate = LocalDate.parse(endDateStr, DATE_FORMATTER);

        List<ShipmentRecord> records = shipmentRecordService.getByDateRange(factoryId, startDate, endDate);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SHIPMENT")
                .status("COMPLETED")
                .message(startDateStr + " 至 " + endDateStr + " 出货记录: " + records.size() + "条")
                .resultData(Map.of(
                        "shipments", records,
                        "count", records.size(),
                        "startDate", startDateStr,
                        "endDate", endDateStr
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 批次溯源查询
     */
    private IntentExecuteResponse handleTraceBatch(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig) {
        String batchNumber = null;
        if (request.getContext() != null) {
            batchNumber = getStringFromContext(request.getContext(), "batchNumber");
        }

        if (batchNumber == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供批次号 (batchNumber)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        try {
            TraceabilityDTO.BatchTraceResponse trace = traceabilityService.getBatchTrace(factoryId, batchNumber);

            if (trace == null) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("未找到批次 " + batchNumber + " 的溯源信息")
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SHIPMENT")
                    .status("COMPLETED")
                    .message("批次 " + batchNumber + " 溯源信息查询成功")
                    .resultData(Map.of(
                            "trace", trace,
                            "batchNumber", batchNumber
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("溯源查询失败: batchNumber={}", batchNumber, e);
            String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("FAILED")
                    .message("溯源查询失败: " + errorMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 完整链路溯源
     */
    private IntentExecuteResponse handleTraceFull(String factoryId, IntentExecuteRequest request,
                                                  AIIntentConfig intentConfig) {
        String batchNumber = null;
        if (request.getContext() != null) {
            batchNumber = getStringFromContext(request.getContext(), "batchNumber");
        }

        if (batchNumber == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供批次号 (batchNumber) 进行完整链路溯源")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        try {
            TraceabilityDTO.FullTraceResponse trace = traceabilityService.getFullTrace(factoryId, batchNumber);

            if (trace == null) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("未找到批次 " + batchNumber + " 的完整溯源信息")
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SHIPMENT")
                    .status("COMPLETED")
                    .message("批次 " + batchNumber + " 完整链路溯源成功")
                    .resultData(Map.of(
                            "fullTrace", trace,
                            "batchNumber", batchNumber,
                            "traceCode", trace.getTraceCode() != null ? trace.getTraceCode() : ""
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("完整溯源查询失败: batchNumber={}", batchNumber, e);
            String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("FAILED")
                    .message("完整溯源查询失败: " + errorMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 公开溯源查询（消费者端）
     */
    private IntentExecuteResponse handleTracePublic(IntentExecuteRequest request, AIIntentConfig intentConfig) {
        String batchNumber = null;
        if (request.getContext() != null) {
            batchNumber = getStringFromContext(request.getContext(), "batchNumber");
        }

        if (batchNumber == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供批次号 (batchNumber) 进行公开溯源查询")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        try {
            TraceabilityDTO.PublicTraceResponse trace = traceabilityService.getPublicTrace(batchNumber);

            if (trace == null) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("COMPLETED")
                        .message("未找到批次 " + batchNumber + " 的公开溯源信息")
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SHIPMENT")
                    .status("COMPLETED")
                    .message(trace.getIsValid()
                            ? "产品溯源信息查询成功"
                            : "未找到该批次的溯源信息")
                    .resultData(Map.of(
                            "publicTrace", trace,
                            "isValid", trace.getIsValid()
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("公开溯源查询失败: batchNumber={}", batchNumber, e);
            String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("FAILED")
                    .message("公开溯源查询失败: " + errorMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .status("PREVIEW")
                .message("出货/溯源意图预览功能")
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式
        return true;
    }

    // === 工具方法 ===

    private String getStringFromContext(Map<String, Object> ctx, String key) {
        Object value = ctx.get(key);
        return value != null ? value.toString() : null;
    }

    private BigDecimal getBigDecimalFromContext(Map<String, Object> ctx, String key) {
        Object value = ctx.get(key);
        if (value == null) return null;
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer getIntegerFromContext(Map<String, Object> ctx, String key) {
        Object value = ctx.get(key);
        if (value == null) return null;
        try {
            return Integer.valueOf(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isValidStatus(String status) {
        return status != null && List.of("pending", "shipped", "delivered", "returned").contains(status.toLowerCase());
    }

    private String getStatusDescription(String status) {
        if (status == null) return "未知";
        return switch (status.toLowerCase()) {
            case "pending" -> "待发货";
            case "shipped" -> "已发货";
            case "delivered" -> "已送达";
            case "returned" -> "已退回";
            default -> status;
        };
    }
}
