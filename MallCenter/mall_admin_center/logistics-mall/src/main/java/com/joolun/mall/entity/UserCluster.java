package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 用户聚类表
 * 存储K-Means聚类结果的聚类中心信息
 */
@Data
@TableName("user_clusters")
@EqualsAndHashCode(callSuper = true)
public class UserCluster extends Model<UserCluster> {
    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 聚类名称 (如: 火锅店采购、快餐店采购)
     */
    private String clusterName;

    /**
     * 聚类描述
     */
    private String description;

    /**
     * 聚类中心向量 (JSON: [0.1, 0.2, ...])
     * 16维特征向量
     */
    private String centroidVector;

    /**
     * 聚类成员数量
     */
    private Integer memberCount;

    /**
     * 聚类平均距离 (聚类内平均距离，衡量紧凑程度)
     */
    private Double avgDistance;

    /**
     * 聚类主要特征标签 (JSON: {"主要品类": ["肉类", "火锅底料"], "价格偏好": "中高"})
     */
    private String featureLabels;

    /**
     * 推荐品类 (JSON: ["肉类", "火锅底料", "蔬菜"])
     */
    private String recommendCategories;

    /**
     * 聚类版本号 (每次重新聚类+1)
     */
    private Integer version;

    /**
     * 是否激活 (最新版本的聚类激活)
     */
    private Boolean active;

    /**
     * 最后聚类时间
     */
    private LocalDateTime lastClusterTime;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
