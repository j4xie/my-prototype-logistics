package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import com.joolun.common.annotation.Excel;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 广告
 */
@Data
@TableName("advertisement")
@EqualsAndHashCode(callSuper = true)
public class Advertisement extends Model<Advertisement> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 类型：splash_ad/home_banner/detail_bottom
     */
    @Excel(name = "类型")
    private String type;

    /**
     * 标题
     */
    @Excel(name = "标题")
    private String title;

    /**
     * 描述
     */
    private String description;

    /**
     * 图片URL
     */
    private String imageUrl;

    /**
     * 视频URL
     */
    private String videoUrl;

    /**
     * 链接类型：product/url/miniprogram/none
     */
    private String linkType;

    /**
     * 链接值
     */
    private String linkValue;

    /**
     * 位置/排序
     */
    private Integer position;

    /**
     * 开始时间
     */
    private LocalDateTime startTime;

    /**
     * 结束时间
     */
    private LocalDateTime endTime;

    /**
     * 状态：0下线 1上线
     */
    @Excel(name = "状态")
    private Integer status;

    /**
     * 展示次数
     */
    private Integer viewCount;

    /**
     * 点击次数
     */
    private Integer clickCount;

    /**
     * 创建人
     */
    private Long createBy;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}
