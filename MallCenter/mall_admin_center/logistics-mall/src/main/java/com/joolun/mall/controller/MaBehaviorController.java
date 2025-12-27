package com.joolun.mall.controller;

import com.joolun.common.core.domain.R;
import com.joolun.mall.dto.BehaviorEventDTO;
import com.joolun.mall.dto.BehaviorBatchDTO;
import com.joolun.mall.entity.UserBehaviorEvent;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.entity.UserRecommendationProfile;
import com.joolun.mall.service.UserBehaviorTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 用户行为追踪API
 * 记录用户浏览、搜索、点击等行为用于兴趣推荐
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/weixin/ma/behavior")
@Tag(name = "小程序-用户行为追踪", description = "用户行为追踪API")
public class MaBehaviorController {

    private final UserBehaviorTrackingService behaviorTrackingService;

    /**
     * 上报单个行为事件
     */
    @PostMapping("/track")
    @Operation(summary = "上报单个行为事件")
    public R<?> trackEvent(@RequestBody BehaviorEventDTO dto, HttpServletRequest request) {
        try {
            UserBehaviorEvent event = convertToEvent(dto, request);
            behaviorTrackingService.trackEvent(event);
            return R.ok();
        } catch (Exception e) {
            log.error("上报行为事件失败", e);
            return R.fail("上报失败");
        }
    }

    /**
     * 批量上报行为事件
     */
    @PostMapping("/trackBatch")
    @Operation(summary = "批量上报行为事件")
    public R<?> trackBatch(@RequestBody BehaviorBatchDTO dto, HttpServletRequest request) {
        try {
            if (dto.getEvents() == null || dto.getEvents().isEmpty()) {
                return R.fail("事件列表为空");
            }

            for (BehaviorEventDTO eventDto : dto.getEvents()) {
                UserBehaviorEvent event = convertToEvent(eventDto, request);
                behaviorTrackingService.trackEvent(event);
            }

            return R.ok(Map.of("count", dto.getEvents().size()));
        } catch (Exception e) {
            log.error("批量上报行为事件失败", e);
            return R.fail("批量上报失败");
        }
    }

    /**
     * 上报商品浏览事件
     */
    @PostMapping("/view/product")
    @Operation(summary = "上报商品浏览事件")
    public R<?> trackProductView(@RequestBody Map<String, Object> params) {
        try {
            String wxUserId = (String) params.get("wxUserId");
            String productId = (String) params.get("productId");
            String productName = (String) params.get("productName");

            if (wxUserId == null || productId == null) {
                return R.fail("参数缺失");
            }

            Map<String, Object> eventData = new HashMap<>();
            eventData.put("duration", params.get("duration"));
            eventData.put("scrollDepth", params.get("scrollDepth"));
            eventData.put("source", params.get("source"));

            behaviorTrackingService.trackProductView(wxUserId, productId, productName, eventData);
            return R.ok();
        } catch (Exception e) {
            log.error("上报商品浏览失败", e);
            return R.fail("上报失败");
        }
    }

    /**
     * 上报搜索事件
     */
    @PostMapping("/search")
    @Operation(summary = "上报搜索事件")
    public R<?> trackSearch(@RequestBody Map<String, Object> params) {
        try {
            String wxUserId = (String) params.get("wxUserId");
            String keyword = (String) params.get("keyword");
            Integer resultCount = params.get("resultCount") != null
                    ? ((Number) params.get("resultCount")).intValue() : 0;

            if (wxUserId == null || keyword == null) {
                return R.fail("参数缺失");
            }

            behaviorTrackingService.trackSearch(wxUserId, keyword, resultCount);
            return R.ok();
        } catch (Exception e) {
            log.error("上报搜索事件失败", e);
            return R.fail("上报失败");
        }
    }

    /**
     * 上报加购事件
     */
    @PostMapping("/cart/add")
    @Operation(summary = "上报加购事件")
    public R<?> trackCartAdd(@RequestBody Map<String, Object> params) {
        try {
            String wxUserId = (String) params.get("wxUserId");
            String productId = (String) params.get("productId");
            String productName = (String) params.get("productName");
            Integer quantity = params.get("quantity") != null
                    ? ((Number) params.get("quantity")).intValue() : 1;

            if (wxUserId == null || productId == null) {
                return R.fail("参数缺失");
            }

            behaviorTrackingService.trackCartAdd(wxUserId, productId, productName, quantity);
            return R.ok();
        } catch (Exception e) {
            log.error("上报加购事件失败", e);
            return R.fail("上报失败");
        }
    }

    /**
     * 获取用户兴趣标签
     */
    @GetMapping("/interests/{wxUserId}")
    @Operation(summary = "获取用户兴趣标签")
    public R<List<UserInterestTag>> getUserInterests(
            @PathVariable String wxUserId,
            @RequestParam(defaultValue = "20") int limit) {
        try {
            List<UserInterestTag> tags = behaviorTrackingService.getUserInterestTags(wxUserId, limit);
            return R.ok(tags);
        } catch (Exception e) {
            log.error("获取用户兴趣失败", e);
            return R.fail("获取失败");
        }
    }

    /**
     * 获取用户画像
     */
    @GetMapping("/profile/{wxUserId}")
    @Operation(summary = "获取用户画像")
    public R<UserRecommendationProfile> getUserProfile(@PathVariable String wxUserId) {
        try {
            UserRecommendationProfile profile = behaviorTrackingService.getUserProfile(wxUserId);
            return R.ok(profile);
        } catch (Exception e) {
            log.error("获取用户画像失败", e);
            return R.fail("获取失败");
        }
    }

    /**
     * 获取用户搜索历史
     */
    @GetMapping("/searchHistory/{wxUserId}")
    @Operation(summary = "获取用户搜索历史")
    public R<List<String>> getSearchHistory(
            @PathVariable String wxUserId,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            List<String> history = behaviorTrackingService.getSearchHistory(wxUserId, limit);
            return R.ok(history);
        } catch (Exception e) {
            log.error("获取搜索历史失败", e);
            return R.fail("获取失败");
        }
    }

    /**
     * 获取最近浏览的商品
     */
    @GetMapping("/recentViewed/{wxUserId}")
    @Operation(summary = "获取最近浏览的商品")
    public R<List<String>> getRecentViewed(
            @PathVariable String wxUserId,
            @RequestParam(defaultValue = "20") int limit) {
        try {
            List<String> productIds = behaviorTrackingService.getRecentViewedProducts(wxUserId, limit);
            return R.ok(productIds);
        } catch (Exception e) {
            log.error("获取浏览历史失败", e);
            return R.fail("获取失败");
        }
    }

    /**
     * 手动触发兴趣分析
     */
    @PostMapping("/analyze/{wxUserId}")
    @Operation(summary = "手动触发兴趣分析")
    public R<?> analyzeInterests(@PathVariable String wxUserId) {
        try {
            behaviorTrackingService.updateUserInterests(wxUserId);
            return R.ok(Map.of("message", "分析任务已提交"));
        } catch (Exception e) {
            log.error("触发兴趣分析失败", e);
            return R.fail("分析失败");
        }
    }

    /**
     * 检查是否需要显示冷启动弹窗
     * 只有首次使用的用户才需要显示
     */
    @GetMapping("/cold-start/check/{wxUserId}")
    @Operation(summary = "检查是否需要显示冷启动弹窗")
    public R<Map<String, Object>> checkColdStart(@PathVariable String wxUserId) {
        try {
            boolean needsShow = behaviorTrackingService.needsShowColdStart(wxUserId);
            return R.ok(Map.of(
                    "needsShow", needsShow,
                    "wxUserId", wxUserId
            ));
        } catch (Exception e) {
            log.error("检查冷启动状态失败", e);
            return R.fail("检查失败");
        }
    }

    /**
     * 完成冷启动
     * 用户选择偏好后调用，保存初始偏好并标记冷启动已完成
     * 之后不再显示冷启动弹窗
     */
    @PostMapping("/cold-start/complete")
    @Operation(summary = "完成冷启动偏好设置")
    public R<?> completeColdStart(@RequestBody Map<String, Object> params) {
        try {
            String wxUserId = (String) params.get("wxUserId");
            if (wxUserId == null || wxUserId.isEmpty()) {
                return R.fail("用户ID不能为空");
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> preferences = (Map<String, Object>) params.get("preferences");
            if (preferences == null || preferences.isEmpty()) {
                return R.fail("请选择至少一个偏好");
            }

            behaviorTrackingService.completeColdStart(wxUserId, preferences);
            return R.ok(Map.of(
                    "message", "偏好设置成功",
                    "coldStartCompleted", true
            ));
        } catch (Exception e) {
            log.error("完成冷启动失败", e);
            return R.fail("设置偏好失败");
        }
    }

    /**
     * 处理被忽略的推荐 (负向反馈)
     * 当用户刷新推荐或离开页面时调用，对之前展示但未点击的探索推荐发送负向反馈
     */
    @PostMapping("/ignored/{wxUserId}")
    @Operation(summary = "处理被忽略的推荐(负向反馈)")
    public R<Map<String, Object>> processIgnoredRecommendations(@PathVariable String wxUserId) {
        try {
            int count = behaviorTrackingService.processIgnoredRecommendations(wxUserId);
            return R.ok(Map.of(
                    "processedCount", count,
                    "message", count > 0 ? "已处理 " + count + " 个忽略的推荐" : "没有待处理的忽略推荐"
            ));
        } catch (Exception e) {
            log.error("处理忽略推荐失败", e);
            return R.fail("处理失败");
        }
    }

    /**
     * 转换DTO到实体
     */
    private UserBehaviorEvent convertToEvent(BehaviorEventDTO dto, HttpServletRequest request) {
        UserBehaviorEvent event = new UserBehaviorEvent();
        event.setWxUserId(dto.getWxUserId());
        event.setEventType(dto.getEventType());
        event.setEventTime(dto.getEventTime() != null ? dto.getEventTime() : LocalDateTime.now());
        event.setTargetType(dto.getTargetType());
        event.setTargetId(dto.getTargetId());
        event.setTargetName(dto.getTargetName());
        event.setEventData(dto.getEventData());
        event.setSessionId(dto.getSessionId());
        event.setDeviceType(dto.getDeviceType());
        event.setSourceType(dto.getSourceType());
        event.setSourceId(dto.getSourceId());

        // 获取IP地址
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty()) {
            ip = request.getRemoteAddr();
        }
        event.setIpAddress(ip);

        return event;
    }
}
