package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * LinUCB 臂参数表
 * 存储 LinUCB 算法的 A 矩阵、b 向量和 theta 参数
 *
 * LinUCB 核心公式:
 * UCB_a(t) = x^T * theta + alpha * sqrt(x^T * A^{-1} * x)
 * 其中:
 * - x 是上下文特征向量 (用户特征 + 商品特征)
 * - theta = A^{-1} * b 是预测参数
 * - A^{-1} * x 用于计算不确定性奖励
 *
 * 参数更新规则:
 * - A = A + x * x^T (外积累加)
 * - b = b + r * x (奖励加权累加)
 */
@Data
@TableName("linucb_arm_parameters")
@EqualsAndHashCode(callSuper = true)
public class LinUCBArmParameter extends Model<LinUCBArmParameter> {
    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 臂ID (分类ID或商品ID)
     */
    private String armId;

    /**
     * 臂类型: category (分类级别) / product (商品级别)
     */
    private String armType;

    /**
     * A 矩阵 (d x d 矩阵，JSON格式存储)
     * 初始值为单位矩阵 I_d
     * 格式: [[1,0,0,...], [0,1,0,...], ...]
     */
    @TableField("a_matrix")
    private String aMatrix;

    /**
     * b 向量 (d 维向量，JSON格式存储)
     * 初始值为零向量
     * 格式: [0, 0, 0, ...]
     */
    @TableField("b_vector")
    private String bVector;

    /**
     * theta 参数向量 (d 维向量，JSON格式存储)
     * theta = A^{-1} * b
     * 格式: [0.1, 0.05, -0.02, ...]
     */
    private String thetaVector;

    /**
     * 特征维度 d
     */
    private Integer featureDimension;

    /**
     * 被选择次数
     */
    private Integer selectionCount;

    /**
     * 正向反馈次数 (点击/购买)
     */
    private Integer positiveFeedbackCount;

    /**
     * 负向反馈次数 (曝光未点击)
     */
    private Integer negativeFeedbackCount;

    /**
     * 累积奖励
     */
    private BigDecimal cumulativeReward;

    /**
     * 预期点击率 (根据历史数据计算)
     */
    private BigDecimal expectedCtr;

    /**
     * 算法版本
     */
    private String algorithmVersion;

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
