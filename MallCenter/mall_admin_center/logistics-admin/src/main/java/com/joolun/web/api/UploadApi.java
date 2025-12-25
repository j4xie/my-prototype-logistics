package com.joolun.web.api;

import com.joolun.common.config.JooLunConfig;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.common.utils.file.FileUploadUtils;
import com.joolun.common.utils.file.FileUtils;
import com.joolun.framework.config.ServerConfig;
import com.joolun.weixin.entity.ThirdSession;
import com.joolun.weixin.entity.WxUser;
import com.joolun.weixin.service.WxUserService;
import com.joolun.weixin.utils.ThirdSessionHolder;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;

/**
 * C端文件上传 API
 * 提供小程序端的文件上传功能
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma")
public class UploadApi {

    private final ServerConfig serverConfig;
    private final WxUserService wxUserService;

    /**
     * 获取当前登录用户
     */
    private WxUser getCurrentWxUser() {
        ThirdSession session = ThirdSessionHolder.getThirdSession();
        if (session == null || session.getWxUserId() == null) {
            return null;
        }
        return wxUserService.getById(session.getWxUserId());
    }

    private static final String FILE_DELIMITER = ",";

    // 允许上传的文件类型
    private static final String[] ALLOWED_EXTENSIONS = {
            "jpg", "jpeg", "png", "gif", "bmp", "webp",  // 图片
            "mp4", "avi", "mov", "wmv",                   // 视频
            "pdf", "doc", "docx", "xls", "xlsx"           // 文档
    };

    // 最大文件大小 10MB
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    /**
     * 单文件上传
     */
    @PostMapping("/upload")
    public AjaxResult uploadFile(@RequestParam("file") MultipartFile file) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        if (file == null || file.isEmpty()) {
            return AjaxResult.error("请选择要上传的文件");
        }

        // 检查文件大小
        if (file.getSize() > MAX_FILE_SIZE) {
            return AjaxResult.error("文件大小不能超过10MB");
        }

        // 检查文件类型
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            return AjaxResult.error("文件名不能为空");
        }

        String extension = getFileExtension(originalFilename);
        if (!isAllowedExtension(extension)) {
            return AjaxResult.error("不支持的文件类型");
        }

        try {
            // 上传文件路径
            String filePath = JooLunConfig.getUploadPath();
            // 上传并返回新文件名称
            String fileName = FileUploadUtils.upload(filePath, file);
            String url = serverConfig.getUrl() + fileName;

            log.info("文件上传成功: userId={}, fileName={}", wxUser.getId(), fileName);

            AjaxResult ajax = AjaxResult.success();
            ajax.put("url", url);
            ajax.put("fileName", fileName);
            ajax.put("newFileName", FileUtils.getName(fileName));
            ajax.put("originalFilename", originalFilename);
            return ajax;
        } catch (Exception e) {
            log.error("文件上传失败: userId={}", wxUser.getId(), e);
            return AjaxResult.error("文件上传失败: " + e.getMessage());
        }
    }

    /**
     * 多文件上传
     */
    @PostMapping("/uploads")
    public AjaxResult uploadFiles(@RequestParam("files") List<MultipartFile> files) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        if (files == null || files.isEmpty()) {
            return AjaxResult.error("请选择要上传的文件");
        }

        if (files.size() > 9) {
            return AjaxResult.error("一次最多上传9个文件");
        }

        try {
            String filePath = JooLunConfig.getUploadPath();
            List<String> urls = new ArrayList<>();
            List<String> fileNames = new ArrayList<>();
            List<String> newFileNames = new ArrayList<>();
            List<String> originalFilenames = new ArrayList<>();

            for (MultipartFile file : files) {
                if (file.isEmpty()) {
                    continue;
                }

                // 检查文件大小
                if (file.getSize() > MAX_FILE_SIZE) {
                    return AjaxResult.error("文件 " + file.getOriginalFilename() + " 大小超过10MB限制");
                }

                String originalFilename = file.getOriginalFilename();
                if (originalFilename == null) {
                    continue;
                }

                String extension = getFileExtension(originalFilename);
                if (!isAllowedExtension(extension)) {
                    return AjaxResult.error("文件 " + originalFilename + " 类型不支持");
                }

                String fileName = FileUploadUtils.upload(filePath, file);
                String url = serverConfig.getUrl() + fileName;
                urls.add(url);
                fileNames.add(fileName);
                newFileNames.add(FileUtils.getName(fileName));
                originalFilenames.add(originalFilename);
            }

            log.info("批量文件上传成功: userId={}, count={}", wxUser.getId(), urls.size());

            AjaxResult ajax = AjaxResult.success();
            ajax.put("urls", String.join(FILE_DELIMITER, urls));
            ajax.put("fileNames", String.join(FILE_DELIMITER, fileNames));
            ajax.put("newFileNames", String.join(FILE_DELIMITER, newFileNames));
            ajax.put("originalFilenames", String.join(FILE_DELIMITER, originalFilenames));
            return ajax;
        } catch (Exception e) {
            log.error("批量文件上传失败: userId={}", wxUser.getId(), e);
            return AjaxResult.error("文件上传失败: " + e.getMessage());
        }
    }

    /**
     * 上传图片（限制只能上传图片类型）
     */
    @PostMapping("/upload/image")
    public AjaxResult uploadImage(@RequestParam("file") MultipartFile file) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        if (file == null || file.isEmpty()) {
            return AjaxResult.error("请选择要上传的图片");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            return AjaxResult.error("文件名不能为空");
        }

        String extension = getFileExtension(originalFilename).toLowerCase();
        if (!isImageExtension(extension)) {
            return AjaxResult.error("只支持上传图片文件（jpg, jpeg, png, gif, bmp, webp）");
        }

        // 图片最大5MB
        if (file.getSize() > 5 * 1024 * 1024) {
            return AjaxResult.error("图片大小不能超过5MB");
        }

        try {
            String filePath = JooLunConfig.getUploadPath();
            String fileName = FileUploadUtils.upload(filePath, file);
            String url = serverConfig.getUrl() + fileName;

            log.info("图片上传成功: userId={}, fileName={}", wxUser.getId(), fileName);

            AjaxResult ajax = AjaxResult.success();
            ajax.put("url", url);
            ajax.put("fileName", fileName);
            return ajax;
        } catch (Exception e) {
            log.error("图片上传失败: userId={}", wxUser.getId(), e);
            return AjaxResult.error("图片上传失败");
        }
    }

    /**
     * 获取文件扩展名
     */
    private String getFileExtension(String filename) {
        int lastDotIndex = filename.lastIndexOf(".");
        if (lastDotIndex == -1) {
            return "";
        }
        return filename.substring(lastDotIndex + 1).toLowerCase();
    }

    /**
     * 检查是否为允许的扩展名
     */
    private boolean isAllowedExtension(String extension) {
        for (String allowed : ALLOWED_EXTENSIONS) {
            if (allowed.equalsIgnoreCase(extension)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检查是否为图片扩展名
     */
    private boolean isImageExtension(String extension) {
        String[] imageExtensions = {"jpg", "jpeg", "png", "gif", "bmp", "webp"};
        for (String imgExt : imageExtensions) {
            if (imgExt.equalsIgnoreCase(extension)) {
                return true;
            }
        }
        return false;
    }
}
