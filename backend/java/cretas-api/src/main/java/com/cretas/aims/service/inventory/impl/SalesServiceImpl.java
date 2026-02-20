package com.cretas.aims.service.inventory.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateDeliveryRequest;
import com.cretas.aims.dto.inventory.CreateSalesOrderRequest;
import com.cretas.aims.entity.enums.SalesDeliveryStatus;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import com.cretas.aims.entity.inventory.*;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.inventory.*;
import com.cretas.aims.service.inventory.SalesService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    private final com.cretas.aims.service.finance.ArApService arApService;

    public SalesServiceImpl(SalesOrderRepository salesOrderRepository,
                            SalesOrderItemRepository salesOrderItemRepository,
                            SalesDeliveryRecordRepository deliveryRecordRepository,
                            FinishedGoodsBatchRepository finishedGoodsBatchRepository,
                            CustomerRepository customerRepository,
                            com.cretas.aims.service.finance.ArApService arApService) {
        this.salesOrderRepository = salesOrderRepository;
        this.salesOrderItemRepository = salesOrderItemRepository;
        this.deliveryRecordRepository = deliveryRecordRepository;
        this.finishedGoodsBatchRepository = finishedGoodsBatchRepository;
        this.customerRepository = customerRepository;
        this.arApService = arApService;
    }

    // ==================== 销售订单 ====================

    @Override
    @Transactional
    public SalesOrder createSalesOrder(String factoryId, CreateSalesOrderRequest request, Long userId) {
        // 验证客户
        customerRepository.findByIdAndFactoryId(request.getCustomerId(), factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在或不属于当前组织"));

        String orderNumber = generateSalesOrderNumber(factoryId);

        SalesOrder order = new SalesOrder();
        order.setFactoryId(factoryId);
        order.setOrderNumber(orderNumber);
        order.setCustomerId(request.getCustomerId());
        order.setOrderDate(request.getOrderDate());
        order.setRequiredDeliveryDate(request.getRequiredDeliveryDate());
        order.setDeliveryAddress(request.getDeliveryAddress());
        order.setDiscountAmount(request.getDiscountAmount() != null ? request.getDiscountAmount() : BigDecimal.ZERO);
        order.setRemark(request.getRemark());
        order.setStatus(SalesOrderStatus.DRAFT);
        order.setCreatedBy(userId);

        order = salesOrderRepository.save(order);

        // 创建行项目
        BigDecimal totalAmount = BigDecimal.ZERO;
        List<SalesOrderItem> items = new ArrayList<>();

        for (CreateSalesOrderRequest.SalesOrderItemDTO itemDTO : request.getItems()) {
            SalesOrderItem item = new SalesOrderItem();
            item.setSalesOrderId(order.getId());
            item.setProductTypeId(itemDTO.getProductTypeId());
            item.setProductName(itemDTO.getProductName());
            item.setQuantity(itemDTO.getQuantity());
            item.setUnit(itemDTO.getUnit());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setDiscountRate(itemDTO.getDiscountRate() != null ? itemDTO.getDiscountRate() : BigDecimal.ZERO);
            item.setRemark(itemDTO.getRemark());
            items.add(item);

            totalAmount = totalAmount.add(item.getLineAmount());
        }

        salesOrderItemRepository.saveAll(items);

        order.setTotalAmount(totalAmount);
        order = salesOrderRepository.save(order);

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
        if (order.getStatus() != SalesOrderStatus.DRAFT) {
            throw new BusinessException("只有草稿状态的订单可以确认");
        }
        order.setStatus(SalesOrderStatus.CONFIRMED);
        order.setConfirmedAt(LocalDateTime.now());
        log.info("确认销售订单: orderId={}, orderNumber={}", orderId, order.getOrderNumber());
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
            if (order.getStatus() != SalesOrderStatus.CONFIRMED &&
                    order.getStatus() != SalesOrderStatus.PROCESSING &&
                    order.getStatus() != SalesOrderStatus.PARTIAL_DELIVERED) {
                throw new BusinessException("只有已确认/处理中/部分发货状态的订单可以创建发货单");
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
                .filter(o -> o.getStatus() == SalesOrderStatus.CONFIRMED || o.getStatus() == SalesOrderStatus.PROCESSING)
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
            log.warn("成品库存不足: productTypeId={}, 缺少数量={}", item.getProductTypeId(), remaining);
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
