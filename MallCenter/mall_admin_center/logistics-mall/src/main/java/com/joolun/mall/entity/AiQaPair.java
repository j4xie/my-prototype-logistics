package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * AI知识库问答对 - 对齐 V4.0 SQL: ai_qa_pair
 */
@Data
@TableName("ai_qa_pair")
@EqualsAndHashCode(callSuper = true)
public class AiQaPair extends Model<AiQaPair> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 分类ID
     */
    @TableField("category_id")
    private Long categoryId;

    /**
     * 问题
     */
    private String question;

    /**
     * 答案
     */
    private String answer;

    /**
     * 关键词
     */
    private String keywords;

    /**
     * 命中次数
     */
    @TableField("hit_count")
    private Integer hitCount;

    /**
     * 点赞次数
     */
    @TableField("like_count")
    private Integer likeCount;

    /**
     * 踩次数
     */
    @TableField("dislike_count")
    private Integer dislikeCount;

    /**
     * 状态：0停用 1启用
     */
    private Integer status;

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
