package com.cretas.aims.ai.tool.impl.hr;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 月度考勤报表工具
 *
 * 查询指定用户的月度考勤汇总报表，包括出勤天数、迟到次数、早退次数等统计。
 * 作为查询类Tool，无必需参数。
 *
 * Intent Code: ATTENDANCE_MONTHLY
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class AttendanceMonthlyTool extends AbstractBusinessTool {

    // TODO: 注入实际的考勤服务
    // @Autowired
    // private AttendanceService attendanceService;

    @Override
    public String getToolName() {
        return "attendance_monthly";
    }

    @Override
    public String getDescription() {
        return "查询月度考勤报表。获取指定用户某月的考勤统计汇总，包括出勤天数、迟到早退次数、缺勤天数、加班时长等。" +
                "适用场景：查看本月考勤汇总、查看某人某月出勤情况。";
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

        // year: 年份（可选，默认当年）
        Map<String, Object> year = new HashMap<>();
        year.put("type", "integer");
        year.put("description", "年份，如2026");
        year.put("minimum", 2020);
        year.put("maximum", 2099);
        properties.put("year", year);

        // month: 月份（可选，默认当月）
        Map<String, Object> month = new HashMap<>();
        month.put("type", "integer");
        month.put("description", "月份，1-12");
        month.put("minimum", 1);
        month.put("maximum", 12);
        properties.put("month", month);

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
        // 考勤服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "考勤服务尚未接入，请联系管理员配置 TimeclockService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }

    /**
     * 计算指定月份的工作日数（简单估算，不考虑节假日）
     */
    private int calculateWorkingDays(YearMonth yearMonth) {
        int workingDays = 0;
        LocalDate start = yearMonth.atDay(1);
        LocalDate end = yearMonth.atEndOfMonth();

        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            int dayOfWeek = date.getDayOfWeek().getValue();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) { // 周一到周五
                workingDays++;
            }
        }
        return workingDays;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "userId", "请问您要查询哪位员工的月度考勤？",
            "year", "请问查询哪一年的考勤？",
            "month", "请问查询哪个月份的考勤？"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "userId", "用户ID",
            "year", "年份",
            "month", "月份"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
