package com.cretas.aims.controller;

import com.cretas.aims.dto.ai.AIBusinessDataRequest;
import com.cretas.aims.dto.ai.AIBusinessDataResponse;
import com.cretas.aims.entity.MaterialProductConversion;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.repository.ConversionRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

/**
 * AI 业务数据初始化控制器
 * 用于将 AI 生成的业务数据建议持久化到数据库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/ai/business-data")
@RequiredArgsConstructor
public class AIBusinessDataController {

    private final ProductTypeRepository productTypeRepository;
    private final RawMaterialTypeRepository rawMaterialTypeRepository;
    private final ConversionRepository conversionRepository;

    /**
     * 初始化业务数据
     * 根据 AI 建议的数据创建产品类型、原材料类型和转换率配置
     *
     * @param factoryId 工厂ID
     * @param request   AI 建议的业务数据
     * @param userId    当前用户ID (从 JWT 中获取)
     * @return 创建结果统计
     */
    @PostMapping("/initialize")
    public ResponseEntity<AIBusinessDataResponse> initializeBusinessData(
            @PathVariable String factoryId,
            @RequestBody AIBusinessDataRequest request,
            @RequestAttribute("userId") Long userId) {

        log.info("开始 AI 业务数据初始化 - 工厂: {}, 用户: {}", factoryId, userId);

        try {
            // 创建结果统计
            int productTypesCreated = 0;
            int productTypesSkipped = 0;
            int materialTypesCreated = 0;
            int materialTypesSkipped = 0;
            int conversionsCreated = 0;
            int conversionsSkipped = 0;

            List<String> createdProductTypeIds = new ArrayList<>();
            List<String> createdMaterialTypeIds = new ArrayList<>();
            List<String> createdConversionIds = new ArrayList<>();

            // 用于存储 code -> id 的映射，后续创建转换率时使用
            Map<String, String> productTypeCodeToId = new HashMap<>();
            Map<String, String> materialTypeCodeToId = new HashMap<>();

            // 1. 创建产品类型
            if (request.getProductTypes() != null) {
                for (AIBusinessDataRequest.ProductTypeData ptData : request.getProductTypes()) {
                    // 检查是否已存在
                    if (productTypeRepository.existsByFactoryIdAndCode(factoryId, ptData.getCode())) {
                        log.info("产品类型已存在，跳过: {}", ptData.getCode());
                        productTypesSkipped++;
                        // 获取已有的 ID 用于转换率创建
                        productTypeRepository.findByFactoryIdAndCode(factoryId, ptData.getCode())
                                .ifPresent(pt -> productTypeCodeToId.put(ptData.getCode(), pt.getId()));
                        continue;
                    }

                    // 创建新产品类型
                    ProductType productType = new ProductType();
                    productType.setId(UUID.randomUUID().toString());
                    productType.setFactoryId(factoryId);
                    productType.setCode(ptData.getCode());
                    productType.setName(ptData.getName());
                    productType.setCategory(ptData.getCategory() != null ? ptData.getCategory() : "通用");
                    productType.setUnit(ptData.getUnit() != null ? ptData.getUnit() : "kg");
                    productType.setNotes(ptData.getDescription());
                    productType.setProductionTimeMinutes(ptData.getProductionTimeMinutes());
                    productType.setShelfLifeDays(ptData.getShelfLifeDays());
                    productType.setIsActive(true);
                    productType.setCreatedBy(userId);

                    ProductType saved = productTypeRepository.save(productType);
                    createdProductTypeIds.add(saved.getId());
                    productTypeCodeToId.put(ptData.getCode(), saved.getId());
                    productTypesCreated++;
                    log.info("创建产品类型: {} - {}", ptData.getCode(), ptData.getName());
                }
            }

            // 2. 创建原材料类型
            if (request.getMaterialTypes() != null) {
                for (AIBusinessDataRequest.MaterialTypeData mtData : request.getMaterialTypes()) {
                    // 检查是否已存在
                    if (rawMaterialTypeRepository.existsByFactoryIdAndCode(factoryId, mtData.getCode())) {
                        log.info("原材料类型已存在，跳过: {}", mtData.getCode());
                        materialTypesSkipped++;
                        // 获取已有的 ID 用于转换率创建
                        rawMaterialTypeRepository.findByFactoryIdAndCode(factoryId, mtData.getCode())
                                .ifPresent(mt -> materialTypeCodeToId.put(mtData.getCode(), mt.getId()));
                        continue;
                    }

                    // 创建新原材料类型
                    RawMaterialType materialType = new RawMaterialType();
                    materialType.setId(UUID.randomUUID().toString());
                    materialType.setFactoryId(factoryId);
                    materialType.setCode(mtData.getCode());
                    materialType.setName(mtData.getName());
                    materialType.setCategory(mtData.getCategory() != null ? mtData.getCategory() : "通用");
                    materialType.setUnit(mtData.getUnit() != null ? mtData.getUnit() : "kg");
                    materialType.setStorageType(mtData.getStorageType() != null ? mtData.getStorageType() : "frozen");
                    materialType.setShelfLifeDays(mtData.getShelfLifeDays());
                    materialType.setNotes(mtData.getDescription());
                    materialType.setIsActive(true);
                    materialType.setCreatedBy(userId);

                    RawMaterialType saved = rawMaterialTypeRepository.save(materialType);
                    createdMaterialTypeIds.add(saved.getId());
                    materialTypeCodeToId.put(mtData.getCode(), saved.getId());
                    materialTypesCreated++;
                    log.info("创建原材料类型: {} - {}", mtData.getCode(), mtData.getName());
                }
            }

            // 3. 创建转换率配置
            if (request.getConversionRates() != null) {
                for (AIBusinessDataRequest.ConversionRateData crData : request.getConversionRates()) {
                    // 查找对应的产品类型和原材料类型 ID
                    String productTypeId = productTypeCodeToId.get(crData.getProductTypeCode());
                    String materialTypeId = materialTypeCodeToId.get(crData.getMaterialTypeCode());

                    if (productTypeId == null || materialTypeId == null) {
                        log.warn("转换率配置缺少关联类型: 产品={}, 原材料={}",
                                crData.getProductTypeCode(), crData.getMaterialTypeCode());
                        conversionsSkipped++;
                        continue;
                    }

                    // 检查是否已存在
                    if (conversionRepository.existsByFactoryIdAndMaterialTypeIdAndProductTypeId(
                            factoryId, materialTypeId, productTypeId)) {
                        log.info("转换率配置已存在，跳过: {} -> {}", crData.getMaterialTypeCode(), crData.getProductTypeCode());
                        conversionsSkipped++;
                        continue;
                    }

                    // 创建新转换率配置
                    MaterialProductConversion conversion = new MaterialProductConversion();
                    conversion.setId(UUID.randomUUID().toString());
                    conversion.setFactoryId(factoryId);
                    conversion.setMaterialTypeId(materialTypeId);
                    conversion.setProductTypeId(productTypeId);
                    conversion.setConversionRate(BigDecimal.valueOf(crData.getRate() != null ? crData.getRate() : 1.0));
                    conversion.setWastageRate(BigDecimal.valueOf(crData.getWastageRate() != null ? crData.getWastageRate() : 0.0));
                    conversion.setNotes(crData.getDescription());
                    conversion.setIsActive(true);
                    conversion.setCreatedBy(userId);

                    MaterialProductConversion saved = conversionRepository.save(conversion);
                    createdConversionIds.add(saved.getId());
                    conversionsCreated++;
                    log.info("创建转换率配置: {} -> {}, 转换率: {}",
                            crData.getMaterialTypeCode(), crData.getProductTypeCode(), crData.getRate());
                }
            }

            // 构建响应
            AIBusinessDataResponse.CreationStats stats = AIBusinessDataResponse.CreationStats.builder()
                    .productTypesCreated(productTypesCreated)
                    .productTypesSkipped(productTypesSkipped)
                    .materialTypesCreated(materialTypesCreated)
                    .materialTypesSkipped(materialTypesSkipped)
                    .conversionsCreated(conversionsCreated)
                    .conversionsSkipped(conversionsSkipped)
                    .build();

            AIBusinessDataResponse response = AIBusinessDataResponse.builder()
                    .success(true)
                    .message(String.format("初始化完成: 创建 %d 个产品类型, %d 个原材料类型, %d 个转换率配置",
                            productTypesCreated, materialTypesCreated, conversionsCreated))
                    .stats(stats)
                    .createdProductTypeIds(createdProductTypeIds)
                    .createdMaterialTypeIds(createdMaterialTypeIds)
                    .createdConversionIds(createdConversionIds)
                    .build();

            log.info("AI 业务数据初始化完成 - 工厂: {}, 统计: {}", factoryId, stats);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("AI 业务数据初始化失败 - 工厂: {}", factoryId, e);
            return ResponseEntity.ok(AIBusinessDataResponse.builder()
                    .success(false)
                    .message("初始化失败: " + e.getMessage())
                    .build());
        }
    }

    /**
     * 预览业务数据
     * 检查哪些数据会被创建，哪些会被跳过
     *
     * @param factoryId 工厂ID
     * @param request   AI 建议的业务数据
     * @return 预览结果
     */
    @PostMapping("/preview")
    public ResponseEntity<Map<String, Object>> previewBusinessData(
            @PathVariable String factoryId,
            @RequestBody AIBusinessDataRequest request) {

        log.info("预览 AI 业务数据 - 工厂: {}", factoryId);

        Map<String, Object> preview = new HashMap<>();

        // 产品类型预览
        List<Map<String, Object>> productTypePreview = new ArrayList<>();
        if (request.getProductTypes() != null) {
            for (AIBusinessDataRequest.ProductTypeData ptData : request.getProductTypes()) {
                Map<String, Object> item = new HashMap<>();
                item.put("code", ptData.getCode());
                item.put("name", ptData.getName());
                item.put("exists", productTypeRepository.existsByFactoryIdAndCode(factoryId, ptData.getCode()));
                productTypePreview.add(item);
            }
        }
        preview.put("productTypes", productTypePreview);

        // 原材料类型预览
        List<Map<String, Object>> materialTypePreview = new ArrayList<>();
        if (request.getMaterialTypes() != null) {
            for (AIBusinessDataRequest.MaterialTypeData mtData : request.getMaterialTypes()) {
                Map<String, Object> item = new HashMap<>();
                item.put("code", mtData.getCode());
                item.put("name", mtData.getName());
                item.put("exists", rawMaterialTypeRepository.existsByFactoryIdAndCode(factoryId, mtData.getCode()));
                materialTypePreview.add(item);
            }
        }
        preview.put("materialTypes", materialTypePreview);

        // 统计
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalProductTypes", request.getProductTypes() != null ? request.getProductTypes().size() : 0);
        stats.put("totalMaterialTypes", request.getMaterialTypes() != null ? request.getMaterialTypes().size() : 0);
        stats.put("totalConversions", request.getConversionRates() != null ? request.getConversionRates().size() : 0);
        preview.put("stats", stats);

        return ResponseEntity.ok(preview);
    }
}
