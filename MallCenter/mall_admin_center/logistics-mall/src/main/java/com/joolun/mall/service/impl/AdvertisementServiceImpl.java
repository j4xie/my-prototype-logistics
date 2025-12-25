package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.Advertisement;
import com.joolun.mall.mapper.AdvertisementMapper;
import com.joolun.mall.service.AdvertisementService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 广告服务实现
 */
@Service
public class AdvertisementServiceImpl extends ServiceImpl<AdvertisementMapper, Advertisement> implements AdvertisementService {

    @Override
    public IPage<Advertisement> page1(IPage<Advertisement> page, Advertisement ad) {
        return baseMapper.selectPage1(page, ad);
    }

    @Override
    public List<Advertisement> listActiveByType(String type) {
        return baseMapper.selectActiveByType(type);
    }

    @Override
    public Advertisement getSplashAd() {
        return baseMapper.selectActiveSplashAd();
    }

    @Override
    public List<Advertisement> getHomeBanners() {
        return listActiveByType("banner");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean recordClick(Long id) {
        Advertisement ad = baseMapper.selectById(id);
        if (ad != null) {
            ad.setClickCount(ad.getClickCount() + 1);
            ad.setUpdateTime(LocalDateTime.now());
            return baseMapper.updateById(ad) > 0;
        }
        return false;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean recordView(Long id) {
        Advertisement ad = baseMapper.selectById(id);
        if (ad != null) {
            ad.setViewCount(ad.getViewCount() + 1);
            ad.setUpdateTime(LocalDateTime.now());
            return baseMapper.updateById(ad) > 0;
        }
        return false;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateStatus(Long id, Integer status) {
        Advertisement ad = new Advertisement();
        ad.setId(id);
        ad.setStatus(status);
        ad.setUpdateTime(LocalDateTime.now());
        return baseMapper.updateById(ad) > 0;
    }

    @Override
    public Map<String, Object> getStats(Long id) {
        Advertisement ad = baseMapper.selectById(id);
        Map<String, Object> stats = new HashMap<>();
        if (ad != null) {
            stats.put("viewCount", ad.getViewCount());
            stats.put("clickCount", ad.getClickCount());
            // 计算点击率
            if (ad.getViewCount() > 0) {
                double ctr = (double) ad.getClickCount() / ad.getViewCount() * 100;
                stats.put("ctr", String.format("%.2f%%", ctr));
            } else {
                stats.put("ctr", "0.00%");
            }
        }
        return stats;
    }
}
