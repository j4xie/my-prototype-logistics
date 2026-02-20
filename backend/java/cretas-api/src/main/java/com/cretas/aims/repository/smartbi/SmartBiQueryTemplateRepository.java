package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiQueryTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SmartBiQueryTemplateRepository extends JpaRepository<SmartBiQueryTemplate, Long> {

    List<SmartBiQueryTemplate> findByFactoryIdOrderByCreatedAtDesc(String factoryId);
}
