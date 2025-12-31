package com.cretas.aims.service.impl;

import com.cretas.aims.entity.DecisionAuditLog;
import com.cretas.aims.entity.DecisionAuditLog.ApprovalStatus;
import com.cretas.aims.entity.DecisionAuditLog.DecisionType;
import com.cretas.aims.entity.DecisionAuditLog.ExecutionMode;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.repository.DecisionAuditLogRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.service.SupplierAdmissionRuleService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 供应商准入规则服务实现
 *
 * 实现供应商准入评估、供货权限检查、验收策略生成
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SupplierAdmissionRuleServiceImpl implements SupplierAdmissionRuleService {

    private final SupplierRepository supplierRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final DecisionAuditLogRepository decisionAuditLogRepository;
    private final ObjectMapper objectMapper;

    // 工厂规则配置缓存 (生产环境应使用Redis)
    private final Map<String, SupplierRuleConfig> ruleConfigCache = new ConcurrentHashMap<>();

    // 配置版本计数器
    private final Map<String, Integer> versionCounter = new ConcurrentHashMap<>();

    // 默认规则配置
    private static final String DEFAULT_CONFIG_ID = "default-supplier-rule-config";
    private static final Integer DEFAULT_VERSION = 1;

    @Override
    @Transactional(readOnly = true)
    public AdmissionEvaluationResult evaluateAdmission(String factoryId, Supplier supplier) {
        log.info("评估供应商准入资格: factoryId={}, supplierId={}, supplierName={}",
                factoryId, supplier.getId(), supplier.getName());

        // 1. 获取规则配置
        SupplierRuleConfig config = getRuleConfiguration(factoryId);
        AdmissionRules rules = config.getAdmissionRules();

        // 2. 评估各项条件
        List<RejectionReason> rejectionReasons = new ArrayList<>();
        List<String> improvements = new ArrayList<>();
        BigDecimal totalScore = BigDecimal.ZERO;
        int criteriaCount = 0;

        // 2.1 营业执照检查 (权重: 20分)
        if (rules.isRequireBusinessLicense()) {
            criteriaCount++;
            if (supplier.getBusinessLicense() != null && !supplier.getBusinessLicense().isEmpty()) {
                totalScore = totalScore.add(new BigDecimal("20"));
            } else {
                rejectionReasons.add(RejectionReason.builder()
                        .code("MISSING_BUSINESS_LICENSE")
                        .description("缺少营业执照")
                        .requirement("必须提供有效的营业执照编号")
                        .currentValue("未提供")
                        .build());
                improvements.add("请提交有效的营业执照信息");
            }
        }

        // 2.2 质量证书检查 (权重: 20分)
        if (rules.isRequireQualityCertificates()) {
            criteriaCount++;
            if (supplier.getQualityCertificates() != null && !supplier.getQualityCertificates().isEmpty()) {
                // 解析证书数量
                int certCount = countCertificates(supplier.getQualityCertificates());
                BigDecimal certScore = new BigDecimal(Math.min(certCount * 5, 20));
                totalScore = totalScore.add(certScore);
                if (certCount < 4) {
                    improvements.add("建议补充更多质量认证证书（如ISO9001、HACCP等）");
                }
            } else {
                rejectionReasons.add(RejectionReason.builder()
                        .code("MISSING_QUALITY_CERTIFICATES")
                        .description("缺少质量证书")
                        .requirement("至少提供一份质量认证证书")
                        .currentValue("未提供")
                        .build());
                improvements.add("请提交质量认证证书（如ISO9001、HACCP、SC食品生产许可证等）");
            }
        }

        // 2.3 评级检查 (权重: 25分)
        if (rules.getMinRating() != null && rules.getMinRating() > 0) {
            criteriaCount++;
            Integer rating = supplier.getRating();
            if (rating != null && rating >= rules.getMinRating()) {
                // 评级得分: minRating=3时, rating=5得满分25, rating=4得20, rating=3得15
                BigDecimal ratingScore = new BigDecimal((rating - rules.getMinRating() + 1) * 5)
                        .min(new BigDecimal("25"));
                totalScore = totalScore.add(ratingScore);
            } else {
                rejectionReasons.add(RejectionReason.builder()
                        .code("INSUFFICIENT_RATING")
                        .description("评级不足")
                        .requirement("最低评级要求: " + rules.getMinRating() + "星")
                        .currentValue(rating != null ? rating + "星" : "未评级")
                        .build());
                improvements.add("请通过提升产品质量和服务来提高供应商评级");
            }
        }

        // 2.4 信用额度检查 (权重: 15分)
        if (rules.isRequireCreditLimit()) {
            criteriaCount++;
            if (supplier.getCreditLimit() != null && supplier.getCreditLimit().compareTo(BigDecimal.ZERO) > 0) {
                totalScore = totalScore.add(new BigDecimal("15"));
            } else {
                rejectionReasons.add(RejectionReason.builder()
                        .code("NO_CREDIT_LIMIT")
                        .description("未设置信用额度")
                        .requirement("必须设置信用额度")
                        .currentValue("未设置")
                        .build());
                improvements.add("请申请设置信用额度");
            }
        }

        // 2.5 历史合格率检查 (权重: 20分)
        if (rules.getMinHistoricalPassRate() != null) {
            criteriaCount++;
            BigDecimal passRate = calculateSupplierPassRate(factoryId, supplier.getId());
            if (passRate.compareTo(rules.getMinHistoricalPassRate()) >= 0) {
                BigDecimal passRateScore = passRate.multiply(new BigDecimal("0.2")).min(new BigDecimal("20"));
                totalScore = totalScore.add(passRateScore);
            } else if (passRate.compareTo(BigDecimal.ZERO) == 0) {
                // 新供应商，给予基础分
                totalScore = totalScore.add(new BigDecimal("10"));
                improvements.add("新供应商，建议先进行小批量试供货");
            } else {
                rejectionReasons.add(RejectionReason.builder()
                        .code("LOW_PASS_RATE")
                        .description("历史合格率过低")
                        .requirement("最低合格率要求: " + rules.getMinHistoricalPassRate() + "%")
                        .currentValue(passRate.setScale(2, RoundingMode.HALF_UP) + "%")
                        .build());
                improvements.add("请改善产品质量以提高合格率");
            }
        }

        // 3. 计算综合得分
        BigDecimal maxScore = new BigDecimal(criteriaCount * 20); // 假设每项满分20
        BigDecimal normalizedScore = criteriaCount > 0
                ? totalScore.multiply(new BigDecimal("100")).divide(maxScore, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // 4. 确定评级
        String grade = determineGrade(normalizedScore);

        // 5. 判断是否通过
        boolean admitted = rejectionReasons.isEmpty()
                && normalizedScore.compareTo(new BigDecimal("60")) >= 0;

        // 6. 生成评估结论
        String reason = generateAdmissionReason(admitted, normalizedScore, grade, rejectionReasons);

        // 7. 记录审计日志
        recordAdmissionAuditLog(factoryId, supplier, admitted, normalizedScore, grade, reason, config);

        return AdmissionEvaluationResult.builder()
                .admitted(admitted)
                .score(normalizedScore)
                .grade(grade)
                .triggeredRuleName("supplier-admission-" + grade)
                .ruleConfigId(config.getId())
                .ruleVersion(config.getVersion())
                .rejectionReasons(rejectionReasons)
                .improvements(improvements)
                .reason(reason)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public SupplyPermissionResult checkSupplyPermission(
            String factoryId,
            Supplier supplier,
            String materialTypeId
    ) {
        log.info("检查供应商供货权限: factoryId={}, supplierId={}, materialTypeId={}",
                factoryId, supplier.getId(), materialTypeId);

        List<String> restrictions = new ArrayList<>();

        // 1. 检查供应商是否激活
        if (!supplier.getIsActive()) {
            return SupplyPermissionResult.builder()
                    .permitted(false)
                    .reason("供应商已停用")
                    .historicalPassRate(BigDecimal.ZERO)
                    .supplyCount(0)
                    .restrictions(List.of("供应商状态: 停用"))
                    .build();
        }

        // 2. 检查供应商是否有该材料的供货资质
        String suppliedMaterials = supplier.getSuppliedMaterials();
        boolean hasMaterialPermission = suppliedMaterials != null
                && (suppliedMaterials.contains(materialTypeId)
                    || suppliedMaterials.toLowerCase().contains("all")
                    || suppliedMaterials.equals("*"));

        if (!hasMaterialPermission) {
            restrictions.add("该供应商未获得此材料类型的供货授权");
        }

        // 3. 计算历史供货统计
        List<MaterialBatch> supplyHistory = materialBatchRepository
                .findByFactoryIdAndSupplierId(factoryId, supplier.getId())
                .stream()
                .filter(batch -> materialTypeId == null
                        || materialTypeId.equals(batch.getMaterialTypeId()))
                .collect(Collectors.toList());

        int supplyCount = supplyHistory.size();
        String lastSupplyDate = supplyHistory.stream()
                .map(MaterialBatch::getCreatedAt)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .map(dt -> dt.format(DateTimeFormatter.ISO_LOCAL_DATE))
                .orElse(null);

        // 4. 计算合格率 (基于批次状态)
        long availableCount = supplyHistory.stream()
                .filter(batch -> batch.getStatus() == MaterialBatchStatus.AVAILABLE
                        || batch.getStatus() == MaterialBatchStatus.RESERVED
                        || batch.getStatus() == MaterialBatchStatus.DEPLETED)
                .count();
        long expiredOrRejected = supplyHistory.stream()
                .filter(batch -> batch.getStatus() == MaterialBatchStatus.EXPIRED)
                .count();

        BigDecimal passRate = supplyCount > 0
                ? new BigDecimal(availableCount).multiply(new BigDecimal("100"))
                    .divide(new BigDecimal(supplyCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // 5. 检查信用额度
        if (supplier.getCreditLimit() != null && supplier.getCurrentBalance() != null) {
            if (supplier.getCurrentBalance().compareTo(supplier.getCreditLimit()) >= 0) {
                restrictions.add("已达到信用额度上限");
            }
        }

        // 6. 检查是否是新供应商（供货次数<3）
        if (supplyCount < 3) {
            restrictions.add("新供应商，建议加强验收检验");
        }

        // 7. 判断是否允许供货
        boolean permitted = hasMaterialPermission
                && (passRate.compareTo(new BigDecimal("80")) >= 0 || supplyCount < 3);

        String reason;
        if (permitted) {
            if (restrictions.isEmpty()) {
                reason = "供应商具备供货资质";
            } else {
                reason = "供应商具备供货资质，但存在以下提示: " + String.join("; ", restrictions);
            }
        } else {
            reason = "供货权限受限: " + (hasMaterialPermission
                    ? "历史合格率过低(" + passRate + "%)"
                    : "未获得该材料供货授权");
        }

        return SupplyPermissionResult.builder()
                .permitted(permitted)
                .reason(reason)
                .historicalPassRate(passRate)
                .supplyCount(supplyCount)
                .lastSupplyDate(lastSupplyDate)
                .restrictions(restrictions)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public AcceptanceStrategy generateAcceptanceStrategy(
            String factoryId,
            Supplier supplier,
            String materialTypeId,
            BigDecimal quantity
    ) {
        log.info("生成验收策略: factoryId={}, supplierId={}, materialTypeId={}, quantity={}",
                factoryId, supplier.getId(), materialTypeId, quantity);

        // 1. 获取规则配置
        SupplierRuleConfig config = getRuleConfiguration(factoryId);
        AcceptanceRules rules = config.getAcceptanceRules();

        // 2. 获取供应商历史数据
        List<MaterialBatch> supplyHistory = materialBatchRepository
                .findByFactoryIdAndSupplierId(factoryId, supplier.getId());
        int supplyCount = supplyHistory.size();

        BigDecimal passRate = calculateSupplierPassRate(factoryId, supplier.getId());

        // 3. 确定检验级别
        InspectionLevel level;
        String rationale;

        if (supplyCount < 3) {
            // 新供应商：使用配置的默认级别
            level = rules.getNewSupplierLevel() != null
                    ? rules.getNewSupplierLevel()
                    : InspectionLevel.STRICT;
            rationale = String.format("新供应商（供货次数=%d），采用%s", supplyCount, level.getDescription());
        } else if (passRate.compareTo(rules.getRelaxedThreshold()) >= 0) {
            // 合格率高于宽松阈值：宽松检验
            level = InspectionLevel.RELAXED;
            rationale = String.format("历史合格率%.1f%%，高于宽松阈值%.1f%%，采用%s",
                    passRate.doubleValue(), rules.getRelaxedThreshold().doubleValue(), level.getDescription());
        } else if (passRate.compareTo(new BigDecimal("100").subtract(rules.getStrictThreshold())) < 0) {
            // 不合格率高于严格阈值：加严检验
            level = InspectionLevel.STRICT;
            rationale = String.format("历史合格率%.1f%%，低于加严触发点，采用%s",
                    passRate.doubleValue(), level.getDescription());
        } else {
            // 正常检验
            level = InspectionLevel.NORMAL;
            rationale = String.format("历史合格率%.1f%%，采用%s", passRate.doubleValue(), level.getDescription());
        }

        // 4. 计算抽样方案
        SamplingPlan samplingPlan = calculateSamplingPlan(level, quantity, rules);

        // 5. 确定检验项目
        List<InspectionItem> inspectionItems = generateInspectionItems(level, materialTypeId);

        // 6. 是否需要全检
        boolean fullInspection = level == InspectionLevel.STRICT
                && quantity.compareTo(new BigDecimal("100")) <= 0;

        // 7. 生成策略ID
        String strategyId = UUID.randomUUID().toString();

        // 8. 生成策略描述
        String description = String.format(
                "供应商[%s]的%s验收策略：抽样比例%.1f%%，样本量%d，%s",
                supplier.getName(),
                level.getDescription(),
                samplingPlan.getSamplePercentage().doubleValue(),
                samplingPlan.getCalculatedSampleSize(),
                fullInspection ? "需全检" : "抽样检验"
        );

        return AcceptanceStrategy.builder()
                .strategyId(strategyId)
                .inspectionLevel(level)
                .samplingPlan(samplingPlan)
                .inspectionItems(inspectionItems)
                .fullInspection(fullInspection)
                .description(description)
                .rationale(rationale)
                .ruleConfigId(config.getId())
                .ruleVersion(config.getVersion())
                .build();
    }

    @Override
    public SupplierRuleConfig getRuleConfiguration(String factoryId) {
        // 尝试从缓存获取
        SupplierRuleConfig cached = ruleConfigCache.get(factoryId);
        if (cached != null) {
            return cached;
        }

        // 创建默认配置
        SupplierRuleConfig defaultConfig = createDefaultConfig(factoryId);
        ruleConfigCache.put(factoryId, defaultConfig);
        return defaultConfig;
    }

    @Override
    @Transactional
    public SupplierRuleConfig updateRuleConfiguration(String factoryId, SupplierRuleConfig config) {
        log.info("更新供应商规则配置: factoryId={}", factoryId);

        // 增加版本号
        int newVersion = versionCounter.compute(factoryId, (k, v) -> v == null ? 2 : v + 1);
        config.setVersion(newVersion);
        config.setUpdatedAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        // 更新缓存
        ruleConfigCache.put(factoryId, config);

        log.info("规则配置已更新: factoryId={}, version={}", factoryId, newVersion);
        return config;
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 计算供应商历史合格率
     */
    private BigDecimal calculateSupplierPassRate(String factoryId, String supplierId) {
        List<MaterialBatch> batches = materialBatchRepository
                .findByFactoryIdAndSupplierId(factoryId, supplierId);

        if (batches.isEmpty()) {
            return BigDecimal.ZERO;
        }

        long goodBatches = batches.stream()
                .filter(batch -> batch.getStatus() != MaterialBatchStatus.EXPIRED)
                .count();

        return new BigDecimal(goodBatches)
                .multiply(new BigDecimal("100"))
                .divide(new BigDecimal(batches.size()), 2, RoundingMode.HALF_UP);
    }

    /**
     * 统计证书数量
     */
    private int countCertificates(String certificates) {
        if (certificates == null || certificates.isEmpty()) {
            return 0;
        }
        // 假设证书以逗号或换行分隔
        return certificates.split("[,\n]").length;
    }

    /**
     * 确定评级
     */
    private String determineGrade(BigDecimal score) {
        if (score.compareTo(new BigDecimal("90")) >= 0) {
            return "A";
        } else if (score.compareTo(new BigDecimal("80")) >= 0) {
            return "B";
        } else if (score.compareTo(new BigDecimal("60")) >= 0) {
            return "C";
        } else {
            return "D";
        }
    }

    /**
     * 生成准入评估结论
     */
    private String generateAdmissionReason(
            boolean admitted,
            BigDecimal score,
            String grade,
            List<RejectionReason> rejectionReasons
    ) {
        if (admitted) {
            return String.format("供应商准入评估通过，综合得分%.1f分，评级%s",
                    score.doubleValue(), grade);
        } else {
            String rejectSummary = rejectionReasons.stream()
                    .map(RejectionReason::getDescription)
                    .collect(Collectors.joining("；"));
            return String.format("供应商准入评估未通过，综合得分%.1f分，评级%s。问题：%s",
                    score.doubleValue(), grade, rejectSummary);
        }
    }

    /**
     * 记录准入评估审计日志
     */
    private void recordAdmissionAuditLog(
            String factoryId,
            Supplier supplier,
            boolean admitted,
            BigDecimal score,
            String grade,
            String reason,
            SupplierRuleConfig config
    ) {
        try {
            Map<String, Object> inputContext = new HashMap<>();
            inputContext.put("supplierId", supplier.getId());
            inputContext.put("supplierName", supplier.getName());
            inputContext.put("rating", supplier.getRating());
            inputContext.put("hasBusinessLicense", supplier.getBusinessLicense() != null);
            inputContext.put("hasCertificates", supplier.getQualityCertificates() != null);

            Map<String, Object> outputResult = new HashMap<>();
            outputResult.put("admitted", admitted);
            outputResult.put("score", score);
            outputResult.put("grade", grade);

            DecisionAuditLog auditLog = DecisionAuditLog.builder()
                    .decisionType(DecisionType.RULE_EXECUTION)
                    .decisionCode("SUPPLIER_ADMISSION_EVALUATION")
                    .entityType("Supplier")
                    .entityId(supplier.getId())
                    .factoryId(factoryId)
                    .inputContext(toJson(inputContext))
                    .outputResult(toJson(outputResult))
                    .ruleConfigId(config.getId())
                    .ruleConfigVersion(config.getVersion())
                    .ruleConfigName("supplier-admission-rules")
                    .decisionMade(admitted ? "ADMITTED" : "REJECTED")
                    .reason(reason)
                    .confidence(score)
                    .executionMode(ExecutionMode.AUTOMATIC)
                    .requiresApproval(false)
                    .isReplayable(true)
                    .build();

            decisionAuditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.warn("记录准入评估审计日志失败: {}", e.getMessage());
        }
    }

    /**
     * 计算抽样方案
     */
    private SamplingPlan calculateSamplingPlan(
            InspectionLevel level,
            BigDecimal quantity,
            AcceptanceRules rules
    ) {
        BigDecimal samplePercentage;
        switch (level) {
            case RELAXED:
                samplePercentage = rules.getDefaultSamplePercentage()
                        .multiply(new BigDecimal("0.5"));
                break;
            case STRICT:
                samplePercentage = rules.getHighRiskSamplePercentage() != null
                        ? rules.getHighRiskSamplePercentage()
                        : rules.getDefaultSamplePercentage().multiply(new BigDecimal("2"));
                break;
            default: // NORMAL
                samplePercentage = rules.getDefaultSamplePercentage();
        }

        // 计算样本量
        int calculatedSize = quantity
                .multiply(samplePercentage)
                .divide(new BigDecimal("100"), 0, RoundingMode.CEILING)
                .intValue();

        // 应用最小/最大限制
        int minSize = rules.getMinSampleSize() != null ? rules.getMinSampleSize() : 3;
        int maxSize = rules.getMaxSampleSize() != null ? rules.getMaxSampleSize() : 100;
        calculatedSize = Math.max(minSize, Math.min(maxSize, calculatedSize));

        // AQL接收数计算（简化版本）
        int acceptanceNumber = level == InspectionLevel.STRICT ? 0
                : (level == InspectionLevel.NORMAL ? 1 : 2);
        int rejectionNumber = acceptanceNumber + 1;

        return SamplingPlan.builder()
                .samplePercentage(samplePercentage)
                .minSampleSize(minSize)
                .maxSampleSize(maxSize)
                .calculatedSampleSize(calculatedSize)
                .acceptanceNumber(acceptanceNumber)
                .rejectionNumber(rejectionNumber)
                .build();
    }

    /**
     * 生成检验项目列表
     */
    private List<InspectionItem> generateInspectionItems(
            InspectionLevel level,
            String materialTypeId
    ) {
        List<InspectionItem> items = new ArrayList<>();

        // 基础检验项（所有级别都需要）
        items.add(InspectionItem.builder()
                .name("外观检验")
                .method("目视检查")
                .standardValue("无异常")
                .toleranceRange("N/A")
                .mandatory(true)
                .weight(new BigDecimal("0.15"))
                .build());

        items.add(InspectionItem.builder()
                .name("数量核对")
                .method("清点计数")
                .standardValue("与送货单一致")
                .toleranceRange("±0")
                .mandatory(true)
                .weight(new BigDecimal("0.10"))
                .build());

        items.add(InspectionItem.builder()
                .name("包装完整性")
                .method("目视检查")
                .standardValue("包装完好无破损")
                .toleranceRange("N/A")
                .mandatory(true)
                .weight(new BigDecimal("0.10"))
                .build());

        // 正常及严格检验增加的项目
        if (level != InspectionLevel.RELAXED) {
            items.add(InspectionItem.builder()
                    .name("温度检测")
                    .method("温度计测量")
                    .standardValue("-18°C至4°C")
                    .toleranceRange("±2°C")
                    .mandatory(true)
                    .weight(new BigDecimal("0.20"))
                    .build());

            items.add(InspectionItem.builder()
                    .name("保质期检查")
                    .method("查看标签")
                    .standardValue("剩余保质期>50%")
                    .toleranceRange("N/A")
                    .mandatory(true)
                    .weight(new BigDecimal("0.15"))
                    .build());
        }

        // 严格检验特有项目
        if (level == InspectionLevel.STRICT) {
            items.add(InspectionItem.builder()
                    .name("理化指标检测")
                    .method("实验室检测")
                    .standardValue("符合GB标准")
                    .toleranceRange("参照国标")
                    .mandatory(true)
                    .weight(new BigDecimal("0.20"))
                    .build());

            items.add(InspectionItem.builder()
                    .name("微生物检测")
                    .method("实验室培养")
                    .standardValue("菌落总数<1000CFU/g")
                    .toleranceRange("N/A")
                    .mandatory(false)
                    .weight(new BigDecimal("0.10"))
                    .build());
        }

        return items;
    }

    /**
     * 创建默认配置
     */
    private SupplierRuleConfig createDefaultConfig(String factoryId) {
        String configId = factoryId + "-" + DEFAULT_CONFIG_ID;

        AdmissionRules admissionRules = AdmissionRules.builder()
                .requireBusinessLicense(true)
                .requireQualityCertificates(true)
                .minRating(3)
                .requireCreditLimit(false)
                .minHistoricalPassRate(new BigDecimal("80"))
                .minSupplyCount(0)
                .build();

        AcceptanceRules acceptanceRules = AcceptanceRules.builder()
                .newSupplierLevel(InspectionLevel.STRICT)
                .relaxedThreshold(new BigDecimal("95"))
                .strictThreshold(new BigDecimal("10"))
                .defaultSamplePercentage(new BigDecimal("10"))
                .highRiskSamplePercentage(new BigDecimal("30"))
                .minSampleSize(3)
                .maxSampleSize(100)
                .build();

        return SupplierRuleConfig.builder()
                .id(configId)
                .factoryId(factoryId)
                .version(DEFAULT_VERSION)
                .admissionRules(admissionRules)
                .acceptanceRules(acceptanceRules)
                .enabled(true)
                .createdAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .updatedAt(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .build();
    }

    /**
     * 对象转JSON字符串
     */
    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("JSON序列化失败: {}", e.getMessage());
            return null;
        }
    }
}
