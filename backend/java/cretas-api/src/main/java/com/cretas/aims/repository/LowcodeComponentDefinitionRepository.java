package com.cretas.aims.repository;

import com.cretas.aims.entity.LowcodeComponentDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 低代码组件定义数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-14
 */
@Repository
public interface LowcodeComponentDefinitionRepository extends JpaRepository<LowcodeComponentDefinition, Long> {

    /**
     * 根据组件类型查找组件定义
     *
     * @param componentType 组件类型标识（如: stats-card, chart-line等）
     * @return 组件定义（如果存在）
     */
    Optional<LowcodeComponentDefinition> findByComponentType(String componentType);

    /**
     * 根据状态查找组件定义列表，按排序顺序升序排列
     *
     * @param status 状态（0-禁用, 1-启用）
     * @return 组件定义列表
     */
    List<LowcodeComponentDefinition> findByStatusOrderBySortOrderAsc(Integer status);

    /**
     * 根据分类和状态查找组件定义列表
     *
     * @param category 组件分类（如: display, chart, form, layout等）
     * @param status 状态（0-禁用, 1-启用）
     * @return 组件定义列表
     */
    List<LowcodeComponentDefinition> findByCategoryAndStatus(String category, Integer status);

    /**
     * 查找系统组件或指定工厂的自定义组件
     * 用于获取可用的所有组件（系统+工厂自定义）
     *
     * @param isSystem 是否为系统组件（0-否, 1-是）
     * @param factoryId 工厂ID
     * @return 组件定义列表
     */
    List<LowcodeComponentDefinition> findByIsSystemOrFactoryId(Integer isSystem, String factoryId);
}
