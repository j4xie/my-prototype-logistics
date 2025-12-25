package com.joolun.web.controller.mall;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.controller.BaseController;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.Advertisement;
import com.joolun.mall.service.AdvertisementService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 广告管理
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/advertisement")
public class AdvertisementController extends BaseController {

    private final AdvertisementService advertisementService;

    /**
     * 分页查询广告
     */
    @GetMapping("/page")
    @PreAuthorize("@ss.hasPermi('mall:advertisement:index')")
    public AjaxResult page(Page page, Advertisement ad) {
        return AjaxResult.success(advertisementService.page1(page, ad));
    }

    /**
     * 通过id查询广告
     */
    @GetMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('mall:advertisement:get')")
    public AjaxResult getById(@PathVariable("id") Long id) {
        return AjaxResult.success(advertisementService.getById(id));
    }

    /**
     * 按类型获取有效广告（公开接口，供C端使用）
     */
    @GetMapping("/active/{type}")
    public AjaxResult listActiveByType(@PathVariable("type") String type) {
        return AjaxResult.success(advertisementService.listActiveByType(type));
    }

    /**
     * 获取启动广告（公开接口，供C端使用）
     */
    @GetMapping("/splash")
    public AjaxResult getSplashAd() {
        return AjaxResult.success(advertisementService.getSplashAd());
    }

    /**
     * 获取首页Banner（公开接口，供C端使用）
     */
    @GetMapping("/banners")
    public AjaxResult getHomeBanners() {
        return AjaxResult.success(advertisementService.getHomeBanners());
    }

    /**
     * 新增广告
     */
    @PostMapping
    @PreAuthorize("@ss.hasPermi('mall:advertisement:add')")
    public AjaxResult save(@RequestBody Advertisement ad) {
        return AjaxResult.success(advertisementService.save(ad));
    }

    /**
     * 修改广告
     */
    @PutMapping
    @PreAuthorize("@ss.hasPermi('mall:advertisement:edit')")
    public AjaxResult updateById(@RequestBody Advertisement ad) {
        return AjaxResult.success(advertisementService.updateById(ad));
    }

    /**
     * 更新广告状态（上下线）
     */
    @PutMapping("/{id}/status")
    @PreAuthorize("@ss.hasPermi('mall:advertisement:edit')")
    public AjaxResult updateStatus(
            @PathVariable("id") Long id,
            @RequestParam("status") Integer status) {
        return AjaxResult.success(advertisementService.updateStatus(id, status));
    }

    /**
     * 记录广告点击（公开接口）
     */
    @PostMapping("/{id}/click")
    public AjaxResult recordClick(@PathVariable("id") Long id) {
        return AjaxResult.success(advertisementService.recordClick(id));
    }

    /**
     * 记录广告展示（公开接口）
     */
    @PostMapping("/{id}/view")
    public AjaxResult recordView(@PathVariable("id") Long id) {
        return AjaxResult.success(advertisementService.recordView(id));
    }

    /**
     * 获取广告统计数据
     */
    @GetMapping("/{id}/stats")
    @PreAuthorize("@ss.hasPermi('mall:advertisement:get')")
    public AjaxResult getStats(@PathVariable("id") Long id) {
        return AjaxResult.success(advertisementService.getStats(id));
    }

    /**
     * 删除广告（软删除）
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('mall:advertisement:del')")
    public AjaxResult removeById(@PathVariable Long id) {
        return AjaxResult.success(advertisementService.removeById(id));
    }
}
