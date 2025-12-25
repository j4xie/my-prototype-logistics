package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.MerchantStaff;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 商户员工 Mapper 接口
 */
@Mapper
public interface MerchantStaffMapper extends BaseMapper<MerchantStaff> {

    @Select("SELECT ms.*, wu.nick_name as name, wu.phone, wu.headimg_url as avatar " +
            "FROM merchant_staff ms " +
            "LEFT JOIN wx_user wu ON ms.user_id = wu.id " +
            "WHERE ms.merchant_id = #{merchantId}")
    List<Map<String, Object>> selectStaffDetails(@Param("merchantId") Long merchantId);
}

