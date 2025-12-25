package com.joolun.web.api;

import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.GoodsPriceTier;
import com.joolun.mall.service.GoodsPriceTierService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 商品阶梯定价API - 小程序端
 * 提供商品阶梯价格查询和计算功能
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/goods-price-tier")
public class GoodsPriceTierApi {

    private final GoodsPriceTierService goodsPriceTierService;

    /**
     * 获取商品的阶梯定价列表
     *
     * @param spuId 商品SPU ID
     * @return 阶梯定价列表
     */
    @GetMapping("/spu/{spuId}")
    public AjaxResult getPriceTiers(@PathVariable("spuId") String spuId) {
        try {
            List<GoodsPriceTier> tiers = goodsPriceTierService.listBySpuId(spuId);
            return AjaxResult.success(tiers);
        } catch (Exception e) {
            log.error("获取阶梯定价失败: spuId={}", spuId, e);
            return AjaxResult.error("获取阶梯定价失败");
        }
    }

    /**
     * 计算阶梯价格
     *
     * @param spuId 商品SPU ID
     * @param quantity 购买数量
     * @return 价格信息 { price: 单价, total: 总价, tier: 当前梯度, nextTier: 下一梯度信息 }
     */
    @GetMapping("/calculate")
    public AjaxResult calculatePrice(
            @RequestParam("spuId") String spuId,
            @RequestParam("quantity") Integer quantity) {

        if (quantity == null || quantity <= 0) {
            return AjaxResult.error("数量必须大于0");
        }

        try {
            Map<String, Object> priceDetail = goodsPriceTierService.calculatePriceDetail(spuId, quantity);
            return AjaxResult.success(priceDetail);
        } catch (Exception e) {
            log.error("计算阶梯价格失败: spuId={}, quantity={}", spuId, quantity, e);
            return AjaxResult.error("计算价格失败");
        }
    }

    /**
     * 获取指定数量的单价
     *
     * @param spuId 商品SPU ID
     * @param quantity 购买数量
     * @return 单价
     */
    @GetMapping("/unit-price")
    public AjaxResult getUnitPrice(
            @RequestParam("spuId") String spuId,
            @RequestParam("quantity") Integer quantity) {

        if (quantity == null || quantity <= 0) {
            return AjaxResult.error("数量必须大于0");
        }

        try {
            BigDecimal price = goodsPriceTierService.calculatePrice(spuId, quantity);
            return AjaxResult.success(Map.of("price", price));
        } catch (Exception e) {
            log.error("获取单价失败: spuId={}, quantity={}", spuId, quantity, e);
            return AjaxResult.error("获取价格失败");
        }
    }

    /**
     * 批量计算多个商品的价格
     *
     * @param items 商品列表 [{ spuId, quantity }, ...]
     * @return 价格列表
     */
    @PostMapping("/batch-calculate")
    public AjaxResult batchCalculatePrice(@RequestBody List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) {
            return AjaxResult.error("商品列表不能为空");
        }

        try {
            for (Map<String, Object> item : items) {
                String spuId = String.valueOf(item.get("spuId"));
                Integer quantity = ((Number) item.get("quantity")).intValue();

                if (quantity > 0) {
                    Map<String, Object> priceDetail = goodsPriceTierService.calculatePriceDetail(spuId, quantity);
                    item.put("priceDetail", priceDetail);
                }
            }

            return AjaxResult.success(items);
        } catch (Exception e) {
            log.error("批量计算价格失败", e);
            return AjaxResult.error("计算价格失败");
        }
    }
}
