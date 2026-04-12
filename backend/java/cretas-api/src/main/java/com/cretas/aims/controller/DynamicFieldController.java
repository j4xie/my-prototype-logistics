package com.cretas.aims.controller;

import com.cretas.aims.config.RequireRole;
import com.cretas.aims.engine.DynamicFieldService;
import com.cretas.aims.engine.DynamicTableService;
import com.cretas.aims.entity.config.CanvasDDLLog;
import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.repository.config.CanvasDDLLogRepository;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Round 4 Fix P0-6: added @PreAuthorize on mutating endpoints to restrict Canvas V3
 * dynamic field writes to FACTORY_SUPER_ADMIN / PERMISSION_ADMIN only.
 * Previously every factory user could add/modify fields.
 *
 * Round 5 Fix SEC-3/SEC-4: input validation for fieldCode, moduleCode, sub-table
 * path vars to prevent SQL injection through the DDL pipeline.
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}")
@RequiredArgsConstructor
public class DynamicFieldController {

    private final CanvasDynamicFieldRepository fieldRepo;
    private final CanvasDDLLogRepository ddlLogRepo;
    private final DynamicFieldService dynamicFieldService;
    private final DynamicTableService dynamicTableService;

    // Round 5 Fix SEC-3: strict identifier pattern for SQL-bound names
    private static final java.util.regex.Pattern IDENTIFIER_PATTERN =
        java.util.regex.Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_]{1,60}$");
    private static final java.util.regex.Pattern MODULE_CODE_PATTERN =
        java.util.regex.Pattern.compile("^[a-z][a-z0-9_]{1,50}$");

    private static void validateIdentifier(String name, String paramName) {
        if (name == null || !IDENTIFIER_PATTERN.matcher(name).matches()) {
            throw new IllegalArgumentException(paramName + " 必须匹配 [a-zA-Z_][a-zA-Z0-9_]{1,60}");
        }
    }

    private static void validateModuleCode(String moduleCode) {
        if (moduleCode == null || !MODULE_CODE_PATTERN.matcher(moduleCode).matches()) {
            throw new IllegalArgumentException("moduleCode 必须匹配 [a-z][a-z0-9_]{1,50}");
        }
    }

    // --- Dynamic Field Definition CRUD ---

    @GetMapping("/config/v2/dynamic-fields")
    public ResponseEntity<List<CanvasDynamicField>> getDynamicFields(
            @PathVariable String factoryId,
            @RequestParam(required = false) String moduleCode) {
        List<CanvasDynamicField> fields = moduleCode != null
            ? fieldRepo.findByModuleCodeForFactory(factoryId, moduleCode)
            : fieldRepo.findByFactoryIdAndStatus(factoryId, "ACTIVE");
        return ResponseEntity.ok(fields);
    }

    @SuppressWarnings("unchecked")
    @PostMapping("/config/v2/dynamic-fields")
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<CanvasDynamicField> createDynamicField(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body) {
        // Round 5 Fix SEC-3: validate identifiers before using as SQL column name
        String moduleCode = (String) body.get("moduleCode");
        String fieldCode = (String) body.get("fieldCode");
        validateModuleCode(moduleCode);
        validateIdentifier(fieldCode, "fieldCode");

        CanvasDynamicField field = CanvasDynamicField.builder()
            .factoryId(factoryId)
            .moduleCode(moduleCode)
            .fieldCode(fieldCode)
            .fieldType((String) body.get("fieldType"))
            .label((String) body.get("label"))
            .config(body.containsKey("config") ? (Map<String, Object>) body.get("config") : Map.of())
            .visibleWhen((String) body.get("visibleWhen"))
            .computedWhen((String) body.get("computedWhen"))
            .sortOrder(body.containsKey("sortOrder") ? ((Number) body.get("sortOrder")).intValue() : 0)
            .status("PENDING_DDL")
            .build();
        field.setColumnName("cf_" + field.getFieldCode());
        return ResponseEntity.ok(fieldRepo.save(field));
    }

    @SuppressWarnings("unchecked")
    @PutMapping("/config/v2/dynamic-fields/{fieldCode}")
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<CanvasDynamicField> updateDynamicField(
            @PathVariable String factoryId,
            @PathVariable String fieldCode,
            @RequestBody Map<String, Object> body) {
        String moduleCode = (String) body.get("moduleCode");
        CanvasDynamicField existing = fieldRepo.findByFactoryIdAndModuleCodeAndFieldCode(
            factoryId, moduleCode, fieldCode).orElseThrow();
        if (body.containsKey("label")) existing.setLabel((String) body.get("label"));
        if (body.containsKey("config")) existing.setConfig((Map<String, Object>) body.get("config"));
        if (body.containsKey("visibleWhen")) existing.setVisibleWhen((String) body.get("visibleWhen"));
        if (body.containsKey("computedWhen")) existing.setComputedWhen((String) body.get("computedWhen"));
        if (body.containsKey("sortOrder")) existing.setSortOrder(((Number) body.get("sortOrder")).intValue());
        return ResponseEntity.ok(fieldRepo.save(existing));
    }

    @DeleteMapping("/config/v2/dynamic-fields/{fieldCode}")
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<Void> disableDynamicField(
            @PathVariable String factoryId,
            @PathVariable String fieldCode,
            @RequestParam String moduleCode) {
        CanvasDynamicField existing = fieldRepo.findByFactoryIdAndModuleCodeAndFieldCode(
            factoryId, moduleCode, fieldCode).orElseThrow();
        existing.setStatus("DISABLED");
        fieldRepo.save(existing);
        dynamicFieldService.refreshCache(factoryId, moduleCode);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/config/v2/ddl-log")
    public ResponseEntity<Map<String, Object>> getDDLLog(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        // Round 5 Fix PERF-3: paginate DDL log. Previously returned ALL rows unbounded;
        // busy factories accumulate thousands of DDL entries and would OOM the JVM on load.
        int clampedSize = Math.min(Math.max(size, 1), 500);
        var pageResult = ddlLogRepo.findByFactoryIdOrderByCreatedAtDesc(
                factoryId,
                org.springframework.data.domain.PageRequest.of(Math.max(page, 0), clampedSize));
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("content", pageResult.getContent());
        result.put("totalElements", pageResult.getTotalElements());
        result.put("totalPages", pageResult.getTotalPages());
        result.put("number", pageResult.getNumber());
        result.put("size", pageResult.getSize());
        return ResponseEntity.ok(result);
    }

    /**
     * Round 4 Fix P1-18: Change field type via ALTER COLUMN TYPE with USING cast.
     *
     * Supported transitions (with data preservation):
     *   TEXT → NUMBER / DECIMAL  (USING col::numeric, fails if data not numeric)
     *   TEXT → DATE / DATETIME   (USING col::timestamp, fails if not parseable)
     *   NUMBER ↔ DECIMAL         (always safe)
     *   NUMBER / DECIMAL → TEXT  (always safe, USING col::text)
     *
     * Unsafe transitions (e.g. DATE → NUMBER) return 400.
     */
    @PostMapping("/config/v2/dynamic-fields/{fieldCode}/change-type")
    @RequireRole({"factory_super_admin"})
    public ResponseEntity<?> changeFieldType(
            @PathVariable String factoryId,
            @PathVariable String fieldCode,
            @RequestBody Map<String, Object> body) {
        String moduleCode = (String) body.get("moduleCode");
        String newType = (String) body.get("newType");
        if (newType == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "newType is required"));
        }

        CanvasDynamicField existing = fieldRepo.findByFactoryIdAndModuleCodeAndFieldCode(
            factoryId, moduleCode, fieldCode).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }

        String oldType = existing.getFieldType();
        if (oldType.equalsIgnoreCase(newType)) {
            return ResponseEntity.ok(existing);
        }

        // R26 fix: PENDING_DDL fields have no cf_* column yet — ALTER TABLE would fail.
        // Only allow type change on ACTIVE fields that have been through DDL.
        if ("PENDING_DDL".equals(existing.getStatus())) {
            // Safe path: just update the type in metadata, DDL will use the new type on next publish
            existing.setFieldType(newType.toUpperCase());
            fieldRepo.save(existing);
            return ResponseEntity.ok(existing);
        }

        try {
            dynamicFieldService.changeFieldType(existing, newType);
            return ResponseEntity.ok(existing);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage(), "oldType", oldType, "newType", newType));
        }
    }

    // --- Sub-table CRUD ---

    @GetMapping("/{moduleCode}/{recordId}/sub-table/{fieldCode}")
    public ResponseEntity<List<Map<String, Object>>> getSubTableRows(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @PathVariable String fieldCode,
            @RequestParam(required = false) Map<String, String> filters) {
        // Round 4 Fix P1-13: filters query params are forwarded to DynamicTableService.
        // Supported keys: cf_xxx (exact match), dateFrom, dateTo, limit.
        // Round 5 Fix SEC-4: validate path variables before building table name (injection guard)
        validateModuleCode(moduleCode);
        validateIdentifier(fieldCode, "fieldCode");
        String subTableName = moduleCode + "_" + fieldCode + "_items";
        Map<String, Object> filterMap = new java.util.HashMap<>();
        if (filters != null) {
            for (Map.Entry<String, String> e : filters.entrySet()) {
                // Spring injects path variables into @RequestParam Map too; filter them out.
                if ("factoryId".equals(e.getKey()) || "moduleCode".equals(e.getKey())
                        || "recordId".equals(e.getKey()) || "fieldCode".equals(e.getKey())) continue;
                filterMap.put(e.getKey(), e.getValue());
            }
        }
        return ResponseEntity.ok(dynamicTableService.getRows(subTableName, recordId, filterMap));
    }

    @PostMapping("/{moduleCode}/{recordId}/sub-table/{fieldCode}")
    public ResponseEntity<Map<String, Object>> addSubTableRow(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @PathVariable String fieldCode,
            @RequestBody Map<String, Object> row) {
        // Round 5 Fix SEC-4
        validateModuleCode(moduleCode);
        validateIdentifier(fieldCode, "fieldCode");
        String subTableName = moduleCode + "_" + fieldCode + "_items";
        return ResponseEntity.ok(dynamicTableService.addRow(subTableName, recordId, row));
    }

    @PutMapping("/{moduleCode}/{recordId}/sub-table/{fieldCode}/{rowId}")
    public ResponseEntity<Void> updateSubTableRow(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @PathVariable String fieldCode,
            @PathVariable String rowId,
            @RequestBody Map<String, Object> row) {
        // Round 5 Fix SEC-4
        validateModuleCode(moduleCode);
        validateIdentifier(fieldCode, "fieldCode");
        String subTableName = moduleCode + "_" + fieldCode + "_items";
        dynamicTableService.updateRow(subTableName, rowId, row);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{moduleCode}/{recordId}/sub-table/{fieldCode}/{rowId}")
    public ResponseEntity<Void> deleteSubTableRow(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @PathVariable String fieldCode,
            @PathVariable String rowId) {
        // Round 5 Fix SEC-4
        validateModuleCode(moduleCode);
        validateIdentifier(fieldCode, "fieldCode");
        String subTableName = moduleCode + "_" + fieldCode + "_items";
        dynamicTableService.deleteRow(subTableName, rowId);
        return ResponseEntity.noContent().build();
    }

    // --- Dynamic field values for a record ---

    @GetMapping("/{moduleCode}/{recordId}/custom-fields")
    public ResponseEntity<Map<String, Object>> getCustomFields(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId) {
        return ResponseEntity.ok(dynamicFieldService.getDynamicFields(factoryId, moduleCode, recordId));
    }

    @PutMapping("/{moduleCode}/{recordId}/custom-fields")
    public ResponseEntity<Void> setCustomFields(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @RequestBody Map<String, Object> fields) {
        dynamicFieldService.setDynamicFields(factoryId, moduleCode, recordId, fields);
        return ResponseEntity.ok().build();
    }
}
