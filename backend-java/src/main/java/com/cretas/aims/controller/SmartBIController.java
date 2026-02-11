package com.cretas.aims.controller;

/**
 * SmartBI Controller - Deprecated Facade
 *
 * AUDIT-085: All endpoints have been split into dedicated sub-controllers:
 * - {@link SmartBIUploadController} — Upload, batch sheet, retry, data preview, backfill
 * - {@link SmartBIDashboardController} — Dashboard, adaptive charts, dynamic analysis
 * - {@link SmartBIAnalysisController} — All domain analysis, NL query, drill-down, alerts, recommendations, schema management
 * - {@link SmartBIConfigController} — Configuration management (existing)
 *
 * AUDIT-086: Inner DTO classes have been extracted to com.cretas.aims.dto.smartbi package:
 * - TableDataResponse -> dto.smartbi.TableDataResponse
 * - BackfillResult -> dto.smartbi.BackfillResult
 * - BatchBackfillResult -> dto.smartbi.BatchBackfillResult
 * - UploadHistoryDTO -> dto.smartbi.UploadHistoryDTO
 * - ConfirmMappingRequest -> dto.smartbi.ConfirmMappingRequest
 *
 * This class is now empty and can be deleted in a future cleanup pass.
 *
 * @author Cretas Team
 * @since 2026-01-18
 * @deprecated Use the dedicated sub-controllers and DTO classes instead
 */
@Deprecated
public class SmartBIController {
    // All endpoints moved to SmartBIUploadController, SmartBIDashboardController, SmartBIAnalysisController.
    // All inner DTOs moved to com.cretas.aims.dto.smartbi package.
}
