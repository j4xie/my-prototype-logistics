package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI 动态字典 Repository
 */
@Repository
public interface SmartBiDictionaryRepository extends JpaRepository<SmartBiDictionary, Long> {

    /**
     * 按类型查找所有启用的字典条目
     */
    List<SmartBiDictionary> findByDictTypeAndIsActiveTrueOrderByPriorityAsc(String dictType);

    /**
     * 按类型和工厂ID查找（包括全局配置）
     */
    @Query("SELECT d FROM SmartBiDictionary d WHERE d.dictType = :dictType " +
           "AND d.isActive = true " +
           "AND (d.factoryId IS NULL OR d.factoryId = :factoryId) " +
           "ORDER BY d.priority ASC")
    List<SmartBiDictionary> findByDictTypeAndFactoryId(
            @Param("dictType") String dictType,
            @Param("factoryId") String factoryId);

    /**
     * 查找特定条目
     */
    Optional<SmartBiDictionary> findByDictTypeAndNameAndFactoryId(
            String dictType, String name, String factoryId);

    /**
     * 查找全局条目
     */
    @Query("SELECT d FROM SmartBiDictionary d WHERE d.dictType = :dictType " +
           "AND d.name = :name AND d.factoryId IS NULL")
    Optional<SmartBiDictionary> findGlobalByDictTypeAndName(
            @Param("dictType") String dictType,
            @Param("name") String name);

    /**
     * 检查是否存在
     */
    boolean existsByDictTypeAndNameAndFactoryId(String dictType, String name, String factoryId);

    /**
     * 按别名搜索（PostgreSQL 兼容）
     * 使用 JSONB 包含操作符检查 aliases 数组是否包含指定别名
     */
    @Query(value = "SELECT * FROM smart_bi_dictionary WHERE dict_type = :dictType " +
            "AND is_active = true " +
            "AND (factory_id IS NULL OR factory_id = :factoryId) " +
            "AND aliases::jsonb @> to_jsonb(:alias::text) " +
            "AND deleted_at IS NULL " +
            "ORDER BY priority ASC", nativeQuery = true)
    List<SmartBiDictionary> findByAliasContaining(
            @Param("dictType") String dictType,
            @Param("factoryId") String factoryId,
            @Param("alias") String alias);

    /**
     * 统计各类型条目数
     */
    long countByDictTypeAndIsActiveTrue(String dictType);

    /**
     * 获取所有字典类型
     */
    @Query("SELECT DISTINCT d.dictType FROM SmartBiDictionary d WHERE d.isActive = true")
    List<String> findAllDictTypes();

    /**
     * 按来源查找
     */
    List<SmartBiDictionary> findBySourceAndIsActiveTrue(String source);
}
