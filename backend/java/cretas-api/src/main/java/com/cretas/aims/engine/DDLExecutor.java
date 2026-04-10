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
                fieldRepo.save(field);
                logEntry.setStatus("EXECUTED");
                logEntry.setExecutedAt(LocalDateTime.now());
                ddlLogRepo.save(logEntry);
                log.info("DDL executed: {} -> {}.{}", field.getFieldType(), field.getModuleCode(), field.getColumnName());
            } catch (Exception e) {
                logEntry.setStatus("FAILED");
                logEntry.setErrorMessage(e.getMessage());
                ddlLogRepo.save(logEntry);
                throw new BusinessException("DDL execution failed [" + field.getModuleCode() + "." + field.getFieldCode() + "]: " + e.getMessage());
            }
        }
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
