package com.cretas.aims.service;

import com.cretas.aims.dto.ProductWorkProcessDTO;

import java.util.List;

public interface ProductWorkProcessService {

    ProductWorkProcessDTO create(String factoryId, ProductWorkProcessDTO dto);

    List<ProductWorkProcessDTO> listByProduct(String factoryId, String productTypeId);

    ProductWorkProcessDTO update(String factoryId, Long id, ProductWorkProcessDTO dto);

    void delete(String factoryId, Long id);

    void batchSort(String factoryId, List<ProductWorkProcessDTO.SortItem> items);
}
