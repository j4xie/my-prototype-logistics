package com.cretas.aims.service;

import com.cretas.aims.entity.Supplier;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 供应商准入规则服务接口
 *
 * 管理供应商准入评估、供货权限检查、验收策略生成
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
public interface SupplierAdmissionRuleService {

    /**
     * 评估供应商准入资格
     *
     * @param factoryId 工厂ID
     * @param supplier 供应商对象
     * @return 准入评估结果
     */
    AdmissionEvaluationResult evaluateAdmission(String factoryId, Supplier supplier);

    /**
     * 检查供应商供货权限
     *
     * @param factoryId 工厂ID
     * @param supplier 供应商对象
     * @param materialTypeId 原材料类型ID
     * @return 供货权限检查结果
     */
    SupplyPermissionResult checkSupplyPermission(String factoryId, Supplier supplier, String materialTypeId);

    /**
     * 生成验收策略
     *
     * @param factoryId 工厂ID
     * @param supplier 供应商对象
     * @param materialTypeId 原材料类型ID
     * @param quantity 采购数量
     * @return 验收策略
     */
    AcceptanceStrategy generateAcceptanceStrategy(
            String factoryId,
            Supplier supplier,
            String materialTypeId,
            BigDecimal quantity
    );

    /**
     * 获取规则配置
     *
     * @param factoryId 工厂ID
     * @return 规则配置
     */
    SupplierRuleConfig getRuleConfiguration(String factoryId);

    /**
     * 更新规则配置
     *
     * @param factoryId 工厂ID
     * @param config 规则配置
     * @return 更新后的规则配置
     */
    SupplierRuleConfig updateRuleConfiguration(String factoryId, SupplierRuleConfig config);

    // ==================== 结果类定义 ====================

    /**
     * 准入评估结果
     */
    @Data
    @Builder
    class AdmissionEvaluationResult {
        /**
         * 是否通过准入评估
         */
        private boolean admitted;

        /**
         * 评估得分 (0-100)
         */
        private BigDecimal score;

        /**
         * 评估等级 (A/B/C/D)
         */
        private String grade;

        /**
         * 触发的规则名称
         */
        private String triggeredRuleName;

        /**
         * 规则配置ID
         */
        private String ruleConfigId;

        /**
         * 规则版本
         */
        private Integer ruleVersion;

        /**
         * 拒绝原因列表
         */
        private List<RejectionReason> rejectionReasons;

        /**
         * 改进建议
         */
        private List<String> improvements;

        /**
         * 详细说明
         */
        private String reason;
    }

    /**
     * 拒绝原因
     */
    @Data
    @Builder
    class RejectionReason {
        private String code;
        private String description;
        private String requirement;
        private String currentValue;
    }

    /**
     * 供货权限检查结果
     */
    @Data
    @Builder
    class SupplyPermissionResult {
        /**
         * 是否允许供货
         */
        private boolean permitted;

        /**
         * 原因说明
         */
        private String reason;

        /**
         * 供应商对该材料的历史合格率
         */
        private BigDecimal historicalPassRate;

        /**
         * 供应商对该材料的历史供货次数
         */
        private Integer supplyCount;

        /**
         * 最近一次供货时间
         */
        private String lastSupplyDate;

        /**
         * 限制条件（如果有）
         */
        private List<String> restrictions;
    }

    /**
     * 验收策略
     */
    @Data
    @Builder
    class AcceptanceStrategy {
        /**
         * 策略ID
         */
        private String strategyId;

        /**
         * 检验级别 (NORMAL/STRICT/RELAXED)
         */
        private InspectionLevel inspectionLevel;

        /**
         * 抽样方案
         */
        private SamplingPlan samplingPlan;

        /**
         * 检验项目列表
         */
        private List<InspectionItem> inspectionItems;

        /**
         * 是否需要全检
         */
        private boolean fullInspection;

        /**
         * 策略说明
         */
        private String description;

        /**
         * 生成依据
         */
        private String rationale;

        /**
         * 规则配置ID
         */
        private String ruleConfigId;

        /**
         * 规则版本
         */
        private Integer ruleVersion;
    }

    /**
     * 检验级别
     */
    enum InspectionLevel {
        RELAXED("宽松检验"),
        NORMAL("正常检验"),
        STRICT("加严检验");

        private final String description;

        InspectionLevel(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    /**
     * 抽样方案
     */
    @Data
    @Builder
    class SamplingPlan {
        /**
         * 抽样比例 (0-100)
         */
        private BigDecimal samplePercentage;

        /**
         * 最小样本量
         */
        private Integer minSampleSize;

        /**
         * 最大样本量
         */
        private Integer maxSampleSize;

        /**
         * 计算得出的样本量
         */
        private Integer calculatedSampleSize;

        /**
         * 接收数 (AQL)
         */
        private Integer acceptanceNumber;

        /**
         * 拒收数
         */
        private Integer rejectionNumber;
    }

    /**
     * 检验项目
     */
    @Data
    @Builder
    class InspectionItem {
        /**
         * 检验项目名称
         */
        private String name;

        /**
         * 检验方法
         */
        private String method;

        /**
         * 标准值
         */
        private String standardValue;

        /**
         * 容差范围
         */
        private String toleranceRange;

        /**
         * 是否必检
         */
        private boolean mandatory;

        /**
         * 权重
         */
        private BigDecimal weight;
    }

    /**
     * 供应商规则配置
     */
    @Data
    @Builder
    class SupplierRuleConfig {
        /**
         * 配置ID
         */
        private String id;

        /**
         * 工厂ID
         */
        private String factoryId;

        /**
         * 版本号
         */
        private Integer version;

        /**
         * 准入规则
         */
        private AdmissionRules admissionRules;

        /**
         * 验收策略规则
         */
        private AcceptanceRules acceptanceRules;

        /**
         * 是否启用
         */
        private boolean enabled;

        /**
         * 创建时间
         */
        private String createdAt;

        /**
         * 更新时间
         */
        private String updatedAt;
    }

    /**
     * 准入规则配置
     */
    @Data
    @Builder
    class AdmissionRules {
        /**
         * 是否要求营业执照
         */
        private boolean requireBusinessLicense;

        /**
         * 是否要求质量证书
         */
        private boolean requireQualityCertificates;

        /**
         * 最低评级要求
         */
        private Integer minRating;

        /**
         * 是否要求设置信用额度
         */
        private boolean requireCreditLimit;

        /**
         * 历史合格率最低要求 (0-100)
         */
        private BigDecimal minHistoricalPassRate;

        /**
         * 最少供货次数要求
         */
        private Integer minSupplyCount;
    }

    /**
     * 验收策略规则配置
     */
    @Data
    @Builder
    class AcceptanceRules {
        /**
         * 新供应商默认检验级别
         */
        private InspectionLevel newSupplierLevel;

        /**
         * 宽松检验合格率阈值 (连续合格)
         */
        private BigDecimal relaxedThreshold;

        /**
         * 加严检验触发阈值 (不合格率)
         */
        private BigDecimal strictThreshold;

        /**
         * 默认抽样比例
         */
        private BigDecimal defaultSamplePercentage;

        /**
         * 高风险材料抽样比例
         */
        private BigDecimal highRiskSamplePercentage;

        /**
         * 最小样本量
         */
        private Integer minSampleSize;

        /**
         * 最大样本量
         */
        private Integer maxSampleSize;
    }
}
