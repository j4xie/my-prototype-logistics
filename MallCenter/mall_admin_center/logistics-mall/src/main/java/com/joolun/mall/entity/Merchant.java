package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import com.joolun.common.annotation.Excel;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 商户表
 */
@Data
@TableName("merchant")
@EqualsAndHashCode(callSuper = true)
public class Merchant extends Model<Merchant> {
    private static final long serialVersionUID = 1L;

    /**
     * 商户ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 关联用户ID
     */
    private Long userId;

    /**
     * 商户编号
     */
    @Excel(name = "商户编号")
    private String merchantNo;

    /**
     * 商户名称
     */
    @Excel(name = "商户名称")
    private String merchantName;

    /**
     * 简称
     */
    private String shortName;

    /**
     * Logo图片
     */
    private String logoUrl;

    /**
     * 营业执照号
     */
    @Excel(name = "营业执照号")
    private String licenseNo;

    /**
     * 营业执照图片
     */
    private String licenseImage;

    /**
     * 法人姓名
     */
    @Excel(name = "法人姓名")
    private String legalPerson;

    /**
     * 法人身份证
     */
    private String legalIdCard;

    /**
     * 身份证正面
     */
    private String legalIdFront;

    /**
     * 身份证反面
     */
    private String legalIdBack;

    /**
     * 银行账户
     */
    private String bankAccount;

    /**
     * 开户银行
     */
    private String bankName;

    /**
     * 支行名称
     */
    private String bankBranch;

    /**
     * 联系人
     */
    @Excel(name = "联系人")
    private String contactName;

    /**
     * 联系电话
     */
    @Excel(name = "联系电话")
    private String contactPhone;

    /**
     * 联系邮箱
     */
    private String contactEmail;

    /**
     * 经营地址
     */
    private String address;

    /**
     * 公司类型：manufacturer/distributor/restaurant/retailer/other
     */
    private String companyType;

    /**
     * 联系人职位
     */
    private String position;

    /**
     * 预估采购量
     */
    private String purchaseVolume;

    /**
     * 备注信息
     */
    private String remarks;

    /**
     * 状态：0待审核 1已认证 2已封禁 3已注销
     */
    @Excel(name = "状态")
    private Integer status;

    /**
     * 推荐码（来源推荐人的推荐码）
     */
    private String referralCode;

    /**
     * 推荐人ID
     */
    private Long referrerId;

    /**
     * 评分
     */
    @Excel(name = "评分")
    private BigDecimal rating;

    /**
     * 好评率%
     */
    private BigDecimal reviewRate;

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
    private BigDecimal totalSales;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;

    /**
     * 删除标记
     */
    @TableLogic
    private Integer delFlag;
}
