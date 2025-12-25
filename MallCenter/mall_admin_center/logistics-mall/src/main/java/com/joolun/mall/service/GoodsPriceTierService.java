package com.joolun.mall.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.GoodsPriceTier;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 商品阶梯定价服务接口
 */
public interface GoodsPriceTierService extends IService<GoodsPriceTier> {

    /**
     * 获取商品的阶梯定价
     */
    List<GoodsPriceTier> listBySpuId(String spuId);

    /**
     * 保存商品的阶梯定价（先删后增）
     */
    boolean saveTiers(String spuId, List<GoodsPriceTier> tiers);

    /**
     * 计算指定数量的单价
     */
    BigDecimal calculatePrice(String spuId, Integer quantity);

    /**
     * 计算指定数量的总价和单价信息
     * @return { price: 单价, total: 总价, tier: 当前梯度, nextTier: 下一梯度信息 }
     */
    Map<String, Object> calculatePriceDetail(String spuId, Integer quantity);

    /**
     * 删除商品的所有阶梯定价
     */
    boolean deleteBySpuId(String spuId);
}
