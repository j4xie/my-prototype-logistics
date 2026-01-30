package com.cretas.aims.repository;

import com.cretas.aims.entity.MaterialSpecConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 原材料规格配置数据访问接口
 *
 * <p>本接口继承自JpaRepository，提供原材料规格配置实体的基础CRUD操作和自定义查询方法。</p>
 *
 * <h3>功能说明</h3>
 * <p>原材料规格配置用于存储每个工厂的原材料类别对应的规格选项列表。每个工厂可以为每个类别自定义规格选项，也可以使用系统默认配置。</p>
 *
 * <h3>数据模型</h3>
 * <ul>
 *   <li><b>唯一性约束</b>：factory_id + category 组合唯一，确保每个工厂的每个类别只有一条配置记录</li>
 *   <li><b>规格存储</b>：规格选项列表以JSON数组格式存储在specifications字段中</li>
 *   <li><b>配置类型</b>：通过isSystemDefault字段区分系统默认配置和用户自定义配置</li>
 * </ul>
 *
 * <h3>查询方法说明</h3>
 * <ul>
 *   <li><b>findByFactoryId</b>：查询工厂的所有规格配置（用于获取完整配置列表）</li>
 *   <li><b>findByFactoryIdAndCategory</b>：查询指定类别的规格配置（用于获取单个类别的配置）</li>
 *   <li><b>existsByFactoryIdAndCategory</b>：检查配置是否存在（用于判断是否需要创建新配置）</li>
 *   <li><b>deleteByFactoryIdAndCategory</b>：删除指定类别的配置（用于重置为系统默认配置）</li>
 * </ul>
 *
 * <h3>使用场景</h3>
 * <ul>
 *   <li>创建原材料批次时，根据原材料类别获取对应的规格选项列表</li>
 *   <li>管理员自定义规格配置时，更新或创建配置记录</li>
 *   <li>重置配置时，删除自定义配置，恢复使用系统默认配置</li>
 * </ul>
 *
 * <h3>性能优化</h3>
 * <ul>
 *   <li>所有查询都基于factoryId，确保数据隔离</li>
 *   <li>使用唯一索引（factory_id, category）提高查询效率</li>
 *   <li>exists方法比find方法更高效，适合用于存在性检查</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
 * @see MaterialSpecConfig 实体类
 * @see MaterialSpecConfigService 业务逻辑层
 */
@Repository
public interface MaterialSpecConfigRepository extends JpaRepository<MaterialSpecConfig, Long> {

    /**
     * 根据工厂ID查找所有规格配置
     */
    List<MaterialSpecConfig> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID和类别查找规格配置
     */
    Optional<MaterialSpecConfig> findByFactoryIdAndCategory(String factoryId, String category);

    /**
     * 根据工厂ID和类别删除规格配置
     */
    void deleteByFactoryIdAndCategory(String factoryId, String category);

    /**
     * 检查配置是否存在
     */
    boolean existsByFactoryIdAndCategory(String factoryId, String category);
}
