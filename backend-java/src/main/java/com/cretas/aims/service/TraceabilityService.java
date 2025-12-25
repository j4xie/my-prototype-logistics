package com.cretas.aims.service;

import com.cretas.aims.dto.traceability.TraceabilityDTO;

/**
 * 溯源服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface TraceabilityService {

    /**
     * 获取基础溯源信息（批次级别）
     *
     * @param factoryId 工厂ID
     * @param batchNumber 批次号
     * @return 基础溯源响应
     */
    TraceabilityDTO.BatchTraceResponse getBatchTrace(String factoryId, String batchNumber);

    /**
     * 获取完整溯源链路
     *
     * @param factoryId 工厂ID
     * @param batchNumber 批次号
     * @return 完整溯源链路响应
     */
    TraceabilityDTO.FullTraceResponse getFullTrace(String factoryId, String batchNumber);

    /**
     * 公开溯源查询（消费者扫码，无需认证）
     *
     * @param batchNumber 批次号
     * @return 公开溯源信息（脱敏）
     */
    TraceabilityDTO.PublicTraceResponse getPublicTrace(String batchNumber);
}
