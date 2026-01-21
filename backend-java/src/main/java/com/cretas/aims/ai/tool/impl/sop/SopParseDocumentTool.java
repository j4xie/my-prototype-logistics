package com.cretas.aims.ai.tool.impl.sop;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.config.DashScopeConfig;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URL;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SOP 文档解析工具
 *
 * <p>解析 SOP 文档(PDF/Excel/图片)，提取工序步骤、时间要求、技能要求等信息。
 *
 * <p>支持的文件类型:
 * <ul>
 *   <li>PDF: 使用文本提取（通过 AI 解析）</li>
 *   <li>Excel: 直接解析表格结构</li>
 *   <li>图片: 调用 OCR（DashScope Vision）</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@Component
public class SopParseDocumentTool extends AbstractBusinessTool {

    @Autowired
    @Lazy
    private DashScopeClient dashScopeClient;

    @Autowired
    @Lazy
    private DashScopeConfig dashScopeConfig;

    @Override
    public String getToolName() {
        return "sop_parse_document";
    }

    @Override
    public String getDescription() {
        return "解析SOP文档(PDF/Excel/图片)，提取工序步骤、时间要求、技能要求等信息。" +
               "支持自动识别文件类型并选择相应的解析策略。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // fileUrl: 文件URL（必需）
        Map<String, Object> fileUrl = new HashMap<>();
        fileUrl.put("type", "string");
        fileUrl.put("description", "SOP文档的URL地址，支持PDF、Excel、图片格式");
        properties.put("fileUrl", fileUrl);

        // fileType: 文件类型（可选，自动检测）
        Map<String, Object> fileType = new HashMap<>();
        fileType.put("type", "string");
        fileType.put("description", "文件类型: PDF, EXCEL, IMAGE。如不提供则自动检测。");
        fileType.put("enum", Arrays.asList("PDF", "EXCEL", "IMAGE"));
        properties.put("fileType", fileType);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("fileUrl"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("fileUrl");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        String fileUrl = getString(params, "fileUrl");
        String fileType = getString(params, "fileType");

        // 自动检测文件类型
        if (fileType == null || fileType.isEmpty()) {
            fileType = detectFileType(fileUrl);
        }

        log.info("开始解析SOP文档: factoryId={}, fileUrl={}, fileType={}", factoryId, fileUrl, fileType);

        // 根据文件类型选择解析策略
        SopParseResult result;
        switch (fileType.toUpperCase()) {
            case "PDF":
                result = parsePdfDocument(fileUrl);
                break;
            case "EXCEL":
            case "XLS":
            case "XLSX":
                result = parseExcelDocument(fileUrl);
                break;
            case "IMAGE":
            case "PNG":
            case "JPG":
            case "JPEG":
                result = parseImageDocument(fileUrl);
                break;
            default:
                throw new IllegalArgumentException("不支持的文件类型: " + fileType);
        }

        log.info("SOP文档解析完成: 识别到 {} 个工序步骤", result.getSteps().size());

        // 构建返回结果
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("fileUrl", fileUrl);
        response.put("fileType", fileType);
        response.put("content", result.getContent());
        response.put("steps", result.getSteps());
        response.put("stepCount", result.getSteps().size());
        response.put("metadata", result.getMetadata());
        response.put("message", String.format("成功解析SOP文档，识别到 %d 个工序步骤", result.getSteps().size()));

        return response;
    }

    /**
     * 检测文件类型
     */
    private String detectFileType(String fileUrl) {
        String url = fileUrl.toLowerCase();
        if (url.endsWith(".pdf")) {
            return "PDF";
        } else if (url.endsWith(".xlsx") || url.endsWith(".xls")) {
            return "EXCEL";
        } else if (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg")) {
            return "IMAGE";
        }

        // 尝试从Content-Type判断
        log.warn("无法从URL后缀判断文件类型，默认使用PDF: {}", fileUrl);
        return "PDF";
    }

    /**
     * 解析PDF文档
     * 1. 从URL下载PDF
     * 2. 使用PDFBox提取文本
     * 3. 发送文本给AI进行结构化解析
     */
    private SopParseResult parsePdfDocument(String fileUrl) {
        // 1. 下载并提取PDF文本
        String pdfText;
        try {
            pdfText = extractPdfText(fileUrl);
            log.info("PDF文本提取完成，共 {} 个字符", pdfText.length());
        } catch (Exception e) {
            log.error("PDF文本提取失败: {}", e.getMessage(), e);
            return createEmptyResult(fileUrl, "PDF文本提取失败: " + e.getMessage());
        }

        // 如果提取到的文本为空或太短，直接返回
        if (pdfText == null || pdfText.trim().length() < 10) {
            log.warn("PDF文本内容为空或太短");
            return createEmptyResult(fileUrl, "PDF文本内容为空或无法提取");
        }

        // 2. 使用AI来解析提取的文本内容
        String systemPrompt = """
            你是一个SOP文档解析专家。请分析提供的SOP文档内容，提取以下信息：
            1. 工序步骤列表（按顺序）
            2. 每个步骤的时间要求
            3. 每个步骤的技能要求
            4. 质检点
            5. 特殊设备要求

            请以JSON格式输出：
            {
                "steps": [
                    {
                        "orderIndex": 1,
                        "name": "步骤名称",
                        "description": "步骤描述",
                        "timeLimitMinutes": 10,
                        "skillLevel": 2,
                        "isQualityCheckpoint": false,
                        "equipmentRequired": []
                    }
                ],
                "metadata": {
                    "productName": "产品名称",
                    "totalEstimatedMinutes": 60,
                    "specialNotes": "特殊注意事项"
                }
            }

            仅返回JSON，不要包含其他文字。
            """;

        // 限制文本长度，避免超出token限制
        String truncatedText = pdfText.length() > 8000 ? pdfText.substring(0, 8000) + "\n...(内容已截断)" : pdfText;
        String userPrompt = "请解析以下SOP文档内容:\n\n" + truncatedText;

        try {
            String response = dashScopeClient.chat(systemPrompt, userPrompt);
            SopParseResult result = parseAiResponse(response, fileUrl);
            // 保存原始PDF文本
            result.setContent(pdfText);
            return result;
        } catch (Exception e) {
            log.error("AI解析PDF内容失败: {}", e.getMessage(), e);
            // 返回原始文本，但没有结构化的步骤
            SopParseResult result = createEmptyResult(fileUrl, "AI解析失败: " + e.getMessage());
            result.setContent(pdfText);
            return result;
        }
    }

    /**
     * 从URL下载PDF并提取文本
     */
    private String extractPdfText(String fileUrl) throws Exception {
        log.info("开始下载PDF: {}", fileUrl);

        try (InputStream is = new URL(fileUrl).openStream();
             PDDocument document = PDDocument.load(is)) {

            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);

            String text = stripper.getText(document);
            log.info("PDF解析成功，页数: {}, 文本长度: {}", document.getNumberOfPages(), text.length());

            return text;
        }
    }

    /**
     * 解析Excel文档
     */
    private SopParseResult parseExcelDocument(String fileUrl) {
        SopParseResult result = new SopParseResult();
        result.setContent("");
        result.setSteps(new ArrayList<>());
        result.setMetadata(new HashMap<>());

        try (InputStream is = new URL(fileUrl).openStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            StringBuilder content = new StringBuilder();
            List<Map<String, Object>> steps = new ArrayList<>();

            // 解析表头
            Row headerRow = sheet.getRow(0);
            List<String> headers = new ArrayList<>();
            if (headerRow != null) {
                for (Cell cell : headerRow) {
                    headers.add(getCellValueAsString(cell));
                }
            }

            // 解析数据行
            int orderIndex = 1;
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                Map<String, Object> step = new LinkedHashMap<>();
                step.put("orderIndex", orderIndex++);

                StringBuilder rowContent = new StringBuilder();
                for (int j = 0; j < headers.size() && j < row.getLastCellNum(); j++) {
                    Cell cell = row.getCell(j);
                    String value = getCellValueAsString(cell);
                    String header = headers.get(j).toLowerCase();

                    // 映射常见列名
                    if (header.contains("步骤") || header.contains("name") || header.contains("工序")) {
                        step.put("name", value);
                    } else if (header.contains("描述") || header.contains("description")) {
                        step.put("description", value);
                    } else if (header.contains("时间") || header.contains("time") || header.contains("分钟")) {
                        step.put("timeLimitMinutes", parseMinutes(value));
                    } else if (header.contains("技能") || header.contains("skill") || header.contains("等级")) {
                        step.put("skillLevel", parseSkillLevel(value));
                    } else if (header.contains("质检") || header.contains("检查") || header.contains("quality")) {
                        step.put("isQualityCheckpoint", parseBoolean(value));
                    }

                    rowContent.append(value).append("\t");
                }

                // 确保步骤有名称
                if (!step.containsKey("name") || step.get("name") == null) {
                    Cell firstCell = row.getCell(0);
                    step.put("name", getCellValueAsString(firstCell));
                }

                if (step.get("name") != null && !step.get("name").toString().trim().isEmpty()) {
                    steps.add(step);
                }

                content.append(rowContent).append("\n");
            }

            result.setContent(content.toString());
            result.setSteps(steps);
            result.getMetadata().put("sheetName", sheet.getSheetName());
            result.getMetadata().put("totalRows", sheet.getLastRowNum());

        } catch (Exception e) {
            log.error("Excel解析失败: {}", e.getMessage(), e);
            return createEmptyResult(fileUrl, "Excel解析失败: " + e.getMessage());
        }

        return result;
    }

    /**
     * 解析图片文档（通过Vision AI OCR）
     */
    private SopParseResult parseImageDocument(String fileUrl) {
        String prompt = """
            你是一个SOP文档OCR专家。请识别图片中的SOP文档内容，提取以下信息：
            1. 工序步骤列表（按顺序）
            2. 每个步骤的时间要求
            3. 每个步骤的技能要求
            4. 质检点
            5. 特殊设备要求

            请以JSON格式输出：
            {
                "steps": [
                    {
                        "orderIndex": 1,
                        "name": "步骤名称",
                        "description": "步骤描述",
                        "timeLimitMinutes": 10,
                        "skillLevel": 2,
                        "isQualityCheckpoint": false,
                        "equipmentRequired": []
                    }
                ],
                "metadata": {
                    "productName": "产品名称",
                    "totalEstimatedMinutes": 60,
                    "specialNotes": "特殊注意事项"
                }
            }

            仅返回 JSON，不要包含其他文字。
            """;

        try {
            // 使用 Vision 模型分析图片
            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(dashScopeConfig.getVisionModel())
                    .messages(List.of(ChatMessage.userWithImageUrl(prompt, fileUrl)))
                    .maxTokens(2000)
                    .temperature(0.3)
                    .build();

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

            if (response.hasError()) {
                log.error("Vision API 调用失败: {}", response.getErrorMessage());
                return createEmptyResult(fileUrl, "Vision API 调用失败: " + response.getErrorMessage());
            }

            return parseAiResponse(response.getContent(), fileUrl);
        } catch (Exception e) {
            log.error("图片OCR解析失败: {}", e.getMessage(), e);
            return createEmptyResult(fileUrl, "图片OCR解析失败: " + e.getMessage());
        }
    }

    /**
     * 解析AI响应
     */
    private SopParseResult parseAiResponse(String response, String fileUrl) {
        SopParseResult result = new SopParseResult();
        result.setContent(response);
        result.setSteps(new ArrayList<>());
        result.setMetadata(new HashMap<>());

        try {
            // 提取JSON部分
            String jsonStr = extractJson(response);
            if (jsonStr != null) {
                Map<String, Object> parsed = objectMapper.readValue(jsonStr,
                        new TypeReference<Map<String, Object>>() {});

                if (parsed.containsKey("steps")) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> steps = (List<Map<String, Object>>) parsed.get("steps");
                    result.setSteps(steps);
                }

                if (parsed.containsKey("metadata")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> metadata = (Map<String, Object>) parsed.get("metadata");
                    result.setMetadata(metadata);
                }
            }
        } catch (Exception e) {
            log.warn("AI响应解析失败，使用原始内容: {}", e.getMessage());
        }

        return result;
    }

    /**
     * 从文本中提取JSON
     */
    private String extractJson(String text) {
        // 尝试匹配 {...} 或 ```json ... ```
        Pattern jsonPattern = Pattern.compile("```json\\s*([\\s\\S]*?)\\s*```|\\{[\\s\\S]*\\}");
        Matcher matcher = jsonPattern.matcher(text);
        if (matcher.find()) {
            String match = matcher.group(1) != null ? matcher.group(1) : matcher.group();
            if (!match.startsWith("{")) {
                match = "{" + match + "}";
            }
            return match.trim();
        }
        return null;
    }

    /**
     * 获取单元格值为字符串
     */
    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toString();
                }
                return String.valueOf((int) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue();
                } catch (Exception e) {
                    return String.valueOf(cell.getNumericCellValue());
                }
            default:
                return "";
        }
    }

    /**
     * 解析分钟数
     */
    private Integer parseMinutes(String value) {
        if (value == null || value.isEmpty()) return null;
        try {
            return Integer.parseInt(value.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 解析技能等级
     */
    private Integer parseSkillLevel(String value) {
        if (value == null || value.isEmpty()) return 1;
        try {
            int level = Integer.parseInt(value.replaceAll("[^0-9]", ""));
            return Math.min(Math.max(level, 1), 5);
        } catch (NumberFormatException e) {
            // 尝试解析文字描述
            if (value.contains("高级") || value.contains("专家")) return 5;
            if (value.contains("中级") || value.contains("熟练")) return 3;
            if (value.contains("初级") || value.contains("基础")) return 1;
            return 2;
        }
    }

    /**
     * 解析布尔值
     */
    private Boolean parseBoolean(String value) {
        if (value == null || value.isEmpty()) return false;
        return value.contains("是") || value.contains("yes") ||
               value.contains("true") || value.equals("1") ||
               value.contains("需要") || value.contains("必须");
    }

    /**
     * 创建空结果
     */
    private SopParseResult createEmptyResult(String fileUrl, String error) {
        SopParseResult result = new SopParseResult();
        result.setContent("");
        result.setSteps(new ArrayList<>());
        result.setMetadata(new HashMap<>());
        result.getMetadata().put("error", error);
        result.getMetadata().put("fileUrl", fileUrl);
        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        if ("fileUrl".equals(paramName)) {
            return "请提供SOP文档的URL地址。";
        }
        return super.getParameterQuestion(paramName);
    }

    /**
     * SOP解析结果内部类
     */
    private static class SopParseResult {
        private String content;
        private List<Map<String, Object>> steps;
        private Map<String, Object> metadata;

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
        public List<Map<String, Object>> getSteps() { return steps; }
        public void setSteps(List<Map<String, Object>> steps) { this.steps = steps; }
        public Map<String, Object> getMetadata() { return metadata; }
        public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    }
}
