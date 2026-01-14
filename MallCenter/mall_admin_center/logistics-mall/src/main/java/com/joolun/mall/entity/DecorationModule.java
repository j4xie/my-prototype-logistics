package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 页面模块实体
 */
@Data
@TableName("decoration_module")
@EqualsAndHashCode(callSuper = true)
public class DecorationModule extends Model<DecorationModule> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 模块名称
     */
    private String name;

    /**
     * 模块编码
     */
    private String code;

    /**
     * 模块类型
     */
    private String moduleType;

    /**
     * 组件名称
     */
    private String componentName;

    /**
     * WXML模板
     */
    private String wxmlTemplate;

    /**
     * WXSS模板
     */
    private String wxssTemplate;

    /**
     * 参数Schema JSON
     */
    private String paramsSchema;

    /**
     * 默认参数 JSON
     */
    private String defaultParams;

    /**
     * 数据源类型
     */
    private String dataSourceType;

    /**
     * 数据源API
     */
    private String dataSourceApi;

    /**
     * 状态：0禁用 1启用
     */
    private Integer status;

    /**
     * 排序
     */
    private Integer sortOrder;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}
