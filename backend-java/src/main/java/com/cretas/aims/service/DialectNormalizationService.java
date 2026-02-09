package com.cretas.aims.service;

import com.cretas.aims.entity.DialectMapping;
import com.cretas.aims.entity.DialectMapping.MappingType;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 方言/口语标准化服务接口
 *
 * 提供方言/口语表达到标准表达的映射功能，
 * 支持预置映射和自学习新映射。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
public interface DialectNormalizationService {

    /**
     * 执行方言/口语标准化
     *
     * @param input 用户输入
     * @return 标准化结果
     */
    NormalizationResult normalize(String input);

    /**
     * 执行方言/口语标准化（带工厂ID）
     *
     * @param input     用户输入
     * @param factoryId 工厂ID
     * @return 标准化结果
     */
    NormalizationResult normalize(String input, String factoryId);

    /**
     * 学习新的方言/口语映射
     *
     * @param dialect    方言/口语表达
     * @param standard   标准表达
     * @param confidence 置信度 (0.0 - 1.0)
     * @return 创建或更新的映射
     */
    DialectMapping learnDialect(String dialect, String standard, double confidence);

    /**
     * 学习新的方言/口语映射（带工厂ID和类型）
     *
     * @param dialect     方言/口语表达
     * @param standard    标准表达
     * @param confidence  置信度 (0.0 - 1.0)
     * @param factoryId   工厂ID（可为空表示全局）
     * @param mappingType 映射类型
     * @return 创建或更新的映射
     */
    DialectMapping learnDialect(String dialect, String standard, double confidence,
                                 String factoryId, MappingType mappingType);

    /**
     * 获取当前所有映射
     *
     * @return 方言 -> 标准表达 的映射表
     */
    Map<String, String> getMapping();

    /**
     * 获取指定工厂的映射（包括全局映射）
     *
     * @param factoryId 工厂ID
     * @return 方言 -> 标准表达 的映射表
     */
    Map<String, String> getMapping(String factoryId);

    /**
     * 获取指定类型的映射
     *
     * @param type 映射类型
     * @return 方言 -> 标准表达 的映射表
     */
    Map<String, String> getMappingByType(MappingType type);

    /**
     * 记录映射使用（用于统计和置信度调整）
     *
     * @param dialectExpr 方言表达
     */
    void recordUsage(String dialectExpr);

    /**
     * 记录映射成功使用（用户接受了转换）
     *
     * @param dialectExpr 方言表达
     */
    void recordSuccess(String dialectExpr);

    /**
     * 刷新映射缓存（从数据库重新加载）
     */
    void refreshCache();

    /**
     * 获取映射统计信息
     *
     * @return 统计信息
     */
    MappingStatistics getStatistics();

    /**
     * 禁用低置信度映射
     *
     * @param threshold 置信度阈值
     * @return 禁用的映射数量
     */
    int disableLowConfidenceMappings(double threshold);

    // ==================== 结果和统计类 ====================

    /**
     * 标准化结果
     */
    @Data
    @Builder
    class NormalizationResult {
        /** 原始输入 */
        private String originalInput;
        /** 标准化后的文本 */
        private String normalizedText;
        /** 是否有替换发生 */
        private boolean hasReplacements;
        /** 替换的映射列表 */
        private List<ReplacedMapping> replacements;
        /** 处理耗时(ms) */
        private long processingTimeMs;

        /**
         * 无替换的结果
         */
        public static NormalizationResult noChange(String input) {
            return NormalizationResult.builder()
                    .originalInput(input)
                    .normalizedText(input)
                    .hasReplacements(false)
                    .replacements(List.of())
                    .processingTimeMs(0)
                    .build();
        }
    }

    /**
     * 替换的映射详情
     */
    @Data
    @Builder
    class ReplacedMapping {
        /** 方言表达 */
        private String dialectExpr;
        /** 标准表达 */
        private String standardExpr;
        /** 映射类型 */
        private MappingType mappingType;
        /** 置信度 */
        private Double confidence;
        /** 映射ID（用于统计） */
        private Long mappingId;
    }

    /**
     * 映射统计信息
     */
    @Data
    @Builder
    class MappingStatistics {
        /** 总映射数 */
        private int totalMappings;
        /** 启用的映射数 */
        private int enabledMappings;
        /** 预置映射数 */
        private int presetMappings;
        /** 学习映射数 */
        private int learnedMappings;
        /** 各类型映射数 */
        private Map<MappingType, Integer> mappingsByType;
        /** 平均置信度 */
        private double averageConfidence;
        /** 高频映射数（使用次数>=10） */
        private int highFrequencyMappings;
    }
}
