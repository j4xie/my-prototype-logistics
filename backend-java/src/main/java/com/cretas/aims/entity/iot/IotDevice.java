package com.cretas.aims.entity.iot;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * IoT设备实体类
 * 对应数据库表 iot_devices
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-04
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "iot_devices",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"factory_id", "device_code"})
       },
       indexes = {
           @Index(name = "idx_iot_device_factory", columnList = "factory_id"),
           @Index(name = "idx_iot_device_status", columnList = "status"),
           @Index(name = "idx_iot_device_type", columnList = "device_type")
       }
)
public class IotDevice extends BaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;  // UUID

    @Column(name = "device_code", nullable = false, length = 100)
    private String deviceCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "device_type", nullable = false, length = 20)
    private DeviceType deviceType;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    @Column(name = "equipment_id")
    private Long equipmentId;  // 关联 factory_equipment.id，可为空

    @Column(name = "protocol_id", length = 50)
    private String protocolId;  // 关联协议配置，可为空

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private DeviceStatus status = DeviceStatus.OFFLINE;

    @Column(name = "last_heartbeat")
    private LocalDateTime lastHeartbeat;

    @Column(name = "last_data_time")
    private LocalDateTime lastDataTime;

    // 乐观锁版本号
    @Version
    @Column(name = "version")
    private Integer version;
}
