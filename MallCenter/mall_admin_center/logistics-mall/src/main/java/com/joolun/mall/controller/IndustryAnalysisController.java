package com.joolun.mall.controller;

import com.joolun.common.core.domain.R;
import com.joolun.mall.dto.analysis.FactoryAnalysisDTO;
import com.joolun.mall.dto.analysis.ProductAnalysisDTO;
import com.joolun.mall.dto.industry.IndustryAnalysisDTO;
import com.joolun.mall.service.FactoryAnalysisService;
import com.joolun.mall.service.IndustryAnalysisService;
import com.joolun.mall.service.ProductAnalysisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * AI 分析 API 控制器 - 缓存管理
 * 注意: 分析端点(industry-analysis, product-analysis, factory-analysis)
 *       已在 AiChatApi 中实现，此处仅保留缓存管理端点
 */
@Slf4j
@RestController
@RequestMapping("/weixin/api/ma/ai")
@RequiredArgsConstructor
@Tag(name = "AI分析缓存管理", description = "AI分析报告缓存管理API")
public class IndustryAnalysisController {

    private final IndustryAnalysisService industryAnalysisService;
    private final ProductAnalysisService productAnalysisService;
    private final FactoryAnalysisService factoryAnalysisService;

    // 注意: /industry-analysis, /product-analysis/{productId}, /factory-analysis/{factoryId}
    // 端点已移至 AiChatApi.java 以避免重复映射

    /**
     * 获取缓存状态
     *
     * @return 缓存状态信息
     */
    @GetMapping("/industry-analysis/status")
    @Operation(summary = "获取缓存状态", description = "返回行业分析报告的缓存状态")
    public R<Map<String, Object>> getAnalysisStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("cacheValid", industryAnalysisService.isCacheValid());
        status.put("remainingSeconds", industryAnalysisService.getCacheRemainingSeconds());
        status.put("cacheTtlMinutes", 30);
        return R.ok(status);
    }

    /**
     * 清除缓存（管理员操作）
     *
     * @return 操作结果
     */
    @DeleteMapping("/industry-analysis/cache")
    @Operation(summary = "清除缓存", description = "清除行业分析报告缓存，下次请求将重新生成")
    public R<String> invalidateCache() {
        log.info("清除行业分析报告缓存");
        industryAnalysisService.invalidateCache();
        return R.ok("缓存已清除");
    }
}
