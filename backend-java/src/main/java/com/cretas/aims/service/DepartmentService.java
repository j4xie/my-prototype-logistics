package com.cretas.aims.service;

import com.cretas.aims.dto.DepartmentDTO;
import com.cretas.aims.dto.common.PageResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * 部门服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-19
 */
public interface DepartmentService {

    /**
     * 创建部门
     *
     * @param factoryId 工厂ID
     * @param dto 部门信息
     * @return 创建的部门
     */
    DepartmentDTO createDepartment(String factoryId, DepartmentDTO dto);

    /**
     * 更新部门
     *
     * @param factoryId 工厂ID
     * @param id 部门ID
     * @param dto 部门信息
     * @return 更新后的部门
     */
    DepartmentDTO updateDepartment(String factoryId, Integer id, DepartmentDTO dto);

    /**
     * 删除部门
     *
     * @param factoryId 工厂ID
     * @param id 部门ID
     */
    void deleteDepartment(String factoryId, Integer id);

    /**
     * 根据ID获取部门
     *
     * @param factoryId 工厂ID
     * @param id 部门ID
     * @return 部门信息
     */
    DepartmentDTO getDepartmentById(String factoryId, Integer id);

    /**
     * 分页查询部门
     *
     * @param factoryId 工厂ID
     * @param pageable 分页参数
     * @return 部门分页列表
     */
    PageResponse<DepartmentDTO> getDepartments(String factoryId, Pageable pageable);

    /**
     * 获取所有活跃部门
     *
     * @param factoryId 工厂ID
     * @return 活跃部门列表
     */
    List<DepartmentDTO> getAllActiveDepartments(String factoryId);

    /**
     * 搜索部门
     *
     * @param factoryId 工厂ID
     * @param keyword 关键词
     * @param pageable 分页参数
     * @return 部门分页列表
     */
    PageResponse<DepartmentDTO> searchDepartments(String factoryId, String keyword, Pageable pageable);

    /**
     * 获取部门树形结构
     *
     * @param factoryId 工厂ID
     * @return 部门树
     */
    List<DepartmentDTO> getDepartmentTree(String factoryId);

    /**
     * 检查部门编码是否存在
     *
     * @param factoryId 工厂ID
     * @param code 部门编码
     * @param excludeId 排除的部门ID（更新时使用）
     * @return 是否存在
     */
    boolean checkCodeExists(String factoryId, String code, Integer excludeId);

    /**
     * 初始化默认部门
     *
     * @param factoryId 工厂ID
     */
    void initializeDefaultDepartments(String factoryId);

    /**
     * 批量更新部门状态
     *
     * @param factoryId 工厂ID
     * @param ids 部门ID列表
     * @param isActive 是否启用
     */
    void updateDepartmentsStatus(String factoryId, List<Integer> ids, Boolean isActive);
}
