package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.ConversionDTO;
import org.springframework.data.domain.Pageable;
import java.math.BigDecimal;
import java.util.List;
/**
 * 转换率管理服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface ConversionService {
    /**
     * 创建转换率配置
     */
    ConversionDTO createConversion(String factoryId, ConversionDTO dto);
     /**
     * 更新转换率配置
      */
    ConversionDTO updateConversion(String factoryId, Integer id, ConversionDTO dto);
     /**
     * 删除转换率配置
      */
    void deleteConversion(String factoryId, Integer id);
     /**
     * 获取转换率详情
      */
    ConversionDTO getConversion(String factoryId, Integer id);
     /**
     * 分页查询转换率配置
      */
    PageResponse<ConversionDTO> getConversions(String factoryId, Boolean isActive, Pageable pageable);
     /**
     * 根据原材料类型获取转换率列表
      */
    List<ConversionDTO> getConversionsByMaterial(String factoryId, String materialTypeId);
     /**
     * 根据产品类型获取转换率列表
      */
    List<ConversionDTO> getConversionsByProduct(String factoryId, String productTypeId);
     /**
     * 获取特定原材料和产品的转换率
      */
    ConversionDTO getConversionRate(String factoryId, String materialTypeId, String productTypeId);
     /**
     * 计算原材料需求量
     * @param factoryId 工厂ID
     * @param productTypeId 产品类型ID
     * @param productQuantity 产品数量
     * @return 所需原材料列表及数量
      */
    List<MaterialRequirement> calculateMaterialRequirement(String factoryId, String productTypeId,
                                                          BigDecimal productQuantity);
     /**
     * 计算产品产出量
     * @param materialTypeId 原材料类型ID
     * @param materialQuantity 原材料数量
     * @return 可产出产品列表及数量
      */
    List<ProductOutput> calculateProductOutput(String factoryId, String materialTypeId,
                                              BigDecimal materialQuantity);
     /**
     * 批量更新激活状态
      */
    void updateActiveStatus(String factoryId, List<Integer> ids, Boolean isActive);
     /**
     * 导入转换率配置
      */
    List<ConversionDTO> importConversions(String factoryId, List<ConversionDTO> conversions);
     /**
     * 导出转换率配置
      */
    List<ConversionDTO> exportConversions(String factoryId);
     /**
     * 验证转换率配置
      */
    ValidationResult validateConversion(String factoryId, ConversionDTO dto);
     /**
     * 获取转换率统计信息
      */
    ConversionStatistics getStatistics(String factoryId);
     /**
     * 原材料需求
      */
    class MaterialRequirement {
        private String materialTypeId;
        private String materialTypeName;
        private BigDecimal quantity;
        private String unit;
        private BigDecimal wastageQuantity;
        private BigDecimal totalQuantity;
        // Getters and setters
        public String getMaterialTypeId() { return materialTypeId; }
        public void setMaterialTypeId(String materialTypeId) { this.materialTypeId = materialTypeId; }
        public String getMaterialTypeName() { return materialTypeName; }
        public void setMaterialTypeName(String materialTypeName) { this.materialTypeName = materialTypeName; }
        public BigDecimal getQuantity() { return quantity; }
        public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
        public String getUnit() { return unit; }
        public void setUnit(String unit) { this.unit = unit; }
        public BigDecimal getWastageQuantity() { return wastageQuantity; }
        public void setWastageQuantity(BigDecimal wastageQuantity) { this.wastageQuantity = wastageQuantity; }
        public BigDecimal getTotalQuantity() { return totalQuantity; }
        public void setTotalQuantity(BigDecimal totalQuantity) { this.totalQuantity = totalQuantity; }
    }
     /**
     * 产品产出
      */
    class ProductOutput {
        private String productTypeId;
        private String productTypeName;
        private BigDecimal quantity;
        private String unit;
        private BigDecimal efficiency;

        public String getProductTypeId() { return productTypeId; }
        public void setProductTypeId(String productTypeId) { this.productTypeId = productTypeId; }
        public String getProductTypeName() { return productTypeName; }
        public void setProductTypeName(String productTypeName) { this.productTypeName = productTypeName; }
        public BigDecimal getQuantity() { return quantity; }
        public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
        public String getUnit() { return unit; }
        public void setUnit(String unit) { this.unit = unit; }
        public BigDecimal getEfficiency() { return efficiency; }
        public void setEfficiency(BigDecimal efficiency) { this.efficiency = efficiency; }
    }

    /**
     * 验证结果
      */
    class ValidationResult {
        private boolean valid;
        private List<String> errors;
        private List<String> warnings;

        public boolean isValid() { return valid; }
        public void setValid(boolean valid) { this.valid = valid; }
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }
        public List<String> getWarnings() { return warnings; }
        public void setWarnings(List<String> warnings) { this.warnings = warnings; }
    }

    /**
     * 转换率统计
      */
    class ConversionStatistics {
        private long totalConversions;
        private long activeConversions;
        private long inactiveConversions;
        private long materialTypes;
        private long productTypes;
        private BigDecimal averageConversionRate;
        private BigDecimal averageWastageRate;

        public long getTotalConversions() { return totalConversions; }
        public void setTotalConversions(long totalConversions) { this.totalConversions = totalConversions; }
        public long getActiveConversions() { return activeConversions; }
        public void setActiveConversions(long activeConversions) { this.activeConversions = activeConversions; }
        public long getInactiveConversions() { return inactiveConversions; }
        public void setInactiveConversions(long inactiveConversions) { this.inactiveConversions = inactiveConversions; }
        public long getMaterialTypes() { return materialTypes; }
        public void setMaterialTypes(long materialTypes) { this.materialTypes = materialTypes; }
        public long getProductTypes() { return productTypes; }
        public void setProductTypes(long productTypes) { this.productTypes = productTypes; }
        public BigDecimal getAverageConversionRate() { return averageConversionRate; }
        public void setAverageConversionRate(BigDecimal averageConversionRate) { this.averageConversionRate = averageConversionRate; }
        public BigDecimal getAverageWastageRate() { return averageWastageRate; }
        public void setAverageWastageRate(BigDecimal averageWastageRate) { this.averageWastageRate = averageWastageRate; }
    }
}
