package com.cretas.aims.repository;

import com.cretas.aims.entity.ProcessCheckinRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProcessCheckinRecordRepository extends JpaRepository<ProcessCheckinRecord, Long> {

    List<ProcessCheckinRecord> findByFactoryIdAndEmployeeIdAndStatus(
            String factoryId, Long employeeId, String status);

    @Query("SELECT p FROM ProcessCheckinRecord p WHERE p.factoryId = :factoryId " +
           "AND p.checkInTime >= :startOfDay AND p.checkInTime < :endOfDay " +
           "ORDER BY p.checkInTime DESC")
    List<ProcessCheckinRecord> findTodayRecords(
            @Param("factoryId") String factoryId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay);

    @Query("SELECT p FROM ProcessCheckinRecord p WHERE p.factoryId = :factoryId " +
           "AND p.employeeId = :employeeId " +
           "AND p.checkInTime >= :startOfDay AND p.checkInTime < :endOfDay " +
           "ORDER BY p.checkInTime DESC")
    List<ProcessCheckinRecord> findTodayByEmployee(
            @Param("factoryId") String factoryId,
            @Param("employeeId") Long employeeId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay);

    Optional<ProcessCheckinRecord> findByIdAndFactoryId(Long id, String factoryId);
}
