package com.joolun.web.utils;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.MerchantStaff;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.mapper.MerchantStaffMapper;
import com.joolun.weixin.entity.WxUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 商户-用户关联查询工具类
 * 查询优先级: merchant.user_id (店主) → merchant_staff.user_id (员工)
 *
 * @author JL
 * @date 2024-12-25
 */
@Slf4j
@Component
public class MerchantUserHelper {

    private final MerchantMapper merchantMapper;
    private final MerchantStaffMapper merchantStaffMapper;

    public MerchantUserHelper(MerchantMapper merchantMapper, MerchantStaffMapper merchantStaffMapper) {
        this.merchantMapper = merchantMapper;
        this.merchantStaffMapper = merchantStaffMapper;
    }

    /**
     * 根据微信用户获取关联的商户ID
     * 先查 merchant 表（店主），再查 merchant_staff 表（员工）
     *
     * @param wxUser 微信用户
     * @return 商户ID，如果未关联则返回null
     */
    public Long getMerchantIdFromUser(WxUser wxUser) {
        if (wxUser == null || wxUser.getId() == null) {
            return null;
        }

        try {
            Long userId = Long.parseLong(wxUser.getId());

            // 1. 先查店主
            Merchant merchant = merchantMapper.selectByUserId(userId);
            if (merchant != null) {
                return merchant.getId();
            }

            // 2. 再查员工表
            MerchantStaff staff = merchantStaffMapper.selectOne(
                    new LambdaQueryWrapper<MerchantStaff>()
                            .eq(MerchantStaff::getUserId, userId)
                            .eq(MerchantStaff::getStatus, 1)
                            .last("LIMIT 1"));
            return staff != null ? staff.getMerchantId() : null;
        } catch (Exception e) {
            log.error("查询用户关联商户失败: userId={}", wxUser.getId(), e);
            return null;
        }
    }

    /**
     * 根据微信用户获取关联的商户
     *
     * @param wxUser 微信用户
     * @return 商户实体，如果未关联则返回null
     */
    public Merchant getMerchantFromUser(WxUser wxUser) {
        if (wxUser == null || wxUser.getId() == null) {
            return null;
        }

        try {
            Long userId = Long.parseLong(wxUser.getId());

            // 1. 先查店主
            Merchant merchant = merchantMapper.selectByUserId(userId);
            if (merchant != null) {
                return merchant;
            }

            // 2. 再查员工表，找到 merchantId 后查 merchant
            MerchantStaff staff = merchantStaffMapper.selectOne(
                    new LambdaQueryWrapper<MerchantStaff>()
                            .eq(MerchantStaff::getUserId, userId)
                            .eq(MerchantStaff::getStatus, 1)
                            .last("LIMIT 1"));
            if (staff != null) {
                return merchantMapper.selectById(staff.getMerchantId());
            }
            return null;
        } catch (Exception e) {
            log.error("查询用户关联商户失败: userId={}", wxUser.getId(), e);
            return null;
        }
    }
}
