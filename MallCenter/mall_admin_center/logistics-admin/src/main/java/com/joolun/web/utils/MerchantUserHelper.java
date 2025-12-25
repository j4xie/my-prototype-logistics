package com.joolun.web.utils;

import com.joolun.mall.entity.Merchant;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.weixin.entity.WxUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 商户-用户关联查询工具类
 * 用于从微信用户获取关联的商户ID
 *
 * @author JL
 * @date 2024-12-25
 */
@Slf4j
@Component
public class MerchantUserHelper {

    private final MerchantMapper merchantMapper;

    public MerchantUserHelper(MerchantMapper merchantMapper) {
        this.merchantMapper = merchantMapper;
    }

    /**
     * 根据微信用户获取关联的商户ID
     *
     * @param wxUser 微信用户
     * @return 商户ID，如果未关联则返回null
     */
    public Long getMerchantIdFromUser(WxUser wxUser) {
        if (wxUser == null || wxUser.getId() == null) {
            return null;
        }

        try {
            Merchant merchant = merchantMapper.selectByUserId(Long.parseLong(wxUser.getId()));
            return merchant != null ? merchant.getId() : null;
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
            return merchantMapper.selectByUserId(Long.parseLong(wxUser.getId()));
        } catch (Exception e) {
            log.error("查询用户关联商户失败: userId={}", wxUser.getId(), e);
            return null;
        }
    }
}
