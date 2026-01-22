package com.cretas.aims.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * 意图组合配置
 *
 * 将领域(Domain) + 动作(Action) + 修饰符(Modifiers) 映射为最终意图代码(Intent Code)。
 * 用于多阶段分类架构中，在粗分类(Domain)和动作分类(Action)完成后，
 * 结合修饰符(Modifiers)组合生成最终的细粒度意图代码。
 *
 * <p>v9.0: 支持多维映射</p>
 * <pre>
 * ATTENDANCE_QUERY + [] -> ATTENDANCE_TODAY (默认)
 * ATTENDANCE_QUERY + [STATS] -> ATTENDANCE_STATS (统计)
 * ATTENDANCE_QUERY + [ANOMALY] -> ATTENDANCE_ANOMALY (异常)
 * MATERIAL_QUERY + [FUTURE] -> MATERIAL_INCOMING (即将到货)
 * </pre>
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-01-21
 */
@Slf4j
@Configuration
public class IntentCompositionConfig {

    /**
     * Domain + Action -> Intent 映射表 (基础映射，v8.0兼容)
     */
    private final Map<String, String> compositionMapping = new HashMap<>();

    /**
     * v9.0: Domain + Action + Modifier -> Intent 多维映射表
     * Key: "DOMAIN_ACTION", Value: Map<Modifier, Intent>
     */
    private final Map<String, Map<String, String>> modifierMappings = new HashMap<>();

    /**
     * 初始化映射表
     */
    @PostConstruct
    public void init() {
        log.info("初始化意图组合配置 (v9.0 多维映射)...");

        // ==================== MATERIAL 领域 ====================
        compositionMapping.put("MATERIAL_QUERY", "MATERIAL_BATCH_QUERY");
        compositionMapping.put("MATERIAL_CREATE", "MATERIAL_BATCH_CREATE");

        // v9.0: MATERIAL 领域多维映射
        // 注：MATERIAL_INCOMING 暂未在数据库中注册，暂时使用 MATERIAL_BATCH_QUERY 处理未来时态查询
        Map<String, String> materialQueryModifiers = new HashMap<>();
        materialQueryModifiers.put("FUTURE", "MATERIAL_BATCH_QUERY");        // 明天要到的原料 (使用BATCH_QUERY处理)
        modifierMappings.put("MATERIAL_QUERY", materialQueryModifiers);

        // ==================== SHIPMENT 领域 ====================
        compositionMapping.put("SHIPMENT_QUERY", "SHIPMENT_QUERY");
        compositionMapping.put("SHIPMENT_CREATE", "SHIPMENT_CREATE");

        // ==================== ATTENDANCE 领域 ====================
        compositionMapping.put("ATTENDANCE_QUERY", "ATTENDANCE_TODAY");
        compositionMapping.put("ATTENDANCE_UPDATE", "CLOCK_IN");
        compositionMapping.put("ATTENDANCE_CREATE", "CLOCK_IN");  // v9.0: 打卡也是CREATE操作

        // v9.0: ATTENDANCE 领域多维映射 (支持9种意图细分)
        Map<String, String> attendanceQueryModifiers = new HashMap<>();
        attendanceQueryModifiers.put("STATS", "ATTENDANCE_STATS");           // 考勤统计
        attendanceQueryModifiers.put("ANOMALY", "ATTENDANCE_ANOMALY");       // 谁没来
        attendanceQueryModifiers.put("PERSONAL", "ATTENDANCE_HISTORY");      // 查张三的考勤
        attendanceQueryModifiers.put("MONTHLY", "ATTENDANCE_MONTHLY");       // 本月考勤
        modifierMappings.put("ATTENDANCE_QUERY", attendanceQueryModifiers);

        // ==================== EQUIPMENT 领域 ====================
        compositionMapping.put("EQUIPMENT_QUERY", "EQUIPMENT_STATUS");
        compositionMapping.put("EQUIPMENT_UPDATE", "EQUIPMENT_STATUS_UPDATE");
        compositionMapping.put("EQUIPMENT_CREATE", "EQUIPMENT_CREATE");

        // v9.0: EQUIPMENT 领域多维映射
        Map<String, String> equipmentQueryModifiers = new HashMap<>();
        equipmentQueryModifiers.put("ANOMALY", "EQUIPMENT_FAULT");           // 设备故障
        equipmentQueryModifiers.put("STATS", "EQUIPMENT_STATS");             // 设备统计
        modifierMappings.put("EQUIPMENT_QUERY", equipmentQueryModifiers);

        // ==================== QUALITY 领域 ====================
        compositionMapping.put("QUALITY_QUERY", "QUALITY_CHECK_QUERY");
        compositionMapping.put("QUALITY_CREATE", "QUALITY_CHECK_CREATE");
        compositionMapping.put("QUALITY_UPDATE", "QUALITY_CHECK_UPDATE");

        // v9.0: QUALITY 领域多维映射
        Map<String, String> qualityQueryModifiers = new HashMap<>();
        qualityQueryModifiers.put("STATS", "QUALITY_STATS");                 // 统计80分以上的质检
        qualityQueryModifiers.put("CRITICAL", "QUALITY_CRITICAL_ITEMS");     // 关键质检项
        qualityQueryModifiers.put("ANOMALY", "QUALITY_ANOMALY");             // 质检异常
        modifierMappings.put("QUALITY_QUERY", qualityQueryModifiers);

        // ==================== PROCESSING 领域 ====================
        compositionMapping.put("PROCESSING_QUERY", "PROCESSING_BATCH_LIST");
        compositionMapping.put("PROCESSING_CREATE", "PROCESSING_BATCH_CREATE");
        compositionMapping.put("PROCESSING_UPDATE", "PROCESSING_BATCH_UPDATE");

        // v9.0: PROCESSING 领域多维映射
        Map<String, String> processingQueryModifiers = new HashMap<>();
        processingQueryModifiers.put("STATS", "PROCESSING_STATS");           // 生产统计
        processingQueryModifiers.put("ANOMALY", "PROCESSING_ANOMALY");       // 生产异常
        modifierMappings.put("PROCESSING_QUERY", processingQueryModifiers);

        // ==================== ALERT 领域 ====================
        compositionMapping.put("ALERT_QUERY", "ALERT_LIST");
        compositionMapping.put("ALERT_UPDATE", "ALERT_RESOLVE");

        // v9.0: ALERT 领域多维映射
        Map<String, String> alertQueryModifiers = new HashMap<>();
        alertQueryModifiers.put("CRITICAL", "ALERT_CRITICAL");               // 紧急告警
        alertQueryModifiers.put("STATS", "ALERT_STATS");                     // 告警统计
        modifierMappings.put("ALERT_QUERY", alertQueryModifiers);

        // ==================== SUPPLIER 领域 ====================
        compositionMapping.put("SUPPLIER_QUERY", "SUPPLIER_QUERY");
        compositionMapping.put("SUPPLIER_CREATE", "SUPPLIER_CREATE");

        // ==================== CUSTOMER 领域 ====================
        compositionMapping.put("CUSTOMER_QUERY", "CUSTOMER_QUERY");
        compositionMapping.put("CUSTOMER_CREATE", "CUSTOMER_CREATE");

        log.info("意图组合配置初始化完成，共加载 {} 条基础映射, {} 条修饰符映射",
                compositionMapping.size(), modifierMappings.size());
    }

    /**
     * Get intent code for domain + action combination (v8.0 兼容方法)
     * @param domain The classified domain
     * @param action The classified action
     * @return Intent code or null if not mapped
     */
    public String getIntent(String domain, String action) {
        return getIntent(domain, action, Collections.emptySet());
    }

    /**
     * v9.0: Get intent code for domain + action + modifiers combination
     * Supports multi-dimensional intent mapping
     *
     * @param domain The classified domain
     * @param action The classified action
     * @param modifiers The set of modifiers (e.g., STATS, ANOMALY, FUTURE)
     * @return Intent code or null if not mapped
     */
    public String getIntent(String domain, String action, Set<String> modifiers) {
        if (domain == null || action == null) {
            log.warn("getIntent 参数为空: domain={}, action={}", domain, action);
            return null;
        }

        String key = domain + "_" + action;

        // v9.0: 优先尝试修饰符映射
        if (modifiers != null && !modifiers.isEmpty()) {
            Map<String, String> modMap = modifierMappings.get(key);
            if (modMap != null) {
                // 尝试按优先级匹配修饰符 (优先匹配更具体的修饰符)
                String[] priorityOrder = {"ANOMALY", "STATS", "PERSONAL", "MONTHLY", "FUTURE", "CRITICAL"};
                for (String mod : priorityOrder) {
                    if (modifiers.contains(mod) && modMap.containsKey(mod)) {
                        String intent = modMap.get(mod);
                        log.debug("v9.0 修饰符映射命中: {} + {} -> {}", key, mod, intent);
                        return intent;
                    }
                }
            }
        }

        // 回退到基础映射
        String intent = compositionMapping.get(key);

        if (intent != null) {
            log.debug("基础意图组合匹配成功: {} -> {}", key, intent);
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
