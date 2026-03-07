package com.joolun.web.api;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.metadata.OrderItem;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.annotation.Anonymous;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.config.CommonConstants;
import com.joolun.mall.entity.GoodsCategory;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.MerchantPageConfig;
import com.joolun.mall.service.AdvertisementService;
import com.joolun.mall.service.DecorationService;
import com.joolun.mall.service.GoodsCategoryService;
import com.joolun.mall.service.GoodsSpuService;
import com.joolun.system.service.ISysConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * 首页聚合接口
 * 将 banners + categories + newProducts + hotProducts + featureConfig 合并为一次请求
 * 减少小程序首页 8+ 并发请求到 1 次
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/home")
public class HomeInitApi {

    private final AdvertisementService advertisementService;
    private final GoodsCategoryService goodsCategoryService;
    private final GoodsSpuService goodsSpuService;
    private final ISysConfigService configService;
    private final DecorationService decorationService;
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Anonymous
    @GetMapping("/init")
    public AjaxResult homeInit() {
        Map<String, Object> result = new HashMap<>();

        // 1. 首页Banner
        try {
            result.put("banners", advertisementService.getHomeBanners());
        } catch (Exception e) {
            log.warn("首页聚合: 加载Banner失败", e);
            result.put("banners", new Object[0]);
        }

        // 2. 商品分类树 (只返回启用的)
        try {
            GoodsCategory categoryQuery = new GoodsCategory();
            categoryQuery.setEnable(CommonConstants.YES);
            result.put("categories", goodsCategoryService.selectTree(categoryQuery));
        } catch (Exception e) {
            log.warn("首页聚合: 加载分类失败", e);
            result.put("categories", new Object[0]);
        }

        // 3. 新品首发 (按创建时间倒序, 5条)
        try {
            Page<GoodsSpu> newPage = new Page<>(1, 5);
            newPage.addOrder(OrderItem.desc("create_time"));
            GoodsSpu newQuery = new GoodsSpu();
            newQuery.setShelf(CommonConstants.YES);
            IPage<GoodsSpu> newResult = goodsSpuService.page1(newPage, newQuery);
            result.put("newProducts", newResult.getRecords());
        } catch (Exception e) {
            log.warn("首页聚合: 加载新品失败", e);
            result.put("newProducts", new Object[0]);
        }

        // 4. 热销单品 (按销量倒序, 5条)
        try {
            Page<GoodsSpu> hotPage = new Page<>(1, 5);
            hotPage.addOrder(OrderItem.desc("sale_num"));
            GoodsSpu hotQuery = new GoodsSpu();
            hotQuery.setShelf(CommonConstants.YES);
            IPage<GoodsSpu> hotResult = goodsSpuService.page1(hotPage, hotQuery);
            result.put("hotProducts", hotResult.getRecords());
        } catch (Exception e) {
            log.warn("首页聚合: 加载热销失败", e);
            result.put("hotProducts", new Object[0]);
        }

        // 5. 功能开关配置
        try {
            Map<String, Object> featureConfig = new HashMap<>();
            String aiEnabled = configService.selectConfigByKey("mall.ai.assistant.enabled");
            featureConfig.put("showAI", "true".equalsIgnoreCase(aiEnabled));

            String categoriesEnabled = configService.selectConfigByKey("mall.home.categories.enabled");
            featureConfig.put("showCategories", !"false".equalsIgnoreCase(categoriesEnabled));

            String productsEnabled = configService.selectConfigByKey("mall.home.products.enabled");
            featureConfig.put("showProducts", !"false".equalsIgnoreCase(productsEnabled));

            String categoryTabEnabled = configService.selectConfigByKey("mall.tabbar.category.enabled");
            featureConfig.put("showCategoryTab", !"false".equalsIgnoreCase(categoryTabEnabled));

            result.put("featureConfig", featureConfig);
        } catch (Exception e) {
            log.warn("首页聚合: 加载功能配置失败", e);
            Map<String, Object> defaultConfig = new HashMap<>();
            defaultConfig.put("showAI", false);
            defaultConfig.put("showCategories", true);
            defaultConfig.put("showProducts", true);
            defaultConfig.put("showCategoryTab", true);
            result.put("featureConfig", defaultConfig);
        }

        // 6. 页面装修主题 + 店铺信息（从数据库读取）
        try {
            MerchantPageConfig dbConfig = decorationService.getPublishedConfig(null, "home");
            if (dbConfig == null) {
                dbConfig = decorationService.getPageConfig(null, "home");
            }

            Map<String, Object> theme = new HashMap<>();
            if (dbConfig != null && dbConfig.getCustomTheme() != null) {
                try {
                    JsonNode themeNode = objectMapper.readTree(dbConfig.getCustomTheme());
                    theme = objectMapper.convertValue(themeNode, Map.class);
                } catch (Exception e) {
                    log.warn("解析主题JSON失败，使用默认值", e);
                }
            }
            // 确保核心字段有值
            theme.putIfAbsent("primaryColor", "#52c41a");
            theme.putIfAbsent("secondaryColor", "#1a1a1a");
            theme.putIfAbsent("backgroundColor", "#f5f5f5");
            theme.putIfAbsent("textColor", "#333333");
            theme.putIfAbsent("accentColor", "#52c41a");
            result.put("theme", theme);

            // 店铺信息
            if (dbConfig != null) {
                Map<String, Object> shopInfo = new HashMap<>();
                shopInfo.put("shopName", dbConfig.getShopName());
                shopInfo.put("logoUrl", dbConfig.getLogoUrl());
                shopInfo.put("slogan", dbConfig.getSlogan());
                if (dbConfig.getNoticeTexts() != null) {
                    try {
                        shopInfo.put("noticeTexts", objectMapper.readTree(dbConfig.getNoticeTexts()));
                    } catch (Exception e) {
                        shopInfo.put("noticeTexts", new String[0]);
                    }
                }
                result.put("shopInfo", shopInfo);
            }
        } catch (Exception e) {
            log.warn("首页聚合: 加载主题失败", e);
            Map<String, Object> defaultTheme = new HashMap<>();
            defaultTheme.put("primaryColor", "#52c41a");
            defaultTheme.put("secondaryColor", "#1a1a1a");
            defaultTheme.put("backgroundColor", "#f5f5f5");
            defaultTheme.put("textColor", "#333333");
            defaultTheme.put("accentColor", "#52c41a");
            result.put("theme", defaultTheme);
        }

        return AjaxResult.success(result);
    }
}
