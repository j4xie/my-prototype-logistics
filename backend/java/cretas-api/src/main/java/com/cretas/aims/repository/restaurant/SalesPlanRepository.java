package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.SalesPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface SalesPlanRepository extends JpaRepository<SalesPlan, String> {

    Optional<SalesPlan> findByFactoryIdAndStoreIdAndPlanMonth(
            String factoryId, String storeId, LocalDate planMonth);

    List<SalesPlan> findByFactoryIdAndPlanMonthAndIsActiveTrue(
            String factoryId, LocalDate planMonth);

    @Query("SELECT sp FROM SalesPlan sp WHERE sp.factoryId = :fid AND sp.planMonth = :month AND sp.isActive = true")
    List<SalesPlan> findActivePlans(@Param("fid") String factoryId, @Param("month") LocalDate planMonth);
}
