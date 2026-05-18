package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.EmployeeShiftAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeShiftAssignmentRepository
        extends JpaRepository<EmployeeShiftAssignment, String> {

    Optional<EmployeeShiftAssignment> findByFactoryIdAndUserIdAndWorkDate(
            String factoryId, Long userId, LocalDate workDate);

    List<EmployeeShiftAssignment> findByFactoryIdAndWorkDateBetween(
            String factoryId, LocalDate start, LocalDate end);

    List<EmployeeShiftAssignment> findByFactoryIdAndUserIdAndWorkDateBetween(
            String factoryId, Long userId, LocalDate start, LocalDate end);
}
