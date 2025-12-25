package com.joolun.web.api;

import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.service.MerchantService;
import com.joolun.weixin.entity.ThirdSession;
import com.joolun.weixin.entity.WxUser;
import com.joolun.weixin.service.WxUserService;
import com.joolun.weixin.utils.ThirdSessionHolder;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 商户信息API - 小程序端
 * 提供商户信息查询和绑定功能
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/merchant")
public class MerchantInfoApi {

    private final MerchantService merchantService;
    private final MerchantMapper merchantMapper;
    private final WxUserService wxUserService;

    /**
     * 获取当前登录用户
     */
    private WxUser getCurrentWxUser() {
        ThirdSession session = ThirdSessionHolder.getThirdSession();
        if (session == null || session.getWxUserId() == null) {
            return null;
        }
        return wxUserService.getById(session.getWxUserId());
    }

    /**
     * 获取商户详情
     *
     * @param id 商户ID
     * @return 商户信息
     */
    @GetMapping("/{id}")
    public AjaxResult getMerchantInfo(@PathVariable("id") Long id) {
        try {
            Merchant merchant = merchantService.getById(id);
            if (merchant == null) {
                return AjaxResult.error("商户不存在");
            }

            // 隐藏敏感信息
            merchant.setLegalIdCard(null);
            merchant.setBankAccount(maskBankAccount(merchant.getBankAccount()));

            return AjaxResult.success(merchant);
        } catch (Exception e) {
            log.error("获取商户信息失败: id={}", id, e);
            return AjaxResult.error("获取商户信息失败");
        }
    }

    /**
     * 获取当前用户关联的商户
     *
     * @return 商户信息
     */
    @GetMapping("/my")
    public AjaxResult getMyMerchant() {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        try {
            Merchant merchant = merchantMapper.selectByUserId(Long.parseLong(wxUser.getId()));
            if (merchant == null) {
                return AjaxResult.success(null);
            }

            // 隐藏敏感信息
            merchant.setLegalIdCard(null);
            merchant.setBankAccount(maskBankAccount(merchant.getBankAccount()));

            return AjaxResult.success(merchant);
        } catch (Exception e) {
            log.error("获取我的商户信息失败: userId={}", Long.parseLong(wxUser.getId()), e);
            return AjaxResult.error("获取商户信息失败");
        }
    }

    /**
     * 绑定商户
     *
     * @param params 包含 merchantNo 商户编号
     * @return 绑定结果
     */
    @PostMapping("/bind")
    public AjaxResult bindMerchant(@RequestBody Map<String, Object> params) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        String merchantNo = (String) params.get("merchantNo");
        if (merchantNo == null || merchantNo.trim().isEmpty()) {
            return AjaxResult.error("商户编号不能为空");
        }

        try {
            // 检查用户是否已绑定商户
            Merchant existingMerchant = merchantMapper.selectByUserId(Long.parseLong(wxUser.getId()));
            if (existingMerchant != null) {
                return AjaxResult.error("您已绑定商户，请先解绑");
            }

            // 查询商户
            Merchant merchant = merchantMapper.selectByMerchantNo(merchantNo.trim());
            if (merchant == null) {
                return AjaxResult.error("商户编号不存在");
            }

            // 检查商户是否已被绑定
            if (merchant.getUserId() != null) {
                return AjaxResult.error("该商户已被其他用户绑定");
            }

            // 绑定商户
            merchant.setUserId(Long.parseLong(wxUser.getId()));
            boolean success = merchantService.updateById(merchant);

            return success ? AjaxResult.success("绑定成功") : AjaxResult.error("绑定失败");
        } catch (Exception e) {
            log.error("绑定商户失败: merchantNo={}, userId={}", merchantNo, Long.parseLong(wxUser.getId()), e);
            return AjaxResult.error("绑定失败");
        }
    }

    /**
     * 注册商户
     *
     * @param params 商户注册信息
     * @return 注册结果
     */
    @PostMapping("/register")
    public AjaxResult registerMerchant(@RequestBody Map<String, Object> params) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        try {
            // 检查用户是否已是商户
            Merchant existingMerchant = merchantMapper.selectByUserId(Long.parseLong(wxUser.getId()));
            if (existingMerchant != null) {
                return AjaxResult.error("您已是商户，无需重复注册");
            }

            // 创建商户
            Merchant merchant = new Merchant();
            merchant.setUserId(Long.parseLong(wxUser.getId()));
            merchant.setMerchantName((String) params.get("merchantName"));
            merchant.setShortName((String) params.get("shortName"));
            merchant.setContactName((String) params.get("contactName"));
            merchant.setContactPhone((String) params.get("contactPhone"));
            merchant.setContactEmail((String) params.get("contactEmail"));
            merchant.setAddress((String) params.get("address"));
            merchant.setLicenseNo((String) params.get("licenseNo") != null ? (String) params.get("licenseNo") : (String) params.get("creditCode"));
            merchant.setLicenseImage((String) params.get("licenseImage") != null ? (String) params.get("licenseImage") : (String) params.get("businessLicenseImage"));
            merchant.setLegalPerson((String) params.get("legalPerson"));
            
            // 新增字段处理
            merchant.setCompanyType((String) params.get("companyType"));
            merchant.setPosition((String) params.get("position"));
            merchant.setPurchaseVolume((String) params.get("purchaseVolume"));
            merchant.setRemarks((String) params.get("remarks"));
            merchant.setReferralCode((String) params.get("referralCode"));
            
            merchant.setStatus(0); // 待审核

            // 生成商户编号
            merchant.setMerchantNo(generateMerchantNo());

            boolean success = merchantService.save(merchant);

            if (success) {
                return AjaxResult.success("注册成功，请等待审核", merchant);
            } else {
                return AjaxResult.error("注册失败");
            }
        } catch (Exception e) {
            log.error("注册商户失败: userId={}", Long.parseLong(wxUser.getId()), e);
            return AjaxResult.error("注册失败");
        }
    }

    /**
     * 获取商户统计数据
     *
     * @param id 商户ID
     * @return 统计数据
     */
    @GetMapping("/{id}/stats")
    public AjaxResult getMerchantStats(@PathVariable("id") Long id) {
        try {
            Map<String, Object> stats = merchantService.getStats(id);
            if (stats == null || stats.isEmpty()) {
                return AjaxResult.error("商户不存在");
            }
            return AjaxResult.success(stats);
        } catch (Exception e) {
            log.error("获取商户统计失败: id={}", id, e);
            return AjaxResult.error("获取统计数据失败");
        }
    }

    /**
     * 脱敏银行账号
     */
    private String maskBankAccount(String account) {
        if (account == null || account.length() <= 8) {
            return account;
        }
        return account.substring(0, 4) + "****" + account.substring(account.length() - 4);
    }

    /**
     * 生成商户编号
     */
    private String generateMerchantNo() {
        return "M" + System.currentTimeMillis();
    }
}
