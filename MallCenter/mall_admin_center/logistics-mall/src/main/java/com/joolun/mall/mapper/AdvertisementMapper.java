package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.Advertisement;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 广告Mapper
 */
public interface AdvertisementMapper extends BaseMapper<Advertisement> {

    /**
     * 分页查询广告
     */
    IPage<Advertisement> selectPage1(IPage<Advertisement> page, @Param("query") Advertisement ad);

    /**
     * 按类型查询有效广告
     */
    List<Advertisement> selectActiveByType(String type);

    /**
     * 获取当前有效的启动广告
     */
    Advertisement selectActiveSplashAd();
}
