package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 组件样式实体
 */
@Data
@TableName("decoration_component_style")
@EqualsAndHashCode(callSuper = true)
public class DecorationComponentStyle extends Model<DecorationComponentStyle> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 样式名称
     */
    private String name;

    /**
     * 样式编码
     */
    private String code;

    /**
     * 组件类型: banner/product/navigation/category
     */
    private String componentType;

    /**
     * 样式描述
     */
    private String description;

    /**
     * 预览图URL
     */
    private String previewImage;

    /**
     * 样式配置 JSON
     */
    private String styleConfig;

    /**
     * 默认属性 JSON
     */
    private String defaultProps;

    /**
     * 适用风格标签，逗号分隔
     */
    private String styleTags;

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
