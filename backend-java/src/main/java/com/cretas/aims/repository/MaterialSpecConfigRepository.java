package com.cretas.aims.repository;

import com.cretas.aims.entity.MaterialSpecConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 原材料规格配置数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
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
