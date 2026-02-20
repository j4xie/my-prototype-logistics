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
 * ATTENDANCE_QUERY + [] -> ATTENDANCE_HISTORY (默认, v22: 从TODAY改为HISTORY)
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
        compositionMapping.put("MATERIAL_DELETE", "MATERIAL_BATCH_DELETE");

        // v9.0: MATERIAL 领域多维映射
        // 注：MATERIAL_INCOMING 暂未在数据库中注册，暂时使用 MATERIAL_BATCH_QUERY 处理未来时态查询
        Map<String, String> materialQueryModifiers = new HashMap<>();
        materialQueryModifiers.put("FUTURE", "MATERIAL_BATCH_QUERY");        // 明天要到的原料 (使用BATCH_QUERY处理)
        modifierMappings.put("MATERIAL_QUERY", materialQueryModifiers);

        // ==================== SHIPMENT 领域 ====================
        compositionMapping.put("SHIPMENT_QUERY", "SHIPMENT_QUERY");
        compositionMapping.put("SHIPMENT_CREATE", "SHIPMENT_CREATE");
        compositionMapping.put("SHIPMENT_DELETE", "SHIPMENT_DELETE");

        // ==================== ATTENDANCE 领域 ====================
        compositionMapping.put("ATTENDANCE_QUERY", "ATTENDANCE_HISTORY");  // v22.1: 默认从TODAY改为HISTORY
        compositionMapping.put("ATTENDANCE_UPDATE", "CLOCK_IN");
        compositionMapping.put("ATTENDANCE_CREATE", "CLOCK_IN");  // v9.0: 打卡也是CREATE操作
        compositionMapping.put("ATTENDANCE_DELETE", "ATTENDANCE_DELETE");

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
        compositionMapping.put("EQUIPMENT_DELETE", "EQUIPMENT_DELETE");

        // v9.0: EQUIPMENT 领域多维映射
        Map<String, String> equipmentQueryModifiers = new HashMap<>();
        equipmentQueryModifiers.put("ANOMALY", "EQUIPMENT_FAULT");           // 设备故障
        equipmentQueryModifiers.put("STATS", "EQUIPMENT_STATS");             // 设备统计
        modifierMappings.put("EQUIPMENT_QUERY", equipmentQueryModifiers);

        // ==================== QUALITY 领域 ====================
        compositionMapping.put("QUALITY_QUERY", "QUALITY_CHECK_QUERY");
        compositionMapping.put("QUALITY_CREATE", "QUALITY_CHECK_CREATE");
        compositionMapping.put("QUALITY_UPDATE", "QUALITY_CHECK_UPDATE");
        compositionMapping.put("QUALITY_DELETE", "QUALITY_DELETE");

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
        compositionMapping.put("PROCESSING_DELETE", "PROCESSING_BATCH_CANCEL");

        // v9.0: PROCESSING 领域多维映射
        Map<String, String> processingQueryModifiers = new HashMap<>();
        processingQueryModifiers.put("STATS", "PROCESSING_STATS");           // 生产统计
        processingQueryModifiers.put("ANOMALY", "PROCESSING_ANOMALY");       // 生产异常
        modifierMappings.put("PROCESSING_QUERY", processingQueryModifiers);

        // ==================== ALERT 领域 ====================
        compositionMapping.put("ALERT_QUERY", "ALERT_LIST");
        compositionMapping.put("ALERT_UPDATE", "ALERT_RESOLVE");
        compositionMapping.put("ALERT_DELETE", "ALERT_DELETE");

        // v9.0: ALERT 领域多维映射
        Map<String, String> alertQueryModifiers = new HashMap<>();
        alertQueryModifiers.put("CRITICAL", "ALERT_CRITICAL");               // 紧急告警
        alertQueryModifiers.put("STATS", "ALERT_STATS");                     // 告警统计
        modifierMappings.put("ALERT_QUERY", alertQueryModifiers);

        // ==================== SUPPLIER 领域 ====================
        compositionMapping.put("SUPPLIER_QUERY", "SUPPLIER_QUERY");
        compositionMapping.put("SUPPLIER_CREATE", "SUPPLIER_CREATE");
        compositionMapping.put("SUPPLIER_DELETE", "SUPPLIER_DELETE");

        // ==================== CUSTOMER 领域 ====================
        compositionMapping.put("CUSTOMER_QUERY", "CUSTOMER_QUERY");
        compositionMapping.put("CUSTOMER_CREATE", "CUSTOMER_CREATE");
        compositionMapping.put("CUSTOMER_DELETE", "CUSTOMER_DELETE");

        // ==================== ORDER 领域 ====================
        compositionMapping.put("ORDER_QUERY", "ORDER_LIST");
        compositionMapping.put("ORDER_CREATE", "ORDER_CREATE");
        compositionMapping.put("ORDER_UPDATE", "ORDER_UPDATE");
        compositionMapping.put("ORDER_DELETE", "ORDER_DELETE");

        // ==================== v13.0: 新增 Modifier 映射 ====================

        // ORDER 领域多维映射
        Map<String, String> orderQueryModifiers = new HashMap<>();
        orderQueryModifiers.put("STATS", "ORDER_STATS");                   // 订单统计
        orderQueryModifiers.put("RANKING", "ORDER_RANKING");               // 订单排名
        orderQueryModifiers.put("COMPARISON", "ORDER_COMPARISON");         // 订单对比
        orderQueryModifiers.put("MOM", "ORDER_MOM_ANALYSIS");              // 订单环比
        orderQueryModifiers.put("YOY", "ORDER_YOY_ANALYSIS");              // 订单同比
        orderQueryModifiers.put("NEGATION", "ORDER_EXCLUDE_LIST");         // 排除某些订单
        modifierMappings.put("ORDER_QUERY", orderQueryModifiers);

        // SHIPMENT 领域多维映射
        Map<String, String> shipmentQueryModifiers = new HashMap<>();
        shipmentQueryModifiers.put("STATS", "SHIPMENT_STATS");             // 发货统计
        shipmentQueryModifiers.put("RANKING", "SHIPMENT_RANKING");         // 发货排名
        shipmentQueryModifiers.put("COMPARISON", "SHIPMENT_COMPARISON");   // 发货对比
        shipmentQueryModifiers.put("ANOMALY", "SHIPMENT_ANOMALY");         // 发货异常
        modifierMappings.put("SHIPMENT_QUERY", shipmentQueryModifiers);

        // SUPPLIER 领域多维映射
        Map<String, String> supplierQueryModifiers = new HashMap<>();
        supplierQueryModifiers.put("STATS", "SUPPLIER_STATS");             // 供应商统计
        supplierQueryModifiers.put("RANKING", "SUPPLIER_RANKING");         // 供应商排名
        supplierQueryModifiers.put("COMPARISON", "SUPPLIER_COMPARISON");   // 供应商对比
        modifierMappings.put("SUPPLIER_QUERY", supplierQueryModifiers);

        // CUSTOMER 领域多维映射
        Map<String, String> customerQueryModifiers = new HashMap<>();
        customerQueryModifiers.put("STATS", "CUSTOMER_STATS");             // 客户统计
        customerQueryModifiers.put("RANKING", "CUSTOMER_RANKING");         // 客户排名
        customerQueryModifiers.put("COMPARISON", "CUSTOMER_COMPARISON");   // 客户对比
        modifierMappings.put("CUSTOMER_QUERY", customerQueryModifiers);

        // MATERIAL 领域扩展映射
        materialQueryModifiers.put("STATS", "MATERIAL_STATS");             // 原料统计
        materialQueryModifiers.put("RANKING", "MATERIAL_RANKING");         // 原料排名
        materialQueryModifiers.put("ANOMALY", "MATERIAL_LOW_STOCK_ALERT"); // 库存异常
        materialQueryModifiers.put("NEGATION", "MATERIAL_EXCLUDE_LIST");   // 排除某些原料
        materialQueryModifiers.put("COMPARISON", "MATERIAL_COMPARISON");   // 原料对比
        materialQueryModifiers.put("MOM", "MATERIAL_MOM_ANALYSIS");        // 原料环比
        materialQueryModifiers.put("YOY", "MATERIAL_YOY_ANALYSIS");        // 原料同比

        // PROCESSING 领域扩展映射
        processingQueryModifiers.put("RANKING", "PROCESSING_RANKING");     // 生产排名
        processingQueryModifiers.put("COMPARISON", "PROCESSING_COMPARISON"); // 生产对比
        processingQueryModifiers.put("MOM", "PROCESSING_MOM_ANALYSIS");    // 生产环比
        processingQueryModifiers.put("YOY", "PROCESSING_YOY_ANALYSIS");    // 生产同比

        // QUALITY 领域扩展映射
        qualityQueryModifiers.put("RANKING", "QUALITY_RANKING");           // 质检排名
        qualityQueryModifiers.put("COMPARISON", "QUALITY_COMPARISON");     // 质检对比
        qualityQueryModifiers.put("MOM", "QUALITY_MOM_ANALYSIS");          // 质检环比
        qualityQueryModifiers.put("YOY", "QUALITY_YOY_ANALYSIS");          // 质检同比

        // EQUIPMENT 领域扩展映射
        equipmentQueryModifiers.put("RANKING", "EQUIPMENT_RANKING");       // 设备排名
        equipmentQueryModifiers.put("COMPARISON", "EQUIPMENT_COMPARISON"); // 设备对比

        // ATTENDANCE 领域扩展映射
        attendanceQueryModifiers.put("RANKING", "ATTENDANCE_RANKING");     // 考勤排名
        attendanceQueryModifiers.put("COMPARISON", "ATTENDANCE_COMPARISON"); // 考勤对比
        attendanceQueryModifiers.put("MOM", "ATTENDANCE_MOM_ANALYSIS");    // 考勤环比
        attendanceQueryModifiers.put("YOY", "ATTENDANCE_YOY_ANALYSIS");    // 考勤同比

        // ==================== v15: FOOD 领域 (食品安全知识库) ====================
        // 所有食品知识查询均映射到 FOOD_KNOWLEDGE_QUERY — 食品知识库是只读 RAG 查询
        compositionMapping.put("FOOD_QUERY", "FOOD_KNOWLEDGE_QUERY");
        compositionMapping.put("FOOD_CREATE", "FOOD_KNOWLEDGE_QUERY");  // "帮我查一下" 可能被分为 CREATE
        compositionMapping.put("FOOD_UPDATE", "FOOD_KNOWLEDGE_QUERY");  // 食品知识无写操作
        compositionMapping.put("FOOD_DELETE", "FOOD_KNOWLEDGE_QUERY");  // 食品知识无删除操作

        // ==================== v12.2 Phase 2: HIGH-RISK 操作 ====================
        // 库存清空操作
        compositionMapping.put("INVENTORY_DELETE", "INVENTORY_CLEAR");
        compositionMapping.put("INVENTORY_CLEAR", "INVENTORY_CLEAR");

        // 批量数据删除
        compositionMapping.put("DATA_DELETE", "DATA_BATCH_DELETE");
        compositionMapping.put("DATA_BATCH_DELETE", "DATA_BATCH_DELETE");

        // 系统配置重置
        compositionMapping.put("SYSTEM_RESET", "CONFIG_RESET");
        compositionMapping.put("CONFIG_RESET", "CONFIG_RESET");
        compositionMapping.put("CONFIG_UPDATE", "CONFIG_RESET");

        // ==================== v12.2 Phase 2: DOMAIN 领域 ====================
        // 冷链温度监控
        compositionMapping.put("COLD_CHAIN_QUERY", "COLD_CHAIN_TEMPERATURE");
        compositionMapping.put("TEMPERATURE_QUERY", "COLD_CHAIN_TEMPERATURE");

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

        // v9.0/v13.0: 优先尝试修饰符映射
        if (modifiers != null && !modifiers.isEmpty()) {
            Map<String, String> modMap = modifierMappings.get(key);
            if (modMap != null) {
                // v13.0: 扩展修饰符优先级顺序 (优先匹配更具体的修饰符)
                // NEGATION > RANKING > COMPARISON > MOM/YOY/QOQ > ANOMALY > STATS > PERSONAL > MONTHLY > FUTURE > CRITICAL
                String[] priorityOrder = {
                    "NEGATION",    // 否定最高优先级
                    "RANKING",     // 排名
                    "COMPARISON",  // 对比
                    "MOM",         // 环比
                    "YOY",         // 同比
                    "QOQ",         // 季环比
                    "ANOMALY",     // 异常
                    "STATS",       // 统计
                    "AGGREGATION", // 聚合
                    "PERSONAL",    // 个人
                    "MONTHLY",     // 月度
                    "FUTURE",      // 未来
                    "CRITICAL"     // 关键
                };
                for (String mod : priorityOrder) {
                    if (modifiers.contains(mod) && modMap.containsKey(mod)) {
                        String intent = modMap.get(mod);
                        log.debug("v13.0 修饰符映射命中: {} + {} -> {}", key, mod, intent);
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
