package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.AttendanceShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceShiftRepository extends JpaRepository<AttendanceShift, String> {

    Optional<AttendanceShift> findByIdAndFactoryId(String id, String factoryId);

    Optional<AttendanceShift> findByFactoryIdAndShiftCode(String factoryId, String shiftCode);

    List<AttendanceShift> findByFactoryIdAndIsActiveTrue(String factoryId);

    List<AttendanceShift> findByFactoryId(String factoryId);
}
