package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.ShiftTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ShiftTemplateRepository extends JpaRepository<ShiftTemplate, String> {
    List<ShiftTemplate> findByFactoryIdAndStoreIdAndIsActiveTrue(String factoryId, String storeId);
    List<ShiftTemplate> findByFactoryIdAndIsActiveTrue(String factoryId);
}
