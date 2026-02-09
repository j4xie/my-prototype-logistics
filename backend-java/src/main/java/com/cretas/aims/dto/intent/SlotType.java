package com.cretas.aims.dto.intent;

/**
 * Slot Type Enum for Intent Parameter Extraction
 *
 * Defines the types of slots (parameters) that can be extracted
 * from user input for parameterized queries.
 *
 * <p>Supported slot types:</p>
 * <ul>
 *   <li><b>DEVICE_ID</b>: Equipment/device identifiers (EQ001, WH002)</li>
 *   <li><b>EMPLOYEE_ID</b>: Employee identifiers (1001, E001)</li>
 *   <li><b>CUSTOMER_ID</b>: Customer identifiers (C001, CUS001)</li>
 *   <li><b>BATCH_ID</b>: Batch numbers (B2026012401)</li>
 *   <li><b>ORDER_ID</b>: Order identifiers (O20260124001)</li>
 *   <li><b>TIME_RANGE</b>: Time expressions (last 7 days, this month)</li>
 *   <li><b>NUMBER</b>: Numeric values (TOP10, more than 100)</li>
 *   <li><b>COMPARISON</b>: Comparison types (highest, lowest, YoY, MoM)</li>
 *   <li><b>METRIC</b>: Business metrics (sales, output, inventory)</li>
 *   <li><b>PRODUCT_ID</b>: Product identifiers (P001, PROD001)</li>
 *   <li><b>SUPPLIER_ID</b>: Supplier identifiers (SUP001, S001)</li>
 *   <li><b>MATERIAL_ID</b>: Material identifiers (M001, MAT001)</li>
 *   <li><b>PERCENTAGE</b>: Percentage values (50%, 80%)</li>
 *   <li><b>DEPARTMENT</b>: Department names</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public enum SlotType {

    // ==================== ID Slots ====================

    /**
     * Device/Equipment ID
     * Examples: EQ001, WH002, DEV003, M001
     */
    DEVICE_ID("设备编号"),

    /**
     * Employee ID
     * Examples: 1001, E001, EMP001
     */
    EMPLOYEE_ID("员工工号"),

    /**
     * Customer ID
     * Examples: C001, CUS001, CUST001
     */
    CUSTOMER_ID("客户编号"),

    /**
     * Batch ID
     * Examples: B2026012401, BATCH001, MB-F001-001
     */
    BATCH_ID("批次号"),

    /**
     * Order ID
     * Examples: O20260124001, ORD001, ORDER-2026
     */
    ORDER_ID("订单号"),

    /**
     * Product ID
     * Examples: P001, PROD001, SKU001
     */
    PRODUCT_ID("产品编号"),

    /**
     * Supplier ID
     * Examples: SUP001, S001, SUPP001
     */
    SUPPLIER_ID("供应商编号"),

    /**
     * Material ID
     * Examples: M001, MAT001, MATERIAL001
     */
    MATERIAL_ID("原料编号"),

    // ==================== Time Slots ====================

    /**
     * Time Range Expression
     * Examples: 最近7天, 本月, 上周, 过去3个月
     */
    TIME_RANGE("时间范围"),

    /**
     * Specific Date
     * Examples: 2026-01-24, 今天, 昨天
     */
    DATE("日期"),

    // ==================== Numeric Slots ====================

    /**
     * Number/Count/Ranking Limit
     * Examples: TOP10, 前5, 超过100
     */
    NUMBER("数值"),

    /**
     * Percentage Value
     * Examples: 50%, 80%, 达标率90%
     */
    PERCENTAGE("百分比"),

    // ==================== Comparison Slots ====================

    /**
     * Comparison Type
     * Examples: 最高, 最低, 排名, 环比, 同比
     */
    COMPARISON("比较类型"),

    /**
     * Sorting Type
     * Examples: 降序, 升序, 按销量排序
     */
    SORT_TYPE("排序方式"),

    // ==================== Business Slots ====================

    /**
     * Business Metric
     * Examples: 销量, 产量, 库存, 效率, 合格率
     */
    METRIC("指标"),

    /**
     * Department/Workshop
     * Examples: 车间A, 生产部, 质检部
     */
    DEPARTMENT("部门"),

    /**
     * Status
     * Examples: 运行中, 待机, 故障, 完成
     */
    STATUS("状态"),

    /**
     * Person Name
     * Examples: 张三, 李四
     */
    PERSON_NAME("人员姓名");

    private final String displayName;

    SlotType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
