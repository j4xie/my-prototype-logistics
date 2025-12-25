package com.joolun.mall.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.domain.R;
import com.joolun.mall.entity.Referral;
import com.joolun.mall.entity.ReferralRewardConfig;
import com.joolun.mall.service.ReferralService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * 推荐系统控制器 - 权限标识统一为 mall:referral 风格
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/referral")
@Tag(name = "推荐系统管理")
public class ReferralController {
    
    private final ReferralService referralService;
    
    @GetMapping("/page")
    @Operation(summary = "分页查询推荐记录")
    @PreAuthorize("@ss.hasPermi('mall:referral:get')")
    public R<IPage<Referral>> pageReferrals(
            Page<Referral> page,
            @RequestParam(required = false) Long referrerId,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Integer referralType) {
        return R.ok(referralService.pageReferrals(page, referrerId, status, referralType));
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "获取推荐记录详情")
    @PreAuthorize("@ss.hasPermi('mall:referral:get')")
    public R<Referral> getById(@PathVariable Long id) {
        return R.ok(referralService.getById(id));
    }
    
    @GetMapping("/referrer/{referrerId}")
    @Operation(summary = "查询推荐人的推荐记录")
    @PreAuthorize("@ss.hasPermi('mall:referral:get')")
    public R<List<Referral>> listByReferrer(@PathVariable Long referrerId) {
        return R.ok(referralService.listByReferrer(referrerId));
    }
    
    @GetMapping("/statistics/{referrerId}")
    @Operation(summary = "获取推荐人统计数据")
    @PreAuthorize("@ss.hasPermi('mall:referral:get')")
    public R<ReferralService.ReferralStatistics> getReferrerStatistics(@PathVariable Long referrerId) {
        return R.ok(referralService.getReferrerStatistics(referrerId));
    }
    
    @PostMapping
    @Operation(summary = "创建推荐记录")
    @PreAuthorize("@ss.hasPermi('mall:referral:add')")
    public R<Referral> createReferral(@RequestBody Referral referral) {
        return R.ok(referralService.createReferral(referral));
    }
    
    @PutMapping("/{id}/confirm")
    @Operation(summary = "确认推荐有效")
    @PreAuthorize("@ss.hasPermi('mall:referral:edit')")
    public R<Boolean> confirmReferral(@PathVariable Long id) {
        return R.ok(referralService.confirmReferral(id));
    }
    
    @PutMapping("/{id}/reward")
    @Operation(summary = "发放奖励")
    @PreAuthorize("@ss.hasPermi('mall:referral:edit')")
    public R<Boolean> grantReward(
            @PathVariable Long id,
            @RequestParam BigDecimal rewardAmount,
            @RequestParam Integer rewardType) {
        return R.ok(referralService.grantReward(id, rewardAmount, rewardType));
    }
    
    @GetMapping("/code/generate/{userId}")
    @Operation(summary = "生成用户推荐码")
    public R<String> generateReferralCode(@PathVariable Long userId) {
        return R.ok(referralService.generateReferralCode(userId));
    }
    
    // ========== 奖励配置 ==========
    
    @GetMapping("/config/active")
    @Operation(summary = "获取有效的奖励配置")
    @PreAuthorize("@ss.hasPermi('mall:referral:get')")
    public R<List<ReferralRewardConfig>> getActiveConfigs() {
        return R.ok(referralService.getActiveRewardConfigs());
    }
    
    @GetMapping("/config/type/{referralType}")
    @Operation(summary = "根据推荐类型获取配置")
    @PreAuthorize("@ss.hasPermi('mall:referral:get')")
    public R<ReferralRewardConfig> getConfigByType(@PathVariable Integer referralType) {
        return R.ok(referralService.getRewardConfigByType(referralType));
    }
    
    @PostMapping("/process-pending")
    @Operation(summary = "处理待发放奖励")
    @PreAuthorize("@ss.hasPermi('mall:referral:edit')")
    public R<Integer> processPendingRewards() {
        return R.ok(referralService.processPendingRewards());
    }
}
