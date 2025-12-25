package com.joolun.web.api;

import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.SearchKeywordRecord;
import com.joolun.mall.entity.SearchKeywordStats;
import com.joolun.mall.service.SearchKeywordService;
import com.joolun.weixin.entity.ThirdSession;
import com.joolun.weixin.entity.WxUser;
import com.joolun.weixin.service.WxUserService;
import com.joolun.weixin.utils.ThirdSessionHolder;
import com.joolun.web.utils.MerchantUserHelper;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 搜索关键词API - 小程序端
 * 用于记录商家搜索行为，特别是无结果搜索
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/search-keyword")
public class SearchKeywordApi {

    private final SearchKeywordService searchKeywordService;
    private final MerchantUserHelper merchantUserHelper;
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
     * 记录搜索关键词
     * 当搜索返回结果时记录，特别关注无结果搜索
     *
     * @param params 包含 keyword, resultCount
     * @return 记录结果
     */
    @PostMapping("/record")
    public AjaxResult recordSearch(@RequestBody Map<String, Object> params) {
        String keyword = (String) params.get("keyword");
        Integer resultCount = (Integer) params.getOrDefault("resultCount", 0);

        if (keyword == null || keyword.trim().isEmpty()) {
            return AjaxResult.error("关键词不能为空");
        }

        // 获取当前用户信息
        WxUser wxUser = getCurrentWxUser();
        Long userId = null;
        Long merchantId = null;
        String phone = null;

        if (wxUser != null) {
            userId = Long.parseLong(wxUser.getId());
            phone = wxUser.getPhone();
            // 获取用户关联的商户ID
            merchantId = merchantUserHelper.getMerchantIdFromUser(wxUser);
        }

        try {
            SearchKeywordRecord record = searchKeywordService.recordSearch(
                keyword.trim(),
                userId,
                merchantId,
                phone,
                resultCount
            );

            Map<String, Object> result = Map.of(
                "id", record.getId(),
                "recorded", true,
                "noResult", resultCount == 0,
                "message", resultCount == 0 ? "已记录您的需求，有新品上架会通知您" : "搜索记录成功"
            );

            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("记录搜索关键词失败: keyword={}", keyword, e);
            return AjaxResult.error("记录失败，请稍后重试");
        }
    }

    /**
     * 获取热门搜索词
     * 用于搜索页展示热门搜索
     *
     * @param limit 返回数量，默认10
     * @return 热门搜索词列表
     */
    @GetMapping("/hot")
    public AjaxResult getHotKeywords(
            @RequestParam(value = "limit", defaultValue = "10") Integer limit) {
        try {
            List<SearchKeywordStats> hotKeywords = searchKeywordService.getHotKeywords(limit);
            return AjaxResult.success(hotKeywords);
        } catch (Exception e) {
            log.error("获取热门搜索词失败", e);
            return AjaxResult.error("获取失败");
        }
    }

    /**
     * 获取搜索建议
     * 根据输入前缀返回搜索建议
     *
     * @param prefix 搜索前缀
     * @param limit 返回数量
     * @return 搜索建议列表
     */
    @GetMapping("/suggest")
    public AjaxResult getSuggestions(
            @RequestParam("prefix") String prefix,
            @RequestParam(value = "limit", defaultValue = "5") Integer limit) {
        if (prefix == null || prefix.trim().length() < 2) {
            return AjaxResult.success(List.of());
        }

        try {
            // 从已有的热门关键词中匹配
            List<SearchKeywordStats> allHot = searchKeywordService.getHotKeywords(100);
            List<String> suggestions = allHot.stream()
                .filter(s -> s.getKeyword().contains(prefix.trim()))
                .limit(limit)
                .map(SearchKeywordStats::getKeyword)
                .toList();

            return AjaxResult.success(suggestions);
        } catch (Exception e) {
            log.error("获取搜索建议失败: prefix={}", prefix, e);
            return AjaxResult.success(List.of());
        }
    }
}
