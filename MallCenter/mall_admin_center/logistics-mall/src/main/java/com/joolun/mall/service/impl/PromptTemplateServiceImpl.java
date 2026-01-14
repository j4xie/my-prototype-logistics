package com.joolun.mall.service.impl;

import com.joolun.mall.entity.DecorationPromptTemplate;
import com.joolun.mall.mapper.DecorationPromptTemplateMapper;
import com.joolun.mall.service.PromptTemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Prompt模板服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PromptTemplateServiceImpl implements PromptTemplateService {

    private final DecorationPromptTemplateMapper promptTemplateMapper;

    /**
     * 变量占位符正则表达式
     * 匹配 {variable_name} 格式
     */
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{(\\w+)\\}");

    @Override
    public DecorationPromptTemplate getByCode(String code) {
        if (!StringUtils.hasText(code)) {
            log.warn("getByCode called with empty code");
            return null;
        }
        return promptTemplateMapper.selectByCode(code);
    }

    @Override
    public List<DecorationPromptTemplate> getByIndustryAndType(String industryType, String imageType) {
        if (!StringUtils.hasText(industryType) || !StringUtils.hasText(imageType)) {
            log.warn("getByIndustryAndType called with empty parameters: industryType={}, imageType={}",
                    industryType, imageType);
            return Collections.emptyList();
        }
        return promptTemplateMapper.selectByIndustryAndType(industryType, imageType);
    }

    @Override
    public List<DecorationPromptTemplate> getByIndustry(String industryType) {
        if (!StringUtils.hasText(industryType)) {
            log.warn("getByIndustry called with empty industryType");
            return Collections.emptyList();
        }
        return promptTemplateMapper.selectByIndustry(industryType);
    }

    @Override
    public String buildPrompt(String templateCode, Map<String, String> variables) {
        if (!StringUtils.hasText(templateCode)) {
            log.warn("buildPrompt called with empty templateCode");
            return "";
        }

        DecorationPromptTemplate template = getByCode(templateCode);
        if (template == null) {
            log.warn("Template not found for code: {}", templateCode);
            return "";
        }

        String basePrompt = template.getBasePrompt();
        if (!StringUtils.hasText(basePrompt)) {
            log.warn("Template has empty basePrompt: {}", templateCode);
            return "";
        }

        // 替换变量
        String result = replaceVariables(basePrompt, variables);

        // 增加使用次数
        incrementUseCount(template.getId());

        log.debug("Built prompt from template {}: {}", templateCode, result);
        return result;
    }

    @Override
    public List<DecorationPromptTemplate> listActive() {
        return promptTemplateMapper.selectActiveList();
    }

    @Override
    public DecorationPromptTemplate getBestMatch(String industryType, String styleType, String imageType) {
        // 优先级1: 精确匹配行业+风格+图片类型
        List<DecorationPromptTemplate> templates = getByIndustryAndType(industryType, imageType);
        if (!CollectionUtils.isEmpty(templates)) {
            // 按风格筛选
            if (StringUtils.hasText(styleType)) {
                for (DecorationPromptTemplate template : templates) {
                    if (styleType.equals(template.getStyleType())) {
                        return template;
                    }
                }
            }
            // 返回第一个匹配的
            return templates.get(0);
        }

        // 优先级2: 尝试通用行业(general)
        templates = getByIndustryAndType("general", imageType);
        if (!CollectionUtils.isEmpty(templates)) {
            return templates.get(0);
        }

        // 优先级3: 返回任意匹配图片类型的模板
        List<DecorationPromptTemplate> allTemplates = promptTemplateMapper.selectByImageType(imageType);
        if (!CollectionUtils.isEmpty(allTemplates)) {
            return allTemplates.get(0);
        }

        log.warn("No template found for industryType={}, styleType={}, imageType={}",
                industryType, styleType, imageType);
        return null;
    }

    @Override
    public void incrementUseCount(Long templateId) {
        if (templateId != null) {
            try {
                promptTemplateMapper.incrementUseCount(templateId);
            } catch (Exception e) {
                log.error("Failed to increment use count for template {}: {}", templateId, e.getMessage());
            }
        }
    }

    /**
     * 替换模板中的变量
     * @param template 模板字符串
     * @param variables 变量映射
     * @return 替换后的字符串
     */
    private String replaceVariables(String template, Map<String, String> variables) {
        if (variables == null || variables.isEmpty()) {
            return template;
        }

        StringBuffer result = new StringBuffer();
        Matcher matcher = VARIABLE_PATTERN.matcher(template);

        while (matcher.find()) {
            String variableName = matcher.group(1);
            String replacement = variables.getOrDefault(variableName, matcher.group(0));
            // 转义特殊字符
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);

        return result.toString();
    }
}
