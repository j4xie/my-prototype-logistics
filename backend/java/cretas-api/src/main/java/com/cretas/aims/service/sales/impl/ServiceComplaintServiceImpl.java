package com.cretas.aims.service.sales.impl;

import com.cretas.aims.dto.sales.ServiceComplaintCreateRequest;
import com.cretas.aims.dto.sales.ServiceComplaintUpdateRequest;
import com.cretas.aims.entity.enums.ServiceComplaintStatus;
import com.cretas.aims.entity.sales.ServiceComplaint;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.sales.ServiceComplaintRepository;
import com.cretas.aims.service.sales.ServiceComplaintService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * P2 #74 S-COMPLAINT-1 — 售后服务投诉实现.
 *
 * <p>状态机:
 * <pre>
 * NEW --startInvestigation--> INVESTIGATING --resolve--> RESOLVED --close--> CLOSED
 * </pre>
 *
 * <p>防呆 R4: create() 内 5min window dedup check, 同 customer + same description 5min
 * 内重复 → 抛 BusinessException(409). 由 frontend 转 confirm-跳转-existing.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceComplaintServiceImpl implements ServiceComplaintService {

    private final ServiceComplaintRepository repository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    /** R4 dedup window — 5 min. */
    private static final int DEDUP_WINDOW_MINUTES = 5;

    @Override
    @Transactional
    public ServiceComplaint create(String factoryId,
                                    ServiceComplaintCreateRequest req,
                                    Long userId) {
        // R4 dedup — same customer + same description within 5 min → reject.
        LocalDateTime sinceAt = LocalDateTime.now().minusMinutes(DEDUP_WINDOW_MINUTES);
        List<ServiceComplaint> dups = repository.findRecentDuplicates(
                factoryId, req.getCustomerId(), req.getDescription(), sinceAt);
        if (!dups.isEmpty()) {
            ServiceComplaint existing = dups.get(0);
            throw new BusinessException(409,
                    "5 分钟内已存在相同投诉 " + existing.getComplaintNumber() + ", 请勿重复提交")
                    .withHint("查看现有投诉 " + existing.getComplaintNumber());
        }

        ServiceComplaint complaint = new ServiceComplaint();
        complaint.setFactoryId(factoryId);
        complaint.setComplaintNumber(generateComplaintNumber(factoryId));
        complaint.setCustomerId(req.getCustomerId());
        complaint.setCustomerName(req.getCustomerName());
        complaint.setOrderId(req.getOrderId());
        complaint.setComplaintType(req.getComplaintType());
        complaint.setSeverity(req.getSeverity());
        complaint.setSource(req.getSource());
        complaint.setStatus(ServiceComplaintStatus.NEW);
        complaint.setDescription(req.getDescription());
        complaint.setHandledBy(req.getHandledBy());
        complaint.setOccurredAt(req.getOccurredAt() != null
                ? req.getOccurredAt() : LocalDateTime.now());
        complaint.setCreatedBy(userId);

        ServiceComplaint saved = repository.save(complaint);
        log.info("[S-COMPLAINT-1 create] number={} customer={} type={} severity={}",
                saved.getComplaintNumber(), saved.getCustomerId(),
                saved.getComplaintType(), saved.getSeverity());
        return saved;
    }

    @Override
    @Transactional
    public ServiceComplaint update(String factoryId,
                                    String id,
                                    ServiceComplaintUpdateRequest req) {
        ServiceComplaint complaint = loadOrThrow(factoryId, id);
        if (complaint.getStatus() == ServiceComplaintStatus.CLOSED) {
            throw new BusinessException(400, "已关闭的投诉不可编辑");
        }
        boolean isNew = complaint.getStatus() == ServiceComplaintStatus.NEW;

        // NEW state allows full edit; others only allow handler/resolution updates.
        if (isNew) {
            if (req.getComplaintType() != null) complaint.setComplaintType(req.getComplaintType());
            if (req.getSeverity() != null) complaint.setSeverity(req.getSeverity());
            if (req.getSource() != null) complaint.setSource(req.getSource());
            if (req.getDescription() != null) complaint.setDescription(req.getDescription());
            if (req.getOccurredAt() != null) complaint.setOccurredAt(req.getOccurredAt());
        }
        if (req.getHandledBy() != null) complaint.setHandledBy(req.getHandledBy());
        if (req.getResolution() != null) complaint.setResolution(req.getResolution());
        return repository.save(complaint);
    }

    @Override
    public ServiceComplaint getById(String factoryId, String id) {
        return loadOrThrow(factoryId, id);
    }

    @Override
    public Page<ServiceComplaint> list(String factoryId,
                                        List<ServiceComplaintStatus> statuses,
                                        String customerId,
                                        Pageable pageable) {
        if (customerId != null && !customerId.isBlank()) {
            return repository.findByFactoryIdAndCustomerIdAndDeletedAtIsNullOrderByCreatedAtDesc(
                    factoryId, customerId, pageable);
        }
        if (statuses != null && !statuses.isEmpty()) {
            return repository.findByFactoryIdAndStatusInAndDeletedAtIsNullOrderByCreatedAtDesc(
                    factoryId, statuses, pageable);
        }
        return repository.findByFactoryIdAndDeletedAtIsNullOrderByCreatedAtDesc(factoryId, pageable);
    }

    @Override
    @Transactional
    public ServiceComplaint startInvestigation(String factoryId, String id, Long handlerUserId) {
        ServiceComplaint complaint = loadOrThrow(factoryId, id);
        if (complaint.getStatus() != ServiceComplaintStatus.NEW) {
            throw new BusinessException(400, "只有 NEW 状态可开始调查 (当前: "
                    + complaint.getStatus() + ")");
        }
        complaint.setStatus(ServiceComplaintStatus.INVESTIGATING);
        if (handlerUserId != null) {
            complaint.setHandledBy(handlerUserId);
        }
        return repository.save(complaint);
    }

    @Override
    @Transactional
    public ServiceComplaint resolve(String factoryId, String id, String resolution) {
        ServiceComplaint complaint = loadOrThrow(factoryId, id);
        if (complaint.getStatus() != ServiceComplaintStatus.INVESTIGATING) {
            throw new BusinessException(400, "只有 INVESTIGATING 状态可解决 (当前: "
                    + complaint.getStatus() + ")");
        }
        if (resolution == null || resolution.isBlank()) {
            throw new BusinessException(400, "解决方案不能为空");
        }
        complaint.setStatus(ServiceComplaintStatus.RESOLVED);
        complaint.setResolution(resolution);
        complaint.setResolvedAt(LocalDateTime.now());
        return repository.save(complaint);
    }

    @Override
    @Transactional
    public ServiceComplaint close(String factoryId, String id) {
        ServiceComplaint complaint = loadOrThrow(factoryId, id);
        if (complaint.getStatus() != ServiceComplaintStatus.RESOLVED) {
            throw new BusinessException(400, "只有 RESOLVED 状态可关闭 (当前: "
                    + complaint.getStatus() + ")");
        }
        complaint.setStatus(ServiceComplaintStatus.CLOSED);
        return repository.save(complaint);
    }

    private ServiceComplaint loadOrThrow(String factoryId, String id) {
        return repository.findByIdAndFactoryIdAndDeletedAtIsNull(id, factoryId)
                .orElseThrow(() -> new BusinessException(404, "投诉不存在"));
    }

    /** Generate CMP-YYYYMMDD-NNNN, NNNN = today's sequence (zero-padded 4 digits). */
    private String generateComplaintNumber(String factoryId) {
        String dateStr = LocalDate.now().format(DATE_FMT);
        String prefix = "CMP-" + dateStr + "-";
        long countToday = repository.countByPrefix(factoryId, prefix + "%");
        long seq = countToday + 1;
        return String.format("%s%04d", prefix, seq);
    }
}
