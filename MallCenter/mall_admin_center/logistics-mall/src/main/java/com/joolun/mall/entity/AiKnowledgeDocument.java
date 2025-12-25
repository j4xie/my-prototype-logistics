package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * AI知识库文档 - 对齐 V4.0 SQL: ai_knowledge_document
 */
@Data
@TableName("ai_knowledge_document")
@EqualsAndHashCode(callSuper = true)
public class AiKnowledgeDocument extends Model<AiKnowledgeDocument> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 分类ID
     */
    @TableField("category_id")
    private Long categoryId;

    /**
     * 文档标题
     */
    private String title;

    /**
     * 文档内容
     */
    private String content;

    /**
     * 摘要
     */
    private String summary;

    /**
     * 关键词（逗号分隔）
     */
    private String keywords;

    /**
     * 来源
     */
    private String source;

    /**
     * 原始文件URL
     */
    @TableField("file_url")
    private String fileUrl;

    /**
     * 文件类型
     */
    @TableField("file_type")
    private String fileType;

    /**
     * 向量化状态：0未处理 1处理中 2已完成 3失败
     */
    @TableField("vector_status")
    private Integer vectorStatus;

    /**
     * 向量库ID
     */
    @TableField("vector_id")
    private String vectorId;

    /**
     * 查看次数
     */
    @TableField("view_count")
    private Integer viewCount;

    /**
     * 点赞次数
     */
    @TableField("like_count")
    private Integer likeCount;

    /**
     * 状态：0草稿 1发布
     */
    private Integer status;

    /**
     * 创建人
     */
    @TableField("create_by")
    private Long createBy;

    /**
     * 创建时间
     */
    @TableField("create_time")
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField("update_time")
    private LocalDateTime updateTime;

    /**
     * 删除标记
     */
    @TableLogic
    @TableField("del_flag")
    private Integer delFlag;
}
