package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.Map;

/**
 * 自然语言查询请求 DTO
 *
 * 用于接收用户的自然语言查询，支持：
 * - 自然语言问答
 * - 上下文感知
 * - 时间范围筛选
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NLQueryRequest {

    /**
     * 用户输入的自然语言查询
     * 例如："本月销售额是多少？"、"哪个部门业绩最好？"
     */
    @NotBlank(message = "查询内容不能为空")
    private String query;

    /**
     * 工厂 ID
     */
    private String factoryId;

    /**
     * 会话 ID（可选，用于上下文关联）
     * 用于支持多轮对话时的上下文记忆
     */
    private String sessionId;

    /**
     * 查询文本（兼容旧版本）
     * @deprecated 请使用 query 字段
     */
    @Deprecated
    private String queryText;

    /**
     * 上下文信息
     * 可包含当前页面、已选筛选条件等上下文参数
     */
    private Map<String, Object> context;

    /**
     * 查询时间范围 - 开始日期（可选）
     * 用于限定数据查询的时间范围
     */
    private LocalDate startDate;

    /**
     * 查询时间范围 - 结束日期（可选）
     * 用于限定数据查询的时间范围
     */
    private LocalDate endDate;

    /**
     * 获取有效的查询文本
     * 优先返回 query 字段，兼容旧版 queryText
     *
     * @return 查询文本
     */
    public String getEffectiveQuery() {
        return query != null && !query.isBlank() ? query : queryText;
    }
}
