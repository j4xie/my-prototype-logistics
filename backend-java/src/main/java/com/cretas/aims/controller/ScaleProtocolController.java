package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.scale.ScaleBrandModelDTO;
import com.cretas.aims.dto.scale.ScaleProtocolDTO;
import com.cretas.aims.entity.scale.ScaleBrandModel;
import com.cretas.aims.entity.scale.ScaleProtocolConfig;
import com.cretas.aims.repository.ScaleBrandModelRepository;
import com.cretas.aims.repository.ScaleProtocolConfigRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 秤协议管理控制器
 *
 * 提供秤协议配置和品牌型号的管理接口
 * 协议配置为全局共享资源，由平台管理员管理
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/scale-protocols")
@Tag(name = "秤协议管理", description = "管理电子秤通信协议和品牌型号")
@RequiredArgsConstructor
public class ScaleProtocolController {

    private final ScaleProtocolConfigRepository protocolRepository;
    private final ScaleBrandModelRepository brandModelRepository;

    // ==================== 协议列表查询 ====================

    @GetMapping
    @Operation(summary = "获取协议列表", description = "获取所有可用的秤协议配置")
    public ApiResponse<List<ScaleProtocolDTO>> getProtocols(
            @RequestParam(required = false) @Parameter(description = "工厂ID（可选，用于获取工厂专属协议）") String factoryId,
            @RequestParam(required = false) @Parameter(description = "连接类型") String connectionType,
            @RequestParam(required = false) @Parameter(description = "仅显示已验证") Boolean verifiedOnly,
            @RequestParam(required = false) @Parameter(description = "仅显示启用") Boolean activeOnly) {

        log.info("获取协议列表: factoryId={}, connectionType={}", factoryId, connectionType);

        List<ScaleProtocolConfig> protocols;

        if (factoryId != null) {
            protocols = protocolRepository.findAvailableProtocols(factoryId);
        } else if (Boolean.TRUE.equals(activeOnly)) {
            protocols = protocolRepository.findByIsActiveTrue();
        } else if (Boolean.TRUE.equals(verifiedOnly)) {
            protocols = protocolRepository.findByIsVerifiedTrue();
        } else {
            protocols = protocolRepository.findAll();
        }

        // 连接类型过滤
        if (connectionType != null && !connectionType.isEmpty()) {
            try {
                ScaleProtocolConfig.ConnectionType type = ScaleProtocolConfig.ConnectionType.valueOf(connectionType);
                protocols = protocols.stream()
                        .filter(p -> p.getConnectionType() == type)
                        .collect(Collectors.toList());
            } catch (IllegalArgumentException e) {
                log.warn("无效的连接类型: {}", connectionType);
            }
        }

        List<ScaleProtocolDTO> dtos = protocols.stream()
                .map(ScaleProtocolDTO::fromEntity)
                .collect(Collectors.toList());

        return ApiResponse.success(dtos);
    }

    // ==================== 协议详情 ====================

    @GetMapping("/{protocolId}")
    @Operation(summary = "获取协议详情", description = "获取指定协议的详细配置")
    public ApiResponse<ScaleProtocolDTO> getProtocol(
            @PathVariable @Parameter(description = "协议ID") String protocolId) {

        log.info("获取协议详情: protocolId={}", protocolId);

        ScaleProtocolConfig protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "协议不存在"));

        return ApiResponse.success(ScaleProtocolDTO.fromEntity(protocol));
    }

    // ==================== 创建协议 ====================

    @PostMapping
    @Operation(summary = "创建协议", description = "创建新的秤协议配置（平台管理员）")
    public ApiResponse<ScaleProtocolDTO> createProtocol(
            @RequestBody @Valid ProtocolCreateRequest request) {

        log.info("创建协议: code={}, name={}", request.getProtocolCode(), request.getProtocolName());

        // 检查协议编码是否已存在
        if (protocolRepository.existsByProtocolCode(request.getProtocolCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "协议编码已存在: " + request.getProtocolCode());
        }

        ScaleProtocolConfig protocol = new ScaleProtocolConfig();
        protocol.setId(UUID.randomUUID().toString());
        protocol.setProtocolCode(request.getProtocolCode());
        protocol.setProtocolName(request.getProtocolName());
        protocol.setConnectionType(ScaleProtocolConfig.ConnectionType.valueOf(request.getConnectionType()));
        protocol.setSerialConfig(request.getSerialConfig());
        protocol.setApiConfig(request.getApiConfig());
        protocol.setFrameFormat(request.getFrameFormat());
        protocol.setParsingRuleGroup(request.getParsingRuleGroup());
        protocol.setChecksumType(request.getChecksumType() != null ?
                ScaleProtocolConfig.ChecksumType.valueOf(request.getChecksumType()) :
                ScaleProtocolConfig.ChecksumType.NONE);
        protocol.setReadMode(request.getReadMode() != null ?
                ScaleProtocolConfig.ReadMode.valueOf(request.getReadMode()) :
                ScaleProtocolConfig.ReadMode.CONTINUOUS);
        protocol.setStableThresholdMs(request.getStableThresholdMs() != null ? request.getStableThresholdMs() : 500);
        protocol.setModbusConfig(request.getModbusConfig());
        protocol.setDocumentationUrl(request.getDocumentationUrl());
        protocol.setSampleDataHex(request.getSampleDataHex());
        protocol.setDescription(request.getDescription());
        protocol.setFactoryId(request.getFactoryId());
        protocol.setIsActive(true);
        protocol.setIsVerified(false);
        protocol.setIsBuiltin(false);

        protocol = protocolRepository.save(protocol);

        log.info("协议创建成功: id={}, code={}", protocol.getId(), protocol.getProtocolCode());

        return ApiResponse.success(ScaleProtocolDTO.fromEntity(protocol));
    }

    // ==================== 更新协议 ====================

    @PutMapping("/{protocolId}")
    @Operation(summary = "更新协议", description = "更新协议配置（内置协议不可修改关键字段）")
    public ApiResponse<ScaleProtocolDTO> updateProtocol(
            @PathVariable @Parameter(description = "协议ID") String protocolId,
            @RequestBody @Valid ProtocolUpdateRequest request) {

        log.info("更新协议: protocolId={}", protocolId);

        ScaleProtocolConfig protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "协议不存在"));

        // 内置协议限制修改
        if (Boolean.TRUE.equals(protocol.getIsBuiltin())) {
            // 只允许更新部分字段
            if (request.getDescription() != null) protocol.setDescription(request.getDescription());
            if (request.getDocumentationUrl() != null) protocol.setDocumentationUrl(request.getDocumentationUrl());
            if (request.getIsActive() != null) protocol.setIsActive(request.getIsActive());
        } else {
            // 非内置协议允许全部修改
            if (request.getProtocolName() != null) protocol.setProtocolName(request.getProtocolName());
            if (request.getConnectionType() != null) {
                protocol.setConnectionType(ScaleProtocolConfig.ConnectionType.valueOf(request.getConnectionType()));
            }
            if (request.getSerialConfig() != null) protocol.setSerialConfig(request.getSerialConfig());
            if (request.getApiConfig() != null) protocol.setApiConfig(request.getApiConfig());
            if (request.getFrameFormat() != null) protocol.setFrameFormat(request.getFrameFormat());
            if (request.getParsingRuleGroup() != null) protocol.setParsingRuleGroup(request.getParsingRuleGroup());
            if (request.getChecksumType() != null) {
                protocol.setChecksumType(ScaleProtocolConfig.ChecksumType.valueOf(request.getChecksumType()));
            }
            if (request.getReadMode() != null) {
                protocol.setReadMode(ScaleProtocolConfig.ReadMode.valueOf(request.getReadMode()));
            }
            if (request.getStableThresholdMs() != null) protocol.setStableThresholdMs(request.getStableThresholdMs());
            if (request.getModbusConfig() != null) protocol.setModbusConfig(request.getModbusConfig());
            if (request.getDocumentationUrl() != null) protocol.setDocumentationUrl(request.getDocumentationUrl());
            if (request.getSampleDataHex() != null) protocol.setSampleDataHex(request.getSampleDataHex());
            if (request.getDescription() != null) protocol.setDescription(request.getDescription());
            if (request.getIsActive() != null) protocol.setIsActive(request.getIsActive());
        }

        protocol = protocolRepository.save(protocol);

        log.info("协议更新成功: id={}", protocol.getId());

        return ApiResponse.success(ScaleProtocolDTO.fromEntity(protocol));
    }

    // ==================== 删除协议 ====================

    @DeleteMapping("/{protocolId}")
    @Operation(summary = "删除协议", description = "删除协议配置（内置协议不可删除）")
    public ApiResponse<Void> deleteProtocol(
            @PathVariable @Parameter(description = "协议ID") String protocolId) {

        log.info("删除协议: protocolId={}", protocolId);

        ScaleProtocolConfig protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "协议不存在"));

        if (Boolean.TRUE.equals(protocol.getIsBuiltin())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "内置协议不可删除");
        }

        protocolRepository.delete(protocol);

        log.info("协议删除成功: id={}", protocolId);

        return ApiResponse.success();
    }

    // ==================== 品牌型号管理 ====================

    @GetMapping("/brand-models")
    @Operation(summary = "获取品牌型号列表", description = "获取所有秤品牌和型号")
    public ApiResponse<List<ScaleBrandModelDTO>> getBrandModels(
            @RequestParam(required = false) @Parameter(description = "品牌编码") String brandCode,
            @RequestParam(required = false) @Parameter(description = "秤类型") String scaleType,
            @RequestParam(required = false) @Parameter(description = "搜索关键词") String keyword,
            @RequestParam(required = false) @Parameter(description = "仅显示推荐") Boolean recommendedOnly) {

        log.info("获取品牌型号列表: brandCode={}, scaleType={}, keyword={}", brandCode, scaleType, keyword);

        List<ScaleBrandModel> models;

        if (keyword != null && !keyword.isEmpty()) {
            models = brandModelRepository.searchByKeyword(keyword);
        } else if (brandCode != null) {
            models = brandModelRepository.findByBrandCode(brandCode);
        } else if (Boolean.TRUE.equals(recommendedOnly)) {
            models = brandModelRepository.findByIsRecommendedTrueOrderByRecommendationScoreDesc();
        } else if (scaleType != null) {
            try {
                ScaleBrandModel.ScaleType type = ScaleBrandModel.ScaleType.valueOf(scaleType);
                models = brandModelRepository.findByScaleType(type);
            } catch (IllegalArgumentException e) {
                models = brandModelRepository.findAll();
            }
        } else {
            models = brandModelRepository.findAll();
        }

        List<ScaleBrandModelDTO> dtos = models.stream()
                .map(ScaleBrandModelDTO::fromEntity)
                .collect(Collectors.toList());

        return ApiResponse.success(dtos);
    }

    @GetMapping("/brand-models/{modelId}")
    @Operation(summary = "获取品牌型号详情", description = "获取指定品牌型号的详细信息")
    public ApiResponse<ScaleBrandModelDTO> getBrandModel(
            @PathVariable @Parameter(description = "型号ID") String modelId) {

        log.info("获取品牌型号详情: modelId={}", modelId);

        ScaleBrandModel model = brandModelRepository.findById(modelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "品牌型号不存在"));

        return ApiResponse.success(ScaleBrandModelDTO.fromEntity(model));
    }

    @PostMapping("/brand-models")
    @Operation(summary = "创建品牌型号", description = "添加新的秤品牌型号（平台管理员）")
    public ApiResponse<ScaleBrandModelDTO> createBrandModel(
            @RequestBody @Valid BrandModelCreateRequest request) {

        log.info("创建品牌型号: brand={}, model={}", request.getBrandCode(), request.getModelCode());

        // 检查是否已存在
        if (brandModelRepository.findByBrandCodeAndModelCode(request.getBrandCode(), request.getModelCode()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "品牌型号已存在");
        }

        ScaleBrandModel model = new ScaleBrandModel();
        model.setId(UUID.randomUUID().toString());
        model.setBrandCode(request.getBrandCode());
        model.setBrandName(request.getBrandName());
        model.setBrandNameEn(request.getBrandNameEn());
        model.setModelCode(request.getModelCode());
        model.setModelName(request.getModelName());
        model.setSupportedProtocolIds(request.getSupportedProtocolIds());
        model.setDefaultProtocolId(request.getDefaultProtocolId());
        model.setHasSerialPort(request.getHasSerialPort() != null ? request.getHasSerialPort() : true);
        model.setHasWifi(request.getHasWifi() != null ? request.getHasWifi() : false);
        model.setHasEthernet(request.getHasEthernet() != null ? request.getHasEthernet() : false);
        model.setHasBluetooth(request.getHasBluetooth() != null ? request.getHasBluetooth() : false);
        model.setHasUsb(request.getHasUsb() != null ? request.getHasUsb() : false);
        model.setWeightRange(request.getWeightRange());
        model.setAccuracy(request.getAccuracy());
        model.setScaleType(request.getScaleType() != null ?
                ScaleBrandModel.ScaleType.valueOf(request.getScaleType()) : null);
        model.setIpRating(request.getIpRating());
        model.setMaterial(request.getMaterial());
        model.setManufacturer(request.getManufacturer());
        model.setManufacturerWebsite(request.getManufacturerWebsite());
        model.setPriceRange(request.getPriceRange());
        model.setRecommendationScore(request.getRecommendationScore() != null ? request.getRecommendationScore() : 0);
        model.setRecommendationReason(request.getRecommendationReason());
        model.setDocumentationUrl(request.getDocumentationUrl());
        model.setImageUrl(request.getImageUrl());
        model.setIsRecommended(request.getIsRecommended() != null ? request.getIsRecommended() : false);
        model.setIsVerified(false);
        model.setDescription(request.getDescription());
        model.setSortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0);

        model = brandModelRepository.save(model);

        log.info("品牌型号创建成功: id={}", model.getId());

        return ApiResponse.success(ScaleBrandModelDTO.fromEntity(model));
    }

    @PutMapping("/brand-models/{modelId}")
    @Operation(summary = "更新品牌型号", description = "更新秤品牌型号信息")
    public ApiResponse<ScaleBrandModelDTO> updateBrandModel(
            @PathVariable @Parameter(description = "型号ID") String modelId,
            @RequestBody @Valid BrandModelUpdateRequest request) {

        log.info("更新品牌型号: modelId={}", modelId);

        ScaleBrandModel model = brandModelRepository.findById(modelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "品牌型号不存在"));

        if (request.getBrandName() != null) model.setBrandName(request.getBrandName());
        if (request.getBrandNameEn() != null) model.setBrandNameEn(request.getBrandNameEn());
        if (request.getModelName() != null) model.setModelName(request.getModelName());
        if (request.getSupportedProtocolIds() != null) model.setSupportedProtocolIds(request.getSupportedProtocolIds());
        if (request.getDefaultProtocolId() != null) model.setDefaultProtocolId(request.getDefaultProtocolId());
        if (request.getHasSerialPort() != null) model.setHasSerialPort(request.getHasSerialPort());
        if (request.getHasWifi() != null) model.setHasWifi(request.getHasWifi());
        if (request.getHasEthernet() != null) model.setHasEthernet(request.getHasEthernet());
        if (request.getHasBluetooth() != null) model.setHasBluetooth(request.getHasBluetooth());
        if (request.getHasUsb() != null) model.setHasUsb(request.getHasUsb());
        if (request.getWeightRange() != null) model.setWeightRange(request.getWeightRange());
        if (request.getAccuracy() != null) model.setAccuracy(request.getAccuracy());
        if (request.getScaleType() != null) {
            model.setScaleType(ScaleBrandModel.ScaleType.valueOf(request.getScaleType()));
        }
        if (request.getIpRating() != null) model.setIpRating(request.getIpRating());
        if (request.getMaterial() != null) model.setMaterial(request.getMaterial());
        if (request.getManufacturer() != null) model.setManufacturer(request.getManufacturer());
        if (request.getManufacturerWebsite() != null) model.setManufacturerWebsite(request.getManufacturerWebsite());
        if (request.getPriceRange() != null) model.setPriceRange(request.getPriceRange());
        if (request.getRecommendationScore() != null) model.setRecommendationScore(request.getRecommendationScore());
        if (request.getRecommendationReason() != null) model.setRecommendationReason(request.getRecommendationReason());
        if (request.getDocumentationUrl() != null) model.setDocumentationUrl(request.getDocumentationUrl());
        if (request.getImageUrl() != null) model.setImageUrl(request.getImageUrl());
        if (request.getIsRecommended() != null) model.setIsRecommended(request.getIsRecommended());
        if (request.getIsVerified() != null) model.setIsVerified(request.getIsVerified());
        if (request.getDescription() != null) model.setDescription(request.getDescription());
        if (request.getSortOrder() != null) model.setSortOrder(request.getSortOrder());

        model = brandModelRepository.save(model);

        log.info("品牌型号更新成功: id={}", model.getId());

        return ApiResponse.success(ScaleBrandModelDTO.fromEntity(model));
    }

    @GetMapping("/brands")
    @Operation(summary = "获取品牌列表", description = "获取所有品牌（去重）")
    public ApiResponse<List<BrandInfo>> getBrands() {

        log.info("获取品牌列表");

        List<Object[]> results = brandModelRepository.findDistinctBrands();

        List<BrandInfo> brands = results.stream()
                .map(row -> BrandInfo.builder()
                        .brandCode((String) row[0])
                        .brandName((String) row[1])
                        .brandNameEn((String) row[2])
                        .build())
                .collect(Collectors.toList());

        return ApiResponse.success(brands);
    }

    // ==================== 内部 DTO 类 ====================

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProtocolCreateRequest {
        private String protocolCode;
        private String protocolName;
        private String connectionType;
        private String serialConfig;
        private String apiConfig;
        private String frameFormat;
        private String parsingRuleGroup;
        private String checksumType;
        private String readMode;
        private Integer stableThresholdMs;
        private String modbusConfig;
        private String documentationUrl;
        private String sampleDataHex;
        private String description;
        private String factoryId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProtocolUpdateRequest {
        private String protocolName;
        private String connectionType;
        private String serialConfig;
        private String apiConfig;
        private String frameFormat;
        private String parsingRuleGroup;
        private String checksumType;
        private String readMode;
        private Integer stableThresholdMs;
        private String modbusConfig;
        private String documentationUrl;
        private String sampleDataHex;
        private String description;
        private Boolean isActive;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BrandModelCreateRequest {
        private String brandCode;
        private String brandName;
        private String brandNameEn;
        private String modelCode;
        private String modelName;
        private String supportedProtocolIds;
        private String defaultProtocolId;
        private Boolean hasSerialPort;
        private Boolean hasWifi;
        private Boolean hasEthernet;
        private Boolean hasBluetooth;
        private Boolean hasUsb;
        private String weightRange;
        private String accuracy;
        private String scaleType;
        private String ipRating;
        private String material;
        private String manufacturer;
        private String manufacturerWebsite;
        private String priceRange;
        private Integer recommendationScore;
        private String recommendationReason;
        private String documentationUrl;
        private String imageUrl;
        private Boolean isRecommended;
        private String description;
        private Integer sortOrder;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BrandModelUpdateRequest {
        private String brandName;
        private String brandNameEn;
        private String modelName;
        private String supportedProtocolIds;
        private String defaultProtocolId;
        private Boolean hasSerialPort;
        private Boolean hasWifi;
        private Boolean hasEthernet;
        private Boolean hasBluetooth;
        private Boolean hasUsb;
        private String weightRange;
        private String accuracy;
        private String scaleType;
        private String ipRating;
        private String material;
        private String manufacturer;
        private String manufacturerWebsite;
        private String priceRange;
        private Integer recommendationScore;
        private String recommendationReason;
        private String documentationUrl;
        private String imageUrl;
        private Boolean isRecommended;
        private Boolean isVerified;
        private String description;
        private Integer sortOrder;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BrandInfo {
        private String brandCode;
        private String brandName;
        private String brandNameEn;
    }
}
