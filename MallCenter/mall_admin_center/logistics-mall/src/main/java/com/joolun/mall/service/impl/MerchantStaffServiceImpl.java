package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.MerchantStaff;
import com.joolun.mall.mapper.MerchantStaffMapper;
import com.joolun.mall.service.MerchantStaffService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 商户员工 Service 实现类
 */
@Service
@RequiredArgsConstructor
public class MerchantStaffServiceImpl extends ServiceImpl<MerchantStaffMapper, MerchantStaff> implements MerchantStaffService {

    @Override
    public List<Map<String, Object>> getStaffDetails(Long merchantId) {
        return baseMapper.selectStaffDetails(merchantId);
    }
}




