package com.joolun.mall.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.MerchantStaff;

import java.util.List;
import java.util.Map;

/**
 * 商户员工 Service 接口
 */
public interface MerchantStaffService extends IService<MerchantStaff> {
    
    /**
     * 获取商户员工详情列表（包含用户信息）
     * @param merchantId 商户ID
     * @return 员工详情列表
     */
    List<Map<String, Object>> getStaffDetails(Long merchantId);
}

























