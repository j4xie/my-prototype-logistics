package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.PriceList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface PriceListRepository extends JpaRepository<PriceList, String> {

    Page<PriceList> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    /** 查询当前生效的价格表 */
    @Query("SELECT p FROM PriceList p WHERE p.factoryId = :factoryId " +
            "AND p.isActive = true AND p.effectiveFrom <= :date " +
            "AND (p.effectiveTo IS NULL OR p.effectiveTo >= :date)")
    List<PriceList> findEffective(@Param("factoryId") String factoryId, @Param("date") LocalDate date);

    List<PriceList> findByFactoryIdAndPriceType(String factoryId, String priceType);
}
