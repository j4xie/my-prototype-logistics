package com.cretas.aims.service.inventory;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateTransferRequest;
import com.cretas.aims.entity.inventory.InternalTransfer;

import java.util.Map;

public interface TransferService {

    InternalTransfer createTransfer(String factoryId, CreateTransferRequest request, Long userId);

    InternalTransfer getTransferById(String transferId);

    /** 双向视角：调出或调入都能查到 */
    PageResponse<InternalTransfer> getTransfers(String factoryId, int page, int size);

    /** 状态机流转 */
    InternalTransfer requestTransfer(String transferId, Long userId);

    InternalTransfer approveTransfer(String transferId, Long userId);

    InternalTransfer rejectTransfer(String transferId, Long userId, String reason);

    InternalTransfer shipTransfer(String transferId, Long userId);

    InternalTransfer receiveTransfer(String transferId, Long userId);

    InternalTransfer confirmTransfer(String transferId, Long userId);

    InternalTransfer cancelTransfer(String transferId, Long userId, String reason);

    Map<String, Object> getTransferStatistics(String factoryId);
}
