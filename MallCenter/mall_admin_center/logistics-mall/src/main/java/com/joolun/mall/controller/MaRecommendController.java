package com.joolun.mall.controller;

import com.joolun.common.core.domain.R;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.service.RecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 个性化推荐API
 * 基于用户兴趣的商品推荐
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/weixin/ma/recommend")
@Tag(name = "小程序-个性化推荐", description = "个性化推荐API")
public class MaRecommendController {

    private final RecommendationService recommendationService;

    // P2优化: 分页参数上限，防止OOM
    private static final int MAX_LIMIT = 100;
    private static final int MAX_PAGE_SIZE = 50;
    private static final int MAX_PAGE = 100;

    /**
     * 校验并规范化 limit 参数
     */
    private int validateLimit(int limit) {
        if (limit <= 0) return 10;
        return Math.min(limit, MAX_LIMIT);
    }

    /**
     * 校验并规范化分页参数
     */
    private int[] validatePagination(int page, int size) {
        page = Math.max(0, Math.min(page, MAX_PAGE));
        size = size <= 0 ? 10 : Math.min(size, MAX_PAGE_SIZE);
        return new int[]{page, size};
    }

    /**
     * 获取首页推荐商品
     */
    @GetMapping("/home/{wxUserId}")
    @Operation(summary = "获取首页推荐商品")
    public R<List<GoodsSpu>> getHomeRecommendations(
            @PathVariable String wxUserId,
            @RequestParam(defaultValue = "20") int limit) {
        try {
            limit = validateLimit(limit);  // P2优化: 参数验证
            List<GoodsSpu> recommendations = recommendationService.getHomeRecommendations(wxUserId, limit);
            return R.ok(recommendations);
        } catch (Exception e) {
            log.error("获取首页推荐失败", e);
            return R.fail("获取推荐失败");
        }
    }

    /**
     * 获取"猜你喜欢"推荐 (分页)
     */
    @GetMapping("/youMayLike/{wxUserId}")
    @Operation(summary = "获取猜你喜欢推荐")
    public R<Map<String, Object>> getYouMayLike(
            @PathVariable String wxUserId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            int[] validParams = validatePagination(page, size);  // P2优化: 参数验证
            Map<String, Object> result = recommendationService.getYouMayLike(wxUserId, validParams[0], validParams[1]);
            return R.ok(result);
        } catch (Exception e) {
            log.error("获取猜你喜欢失败", e);
            return R.fail("获取推荐失败");
        }
    }

    /**
     * 获取相似商品推荐
     */
    @GetMapping("/similar/{productId}")
    @Operation(summary = "获取相似商品推荐")
    public R<List<GoodsSpu>> getSimilarProducts(
            @PathVariable String productId,
            @RequestParam(required = false) String wxUserId,
            @RequestParam(defaultValue = "6") int limit) {
        try {
            limit = validateLimit(limit);  // P2优化: 参数验证
            List<GoodsSpu> similar = recommendationService.getSimilarProducts(wxUserId, productId, limit);
            return R.ok(similar);
        } catch (Exception e) {
            log.error("获取相似商品失败", e);
            return R.fail("获取推荐失败");
        }
    }

    /**
     * 获取购物车推荐
     */
    @PostMapping("/cart")
    @Operation(summary = "获取购物车推荐")
    public R<List<GoodsSpu>> getCartRecommendations(@RequestBody Map<String, Object> params) {
        try {
            String wxUserId = (String) params.get("wxUserId");
            @SuppressWarnings("unchecked")
            List<String> cartProductIds = (List<String>) params.get("cartProductIds");
            Integer limit = params.get("limit") != null ? ((Number) params.get("limit")).intValue() : 6;
            limit = validateLimit(limit);  // P2优化: 参数验证

            List<GoodsSpu> recommendations = recommendationService.getCartRecommendations(
                    wxUserId, cartProductIds, limit);
            return R.ok(recommendations);
        } catch (Exception e) {
            log.error("获取购物车推荐失败", e);
            return R.fail("获取推荐失败");
        }
    }

    /**
     * 获取热门商品 (无需登录)
     */
    @GetMapping("/popular")
    @Operation(summary = "获取热门商品")
    public R<List<GoodsSpu>> getPopularProducts(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            limit = validateLimit(limit);  // P2优化: 参数验证
            List<GoodsSpu> popular = recommendationService.getPopularProducts(category, limit);
            return R.ok(popular);
        } catch (Exception e) {
            log.error("获取热门商品失败", e);
            return R.fail("获取失败");
        }
    }

    /**
     * 刷新推荐缓存
     */
    @PostMapping("/refresh/{wxUserId}")
    @Operation(summary = "刷新推荐缓存")
    public R<?> refreshCache(@PathVariable String wxUserId) {
        try {
            recommendationService.refreshRecommendationCache(wxUserId);
            return R.ok(Map.of("message", "缓存已刷新"));
        } catch (Exception e) {
            log.error("刷新缓存失败", e);
            return R.fail("刷新失败");
        }
    }
}
