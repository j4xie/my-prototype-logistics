package com.cretas.aims.ai.tool.impl.equipment;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.equipment.EquipmentAlertDTO;
import com.cretas.aims.service.EquipmentAlertsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 设备告警列表查询工具
 *
 * 提供设备告警的分页查询功能，支持按严重程度、状态、关键词等条件筛选。
 * 作为查询类Tool，无必需参数，所有参数均为可选。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
@Slf4j
@Component
public class EquipmentAlertListTool extends AbstractBusinessTool {

    @Autowired
    private EquipmentAlertsService equipmentAlertsService;

    @Override
    public String getToolName() {
        return "equipment_alert_list";
    }

    @Override
    public String getDescription() {
        return "查询设备告警列表。支持按严重程度(CRITICAL/WARNING/INFO)、状态(ACTIVE/ACKNOWLEDGED/RESOLVED/IGNORED)、" +
                "关键词进行筛选，支持分页。适用场景：查看设备告警、监控设备状态、排查设备问题。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // severity: 严重程度（可选）
        Map<String, Object> severity = new HashMap<>();
        severity.put("type", "string");
        severity.put("description", "告警严重程度筛选");
        severity.put("enum", Arrays.asList("CRITICAL", "WARNING", "INFO"));
        properties.put("severity", severity);

        // status: 告警状态（可选）
        Map<String, Object> status = new HashMap<>();
        status.put("type", "string");
        status.put("description", "告警状态筛选");
        status.put("enum", Arrays.asList("ACTIVE", "ACKNOWLEDGED", "RESOLVED", "IGNORED"));
        properties.put("status", status);

        // keyword: 关键词（可选）
        Map<String, Object> keyword = new HashMap<>();
        keyword.put("type", "string");
        keyword.put("description", "关键词，模糊搜索告警消息或设备名称");
        properties.put("keyword", keyword);

        // page: 页码（可选，默认1）
        Map<String, Object> page = new HashMap<>();
        page.put("type", "integer");
        page.put("description", "页码，从1开始");
        page.put("default", 1);
        page.put("minimum", 1);
        properties.put("page", page);

        // size: 每页数量（可选，默认10）
        Map<String, Object> size = new HashMap<>();
        size.put("type", "integer");
        size.put("description", "每页记录数");
        size.put("default", 10);
        size.put("minimum", 1);
        size.put("maximum", 100);
        properties.put("size", size);

        schema.put("properties", properties);
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行设备告警列表查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 解析分页参数
        Integer page = getInteger(params, "page", 1);
        Integer size = getInteger(params, "size", 10);

        // 解析筛选参数
        String severity = getString(params, "severity");
        String status = getString(params, "status");
        String keyword = getString(params, "keyword");

        // 构建分页请求
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);

        // 调用服务获取数据
        PageResponse<EquipmentAlertDTO> pageResponse = equipmentAlertsService.getAlertList(
                factoryId, pageRequest, keyword, severity, status);

        // 构建返回结果
        List<EquipmentAlertDTO> content = pageResponse.getContent();
        Map<String, Object> result = buildPageResult(
                content != null ? content : Collections.emptyList(),
                pageResponse.getTotalElements() != null ? pageResponse.getTotalElements() : 0L,
                pageResponse.getTotalPages() != null ? pageResponse.getTotalPages() : 0,
                page
        );

        // 添加查询条件摘要
        Map<String, Object> queryConditions = new HashMap<>();
        if (severity != null) queryConditions.put("severity", severity);
        if (status != null) queryConditions.put("status", status);
        if (keyword != null) queryConditions.put("keyword", keyword);
        result.put("queryConditions", queryConditions);

        log.info("设备告警列表查询完成 - 总记录数: {}, 当前页: {}",
                pageResponse.getTotalElements(), page);

        return result;
    }
}
