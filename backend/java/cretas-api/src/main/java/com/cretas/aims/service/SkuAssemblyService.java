package com.cretas.aims.service;

import com.cretas.aims.entity.Customer;
import com.cretas.aims.entity.MaterialProductConversion;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import java.time.LocalDateTime;
import com.cretas.aims.repository.ConversionRepository;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * SKU 组装服务
 *
 * 拼积木模式: 产品模板 + 客户 + 配方版本 → SKU
 *
 * - 模板: ProductType where templateId IS NULL
 * - SKU:  ProductType where templateId IS NOT NULL
 * - 配方: 创建SKU时从模板的 MaterialProductConversion 复制
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SkuAssemblyService {

    private final ProductTypeRepository productTypeRepository;
    private final CustomerRepository customerRepository;
    private final ConversionRepository conversionRepository;

    /**
     * 拼积木创建 SKU
     *
     * @param factoryId 工厂ID
     * @param templateId 产品模板ID (ProductType where templateId=null)
     * @param customerId 客户ID (可选, 六扇门必填)
     * @param recipeVersion 配方版本 (默认 "default")
     * @param recipeModifications 配方修改 (可选): {materialTypeId: {conversionRate, wastageRate}}
     * @param userId 操作人
     * @return 创建的 SKU
     */
    @Transactional
    public ProductType assemblesku(String factoryId, String templateId, String customerId,
                                    String recipeVersion, Map<String, Map<String, Object>> recipeModifications,
                                    Long userId) {

        // 1. 加载并验证模板
        ProductType template = productTypeRepository.findById(templateId)
                .orElseThrow(() -> new ResourceNotFoundException("产品模板不存在: " + templateId));

        if (template.getTemplateId() != null) {
            throw new BusinessException("不能从 SKU 创建 SKU，请选择产品模板");
        }

        // 2. 加载客户 (可选)
        Customer customer = null;
        if (customerId != null && !customerId.isBlank()) {
            customer = customerRepository.findById(customerId)
                    .orElseThrow(() -> new ResourceNotFoundException("客户不存在: " + customerId));
        }

        // 3. 生成 SKU 编码
        String skuCode = generateSkuCode(template, customer, recipeVersion);

        // 检查编码唯一性
        if (productTypeRepository.existsByFactoryIdAndCode(factoryId, skuCode)) {
            throw new BusinessException("SKU编码已存在: " + skuCode + "，该客户+产品+配方的SKU可能已创建");
        }

        // 4. 克隆模板为 SKU
        ProductType sku = new ProductType();
        sku.setId(UUID.randomUUID().toString());
        sku.setFactoryId(factoryId);
        sku.setCode(skuCode);
        sku.setName(buildSkuName(template, customer));
        sku.setCategory(template.getCategory());
        sku.setUnit(template.getUnit());
        sku.setUnitPrice(template.getUnitPrice());
        sku.setProductionTimeMinutes(template.getProductionTimeMinutes());
        sku.setShelfLifeDays(template.getShelfLifeDays());
        sku.setProductCategory(template.getProductCategory());
        sku.setSpecification(template.getSpecification());
        sku.setPackageSpec(template.getPackageSpec());
        sku.setImageUrl(template.getImageUrl());
        sku.setIsActive(true);
        sku.setCreatedBy(userId);

        // SKU 特有字段
        sku.setTemplateId(templateId);
        sku.setCustomerId(customerId);
        sku.setRecipeVersion(recipeVersion != null ? recipeVersion : "default");
        sku.setRelatedCustomer(customer != null ? customer.getName() : null);

        productTypeRepository.save(sku);
        log.info("SKU创建成功: code={}, template={}, customer={}", skuCode, template.getCode(), customerId);

        // 5. 复制配方 (MaterialProductConversion)
        copyRecipe(factoryId, templateId, sku.getId(), recipeModifications);

        return sku;
    }

    /**
     * 查询产品模板列表 (templateId IS NULL)
     */
    public List<ProductType> getTemplates(String factoryId) {
        return productTypeRepository.findByFactoryIdAndTemplateIdIsNullAndIsActiveTrue(factoryId);
    }

    /**
     * 查询某模板下的所有SKU
     */
    public List<ProductType> getSkusByTemplate(String factoryId, String templateId) {
        return productTypeRepository.findByFactoryIdAndTemplateIdAndIsActiveTrue(factoryId, templateId);
    }

    // ==================== 内部方法 ====================

    private String generateSkuCode(ProductType template, Customer customer, String version) {
        String customerPart = customer != null ? customer.getName() : "通用";
        // 截取关键部分避免过长
        if (customerPart.length() > 6) customerPart = customerPart.substring(0, 6);
        String templatePart = template.getName();
        if (templatePart.length() > 10) templatePart = templatePart.substring(0, 10);

        String base = String.format("CP-%s-%s", customerPart, templatePart);
        if (version != null && !"default".equals(version)) {
            base += "-" + version;
        }
        return base;
    }

    private String buildSkuName(ProductType template, Customer customer) {
        if (customer != null) {
            return String.format("%s (%s)", template.getName(), customer.getName());
        }
        return template.getName();
    }

    private void copyRecipe(String factoryId, String templateId, String skuId,
                            Map<String, Map<String, Object>> modifications) {
        List<MaterialProductConversion> templateRecipes =
                conversionRepository.findByFactoryIdAndProductTypeId(factoryId, templateId);

        for (MaterialProductConversion source : templateRecipes) {
            if (!Boolean.TRUE.equals(source.getIsActive())) continue;

            MaterialProductConversion copy = new MaterialProductConversion();
            copy.setId(UUID.randomUUID().toString());
            copy.setFactoryId(factoryId);
            copy.setProductTypeId(skuId); // 指向新 SKU
            copy.setMaterialTypeId(source.getMaterialTypeId());
            copy.setConversionRate(source.getConversionRate());
            copy.setWastageRate(source.getWastageRate());
            copy.setStandardUsage(source.getStandardUsage());
            copy.setMinBatchSize(source.getMinBatchSize());
            copy.setMaxBatchSize(source.getMaxBatchSize());
            copy.setIsActive(true);
            copy.setCreatedAt(LocalDateTime.now());
            copy.setUpdatedAt(LocalDateTime.now());
            copy.setNotes("从模板复制: " + templateId);

            // 应用配方修改 (如果有)
            if (modifications != null && modifications.containsKey(source.getMaterialTypeId())) {
                Map<String, Object> mod = modifications.get(source.getMaterialTypeId());
                if (mod.containsKey("conversionRate")) {
                    copy.setConversionRate(new BigDecimal(mod.get("conversionRate").toString()));
                    // 重新计算 standardUsage
                    if (copy.getConversionRate().compareTo(BigDecimal.ZERO) > 0) {
                        copy.setStandardUsage(BigDecimal.ONE.divide(copy.getConversionRate(), 4, BigDecimal.ROUND_HALF_UP));
                    }
                }
                if (mod.containsKey("wastageRate")) {
                    copy.setWastageRate(new BigDecimal(mod.get("wastageRate").toString()));
                }
                copy.setNotes("从模板复制(已修改): " + templateId);
            }

            conversionRepository.save(copy);
        }

        log.info("配方复制完成: template={} → sku={}, recipes={}", templateId, skuId, templateRecipes.size());
    }
}
