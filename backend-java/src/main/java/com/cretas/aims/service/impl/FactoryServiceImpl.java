package com.cretas.aims.service.impl;

import com.cretas.aims.dto.platform.CreateFactoryRequest;
import com.cretas.aims.dto.platform.FactoryDTO;
import com.cretas.aims.dto.platform.UpdateFactoryRequest;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.service.FactoryService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 工厂管理服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Service
@RequiredArgsConstructor
public class FactoryServiceImpl implements FactoryService {

    private static final Logger log = LoggerFactory.getLogger(FactoryServiceImpl.class);

    private final FactoryRepository factoryRepository;

    /**
     * 获取所有工厂列表（不推荐，使用分页版本）
     * 内部限制最多返回1000条，防止内存溢出
     */
    @Override
    @Deprecated
    public List<FactoryDTO> getAllFactories() {
        log.warn("使用了无分页的getAllFactories()，建议使用分页版本");
        // 限制最多返回1000条，防止内存问题
        Page<Factory> factories = factoryRepository.findAll(PageRequest.of(0, 1000));
        return factories.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public Page<FactoryDTO> getAllFactories(Pageable pageable) {
        log.info("分页获取工厂列表: page={}, size={}", pageable.getPageNumber(), pageable.getPageSize());
        Page<Factory> factories = factoryRepository.findAll(pageable);
        return factories.map(this::convertToDTO);
    }

    @Override
    public FactoryDTO getFactoryById(String factoryId) {
        log.info("获取工厂详情，factoryId: {}", factoryId);
        Factory factory = factoryRepository.findById(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂不存在，ID: " + factoryId));
        return convertToDTO(factory);
    }

    @Override
    @Transactional
    public FactoryDTO createFactory(CreateFactoryRequest request) {
        log.info("创建新工厂，name: {}, industryCode: {}, regionCode: {}",
                request.getName(), request.getIndustryCode(), request.getRegionCode());

        // 生成工厂ID（格式：行业代码_地区代码_序号）
        String factoryId = generateFactoryId(request.getIndustryCode(), request.getRegionCode());

        Factory factory = new Factory();
        factory.setId(factoryId);
        factory.setName(request.getName());
        factory.setIndustryCode(request.getIndustryCode());
        factory.setRegionCode(request.getRegionCode());
        factory.setAddress(request.getAddress());
        factory.setContactName(request.getContactName());
        factory.setContactPhone(request.getContactPhone());
        factory.setContactEmail(request.getContactEmail());
        factory.setSubscriptionPlan(request.getSubscriptionPlan() != null ? request.getSubscriptionPlan() : "BASIC");
        factory.setAiWeeklyQuota(request.getAiWeeklyQuota() != null ? request.getAiWeeklyQuota() : 50);
        factory.setIsActive(request.getIsActive() != null ? request.getIsActive() : true);
        factory.setCreatedAt(LocalDateTime.now());
        factory.setUpdatedAt(LocalDateTime.now());

        Factory savedFactory = factoryRepository.save(factory);
        log.info("工厂创建成功，factoryId: {}", savedFactory.getId());

        return convertToDTO(savedFactory);
    }

    @Override
    @Transactional
    public FactoryDTO updateFactory(String factoryId, UpdateFactoryRequest request) {
        log.info("更新工厂信息，factoryId: {}", factoryId);

        Factory factory = factoryRepository.findById(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂不存在，ID: " + factoryId));

        // 更新字段（只更新非空字段）
        if (request.getName() != null) {
            factory.setName(request.getName());
        }
        if (request.getAddress() != null) {
            factory.setAddress(request.getAddress());
        }
        if (request.getContactName() != null) {
            factory.setContactName(request.getContactName());
        }
        if (request.getContactPhone() != null) {
            factory.setContactPhone(request.getContactPhone());
        }
        if (request.getContactEmail() != null) {
            factory.setContactEmail(request.getContactEmail());
        }
        if (request.getSubscriptionPlan() != null) {
            factory.setSubscriptionPlan(request.getSubscriptionPlan());
        }
        if (request.getAiWeeklyQuota() != null) {
            factory.setAiWeeklyQuota(request.getAiWeeklyQuota());
        }
        if (request.getIsActive() != null) {
            factory.setIsActive(request.getIsActive());
        }

        factory.setUpdatedAt(LocalDateTime.now());

        Factory updatedFactory = factoryRepository.save(factory);
        log.info("工厂更新成功，factoryId: {}", updatedFactory.getId());

        return convertToDTO(updatedFactory);
    }

    @Override
    @Transactional
    public void deleteFactory(String factoryId) {
        log.info("删除工厂（软删除），factoryId: {}", factoryId);

        Factory factory = factoryRepository.findById(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂不存在，ID: " + factoryId));

        factory.setIsActive(false);
        factory.setUpdatedAt(LocalDateTime.now());
        factoryRepository.save(factory);

        log.info("工厂已停用，factoryId: {}", factoryId);
    }

    @Override
    @Transactional
    public FactoryDTO activateFactory(String factoryId) {
        log.info("激活工厂，factoryId: {}", factoryId);

        Factory factory = factoryRepository.findById(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂不存在，ID: " + factoryId));

        factory.setIsActive(true);
        factory.setUpdatedAt(LocalDateTime.now());

        Factory updatedFactory = factoryRepository.save(factory);
        log.info("工厂已激活，factoryId: {}", factoryId);

        return convertToDTO(updatedFactory);
    }

    @Override
    @Transactional
    public FactoryDTO deactivateFactory(String factoryId) {
        log.info("停用工厂，factoryId: {}", factoryId);

        Factory factory = factoryRepository.findById(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂不存在，ID: " + factoryId));

        factory.setIsActive(false);
        factory.setUpdatedAt(LocalDateTime.now());

        Factory updatedFactory = factoryRepository.save(factory);
        log.info("工厂已停用，factoryId: {}", factoryId);

        return convertToDTO(updatedFactory);
    }

    /**
     * 生成工厂ID
     * 格式：行业代码_地区代码_序号
     * 例如：FISH_2025_001
     *
     * @param industryCode 行业代码
     * @param regionCode   地区代码
     * @return 工厂ID
     */
    private String generateFactoryId(String industryCode, String regionCode) {
        // 使用COUNT查询替代findAll().stream().filter()，避免全表加载
        String prefix = industryCode + "_" + regionCode + "_";
        long existingCount = factoryRepository.countByIdPrefix(prefix);

        // 生成序号（001, 002, 003...）
        int sequence = (int) existingCount + 1;
        String factoryId = String.format("%s_%s_%03d", industryCode, regionCode, sequence);

        log.info("生成工厂ID: {}, 现有数量: {}", factoryId, existingCount);
        return factoryId;
    }

    /**
     * 将Factory实体转换为FactoryDTO
     *
     * @param factory 工厂实体
     * @return 工厂DTO
     */
    private FactoryDTO convertToDTO(Factory factory) {
        return FactoryDTO.builder()
                .id(factory.getId())
                .name(factory.getName())
                .industryCode(factory.getIndustryCode())
                .regionCode(factory.getRegionCode())
                .address(factory.getAddress())
                .contactName(factory.getContactName())
                .contactPhone(factory.getContactPhone())
                .contactEmail(factory.getContactEmail())
                .subscriptionPlan(factory.getSubscriptionPlan())
                .aiWeeklyQuota(factory.getAiWeeklyQuota())
                .isActive(factory.getIsActive())
                .createdAt(factory.getCreatedAt())
                .updatedAt(factory.getUpdatedAt())
                .build();
    }
}
