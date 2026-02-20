package com.cretas.aims.service.inventory.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreatePurchaseOrderRequest;
import com.cretas.aims.dto.inventory.CreateReceiveRecordRequest;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.enums.PurchaseReceiveStatus;
import com.cretas.aims.entity.enums.PurchaseType;
import com.cretas.aims.entity.inventory.*;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.repository.inventory.PurchaseOrderItemRepository;
import com.cretas.aims.repository.inventory.PurchaseOrderRepository;
import com.cretas.aims.repository.inventory.PurchaseReceiveRecordRepository;
import com.cretas.aims.service.inventory.PurchaseService;
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
public class PurchaseServiceImpl implements PurchaseService {

    private static final Logger log = LoggerFactory.getLogger(PurchaseServiceImpl.class);

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;
    private final PurchaseReceiveRecordRepository receiveRecordRepository;
    private final SupplierRepository supplierRepository;
    private final RawMaterialTypeRepository materialTypeRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final com.cretas.aims.service.finance.ArApService arApService;

    public PurchaseServiceImpl(PurchaseOrderRepository purchaseOrderRepository,
                               PurchaseOrderItemRepository purchaseOrderItemRepository,
                               PurchaseReceiveRecordRepository receiveRecordRepository,
                               SupplierRepository supplierRepository,
                               RawMaterialTypeRepository materialTypeRepository,
                               MaterialBatchRepository materialBatchRepository,
                               com.cretas.aims.service.finance.ArApService arApService) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.purchaseOrderItemRepository = purchaseOrderItemRepository;
        this.receiveRecordRepository = receiveRecordRepository;
        this.supplierRepository = supplierRepository;
        this.materialTypeRepository = materialTypeRepository;
        this.materialBatchRepository = materialBatchRepository;
        this.arApService = arApService;
    }

    // ==================== 采购订单 ====================

    @Override
    @Transactional
    public PurchaseOrder createPurchaseOrder(String factoryId, CreatePurchaseOrderRequest request, Long userId) {
        // 验证供应商
        supplierRepository.findByIdAndFactoryId(request.getSupplierId(), factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在或不属于当前组织"));

        // 生成订单号: PO-YYYYMMDD-序号
        String orderNumber = generateOrderNumber(factoryId);

        PurchaseOrder order = new PurchaseOrder();
        order.setFactoryId(factoryId);
        order.setOrderNumber(orderNumber);
        order.setSupplierId(request.getSupplierId());
        order.setPurchaseType(PurchaseType.valueOf(request.getPurchaseType()));
        order.setOrderDate(request.getOrderDate());
        order.setExpectedDeliveryDate(request.getExpectedDeliveryDate());
        order.setRemark(request.getRemark());
        order.setStatus(PurchaseOrderStatus.DRAFT);
        order.setCreatedBy(userId);

        // 保存订单（@PrePersist 自动生成 UUID）
        order = purchaseOrderRepository.save(order);

        // 创建行项目
        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal taxAmount = BigDecimal.ZERO;
        List<PurchaseOrderItem> items = new ArrayList<>();

        for (CreatePurchaseOrderRequest.PurchaseOrderItemDTO itemDTO : request.getItems()) {
            PurchaseOrderItem item = new PurchaseOrderItem();
            item.setPurchaseOrderId(order.getId());
            item.setMaterialTypeId(itemDTO.getMaterialTypeId());
            item.setMaterialName(itemDTO.getMaterialName());
            item.setQuantity(itemDTO.getQuantity());
            item.setUnit(itemDTO.getUnit());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setTaxRate(itemDTO.getTaxRate() != null ? itemDTO.getTaxRate() : BigDecimal.ZERO);
            item.setRemark(itemDTO.getRemark());
            items.add(item);

            BigDecimal lineAmount = item.getLineAmount();
            totalAmount = totalAmount.add(lineAmount);
            taxAmount = taxAmount.add(item.getLineAmountWithTax().subtract(lineAmount));
        }

        purchaseOrderItemRepository.saveAll(items);

        order.setTotalAmount(totalAmount);
        order.setTaxAmount(taxAmount);
        order = purchaseOrderRepository.save(order);

        log.info("创建采购订单: factoryId={}, orderNumber={}, items={}", factoryId, orderNumber, items.size());
        return order;
    }

    @Override
    public PurchaseOrder getPurchaseOrderById(String factoryId, String orderId) {
        PurchaseOrder order = purchaseOrderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("采购订单不存在"));
        if (!order.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该采购订单");
        }
        return order;
    }

    @Override
    public PageResponse<PurchaseOrder> getPurchaseOrders(String factoryId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PurchaseOrder> result = purchaseOrderRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageRequest);
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public PageResponse<PurchaseOrder> getPurchaseOrdersByStatus(String factoryId, PurchaseOrderStatus status, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size);
        Page<PurchaseOrder> result = purchaseOrderRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, status, pageRequest);
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    @Transactional
    public PurchaseOrder submitOrder(String factoryId, String orderId) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        if (order.getStatus() != PurchaseOrderStatus.DRAFT) {
            throw new BusinessException("只有草稿状态的订单可以提交");
        }
        order.setStatus(PurchaseOrderStatus.SUBMITTED);
        log.info("提交采购订单: orderId={}, orderNumber={}", orderId, order.getOrderNumber());
        return purchaseOrderRepository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder approveOrder(String factoryId, String orderId, Long approvedBy) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        if (order.getStatus() != PurchaseOrderStatus.SUBMITTED) {
            throw new BusinessException("只有已提交状态的订单可以审批");
        }
        order.setStatus(PurchaseOrderStatus.APPROVED);
        order.setApprovedBy(approvedBy);
        order.setApprovedAt(LocalDateTime.now());
        log.info("审批采购订单: orderId={}, approvedBy={}", orderId, approvedBy);
        return purchaseOrderRepository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder cancelOrder(String factoryId, String orderId) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        if (order.getStatus() == PurchaseOrderStatus.COMPLETED || order.getStatus() == PurchaseOrderStatus.CLOSED) {
            throw new BusinessException("已完成或已关闭的订单不能取消");
        }
        order.setStatus(PurchaseOrderStatus.CANCELLED);
        log.info("取消采购订单: orderId={}, orderNumber={}", orderId, order.getOrderNumber());
        return purchaseOrderRepository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder updateDraftOrder(String factoryId, String orderId, CreatePurchaseOrderRequest request) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        if (order.getStatus() != PurchaseOrderStatus.DRAFT) {
            throw new BusinessException("只有草稿状态的订单可以编辑");
        }

        // Validate supplier
        supplierRepository.findByIdAndFactoryId(request.getSupplierId(), factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在或不属于当前组织"));

        // Update mutable fields
        order.setSupplierId(request.getSupplierId());
        order.setPurchaseType(PurchaseType.valueOf(request.getPurchaseType()));
        order.setOrderDate(request.getOrderDate());
        order.setExpectedDeliveryDate(request.getExpectedDeliveryDate());
        order.setRemark(request.getRemark());

        // Replace items: delete old, create new
        purchaseOrderItemRepository.deleteAll(
                purchaseOrderItemRepository.findByPurchaseOrderId(orderId));

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal taxAmount = BigDecimal.ZERO;
        List<PurchaseOrderItem> items = new ArrayList<>();

        for (CreatePurchaseOrderRequest.PurchaseOrderItemDTO itemDTO : request.getItems()) {
            PurchaseOrderItem item = new PurchaseOrderItem();
            item.setPurchaseOrderId(orderId);
            item.setMaterialTypeId(itemDTO.getMaterialTypeId());
            item.setMaterialName(itemDTO.getMaterialName());
            item.setQuantity(itemDTO.getQuantity());
            item.setUnit(itemDTO.getUnit());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setTaxRate(itemDTO.getTaxRate() != null ? itemDTO.getTaxRate() : BigDecimal.ZERO);
            item.setRemark(itemDTO.getRemark());
            items.add(item);

            BigDecimal lineAmount = item.getLineAmount();
            totalAmount = totalAmount.add(lineAmount);
            taxAmount = taxAmount.add(item.getLineAmountWithTax().subtract(lineAmount));
        }

        purchaseOrderItemRepository.saveAll(items);
        order.setTotalAmount(totalAmount);
        order.setTaxAmount(taxAmount);
        order = purchaseOrderRepository.save(order);

        log.info("编辑草稿采购订单: orderId={}, orderNumber={}", orderId, order.getOrderNumber());
        return order;
    }

    // ==================== 采购入库 ====================

    @Override
    @Transactional
    public PurchaseReceiveRecord createReceiveRecord(String factoryId, CreateReceiveRecordRequest request, Long userId) {
        // 验证供应商
        supplierRepository.findByIdAndFactoryId(request.getSupplierId(), factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在或不属于当前组织"));

        // 如果关联采购订单，验证订单状态
        if (request.getPurchaseOrderId() != null && !request.getPurchaseOrderId().isEmpty()) {
            PurchaseOrder order = getPurchaseOrderById(factoryId, request.getPurchaseOrderId());
            if (order.getStatus() != PurchaseOrderStatus.APPROVED &&
                    order.getStatus() != PurchaseOrderStatus.PARTIAL_RECEIVED) {
                throw new BusinessException("只有已审批或部分到货状态的订单可以入库");
            }
        }

        // 生成入库单号: RCV-YYYYMMDD-序号
        String receiveNumber = generateReceiveNumber(factoryId);

        PurchaseReceiveRecord record = new PurchaseReceiveRecord();
        record.setFactoryId(factoryId);
        record.setReceiveNumber(receiveNumber);
        record.setPurchaseOrderId(request.getPurchaseOrderId());
        record.setSupplierId(request.getSupplierId());
        record.setReceiveDate(request.getReceiveDate());
        record.setWarehouseId(request.getWarehouseId());
        record.setStatus(PurchaseReceiveStatus.DRAFT);
        record.setReceivedBy(userId);
        record.setRemark(request.getRemark());

        record = receiveRecordRepository.save(record);

        // 创建入库行项目
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (CreateReceiveRecordRequest.ReceiveItemDTO itemDTO : request.getItems()) {
            PurchaseReceiveItem item = new PurchaseReceiveItem();
            item.setReceiveRecordId(record.getId());
            item.setMaterialTypeId(itemDTO.getMaterialTypeId());
            item.setMaterialName(itemDTO.getMaterialName());
            item.setReceivedQuantity(itemDTO.getReceivedQuantity());
            item.setUnit(itemDTO.getUnit());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setQcResult(itemDTO.getQcResult());
            item.setRemark(itemDTO.getRemark());
            record.getItems().add(item);

            if (itemDTO.getUnitPrice() != null) {
                totalAmount = totalAmount.add(itemDTO.getReceivedQuantity().multiply(itemDTO.getUnitPrice()));
            }
        }

        record.setTotalAmount(totalAmount);
        record = receiveRecordRepository.save(record);

        log.info("创建入库单: factoryId={}, receiveNumber={}, items={}", factoryId, receiveNumber, request.getItems().size());
        return record;
    }

    @Override
    @Transactional
    public PurchaseReceiveRecord confirmReceive(String factoryId, String receiveId, Long userId) {
        PurchaseReceiveRecord record = getReceiveRecordById(factoryId, receiveId);
        if (record.getStatus() != PurchaseReceiveStatus.DRAFT && record.getStatus() != PurchaseReceiveStatus.PENDING_QC) {
            throw new BusinessException("只有草稿或待质检状态的入库单可以确认");
        }

        // 确认入库：为每个行项目创建 MaterialBatch
        for (PurchaseReceiveItem item : record.getItems()) {
            MaterialBatch batch = createMaterialBatchFromReceiveItem(factoryId, record, item, userId);
            item.setMaterialBatchId(batch.getId());
        }

        // 更新入库单状态
        record.setStatus(PurchaseReceiveStatus.CONFIRMED);

        // 如果关联采购订单，更新订单的已收货数量和状态
        if (record.getPurchaseOrderId() != null) {
            updateOrderReceiveStatus(record);
        }

        record = receiveRecordRepository.save(record);
        log.info("确认入库: receiveId={}, receiveNumber={}, batchesCreated={}", receiveId, record.getReceiveNumber(), record.getItems().size());

        // 自动创建应付账款（采购入库 → AP_INVOICE）
        if (record.getPurchaseOrderId() != null) {
            try {
                PurchaseOrder order = purchaseOrderRepository.findById(record.getPurchaseOrderId()).orElse(null);
                if (order != null && order.getSupplierId() != null && order.getTotalAmount() != null) {
                    arApService.recordPayable(factoryId, order.getSupplierId(), order.getId(),
                            order.getTotalAmount(), LocalDate.now().plusDays(30), userId,
                            "采购入库自动挂账-" + record.getReceiveNumber());
                    log.info("自动创建应付: orderId={}, amount={}", order.getId(), order.getTotalAmount());
                }
            } catch (BusinessException e) {
                // 重复挂账（ArApService 内置防重），忽略
                log.warn("应付自动挂账跳过(可能已存在): {}", e.getMessage());
            } catch (Exception e) {
                log.error("应付自动挂账失败: receiveId={}", receiveId, e);
            }
        }

        return record;
    }

    @Override
    public PurchaseReceiveRecord getReceiveRecordById(String factoryId, String receiveId) {
        PurchaseReceiveRecord record = receiveRecordRepository.findById(receiveId)
                .orElseThrow(() -> new ResourceNotFoundException("入库单不存在"));
        if (!record.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该入库单");
        }
        return record;
    }

    @Override
    public PageResponse<PurchaseReceiveRecord> getReceiveRecords(String factoryId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PurchaseReceiveRecord> result = receiveRecordRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageRequest);
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public List<PurchaseReceiveRecord> getReceiveRecordsByOrder(String purchaseOrderId) {
        return receiveRecordRepository.findByPurchaseOrderId(purchaseOrderId);
    }

    // ==================== 统计 ====================

    @Override
    public Map<String, Object> getPurchaseStatistics(String factoryId) {
        Map<String, Object> stats = new LinkedHashMap<>();

        // 本月采购统计
        LocalDate now = LocalDate.now();
        LocalDate monthStart = now.withDayOfMonth(1);
        List<PurchaseOrder> monthlyOrders = purchaseOrderRepository.findByFactoryIdAndDateRange(factoryId, monthStart, now);

        long totalOrders = monthlyOrders.size();
        long pendingOrders = monthlyOrders.stream()
                .filter(o -> o.getStatus() == PurchaseOrderStatus.SUBMITTED)
                .count();
        BigDecimal monthlyAmount = monthlyOrders.stream()
                .filter(o -> o.getStatus() != PurchaseOrderStatus.CANCELLED)
                .map(PurchaseOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        stats.put("monthlyOrderCount", totalOrders);
        stats.put("pendingApprovalCount", pendingOrders);
        stats.put("monthlyPurchaseAmount", monthlyAmount);

        return stats;
    }

    // ==================== 内部方法 ====================

    private String generateOrderNumber(String factoryId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = purchaseOrderRepository.countByFactoryIdAndDate(factoryId, LocalDate.now());
        return String.format("PO-%s-%04d", dateStr, count + 1);
    }

    private String generateReceiveNumber(String factoryId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        // 用时间戳后4位 + 随机数确保唯一
        long ts = System.currentTimeMillis() % 10000;
        return String.format("RCV-%s-%04d", dateStr, ts);
    }

    private MaterialBatch createMaterialBatchFromReceiveItem(String factoryId, PurchaseReceiveRecord record, PurchaseReceiveItem item, Long userId) {
        // 查找原料类型获取保质期等信息
        RawMaterialType materialType = materialTypeRepository.findById(item.getMaterialTypeId()).orElse(null);

        String batchNumber = String.format("MT-%s-%04d",
                LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")),
                System.currentTimeMillis() % 10000);

        MaterialBatch batch = new MaterialBatch();
        batch.setId(UUID.randomUUID().toString());
        batch.setFactoryId(factoryId);
        batch.setBatchNumber(batchNumber);
        batch.setMaterialTypeId(item.getMaterialTypeId());
        batch.setSupplierId(record.getSupplierId());
        batch.setReceiptQuantity(item.getReceivedQuantity());
        batch.setUsedQuantity(BigDecimal.ZERO);
        batch.setReservedQuantity(BigDecimal.ZERO);
        batch.setQuantityUnit(item.getUnit());
        batch.setUnitPrice(item.getUnitPrice());
        batch.setReceiptDate(record.getReceiveDate());
        batch.setPurchaseDate(record.getReceiveDate());
        batch.setStatus(MaterialBatchStatus.AVAILABLE);
        batch.setCreatedBy(userId);

        // 根据原料类型计算过期日期
        if (materialType != null && materialType.getShelfLifeDays() != null) {
            batch.setExpireDate(record.getReceiveDate().plusDays(materialType.getShelfLifeDays()));
        }

        batch = materialBatchRepository.save(batch);
        log.debug("创建物料批次: batchId={}, batchNumber={}, materialTypeId={}, qty={}",
                batch.getId(), batchNumber, item.getMaterialTypeId(), item.getReceivedQuantity());
        return batch;
    }

    private void updateOrderReceiveStatus(PurchaseReceiveRecord record) {
        PurchaseOrder order = purchaseOrderRepository.findById(record.getPurchaseOrderId()).orElse(null);
        if (order == null) return;

        List<PurchaseOrderItem> orderItems = purchaseOrderItemRepository.findByPurchaseOrderId(order.getId());

        // 累加本次入库数量到订单行项目
        for (PurchaseReceiveItem receiveItem : record.getItems()) {
            for (PurchaseOrderItem orderItem : orderItems) {
                if (orderItem.getMaterialTypeId().equals(receiveItem.getMaterialTypeId())) {
                    BigDecimal newReceived = orderItem.getReceivedQuantity().add(receiveItem.getReceivedQuantity());
                    orderItem.setReceivedQuantity(newReceived);
                }
            }
        }
        purchaseOrderItemRepository.saveAll(orderItems);

        // 判断是否全部到货
        boolean allReceived = orderItems.stream().allMatch(item ->
                item.getReceivedQuantity().compareTo(item.getQuantity()) >= 0);

        if (allReceived) {
            order.setStatus(PurchaseOrderStatus.COMPLETED);
        } else {
            order.setStatus(PurchaseOrderStatus.PARTIAL_RECEIVED);
        }
        purchaseOrderRepository.save(order);
    }
}
