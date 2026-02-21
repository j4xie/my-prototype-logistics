package com.cretas.aims.controller.restaurant;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.impl.RestaurantDashboardServiceImpl;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 餐饮 Dashboard 聚合 Controller
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/restaurant-dashboard")
@RequiredArgsConstructor
@Tag(name = "餐饮-数据看板")
public class RestaurantDashboardController {

    private final RestaurantDashboardServiceImpl dashboardService;

    @GetMapping("/summary")
    @Operation(summary = "餐饮看板汇总", description = "聚合领料、损耗、盘点等核心指标")
    public ApiResponse<Map<String, Object>> summary(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("查询餐饮看板: factoryId={}", factoryId);
        Map<String, Object> result = dashboardService.getSummary(factoryId);
        return ApiResponse.success(result);
    }
}
