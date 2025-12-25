package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.List;

/**
 * AI知识库分类 - 对齐 V4.0 SQL: ai_knowledge_category
 */
@Data
@TableName("ai_knowledge_category")
@EqualsAndHashCode(callSuper = true)
public class AiKnowledgeCategory extends Model<AiKnowledgeCategory> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 父分类ID
     */
    @TableField("parent_id")
    private Long parentId;

    /**
     * 分类名称
     */
    @TableField("category_name")
    private String categoryName;

    /**
     * 分类编码
     */
    @TableField("category_code")
    private String categoryCode;

    /**
     * 描述
     */
    private String description;

    /**
     * 图标
     */
    private String icon;

    /**
     * 排序
     */
    private Integer sort;

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

    /**
     * 子分类（非数据库字段，用于树形结构）
     */
    @TableField(exist = false)
    private List<AiKnowledgeCategory> children;
}
