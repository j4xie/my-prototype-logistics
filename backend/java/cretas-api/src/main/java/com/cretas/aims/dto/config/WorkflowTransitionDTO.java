package com.cretas.aims.dto.config;

import lombok.*;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkflowTransitionDTO {
    private String from;
    private String to;
    private String action;
    private String label;
    private String buttonType;
    private boolean enabled;
    private String condition;
    private List<String> allowedRoles;
}
