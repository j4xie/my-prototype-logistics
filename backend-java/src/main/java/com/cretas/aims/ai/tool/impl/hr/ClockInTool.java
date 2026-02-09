package com.cretas.aims.ai.tool.impl.hr;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 签到打卡工具
 *
 * 执行签到打卡操作，记录当前用户的上班签到时间。
 * 作为操作类Tool，用户上下文从JWT获取，无需额外必需参数。
 *
 * Intent Code: CLOCK_IN
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ClockInTool extends AbstractBusinessTool {

    // TODO: 注入实际的打卡服务
    // @Autowired
    // private TimeclockService timeclockService;

    @Override
    public String getToolName() {
        return "clock_in";
    }

    @Override
    public String getDescription() {
        return "执行签到打卡。记录当前用户的上班签到时间，支持添加签到备注和位置信息。" +
                "适用场景：上班打卡、补签到。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // remark: 签到备注（可选）
        Map<String, Object> remark = new HashMap<>();
        remark.put("type", "string");
        remark.put("description", "签到备注，如外勤说明");
        properties.put("remark", remark);

        // location: 签到位置（可选）
        Map<String, Object> location = new HashMap<>();
        location.put("type", "string");
        location.put("description", "签到位置描述");
        properties.put("location", location);

        // latitude: 纬度（可选）
        Map<String, Object> latitude = new HashMap<>();
        latitude.put("type", "number");
        latitude.put("description", "签到位置纬度");
        properties.put("latitude", latitude);

        // longitude: 经度（可选）
        Map<String, Object> longitude = new HashMap<>();
        longitude.put("type", "number");
        longitude.put("description", "签到位置经度");
        properties.put("longitude", longitude);

        schema.put("properties", properties);
        // 签到操作无必需参数，用户信息从JWT获取
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        // 签到操作无必需参数，用户信息从context获取
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行签到打卡 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 从context获取当前用户信息
        Object contextUserId = context.get("userId");
        String userId = contextUserId != null ? String.valueOf(contextUserId) : null;
        Object contextUserName = context.get("userName");
        String userName = contextUserName != null ? String.valueOf(contextUserName) : null;

        if (userId == null || userId.trim().isEmpty()) {
            throw new IllegalArgumentException("无法获取用户信息，请重新登录");
        }

        // 获取可选参数
        String remark = getString(params, "remark");
        String location = getString(params, "location");
        Double latitude = params.get("latitude") != null ?
                ((Number) params.get("latitude")).doubleValue() : null;
        Double longitude = params.get("longitude") != null ?
                ((Number) params.get("longitude")).doubleValue() : null;

        LocalDateTime now = LocalDateTime.now();
        String clockInTime = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        // TODO: 调用实际服务执行签到
        // ClockInResult result = timeclockService.clockIn(factoryId, userId, remark, location, latitude, longitude);

        // 判断是否迟到（假设9:00为上班时间）
        boolean isLate = now.getHour() >= 9 && (now.getHour() > 9 || now.getMinute() > 0);

        // 占位实现：返回模拟结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("userId", userId);
        result.put("userName", userName != null ? userName : "当前用户");
        result.put("clockInTime", clockInTime);
        result.put("date", now.toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE));
        result.put("isLate", isLate);
        result.put("lateMinutes", isLate ? (now.getHour() - 9) * 60 + now.getMinute() : 0);

        if (remark != null) result.put("remark", remark);
        if (location != null) result.put("location", location);
        if (latitude != null && longitude != null) {
            Map<String, Double> coordinates = new HashMap<>();
            coordinates.put("latitude", latitude);
            coordinates.put("longitude", longitude);
            result.put("coordinates", coordinates);
        }

        result.put("message", isLate ?
                "签到成功，您今天迟到了" + result.get("lateMinutes") + "分钟" :
                "签到成功，祝您工作愉快！");
        result.put("notice", "请接入TimeclockService完成实际签到");

        log.info("签到打卡完成 - 用户: {}, 时间: {}, 是否迟到: {}", userId, clockInTime, isLate);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "remark", "请问需要添加签到备注吗？",
            "location", "请问需要记录签到位置吗？"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "remark", "签到备注",
            "location", "签到位置",
            "latitude", "纬度",
            "longitude", "经度"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
