package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "smart_bi_share_tokens",
       indexes = {
           @Index(name = "idx_share_token", columnList = "token", unique = true),
           @Index(name = "idx_share_factory_upload", columnList = "factory_id,upload_id")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiShareToken extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token", nullable = false, unique = true, length = 64)
    private String token;

    @Column(name = "upload_id", nullable = false)
    private Long uploadId;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    @Column(name = "title", length = 200)
    private String title;

    @Column(name = "sheet_index")
    private Integer sheetIndex;

    @Column(name = "file_name", length = 200)
    private String fileName;

    @Column(name = "sheet_name", length = 200)
    private String sheetName;

    @Column(name = "ttl_days")
    private Integer ttlDays;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "created_by")
    private Long createdBy;
}
