package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.ComboItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ComboItemRepository extends JpaRepository<ComboItem, Long> {

    List<ComboItem> findByComboProductIdOrderBySortOrderAsc(String comboProductId);

    List<ComboItem> findByFactoryIdAndComboProductId(String factoryId, String comboProductId);

    List<ComboItem> findByChildProductId(String childProductId);

    void deleteByComboProductId(String comboProductId);
}
