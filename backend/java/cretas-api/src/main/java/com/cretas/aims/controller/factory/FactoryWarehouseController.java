package com.cretas.aims.controller.factory;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.factory.FactoryWarehouse;
import com.cretas.aims.entity.factory.FactoryWarehouse.WarehouseType;
import com.cretas.aims.repository.factory.FactoryWarehouseRepository;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * P1-4 工厂仓库查询 Controller (v1 §2.9 双仓体系).
 *
 * <p>提供 FMR create/edit dialog 里的 source/target warehouse 下拉数据.
 * 当前仅只读 (seed 数据在 V20260411_03 migration 里插入).
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/factory/warehouses")
@RequiredArgsConstructor
public class FactoryWarehouseController {

    private final FactoryWarehouseRepository repository;

    @GetMapping
    public ApiResponse<List<FactoryWarehouse>> list(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(required = false) WarehouseType type) {
        List<FactoryWarehouse> list = type != null
                ? repository.findByFactoryIdAndTypeAndDeletedAtIsNullOrderByCodeAsc(factoryId, type)
                : repository.findByFactoryIdAndDeletedAtIsNullOrderByCodeAsc(factoryId);
        return ApiResponse.success("查询成功", list);
    }
}
