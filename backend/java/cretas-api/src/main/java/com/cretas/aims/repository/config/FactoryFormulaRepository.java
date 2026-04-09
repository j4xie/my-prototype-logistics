package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryFormula;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryFormulaRepository extends JpaRepository<FactoryFormula, Long> {
    Optional<FactoryFormula> findByFactoryIdAndModuleCodeAndFormulaCode(String factoryId, String moduleCode, String formulaCode);
    @Query("SELECT f FROM FactoryFormula f WHERE f.factoryId IS NULL AND f.moduleCode = :moduleCode AND f.formulaCode = :formulaCode")
    Optional<FactoryFormula> findGlobalFormula(@Param("moduleCode") String moduleCode, @Param("formulaCode") String formulaCode);
    List<FactoryFormula> findByFactoryIdAndModuleCode(String factoryId, String moduleCode);
}
