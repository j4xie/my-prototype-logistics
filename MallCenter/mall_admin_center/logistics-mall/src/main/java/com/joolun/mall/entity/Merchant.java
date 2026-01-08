package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 商户实体类
 */
@Data
@TableName("merchant")
@EqualsAndHashCode(callSuper = true)
public class Merchant extends Model<Merchant> {
    private static final long serialVersionUID = 1L;

    /**
     * ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 商户名称
     */
    private String merchantName;

    /**
     * 公司类型
     */
    private String companyType;

    /**
     * 地址
     */
    private String address;

    /**
     * 经营年限
     */
    private Integer operatingYears;

    /**
     * 商品数量
     */
    private Integer productCount;

    /**
     * 订单数量
     */
    private Integer orderCount;

    /**
     * 总销售额
     */
    private Double totalSales;

    /**
     * 评分
     */
    private Double rating;

    /**
     * 好评率
     */
    private Double reviewRate;

    /**
     * 状态
     */
    private Integer status;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}