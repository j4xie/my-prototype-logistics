package com.cretas.aims.service;

import com.cretas.aims.entity.ProductionLineSupervisor;
import java.util.List;

/**
 * 产线负责人服务接口
 */
public interface ProductionLineSupervisorService {

    /**
     * 获取产线的所有负责人
     * @param factoryId 工厂ID
     * @param lineId 产线ID
     * @return 负责人列表
     */
    List<ProductionLineSupervisor> getSupervisorsByLine(String factoryId, String lineId);

    /**
     * 获取产线的主要负责人
     * @param lineId 产线ID
     * @return 主要负责人，可能为null
     */
    ProductionLineSupervisor getPrimarySupervisor(String lineId);

    /**
     * 获取车间主任负责的产线ID列表
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @return 产线ID列表
     */
    List<String> getLineIdsBySupervisor(String factoryId, Long userId);

    /**
     * 分配产线负责人
     * @param factoryId 工厂ID
     * @param lineId 产线ID
     * @param userId 用户ID
     * @param isPrimary 是否为主要负责人
     * @return 创建的关联实体
     */
    ProductionLineSupervisor assignSupervisor(String factoryId, String lineId, Long userId, boolean isPrimary);

    /**
     * 移除产线负责人
     * @param lineId 产线ID
     * @param userId 用户ID
     */
    void removeSupervisor(String lineId, Long userId);

    /**
     * 检查是否已分配
     * @param lineId 产线ID
     * @param userId 用户ID
     * @return 是否已分配
     */
    boolean isAssigned(String lineId, Long userId);
}
