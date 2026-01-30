package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.entity.smartbi.SmartBiDepartmentData;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import com.cretas.aims.repository.smartbi.postgres.SmartBiDynamicDataRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgExcelUploadRepository;
import com.cretas.aims.service.smartbi.UnifiedSmartBIDataService;
import com.cretas.aims.service.smartbi.util.DynamicDataParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Unified SmartBI Data Service Implementation
 *
 * Reads data from PostgreSQL JSONB storage (smart_bi_dynamic_data) and parses
 * it into typed entity objects using DynamicDataParser.
 *
 * This service provides a unified interface for all SmartBI analysis services
 * to access data without depending on MySQL fixed-schema repositories.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Slf4j
@Service
public class UnifiedSmartBIDataServiceImpl implements UnifiedSmartBIDataService {

    private final SmartBiDynamicDataRepository dynamicDataRepository;
    private final SmartBiPgExcelUploadRepository uploadRepository;

    @Autowired
    public UnifiedSmartBIDataServiceImpl(
            @Autowired(required = false) SmartBiDynamicDataRepository dynamicDataRepository,
            @Autowired(required = false) SmartBiPgExcelUploadRepository uploadRepository) {
        this.dynamicDataRepository = dynamicDataRepository;
        this.uploadRepository = uploadRepository;
    }

    @Override
    public boolean hasDynamicData(String factoryId) {
        if (dynamicDataRepository == null || uploadRepository == null) {
            return false;
        }

        try {
            Long uploadId = getLatestUploadId(factoryId);
            if (uploadId == null) {
                return false;
            }
            return dynamicDataRepository.countByUploadId(uploadId) > 0;
        } catch (Exception e) {
            log.warn("Error checking dynamic data existence for factory {}: {}", factoryId, e.getMessage());
            return false;
        }
    }

    @Override
    public Long getLatestUploadId(String factoryId) {
        if (uploadRepository == null) {
            return null;
        }

        try {
            Optional<SmartBiPgExcelUpload> latestUpload = uploadRepository.findFirstByFactoryIdOrderByCreatedAtDesc(factoryId);
            return latestUpload.map(SmartBiPgExcelUpload::getId).orElse(null);
        } catch (Exception e) {
            log.warn("Error getting latest upload ID for factory {}: {}", factoryId, e.getMessage());
            return null;
        }
    }

    @Override
    public List<SmartBiSalesData> getSalesData(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<SmartBiSalesData> allData = getAllSalesData(factoryId);

        if (allData.isEmpty() || startDate == null || endDate == null) {
            return allData;
        }

        // Filter by date range
        return allData.stream()
                .filter(d -> {
                    LocalDate orderDate = d.getOrderDate();
                    if (orderDate == null) {
                        return true; // Include records without date
                    }
                    return !orderDate.isBefore(startDate) && !orderDate.isAfter(endDate);
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<SmartBiFinanceData> getFinanceData(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<SmartBiFinanceData> allData = getAllFinanceData(factoryId);

        if (allData.isEmpty() || startDate == null || endDate == null) {
            return allData;
        }

        // Filter by date range
        return allData.stream()
                .filter(d -> {
                    LocalDate recordDate = d.getRecordDate();
                    if (recordDate == null) {
                        return true; // Include records without date
                    }
                    return !recordDate.isBefore(startDate) && !recordDate.isAfter(endDate);
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<SmartBiDepartmentData> getDepartmentData(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<SmartBiDepartmentData> allData = getAllDepartmentData(factoryId);

        if (allData.isEmpty() || startDate == null || endDate == null) {
            return allData;
        }

        // Filter by date range
        return allData.stream()
                .filter(d -> {
                    LocalDate recordDate = d.getRecordDate();
                    if (recordDate == null) {
                        return true; // Include records without date
                    }
                    return !recordDate.isBefore(startDate) && !recordDate.isAfter(endDate);
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<SmartBiSalesData> getAllSalesData(String factoryId) {
        List<SmartBiDynamicData> dynamicData = loadDynamicData(factoryId);
        if (dynamicData.isEmpty()) {
            return Collections.emptyList();
        }

        return dynamicData.stream()
                .map(DynamicDataParser::parseSalesData)
                .filter(Objects::nonNull)
                .filter(d -> d.getOrderDate() != null) // Must have a valid date
                .collect(Collectors.toList());
    }

    @Override
    public List<SmartBiFinanceData> getAllFinanceData(String factoryId) {
        List<SmartBiDynamicData> dynamicData = loadDynamicData(factoryId);
        if (dynamicData.isEmpty()) {
            return Collections.emptyList();
        }

        return dynamicData.stream()
                .map(DynamicDataParser::parseFinanceData)
                .filter(Objects::nonNull)
                .filter(d -> d.getRecordDate() != null) // Must have a valid date
                .collect(Collectors.toList());
    }

    @Override
    public List<SmartBiDepartmentData> getAllDepartmentData(String factoryId) {
        List<SmartBiDynamicData> dynamicData = loadDynamicData(factoryId);
        if (dynamicData.isEmpty()) {
            return Collections.emptyList();
        }

        return dynamicData.stream()
                .map(DynamicDataParser::parseDepartmentData)
                .filter(Objects::nonNull)
                .filter(d -> d.getDepartment() != null && !d.getDepartment().isEmpty())
                .collect(Collectors.toList());
    }

    /**
     * Load dynamic data from PostgreSQL
     */
    private List<SmartBiDynamicData> loadDynamicData(String factoryId) {
        if (dynamicDataRepository == null) {
            log.debug("Dynamic data repository not available");
            return Collections.emptyList();
        }

        try {
            Long uploadId = getLatestUploadId(factoryId);
            if (uploadId == null) {
                log.debug("No upload found for factory {}", factoryId);
                return Collections.emptyList();
            }

            List<SmartBiDynamicData> data = dynamicDataRepository.findByFactoryIdAndUploadId(factoryId, uploadId);
            log.debug("Loaded {} dynamic data rows for factory {} upload {}", data.size(), factoryId, uploadId);
            return data;
        } catch (Exception e) {
            log.warn("Error loading dynamic data for factory {}: {}", factoryId, e.getMessage());
            return Collections.emptyList();
        }
    }
}
