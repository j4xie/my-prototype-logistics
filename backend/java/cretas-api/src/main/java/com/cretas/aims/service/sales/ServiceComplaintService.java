package com.cretas.aims.service.sales;

import com.cretas.aims.dto.sales.ServiceComplaintCreateRequest;
import com.cretas.aims.dto.sales.ServiceComplaintUpdateRequest;
import com.cretas.aims.entity.enums.ServiceComplaintStatus;
import com.cretas.aims.entity.sales.ServiceComplaint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * P2 #74 S-COMPLAINT-1 — 售后服务投诉业务接口.
 */
public interface ServiceComplaintService {

    ServiceComplaint create(String factoryId, ServiceComplaintCreateRequest req, Long userId);

    ServiceComplaint update(String factoryId, String id, ServiceComplaintUpdateRequest req);

    ServiceComplaint getById(String factoryId, String id);

    Page<ServiceComplaint> list(String factoryId,
                                 List<ServiceComplaintStatus> statuses,
                                 String customerId,
                                 Pageable pageable);

    /** NEW → INVESTIGATING. Optionally assigns handler. */
    ServiceComplaint startInvestigation(String factoryId, String id, Long handlerUserId);

    /** INVESTIGATING → RESOLVED. resolution required. */
    ServiceComplaint resolve(String factoryId, String id, String resolution);

    /** RESOLVED → CLOSED. */
    ServiceComplaint close(String factoryId, String id);
}
