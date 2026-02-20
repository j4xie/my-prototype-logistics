package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.smartbi.*;
import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.service.smartbi.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgExcelUploadRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.validation.Valid;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * SmartBI Upload Controller
 *
 * Handles all Excel upload, batch processing, retry, data preview, and backfill endpoints.
 * AUDIT-085: Extracted from SmartBIController to reduce file size.
 *
 * @author Cretas Team
 * @since 2026-02-11
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/smart-bi")
@Tag(name = "SmartBI Upload", description = "SmartBI Excel upload and data management API")
public class SmartBIUploadController {

    private final ExcelDynamicParserService excelParserService;
    private final SmartBIUploadFlowService uploadFlowService;
    private final PythonSmartBIClient pythonClient;
    private final PythonSmartBIConfig pythonConfig;
    private final ObjectMapper objectMapper;
    private final DynamicAnalysisService dynamicAnalysisService;
    private final SmartBiPgExcelUploadRepository pgUploadRepository;

    @Autowired
    public SmartBIUploadController(
            ExcelDynamicParserService excelParserService,
            @Autowired(required = false) SmartBIUploadFlowService uploadFlowService,
            PythonSmartBIClient pythonClient,
            PythonSmartBIConfig pythonConfig,
            ObjectMapper objectMapper,
            @Autowired(required = false) DynamicAnalysisService dynamicAnalysisService,
            @Autowired(required = false) SmartBiPgExcelUploadRepository pgUploadRepository) {
        this.excelParserService = excelParserService;
        this.uploadFlowService = uploadFlowService;
        this.pythonClient = pythonClient;
        this.pythonConfig = pythonConfig;
        this.objectMapper = objectMapper;
        this.dynamicAnalysisService = dynamicAnalysisService;
        this.pgUploadRepository = pgUploadRepository;
    }

    // ==================== Excel Upload ====================

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload Excel file", description = "Upload and parse Excel file using Python SmartBI service")
    public ResponseEntity<ApiResponse<ExcelParseResponse>> uploadExcel(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Excel file") @RequestParam("file") MultipartFile file,
            @Parameter(description = "Data type: sales/finance/inventory") @RequestParam(required = false) String dataType,
            @Parameter(description = "Sheet index (0-based)") @RequestParam(required = false, defaultValue = "0") Integer sheetIndex,
            @Parameter(description = "Header row (0-based)") @RequestParam(required = false, defaultValue = "0") Integer headerRow,
            @Parameter(description = "Transpose data") @RequestParam(required = false, defaultValue = "false") Boolean transpose,
            @Parameter(description = "Row label column index for transpose") @RequestParam(required = false, defaultValue = "0") Integer rowLabelColumn,
            @Parameter(description = "Header row count for transpose") @RequestParam(required = false, defaultValue = "1") Integer headerRowCount) {

        log.info("Upload Excel: factoryId={}, fileName={}, dataType={}, sheetIndex={}, headerRow={}, transpose={}",
                factoryId, file.getOriginalFilename(), dataType, sheetIndex, headerRow, transpose);

        if (!pythonConfig.isEnabled()) {
            return ResponseEntity.ok(ApiResponse.error("Python SmartBI service not enabled"));
        }
        if (!pythonClient.isAvailable()) {
            return ResponseEntity.ok(ApiResponse.error("Python SmartBI service unavailable at " + pythonConfig.getUrl()));
        }

        try {
            int headerRows;
            if (headerRow == null || headerRow < 0) {
                headerRows = 0;
                log.debug("Using Python auto-detect for header rows");
            } else {
                headerRows = headerRow + 1;
            }
            ExcelParseResponse response = pythonClient.parseExcel(file, factoryId, dataType, sheetIndex, headerRows);

            if (response == null || !response.isSuccess()) {
                String errorMsg = response != null ? response.getErrorMessage() : "Python service returned null";
                return ResponseEntity.ok(ApiResponse.error("Excel parse failed: " + errorMsg));
            }

            return ResponseEntity.ok(ApiResponse.success("Excel parsed successfully", response));
        } catch (IOException e) {
            log.error("Excel file read failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("File read failed: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Excel parse error: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Parse failed: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/upload-and-analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload and analyze", description = "Upload Excel, auto-parse, save data and generate chart analysis")
    public ResponseEntity<ApiResponse<?>> uploadAndAnalyze(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Excel file") @RequestParam("file") MultipartFile file,
            @Parameter(description = "Data type") @RequestParam(required = false) String dataType,
            @Parameter(description = "Sheet index") @RequestParam(required = false, defaultValue = "0") Integer sheetIndex,
            @Parameter(description = "Header row") @RequestParam(required = false, defaultValue = "0") Integer headerRow,
            @Parameter(description = "Auto confirm field mappings") @RequestParam(name = "auto_confirm", required = false, defaultValue = "false") Boolean autoConfirm,
            @Parameter(description = "Transpose data") @RequestParam(required = false, defaultValue = "false") Boolean transpose,
            @Parameter(description = "Row label column index") @RequestParam(required = false, defaultValue = "0") Integer rowLabelColumn,
            @Parameter(description = "Header row count") @RequestParam(required = false, defaultValue = "1") Integer headerRowCount) {

        log.info("Upload and analyze: factoryId={}, fileName={}, dataType={}, autoConfirm={}",
                factoryId, file.getOriginalFilename(), dataType, autoConfirm);

        if (uploadFlowService == null) {
            return ResponseEntity.ok(ApiResponse.error("SmartBI upload flow service not configured"));
        }
        if (!pythonConfig.isEnabled() || !pythonClient.isAvailable()) {
            return ResponseEntity.ok(ApiResponse.error("Python SmartBI service unavailable at " + pythonConfig.getUrl()));
        }

        try {
            SmartBIUploadFlowService.UploadFlowResult result = uploadFlowService.executeUploadFlow(
                    factoryId, file, dataType, sheetIndex, headerRow, Boolean.TRUE.equals(autoConfirm));
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success(result.getMessage(), result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("Upload and analyze failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Upload and analyze failed: " + e.getMessage()));
        }
    }

    @PostMapping("/upload/confirm")
    @Operation(summary = "Confirm field mappings", description = "Confirm field mappings, save data and generate chart")
    public ResponseEntity<ApiResponse<?>> confirmMappingsAndSave(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @RequestBody @Valid ConfirmMappingRequest request) {

        log.info("Confirm field mappings: factoryId={}, dataType={}, mappings={}",
                factoryId, request.getDataType(),
                request.getConfirmedMappings() != null ? request.getConfirmedMappings().size() : 0);

        if (uploadFlowService == null) {
            return ResponseEntity.ok(ApiResponse.error("Upload flow service not configured"));
        }

        try {
            List<FieldMappingResult> mappings = new java.util.ArrayList<>();
            if (request.getConfirmedMappings() != null) {
                request.getConfirmedMappings().forEach((original, standard) -> {
                    FieldMappingResult mapping = new FieldMappingResult();
                    mapping.setOriginalColumn(original);
                    mapping.setStandardField(standard);
                    mapping.setConfidence(100.0);
                    mappings.add(mapping);
                });
            }

            SmartBIUploadFlowService.UploadFlowResult result = uploadFlowService.confirmAndPersist(
                    factoryId, request.getParseResponse(), mappings, request.getDataType());
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success(result.getMessage(), result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("Confirm and save failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Save failed: " + e.getMessage()));
        }
    }

    // ==================== Batch Sheet Processing ====================

    @PostMapping(value = "/sheets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "List sheets", description = "Preview all sheets in the Excel file")
    public ResponseEntity<ApiResponse<List<SheetInfo>>> listSheets(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Excel file") @RequestParam("file") MultipartFile file) {

        log.info("List sheets: factoryId={}, fileName={}", factoryId, file.getOriginalFilename());

        try {
            List<SheetInfo> sheets = excelParserService.listSheets(file.getInputStream());
            return ResponseEntity.ok(ApiResponse.success("Success", sheets));
        } catch (IOException e) {
            log.error("File read failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("File read failed: " + e.getMessage()));
        } catch (Exception e) {
            log.error("List sheets failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Failed: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/upload-batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Batch upload sheets", description = "Upload and process multiple sheets from Excel file")
    public ResponseEntity<ApiResponse<BatchUploadResult>> uploadBatch(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Excel file") @RequestParam("file") MultipartFile file,
            @Parameter(description = "Sheet configs JSON array") @RequestParam("sheetConfigs") String sheetConfigsJson) {

        log.info("Batch upload: factoryId={}, fileName={}", factoryId, file.getOriginalFilename());

        if (uploadFlowService == null) {
            return ResponseEntity.ok(ApiResponse.error("Batch upload service not available"));
        }

        try {
            List<SheetConfig> configs = objectMapper.readValue(sheetConfigsJson,
                    new TypeReference<List<SheetConfig>>() {});

            if (configs == null || configs.isEmpty()) {
                return ResponseEntity.ok(ApiResponse.error("sheetConfigs cannot be empty"));
            }

            BatchUploadResult result = uploadFlowService.executeBatchUpload(
                    factoryId, file.getInputStream(), file.getOriginalFilename(), configs);

            String statusPrefix;
            if (result.isAllSuccess()) {
                statusPrefix = "";
            } else if (result.getRequiresConfirmationCount() > 0) {
                statusPrefix = "Pending confirmation: ";
            } else if (result.isPartialSuccess()) {
                statusPrefix = "Partial success: ";
            } else {
                statusPrefix = "Failed: ";
            }
            return ResponseEntity.ok(ApiResponse.success(statusPrefix + result.getMessage(), result));

        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            log.error("Parse sheetConfigs failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("sheetConfigs format error: " + e.getMessage()));
        } catch (IOException e) {
            log.error("File read failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("File read failed: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Batch upload failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Batch upload failed: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/upload-batch-stream", consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
                 produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Batch upload sheets (streaming)", description = "SSE streaming progress for batch sheet upload")
    public SseEmitter uploadBatchStream(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Excel file") @RequestParam("file") MultipartFile file,
            @Parameter(description = "Sheet configs JSON array") @RequestParam("sheetConfigs") String sheetConfigsJson) {

        log.info("Batch upload (streaming): factoryId={}, fileName={}", factoryId, file.getOriginalFilename());

        SseEmitter emitter = new SseEmitter(600000L);

        new Thread(() -> {
            try {
                if (uploadFlowService == null) {
                    sendEvent(emitter, UploadProgressEvent.error("Batch upload service not available"));
                    emitter.complete();
                    return;
                }

                List<SheetConfig> configs = objectMapper.readValue(sheetConfigsJson,
                        new TypeReference<List<SheetConfig>>() {});

                if (configs == null || configs.isEmpty()) {
                    sendEvent(emitter, UploadProgressEvent.error("sheetConfigs cannot be empty"));
                    emitter.complete();
                    return;
                }

                BatchUploadResult result = uploadFlowService.executeBatchUploadWithProgress(
                        factoryId, file.getInputStream(), file.getOriginalFilename(), configs,
                        event -> sendEvent(emitter, event));

                sendEvent(emitter, UploadProgressEvent.complete(result));
                emitter.complete();

            } catch (Exception e) {
                log.error("Batch upload (streaming) failed: {}", e.getMessage(), e);
                try {
                    sendEvent(emitter, UploadProgressEvent.error(e.getMessage()));
                    emitter.complete();
                } catch (Exception ex) {
                    emitter.completeWithError(ex);
                }
            }
        }, "upload-stream-" + System.currentTimeMillis()).start();

        emitter.onCompletion(() -> log.debug("SSE connection completed"));
        emitter.onTimeout(() -> log.warn("SSE connection timeout"));
        emitter.onError(e -> log.error("SSE connection error: {}", e.getMessage()));

        return emitter;
    }

    // ==================== Sheet Retry ====================

    @PostMapping("/retry-sheet/{uploadId}")
    @Operation(summary = "Retry failed sheet", description = "Re-parse and persist failed or stuck sheet data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> retrySheet(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Upload record ID") @PathVariable Long uploadId) {

        log.info("Retry sheet upload: factoryId={}, uploadId={}", factoryId, uploadId);

        if (uploadFlowService == null) {
            return ResponseEntity.ok(ApiResponse.error("Upload service not available"));
        }

        try {
            SmartBIUploadFlowService.UploadFlowResult result = uploadFlowService.retrySheetUpload(factoryId, uploadId);

            if (result.isSuccess()) {
                Map<String, Object> data = new HashMap<>();
                data.put("uploadId", result.getUploadId());
                data.put("message", result.getMessage());
                if (result.getParseResult() != null) {
                    data.put("rowCount", result.getParseResult().getRowCount());
                    data.put("headers", result.getParseResult().getHeaders());
                }
                return ResponseEntity.ok(ApiResponse.success("Retry succeeded", data));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("Retry sheet failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Retry failed: " + e.getMessage()));
        }
    }

    // ==================== Upload History & Data Preview ====================

    @GetMapping("/uploads")
    @Operation(summary = "Get upload history", description = "Get all uploaded Excel files for the factory")
    public ResponseEntity<ApiResponse<List<UploadHistoryDTO>>> getUploadHistory(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Status filter") @RequestParam(required = false) String status) {

        log.info("Get upload history: factoryId={}, status={}", factoryId, status);

        if (pgUploadRepository == null) {
            return ResponseEntity.ok(ApiResponse.success(java.util.Collections.emptyList()));
        }

        try {
            List<SmartBiPgExcelUpload> uploads = pgUploadRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId);
            List<UploadHistoryDTO> dtos = uploads.stream()
                    .map(UploadHistoryDTO::fromEntity)
                    .collect(java.util.stream.Collectors.toList());
            return ResponseEntity.ok(ApiResponse.success(dtos));
        } catch (Exception e) {
            log.error("Get upload history failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get upload history failed: " + e.getMessage()));
        }
    }

    @GetMapping("/uploads/{uploadId}/fields")
    @Operation(summary = "Get upload fields", description = "Get field definitions for uploaded data")
    public ResponseEntity<ApiResponse<List<DynamicAnalysisService.FieldDefinitionDTO>>> getUploadFields(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Upload ID") @PathVariable Long uploadId) {

        log.info("Get upload fields: factoryId={}, uploadId={}", factoryId, uploadId);

        if (dynamicAnalysisService == null) {
            return ResponseEntity.ok(ApiResponse.error("Dynamic analysis service not enabled"));
        }

        try {
            List<DynamicAnalysisService.FieldDefinitionDTO> fields =
                    dynamicAnalysisService.getFieldDefinitions(uploadId);
            return ResponseEntity.ok(ApiResponse.success(fields));
        } catch (Exception e) {
            log.error("Get upload fields failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get fields failed: " + e.getMessage()));
        }
    }

    @GetMapping("/uploads/{uploadId}/data")
    @Operation(summary = "Get upload data", description = "Paginated view of persisted Excel data rows")
    public ResponseEntity<ApiResponse<TableDataResponse>> getUploadData(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Upload ID") @PathVariable Long uploadId,
            @Parameter(description = "Page (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "50") int size) {

        log.info("Get upload data: factoryId={}, uploadId={}, page={}, size={}", factoryId, uploadId, page, size);

        if (dynamicAnalysisService == null) {
            return ResponseEntity.ok(ApiResponse.error("Dynamic analysis service not enabled"));
        }

        try {
            List<DynamicAnalysisService.FieldDefinitionDTO> fields =
                    dynamicAnalysisService.getFieldDefinitions(uploadId);
            List<String> headers = fields.stream()
                    .map(DynamicAnalysisService.FieldDefinitionDTO::getOriginalName)
                    .collect(java.util.stream.Collectors.toList());

            org.springframework.data.domain.Page<SmartBiDynamicData> dataPage =
                    dynamicAnalysisService.getDataPage(factoryId, uploadId, page, size);

            List<Map<String, Object>> rows = dataPage.getContent().stream()
                    .map(SmartBiDynamicData::getRowData)
                    .collect(java.util.stream.Collectors.toList());

            TableDataResponse response = TableDataResponse.builder()
                    .headers(headers)
                    .data(rows)
                    .total(dataPage.getTotalElements())
                    .page(page)
                    .size(size)
                    .totalPages(dataPage.getTotalPages())
                    .build();

            return ResponseEntity.ok(ApiResponse.success(response));
        } catch (Exception e) {
            log.error("Get upload data failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get data failed: " + e.getMessage()));
        }
    }

    // ==================== Field Definition Backfill ====================

    @GetMapping("/uploads-missing-fields")
    @Operation(summary = "Diagnose missing field definitions", description = "Count uploads missing field definitions")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUploadsMissingFields(
            @Parameter(description = "Factory ID") @PathVariable String factoryId) {

        log.info("Diagnose missing fields: factoryId={}", factoryId);

        if (pgUploadRepository == null) {
            return ResponseEntity.ok(ApiResponse.error("PostgreSQL not enabled"));
        }

        try {
            List<SmartBiPgExcelUpload> allUploads = pgUploadRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId);
            int totalCount = allUploads.size();
            int missingCount = 0;

            for (SmartBiPgExcelUpload upload : allUploads) {
                if (dynamicAnalysisService != null) {
                    long fieldCount = dynamicAnalysisService.getFieldCount(upload.getId());
                    if (fieldCount == 0) {
                        missingCount++;
                    }
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("totalUploads", totalCount);
            result.put("missingFieldsCount", missingCount);
            result.put("hasIssues", missingCount > 0);

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Diagnose failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Diagnose failed: " + e.getMessage()));
        }
    }

    @PostMapping("/backfill/fields/{uploadId}")
    @Operation(summary = "Backfill field definitions", description = "Rebuild missing field definitions from field_mappings")
    public ResponseEntity<ApiResponse<BackfillResult>> backfillFieldDefinitions(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Upload ID") @PathVariable Long uploadId) {

        log.info("Backfill field definitions: factoryId={}, uploadId={}", factoryId, uploadId);

        if (dynamicAnalysisService == null || pgUploadRepository == null) {
            return ResponseEntity.ok(ApiResponse.error("Dynamic analysis service not enabled"));
        }

        try {
            BackfillResult result = dynamicAnalysisService.backfillFieldDefinitions(factoryId, uploadId);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Backfill failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Backfill failed: " + e.getMessage()));
        }
    }

    @PostMapping("/backfill/batch")
    @Operation(summary = "Batch backfill field definitions", description = "Backfill all uploads missing field definitions")
    public ResponseEntity<ApiResponse<BatchBackfillResult>> batchBackfill(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Max items to process") @RequestParam(defaultValue = "100") int limit) {

        log.info("Batch backfill: factoryId={}, limit={}", factoryId, limit);

        if (dynamicAnalysisService == null || pgUploadRepository == null) {
            return ResponseEntity.ok(ApiResponse.error("Dynamic analysis service not enabled"));
        }

        try {
            BatchBackfillResult result = dynamicAnalysisService.batchBackfillFieldDefinitions(factoryId, limit);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Batch backfill failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Batch backfill failed: " + e.getMessage()));
        }
    }

    // ==================== Helper ====================

    private void sendEvent(SseEmitter emitter, UploadProgressEvent event) {
        try {
            emitter.send(SseEmitter.event()
                    .name(event.getType().name().toLowerCase())
                    .data(event, MediaType.APPLICATION_JSON));
        } catch (Exception e) {
            log.warn("Send SSE event failed: {}", e.getMessage());
        }
    }
}
