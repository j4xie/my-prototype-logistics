package com.cretas.aims.service.inventory;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateTransferRequest;
import com.cretas.aims.entity.inventory.InternalTransfer;

import java.util.Map;

public interface TransferService {

    InternalTransfer createTransfer(String factoryId, CreateTransferRequest request, Long userId);

    /**
     * Factory-scoped lookup — only returns the transfer if factoryId is its source or target.
     * Prevents cross-tenant data leakage when a user knows a transferId.
     */
    InternalTransfer getTransferById(String factoryId, String transferId);

    /** 双向视角：调出或调入都能查到 */
    PageResponse<InternalTransfer> getTransfers(String factoryId, int page, int size);

    /** 状态机流转 — 全部强制 factoryId 隔离 (写路径漏洞比读路径更严重 — Apr 7 audit) */
    InternalTransfer requestTransfer(String factoryId, String transferId, Long userId);

    InternalTransfer approveTransfer(String factoryId, String transferId, Long userId);

    InternalTransfer rejectTransfer(String factoryId, String transferId, Long userId, String reason);

    InternalTransfer shipTransfer(String factoryId, String transferId, Long userId);

    InternalTransfer receiveTransfer(String factoryId, String transferId, Long userId);

    InternalTransfer confirmTransfer(String factoryId, String transferId, Long userId);

    InternalTransfer cancelTransfer(String factoryId, String transferId, Long userId, String reason);

    Map<String, Object> getTransferStatistics(String factoryId);
}
