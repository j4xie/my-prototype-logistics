package com.cretas.aims.repository;

import com.cretas.aims.entity.scale.ScaleProtocolConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 秤协议配置 Repository
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Repository
public interface ScaleProtocolConfigRepository extends JpaRepository<ScaleProtocolConfig, String> {

    /**
     * 根据协议编码查找
     */
    Optional<ScaleProtocolConfig> findByProtocolCode(String protocolCode);

    /**
     * 查找工厂可用的协议列表 (全局协议 + 工厂专属协议)
     */
    @Query("SELECT p FROM ScaleProtocolConfig p WHERE p.isActive = true AND (p.factoryId IS NULL OR p.factoryId = :factoryId) ORDER BY p.protocolName")
    List<ScaleProtocolConfig> findAvailableProtocols(@Param("factoryId") String factoryId);

    /**
     * 查找所有启用的协议
     */
    List<ScaleProtocolConfig> findByIsActiveTrue();

    /**
     * 查找所有内置协议
     */
    List<ScaleProtocolConfig> findByIsBuiltinTrue();

    /**
     * 查找已验证的协议
     */
    List<ScaleProtocolConfig> findByIsVerifiedTrue();

    /**
     * 按连接类型查找协议
     */
    List<ScaleProtocolConfig> findByConnectionTypeAndIsActiveTrue(ScaleProtocolConfig.ConnectionType connectionType);

    /**
     * 检查协议编码是否存在
     */
    boolean existsByProtocolCode(String protocolCode);

    /**
     * 按规则组名称查找协议
     */
    List<ScaleProtocolConfig> findByParsingRuleGroup(String ruleGroup);

    /**
     * 按品牌代码模糊匹配协议 (协议编码格式: BRAND_MODEL_TYPE)
     * 优先返回已验证的协议
     */
    @Query("SELECT p FROM ScaleProtocolConfig p WHERE p.isActive = true " +
           "AND p.protocolCode LIKE CONCAT(:brandCode, '_%') " +
           "AND (p.factoryId IS NULL OR p.factoryId = :factoryId) " +
           "ORDER BY p.isVerified DESC, p.isBuiltin DESC, p.protocolName")
    List<ScaleProtocolConfig> findByBrandCodePattern(@Param("brandCode") String brandCode,
                                                      @Param("factoryId") String factoryId);

    /**
     * 按品牌+型号精确匹配协议 (协议编码格式: BRAND_MODEL_TYPE)
     */
    @Query("SELECT p FROM ScaleProtocolConfig p WHERE p.isActive = true " +
           "AND p.protocolCode LIKE CONCAT(:brandCode, '_', :modelCode, '_%') " +
           "AND (p.factoryId IS NULL OR p.factoryId = :factoryId) " +
           "ORDER BY p.isVerified DESC, p.isBuiltin DESC")
    List<ScaleProtocolConfig> findByBrandModelPattern(@Param("brandCode") String brandCode,
                                                       @Param("modelCode") String modelCode,
                                                       @Param("factoryId") String factoryId);
}
