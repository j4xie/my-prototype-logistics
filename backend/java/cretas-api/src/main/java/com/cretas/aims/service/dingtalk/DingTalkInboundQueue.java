package com.cretas.aims.service.dingtalk;

import com.cretas.aims.dto.dingtalk.DingTalkInboundPayload;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Deque;
import java.util.Map;

/**
 * Redis-backed FIFO queue for DingTalk inbound payloads.
 *
 * <p>Storage: Redis list at key {@code dingtalk:inbound:{factoryId}}, or
 * {@code dingtalk:inbound:_global} when factoryId is absent (platform-level).
 * Ops: LPUSH on enqueue, RPOP on consume (FIFO).
 *
 * <p>Fail-open behavior: when Redis is unavailable, falls back to an
 * in-process deque so unit-test and local-dev (no Redis) still functions.
 * Single-instance only — multi-replica deployments require Redis.
 *
 * <p>Consumer: see {@link DingTalkInboundConsumer} (Day 3).
 */
@Slf4j
@Service
public class DingTalkInboundQueue {

    private static final String KEY_PREFIX = "dingtalk:inbound:";
    private static final String GLOBAL_KEY = KEY_PREFIX + "_global";

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    private final ObjectMapper objectMapper;
    private final Map<String, Deque<String>> memoryQueues = new ConcurrentHashMap<>();

    public DingTalkInboundQueue(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * @return true on success, false on serialization or transport failure.
     */
    public boolean enqueue(String factoryId, DingTalkInboundPayload payload) {
        String key = keyFor(factoryId);
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize DingTalkInboundPayload msgId={}", payload.getMsgId(), e);
            return false;
        }
        if (redisTemplate != null) {
            try {
                redisTemplate.opsForList().leftPush(key, json);
                log.debug("Enqueued inbound msg to Redis: key={} msgId={}", key, payload.getMsgId());
                return true;
            } catch (Exception e) {
                log.warn("Redis enqueue failed, falling back to memory: {}", e.getMessage());
            }
        }
        memoryQueues.computeIfAbsent(key, k -> new ConcurrentLinkedDeque<>()).offerFirst(json);
        log.debug("Enqueued inbound msg to memory queue: key={} msgId={}", key, payload.getMsgId());
        return true;
    }

    /**
     * Pops the oldest payload (FIFO) from the queue for the given factory.
     *
     * @return Empty when queue empty or serialization fails.
     */
    public Optional<DingTalkInboundPayload> dequeue(String factoryId) {
        String key = keyFor(factoryId);
        String json = null;
        if (redisTemplate != null) {
            try {
                json = redisTemplate.opsForList().rightPop(key);
            } catch (Exception e) {
                log.warn("Redis dequeue failed, falling back to memory: {}", e.getMessage());
            }
        }
        if (json == null) {
            Deque<String> mem = memoryQueues.get(key);
            if (mem != null) json = mem.pollLast();
        }
        if (json == null) return Optional.empty();
        try {
            return Optional.of(objectMapper.readValue(json, DingTalkInboundPayload.class));
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize DingTalk inbound payload from queue: {}", json, e);
            return Optional.empty();
        }
    }

    private String keyFor(String factoryId) {
        if (factoryId == null || factoryId.isBlank()) return GLOBAL_KEY;
        return KEY_PREFIX + factoryId;
    }
}
