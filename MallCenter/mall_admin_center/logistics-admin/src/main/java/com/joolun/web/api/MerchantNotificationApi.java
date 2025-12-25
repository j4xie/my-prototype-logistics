package com.joolun.web.api;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.MerchantNotification;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.service.MerchantNotificationService;
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
 * 商家通知API - 小程序端
 * 提供商家站内消息功能
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/notification")
public class MerchantNotificationApi {

    private final MerchantNotificationService notificationService;
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
     * 获取通知列表
     *
     * @param page 分页参数
     * @param category 分类筛选（可选）
     * @return 通知列表
     */
    @GetMapping("/list")
    public AjaxResult getNotificationList(
            Page<MerchantNotification> page,
            @RequestParam(value = "category", required = false) String category) {

        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        // TODO: 获取用户关联的商户ID
        Long merchantId = getMerchantIdFromUser(wxUser);
        if (merchantId == null) {
            return AjaxResult.success(new Page<>());
        }

        try {
            MerchantNotification query = new MerchantNotification();
            query.setMerchantId(merchantId);
            if (category != null && !category.isEmpty()) {
                query.setCategory(category);
            }

            IPage<MerchantNotification> result = notificationService.pageNotifications(page, query);
            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("获取通知列表失败: merchantId={}", merchantId, e);
            return AjaxResult.error("获取通知失败");
        }
    }

    /**
     * 获取未读通知数量
     *
     * @return 未读数量
     */
    @GetMapping("/unread-count")
    public AjaxResult getUnreadCount() {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.success(Map.of("count", 0));
        }

        Long merchantId = getMerchantIdFromUser(wxUser);
        if (merchantId == null) {
            return AjaxResult.success(Map.of("count", 0));
        }

        try {
            int count = notificationService.getUnreadCount(merchantId);
            return AjaxResult.success(Map.of("count", count));
        } catch (Exception e) {
            log.error("获取未读数量失败: merchantId={}", merchantId, e);
            return AjaxResult.success(Map.of("count", 0));
        }
    }

    /**
     * 获取通知详情
     *
     * @param id 通知ID
     * @return 通知详情
     */
    @GetMapping("/{id}")
    public AjaxResult getNotificationDetail(@PathVariable("id") Long id) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        try {
            MerchantNotification notification = notificationService.getById(id);
            if (notification == null) {
                return AjaxResult.error("通知不存在");
            }

            // 验证通知是否属于当前用户的商户
            Long merchantId = getMerchantIdFromUser(wxUser);
            if (!notification.getMerchantId().equals(merchantId)) {
                return AjaxResult.error("无权查看此通知");
            }

            // 自动标记为已读
            if (notification.getInAppStatus() == 1) {
                notificationService.markAsRead(List.of(id));
                notification.setInAppStatus(2);
            }

            return AjaxResult.success(notification);
        } catch (Exception e) {
            log.error("获取通知详情失败: id={}", id, e);
            return AjaxResult.error("获取通知失败");
        }
    }

    /**
     * 标记通知为已读
     *
     * @param params 包含 ids 通知ID列表
     * @return 操作结果
     */
    @PutMapping("/read")
    public AjaxResult markAsRead(@RequestBody Map<String, Object> params) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        @SuppressWarnings("unchecked")
        List<Long> ids = (List<Long>) params.get("ids");
        if (ids == null || ids.isEmpty()) {
            return AjaxResult.error("请选择要标记的通知");
        }

        try {
            boolean result = notificationService.markAsRead(ids);
            return result ? AjaxResult.success("标记成功") : AjaxResult.error("标记失败");
        } catch (Exception e) {
            log.error("标记已读失败: ids={}", ids, e);
            return AjaxResult.error("操作失败");
        }
    }

    /**
     * 标记所有通知为已读
     *
     * @return 操作结果
     */
    @PutMapping("/read-all")
    public AjaxResult markAllAsRead() {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        Long merchantId = getMerchantIdFromUser(wxUser);
        if (merchantId == null) {
            return AjaxResult.success("没有需要标记的通知");
        }

        try {
            // 获取所有未读通知ID并标记
            MerchantNotification query = new MerchantNotification();
            query.setMerchantId(merchantId);
            query.setInAppStatus(1); // 未读

            IPage<MerchantNotification> unread = notificationService.pageNotifications(
                new Page<>(1, 1000), query);

            List<Long> ids = unread.getRecords().stream()
                .map(MerchantNotification::getId)
                .toList();

            if (!ids.isEmpty()) {
                notificationService.markAsRead(ids);
            }

            return AjaxResult.success(Map.of("markedCount", ids.size()));
        } catch (Exception e) {
            log.error("标记全部已读失败: merchantId={}", merchantId, e);
            return AjaxResult.error("操作失败");
        }
    }

    /**
     * 删除通知
     *
     * @param id 通知ID
     * @return 操作结果
     */
    @DeleteMapping("/{id}")
    public AjaxResult deleteNotification(@PathVariable("id") Long id) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        try {
            MerchantNotification notification = notificationService.getById(id);
            if (notification == null) {
                return AjaxResult.error("通知不存在");
            }

            // 验证权限
            Long merchantId = getMerchantIdFromUser(wxUser);
            if (!notification.getMerchantId().equals(merchantId)) {
                return AjaxResult.error("无权删除此通知");
            }

            // 软删除：将状态设为已删除
            notification.setInAppStatus(3); // 3=已删除
            boolean result = notificationService.updateById(notification);

            return result ? AjaxResult.success("删除成功") : AjaxResult.error("删除失败");
        } catch (Exception e) {
            log.error("删除通知失败: id={}", id, e);
            return AjaxResult.error("删除失败");
        }
    }

    /**
     * 获取通知统计
     *
     * @return 各类通知统计
     */
    @GetMapping("/stats")
    public AjaxResult getNotificationStats() {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.success(Map.of(
                "total", 0,
                "unread", 0,
                "productFound", 0,
                "promotion", 0,
                "system", 0
            ));
        }

        Long merchantId = getMerchantIdFromUser(wxUser);
        if (merchantId == null) {
            return AjaxResult.success(Map.of(
                "total", 0,
                "unread", 0,
                "productFound", 0,
                "promotion", 0,
                "system", 0
            ));
        }

        try {
            Map<String, Object> stats = new HashMap<>();
            stats.put("unread", notificationService.getUnreadCount(merchantId));

            // 可以添加更多统计数据
            // stats.put("productFound", countByCategory(merchantId, "product_found"));
            // stats.put("promotion", countByCategory(merchantId, "promotion"));
            // stats.put("system", countByCategory(merchantId, "system"));

            return AjaxResult.success(stats);
        } catch (Exception e) {
            log.error("获取通知统计失败: merchantId={}", merchantId, e);
            return AjaxResult.error("获取统计失败");
        }
    }

    /**
     * 从用户获取关联的商户ID
     */
    private Long getMerchantIdFromUser(WxUser wxUser) {
        if (wxUser == null || wxUser.getId() == null) {
            return null;
        }

        try {
            // 根据用户ID查询关联的商户
            Merchant merchant = merchantMapper.selectByUserId(Long.parseLong(wxUser.getId()));
            return merchant != null ? merchant.getId() : null;
        } catch (Exception e) {
            log.error("查询用户关联商户失败: userId={}", Long.parseLong(wxUser.getId()), e);
            return null;
        }
    }
}
