package com.cretas.aims.engine;

import com.cretas.aims.entity.config.CanvasDDLLog;
import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.config.CanvasDDLLogRepository;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DDLExecutor {

    private final JdbcTemplate jdbcTemplate;
    private final CanvasDynamicFieldRepository fieldRepo;
    private final CanvasDDLLogRepository ddlLogRepo;

    private static final Map<String, String> MODULE_TABLE_MAP = Map.ofEntries(
        Map.entry("sales_order", "sales_orders"),
        Map.entry("bom", "bom_items"),
        Map.entry("production_plan", "production_plans"),
        Map.entry("production_report", "process_work_reports"),
        Map.entry("purchase_order", "purchase_orders"),
        Map.entry("quality_inspection", "quality_inspections"),
        Map.entry("equipment", "equipment"),
        Map.entry("material_batch", "material_batches"),
        Map.entry("customer", "customers"),
        Map.entry("supplier", "suppliers"),
        Map.entry("transfer", "inventory_transfers"),
        Map.entry("invoice_record", "invoice_records"),
        Map.entry("rd_sample", "product_samples"),
        Map.entry("material_requisition", "factory_material_requisitions"),
        Map.entry("product", "products"),
        Map.entry("inventory", "inventory_items"),
        Map.entry("hr_employee", "employees")
    );

    @Transactional
    public void executePendingDDL(String factoryId, int configVersion) {
        List<CanvasDynamicField> pending = fieldRepo.findByFactoryIdAndStatus(factoryId, "PENDING_DDL");
        if (pending.isEmpty()) {
            log.info("No pending DDL for factory {}", factoryId);
            return;
        }

        log.info("Executing {} pending DDL statements for factory {}", pending.size(), factoryId);
        for (CanvasDynamicField field : pending) {
            // Pre-check: detect type conflict for shared columns across factories
            String conflictError = checkTypeConflict(field);
            if (conflictError != null) {
                CanvasDDLLog conflictLog = CanvasDDLLog.builder()
                    .factoryId(factoryId)
                    .configVersion(configVersion)
                    .ddlStatement("-- type conflict detected, not executed")
                    .targetTable(resolveTableName(field))
                    .status("FAILED")
                    .errorMessage(conflictError)
                    .build();
                ddlLogRepo.save(conflictLog);
                throw new BusinessException(conflictError);
            }

            String ddl = generateDDL(field);
            CanvasDDLLog logEntry = CanvasDDLLog.builder()
                .factoryId(factoryId)
                .configVersion(configVersion)
                .ddlStatement(ddl)
                .targetTable(resolveTableName(field))
                .status("PENDING")
                .build();
            ddlLogRepo.save(logEntry);

            try {
                jdbcTemplate.execute(ddl);
                field.setStatus("ACTIVE");
                // Round 4 Fix P0-5: record the config version at which this field first went active
                // This enables rollback to disable fields added in later versions.
                if (field.getActiveFromVersion() == null) {
                    field.setActiveFromVersion(configVersion);
                }
                fieldRepo.save(field);
                logEntry.setStatus("EXECUTED");
                logEntry.setExecutedAt(LocalDateTime.now());
                ddlLogRepo.save(logEntry);
                log.info("DDL executed: {} -> {}.{} (v{})", field.getFieldType(), field.getModuleCode(), field.getColumnName(), configVersion);
            } catch (Exception e) {
                logEntry.setStatus("FAILED");
                logEntry.setErrorMessage(e.getMessage());
                ddlLogRepo.save(logEntry);
                throw new BusinessException("DDL execution failed [" + field.getModuleCode() + "." + field.getFieldCode() + "]: " + e.getMessage());
            }
        }
    }

    /**
     * Check if target column already exists with an incompatible type.
     * Returns null if no conflict, or an error message if a conflict is detected.
     * Sub-tables are skipped — table name uniqueness is enforced by the naming scheme.
     */
    private String checkTypeConflict(CanvasDynamicField field) {
        if ("SUB_TABLE".equals(field.getFieldType())) {
            return null;
        }
        String tableName = resolveTableName(field);
        String colName = field.getColumnName();
        if (colName == null) {
            return null;
        }
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT data_type, character_maximum_length, numeric_precision, numeric_scale " +
                "FROM information_schema.columns WHERE table_name = ? AND column_name = ?",
                tableName, colName
            );
            if (rows.isEmpty()) {
                return null; // column does not exist, no conflict
            }
            String existingDataType = String.valueOf(rows.get(0).get("data_type"));
            String expectedSql = mapFieldTypeToSQL(field.getFieldType());
            if (!isCompatible(existingDataType, expectedSql)) {
                return "DDL type conflict: column " + tableName + "." + colName +
                       " already exists as " + existingDataType +
                       " but factory " + field.getFactoryId() +
                       " requested " + field.getFieldType() + " (" + expectedSql + "). " +
                       "Rename the fieldCode to avoid cross-factory collision.";
            }
            return null;
        } catch (Exception e) {
            log.warn("Type conflict check failed for {}.{}: {}", tableName, colName, e.getMessage());
            return null; // fail-open: do not block on metadata query errors
        }
    }

    /**
     * Check if an existing PostgreSQL data_type is compatible with the expected SQL type.
     * Maps our mapFieldTypeToSQL() output family to PG information_schema.data_type values.
     */
    private boolean isCompatible(String existingDataType, String expectedSql) {
        if (existingDataType == null) return true;
        String existing = existingDataType.toLowerCase();
        String expected = expectedSql.toLowerCase();

        if (expected.startsWith("varchar")) {
            return existing.equals("character varying") || existing.equals("text");
        }
        if (expected.startsWith("integer")) {
            return existing.equals("integer") || existing.equals("bigint") || existing.equals("smallint");
        }
        if (expected.startsWith("numeric")) {
            return existing.equals("numeric") || existing.equals("decimal");
        }
        if (expected.startsWith("timestamp")) {
            return existing.contains("timestamp") || existing.equals("date");
        }
        return false;
    }

    private String generateDDL(CanvasDynamicField field) {
        if ("SUB_TABLE".equals(field.getFieldType())) {
            return generateSubTableDDL(field);
        }
        String tableName = resolveTableName(field);
        String colName = field.getColumnName();
        String colType = mapFieldTypeToSQL(field.getFieldType());
        return "ALTER TABLE " + tableName + " ADD COLUMN IF NOT EXISTS " + colName + " " + colType;
    }

    @SuppressWarnings("unchecked")
    private String generateSubTableDDL(CanvasDynamicField field) {
        String subTableName = field.getModuleCode() + "_" + field.getFieldCode() + "_items";
        StringBuilder sb = new StringBuilder();
        sb.append("CREATE TABLE IF NOT EXISTS ").append(subTableName).append(" (");
        sb.append("id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ");
        sb.append("parent_id UUID NOT NULL, ");

        List<Map<String, Object>> columns = (List<Map<String, Object>>) field.getConfig().get("columns");
        if (columns != null) {
            for (Map<String, Object> col : columns) {
                String code = (String) col.get("code");
                String type = (String) col.getOrDefault("type", "TEXT");
                sb.append("cf_").append(code).append(" ").append(mapFieldTypeToSQL(type)).append(", ");
            }
        }
        sb.append("created_at TIMESTAMP DEFAULT NOW(), ");
        sb.append("updated_at TIMESTAMP DEFAULT NOW()");
        sb.append("); ");
        sb.append("CREATE INDEX IF NOT EXISTS idx_").append(subTableName).append("_parent ON ").append(subTableName).append("(parent_id)");
        return sb.toString();
    }

    private String resolveTableName(CanvasDynamicField field) {
        return MODULE_TABLE_MAP.getOrDefault(field.getModuleCode(), field.getModuleCode());
    }

    public String resolveTable(String moduleCode) {
        return MODULE_TABLE_MAP.getOrDefault(moduleCode, moduleCode);
    }

    private String mapFieldTypeToSQL(String fieldType) {
        return switch (fieldType) {
            case "TEXT" -> "VARCHAR(500)";
            case "NUMBER" -> "INTEGER";
            case "DECIMAL" -> "NUMERIC(18,4)";
            case "SELECT" -> "VARCHAR(100)";
            case "DATE" -> "TIMESTAMP";
            case "ATTACHMENT" -> "VARCHAR(2000)";
            default -> "VARCHAR(500)";
        };
    }
}
