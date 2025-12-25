package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.Merchant;
import org.apache.ibatis.annotations.Param;

/**
 * 商户Mapper
 */
public interface MerchantMapper extends BaseMapper<Merchant> {

    /**
     * 分页查询商户
     */
    IPage<Merchant> selectPage1(IPage<Merchant> page, @Param("query") Merchant merchant);

    /**
     * 根据ID查询商户详情
     */
    Merchant selectById1(Long id);

    /**
     * 根据用户ID查询商户
     */
    Merchant selectByUserId(Long userId);

    /**
     * 根据商户编号查询
     */
    Merchant selectByMerchantNo(String merchantNo);
}
