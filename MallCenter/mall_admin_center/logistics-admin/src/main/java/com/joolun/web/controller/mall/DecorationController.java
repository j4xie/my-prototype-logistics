package com.joolun.web.controller.mall;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.controller.BaseController;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.common.core.page.TableDataInfo;
import com.joolun.mall.entity.*;
import com.joolun.mall.mapper.AiDecorationSessionMapper;
import com.joolun.mall.mapper.DecorationKeywordMappingMapper;
import com.joolun.mall.mapper.DecorationPromptTemplateMapper;
import com.joolun.mall.service.DecorationService;
import com.joolun.mall.service.DecorationAiService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 装修管理
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/mall/decoration")
public class DecorationController extends BaseController {

    private final DecorationService decorationService;
    private final DecorationAiService aiService;
    private final DecorationPromptTemplateMapper promptTemplateMapper;
    private final DecorationKeywordMappingMapper keywordMappingMapper;
    private final AiDecorationSessionMapper sessionMapper;

    // ============ 模板管理 ============

    /**
     * 分页查询模板列表
     */
    @GetMapping("/templates")
    @PreAuthorize("@ss.hasPermi('mall:decoration:index')")
    public TableDataInfo listTemplates(DecorationTemplate query) {
        startPage();
        Page<DecorationTemplate> page = new Page<>();
        return getDataTable(decorationService.pageTemplates(page, query).getRecords());
    }

    /**
     * 通过id查询模板
     */
    @GetMapping("/templates/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:index')")
    public AjaxResult getTemplate(@PathVariable("id") Long id) {
        return AjaxResult.success(decorationService.getTemplateById(id));
    }

    /**
     * 新增模板
     */
    @PostMapping("/templates")
    @PreAuthorize("@ss.hasPermi('mall:decoration:add')")
    public AjaxResult createTemplate(@RequestBody DecorationTemplate template) {
        return AjaxResult.success(decorationService.saveTemplate(template));
    }

    /**
     * 修改模板
     */
    @PutMapping("/templates/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:edit')")
    public AjaxResult updateTemplate(@PathVariable("id") Long id, @RequestBody DecorationTemplate template) {
        template.setId(id);
        return AjaxResult.success(decorationService.updateTemplate(template));
    }

    /**
     * 删除模板
     */
    @DeleteMapping("/templates/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:del')")
    public AjaxResult deleteTemplate(@PathVariable("id") Long id) {
        return AjaxResult.success(decorationService.removeById(id));
    }

    // ============ 模块管理 ============

    /**
     * 获取所有可用模块
     */
    @GetMapping("/modules")
    public AjaxResult listModules() {
        return AjaxResult.success(decorationService.listModules());
    }

    /**
     * 通过编码查询模块
     */
    @GetMapping("/modules/{code}")
    public AjaxResult getModule(@PathVariable("code") String code) {
        return AjaxResult.success(decorationService.getModuleByCode(code));
    }

    // ============ 主题管理 ============

    /**
     * 获取主题列表
     */
    @GetMapping("/themes")
    public AjaxResult listThemes(@RequestParam(required = false) String styleTag) {
        return AjaxResult.success(decorationService.listThemes(styleTag));
    }

    /**
     * 通过编码查询主题
     */
    @GetMapping("/themes/{code}")
    public AjaxResult getTheme(@PathVariable("code") String code) {
        return AjaxResult.success(decorationService.getThemeByCode(code));
    }

    // ============ 商户配置 ============

    /**
     * 获取商户页面配置
     */
    @GetMapping("/page-config")
    public AjaxResult getPageConfig(
            @RequestParam(required = false) Long merchantId,
            @RequestParam(defaultValue = "home") String pageType) {
        return AjaxResult.success(decorationService.getPageConfig(merchantId, pageType));
    }

    /**
     * 保存商户页面配置
     */
    @PostMapping("/page-config")
    public AjaxResult savePageConfig(@RequestBody MerchantPageConfig config) {
        return AjaxResult.success(decorationService.savePageConfig(config));
    }

    /**
     * 发布页面配置
     */
    @PostMapping("/page-config/{id}/publish")
    public AjaxResult publishPageConfig(@PathVariable("id") Long id) {
        return AjaxResult.success(decorationService.publishPageConfig(id));
    }

    // ============ AI智能装修 ============

    /**
     * AI分析商户数据并生成装修建议
     */
    @PostMapping("/ai/analyze")
    public AjaxResult aiAnalyze(@RequestBody Map<String, Object> request) {
        String prompt = (String) request.get("prompt");
        Long merchantId = request.get("merchantId") != null ? Long.valueOf(request.get("merchantId").toString()) : null;
        return AjaxResult.success(aiService.analyze(prompt, merchantId));
    }

    /**
     * 应用AI生成的装修方案
     */
    @PostMapping("/ai/apply/{sessionId}")
    public AjaxResult aiApply(@PathVariable("sessionId") String sessionId) {
        return AjaxResult.success(aiService.applyConfig(sessionId));
    }

    /**
     * 精调AI装修方案
     */
    @PostMapping("/ai/refine")
    public AjaxResult aiRefine(@RequestBody Map<String, Object> request) {
        String sessionId = (String) request.get("sessionId");
        String refinement = (String) request.get("refinement");
        return AjaxResult.success(aiService.refine(sessionId, refinement));
    }

    /**
     * 获取会话结果
     */
    @GetMapping("/ai/session/{sessionId}")
    public AjaxResult getSession(@PathVariable("sessionId") String sessionId) {
        return AjaxResult.success(aiService.getSessionResult(sessionId));
    }

    // ============ Phase 8: Prompt模板管理 ============

    /**
     * 分页查询Prompt模板
     */
    @GetMapping("/prompt-templates")
    @PreAuthorize("@ss.hasPermi('mall:decoration:index')")
    public TableDataInfo listPromptTemplates(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String industryType,
            @RequestParam(required = false) String imageType,
            @RequestParam(required = false) Integer status) {
        startPage();
        LambdaQueryWrapper<DecorationPromptTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(name), DecorationPromptTemplate::getName, name)
               .eq(StringUtils.hasText(industryType), DecorationPromptTemplate::getIndustryType, industryType)
               .eq(StringUtils.hasText(imageType), DecorationPromptTemplate::getImageType, imageType)
               .eq(status != null, DecorationPromptTemplate::getStatus, status)
               .orderByDesc(DecorationPromptTemplate::getCreateTime);
        return getDataTable(promptTemplateMapper.selectList(wrapper));
    }

    /**
     * 获取Prompt模板详情
     */
    @GetMapping("/prompt-templates/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:index')")
    public AjaxResult getPromptTemplate(@PathVariable("id") Long id) {
        return AjaxResult.success(promptTemplateMapper.selectById(id));
    }

    /**
     * 创建Prompt模板
     */
    @PostMapping("/prompt-templates")
    @PreAuthorize("@ss.hasPermi('mall:decoration:add')")
    public AjaxResult createPromptTemplate(@RequestBody DecorationPromptTemplate template) {
        return AjaxResult.success(promptTemplateMapper.insert(template));
    }

    /**
     * 更新Prompt模板
     */
    @PutMapping("/prompt-templates/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:edit')")
    public AjaxResult updatePromptTemplate(@PathVariable("id") Long id, @RequestBody DecorationPromptTemplate template) {
        template.setId(id);
        return AjaxResult.success(promptTemplateMapper.updateById(template));
    }

    /**
     * 删除Prompt模板
     */
    @DeleteMapping("/prompt-templates/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:del')")
    public AjaxResult deletePromptTemplate(@PathVariable("id") Long id) {
        return AjaxResult.success(promptTemplateMapper.deleteById(id));
    }

    // ============ 关键词映射管理 ============

    /**
     * 分页查询关键词映射
     */
    @GetMapping("/keyword-mappings")
    @PreAuthorize("@ss.hasPermi('mall:decoration:index')")
    public TableDataInfo listKeywordMappings(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String mappingType,
            @RequestParam(required = false) Integer status) {
        startPage();
        LambdaQueryWrapper<DecorationKeywordMapping> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(keyword), DecorationKeywordMapping::getKeyword, keyword)
               .eq(StringUtils.hasText(mappingType), DecorationKeywordMapping::getMappingType, mappingType)
               .eq(status != null, DecorationKeywordMapping::getStatus, status)
               .orderByDesc(DecorationKeywordMapping::getWeight);
        return getDataTable(keywordMappingMapper.selectList(wrapper));
    }

    /**
     * 创建关键词映射
     */
    @PostMapping("/keyword-mappings")
    @PreAuthorize("@ss.hasPermi('mall:decoration:add')")
    public AjaxResult createKeywordMapping(@RequestBody DecorationKeywordMapping mapping) {
        return AjaxResult.success(keywordMappingMapper.insert(mapping));
    }

    /**
     * 更新关键词映射
     */
    @PutMapping("/keyword-mappings/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:edit')")
    public AjaxResult updateKeywordMapping(@PathVariable("id") Long id, @RequestBody DecorationKeywordMapping mapping) {
        mapping.setId(id);
        return AjaxResult.success(keywordMappingMapper.updateById(mapping));
    }

    /**
     * 删除关键词映射
     */
    @DeleteMapping("/keyword-mappings/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:del')")
    public AjaxResult deleteKeywordMapping(@PathVariable("id") Long id) {
        return AjaxResult.success(keywordMappingMapper.deleteById(id));
    }

    /**
     * 批量导入关键词映射
     */
    @PostMapping("/keyword-mappings/batch")
    @PreAuthorize("@ss.hasPermi('mall:decoration:add')")
    public AjaxResult batchImportKeywordMappings(@RequestBody List<DecorationKeywordMapping> mappings) {
        int count = 0;
        for (DecorationKeywordMapping mapping : mappings) {
            keywordMappingMapper.insert(mapping);
            count++;
        }
        return AjaxResult.success(count);
    }

    // ============ AI会话记录管理 ============

    /**
     * 分页查询AI会话记录
     */
    @GetMapping("/ai-sessions")
    @PreAuthorize("@ss.hasPermi('mall:decoration:index')")
    public TableDataInfo listAiSessions(
            @RequestParam(required = false) Long merchantId,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        startPage();
        LambdaQueryWrapper<AiDecorationSession> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(merchantId != null, AiDecorationSession::getMerchantId, merchantId)
               .eq(status != null, AiDecorationSession::getStatus, status)
               .orderByDesc(AiDecorationSession::getCreateTime);
        return getDataTable(sessionMapper.selectList(wrapper));
    }

    /**
     * 获取AI会话详情
     */
    @GetMapping("/ai-sessions/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:index')")
    public AjaxResult getAiSession(@PathVariable("id") Long id) {
        return AjaxResult.success(sessionMapper.selectById(id));
    }

    /**
     * 删除AI会话记录
     */
    @DeleteMapping("/ai-sessions/{id}")
    @PreAuthorize("@ss.hasPermi('mall:decoration:del')")
    public AjaxResult deleteAiSession(@PathVariable("id") Long id) {
        return AjaxResult.success(sessionMapper.deleteById(id));
    }

    // ============ AI使用统计 ============

    /**
     * 获取商户AI使用列表
     */
    @GetMapping("/ai-usage/merchants")
    @PreAuthorize("@ss.hasPermi('mall:decoration:index')")
    public AjaxResult getMerchantAiUsage() {
        // 统计每个商户的AI使用情况
        List<Map<String, Object>> usageList = sessionMapper.selectMerchantUsageStats();
        return AjaxResult.success(usageList);
    }

    /**
     * 获取AI使用总览统计
     */
    @GetMapping("/ai-usage/overview")
    @PreAuthorize("@ss.hasPermi('mall:decoration:index')")
    public AjaxResult getAiUsageOverview() {
        Map<String, Object> overview = new HashMap<>();

        // 总会话数
        Long totalSessions = sessionMapper.selectCount(null);
        overview.put("totalSessions", totalSessions);

        // 已完成会话数 (status=1)
        Long completedSessions = sessionMapper.selectCount(
            new LambdaQueryWrapper<AiDecorationSession>().eq(AiDecorationSession::getStatus, 1)
        );
        overview.put("completedSessions", completedSessions);

        // 已应用配置数 (status=1且有generatedConfig)
        Long appliedConfigs = sessionMapper.selectCount(
            new LambdaQueryWrapper<AiDecorationSession>()
                .eq(AiDecorationSession::getStatus, 1)
                .isNotNull(AiDecorationSession::getGeneratedConfig)
        );
        overview.put("appliedConfigs", appliedConfigs);

        // 平均反馈分
        Double avgScore = sessionMapper.selectAvgFeedbackScore();
        overview.put("avgFeedbackScore", avgScore != null ? avgScore : 0.0);

        // 今日会话数
        Long todaySessions = sessionMapper.selectTodayCount();
        overview.put("todaySessions", todaySessions != null ? todaySessions : 0);

        // 本周会话数
        Long weekSessions = sessionMapper.selectWeekCount();
        overview.put("weekSessions", weekSessions != null ? weekSessions : 0);

        // 热门行业统计
        List<Map<String, Object>> topIndustries = sessionMapper.selectTopIndustries(5);
        overview.put("topIndustries", topIndustries);

        // 热门风格统计
        List<Map<String, Object>> topStyles = sessionMapper.selectTopStyles(5);
        overview.put("topStyles", topStyles);

        return AjaxResult.success(overview);
    }
}
