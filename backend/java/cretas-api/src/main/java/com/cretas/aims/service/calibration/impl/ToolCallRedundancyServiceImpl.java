package com.cretas.aims.service.calibration.impl;

import com.cretas.aims.entity.calibration.ToolCallCache;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.repository.calibration.ToolCallCacheRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.service.calibration.ToolCallRedundancyService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 工具调用冗余检测服务实现
 * 提供基于 SHA-256 哈希的工具调用冗余检测和缓存管理
 *
 * 特性:
 * - 双层缓存策略：内存缓存 + 数据库持久化缓存
 * - 可配置的缓存 TTL
 * - 自动清理过期缓存
 * - 冗余调用统计和分析
 *
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的行为校准设计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ToolCallRedundancyServiceImpl implements ToolCallRedundancyService {

    private final ToolCallRecordRepository toolCallRecordRepository;
    private final ToolCallCacheRepository toolCallCacheRepository;
    private final ObjectMapper objectMapper;

    /**
     * 内存级缓存，用于快速查找
     * Key: cacheKey (sessionId:toolName:parametersHash)
     * Value: 缓存条目信息
     */
    private final ConcurrentHashMap<String, MemoryCacheEntry> memoryCache = new ConcurrentHashMap<>();

    /**
     * 会话级统计计数器
     */
    private final ConcurrentHashMap<String, SessionStatsCounter> sessionStats = new ConcurrentHashMap<>();

    @Value("${cretas.calibration.redundancy.cache-ttl-minutes:5}")
    private int defaultCacheTtlMinutes;

    @Value("${cretas.calibration.redundancy.memory-cache-enabled:true}")
    private boolean memoryCacheEnabled;

    @Override
    public boolean isRedundant(String sessionId, String toolName, Map<String, Object> parameters) {
        if (sessionId == null || toolName == null || parameters == null) {
            return false;
        }

        String parametersHash = computeParametersHash(parameters);
        String cacheKey = ToolCallCache.generateCacheKey(sessionId, toolName, parametersHash);

        // 1. 检查内存缓存
        if (memoryCacheEnabled) {
            MemoryCacheEntry memEntry = memoryCache.get(cacheKey);
            if (memEntry != null && !memEntry.isExpired()) {
                log.debug("Redundant call detected (memory cache): session={}, tool={}, hash={}",
                    sessionId, toolName, parametersHash.substring(0, 8));
                incrementCacheHit(sessionId);
                return true;
            }
        }

        // 2. 检查数据库缓存
        Optional<ToolCallCache> dbCache = toolCallCacheRepository.findValidCache(
            cacheKey, LocalDateTime.now());

        if (dbCache.isPresent()) {
            // 更新内存缓存
            if (memoryCacheEnabled) {
                ToolCallCache cache = dbCache.get();
                memoryCache.put(cacheKey, new MemoryCacheEntry(
                    cache.getCachedResult(),
                    cache.getOriginalCallId(),
                    cache.getExpiresAt()
                ));
            }

            log.debug("Redundant call detected (db cache): session={}, tool={}, hash={}",
                sessionId, toolName, parametersHash.substring(0, 8));
            incrementCacheHit(sessionId);
            return true;
        }

        // 3. 检查最近的调用记录（用于检测短时间内的重复调用）
        LocalDateTime cutoffTime = LocalDateTime.now().minusMinutes(defaultCacheTtlMinutes);
        Optional<ToolCallRecord> recentCall = toolCallRecordRepository
            .findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
                sessionId, toolName, parametersHash, cutoffTime);

        if (recentCall.isPresent()) {
            ToolCallRecord record = recentCall.get();
            if (record.getExecutionStatus() == ToolCallRecord.ExecutionStatus.SUCCESS) {
                log.debug("Redundant call detected (recent record): session={}, tool={}, originalId={}",
                    sessionId, toolName, record.getId());
                incrementRedundantCall(sessionId);
                return true;
            }
        }

        return false;
    }

    @Override
    @Transactional
    public ToolCallRecord recordToolCall(ToolCallRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("ToolCallRecord cannot be null");
        }

        // 确保参数哈希已计算
        if (record.getParametersHash() == null && record.getToolParameters() != null) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> params = objectMapper.readValue(
                    record.getToolParameters(), Map.class);
                record.setParametersHash(computeParametersHash(params));
            } catch (JsonProcessingException e) {
                log.warn("Failed to parse tool parameters for hash computation: {}", e.getMessage());
            }
        }

        ToolCallRecord savedRecord = toolCallRecordRepository.save(record);

        // 更新统计
        incrementTotalCall(record.getSessionId());
        if (Boolean.TRUE.equals(record.getIsRedundant())) {
            incrementRedundantCall(record.getSessionId());
        }

        log.debug("Recorded tool call: id={}, session={}, tool={}, status={}",
            savedRecord.getId(), record.getSessionId(), record.getToolName(), record.getExecutionStatus());

        return savedRecord;
    }

    @Override
    public Optional<String> getCachedResult(String sessionId, String toolName, Map<String, Object> parameters) {
        if (sessionId == null || toolName == null || parameters == null) {
            return Optional.empty();
        }

        String parametersHash = computeParametersHash(parameters);
        String cacheKey = ToolCallCache.generateCacheKey(sessionId, toolName, parametersHash);

        // 1. 检查内存缓存
        if (memoryCacheEnabled) {
            MemoryCacheEntry memEntry = memoryCache.get(cacheKey);
            if (memEntry != null && !memEntry.isExpired()) {
                log.debug("Cache hit (memory): session={}, tool={}", sessionId, toolName);
                incrementCacheHit(sessionId);
                return Optional.ofNullable(memEntry.result);
            }
        }

        // 2. 检查数据库缓存
        Optional<ToolCallCache> dbCache = toolCallCacheRepository.findValidCache(
            cacheKey, LocalDateTime.now());

        if (dbCache.isPresent()) {
            ToolCallCache cache = dbCache.get();
            cache.incrementHitCount();
            toolCallCacheRepository.save(cache);

            // 更新内存缓存
            if (memoryCacheEnabled) {
                memoryCache.put(cacheKey, new MemoryCacheEntry(
                    cache.getCachedResult(),
                    cache.getOriginalCallId(),
                    cache.getExpiresAt()
                ));
            }

            log.debug("Cache hit (db): session={}, tool={}, hitCount={}",
                sessionId, toolName, cache.getHitCount());
            incrementCacheHit(sessionId);
            return Optional.ofNullable(cache.getCachedResult());
        }

        return Optional.empty();
    }

    @Override
    @Transactional
    public void cacheResult(String sessionId, String toolName, Map<String, Object> parameters,
                            String result, Long originalCallId) {
        cacheResult(sessionId, toolName, parameters, result, originalCallId, defaultCacheTtlMinutes);
    }

    @Override
    @Transactional
    public void cacheResult(String sessionId, String toolName, Map<String, Object> parameters,
                            String result, Long originalCallId, int ttlMinutes) {
        if (sessionId == null || toolName == null || parameters == null) {
            log.warn("Cannot cache result: missing required parameters");
            return;
        }

        String parametersHash = computeParametersHash(parameters);
        String cacheKey = ToolCallCache.generateCacheKey(sessionId, toolName, parametersHash);
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(ttlMinutes);

        // 检查是否已存在缓存
        Optional<ToolCallCache> existing = toolCallCacheRepository.findByCacheKey(cacheKey);

        if (existing.isPresent()) {
            // 更新现有缓存
            ToolCallCache cache = existing.get();
            cache.setCachedResult(result);
            cache.setOriginalCallId(originalCallId);
            cache.setExpiresAt(expiresAt);
            toolCallCacheRepository.save(cache);
            log.debug("Updated cache: key={}", cacheKey);
        } else {
            // 创建新缓存
            ToolCallCache cache = ToolCallCache.builder()
                .cacheKey(cacheKey)
                .sessionId(sessionId)
                .toolName(toolName)
                .parametersHash(parametersHash)
                .cachedResult(result)
                .originalCallId(originalCallId)
                .expiresAt(expiresAt)
                .hitCount(0)
                .build();
            toolCallCacheRepository.save(cache);
            log.debug("Created cache: key={}, ttl={}min", cacheKey, ttlMinutes);
        }

        // 更新内存缓存
        if (memoryCacheEnabled) {
            memoryCache.put(cacheKey, new MemoryCacheEntry(result, originalCallId, expiresAt));
        }
    }

    @Override
    @Transactional
    public int clearSessionCache(String sessionId) {
        if (sessionId == null) {
            return 0;
        }

        // 清除数据库缓存
        toolCallCacheRepository.deleteBySessionId(sessionId);

        // 清除内存缓存
        int removedCount = 0;
        String prefix = sessionId + ":";
        for (String key : memoryCache.keySet()) {
            if (key.startsWith(prefix)) {
                memoryCache.remove(key);
                removedCount++;
            }
        }

        // 清除统计数据
        sessionStats.remove(sessionId);

        log.info("Cleared cache for session={}, removedFromMemory={}", sessionId, removedCount);
        return removedCount;
    }

    @Override
    public String computeParametersHash(Map<String, Object> parameters) {
        if (parameters == null || parameters.isEmpty()) {
            return computeSHA256("");
        }

        try {
            // 使用 TreeMap 确保参数顺序一致
            TreeMap<String, Object> sortedParams = new TreeMap<>(parameters);
            String json = objectMapper.writeValueAsString(sortedParams);
            return computeSHA256(json);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize parameters for hashing: {}", e.getMessage());
            // 降级方案：使用 toString()
            return computeSHA256(new TreeMap<>(parameters).toString());
        }
    }

    @Override
    public RedundancyStats getSessionStats(String sessionId) {
        SessionStatsCounter counter = sessionStats.getOrDefault(sessionId, new SessionStatsCounter());
        return new RedundancyStatsImpl(
            counter.totalCalls.get(),
            counter.redundantCalls.get(),
            counter.cacheHits.get(),
            counter.estimatedTimeSavedMs.get()
        );
    }

    @Override
    @Transactional
    public void markAsRedundant(Long recordId, Long originalCallId, String reason) {
        if (recordId == null) {
            return;
        }

        toolCallRecordRepository.findById(recordId).ifPresent(record -> {
            record.markAsRedundant(originalCallId, reason);
            toolCallRecordRepository.save(record);

            log.debug("Marked call as redundant: id={}, originalId={}, reason={}",
                recordId, originalCallId, reason);
        });
    }

    @Override
    @Transactional
    @Scheduled(cron = "0 */10 * * * ?") // 每10分钟执行一次
    public int cleanupExpiredCache() {
        LocalDateTime now = LocalDateTime.now();

        // 清理数据库过期缓存
        int dbCleanedCount = toolCallCacheRepository.deleteExpiredCache(now);

        // 清理内存过期缓存
        int memCleanedCount = 0;
        for (Map.Entry<String, MemoryCacheEntry> entry : memoryCache.entrySet()) {
            if (entry.getValue().isExpired()) {
                memoryCache.remove(entry.getKey());
                memCleanedCount++;
            }
        }

        if (dbCleanedCount > 0 || memCleanedCount > 0) {
            log.info("Cleaned up expired caches: db={}, memory={}", dbCleanedCount, memCleanedCount);
        }

        return dbCleanedCount + memCleanedCount;
    }

    // ========== Private Methods ==========

    private String computeSHA256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder(64);
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    private void incrementTotalCall(String sessionId) {
        if (sessionId == null) return;
        sessionStats.computeIfAbsent(sessionId, k -> new SessionStatsCounter())
            .totalCalls.incrementAndGet();
    }

    private void incrementRedundantCall(String sessionId) {
        if (sessionId == null) return;
        SessionStatsCounter counter = sessionStats.computeIfAbsent(sessionId, k -> new SessionStatsCounter());
        counter.redundantCalls.incrementAndGet();
        // 估算节省的时间（假设平均每次调用100ms）
        counter.estimatedTimeSavedMs.addAndGet(100);
    }

    private void incrementCacheHit(String sessionId) {
        if (sessionId == null) return;
        SessionStatsCounter counter = sessionStats.computeIfAbsent(sessionId, k -> new SessionStatsCounter());
        counter.cacheHits.incrementAndGet();
        // 缓存命中节省更多时间（假设节省200ms）
        counter.estimatedTimeSavedMs.addAndGet(200);
    }

    // ========== Inner Classes ==========

    /**
     * 内存缓存条目
     */
    private static class MemoryCacheEntry {
        final String result;
        final Long originalCallId;
        final LocalDateTime expiresAt;

        MemoryCacheEntry(String result, Long originalCallId, LocalDateTime expiresAt) {
            this.result = result;
            this.originalCallId = originalCallId;
            this.expiresAt = expiresAt;
        }

        boolean isExpired() {
            return LocalDateTime.now().isAfter(expiresAt);
        }
    }

    /**
     * 会话统计计数器
     */
    private static class SessionStatsCounter {
        final AtomicLong totalCalls = new AtomicLong(0);
        final AtomicLong redundantCalls = new AtomicLong(0);
        final AtomicLong cacheHits = new AtomicLong(0);
        final AtomicLong estimatedTimeSavedMs = new AtomicLong(0);
    }

    /**
     * 冗余统计实现
     */
    @RequiredArgsConstructor
    private static class RedundancyStatsImpl implements RedundancyStats {
        private final long totalCalls;
        private final long redundantCalls;
        private final long cacheHits;
        private final long estimatedTimeSavedMs;

        @Override
        public long getTotalCalls() {
            return totalCalls;
        }

        @Override
        public long getRedundantCalls() {
            return redundantCalls;
        }

        @Override
        public double getRedundancyRate() {
            if (totalCalls == 0) {
                return 0.0;
            }
            return (double) redundantCalls / totalCalls;
        }

        @Override
        public long getCacheHits() {
            return cacheHits;
        }

        @Override
        public long getEstimatedTimeSavedMs() {
            return estimatedTimeSavedMs;
        }
    }
}
