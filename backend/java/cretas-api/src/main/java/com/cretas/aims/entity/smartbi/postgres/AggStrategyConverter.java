package com.cretas.aims.entity.smartbi.postgres;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA converter mapping AggStrategy enum ↔ DB VARCHAR(20).
 *
 * Backwards compatible: existing DB rows have agg_strategy='sum'/'mean'/'none'
 * as plain strings (V20260425_02 migration). This converter preserves that
 * encoding so no schema change is needed.
 *
 * Not annotated @Converter(autoApply = true) — applied per-field via @Convert
 * on SmartBiPgFieldDefinition.aggStrategy. Avoids accidentally converting
 * unrelated String columns elsewhere in the codebase.
 */
@Converter
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
