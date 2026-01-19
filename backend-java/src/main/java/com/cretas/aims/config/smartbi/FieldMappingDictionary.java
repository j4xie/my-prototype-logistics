package com.cretas.aims.config.smartbi;

import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Smart BI 字段映射字典配置
 *
 * 提供标准字段与同义词的映射关系，支持:
 * - 同义词匹配（中英文）
 * - 数据类型映射
 * - 字段分类查询
 * - 必填字段验证
 *
 * @see docs/architecture/smart-bi-ai-analysis-spec.md Section 4.1
 */
@Configuration
@Component
public class FieldMappingDictionary {

    // ==================== 字段分类定义 ====================

    /**
     * 销售相关字段
     */
    public static final Set<String> SALES_FIELDS = Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(
            "order_date",
            "salesperson_id",
            "salesperson_name",
            "department",
            "region",
            "province",
            "city",
            "customer_name",
            "customer_type",
            "product_id",
            "product_name",
            "product_category",
            "quantity",
            "amount",
            "unit_price",
            "monthly_target"
    )));

    /**
     * 财务相关字段
     */
    public static final Set<String> FINANCE_FIELDS = Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(
            "cost",
            "material_cost",
            "labor_cost",
            "overhead",
            "total_cost",
            "unit_cost",
            "profit",
            "gross_margin",
            "net_profit",
            "net_margin"
    )));

    /**
     * 应收应付字段
     */
    public static final Set<String> AR_AP_FIELDS = Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(
            "accounts_receivable",
            "accounts_payable",
            "collection",
            "payment",
            "invoice_date",
            "due_date",
            "aging_days"
    )));

    /**
     * 预算相关字段
     */
    public static final Set<String> BUDGET_FIELDS = Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(
            "budget_amount",
            "actual_amount",
            "variance",
            "budget_category"
    )));

    /**
     * 组织架构字段
     */
    public static final Set<String> ORG_FIELDS = Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(
            "department_id",
            "team",
            "manager",
            "headcount",
            "hire_date",
            "cost_center"
    )));

    // ==================== 同义词映射表 ====================

    /**
     * 标准字段 -> 同义词列表
     * Key: 标准字段名 (snake_case)
     * Value: 同义词列表（包含中英文）
     */
    public static final Map<String, List<String>> SYNONYM_MAP;

    static {
        Map<String, List<String>> map = new LinkedHashMap<>();

        // ===== 销售相关字段 =====
        map.put("order_date", Arrays.asList(
                "订单日期", "日期", "成交日期", "销售日期", "date", "order date", "sale date",
                "交易日期", "下单日期", "购买日期", "purchase date"
        ));

        map.put("salesperson_id", Arrays.asList(
                "销售员ID", "员工编号", "工号", "emp_id", "employee id", "salesperson id",
                "销售编号", "业务员编号", "staff id", "员工ID"
        ));

        map.put("salesperson_name", Arrays.asList(
                "销售员", "姓名", "业务员", "name", "salesperson name", "sales rep",
                "销售人员", "员工姓名", "业务员姓名", "销售代表", "employee name"
        ));

        map.put("department", Arrays.asList(
                "部门", "所属部门", "团队", "dept", "department", "division",
                "sales team", "销售部门", "归属部门"
        ));

        map.put("region", Arrays.asList(
                "区域", "大区", "销售区域", "area", "region", "territory",
                "地区", "片区", "sales area", "市场区域"
        ));

        map.put("province", Arrays.asList(
                "省份", "省", "province", "state",
                "所在省", "省级"
        ));

        map.put("city", Arrays.asList(
                "城市", "市", "city",
                "所在城市", "地级市"
        ));

        map.put("customer_name", Arrays.asList(
                "客户", "客户名称", "公司名", "customer name", "client name",
                "customer", "客户名", "公司名称", "买方", "购买方"
        ));

        map.put("customer_type", Arrays.asList(
                "客户类型", "客户分类", "customer type", "client type",
                "客户级别", "客户等级", "客户类别"
        ));

        map.put("product_id", Arrays.asList(
                "产品ID", "商品编号", "SKU", "product id", "item id",
                "产品编号", "商品ID", "货号", "产品代码", "商品代码"
        ));

        map.put("product_name", Arrays.asList(
                "产品", "商品", "品名", "product name", "item name",
                "产品名称", "商品名称", "产品名", "商品名", "货品"
        ));

        map.put("product_category", Arrays.asList(
                "类别", "品类", "分类", "category", "product category",
                "产品类别", "商品分类", "产品分类", "商品类别", "类目"
        ));

        map.put("quantity", Arrays.asList(
                "数量", "销售数量", "件数", "qty", "quantity", "count",
                "销量", "销售件数", "订购数量", "购买数量", "amount count"
        ));

        map.put("amount", Arrays.asList(
                "金额", "销售额", "成交金额", "收入", "revenue", "amount",
                "销售金额", "订单金额", "营收", "营业额", "sales amount",
                "业绩", "业绩金额", "交易金额", "成交额"
        ));

        map.put("unit_price", Arrays.asList(
                "单价", "售价", "price", "unit price",
                "销售单价", "销售价格", "商品单价", "产品单价", "定价"
        ));

        map.put("monthly_target", Arrays.asList(
                "月目标", "销售目标", "目标金额", "target", "monthly target",
                "月度目标", "业绩目标", "指标", "月度指标", "sales target"
        ));

        // ===== 财务相关字段 =====
        map.put("cost", Arrays.asList(
                "成本", "成本金额", "cost", "total cost",
                "费用", "支出", "花费"
        ));

        map.put("material_cost", Arrays.asList(
                "原材料成本", "材料费", "采购成本", "进货成本", "material cost",
                "物料成本", "原料成本", "材料成本", "采购费"
        ));

        map.put("labor_cost", Arrays.asList(
                "人工成本", "工资", "人工费用", "薪酬", "labor cost",
                "人力成本", "工资成本", "薪资", "人员成本", "工资费用"
        ));

        map.put("overhead", Arrays.asList(
                "制造费用", "间接费用", "管理费用", "overhead",
                "间接成本", "运营费用", "其他费用", "杂费"
        ));

        map.put("total_cost", Arrays.asList(
                "总成本", "成本合计", "total cost", "full cost",
                "合计成本", "成本总额", "全部成本"
        ));

        map.put("unit_cost", Arrays.asList(
                "成本价", "采购价", "进价", "unit cost",
                "单位成本", "单件成本", "进货价", "采购单价"
        ));

        map.put("profit", Arrays.asList(
                "毛利", "毛利额", "利润", "gross_profit", "gross profit",
                "盈利", "收益", "利润额"
        ));

        map.put("gross_margin", Arrays.asList(
                "毛利率", "利润率", "margin", "gross margin",
                "毛利润率", "利润率%", "GPM"
        ));

        map.put("net_profit", Arrays.asList(
                "净利", "净利润", "net profit",
                "净利额", "纯利", "纯利润", "税后利润"
        ));

        map.put("net_margin", Arrays.asList(
                "净利率", "净利润率", "net margin",
                "净利润率%", "NPM"
        ));

        // ===== 应收应付字段 =====
        map.put("accounts_receivable", Arrays.asList(
                "应收账款", "应收", "AR", "accounts receivable",
                "应收款", "待收款", "应收金额"
        ));

        map.put("accounts_payable", Arrays.asList(
                "应付账款", "应付", "AP", "accounts payable",
                "应付款", "待付款", "应付金额"
        ));

        map.put("collection", Arrays.asList(
                "回款", "收款", "已收", "collection",
                "回款金额", "收款金额", "已收款", "实收"
        ));

        map.put("payment", Arrays.asList(
                "付款", "已付", "payment",
                "付款金额", "已付款", "实付", "支付金额"
        ));

        map.put("invoice_date", Arrays.asList(
                "开票日期", "发票日期", "invoice date",
                "开票时间", "发票时间", "开具日期"
        ));

        map.put("due_date", Arrays.asList(
                "到期日", "应收日期", "due date",
                "到期日期", "截止日期", "应付日期", "账期"
        ));

        map.put("aging_days", Arrays.asList(
                "账龄", "天数", "aging days", "days",
                "账龄天数", "逾期天数", "欠款天数"
        ));

        // ===== 预算相关字段 =====
        map.put("budget_amount", Arrays.asList(
                "预算", "预算金额", "budget", "budget amount",
                "预算额", "计划金额", "预算值"
        ));

        map.put("actual_amount", Arrays.asList(
                "实际", "实际金额", "actual", "actual amount",
                "实际值", "实际额", "实际发生"
        ));

        map.put("variance", Arrays.asList(
                "差异", "偏差", "variance",
                "差异金额", "预算差异", "偏差值", "差额"
        ));

        map.put("budget_category", Arrays.asList(
                "预算科目", "费用类别", "budget category",
                "预算类别", "科目", "费用科目", "预算项目"
        ));

        // ===== 组织架构字段 =====
        map.put("department_id", Arrays.asList(
                "部门编号", "部门ID", "dept_id", "department id",
                "部门代码", "部门号"
        ));

        map.put("team", Arrays.asList(
                "团队", "小组", "group", "team",
                "工作组", "班组", "小队"
        ));

        map.put("manager", Arrays.asList(
                "负责人", "经理", "主管", "manager",
                "管理者", "领导", "上级", "team leader"
        ));

        map.put("headcount", Arrays.asList(
                "人数", "编制", "员工数", "headcount",
                "人员数量", "员工人数", "人员编制", "在编人数"
        ));

        map.put("hire_date", Arrays.asList(
                "入职日期", "入职时间", "hire date",
                "入职日", "加入日期", "雇佣日期", "入司日期"
        ));

        map.put("cost_center", Arrays.asList(
                "成本中心", "cost center",
                "成本归属", "费用中心", "核算中心"
        ));

        SYNONYM_MAP = Collections.unmodifiableMap(map);
    }

    // ==================== 数据类型映射 ====================

    /**
     * 数据类型常量
     */
    public static final String TYPE_DATE = "DATE";
    public static final String TYPE_AMOUNT = "AMOUNT";
    public static final String TYPE_QUANTITY = "QUANTITY";
    public static final String TYPE_PERCENTAGE = "PERCENTAGE";
    public static final String TYPE_CATEGORICAL = "CATEGORICAL";
    public static final String TYPE_STRING = "STRING";
    public static final String TYPE_ID = "ID";

    /**
     * 标准字段 -> 数据类型
     */
    public static final Map<String, String> DATA_TYPE_MAP;

    static {
        Map<String, String> map = new LinkedHashMap<>();

        // 日期类型
        map.put("order_date", TYPE_DATE);
        map.put("invoice_date", TYPE_DATE);
        map.put("due_date", TYPE_DATE);
        map.put("hire_date", TYPE_DATE);

        // 金额类型
        map.put("amount", TYPE_AMOUNT);
        map.put("cost", TYPE_AMOUNT);
        map.put("material_cost", TYPE_AMOUNT);
        map.put("labor_cost", TYPE_AMOUNT);
        map.put("overhead", TYPE_AMOUNT);
        map.put("total_cost", TYPE_AMOUNT);
        map.put("unit_cost", TYPE_AMOUNT);
        map.put("unit_price", TYPE_AMOUNT);
        map.put("profit", TYPE_AMOUNT);
        map.put("net_profit", TYPE_AMOUNT);
        map.put("monthly_target", TYPE_AMOUNT);
        map.put("accounts_receivable", TYPE_AMOUNT);
        map.put("accounts_payable", TYPE_AMOUNT);
        map.put("collection", TYPE_AMOUNT);
        map.put("payment", TYPE_AMOUNT);
        map.put("budget_amount", TYPE_AMOUNT);
        map.put("actual_amount", TYPE_AMOUNT);
        map.put("variance", TYPE_AMOUNT);

        // 数量类型
        map.put("quantity", TYPE_QUANTITY);
        map.put("headcount", TYPE_QUANTITY);
        map.put("aging_days", TYPE_QUANTITY);

        // 百分比类型
        map.put("gross_margin", TYPE_PERCENTAGE);
        map.put("net_margin", TYPE_PERCENTAGE);

        // 分类类型
        map.put("department", TYPE_CATEGORICAL);
        map.put("region", TYPE_CATEGORICAL);
        map.put("province", TYPE_CATEGORICAL);
        map.put("city", TYPE_CATEGORICAL);
        map.put("customer_type", TYPE_CATEGORICAL);
        map.put("product_category", TYPE_CATEGORICAL);
        map.put("team", TYPE_CATEGORICAL);
        map.put("budget_category", TYPE_CATEGORICAL);
        map.put("cost_center", TYPE_CATEGORICAL);

        // ID类型
        map.put("salesperson_id", TYPE_ID);
        map.put("product_id", TYPE_ID);
        map.put("department_id", TYPE_ID);

        // 字符串类型
        map.put("salesperson_name", TYPE_STRING);
        map.put("customer_name", TYPE_STRING);
        map.put("product_name", TYPE_STRING);
        map.put("manager", TYPE_STRING);

        DATA_TYPE_MAP = Collections.unmodifiableMap(map);
    }

    // ==================== 必填字段 ====================

    /**
     * 必填字段集合
     * 这些字段对于基本销售分析是必需的
     */
    public static final Set<String> REQUIRED_FIELDS = Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(
            "order_date",
            "salesperson_id",
            "salesperson_name",
            "department",
            "product_name",
            "quantity",
            "amount"
    )));

    // ==================== 反向索引（用于快速查找） ====================

    /**
     * 同义词 -> 标准字段名 的反向索引
     * 用于快速根据同义词查找标准字段
     */
    private Map<String, String> synonymToFieldIndex;

    /**
     * 分类名 -> 字段列表
     */
    private Map<String, Set<String>> categoryToFieldsMap;

    @PostConstruct
    public void init() {
        buildSynonymIndex();
        buildCategoryMap();
    }

    /**
     * 构建同义词反向索引
     */
    private void buildSynonymIndex() {
        synonymToFieldIndex = new HashMap<>();

        for (Map.Entry<String, List<String>> entry : SYNONYM_MAP.entrySet()) {
            String standardField = entry.getKey();

            // 标准字段名本身也可以作为查找依据
            synonymToFieldIndex.put(standardField.toLowerCase(), standardField);
            synonymToFieldIndex.put(standardField.replace("_", " ").toLowerCase(), standardField);
            synonymToFieldIndex.put(standardField.replace("_", "").toLowerCase(), standardField);

            // 所有同义词
            for (String synonym : entry.getValue()) {
                synonymToFieldIndex.put(synonym.toLowerCase(), standardField);
                // 去除空格的版本
                String noSpace = synonym.replace(" ", "").toLowerCase();
                if (!noSpace.equals(synonym.toLowerCase())) {
                    synonymToFieldIndex.put(noSpace, standardField);
                }
            }
        }
    }

    /**
     * 构建分类映射
     */
    private void buildCategoryMap() {
        categoryToFieldsMap = new LinkedHashMap<>();
        categoryToFieldsMap.put("SALES", SALES_FIELDS);
        categoryToFieldsMap.put("FINANCE", FINANCE_FIELDS);
        categoryToFieldsMap.put("AR_AP", AR_AP_FIELDS);
        categoryToFieldsMap.put("BUDGET", BUDGET_FIELDS);
        categoryToFieldsMap.put("ORG", ORG_FIELDS);
    }

    // ==================== 公共方法 ====================

    /**
     * 根据列名查找标准字段
     *
     * 匹配策略:
     * 1. 精确匹配（大小写不敏感）
     * 2. 同义词匹配
     * 3. 部分匹配（列名包含同义词）
     *
     * @param columnName 用户Excel中的列名
     * @return 匹配到的标准字段名，未找到返回 Optional.empty()
     */
    public Optional<String> findStandardField(String columnName) {
        if (columnName == null || columnName.trim().isEmpty()) {
            return Optional.empty();
        }

        String normalizedName = columnName.trim().toLowerCase();

        // 1. 精确匹配
        if (synonymToFieldIndex.containsKey(normalizedName)) {
            return Optional.of(synonymToFieldIndex.get(normalizedName));
        }

        // 2. 去除常见前后缀后匹配
        String stripped = stripCommonAffixes(normalizedName);
        if (!stripped.equals(normalizedName) && synonymToFieldIndex.containsKey(stripped)) {
            return Optional.of(synonymToFieldIndex.get(stripped));
        }

        // 3. 部分匹配 - 列名包含同义词
        for (Map.Entry<String, String> entry : synonymToFieldIndex.entrySet()) {
            String synonym = entry.getKey();
            // 只对长度>=2的同义词进行包含匹配，避免误匹配
            if (synonym.length() >= 2 && normalizedName.contains(synonym)) {
                return Optional.of(entry.getValue());
            }
        }

        // 4. 部分匹配 - 同义词包含列名
        for (Map.Entry<String, String> entry : synonymToFieldIndex.entrySet()) {
            String synonym = entry.getKey();
            if (normalizedName.length() >= 2 && synonym.contains(normalizedName)) {
                return Optional.of(entry.getValue());
            }
        }

        return Optional.empty();
    }

    /**
     * 去除常见前后缀
     */
    private String stripCommonAffixes(String name) {
        String result = name;

        // 去除常见前缀
        String[] prefixes = {"col_", "field_", "f_", "c_", "column_"};
        for (String prefix : prefixes) {
            if (result.startsWith(prefix)) {
                result = result.substring(prefix.length());
                break;
            }
        }

        // 去除常见后缀
        String[] suffixes = {"_col", "_field", "_value", "_val"};
        for (String suffix : suffixes) {
            if (result.endsWith(suffix)) {
                result = result.substring(0, result.length() - suffix.length());
                break;
            }
        }

        return result;
    }

    /**
     * 获取标准字段的数据类型
     *
     * @param standardField 标准字段名
     * @return 数据类型，未定义则返回 STRING
     */
    public String getDataType(String standardField) {
        return DATA_TYPE_MAP.getOrDefault(standardField, TYPE_STRING);
    }

    /**
     * 检查字段是否为必填
     *
     * @param standardField 标准字段名
     * @return true 如果是必填字段
     */
    public boolean isRequired(String standardField) {
        return REQUIRED_FIELDS.contains(standardField);
    }

    /**
     * 获取标准字段的所有同义词
     *
     * @param standardField 标准字段名
     * @return 同义词列表，未找到返回空列表
     */
    public List<String> getAllSynonyms(String standardField) {
        List<String> synonyms = SYNONYM_MAP.get(standardField);
        return synonyms != null ? new ArrayList<>(synonyms) : Collections.emptyList();
    }

    /**
     * 根据分类获取字段列表
     *
     * @param category 分类名: SALES, FINANCE, AR_AP, BUDGET, ORG
     * @return 该分类下的字段列表
     */
    public List<String> getFieldsByCategory(String category) {
        if (category == null) {
            return Collections.emptyList();
        }

        Set<String> fields = categoryToFieldsMap.get(category.toUpperCase());
        return fields != null ? new ArrayList<>(fields) : Collections.emptyList();
    }

    /**
     * 获取所有分类
     *
     * @return 分类名列表
     */
    public List<String> getAllCategories() {
        return new ArrayList<>(categoryToFieldsMap.keySet());
    }

    /**
     * 获取所有标准字段
     *
     * @return 所有标准字段名列表
     */
    public List<String> getAllStandardFields() {
        return new ArrayList<>(SYNONYM_MAP.keySet());
    }

    /**
     * 获取字段所属分类
     *
     * @param standardField 标准字段名
     * @return 分类名，未找到返回 null
     */
    public String getFieldCategory(String standardField) {
        for (Map.Entry<String, Set<String>> entry : categoryToFieldsMap.entrySet()) {
            if (entry.getValue().contains(standardField)) {
                return entry.getKey();
            }
        }
        return null;
    }

    /**
     * 批量查找标准字段
     *
     * @param columnNames 列名列表
     * @return Map<原列名, 标准字段名>，未匹配的列不包含在结果中
     */
    public Map<String, String> findStandardFields(List<String> columnNames) {
        Map<String, String> result = new LinkedHashMap<>();
        for (String columnName : columnNames) {
            findStandardField(columnName).ifPresent(
                standardField -> result.put(columnName, standardField)
            );
        }
        return result;
    }

    /**
     * 验证是否包含所有必填字段
     *
     * @param mappedFields 已映射的标准字段集合
     * @return 缺失的必填字段列表
     */
    public List<String> getMissingRequiredFields(Set<String> mappedFields) {
        return REQUIRED_FIELDS.stream()
                .filter(field -> !mappedFields.contains(field))
                .collect(Collectors.toList());
    }

    /**
     * 获取匹配置信度
     * 用于判断匹配质量
     *
     * @param columnName 列名
     * @param standardField 标准字段
     * @return 置信度 0-100
     */
    public int getMatchConfidence(String columnName, String standardField) {
        if (columnName == null || standardField == null) {
            return 0;
        }

        String normalizedName = columnName.trim().toLowerCase();

        // 精确匹配标准字段名
        if (normalizedName.equals(standardField) ||
            normalizedName.equals(standardField.replace("_", " ")) ||
            normalizedName.equals(standardField.replace("_", ""))) {
            return 100;
        }

        // 精确匹配同义词
        List<String> synonyms = SYNONYM_MAP.get(standardField);
        if (synonyms != null) {
            for (String synonym : synonyms) {
                if (normalizedName.equals(synonym.toLowerCase())) {
                    return 95;
                }
            }

            // 部分匹配
            for (String synonym : synonyms) {
                if (normalizedName.contains(synonym.toLowerCase()) ||
                    synonym.toLowerCase().contains(normalizedName)) {
                    return 70;
                }
            }
        }

        return 0;
    }
}
