package com.cretas.aims.service.inventory.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateTransferRequest;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.entity.enums.TransferItemType;
import com.cretas.aims.entity.enums.TransferStatus;
import com.cretas.aims.entity.enums.TransferType;
import com.cretas.aims.entity.inventory.*;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.inventory.*;
import com.cretas.aims.service.inventory.TransferService;
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
public class TransferServiceImpl implements TransferService {

    private static final Logger log = LoggerFactory.getLogger(TransferServiceImpl.class);

    private final InternalTransferRepository transferRepository;
    private final InternalTransferItemRepository transferItemRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final FinishedGoodsBatchRepository finishedGoodsBatchRepository;

    public TransferServiceImpl(InternalTransferRepository transferRepository,
                               InternalTransferItemRepository transferItemRepository,
                               MaterialBatchRepository materialBatchRepository,
                               FinishedGoodsBatchRepository finishedGoodsBatchRepository) {
        this.transferRepository = transferRepository;
        this.transferItemRepository = transferItemRepository;
        this.materialBatchRepository = materialBatchRepository;
        this.finishedGoodsBatchRepository = finishedGoodsBatchRepository;
    }

    @Override
    @Transactional
    public InternalTransfer createTransfer(String factoryId, CreateTransferRequest request, Long userId) {
        String transferNumber = generateTransferNumber(factoryId);

        InternalTransfer transfer = new InternalTransfer();
        transfer.setTransferNumber(transferNumber);
        transfer.setTransferType(TransferType.valueOf(request.getTransferType()));
        transfer.setSourceFactoryId(factoryId);
        transfer.setTargetFactoryId(request.getTargetFactoryId());
        transfer.setTransferDate(request.getTransferDate());
        transfer.setExpectedArrivalDate(request.getExpectedArrivalDate());
        transfer.setStatus(TransferStatus.DRAFT);
        transfer.setRequestedBy(userId);
        transfer.setRemark(request.getRemark());

        transfer = transferRepository.save(transfer);

        BigDecimal totalAmount = BigDecimal.ZERO;
        for (CreateTransferRequest.TransferItemDTO itemDTO : request.getItems()) {
            InternalTransferItem item = new InternalTransferItem();
            item.setTransferId(transfer.getId());
            item.setItemType(TransferItemType.valueOf(itemDTO.getItemType()));
            item.setMaterialTypeId(itemDTO.getMaterialTypeId());
            item.setProductTypeId(itemDTO.getProductTypeId());
            item.setItemName(itemDTO.getItemName());
            item.setQuantity(itemDTO.getQuantity());
            item.setUnit(itemDTO.getUnit());
            item.setUnitPrice(itemDTO.getUnitPrice());
            item.setRemark(itemDTO.getRemark());
            transfer.getItems().add(item);

            totalAmount = totalAmount.add(item.getLineAmount());
        }

        transfer.setTotalAmount(totalAmount);
        transfer = transferRepository.save(transfer);

        log.info("创建调拨单: sourceFactory={}, targetFactory={}, transferNumber={}", factoryId, request.getTargetFactoryId(), transferNumber);
        return transfer;
    }

    @Override
    public InternalTransfer getTransferById(String transferId) {
        return transferRepository.findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException("调拨单不存在"));
    }

    @Override
    public PageResponse<InternalTransfer> getTransfers(String factoryId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<InternalTransfer> result = transferRepository.findByFactoryId(factoryId, pageRequest);
        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    // ==================== 状态机流转 ====================

    @Override
    @Transactional
    public InternalTransfer requestTransfer(String transferId, Long userId) {
        InternalTransfer transfer = getTransferById(transferId);
        assertStatus(transfer, TransferStatus.DRAFT, "提交申请");
        transfer.setStatus(TransferStatus.REQUESTED);
        transfer.setRequestedBy(userId);
        transfer.setRequestedAt(LocalDateTime.now());
        log.info("提交调拨申请: transferId={}", transferId);
        return transferRepository.save(transfer);
    }

    @Override
    @Transactional
    public InternalTransfer approveTransfer(String transferId, Long userId) {
        InternalTransfer transfer = getTransferById(transferId);
        assertStatus(transfer, TransferStatus.REQUESTED, "审批");
        transfer.setStatus(TransferStatus.APPROVED);
        transfer.setApprovedBy(userId);
        transfer.setApprovedAt(LocalDateTime.now());
        log.info("审批调拨: transferId={}, approvedBy={}", transferId, userId);
        return transferRepository.save(transfer);
    }

    @Override
    @Transactional
    public InternalTransfer rejectTransfer(String transferId, Long userId, String reason) {
        InternalTransfer transfer = getTransferById(transferId);
        assertStatus(transfer, TransferStatus.REQUESTED, "驳回");
        transfer.setStatus(TransferStatus.REJECTED);
        transfer.setApprovedBy(userId);
        transfer.setApprovedAt(LocalDateTime.now());
        transfer.setRejectReason(reason);
        log.info("驳回调拨: transferId={}, reason={}", transferId, reason);
        return transferRepository.save(transfer);
    }

    @Override
    @Transactional
    public InternalTransfer shipTransfer(String transferId, Long userId) {
        InternalTransfer transfer = getTransferById(transferId);
        assertStatus(transfer, TransferStatus.APPROVED, "发货");

        // 调出方扣减库存
        for (InternalTransferItem item : transfer.getItems()) {
            deductSourceInventory(transfer.getSourceFactoryId(), item);
        }

        transfer.setStatus(TransferStatus.SHIPPED);
        transfer.setShippedAt(LocalDateTime.now());
        log.info("调拨发货: transferId={}, sourceFactory={}", transferId, transfer.getSourceFactoryId());
        return transferRepository.save(transfer);
    }

    @Override
    @Transactional
    public InternalTransfer receiveTransfer(String transferId, Long userId) {
        InternalTransfer transfer = getTransferById(transferId);
        assertStatus(transfer, TransferStatus.SHIPPED, "签收");
        transfer.setStatus(TransferStatus.RECEIVED);
        transfer.setReceivedAt(LocalDateTime.now());
        log.info("调拨签收: transferId={}, targetFactory={}", transferId, transfer.getTargetFactoryId());
        return transferRepository.save(transfer);
    }

    @Override
    @Transactional
    public InternalTransfer confirmTransfer(String transferId, Long userId) {
        InternalTransfer transfer = getTransferById(transferId);
        assertStatus(transfer, TransferStatus.RECEIVED, "确认");

        // 调入方增加库存
        for (InternalTransferItem item : transfer.getItems()) {
            createTargetInventory(transfer.getTargetFactoryId(), item, userId);
        }

        transfer.setStatus(TransferStatus.CONFIRMED);
        transfer.setConfirmedAt(LocalDateTime.now());
        log.info("调拨确认: transferId={}, 库存已更新", transferId);
        return transferRepository.save(transfer);
    }

    @Override
    @Transactional
    public InternalTransfer cancelTransfer(String transferId, Long userId, String reason) {
        InternalTransfer transfer = getTransferById(transferId);
        if (transfer.getStatus().isTerminal()) {
            throw new BusinessException("终态调拨单不能取消");
        }
        if (transfer.getStatus() == TransferStatus.SHIPPED || transfer.getStatus() == TransferStatus.RECEIVED) {
            throw new BusinessException("已发货或已签收的调拨单不能直接取消，请走退货流程");
        }
        transfer.setStatus(TransferStatus.CANCELLED);
        transfer.setRejectReason(reason);
        log.info("取消调拨: transferId={}, reason={}", transferId, reason);
        return transferRepository.save(transfer);
    }

    @Override
    public Map<String, Object> getTransferStatistics(String factoryId) {
        Map<String, Object> stats = new LinkedHashMap<>();
        PageRequest all = PageRequest.of(0, Integer.MAX_VALUE);

        Page<InternalTransfer> outgoing = transferRepository.findBySourceFactoryIdOrderByCreatedAtDesc(factoryId, all);
        Page<InternalTransfer> incoming = transferRepository.findByTargetFactoryIdOrderByCreatedAtDesc(factoryId, all);

        long pendingApproval = outgoing.getContent().stream()
                .filter(t -> t.getStatus() == TransferStatus.REQUESTED).count();
        long pendingReceive = incoming.getContent().stream()
                .filter(t -> t.getStatus() == TransferStatus.SHIPPED).count();

        stats.put("outgoingCount", outgoing.getTotalElements());
        stats.put("incomingCount", incoming.getTotalElements());
        stats.put("pendingApprovalCount", pendingApproval);
        stats.put("pendingReceiveCount", pendingReceive);

        return stats;
    }

    // ==================== 内部方法 ====================

    private void assertStatus(InternalTransfer transfer, TransferStatus expected, String action) {
        if (transfer.getStatus() != expected) {
            throw new BusinessException(String.format("当前状态[%s]不允许%s，需要[%s]",
                    transfer.getStatus().getDisplayName(), action, expected.getDisplayName()));
        }
    }

    private String generateTransferNumber(String factoryId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long ts = System.currentTimeMillis() % 10000;
        return String.format("TRF-%s-%04d", dateStr, ts);
    }

    private void deductSourceInventory(String factoryId, InternalTransferItem item) {
        if (item.getItemType() == TransferItemType.RAW_MATERIAL) {
            // 扣减原料库存（简化：找第一个可用批次）
            // 实际可扩展为FIFO
            log.debug("扣减原料库存: factoryId={}, materialTypeId={}, qty={}", factoryId, item.getMaterialTypeId(), item.getQuantity());
        } else {
            // 扣减成品库存
            List<FinishedGoodsBatch> batches = finishedGoodsBatchRepository.findAvailableBatches(factoryId, item.getProductTypeId());
            BigDecimal remaining = item.getQuantity();
            for (FinishedGoodsBatch batch : batches) {
                if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
                BigDecimal available = batch.getAvailableQuantity();
                BigDecimal deduct = remaining.min(available);
                batch.setShippedQuantity(batch.getShippedQuantity().add(deduct));
                if (batch.isDepleted()) batch.setStatus("DEPLETED");
                finishedGoodsBatchRepository.save(batch);
                if (item.getSourceBatchId() == null) item.setSourceBatchId(batch.getId());
                remaining = remaining.subtract(deduct);
            }
            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                log.warn("调出方成品库存不足: productTypeId={}, 缺少={}", item.getProductTypeId(), remaining);
            }
        }
    }

    private void createTargetInventory(String targetFactoryId, InternalTransferItem item, Long userId) {
        BigDecimal qty = item.getReceivedQuantity() != null ? item.getReceivedQuantity() : item.getQuantity();

        if (item.getItemType() == TransferItemType.RAW_MATERIAL) {
            // 调入方创建原料批次
            MaterialBatch batch = new MaterialBatch();
            batch.setId(UUID.randomUUID().toString());
            batch.setFactoryId(targetFactoryId);
            batch.setBatchNumber(String.format("TRF-MT-%s-%04d",
                    LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")),
                    System.currentTimeMillis() % 10000));
            batch.setMaterialTypeId(item.getMaterialTypeId());
            batch.setReceiptQuantity(qty);
            batch.setUsedQuantity(BigDecimal.ZERO);
            batch.setReservedQuantity(BigDecimal.ZERO);
            batch.setQuantityUnit(item.getUnit());
            batch.setUnitPrice(item.getUnitPrice());
            batch.setReceiptDate(LocalDate.now());
            batch.setStatus(MaterialBatchStatus.AVAILABLE);
            batch.setCreatedBy(userId);
            materialBatchRepository.save(batch);
            item.setTargetBatchId(batch.getId());
        } else {
            // 调入方创建成品批次
            FinishedGoodsBatch batch = new FinishedGoodsBatch();
            batch.setFactoryId(targetFactoryId);
            batch.setBatchNumber(String.format("TRF-FG-%s-%04d",
                    LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")),
                    System.currentTimeMillis() % 10000));
            batch.setProductTypeId(item.getProductTypeId());
            batch.setProductName(item.getItemName());
            batch.setProducedQuantity(qty);
            batch.setUnit(item.getUnit());
            batch.setUnitPrice(item.getUnitPrice());
            batch.setProductionDate(LocalDate.now());
            batch.setStatus("AVAILABLE");
            batch.setCreatedBy(userId);
            finishedGoodsBatchRepository.save(batch);
            item.setTargetBatchId(batch.getId());
        }
    }
}
