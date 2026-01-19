package com.cretas.aims.service.skill.impl;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.skill.SkillContext;
import com.cretas.aims.dto.skill.SkillDefinition;
import com.cretas.aims.dto.skill.SkillResult;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.ToolRouterService;
import com.cretas.aims.service.skill.SkillExecutor;
import com.cretas.aims.service.skill.SkillRegistry;
import com.cretas.aims.service.skill.SkillRouterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Skill路由服务实现
 *
 * 作为AI请求处理的入口，协调Skill匹配和执行：
 * 1. 优先尝试Skill匹配
 * 2. Skill执行失败时fallback到ToolRouter
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SkillRouterServiceImpl implements SkillRouterService {

    private final SkillRegistry skillRegistry;
    private final SkillExecutor skillExecutor;
    private final AIIntentService intentService;
    private final ToolRouterService toolRouter;

    @Value("${cretas.skills.enabled:true}")
    private boolean skillsEnabled;

    @Value("${cretas.skills.min_confidence:0.3}")
    private double minSkillConfidence;

    // 统计计数器
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong skillMatches = new AtomicLong(0);
    private final AtomicLong skillSuccesses = new AtomicLong(0);
    private final AtomicLong toolRouterFallbacks = new AtomicLong(0);

    @Override
    public Object processQuery(String userQuery, String factoryId, String userId) {
        return processQuery(userQuery, factoryId, userId, null);
    }

    @Override
    public Object processQuery(String userQuery, String factoryId, String userId, String sessionId) {
        SkillContext context = SkillContext.builder()
                .factoryId(factoryId)
                .userId(userId)
                .sessionId(sessionId)
                .userQuery(userQuery)
                .extractedParams(new HashMap<>())
                .build();

        return processQuery(context);
    }

    @Override
    public Object processQuery(SkillContext context) {
        totalRequests.incrementAndGet();

        String userQuery = context.getUserQuery();
        String factoryId = context.getFactoryId();

        log.info("Processing query: factoryId={}, query='{}'",
                factoryId, truncate(userQuery, 50));

        // 检查Skills是否启用
        if (!skillsEnabled) {
            log.debug("Skills disabled, falling back to ToolRouter");
            return fallbackToToolRouter(userQuery, factoryId);
        }

        // 1. 查找匹配的Skills
        List<SkillDefinition> matchingSkills = skillRegistry.findMatchingSkills(userQuery);

        if (!matchingSkills.isEmpty()) {
            skillMatches.incrementAndGet();

            // 2. 使用最佳匹配的Skill
            SkillDefinition bestMatch = matchingSkills.get(0);
            double matchScore = bestMatch.calculateMatchScore(userQuery);

            log.info("Found matching skill: name={}, score={}, query='{}'",
                    bestMatch.getName(), String.format("%.2f", matchScore),
                    truncate(userQuery, 50));

            // 检查匹配置信度
            if (matchScore < minSkillConfidence) {
                log.info("Skill match score too low ({} < {}), falling back to ToolRouter",
                        matchScore, minSkillConfidence);
                return fallbackToToolRouter(userQuery, factoryId);
            }

            // 3. 执行Skill
            SkillResult result = skillExecutor.execute(bestMatch, context);

            if (result.isSuccess()) {
                skillSuccesses.incrementAndGet();
                log.info("Skill executed successfully: name={}, tools={}, time={}ms",
                        result.getSkillName(),
                        result.getExecutedTools(),
                        result.getExecutionTime());
                return result;
            }

            // 4. Skill执行失败，记录日志并fallback
            log.warn("Skill execution failed: name={}, message={}. Falling back to ToolRouter",
                    result.getSkillName(), result.getMessage());
        } else {
            log.debug("No matching skill found for query: '{}'", truncate(userQuery, 50));
        }

        // 5. 没有匹配的Skill或执行失败，fallback到ToolRouter
        return fallbackToToolRouter(userQuery, factoryId);
    }

    @Override
    public List<SkillDefinition> findMatchingSkills(String userQuery) {
        return skillRegistry.findMatchingSkills(userQuery);
    }

    @Override
    public SkillResult executeSkill(String skillName, SkillContext context) {
        Optional<SkillDefinition> skillOpt = skillRegistry.getSkill(skillName);

        if (skillOpt.isEmpty()) {
            return SkillResult.builder()
                    .success(false)
                    .skillName(skillName)
                    .message("Skill not found: " + skillName)
                    .executionTime(0)
                    .build();
        }

        return skillExecutor.execute(skillOpt.get(), context);
    }

    @Override
    public boolean isSkillsEnabled() {
        return skillsEnabled;
    }

    @Override
    public Map<String, Object> getRouterStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("skillsEnabled", skillsEnabled);
        stats.put("registeredSkills", skillRegistry.getSkillCount());
        stats.put("enabledSkills", skillRegistry.getEnabledSkills().size());
        stats.put("totalRequests", totalRequests.get());
        stats.put("skillMatches", skillMatches.get());
        stats.put("skillSuccesses", skillSuccesses.get());
        stats.put("toolRouterFallbacks", toolRouterFallbacks.get());

        // 计算成功率
        long matches = skillMatches.get();
        long successes = skillSuccesses.get();
        stats.put("skillSuccessRate", matches > 0 ?
                String.format("%.2f%%", (double) successes / matches * 100) : "N/A");

        return stats;
    }

    /**
     * Fallback到ToolRouter处理
     */
    private Object fallbackToToolRouter(String userQuery, String factoryId) {
        toolRouterFallbacks.incrementAndGet();

        log.debug("Falling back to ToolRouter for query: '{}'", truncate(userQuery, 50));

        try {
            // 1. 使用意图服务识别意图
            IntentMatchResult intentResult = intentService.recognizeIntentWithConfidence(userQuery, 3);

            // 2. 检查是否需要动态工具选择
            if (toolRouter.requiresDynamicSelection(intentResult)) {
                log.debug("Using dynamic tool selection for query: '{}'", truncate(userQuery, 50));

                // 3. 检索候选工具
                List<ToolRouterService.ToolCandidate> candidates =
                        toolRouter.retrieveCandidateTools(userQuery, 10);

                if (!candidates.isEmpty()) {
                    // 4. LLM精选工具
                    ToolRouterService.SelectedTools selectedTools =
                            toolRouter.selectTools(userQuery, intentResult, candidates);

                    // 5. 执行工具链
                    Map<String, Object> context = new HashMap<>();
                    context.put("factoryId", factoryId);
                    context.put("userQuery", userQuery);

                    return toolRouter.executeToolChain(selectedTools, context);
                }
            }

            // 如果不需要动态选择或没有候选工具，返回意图结果
            return intentResult;

        } catch (Exception e) {
            log.error("ToolRouter fallback failed", e);
            return createErrorResult("Processing failed: " + e.getMessage());
        }
    }

    /**
     * 创建错误结果
     */
    private Object createErrorResult(String message) {
        return SkillResult.builder()
                .success(false)
                .skillName("error")
                .message(message)
                .executionTime(0)
                .build();
    }

    /**
     * 截断字符串
     */
    private String truncate(String str, int maxLength) {
        if (str == null) {
            return "";
        }
        return str.length() > maxLength ? str.substring(0, maxLength) + "..." : str;
    }
}
