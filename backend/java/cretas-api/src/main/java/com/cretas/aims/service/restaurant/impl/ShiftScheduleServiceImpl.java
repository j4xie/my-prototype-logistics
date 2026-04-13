package com.cretas.aims.service.restaurant.impl;

import com.cretas.aims.entity.restaurant.ShiftSchedule;
import com.cretas.aims.entity.restaurant.ShiftTemplate;
import com.cretas.aims.repository.restaurant.ShiftScheduleRepository;
import com.cretas.aims.repository.restaurant.ShiftTemplateRepository;
import com.cretas.aims.service.restaurant.ShiftScheduleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Slf4j @Service @RequiredArgsConstructor
public class ShiftScheduleServiceImpl implements ShiftScheduleService {
    private final ShiftTemplateRepository templateRepo;
    private final ShiftScheduleRepository scheduleRepo;

    @Override
    public ShiftTemplate createTemplate(String factoryId, String storeId, String name,
                                         String startTime, String endTime, String employeeType) {
        return templateRepo.save(ShiftTemplate.builder()
            .factoryId(factoryId).storeId(storeId).templateName(name)
            .startTime(startTime).endTime(endTime).employeeType(employeeType != null ? employeeType : "BOTH")
            .build());
    }

    @Override
    public List<ShiftTemplate> getTemplates(String factoryId, String storeId) {
        return storeId != null ? templateRepo.findByFactoryIdAndStoreIdAndIsActiveTrue(factoryId, storeId)
                               : templateRepo.findByFactoryIdAndIsActiveTrue(factoryId);
    }

    @Override
    public ShiftSchedule assignShift(String factoryId, String storeId, String employeeId,
                                      String employeeName, LocalDate date, String templateId,
                                      String employeeType, BigDecimal hourlyRate) {
        return scheduleRepo.save(ShiftSchedule.builder()
            .factoryId(factoryId).storeId(storeId).employeeId(employeeId)
            .employeeName(employeeName).shiftDate(date).shiftTemplateId(templateId)
            .employeeType(employeeType).hourlyRate(hourlyRate).build());
    }

    @Override
    public List<ShiftSchedule> getSchedule(String factoryId, String storeId, LocalDate start, LocalDate end) {
        return scheduleRepo.findByDateRange(factoryId, storeId, start, end);
    }

    @Override
    public Map<String, Object> getMonthlySummary(String factoryId, String storeId, LocalDate month) {
        LocalDate start = month.withDayOfMonth(1);
        LocalDate end = month.withDayOfMonth(month.lengthOfMonth());
        List<Object[]> rows = scheduleRepo.summarizeByEmployeeType(factoryId, storeId, start, end);

        Map<String, Object> summary = new HashMap<>();
        int totalShifts = 0; double totalHours = 0;
        List<Map<String, Object>> breakdown = new ArrayList<>();
        for (Object[] row : rows) {
            String type = (String) row[0];
            long count = (Long) row[1];
            double hours = row[2] != null ? ((Number) row[2]).doubleValue() : 0;
            totalShifts += count; totalHours += hours;
            breakdown.add(Map.of("employeeType", type, "shiftCount", count, "totalHours", hours));
        }
        summary.put("month", start.toString());
        summary.put("breakdown", breakdown);
        summary.put("totalShifts", totalShifts);
        summary.put("totalHours", totalHours);
        return summary;
    }

    @Override
    public Map<String, Object> checkMinHoursCompliance(String factoryId, String storeId,
                                                        LocalDate month, int minHours) {
        LocalDate start = month.withDayOfMonth(1);
        LocalDate end = month.withDayOfMonth(month.lengthOfMonth());
        List<ShiftSchedule> schedules = scheduleRepo.findByDateRange(factoryId, storeId, start, end);

        Map<String, Double> employeeHours = new HashMap<>();
        for (ShiftSchedule s : schedules) {
            if ("FULL_TIME".equals(s.getEmployeeType()) && s.getActualHours() != null) {
                employeeHours.merge(s.getEmployeeId(), s.getActualHours().doubleValue(), Double::sum);
            }
        }

        List<Map<String, Object>> violations = new ArrayList<>();
        for (Map.Entry<String, Double> e : employeeHours.entrySet()) {
            if (e.getValue() < minHours) {
                violations.add(Map.of("employeeId", e.getKey(), "actualHours", e.getValue(),
                    "minRequired", minHours, "shortfall", minHours - e.getValue()));
            }
        }
        return Map.of("compliant", violations.isEmpty(), "violations", violations,
                       "totalFullTimeEmployees", employeeHours.size());
    }
}
