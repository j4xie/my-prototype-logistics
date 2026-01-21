package com.cretas.aims.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * 意图组合配置
 *
 * 将领域(Domain) + 动作(Action) 映射为最终意图代码(Intent Code)。
 * 用于两阶段分类架构中，在粗分类(Domain)和动作分类(Action)完成后，
 * 组合生成最终的细粒度意图代码。
 *
 * <p>映射规则：DOMAIN_ACTION -> INTENT_CODE</p>
 *
 * <p>示例：</p>
 * <pre>
 * MATERIAL_QUERY  -> MATERIAL_BATCH_QUERY
 * SHIPMENT_CREATE -> SHIPMENT_CREATE
 * ATTENDANCE_UPDATE -> CLOCK_IN
 * </pre>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@Configuration
public class IntentCompositionConfig {

    /**
     * Domain + Action -> Intent 映射表
     */
    private final Map<String, String> compositionMapping = new HashMap<>();

    /**
     * 初始化映射表
     */
    @PostConstruct
    public void init() {
        log.info("初始化意图组合配置...");

        // ==================== MATERIAL 领域 ====================
        compositionMapping.put("MATERIAL_QUERY", "MATERIAL_BATCH_QUERY");
        compositionMapping.put("MATERIAL_CREATE", "MATERIAL_BATCH_CREATE");

        // ==================== SHIPMENT 领域 ====================
        compositionMapping.put("SHIPMENT_QUERY", "SHIPMENT_QUERY");
        compositionMapping.put("SHIPMENT_CREATE", "SHIPMENT_CREATE");

        // ==================== ATTENDANCE 领域 ====================
        compositionMapping.put("ATTENDANCE_QUERY", "ATTENDANCE_TODAY");
        compositionMapping.put("ATTENDANCE_UPDATE", "CLOCK_IN");

        // ==================== EQUIPMENT 领域 ====================
        compositionMapping.put("EQUIPMENT_QUERY", "EQUIPMENT_STATUS");
        compositionMapping.put("EQUIPMENT_UPDATE", "EQUIPMENT_STATUS_UPDATE");
        compositionMapping.put("EQUIPMENT_CREATE", "EQUIPMENT_CREATE");

        // ==================== QUALITY 领域 ====================
        compositionMapping.put("QUALITY_QUERY", "QUALITY_CHECK_QUERY");
        compositionMapping.put("QUALITY_CREATE", "QUALITY_CHECK_CREATE");
        compositionMapping.put("QUALITY_UPDATE", "QUALITY_CHECK_UPDATE");

        // ==================== PROCESSING 领域 ====================
        compositionMapping.put("PROCESSING_QUERY", "PROCESSING_BATCH_LIST");
        compositionMapping.put("PROCESSING_CREATE", "PROCESSING_BATCH_CREATE");
        compositionMapping.put("PROCESSING_UPDATE", "PROCESSING_BATCH_UPDATE");

        // ==================== ALERT 领域 ====================
        compositionMapping.put("ALERT_QUERY", "ALERT_LIST");
        compositionMapping.put("ALERT_UPDATE", "ALERT_RESOLVE");

        // ==================== SUPPLIER 领域 ====================
        compositionMapping.put("SUPPLIER_QUERY", "SUPPLIER_QUERY");
        compositionMapping.put("SUPPLIER_CREATE", "SUPPLIER_CREATE");

        // ==================== CUSTOMER 领域 ====================
        compositionMapping.put("CUSTOMER_QUERY", "CUSTOMER_QUERY");
        compositionMapping.put("CUSTOMER_CREATE", "CUSTOMER_CREATE");

        log.info("意图组合配置初始化完成，共加载 {} 条映射", compositionMapping.size());
    }

    /**
     * Get intent code for domain + action combination
     * @param domain The classified domain
     * @param action The classified action
     * @return Intent code or null if not mapped
     */
    public String getIntent(String domain, String action) {
        if (domain == null || action == null) {
            log.warn("getIntent 参数为空: domain={}, action={}", domain, action);
            return null;
        }

        String key = domain + "_" + action;
        String intent = compositionMapping.get(key);

        if (intent != null) {
            log.debug("意图组合匹配成功: {} -> {}", key, intent);
        } else {
            log.debug("意图组合未匹配: {}", key);
        }

        return intent;
    }

    /**
     * Check if a domain+action combination has a mapping
     */
    public boolean hasMapping(String domain, String action) {
        if (domain == null || action == null) {
            return false;
        }
        return compositionMapping.containsKey(domain + "_" + action);
    }

    /**
     * Get all mappings (for debugging)
     */
    public Map<String, String> getAllMappings() {
        return Collections.unmodifiableMap(compositionMapping);
    }
}
