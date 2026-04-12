package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.PieceworkConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface PieceworkConfigRepository extends JpaRepository<PieceworkConfig, String> {
    List<PieceworkConfig> findByFactoryIdAndStoreIdAndEffectiveMonthAndIsActiveTrue(
        String factoryId, String storeId, LocalDate effectiveMonth);
    List<PieceworkConfig> findByFactoryIdAndStoreIdAndIsActiveTrue(String factoryId, String storeId);
}
