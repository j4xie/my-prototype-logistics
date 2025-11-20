package com.cretas.aims.service;

import com.cretas.aims.dto.platform.CreateFactoryRequest;
import com.cretas.aims.dto.platform.FactoryDTO;
import com.cretas.aims.dto.platform.UpdateFactoryRequest;

import java.util.List;

/**
 * 工厂管理服务接口
 * 用于平台管理员管理工厂
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
public interface FactoryService {

    /**
     * 获取所有工厂列表
     *
     * @return 工厂列表
     */
    List<FactoryDTO> getAllFactories();

    /**
     * 根据ID获取工厂详情
     *
     * @param factoryId 工厂ID
     * @return 工厂详情
     */
    FactoryDTO getFactoryById(String factoryId);

    /**
     * 创建新工厂
     *
     * @param request 创建工厂请求
     * @return 创建的工厂详情
     */
    FactoryDTO createFactory(CreateFactoryRequest request);

    /**
     * 更新工厂信息
     *
     * @param factoryId 工厂ID
     * @param request   更新工厂请求
     * @return 更新后的工厂详情
     */
    FactoryDTO updateFactory(String factoryId, UpdateFactoryRequest request);

    /**
     * 删除工厂（软删除：设置isActive=false）
     *
     * @param factoryId 工厂ID
     */
    void deleteFactory(String factoryId);

    /**
     * 激活工厂
     *
     * @param factoryId 工厂ID
     * @return 激活后的工厂详情
     */
    FactoryDTO activateFactory(String factoryId);

    /**
     * 停用工厂
     *
     * @param factoryId 工厂ID
     * @return 停用后的工厂详情
     */
    FactoryDTO deactivateFactory(String factoryId);
}
