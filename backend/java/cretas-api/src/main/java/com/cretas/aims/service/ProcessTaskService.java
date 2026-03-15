package com.cretas.aims.service;

import com.cretas.aims.dto.ProcessTaskDTO;
import com.cretas.aims.dto.common.PageResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface ProcessTaskService {

    ProcessTaskDTO create(String factoryId, ProcessTaskDTO dto);

    List<ProcessTaskDTO> getActiveTasks(String factoryId);

    PageResponse<ProcessTaskDTO> list(String factoryId, String status, String productTypeId, Pageable pageable);

    ProcessTaskDTO getById(String factoryId, String id);

    ProcessTaskDTO updateStatus(String factoryId, String id, ProcessTaskDTO.StatusUpdateRequest request);

    ProcessTaskDTO closeTask(String factoryId, String id, String notes);

    ProcessTaskDTO.TaskSummary getTaskSummary(String factoryId, String id);

    ProcessTaskDTO.RunOverview getRunOverview(String factoryId, String productionRunId);

    /** 根据产品的工序配置批量生成 ProcessTask */
    List<ProcessTaskDTO> generateFromProduct(String factoryId, String productTypeId,
                                              java.util.Map<String, java.math.BigDecimal> plannedQuantities,
                                              String sourceCustomerName, Long createdBy);
}
