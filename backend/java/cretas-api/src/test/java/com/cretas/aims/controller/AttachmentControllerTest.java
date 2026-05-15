package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.Attachment;
import com.cretas.aims.entity.Attachment.EntityType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.security.AttachmentPermissionResolver;
import com.cretas.aims.service.attachment.AttachmentService;
import com.cretas.aims.service.attachment.dto.RegisterAttachmentRequest;
import com.cretas.aims.service.attachment.dto.UpdateAttachmentRequest;
import com.cretas.aims.service.attachment.dto.UploadUrlResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * AttachmentController 单元测试 — C-ATT-1 Day 5.
 *
 * 覆盖 8 endpoint 的 controller 层契约: 路径绑定 / DTO 解析 / 响应包装 /
 * 302 redirect / stripQuery 在 fileUrl 派生.
 *
 * <p>RBAC 行为在 {@link AttachmentControllerRBACTest} 单独覆盖, 这里 resolver
 * 默认是 silent mock (调用不抛异常 = "管理员行为"), 让契约测试聚焦 controller 编排.
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15
 */
@DisplayName("AttachmentController 单元测试")
@ExtendWith(MockitoExtension.class)
class AttachmentControllerTest {

    @Mock AttachmentService attachmentService;
    @Mock AttachmentPermissionResolver permissionResolver;
    @Mock HttpServletRequest request;
    @InjectMocks AttachmentController controller;

    private static final String FACTORY_ID = "F006";
    private static final String ATT_ID = "att-uuid-001";

    @Test
    @DisplayName("✅ GET /attachments?entityType=PURCHASE_ORDER&entityId=PO-001 返列表")
    void listByEntity_returnsList() {
        Attachment a = new Attachment();
        a.setId(ATT_ID);
        when(attachmentService.queryByEntity(FACTORY_ID, EntityType.PURCHASE_ORDER, "PO-001"))
                .thenReturn(List.of(a));

        ResponseEntity<ApiResponse<List<Attachment>>> resp =
                controller.listByEntity(FACTORY_ID, EntityType.PURCHASE_ORDER, "PO-001", request);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertTrue(resp.getBody().getSuccess());
        assertEquals(1, resp.getBody().getData().size());
        assertEquals(ATT_ID, resp.getBody().getData().get(0).getId());
        verify(permissionResolver).requireRead(any(), eq(EntityType.PURCHASE_ORDER));
    }

    @Test
    @DisplayName("✅ GET /attachments/{id} 返详情")
    void getById_returnsAttachment() {
        Attachment a = new Attachment();
        a.setId(ATT_ID);
        a.setEntityType(EntityType.PURCHASE_ORDER);
        when(attachmentService.getById(FACTORY_ID, ATT_ID)).thenReturn(a);

        ResponseEntity<ApiResponse<Attachment>> resp = controller.getById(FACTORY_ID, ATT_ID, request);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals(ATT_ID, resp.getBody().getData().getId());
        verify(permissionResolver).requireRead(any(), eq(EntityType.PURCHASE_ORDER));
    }

    @Test
    @DisplayName("✅ GET /attachments/{id}/download 返 302 + Location 签名 URL")
    void download_returns302WithSignedUrl() {
        Attachment a = new Attachment();
        a.setId(ATT_ID);
        a.setEntityType(EntityType.PURCHASE_ORDER);
        when(attachmentService.getById(FACTORY_ID, ATT_ID)).thenReturn(a);
        String signedUrl = "https://cretas-media.oss-cn-shanghai.aliyuncs.com/x?Signature=s&Expires=t";
        when(attachmentService.generateDownloadUrl(FACTORY_ID, ATT_ID)).thenReturn(signedUrl);

        ResponseEntity<Void> resp = controller.download(FACTORY_ID, ATT_ID, request);

        assertEquals(HttpStatus.FOUND, resp.getStatusCode());
        assertEquals(signedUrl, resp.getHeaders().getLocation().toString());
        verify(permissionResolver).requireRead(any(), eq(EntityType.PURCHASE_ORDER));
    }

    @Test
    @DisplayName("✅ POST /attachments/upload-url 返 { uploadUrl, fileUrl } — fileUrl 是 stripQuery 结果")
    void generateUploadUrl_returnsBothUrls() {
        String presigned = "https://cretas-media.oss-cn-shanghai.aliyuncs.com/F006/attachments/2026/05/15/abc.jpg?Signature=s&Expires=t";
        when(attachmentService.generateUploadUrl(eq(FACTORY_ID), eq("test.jpg"), eq("image/jpeg")))
                .thenReturn(presigned);

        AttachmentController.UploadUrlRequest req = new AttachmentController.UploadUrlRequest();
        req.setFileName("test.jpg");
        req.setFileType("image/jpeg");

        ResponseEntity<ApiResponse<UploadUrlResponse>> resp =
                controller.generateUploadUrl(FACTORY_ID, req);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        UploadUrlResponse data = resp.getBody().getData();
        assertEquals(presigned, data.getUploadUrl(), "uploadUrl = 完整签名 URL");
        assertEquals("https://cretas-media.oss-cn-shanghai.aliyuncs.com/F006/attachments/2026/05/15/abc.jpg",
                data.getFileUrl(),
                "fileUrl = stripQuery (去除签名查询串)");
        verify(permissionResolver).validateUploadRequest("image/jpeg", null);
    }

    @Test
    @DisplayName("✅ POST /attachments 注册 — 路径 factoryId 透传给 service")
    void register_passesFactoryIdToService() {
        RegisterAttachmentRequest req = new RegisterAttachmentRequest();
        req.setEntityType(EntityType.PURCHASE_ORDER);
        req.setEntityId("PO-001");
        req.setFileName("a.jpg");
        req.setFileUrl("https://x/a.jpg");
        req.setFileSize(100L);
        req.setFileType("image/jpeg");

        Attachment saved = new Attachment();
        saved.setId(ATT_ID);
        when(attachmentService.register(eq(FACTORY_ID), any(RegisterAttachmentRequest.class), any()))
                .thenReturn(saved);

        ResponseEntity<ApiResponse<Attachment>> resp = controller.register(FACTORY_ID, req, request);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals(ATT_ID, resp.getBody().getData().getId());

        ArgumentCaptor<RegisterAttachmentRequest> cap = ArgumentCaptor.forClass(RegisterAttachmentRequest.class);
        verify(attachmentService).register(eq(FACTORY_ID), cap.capture(), any());
        assertEquals(EntityType.PURCHASE_ORDER, cap.getValue().getEntityType());
        assertEquals("PO-001", cap.getValue().getEntityId());
        verify(permissionResolver).requireWrite(any(), eq(EntityType.PURCHASE_ORDER));
    }

    @Test
    @DisplayName("✅ PUT /attachments/{id} 更新")
    void update_invokesService() {
        Attachment existing = new Attachment();
        existing.setId(ATT_ID);
        existing.setEntityType(EntityType.PURCHASE_ORDER);
        when(attachmentService.getById(FACTORY_ID, ATT_ID)).thenReturn(existing);

        UpdateAttachmentRequest req = new UpdateAttachmentRequest();
        req.setDescription("new desc");
        Attachment updated = new Attachment();
        updated.setId(ATT_ID);
        updated.setDescription("new desc");
        when(attachmentService.update(eq(FACTORY_ID), eq(ATT_ID), any(UpdateAttachmentRequest.class), any()))
                .thenReturn(updated);

        ResponseEntity<ApiResponse<Attachment>> resp = controller.update(FACTORY_ID, ATT_ID, req, request);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals("new desc", resp.getBody().getData().getDescription());
        verify(permissionResolver).requireWrite(any(), eq(EntityType.PURCHASE_ORDER));
    }

    @Test
    @DisplayName("✅ DELETE /attachments/{id} 软删, 返成功消息")
    void softDelete_returnsSuccessMessage() {
        ResponseEntity<ApiResponse<Void>> resp = controller.softDelete(FACTORY_ID, ATT_ID);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertTrue(resp.getBody().getSuccess());
        verify(attachmentService).softDelete(eq(FACTORY_ID), eq(ATT_ID), any());
    }

    @Test
    @DisplayName("✅ POST /attachments/batch-by-entity 返计数 Map")
    void batchCount_returnsMap() {
        Map<String, Long> mockCounts = Map.of("PO-001", 3L, "PO-002", 7L);
        when(attachmentService.countByEntities(FACTORY_ID, EntityType.PURCHASE_ORDER, List.of("PO-001", "PO-002")))
                .thenReturn(mockCounts);

        AttachmentController.BatchCountRequest req = new AttachmentController.BatchCountRequest();
        req.setEntityType(EntityType.PURCHASE_ORDER);
        req.setEntityIds(List.of("PO-001", "PO-002"));

        ResponseEntity<ApiResponse<Map<String, Long>>> resp = controller.batchCount(FACTORY_ID, req, request);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals(2, resp.getBody().getData().size());
        assertEquals(3L, resp.getBody().getData().get("PO-001"));
        assertEquals(7L, resp.getBody().getData().get("PO-002"));
        verify(permissionResolver).requireRead(any(), eq(EntityType.PURCHASE_ORDER));
    }

    @Test
    @DisplayName("❌ getById 不存在 — Service 抛 BusinessException 404 沿 controller 边界透传 (由 GlobalExceptionHandler 转 HTTP)")
    void getById_notFound_propagatesException() {
        when(attachmentService.getById(FACTORY_ID, ATT_ID))
                .thenThrow(new BusinessException(404, "附件不存在"));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> controller.getById(FACTORY_ID, ATT_ID, request));
        assertEquals(404, ex.getCode());
    }
}
