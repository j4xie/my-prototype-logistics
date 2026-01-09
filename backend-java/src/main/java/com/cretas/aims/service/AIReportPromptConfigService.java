package com.cretas.aims.service;

import com.cretas.aims.dto.ai.AIReportPromptConfigDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * AI报告提示词配置服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
public interface AIReportPromptConfigService {

    /**
     * 分页获取所有配置
     *
     * @param pageable 分页参数
     * @return 配置分页列表
     */
    Page<AIReportPromptConfigDTO> getAllConfigs(Pageable pageable);

    /**
     * 根据ID获取配置
     *
     * @param id 配置ID
     * @return 配置详情
     */
    AIReportPromptConfigDTO getConfigById(String id);

    /**
     * 根据报告类型获取配置列表
     *
     * @param reportType 报告类型 (daily/weekly/monthly/quarterly/yearly)
     * @return 配置列表
     */
    List<AIReportPromptConfigDTO> getConfigsByReportType(String reportType);

    /**
     * 创建新配置
     *
     * @param dto 配置DTO
     * @param username 操作者用户名
     * @return 创建的配置
     */
    AIReportPromptConfigDTO createConfig(AIReportPromptConfigDTO dto, String username);

    /**
     * 更新配置
     *
     * @param id 配置ID
     * @param dto 配置DTO
     * @param username 操作者用户名
     * @return 更新后的配置
     */
    AIReportPromptConfigDTO updateConfig(String id, AIReportPromptConfigDTO dto, String username);

    /**
     * 删除配置
     *
     * @param id 配置ID
     */
    void deleteConfig(String id);

    /**
     * 激活配置
     *
     * @param id 配置ID
     * @param username 操作者用户名
     * @return 激活后的配置
     */
    AIReportPromptConfigDTO activateConfig(String id, String username);

    /**
     * 停用配置
     *
     * @param id 配置ID
     * @param username 操作者用户名
     * @return 停用后的配置
     */
    AIReportPromptConfigDTO deactivateConfig(String id, String username);

    /**
     * 获取工厂适用的配置（优先工厂级别，其次全局）
     *
     * @param factoryId 工厂ID
     * @param reportType 报告类型
     * @return 最佳匹配配置
     */
    AIReportPromptConfigDTO getEffectiveConfig(String factoryId, String reportType);
}
