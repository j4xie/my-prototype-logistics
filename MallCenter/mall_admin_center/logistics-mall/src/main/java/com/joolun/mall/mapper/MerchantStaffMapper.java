package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.MerchantStaff;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

/**
 * 商户员工Mapper接口
 */
@Mapper
public interface MerchantStaffMapper extends BaseMapper<MerchantStaff> {

    /**
     * 查询商户员工详情
     * @param merchantId 商户ID
     * @return 员工详情列表
     */
    List<Map<String, Object>> selectStaffDetails(@Param("merchantId") Long merchantId);
}