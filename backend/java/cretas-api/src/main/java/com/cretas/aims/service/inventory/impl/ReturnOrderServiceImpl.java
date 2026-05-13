package com.cretas.aims.service.inventory.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateReturnOrderRequest;
import com.cretas.aims.entity.enums.ReturnOrderStatus;
import com.cretas.aims.entity.enums.ReturnType;
import com.cretas.aims.entity.inventory.ReturnOrder;
import com.cretas.aims.entity.inventory.ReturnOrderItem;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.inventory.ReturnOrderItemRepository;
import com.cretas.aims.repository.inventory.ReturnOrderRepository;
import com.cretas.aims.service.finance.ArApService;
import com.cretas.aims.service.inventory.ReturnOrderService;
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

@Service
public class ReturnOrderServiceImpl implements ReturnOrderService {

    private static final Logger log = LoggerFactory.getLogger(ReturnOrderServiceImpl.class);

    private final ReturnOrderRepository returnOrderRepository;
    private final ReturnOrderItemRepository returnOrderItemRepository;
    private final ArApService arApService;
    private final ApplicationEventPublisher applicationEventPublisher;

    /** Round 11 T2 — Canvas Integration Template hook 1: DB-driven validation. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.ValidationRuleEvaluator validationRuleEvaluator;

    /** Round 11 T2 — Canvas Integration Template hook 2: dynamic field persist. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.DynamicFieldService dynamicFieldService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.DefaultValueResolver defaultValueResolver;

    public ReturnOrderServiceImpl(ReturnOrderRepository returnOrderRepository,
                                   ReturnOrderItemRepository returnOrderItemRepository,
                                   ArApService arApService,
                                   ApplicationEventPublisher applicationEventPublisher) {
        this.returnOrderRepository = returnOrderRepository;
        this.returnOrderItemRepository = returnOrderItemRepository;
        this.arApService = arApService;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @Override
    @Transactional
    public ReturnOrder createReturnOrder(String factoryId, CreateReturnOrderRequest request, Long userId) {
        ReturnType returnType = ReturnType.valueOf(request.getReturnType());

        // Round 11 T2: Canvas Integration Template hook 1 — DB-driven validation
        if (validationRuleEvaluator != null) {
            try {
                validationRuleEvaluator.validate(factoryId, "sales_return", "CREATE",
                        java.util.Map.of(
                            "returnType", returnType.name(),
                            "itemCount", request.getItems() != null ? request.getItems().size() : 0,
                            "counterpartyId", request.getCounterpartyId() != null ? request.getCounterpartyId() : ""));
            } catch (com.cretas.aims.exception.BusinessException e) { throw e; }
            catch (Exception e) { log.warn("Canvas validation non-blocking: {}", e.getMessage()); }
        }

        String returnNumber = generateReturnNumber(factoryId, returnType);

        ReturnOrder order = new ReturnOrder();
        order.setFactoryId(factoryId);
        order.setReturnNumber(returnNumber);
        order.setReturnType(returnType);
        order.setStatus(ReturnOrderStatus.DRAFT);
        order.setCounterpartyId(request.getCounterpartyId());
        order.setSourceOrderId(request.getSourceOrderId());
        order.setReturnDate(request.getReturnDate());
        order.setReason(request.getReason());
        order.setRemark(request.getRemark());
        // T-RTA business logic (issue #571): default TRUE (实物退货, customer's primary case).
        // Caller may explicitly set false for refund-only path.
        order.setWithGoods(request.getWithGoods() != null ? request.getWithGoods() : Boolean.TRUE);
        order.setCreatedBy(userId);

        order = returnOrderRepository.save(order);

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<ReturnOrderItem> items = new ArrayList<>();

        for (CreateReturnOrderRequest.ReturnOrderItemDTO itemDTO : request.getItems()) {
            ReturnOrderItem item = new ReturnOrderItem();
            item.setReturnOrderId(order.getId());
            item.setMaterialTypeId(itemDTO.getMaterialTypeId());
            item.setProductTypeId(itemDTO.getProductTypeId());
            item.setItemName(itemDTO.getItemName());
            item.setQuantity(itemDTO.getQuantity());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setBatchNumber(itemDTO.getBatchNumber());
            item.setReason(itemDTO.getReason());

            BigDecimal lineAmount = BigDecimal.ZERO;
            if (itemDTO.getUnitPrice() != null && itemDTO.getQuantity() != null) {
                lineAmount = itemDTO.getQuantity().multiply(itemDTO.getUnitPrice())
                        .setScale(2, BigDecimal.ROUND_HALF_UP);
            }
            item.setLineAmount(lineAmount);
            items.add(item);
            totalAmount = totalAmount.add(lineAmount);
        }

        returnOrderItemRepository.saveAll(items);
        order.setTotalAmount(totalAmount);
        order = returnOrderRepository.save(order);

        // Round 11 T2: Canvas Integration Template hook 2 — persist dynamic fields.
        // Customer-configured fields (退货照片, 客诉单号, 退货责任方) land in cf_*
        // columns on return_orders. Silent failure must not break the return creation.
        if (dynamicFieldService != null && request.getCustomFields() != null && !request.getCustomFields().isEmpty()) {
            try {
                dynamicFieldService.setDynamicFields(factoryId, "sales_return", order.getId(), request.getCustomFields());
            } catch (Exception e) {
                log.warn("Canvas dynamic fields save failed for return order {}: {}", order.getId(), e.getMessage());
            }
        }

        // Round 11 T2: Canvas Integration Template hook 3 — publish event for trigger chains.
        // Fires on DRAFT creation of both SALES_RETURN and PURCHASE_RETURN. Factories
        // can now react via configured trigger chains (e.g., "大额退货通知财务").
        try {
            applicationEventPublisher.publishEvent(new com.cretas.aims.event.ReturnOrderCreatedEvent(
                    this, factoryId, order.getId(), order.getReturnNumber(),
                    returnType.name(), order.getCounterpartyId(),
                    order.getSourceOrderId(), order.getTotalAmount()));
        } catch (Exception e) {
            log.warn("Publish ReturnOrderCreatedEvent failed for {}: {}", order.getId(), e.getMessage());
        }

        log.info("创建退货单: factoryId={}, returnNumber={}, type={}, items={}",
                factoryId, returnNumber, returnType, items.size());
        return order;
    }

    @Override
    public ReturnOrder getReturnOrderById(String factoryId, String returnOrderId) {
        ReturnOrder order = returnOrderRepository.findById(returnOrderId)
                .orElseThrow(() -> new ResourceNotFoundException("退货单不存在"));
        if (!order.getFactoryId().equals(factoryId)) {
            throw new BusinessException(403, "无权访问该退货单")
                    .withHint("当前退货单不属于该工厂, 无法访问");
        }
        return order;
    }

    @Override
    public PageResponse<ReturnOrder> getReturnOrders(String factoryId, ReturnType returnType,
                                                      ReturnOrderStatus status, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ReturnOrder> result;

        if (returnType != null && status != null) {
            result = returnOrderRepository.findByFactoryIdAndReturnTypeAndStatusOrderByCreatedAtDesc(
                    factoryId, returnType, status, pageRequest);
        } else if (returnType != null) {
            result = returnOrderRepository.findByFactoryIdAndReturnTypeOrderByCreatedAtDesc(
                    factoryId, returnType, pageRequest);
        } else if (status != null) {
            result = returnOrderRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(
                    factoryId, status, pageRequest);
        } else {
            result = returnOrderRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageRequest);
        }

        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    @Transactional
    public ReturnOrder submitReturnOrder(String factoryId, String returnOrderId) {
        ReturnOrder order = getReturnOrderById(factoryId, returnOrderId);
        if (order.getStatus() != ReturnOrderStatus.DRAFT) {
            throw new BusinessException(409, "只有草稿状态的退货单可以提交")
                    .withHint("请刷新退货单列表查看最新状态");
        }
        order.setStatus(ReturnOrderStatus.SUBMITTED);
        log.info("提交退货单: returnOrderId={}, returnNumber={}", returnOrderId, order.getReturnNumber());
        return returnOrderRepository.save(order);
    }

    @Override
    @Transactional
    public ReturnOrder approveReturnOrder(String factoryId, String returnOrderId, Long approverId) {
        ReturnOrder order = getReturnOrderById(factoryId, returnOrderId);
        if (order.getStatus() != ReturnOrderStatus.SUBMITTED) {
            throw new BusinessException(409, "只有已提交状态的退货单可以审批")
                    .withHint("请刷新退货单列表查看最新状态");
        }
        order.setStatus(ReturnOrderStatus.APPROVED);
        order.setApprovedBy(approverId);
        order.setApprovedAt(LocalDateTime.now());

        // T-RTA business logic (issue #571, audit BLOCKER B1): branch by withGoods.
        //
        // withGoods=true  (实物退货): defer AR/AP adjustment to completeReturnOrder. Warehouse
        //                            keeper must physically receive goods first; financial
        //                            credit happens when 不良品 inbound is confirmed.
        // withGoods=false (退款 only): trigger AR/AP adjustment now (existing behavior). No
        //                            inventory action needed since no physical goods involved.
        //
        // Customer transcript (第四次:956-1037): "有食物的话, 库存入库到总仓 ... 无食物的话就退款"
        // — the order of operations matters because real-world workflow can't credit before
        // verifying physical receipt (would create accounting/audit gap).
        boolean withGoods = Boolean.TRUE.equals(order.getWithGoods());
        if (!withGoods) {
            // No-goods path: AR/AP adjustment immediately on approve (current behavior).
            try {
                if (order.getReturnType() == ReturnType.PURCHASE_RETURN) {
                    arApService.recordAdjustment(factoryId,
                            com.cretas.aims.entity.enums.CounterpartyType.SUPPLIER,
                            order.getCounterpartyId(),
                            order.getTotalAmount().negate(),
                            approverId,
                            "采购退货冲减(无货)-" + order.getReturnNumber());
                    log.info("采购退货冲减应付(无货, 审批立即触发): returnNumber={}, amount={}", order.getReturnNumber(), order.getTotalAmount());
                } else if (order.getReturnType() == ReturnType.SALES_RETURN) {
                    arApService.recordAdjustment(factoryId,
                            com.cretas.aims.entity.enums.CounterpartyType.CUSTOMER,
                            order.getCounterpartyId(),
                            order.getTotalAmount().negate(),
                            approverId,
                            "销售退货冲减(无货)-" + order.getReturnNumber());
                    log.info("销售退货冲减应收(无货, 审批立即触发): returnNumber={}, amount={}", order.getReturnNumber(), order.getTotalAmount());
                }
            } catch (Exception e) {
                log.error("退货AR/AP冲减失败 (无货path): returnOrderId={}", returnOrderId, e);
            }
        } else {
            // With-goods path: AR/AP冲减 deferred until 仓库实物入库 in completeReturnOrder.
            log.info("审批退货单(有货): returnOrderId={} — AR冲减 + 库存入库 deferred to completion", returnOrderId);
        }

        log.info("审批退货单: returnOrderId={}, approvedBy={}, withGoods={}", returnOrderId, approverId, withGoods);
        return returnOrderRepository.save(order);
    }

    @Override
    @Transactional
    public ReturnOrder rejectReturnOrder(String factoryId, String returnOrderId) {
        ReturnOrder order = getReturnOrderById(factoryId, returnOrderId);
        if (order.getStatus() != ReturnOrderStatus.SUBMITTED) {
            throw new BusinessException(409, "只有已提交状态的退货单可以驳回")
                    .withHint("请刷新退货单列表查看最新状态");
        }
        order.setStatus(ReturnOrderStatus.REJECTED);
        log.info("驳回退货单: returnOrderId={}, returnNumber={}", returnOrderId, order.getReturnNumber());
        return returnOrderRepository.save(order);
    }

    @Override
    @Transactional
    public ReturnOrder completeReturnOrder(String factoryId, String returnOrderId) {
        ReturnOrder order = getReturnOrderById(factoryId, returnOrderId);
        if (order.getStatus() != ReturnOrderStatus.APPROVED) {
            throw new BusinessException(409, "只有已审批状态的退货单可以完成")
                    .withHint("请刷新退货单列表查看最新状态");
        }

        // T-RTA business logic (issue #571 Phase B): for withGoods=true, trigger
        // deferred AR/AP冲减 now (after physical receipt confirmed). For withGoods=false,
        // AR/AP冲减 already happened at approve time — just flip status.
        boolean withGoods = Boolean.TRUE.equals(order.getWithGoods());
        if (withGoods) {
            // Deferred AR/AP冲减 from approve.
            try {
                if (order.getReturnType() == ReturnType.PURCHASE_RETURN) {
                    arApService.recordAdjustment(factoryId,
                            com.cretas.aims.entity.enums.CounterpartyType.SUPPLIER,
                            order.getCounterpartyId(),
                            order.getTotalAmount().negate(),
                            order.getApprovedBy(),
                            "采购退货冲减(实物已入库)-" + order.getReturnNumber());
                    log.info("采购退货冲减应付(实物已入库, completion 触发): returnNumber={}, amount={}", order.getReturnNumber(), order.getTotalAmount());
                } else if (order.getReturnType() == ReturnType.SALES_RETURN) {
                    arApService.recordAdjustment(factoryId,
                            com.cretas.aims.entity.enums.CounterpartyType.CUSTOMER,
                            order.getCounterpartyId(),
                            order.getTotalAmount().negate(),
                            order.getApprovedBy(),
                            "销售退货冲减(实物已入库)-" + order.getReturnNumber());
                    log.info("销售退货冲减应收(实物已入库, completion 触发): returnNumber={}, amount={}", order.getReturnNumber(), order.getTotalAmount());
                }
            } catch (Exception e) {
                log.error("退货AR/AP冲减失败 (有货 completion path): returnOrderId={}", returnOrderId, e);
            }
            // TODO Phase C (separate follow-up ticket): 库存入库 to WH-LOG with 不良品 status flag.
            //   - Find/create MaterialBatch (PURCHASE_RETURN) or FinishedGoodsBatch (SALES_RETURN)
            //     with status='DEFECTIVE' or similar new enum value
            //   - Link batchId back to the ReturnOrderItem for traceability
            //   - May need new column FinishedGoodsBatch.qualityStatus or similar
            //   - Customer's "不良品" semantics: 调拨/销售/生产 should NOT pick these batches
            //     unless explicit override (e.g. for 二次销售 or 处理).
            //   See issue #571 PR body for design considerations.
            log.warn("退货单完成(有货): inventory inbound to WH-LOG with 不良品 status NOT YET IMPLEMENTED (Phase C scope, issue #571). Status flipped to COMPLETED + AR冲减 done, but stock 仍未增加.");
        }

        order.setStatus(ReturnOrderStatus.COMPLETED);
        log.info("完成退货单: returnOrderId={}, returnNumber={}, withGoods={}", returnOrderId, order.getReturnNumber(), withGoods);
        return returnOrderRepository.save(order);
    }

    @Override
    public Map<String, Object> getReturnOrderStatistics(String factoryId) {
        Map<String, Object> stats = new LinkedHashMap<>();
        PageRequest all = PageRequest.of(0, Integer.MAX_VALUE);

        Page<ReturnOrder> allOrders = returnOrderRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, all);
        List<ReturnOrder> orders = allOrders.getContent();

        long purchaseReturnCount = orders.stream().filter(o -> o.getReturnType() == ReturnType.PURCHASE_RETURN).count();
        long salesReturnCount = orders.stream().filter(o -> o.getReturnType() == ReturnType.SALES_RETURN).count();
        long pendingApproval = orders.stream().filter(o -> o.getStatus() == ReturnOrderStatus.SUBMITTED).count();

        BigDecimal totalReturnAmount = orders.stream()
                .filter(o -> o.getStatus() != ReturnOrderStatus.REJECTED)
                .map(ReturnOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        stats.put("purchaseReturnCount", purchaseReturnCount);
        stats.put("salesReturnCount", salesReturnCount);
        stats.put("pendingApprovalCount", pendingApproval);
        stats.put("totalReturnAmount", totalReturnAmount);
        return stats;
    }

    // ==================== 内部方法 ====================

    private String generateReturnNumber(String factoryId, ReturnType returnType) {
        String prefix = returnType == ReturnType.PURCHASE_RETURN ? "RT-PUR" : "RT-SAL";
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = returnOrderRepository.countByFactoryIdAndDate(factoryId, LocalDate.now());
        return String.format("%s-%s-%04d", prefix, dateStr, count + 1);
    }
}
