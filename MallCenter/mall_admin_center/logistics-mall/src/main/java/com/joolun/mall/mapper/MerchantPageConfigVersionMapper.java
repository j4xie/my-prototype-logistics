package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.MerchantPageConfigVersion;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 商户页面配置版本Mapper
 */
public interface MerchantPageConfigVersionMapper extends BaseMapper<MerchantPageConfigVersion> {

    /**
     * 查询商户指定页面的版本列表（按版本号倒序，最多20条）
     */
    List<MerchantPageConfigVersion> selectVersions(
            @Param("merchantId") Long merchantId,
            @Param("pageType") String pageType);

    /**
     * 获取当前最大版本号
     */
    Integer selectMaxVersionNo(
            @Param("merchantId") Long merchantId,
            @Param("pageType") String pageType);

    /**
     * 删除超出保留数量的旧版本（保留最近 keepCount 条）
     */
    int deleteOldVersions(
            @Param("merchantId") Long merchantId,
            @Param("pageType") String pageType,
            @Param("keepCount") int keepCount);
}
