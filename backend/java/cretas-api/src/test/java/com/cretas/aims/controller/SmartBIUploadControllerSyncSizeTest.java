package com.cretas.aims.controller;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgExcelUploadRepository;
import com.cretas.aims.service.smartbi.DynamicAnalysisService;
import com.cretas.aims.service.smartbi.ExcelDynamicParserService;
import com.cretas.aims.service.smartbi.SmartBIUploadFlowService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * T-R5-1: /upload sync path must reject >50 MB files immediately
 * so a 100 MB junk binary cannot hold a backend thread + Python parse worker
 * for 5 minutes (DoS surface logged by R5 audit §1 B1).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SmartBIUploadController — sync upload size cap (T-R5-1)")
class SmartBIUploadControllerSyncSizeTest {

    @Mock ExcelDynamicParserService excelParserService;
    @Mock SmartBIUploadFlowService uploadFlowService;
    @Mock PythonSmartBIClient pythonClient;
    @Mock PythonSmartBIConfig pythonConfig;
    @Mock ObjectMapper objectMapper;
    @Mock DynamicAnalysisService dynamicAnalysisService;
    @Mock SmartBiPgExcelUploadRepository pgUploadRepository;

    private SmartBIUploadController newController() {
        return new SmartBIUploadController(
                excelParserService, uploadFlowService, pythonClient, pythonConfig,
                objectMapper, dynamicAnalysisService, pgUploadRepository);
    }

    @Test
    @DisplayName("100MB sync upload → rejected fast with actionable error; Python never called")
    void uploadExcel_rejectsAt50MB() {
        SmartBIUploadController controller = newController();
        MultipartFile huge = mock(MultipartFile.class);
        when(huge.getSize()).thenReturn(100L * 1024 * 1024);
        when(huge.getOriginalFilename()).thenReturn("huge.xlsx");

        long start = System.currentTimeMillis();
        ResponseEntity<ApiResponse<ExcelParseResponse>> resp = controller.uploadExcel(
                "F001", huge, null, 0, 0, false, 0, 1);
        long elapsed = System.currentTimeMillis() - start;

        ApiResponse<?> body = resp.getBody();
        assertNotNull(body, "body must not be null");
        assertEquals(Boolean.FALSE, body.getSuccess(), "must be error envelope");
        assertNotNull(body.getMessage(), "must carry error message");
        assertTrue(body.getMessage().contains("过大") || body.getMessage().contains("upload-and-analyze"),
                "message must steer user to async route, got: " + body.getMessage());
        assertTrue(elapsed < 2_000, "must return in <2s, got " + elapsed + "ms");
        verifyNoInteractions(pythonClient);
    }

    @Test
    @DisplayName("≤50MB sync upload still attempts Python (size cap is a ceiling, not a floor)")
    void uploadExcel_passes50MBThroughToPython() throws Exception {
        SmartBIUploadController controller = newController();
        MultipartFile small = mock(MultipartFile.class);
        when(small.getSize()).thenReturn(5L * 1024 * 1024); // 5 MB
        when(small.getOriginalFilename()).thenReturn("small.xlsx");
        when(pythonConfig.isEnabled()).thenReturn(true);
        when(pythonClient.isAvailable()).thenReturn(true);
        ExcelParseResponse ok = new ExcelParseResponse();
        ok.setSuccess(true);
        when(pythonClient.parseExcel(any(), eq("F001"), any(), anyInt(), anyInt())).thenReturn(ok);

        ResponseEntity<ApiResponse<ExcelParseResponse>> resp = controller.uploadExcel(
                "F001", small, null, 0, 0, false, 0, 1);

        ApiResponse<?> body = resp.getBody();
        assertNotNull(body);
        assertEquals(Boolean.TRUE, body.getSuccess());
        verify(pythonClient, times(1)).parseExcel(any(), eq("F001"), any(), anyInt(), anyInt());
    }
}
