package com.cretas.aims.ai.tool.impl.hr;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 考勤统计工具
 *
 * 获取考勤统计数据，包括出勤率、平均工作时长、迟到率等指标。
 * 作为查询类Tool，无必需参数。
 *
 * Intent Code: ATTENDANCE_STATS
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class AttendanceStatsTool extends AbstractBusinessTool {

    // TODO: 注入实际的考勤服务
    // @Autowired
    // private AttendanceService attendanceService;

    @Override
    public String getToolName() {
        return "attendance_stats";
    }

    @Override
    public String getDescription() {
        return "获取考勤统计数据。查看出勤率、迟到率、平均工作时长等关键指标，支持按用户、部门、时间段统计。" +
                "适用场景：查看整体考勤情况、生成考勤报表、分析出勤趋势。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // userId: 用户ID（可选）
        Map<String, Object> userId = new HashMap<>();
        userId.put("type", "string");
        userId.put("description", "用户ID，不传则统计全体员工");
        properties.put("userId", userId);

        // departmentId: 部门ID（可选）
        Map<String, Object> departmentId = new HashMap<>();
        departmentId.put("type", "string");
        departmentId.put("description", "部门ID，不传则统计全部部门");
        properties.put("departmentId", departmentId);

        // period: 统计周期（可选）
        Map<String, Object> period = new HashMap<>();
        period.put("type", "string");
        period.put("description", "统计周期");
        period.put("enum", Arrays.asList(
                "TODAY",      // 今日
                "WEEK",       // 本周
                "MONTH",      // 本月
                "QUARTER",    // 本季度
                "YEAR",       // 本年
                "CUSTOM"      // 自定义（需指定startDate和endDate）
        ));
        period.put("default", "MONTH");
        properties.put("period", period);

        // startDate: 开始日期（可选，period为CUSTOM时使用）
        Map<String, Object> startDate = new HashMap<>();
        startDate.put("type", "string");
        startDate.put("description", "开始日期，格式：YYYY-MM-DD");
        startDate.put("format", "date");
        properties.put("startDate", startDate);

        // endDate: 结束日期（可选，period为CUSTOM时使用）
        Map<String, Object> endDate = new HashMap<>();
        endDate.put("type", "string");
        endDate.put("description", "结束日期，格式：YYYY-MM-DD");
        endDate.put("format", "date");
        properties.put("endDate", endDate);

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
        log.info("执行考勤统计查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 解析参数
        String userId = getString(params, "userId");
        String departmentId = getString(params, "departmentId");
        String period = getString(params, "period", "MONTH");
        String startDate = getString(params, "startDate");
        String endDate = getString(params, "endDate");

        // 根据period计算日期范围
        LocalDate now = LocalDate.now();
        if (!"CUSTOM".equals(period)) {
            DateRange range = calculateDateRange(period, now);
            startDate = range.start.format(DateTimeFormatter.ISO_LOCAL_DATE);
            endDate = range.end.format(DateTimeFormatter.ISO_LOCAL_DATE);
        }

        // TODO: 调用实际服务获取数据
        // AttendanceStatistics stats = attendanceService.getStatistics(
        //     factoryId, userId, departmentId, startDate, endDate);

        // 占位实现：返回模拟数据结构
        Map<String, Object> result = new HashMap<>();
        result.put("period", period);
        result.put("startDate", startDate);
        result.put("endDate", endDate);
        if (userId != null) result.put("userId", userId);
        if (departmentId != null) result.put("departmentId", departmentId);

        // 核心统计指标
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("totalEmployees", 0);
        metrics.put("workingDays", 0);
        metrics.put("attendanceRate", 0.0);      // 出勤率
        metrics.put("lateRate", 0.0);            // 迟到率
        metrics.put("earlyLeaveRate", 0.0);      // 早退率
        metrics.put("absentRate", 0.0);          // 缺勤率
        metrics.put("averageWorkHours", 0.0);    // 平均工作时长
        metrics.put("totalOvertimeHours", 0.0);  // 总加班时长
        result.put("metrics", metrics);

        // 趋势数据（按日/周汇总）
        result.put("trends", Collections.emptyList());

        // 部门排名（如果未指定部门）
        if (departmentId == null) {
            result.put("departmentRanking", Collections.emptyList());
        }

        result.put("message", "请接入AttendanceService获取实际考勤统计数据");

        log.info("考勤统计查询完成 - 周期: {}, 日期范围: {} ~ {}", period, startDate, endDate);

        return result;
    }

    /**
     * 根据统计周期计算日期范围
     */
    private DateRange calculateDateRange(String period, LocalDate now) {
        LocalDate start;
        LocalDate end = now;

        switch (period) {
            case "TODAY":
                start = now;
                break;
            case "WEEK":
                start = now.minusDays(now.getDayOfWeek().getValue() - 1);
                break;
            case "MONTH":
                start = now.withDayOfMonth(1);
                break;
            case "QUARTER":
                int currentQuarter = (now.getMonthValue() - 1) / 3;
                start = now.withMonth(currentQuarter * 3 + 1).withDayOfMonth(1);
                break;
            case "YEAR":
                start = now.withDayOfYear(1);
                break;
            default:
                start = now.withDayOfMonth(1);
        }

        return new DateRange(start, end);
    }

    private static class DateRange {
        final LocalDate start;
        final LocalDate end;

        DateRange(LocalDate start, LocalDate end) {
            this.start = start;
            this.end = end;
        }
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "userId", "请问您要查看哪位员工的考勤统计？",
            "departmentId", "请问查看哪个部门的考勤统计？",
            "period", "请问查看哪个时间段的统计？（今日/本周/本月/本季度/本年）",
            "startDate", "请问从哪一天开始统计？",
            "endDate", "请问统计到哪一天为止？"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "userId", "用户ID",
            "departmentId", "部门ID",
            "period", "统计周期",
            "startDate", "开始日期",
            "endDate", "结束日期"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
