package com.joolun.web.controller.mall;

import com.joolun.common.core.controller.BaseController;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.GoodsPriceTier;
import com.joolun.mall.service.GoodsPriceTierService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 商品阶梯定价
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/goods-price-tier")
public class GoodsPriceTierController extends BaseController {

    private final GoodsPriceTierService goodsPriceTierService;

    /**
     * 获取商品的阶梯定价
     */
    @GetMapping("/spu/{spuId}")
    public AjaxResult listBySpuId(@PathVariable("spuId") Long spuId) {
        return AjaxResult.success(goodsPriceTierService.listBySpuId(spuId));
    }

    /**
     * 保存商品的阶梯定价（先删后增）
     */
    @PostMapping("/spu/{spuId}")
    @PreAuthorize("@ss.hasPermi('mall:goodsspu:edit')")
    public AjaxResult saveTiers(
            @PathVariable("spuId") Long spuId,
            @RequestBody List<GoodsPriceTier> tiers) {
        return AjaxResult.success(goodsPriceTierService.saveTiers(spuId, tiers));
    }

    /**
     * 计算指定数量的价格（公开接口，供C端使用）
     */
    @GetMapping("/calculate")
    public AjaxResult calculatePrice(
            @RequestParam("spuId") Long spuId,
            @RequestParam("quantity") Integer quantity) {
        return AjaxResult.success(goodsPriceTierService.calculatePriceDetail(spuId, quantity));
    }

    /**
     * 删除商品的所有阶梯定价
     */
    @DeleteMapping("/spu/{spuId}")
    @PreAuthorize("@ss.hasPermi('mall:goodsspu:edit')")
    public AjaxResult deleteBySpuId(@PathVariable("spuId") Long spuId) {
        return AjaxResult.success(goodsPriceTierService.deleteBySpuId(spuId));
    }
}
