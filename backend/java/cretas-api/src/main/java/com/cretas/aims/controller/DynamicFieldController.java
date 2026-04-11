package com.cretas.aims.controller;

import com.cretas.aims.engine.DynamicFieldService;
import com.cretas.aims.engine.DynamicTableService;
import com.cretas.aims.entity.config.CanvasDDLLog;
import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.repository.config.CanvasDDLLogRepository;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Round 4 Fix P0-6: added @PreAuthorize on mutating endpoints to restrict Canvas V3
 * dynamic field writes to FACTORY_SUPER_ADMIN / PERMISSION_ADMIN only.
 * Previously every factory user could add/modify fields.
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}")
@RequiredArgsConstructor
public class DynamicFieldController {

    private final CanvasDynamicFieldRepository fieldRepo;
    private final CanvasDDLLogRepository ddlLogRepo;
    private final DynamicFieldService dynamicFieldService;
    private final DynamicTableService dynamicTableService;

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
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'PLATFORM_SUPER_ADMIN')")
    public ResponseEntity<CanvasDynamicField> createDynamicField(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body) {
        CanvasDynamicField field = CanvasDynamicField.builder()
            .factoryId(factoryId)
            .moduleCode((String) body.get("moduleCode"))
            .fieldCode((String) body.get("fieldCode"))
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
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'PLATFORM_SUPER_ADMIN')")
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
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'PLATFORM_SUPER_ADMIN')")
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
    public ResponseEntity<List<CanvasDDLLog>> getDDLLog(@PathVariable String factoryId) {
        return ResponseEntity.ok(ddlLogRepo.findByFactoryIdOrderByCreatedAtDesc(factoryId));
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
    @org.springframework.security.access.prepost.PreAuthorize(
        "hasAnyRole('FACTORY_SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN')")
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
