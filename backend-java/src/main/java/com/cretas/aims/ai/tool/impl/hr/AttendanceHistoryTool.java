package com.cretas.aims.ai.tool.impl.hr;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 考勤历史查询工具
 *
 * 查询指定用户的历史考勤记录，支持日期范围筛选和分页。
 * 作为查询类Tool，无必需参数。
 *
 * Intent Code: ATTENDANCE_HISTORY
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class AttendanceHistoryTool extends AbstractBusinessTool {

    // TODO: 注入实际的考勤服务
    // @Autowired
    // private AttendanceService attendanceService;

    @Override
    public String getToolName() {
        return "attendance_history";
    }

    @Override
    public String getDescription() {
        return "查询考勤历史记录。获取指定用户在一段时间内的考勤详情，支持分页。" +
                "适用场景：查看过去一周/一个月的考勤、查看某人的考勤记录。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // userId: 用户ID（可选，默认当前用户）
        Map<String, Object> userId = new HashMap<>();
        userId.put("type", "string");
        userId.put("description", "用户ID，不传则查询当前登录用户");
        properties.put("userId", userId);

        // startDate: 开始日期（可选）
        Map<String, Object> startDate = new HashMap<>();
        startDate.put("type", "string");
        startDate.put("description", "开始日期，格式：YYYY-MM-DD");
        startDate.put("format", "date");
        properties.put("startDate", startDate);

        // endDate: 结束日期（可选）
        Map<String, Object> endDate = new HashMap<>();
        endDate.put("type", "string");
        endDate.put("description", "结束日期，格式：YYYY-MM-DD");
        endDate.put("format", "date");
        properties.put("endDate", endDate);

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
        log.info("执行考勤历史查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 获取用户ID
        String userId = getString(params, "userId");
        if (userId == null || userId.trim().isEmpty()) {
            Object contextUserId = context.get("userId");
            if (contextUserId != null) {
                userId = String.valueOf(contextUserId);
            }
        }

        // 获取日期范围（默认最近30天）
        String startDate = getString(params, "startDate");
        String endDate = getString(params, "endDate");
        if (endDate == null || endDate.trim().isEmpty()) {
            endDate = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        }
        if (startDate == null || startDate.trim().isEmpty()) {
            startDate = LocalDate.now().minusDays(30).format(DateTimeFormatter.ISO_LOCAL_DATE);
        }

        // 分页参数
        Integer page = getInteger(params, "page", 1);
        Integer size = getInteger(params, "size", 10);

        // TODO: 调用实际服务获取数据
        // Page<AttendanceRecord> records = attendanceService.getAttendanceHistory(
        //     factoryId, userId, startDate, endDate, page, size);

        // 占位实现：返回模拟数据结构
        List<Map<String, Object>> records = new ArrayList<>();
        // 模拟空记录列表

        Map<String, Object> result = buildPageResult(records, 0L, 0, page);
        result.put("userId", userId);
        result.put("startDate", startDate);
        result.put("endDate", endDate);
        result.put("message", "请接入AttendanceService获取实际考勤历史");

        log.info("考勤历史查询完成 - 用户: {}, 日期范围: {} ~ {}", userId, startDate, endDate);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "userId", "请问您要查询哪位员工的考勤历史？",
            "startDate", "请问从哪一天开始查询？",
            "endDate", "请问查询到哪一天为止？"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "userId", "用户ID",
            "startDate", "开始日期",
            "endDate", "结束日期",
            "page", "页码",
            "size", "每页数量"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
