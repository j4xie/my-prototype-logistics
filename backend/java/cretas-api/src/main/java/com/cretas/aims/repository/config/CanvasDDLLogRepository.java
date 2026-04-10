package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.CanvasDDLLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CanvasDDLLogRepository extends JpaRepository<CanvasDDLLog, String> {

    List<CanvasDDLLog> findByFactoryIdOrderByCreatedAtDesc(String factoryId);

    List<CanvasDDLLog> findByFactoryIdAndConfigVersion(String factoryId, Integer configVersion);
}
