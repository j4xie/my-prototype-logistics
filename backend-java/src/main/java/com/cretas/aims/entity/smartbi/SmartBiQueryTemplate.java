package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI Query Template Entity
 *
 * Stores user-defined query templates for the AI query page.
 * Each template belongs to a factory and a category.
 */
@Entity
@Table(name = "smart_bi_query_templates",
       indexes = {
           @Index(name = "idx_qt_factory", columnList = "factory_id"),
           @Index(name = "idx_qt_category", columnList = "category")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiQueryTemplate extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", nullable = false, length = 32)
    private String factoryId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "category", nullable = false, length = 32)
    private String category;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "query_template", nullable = false, columnDefinition = "TEXT")
    private String queryTemplate;

    /** JSON array of parameter definitions */
    @Column(name = "parameters", columnDefinition = "TEXT")
    private String parameters;
}
