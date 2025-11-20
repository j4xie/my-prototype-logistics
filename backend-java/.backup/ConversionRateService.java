package com.cretas.aims.service;

import com.cretas.aims.entity.MaterialProductConversion;
import com.cretas.aims.repository.ConversionRateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityNotFoundException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 转化率业务逻辑层
 *
 * 功能:
 * 1. 获取转化率列表（分页、筛选）
 * 2. 创建转化率（唯一性验证）
 * 3. 更新转化率
 * 4. 删除转化率
 * 5. 按原材料/产品查询
 * 6. 计算原材料需求量
 * 7. 计算产品产出量
 * 8. 批量激活/停用
 * 9. 统计信息
 * 10. 导入导出
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 */
@Service
public class ConversionRateService {

    @Autowired
    private ConversionRateRepository repository;

    // ========== 查询功能 ==========

    /**
     * 获取转化率列表（分页）
     */
    public Page<MaterialProductConversion> getConversionRates(String factoryId, int page, int size,
                                                                String sortBy, String sortDirection) {
        Sort.Direction direction = "ASC".equalsIgnoreCase(sortDirection) ?
                Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = Sort.by(direction, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        return repository.findByFactoryId(factoryId, pageable);
    }

    /**
     * 按ID获取转化率
     */
    public MaterialProductConversion getConversionRateById(String factoryId, String id) {
        return repository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new EntityNotFoundException("转化率配置不存在: " + id));
    }

    /**
     * 按原材料类型ID获取转化率列表
     */
    public List<MaterialProductConversion> getConversionsByMaterial(String factoryId, String materialTypeId) {
        return repository.findByFactoryIdAndMaterialTypeIdAndIsActive(factoryId, materialTypeId, true);
    }

    /**
     * 按产品类型ID获取转化率列表
     */
    public List<MaterialProductConversion> getConversionsByProduct(String factoryId, String productTypeId) {
        return repository.findByFactoryIdAndProductTypeIdAndIsActive(factoryId, productTypeId, true);
    }

    /**
     * 获取特定原材料和产品的转化率
     */
    public MaterialProductConversion getSpecificConversionRate(String factoryId, String materialTypeId, String productTypeId) {
        return repository.findByFactoryIdAndMaterialTypeIdAndProductTypeId(factoryId, materialTypeId, productTypeId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "未找到转化率配置: materialTypeId=" + materialTypeId + ", productTypeId=" + productTypeId));
    }

    // ========== 创建和更新 ==========

    /**
     * 创建转化率
     */
    @Transactional
    public MaterialProductConversion createConversionRate(MaterialProductConversion conversionRate) {
        // 验证唯一性
        if (repository.existsByMaterialTypeIdAndProductTypeId(
                conversionRate.getMaterialTypeId(), conversionRate.getProductTypeId())) {
            throw new IllegalArgumentException("该原材料和产品的转化率配置已存在");
        }

        // 验证转化率范围（0-100%）
        validateConversionRate(conversionRate);

        return repository.save(conversionRate);
    }

    /**
     * 更新转化率
     */
    @Transactional
    public MaterialProductConversion updateConversionRate(String factoryId, String id, MaterialProductConversion updateData) {
        MaterialProductConversion existing = getConversionRateById(factoryId, id);

        // 检查是否修改了原材料或产品类型（需验证唯一性）
        if (updateData.getMaterialTypeId() != null && !updateData.getMaterialTypeId().equals(existing.getMaterialTypeId()) ||
            updateData.getProductTypeId() != null && !updateData.getProductTypeId().equals(existing.getProductTypeId())) {

            String newMaterialId = updateData.getMaterialTypeId() != null ? updateData.getMaterialTypeId() : existing.getMaterialTypeId();
            String newProductId = updateData.getProductTypeId() != null ? updateData.getProductTypeId() : existing.getProductTypeId();

            if (repository.existsByMaterialAndProductExcludingId(newMaterialId, newProductId, id)) {
                throw new IllegalArgumentException("该原材料和产品的转化率配置已存在");
            }

            existing.setMaterialTypeId(newMaterialId);
            existing.setProductTypeId(newProductId);
        }

        if (updateData.getConversionRate() != null) {
            existing.setConversionRate(updateData.getConversionRate());
        }
        if (updateData.getWastageRate() != null) {
            existing.setWastageRate(updateData.getWastageRate());
        }
        if (updateData.getNotes() != null) {
            existing.setNotes(updateData.getNotes());
        }
        if (updateData.getIsActive() != null) {
            existing.setIsActive(updateData.getIsActive());
        }

        // 验证转化率范围
        validateConversionRate(existing);

        return repository.save(existing);
    }

    /**
     * 删除转化率
     */
    @Transactional
    public void deleteConversionRate(String factoryId, String id) {
        if (!repository.existsById(id)) {
            throw new EntityNotFoundException("转化率配置不存在: " + id);
        }
        repository.deleteByFactoryIdAndId(factoryId, id);
    }

    // ========== 计算功能 ==========

    /**
     * 计算原材料需求量
     * 公式: 原材料需求 = 产品数量 / (转化率 × (1 - 损耗率))
     */
    public MaterialRequirementResult calculateMaterialRequirement(String factoryId, String productTypeId, BigDecimal productQuantity) {
        // 获取该产品的所有转化率配置
        List<MaterialProductConversion> conversions = repository.findByFactoryIdAndProductTypeIdAndIsActive(
                factoryId, productTypeId, true);

        if (conversions.isEmpty()) {
            throw new EntityNotFoundException("未找到产品类型 " + productTypeId + " 的转化率配置");
        }

        List<MaterialRequirement> requirements = new ArrayList<>();
        for (MaterialProductConversion conversion : conversions) {
            BigDecimal conversionRate = conversion.getConversionRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            BigDecimal wastageRate = conversion.getWastageRate() != null ?
                    conversion.getWastageRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP) :
                    BigDecimal.ZERO;

            // 计算有效转化率 = 转化率 × (1 - 损耗率)
            BigDecimal effectiveRate = conversionRate.multiply(BigDecimal.ONE.subtract(wastageRate));

            // 计算原材料需求量
            BigDecimal requiredQuantity = productQuantity.divide(effectiveRate, 2, RoundingMode.HALF_UP);

            requirements.add(new MaterialRequirement(
                    conversion.getMaterialTypeId(),
                    requiredQuantity,
                    conversion.getConversionRate(),
                    conversion.getWastageRate()
            ));
        }

        return new MaterialRequirementResult(productTypeId, productQuantity, requirements);
    }

    /**
     * 计算产品产出量
     * 公式: 产品产出 = 原材料数量 × 转化率 × (1 - 损耗率)
     */
    public ProductOutputResult calculateProductOutput(String factoryId, String materialTypeId, BigDecimal materialQuantity) {
        // 获取该原材料的所有转化率配置
        List<MaterialProductConversion> conversions = repository.findByFactoryIdAndMaterialTypeIdAndIsActive(
                factoryId, materialTypeId, true);

        if (conversions.isEmpty()) {
            throw new EntityNotFoundException("未找到原材料类型 " + materialTypeId + " 的转化率配置");
        }

        List<ProductOutput> outputs = new ArrayList<>();
        for (MaterialProductConversion conversion : conversions) {
            BigDecimal conversionRate = conversion.getConversionRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            BigDecimal wastageRate = conversion.getWastageRate() != null ?
                    conversion.getWastageRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP) :
                    BigDecimal.ZERO;

            // 计算有效转化率 = 转化率 × (1 - 损耗率)
            BigDecimal effectiveRate = conversionRate.multiply(BigDecimal.ONE.subtract(wastageRate));

            // 计算产品产出量
            BigDecimal outputQuantity = materialQuantity.multiply(effectiveRate).setScale(2, RoundingMode.HALF_UP);

            outputs.add(new ProductOutput(
                    conversion.getProductTypeId(),
                    outputQuantity,
                    conversion.getConversionRate(),
                    conversion.getWastageRate()
            ));
        }

        return new ProductOutputResult(materialTypeId, materialQuantity, outputs);
    }

    // ========== 验证和批量操作 ==========

    /**
     * 验证转化率配置
     */
    private void validateConversionRate(MaterialProductConversion conversion) {
        if (conversion.getConversionRate().compareTo(BigDecimal.ZERO) <= 0 ||
            conversion.getConversionRate().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException("转化率必须在0-100之间");
        }

        if (conversion.getWastageRate() != null &&
            (conversion.getWastageRate().compareTo(BigDecimal.ZERO) < 0 ||
             conversion.getWastageRate().compareTo(BigDecimal.valueOf(100)) >= 0)) {
            throw new IllegalArgumentException("损耗率必须在0-100之间");
        }
    }

    /**
     * 批量激活/停用转化率
     */
    @Transactional
    public BatchActivateResult batchActivate(String factoryId, List<String> ids, Boolean isActive) {
        int successCount = 0;
        int failedCount = 0;
        List<String> errors = new ArrayList<>();

        for (String id : ids) {
            try {
                MaterialProductConversion conversion = getConversionRateById(factoryId, id);
                conversion.setIsActive(isActive);
                repository.save(conversion);
                successCount++;
            } catch (Exception e) {
                failedCount++;
                errors.add("ID " + id + ": " + e.getMessage());
            }
        }

        return new BatchActivateResult(successCount, failedCount, errors);
    }

    // ========== 统计功能 ==========

    /**
     * 获取转化率统计信息
     */
    public ConversionStatistics getStatistics(String factoryId) {
        long totalCount = repository.countByFactoryId(factoryId);
        long activeCount = repository.countByFactoryIdAndIsActive(factoryId, true);
        long inactiveCount = repository.countByFactoryIdAndIsActive(factoryId, false);

        Double avgConversionRate = repository.getAverageConversionRate(factoryId);
        Double avgWastageRate = repository.getAverageWastageRate(factoryId);

        return new ConversionStatistics(
                totalCount,
                activeCount,
                inactiveCount,
                avgConversionRate != null ? BigDecimal.valueOf(avgConversionRate).setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO,
                avgWastageRate != null ? BigDecimal.valueOf(avgWastageRate).setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO
        );
    }

    /**
     * 导出转化率列表
     */
    public List<MaterialProductConversion> exportConversionRates(String factoryId) {
        return repository.findByFactoryId(factoryId);
    }

    // ========== 内部类 ==========

    /**
     * 原材料需求
     */
    public static class MaterialRequirement {
        private String materialTypeId;
        private BigDecimal requiredQuantity;
        private BigDecimal conversionRate;
        private BigDecimal wastageRate;

        public MaterialRequirement(String materialTypeId, BigDecimal requiredQuantity,
                                    BigDecimal conversionRate, BigDecimal wastageRate) {
            this.materialTypeId = materialTypeId;
            this.requiredQuantity = requiredQuantity;
            this.conversionRate = conversionRate;
            this.wastageRate = wastageRate;
        }

        public String getMaterialTypeId() { return materialTypeId; }
        public BigDecimal getRequiredQuantity() { return requiredQuantity; }
        public BigDecimal getConversionRate() { return conversionRate; }
        public BigDecimal getWastageRate() { return wastageRate; }
    }

    /**
     * 原材料需求计算结果
     */
    public static class MaterialRequirementResult {
        private String productTypeId;
        private BigDecimal productQuantity;
        private List<MaterialRequirement> requirements;

        public MaterialRequirementResult(String productTypeId, BigDecimal productQuantity,
                                          List<MaterialRequirement> requirements) {
            this.productTypeId = productTypeId;
            this.productQuantity = productQuantity;
            this.requirements = requirements;
        }

        public String getProductTypeId() { return productTypeId; }
        public BigDecimal getProductQuantity() { return productQuantity; }
        public List<MaterialRequirement> getRequirements() { return requirements; }
    }

    /**
     * 产品产出
     */
    public static class ProductOutput {
        private String productTypeId;
        private BigDecimal outputQuantity;
        private BigDecimal conversionRate;
        private BigDecimal wastageRate;

        public ProductOutput(String productTypeId, BigDecimal outputQuantity,
                             BigDecimal conversionRate, BigDecimal wastageRate) {
            this.productTypeId = productTypeId;
            this.outputQuantity = outputQuantity;
            this.conversionRate = conversionRate;
            this.wastageRate = wastageRate;
        }

        public String getProductTypeId() { return productTypeId; }
        public BigDecimal getOutputQuantity() { return outputQuantity; }
        public BigDecimal getConversionRate() { return conversionRate; }
        public BigDecimal getWastageRate() { return wastageRate; }
    }

    /**
     * 产品产出计算结果
     */
    public static class ProductOutputResult {
        private String materialTypeId;
        private BigDecimal materialQuantity;
        private List<ProductOutput> outputs;

        public ProductOutputResult(String materialTypeId, BigDecimal materialQuantity,
                                    List<ProductOutput> outputs) {
            this.materialTypeId = materialTypeId;
            this.materialQuantity = materialQuantity;
            this.outputs = outputs;
        }

        public String getMaterialTypeId() { return materialTypeId; }
        public BigDecimal getMaterialQuantity() { return materialQuantity; }
        public List<ProductOutput> getOutputs() { return outputs; }
    }

    /**
     * 批量激活结果
     */
    public static class BatchActivateResult {
        private int success;
        private int failed;
        private List<String> errors;

        public BatchActivateResult(int success, int failed, List<String> errors) {
            this.success = success;
            this.failed = failed;
            this.errors = errors;
        }

        public int getSuccess() { return success; }
        public int getFailed() { return failed; }
        public List<String> getErrors() { return errors; }
    }

    /**
     * 统计信息
     */
    public static class ConversionStatistics {
        private long totalCount;
        private long activeCount;
        private long inactiveCount;
        private BigDecimal averageConversionRate;
        private BigDecimal averageWastageRate;

        public ConversionStatistics(long totalCount, long activeCount, long inactiveCount,
                                     BigDecimal averageConversionRate, BigDecimal averageWastageRate) {
            this.totalCount = totalCount;
            this.activeCount = activeCount;
            this.inactiveCount = inactiveCount;
            this.averageConversionRate = averageConversionRate;
            this.averageWastageRate = averageWastageRate;
        }

        public long getTotalCount() { return totalCount; }
        public long getActiveCount() { return activeCount; }
        public long getInactiveCount() { return inactiveCount; }
        public BigDecimal getAverageConversionRate() { return averageConversionRate; }
        public BigDecimal getAverageWastageRate() { return averageWastageRate; }
    }
}
