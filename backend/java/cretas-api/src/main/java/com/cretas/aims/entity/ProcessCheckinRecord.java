package com.cretas.aims.entity;

import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "process_checkin_records",
       indexes = {
           @Index(name = "idx_pcr_employee_date", columnList = "employee_id, check_in_time"),
           @Index(name = "idx_pcr_factory", columnList = "factory_id")
       }
)
public class ProcessCheckinRecord extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "process_name", length = 200)
    private String processName;

    @Column(name = "process_category", length = 50)
    private String processCategory;

    @Column(name = "batch_id")
    private Long batchId;

    @Column(name = "check_in_time", nullable = false)
    private LocalDateTime checkInTime;

    @Column(name = "check_out_time")
    private LocalDateTime checkOutTime;

    @Column(name = "work_minutes")
    private Integer workMinutes;

    @Column(name = "checkin_method", length = 20)
    private String checkinMethod;

    @Column(name = "status", length = 20)
    private String status = "CHECKED_IN";
}
