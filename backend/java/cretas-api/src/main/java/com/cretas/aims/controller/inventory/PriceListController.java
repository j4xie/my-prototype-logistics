package com.cretas.aims.controller.inventory;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreatePriceListRequest;
import com.cretas.aims.entity.inventory.PriceList;
import com.cretas.aims.entity.inventory.PriceListItem;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.inventory.PriceListItemRepository;
import com.cretas.aims.repository.inventory.PriceListRepository;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/price-lists")
@RequiredArgsConstructor
@Tag(name = "价格表管理", description = "总部统一定价管理")
public class PriceListController {

    private final PriceListRepository priceListRepository;
    private final PriceListItemRepository priceListItemRepository;
    private final MobileService mobileService;

    @PostMapping
    @Operation(summary = "创建价格表")
    public ApiResponse<PriceList> createPriceList(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreatePriceListRequest request) {
        String token = TokenUtils.extractToken(authorization);
        Long userId = mobileService.getUserFromToken(token).getId();

        PriceList priceList = new PriceList();
        priceList.setFactoryId(factoryId);
        priceList.setName(request.getName());
        priceList.setPriceType(request.getPriceType());
        priceList.setEffectiveFrom(request.getEffectiveFrom());
        priceList.setEffectiveTo(request.getEffectiveTo());
        priceList.setCreatedBy(userId);
        priceList.setRemark(request.getRemark());

        priceList = priceListRepository.save(priceList);

        for (CreatePriceListRequest.PriceItemDTO itemDTO : request.getItems()) {
            PriceListItem item = new PriceListItem();
            item.setPriceListId(priceList.getId());
            item.setMaterialTypeId(itemDTO.getMaterialTypeId());
            item.setProductTypeId(itemDTO.getProductTypeId());
            item.setItemName(itemDTO.getItemName());
            item.setUnit(itemDTO.getUnit());
            item.setStandardPrice(itemDTO.getStandardPrice());
            item.setMinPrice(itemDTO.getMinPrice());
            item.setMaxPrice(itemDTO.getMaxPrice());
            item.setRemark(itemDTO.getRemark());
            priceList.getItems().add(item);
        }

        priceList = priceListRepository.save(priceList);
        log.info("创建价格表: factoryId={}, name={}, items={}", factoryId, request.getName(), request.getItems().size());
        return ApiResponse.success("价格表创建成功", priceList);
    }

    @GetMapping
    @Operation(summary = "价格表列表")
    public ApiResponse<PageResponse<PriceList>> listPriceLists(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PriceList> result = priceListRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageRequest);
        return ApiResponse.success("查询成功", PageResponse.of(result.getContent(), page, size, result.getTotalElements()));
    }

    @GetMapping("/effective")
    @Operation(summary = "查询当前生效的价格表")
    public ApiResponse<List<PriceList>> getEffective(
            @PathVariable @NotBlank String factoryId) {
        List<PriceList> result = priceListRepository.findEffective(factoryId, LocalDate.now());
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/{priceListId}")
    @Operation(summary = "价格表详情")
    public ApiResponse<PriceList> getPriceList(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String priceListId) {
        PriceList priceList = priceListRepository.findById(priceListId)
                .orElseThrow(() -> new ResourceNotFoundException("价格表不存在"));
        return ApiResponse.success("查询成功", priceList);
    }

    @DeleteMapping("/{priceListId}")
    @Operation(summary = "删除价格表")
    public ApiResponse<Void> deletePriceList(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String priceListId) {
        PriceList priceList = priceListRepository.findById(priceListId)
                .orElseThrow(() -> new ResourceNotFoundException("价格表不存在"));
        priceListRepository.delete(priceList);
        log.info("删除价格表: priceListId={}", priceListId);
        return ApiResponse.success("价格表删除成功", null);
    }
}
