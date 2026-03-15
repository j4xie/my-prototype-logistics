package com.cretas.aims.service.governance;

import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.entity.smartbi.SmartBiSkill;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.repository.smartbi.SmartBiSkillRepository;
import com.cretas.aims.service.skill.SkillRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Tool 自动组合服务
 *
 * 基于 tool_call_records 中的 session 共现数据，
 * 自动发现高频共用的 Tool 组合并推荐组合为 Skill。
 *
 * 三层自动化：
 * 1. Mining — 从历史调用记录中挖掘 Tool 共现模式
 * 2. Recommendation — 对高频共现模式进行评分和推荐
 * 3. Composition — 将推荐转化为 SmartBiSkill 写入 DB
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ToolAutoComposerService {

    private final ToolCallRecordRepository toolCallRecordRepository;
    private final SmartBiSkillRepository skillRepository;
    private final SkillRegistry skillRegistry;
    private final ObjectMapper objectMapper;

    // --- DTOs ---

    @Data
    @AllArgsConstructor
    public static class CoOccurrence {
        private String toolA;
        private String toolB;
        private int sessionCount;     // 共现 session 数
        private double supportRate;   // sessionCount / totalSessions
        private double avgSuccessRate;
    }

    @Data
    @AllArgsConstructor
    public static class ToolSequence {
        private List<String> tools;   // 有序 tool 列表
        private int occurrences;
        private double avgSuccessRate;
        private double avgTotalTimeMs;
    }

    @Data
    @AllArgsConstructor
    public static class SkillRecommendation {
        private String suggestedName;
        private String suggestedDisplayName;
        private List<String> tools;
        private List<String> suggestedTriggers;
        private int evidenceCount;      // 基于多少次共现
        private double confidenceScore; // 0-1
        private String reason;
        private boolean alreadyCoveredBySkill;
    }

    // --- Core Mining ---

    /**
     * 挖掘 Tool 共现模式
     *
     * @param factoryId 工厂ID (null = 全平台)
     * @param days      回溯天数
     * @param minCoOccurrence 最小共现次数阈值
     * @return 按共现频次降序排列的共现对
     */
    public List<CoOccurrence> mineCoOccurrences(String factoryId, int days, int minCoOccurrence) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        LocalDateTime until = LocalDateTime.now();

        // 获取所有成功的调用记录
        List<ToolCallRecord> records;
        if (factoryId != null) {
            records = toolCallRecordRepository.findByFactoryIdAndCreatedAtBetween(factoryId, since, until);
        } else {
            records = toolCallRecordRepository.findByCreatedAtBetween(since, until);
        }

        // 按 sessionId 分组
        Map<String, List<ToolCallRecord>> sessionGroups = records.stream()
                .filter(r -> r.getSessionId() != null)
                .filter(r -> r.getExecutionStatus() == ToolCallRecord.ExecutionStatus.SUCCESS)
                .collect(Collectors.groupingBy(ToolCallRecord::getSessionId));

        int totalSessions = sessionGroups.size();
        if (totalSessions == 0) {
            return Collections.emptyList();
        }

        // 统计 tool 对共现频次
        Map<String, Integer> pairCounts = new HashMap<>();
        Map<String, List<Boolean>> pairSuccessRates = new HashMap<>();

        for (List<ToolCallRecord> sessionRecords : sessionGroups.values()) {
            // 去重：同一 session 中同一 tool 可能被调用多次
            List<String> distinctTools = sessionRecords.stream()
                    .map(ToolCallRecord::getToolName)
                    .distinct()
                    .sorted()
                    .collect(Collectors.toList());

            // 生成所有无序 pair (A < B)
            for (int i = 0; i < distinctTools.size(); i++) {
                for (int j = i + 1; j < distinctTools.size(); j++) {
                    String pairKey = distinctTools.get(i) + "|" + distinctTools.get(j);
                    pairCounts.merge(pairKey, 1, Integer::sum);
                }
            }
        }

        // 过滤和排序
        return pairCounts.entrySet().stream()
                .filter(e -> e.getValue() >= minCoOccurrence)
                .map(e -> {
                    String[] tools = e.getKey().split("\\|");
                    return new CoOccurrence(
                            tools[0], tools[1],
                            e.getValue(),
                            (double) e.getValue() / totalSessions,
                            1.0 // 只统计了 SUCCESS 记录，所以成功率 = 1.0
                    );
                })
                .sorted(Comparator.comparingInt(CoOccurrence::getSessionCount).reversed())
                .collect(Collectors.toList());
    }

    /**
     * 挖掘有序 Tool 序列模式
     *
     * 查找在 session 中按顺序调用的 tool 序列 (2-tool 和 3-tool 序列)
     */
    public List<ToolSequence> mineSequences(String factoryId, int days, int minOccurrence) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        LocalDateTime until = LocalDateTime.now();

        List<ToolCallRecord> records;
        if (factoryId != null) {
            records = toolCallRecordRepository.findByFactoryIdAndCreatedAtBetween(factoryId, since, until);
        } else {
            records = toolCallRecordRepository.findByCreatedAtBetween(since, until);
        }

        Map<String, List<ToolCallRecord>> sessionGroups = records.stream()
                .filter(r -> r.getSessionId() != null)
                .filter(r -> r.getExecutionStatus() == ToolCallRecord.ExecutionStatus.SUCCESS)
                .collect(Collectors.groupingBy(ToolCallRecord::getSessionId));

        // 统计 2-tool 有序序列
        Map<String, Integer> seqCounts = new HashMap<>();
        Map<String, List<Integer>> seqTimes = new HashMap<>();

        for (List<ToolCallRecord> sessionRecords : sessionGroups.values()) {
            // 按时间排序
            List<ToolCallRecord> ordered = sessionRecords.stream()
                    .sorted(Comparator.comparing(ToolCallRecord::getCreatedAt))
                    .collect(Collectors.toList());

            // 提取相邻 tool 对
            for (int i = 0; i < ordered.size() - 1; i++) {
                ToolCallRecord a = ordered.get(i);
                ToolCallRecord b = ordered.get(i + 1);

                // 只统计 5 分钟内的连续调用
                if (java.time.Duration.between(a.getCreatedAt(), b.getCreatedAt()).toMinutes() > 5) {
                    continue;
                }

                String seqKey = a.getToolName() + " → " + b.getToolName();
                seqCounts.merge(seqKey, 1, Integer::sum);

                int totalTime = (a.getExecutionTimeMs() != null ? a.getExecutionTimeMs() : 0)
                        + (b.getExecutionTimeMs() != null ? b.getExecutionTimeMs() : 0);
                seqTimes.computeIfAbsent(seqKey, k -> new ArrayList<>()).add(totalTime);
            }

            // 提取 3-tool 序列
            for (int i = 0; i < ordered.size() - 2; i++) {
                ToolCallRecord a = ordered.get(i);
                ToolCallRecord b = ordered.get(i + 1);
                ToolCallRecord c = ordered.get(i + 2);
                if (java.time.Duration.between(a.getCreatedAt(), c.getCreatedAt()).toMinutes() > 10) {
                    continue;
                }
                String seqKey = a.getToolName() + " → " + b.getToolName() + " → " + c.getToolName();
                seqCounts.merge(seqKey, 1, Integer::sum);

                int totalTime = (a.getExecutionTimeMs() != null ? a.getExecutionTimeMs() : 0)
                        + (b.getExecutionTimeMs() != null ? b.getExecutionTimeMs() : 0)
                        + (c.getExecutionTimeMs() != null ? c.getExecutionTimeMs() : 0);
                seqTimes.computeIfAbsent(seqKey, k -> new ArrayList<>()).add(totalTime);
            }
        }

        return seqCounts.entrySet().stream()
                .filter(e -> e.getValue() >= minOccurrence)
                .map(e -> {
                    List<String> tools = Arrays.asList(e.getKey().split(" → "));
                    List<Integer> times = seqTimes.getOrDefault(e.getKey(), Collections.emptyList());
                    double avgTime = times.stream().mapToInt(Integer::intValue).average().orElse(0);
                    return new ToolSequence(tools, e.getValue(), 1.0, avgTime);
                })
                .sorted(Comparator.comparingInt(ToolSequence::getOccurrences).reversed())
                .collect(Collectors.toList());
    }

    // --- Recommendation ---

    /**
     * 生成 Skill 组合推荐
     *
     * 基于共现模式，推荐可以组合为 Skill 的 tool 组合。
     * 排除已被现有 Skill 覆盖的组合。
     */
    public List<SkillRecommendation> generateRecommendations(String factoryId, int days) {
        List<CoOccurrence> coOccurrences = mineCoOccurrences(factoryId, days, 3);
        List<ToolSequence> sequences = mineSequences(factoryId, days, 3);

        // 获取现有 skill 的 tool 覆盖
        Set<Set<String>> existingSkillToolSets = getExistingSkillToolSets();

        List<SkillRecommendation> recommendations = new ArrayList<>();

        // 从共现对生成推荐
        for (CoOccurrence co : coOccurrences) {
            List<String> tools = Arrays.asList(co.getToolA(), co.getToolB());
            Set<String> toolSet = new HashSet<>(tools);

            boolean covered = existingSkillToolSets.stream()
                    .anyMatch(existing -> existing.containsAll(toolSet));

            String suggestedName = deriveSkillName(tools);

            recommendations.add(new SkillRecommendation(
                    suggestedName,
                    deriveDisplayName(tools),
                    tools,
                    deriveTriggers(tools),
                    co.getSessionCount(),
                    Math.min(1.0, co.getSessionCount() / 20.0), // 20次共现 = 满分
                    String.format("在 %d 个会话中共同使用，支持率 %.1f%%",
                            co.getSessionCount(), co.getSupportRate() * 100),
                    covered
            ));
        }

        // 从序列模式生成推荐（得分加权更高，因为有明确顺序）
        for (ToolSequence seq : sequences) {
            if (seq.getTools().size() >= 3) {
                Set<String> toolSet = new HashSet<>(seq.getTools());
                boolean covered = existingSkillToolSets.stream()
                        .anyMatch(existing -> existing.containsAll(toolSet));

                String suggestedName = deriveSkillName(seq.getTools());

                recommendations.add(new SkillRecommendation(
                        suggestedName,
                        deriveDisplayName(seq.getTools()),
                        seq.getTools(),
                        deriveTriggers(seq.getTools()),
                        seq.getOccurrences(),
                        Math.min(1.0, seq.getOccurrences() / 15.0), // 3-tool 序列门槛更低
                        String.format("有序序列出现 %d 次，平均耗时 %.0fms",
                                seq.getOccurrences(), seq.getAvgTotalTimeMs()),
                        covered
                ));
            }
        }

        // 按置信度降序，已覆盖的排后面
        return recommendations.stream()
                .sorted(Comparator
                        .comparing(SkillRecommendation::isAlreadyCoveredBySkill)
                        .thenComparing(Comparator.comparingDouble(SkillRecommendation::getConfidenceScore).reversed()))
                .collect(Collectors.toList());
    }

    // --- Composition ---

    /**
     * 将推荐的 tool 组合创建为 Skill 并写入 DB
     *
     * @param name        skill 名称
     * @param displayName 显示名称
     * @param tools       工具列表（有序）
     * @param triggers    触发关键词
     * @param description 描述
     * @param category    分类
     * @return 创建的 SmartBiSkill
     */
    @Transactional
    public SmartBiSkill composeSkill(String name, String displayName, List<String> tools,
                                      List<String> triggers, String description, String category) {
        // 检查是否已存在
        if (skillRepository.existsByName(name)) {
            throw new IllegalArgumentException("Skill '" + name + "' 已存在");
        }

        try {
            SmartBiSkill skill = SmartBiSkill.builder()
                    .name(name)
                    .displayName(displayName)
                    .description(description != null ? description : "自动组合: " + String.join(" + ", tools))
                    .version("1.0.0")
                    .triggers(objectMapper.writeValueAsString(triggers))
                    .tools(objectMapper.writeValueAsString(tools))
                    .contextNeeded(objectMapper.writeValueAsString(Arrays.asList("factoryId")))
                    .config(objectMapper.writeValueAsString(Map.of(
                            "maxTokens", 800,
                            "temperature", 0.7,
                            "responseFormat", "markdown",
                            "autoComposed", true,
                            "composedAt", LocalDateTime.now().toString()
                    )))
                    .enabled(true)
                    .priority(200) // 自动组合的 skill 优先级低于手动创建的
                    .category(category != null ? category : "auto-composed")
                    .build();

            SmartBiSkill saved = skillRepository.save(skill);
            log.info("✅ 自动组合 Skill 创建成功: name={}, tools={}", name, tools);

            // 刷新 SkillRegistry 使其立即生效
            skillRegistry.refresh();

            return saved;
        } catch (DataIntegrityViolationException e) {
            throw new IllegalArgumentException("Skill '" + name + "' 已存在（并发创建冲突）");
        } catch (Exception e) {
            throw new RuntimeException("创建 Skill 失败: " + e.getMessage(), e);
        }
    }

    /**
     * 列出所有已注册的 Skill（DB + 代码默认 + 文件）
     */
    public List<Map<String, Object>> listAllSkills() {
        return skillRegistry.getAllSkills().stream()
                .map(def -> {
                    Map<String, Object> info = new HashMap<>();
                    info.put("name", def.getName());
                    info.put("displayName", def.getDisplayName());
                    info.put("description", def.getDescription());
                    info.put("tools", def.getTools());
                    info.put("triggers", def.getTriggers());
                    info.put("source", def.getSource());
                    info.put("version", def.getVersion());
                    info.put("enabled", def.isEnabled());
                    return info;
                })
                .collect(Collectors.toList());
    }

    // --- Scheduled Auto-Discovery ---

    /**
     * 每日凌晨自动挖掘共现模式并记录推荐
     * 仅记录日志，不自动创建 Skill（需人工确认）
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void dailyAutoDiscovery() {
        log.info("🔍 开始每日 Tool 共现模式挖掘...");
        try {
            List<SkillRecommendation> recommendations = generateRecommendations(null, 30);

            List<SkillRecommendation> actionable = recommendations.stream()
                    .filter(r -> !r.isAlreadyCoveredBySkill())
                    .filter(r -> r.getConfidenceScore() >= 0.5)
                    .collect(Collectors.toList());

            if (actionable.isEmpty()) {
                log.info("📋 无新的 Skill 组合推荐");
            } else {
                log.info("📋 发现 {} 个候选 Skill 组合推荐:", actionable.size());
                for (SkillRecommendation r : actionable) {
                    log.info("  → {} (tools: {}, confidence: {}, reason: {})",
                            r.getSuggestedName(), r.getTools(),
                            String.format("%.2f", r.getConfidenceScore()), r.getReason());
                }
            }
        } catch (Exception e) {
            log.error("Tool 共现挖掘失败", e);
        }
    }

    // --- Helper Methods ---

    private Set<Set<String>> getExistingSkillToolSets() {
        Set<Set<String>> result = new HashSet<>();
        for (var def : skillRegistry.getAllSkills()) {
            if (def.getTools() != null) {
                result.add(new HashSet<>(def.getTools()));
            }
        }
        return result;
    }

    private String deriveSkillName(List<String> tools) {
        // 提取 domain prefix: material_batch_query → material
        Set<String> domains = tools.stream()
                .map(t -> t.contains("_") ? t.substring(0, t.indexOf("_")) : t)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (domains.size() == 1) {
            return domains.iterator().next() + "-auto-combo";
        }
        return String.join("-", domains) + "-combo";
    }

    private String deriveDisplayName(List<String> tools) {
        Set<String> domains = tools.stream()
                .map(t -> t.contains("_") ? t.substring(0, t.indexOf("_")) : t)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return String.join("+", domains) + " 组合查询";
    }

    private List<String> deriveTriggers(List<String> tools) {
        // 从 tool 名称生成基本触发词
        Set<String> keywords = new LinkedHashSet<>();
        for (String tool : tools) {
            String[] parts = tool.split("_");
            for (String part : parts) {
                if (!part.equals("query") && !part.equals("list") && !part.equals("get")
                        && !part.equals("create") && !part.equals("update") && part.length() > 2) {
                    keywords.add(part);
                }
            }
        }
        List<String> triggers = new ArrayList<>(keywords);
        // 添加组合触发词
        if (triggers.size() >= 2) {
            triggers.add(triggers.get(0) + "和" + triggers.get(1));
        }
        return triggers;
    }
}
