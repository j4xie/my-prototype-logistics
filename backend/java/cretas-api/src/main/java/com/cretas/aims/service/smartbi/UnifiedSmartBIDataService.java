package com.cretas.aims.service.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiDepartmentData;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;

import java.time.LocalDate;
import java.util.List;

/**
 * Unified SmartBI Data Service
 *
 * Provides a unified interface for reading SmartBI data from PostgreSQL JSONB storage.
 * Replaces direct access to MySQL fixed-schema repositories with dynamic JSONB parsing.
 *
 * Benefits:
 * - Single source of truth (PostgreSQL smart_bi_dynamic_data table)
 * - Flexible schema support via JSONB
 * - Field alias mapping for various Excel column naming conventions
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
public interface UnifiedSmartBIDataService {

    /**
     * Check if dynamic data exists for the factory
     *
     * @param factoryId Factory ID
     * @return true if data exists
     */
    boolean hasDynamicData(String factoryId);

    /**
     * Get the latest upload ID for a factory
     *
     * @param factoryId Factory ID
     * @return Latest upload ID or null if none exists
     */
    Long getLatestUploadId(String factoryId);

    /**
     * Get sales data from dynamic JSONB storage
     * Parses JSONB row_data into SmartBiSalesData entities
     *
     * @param factoryId Factory ID
     * @param startDate Start date
     * @param endDate End date
     * @return List of parsed sales data entities
     */
    List<SmartBiSalesData> getSalesData(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * Get finance data from dynamic JSONB storage
     * Parses JSONB row_data into SmartBiFinanceData entities
     *
     * @param factoryId Factory ID
     * @param startDate Start date
     * @param endDate End date
     * @return List of parsed finance data entities
     */
    List<SmartBiFinanceData> getFinanceData(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * Get department data from dynamic JSONB storage
     * Parses JSONB row_data into SmartBiDepartmentData entities
     *
     * @param factoryId Factory ID
     * @param startDate Start date
     * @param endDate End date
     * @return List of parsed department data entities
     */
    List<SmartBiDepartmentData> getDepartmentData(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * Get all sales data for a factory (no date filter)
     *
     * @param factoryId Factory ID
     * @return List of all sales data
     */
    List<SmartBiSalesData> getAllSalesData(String factoryId);

    /**
     * Get all finance data for a factory (no date filter)
     *
     * @param factoryId Factory ID
     * @return List of all finance data
     */
    List<SmartBiFinanceData> getAllFinanceData(String factoryId);

    /**
     * Get all department data for a factory (no date filter)
     *
     * @param factoryId Factory ID
     * @return List of all department data
     */
    List<SmartBiDepartmentData> getAllDepartmentData(String factoryId);
}
