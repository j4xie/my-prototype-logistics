package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.Advertisement;

import java.util.List;
import java.util.Map;

/**
 * 广告服务接口
 */
public interface AdvertisementService extends IService<Advertisement> {

    /**
     * 分页查询广告
     */
    IPage<Advertisement> page1(IPage<Advertisement> page, Advertisement ad);

    /**
     * 按类型查询有效广告
     */
    List<Advertisement> listActiveByType(String type);

    /**
     * 获取当前有效的启动广告
     */
    Advertisement getSplashAd();

    /**
     * 获取首页Banner列表
     */
    List<Advertisement> getHomeBanners();

    /**
     * 记录广告点击
     */
    boolean recordClick(Long id);

    /**
     * 记录广告展示
     */
    boolean recordView(Long id);

    /**
     * 更新广告状态（上下线）
     */
    boolean updateStatus(Long id, Integer status);

    /**
     * 获取广告统计数据
     */
    Map<String, Object> getStats(Long id);
}
