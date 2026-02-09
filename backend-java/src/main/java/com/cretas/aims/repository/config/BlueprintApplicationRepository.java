package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.BlueprintApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 蓝图应用记录数据访问层
 */
@Repository
public interface BlueprintApplicationRepository extends JpaRepository<BlueprintApplication, String> {

    /**
     * 查询指定工厂的应用记录
     */
    List<BlueprintApplication> findByFactoryIdAndDeletedAtIsNull(String factoryId);

    /**
     * 查询指定蓝图的应用记录
     */
    List<BlueprintApplication> findByBlueprintIdAndDeletedAtIsNull(String blueprintId);

    /**
     * 查询指定工厂和蓝图的应用记录
     */
    List<BlueprintApplication> findByFactoryIdAndBlueprintIdAndDeletedAtIsNull(String factoryId, String blueprintId);
}
