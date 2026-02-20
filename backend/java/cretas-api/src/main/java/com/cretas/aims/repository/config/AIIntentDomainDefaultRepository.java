package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.AIIntentDomainDefault;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AI意图域默认配置 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-10
 */
@Repository
public interface AIIntentDomainDefaultRepository extends JpaRepository<AIIntentDomainDefault, String> {

    /**
     * 根据工厂ID和域名查找配置
     * 精确匹配，用于工厂级配置查询
     */
    Optional<AIIntentDomainDefault> findByFactoryIdAndDomainNameAndIsActiveTrueAndDeletedAtIsNull(
            String factoryId, String domainName);

    /**
     * 查找平台级配置（factoryId为null）
     */
    @Query("SELECT d FROM AIIntentDomainDefault d " +
           "WHERE d.factoryId IS NULL " +
           "AND d.domainName = :domainName " +
           "AND d.isActive = true " +
           "AND d.deletedAt IS NULL")
    Optional<AIIntentDomainDefault> findPlatformLevelByDomainName(@Param("domainName") String domainName);

    /**
     * 查找工厂可见的域默认配置（工厂级 + 平台级）
     * 用于列表展示
     */
    @Query("SELECT d FROM AIIntentDomainDefault d " +
           "WHERE d.isActive = true " +
           "AND d.deletedAt IS NULL " +
           "AND (d.factoryId = :factoryId OR d.factoryId IS NULL) " +
           "ORDER BY d.domainName ASC")
    List<AIIntentDomainDefault> findByFactoryIdOrPlatformLevel(@Param("factoryId") String factoryId);

    /**
     * 查找所有启用的平台级配置
     */
    @Query("SELECT d FROM AIIntentDomainDefault d " +
           "WHERE d.factoryId IS NULL " +
           "AND d.isActive = true " +
           "AND d.deletedAt IS NULL " +
           "ORDER BY d.domainName ASC")
    List<AIIntentDomainDefault> findAllPlatformLevel();

    /**
     * 查找指定工厂的所有配置（不包含平台级）
     */
    List<AIIntentDomainDefault> findByFactoryIdAndIsActiveTrueAndDeletedAtIsNullOrderByDomainNameAsc(
            String factoryId);

    /**
     * 检查域默认配置是否已存在
     */
    @Query("SELECT CASE WHEN COUNT(d) > 0 THEN true ELSE false END FROM AIIntentDomainDefault d " +
           "WHERE d.domainName = :domainName " +
           "AND d.deletedAt IS NULL " +
           "AND ((:factoryId IS NULL AND d.factoryId IS NULL) OR d.factoryId = :factoryId)")
    boolean existsByFactoryIdAndDomainName(
            @Param("factoryId") String factoryId,
            @Param("domainName") String domainName);

    /**
     * 根据域名查找所有配置（包括工厂级和平台级）
     */
    @Query("SELECT d FROM AIIntentDomainDefault d " +
           "WHERE d.domainName = :domainName " +
           "AND d.isActive = true " +
           "AND d.deletedAt IS NULL")
    List<AIIntentDomainDefault> findAllByDomainName(@Param("domainName") String domainName);

    /**
     * 获取所有已配置的域名列表
     */
    @Query("SELECT DISTINCT d.domainName FROM AIIntentDomainDefault d " +
           "WHERE d.isActive = true AND d.deletedAt IS NULL " +
           "ORDER BY d.domainName ASC")
    List<String> findAllDomainNames();
}
