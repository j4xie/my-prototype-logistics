package com.cretas.aims.service;

import com.cretas.aims.dto.factory.FactoryAIUsageDTO;

/**
 * 工厂AI配额服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
public interface FactoryAIService {

    /**
     * 获取指定工厂的AI使用情况
     *
     * @param factoryId 工厂ID
     * @return AI使用情况
     */
    FactoryAIUsageDTO getFactoryAIUsage(String factoryId);
}
