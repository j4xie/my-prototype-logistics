package com.joolun.web.api;

import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.MerchantStaff;
import com.joolun.mall.service.MerchantStaffService;
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
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/weixin/api/ma/merchant/{merchantId}/staff")
@Tag(name = "商户员工管理", description = "小程序端商户员工管理接口")
public class MaMerchantStaffApi {

    private final MerchantStaffService merchantStaffService;

    /**
     * 获取商户员工列表
     */
    @GetMapping
    @Operation(summary = "获取商户员工列表")
    public AjaxResult list(@PathVariable Long merchantId) {
        try {
            List<Map<String, Object>> staffList = merchantStaffService.getStaffDetails(merchantId);
            return AjaxResult.success(staffList);
        } catch (Exception e) {
            log.error("获取商户员工列表失败: merchantId={}", merchantId, e);
            return AjaxResult.error("获取员工列表失败");
        }
    }

    /**
     * 添加商户员工
     */
    @PostMapping
    @Operation(summary = "添加商户员工")
    public AjaxResult save(@PathVariable Long merchantId, @RequestBody MerchantStaff merchantStaff) {
        try {
            merchantStaff.setMerchantId(merchantId);
            merchantStaff.setCreateTime(LocalDateTime.now());
            merchantStaff.setStatus(1); // 默认启用
            boolean success = merchantStaffService.save(merchantStaff);
            return success ? AjaxResult.success("添加成功") : AjaxResult.error("添加失败");
        } catch (Exception e) {
            log.error("添加商户员工失败: merchantId={}", merchantId, e);
            return AjaxResult.error("添加员工失败");
        }
    }

    /**
     * 更新商户员工
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新商户员工")
    public AjaxResult update(@PathVariable Long merchantId, @PathVariable Long id, @RequestBody MerchantStaff merchantStaff) {
        try {
            merchantStaff.setId(id);
            merchantStaff.setMerchantId(merchantId);
            boolean success = merchantStaffService.updateById(merchantStaff);
            return success ? AjaxResult.success("更新成功") : AjaxResult.error("更新失败");
        } catch (Exception e) {
            log.error("更新商户员工失败: staffId={}", id, e);
            return AjaxResult.error("更新员工失败");
        }
    }

    /**
     * 移除商户员工
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "移除商户员工")
    public AjaxResult remove(@PathVariable Long merchantId, @PathVariable Long id) {
        try {
            boolean success = merchantStaffService.removeById(id);
            return success ? AjaxResult.success("移除成功") : AjaxResult.error("移除失败");
        } catch (Exception e) {
            log.error("移除商户员工失败: staffId={}", id, e);
            return AjaxResult.error("移除员工失败");
        }
    }
}




