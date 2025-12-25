package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.GoodsPriceTier;
import com.joolun.mall.mapper.GoodsPriceTierMapper;
import com.joolun.mall.service.GoodsPriceTierService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 商品阶梯定价服务实现
 */
@Service
public class GoodsPriceTierServiceImpl extends ServiceImpl<GoodsPriceTierMapper, GoodsPriceTier> implements GoodsPriceTierService {

    @Override
    public List<GoodsPriceTier> listBySpuId(String spuId) {
        LambdaQueryWrapper<GoodsPriceTier> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsPriceTier::getSpuId, spuId)
               .orderByAsc(GoodsPriceTier::getMinQuantity);
        return baseMapper.selectList(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean saveTiers(String spuId, List<GoodsPriceTier> tiers) {
        // 先删除原有的阶梯定价
        deleteBySpuId(spuId);

        // 保存新的阶梯定价
        if (tiers != null && !tiers.isEmpty()) {
            for (GoodsPriceTier tier : tiers) {
                tier.setSpuId(spuId);
                tier.setCreateTime(LocalDateTime.now());
                baseMapper.insert(tier);
            }
        }
        return true;
    }

    @Override
    public BigDecimal calculatePrice(String spuId, Integer quantity) {
        List<GoodsPriceTier> tiers = listBySpuId(spuId);

        if (tiers.isEmpty()) {
            return null; // 没有阶梯定价，使用商品原价
        }

        // 找到匹配的阶梯
        for (int i = tiers.size() - 1; i >= 0; i--) {
            GoodsPriceTier tier = tiers.get(i);
            if (quantity >= tier.getMinQuantity()) {
                if (tier.getMaxQuantity() == null || quantity <= tier.getMaxQuantity()) {
                    return tier.getPrice();
                }
            }
        }

        // 如果数量小于最低阶梯，返回第一个阶梯的价格
        return tiers.get(0).getPrice();
    }

    @Override
    public Map<String, Object> calculatePriceDetail(String spuId, Integer quantity) {
        Map<String, Object> result = new HashMap<>();
        List<GoodsPriceTier> tiers = listBySpuId(spuId);

        if (tiers.isEmpty()) {
            result.put("hasTier", false);
            return result;
        }

        result.put("hasTier", true);
        result.put("tiers", tiers);

        GoodsPriceTier currentTier = null;
        GoodsPriceTier nextTier = null;

        // 找到当前阶梯和下一个阶梯
        for (int i = 0; i < tiers.size(); i++) {
            GoodsPriceTier tier = tiers.get(i);
            if (quantity >= tier.getMinQuantity()) {
                if (tier.getMaxQuantity() == null || quantity <= tier.getMaxQuantity()) {
                    currentTier = tier;
                    if (i + 1 < tiers.size()) {
                        nextTier = tiers.get(i + 1);
                    }
                    break;
                }
            } else {
                // 数量小于当前阶梯，使用第一个阶梯
                currentTier = tiers.get(0);
                if (tiers.size() > 1) {
                    nextTier = tiers.get(1);
                }
                break;
            }
        }

        if (currentTier != null) {
            result.put("price", currentTier.getPrice());
            result.put("total", currentTier.getPrice().multiply(new BigDecimal(quantity)));
            result.put("tier", currentTier);
        }

        if (nextTier != null) {
            result.put("nextTier", nextTier);
            result.put("nextTierSaving", currentTier.getPrice().subtract(nextTier.getPrice()));
            result.put("quantityToNextTier", nextTier.getMinQuantity() - quantity);
        }

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteBySpuId(String spuId) {
        LambdaQueryWrapper<GoodsPriceTier> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsPriceTier::getSpuId, spuId);
        return baseMapper.delete(wrapper) >= 0;
    }
}
