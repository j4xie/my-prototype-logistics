package com.cretas.aims.service.impl;

import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.FieldCapabilityMapping;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.repository.FieldCapabilityMappingRepository;
import com.cretas.aims.service.FieldVisibilityService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.Query;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;

@Service
public class FieldVisibilityServiceImpl implements FieldVisibilityService {

    private static final Logger log = LoggerFactory.getLogger(FieldVisibilityServiceImpl.class);

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private FactoryRepository factoryRepository;

    @Autowired
    private FieldCapabilityMappingRepository fieldCapabilityMappingRepository;

    @Value("${python.service.url:http://localhost:8083}")
    private String pythonServiceUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder().build();

    @Override
    public Map<String, List<String>> getHiddenFields(String factoryId) {
        // 1. Check cache first
        Map<String, List<String>> cached = getCachedVisibility(factoryId);
        if (cached != null && !cached.isEmpty()) {
            return cached;
        }

        // 2. Compute from survey data
        return computeHiddenFields(factoryId);
    }

    @Override
    public boolean isFieldVisible(String factoryId, String entityType, String fieldKey) {
        Map<String, List<String>> hidden = getHiddenFields(factoryId);
        List<String> hiddenFields = hidden.getOrDefault(entityType, Collections.emptyList());
        return !hiddenFields.contains(fieldKey);
    }

    @Override
    @Transactional
    public void recomputeVisibility(String factoryId) {
        Map<String, List<String>> result = computeHiddenFields(factoryId);
        cacheVisibility(factoryId, result);
    }

    @SuppressWarnings("unchecked")
    private Map<String, List<String>> computeHiddenFields(String factoryId) {
        Map<String, List<String>> result = new HashMap<>();

        try {
            Optional<Factory> factoryOpt = factoryRepository.findById(factoryId);
            if (factoryOpt.isEmpty()) {
                log.warn("Factory not found: {}", factoryId);
                return result;
            }

            Factory factory = factoryOpt.get();
            String companyId = factory.getSurveyCompanyId();
            if (companyId == null || companyId.isBlank()) {
                log.debug("Factory {} has no survey company linked, all fields visible", factoryId);
                cacheVisibility(factoryId, result);
                return result;
            }

            // Call Python to get not-applicable fields
            List<Map<String, Object>> notApplicableFields = fetchNotApplicableFields(companyId);
            if (notApplicableFields.isEmpty()) {
                log.debug("No not-applicable fields for company {}", companyId);
                cacheVisibility(factoryId, result);
                return result;
            }

            // Build a lookup set of (section_html, row_index_html) that are not applicable
            Set<String> naKeys = new HashSet<>();
            for (Map<String, Object> field : notApplicableFields) {
                String section = (String) field.get("section");
                Object rowIdx = field.get("rowIndex");
                if (section != null && rowIdx != null) {
                    naKeys.add(section + ":" + rowIdx);
                }
            }

            // Get all mappings that have HTML section info
            List<FieldCapabilityMapping> mappings = fieldCapabilityMappingRepository.findBySurveySectionHtmlIsNotNull();

            for (FieldCapabilityMapping mapping : mappings) {
                String key = mapping.getSurveySectionHtml() + ":" + mapping.getSurveyRowIndexHtml();
                if (naKeys.contains(key)) {
                    // This field is declared "not applicable" → hide it
                    result.computeIfAbsent(mapping.getEntityType(), k -> new ArrayList<>())
                            .add(mapping.getEntityField());
                }
            }

            log.info("Computed hidden fields for factory {}: {} entity types, {} fields total",
                    factoryId, result.size(),
                    result.values().stream().mapToInt(List::size).sum());

        } catch (Exception e) {
            log.error("Failed to compute field visibility for factory {}", factoryId, e);
        }

        cacheVisibility(factoryId, result);
        return result;
    }

    /**
     * Call Python /api/public/client-requirement/{companyId}/not-applicable-fields
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchNotApplicableFields(String companyId) {
        try {
            String url = pythonServiceUrl + "/api/public/client-requirement/" + companyId + "/not-applicable-fields";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .header("Accept", "application/json")
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Map<String, Object> body = objectMapper.readValue(response.body(), new TypeReference<>() {});
                if (Boolean.TRUE.equals(body.get("success"))) {
                    return (List<Map<String, Object>>) body.get("data");
                }
            }
            log.warn("Python not-applicable-fields returned status {}", response.statusCode());
        } catch (Exception e) {
            log.warn("Failed to fetch not-applicable fields from Python for company {}: {}", companyId, e.getMessage());
        }
        return Collections.emptyList();
    }

    @SuppressWarnings("unchecked")
    private Map<String, List<String>> getCachedVisibility(String factoryId) {
        try {
            Query query = entityManager.createNativeQuery(
                "SELECT entity_type, hidden_fields FROM factory_field_visibility WHERE factory_id = :factoryId"
            );
            query.setParameter("factoryId", factoryId);

            List<Object[]> rows = query.getResultList();
            Map<String, List<String>> result = new HashMap<>();

            for (Object[] row : rows) {
                String entityType = (String) row[0];
                String hiddenJson = row[1] != null ? row[1].toString() : "[]";
                List<String> hiddenFields = objectMapper.readValue(hiddenJson, new TypeReference<List<String>>() {});
                result.put(entityType, hiddenFields);
            }

            return result;
        } catch (Exception e) {
            log.debug("No cached visibility for factory {}: {}", factoryId, e.getMessage());
            return null;
        }
    }

    // Mapping from entityType enum values to actual database table names
    private static final Map<String, String> ENTITY_TABLE_MAP = Map.of(
        "PROCESSING_BATCH", "production_batches",
        "WORK_SESSION", "employee_work_sessions",
        "MATERIAL_BATCH", "material_batches",
        "QUALITY_INSPECTION", "quality_inspections",
        "EQUIPMENT", "factory_equipment"
    );

    // Columns to exclude from null-rate analysis (internal/audit fields)
    private static final Set<String> EXCLUDED_COLUMNS = Set.of(
        "id", "created_at", "updated_at", "deleted_at"
    );

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Double> getFieldNullCounts(String factoryId, String entityType) {
        Map<String, Double> result = new LinkedHashMap<>();

        String tableName = ENTITY_TABLE_MAP.get(entityType);
        if (tableName == null) {
            throw new IllegalArgumentException(
                "Unknown entity type: " + entityType +
                ". Supported types: " + ENTITY_TABLE_MAP.keySet());
        }

        try {
            // Step 1: Check the table exists by querying information_schema
            List<Object[]> columns = entityManager.createNativeQuery(
                "SELECT column_name FROM information_schema.columns " +
                "WHERE table_name = :tableName ORDER BY ordinal_position"
            ).setParameter("tableName", tableName).getResultList();

            if (columns.isEmpty()) {
                throw new IllegalArgumentException(
                    "Table '" + tableName + "' does not exist or has no columns");
            }

            // Step 2: Build a single query that computes null count per column
            // For each column: (COUNT(*) - COUNT(column_name)) * 100.0 / NULLIF(COUNT(*), 0)
            List<String> columnNames = new ArrayList<>();
            for (Object col : columns) {
                // information_schema returns single column, may be String or Object[]
                String colName;
                if (col instanceof Object[]) {
                    colName = (String) ((Object[]) col)[0];
                } else {
                    colName = col.toString();
                }
                if (!EXCLUDED_COLUMNS.contains(colName)) {
                    columnNames.add(colName);
                }
            }

            if (columnNames.isEmpty()) {
                return result;
            }

            // Build the dynamic SQL with factory_id filter if the table has that column
            boolean hasFactoryId = columnNames.contains("factory_id");

            StringBuilder sql = new StringBuilder("SELECT COUNT(*) AS total_rows");
            for (String col : columnNames) {
                // COUNT(col) counts non-null values; COUNT(*) - COUNT(col) = null count
                sql.append(", COUNT(\"").append(col).append("\") AS cnt_").append(col.replace("-", "_"));
            }
            sql.append(" FROM ").append(tableName);

            if (hasFactoryId) {
                sql.append(" WHERE factory_id = :factoryId");
            }

            Query query = entityManager.createNativeQuery(sql.toString());
            if (hasFactoryId) {
                query.setParameter("factoryId", factoryId);
            }

            Object[] row = (Object[]) query.getSingleResult();
            long totalRows = ((Number) row[0]).longValue();

            if (totalRows == 0) {
                // No data rows: all fields are 100% null
                for (String col : columnNames) {
                    result.put(snakeToCamel(col), 100.0);
                }
                return result;
            }

            // Step 3: Compute null rate for each column
            for (int i = 0; i < columnNames.size(); i++) {
                long nonNullCount = ((Number) row[i + 1]).longValue();
                long nullCount = totalRows - nonNullCount;
                double nullRate = (nullCount * 100.0) / totalRows;
                // Round to 1 decimal place
                nullRate = Math.round(nullRate * 10.0) / 10.0;
                result.put(snakeToCamel(columnNames.get(i)), nullRate);
            }

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to compute field null counts for entityType={}, factoryId={}",
                    entityType, factoryId, e);
            throw new RuntimeException("Failed to compute field null counts: " + e.getMessage(), e);
        }

        return result;
    }

    /**
     * Convert snake_case column name to camelCase field name.
     * e.g. "batch_number" -> "batchNumber"
     */
    private String snakeToCamel(String snake) {
        StringBuilder sb = new StringBuilder();
        boolean upperNext = false;
        for (char c : snake.toCharArray()) {
            if (c == '_') {
                upperNext = true;
            } else {
                sb.append(upperNext ? Character.toUpperCase(c) : c);
                upperNext = false;
            }
        }
        return sb.toString();
    }

    private void cacheVisibility(String factoryId, Map<String, List<String>> visibility) {
        try {
            for (Map.Entry<String, List<String>> entry : visibility.entrySet()) {
                String hiddenJson = objectMapper.writeValueAsString(entry.getValue());

                entityManager.createNativeQuery("""
                    INSERT INTO factory_field_visibility (factory_id, entity_type, hidden_fields, last_computed_at, created_at, updated_at)
                    VALUES (:factoryId, :entityType, CAST(:hidden AS jsonb), NOW(), NOW(), NOW())
                    ON CONFLICT (factory_id, entity_type)
                    DO UPDATE SET hidden_fields = CAST(:hidden AS jsonb), last_computed_at = NOW(), updated_at = NOW()
                    """)
                    .setParameter("factoryId", factoryId)
                    .setParameter("entityType", entry.getKey())
                    .setParameter("hidden", hiddenJson)
                    .executeUpdate();
            }
        } catch (Exception e) {
            log.error("Failed to cache visibility for factory {}", factoryId, e);
        }
    }
}
