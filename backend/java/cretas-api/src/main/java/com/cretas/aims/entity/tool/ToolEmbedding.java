package com.cretas.aims.entity.tool;

import com.cretas.aims.util.VectorUtils;
import com.cretas.aims.util.converter.StringListConverter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 工具向量嵌入实体
 *
 * 存储工具的描述向量，用于动态工具选择的语义检索。
 * 当用户意图需要动态工具匹配时，系统会将用户查询向量化，
 * 然后与此表中的工具向量计算相似度，选择最合适的工具。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Entity
@Table(name = "tool_embeddings", indexes = {
    @Index(name = "idx_tool_name", columnList = "tool_name"),
    @Index(name = "idx_tool_category", columnList = "tool_category")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ToolEmbedding {

    /**
     * 主键 UUID
     */
    @Id
    @Column(length = 36)
    private String id;

    /**
     * 工具名称 (唯一标识，对应 ToolExecutor.getToolName())
     */
    @Column(name = "tool_name", nullable = false, unique = true)
    private String toolName;

    /**
     * 工具描述 (用于向量化和 LLM 选择)
     */
    @Column(name = "tool_description", columnDefinition = "TEXT")
    private String toolDescription;

    /**
     * 工具分类 (如: data_query, form_assist, production, etc.)
     */
    @Column(name = "tool_category")
    private String toolCategory;

    /**
     * 工具描述的向量嵌入 (序列化的 float[])
     * 使用 MEDIUMBLOB 存储，最大 16MB
     */
    @Column(name = "embedding_vector", columnDefinition = "MEDIUMBLOB")
    @Lob
    private byte[] embeddingVector;

    /**
     * 关键词列表 (用于快速过滤)
     * 存储为 JSON 数组
     */
    @Column(name = "keywords", columnDefinition = "json")
    @Convert(converter = StringListConverter.class)
    private List<String> keywords;

    /**
     * 使用次数统计
     */
    @Column(name = "usage_count")
    @Builder.Default
    private Integer usageCount = 0;

    /**
     * 平均执行时间 (毫秒)
     */
    @Column(name = "avg_execution_time_ms")
    private Integer avgExecutionTimeMs;

    /**
     * 最后使用时间
     */
    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    /**
     * 创建时间
     */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 创建前自动填充
     */
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }

    /**
     * 更新前自动填充
     */
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // ==================== 向量序列化/反序列化 ====================

    /**
     * 获取向量嵌入 (反序列化)
     *
     * @return float[] 向量数组
     */
    public float[] getEmbeddingAsFloats() {
        return VectorUtils.deserializeEmbedding(embeddingVector);
    }

    /**
     * 设置向量嵌入 (序列化)
     *
     * @param embedding float[] 向量数组
     */
    public void setEmbeddingFromFloats(float[] embedding) {
        this.embeddingVector = VectorUtils.serializeEmbedding(embedding);
    }
}
