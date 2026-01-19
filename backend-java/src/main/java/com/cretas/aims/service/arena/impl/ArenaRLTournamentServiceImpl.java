package com.cretas.aims.service.arena.impl;

import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationParam;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.common.Role;
import com.cretas.aims.config.ArenaRLConfig;
import com.cretas.aims.dto.arena.ComparisonRubric;
import com.cretas.aims.dto.arena.MatchResult;
import com.cretas.aims.dto.arena.TournamentResult;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.service.arena.ArenaRLTournamentService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * ArenaRL 锦标赛服务实现
 *
 * 实现基于 ArenaRL 论文的种子单淘汰制锦标赛：
 * 1. 种子阶段: 根据初始分数确定种子排名
 * 2. 淘汰阶段: 高种子 vs 低种子，胜者晋级
 * 3. 决赛: 最终两个候选比较，决出冠军
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ArenaRLTournamentServiceImpl implements ArenaRLTournamentService {

    private final ArenaRLConfig config;
    private final Generation generation;
    private final ObjectMapper objectMapper;

    // 用于缓存比较结果的简单内存缓存
    private final Map<String, MatchResult> comparisonCache = new LinkedHashMap<String, MatchResult>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, MatchResult> eldest) {
            return size() > 100; // 保留最近100个比较结果
        }
    };

    @Override
    public TournamentResult runIntentTournament(String userInput,
                                                List<IntentMatchResult.CandidateIntent> candidates) {
        String tournamentId = UUID.randomUUID().toString();
        Instant startTime = Instant.now();

        log.info("[ArenaRL] Starting intent tournament, id={}, candidates={}",
                tournamentId, candidates.size());

        try {
            // 1. 转换为通用候选格式
            List<TournamentCandidate> genericCandidates = candidates.stream()
                    .map(this::toTournamentCandidate)
                    .collect(Collectors.toList());

            // 2. 限制候选数量
            int maxCandidates = config.getIntentMaxCandidates();
            if (genericCandidates.size() > maxCandidates) {
                genericCandidates = genericCandidates.subList(0, maxCandidates);
            }

            // 3. 执行锦标赛
            ComparisonRubric rubric = ComparisonRubric.intentDisambiguationRubric();
            return runTournament(tournamentId, TournamentResult.TournamentType.INTENT_DISAMBIGUATION,
                    userInput, genericCandidates, rubric, startTime);

        } catch (Exception e) {
            log.error("[ArenaRL] Intent tournament failed, id={}", tournamentId, e);
            return TournamentResult.failure(tournamentId,
                    TournamentResult.TournamentType.INTENT_DISAMBIGUATION,
                    userInput, e.getMessage());
        }
    }

    @Override
    @Async
    public CompletableFuture<TournamentResult> runIntentTournamentAsync(String userInput,
                                                                         List<IntentMatchResult.CandidateIntent> candidates) {
        return CompletableFuture.supplyAsync(() -> runIntentTournament(userInput, candidates));
    }

    @Override
    public TournamentResult runToolTournament(String userQuery,
                                              List<ToolCandidate> toolCandidates) {
        String tournamentId = UUID.randomUUID().toString();
        Instant startTime = Instant.now();

        log.info("[ArenaRL] Starting tool tournament, id={}, candidates={}",
                tournamentId, toolCandidates.size());

        try {
            // 1. 限制候选数量
            int maxCandidates = config.getToolMaxCandidates();
            List<TournamentCandidate> genericCandidates = new ArrayList<>(toolCandidates);
            if (genericCandidates.size() > maxCandidates) {
                genericCandidates = genericCandidates.subList(0, maxCandidates);
            }

            // 2. 执行锦标赛
            ComparisonRubric rubric = ComparisonRubric.toolSelectionRubric();
            return runTournament(tournamentId, TournamentResult.TournamentType.TOOL_SELECTION,
                    userQuery, genericCandidates, rubric, startTime);

        } catch (Exception e) {
            log.error("[ArenaRL] Tool tournament failed, id={}", tournamentId, e);
            return TournamentResult.failure(tournamentId,
                    TournamentResult.TournamentType.TOOL_SELECTION,
                    userQuery, e.getMessage());
        }
    }

    @Override
    @Async
    public CompletableFuture<TournamentResult> runToolTournamentAsync(String userQuery,
                                                                       List<ToolCandidate> toolCandidates) {
        return CompletableFuture.supplyAsync(() -> runToolTournament(userQuery, toolCandidates));
    }

    @Override
    public TournamentResult runAnalysisTournament(String userQuestion,
                                                  List<AnalysisCandidate> analysisResults) {
        String tournamentId = UUID.randomUUID().toString();
        Instant startTime = Instant.now();

        log.info("[ArenaRL] Starting analysis tournament, id={}, candidates={}",
                tournamentId, analysisResults.size());

        try {
            List<TournamentCandidate> genericCandidates = new ArrayList<>(analysisResults);
            int maxCandidates = config.getAgentAnalysis().getMaxCandidates();
            if (genericCandidates.size() > maxCandidates) {
                genericCandidates = genericCandidates.subList(0, maxCandidates);
            }

            ComparisonRubric rubric = ComparisonRubric.agentAnalysisRubric();
            return runTournament(tournamentId, TournamentResult.TournamentType.AGENT_ANALYSIS,
                    userQuestion, genericCandidates, rubric, startTime);

        } catch (Exception e) {
            log.error("[ArenaRL] Analysis tournament failed, id={}", tournamentId, e);
            return TournamentResult.failure(tournamentId,
                    TournamentResult.TournamentType.AGENT_ANALYSIS,
                    userQuestion, e.getMessage());
        }
    }

    @Override
    public MatchResult compareTwo(String userInput,
                                  TournamentCandidate candidateA,
                                  TournamentCandidate candidateB,
                                  ComparisonRubric rubric) {
        String matchId = UUID.randomUUID().toString();
        Instant startTime = Instant.now();

        log.debug("[ArenaRL] Comparing {} vs {}", candidateA.getId(), candidateB.getId());

        try {
            // 检查缓存
            String cacheKey = buildCacheKey(userInput, candidateA.getId(), candidateB.getId());
            if (config.getPerformanceConfig().isCacheEnabled()) {
                MatchResult cached = comparisonCache.get(cacheKey);
                if (cached != null) {
                    log.debug("[ArenaRL] Cache hit for comparison {}", cacheKey);
                    return cached.toBuilder().matchId(matchId).build();
                }
            }

            // 构建比较 Prompt
            String prompt = buildComparisonPrompt(userInput, candidateA, candidateB, rubric);

            // 调用 LLM
            MatchResult result = callLlmForComparison(matchId, prompt, candidateA, candidateB, startTime);

            // 双向比较 (减少位置偏见)
            if (config.getLlmConfig().isBidirectionalComparison()) {
                String reversePrompt = buildComparisonPrompt(userInput, candidateB, candidateA, rubric);
                MatchResult reverseResult = callLlmForComparison(
                        matchId + "-reverse", reversePrompt, candidateB, candidateA, startTime);

                // 综合两次比较结果
                result = mergeResults(result, reverseResult, candidateA, candidateB);
            }

            // 缓存结果
            if (config.getPerformanceConfig().isCacheEnabled()) {
                comparisonCache.put(cacheKey, result);
            }

            return result;

        } catch (Exception e) {
            log.error("[ArenaRL] Comparison failed, {} vs {}", candidateA.getId(), candidateB.getId(), e);
            return MatchResult.failure(matchId, 0, 0,
                    candidateA.getId(), candidateB.getId(), e.getMessage());
        }
    }

    @Override
    @Async
    public CompletableFuture<MatchResult> compareTwoAsync(String userInput,
                                                          TournamentCandidate candidateA,
                                                          TournamentCandidate candidateB,
                                                          ComparisonRubric rubric) {
        return CompletableFuture.supplyAsync(() -> compareTwo(userInput, candidateA, candidateB, rubric));
    }

    @Override
    public boolean shouldTriggerIntentTournament(List<IntentMatchResult.CandidateIntent> topCandidates) {
        if (!config.isIntentDisambiguationEnabled()) {
            return false;
        }
        if (topCandidates == null || topCandidates.size() < 2) {
            return false;
        }

        double top1 = topCandidates.get(0).getConfidence();
        double top2 = topCandidates.get(1).getConfidence();

        return config.shouldTriggerIntentTournament(top1, top2);
    }

    @Override
    public boolean shouldTriggerToolTournament(List<ToolCandidate> toolCandidates) {
        if (!config.isToolSelectionEnabled()) {
            return false;
        }
        if (toolCandidates == null || toolCandidates.size() < 2) {
            return false;
        }

        double top1 = toolCandidates.get(0).getScore();
        double top2 = toolCandidates.get(1).getScore();

        return config.shouldTriggerToolTournament(top1, top2);
    }

    // ==================== 私有方法 ====================

    /**
     * 执行锦标赛核心逻辑
     */
    private TournamentResult runTournament(String tournamentId,
                                           TournamentResult.TournamentType type,
                                           String userInput,
                                           List<TournamentCandidate> candidates,
                                           ComparisonRubric rubric,
                                           Instant startTime) {
        List<MatchResult> allMatches = new ArrayList<>();
        List<TournamentResult.SeedRanking> seedRankings = new ArrayList<>();
        int llmCalls = 0;

        // 1. 建立种子排名
        for (int i = 0; i < candidates.size(); i++) {
            TournamentCandidate c = candidates.get(i);
            seedRankings.add(TournamentResult.SeedRanking.builder()
                    .candidateId(c.getId())
                    .candidateName(c.getName())
                    .originalScore(c.getScore())
                    .seedRank(i + 1)
                    .build());
        }

        // 2. 种子单淘汰赛
        List<TournamentCandidate> remaining = new ArrayList<>(candidates);
        int round = 1;

        while (remaining.size() > 1) {
            List<TournamentCandidate> nextRound = new ArrayList<>();
            int matchIndex = 0;

            // 配对: 高种子 vs 低种子
            while (remaining.size() >= 2) {
                TournamentCandidate high = remaining.remove(0);       // 最高种子
                TournamentCandidate low = remaining.remove(remaining.size() - 1);  // 最低种子

                // 执行比较
                MatchResult match = compareTwo(userInput, high, low, rubric);
                match = match.toBuilder()
                        .round(round)
                        .matchIndex(matchIndex++)
                        .build();
                allMatches.add(match);
                llmCalls += config.getLlmConfig().isBidirectionalComparison() ? 2 : 1;

                // 胜者晋级
                if (match.isAWinner()) {
                    nextRound.add(high);
                } else if (match.isBWinner()) {
                    nextRound.add(low);
                } else {
                    // 平局时，保留种子较高的
                    nextRound.add(high);
                }

                // 检查超时
                if (System.currentTimeMillis() - startTime.toEpochMilli() >
                        config.getPerformanceConfig().getTotalTimeoutMs()) {
                    log.warn("[ArenaRL] Tournament timeout, returning best available");
                    break;
                }

                // 检查 LLM 调用次数
                if (llmCalls >= config.getPerformanceConfig().getMaxLlmCalls()) {
                    log.warn("[ArenaRL] Max LLM calls reached, returning best available");
                    break;
                }
            }

            // 奇数候选，直接晋级
            if (!remaining.isEmpty()) {
                nextRound.addAll(remaining);
            }

            remaining = nextRound;
            round++;
        }

        // 3. 构建结果
        Instant endTime = Instant.now();
        TournamentCandidate winner = remaining.isEmpty() ? candidates.get(0) : remaining.get(0);

        // 计算获胜置信度 (基于比赛胜率)
        long winCount = allMatches.stream()
                .filter(m -> winner.getId().equals(m.getWinnerId()))
                .count();
        double winnerConfidence = allMatches.isEmpty() ? winner.getScore() :
                Math.min(0.95, winner.getScore() + 0.1 * (winCount / (double) allMatches.size()));

        return TournamentResult.builder()
                .tournamentId(tournamentId)
                .type(type)
                .winnerId(winner.getId())
                .winnerName(winner.getName())
                .winnerConfidence(winnerConfidence)
                .matches(allMatches)
                .seedRankings(seedRankings)
                .totalComparisons(allMatches.size())
                .llmCalls(llmCalls)
                .totalLatencyMs(endTime.toEpochMilli() - startTime.toEpochMilli())
                .estimatedTokens(llmCalls * 1500) // 估算每次调用约1500 token
                .userInput(userInput)
                .startTime(startTime)
                .endTime(endTime)
                .success(true)
                .build();
    }

    /**
     * 构建比较 Prompt (v7.1 优化版 - 增强语义理解)
     */
    private String buildComparisonPrompt(String userInput,
                                         TournamentCandidate candidateA,
                                         TournamentCandidate candidateB,
                                         ComparisonRubric rubric) {
        StringBuilder sb = new StringBuilder();

        sb.append("用户输入: \"").append(userInput).append("\"\n\n");
        sb.append("A: ").append(candidateA.getName()).append(" [").append(candidateA.getId()).append("] - ").append(candidateA.getDescription()).append("\n");
        sb.append("B: ").append(candidateB.getName()).append(" [").append(candidateB.getId()).append("] - ").append(candidateB.getDescription()).append("\n\n");

        // v7.1: 添加语义理解提示
        sb.append("【重要判断规则】\n");
        sb.append("1. 时态线索: \"正在\"、\"今天的\"、\"最近的\"、\"当前\" 表示查询状态/列表，不是执行动作\n");
        sb.append("2. 动作词: \"开始\"、\"启动\"、\"创建\" 是执行动作; \"查看\"、\"显示\"、\"列出\" 是查询\n");
        sb.append("3. 打卡: \"上班打卡\"→签到(CLOCK_IN), \"下班打卡\"→签退(CLOCK_OUT), 注意区分\n");
        sb.append("4. 记录 vs 执行: \"xxx记录\" 通常是查询历史，不是执行操作\n");
        sb.append("5. \"暂停生产\" 是暂停批次(PAUSE)，不是手动排产(MANUAL)\n\n");

        sb.append("哪个更匹配用户意图? 考虑: ");

        // 只列出维度名称，不展开
        sb.append(rubric.getDimensions().stream()
                .map(d -> d.getName())
                .collect(Collectors.joining("、")));
        sb.append("\n\n");
        sb.append("JSON格式输出: {\"winner\":\"A或B\",\"win_confidence\":0.5-1.0,\"reasoning\":\"理由\"}");

        return sb.toString();
    }

    /**
     * 调用 LLM 进行比较 (带超时控制)
     */
    private MatchResult callLlmForComparison(String matchId,
                                             String prompt,
                                             TournamentCandidate candidateA,
                                             TournamentCandidate candidateB,
                                             Instant startTime) {
        Instant matchStart = Instant.now();
        int timeoutMs = config.getLlmConfig().getComparisonTimeoutMs();

        try {
            // 使用 CompletableFuture 实现超时控制
            CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
                try {
                    Message systemMsg = Message.builder()
                            .role(Role.SYSTEM.getValue())
                            .content("你是一个专业的比较评估专家。请严格按 JSON 格式输出: {\"winner\":\"A/B\",\"win_confidence\":0.5-1.0,\"reasoning\":\"理由\"}")
                            .build();

                    Message userMsg = Message.builder()
                            .role(Role.USER.getValue())
                            .content(prompt)
                            .build();

                    // 使用配置的模型 (默认 qwen-turbo 更快)
                    GenerationParam param = GenerationParam.builder()
                            .model(config.getLlmConfig().getModel())
                            .messages(Arrays.asList(systemMsg, userMsg))
                            .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                            .temperature((float) config.getLlmConfig().getTemperature())
                            .maxTokens(config.getLlmConfig().getMaxResponseTokens())
                            .build();

                    GenerationResult result = generation.call(param);
                    return result.getOutput().getChoices().get(0).getMessage().getContent();
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            });

            // 等待结果，带超时
            String responseText = future.get(timeoutMs, TimeUnit.MILLISECONDS);

            // 解析 JSON 响应
            return parseComparisonResponse(matchId, responseText, candidateA, candidateB, matchStart);

        } catch (java.util.concurrent.TimeoutException e) {
            log.warn("[ArenaRL] LLM call timeout ({}ms), defaulting to higher-seeded", timeoutMs);
            // 超时时返回高种子候选作为默认胜者
            return MatchResult.builder()
                    .matchId(matchId)
                    .candidateAId(candidateA.getId())
                    .candidateAName(candidateA.getName())
                    .candidateBId(candidateB.getId())
                    .candidateBName(candidateB.getName())
                    .winnerId(candidateA.getId())
                    .winConfidence(0.55)
                    .reasoning("LLM timeout, defaulting to higher-seeded candidate")
                    .isForwardComparison(true)
                    .latencyMs(Long.valueOf(timeoutMs))
                    .startTime(matchStart)
                    .endTime(Instant.now())
                    .success(true)
                    .build();
        } catch (Exception e) {
            log.error("[ArenaRL] LLM call failed for comparison", e);
            return MatchResult.failure(matchId, 0, 0,
                    candidateA.getId(), candidateB.getId(), e.getMessage());
        }
    }

    /**
     * 解析 LLM 比较响应
     */
    private MatchResult parseComparisonResponse(String matchId,
                                                String responseText,
                                                TournamentCandidate candidateA,
                                                TournamentCandidate candidateB,
                                                Instant matchStart) {
        Instant matchEnd = Instant.now();

        try {
            // 提取 JSON 部分
            String json = extractJson(responseText);
            JsonNode root = objectMapper.readTree(json);

            String winner = root.has("winner") ? root.get("winner").asText() : "A";
            double winConfidence = root.has("win_confidence") ? root.get("win_confidence").asDouble() : 0.6;
            String reasoning = root.has("reasoning") ? root.get("reasoning").asText() : "";

            // 解析维度分数
            Map<String, Double> dimensionScores = new HashMap<>();
            if (root.has("dimension_scores")) {
                JsonNode scores = root.get("dimension_scores");
                scores.fieldNames().forEachRemaining(field ->
                        dimensionScores.put(field, scores.get(field).asDouble()));
            }

            String winnerId = "A".equalsIgnoreCase(winner) ? candidateA.getId() : candidateB.getId();

            return MatchResult.builder()
                    .matchId(matchId)
                    .round(0)
                    .matchIndex(0)
                    .candidateAId(candidateA.getId())
                    .candidateAName(candidateA.getName())
                    .candidateBId(candidateB.getId())
                    .candidateBName(candidateB.getName())
                    .winnerId(winnerId)
                    .winConfidence(winConfidence)
                    .dimensionScores(dimensionScores)
                    .reasoning(reasoning)
                    .isForwardComparison(true)
                    .latencyMs(matchEnd.toEpochMilli() - matchStart.toEpochMilli())
                    .startTime(matchStart)
                    .endTime(matchEnd)
                    .success(true)
                    .build();

        } catch (JsonProcessingException e) {
            log.warn("[ArenaRL] Failed to parse comparison response: {}", responseText);
            // 降级: 返回 A 作为默认获胜者
            return MatchResult.builder()
                    .matchId(matchId)
                    .candidateAId(candidateA.getId())
                    .candidateAName(candidateA.getName())
                    .candidateBId(candidateB.getId())
                    .candidateBName(candidateB.getName())
                    .winnerId(candidateA.getId())
                    .winConfidence(0.55)
                    .reasoning("Failed to parse LLM response, defaulting to higher-seeded candidate")
                    .isForwardComparison(true)
                    .latencyMs(matchEnd.toEpochMilli() - matchStart.toEpochMilli())
                    .startTime(matchStart)
                    .endTime(matchEnd)
                    .success(true)
                    .build();
        }
    }

    /**
     * 合并双向比较结果
     */
    private MatchResult mergeResults(MatchResult forward,
                                     MatchResult reverse,
                                     TournamentCandidate candidateA,
                                     TournamentCandidate candidateB) {
        // 检查两次比较是否一致
        boolean forwardAWins = candidateA.getId().equals(forward.getWinnerId());
        boolean reverseAWins = candidateA.getId().equals(reverse.getWinnerId());

        if (forwardAWins == reverseAWins) {
            // 两次结果一致，使用平均置信度
            double avgConfidence = (forward.getWinConfidence() + reverse.getWinConfidence()) / 2;
            return forward.toBuilder()
                    .winConfidence(avgConfidence)
                    .reasoning(forward.getReasoning() + " [Confirmed by bidirectional comparison]")
                    .build();
        } else {
            // 结果不一致，检查差异
            double discrepancy = Math.abs(forward.getWinConfidence() - reverse.getWinConfidence());
            if (discrepancy > config.getLlmConfig().getBidirectionalDiscrepancyThreshold()) {
                // 差异较大，选择置信度更高的结果
                if (forward.getWinConfidence() > reverse.getWinConfidence()) {
                    return forward.toBuilder()
                            .winConfidence(forward.getWinConfidence() * 0.9)
                            .reasoning(forward.getReasoning() + " [Warning: bidirectional discrepancy detected]")
                            .build();
                } else {
                    // 需要翻转结果
                    String reverseWinner = candidateA.getId().equals(reverse.getWinnerId()) ?
                            candidateA.getId() : candidateB.getId();
                    return forward.toBuilder()
                            .winnerId(reverseWinner)
                            .winConfidence(reverse.getWinConfidence() * 0.9)
                            .reasoning(reverse.getReasoning() + " [Warning: bidirectional discrepancy detected]")
                            .build();
                }
            } else {
                // 差异较小，视为平局，保留高种子
                return forward.toBuilder()
                        .winConfidence(0.5)
                        .reasoning("Bidirectional comparison resulted in tie, keeping higher-seeded candidate")
                        .build();
            }
        }
    }

    /**
     * 从响应中提取 JSON
     */
    private String extractJson(String text) {
        int start = text.indexOf("{");
        int end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return "{}";
    }

    /**
     * 构建缓存键
     */
    private String buildCacheKey(String userInput, String candidateAId, String candidateBId) {
        // 确保缓存键与顺序无关
        String ids = candidateAId.compareTo(candidateBId) < 0 ?
                candidateAId + ":" + candidateBId : candidateBId + ":" + candidateAId;
        return userInput.hashCode() + ":" + ids;
    }

    /**
     * 将 CandidateIntent 转换为 TournamentCandidate
     */
    private TournamentCandidate toTournamentCandidate(IntentMatchResult.CandidateIntent intent) {
        return new TournamentCandidate() {
            @Override
            public String getId() { return intent.getIntentCode(); }
            @Override
            public String getName() { return intent.getIntentName(); }
            @Override
            public String getDescription() { return intent.getDescription(); }
            @Override
            public Double getScore() { return intent.getConfidence(); }
            @Override
            public Map<String, Object> getMetadata() {
                Map<String, Object> meta = new HashMap<>();
                meta.put("category", intent.getIntentCategory());
                meta.put("matchMethod", intent.getMatchMethod());
                meta.put("matchedKeywords", intent.getMatchedKeywords());
                return meta;
            }
        };
    }
}
