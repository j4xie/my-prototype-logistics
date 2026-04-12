package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.StoreSeatConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface StoreSeatConfigRepository extends JpaRepository<StoreSeatConfig, String> {
    List<StoreSeatConfig> findByFactoryIdAndStoreIdAndIsActiveTrue(String factoryId, String storeId);
}
