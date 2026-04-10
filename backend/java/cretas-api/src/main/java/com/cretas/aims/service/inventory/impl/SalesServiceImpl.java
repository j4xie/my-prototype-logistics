package com.cretas.aims.service.inventory.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateDeliveryRequest;
import com.cretas.aims.dto.inventory.CreateSalesOrderRequest;
import com.cretas.aims.dto.inventory.UpdateSalesOrderRequest;
import com.cretas.aims.entity.enums.SalesDeliveryStatus;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import com.cretas.aims.entity.inventory.*;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.inventory.*;
import com.cretas.aims.event.SalesOrderConfirmedEvent;
import com.cretas.aims.event.SalesOrderFinanceApprovedEvent;
import com.cretas.aims.service.config.FactoryConfigService;
import com.cretas.aims.service.inventory.SalesService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SalesServiceImpl implements SalesService {

    private static final Logger log = LoggerFactory.getLogger(SalesServiceImpl.class);

    private final SalesOrderRepository salesOrderRepository;
    private final SalesOrderItemRepository salesOrderItemRepository;
    private final SalesDeliveryRecordRepository deliveryRecordRepository;
    private final FinishedGoodsBatchRepository finishedGoodsBatchRepository;
    private final CustomerRepository customerRepository;
    private final ProductTypeRepository productTypeRepository;
    private final com.cretas.aims.service.finance.ArApService arApService;
    private final ApplicationEventPublisher applicationEventPublisher;

    /** P0-13 批次分配校验（可选注入，避免破坏现有构造器）。 */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.service.sales.SalesDeliveryBatchAllocationService batchAllocationService;

    /** Canvas Config — 可选注入，模块未部署时不影响现有逻辑 */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private FactoryConfigService factoryConfigService;

    /** Canvas V2: DB-driven validation rules */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.ValidationRuleEvaluator validationRuleEvaluator;

    /** Canvas V2: DB-driven default values */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.DefaultValueResolver defaultValueResolver;

    /** Canvas V2: DB-driven formula engine */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.FormulaEngine formulaEngine;

    /** Canvas V3: Dynamic field persistence (cf_xxx columns) */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.DynamicFieldService dynamicFieldService;

    public SalesServiceImpl(SalesOrderRepository salesOrderRepository,
                            SalesOrderItemRepository salesOrderItemRepository,
                            SalesDeliveryRecordRepository deliveryRecordRepository,
                            FinishedGoodsBatchRepository finishedGoodsBatchRepository,
                            CustomerRepository customerRepository,
                            ProductTypeRepository productTypeRepository,
                            com.cretas.aims.service.finance.ArApService arApService,
                            ApplicationEventPublisher applicationEventPublisher) {
        this.salesOrderRepository = salesOrderRepository;
        this.salesOrderItemRepository = salesOrderItemRepository;
        this.deliveryRecordRepository = deliveryRecordRepository;
        this.finishedGoodsBatchRepository = finishedGoodsBatchRepository;
        this.customerRepository = customerRepository;
        this.productTypeRepository = productTypeRepository;
        this.arApService = arApService;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    // ==================== 销售订单 ====================

    @Override
    @Transactional
    public SalesOrder createSalesOrder(String factoryId, CreateSalesOrderRequest request, Long userId) {
        // Canvas V2: DB-driven validation — pre-compute totalAmount so rules can reference it
        BigDecimal preComputedTotal = BigDecimal.ZERO;
        Set<String> seenProductIdsForCheck = new HashSet<>();
        boolean hasDuplicate = false;
        if (request.getItems() != null) {
            for (CreateSalesOrderRequest.SalesOrderItemDTO itemDTO : request.getItems()) {
                if (itemDTO.getProductTypeId() != null && !seenProductIdsForCheck.add(itemDTO.getProductTypeId())) {
                    hasDuplicate = true;
                }
                if (itemDTO.getQuantity() != null && itemDTO.getUnitPrice() != null) {
                    BigDecimal discountRate = itemDTO.getDiscountRate() != null ? itemDTO.getDiscountRate() : BigDecimal.ZERO;
                    BigDecimal line = itemDTO.getQuantity().multiply(itemDTO.getUnitPrice())
                            .multiply(BigDecimal.ONE.subtract(discountRate));
                    preComputedTotal = preComputedTotal.add(line);
                }
            }
        }
        runConfiguredValidation(factoryId, "CREATE", Map.of(
                "itemCount", request.getItems() != null ? request.getItems().size() : 0,
                "totalAmount", preComputedTotal,
                "hasDuplicateProduct", hasDuplicate));

        // 验证客户
        customerRepository.findByIdAndFactoryId(request.getCustomerId(), factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在或不属于当前组织"));

        String orderNumber = generateSalesOrderNumber(factoryId);

        SalesOrder order = new SalesOrder();
        order.setFactoryId(factoryId);
        order.setOrderNumber(orderNumber);
        order.setCustomerId(request.getCustomerId());
        order.setOrderDate(request.getOrderDate() != null ? request.getOrderDate() : java.time.LocalDate.now());
        order.setRequiredDeliveryDate(request.getRequiredDeliveryDate());
        order.setDeliveryAddress(request.getDeliveryAddress());
        order.setDiscountAmount(request.getDiscountAmount() != null ? request.getDiscountAmount() : BigDecimal.ZERO);
        order.setRemark(request.getRemark());
        order.setSalesperson(request.getSalesperson());
        order.setShippingIncluded(request.getShippingIncluded());
        order.setShippingFee(request.getShippingFee());
        order.setExtraFees(request.getExtraFees());
        order.setStatus(SalesOrderStatus.DRAFT);
        order.setCreatedBy(userId);

        order = salesOrderRepository.save(order);

        // SKU 重复校验
        Set<String> seenProductIds = new HashSet<>();
        for (CreateSalesOrderRequest.SalesOrderItemDTO itemDTO : request.getItems()) {
            if (!seenProductIds.add(itemDTO.getProductTypeId())) {
                throw new BusinessException("同一订单不能添加重复的产品: " + (itemDTO.getProductName() != null ? itemDTO.getProductName() : itemDTO.getProductTypeId()));
            }
        }

        // 创建行项目
        BigDecimal totalAmount = BigDecimal.ZERO;
        List<SalesOrderItem> items = new ArrayList<>();

        for (CreateSalesOrderRequest.SalesOrderItemDTO itemDTO : request.getItems()) {
            SalesOrderItem item = new SalesOrderItem();
            item.setSalesOrderId(order.getId());
            item.setProductTypeId(itemDTO.getProductTypeId());
            // 自动填充产品名称
            String productName = itemDTO.getProductName();
            if (productName == null || productName.isBlank()) {
                productName = productTypeRepository.findById(itemDTO.getProductTypeId())
                        .map(ProductType::getName).orElse(null);
            }
            item.setProductName(productName);
            item.setQuantity(itemDTO.getQuantity());
            item.setUnit(itemDTO.getUnit());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setDiscountRate(itemDTO.getDiscountRate() != null ? itemDTO.getDiscountRate() : BigDecimal.ZERO);
            item.setRemark(itemDTO.getRemark());
            item.setSpecification(itemDTO.getSpecification());
            item.setBoxQuantity(itemDTO.getBoxQuantity());
            items.add(item);

            totalAmount = totalAmount.add(calculateLineAmount(factoryId, item));
        }

        salesOrderItemRepository.saveAll(items);

        order.setTotalAmount(totalAmount);
        order = salesOrderRepository.save(order);

        // Canvas V3: Persist dynamic custom fields via DynamicFieldService
        // (dual-track: JPA columns above + dynamic cf_xxx columns here)
        if (dynamicFieldService != null && request.getCustomFields() != null && !request.getCustomFields().isEmpty()) {
            try {
                dynamicFieldService.setDynamicFields(factoryId, "sales_order", order.getId(), request.getCustomFields());
                log.info("Persisted {} custom fields for sales order {}",
                        request.getCustomFields().size(), order.getId());
            } catch (Exception e) {
                // Non-blocking: log but don't rollback the order
                log.warn("Failed to persist custom fields for sales order {}: {}", order.getId(), e.getMessage());
            }
        }

        log.info("创建销售订单: factoryId={}, orderNumber={}, items={}", factoryId, orderNumber, items.size());
        return order;
    }

    @Override
    public SalesOrder getSalesOrderById(String factoryId, String orderId) {
        SalesOrder order = salesOrderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("销售订单不存在"));
        if (!order.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该销售订单");
        }
        return order;
    }

    @Override
    public PageResponse<SalesOrder> getSalesOrders(String factoryId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<SalesOrder> result = salesOrderRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageRequest);
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public PageResponse<SalesOrder> getSalesOrdersByStatus(String factoryId, SalesOrderStatus status, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size);
        Page<SalesOrder> result = salesOrderRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, status, pageRequest);
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    @Transactional
    public SalesOrder confirmOrder(String factoryId, String orderId) {
        SalesOrder order = getSalesOrderById(factoryId, orderId);
        runConfiguredValidation(factoryId, "STATUS_CHANGE", Map.of(
                "status", order.getStatus().name(), "targetStatus", "CONFIRMED"));
        if (order.getStatus() != SalesOrderStatus.DRAFT) {
            throw new BusinessException("只有草稿状态的订单可以确认");
        }
        checkTransitionAllowed(factoryId, order.getStatus().name(), "CONFIRMED");
        order.setStatus(SalesOrderStatus.CONFIRMED);
        order.setConfirmedAt(LocalDateTime.now());
        SalesOrder saved = salesOrderRepository.save(order);
        log.info("确认销售订单: orderId={}, orderNumber={}", orderId, saved.getOrderNumber());

        // 注意: 供应链联动不再在确认时触发
        // 新流程: CONFIRMED -> 提交财务审核 -> 财务批准后才触发供应链联动
        // 发布确认事件仅用于通知（不再驱动生产）
        try {
            applicationEventPublisher.publishEvent(new SalesOrderConfirmedEvent(this, factoryId, saved.getId()));
            log.info("已发布SalesOrderConfirmedEvent(仅通知): SO={}", saved.getId());
        } catch (Exception e) {
            log.error("发布SalesOrderConfirmedEvent失败: SO={}", saved.getId(), e);
        }

        return saved;
    }

    @Override
    @Transactional
    public SalesOrder submitForFinanceReview(String factoryId, String orderId) {
        SalesOrder order = getSalesOrderById(factoryId, orderId);
        runConfiguredValidation(factoryId, "STATUS_CHANGE", Map.of(
                "status", order.getStatus().name(), "targetStatus", "PENDING_FINANCE_REVIEW"));
        if (order.getStatus() != SalesOrderStatus.CONFIRMED
                && order.getStatus() != SalesOrderStatus.FINANCE_REJECTED) {
            throw new BusinessException("只有已确认或财务驳回状态的订单可以提交财务审核");
        }
        checkTransitionAllowed(factoryId, order.getStatus().name(), "PENDING_FINANCE_REVIEW");
        order.setStatus(SalesOrderStatus.PENDING_FINANCE_REVIEW);
        // 清除上一次审核记录，重新审核
        order.setFinanceReviewedBy(null);
        order.setFinanceReviewedAt(null);
        order.setFinanceReviewNotes(null);
        SalesOrder saved = salesOrderRepository.save(order);
        log.info("销售订单已提交财务审核: orderId={}, orderNumber={}", orderId, saved.getOrderNumber());
        return saved;
    }

    @Override
    @Transactional
    public SalesOrder financeApproveOrder(String factoryId, String orderId, String notes, Long reviewerId) {
        SalesOrder order = getSalesOrderById(factoryId, orderId);
        // 强制加载 items，防止事件处理器中 LazyInitializationException
        org.hibernate.Hibernate.initialize(order.getItems());
        if (order.getStatus() != SalesOrderStatus.PENDING_FINANCE_REVIEW) {
            throw new BusinessException("只有待财务审核状态的订单可以审批");
        }
        checkTransitionAllowed(factoryId, order.getStatus().name(), "FINANCE_APPROVED");
        order.setStatus(SalesOrderStatus.FINANCE_APPROVED);
        order.setFinanceReviewedBy(reviewerId);
        order.setFinanceReviewedAt(LocalDateTime.now());
        order.setFinanceReviewNotes(notes);

        // 计算预估成本与利润（如果前端/财务未手动填写，此处可后续扩展从BOM自动计算）
        if (order.getEstimatedCost() != null && order.getTotalAmount() != null) {
            order.setEstimatedProfit(order.getTotalAmount().subtract(order.getEstimatedCost()));
        }

        SalesOrder saved = salesOrderRepository.save(order);
        log.info("销售订单财务审核通过: orderId={}, orderNumber={}, reviewerId={}",
                orderId, saved.getOrderNumber(), reviewerId);

        // 发布财务审核通过事件 → 触发供应链联动（库存检查+生产计划+采购建议）
        try {
            applicationEventPublisher.publishEvent(
                    new SalesOrderFinanceApprovedEvent(this, factoryId, saved.getId(), reviewerId));
            log.info("已发布SalesOrderFinanceApprovedEvent: SO={}", saved.getId());
        } catch (Exception e) {
            log.error("发布SalesOrderFinanceApprovedEvent失败(不影响审批): SO={}", saved.getId(), e);
        }

        return saved;
    }

    @Override
    @Transactional
    public SalesOrder financeRejectOrder(String factoryId, String orderId, String reason, Long reviewerId) {
        SalesOrder order = getSalesOrderById(factoryId, orderId);
        if (order.getStatus() != SalesOrderStatus.PENDING_FINANCE_REVIEW) {
            throw new BusinessException("只有待财务审核状态的订单可以驳回");
        }
        checkTransitionAllowed(factoryId, order.getStatus().name(), "FINANCE_REJECTED");
        order.setStatus(SalesOrderStatus.FINANCE_REJECTED);
        order.setFinanceReviewedBy(reviewerId);
        order.setFinanceReviewedAt(LocalDateTime.now());
        order.setFinanceReviewNotes(reason);
        SalesOrder saved = salesOrderRepository.save(order);
        log.info("销售订单财务审核驳回: orderId={}, orderNumber={}, reviewerId={}, reason={}",
                orderId, saved.getOrderNumber(), reviewerId, reason);
        return saved;
    }

    @Override
    @Transactional
    public SalesOrder updateSalesOrder(String factoryId, String orderId, UpdateSalesOrderRequest request) {
        SalesOrder order = getSalesOrderById(factoryId, orderId);
        if (order.getStatus() != SalesOrderStatus.DRAFT) {
            throw new BusinessException("只有草稿状态的订单可以编辑");
        }

        // Canvas V2: DB-driven validation for UPDATE — pre-compute totalAmount if items changed
        BigDecimal updateTotal = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        boolean hasDupOnUpdate = false;
        if (request.getItems() != null && !request.getItems().isEmpty()) {
            Set<String> seenIds = new HashSet<>();
            updateTotal = BigDecimal.ZERO;
            for (CreateSalesOrderRequest.SalesOrderItemDTO itemDTO : request.getItems()) {
                if (itemDTO.getProductTypeId() != null && !seenIds.add(itemDTO.getProductTypeId())) {
                    hasDupOnUpdate = true;
                }
                if (itemDTO.getQuantity() != null && itemDTO.getUnitPrice() != null) {
                    BigDecimal discountRate = itemDTO.getDiscountRate() != null ? itemDTO.getDiscountRate() : BigDecimal.ZERO;
                    BigDecimal line = itemDTO.getQuantity().multiply(itemDTO.getUnitPrice())
                            .multiply(BigDecimal.ONE.subtract(discountRate));
                    updateTotal = updateTotal.add(line);
                }
            }
        }
        runConfiguredValidation(factoryId, "UPDATE", Map.of(
                "itemCount", request.getItems() != null ? request.getItems().size() : 0,
                "totalAmount", updateTotal,
                "hasDuplicateProduct", hasDupOnUpdate,
                "currentStatus", order.getStatus().name()));

        if (request.getSalesperson() != null) {
            order.setSalesperson(request.getSalesperson());
        }
        if (request.getDeliveryAddress() != null) {
            order.setDeliveryAddress(request.getDeliveryAddress());
        }
        if (request.getRemark() != null) {
            order.setRemark(request.getRemark());
        }
        if (request.getShippingIncluded() != null) {
            order.setShippingIncluded(request.getShippingIncluded());
        }
        if (request.getShippingFee() != null) {
            order.setShippingFee(request.getShippingFee());
        }
        if (request.getExtraFees() != null) {
            order.setExtraFees(request.getExtraFees());
        }
        if (request.getRequiredDeliveryDate() != null) {
            order.setRequiredDeliveryDate(request.getRequiredDeliveryDate());
        }

        // 行项目更新 + 总金额重算
        if (request.getItems() != null && !request.getItems().isEmpty()) {
            // 删除旧行项
            List<SalesOrderItem> oldItems = salesOrderItemRepository.findBySalesOrderId(order.getId());
            salesOrderItemRepository.deleteAll(oldItems);

            // 创建新行项 + 重算总金额
            BigDecimal totalAmount = BigDecimal.ZERO;
            List<SalesOrderItem> newItems = new ArrayList<>();
            for (CreateSalesOrderRequest.SalesOrderItemDTO itemDTO : request.getItems()) {
                SalesOrderItem item = new SalesOrderItem();
                item.setSalesOrderId(order.getId());
                item.setProductTypeId(itemDTO.getProductTypeId());
                String productName = itemDTO.getProductName();
                if (productName == null || productName.isBlank()) {
                    productName = productTypeRepository.findById(itemDTO.getProductTypeId())
                            .map(ProductType::getName).orElse(null);
                }
                item.setProductName(productName);
                item.setQuantity(itemDTO.getQuantity());
                item.setUnit(itemDTO.getUnit());
                item.setUnitPrice(itemDTO.getUnitPrice());
                item.setDiscountRate(itemDTO.getDiscountRate() != null ? itemDTO.getDiscountRate() : BigDecimal.ZERO);
                item.setRemark(itemDTO.getRemark());
                item.setSpecification(itemDTO.getSpecification());
                item.setBoxQuantity(itemDTO.getBoxQuantity());
                newItems.add(item);
                totalAmount = totalAmount.add(item.getLineAmount());
            }
            salesOrderItemRepository.saveAll(newItems);
            order.setTotalAmount(totalAmount);
        }

        // Canvas V3: Update dynamic custom fields via DynamicFieldService
        if (dynamicFieldService != null && request.getCustomFields() != null && !request.getCustomFields().isEmpty()) {
            try {
                dynamicFieldService.setDynamicFields(factoryId, "sales_order", order.getId(), request.getCustomFields());
                log.info("Updated {} custom fields for sales order {}",
                        request.getCustomFields().size(), order.getId());
            } catch (Exception e) {
                log.warn("Failed to update custom fields for sales order {}: {}", order.getId(), e.getMessage());
            }
        }

        log.info("更新销售订单: orderId={}, orderNumber={}", orderId, order.getOrderNumber());
        return salesOrderRepository.save(order);
    }

    @Override
    @Transactional
    public SalesOrder cancelOrder(String factoryId, String orderId) {
        SalesOrder order = getSalesOrderById(factoryId, orderId);
        if (order.getStatus() == SalesOrderStatus.COMPLETED) {
            throw new BusinessException("已完成的订单不能取消");
        }
        order.setStatus(SalesOrderStatus.CANCELLED);
        log.info("取消销售订单: orderId={}, orderNumber={}", orderId, order.getOrderNumber());
        return salesOrderRepository.save(order);
    }

    // ==================== 发货/出库 ====================

    @Override
    @Transactional
    public SalesDeliveryRecord createDeliveryRecord(String factoryId, CreateDeliveryRequest request, Long userId) {
        // 验证客户
        customerRepository.findByIdAndFactoryId(request.getCustomerId(), factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在或不属于当前组织"));

        // 如果关联销售订单，验证状态
        if (request.getSalesOrderId() != null && !request.getSalesOrderId().isEmpty()) {
            SalesOrder order = getSalesOrderById(factoryId, request.getSalesOrderId());
            if (order.getStatus() != SalesOrderStatus.FINANCE_APPROVED &&
                    order.getStatus() != SalesOrderStatus.CONFIRMED &&
                    order.getStatus() != SalesOrderStatus.PROCESSING &&
                    order.getStatus() != SalesOrderStatus.PARTIAL_DELIVERED) {
                throw new BusinessException("只有财务已批准/已确认/处理中/部分发货状态的订单可以创建发货单");
            }
        }

        String deliveryNumber = generateDeliveryNumber(factoryId);

        SalesDeliveryRecord record = new SalesDeliveryRecord();
        record.setFactoryId(factoryId);
        record.setDeliveryNumber(deliveryNumber);
        record.setSalesOrderId(request.getSalesOrderId());
        record.setCustomerId(request.getCustomerId());
        record.setDeliveryDate(request.getDeliveryDate());
        record.setDeliveryAddress(request.getDeliveryAddress());
        record.setLogisticsCompany(request.getLogisticsCompany());
        record.setTrackingNumber(request.getTrackingNumber());
        record.setStatus(SalesDeliveryStatus.DRAFT);
        record.setShippedBy(userId);
        record.setRemark(request.getRemark());

        record = deliveryRecordRepository.save(record);

        // 创建发货行项目
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (CreateDeliveryRequest.DeliveryItemDTO itemDTO : request.getItems()) {
            SalesDeliveryItem item = new SalesDeliveryItem();
            item.setDeliveryRecordId(record.getId());
            item.setProductTypeId(itemDTO.getProductTypeId());
            item.setProductName(itemDTO.getProductName());
            item.setDeliveredQuantity(itemDTO.getDeliveredQuantity());
            item.setUnit(itemDTO.getUnit());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setRemark(itemDTO.getRemark());
            record.getItems().add(item);

            if (itemDTO.getUnitPrice() != null) {
                totalAmount = totalAmount.add(itemDTO.getDeliveredQuantity().multiply(itemDTO.getUnitPrice()));
            }
        }

        record.setTotalAmount(totalAmount);
        record = deliveryRecordRepository.save(record);

        log.info("创建发货单: factoryId={}, deliveryNumber={}, items={}", factoryId, deliveryNumber, request.getItems().size());
        return record;
    }

    @Override
    @Transactional
    public SalesDeliveryRecord shipDelivery(String factoryId, String deliveryId, Long userId) {
        SalesDeliveryRecord record = getDeliveryRecordById(factoryId, deliveryId);
        if (record.getStatus() != SalesDeliveryStatus.DRAFT && record.getStatus() != SalesDeliveryStatus.PICKED) {
            throw new BusinessException("只有草稿或已拣货状态的发货单可以发货");
        }

        // P0-13 强制批次分配校验：发货行必须已完成批次分配才能发货
        if (batchAllocationService != null) {
            for (SalesDeliveryItem item : record.getItems()) {
                String itemIdStr = String.valueOf(item.getId());
                if (!batchAllocationService.isFullyAllocated(factoryId, itemIdStr)) {
                    throw new BusinessException("发货行 " + itemIdStr
                            + "（产品：" + item.getProductName() + "）未完成批次分配，无法确认发货");
                }
            }
        }

        // FIFO 扣减成品库存
        for (SalesDeliveryItem item : record.getItems()) {
            deductFinishedGoodsInventory(factoryId, item);
        }

        record.setStatus(SalesDeliveryStatus.SHIPPED);

        // 更新销售订单状态
        if (record.getSalesOrderId() != null) {
            updateOrderDeliveryStatus(record);
        }

        record = deliveryRecordRepository.save(record);
        log.info("发货确认: deliveryId={}, deliveryNumber={}", deliveryId, record.getDeliveryNumber());

        // 自动创建应收账款（销售发货 → AR_INVOICE）
        if (record.getSalesOrderId() != null) {
            try {
                SalesOrder order = salesOrderRepository.findById(record.getSalesOrderId()).orElse(null);
                if (order != null && order.getCustomerId() != null && order.getTotalAmount() != null) {
                    arApService.recordReceivable(factoryId, order.getCustomerId(), order.getId(),
                            order.getTotalAmount(), LocalDate.now().plusDays(30), userId,
                            "销售发货自动挂账-" + record.getDeliveryNumber());
                    log.info("自动创建应收: orderId={}, amount={}", order.getId(), order.getTotalAmount());
                }
            } catch (BusinessException e) {
                log.warn("应收自动挂账跳过(可能已存在): {}", e.getMessage());
            } catch (Exception e) {
                log.error("应收自动挂账失败: deliveryId={}", deliveryId, e);
            }
        }

        return record;
    }

    @Override
    @Transactional
    public SalesDeliveryRecord confirmDelivered(String factoryId, String deliveryId) {
        SalesDeliveryRecord record = getDeliveryRecordById(factoryId, deliveryId);
        if (record.getStatus() != SalesDeliveryStatus.SHIPPED) {
            throw new BusinessException("只有已发货状态的发货单可以确认签收");
        }
        record.setStatus(SalesDeliveryStatus.DELIVERED);
        log.info("签收确认: deliveryId={}, deliveryNumber={}", deliveryId, record.getDeliveryNumber());
        return deliveryRecordRepository.save(record);
    }

    @Override
    public SalesDeliveryRecord getDeliveryRecordById(String factoryId, String deliveryId) {
        SalesDeliveryRecord record = deliveryRecordRepository.findById(deliveryId)
                .orElseThrow(() -> new ResourceNotFoundException("发货单不存在"));
        if (!record.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该发货单");
        }
        return record;
    }

    @Override
    public PageResponse<SalesDeliveryRecord> getDeliveryRecords(String factoryId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<SalesDeliveryRecord> result = deliveryRecordRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageRequest);
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public List<SalesDeliveryRecord> getDeliveryRecordsByOrder(String salesOrderId) {
        return deliveryRecordRepository.findBySalesOrderId(salesOrderId);
    }

    @Override
    @Transactional
    public SalesDeliveryRecord uploadDeliverySignature(String factoryId, String deliveryId,
                                                        List<String> photoUrls, String signedByName, String remark) {
        SalesDeliveryRecord record = getDeliveryRecordById(factoryId, deliveryId);
        // 将 photoUrls 存为简单 JSON 数组字符串 (避免注入 ObjectMapper)
        String json = "[]";
        if (photoUrls != null && !photoUrls.isEmpty()) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < photoUrls.size(); i++) {
                if (i > 0) sb.append(",");
                String url = photoUrls.get(i) == null ? "" : photoUrls.get(i).replace("\\", "\\\\").replace("\"", "\\\"");
                sb.append("\"").append(url).append("\"");
            }
            sb.append("]");
            json = sb.toString();
        }
        record.setSignaturePhotoUrls(json);
        record.setSignedByName(signedByName);
        record.setSignedAt(LocalDateTime.now());
        record.setSignatureRemark(remark);
        log.info("上传签收凭证: deliveryId={}, 照片数={}, 签收人={}",
                deliveryId, photoUrls == null ? 0 : photoUrls.size(), signedByName);
        return deliveryRecordRepository.save(record);
    }

    // ==================== 成品库存 ====================

    @Override
    public PageResponse<FinishedGoodsBatch> getFinishedGoodsBatches(String factoryId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<FinishedGoodsBatch> result = finishedGoodsBatchRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageRequest);
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public List<FinishedGoodsBatch> getAvailableBatches(String factoryId, String productTypeId) {
        return finishedGoodsBatchRepository.findAvailableBatches(factoryId, productTypeId);
    }

    @Override
    @Transactional
    public FinishedGoodsBatch createFinishedGoodsBatch(String factoryId, FinishedGoodsBatch batch, Long userId) {
        batch.setFactoryId(factoryId);
        batch.setCreatedBy(userId);
        if (batch.getBatchNumber() == null) {
            batch.setBatchNumber(generateFinishedGoodsBatchNumber(factoryId));
        }
        batch = finishedGoodsBatchRepository.save(batch);
        log.info("创建成品批次: factoryId={}, batchNumber={}, productTypeId={}", factoryId, batch.getBatchNumber(), batch.getProductTypeId());
        return batch;
    }

    // ==================== 统计 ====================

    @Override
    public Map<String, Object> getSalesStatistics(String factoryId) {
        Map<String, Object> stats = new LinkedHashMap<>();

        LocalDate now = LocalDate.now();
        LocalDate monthStart = now.withDayOfMonth(1);
        List<SalesOrder> monthlyOrders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, monthStart, now);

        long totalOrders = monthlyOrders.size();
        long pendingOrders = monthlyOrders.stream()
                .filter(o -> o.getStatus() == SalesOrderStatus.CONFIRMED
                        || o.getStatus() == SalesOrderStatus.PENDING_FINANCE_REVIEW
                        || o.getStatus() == SalesOrderStatus.FINANCE_APPROVED
                        || o.getStatus() == SalesOrderStatus.PROCESSING)
                .count();
        BigDecimal monthlyRevenue = monthlyOrders.stream()
                .filter(o -> o.getStatus() != SalesOrderStatus.CANCELLED)
                .map(SalesOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        stats.put("monthlySalesOrderCount", totalOrders);
        stats.put("pendingDeliveryCount", pendingOrders);
        stats.put("monthlySalesAmount", monthlyRevenue);

        return stats;
    }

    // ==================== 内部方法 ====================

    private String generateSalesOrderNumber(String factoryId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = salesOrderRepository.countByFactoryIdAndDate(factoryId, LocalDate.now());
        return String.format("SO-%s-%04d", dateStr, count + 1);
    }

    private String generateDeliveryNumber(String factoryId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long ts = System.currentTimeMillis() % 10000;
        return String.format("DLV-%s-%04d", dateStr, ts);
    }

    private String generateFinishedGoodsBatchNumber(String factoryId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long ts = System.currentTimeMillis() % 10000;
        return String.format("FG-%s-%04d", dateStr, ts);
    }

    /**
     * Canvas Config: 检查工作流状态转换是否被配置允许。
     * 如果 factoryConfigService 未注入（模块未部署），默认允许所有转换（向后兼容）。
     */
    /**
     * Canvas V2: Run DB-driven validation rules before hardcoded checks.
     * If no DB rules exist, this is a no-op — existing hardcoded validation still runs.
     */
    /**
     * Canvas V2: Calculate line amount using FormulaEngine, fall back to entity method.
     */
    private BigDecimal calculateLineAmount(String factoryId, SalesOrderItem item) {
        if (formulaEngine != null && factoryId != null && item.getQuantity() != null && item.getUnitPrice() != null) {
            try {
                Map<String, Object> vars = new HashMap<>();
                vars.put("quantity", item.getQuantity());
                vars.put("unitPrice", item.getUnitPrice());
                vars.put("discountRate", item.getDiscountRate() != null ? item.getDiscountRate() : BigDecimal.ZERO);
                BigDecimal result = formulaEngine.evaluate(factoryId, "sales_order", "LINE_AMOUNT", vars);
                if (result != null) return result;
            } catch (Exception e) {
                log.debug("FormulaEngine LINE_AMOUNT failed, using entity method: {}", e.getMessage());
            }
        }
        return item.getLineAmount();
    }

    private void runConfiguredValidation(String factoryId, String operation, Map<String, Object> context) {
        if (validationRuleEvaluator == null) return;
        try {
            validationRuleEvaluator.validate(factoryId, "sales_order", operation, context);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Canvas validation non-blocking error: {}", e.getMessage());
        }
    }

    private void checkTransitionAllowed(String factoryId, String fromStatus, String toStatus) {
        if (factoryConfigService != null) {
            if (!factoryConfigService.isTransitionAllowed(factoryId, "sales_order", fromStatus, toStatus)) {
                throw new BusinessException("当前配置不允许从 " + fromStatus + " 转换到 " + toStatus);
            }
        }
    }

    /**
     * FIFO 扣减成品库存
     * 按生产日期从早到晚，依次扣减可用库存
     */
    private void deductFinishedGoodsInventory(String factoryId, SalesDeliveryItem item) {
        List<FinishedGoodsBatch> batches = finishedGoodsBatchRepository.findAvailableBatches(factoryId, item.getProductTypeId());

        BigDecimal remaining = item.getDeliveredQuantity();

        for (FinishedGoodsBatch batch : batches) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;

            BigDecimal available = batch.getAvailableQuantity();
            BigDecimal deduct = remaining.min(available);

            batch.setShippedQuantity(batch.getShippedQuantity().add(deduct));
            if (batch.isDepleted()) {
                batch.setStatus("DEPLETED");
            }
            finishedGoodsBatchRepository.save(batch);

            // 记录扣减的批次
            if (item.getFinishedGoodsBatchId() == null) {
                item.setFinishedGoodsBatchId(batch.getId());
            }

            remaining = remaining.subtract(deduct);
        }

        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
            throw new BusinessException(String.format("成品库存不足: 产品=%s, 缺少数量=%s",
                item.getProductTypeId(), remaining.toPlainString()));
        }
    }

    private void updateOrderDeliveryStatus(SalesDeliveryRecord record) {
        SalesOrder order = salesOrderRepository.findById(record.getSalesOrderId()).orElse(null);
        if (order == null) return;

        List<SalesOrderItem> orderItems = salesOrderItemRepository.findBySalesOrderId(order.getId());

        // 累加本次发货数量
        for (SalesDeliveryItem deliveryItem : record.getItems()) {
            for (SalesOrderItem orderItem : orderItems) {
                if (orderItem.getProductTypeId().equals(deliveryItem.getProductTypeId())) {
                    BigDecimal newDelivered = orderItem.getDeliveredQuantity().add(deliveryItem.getDeliveredQuantity());
                    orderItem.setDeliveredQuantity(newDelivered);
                }
            }
        }
        salesOrderItemRepository.saveAll(orderItems);

        boolean allDelivered = orderItems.stream().allMatch(item ->
                item.getDeliveredQuantity().compareTo(item.getQuantity()) >= 0);

        if (allDelivered) {
            order.setStatus(SalesOrderStatus.COMPLETED);
        } else {
            order.setStatus(SalesOrderStatus.PARTIAL_DELIVERED);
        }
        salesOrderRepository.save(order);
    }
}
