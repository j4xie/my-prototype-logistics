package com.joolun.web.api;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.Referral;
import com.joolun.mall.entity.ReferralRewardConfig;
import com.joolun.mall.service.ReferralService;
import com.joolun.weixin.entity.ThirdSession;
import com.joolun.weixin.entity.WxUser;
import com.joolun.weixin.service.WxUserService;
import com.joolun.weixin.utils.ThirdSessionHolder;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * C端推荐系统 API
 * 提供小程序端的推荐功能
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/referral")
public class ReferralApi {

    private final ReferralService referralService;
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
     * 获取推荐信息（推荐码、二维码等）
     */
    @GetMapping("/info")
    public AjaxResult getReferralInfo() {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        try {
            Long userId = Long.parseLong(wxUser.getId());

            // 生成或获取推荐码
            String referralCode = referralService.generateReferralCode(userId);

            // 获取统计数据
            ReferralService.ReferralStatistics stats = referralService.getReferrerStatistics(userId);

            // 获取奖励配置
            List<ReferralRewardConfig> configs = referralService.getActiveRewardConfigs();
            ReferralRewardConfig userRegisterConfig = configs.stream()
                    .filter(c -> c.getReferralType() != null && c.getReferralType() == 1)
                    .findFirst()
                    .orElse(null);

            // 构建返回数据
            Map<String, Object> result = new HashMap<>();
            result.put("referralCode", referralCode);
            result.put("qrCodeUrl", generateQrCodeUrl(referralCode));

            // 统计数据
            Map<String, Object> statsMap = new HashMap<>();
            if (stats != null) {
                statsMap.put("totalReferrals", stats.getTotalCount());
                statsMap.put("successCount", stats.getConfirmedCount());
                statsMap.put("pendingCount", stats.getTotalCount() - stats.getConfirmedCount());
                statsMap.put("totalRewards", stats.getTotalReward());
            } else {
                statsMap.put("totalReferrals", 0);
                statsMap.put("successCount", 0);
                statsMap.put("pendingCount", 0);
                statsMap.put("totalRewards", 0);
            }
            result.put("stats", statsMap);

            // 奖励信息
            Map<String, Object> rewardInfo = new HashMap<>();
            if (userRegisterConfig != null) {
                rewardInfo.put("referrerReward", userRegisterConfig.getReferrerReward());
                rewardInfo.put("refereeReward", userRegisterConfig.getRefereeReward());
                rewardInfo.put("maxMonthly", userRegisterConfig.getMaxReward());
            } else {
                rewardInfo.put("referrerReward", 10);
                rewardInfo.put("refereeReward", 5);
                rewardInfo.put("maxMonthly", 500);
            }
            result.put("rewardInfo", rewardInfo);

            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("获取推荐信息失败: userId={}", wxUser.getId(), e);
            return AjaxResult.error("获取推荐信息失败");
        }
    }

    /**
     * 获取推荐统计数据
     */
    @GetMapping("/stats")
    public AjaxResult getReferralStats() {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        try {
            Long userId = Long.parseLong(wxUser.getId());
            ReferralService.ReferralStatistics stats = referralService.getReferrerStatistics(userId);

            Map<String, Object> result = new HashMap<>();
            if (stats != null) {
                result.put("totalReferrals", stats.getTotalCount());
                result.put("successCount", stats.getConfirmedCount());
                result.put("pendingCount", stats.getTotalCount() - stats.getConfirmedCount());
                result.put("totalRewards", stats.getTotalReward());
            } else {
                result.put("totalReferrals", 0);
                result.put("successCount", 0);
                result.put("pendingCount", 0);
                result.put("totalRewards", 0);
            }

            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("获取推荐统计失败: userId={}", wxUser.getId(), e);
            return AjaxResult.error("获取统计数据失败");
        }
    }

    /**
     * 分页获取推荐记录
     */
    @GetMapping("/records")
    public AjaxResult getReferralRecords(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Integer status) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        try {
            Long userId = Long.parseLong(wxUser.getId());
            Page<Referral> pageParam = new Page<>(page, size);
            IPage<Referral> records = referralService.pageReferrals(pageParam, userId, status, null);

            return AjaxResult.success(records);
        } catch (Exception e) {
            log.error("获取推荐记录失败: userId={}", wxUser.getId(), e);
            return AjaxResult.error("获取推荐记录失败");
        }
    }

    /**
     * 生成推荐码
     */
    @GetMapping("/code/generate")
    public AjaxResult generateReferralCode() {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        try {
            Long userId = Long.parseLong(wxUser.getId());
            String referralCode = referralService.generateReferralCode(userId);

            Map<String, Object> result = new HashMap<>();
            result.put("referralCode", referralCode);
            result.put("qrCodeUrl", generateQrCodeUrl(referralCode));

            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("生成推荐码失败: userId={}", wxUser.getId(), e);
            return AjaxResult.error("生成推荐码失败");
        }
    }

    /**
     * 使用推荐码注册（被推荐人调用）
     */
    @PostMapping("/use")
    public AjaxResult useReferralCode(@RequestBody Map<String, String> params) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        String referralCode = params.get("referralCode");
        if (referralCode == null || referralCode.trim().isEmpty()) {
            return AjaxResult.error("推荐码不能为空");
        }

        try {
            Long userId = Long.parseLong(wxUser.getId());

            // 查找推荐码对应的推荐人
            List<Referral> existingReferrals = referralService.listByReferralCode(referralCode.trim());
            if (existingReferrals.isEmpty()) {
                return AjaxResult.error("推荐码无效");
            }

            // 获取推荐人ID（从已有记录中获取）
            Long referrerId = existingReferrals.get(0).getReferrerId();
            if (referrerId.equals(userId)) {
                return AjaxResult.error("不能使用自己的推荐码");
            }

            // 检查是否已被推荐过
            List<Referral> myReferrals = referralService.listByReferrer(userId);
            boolean alreadyReferred = myReferrals.stream()
                    .anyMatch(r -> r.getRefereeId() != null && r.getRefereeId().equals(userId));
            if (alreadyReferred) {
                return AjaxResult.error("您已被其他用户推荐过");
            }

            // 创建推荐记录
            Referral referral = new Referral();
            referral.setReferralCode(referralCode.trim());
            referral.setReferrerId(referrerId);
            referral.setRefereeId(userId);
            referral.setRefereeName(wxUser.getNickName());
            referral.setReferralType(1); // 新用户注册
            referral.setStatus(0); // 待确认

            referralService.createReferral(referral);

            return AjaxResult.success("推荐码使用成功");
        } catch (Exception e) {
            log.error("使用推荐码失败: userId={}, code={}", wxUser.getId(), referralCode, e);
            return AjaxResult.error("使用推荐码失败");
        }
    }

    /**
     * 获取奖励规则
     */
    @GetMapping("/reward-rules")
    public AjaxResult getRewardRules() {
        try {
            List<ReferralRewardConfig> configs = referralService.getActiveRewardConfigs();
            return AjaxResult.success(configs);
        } catch (Exception e) {
            log.error("获取奖励规则失败", e);
            return AjaxResult.error("获取奖励规则失败");
        }
    }

    /**
     * 生成二维码URL（演示用，实际应使用微信小程序码API）
     */
    private String generateQrCodeUrl(String referralCode) {
        // TODO: 实际应使用微信小程序码API生成带参数的小程序码
        return "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
                "https://cretas.com/register?ref=" + referralCode;
    }
}
