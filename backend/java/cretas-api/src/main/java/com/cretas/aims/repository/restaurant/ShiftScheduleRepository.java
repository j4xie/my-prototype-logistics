package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.ShiftSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ShiftScheduleRepository extends JpaRepository<ShiftSchedule, String> {
    List<ShiftSchedule> findByFactoryIdAndStoreIdAndShiftDate(String factoryId, String storeId, LocalDate date);

    @Query("SELECT ss FROM ShiftSchedule ss WHERE ss.factoryId = :fid AND ss.storeId = :sid " +
           "AND ss.shiftDate BETWEEN :start AND :end ORDER BY ss.shiftDate, ss.employeeName")
    List<ShiftSchedule> findByDateRange(@Param("fid") String factoryId, @Param("sid") String storeId,
                                         @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT ss.employeeType, COUNT(ss), SUM(ss.actualHours) FROM ShiftSchedule ss " +
           "WHERE ss.factoryId = :fid AND ss.storeId = :sid AND ss.shiftDate BETWEEN :start AND :end " +
           "AND ss.status = 'COMPLETED' GROUP BY ss.employeeType")
    List<Object[]> summarizeByEmployeeType(@Param("fid") String fid, @Param("sid") String sid,
                                            @Param("start") LocalDate start, @Param("end") LocalDate end);
}
