package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiBillingConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * SmartBI 计费配置 Repository
 *
 * <p>管理工厂的SmartBI计费配置，包括配额限制、计费规则等。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiBillingConfigRepository extends JpaRepository<SmartBiBillingConfig, Long> {

    /**
     * 根据工厂ID查询计费配置
     *
     * @param factoryId 工厂ID
     * @return 计费配置
     */
    Optional<SmartBiBillingConfig> findByFactoryId(String factoryId);
}
