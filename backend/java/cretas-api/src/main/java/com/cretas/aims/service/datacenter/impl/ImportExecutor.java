package com.cretas.aims.service.datacenter.impl;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.read.listener.ReadListener;
import com.alibaba.excel.util.ConverterUtils;
import com.cretas.aims.entity.datacenter.ImportRule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Import 执行器 — Excel 解析 + 行级 validator. 不写 target entity (由 ImportCommitter 接力).
 *
 * <p>Validator pipe DSL: {@code required|maxLength:100|minLength:1|numeric|email|regex:<pat>|enum:<csv>}.
 *
 * <p>Sprint 4 Chat K C-IMPORT-CENTER-1.
 */
@Slf4j
@Component
public class ImportExecutor {

    public static class DryrunResult {
        public final List<Map<String, Object>> rows;        // 映射后的 entityField → value
        public final List<Map<String, Object>> errors;       // [{row, col, msg}]
        public final int totalRows;
        public final int validRows;

        DryrunResult(List<Map<String, Object>> rows, List<Map<String, Object>> errors,
                     int totalRows, int validRows) {
            this.rows = rows;
            this.errors = errors;
            this.totalRows = totalRows;
            this.validRows = validRows;
        }
    }

    /**
     * 解析上传 Excel + 按 rule.mapping 映射 + 按 validator 校验. 不写库.
     */
    public DryrunResult parseAndValidate(ImportRule rule, InputStream excelStream) {
        List<Map<String, Object>> rawRows = readExcel(excelStream);

        List<Map<String, Object>> mapped = new ArrayList<>(rawRows.size());
        List<Map<String, Object>> errors = new ArrayList<>();
        int validRows = 0;

        for (int i = 0; i < rawRows.size(); i++) {
            Map<String, Object> raw = rawRows.get(i);
            int displayRow = i + 2;  // header is row 1, data starts row 2

            Map<String, Object> mappedRow = new LinkedHashMap<>();
            boolean rowOk = true;
            for (Map<String, Object> col : rule.getMapping()) {
                String excelCol = String.valueOf(col.get("excelCol"));
                String entityField = String.valueOf(col.get("entityField"));
                String validator = col.get("validator") == null ? "" : String.valueOf(col.get("validator"));
                Object value = raw.get(excelCol);

                List<String> errMsgs = applyValidators(value, validator);
                if (!errMsgs.isEmpty()) {
                    rowOk = false;
                    for (String msg : errMsgs) {
                        Map<String, Object> e = new LinkedHashMap<>();
                        e.put("row", displayRow);
                        e.put("col", excelCol);
                        e.put("msg", msg);
                        errors.add(e);
                    }
                }
                mappedRow.put(entityField, value);
            }
            mapped.add(mappedRow);
            if (rowOk) validRows++;
        }

        return new DryrunResult(mapped, errors, rawRows.size(), validRows);
    }

    /** EasyExcel raw 读取. 返 List of Map (key=表头, value=单元格值). */
    static List<Map<String, Object>> readExcel(InputStream stream) {
        List<Map<Integer, String>> headerHolder = new ArrayList<>(1);
        List<Map<String, Object>> rows = new ArrayList<>();

        EasyExcel.read(stream, new ReadListener<Map<Integer, Object>>() {
            @Override
            public void invokeHead(Map<Integer, com.alibaba.excel.metadata.data.ReadCellData<?>> headMap,
                                   AnalysisContext context) {
                headerHolder.add(ConverterUtils.convertToStringMap(headMap, context));
            }

            @Override
            public void invoke(Map<Integer, Object> rowMap, AnalysisContext context) {
                if (headerHolder.isEmpty()) return;
                Map<Integer, String> header = headerHolder.get(0);
                Map<String, Object> row = new LinkedHashMap<>();
                for (Map.Entry<Integer, String> h : header.entrySet()) {
                    row.put(h.getValue(), rowMap.get(h.getKey()));
                }
                rows.add(row);
            }

            @Override
            public void doAfterAllAnalysed(AnalysisContext context) {
                // no-op
            }
        }).sheet().doRead();

        return rows;
    }

    /** Pipe-separated validator DSL. */
    static List<String> applyValidators(Object value, String validator) {
        List<String> errors = new ArrayList<>();
        if (validator == null || validator.isBlank()) return errors;
        String trimmed = String.valueOf(value == null ? "" : value).trim();
        for (String rule : validator.split("\\|")) {
            String r = rule.trim();
            if (r.isEmpty()) continue;
            String key;
            String arg = null;
            int colon = r.indexOf(':');
            if (colon < 0) {
                key = r;
            } else {
                key = r.substring(0, colon);
                arg = r.substring(colon + 1);
            }
            switch (key) {
                case "required":
                    if (value == null || trimmed.isEmpty()) errors.add("必填字段为空");
                    break;
                case "maxLength":
                    if (arg != null && trimmed.length() > parseIntSafe(arg, Integer.MAX_VALUE)) {
                        errors.add("长度超过 " + arg);
                    }
                    break;
                case "minLength":
                    if (arg != null && !trimmed.isEmpty()
                            && trimmed.length() < parseIntSafe(arg, 0)) {
                        errors.add("长度小于 " + arg);
                    }
                    break;
                case "numeric":
                    if (!trimmed.isEmpty()) {
                        try { Double.parseDouble(trimmed); }
                        catch (NumberFormatException nfe) { errors.add("非数字"); }
                    }
                    break;
                case "email":
                    if (!trimmed.isEmpty() && !EMAIL_RE.matcher(trimmed).matches()) {
                        errors.add("邮箱格式错误");
                    }
                    break;
                case "regex":
                    if (arg != null && !trimmed.isEmpty()) {
                        try {
                            if (!Pattern.matches(arg, trimmed)) errors.add("格式错误");
                        } catch (Exception ex) {
                            errors.add("validator regex 配置错误: " + ex.getMessage());
                        }
                    }
                    break;
                case "enum":
                    if (arg != null && !trimmed.isEmpty()) {
                        boolean match = false;
                        for (String allowed : arg.split(",")) {
                            if (allowed.trim().equals(trimmed)) { match = true; break; }
                        }
                        if (!match) errors.add("不在枚举范围内 (" + arg + ")");
                    }
                    break;
                default:
                    log.warn("[ImportExecutor] 未知 validator: {}", key);
            }
        }
        return errors;
    }

    private static final Pattern EMAIL_RE =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    static int parseIntSafe(String s, int fallback) {
        try { return Integer.parseInt(s.trim()); }
        catch (Exception e) { return fallback; }
    }
}
