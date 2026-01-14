package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.MerchantPageConfig;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 商户页面配置Mapper
 */
public interface MerchantPageConfigMapper extends BaseMapper<MerchantPageConfig> {

    /**
     * 分页查询商户页面配置
     */
    IPage<MerchantPageConfig> selectPage1(IPage<MerchantPageConfig> page, @Param("query") MerchantPageConfig query);

    /**
     * 查询商户指定页面类型的配置
     */
    MerchantPageConfig selectByMerchantAndPageType(@Param("merchantId") Long merchantId, @Param("pageType") String pageType);

    /**
     * 查询商户所有页面配置
     */
    List<MerchantPageConfig> selectByMerchantId(@Param("merchantId") Long merchantId);

    /**
     * 查询已发布的配置
     */
    MerchantPageConfig selectPublishedConfig(@Param("merchantId") Long merchantId, @Param("pageType") String pageType);
}
