package com.cretas.aims.repository;

import com.cretas.aims.entity.FieldCapabilityMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 字段能力映射数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@Repository
public interface FieldCapabilityMappingRepository extends JpaRepository<FieldCapabilityMapping, Integer> {

    /**
     * 按实体类型查询映射
     */
    List<FieldCapabilityMapping> findByEntityType(String entityType);

    /**
     * 按调研问卷章节查询映射
     */
    List<FieldCapabilityMapping> findBySurveySection(String surveySection);

    /**
     * 按分析维度查询映射
     */
    List<FieldCapabilityMapping> findByAnalysisDimension(String analysisDimension);

    /**
     * 按HTML survey section和行号查询映射
     */
    List<FieldCapabilityMapping> findBySurveySectionHtmlAndSurveyRowIndexHtml(
            String surveySectionHtml, Integer surveyRowIndexHtml);

    /**
     * 查询所有有HTML映射的记录
     */
    List<FieldCapabilityMapping> findBySurveySectionHtmlIsNotNull();
}
