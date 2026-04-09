package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactorySchedulerConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface FactorySchedulerConfigRepository extends JpaRepository<FactorySchedulerConfig, Long> {
    List<FactorySchedulerConfig> findByEnabledTrue();
    Optional<FactorySchedulerConfig> findByFactoryIdAndTaskCode(String factoryId, String taskCode);
    List<FactorySchedulerConfig> findByFactoryId(String factoryId);
}
