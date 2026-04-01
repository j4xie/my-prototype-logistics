package com.cretas.aims.event.listener;

import com.cretas.aims.entity.rd.ProductSample;
import com.cretas.aims.entity.rd.QuotationTask;
import com.cretas.aims.event.SampleApprovedEvent;
import com.cretas.aims.repository.rd.ProductSampleRepository;
import com.cretas.aims.repository.rd.QuotationTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 样品审核通过事件监听器
 * 自动创建: 报价任务 (BOM需人工建立，因样品配方还不确定具体用量)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SampleApprovedEventListener {

    private final ProductSampleRepository productSampleRepository;
    private final QuotationTaskRepository quotationTaskRepository;

    @EventListener
    @Async
    @Transactional
    public void handleSampleApproved(SampleApprovedEvent event) {
        try {
            ProductSample sample = productSampleRepository.findById(event.getSampleId()).orElse(null);
            if (sample == null) {
                log.warn("样品不存在: {}", event.getSampleId());
                return;
            }

            // 创建报价任务
            QuotationTask task = new QuotationTask();
            task.setFactoryId(event.getFactoryId());
            task.setTaskNumber(String.format("QT-%s-%04d",
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")),
                    System.nanoTime() % 10000));
            task.setSampleId(sample.getId());
            task.setProductTypeId(sample.getProductTypeId());
            task.setStatus("PENDING");
            quotationTaskRepository.save(task);

            log.info("样品审核通过后自动创建报价任务: sampleId={}, taskNumber={}",
                    sample.getId(), task.getTaskNumber());

        } catch (Exception e) {
            log.error("处理样品审核通过事件失败: sampleId={}", event.getSampleId(), e);
        }
    }
}
