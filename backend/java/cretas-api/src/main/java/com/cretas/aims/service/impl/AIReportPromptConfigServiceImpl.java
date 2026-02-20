package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.AIReportPromptConfigDTO;
import com.cretas.aims.entity.config.AIReportPromptConfig;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.config.AIReportPromptConfigRepository;
import com.cretas.aims.service.AIReportPromptConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * AI报告提示词配置服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIReportPromptConfigServiceImpl implements AIReportPromptConfigService {

    private final AIReportPromptConfigRepository configRepository;

    @Override
    public Page<AIReportPromptConfigDTO> getAllConfigs(Pageable pageable) {
        log.info("获取所有AI报告提示词配置，分页: page={}, size={}",
                pageable.getPageNumber(), pageable.getPageSize());

        Page<AIReportPromptConfig> configs = configRepository.findAllByOrderByPriorityDesc(pageable);
        return configs.map(this::convertToDTO);
    }

    @Override
    public AIReportPromptConfigDTO getConfigById(String id) {
        log.info("获取AI报告提示词配置: id={}", id);

        AIReportPromptConfig config = configRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("配置不存在: " + id));

        return convertToDTO(config);
    }

    @Override
    public List<AIReportPromptConfigDTO> getConfigsByReportType(String reportType) {
        log.info("按报告类型获取配置: reportType={}", reportType);

        validateReportType(reportType);

        List<AIReportPromptConfig> configs = configRepository.findByReportTypeOrderByPriorityDesc(reportType);
        return configs.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public AIReportPromptConfigDTO createConfig(AIReportPromptConfigDTO dto, String username) {
        log.info("创建AI报告提示词配置: reportType={}, factoryId={}, createdBy={}",
                dto.getReportType(), dto.getFactoryId(), username);

        validateReportType(dto.getReportType());

        AIReportPromptConfig config = AIReportPromptConfig.builder()
                .factoryId(dto.getFactoryId())
                .reportType(dto.getReportType())
                .configName(dto.getConfigName())
                .promptTemplate(dto.getPromptTemplate())
                .analysisDirections(dto.getAnalysisDirections())
                .isActive(dto.getIsActive() != null ? dto.getIsActive() : true)
                .priority(dto.getPriority() != null ? dto.getPriority() : 0)
                .description(dto.getDescription())
                .maxTokens(dto.getMaxTokens() != null ? dto.getMaxTokens() : 4000)
                .temperature(dto.getTemperature() != null ? dto.getTemperature() : 0.7)
                .createdBy(username)
                .updatedBy(username)
                .build();

        config = configRepository.save(config);
        log.info("AI报告提示词配置创建成功: id={}", config.getId());

        return convertToDTO(config);
    }

    @Override
    @Transactional
    public AIReportPromptConfigDTO updateConfig(String id, AIReportPromptConfigDTO dto, String username) {
        log.info("更新AI报告提示词配置: id={}, updatedBy={}", id, username);

        AIReportPromptConfig config = configRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("配置不存在: " + id));

        // 验证报告类型（如果提供）
        if (dto.getReportType() != null) {
            validateReportType(dto.getReportType());
            config.setReportType(dto.getReportType());
        }

        // 更新非null字段
        if (dto.getFactoryId() != null) {
            config.setFactoryId(dto.getFactoryId());
        }
        if (dto.getConfigName() != null) {
            config.setConfigName(dto.getConfigName());
        }
        if (dto.getPromptTemplate() != null) {
            config.setPromptTemplate(dto.getPromptTemplate());
        }
        if (dto.getAnalysisDirections() != null) {
            config.setAnalysisDirections(dto.getAnalysisDirections());
        }
        if (dto.getIsActive() != null) {
            config.setIsActive(dto.getIsActive());
        }
        if (dto.getPriority() != null) {
            config.setPriority(dto.getPriority());
        }
        if (dto.getDescription() != null) {
            config.setDescription(dto.getDescription());
        }
        if (dto.getMaxTokens() != null) {
            config.setMaxTokens(dto.getMaxTokens());
        }
        if (dto.getTemperature() != null) {
            config.setTemperature(dto.getTemperature());
        }

        config.setUpdatedBy(username);
        config = configRepository.save(config);

        log.info("AI报告提示词配置更新成功: id={}", config.getId());
        return convertToDTO(config);
    }

    @Override
    @Transactional
    public void deleteConfig(String id) {
        log.info("删除AI报告提示词配置: id={}", id);

        if (!configRepository.existsById(id)) {
            throw new ResourceNotFoundException("配置不存在: " + id);
        }

        configRepository.deleteById(id);
        log.info("AI报告提示词配置删除成功: id={}", id);
    }

    @Override
    @Transactional
    public AIReportPromptConfigDTO activateConfig(String id, String username) {
        log.info("激活AI报告提示词配置: id={}, updatedBy={}", id, username);

        AIReportPromptConfig config = configRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("配置不存在: " + id));

        config.setIsActive(true);
        config.setUpdatedBy(username);
        config = configRepository.save(config);

        log.info("AI报告提示词配置激活成功: id={}", config.getId());
        return convertToDTO(config);
    }

    @Override
    @Transactional
    public AIReportPromptConfigDTO deactivateConfig(String id, String username) {
        log.info("停用AI报告提示词配置: id={}, updatedBy={}", id, username);

        AIReportPromptConfig config = configRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("配置不存在: " + id));

        config.setIsActive(false);
        config.setUpdatedBy(username);
        config = configRepository.save(config);

        log.info("AI报告提示词配置停用成功: id={}", config.getId());
        return convertToDTO(config);
    }

    @Override
    public AIReportPromptConfigDTO getEffectiveConfig(String factoryId, String reportType) {
        log.info("获取工厂适用的配置: factoryId={}, reportType={}", factoryId, reportType);

        validateReportType(reportType);

        // 1. 优先查找工厂级别配置
        if (factoryId != null) {
            AIReportPromptConfig config = configRepository
                    .findFirstByFactoryIdAndReportTypeAndIsActiveTrueOrderByPriorityDesc(factoryId, reportType)
                    .orElse(null);

            if (config != null) {
                log.debug("使用工厂级别配置: factoryId={}, reportType={}", factoryId, reportType);
                return convertToDTO(config);
            }
        }

        // 2. 使用全局默认配置
        AIReportPromptConfig globalConfig = configRepository
                .findFirstByFactoryIdIsNullAndReportTypeAndIsActiveTrueOrderByPriorityDesc(reportType)
                .orElse(null);

        if (globalConfig != null) {
            log.debug("使用全局默认配置: reportType={}", reportType);
            return convertToDTO(globalConfig);
        }

        // 3. 没有找到配置
        log.warn("未找到适用的配置: factoryId={}, reportType={}", factoryId, reportType);
        throw new ResourceNotFoundException("未找到适用的报告提示词配置: reportType=" + reportType);
    }

    /**
     * 验证报告类型
     */
    private void validateReportType(String reportType) {
        if (reportType == null || reportType.isEmpty()) {
            throw new BusinessException("报告类型不能为空");
        }

        if (!reportType.matches("^(daily|weekly|monthly|quarterly|yearly)$")) {
            throw new BusinessException("无效的报告类型: " + reportType +
                    "，必须是 daily/weekly/monthly/quarterly/yearly 之一");
        }
    }

    /**
     * Entity转DTO
     */
    private AIReportPromptConfigDTO convertToDTO(AIReportPromptConfig entity) {
        return AIReportPromptConfigDTO.builder()
                .id(entity.getId())
                .factoryId(entity.getFactoryId())
                .reportType(entity.getReportType())
                .configName(entity.getConfigName())
                .promptTemplate(entity.getPromptTemplate())
                .analysisDirections(entity.getAnalysisDirections())
                .isActive(entity.getIsActive())
                .priority(entity.getPriority())
                .description(entity.getDescription())
                .maxTokens(entity.getMaxTokens())
                .temperature(entity.getTemperature())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .build();
    }
}
