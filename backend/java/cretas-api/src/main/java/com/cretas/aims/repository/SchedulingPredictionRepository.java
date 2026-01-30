package com.cretas.aims.repository;

import com.cretas.aims.entity.SchedulingPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AI 预测记录 Repository
 */
@Repository
public interface SchedulingPredictionRepository extends JpaRepository<SchedulingPrediction, String> {

    List<SchedulingPrediction> findByScheduleId(String scheduleId);

    Optional<SchedulingPrediction> findByScheduleIdAndPredictionType(
        String scheduleId, SchedulingPrediction.PredictionType predictionType);

    @Query("SELECT sp FROM SchedulingPrediction sp " +
           "WHERE sp.scheduleId = :scheduleId " +
           "ORDER BY sp.createdAt DESC")
    List<SchedulingPrediction> findLatestByScheduleId(@Param("scheduleId") String scheduleId);

    void deleteByScheduleId(String scheduleId);
}
