package com.cretas.aims.service;

import com.cretas.aims.dto.intent.IntentMatchResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 动态工具选择服务接口 (模块D)
 *
 * 当意图匹配服务无法明确绑定工具时，使用向量检索 + LLM 精选的方式
 * 动态选择最合适的工具组合。
 *
 * 工作流程:
 * 1. 判断是否需要动态选择 (requiresDynamicSelection)
 * 2. 向量检索候选工具 (retrieveCandidateTools)
 * 3. LLM 精选工具 (selectTools)
 * 4. 执行工具链 (executeToolChain)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
public interface ToolRouterService {

    /**
     * 判断是否需要动态工具选择
     *
     * 触发条件:
     * 1. 意图匹配结果没有绑定工具
     * 2. 识别为复杂意图 (需要多个工具配合)
     * 3. 识别为多意图 (用户请求包含多个操作)
     *
     * @param intentResult 意图匹配结果
     * @return true 表示需要动态选择工具
     */
    boolean requiresDynamicSelection(IntentMatchResult intentResult);

    /**
     * 向量检索候选工具
     *
     * 将用户查询向量化，与工具向量计算余弦相似度，
     * 返回相似度最高的 Top K 个工具作为候选。
     *
     * @param query 用户查询文本
     * @param topK  返回的最大工具数量
     * @return 候选工具列表 (按相似度降序)
     */
    List<ToolCandidate> retrieveCandidateTools(String query, int topK);

    /**
     * LLM 精选工具
     *
     * 使用 LLM 从候选工具中选择最合适的工具组合，
     * 并确定执行顺序 (并行/串行)。
     *
     * @param query        用户查询文本
     * @param intentResult 意图匹配结果 (提供上下文)
     * @param candidates   候选工具列表
     * @return 选中的工具组合
     */
    SelectedTools selectTools(String query, IntentMatchResult intentResult,
                              List<ToolCandidate> candidates);

    /**
     * 执行工具链
     *
     * 按照选定的执行顺序调用工具，收集结果。
     * - PARALLEL: 并行执行所有工具
     * - SEQUENTIAL: 按 order 顺序串行执行
     *
     * @param selectedTools 选中的工具组合
     * @param context       执行上下文 (包含用户ID、工厂ID等)
     * @return 工具执行结果
     */
    Object executeToolChain(SelectedTools selectedTools, Map<String, Object> context);

    /**
     * 初始化工具向量 (启动时调用)
     *
     * 遍历所有注册的工具，对未生成向量的工具调用 EmbeddingClient 生成向量，
     * 并存入数据库和内存缓存。
     */
    void initializeToolEmbeddings();

    /**
     * 使用 ArenaRL 锦标赛进行工具选择歧义裁决
     *
     * 当 top1-top2 相似度差 < 0.10 时触发:
     * - 输入: 用户查询 + 歧义候选工具列表
     * - 输出: 锦标赛裁决的最佳工具
     *
     * @param query 用户查询
     * @param candidates 歧义候选工具列表 (已按相似度排序)
     * @return ArenaRL 裁决结果
     */
    default ArenaRLToolResult disambiguateToolsWithArenaRL(String query, List<ToolCandidate> candidates) {
        // 默认实现: 返回 top1 候选
        if (candidates == null || candidates.isEmpty()) {
            return ArenaRLToolResult.failure("No candidates provided");
        }
        ToolCandidate top = candidates.get(0);
        return ArenaRLToolResult.success(top.getToolName(), top.getSimilarity(),
                "ArenaRL not enabled, using top candidate", 0);
    }

    /**
     * ArenaRL 工具选择裁决结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class ArenaRLToolResult {
        /** 是否成功 */
        private boolean success;

        /** 获胜工具名称 */
        private String winnerToolName;

        /** 获胜工具的最终置信度 */
        private double winnerConfidence;

        /** 裁决理由 */
        private String reasoning;

        /** 错误信息 (如果失败) */
        private String errorMessage;

        /** 锦标赛比较次数 */
        private int comparisonCount;

        /** 锦标赛总耗时 (毫秒) */
        private long totalLatencyMs;

        /** 锦标赛ID (用于追踪) */
        private String tournamentId;

        public static ArenaRLToolResult success(String toolName, double confidence, String reasoning, int comparisons) {
            return ArenaRLToolResult.builder()
                    .success(true)
                    .winnerToolName(toolName)
                    .winnerConfidence(confidence)
                    .reasoning(reasoning)
                    .comparisonCount(comparisons)
                    .build();
        }

        public static ArenaRLToolResult failure(String errorMessage) {
            return ArenaRLToolResult.builder()
                    .success(false)
                    .errorMessage(errorMessage)
                    .build();
        }
    }

    // ==================== 内部数据类 ====================

    /**
     * 候选工具信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class ToolCandidate {
        /**
         * 工具名称
         */
        private String toolName;

        /**
         * 工具描述
         */
        private String toolDescription;

        /**
         * 工具分类
         */
        private String toolCategory;

        /**
         * 与查询的相似度 (0.0 - 1.0)
         */
        private double similarity;

        /**
         * 关键词列表
         */
        private List<String> keywords;
    }

    /**
     * LLM 选中的工具组合
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class SelectedTools {
        /**
         * 选中的工具列表
         */
        private List<SelectedTool> tools;

        /**
         * 执行顺序
         */
        private ExecutionOrder executionOrder;

        /**
         * 工具链描述 (LLM 生成的解释)
         */
        private String toolChainDescription;

        /**
         * 执行顺序枚举
         */
        public enum ExecutionOrder {
            /**
             * 并行执行 (工具之间无依赖)
             */
            PARALLEL,
            /**
             * 串行执行 (工具之间有依赖)
             */
            SEQUENTIAL
        }

        /**
         * 选中的单个工具
         */
        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class SelectedTool {
            /**
             * 工具名称
             */
            private String toolName;

            /**
             * 选择理由
             */
            private String reason;

            /**
             * 需要从上下文提取的参数
             */
            private List<String> paramsToExtract;

            /**
             * 执行顺序 (SEQUENTIAL 模式下使用)
             */
            private int order;
        }
    }
}
