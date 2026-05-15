package com.cretas.aims.service.inventory.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreatePurchaseOrderRequest;
import com.cretas.aims.dto.inventory.CreateReceiveRecordRequest;
import com.cretas.aims.dto.inventory.UpdatePurchaseOrderRequest;
import com.cretas.aims.dto.inventory.MaterialPriceComparisonDTO;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.enums.PurchaseReceiveStatus;
import com.cretas.aims.entity.enums.PurchaseType;
import com.cretas.aims.entity.inventory.*;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.entity.bom.BomItem;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.repository.bom.BomItemRepository;
import com.cretas.aims.repository.inventory.PurchaseOrderItemRepository;
import com.cretas.aims.repository.inventory.PurchaseOrderRepository;
import com.cretas.aims.repository.inventory.PurchaseReceiveRecordRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.event.MaterialReceivedEvent;
import com.cretas.aims.service.MaterialBatchService;
import com.cretas.aims.service.inventory.PurchaseService;
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
public class PurchaseServiceImpl implements PurchaseService {

    private static final Logger log = LoggerFactory.getLogger(PurchaseServiceImpl.class);

    /**
     * 抄收上限率（默认 30%，per audio May 7 客户通话 "餐饮/物业行业正常抄收应该是30%以内"）。
     *
     * 实际累计收货量上限 = 下单量 × (1 + overReceiveRate)。超过则 confirmReceive 抛
     * BusinessException 409 + 事务回滚，要求采购另下新订单。
     *
     * 旧逻辑漏洞：updateOrderReceiveStatus 仅累加 + 设状态，无上限校验 → 分批入库
     * 第二次/N 次可无限超收。客户在 audio 中提及的 30% 上限即此修复。
     *
     * 双轨说明：纯 backend service-level 校验，LEGACY 和 CANVAS (DynamicModulePage)
     * 都走同一 createReceiveRecord → confirmReceive 路径，不分模式。
     *
     * Ops 调整：在 application.properties 设 cretas.purchase.over-receive-rate=0.50
     * 等可临时放宽，无需 rebuild。
     */
    @org.springframework.beans.factory.annotation.Value("${cretas.purchase.over-receive-rate:0.30}")
    private BigDecimal overReceiveRate;

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;
    private final PurchaseReceiveRecordRepository receiveRecordRepository;
    private final SupplierRepository supplierRepository;
    private final RawMaterialTypeRepository materialTypeRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final BomItemRepository bomItemRepository;
    private final com.cretas.aims.service.finance.ArApService arApService;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final MaterialBatchService materialBatchService;

    /** Rule 2 hydration: lookup SO orderNumber for PO.salesOrderNumber @Transient. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private SalesOrderRepository salesOrderRepository;

    /** Canvas V2: DB-driven validation rules */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.ValidationRuleEvaluator validationRuleEvaluator;

    /**
     * Round 11 T1 — Canvas Integration Template hook 2.
     * Writes factory-configured dynamic fields into cf_* columns on
     * purchase_receive_records so downstream trigger chains, reports, and
     * exports can read them alongside the standard columns.
     */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.DynamicFieldService dynamicFieldService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.DefaultValueResolver defaultValueResolver;

    /** D1 双仓流转 (2026-05-10 spec, PR #309 A1=A) — 采购入库默认 WH-LOG. */
    @org.springframework.beans.factory.annotation.Autowired
    private com.cretas.aims.service.factory.WarehouseResolver warehouseResolver;

    /** 三价对比偏差预警阈值（10%） */
    private static final BigDecimal PRICE_ALERT_THRESHOLD = new BigDecimal("10");

    public PurchaseServiceImpl(PurchaseOrderRepository purchaseOrderRepository,
                               PurchaseOrderItemRepository purchaseOrderItemRepository,
                               PurchaseReceiveRecordRepository receiveRecordRepository,
                               SupplierRepository supplierRepository,
                               RawMaterialTypeRepository materialTypeRepository,
                               MaterialBatchRepository materialBatchRepository,
                               BomItemRepository bomItemRepository,
                               com.cretas.aims.service.finance.ArApService arApService,
                               ApplicationEventPublisher applicationEventPublisher,
                               MaterialBatchService materialBatchService) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.purchaseOrderItemRepository = purchaseOrderItemRepository;
        this.receiveRecordRepository = receiveRecordRepository;
        this.supplierRepository = supplierRepository;
        this.materialTypeRepository = materialTypeRepository;
        this.materialBatchRepository = materialBatchRepository;
        this.bomItemRepository = bomItemRepository;
        this.arApService = arApService;
        this.applicationEventPublisher = applicationEventPublisher;
        this.materialBatchService = materialBatchService;
    }

    // ==================== 采购订单 ====================

    @Override
    @Transactional
    public PurchaseOrder createPurchaseOrder(String factoryId, CreatePurchaseOrderRequest request, Long userId) {
        // Canvas V2: DB-driven validation
        if (validationRuleEvaluator != null) {
            try {
                validationRuleEvaluator.validate(factoryId, "purchase_order", "CREATE",
                        java.util.Map.of("itemCount", request.getItems() != null ? request.getItems().size() : 0));
            } catch (com.cretas.aims.exception.BusinessException e) { throw e; }
            catch (Exception e) { log.warn("Canvas validation non-blocking: {}", e.getMessage()); }
        }

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
        // W-12 fix: persist salesOrderId for cross-module tracking (SO detail "关联采购" tab)
        order.setSalesOrderId(request.getSalesOrderId());
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
            // 自动填充原料名称：前端未传时从基础数据查询
            String materialName = itemDTO.getMaterialName();
            if (materialName == null || materialName.isBlank()) {
                materialName = materialTypeRepository.findById(itemDTO.getMaterialTypeId())
                        .map(RawMaterialType::getName).orElse(null);
            }
            item.setMaterialName(materialName);
            item.setQuantity(itemDTO.getQuantity());
            item.setUnit(itemDTO.getUnit());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setTaxRate(itemDTO.getTaxRate() != null ? itemDTO.getTaxRate() : BigDecimal.ZERO);
            item.setRemark(itemDTO.getRemark());
            item.setSpecification(itemDTO.getSpecification());
            item.setBoxQuantity(itemDTO.getBoxQuantity());
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
            throw new BusinessException(403, "无权访问该采购订单")
                    .withHint("当前采购订单不属于该工厂, 无法访问");
        }
        hydrateSalesOrderNumber(order);
        return order;
    }

    @Override
    public PurchaseOrder getPurchaseOrderByNumber(String factoryId, String orderNumber) {
        PurchaseOrder order = purchaseOrderRepository.findByFactoryIdAndOrderNumber(factoryId, orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("采购订单不存在: " + orderNumber));
        hydrateSalesOrderNumber(order);
        return order;
    }

    /**
     * Rule 2 hydration: 给 PO 填 salesOrderNumber (@Transient). 前端"关联销售订单"
     * 展示直接用, 免去 1+N 查询 SO. Null-safe — 无 salesOrderId 时不查.
     */
    private void hydrateSalesOrderNumber(PurchaseOrder order) {
        if (order == null || order.getSalesOrderId() == null || salesOrderRepository == null) return;
        try {
            salesOrderRepository.findById(order.getSalesOrderId())
                    .ifPresent(so -> order.setSalesOrderNumber(so.getOrderNumber()));
        } catch (Exception e) {
            log.debug("hydrate salesOrderNumber failed for PO {}: {}", order.getId(), e.getMessage());
        }
    }

    /**
     * Rule 2 hydration (batch): 给 list 结果一次性填 salesOrderNumber, 避免 1+N.
     * 收集唯一 salesOrderIds → findAllById → map → set 回每个 PO.
     */
    private void hydrateSalesOrderNumbers(List<PurchaseOrder> orders) {
        if (orders == null || orders.isEmpty() || salesOrderRepository == null) return;
        Set<String> ids = orders.stream()
                .map(PurchaseOrder::getSalesOrderId)
                .filter(id -> id != null && !id.isEmpty())
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return;
        try {
            Map<String, String> idToNumber = new HashMap<>();
            salesOrderRepository.findAllById(ids).forEach(so -> idToNumber.put(so.getId(), so.getOrderNumber()));
            for (PurchaseOrder po : orders) {
                if (po.getSalesOrderId() != null) {
                    String num = idToNumber.get(po.getSalesOrderId());
                    if (num != null) po.setSalesOrderNumber(num);
                }
            }
        } catch (Exception e) {
            log.debug("batch hydrate salesOrderNumber failed: {}", e.getMessage());
        }
    }

    @Override
    public PageResponse<PurchaseOrder> getPurchaseOrders(String factoryId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PurchaseOrder> result = purchaseOrderRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageRequest);
        hydrateSalesOrderNumbers(result.getContent());
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public PageResponse<PurchaseOrder> getPurchaseOrdersByStatus(String factoryId, PurchaseOrderStatus status, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size);
        Page<PurchaseOrder> result = purchaseOrderRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, status, pageRequest);
        hydrateSalesOrderNumbers(result.getContent());
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public PageResponse<PurchaseOrder> getPurchaseOrdersBySalesOrder(String factoryId, String salesOrderId, int page, int size) {
        // W-12 fix: SO detail page's "关联采购" tab needs this filter
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PurchaseOrder> result = purchaseOrderRepository.findByFactoryIdAndSalesOrderId(factoryId, salesOrderId, pageRequest);
        hydrateSalesOrderNumbers(result.getContent());
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    @Transactional
    public PurchaseOrder submitOrder(String factoryId, String orderId) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        if (order.getStatus() != PurchaseOrderStatus.DRAFT) {
            throw new BusinessException(409, "只有草稿状态的订单可以提交")
                    .withHint("请刷新订单列表查看最新状态");
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
            throw new BusinessException(409, "只有已提交状态的订单可以审批")
                    .withHint("请刷新订单列表查看最新状态");
        }
        order.setStatus(PurchaseOrderStatus.APPROVED);
        order.setApprovedBy(approvedBy);
        order.setApprovedAt(LocalDateTime.now());
        log.info("审批采购订单: orderId={}, approvedBy={}", orderId, approvedBy);
        return purchaseOrderRepository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder submitForFinanceReview(String factoryId, String orderId) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        if (order.getStatus() != PurchaseOrderStatus.APPROVED) {
            throw new BusinessException(409, "只有已审批状态的订单可以提交财务审核")
                    .withHint("请刷新订单列表查看最新状态");
        }
        order.setStatus(PurchaseOrderStatus.PENDING_FINANCE_REVIEW);
        log.info("采购订单提交财务审核: orderId={}", orderId);
        return purchaseOrderRepository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder financeApproveOrder(String factoryId, String orderId, Long reviewedBy, String notes) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        if (order.getStatus() != PurchaseOrderStatus.PENDING_FINANCE_REVIEW) {
            throw new BusinessException(409, "只有待财务审核状态的订单可以审核")
                    .withHint("请刷新订单列表查看最新状态");
        }
        order.setStatus(PurchaseOrderStatus.FINANCE_APPROVED);
        order.setFinanceReviewedBy(reviewedBy);
        order.setFinanceReviewedAt(java.time.LocalDateTime.now());
        order.setFinanceReviewNotes(notes);
        log.info("采购订单财务审核通过: orderId={}, reviewedBy={}", orderId, reviewedBy);
        return purchaseOrderRepository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder financeRejectOrder(String factoryId, String orderId, Long reviewedBy, String notes) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        if (order.getStatus() != PurchaseOrderStatus.PENDING_FINANCE_REVIEW) {
            throw new BusinessException(409, "只有待财务审核状态的订单可以驳回")
                    .withHint("请刷新订单列表查看最新状态");
        }
        order.setStatus(PurchaseOrderStatus.FINANCE_REJECTED);
        order.setFinanceReviewedBy(reviewedBy);
        order.setFinanceReviewedAt(java.time.LocalDateTime.now());
        order.setFinanceReviewNotes(notes);
        log.info("采购订单财务审核驳回: orderId={}, reviewedBy={}", orderId, reviewedBy);
        return purchaseOrderRepository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder cancelOrder(String factoryId, String orderId) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        // R39 BUG-8 sister fix: was only blocking COMPLETED/CLOSED → FINANCE_APPROVED/PARTIAL_RECEIVED/CANCELLED
        // could be cancelled, breaking AP + inventory invariants. Use whitelist.
        if (!com.cretas.aims.domain.OrderUsageWhitelists.PO_CANCELLABLE.contains(order.getStatus())) {
            throw new BusinessException(409,
                    "当前采购单状态(" + order.getStatus().getDisplayName() + ")不允许取消。"
                  + "财务批准/部分到货后请通过退货流程处理")
                    .withHint("请刷新订单列表查看最新状态");
        }
        order.setStatus(PurchaseOrderStatus.CANCELLED);
        log.info("取消采购订单: orderId={}, orderNumber={}", orderId, order.getOrderNumber());
        return purchaseOrderRepository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder updateDraftOrder(String factoryId, String orderId, UpdatePurchaseOrderRequest request) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        if (order.getStatus() != PurchaseOrderStatus.DRAFT) {
            throw new BusinessException(409, "只有草稿状态的订单可以编辑")
                    .withHint("请刷新订单列表查看最新状态");
        }
        // Optimistic lock: explicit compare (see CustomerServiceImpl for rationale)
        if (request.getVersion() != null && !request.getVersion().equals(order.getVersion())) {
            throw new org.springframework.orm.ObjectOptimisticLockingFailureException(
                PurchaseOrder.class, orderId);
        }

        // Partial update — only touch fields the caller sent
        if (request.getSupplierId() != null) {
            // Validate supplier only when changed
            supplierRepository.findByIdAndFactoryId(request.getSupplierId(), factoryId)
                    .orElseThrow(() -> new ResourceNotFoundException("供应商不存在或不属于当前组织"));
            order.setSupplierId(request.getSupplierId());
        }
        if (request.getPurchaseType() != null) {
            order.setPurchaseType(PurchaseType.valueOf(request.getPurchaseType()));
        }
        if (request.getOrderDate() != null) {
            order.setOrderDate(request.getOrderDate());
        }
        if (request.getExpectedDeliveryDate() != null) {
            order.setExpectedDeliveryDate(request.getExpectedDeliveryDate());
        }
        if (request.getRemark() != null) {
            order.setRemark(request.getRemark());
        }
        // W-12 fix: also update salesOrderId (null-safe — null means caller didn't send, not unlink)
        if (request.getSalesOrderId() != null) {
            order.setSalesOrderId(request.getSalesOrderId());
        }

        // Replace items only when request.items is provided (null = keep existing)
        BigDecimal totalAmount = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal taxAmount = order.getTaxAmount() != null ? order.getTaxAmount() : BigDecimal.ZERO;
        List<PurchaseOrderItem> items = new ArrayList<>();

        if (request.getItems() != null) {
        purchaseOrderItemRepository.deleteAll(
                purchaseOrderItemRepository.findByPurchaseOrderId(orderId));

        totalAmount = BigDecimal.ZERO;
        taxAmount = BigDecimal.ZERO;
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
        } // end if (request.getItems() != null)
        order = purchaseOrderRepository.save(order);

        log.info("编辑草稿采购订单: orderId={}, orderNumber={}", orderId, order.getOrderNumber());
        return order;
    }

    // ==================== 采购入库 ====================

    @Override
    @Transactional
    public PurchaseReceiveRecord createReceiveRecord(String factoryId, CreateReceiveRecordRequest request, Long userId) {
        // Round 11 T1: Canvas Integration Template hook 1 — DB-driven validation
        if (validationRuleEvaluator != null) {
            try {
                validationRuleEvaluator.validate(factoryId, "purchase_receipt", "CREATE",
                        java.util.Map.of(
                            "itemCount", request.getItems() != null ? request.getItems().size() : 0,
                            "supplierId", request.getSupplierId() != null ? request.getSupplierId() : ""));
            } catch (com.cretas.aims.exception.BusinessException e) { throw e; }
            catch (Exception e) { log.warn("Canvas validation non-blocking: {}", e.getMessage()); }
        }

        // 验证供应商
        supplierRepository.findByIdAndFactoryId(request.getSupplierId(), factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在或不属于当前组织"));

        // R23 audit C3: was inline {APPROVED, FINANCE_APPROVED, PARTIAL_RECEIVED}
        // — distinct from PO_RECEIVABLE because this stricter ops-side variant
        // excludes PENDING_FINANCE_REVIEW (only operational receive). Centralized as PO_OPS_RECEIVABLE.
        if (request.getPurchaseOrderId() != null && !request.getPurchaseOrderId().isEmpty()) {
            PurchaseOrder order = getPurchaseOrderById(factoryId, request.getPurchaseOrderId());
            if (order.getStatus() == null
                    || !com.cretas.aims.domain.OrderUsageWhitelists.PO_OPS_RECEIVABLE.contains(order.getStatus())) {
                throw new BusinessException(409, "只有已审批、财务已审核或部分到货状态的订单可以入库")
                        .withHint("请刷新订单列表查看最新状态");
            }

            // PR #173 reviewer follow-up I-2: 早返超收上限校验.
            // 旧行为: cap 校验只在 confirmReceive → updateOrderReceiveStatus (line ~845) 触发,
            // 即用户走完 DRAFT 创建 + QC 流程, 在 confirm 阶段才知道超收 → 体验差.
            // 新行为: 在 DRAFT 创建时同步校验 (基于 request.items 的累计预估),
            // 用户立即看到 "超出可入库上限" 提示, 不用再走质检流程.
            // 注: confirmReceive 也保留 updateOrderReceiveStatus 内的二次校验作为防御
            // (防止 DRAFT → PENDING_QC → CONFIRMED 期间另一并发入库已 commit, 致使原本合法的草稿在
            // confirm 时变非法).
            validateOverReceiveCap(order, request.getItems());
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

        // Round 11 T1: Canvas Integration Template hook 2 — persist dynamic fields.
        // Customer-configured fields (运输温度记录, 质检报告附件, 外包装状态) land in
        // cf_* columns on purchase_receive_records. Silent failure must not break
        // the receive record creation.
        if (dynamicFieldService != null && request.getCustomFields() != null && !request.getCustomFields().isEmpty()) {
            try {
                dynamicFieldService.setDynamicFields(factoryId, "purchase_receipt", record.getId(), request.getCustomFields());
            } catch (Exception e) {
                log.warn("Canvas dynamic fields save failed for purchase receive {}: {}", record.getId(), e.getMessage());
            }
        }

        // Round 11 T1: Canvas Integration Template hook 3 — publish event for trigger chains.
        // Fires on DRAFT creation; distinct from MaterialReceivedEvent which fires on
        // CONFIRMED state via confirmReceive. Factories can now react to receive-draft
        // creation (e.g., auto-create QC sampling task).
        try {
            applicationEventPublisher.publishEvent(new com.cretas.aims.event.PurchaseReceiveCreatedEvent(
                    this, factoryId, record.getId(), record.getReceiveNumber(),
                    record.getSupplierId(), record.getPurchaseOrderId(), record.getTotalAmount()));
        } catch (Exception e) {
            log.warn("Publish PurchaseReceiveCreatedEvent failed for {}: {}", record.getId(), e.getMessage());
        }

        log.info("创建入库单: factoryId={}, receiveNumber={}, items={}", factoryId, receiveNumber, request.getItems().size());
        return record;
    }

    @Override
    @Transactional
    public PurchaseReceiveRecord confirmReceive(String factoryId, String receiveId, Long userId) {
        PurchaseReceiveRecord record = getReceiveRecordById(factoryId, receiveId);
        if (record.getStatus() != PurchaseReceiveStatus.DRAFT && record.getStatus() != PurchaseReceiveStatus.PENDING_QC) {
            throw new BusinessException(409, "只有草稿或待质检状态的入库单可以确认")
                    .withHint("请刷新入库单列表查看最新状态");
        }

        // 确认入库：为每个行项目创建 MaterialBatch
        // 注意: createMaterialBatchFromReceiveItem 直接 new MaterialBatch + repo.save,
        // 绕开了 MaterialBatchService.createMaterialBatch 路径上的 updateMovingAvgPrice。
        // 必须在此显式调用 recalculateMovingAvgPrice, 否则 raw_material_types.moving_avg_price
        // 永远不会被采购入库流程更新, 三价对比的"移动均价"列将永远为 -。
        for (PurchaseReceiveItem item : record.getItems()) {
            MaterialBatch batch = createMaterialBatchFromReceiveItem(factoryId, record, item, userId);
            item.setMaterialBatchId(batch.getId());
            materialBatchService.recalculateMovingAvgPrice(
                    item.getMaterialTypeId(),
                    item.getReceivedQuantity(),
                    item.getUnitPrice(),
                    batch.getId());
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

        // 发布物料收货事件 → 触发供应链联动（检查PP原料到齐状态）
        for (PurchaseReceiveItem item : record.getItems()) {
            try {
                BigDecimal qty = item.getReceivedQuantity() != null ? item.getReceivedQuantity() : BigDecimal.ZERO;
                applicationEventPublisher.publishEvent(new MaterialReceivedEvent(
                    this, factoryId, record.getPurchaseOrderId(),
                    item.getMaterialTypeId(), qty));
                log.info("已发布MaterialReceivedEvent: material={}, qty={}", item.getMaterialTypeId(), qty);
            } catch (Exception e) {
                log.error("发布MaterialReceivedEvent失败(不影响主流程): material={}", item.getMaterialTypeId(), e);
            }
        }

        return record;
    }

    @Override
    public PurchaseReceiveRecord getReceiveRecordById(String factoryId, String receiveId) {
        PurchaseReceiveRecord record = receiveRecordRepository.findById(receiveId)
                .orElseThrow(() -> new ResourceNotFoundException("入库单不存在"));
        if (!record.getFactoryId().equals(factoryId)) {
            throw new BusinessException(403, "无权访问该入库单")
                    .withHint("当前入库单不属于该工厂, 无法访问");
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

    // ==================== 三价对比 ====================

    @Override
    public List<MaterialPriceComparisonDTO> getOrderPriceComparison(String factoryId, String orderId) {
        PurchaseOrder order = getPurchaseOrderById(factoryId, orderId);
        List<PurchaseOrderItem> items = purchaseOrderItemRepository.findByPurchaseOrderId(order.getId());

        return items.stream()
                .map(item -> buildPriceComparison(factoryId, item.getMaterialTypeId(),
                        item.getMaterialName(), item.getUnitPrice()))
                .collect(Collectors.toList());
    }

    @Override
    public MaterialPriceComparisonDTO getMaterialPriceInfo(String factoryId, String materialTypeId, BigDecimal currentPrice) {
        RawMaterialType materialType = materialTypeRepository.findById(materialTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("原料类型不存在: " + materialTypeId));
        if (!materialType.getFactoryId().equals(factoryId)) {
            throw new BusinessException(403, "无权访问该原料类型")
                    .withHint("当前原料类型不属于该工厂, 无法访问");
        }
        return buildPriceComparison(factoryId, materialTypeId, materialType.getName(), currentPrice);
    }

    /**
     * 构建单个原料的三价对比数据.
     *
     * <p>2026-05-15 (Day 8-9): 新增 {@code dataSourceHint} 字段, 解释为何某价 null.
     * 客户原话 (六扇门第三次 May7): "三家对比没有 — 可能是一些数据的 bug". 实际是
     * 移动均价基于入库 (raw_material_types.moving_avg_price 来自历次入库累积),
     * BOM 标准价基于 BOM 配置 — 新原料 / 未入库 / 未配 BOM 时这两个字段必然 null.
     * 此前 UI 显示"-", 客户误以为是 bug. 现在 dataSourceHint 明确告诉用户原因.
     */
    private MaterialPriceComparisonDTO buildPriceComparison(String factoryId, String materialTypeId,
                                                             String materialName, BigDecimal currentPrice) {
        // 1. 查询原料类型获取移动平均价和基础信息
        RawMaterialType materialType = materialTypeRepository.findById(materialTypeId).orElse(null);
        BigDecimal movingAvgPrice = materialType != null ? materialType.getMovingAvgPrice() : null;
        String materialCode = materialType != null ? materialType.getCode() : null;
        String unit = materialType != null ? materialType.getUnit() : null;
        String name = materialName != null ? materialName : (materialType != null ? materialType.getName() : materialTypeId);

        // 2. 查询BOM获取标准单价（如果该原料出现在多个产品的BOM中，取平均值）
        List<BomItem> bomItems = bomItemRepository.findByFactoryIdAndMaterialTypeIdAndDeletedAtIsNull(factoryId, materialTypeId);
        BigDecimal bomStandardPrice = null;
        String bomProductNames = null;

        if (!bomItems.isEmpty()) {
            // 过滤掉没有单价的BOM项
            List<BomItem> pricedItems = bomItems.stream()
                    .filter(b -> b.getUnitPrice() != null && b.getUnitPrice().compareTo(BigDecimal.ZERO) > 0)
                    .collect(Collectors.toList());

            if (!pricedItems.isEmpty()) {
                BigDecimal sum = pricedItems.stream()
                        .map(BomItem::getUnitPrice)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                bomStandardPrice = sum.divide(new BigDecimal(pricedItems.size()), 4, BigDecimal.ROUND_HALF_UP);
            }

            // 收集关联的产品名称
            bomProductNames = bomItems.stream()
                    .map(BomItem::getProductName)
                    .filter(Objects::nonNull)
                    .distinct()
                    .collect(Collectors.joining(", "));
            if (bomProductNames.isEmpty()) {
                bomProductNames = null;
            }
        }

        // 3. 计算偏差百分比
        BigDecimal varianceFromBom = calculateVariance(currentPrice, bomStandardPrice);
        BigDecimal varianceFromAvg = calculateVariance(currentPrice, movingAvgPrice);

        // 4. 判断是否价格异常
        boolean alert = false;
        if (varianceFromBom != null && varianceFromBom.abs().compareTo(PRICE_ALERT_THRESHOLD) > 0) {
            alert = true;
        }
        if (varianceFromAvg != null && varianceFromAvg.abs().compareTo(PRICE_ALERT_THRESHOLD) > 0) {
            alert = true;
        }

        // 5. 数据源诊断 — 帮 F006 仓管区分 "数据 bug" 和 "业务正常空态"
        String dataSourceHint = PurchaseServiceImpl.buildPriceDataSourceHint(bomStandardPrice, movingAvgPrice);

        return MaterialPriceComparisonDTO.builder()
                .materialTypeId(materialTypeId)
                .materialName(name)
                .materialCode(materialCode)
                .unit(unit)
                .bomStandardPrice(bomStandardPrice)
                .movingAvgPrice(movingAvgPrice)
                .currentPrice(currentPrice)
                .varianceFromBom(varianceFromBom)
                .varianceFromAvg(varianceFromAvg)
                .priceAlert(alert)
                .bomProductNames(bomProductNames)
                .dataSourceHint(dataSourceHint)
                .build();
    }

    /**
     * 构造数据源缺失提示 — Day 8-9 三价对比 bug 修复.
     *
     * <p>客户场景区分:
     * <ul>
     *   <li>BOM null + 移动均价 null → "新原料首次采购" (业务正常)</li>
     *   <li>BOM null + 移动均价 OK → "未配 BOM, 仅可对比历史均价"</li>
     *   <li>BOM OK + 移动均价 null → "尚无入库, 仅可对比 BOM 标准价"</li>
     *   <li>双有 → null (正常对比, 无需 hint)</li>
     * </ul>
     */
    // package-private static for test (PurchaseServicePriceHintTest) — pure function, 无依赖
    static String buildPriceDataSourceHint(BigDecimal bomStandardPrice, BigDecimal movingAvgPrice) {
        boolean missingBom = (bomStandardPrice == null);
        boolean missingAvg = (movingAvgPrice == null);
        if (!missingBom && !missingAvg) {
            return null;
        }
        if (missingBom && missingAvg) {
            return "新原料首次采购 — 三价对比基于 BOM 标准价 + 历次入库均价, 当前两项均无数据, 入库后自动累积 (这是预期状态, 不是 bug)";
        }
        if (missingBom) {
            return "该原料未配置 BOM 标准价 — 仅可对比历史入库均价. 在 BOM 模块为相关产品添加该原料以启用 BOM 对比";
        }
        // missingAvg only
        return "尚无该原料的入库记录 — 仅可对比 BOM 标准价. 入库一次后即累积移动均价";
    }

    /**
     * 计算偏差百分比: (current - reference) / reference * 100
     * @return 偏差百分比，正数表示当前价高于参考价；null 表示无法计算
     */
    private BigDecimal calculateVariance(BigDecimal currentPrice, BigDecimal referencePrice) {
        if (currentPrice == null || referencePrice == null || referencePrice.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        return currentPrice.subtract(referencePrice)
                .divide(referencePrice, 4, BigDecimal.ROUND_HALF_UP)
                .multiply(new BigDecimal("100"))
                .setScale(2, BigDecimal.ROUND_HALF_UP);
    }

    // ==================== 内部方法 ====================

    private String generateOrderNumber(String factoryId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "PO-" + dateStr + "-";
        Optional<String> maxNumber = purchaseOrderRepository.findMaxOrderNumberByPrefix(factoryId, prefix + "%");
        if (maxNumber.isPresent()) {
            try {
                int seq = Integer.parseInt(maxNumber.get().substring(prefix.length()));
                return String.format("%s%04d", prefix, seq + 1);
            } catch (NumberFormatException e) {
                // 序号解析失败，回退到计数方式
            }
        }
        long count = purchaseOrderRepository.countByFactoryIdAndDate(factoryId, LocalDate.now());
        return String.format("%s%04d", prefix, count + 1);
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
        // D1: 采购入库默认 WH-LOG (物流仓). per PR #310 spec — raw material persistent in logistics warehouse.
        batch.setWarehouseId(warehouseResolver.resolveLogisticsId(factoryId));

        // 根据原料类型计算过期日期
        if (materialType != null && materialType.getShelfLifeDays() != null) {
            batch.setExpireDate(record.getReceiveDate().plusDays(materialType.getShelfLifeDays()));
        }

        batch = materialBatchRepository.save(batch);
        log.debug("创建物料批次: batchId={}, batchNumber={}, materialTypeId={}, qty={}",
                batch.getId(), batchNumber, item.getMaterialTypeId(), item.getReceivedQuantity());
        return batch;
    }

    /**
     * PR #173 reviewer follow-up I-2 (May 9 2026): 抄收上限校验提取为可复用 helper.
     *
     * 原 audio P1-7 (commit e44b1fd28) 的校验只在 confirmReceive → updateOrderReceiveStatus 触发,
     * 即用户已走完 DRAFT → PENDING_QC 流程后才知道超收 → 体验差 + 已经创建了一些副作用 (in-memory state).
     *
     * 提取后:
     * - createReceiveRecord (DRAFT 创建早返) — 用 CreateReceiveRecordRequest.ReceiveItemDTO
     * - updateOrderReceiveStatus (confirmReceive 二次防御) — 用 PurchaseReceiveItem
     *
     * 双校验防御并发: DRAFT 创建时合法 → PENDING_QC 期间另一并发入库已 commit
     * → confirmReceive 阶段累计已超 cap → 二次校验抛 → 事务回滚.
     *
     * @param order 已加载的 PurchaseOrder (非 null, caller 责任)
     * @param items 入库 items, 用 (materialTypeId, materialName, receivedQuantity) 三元组校验
     */
    private void validateOverReceiveCap(PurchaseOrder order,
            List<CreateReceiveRecordRequest.ReceiveItemDTO> items) {
        if (items == null || items.isEmpty()) return;

        List<PurchaseOrderItem> orderItems = purchaseOrderItemRepository.findByPurchaseOrderId(order.getId());
        for (CreateReceiveRecordRequest.ReceiveItemDTO receiveItem : items) {
            for (PurchaseOrderItem orderItem : orderItems) {
                if (orderItem.getMaterialTypeId().equals(receiveItem.getMaterialTypeId())) {
                    BigDecimal alreadyReceived = orderItem.getReceivedQuantity() != null
                            ? orderItem.getReceivedQuantity() : BigDecimal.ZERO;
                    BigDecimal thisReceive = receiveItem.getReceivedQuantity() != null
                            ? receiveItem.getReceivedQuantity() : BigDecimal.ZERO;
                    BigDecimal newReceived = alreadyReceived.add(thisReceive);

                    if (orderItem.getQuantity() != null) {
                        BigDecimal maxAllowed = orderItem.getQuantity()
                                .multiply(BigDecimal.ONE.add(overReceiveRate));
                        if (newReceived.compareTo(maxAllowed) > 0) {
                            throw new BusinessException(409, String.format(
                                    "超出可入库上限: 物料「%s」已收 %s, 本次 %s, 累计 %s, 下单 %s, 最大可收 %s (含 %s%% 抄收)",
                                    receiveItem.getMaterialName(),
                                    alreadyReceived.stripTrailingZeros().toPlainString(),
                                    thisReceive.stripTrailingZeros().toPlainString(),
                                    newReceived.stripTrailingZeros().toPlainString(),
                                    orderItem.getQuantity().stripTrailingZeros().toPlainString(),
                                    maxAllowed.stripTrailingZeros().toPlainString(),
                                    overReceiveRate.multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString()))
                                    .withHint("如需更多入库, 请采购另下新订单或联系采购员调整下单量");
                        }
                    }
                }
            }
        }
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

                    // May 9 fix (audio P1-7): 抄收上限校验 (二次防御 — 主校验已在 createReceiveRecord 早返).
                    // 旧逻辑无上限 → 分批入库时累计可任意超出下单量.
                    // 客户原话: "正常抄收应该是30%以内, 如果有特殊情况, 那采购另外再下个单子".
                    // PR #173 follow-up I-2: 早返已加在 createReceiveRecord, 此处保留作为
                    // DRAFT → CONFIRMED 期间并发入库已 commit 致原合法草稿变非法时的兜底.
                    if (orderItem.getQuantity() != null) {
                        BigDecimal maxAllowed = orderItem.getQuantity()
                                .multiply(BigDecimal.ONE.add(overReceiveRate));
                        if (newReceived.compareTo(maxAllowed) > 0) {
                            throw new BusinessException(409, String.format(
                                    "超出可入库上限: 物料「%s」已收 %s, 本次 %s, 累计 %s, 下单 %s, 最大可收 %s (含 %s%% 抄收)",
                                    receiveItem.getMaterialName(),
                                    orderItem.getReceivedQuantity().stripTrailingZeros().toPlainString(),
                                    receiveItem.getReceivedQuantity().stripTrailingZeros().toPlainString(),
                                    newReceived.stripTrailingZeros().toPlainString(),
                                    orderItem.getQuantity().stripTrailingZeros().toPlainString(),
                                    maxAllowed.stripTrailingZeros().toPlainString(),
                                    overReceiveRate.multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString()))
                                    .withHint("如需更多入库, 请采购另下新订单或联系采购员调整下单量");
                        }
                    }

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
