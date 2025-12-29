package com.cretas.aims.service.impl;

import com.cretas.aims.dto.config.*;
import com.cretas.aims.entity.config.QualityCheckItem;
import com.cretas.aims.entity.config.QualityCheckItemBinding;
import com.cretas.aims.entity.enums.QualityCheckCategory;
import com.cretas.aims.entity.enums.QualitySeverity;
import com.cretas.aims.entity.enums.SamplingStrategy;
import com.cretas.aims.repository.QualityCheckItemBindingRepository;
import com.cretas.aims.repository.QualityCheckItemRepository;
import com.cretas.aims.service.QualityCheckItemService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityNotFoundException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 质检项配置服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QualityCheckItemServiceImpl implements QualityCheckItemService {

    private final QualityCheckItemRepository qualityCheckItemRepository;
    private final QualityCheckItemBindingRepository bindingRepository;

    // ==================== 质检项 CRUD ====================

    @Override
    @Transactional
    public QualityCheckItemDTO createQualityCheckItem(String factoryId, CreateQualityCheckItemRequest request, Long userId) {
        // 检查编号是否重复
        if (qualityCheckItemRepository.existsByFactoryIdAndItemCodeAndDeletedAtIsNull(factoryId, request.getItemCode())) {
            throw new IllegalArgumentException("项目编号已存在: " + request.getItemCode());
        }

        QualityCheckItem item = QualityCheckItem.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .itemCode(request.getItemCode())
                .itemName(request.getItemName())
                .category(request.getCategory())
                .description(request.getDescription())
                .checkMethod(request.getCheckMethod())
                .standardReference(request.getStandardReference())
                .valueType(request.getValueType())
                .standardValue(request.getStandardValue())
                .minValue(request.getMinValue())
                .maxValue(request.getMaxValue())
                .unit(request.getUnit())
                .tolerance(request.getTolerance())
                .samplingStrategy(request.getSamplingStrategy())
                .samplingRatio(request.getSamplingRatio())
                .minSampleSize(request.getMinSampleSize())
                .aqlLevel(request.getAqlLevel())
                .severity(request.getSeverity())
                .isRequired(request.getIsRequired())
                .requirePhotoOnFail(request.getRequirePhotoOnFail())
                .requireNoteOnFail(request.getRequireNoteOnFail())
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .enabled(request.getEnabled())
                .version(1)
                .createdBy(userId)
                .build();

        item = qualityCheckItemRepository.save(item);
        log.info("Created quality check item: {} for factory: {}", item.getItemCode(), factoryId);
        return toDTO(item);
    }

    @Override
    @Transactional
    public QualityCheckItemDTO updateQualityCheckItem(String factoryId, String itemId, UpdateQualityCheckItemRequest request) {
        QualityCheckItem item = findByIdAndFactory(itemId, factoryId);

        if (request.getItemName() != null) item.setItemName(request.getItemName());
        if (request.getCategory() != null) item.setCategory(request.getCategory());
        if (request.getDescription() != null) item.setDescription(request.getDescription());
        if (request.getCheckMethod() != null) item.setCheckMethod(request.getCheckMethod());
        if (request.getStandardReference() != null) item.setStandardReference(request.getStandardReference());
        if (request.getValueType() != null) item.setValueType(request.getValueType());
        if (request.getStandardValue() != null) item.setStandardValue(request.getStandardValue());
        if (request.getMinValue() != null) item.setMinValue(request.getMinValue());
        if (request.getMaxValue() != null) item.setMaxValue(request.getMaxValue());
        if (request.getUnit() != null) item.setUnit(request.getUnit());
        if (request.getTolerance() != null) item.setTolerance(request.getTolerance());
        if (request.getSamplingStrategy() != null) item.setSamplingStrategy(request.getSamplingStrategy());
        if (request.getSamplingRatio() != null) item.setSamplingRatio(request.getSamplingRatio());
        if (request.getMinSampleSize() != null) item.setMinSampleSize(request.getMinSampleSize());
        if (request.getAqlLevel() != null) item.setAqlLevel(request.getAqlLevel());
        if (request.getSeverity() != null) item.setSeverity(request.getSeverity());
        if (request.getIsRequired() != null) item.setIsRequired(request.getIsRequired());
        if (request.getRequirePhotoOnFail() != null) item.setRequirePhotoOnFail(request.getRequirePhotoOnFail());
        if (request.getRequireNoteOnFail() != null) item.setRequireNoteOnFail(request.getRequireNoteOnFail());
        if (request.getSortOrder() != null) item.setSortOrder(request.getSortOrder());
        if (request.getEnabled() != null) item.setEnabled(request.getEnabled());

        item.incrementVersion();
        item = qualityCheckItemRepository.save(item);
        log.info("Updated quality check item: {}", itemId);
        return toDTO(item);
    }

    @Override
    @Transactional
    public void deleteQualityCheckItem(String factoryId, String itemId) {
        QualityCheckItem item = findByIdAndFactory(itemId, factoryId);

        // 检查是否有绑定
        long bindingCount = bindingRepository.countByQualityCheckItemIdAndEnabledTrueAndDeletedAtIsNull(itemId);
        if (bindingCount > 0) {
            throw new IllegalStateException("该质检项已被 " + bindingCount + " 个产品使用，无法删除");
        }

        item.setDeletedAt(LocalDateTime.now());
        qualityCheckItemRepository.save(item);
        log.info("Deleted quality check item: {}", itemId);
    }

    @Override
    public QualityCheckItemDTO getQualityCheckItem(String factoryId, String itemId) {
        return toDTO(findByIdAndFactory(itemId, factoryId));
    }

    @Override
    public Page<QualityCheckItemDTO> getQualityCheckItems(String factoryId, Pageable pageable) {
        return qualityCheckItemRepository.findByFactoryIdAndDeletedAtIsNull(factoryId, pageable)
                .map(this::toDTO);
    }

    // ==================== 查询方法 ====================

    @Override
    public List<QualityCheckItemDTO> getByCategory(String factoryId, QualityCheckCategory category) {
        return qualityCheckItemRepository.findByFactoryIdAndCategoryAndDeletedAtIsNull(factoryId, category)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<QualityCheckItemDTO> getRequiredItems(String factoryId) {
        return qualityCheckItemRepository.findByFactoryIdAndIsRequiredTrueAndEnabledTrueAndDeletedAtIsNull(factoryId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<QualityCheckItemDTO> getCriticalItems(String factoryId) {
        return qualityCheckItemRepository.findCriticalItems(factoryId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<QualityCheckItemDTO> getEnabledItems(String factoryId) {
        return qualityCheckItemRepository.findByFactoryIdAndEnabledTrueAndDeletedAtIsNull(factoryId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<QualityCheckItemDTO> getSystemDefaultItems() {
        return qualityCheckItemRepository.findByFactoryIdIsNullAndEnabledTrueAndDeletedAtIsNull()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    // ==================== 统计方法 ====================

    @Override
    public Map<QualityCheckCategory, Long> countByCategory(String factoryId) {
        List<Object[]> results = qualityCheckItemRepository.countByCategory(factoryId);
        Map<QualityCheckCategory, Long> map = new EnumMap<>(QualityCheckCategory.class);
        for (Object[] row : results) {
            map.put((QualityCheckCategory) row[0], (Long) row[1]);
        }
        return map;
    }

    @Override
    public Map<String, Object> getStatistics(String factoryId) {
        Map<String, Object> stats = new HashMap<>();

        // 总数
        long total = qualityCheckItemRepository.countByFactoryIdAndEnabledTrueAndDeletedAtIsNull(factoryId);
        stats.put("total", total);

        // 按类别统计
        stats.put("byCategory", countByCategory(factoryId));

        // 按严重程度统计
        List<Object[]> severityResults = qualityCheckItemRepository.countBySeverity(factoryId);
        Map<QualitySeverity, Long> bySeverity = new EnumMap<>(QualitySeverity.class);
        for (Object[] row : severityResults) {
            bySeverity.put((QualitySeverity) row[0], (Long) row[1]);
        }
        stats.put("bySeverity", bySeverity);

        // 必检项数量
        stats.put("requiredCount", qualityCheckItemRepository
                .findByFactoryIdAndIsRequiredTrueAndEnabledTrueAndDeletedAtIsNull(factoryId).size());

        // 关键项数量
        stats.put("criticalCount", qualityCheckItemRepository.findCriticalItems(factoryId).size());

        return stats;
    }

    // ==================== 批量操作 ====================

    @Override
    @Transactional
    public int batchUpdateEnabled(List<String> itemIds, boolean enabled) {
        return qualityCheckItemRepository.batchUpdateEnabled(itemIds, enabled);
    }

    @Override
    @Transactional
    public List<QualityCheckItemDTO> copyFromSystemTemplate(String factoryId, Long userId) {
        List<QualityCheckItem> templates = qualityCheckItemRepository
                .findByFactoryIdIsNullAndEnabledTrueAndDeletedAtIsNull();

        List<QualityCheckItemDTO> copied = new ArrayList<>();
        for (QualityCheckItem template : templates) {
            // 检查是否已存在
            if (qualityCheckItemRepository.existsByFactoryIdAndItemCodeAndDeletedAtIsNull(factoryId, template.getItemCode())) {
                continue;
            }

            QualityCheckItem item = QualityCheckItem.builder()
                    .id(UUID.randomUUID().toString())
                    .factoryId(factoryId)
                    .itemCode(template.getItemCode())
                    .itemName(template.getItemName())
                    .category(template.getCategory())
                    .description(template.getDescription())
                    .checkMethod(template.getCheckMethod())
                    .standardReference(template.getStandardReference())
                    .valueType(template.getValueType())
                    .standardValue(template.getStandardValue())
                    .minValue(template.getMinValue())
                    .maxValue(template.getMaxValue())
                    .unit(template.getUnit())
                    .tolerance(template.getTolerance())
                    .samplingStrategy(template.getSamplingStrategy())
                    .samplingRatio(template.getSamplingRatio())
                    .minSampleSize(template.getMinSampleSize())
                    .aqlLevel(template.getAqlLevel())
                    .severity(template.getSeverity())
                    .isRequired(template.getIsRequired())
                    .requirePhotoOnFail(template.getRequirePhotoOnFail())
                    .requireNoteOnFail(template.getRequireNoteOnFail())
                    .sortOrder(template.getSortOrder())
                    .enabled(true)
                    .version(1)
                    .createdBy(userId)
                    .build();

            item = qualityCheckItemRepository.save(item);
            copied.add(toDTO(item));
        }

        log.info("Copied {} quality check items from system template to factory: {}", copied.size(), factoryId);
        return copied;
    }

    // ==================== 绑定管理 ====================

    @Override
    @Transactional
    public QualityCheckItemBindingDTO bindToProduct(String factoryId, BindQualityCheckItemRequest request) {
        // 验证质检项存在
        QualityCheckItem item = findByIdAndFactory(request.getQualityCheckItemId(), factoryId);

        // 检查是否已绑定
        if (bindingRepository.existsByProductTypeIdAndQualityCheckItemIdAndDeletedAtIsNull(
                request.getProductTypeId(), request.getQualityCheckItemId())) {
            throw new IllegalArgumentException("该质检项已绑定到此产品");
        }

        QualityCheckItemBinding binding = QualityCheckItemBinding.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .productTypeId(request.getProductTypeId())
                .qualityCheckItemId(request.getQualityCheckItemId())
                .overrideStandardValue(request.getOverrideStandardValue())
                .overrideMinValue(request.getOverrideMinValue())
                .overrideMaxValue(request.getOverrideMaxValue())
                .overrideSamplingRatio(request.getOverrideSamplingRatio())
                .overrideIsRequired(request.getOverrideIsRequired())
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .enabled(request.getEnabled())
                .notes(request.getNotes())
                .build();

        binding = bindingRepository.save(binding);
        log.info("Bound quality check item {} to product {} in factory {}",
                request.getQualityCheckItemId(), request.getProductTypeId(), factoryId);
        return toBindingDTO(binding, item);
    }

    @Override
    @Transactional
    public void unbindFromProduct(String factoryId, String bindingId) {
        QualityCheckItemBinding binding = bindingRepository.findById(bindingId)
                .filter(b -> b.getFactoryId().equals(factoryId) && b.getDeletedAt() == null)
                .orElseThrow(() -> new EntityNotFoundException("绑定不存在: " + bindingId));

        binding.setDeletedAt(LocalDateTime.now());
        bindingRepository.save(binding);
        log.info("Unbound quality check item binding: {}", bindingId);
    }

    @Override
    @Transactional
    public QualityCheckItemBindingDTO updateBinding(String factoryId, String bindingId, BindQualityCheckItemRequest request) {
        QualityCheckItemBinding binding = bindingRepository.findById(bindingId)
                .filter(b -> b.getFactoryId().equals(factoryId) && b.getDeletedAt() == null)
                .orElseThrow(() -> new EntityNotFoundException("绑定不存在: " + bindingId));

        if (request.getOverrideStandardValue() != null) binding.setOverrideStandardValue(request.getOverrideStandardValue());
        if (request.getOverrideMinValue() != null) binding.setOverrideMinValue(request.getOverrideMinValue());
        if (request.getOverrideMaxValue() != null) binding.setOverrideMaxValue(request.getOverrideMaxValue());
        if (request.getOverrideSamplingRatio() != null) binding.setOverrideSamplingRatio(request.getOverrideSamplingRatio());
        if (request.getOverrideIsRequired() != null) binding.setOverrideIsRequired(request.getOverrideIsRequired());
        if (request.getSortOrder() != null) binding.setSortOrder(request.getSortOrder());
        if (request.getEnabled() != null) binding.setEnabled(request.getEnabled());
        if (request.getNotes() != null) binding.setNotes(request.getNotes());

        binding = bindingRepository.save(binding);

        QualityCheckItem item = qualityCheckItemRepository.findById(binding.getQualityCheckItemId())
                .orElse(null);
        return toBindingDTO(binding, item);
    }

    @Override
    public List<QualityCheckItemBindingDTO> getProductBindings(String factoryId, String productTypeId) {
        return bindingRepository.findByProductTypeIdWithItems(productTypeId)
                .stream()
                .filter(b -> b.getFactoryId().equals(factoryId))
                .map(b -> toBindingDTO(b, b.getQualityCheckItem()))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<QualityCheckItemBindingDTO> batchBindToProduct(String factoryId, String productTypeId, List<String> itemIds) {
        List<QualityCheckItemBindingDTO> results = new ArrayList<>();
        for (String itemId : itemIds) {
            if (!bindingRepository.existsByProductTypeIdAndQualityCheckItemIdAndDeletedAtIsNull(productTypeId, itemId)) {
                try {
                    BindQualityCheckItemRequest request = BindQualityCheckItemRequest.builder()
                            .productTypeId(productTypeId)
                            .qualityCheckItemId(itemId)
                            .build();
                    results.add(bindToProduct(factoryId, request));
                } catch (Exception e) {
                    log.warn("Failed to bind item {} to product {}: {}", itemId, productTypeId, e.getMessage());
                }
            }
        }
        return results;
    }

    @Override
    public boolean isBindingExists(String productTypeId, String qualityCheckItemId) {
        return bindingRepository.existsByProductTypeIdAndQualityCheckItemIdAndDeletedAtIsNull(productTypeId, qualityCheckItemId);
    }

    @Override
    public boolean validateCheckValue(String factoryId, String itemId, String productTypeId, Object value) {
        QualityCheckItem item = findByIdAndFactory(itemId, factoryId);

        // 获取生效的配置（考虑产品覆盖）
        BigDecimal minValue = item.getMinValue();
        BigDecimal maxValue = item.getMaxValue();

        if (productTypeId != null) {
            Optional<QualityCheckItemBinding> binding = bindingRepository
                    .findByProductTypeIdAndQualityCheckItemIdAndDeletedAtIsNull(productTypeId, itemId);
            if (binding.isPresent()) {
                QualityCheckItemBinding b = binding.get();
                if (b.getOverrideMinValue() != null) minValue = b.getOverrideMinValue();
                if (b.getOverrideMaxValue() != null) maxValue = b.getOverrideMaxValue();
            }
        }

        // 数值型验证
        if ("NUMERIC".equals(item.getValueType()) || "RANGE".equals(item.getValueType())) {
            BigDecimal numericValue;
            if (value instanceof BigDecimal) {
                numericValue = (BigDecimal) value;
            } else if (value instanceof Number) {
                numericValue = new BigDecimal(value.toString());
            } else if (value instanceof String) {
                try {
                    numericValue = new BigDecimal((String) value);
                } catch (NumberFormatException e) {
                    return false;
                }
            } else {
                return false;
            }

            boolean minOk = minValue == null || numericValue.compareTo(minValue) >= 0;
            boolean maxOk = maxValue == null || numericValue.compareTo(maxValue) <= 0;
            return minOk && maxOk;
        }

        // 布尔型验证
        if ("BOOLEAN".equals(item.getValueType())) {
            return value instanceof Boolean;
        }

        // 文本型总是通过
        return true;
    }

    // ==================== 私有方法 ====================

    private QualityCheckItem findByIdAndFactory(String itemId, String factoryId) {
        return qualityCheckItemRepository.findById(itemId)
                .filter(item -> item.getFactoryId() != null && item.getFactoryId().equals(factoryId) && item.getDeletedAt() == null)
                .orElseThrow(() -> new EntityNotFoundException("质检项不存在: " + itemId));
    }

    private QualityCheckItemDTO toDTO(QualityCheckItem item) {
        long bindingCount = bindingRepository.countByQualityCheckItemIdAndEnabledTrueAndDeletedAtIsNull(item.getId());

        return QualityCheckItemDTO.builder()
                .id(item.getId())
                .factoryId(item.getFactoryId())
                .itemCode(item.getItemCode())
                .itemName(item.getItemName())
                .category(item.getCategory())
                .categoryDescription(item.getCategory() != null ? item.getCategory().getDescription() : null)
                .description(item.getDescription())
                .checkMethod(item.getCheckMethod())
                .standardReference(item.getStandardReference())
                .valueType(item.getValueType())
                .standardValue(item.getStandardValue())
                .minValue(item.getMinValue())
                .maxValue(item.getMaxValue())
                .unit(item.getUnit())
                .tolerance(item.getTolerance())
                .samplingStrategy(item.getSamplingStrategy())
                .samplingStrategyDescription(item.getSamplingStrategy() != null ? item.getSamplingStrategy().getDescription() : null)
                .samplingRatio(item.getSamplingRatio())
                .minSampleSize(item.getMinSampleSize())
                .aqlLevel(item.getAqlLevel())
                .severity(item.getSeverity())
                .severityDescription(item.getSeverity() != null ? item.getSeverity().getDescription() : null)
                .severityWeight(item.getSeverity() != null ? item.getSeverity().getWeight() : null)
                .isRequired(item.getIsRequired())
                .requirePhotoOnFail(item.getRequirePhotoOnFail())
                .requireNoteOnFail(item.getRequireNoteOnFail())
                .sortOrder(item.getSortOrder())
                .enabled(item.getEnabled())
                .version(item.getVersion())
                .bindingCount((int) bindingCount)
                .createdBy(item.getCreatedBy())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }

    private QualityCheckItemBindingDTO toBindingDTO(QualityCheckItemBinding binding, QualityCheckItem item) {
        QualityCheckItemBindingDTO.QualityCheckItemBindingDTOBuilder builder = QualityCheckItemBindingDTO.builder()
                .id(binding.getId())
                .factoryId(binding.getFactoryId())
                .productTypeId(binding.getProductTypeId())
                .qualityCheckItemId(binding.getQualityCheckItemId())
                .overrideStandardValue(binding.getOverrideStandardValue())
                .overrideMinValue(binding.getOverrideMinValue())
                .overrideMaxValue(binding.getOverrideMaxValue())
                .overrideSamplingRatio(binding.getOverrideSamplingRatio())
                .overrideIsRequired(binding.getOverrideIsRequired())
                .sortOrder(binding.getSortOrder())
                .enabled(binding.getEnabled())
                .notes(binding.getNotes())
                .createdAt(binding.getCreatedAt())
                .updatedAt(binding.getUpdatedAt());

        if (item != null) {
            builder.qualityCheckItem(toDTO(item));

            // 计算生效值
            builder.effectiveStandardValue(binding.getOverrideStandardValue() != null ?
                    binding.getOverrideStandardValue() : item.getStandardValue());
            builder.effectiveMinValue(binding.getOverrideMinValue() != null ?
                    binding.getOverrideMinValue() : item.getMinValue());
            builder.effectiveMaxValue(binding.getOverrideMaxValue() != null ?
                    binding.getOverrideMaxValue() : item.getMaxValue());
            builder.effectiveSamplingRatio(binding.getOverrideSamplingRatio() != null ?
                    binding.getOverrideSamplingRatio() : item.getSamplingRatio());
            builder.effectiveIsRequired(binding.getOverrideIsRequired() != null ?
                    binding.getOverrideIsRequired() : item.getIsRequired());
        }

        return builder.build();
    }
}
