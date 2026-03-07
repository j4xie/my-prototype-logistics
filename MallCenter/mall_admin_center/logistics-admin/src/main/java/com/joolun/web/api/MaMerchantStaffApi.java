package com.joolun.web.api;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.MerchantStaff;
import com.joolun.mall.mapper.MerchantStaffMapper;
import com.joolun.mall.service.MerchantStaffService;
import com.joolun.web.utils.MerchantUserHelper;
import com.joolun.weixin.entity.ThirdSession;
import com.joolun.weixin.entity.WxUser;
import com.joolun.weixin.service.WxUserService;
import com.joolun.weixin.utils.ThirdSessionHolder;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 商户员工管理 API - 小程序端
 * 仅店主和管理员可操作写入接口
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/weixin/api/ma/merchant/{merchantId}/staff")
@Tag(name = "商户员工管理", description = "小程序端商户员工管理接口")
public class MaMerchantStaffApi {

    private final MerchantStaffService merchantStaffService;
    private final MerchantStaffMapper merchantStaffMapper;
    private final WxUserService wxUserService;
    private final MerchantUserHelper merchantUserHelper;

    /**
     * 校验当前用户是否有权管理该商户的员工
     * 必须是店主或 admin 角色，且属于该商户
     * @return 当前用户的 userId，无权限返回 null
     */
    private Long validateOwnerOrAdmin(Long merchantId) {
        ThirdSession session = ThirdSessionHolder.getThirdSession();
        if (session == null || session.getWxUserId() == null) {
            return null;
        }
        WxUser wxUser = wxUserService.getById(session.getWxUserId());
        if (wxUser == null) {
            return null;
        }
        Long userMerchantId = merchantUserHelper.getMerchantIdFromUser(wxUser);
        if (userMerchantId == null || !userMerchantId.equals(merchantId)) {
            return null;
        }

        Long userId = Long.parseLong(wxUser.getId());

        // 检查是否是 admin 角色（店主不一定在 staff 表中，但 userMerchantId 匹配即可）
        MerchantStaff staff = merchantStaffMapper.selectOne(
                new LambdaQueryWrapper<MerchantStaff>()
                        .eq(MerchantStaff::getMerchantId, merchantId)
                        .eq(MerchantStaff::getUserId, userId)
                        .eq(MerchantStaff::getStatus, 1));
        if (staff != null && !"owner".equals(staff.getRole()) && !"admin".equals(staff.getRole())) {
            return null;
        }
        return userId;
    }

    /**
     * 获取商户员工列表
     */
    @GetMapping
    @Operation(summary = "获取商户员工列表")
    public AjaxResult list(@PathVariable Long merchantId) {
        ThirdSession session = ThirdSessionHolder.getThirdSession();
        if (session == null) {
            return AjaxResult.error("请先登录");
        }

        List<Map<String, Object>> staffList = merchantStaffService.getStaffDetails(merchantId);
        return AjaxResult.success(staffList);
    }

    /**
     * 添加商户员工
     */
    @PostMapping
    @Operation(summary = "添加商户员工")
    public AjaxResult save(@PathVariable Long merchantId, @RequestBody MerchantStaff merchantStaff) {
        Long currentUserId = validateOwnerOrAdmin(merchantId);
        if (currentUserId == null) {
            return AjaxResult.error("无权限操作");
        }

        if (merchantStaff.getUserId() == null) {
            return AjaxResult.error("用户ID不能为空");
        }

        // 检查目标用户是否存在
        WxUser targetUser = wxUserService.getById(merchantStaff.getUserId().toString());
        if (targetUser == null) {
            return AjaxResult.error("用户不存在");
        }

        // 检查是否已是该商户员工
        MerchantStaff existing = merchantStaffMapper.selectOne(
                new LambdaQueryWrapper<MerchantStaff>()
                        .eq(MerchantStaff::getMerchantId, merchantId)
                        .eq(MerchantStaff::getUserId, merchantStaff.getUserId()));
        if (existing != null) {
            return AjaxResult.error("该用户已是本店员工");
        }

        merchantStaff.setMerchantId(merchantId);
        merchantStaff.setCreateTime(LocalDateTime.now());
        merchantStaff.setStatus(1);
        if (merchantStaff.getRole() == null) {
            merchantStaff.setRole("staff");
        }
        boolean success = merchantStaffService.save(merchantStaff);

        log.info("添加员工: merchantId={}, userId={}, role={}", merchantId, merchantStaff.getUserId(), merchantStaff.getRole());
        return success ? AjaxResult.success("添加成功") : AjaxResult.error("添加失败");
    }

    /**
     * 更新商户员工
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新商户员工")
    public AjaxResult update(@PathVariable Long merchantId, @PathVariable Long id, @RequestBody MerchantStaff merchantStaff) {
        Long currentUserId = validateOwnerOrAdmin(merchantId);
        if (currentUserId == null) {
            return AjaxResult.error("无权限操作");
        }

        MerchantStaff existing = merchantStaffService.getById(id);
        if (existing == null || !existing.getMerchantId().equals(merchantId)) {
            return AjaxResult.error("员工不存在");
        }

        merchantStaff.setId(id);
        merchantStaff.setMerchantId(merchantId);
        boolean success = merchantStaffService.updateById(merchantStaff);

        log.info("更新员工: staffId={}, merchantId={}", id, merchantId);
        return success ? AjaxResult.success("更新成功") : AjaxResult.error("更新失败");
    }

    /**
     * 移除商户员工
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "移除商户员工")
    public AjaxResult remove(@PathVariable Long merchantId, @PathVariable Long id) {
        Long currentUserId = validateOwnerOrAdmin(merchantId);
        if (currentUserId == null) {
            return AjaxResult.error("无权限操作");
        }

        MerchantStaff staff = merchantStaffService.getById(id);
        if (staff == null || !staff.getMerchantId().equals(merchantId)) {
            return AjaxResult.error("员工不存在");
        }

        // 不能移除自己
        if (staff.getUserId().equals(currentUserId)) {
            return AjaxResult.error("不能移除自己");
        }

        boolean success = merchantStaffService.removeById(id);
        log.info("移除员工: merchantId={}, staffId={}, userId={}", merchantId, id, staff.getUserId());
        return success ? AjaxResult.success("移除成功") : AjaxResult.error("移除失败");
    }
}
