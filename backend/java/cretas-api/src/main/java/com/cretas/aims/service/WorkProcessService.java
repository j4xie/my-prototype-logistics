package com.cretas.aims.service;

import com.cretas.aims.dto.WorkProcessDTO;
import com.cretas.aims.dto.common.PageResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface WorkProcessService {

    WorkProcessDTO create(String factoryId, WorkProcessDTO dto);

    PageResponse<WorkProcessDTO> list(String factoryId, Pageable pageable);

    List<WorkProcessDTO> listActive(String factoryId);

    WorkProcessDTO getById(String factoryId, String id);

    WorkProcessDTO update(String factoryId, String id, WorkProcessDTO dto);

    void delete(String factoryId, String id);

    WorkProcessDTO toggleStatus(String factoryId, String id);

    void updateSortOrder(String factoryId, List<WorkProcessDTO.SortOrderUpdate> updates);
}
