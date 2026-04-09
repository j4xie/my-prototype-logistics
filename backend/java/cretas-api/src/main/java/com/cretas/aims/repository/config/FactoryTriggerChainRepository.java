package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryTriggerChain;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryTriggerChainRepository extends JpaRepository<FactoryTriggerChain, Long> {
    List<FactoryTriggerChain> findByFactoryIdAndEventTypeAndEnabledTrue(String factoryId, String eventType);

    @Query("SELECT c FROM FactoryTriggerChain c WHERE c.factoryId IS NULL AND c.eventType = :eventType AND c.enabled = true")
    List<FactoryTriggerChain> findGlobalByEventType(@Param("eventType") String eventType);

    List<FactoryTriggerChain> findByFactoryId(String factoryId);
    Optional<FactoryTriggerChain> findByFactoryIdAndChainCode(String factoryId, String chainCode);
}
