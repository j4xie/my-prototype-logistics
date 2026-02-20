package com.cretas.aims.service.smartbi.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * SmartBI File Storage Service
 *
 * Stores uploaded Excel files to disk for retry capability.
 * Files are organized by factoryId under the configured storage path.
 *
 * @author Cretas Team
 * @since 2026-02-09
 */
@Slf4j
@Service
public class SmartBIFileStorageService {

    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    @Value("${smartbi.file-storage.path:uploads/smartbi}")
    private String storagePath;

    /**
     * Store an Excel file to disk
     *
     * @param factoryId  Factory ID for directory isolation
     * @param fileName   Original file name
     * @param fileBytes  File content
     * @return Relative path to stored file
     */
    public String storeFile(String factoryId, String fileName, byte[] fileBytes) {
        try {
            Path factoryDir = Paths.get(storagePath, factoryId);
            Files.createDirectories(factoryDir);

            String timestamp = LocalDateTime.now().format(TIMESTAMP_FORMAT);
            String safeFileName = sanitizeFileName(fileName);
            String storedName = timestamp + "_" + safeFileName;

            Path filePath = factoryDir.resolve(storedName);
            Files.write(filePath, fileBytes);

            String relativePath = factoryId + "/" + storedName;
            log.info("Stored Excel file: {} ({} bytes)", relativePath, fileBytes.length);
            return relativePath;
        } catch (IOException e) {
            log.error("Failed to store file: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Load a stored Excel file from disk
     *
     * @param relativePath Relative path returned by storeFile()
     * @return File bytes or null if not found
     */
    public byte[] loadFile(String relativePath) {
        try {
            Path filePath = Paths.get(storagePath, relativePath);
            if (!Files.exists(filePath)) {
                log.warn("File not found: {}", filePath);
                return null;
            }
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            log.error("Failed to load file: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Check if a stored file exists
     *
     * @param relativePath Relative path returned by storeFile()
     * @return true if file exists
     */
    public boolean fileExists(String relativePath) {
        if (relativePath == null || relativePath.isEmpty()) {
            return false;
        }
        return Files.exists(Paths.get(storagePath, relativePath));
    }

    /**
     * Delete a stored file
     *
     * @param relativePath Relative path returned by storeFile()
     * @return true if deleted successfully
     */
    public boolean deleteFile(String relativePath) {
        try {
            Path filePath = Paths.get(storagePath, relativePath);
            return Files.deleteIfExists(filePath);
        } catch (IOException e) {
            log.error("Failed to delete file: {}", e.getMessage(), e);
            return false;
        }
    }

    private String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return "unknown.xlsx";
        }
        // Remove path separators and special characters
        return fileName.replaceAll("[/\\\\:*?\"<>|]", "_");
    }
}
