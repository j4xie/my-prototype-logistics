package com.cretas.aims.service;

import com.cretas.aims.dto.clarification.ReferenceResult;
import com.cretas.aims.dto.conversation.ConversationContext;

import java.util.List;
import java.util.Map;

/**
 * 指代消解服务接口
 *
 * Phase 3 会话级指代消解：
 * 1. 识别代词："它"、"这个"、"那批"、"上面提到的"
 * 2. 从会话历史中查找指代对象
 * 3. 使用 LLM 辅助复杂指代消解
 *
 * 支持的指代类型：
 * - 代词指代: 它、他们、它们
 * - 近指/远指: 这个、那个、这批、那批
 * - 定指: 该批次、该供应商
 * - 上下文指代: 上面提到的、刚才说的、之前的
 * - 省略指代: 隐含的主语或宾语
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public interface CoreferenceResolutionService {

    /**
     * 解析用户输入中的指代词
     *
     * @param userInput 用户输入
     * @param context 会话上下文
     * @return 指代消解结果
     */
    ReferenceResult resolve(String userInput, ConversationContext context);

    /**
     * 检测输入中的指代词
     *
     * @param userInput 用户输入
     * @return 检测到的指代词列表
     */
    List<DetectedReference> detectReferences(String userInput);

    /**
     * 从会话上下文中查找指代对象
     *
     * @param reference 指代词
     * @param referenceType 指代类型
     * @param context 会话上下文
     * @return 找到的实体信息，未找到返回 null
     */
    ResolvedEntity findReferent(
            String reference,
            ReferenceType referenceType,
            ConversationContext context);

    /**
     * 使用 LLM 进行复杂指代消解
     *
     * 当规则消解失败时调用 LLM：
     * - 分析会话历史
     * - 理解上下文语义
     * - 推断指代对象
     *
     * @param userInput 用户输入
     * @param references 需要消解的指代词列表
     * @param context 会话上下文
     * @return 消解结果
     */
    ReferenceResult resolveWithLLM(
            String userInput,
            List<String> references,
            ConversationContext context);

    /**
     * 批量消解指代词
     *
     * @param userInput 用户输入
     * @param references 检测到的指代词列表
     * @param context 会话上下文
     * @return 消解结果映射 (指代词 -> 消解后文本)
     */
    Map<String, String> resolveBatch(
            String userInput,
            List<DetectedReference> references,
            ConversationContext context);

    /**
     * 检查输入是否包含需要消解的指代
     *
     * @param userInput 用户输入
     * @return true 如果包含需要消解的指代
     */
    boolean hasUnresolvedReferences(String userInput);

    /**
     * 获取支持的指代词模式
     *
     * @return 指代词模式列表
     */
    List<String> getSupportedPatterns();

    /**
     * 检查服务是否可用
     *
     * @return true 如果服务可用
     */
    boolean isAvailable();

    /**
     * 检查 LLM 消解是否可用
     *
     * @return true 如果 LLM 消解可用
     */
    boolean isLLMAvailable();

    // ==================== 内部类 ====================

    /**
     * 指代类型枚举
     */
    enum ReferenceType {
        /**
         * 代词指代: 它、他们、它们
         */
        PRONOUN,

        /**
         * 近指: 这个、这批、这家
         */
        PROXIMAL,

        /**
         * 远指: 那个、那批、那家
         */
        DISTAL,

        /**
         * 定指: 该批次、该供应商
         */
        DEFINITE,

        /**
         * 时间指代: 刚才、之前、上次
         */
        TEMPORAL,

        /**
         * 位置指代: 上面、前面
         */
        POSITIONAL,

        /**
         * 省略指代: 隐含的主语或宾语
         */
        ELLIPSIS,

        /**
         * 未知类型
         */
        UNKNOWN
    }

    /**
     * 检测到的指代词
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    class DetectedReference {
        /**
         * 指代词文本
         */
        private String text;

        /**
         * 指代类型
         */
        private ReferenceType type;

        /**
         * 在原文中的起始位置
         */
        private int startIndex;

        /**
         * 在原文中的结束位置
         */
        private int endIndex;

        /**
         * 预期的实体类型（如果可推断）
         */
        private String expectedEntityType;

        /**
         * 上下文线索
         */
        private String contextHint;
    }

    /**
     * 解析后的实体
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    class ResolvedEntity {
        /**
         * 实体类型
         */
        private String entityType;

        /**
         * 实体ID
         */
        private String entityId;

        /**
         * 实体名称/显示文本
         */
        private String entityName;

        /**
         * 解析来源
         */
        private String source;

        /**
         * 解析置信度
         */
        private double confidence;

        /**
         * 从哪一轮对话中获取
         */
        private Integer fromRound;

        /**
         * 实体附加信息
         */
        private Map<String, Object> metadata;
    }
}
