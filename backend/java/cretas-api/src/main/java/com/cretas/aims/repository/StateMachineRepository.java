package com.cretas.aims.repository;

import com.cretas.aims.entity.rules.StateMachine;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 状态机 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Repository
public interface StateMachineRepository extends JpaRepository<StateMachine, String> {

    /**
     * 按工厂ID和实体类型查询状态机
     */
    Optional<StateMachine> findByFactoryIdAndEntityType(String factoryId, String entityType);

    /**
     * 按工厂ID和实体类型查询启用的状态机
     */
    Optional<StateMachine> findByFactoryIdAndEntityTypeAndEnabledTrue(String factoryId, String entityType);

    /**
     * 按工厂ID查询所有状态机
     */
    List<StateMachine> findByFactoryId(String factoryId);

    /**
     * 按工厂ID查询所有启用的状态机
     */
    List<StateMachine> findByFactoryIdAndEnabledTrue(String factoryId);

    /**
     * 按工厂ID分页查询
     */
    Page<StateMachine> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 检查是否存在
     */
    boolean existsByFactoryIdAndEntityType(String factoryId, String entityType);

    /**
     * 按工厂ID统计
     */
    long countByFactoryId(String factoryId);

    /**
     * 获取工厂配置的所有实体类型
     */
    @Query("SELECT DISTINCT sm.entityType FROM StateMachine sm WHERE sm.factoryId = :factoryId")
    List<String> findDistinctEntityTypesByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 查询已发布的状态机版本
     */
    Optional<StateMachine> findByFactoryIdAndEntityTypeAndPublishStatus(
            String factoryId, String entityType, String publishStatus);

    /**
     * 按发布状态查询
     */
    List<StateMachine> findByFactoryIdAndEntityTypeOrderByVersionDesc(
            String factoryId, String entityType);

    /**
     * 获取最大版本号
     */
    @Query("SELECT COALESCE(MAX(sm.version), 0) FROM StateMachine sm WHERE sm.factoryId = :factoryId AND sm.entityType = :entityType")
    Integer findMaxVersion(@Param("factoryId") String factoryId, @Param("entityType") String entityType);
}
