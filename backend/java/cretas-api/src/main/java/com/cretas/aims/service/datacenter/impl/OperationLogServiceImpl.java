package com.cretas.aims.service.datacenter.impl;

import com.cretas.aims.entity.datacenter.OperationLog;
import com.cretas.aims.repository.datacenter.OperationLogRepository;
import com.cretas.aims.service.datacenter.OperationLogService;
import com.cretas.aims.utils.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

@Slf4j
@Service
@RequiredArgsConstructor
public class OperationLogServiceImpl implements OperationLogService {

    private final OperationLogRepository repo;

    /**
     * AOP 入口. async 写库. 失败 log.error 但不抛 — 审计写失败不能阻塞业务.
     */
    @Async
    @Override
    public void record(OperationLog logEntity) {
        try {
            if (logEntity.getSuccess() == null) logEntity.setSuccess(Boolean.TRUE);
            repo.save(logEntity);
        } catch (Throwable t) {
            log.error("[OperationLog] async record failed: factory={}, module={}, action={}, entity={}/{}: {}",
                    logEntity.getFactoryId(), logEntity.getModule(), logEntity.getAction(),
                    logEntity.getEntityType(), logEntity.getEntityId(), t.getMessage(), t);
        }
    }

    @Async
    @Override
    public void recordDiff(String factoryId, String module, String entityType, String entityId,
                           Map<String, Object> oldValue, Map<String, Object> newValue, String summary) {
        try {
            String action = oldValue == null ? "CREATE" : (newValue == null ? "DELETE" : "UPDATE");
            OperationLog logEntity = OperationLog.builder()
                    .factoryId(factoryId)
                    .userId(SecurityUtils.getCurrentUserId())
                    .username(SecurityUtils.getCurrentUsername())
                    .module(module)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .oldValue(oldValue)
                    .newValue(newValue)
                    .diff(computeDiff(oldValue, newValue))
                    .summary(summary)
                    .success(Boolean.TRUE)
                    .build();
            repo.save(logEntity);
        } catch (Throwable t) {
            log.error("[OperationLog] recordDiff failed: factory={}, module={}, entity={}/{}: {}",
                    factoryId, module, entityType, entityId, t.getMessage(), t);
        }
    }

    /**
     * 字段级 diff. 比较 oldValue 与 newValue 的所有 key, 输出 {@code [{field,from,to}]}.
     */
    static List<Map<String, Object>> computeDiff(Map<String, Object> oldValue, Map<String, Object> newValue) {
        if (oldValue == null && newValue == null) return null;
        Map<String, Object> oldMap = oldValue == null ? new HashMap<>() : oldValue;
        Map<String, Object> newMap = newValue == null ? new HashMap<>() : newValue;
        Set<String> allKeys = new TreeSet<>();
        allKeys.addAll(oldMap.keySet());
        allKeys.addAll(newMap.keySet());
        List<Map<String, Object>> diffs = new ArrayList<>();
        for (String key : allKeys) {
            Object o = oldMap.get(key);
            Object n = newMap.get(key);
            if (!Objects.equals(o, n)) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("field", key);
                entry.put("from", o);
                entry.put("to", n);
                diffs.add(entry);
            }
        }
        return diffs.isEmpty() ? null : diffs;
    }
}
