package com.joolun.web.controller.mall;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.controller.BaseController;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.SearchKeywordRecord;
import com.joolun.mall.entity.SearchKeywordStats;
import com.joolun.mall.service.SearchKeywordService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 搜索关键词管理 - 后台管理端
 * 用于查看和管理商家搜索关键词统计
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/mall/search-keyword")
public class SearchKeywordController extends BaseController {

    private final SearchKeywordService searchKeywordService;

    /**
     * 获取关键词统计概览
     *
     * @return 统计概览数据
     */
    @GetMapping("/overview")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:index')")
    public AjaxResult getOverview() {
        try {
            Map<String, Object> overview = searchKeywordService.getOverview();
            return AjaxResult.success(overview);
        } catch (Exception e) {
            log.error("获取关键词概览失败", e);
            return AjaxResult.error("获取概览失败");
        }
    }

    /**
     * 分页查询关键词统计
     *
     * @param page 分页参数
     * @param stats 查询条件
     * @return 统计列表
     */
    @GetMapping("/stats/page")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:index')")
    public AjaxResult pageStats(Page<SearchKeywordStats> page, SearchKeywordStats stats) {
        try {
            IPage<SearchKeywordStats> result = searchKeywordService.pageStats(page, stats);
            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("分页查询统计失败", e);
            return AjaxResult.error("查询失败");
        }
    }

    /**
     * 分页查询搜索记录明细
     *
     * @param page 分页参数
     * @param record 查询条件
     * @return 记录列表
     */
    @GetMapping("/records/page")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:index')")
    public AjaxResult pageRecords(Page<SearchKeywordRecord> page, SearchKeywordRecord record) {
        try {
            IPage<SearchKeywordRecord> result = searchKeywordService.pageRecords(page, record);
            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("分页查询记录失败", e);
            return AjaxResult.error("查询失败");
        }
    }

    /**
     * 获取热门搜索词
     *
     * @param limit 返回数量
     * @return 热门关键词列表
     */
    @GetMapping("/hot")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:index')")
    public AjaxResult getHotKeywords(
            @RequestParam(value = "limit", defaultValue = "20") Integer limit) {
        try {
            List<SearchKeywordStats> hotKeywords = searchKeywordService.getHotKeywords(limit);
            return AjaxResult.success(hotKeywords);
        } catch (Exception e) {
            log.error("获取热门关键词失败", e);
            return AjaxResult.error("获取失败");
        }
    }

    /**
     * 获取待处理的高优先级关键词
     * 主要是无结果搜索的关键词
     *
     * @param limit 返回数量
     * @return 待处理关键词列表
     */
    @GetMapping("/pending")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:index')")
    public AjaxResult getPendingKeywords(
            @RequestParam(value = "limit", defaultValue = "50") Integer limit) {
        try {
            // 获取无结果次数多的关键词
            SearchKeywordStats query = new SearchKeywordStats();
            query.setStatus(0); // 待处理
            query.setPriority(1); // 高优先级

            Page<SearchKeywordStats> page = new Page<>(1, limit);
            IPage<SearchKeywordStats> result = searchKeywordService.pageStats(page, query);
            return AjaxResult.success(result.getRecords());
        } catch (Exception e) {
            log.error("获取待处理关键词失败", e);
            return AjaxResult.error("获取失败");
        }
    }

    /**
     * 获取关键词详情
     *
     * @param id 关键词统计ID
     * @return 详情信息
     */
    @GetMapping("/stats/{id}")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:get')")
    public AjaxResult getStatsById(@PathVariable("id") Long id) {
        try {
            SearchKeywordStats stats = searchKeywordService.getStatsById(id);
            if (stats == null) {
                return AjaxResult.error("记录不存在");
            }
            return AjaxResult.success(stats);
        } catch (Exception e) {
            log.error("获取关键词详情失败: id={}", id, e);
            return AjaxResult.error("获取失败");
        }
    }

    /**
     * 为关键词匹配商品
     *
     * @param id 关键词统计ID
     * @param params 包含 productIds 商品ID列表
     * @return 匹配结果
     */
    @PostMapping("/stats/{id}/match-products")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:edit')")
    public AjaxResult matchProducts(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> params) {

        @SuppressWarnings("unchecked")
        List<String> productIds = (List<String>) params.get("productIds");
        if (productIds == null || productIds.isEmpty()) {
            return AjaxResult.error("请选择要匹配的商品");
        }

        try {
            boolean result = searchKeywordService.matchProducts(id, productIds);
            return result ? AjaxResult.success("商品匹配成功") : AjaxResult.error("匹配失败");
        } catch (Exception e) {
            log.error("匹配商品失败: id={}, productIds={}", id, productIds, e);
            return AjaxResult.error("匹配失败");
        }
    }

    /**
     * 发送商品上架通知给搜索过的商家
     *
     * @param id 关键词统计ID
     * @param params 包含 notificationConfig 通知配置
     * @return 发送结果
     */
    @PostMapping("/stats/{id}/notify")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:edit')")
    public AjaxResult notifyMerchants(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> params) {

        Boolean sendSms = (Boolean) params.getOrDefault("sendSms", false);
        String templateCode = (String) params.get("templateCode");

        try {
            Map<String, Object> result = searchKeywordService.notifyMerchants(id, sendSms, templateCode);
            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("发送通知失败: id={}", id, e);
            return AjaxResult.error("发送通知失败");
        }
    }

    /**
     * 更新关键词统计状态
     *
     * @param id 关键词统计ID
     * @param status 新状态
     * @return 更新结果
     */
    @PutMapping("/stats/{id}/status")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:edit')")
    public AjaxResult updateStatus(
            @PathVariable("id") Long id,
            @RequestParam("status") Integer status) {
        try {
            SearchKeywordStats stats = searchKeywordService.getStatsById(id);
            if (stats == null) {
                return AjaxResult.error("记录不存在");
            }

            stats.setStatus(status);
            boolean result = searchKeywordService.updateStats(stats);
            return result ? AjaxResult.success("状态更新成功") : AjaxResult.error("更新失败");
        } catch (Exception e) {
            log.error("更新状态失败: id={}, status={}", id, status, e);
            return AjaxResult.error("更新失败");
        }
    }

    /**
     * 更新关键词优先级
     *
     * @param id 关键词统计ID
     * @param priority 优先级
     * @return 更新结果
     */
    @PutMapping("/stats/{id}/priority")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:edit')")
    public AjaxResult updatePriority(
            @PathVariable("id") Long id,
            @RequestParam("priority") Integer priority) {
        try {
            SearchKeywordStats stats = searchKeywordService.getStatsById(id);
            if (stats == null) {
                return AjaxResult.error("记录不存在");
            }

            stats.setPriority(priority);
            boolean result = searchKeywordService.updateStats(stats);
            return result ? AjaxResult.success("优先级更新成功") : AjaxResult.error("更新失败");
        } catch (Exception e) {
            log.error("更新优先级失败: id={}, priority={}", id, priority, e);
            return AjaxResult.error("更新失败");
        }
    }

    /**
     * 设置关键词为热门
     *
     * @param id 关键词统计ID
     * @param isHot 是否热门
     * @return 更新结果
     */
    @PutMapping("/stats/{id}/hot")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:edit')")
    public AjaxResult setHot(
            @PathVariable("id") Long id,
            @RequestParam("isHot") Boolean isHot) {
        try {
            SearchKeywordStats stats = searchKeywordService.getStatsById(id);
            if (stats == null) {
                return AjaxResult.error("记录不存在");
            }

            stats.setIsHot(isHot != null && isHot ? 1 : 0);
            boolean result = searchKeywordService.updateStats(stats);
            return result ? AjaxResult.success("热门状态更新成功") : AjaxResult.error("更新失败");
        } catch (Exception e) {
            log.error("更新热门状态失败: id={}, isHot={}", id, isHot, e);
            return AjaxResult.error("更新失败");
        }
    }

    /**
     * 添加管理员备注
     *
     * @param id 关键词统计ID
     * @param params 包含 note 备注内容
     * @return 更新结果
     */
    @PutMapping("/stats/{id}/note")
    @PreAuthorize("@ss.hasPermi('mall:searchkeyword:edit')")
    public AjaxResult addNote(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> params) {
        String note = (String) params.get("note");

        try {
            SearchKeywordStats stats = searchKeywordService.getStatsById(id);
            if (stats == null) {
                return AjaxResult.error("记录不存在");
            }

            stats.setAdminNote(note);
            boolean result = searchKeywordService.updateStats(stats);
            return result ? AjaxResult.success("备注保存成功") : AjaxResult.error("保存失败");
        } catch (Exception e) {
            log.error("添加备注失败: id={}", id, e);
            return AjaxResult.error("保存失败");
        }
    }
}
