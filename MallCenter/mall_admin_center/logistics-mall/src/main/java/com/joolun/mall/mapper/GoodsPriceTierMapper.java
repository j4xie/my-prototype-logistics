package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.GoodsPriceTier;

import java.util.List;

/**
 * 商品阶梯定价Mapper
 */
public interface GoodsPriceTierMapper extends BaseMapper<GoodsPriceTier> {

    /**
     * 根据SPU ID查询阶梯定价
     */
    List<GoodsPriceTier> selectBySpuId(Long spuId);

    /**
     * 删除SPU的所有阶梯定价
     */
    int deleteBySpuId(Long spuId);
}
