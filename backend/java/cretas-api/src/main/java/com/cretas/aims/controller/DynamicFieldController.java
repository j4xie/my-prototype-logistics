package com.cretas.aims.controller;

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

    @PostMapping("/config/v2/dynamic-fields")
    public ResponseEntity<CanvasDynamicField> createDynamicField(
            @PathVariable String factoryId,
            @RequestBody CanvasDynamicField field) {
        field.setFactoryId(factoryId);
        field.setStatus("PENDING_DDL");
        if (field.getColumnName() == null) {
            field.setColumnName("cf_" + field.getFieldCode());
        }
        return ResponseEntity.ok(fieldRepo.save(field));
    }

    @PutMapping("/config/v2/dynamic-fields/{fieldCode}")
    public ResponseEntity<CanvasDynamicField> updateDynamicField(
            @PathVariable String factoryId,
            @PathVariable String fieldCode,
            @RequestBody CanvasDynamicField update) {
        CanvasDynamicField existing = fieldRepo.findByFactoryIdAndModuleCodeAndFieldCode(
            factoryId, update.getModuleCode(), fieldCode).orElseThrow();
        if (update.getLabel() != null) existing.setLabel(update.getLabel());
        if (update.getConfig() != null) existing.setConfig(update.getConfig());
        if (update.getVisibleWhen() != null) existing.setVisibleWhen(update.getVisibleWhen());
        if (update.getComputedWhen() != null) existing.setComputedWhen(update.getComputedWhen());
        if (update.getSortOrder() != null) existing.setSortOrder(update.getSortOrder());
        return ResponseEntity.ok(fieldRepo.save(existing));
    }

    @DeleteMapping("/config/v2/dynamic-fields/{fieldCode}")
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

    // --- Sub-table CRUD ---

    @GetMapping("/{moduleCode}/{recordId}/sub-table/{fieldCode}")
    public ResponseEntity<List<Map<String, Object>>> getSubTableRows(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @PathVariable String fieldCode) {
        String subTableName = moduleCode + "_" + fieldCode + "_items";
        return ResponseEntity.ok(dynamicTableService.getRows(subTableName, recordId));
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
