package com.cretas.aims.dto.scheduling;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 重排请求 DTO
 */
@Data
public class AdaptiveRescheduleRequest {
    @NotNull
    private String mode; // "affected_only" | "full"

    private List<String> affectedTaskIds; // mode=affected_only时必填
}
