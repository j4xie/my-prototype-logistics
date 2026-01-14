package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 图标库实体
 */
@Data
@TableName("decoration_icon_library")
@EqualsAndHashCode(callSuper = true)
public class DecorationIconLibrary extends Model<DecorationIconLibrary> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 图标名称
     */
    private String name;

    /**
     * 图标编码
     */
    private String code;

    /**
     * 图标URL或SVG内容
     */
    private String iconContent;

    /**
     * 图标类型: svg/png/iconfont
     */
    private String iconType;

    /**
     * 分类: navigation/action/social/commerce
     */
    private String category;

    /**
     * 标签，逗号分隔
     */
    private String tags;

    /**
     * 默认颜色
     */
    private String defaultColor;

    /**
     * 默认大小(px)
     */
    private Integer defaultSize;

    /**
     * 状态：0禁用 1启用
     */
    private Integer status;

    /**
     * 排序
     */
    private Integer sortOrder;

    /**
     * 使用次数
     */
    private Integer useCount;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;
}
