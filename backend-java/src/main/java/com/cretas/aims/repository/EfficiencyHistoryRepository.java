package com.cretas.aims.repository;

import com.cretas.aims.entity.EfficiencyHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 效率历史记录 Repository
 */
@Repository
public interface EfficiencyHistoryRepository extends JpaRepository<EfficiencyHistory, String> {

    List<EfficiencyHistory> findByLineIdAndRecordedAtAfterOrderByRecordedAtDesc(String lineId, LocalDateTime after);

    List<EfficiencyHistory> findByTaskIdOrderByRecordedAtDesc(String taskId);

    void deleteByRecordedAtBefore(LocalDateTime before);
}
