package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 用户聚类分配表
 * 记录用户与聚类的对应关系
 */
@Data
@TableName("user_cluster_assignments")
@EqualsAndHashCode(callSuper = true)
public class UserClusterAssignment extends Model<UserClusterAssignment> {
    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 微信用户ID
     */
    private String wxUserId;

    /**
     * 聚类ID
     */
    private Long clusterId;

    /**
     * 用户特征向量 (JSON: [0.1, 0.2, ...])
     */
    private String featureVector;

    /**
     * 到聚类中心的距离
     */
    private Double distanceToCentroid;

    /**
     * 分配置信度 (0-1, 基于距离比计算)
     */
    private Double confidence;

    /**
     * 次近聚类ID (用于边界用户识别)
     */
    private Long secondNearestClusterId;

    /**
     * 到次近聚类的距离
     */
    private Double distanceToSecondNearest;

    /**
     * 聚类版本号 (与UserCluster.version对应)
     */
    private Integer version;

    /**
     * 是否边界用户 (两个聚类距离相近)
     */
    private Boolean boundaryUser;

    /**
     * 分配时间
     */
    private LocalDateTime assignmentTime;

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
