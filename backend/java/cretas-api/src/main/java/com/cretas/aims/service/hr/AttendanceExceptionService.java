package com.cretas.aims.service.hr;

import com.cretas.aims.entity.hr.AttendanceException;
import com.cretas.aims.entity.hr.enums.AttendanceExceptionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

/**
 * 考勤异常服务 (P1 #41 H-ATT-FULL MVP).
 *
 * @author Cretas Team
 * @since 2026-05-17
 */
public interface AttendanceExceptionService {

    /**
     * 扫描指定月份的打卡 vs 排班, 生成新增异常.
     *
     * <p>幂等: 同 (user, date, type) 已存在则 skip.
     *
     * @param factoryId 工厂
     * @param yearMonth 'YYYY-MM' 格式
     * @return 摘要: {scanned, created, skipped}
     */
    Map<String, Object> detectExceptions(String factoryId, String yearMonth);

    AttendanceException approve(String factoryId, Long processorId, String id, String notes);

    AttendanceException reject(String factoryId, Long processorId, String id, String notes);

    Optional<AttendanceException> getById(String factoryId, String id);

    /** 列表 — status / 日期范围过滤. */
    Page<AttendanceException> list(String factoryId,
                                   AttendanceExceptionStatus status,
                                   LocalDate startDate,
                                   LocalDate endDate,
                                   Pageable pageable);
}
