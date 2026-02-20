package com.cretas.aims.service;

import com.cretas.aims.dto.WorkTypeDTO;
import com.cretas.aims.dto.common.PageResponse;
import org.springframework.data.domain.Pageable;
import java.util.List;
/**
 * 工作类型管理服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface WorkTypeService {
    /**
     * 创建工作类型
     *
     * @param factoryId 工厂ID
     * @param dto 工作类型数据
     * @return 创建的工作类型
     */
    WorkTypeDTO createWorkType(String factoryId, WorkTypeDTO dto);
     /**
     * 获取工作类型列表（分页）
     * @param pageable 分页参数
     * @return 工作类型分页数据
      */
    PageResponse<WorkTypeDTO> getWorkTypes(String factoryId, Pageable pageable);
     /**
     * 获取所有活跃的工作类型
     * @return 活跃的工作类型列表
      */
    List<WorkTypeDTO> getAllActiveWorkTypes(String factoryId);
     /**
     * 根据ID获取工作类型
     * @param id 工作类型ID
     * @return 工作类型详情
      */
    WorkTypeDTO getWorkTypeById(String factoryId, String id);
     /**
     * 更新工作类型
     * @param dto 更新数据
     * @return 更新后的工作类型
      */
    WorkTypeDTO updateWorkType(String factoryId, String id, WorkTypeDTO dto);
     /**
     * 删除工作类型
      */
    void deleteWorkType(String factoryId, String id);
     /**
     * 切换工作类型状态
      */
    WorkTypeDTO toggleWorkTypeStatus(String factoryId, String id);
     /**
     * 初始化默认工作类型
      */
    void initializeDefaultWorkTypes(String factoryId);
     /**
     * 获取工作类型统计信息
     * @return 统计信息
      */
    WorkTypeDTO.WorkTypeStats getWorkTypeStats(String factoryId);
     /**
     * 更新显示顺序
     * @param updates 显示顺序更新列表
      */
    void updateDisplayOrder(String factoryId, List<WorkTypeDTO.DisplayOrderUpdate> updates);
}
