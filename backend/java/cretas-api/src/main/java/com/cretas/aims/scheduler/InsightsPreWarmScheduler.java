package com.cretas.aims.scheduler;

import com.cretas.aims.client.AgentInsightsClient;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.enums.FactoryType;
import com.cretas.aims.repository.FactoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Pre-warm Dashboard /insights/custom canonical date ranges.
 *
 * <p><b>Background</b> — Phase B latency audit (B-latency.md #3) found
 * Dashboard /insights/custom is 24-44s cold per fresh range. The
 * NarrativeCacheService (24h TTL, SHA256 keyed by factory+question+range)
 * works (cache hits return in 9ms), but every NEW range click incurs the
 * full LLM wall. Customers click a date shortcut, wait 30 seconds, walk
 * away. Pre-warming canonical ranges turns the first click into a cache
 * hit (<100ms) instead.
 *
 * <p><b>Strategy</b> — Every 4 hours, walk active RESTAURANT-type
 * factories × canonical_ranges × canonical_questions. Call
 * AgentInsightsClient.fetchInsightsCustom(...) which (a) hits the cache
 * if fresh — cheap, no LLM call — or (b) fires the LLM and populates
 * the cache. After the cron, the user's first click on any canonical
 * range hits the cache.
 *
 * <p><b>Quota math</b> — 5 ranges × 1 question × N factories = 5N calls
 * per 4h run. With 5 active restaurant factories that's 25 LLM calls
 * per 4h = ~6.3/h. DashScope quota easily absorbs this. Cache hits cost
 * zero LLM tokens, so steady-state ramps down quickly once warm.
 *
 * <p><b>Throttling</b> — 3s sleep between calls so we don't burst-hit
 * DashScope rate limits. 25 calls × 3s = ~75s wall per cron run.
 *
 * <p><b>Failure isolation</b> — Each call is wrapped in try/catch.
 * Network blips, 404 (Agent layer disabled), DashScope quota errors,
 * etc. are logged at WARN and the loop continues. The cron NEVER
 * crashes Spring — pre-warm is best-effort.
 *
 * <p><b>ShedLock</b> — Blue/green Java instances both run @Scheduled.
 * @SchedulerLock makes only one instance fire (per ShedLockConfig).
 *
 * <p><b>Disable</b> — set {@code cretas.insights.prewarm.enabled=false}
 * to skip entirely (e.g. dev machines, or if DashScope quota tight).
 *
 * @since 2026-04-25
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InsightsPreWarmScheduler {

    private final FactoryRepository factoryRepository;
    private final AgentInsightsClient agentInsightsClient;

    /**
     * Disable flag — default ON. Set to false in application properties
     * or via env var CRETAS_INSIGHTS_PREWARM_ENABLED=false to disable.
     */
    @Value("${cretas.insights.prewarm.enabled:true}")
    private boolean enabled;

    /**
     * Sleep between calls (ms). Default 3000 = 3s. Lower if DashScope
     * quota is generous and we want faster warm-up.
     */
    @Value("${cretas.insights.prewarm.throttle-ms:3000}")
    private long throttleMs;

    /**
     * Canonical question — default "营业额怎么样" (the most common opener
     * in qhj prod logs per Apr 23 Week 5 audit). Cache key is
     * {factory_id, normalized_question, start_date, end_date}, so a
     * single canonical question per range × factory is the minimum
     * viable warm set.
     *
     * <p>If we expand to more questions later, watch DashScope quota
     * (each question multiplies calls × N).
     */
    private static final String CANONICAL_QUESTION = "营业额怎么样";

    /**
     * Canonical date ranges. Each is (label, supplier-of-(start, end)).
     * Suppliers compute relative to LocalDate.now() at cron firing time
     * so 本月/上月 stay meaningful as the calendar advances.
     */
    private record RangeSpec(String label, Supplier<LocalDate[]> supplier) {}

    private static List<RangeSpec> canonicalRanges() {
        return List.of(
                new RangeSpec("本月", () -> {
                    LocalDate today = LocalDate.now();
                    return new LocalDate[]{
                            today.with(TemporalAdjusters.firstDayOfMonth()),
                            today.with(TemporalAdjusters.lastDayOfMonth())
                    };
                }),
                new RangeSpec("上月", () -> {
                    LocalDate firstOfThis = LocalDate.now().with(TemporalAdjusters.firstDayOfMonth());
                    LocalDate lastOfPrev = firstOfThis.minusDays(1);
                    return new LocalDate[]{
                            lastOfPrev.with(TemporalAdjusters.firstDayOfMonth()),
                            lastOfPrev
                    };
                }),
                new RangeSpec("近30天", () -> {
                    LocalDate today = LocalDate.now();
                    return new LocalDate[]{today.minusDays(30), today};
                }),
                new RangeSpec("近90天", () -> {
                    LocalDate today = LocalDate.now();
                    return new LocalDate[]{today.minusDays(90), today};
                }),
                new RangeSpec("本年", () -> {
                    LocalDate today = LocalDate.now();
                    return new LocalDate[]{
                            today.with(TemporalAdjusters.firstDayOfYear()),
                            today.with(TemporalAdjusters.lastDayOfYear())
                    };
                })
        );
    }

    /**
     * Fire every 4 hours starting at top of hour 0/4/8/12/16/20.
     *
     * <p>Cron format: sec min hr day mon dow.
     */
    @Scheduled(cron = "0 0 0/4 * * ?")
    @SchedulerLock(name = "InsightsPreWarmScheduler.preWarmCanonicalRanges",
                   lockAtMostFor = "PT20M",
                   lockAtLeastFor = "PT1M")
    public void preWarmCanonicalRanges() {
        if (!enabled) {
            log.debug("InsightsPreWarmScheduler disabled by config; skipping");
            return;
        }

        long t0 = System.currentTimeMillis();
        log.info("========== 开始 Dashboard insights 预热任务 ==========");

        List<Factory> factories;
        try {
            // Restaurants are the primary consumer of /insights/custom
            // (Week 5 Agent layer is restaurant-analyst tuned). Including
            // FACTORY tenants would burn quota for negligible UX gain
            // since manufacturing dashboards rarely use the AI insight
            // panel. Adjust later if traffic patterns change.
            factories = factoryRepository.findByTypeAndIsActiveTrue(FactoryType.RESTAURANT);
        } catch (Exception e) {
            log.error("预热任务取工厂列表失败: {}", e.getMessage(), e);
            return;
        }

        if (factories.isEmpty()) {
            log.info("预热任务: 无 RESTAURANT-type 活动工厂, 跳过");
            return;
        }

        List<RangeSpec> ranges = canonicalRanges();
        int totalCalls = factories.size() * ranges.size();
        int hits = 0;
        int misses = 0;
        int errors = 0;

        log.info("预热任务: {} 个工厂 × {} 个区间 = {} 次调用 (节流 {}ms)",
                factories.size(), ranges.size(), totalCalls, throttleMs);

        outer:
        for (Factory factory : factories) {
            String factoryId = factory.getId();
            for (RangeSpec range : ranges) {
                LocalDate[] window = range.supplier().get();
                LocalDate start = window[0];
                LocalDate end = window[1];

                try {
                    long callT0 = System.currentTimeMillis();
                    Map<String, Object> resp = agentInsightsClient.fetchInsightsCustom(
                            factoryId, start, end, CANONICAL_QUESTION);
                    long callElapsed = System.currentTimeMillis() - callT0;
                    String source = resp.get("source") instanceof String
                            ? (String) resp.get("source") : "unknown";

                    if ("cache".equals(source)) {
                        hits++;
                        log.debug("预热 hit: factory={} range={}({}..{}) {}ms",
                                factoryId, range.label(), start, end, callElapsed);
                    } else {
                        misses++;
                        log.info("预热 miss→fill: factory={} range={}({}..{}) source={} {}ms",
                                factoryId, range.label(), start, end, source, callElapsed);
                    }
                } catch (IOException e) {
                    errors++;
                    String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                    if (msg.length() > 200) msg = msg.substring(0, 200) + "...[truncated]";
                    // Common failure: HTTP 404 when SMARTBI_AGENT_LAYER_ENABLED=false
                    // on Python side, or HTTP 503/quota on DashScope. Either is
                    // fatal for this run — bail outer loop to avoid wasting
                    // throttle sleeps on a route that's certain to keep failing.
                    log.warn("预热 error: factory={} range={}({}..{}) — {}; 中止后续调用",
                            factoryId, range.label(), start, end, msg);
                    break outer;
                } catch (Exception e) {
                    errors++;
                    log.warn("预热 unexpected: factory={} range={} — {}",
                            factoryId, range.label(), e.getMessage());
                }

                // Throttle so we don't burst the LLM rate limit.
                try {
                    Thread.sleep(throttleMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("预热任务被中断, 退出");
                    return;
                }
            }
        }

        long elapsed = System.currentTimeMillis() - t0;
        log.info("========== 预热任务完成: hits={} misses={} errors={} 总耗时={}ms ==========",
                hits, misses, errors, elapsed);
    }
}
