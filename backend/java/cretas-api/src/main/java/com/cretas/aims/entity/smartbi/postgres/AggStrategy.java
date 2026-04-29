package com.cretas.aims.entity.smartbi.postgres;

/**
 * KPI aggregation strategy for a SmartBI field.
 *
 * Mirrors the Python infer_agg_strategy() output values stored in
 * smart_bi_pg_field_definitions.agg_strategy (VARCHAR(20)).
 *
 * Database stores lowercase string values ("sum"/"mean"/"none") via
 * AggStrategyConverter — backwards compat with Apr 25 V20260425_02 migration
 * which seeded the column as VARCHAR with literal strings.
 *
 * @see AggStrategyConverter
 * @see backend/python/smartbi/services/field_classifier.py infer_agg_strategy()
 */
public enum AggStrategy {
    /** Default for measures: amounts, counts, etc. KPI shows SUM(col). */
    SUM("sum"),
    /** 1-5 ratings (大众点评 星级/口味/服务/环境). KPI shows AVG(col). */
    MEAN("mean"),
    /** IDs, dimensions, time fields. Excluded from KPI cards. */
    NONE("none");

    private final String dbValue;

    AggStrategy(String dbValue) {
        this.dbValue = dbValue;
    }

    public String getDbValue() {
        return dbValue;
    }

    /**
     * Resolve a DB string back to enum constant.
     * Defaults to SUM for null/unknown values (matches pre-enum behavior:
     * Java entity initialized aggStrategy = "sum" so Python /reclassify could
     * later UPDATE).
     */
    public static AggStrategy fromDb(String value) {
        if (value == null) {
            return SUM;
        }
        for (AggStrategy s : values()) {
            if (s.dbValue.equalsIgnoreCase(value)) {
                return s;
            }
        }
        return SUM;
    }
}
