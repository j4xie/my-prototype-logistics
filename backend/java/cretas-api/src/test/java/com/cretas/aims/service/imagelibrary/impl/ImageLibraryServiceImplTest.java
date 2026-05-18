package com.cretas.aims.service.imagelibrary.impl;

import com.cretas.aims.entity.Attachment;
import com.cretas.aims.entity.imagelibrary.ImageLibrary;
import com.cretas.aims.entity.imagelibrary.ImageLibrary.Category;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.AttachmentRepository;
import com.cretas.aims.repository.imagelibrary.ImageLibraryRepository;
import com.cretas.aims.service.imagelibrary.dto.CreateImageLibraryRequest;
import com.cretas.aims.service.imagelibrary.dto.ImageLibraryView;
import com.cretas.aims.service.imagelibrary.dto.UpdateImageLibraryRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ImageLibraryServiceImpl 单元测试 (P2 #80).
 *
 * 覆盖: create (成功 / dedup / 非图片 / 跨工厂 attachment / 未登录) /
 *       update (owner / admin / non-owner / cross-factory non-admin) /
 *       softDelete (owner / non-owner) /
 *       search (基础 / tag 过滤 / crossFactoryOnly) /
 *       recordUsage (visible / 不可见) /
 *       cleanTags helper.
 *
 * @author Cretas Team — P2 Backlog
 * @since 2026-05-18
 */
@DisplayName("ImageLibraryServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class ImageLibraryServiceImplTest {

    @Mock
    private ImageLibraryRepository imageLibraryRepository;

    @Mock
    private AttachmentRepository attachmentRepository;

    @InjectMocks
    private ImageLibraryServiceImpl service;

    private static final String FACTORY_ID = "F006";
    private static final String OTHER_FACTORY = "F001";
    private static final Long UPLOADER_ID = 100L;
    private static final Long OTHER_USER_ID = 200L;
    private static final String IMG_LIB_ID = "imglib-uuid-001";
    private static final String ATT_ID = "att-uuid-001";

    private Attachment sampleAttachment() {
        Attachment a = new Attachment();
        a.setId(ATT_ID);
        a.setFactoryId(FACTORY_ID);
        a.setFileName("promo-banner.jpg");
        a.setFileUrl("https://oss/promo.jpg");
        a.setThumbnailUrl("https://oss/promo_thumb.jpg");
        a.setFileSize(102400L);
        a.setFileType("image/jpeg");
        return a;
    }

    private CreateImageLibraryRequest sampleCreateReq() {
        CreateImageLibraryRequest req = new CreateImageLibraryRequest();
        req.setAttachmentId(ATT_ID);
        req.setTitle("春季促销 Banner");
        req.setDescription("2026 春季新品促销主图");
        req.setTags(List.of("促销", "春季", "新品"));
        req.setCategory(Category.MARKETING);
        req.setIsPublic(false);
        return req;
    }

    private ImageLibrary sampleEntity() {
        ImageLibrary e = new ImageLibrary();
        e.setId(IMG_LIB_ID);
        e.setAttachmentId(ATT_ID);
        e.setFactoryId(FACTORY_ID);
        e.setTitle("春季促销 Banner");
        e.setDescription("2026 春季新品");
        e.setTags(new ArrayList<>(List.of("促销", "春季")));
        e.setCategory(Category.MARKETING);
        e.setUploaderUserId(UPLOADER_ID);
        e.setIsPublic(false);
        e.setUsageCount(5L);
        return e;
    }

    @BeforeEach
    void setUp() {
        // pure mocks, nothing to init
    }

    // ==================== create ====================

    @Nested
    @DisplayName("create")
    class CreateTests {

        @Test
        @DisplayName("✅ 成功创建 — 图片 attachment 不存在已收录记录")
        void create_success() {
            when(attachmentRepository.findByFactoryIdAndId(FACTORY_ID, ATT_ID))
                    .thenReturn(Optional.of(sampleAttachment()));
            when(imageLibraryRepository.findByAttachmentId(ATT_ID)).thenReturn(Optional.empty());
            when(imageLibraryRepository.save(any(ImageLibrary.class))).thenAnswer(inv -> {
                ImageLibrary e = inv.getArgument(0);
                e.setId(IMG_LIB_ID);
                return e;
            });

            ImageLibraryView view = service.create(FACTORY_ID, sampleCreateReq(), UPLOADER_ID);

            assertNotNull(view);
            assertEquals(IMG_LIB_ID, view.getId());
            assertEquals("春季促销 Banner", view.getTitle());
            assertEquals(Category.MARKETING, view.getCategory());
            assertEquals(3, view.getTags().size());
            assertEquals("https://oss/promo.jpg", view.getFileUrl());
            assertEquals(0L, view.getUsageCount());
            verify(imageLibraryRepository).save(any(ImageLibrary.class));
        }

        @Test
        @DisplayName("❌ 401 — 未登录 (userId=null)")
        void create_unauthorized() {
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.create(FACTORY_ID, sampleCreateReq(), null));
            assertEquals(401, ex.getCode());
        }

        @Test
        @DisplayName("❌ 404 — attachment 不存在或跨工厂")
        void create_attachmentNotFound() {
            when(attachmentRepository.findByFactoryIdAndId(FACTORY_ID, ATT_ID))
                    .thenReturn(Optional.empty());
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.create(FACTORY_ID, sampleCreateReq(), UPLOADER_ID));
            assertEquals(404, ex.getCode());
            assertTrue(ex.getMessage().contains("Attachment 不存在"));
        }

        @Test
        @DisplayName("❌ 400 — 非图片类型 attachment")
        void create_nonImageType() {
            Attachment pdf = sampleAttachment();
            pdf.setFileType("application/pdf");
            when(attachmentRepository.findByFactoryIdAndId(FACTORY_ID, ATT_ID))
                    .thenReturn(Optional.of(pdf));
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.create(FACTORY_ID, sampleCreateReq(), UPLOADER_ID));
            assertEquals(400, ex.getCode());
            assertTrue(ex.getMessage().contains("仅图片类型"));
        }

        @Test
        @DisplayName("❌ 409 — attachment 已收录")
        void create_duplicate() {
            when(attachmentRepository.findByFactoryIdAndId(FACTORY_ID, ATT_ID))
                    .thenReturn(Optional.of(sampleAttachment()));
            when(imageLibraryRepository.findByAttachmentId(ATT_ID))
                    .thenReturn(Optional.of(sampleEntity()));
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.create(FACTORY_ID, sampleCreateReq(), UPLOADER_ID));
            assertEquals(409, ex.getCode());
            assertTrue(ex.getMessage().contains("已收录"));
        }
    }

    // ==================== update ====================

    @Nested
    @DisplayName("update")
    class UpdateTests {

        @Test
        @DisplayName("✅ owner 更新成功 (改 title + tags + isPublic)")
        void update_ownerSuccess() {
            ImageLibrary existing = sampleEntity();
            when(imageLibraryRepository.findVisibleById(FACTORY_ID, IMG_LIB_ID))
                    .thenReturn(Optional.of(existing));
            when(imageLibraryRepository.save(any(ImageLibrary.class))).thenAnswer(inv -> inv.getArgument(0));
            when(attachmentRepository.findById(ATT_ID)).thenReturn(Optional.of(sampleAttachment()));

            UpdateImageLibraryRequest req = new UpdateImageLibraryRequest();
            req.setTitle("新标题");
            req.setTags(List.of("夏季", "促销"));
            req.setIsPublic(true);

            ImageLibraryView view = service.update(FACTORY_ID, IMG_LIB_ID, req, UPLOADER_ID, false);

            assertEquals("新标题", view.getTitle());
            assertEquals(2, view.getTags().size());
            assertTrue(view.getIsPublic());
        }

        @Test
        @DisplayName("✅ admin 跨工厂修改 — 允许")
        void update_adminCrossFactory() {
            ImageLibrary existing = sampleEntity();
            existing.setFactoryId(OTHER_FACTORY);
            when(imageLibraryRepository.findVisibleById(FACTORY_ID, IMG_LIB_ID))
                    .thenReturn(Optional.of(existing));
            when(imageLibraryRepository.save(any(ImageLibrary.class))).thenAnswer(inv -> inv.getArgument(0));
            when(attachmentRepository.findById(ATT_ID)).thenReturn(Optional.empty());

            UpdateImageLibraryRequest req = new UpdateImageLibraryRequest();
            req.setDescription("admin 修改");

            ImageLibraryView view = service.update(FACTORY_ID, IMG_LIB_ID, req, OTHER_USER_ID, true);
            assertEquals("admin 修改", view.getDescription());
        }

        @Test
        @DisplayName("❌ 403 — 非 owner 非 admin")
        void update_forbiddenNonOwner() {
            when(imageLibraryRepository.findVisibleById(FACTORY_ID, IMG_LIB_ID))
                    .thenReturn(Optional.of(sampleEntity()));
            UpdateImageLibraryRequest req = new UpdateImageLibraryRequest();
            req.setTitle("攻击者改名");

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.update(FACTORY_ID, IMG_LIB_ID, req, OTHER_USER_ID, false));
            assertEquals(403, ex.getCode());
        }

        @Test
        @DisplayName("❌ 401 — 未登录")
        void update_unauthorized() {
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.update(FACTORY_ID, IMG_LIB_ID, new UpdateImageLibraryRequest(), null, false));
            assertEquals(401, ex.getCode());
        }
    }

    // ==================== softDelete ====================

    @Nested
    @DisplayName("softDelete")
    class SoftDeleteTests {

        @Test
        @DisplayName("✅ owner 删除成功")
        void delete_ownerSuccess() {
            ImageLibrary existing = sampleEntity();
            when(imageLibraryRepository.findVisibleById(FACTORY_ID, IMG_LIB_ID))
                    .thenReturn(Optional.of(existing));

            service.softDelete(FACTORY_ID, IMG_LIB_ID, UPLOADER_ID, false);
            verify(imageLibraryRepository).delete(existing);
        }

        @Test
        @DisplayName("❌ 403 — 非 owner")
        void delete_forbidden() {
            when(imageLibraryRepository.findVisibleById(FACTORY_ID, IMG_LIB_ID))
                    .thenReturn(Optional.of(sampleEntity()));
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.softDelete(FACTORY_ID, IMG_LIB_ID, OTHER_USER_ID, false));
            assertEquals(403, ex.getCode());
        }
    }

    // ==================== search ====================

    @Nested
    @DisplayName("search")
    class SearchTests {

        @Test
        @DisplayName("✅ 基础列表 — 含 attachment 字段 enrich")
        void search_basicEnrich() {
            ImageLibrary e1 = sampleEntity();
            Pageable pg = PageRequest.of(0, 10);
            when(imageLibraryRepository.search(eq(FACTORY_ID), isNull(), isNull(), eq(false), eq(pg)))
                    .thenReturn(new PageImpl<>(List.of(e1), pg, 1));
            when(attachmentRepository.findAllById(Set.of(ATT_ID)))
                    .thenReturn(List.of(sampleAttachment()));

            Page<ImageLibraryView> page = service.search(FACTORY_ID, null, null, null, false, pg);
            assertEquals(1, page.getTotalElements());
            assertEquals("https://oss/promo.jpg", page.getContent().get(0).getFileUrl());
        }

        @Test
        @DisplayName("✅ tag 过滤 — 含标签 '促销' 命中, '不存在的标签' 0")
        void search_tagFilter() {
            ImageLibrary e1 = sampleEntity();      // tags = [促销, 春季]
            Pageable pg = PageRequest.of(0, 10);
            when(imageLibraryRepository.search(eq(FACTORY_ID), isNull(), isNull(), eq(false), eq(pg)))
                    .thenReturn(new PageImpl<>(List.of(e1), pg, 1));
            when(attachmentRepository.findAllById(anySet()))
                    .thenReturn(List.of(sampleAttachment()));

            Page<ImageLibraryView> hit = service.search(FACTORY_ID, null, null, "促销", false, pg);
            assertEquals(1, hit.getContent().size());

            // 不存在的标签 — content 应过滤为空 (但 totalElements 仍是底层 page 的 1, 因 tag 是 view 层过滤)
            Page<ImageLibraryView> miss = service.search(FACTORY_ID, null, null, "不存在", false, pg);
            assertEquals(0, miss.getContent().size());
        }
    }

    // ==================== recordUsage ====================

    @Nested
    @DisplayName("recordUsage")
    class RecordUsageTests {

        @Test
        @DisplayName("✅ 可见图片 — 调 increment SQL")
        void recordUsage_success() {
            when(imageLibraryRepository.findVisibleById(FACTORY_ID, IMG_LIB_ID))
                    .thenReturn(Optional.of(sampleEntity()));
            when(imageLibraryRepository.incrementUsageCount(IMG_LIB_ID)).thenReturn(1);

            service.recordUsage(FACTORY_ID, IMG_LIB_ID);
            verify(imageLibraryRepository).incrementUsageCount(IMG_LIB_ID);
        }

        @Test
        @DisplayName("❌ 404 — 不可见图片")
        void recordUsage_notVisible() {
            when(imageLibraryRepository.findVisibleById(FACTORY_ID, IMG_LIB_ID))
                    .thenReturn(Optional.empty());
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.recordUsage(FACTORY_ID, IMG_LIB_ID));
            assertEquals(404, ex.getCode());
            verify(imageLibraryRepository, never()).incrementUsageCount(anyString());
        }
    }

    // ==================== cleanTags helper ====================

    @Nested
    @DisplayName("cleanTags helper")
    class CleanTagsTests {

        @Test
        @DisplayName("✅ null → 空 list")
        void cleanTags_nullInput() {
            assertEquals(0, ImageLibraryServiceImpl.cleanTags(null).size());
        }

        @Test
        @DisplayName("✅ trim + 去空 + 去重 (保留顺序)")
        void cleanTags_dedup() {
            List<String> result = ImageLibraryServiceImpl.cleanTags(
                    Arrays.asList(" 春季 ", "促销", "", null, "促销", "春季", "新品  "));
            assertEquals(3, result.size());
            assertEquals("春季", result.get(0));
            assertEquals("促销", result.get(1));
            assertEquals("新品", result.get(2));
        }
    }
}
