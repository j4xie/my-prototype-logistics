package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryTemplateRepository extends JpaRepository<FactoryTemplate, Long> {
    Optional<FactoryTemplate> findByTemplateCode(String templateCode);
    List<FactoryTemplate> findByIsActiveTrue();
}
