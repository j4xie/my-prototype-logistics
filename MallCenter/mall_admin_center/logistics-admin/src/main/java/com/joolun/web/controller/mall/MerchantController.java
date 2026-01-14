package com.joolun.web.controller.mall;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.controller.BaseController;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.common.utils.SecurityUtils;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.service.MerchantService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 商户管理
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/merchant")
public class MerchantController extends BaseController {

    private final MerchantService merchantService;

    /**
     * 分页查询商户
     */
    @GetMapping("/page")
    @PreAuthorize("@ss.hasPermi('mall:merchant:index')")
    public AjaxResult page(Page page, Merchant merchant) {
        return AjaxResult.success(merchantService.page1(page, merchant));
    }

    /**
     * 通过id查询商户
     */
    @GetMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('mall:merchant:get')")
    public AjaxResult getById(@PathVariable("id") Long id) {
        return AjaxResult.success(merchantService.getById1(id));
    }

    /**
     * 新增商户（入驻申请）
     */
    @PostMapping
    public AjaxResult save(@RequestBody Merchant merchant) {
        return AjaxResult.success(merchantService.apply(merchant));
    }

    /**
     * 修改商户
     */
    @PutMapping
    @PreAuthorize("@ss.hasPermi('mall:merchant:edit')")
    public AjaxResult updateById(@RequestBody Merchant merchant) {
        return AjaxResult.success(merchantService.updateById(merchant));
    }

    /**
     * 审核商户
     * @param id 商户ID
     * @param action 1通过 2拒绝
     * @param remark 备注
     */
    @PutMapping("/{id}/review")
    @PreAuthorize("@ss.hasPermi('mall:merchant:review')")
    public AjaxResult review(
            @PathVariable("id") Long id,
            @RequestParam("action") Integer action,
            @RequestParam(value = "remark", required = false) String remark) {
        Long reviewerId = SecurityUtils.getUserId();
        String reviewerName = SecurityUtils.getLoginUser().getUser().getNickName();
        return AjaxResult.success(merchantService.review(id, action, remark, reviewerId, reviewerName));
    }

    /**
     * 更新商户状态
     */
    @PutMapping("/{id}/status")
    @PreAuthorize("@ss.hasPermi('mall:merchant:edit')")
    public AjaxResult updateStatus(
            @PathVariable("id") Long id,
            @RequestParam("status") Integer status) {
        return AjaxResult.success(merchantService.updateStatus(id, status));
    }

    /**
     * 获取商户统计数据
     */
    @GetMapping("/{id}/stats")
    public AjaxResult getStats(@PathVariable("id") Long id) {
        return AjaxResult.success(merchantService.getStats(id));
    }

    /**
     * 获取商户审核历史
     */
    @GetMapping("/{id}/review-history")
    @PreAuthorize("@ss.hasPermi('mall:merchant:get')")
    public AjaxResult getReviewHistory(@PathVariable("id") Long id) {
        return AjaxResult.success(merchantService.getReviewHistory(id));
    }

    /**
     * 获取待审核商户数量
     */
    @GetMapping("/pending-count")
    public AjaxResult getPendingCount() {
        return AjaxResult.success(merchantService.getPendingCount());
    }

    /**
     * 获取商户列表（下拉框用，返回简要信息）
     */
    @GetMapping("/list")
    public AjaxResult list() {
        return AjaxResult.success(merchantService.listSimple());
    }

    /**
     * 通过id删除商户（软删除）
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('mall:merchant:del')")
    public AjaxResult removeById(@PathVariable Long id) {
        return AjaxResult.success(merchantService.removeById(id));
    }
}
