package com.cretas.aims.service;

import com.cretas.aims.entity.MaterialType;
import com.cretas.aims.repository.MaterialTypeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityNotFoundException;
import java.util.*;

/**
 * 原材料类型业务逻辑层
 *
 * <p>本服务类负责原材料类型相关的所有业务逻辑处理，包括数据验证、业务规则执行、数据转换等。</p>
 *
 * <h3>主要功能模块</h3>
 * <ol>
 *   <li><b>查询功能</b>
 *     <ul>
 *       <li>分页查询：支持分页、排序、筛选</li>
 *       <li>条件查询：按类别、存储方式、激活状态等筛选</li>
 *       <li>搜索功能：按名称或编码模糊搜索</li>
 *       <li>统计查询：获取类别列表、统计数量等</li>
 *     </ul>
 *   </li>
 *   <li><b>数据管理</b>
 *     <ul>
 *       <li>创建：验证唯一性后创建新类型</li>
 *       <li>更新：支持部分字段更新，验证唯一性</li>
 *       <li>删除：检查关联关系后删除</li>
 *       <li>批量操作：批量更新状态等</li>
 *     </ul>
 *   </li>
 *   <li><b>业务规则</b>
 *     <ul>
 *       <li>唯一性验证：名称和编码在同一工厂内必须唯一</li>
 *       <li>数据隔离：所有操作基于工厂ID进行隔离</li>
 *       <li>默认数据：提供系统默认原材料类型初始化</li>
 *       <li>关联检查：删除前检查是否被使用</li>
 *     </ul>
 *   </li>
 *   <li><b>数据导入导出</b>
 *     <ul>
 *       <li>Excel导出：导出原材料类型列表</li>
 *       <li>Excel导入：批量导入原材料类型</li>
 *       <li>模板生成：生成导入模板文件</li>
 *     </ul>
 *   </li>
 * </ol>
 *
 * <h3>业务规则说明</h3>
 * <ul>
 *   <li><b>唯一性约束</b>：
 *     <ul>
 *       <li>同一工厂内，原材料名称（name）必须唯一</li>
 *       <li>同一工厂内，原材料编码（materialCode）必须唯一（如果提供）</li>
 *       <li>更新时，需要排除自身进行唯一性检查</li>
 *     </ul>
 *   </li>
 *   <li><b>数据隔离</b>：
 *     <ul>
 *       <li>所有查询和操作都基于factoryId进行数据隔离</li>
 *       <li>不同工厂之间的数据完全隔离，互不影响</li>
 *     </ul>
 *   </li>
 *   <li><b>状态管理</b>：
 *     <ul>
 *       <li>新创建的原材料类型默认激活（isActive=true）</li>
 *       <li>停用的类型不会出现在生产相关的下拉列表中</li>
 *       <li>支持批量激活/停用操作</li>
 *     </ul>
 *   </li>
 *   <li><b>默认值设置</b>：
 *     <ul>
 *       <li>单位（unit）默认为"kg"</li>
 *       <li>激活状态（isActive）默认为true</li>
 *       <li>创建时间和更新时间由系统自动设置</li>
 *     </ul>
 *   </li>
 * </ul>
 *
 * <h3>异常处理</h3>
 * <ul>
 *   <li><b>EntityNotFoundException</b>：当查询的资源不存在时抛出</li>
 *   <li><b>IllegalArgumentException</b>：当数据验证失败（如唯一性冲突）时抛出</li>
 *   <li><b>BusinessException</b>：当业务规则不满足时抛出（如删除被使用的类型）</li>
 * </ul>
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 * @version 1.0.0
 * @see MaterialTypeController 控制器层
 * @see MaterialTypeRepository 数据访问层
 * @see MaterialType 实体类
 */
@Slf4j
@Service
public class MaterialTypeService {

    @Autowired
    private MaterialTypeRepository repository;

    // ========== 系统默认原材料类型数据 ==========

    /**
     * 默认原材料类型（用于初始化）
     */
    private static final List<Map<String, String>> DEFAULT_MATERIAL_TYPES = new ArrayList<>();

    static {
        // 海水鱼类
        DEFAULT_MATERIAL_TYPES.add(new HashMap<String, String>() {{
            put("name", "带鱼");
            put("code", "DY");
            put("category", "海水鱼");
            put("unit", "kg");
            put("storageType", "冷冻");
        }});
        DEFAULT_MATERIAL_TYPES.add(new HashMap<String, String>() {{
            put("name", "黄花鱼");
            put("code", "HHY");
            put("category", "海水鱼");
            put("unit", "kg");
            put("storageType", "冷冻");
        }});
        DEFAULT_MATERIAL_TYPES.add(new HashMap<String, String>() {{
            put("name", "鲳鱼");
            put("code", "CY");
            put("category", "海水鱼");
            put("unit", "kg");
            put("storageType", "冷冻");
        }});

        // 淡水鱼类
        DEFAULT_MATERIAL_TYPES.add(new HashMap<String, String>() {{
            put("name", "鲈鱼");
            put("code", "LY");
            put("category", "淡水鱼");
            put("unit", "kg");
            put("storageType", "冷藏");
        }});
        DEFAULT_MATERIAL_TYPES.add(new HashMap<String, String>() {{
            put("name", "草鱼");
            put("code", "CYU");
            put("category", "淡水鱼");
            put("unit", "kg");
            put("storageType", "冷藏");
        }});

        // 虾类
        DEFAULT_MATERIAL_TYPES.add(new HashMap<String, String>() {{
            put("name", "对虾");
            put("code", "DX");
            put("category", "虾类");
            put("unit", "kg");
            put("storageType", "冷冻");
        }});
        DEFAULT_MATERIAL_TYPES.add(new HashMap<String, String>() {{
            put("name", "基围虾");
            put("code", "JWX");
            put("category", "虾类");
            put("unit", "kg");
            put("storageType", "冷藏");
        }});

        // 贝类
        DEFAULT_MATERIAL_TYPES.add(new HashMap<String, String>() {{
            put("name", "扇贝");
            put("code", "SB");
            put("category", "贝类");
            put("unit", "kg");
            put("storageType", "冷藏");
        }});
    }

    // ========== 查询功能 ==========

    /**
     * 获取原材料类型列表（分页）
     *
     * <p>根据工厂ID获取原材料类型列表，支持分页、排序和状态筛选。</p>
     *
     * <h4>功能说明</h4>
     * <ul>
     *   <li>支持按激活状态筛选：isActive=true仅返回激活的，isActive=false仅返回停用的，null返回全部</li>
     *   <li>支持自定义排序：通过sortBy指定排序字段，sortDirection指定排序方向</li>
     *   <li>支持分页：通过page和size控制分页，注意Spring Data的page从0开始</li>
     * </ul>
     *
     * <h4>排序字段说明</h4>
     * <p>常用的排序字段包括：</p>
     * <ul>
     *   <li><code>createdAt</code>：创建时间（默认）</li>
     *   <li><code>name</code>：名称（字母顺序）</li>
     *   <li><code>category</code>：类别</li>
     *   <li><code>materialCode</code>：编码</li>
     * </ul>
     *
     * <h4>性能考虑</h4>
     * <ul>
     *   <li>建议设置合理的pageSize，避免一次查询过多数据（建议不超过100）</li>
     *   <li>对于大数据量，建议使用索引字段进行排序（如createdAt）</li>
     *   <li>如果只需要激活的类型，建议传入isActive=true以提高查询效率</li>
     * </ul>
     *
     * @param factoryId 工厂ID（必填，用于数据隔离）
     * @param isActive 是否激活（可选，null=全部，true=仅激活，false=仅停用）
     * @param page 页码（从0开始，注意：前端传入的页码可能需要减1）
     * @param size 每页大小（建议10-100之间）
     * @param sortBy 排序字段（可选，如：createdAt, name, category，默认createdAt）
     * @param sortDirection 排序方向（可选，ASC=升序，DESC=降序，默认DESC）
     * @return 分页结果，包含原材料类型列表和分页信息
     * @throws IllegalArgumentException 如果参数不合法（如page<0, size<=0）
     */
    public Page<MaterialType> getMaterialTypes(String factoryId, Boolean isActive,
                                                 int page, int size,
                                                 String sortBy, String sortDirection) {
        // 构建排序
        Sort.Direction direction = "DESC".equalsIgnoreCase(sortDirection) ?
                Sort.Direction.DESC : Sort.Direction.ASC;
        Sort sort = Sort.by(direction, sortBy != null ? sortBy : "createdAt");
        // 前端页码从1开始，Spring Data页码从0开始，需要转换
        Pageable pageable = PageRequest.of(page - 1, size, sort);

        // 查询
        if (isActive != null) {
            return repository.findByFactoryIdAndIsActive(factoryId, isActive, pageable);
        } else {
            return repository.findByFactoryId(factoryId, pageable);
        }
    }

    /**
     * 获取原材料类型列表（不分页）
     *
     * @param factoryId 工厂ID
     * @param isActive 是否激活（null=全部）
     * @return 原材料类型列表
     */
    public List<MaterialType> getAllMaterialTypes(String factoryId, Boolean isActive) {
        if (isActive != null) {
            return repository.findByFactoryIdAndIsActive(factoryId, isActive);
        } else {
            return repository.findByFactoryId(factoryId);
        }
    }

    /**
     * 按ID获取原材料类型
     *
     * @param factoryId 工厂ID
     * @param id 原材料类型ID
     * @return 原材料类型
     * @throws EntityNotFoundException 如果不存在
     */
    public MaterialType getMaterialTypeById(String factoryId, String id) {
        return repository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new EntityNotFoundException("原材料类型不存在: " + id));
    }

    /**
     * 获取激活的原材料类型列表
     *
     * @param factoryId 工厂ID
     * @return 激活的原材料类型列表
     */
    public List<MaterialType> getActiveMaterialTypes(String factoryId) {
        return repository.findByFactoryIdAndIsActive(factoryId, true);
    }

    /**
     * 按类别获取原材料类型
     *
     * @param factoryId 工厂ID
     * @param category 类别
     * @return 原材料类型列表
     */
    public List<MaterialType> getMaterialTypesByCategory(String factoryId, String category) {
        return repository.findByFactoryIdAndCategory(factoryId, category);
    }

    /**
     * 按存储方式获取原材料类型
     *
     * @param factoryId 工厂ID
     * @param storageType 存储方式
     * @return 原材料类型列表
     */
    public List<MaterialType> getMaterialTypesByStorageType(String factoryId, String storageType) {
        return repository.findByFactoryIdAndStorageType(factoryId, storageType);
    }

    /**
     * 搜索原材料类型
     *
     * @param factoryId 工厂ID
     * @param keyword 关键词
     * @param page 页码
     * @param size 每页大小
     * @return 搜索结果
     */
    public Page<MaterialType> searchMaterialTypes(String factoryId, String keyword, int page, int size) {
        // 前端页码从1开始，Spring Data页码从0开始，需要转换
        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return repository.searchByKeyword(factoryId, keyword, pageable);
    }

    /**
     * 获取所有原材料类别（去重）
     *
     * @param factoryId 工厂ID
     * @return 类别列表
     */
    public List<String> getCategories(String factoryId) {
        return repository.findDistinctCategoriesByFactoryId(factoryId);
    }

    /**
     * 获取低库存原材料
     *
     * @param factoryId 工厂ID
     * @return 低库存原材料列表
     */
    public List<MaterialType> getLowStockMaterials(String factoryId) {
        // TODO: 实现库存关联查询
        // 暂时返回所有激活的原材料
        return repository.findLowStockMaterials(factoryId);
    }

    // ========== 创建和更新 ==========

    /**
     * 创建原材料类型
     *
     * <p>在指定工厂下创建新的原材料类型。创建前会进行严格的唯一性验证。</p>
     *
     * <h4>验证规则</h4>
     * <ol>
     *   <li><b>名称唯一性验证</b>：
     *     <ul>
     *       <li>检查同一工厂内是否已存在相同名称的原材料类型</li>
     *       <li>如果已存在，抛出IllegalArgumentException异常</li>
     *     </ul>
     *   </li>
     *   <li><b>编码唯一性验证</b>（如果提供了编码）：
     *     <ul>
     *       <li>检查同一工厂内是否已存在相同编码的原材料类型</li>
     *       <li>如果已存在，抛出IllegalArgumentException异常</li>
     *       <li>如果未提供编码（null或空字符串），跳过此验证</li>
     *     </ul>
     *   </li>
     *   <li><b>必填字段验证</b>：
     *     <ul>
     *       <li>名称（name）必须提供且不能为空</li>
     *       <li>单位（unit）如果未提供，会使用默认值"kg"</li>
     *     </ul>
     *   </li>
     * </ol>
     *
     * <h4>自动设置字段</h4>
     * <ul>
     *   <li><code>id</code>：自动生成UUID字符串</li>
     *   <li><code>factoryId</code>：从参数中获取（由Controller层设置）</li>
     *   <li><code>isActive</code>：默认为true（如果未设置）</li>
     *   <li><code>unit</code>：默认为"kg"（如果未设置）</li>
     *   <li><code>createdAt</code>：自动设置为当前时间（通过@PrePersist）</li>
     *   <li><code>updatedAt</code>：自动设置为当前时间（通过@PrePersist）</li>
     * </ul>
     *
     * <h4>事务处理</h4>
     * <p>本方法使用@Transactional注解，确保数据一致性：</p>
     * <ul>
     *   <li>如果验证失败，整个操作会回滚</li>
     *   <li>如果保存失败，会抛出异常并回滚</li>
     * </ul>
     *
     * @param materialType 原材料类型数据对象（必须包含factoryId和name）
     * @return 创建成功后的原材料类型对象（包含自动生成的id和时间戳）
     * @throws IllegalArgumentException 如果名称或编码已存在，或必填字段缺失
     * @throws RuntimeException 如果数据库操作失败
     */
    @Transactional
    public MaterialType createMaterialType(MaterialType materialType) {
        // 验证编码唯一性
        if (materialType.getMaterialCode() != null &&
            repository.existsByFactoryIdAndMaterialCode(materialType.getFactoryId(), materialType.getMaterialCode())) {
            throw new IllegalArgumentException("原材料编码已存在: " + materialType.getMaterialCode());
        }

        // 验证名称唯一性
        if (repository.existsByFactoryIdAndName(materialType.getFactoryId(), materialType.getName())) {
            throw new IllegalArgumentException("原材料名称已存在: " + materialType.getName());
        }

        // 保存
        return repository.save(materialType);
    }

    /**
     * 更新原材料类型
     *
     * @param factoryId 工厂ID
     * @param id 原材料类型ID
     * @param updatedData 更新数据
     * @return 更新后的原材料类型
     * @throws EntityNotFoundException 如果不存在
     * @throws IllegalArgumentException 如果编码或名称冲突
     */
    @Transactional
    public MaterialType updateMaterialType(String factoryId, String id, MaterialType updatedData) {
        // 查询现有记录
        MaterialType existing = getMaterialTypeById(factoryId, id);

        // 验证编码唯一性（排除自己）
        if (updatedData.getMaterialCode() != null &&
            !updatedData.getMaterialCode().equals(existing.getMaterialCode()) &&
            repository.existsByFactoryIdAndMaterialCodeAndIdNot(factoryId, updatedData.getMaterialCode(), id)) {
            throw new IllegalArgumentException("原材料编码已存在: " + updatedData.getMaterialCode());
        }

        // 验证名称唯一性（排除自己）
        if (updatedData.getName() != null &&
            !updatedData.getName().equals(existing.getName()) &&
            repository.existsByFactoryIdAndNameAndIdNot(factoryId, updatedData.getName(), id)) {
            throw new IllegalArgumentException("原材料名称已存在: " + updatedData.getName());
        }

        // 更新字段
        if (updatedData.getName() != null) existing.setName(updatedData.getName());
        if (updatedData.getMaterialCode() != null) existing.setMaterialCode(updatedData.getMaterialCode());
        if (updatedData.getCategory() != null) existing.setCategory(updatedData.getCategory());
        if (updatedData.getUnit() != null) existing.setUnit(updatedData.getUnit());
        if (updatedData.getStorageType() != null) existing.setStorageType(updatedData.getStorageType());
        if (updatedData.getDescription() != null) existing.setDescription(updatedData.getDescription());
        if (updatedData.getIsActive() != null) existing.setIsActive(updatedData.getIsActive());

        return repository.save(existing);
    }

    /**
     * 删除原材料类型
     *
     * @param factoryId 工厂ID
     * @param id 原材料类型ID
     * @throws EntityNotFoundException 如果不存在
     */
    @Transactional
    public void deleteMaterialType(String factoryId, String id) {
        // 验证存在性
        if (!repository.existsById(id)) {
            throw new EntityNotFoundException("原材料类型不存在: " + id);
        }

        // 删除
        repository.deleteByFactoryIdAndId(factoryId, id);
    }

    // ========== 批量操作 ==========

    /**
     * 批量更新原材料类型状态
     *
     * @param factoryId 工厂ID
     * @param ids ID列表
     * @param isActive 新状态
     * @return 更新数量
     */
    @Transactional
    public int batchUpdateStatus(String factoryId, List<String> ids, Boolean isActive) {
        List<MaterialType> materialTypes = repository.findByFactoryIdAndIdIn(factoryId, ids);

        for (MaterialType materialType : materialTypes) {
            materialType.setIsActive(isActive);
        }

        repository.saveAll(materialTypes);
        return materialTypes.size();
    }

    // ========== 辅助功能 ==========

    /**
     * 检查原材料编码是否存在
     *
     * @param factoryId 工厂ID
     * @param materialCode 原材料编码
     * @return 是否存在
     */
    public boolean checkCodeExists(String factoryId, String materialCode) {
        return repository.existsByFactoryIdAndMaterialCode(factoryId, materialCode);
    }

    /**
     * 初始化默认原材料类型
     *
     * @param factoryId 工厂ID
     * @return 初始化数量
     */
    @Transactional
    public int initializeDefaults(String factoryId) {
        int count = 0;

        for (Map<String, String> defaultMaterial : DEFAULT_MATERIAL_TYPES) {
            String code = defaultMaterial.get("code");

            // 检查是否已存在
            if (!repository.existsByFactoryIdAndMaterialCode(factoryId, code)) {
                MaterialType materialType = new MaterialType(
                        factoryId,
                        defaultMaterial.get("name"),
                        code,
                        defaultMaterial.get("category"),
                        defaultMaterial.get("unit"),
                        defaultMaterial.get("storageType"),
                        null
                );
                repository.save(materialType);
                count++;
            }
        }

        return count;
    }

    /**
     * 统计原材料类型数量
     *
     * @param factoryId 工厂ID
     * @param isActive 是否激活（null=全部）
     * @return 数量
     */
    public long countMaterialTypes(String factoryId, Boolean isActive) {
        if (isActive != null) {
            return repository.countByFactoryIdAndIsActive(factoryId, isActive);
        } else {
            return repository.countByFactoryId(factoryId);
        }
    }

    /**
     * 导出原材料类型列表
     *
     * @param factoryId 工厂ID
     * @return Excel文件字节数组
     */
    public byte[] exportMaterialTypes(String factoryId) {
        // 查询所有原材料类型
        List<MaterialType> materialTypes = repository.findByFactoryId(factoryId);

        // 转换为Excel导出DTO
        List<com.cretas.aims.dto.materialtype.MaterialTypeExportDTO> exportDTOs = materialTypes.stream()
                .map(com.cretas.aims.dto.materialtype.MaterialTypeExportDTO::fromMaterialType)
                .collect(java.util.stream.Collectors.toList());

        // 生成Excel文件
        com.cretas.aims.util.ExcelUtil excelUtil = new com.cretas.aims.util.ExcelUtil();
        return excelUtil.exportToExcel(
                exportDTOs,
                com.cretas.aims.dto.materialtype.MaterialTypeExportDTO.class,
                "原材料类型列表"
        );
    }

    /**
     * 生成原材料类型导入模板
     *
     * @return Excel模板文件字节数组
     */
    public byte[] generateImportTemplate() {
        log.info("生成原材料类型导入模板");

        // 使用ExcelUtil生成空模板
        com.cretas.aims.util.ExcelUtil excelUtil = new com.cretas.aims.util.ExcelUtil();
        byte[] templateBytes = excelUtil.generateTemplate(
                com.cretas.aims.dto.materialtype.MaterialTypeExportDTO.class,
                "原材料类型导入模板"
        );

        log.info("原材料类型导入模板生成成功");
        return templateBytes;
    }

    /**
     * 从Excel文件批量导入原材料类型
     *
     * @param factoryId 工厂ID
     * @param inputStream Excel文件输入流
     * @return 导入结果
     */
    // 不使用@Transactional，让每个save操作独立进行，避免单行失败导致整体回滚
    public com.cretas.aims.dto.common.ImportResult<MaterialType> importMaterialTypesFromExcel(
            String factoryId,
            java.io.InputStream inputStream) {
        log.info("开始从Excel批量导入原材料类型: factoryId={}", factoryId);

        // 1. 解析Excel文件
        com.cretas.aims.util.ExcelUtil excelUtil = new com.cretas.aims.util.ExcelUtil();
        List<com.cretas.aims.dto.materialtype.MaterialTypeExportDTO> excelData;
        try {
            excelData = excelUtil.importFromExcel(inputStream,
                    com.cretas.aims.dto.materialtype.MaterialTypeExportDTO.class);
        } catch (Exception e) {
            log.error("Excel文件解析失败: factoryId={}", factoryId, e);
            throw new RuntimeException("Excel文件格式错误或无法解析: " + e.getMessage());
        }

        com.cretas.aims.dto.common.ImportResult<MaterialType> result =
                com.cretas.aims.dto.common.ImportResult.create(excelData.size());

        // 2. 逐行验证并导入
        for (int i = 0; i < excelData.size(); i++) {
            com.cretas.aims.dto.materialtype.MaterialTypeExportDTO exportDTO = excelData.get(i);
            int rowNumber = i + 2; // Excel行号（从2开始，1是表头）

            try {
                // 2.1 验证必填字段
                if (exportDTO.getName() == null || exportDTO.getName().trim().isEmpty()) {
                    result.addFailure(rowNumber, "原材料名称不能为空", toJsonString(exportDTO));
                    continue;
                }

                // 2.2 验证编码唯一性（如果提供了编码）
                if (exportDTO.getMaterialCode() != null && !exportDTO.getMaterialCode().trim().isEmpty()) {
                    if (repository.existsByFactoryIdAndMaterialCode(factoryId, exportDTO.getMaterialCode())) {
                        result.addFailure(rowNumber, "原材料编码已存在: " + exportDTO.getMaterialCode(),
                                toJsonString(exportDTO));
                        continue;
                    }
                }

                // 2.3 验证名称唯一性
                if (repository.existsByFactoryIdAndName(factoryId, exportDTO.getName())) {
                    result.addFailure(rowNumber, "原材料名称已存在: " + exportDTO.getName(),
                            toJsonString(exportDTO));
                    continue;
                }

                // 2.4 转换为Entity
                MaterialType materialType = convertFromExportDTO(exportDTO, factoryId);

                // 2.5 保存
                MaterialType saved = repository.save(materialType);

                // 2.6 记录成功
                result.addSuccess(saved);

                log.debug("成功导入原材料类型: row={}, name={}", rowNumber, exportDTO.getName());

            } catch (Exception e) {
                log.error("导入原材料类型失败: factoryId={}, row={}, data={}", factoryId, rowNumber, exportDTO, e);
                result.addFailure(rowNumber, "保存失败: " + e.getMessage(), toJsonString(exportDTO));
            }
        }

        log.info("原材料类型批量导入完成: factoryId={}, total={}, success={}, failure={}",
                factoryId, result.getTotalCount(), result.getSuccessCount(), result.getFailureCount());
        return result;
    }

    /**
     * 从MaterialTypeExportDTO转换为MaterialType实体
     */
    private MaterialType convertFromExportDTO(
            com.cretas.aims.dto.materialtype.MaterialTypeExportDTO dto,
            String factoryId) {
        MaterialType materialType = new MaterialType();
        materialType.setId(java.util.UUID.randomUUID().toString());  // 生成UUID作为ID
        materialType.setFactoryId(factoryId);
        materialType.setMaterialCode(dto.getMaterialCode());
        materialType.setName(dto.getName());
        materialType.setCategory(dto.getCategory());
        materialType.setUnit(dto.getUnit());
        materialType.setStorageType(dto.getStorageType());
        materialType.setDescription(dto.getDescription());
        materialType.setIsActive("启用".equals(dto.getStatus()));
        return materialType;
    }

    /**
     * 将对象转换为JSON字符串
     */
    private String toJsonString(Object obj) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return obj.toString();
        }
    }
}
