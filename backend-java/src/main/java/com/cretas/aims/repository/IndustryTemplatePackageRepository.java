package com.cretas.aims.repository;

import com.cretas.aims.entity.IndustryTemplatePackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 行业模板包Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Repository
public interface IndustryTemplatePackageRepository extends JpaRepository<IndustryTemplatePackage, String> {

    /**
     * 根据行业代码查找模板
     */
    List<IndustryTemplatePackage> findByIndustryCode(String industryCode);

    /**
     * 查找默认模板
     */
    Optional<IndustryTemplatePackage> findByIsDefaultTrue();

    /**
     * 查找所有可用模板（未删除）
     */
    @Query("SELECT t FROM IndustryTemplatePackage t WHERE t.deletedAt IS NULL ORDER BY t.isDefault DESC, t.industryName ASC")
    List<IndustryTemplatePackage> findAllAvailable();

    /**
     * 根据行业代码查找最新版本
     */
    @Query("SELECT t FROM IndustryTemplatePackage t WHERE t.industryCode = :industryCode AND t.deletedAt IS NULL ORDER BY t.version DESC")
    List<IndustryTemplatePackage> findLatestByIndustryCode(String industryCode);

    /**
     * 检查行业代码是否存在
     */
    boolean existsByIndustryCodeAndDeletedAtIsNull(String industryCode);

    /**
     * 清除所有默认标记
     */
    @Query("UPDATE IndustryTemplatePackage t SET t.isDefault = false WHERE t.isDefault = true")
    @org.springframework.data.jpa.repository.Modifying
    void clearAllDefaults();
}
