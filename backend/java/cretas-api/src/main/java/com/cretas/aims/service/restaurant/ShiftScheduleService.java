package com.cretas.aims.service.restaurant;

import com.cretas.aims.entity.restaurant.ShiftSchedule;
import com.cretas.aims.entity.restaurant.ShiftTemplate;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface ShiftScheduleService {
    ShiftTemplate createTemplate(String factoryId, String storeId, String name,
                                  String startTime, String endTime, String employeeType);
    List<ShiftTemplate> getTemplates(String factoryId, String storeId);

    ShiftSchedule assignShift(String factoryId, String storeId, String employeeId,
                               String employeeName, LocalDate date, String templateId,
                               String employeeType, java.math.BigDecimal hourlyRate);
    List<ShiftSchedule> getSchedule(String factoryId, String storeId, LocalDate start, LocalDate end);

    /** Monthly hours summary per employee type. */
    Map<String, Object> getMonthlySummary(String factoryId, String storeId, LocalDate month);

    /** Guaranteed minimum hours check for full-timers (160-180/month). */
    Map<String, Object> checkMinHoursCompliance(String factoryId, String storeId, LocalDate month, int minHours);
}
