package com.cretas.aims.config;

import com.cretas.aims.dto.slot.RequiredSlot;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.*;

/**
 * 意图槽位配置
 *
 * 集中管理各意图所需的参数槽位定义，用于：
 * 1. 在意图识别后检查必需参数
 * 2. 触发渐进式参数收集（Slot Filling）
 * 3. 从用户输入中提取参数值
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Component
public class IntentSlotConfiguration {

    /**
     * 意图代码 -> 必需槽位列表的映射
     */
    private final Map<String, List<RequiredSlot>> intentSlots = new HashMap<>();

    @PostConstruct
    public void init() {
        // ==================== 批次操作类意图 ====================

        // 批次状态更新
        registerSlots("BATCH_STATUS_UPDATE", Arrays.asList(
                RequiredSlot.batchId(),
                RequiredSlot.status("[{\"value\":\"PENDING\",\"label\":\"待处理\"},{\"value\":\"IN_PROGRESS\",\"label\":\"进行中\"},{\"value\":\"COMPLETED\",\"label\":\"已完成\"},{\"value\":\"CANCELLED\",\"label\":\"已取消\"}]")
        ));

        // 使用原材料批次
        registerSlots("MATERIAL_BATCH_USE", Arrays.asList(
                RequiredSlot.batchId(),
                RequiredSlot.quantity()
        ));

        // 消耗原材料批次
        registerSlots("MATERIAL_BATCH_CONSUME", Arrays.asList(
                RequiredSlot.batchId(),
                RequiredSlot.quantity(),
                RequiredSlot.reason()
        ));

        // 调整批次库存
        registerSlots("MATERIAL_BATCH_ADJUST", Arrays.asList(
                RequiredSlot.batchId(),
                RequiredSlot.quantity(),
                RequiredSlot.reason()
        ));

        // 释放保留的原材料
        registerSlots("MATERIAL_BATCH_RELEASE", Arrays.asList(
                RequiredSlot.batchId(),
                RequiredSlot.quantity()
        ));

        // 保留原材料批次
        registerSlots("MATERIAL_BATCH_RESERVE", Arrays.asList(
                RequiredSlot.batchId(),
                RequiredSlot.quantity(),
                RequiredSlot.builder()
                        .name("reserveReason")
                        .label("保留原因")
                        .type("TEXT")
                        .required(false)
                        .validationHint("可选：说明保留原因")
                        .priority(5)
                        .build()
        ));

        // ==================== 质检操作类意图 ====================

        // 执行质检
        registerSlots("QUALITY_CHECK_EXECUTE", Arrays.asList(
                RequiredSlot.batchId(),
                RequiredSlot.builder()
                        .name("checkItemId")
                        .label("检查项")
                        .type("TEXT")
                        .required(false)
                        .validationHint("可选：指定检查项ID")
                        .priority(3)
                        .build()
        ));

        // 记录质检结果
        registerSlots("QUALITY_CHECK_RECORD", Arrays.asList(
                RequiredSlot.batchId(),
                RequiredSlot.builder()
                        .name("result")
                        .label("检测结果")
                        .type("SELECT")
                        .options("[{\"value\":\"PASS\",\"label\":\"合格\"},{\"value\":\"FAIL\",\"label\":\"不合格\"},{\"value\":\"CONDITIONAL\",\"label\":\"有条件通过\"}]")
                        .required(true)
                        .validationHint("请选择检测结果：合格/不合格/有条件通过")
                        .priority(2)
                        .build(),
                RequiredSlot.builder()
                        .name("remarks")
                        .label("备注")
                        .type("TEXT")
                        .required(false)
                        .validationHint("可选：补充说明")
                        .priority(5)
                        .build()
        ));

        // ==================== 生产计划类意图 ====================

        // 创建生产计划
        registerSlots("PRODUCTION_PLAN_CREATE", Arrays.asList(
                RequiredSlot.builder()
                        .name("productId")
                        .label("产品")
                        .type("TEXT")
                        .required(true)
                        .validationHint("请提供要生产的产品ID或名称")
                        .priority(1)
                        .autoFillFromContext(true)
                        .entityType("PRODUCT")
                        .build(),
                RequiredSlot.quantity(),
                RequiredSlot.date("plannedStartDate", "计划开始日期")
        ));

        // 更新排程
        registerSlots("SCHEDULE_UPDATE", Arrays.asList(
                RequiredSlot.productionPlanId(),
                RequiredSlot.date("newDate", "新日期")
        ));

        // ==================== 数据查询类意图（通常无必需参数，但可能需要范围） ====================

        // 批次查询 - 无必需参数，但可以接受筛选条件
        registerSlots("MATERIAL_BATCH_QUERY", Collections.emptyList());

        // 即将过期批次查询
        registerSlots("BATCH_EXPIRY_WARNING", Arrays.asList(
                RequiredSlot.builder()
                        .name("warningDays")
                        .label("预警天数")
                        .type("INTEGER")
                        .required(false)
                        .defaultValue("7")
                        .validationHint("可选：预警天数，默认7天")
                        .priority(1)
                        .build()
        ));

        // 成本分析
        registerSlots("COST_ANALYSIS", Arrays.asList(
                RequiredSlot.date("startDate", "开始日期"),
                RequiredSlot.date("endDate", "结束日期")
        ));

        // ==================== 表单生成类意图 ====================

        // 生成表单
        registerSlots("FORM_GENERATION", Arrays.asList(
                RequiredSlot.builder()
                        .name("formType")
                        .label("表单类型")
                        .type("SELECT")
                        .options("[{\"value\":\"QUALITY_CHECK\",\"label\":\"质检单\"},{\"value\":\"RECEIVING\",\"label\":\"入库单\"},{\"value\":\"SHIPPING\",\"label\":\"出库单\"},{\"value\":\"INVENTORY\",\"label\":\"盘点单\"}]")
                        .required(true)
                        .validationHint("请选择要生成的表单类型")
                        .priority(1)
                        .build(),
                RequiredSlot.batchId()
        ));

        // ==================== 设备管理类意图 ====================

        // 设备状态更新
        registerSlots("EQUIPMENT_STATUS_UPDATE", Arrays.asList(
                RequiredSlot.builder()
                        .name("equipmentId")
                        .label("设备")
                        .type("TEXT")
                        .required(true)
                        .validationHint("请提供设备ID或名称")
                        .priority(1)
                        .autoFillFromContext(true)
                        .entityType("EQUIPMENT")
                        .build(),
                RequiredSlot.status("[{\"value\":\"RUNNING\",\"label\":\"运行中\"},{\"value\":\"IDLE\",\"label\":\"空闲\"},{\"value\":\"MAINTENANCE\",\"label\":\"维护中\"},{\"value\":\"FAULT\",\"label\":\"故障\"}]")
        ));

        // ==================== 删除/危险操作类意图 ====================

        // 删除批次
        registerSlots("BATCH_DELETE", Arrays.asList(
                RequiredSlot.batchId(),
                RequiredSlot.builder()
                        .name("confirmDelete")
                        .label("确认删除")
                        .type("BOOLEAN")
                        .required(true)
                        .validationHint("删除操作不可恢复，请确认是否删除（是/否）")
                        .priority(10)
                        .build()
        ));

        // 排程删除
        registerSlots("SCALE_DELETE", Arrays.asList(
                RequiredSlot.builder()
                        .name("scheduleId")
                        .label("排程ID")
                        .type("TEXT")
                        .required(true)
                        .validationHint("请提供要删除的排程ID")
                        .priority(1)
                        .build(),
                RequiredSlot.builder()
                        .name("confirmDelete")
                        .label("确认删除")
                        .type("BOOLEAN")
                        .required(true)
                        .validationHint("删除操作不可恢复，请确认是否删除（是/否）")
                        .priority(10)
                        .build()
        ));

        log.info("意图槽位配置初始化完成，共配置 {} 个意图", intentSlots.size());
    }

    /**
     * 注册意图的槽位配置
     *
     * @param intentCode 意图代码
     * @param slots 槽位列表
     */
    public void registerSlots(String intentCode, List<RequiredSlot> slots) {
        // 按优先级排序
        List<RequiredSlot> sortedSlots = new ArrayList<>(slots);
        sortedSlots.sort(Comparator.comparingInt(RequiredSlot::getPriority));
        intentSlots.put(intentCode, sortedSlots);
    }

    /**
     * 获取意图的必需槽位列表
     *
     * @param intentCode 意图代码
     * @return 槽位列表（如果未配置则返回空列表）
     */
    public List<RequiredSlot> getRequiredSlots(String intentCode) {
        return intentSlots.getOrDefault(intentCode, Collections.emptyList());
    }

    /**
     * 获取意图中必需（required=true）的槽位
     *
     * @param intentCode 意图代码
     * @return 必需槽位列表
     */
    public List<RequiredSlot> getMandatorySlots(String intentCode) {
        List<RequiredSlot> allSlots = getRequiredSlots(intentCode);
        List<RequiredSlot> mandatorySlots = new ArrayList<>();
        for (RequiredSlot slot : allSlots) {
            if (slot.isRequired()) {
                mandatorySlots.add(slot);
            }
        }
        return mandatorySlots;
    }

    /**
     * 检查意图是否有槽位配置
     *
     * @param intentCode 意图代码
     * @return true 如果有配置
     */
    public boolean hasSlotConfiguration(String intentCode) {
        return intentSlots.containsKey(intentCode) && !intentSlots.get(intentCode).isEmpty();
    }

    /**
     * 获取所有已配置的意图代码
     *
     * @return 意图代码集合
     */
    public Set<String> getConfiguredIntents() {
        return new HashSet<>(intentSlots.keySet());
    }

    /**
     * 动态添加或更新意图的槽位配置（运行时）
     *
     * @param intentCode 意图代码
     * @param slots 新的槽位列表
     */
    public void updateSlots(String intentCode, List<RequiredSlot> slots) {
        registerSlots(intentCode, slots);
        log.info("已更新意图 {} 的槽位配置，共 {} 个槽位", intentCode, slots.size());
    }
}
