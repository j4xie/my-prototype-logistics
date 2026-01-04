package com.cretas.aims.repository;

import com.cretas.aims.entity.scale.ScaleBrandModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 秤品牌型号 Repository
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Repository
public interface ScaleBrandModelRepository extends JpaRepository<ScaleBrandModel, String> {

    /**
     * 根据品牌编码查找所有型号
     */
    List<ScaleBrandModel> findByBrandCode(String brandCode);

    /**
     * 根据品牌编码和型号编码查找
     */
    Optional<ScaleBrandModel> findByBrandCodeAndModelCode(String brandCode, String modelCode);

    /**
     * 查找所有推荐的型号
     */
    List<ScaleBrandModel> findByIsRecommendedTrueOrderByRecommendationScoreDesc();

    /**
     * 查找所有已验证的型号
     */
    List<ScaleBrandModel> findByIsVerifiedTrue();

    /**
     * 按秤类型查找
     */
    List<ScaleBrandModel> findByScaleType(ScaleBrandModel.ScaleType scaleType);

    /**
     * 查找支持WiFi的型号
     */
    List<ScaleBrandModel> findByHasWifiTrue();

    /**
     * 查找所有品牌 (去重)
     */
    @Query("SELECT DISTINCT b.brandCode, b.brandName, b.brandNameEn FROM ScaleBrandModel b ORDER BY b.brandName")
    List<Object[]> findDistinctBrands();

    /**
     * 按关键词搜索 (品牌名、型号名)
     */
    @Query("SELECT b FROM ScaleBrandModel b WHERE " +
            "LOWER(b.brandName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(b.brandNameEn) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(b.modelCode) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(b.modelName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "ORDER BY b.sortOrder, b.brandName")
    List<ScaleBrandModel> searchByKeyword(@Param("keyword") String keyword);

    /**
     * 查找支持某协议的品牌型号
     */
    @Query("SELECT b FROM ScaleBrandModel b WHERE b.supportedProtocolIds LIKE CONCAT('%', :protocolId, '%')")
    List<ScaleBrandModel> findByProtocolId(@Param("protocolId") String protocolId);
}
