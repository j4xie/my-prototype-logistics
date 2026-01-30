package com.cretas.aims.dto.ai;

import lombok.Getter;
import java.util.Arrays;
import java.util.List;

/**
 * 分析主题枚举
 *
 * 定义了系统支持的分析主题类型及其关联的工具。
 * 用于分析路由服务确定需要调用哪些工具获取数据。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Getter
public enum AnalysisTopic {

    /**
     * 产品状态分析 - 生产批次、质检结果
     */
    PRODUCT_STATUS("产品状态", Arrays.asList("PROCESSING_BATCH_LIST", "QC_RESULT_QUERY")),

    /**
     * 库存状态分析 - 原料批次、库存查询
     */
    INVENTORY_STATUS("库存状态", Arrays.asList("MATERIAL_BATCH_QUERY", "INVENTORY_QUERY")),

    /**
     * 出货状态分析 - 出货记录、订单查询
     */
    SHIPMENT_STATUS("出货状态", Arrays.asList("SHIPMENT_QUERY", "ORDER_QUERY")),

    /**
     * 质检分析 - 质检结果、质量指标
     */
    QUALITY_ANALYSIS("质检分析", Arrays.asList("QC_RESULT_QUERY", "QUALITY_STATS")),

    /**
     * 人员分析 - 考勤、排班
     */
    PERSONNEL_ANALYSIS("人员分析", Arrays.asList("ATTENDANCE_QUERY", "SCHEDULE_QUERY")),

    /**
     * 整体业务分析 - 综合报表
     */
    OVERALL_BUSINESS("整体业务", Arrays.asList("DAILY_REPORT", "WEEKLY_SUMMARY")),

    /**
     * 通用分析 - 无特定主题
     */
    GENERAL("通用分析", Arrays.asList());

    private final String displayName;
    private final List<String> relatedTools;

    AnalysisTopic(String displayName, List<String> relatedTools) {
        this.displayName = displayName;
        this.relatedTools = relatedTools;
    }
}
