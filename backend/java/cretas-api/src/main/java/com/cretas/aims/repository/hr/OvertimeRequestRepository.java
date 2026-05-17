package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.OvertimeRequest;
import com.cretas.aims.entity.hr.enums.CompensationType;
import com.cretas.aims.entity.hr.enums.HrRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OvertimeRequestRepository extends JpaRepository<OvertimeRequest, String> {

    Optional<OvertimeRequest> findByIdAndFactoryId(String id, String factoryId);

    Page<OvertimeRequest> findByFactoryIdAndUserId(String factoryId, Long userId, Pageable pageable);

    Page<OvertimeRequest> findByFactoryIdAndUserIdAndStatus(
            String factoryId, Long userId, HrRequestStatus status, Pageable pageable);

    Page<OvertimeRequest> findByFactoryIdAndStatus(
            String factoryId, HrRequestStatus status, Pageable pageable);

    Page<OvertimeRequest> findByFactoryId(String factoryId, Pageable pageable);

    /** 已批准 + 补偿方式 + 时间范围. */
    @Query("""
            SELECT r FROM OvertimeRequest r
            WHERE r.factoryId = :factoryId
              AND r.status = com.cretas.aims.entity.hr.enums.HrRequestStatus.APPROVED
              AND r.compensationType = :compensationType
              AND r.startTime >= :rangeStart
              AND r.startTime < :rangeEnd
            """)
    List<OvertimeRequest> findApprovedByCompTypeAndRange(
            @Param("factoryId") String factoryId,
            @Param("compensationType") CompensationType compensationType,
            @Param("rangeStart") LocalDateTime rangeStart,
            @Param("rangeEnd") LocalDateTime rangeEnd);

    /** 月度汇总: 补偿方式 → 总小时数. */
    @Query("""
            SELECT r.compensationType, SUM(r.hours)
            FROM OvertimeRequest r
            WHERE r.factoryId = :factoryId
              AND r.status = com.cretas.aims.entity.hr.enums.HrRequestStatus.APPROVED
              AND r.startTime >= :rangeStart
              AND r.startTime < :rangeEnd
            GROUP BY r.compensationType
            """)
    List<Object[]> sumApprovedHoursByCompTypeInRange(
            @Param("factoryId") String factoryId,
            @Param("rangeStart") LocalDateTime rangeStart,
            @Param("rangeEnd") LocalDateTime rangeEnd);
}
