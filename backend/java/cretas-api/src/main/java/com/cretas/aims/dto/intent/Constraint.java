package com.cretas.aims.dto.intent;

import lombok.Builder;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Constraint {
    private String field;           // 字段名
    private Object value;           // 值
    private ConditionType condition; // 条件类型，默认SET

    public static Constraint set(String field, Object value) {
        return Constraint.builder()
            .field(field)
            .value(value)
            .condition(ConditionType.SET)
            .build();
    }

    public static Constraint equals(String field, Object value) {
        return Constraint.builder()
            .field(field)
            .value(value)
            .condition(ConditionType.EQUALS)
            .build();
    }
}
