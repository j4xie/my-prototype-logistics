package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryTypeBlueprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 工厂类型蓝图数据访问层
 */
@Repository
public interface FactoryTypeBlueprintRepository extends JpaRepository<FactoryTypeBlueprint, String> {

    /**
     * 查询所有激活的蓝图
     */
    List<FactoryTypeBlueprint> findByIsActiveTrueAndDeletedAtIsNull();

    /**
     * 根据行业类型查询蓝图
     */
    List<FactoryTypeBlueprint> findByIndustryTypeAndDeletedAtIsNull(String industryType);

    /**
     * 根据ID查询（排除已删除）
     */
    Optional<FactoryTypeBlueprint> findByIdAndDeletedAtIsNull(String id);

    /**
     * 根据名称查询
     */
    Optional<FactoryTypeBlueprint> findByNameAndDeletedAtIsNull(String name);
}
