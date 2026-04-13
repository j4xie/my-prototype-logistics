package com.cretas.aims.repository.workreport;

import com.cretas.aims.entity.workreport.EmployeeProcessSegment;
import com.cretas.aims.entity.workreport.EmployeeProcessSegment.SegmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * P1-1 员工工序片段 Repository.
 */
@Repository
public interface EmployeeProcessSegmentRepository
        extends JpaRepository<EmployeeProcessSegment, String> {

    /** 查某员工的所有 ACTIVE 片段 (应 <= 1). */
    List<EmployeeProcessSegment> findByFactoryIdAndEmployeeIdAndStatusAndDeletedAtIsNull(
            String factoryId, Long employeeId, SegmentStatus status);

    Optional<EmployeeProcessSegment> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);

    /** 查某员工在时间范围内的所有 segment (按 startAt 升序). */
    List<EmployeeProcessSegment> findByFactoryIdAndEmployeeIdAndStartAtBetweenAndDeletedAtIsNullOrderByStartAtAsc(
            String factoryId, Long employeeId, LocalDateTime start, LocalDateTime end);

    /** 查所有 ACTIVE 的 segment (用于每天 20:00 扫描仍在线员工). */
    List<EmployeeProcessSegment> findByFactoryIdAndStatusAndDeletedAtIsNull(
            String factoryId, SegmentStatus status);
}
