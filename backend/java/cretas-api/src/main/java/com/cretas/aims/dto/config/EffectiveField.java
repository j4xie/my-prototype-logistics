package com.cretas.aims.dto.config;

import lombok.*;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EffectiveField {
    private String code;
    private String label;
    private String type;
    private boolean required;
    private boolean visible;
    private boolean readonly;
    private Object defaultValue;
    private List<Map<String, Object>> options;
    private String group;
    private int order;
    private Map<String, Object> extra;
}
