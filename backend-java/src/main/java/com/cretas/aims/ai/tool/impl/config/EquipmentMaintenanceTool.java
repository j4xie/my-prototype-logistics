package com.cretas.aims.ai.tool.impl.config;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 设备维护工具
 *
 * 执行设备维护操作，包括创建维护任务、记录维护状态等。
 * 支持多种维护类型：例行保养、故障维修、校准等。
 *
 * Intent Code: EQUIPMENT_MAINTENANCE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class EquipmentMaintenanceTool extends AbstractBusinessTool {

    // TODO: 注入实际的设备维护服务
    // @Autowired
    // private EquipmentMaintenanceService equipmentMaintenanceService;

    @Override
    public String getToolName() {
        return "equipment_maintenance";
    }

    @Override
    public String getDescription() {
        return "创建或执行设备维护任务。支持例行保养、故障维修、校准、检验等多种维护类型。" +
                "适用场景：安排设备保养、记录设备维修、设备校准申请。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // equipmentId: 设备ID（必需）
        Map<String, Object> equipmentId = new HashMap<>();
        equipmentId.put("type", "string");
        equipmentId.put("description", "设备ID或设备编号");
        properties.put("equipmentId", equipmentId);

        // maintenanceType: 维护类型（必需）
        Map<String, Object> maintenanceType = new HashMap<>();
        maintenanceType.put("type", "string");
        maintenanceType.put("description", "维护类型");
        maintenanceType.put("enum", Arrays.asList(
                "ROUTINE",       // 例行保养
                "REPAIR",        // 故障维修
                "CALIBRATION",   // 校准
                "INSPECTION",    // 检验
                "UPGRADE",       // 升级
                "CLEANING"       // 清洁保养
        ));
        properties.put("maintenanceType", maintenanceType);

        // description: 维护描述（可选）
        Map<String, Object> description = new HashMap<>();
        description.put("type", "string");
        description.put("description", "维护任务描述");
        properties.put("description", description);

        // priority: 优先级（可选）
        Map<String, Object> priority = new HashMap<>();
        priority.put("type", "string");
        priority.put("description", "优先级");
        priority.put("enum", Arrays.asList("LOW", "MEDIUM", "HIGH", "URGENT"));
        priority.put("default", "MEDIUM");
        properties.put("priority", priority);

        // scheduledDate: 计划日期（可选）
        Map<String, Object> scheduledDate = new HashMap<>();
        scheduledDate.put("type", "string");
        scheduledDate.put("description", "计划执行日期，格式 YYYY-MM-DD");
        properties.put("scheduledDate", scheduledDate);

        // assignee: 负责人（可选）
        Map<String, Object> assignee = new HashMap<>();
        assignee.put("type", "string");
        assignee.put("description", "维护负责人ID或姓名");
        properties.put("assignee", assignee);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("equipmentId", "maintenanceType"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("equipmentId", "maintenanceType");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行设备维护操作 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 获取必需参数
        String equipmentId = getString(params, "equipmentId");
        String maintenanceType = getString(params, "maintenanceType");

        // 获取可选参数
        String description = getString(params, "description");
        String priority = getString(params, "priority", "MEDIUM");
        String scheduledDate = getString(params, "scheduledDate");
        String assignee = getString(params, "assignee");

        // 验证维护类型
        List<String> validTypes = Arrays.asList("ROUTINE", "REPAIR", "CALIBRATION", "INSPECTION", "UPGRADE", "CLEANING");
        if (!validTypes.contains(maintenanceType.toUpperCase())) {
            throw new IllegalArgumentException("无效的维护类型: " + maintenanceType);
        }

        LocalDateTime now = LocalDateTime.now();
        String createdTime = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        // TODO: 调用实际服务创建维护任务
        // MaintenanceTask task = equipmentMaintenanceService.createMaintenanceTask(
        //     factoryId, equipmentId, maintenanceType, description, priority, scheduledDate, assignee);

        // 占位实现：返回模拟结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("taskId", "MAINT_" + System.currentTimeMillis());
        result.put("equipmentId", equipmentId);
        result.put("maintenanceType", maintenanceType.toUpperCase());
        result.put("maintenanceTypeName", getMaintenanceTypeName(maintenanceType));
        result.put("status", "PENDING");
        result.put("priority", priority.toUpperCase());
        result.put("createdAt", createdTime);

        if (description != null) {
            result.put("description", description);
        }
        if (scheduledDate != null) {
            result.put("scheduledDate", scheduledDate);
        }
        if (assignee != null) {
            result.put("assignee", assignee);
        }

        result.put("message", "设备维护任务已创建：" + getMaintenanceTypeName(maintenanceType));
        result.put("notice", "请接入EquipmentMaintenanceService完成实际维护任务创建");

        log.info("设备维护任务创建完成 - 设备: {}, 类型: {}, 优先级: {}",
                equipmentId, maintenanceType, priority);

        return result;
    }

    /**
     * 获取维护类型的中文名称
     */
    private String getMaintenanceTypeName(String type) {
        Map<String, String> typeNames = Map.of(
            "ROUTINE", "例行保养",
            "REPAIR", "故障维修",
            "CALIBRATION", "校准",
            "INSPECTION", "检验",
            "UPGRADE", "升级",
            "CLEANING", "清洁保养"
        );
        return typeNames.getOrDefault(type.toUpperCase(), type);
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "equipmentId", "请问要维护哪台设备？请提供设备ID或设备编号。",
            "maintenanceType", "请问是什么类型的维护？（例行保养/故障维修/校准/检验/升级/清洁保养）"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "equipmentId", "设备ID",
            "maintenanceType", "维护类型",
            "description", "维护描述",
            "priority", "优先级",
            "scheduledDate", "计划日期",
            "assignee", "负责人"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
