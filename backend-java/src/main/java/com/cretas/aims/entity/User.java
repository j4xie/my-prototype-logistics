package com.cretas.aims.entity;

import com.cretas.aims.entity.enums.Department;
import com.cretas.aims.entity.enums.FactoryUserRole;
import lombok.*;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
/**
 * 用户实体类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"factory", "sessions", "workSessions", "materialConsumptions", "batchWorkSessions"})
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "users",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"username"})  // 全局唯一：username不能重复
       },
       indexes = {
           @Index(name = "idx_factory_username", columnList = "factory_id, username"),
           @Index(name = "idx_active_users", columnList = "is_active, factory_id"),
           @Index(name = "idx_username", columnList = "username")  // 加速username查询
       }
)
public class User extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;
    @Column(name = "factory_id", nullable = false)
    private String factoryId;
    @Column(name = "username", nullable = false)
    private String username;
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    @Column(name = "phone")
    private String phone;
    @Column(name = "full_name")
    private String fullName;
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    @Column(name = "department")
    private String department;
    @Column(name = "position")
    private String position;
    @Column(name = "role_code")
    private String roleCode;
    @Column(name = "last_login")
    private LocalDateTime lastLogin;
    // 薪资和成本相关字段
    @Column(name = "monthly_salary", precision = 10, scale = 2)
    private BigDecimal monthlySalary;
    @Column(name = "expected_work_minutes")
    private Integer expectedWorkMinutes;
    @Column(name = "ccr_rate", precision = 8, scale = 4)
    private BigDecimal ccrRate;
    // 关联关系
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factory_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Factory factory;
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Session> sessions = new ArrayList<>();
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<EmployeeWorkSession> workSessions = new ArrayList<>();
    @OneToMany(mappedBy = "recorder", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialConsumption> materialConsumptions = new ArrayList<>();
    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<BatchWorkSession> batchWorkSessions = new ArrayList<>();
    @OneToMany(mappedBy = "createdByUser", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<RawMaterialType> createdMaterialTypes = new ArrayList<>();
    @OneToMany(mappedBy = "createdByUser", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ProductType> createdProductTypes = new ArrayList<>();
    @OneToMany(mappedBy = "createdByUser", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Supplier> createdSuppliers = new ArrayList<>();
    @OneToMany(mappedBy = "createdByUser", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Customer> createdCustomers = new ArrayList<>();
    @OneToMany(mappedBy = "createdByUser", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ProductionPlan> createdProductionPlans = new ArrayList<>();
    @OneToMany(mappedBy = "createdByUser", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialBatch> createdMaterialBatches = new ArrayList<>();
    @OneToMany(mappedBy = "adjustedBy", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MaterialBatchAdjustment> batchAdjustments = new ArrayList<>();
    // 便捷方法
    /**
     * 获取密码（兼容方法）
     */
    public String getPassword() {
        return this.passwordHash;
    }
    /**
     * 设置密码（兼容方法）
     */
    public void setPassword(String password) {
        this.passwordHash = password;
    }

    /**
     * 获取角色字符串
     */
    public String getRole() {
        return this.roleCode != null ? this.roleCode : this.position;
    }

    /**
     * 获取姓名（兼容方法）
     */
    public String getName() {
        return this.fullName;
    }

    /**
     * 设置姓名（兼容方法）
     */
    public void setName(String name) {
        this.fullName = name;
    }

    /**
     * 获取头像（TODO: 添加avatar字段）
     */
    public String getAvatar() {
        return null; // TODO: 添加avatar字段到数据库
    }

    /**
     * 获取权限字符串（基于职位）
     */
    public String getPermissions() {
        // 根据职位返回默认权限
        if (this.position == null) {
            return "";
        }
        switch (this.position) {
            case "super_admin":
                return "admin:all";
            case "permission_admin":
                return "admin:users,admin:permissions";
            case "supervisor":
                return "manager:all,production:all,employee:all";
            case "operator":
                return "production:view,production:manage,timeclock:manage";
            default:
                return "";
        }
    }
}
