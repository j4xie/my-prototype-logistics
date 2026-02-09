package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryBlueprintBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 工厂蓝图绑定数据访问层
 *
 * Sprint 3 任务: S3-7 蓝图版本管理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface FactoryBlueprintBindingRepository extends JpaRepository<FactoryBlueprintBinding, String> {

    /**
     * 根据工厂ID查询绑定
     */
    Optional<FactoryBlueprintBinding> findByFactoryIdAndDeletedAtIsNull(String factoryId);

    /**
     * 根据蓝图ID查询所有绑定的工厂
     */
    List<FactoryBlueprintBinding> findByBlueprintIdAndDeletedAtIsNull(String blueprintId);

    /**
     * 查询使用特定蓝图特定版本的工厂
     */
    List<FactoryBlueprintBinding> findByBlueprintIdAndAppliedVersionAndDeletedAtIsNull(
            String blueprintId, Integer appliedVersion);

    /**
     * 查询有待处理更新的工厂
     */
    List<FactoryBlueprintBinding> findByBlueprintIdAndPendingVersionNotNullAndDeletedAtIsNull(String blueprintId);

    /**
     * 查询启用自动更新的工厂
     */
    List<FactoryBlueprintBinding> findByBlueprintIdAndAutoUpdateTrueAndDeletedAtIsNull(String blueprintId);

    /**
     * 查询版本落后的工厂 (appliedVersion < latestVersion)
     */
    @Query("SELECT b FROM FactoryBlueprintBinding b WHERE b.blueprintId = :blueprintId " +
            "AND b.appliedVersion < b.latestVersion AND b.deletedAt IS NULL")
    List<FactoryBlueprintBinding> findOutdatedFactories(String blueprintId);

    /**
     * 查询特定通知状态的绑定
     */
    List<FactoryBlueprintBinding> findByNotificationStatusAndDeletedAtIsNull(String notificationStatus);

    /**
     * 检查工厂是否已绑定蓝图
     */
    boolean existsByFactoryIdAndDeletedAtIsNull(String factoryId);
}
