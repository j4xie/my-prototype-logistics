package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Agent 间通信消息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentMessage {

    /**
     * 消息ID
     */
    private String messageId;

    /**
     * 原始用户查询
     */
    private String userQuery;

    /**
     * 分析上下文
     */
    private AnalysisContext context;

    /**
     * 检索到的数据
     */
    @Builder.Default
    private Map<String, Object> retrievedData = new HashMap<>();

    /**
     * 分析结果文本
     */
    private String analysisResult;

    /**
     * 审核评论
     */
    @Builder.Default
    private List<String> reviewComments = new ArrayList<>();

    /**
     * 当前处理阶段
     */
    private AgentStage currentStage;

    /**
     * 错误信息
     */
    private String errorMessage;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 添加审核评论
     */
    public void addReviewComments(List<String> comments) {
        if (comments != null) {
            this.reviewComments.addAll(comments);
        }
    }

    /**
     * 转换为分析结果
     */
    public AnalysisResult toAnalysisResult() {
        return AnalysisResult.builder()
                .success(errorMessage == null)
                .formattedAnalysis(analysisResult)
                .dataSummary(retrievedData)
                .topic(context != null ? context.getTopic() : null)
                .errorMessage(errorMessage)
                .build();
    }

    /**
     * 从分析上下文创建消息
     */
    public static AgentMessage create(AnalysisContext context) {
        return AgentMessage.builder()
                .messageId(java.util.UUID.randomUUID().toString())
                .userQuery(context.getUserInput())
                .context(context)
                .currentStage(AgentStage.RETRIEVAL)
                .createdAt(LocalDateTime.now())
                .build();
    }

    /**
     * Agent 处理阶段
     */
    public enum AgentStage {
        RETRIEVAL,    // 检索阶段
        EVALUATION,   // 评估阶段
        ANALYSIS,     // 分析阶段
        REVIEW,       // 审核阶段
        COMPLETED     // 完成
    }
}
