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

    public ReturnOrderServiceImpl(ReturnOrderRepository returnOrderRepository,
                                   ReturnOrderItemRepository returnOrderItemRepository,
                                   ArApService arApService) {
        this.returnOrderRepository = returnOrderRepository;
        this.returnOrderItemRepository = returnOrderItemRepository;
        this.arApService = arApService;
    }

    @Override
    @Transactional
    public ReturnOrder createReturnOrder(String factoryId, CreateReturnOrderRequest request, Long userId) {
        ReturnType returnType = ReturnType.valueOf(request.getReturnType());
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

        log.info("创建退货单: factoryId={}, returnNumber={}, type={}, items={}",
                factoryId, returnNumber, returnType, items.size());
        return order;
    }

    @Override
    public ReturnOrder getReturnOrderById(String factoryId, String returnOrderId) {
        ReturnOrder order = returnOrderRepository.findById(returnOrderId)
                .orElseThrow(() -> new ResourceNotFoundException("退货单不存在"));
        if (!order.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该退货单");
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
            throw new BusinessException("只有草稿状态的退货单可以提交");
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
            throw new BusinessException("只有已提交状态的退货单可以审批");
        }
        order.setStatus(ReturnOrderStatus.APPROVED);
        order.setApprovedBy(approverId);
        order.setApprovedAt(LocalDateTime.now());

        // Record credit note in AR/AP
        try {
            if (order.getReturnType() == ReturnType.PURCHASE_RETURN) {
                // Purchase return → reduce payable (AP_CREDIT_NOTE)
                arApService.recordAdjustment(factoryId,
                        com.cretas.aims.entity.enums.CounterpartyType.SUPPLIER,
                        order.getCounterpartyId(),
                        order.getTotalAmount().negate(),
                        approverId,
                        "采购退货冲减-" + order.getReturnNumber());
                log.info("采购退货冲减应付: returnNumber={}, amount={}", order.getReturnNumber(), order.getTotalAmount());
            } else if (order.getReturnType() == ReturnType.SALES_RETURN) {
                // Sales return → reduce receivable (AR_CREDIT_NOTE)
                arApService.recordAdjustment(factoryId,
                        com.cretas.aims.entity.enums.CounterpartyType.CUSTOMER,
                        order.getCounterpartyId(),
                        order.getTotalAmount().negate(),
                        approverId,
                        "销售退货冲减-" + order.getReturnNumber());
                log.info("销售退货冲减应收: returnNumber={}, amount={}", order.getReturnNumber(), order.getTotalAmount());
            }
        } catch (Exception e) {
            log.error("退货AR/AP冲减失败: returnOrderId={}", returnOrderId, e);
        }

        log.info("审批退货单: returnOrderId={}, approvedBy={}", returnOrderId, approverId);
        return returnOrderRepository.save(order);
    }

    @Override
    @Transactional
    public ReturnOrder rejectReturnOrder(String factoryId, String returnOrderId) {
        ReturnOrder order = getReturnOrderById(factoryId, returnOrderId);
        if (order.getStatus() != ReturnOrderStatus.SUBMITTED) {
            throw new BusinessException("只有已提交状态的退货单可以驳回");
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
            throw new BusinessException("只有已审批状态的退货单可以完成");
        }
        order.setStatus(ReturnOrderStatus.COMPLETED);
        log.info("完成退货单: returnOrderId={}, returnNumber={}", returnOrderId, order.getReturnNumber());
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
