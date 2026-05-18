package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.AttendanceException;
import com.cretas.aims.entity.hr.enums.AttendanceExceptionStatus;
import com.cretas.aims.entity.hr.enums.AttendanceExceptionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceExceptionRepository
        extends JpaRepository<AttendanceException, String> {

    Optional<AttendanceException> findByIdAndFactoryId(String id, String factoryId);

    /**
     * R4 防呆: 同 user 同 date 同 type 唯一 (DB unique constraint 兜底).
     * Service 层在 detect 时先 check 这里, 避免 unique violation 异常.
     */
    Optional<AttendanceException> findByFactoryIdAndUserIdAndWorkDateAndExceptionType(
            String factoryId, Long userId, LocalDate workDate, AttendanceExceptionType type);

    /** HR 列表 — 全部, 按 status / date 过滤. */
    @Query("""
            SELECT e FROM AttendanceException e
            WHERE e.factoryId = :factoryId
              AND (CAST(:status AS string) IS NULL OR e.status = :status)
              AND (CAST(:startDate AS java.time.LocalDate) IS NULL OR e.workDate >= :startDate)
              AND (CAST(:endDate AS java.time.LocalDate) IS NULL OR e.workDate <= :endDate)
            """)
    Page<AttendanceException> search(
            @Param("factoryId") String factoryId,
            @Param("status") AttendanceExceptionStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    /** 待处理 (R5 防呆: empty state on 0 rows). */
    Page<AttendanceException> findByFactoryIdAndStatus(
            String factoryId, AttendanceExceptionStatus status, Pageable pageable);

    /** Detect 时获取已有月度异常 (用于幂等 check). */
    @Query("""
            SELECT e FROM AttendanceException e
            WHERE e.factoryId = :factoryId
              AND e.workDate >= :startDate
              AND e.workDate <= :endDate
            """)
    List<AttendanceException> findExistingInRange(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
