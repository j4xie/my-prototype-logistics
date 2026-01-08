package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.Merchant;
import org.apache.ibatis.annotations.Mapper;

/**
 * 商户Mapper接口
 */
@Mapper
public interface MerchantMapper extends BaseMapper<Merchant> {
}