package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.SystemEnum;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 系统枚举配置 Repository
 *
 * 支持工厂级覆盖的枚举查询:
 * - 优先返回工厂级配置
 * - 如果不存在则返回全局配置 (factoryId = '*')
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface SystemEnumRepository extends JpaRepository<SystemEnum, String> {

    /**
     * 根据工厂ID和枚举组查询所有枚举值
     * 优先返回工厂级配置，如果没有则返回全局配置
     */
    @Query("SELECT e FROM SystemEnum e " +
           "WHERE e.enumGroup = :enumGroup " +
           "AND e.factoryId IN (:factoryId, '*') " +
           "AND e.isActive = true " +
           "AND e.deletedAt IS NULL " +
           "ORDER BY e.sortOrder ASC, " +
           "CASE WHEN e.factoryId = :factoryId THEN 1 ELSE 2 END")
    List<SystemEnum> findByFactoryIdAndEnumGroup(
            @Param("factoryId") String factoryId,
            @Param("enumGroup") String enumGroup);

    /**
     * 查询指定枚举组的全局配置
     */
    List<SystemEnum> findByFactoryIdAndEnumGroupAndIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAsc(
            String factoryId, String enumGroup);

    /**
     * 根据工厂ID、枚举组和枚举代码查询单个枚举
     */
    @Query("SELECT e FROM SystemEnum e " +
           "WHERE e.enumGroup = :enumGroup " +
           "AND e.enumCode = :enumCode " +
           "AND e.factoryId IN (:factoryId, '*') " +
           "AND e.isActive = true " +
           "AND e.deletedAt IS NULL " +
           "ORDER BY CASE WHEN e.factoryId = :factoryId THEN 1 ELSE 2 END")
    List<SystemEnum> findByFactoryIdAndEnumGroupAndEnumCode(
            @Param("factoryId") String factoryId,
            @Param("enumGroup") String enumGroup,
            @Param("enumCode") String enumCode);

    /**
     * 查询工厂的所有枚举配置
     */
    List<SystemEnum> findByFactoryIdAndIsActiveTrueAndDeletedAtIsNullOrderByEnumGroupAscSortOrderAsc(
            String factoryId);

    /**
     * 查询所有可用的枚举组
     */
    @Query("SELECT DISTINCT e.enumGroup FROM SystemEnum e " +
           "WHERE e.isActive = true AND e.deletedAt IS NULL " +
           "ORDER BY e.enumGroup")
    List<String> findAllEnumGroups();

    /**
     * 检查枚举配置是否存在
     */
    boolean existsByFactoryIdAndEnumGroupAndEnumCode(
            String factoryId, String enumGroup, String enumCode);

    /**
     * 根据枚举组查询所有全局配置
     */
    @Query("SELECT e FROM SystemEnum e " +
           "WHERE e.enumGroup = :enumGroup " +
           "AND e.factoryId = '*' " +
           "AND e.isActive = true " +
           "AND e.deletedAt IS NULL " +
           "ORDER BY e.sortOrder ASC")
    List<SystemEnum> findGlobalByEnumGroup(@Param("enumGroup") String enumGroup);

    /**
     * 根据父代码查询子枚举
     */
    List<SystemEnum> findByParentCodeAndIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAsc(
            String parentCode);

    /**
     * 统计枚举组中的枚举数量
     */
    @Query("SELECT COUNT(e) FROM SystemEnum e " +
           "WHERE e.enumGroup = :enumGroup " +
           "AND e.factoryId = :factoryId " +
           "AND e.isActive = true " +
           "AND e.deletedAt IS NULL")
    Long countByFactoryIdAndEnumGroup(
            @Param("factoryId") String factoryId,
            @Param("enumGroup") String enumGroup);

    /**
     * 根据枚举组和枚举值查询
     */
    @Query("SELECT e FROM SystemEnum e " +
           "WHERE e.enumGroup = :enumGroup " +
           "AND e.enumValue = :enumValue " +
           "AND e.factoryId IN (:factoryId, '*') " +
           "AND e.isActive = true " +
           "AND e.deletedAt IS NULL " +
           "ORDER BY CASE WHEN e.factoryId = :factoryId THEN 1 ELSE 2 END")
    List<SystemEnum> findByFactoryIdAndEnumGroupAndEnumValue(
            @Param("factoryId") String factoryId,
            @Param("enumGroup") String enumGroup,
            @Param("enumValue") String enumValue);

    /**
     * 精确查询单个枚举 (用于更新/删除)
     */
    Optional<SystemEnum> findByFactoryIdAndEnumGroupAndEnumCodeAndDeletedAtIsNull(
            String factoryId, String enumGroup, String enumCode);

    /**
     * 查询系统内置枚举
     */
    List<SystemEnum> findByIsSystemTrueAndIsActiveTrueAndDeletedAtIsNullOrderByEnumGroupAscSortOrderAsc();
}
