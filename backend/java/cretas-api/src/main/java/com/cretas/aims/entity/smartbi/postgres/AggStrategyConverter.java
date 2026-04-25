package com.cretas.aims.entity.smartbi.postgres;

import jakarta.persistence.AttributeConverter;

/**
 * JPA converter mapping AggStrategy enum ↔ DB VARCHAR(20).
 *
 * Backwards compatible: existing DB rows have agg_strategy='sum'/'mean'/'none'
 * as plain strings (V20260425_02 migration). This converter preserves that
 * encoding so no schema change is needed.
 *
 * Intentionally NOT annotated with @Converter — registration happens via
 * the @Convert(converter = AggStrategyConverter.class) on
 * SmartBiPgFieldDefinition.aggStrategy. Adding @Converter here would cause
 * Hibernate "registered multiple times" startup failure because Spring/JPA
 * scans both the @Converter annotation AND the per-field @Convert.
 */
public class AggStrategyConverter implements AttributeConverter<AggStrategy, String> {

    @Override
    public String convertToDatabaseColumn(AggStrategy attribute) {
        if (attribute == null) {
            return AggStrategy.SUM.getDbValue();
        }
        return attribute.getDbValue();
    }

    @Override
    public AggStrategy convertToEntityAttribute(String dbData) {
        return AggStrategy.fromDb(dbData);
    }
}
