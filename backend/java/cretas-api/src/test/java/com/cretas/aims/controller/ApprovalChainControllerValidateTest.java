package com.cretas.aims.controller;

import com.cretas.aims.dto.approval.CreateApprovalChainConfigRequest;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.ApprovalChainConfig;
import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.service.ApprovalChainService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Rule 17.1 cleanup verification for
 * {@link ApprovalChainController#validateConfig} (Issue #384 batch 6 final).
 *
 * <p>Asserts that the validate endpoint (a dry-run-style validation against the
 * same shape as create) correctly binds the DTO and forwards the mapped entity
 * to {@code ApprovalChainService.validateConfig(ApprovalChainConfig)} without
 * persisting.
 */
@ExtendWith(MockitoExtension.class)
class ApprovalChainControllerValidateTest {

    @Mock ApprovalChainService approvalChainService;

    @InjectMocks ApprovalChainController controller;

    @Test
    void validateConfig_happyPath_dtoMappedAndForwardedToService() {
        CreateApprovalChainConfigRequest req = new CreateApprovalChainConfigRequest();
        req.setDecisionType(DecisionType.QUALITY_RELEASE);
        req.setName("一级审批 - 质量放行");
        req.setApprovalLevel(1);
        req.setApproverRoles("[\"factory_super_admin\"]");

        Map<String, Object> validation = new HashMap<>();
        validation.put("isValid", Boolean.TRUE);
        validation.put("errors", java.util.Collections.emptyList());
        when(approvalChainService.validateConfig(any(ApprovalChainConfig.class)))
                .thenReturn(validation);

        ApiResponse<Map<String, Object>> resp = controller.validateConfig("F001", req);

        ArgumentCaptor<ApprovalChainConfig> captor =
                ArgumentCaptor.forClass(ApprovalChainConfig.class);
        Mockito.verify(approvalChainService).validateConfig(captor.capture());
        ApprovalChainConfig mapped = captor.getValue();

        assertNotNull(resp);
        assertTrue(Boolean.TRUE.equals(resp.getSuccess()));
        // DTO → Entity mapping at controller boundary
        assertEquals(DecisionType.QUALITY_RELEASE, mapped.getDecisionType());
        assertEquals("一级审批 - 质量放行", mapped.getName());
        assertEquals(1, mapped.getApprovalLevel());
        assertEquals("[\"factory_super_admin\"]", mapped.getApproverRoles());
        // Service result envelope returned verbatim
        assertEquals(Boolean.TRUE, resp.getData().get("isValid"));
    }

    @Test
    void validateConfig_invalidConfig_errorsForwardedFromService() {
        // Caller submits incomplete config; service validation returns errors —
        // controller MUST forward result verbatim (no swallowing).
        CreateApprovalChainConfigRequest req = new CreateApprovalChainConfigRequest();
        req.setDecisionType(DecisionType.SUPPLIER_APPROVAL);
        req.setName("Test");
        req.setApprovalLevel(1);
        req.setApproverRoles("not-a-json-array");

        Map<String, Object> validation = new HashMap<>();
        validation.put("isValid", Boolean.FALSE);
        validation.put("errors", java.util.List.of("审批人角色JSON格式无效"));
        when(approvalChainService.validateConfig(any(ApprovalChainConfig.class)))
                .thenReturn(validation);

        ApiResponse<Map<String, Object>> resp = controller.validateConfig("F001", req);

        assertNotNull(resp);
        // Note: the HTTP envelope is still success=true (this endpoint is *informational*
        // — it returns validation result; persistence path POST /approval-chains is
        // what would throw BusinessException(400) when validation fails)
        assertTrue(Boolean.TRUE.equals(resp.getSuccess()));
        assertEquals(Boolean.FALSE, resp.getData().get("isValid"));
        assertEquals(java.util.List.of("审批人角色JSON格式无效"), resp.getData().get("errors"));
    }
}
