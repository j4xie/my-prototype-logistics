package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 商户页面配置版本快照
 */
@Data
@TableName("merchant_page_config_version")
@EqualsAndHashCode(callSuper = true)
public class MerchantPageConfigVersion extends Model<MerchantPageConfigVersion> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 关联的页面配置ID */
    private Long configId;

    /** 商户ID */
    private Long merchantId;

    /** 页面类型 */
    private String pageType;

    /** 版本号 (递增) */
    private Integer versionNo;

    /** 快照：主题编码 */
    private String themeCode;

    /** 快照：自定义主题配置 JSON */
    private String customTheme;

    /** 快照：模块列表配置 JSON */
    private String modulesConfig;

    /** 快照：店铺名称 */
    private String shopName;

    /** 快照：宣传语 */
    private String slogan;

    /** 快照：通知文字 JSON */
    private String noticeTexts;

    /** 变更来源：chat/template/manual */
    private String changeSource;

    /** 变更描述 */
    private String changeDescription;

    /** 创建时间 */
    private LocalDateTime createTime;
}
