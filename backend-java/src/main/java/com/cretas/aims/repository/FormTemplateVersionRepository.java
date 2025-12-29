package com.cretas.aims.repository;

import com.cretas.aims.entity.config.FormTemplateVersion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 表单模板版本Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Repository
public interface FormTemplateVersionRepository extends JpaRepository<FormTemplateVersion, String> {

    /**
     * 根据模板ID获取所有版本历史
     */
    List<FormTemplateVersion> findByTemplateIdOrderByVersionDesc(String templateId);

    /**
     * 根据模板ID分页获取版本历史
     */
    Page<FormTemplateVersion> findByTemplateIdOrderByVersionDesc(String templateId, Pageable pageable);

    /**
     * 获取模板的特定版本
     */
    Optional<FormTemplateVersion> findByTemplateIdAndVersion(String templateId, Integer version);

    /**
     * 根据工厂和实体类型获取版本历史
     */
    List<FormTemplateVersion> findByFactoryIdAndEntityTypeOrderByVersionDesc(
            String factoryId, String entityType);

    /**
     * 获取模板的最新版本记录
     */
    Optional<FormTemplateVersion> findFirstByTemplateIdOrderByVersionDesc(String templateId);

    /**
     * 统计模板的版本数量
     */
    long countByTemplateId(String templateId);

    /**
     * 删除模板的所有版本历史
     */
    void deleteByTemplateId(String templateId);

    /**
     * 获取指定版本范围的版本列表
     */
    @Query("SELECT v FROM FormTemplateVersion v WHERE v.templateId = :templateId " +
           "AND v.version >= :fromVersion AND v.version <= :toVersion " +
           "ORDER BY v.version DESC")
    List<FormTemplateVersion> findVersionRange(
            @Param("templateId") String templateId,
            @Param("fromVersion") Integer fromVersion,
            @Param("toVersion") Integer toVersion);
}
