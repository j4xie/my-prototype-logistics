package com.cretas.aims.engine;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class AggregateFormulaExecutor {

    private final JdbcTemplate jdbcTemplate;
    private final DDLExecutor ddlExecutor;

    private static final Pattern GROUP_BY_PATTERN =
        Pattern.compile("GROUP_BY\\(\\s*(\\w+)\\s*,\\s*'(\\w+)'\\s*,\\s*(\\w+)\\(\\s*'(\\w+)'\\s*\\)\\s*\\)");

    /** Round 4 Fix P1-15: RATIO(table, 'groupField', 'numeratorField', 'denominatorField')
     *  Computes SUM(numerator) / SUM(denominator) * 100 per group.
     *  Use case: BOM 达成率 = SUM(cf_actual) / SUM(cf_theory) * 100. */
    private static final Pattern RATIO_PATTERN =
        Pattern.compile("RATIO\\(\\s*(\\w+)\\s*,\\s*'(\\w+)'\\s*,\\s*'(\\w+)'\\s*,\\s*'(\\w+)'\\s*\\)");

    // Round 6 Fix Angle-6: hard-reject tables that don't have factory_id column.
    // Previously, a factory_super_admin could craft a formula like
    //   GROUP_BY(users, 'role_code', COUNT('id'))
    // which would read aggregate stats from a tenant-unscoped table (users, platform_admins,
    // config_change_log) because the factory_id filter was silently omitted when the target
    // table lacked the column. This guard now rejects those formulas outright.
    //
    // R6 P0-1b (canvas-security-e2e R6): the original guard rejected ALL sub-tables
    // because sub-tables legitimately don't have factory_id — they derive tenancy
    // from parent_id chaining to the factory-scoped parent table. This blocked
    // legitimate use cases like GROUP_BY(sales_order_prepay_items, 'cf_pay_date',
    // SUM('cf_amount')) for a specific sales order. The relaxed guard accepts such
    // sub-tables IFF the caller provides parentId, which forces a parent_id filter
    // (tenant scoping is still enforced, just indirectly via parent).
    private boolean isAcceptableForAggregation(String tableName, String parentId) {
        if (hasColumn(tableName, "factory_id")) return true;
        // Sub-table path: must have parent_id or order_id AND caller must provide parentId
        if (parentId != null) {
            if (hasColumn(tableName, "parent_id") || hasColumn(tableName, "order_id")) {
                return true;
            }
        }
        return false;
    }

    public List<Map<String, Object>> execute(String expression, Map<String, Object> context) {
        String expr = expression.trim();

        // Try RATIO first (bigger pattern) — Round 4 Fix P1-15
        Matcher ratioM = RATIO_PATTERN.matcher(expr);
        if (ratioM.matches()) {
            return executeRatio(ratioM, context);
        }

        Matcher m = GROUP_BY_PATTERN.matcher(expr);
        if (!m.matches()) {
            log.warn("Unsupported aggregate expression: {}", expression);
            return List.of();
        }

        String sourceTable = m.group(1);
        String groupField = m.group(2);
        String aggFunc = m.group(3).toUpperCase();
        String valueField = m.group(4);

        if (!Set.of("SUM", "COUNT", "AVG", "MIN", "MAX").contains(aggFunc)) {
            log.warn("Unsupported aggregate function: {}", aggFunc);
            return List.of();
        }

        String tableName = ddlExecutor.resolveTable(sourceTable);
        if (sourceTable.endsWith("_items")) {
            tableName = sourceTable;
        }

        String parentId = (String) context.get("parentId");
        String factoryId = (String) context.get("factoryId");

        // Round 6 Fix Angle-6 + R6 P0-1b: cross-tenant guard — reject tables that aren't
        // tenant-scoped. Sub-tables are acceptable IFF caller provides parentId (scoping
        // via parent_id chain). See isAcceptableForAggregation Javadoc.
        if (!isAcceptableForAggregation(tableName, parentId)) {
            log.warn("Aggregate formula rejected — target table '{}' is not tenant-scoped " +
                    "(no factory_id, and no parentId-based sub-table scoping): {}",
                    tableName, expression);
            return List.of();
        }

        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ").append(groupField).append(", ").append(aggFunc).append("(").append(valueField).append(") as agg_value");
        sql.append(" FROM ").append(tableName);

        List<Object> params = new ArrayList<>();
        List<String> wheres = new ArrayList<>();
        if (parentId != null) {
            // R6 Fix P0-1: type-aware cast (was hardcoded "?::uuid" — broke VARCHAR-id parents)
            if (hasColumn(tableName, "parent_id")) {
                wheres.add("parent_id = " + columnCastPlaceholder(tableName, "parent_id"));
                params.add(parentId);
            } else if (hasColumn(tableName, "order_id")) {
                wheres.add("order_id = " + columnCastPlaceholder(tableName, "order_id"));
                params.add(parentId);
            }
        }
        if (factoryId != null && hasColumn(tableName, "factory_id")) {
            wheres.add("factory_id = ?");
            params.add(factoryId);
        }

        if (!wheres.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", wheres));
        }
        sql.append(" GROUP BY ").append(groupField);

        log.debug("Aggregate SQL: {} params: {}", sql, params);
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    /** Round 4 Fix P1-15: RATIO execution — SUM(a)/SUM(b)*100 per group */
    private List<Map<String, Object>> executeRatio(Matcher m, Map<String, Object> context) {
        String sourceTable = m.group(1);
        String groupField = m.group(2);
        String numField = m.group(3);
        String denField = m.group(4);

        String tableName = ddlExecutor.resolveTable(sourceTable);
        if (sourceTable.endsWith("_items")) {
            tableName = sourceTable;
        }

        String parentId = (String) context.get("parentId");
        String factoryId = (String) context.get("factoryId");

        // R6 P0-1b: same guard as GROUP_BY — accept factory_id tables OR sub-tables with parentId scoping
        if (!isAcceptableForAggregation(tableName, parentId)) {
            log.warn("Ratio formula rejected — target table '{}' is not tenant-scoped",
                    tableName);
            return List.of();
        }

        // PostgreSQL: NULLIF protects against divide-by-zero
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ").append(groupField)
           .append(", SUM(").append(numField).append(") as numerator")
           .append(", SUM(").append(denField).append(") as denominator")
           .append(", ROUND(SUM(").append(numField).append(")::numeric / NULLIF(SUM(").append(denField).append("), 0)::numeric * 100, 2) as ratio_pct")
           .append(" FROM ").append(tableName);

        List<Object> params = new ArrayList<>();
        List<String> wheres = new ArrayList<>();
        if (parentId != null) {
            // R6 Fix P0-1: type-aware cast (same as GROUP_BY above)
            if (hasColumn(tableName, "parent_id")) {
                wheres.add("parent_id = " + columnCastPlaceholder(tableName, "parent_id"));
                params.add(parentId);
            } else if (hasColumn(tableName, "order_id")) {
                wheres.add("order_id = " + columnCastPlaceholder(tableName, "order_id"));
                params.add(parentId);
            }
        }
        if (factoryId != null && hasColumn(tableName, "factory_id")) {
            wheres.add("factory_id = ?");
            params.add(factoryId);
        }
        if (!wheres.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", wheres));
        }
        sql.append(" GROUP BY ").append(groupField);

        log.debug("Ratio SQL: {} params: {}", sql, params);
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    private boolean hasColumn(String tableName, String columnName) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = ?",
                Integer.class, tableName, columnName);
            return count != null && count > 0;
        } catch (Exception e) {
            return false;
        }
    }

    // R6 Fix P0-1 (R4/R5 same-cause sweep carryover): parent_id cast was hardcoded
    // `?::uuid` in GROUP_BY and RATIO SQL (lines 87-91 and 141-147 above). After R4
    // made DDLExecutor create sub-tables with parent_id type matching the parent
    // table's id type (VARCHAR/BIGINT/UUID), this hardcoded cast breaks for all
    // non-UUID parents. E.g., for sales_orders (VARCHAR id), formula evaluation
    // throws "ERROR: invalid input syntax for type uuid".
    //
    // Fix: query the actual sub-table column's data_type at runtime and return a
    // type-appropriate cast placeholder. Cached per (tableName, columnName) pair.
    // Matches R4's `DynamicTableService.parentIdPlaceholder` pattern.
    private final Map<String, String> columnCastCache = new ConcurrentHashMap<>();

    /**
     * Return a SQL placeholder appropriate for the given column's actual data_type.
     * - UUID column: "?::uuid"
     * - VARCHAR/TEXT/BIGINT/INTEGER: "?" (JDBC parameter binding handles it)
     * Used for WHERE clauses like `parent_id = <placeholder>` or `order_id = <placeholder>`.
     */
    private String columnCastPlaceholder(String tableName, String columnName) {
        String cacheKey = tableName + "." + columnName;
        return columnCastCache.computeIfAbsent(cacheKey, k -> {
            try {
                String type = jdbcTemplate.queryForObject(
                    "SELECT data_type FROM information_schema.columns " +
                    "WHERE table_name = ? AND column_name = ?",
                    String.class, tableName, columnName);
                if (type != null && type.toLowerCase().contains("uuid")) {
                    return "?::uuid";
                }
                return "?";
            } catch (Exception e) {
                log.warn("Cannot determine type for {}.{}, defaulting to no cast: {}",
                    tableName, columnName, e.getMessage());
                return "?";
            }
        });
    }
}
