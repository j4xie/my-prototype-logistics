package com.cretas.aims.dto.intent;

import lombok.Builder;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class IntentSemantics {
    // L1-L3 语义层级
    private DomainType domain;      // L1: 域
    private ActionType action;      // L2: 动作
    private ObjectType object;      // L3: 对象

    // 对象标识
    private String objectId;        // 对象ID (如批次号)
    private String objectIdentifier; // 辅助标识 (如产品名)

    // L4: 约束条件
    @Builder.Default
    private List<Constraint> constraints = new ArrayList<>();

    // 向后兼容：原始context
    @Builder.Default
    private Map<String, Object> rawContext = new HashMap<>();

    // 解析元信息
    @Builder.Default
    private Double parseConfidence = 1.0;

    @Builder.Default
    private ParseMethod parseMethod = ParseMethod.CONTEXT;

    // 获取语义路径 (如 DATA.UPDATE.BATCH)
    public String getSemanticPath() {
        if (domain == null || action == null || object == null) {
            return null;
        }
        return domain.name() + "." + action.name() + "." + object.name();
    }

    // 便捷方法：添加约束
    public IntentSemantics addConstraint(String field, Object value) {
        if (constraints == null) {
            constraints = new ArrayList<>();
        }
        constraints.add(Constraint.set(field, value));
        return this;
    }

    public IntentSemantics addConstraint(Constraint constraint) {
        if (constraints == null) {
            constraints = new ArrayList<>();
        }
        constraints.add(constraint);
        return this;
    }

    // 从约束中获取值
    public Object getConstraintValue(String field) {
        if (constraints == null) return null;
        return constraints.stream()
            .filter(c -> field.equals(c.getField()))
            .findFirst()
            .map(Constraint::getValue)
            .orElse(null);
    }

    // 静态工厂方法
    public static IntentSemantics of(DomainType domain, ActionType action, ObjectType object) {
        return IntentSemantics.builder()
            .domain(domain)
            .action(action)
            .object(object)
            .build();
    }
}
