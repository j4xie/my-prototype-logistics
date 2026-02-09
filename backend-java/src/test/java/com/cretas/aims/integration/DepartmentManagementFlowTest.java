package com.cretas.aims.integration;

import com.cretas.aims.dto.DepartmentDTO;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.Department;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.DepartmentRepository;
import com.cretas.aims.service.DepartmentService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

/**
 * Department Management Flow Integration Test
 * Tests complete department lifecycle: create -> query -> update -> hierarchy -> statistics
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("DepartmentManagementFlowTest - 部门管理全流程测试")
class DepartmentManagementFlowTest {

    @Autowired
    private DepartmentService departmentService;

    @Autowired
    private DepartmentRepository departmentRepository;

    private static final String TEST_FACTORY_ID = "F001";

    // ==================== 1. 部门创建和查询测试 ====================

    @Test
    @Order(1)
    @Transactional
    @DisplayName("Test1: 创建部门并查询")
    void testCreateDepartmentAndQuery() {
        // Given: 准备部门数据
        DepartmentDTO dto = DepartmentDTO.builder()
                .name("测试部门")
                .code("TEST_DEPT_001")
                .description("这是一个测试部门")
                .isActive(true)
                .displayOrder(1)
                .color("#FF5722")
                .icon("test-icon")
                .build();

        // When: 创建部门
        DepartmentDTO created = departmentService.createDepartment(TEST_FACTORY_ID, dto);

        // Then: 验证创建结果
        assertThat(created).isNotNull();
        assertThat(created.getId()).isNotNull();
        assertThat(created.getName()).isEqualTo("测试部门");
        assertThat(created.getCode()).isEqualTo("TEST_DEPT_001");
        assertThat(created.getFactoryId()).isEqualTo(TEST_FACTORY_ID);
        assertThat(created.getIsActive()).isTrue();
        assertThat(created.getColor()).isEqualTo("#FF5722");

        // When: 按ID查询
        DepartmentDTO queried = departmentService.getDepartmentById(TEST_FACTORY_ID, created.getId());

        // Then: 验证查询结果
        assertThat(queried).isNotNull();
        assertThat(queried.getId()).isEqualTo(created.getId());
        assertThat(queried.getName()).isEqualTo("测试部门");
    }

    @Test
    @Order(2)
    @Transactional
    @DisplayName("Test2: 分页查询部门列表")
    void testQueryDepartmentList() {
        // When: 分页查询部门
        Pageable pageable = PageRequest.of(0, 10);
        PageResponse<DepartmentDTO> response = departmentService.getDepartments(TEST_FACTORY_ID, pageable);

        // Then: 验证查询结果
        assertThat(response).isNotNull();
        assertThat(response.getContent()).isNotNull();
        assertThat(response.getTotalElements()).isGreaterThanOrEqualTo(0);
    }

    @Test
    @Order(3)
    @Transactional
    @DisplayName("Test3: 查询所有活跃部门")
    void testQueryActiveDepartments() {
        // Given: 创建多个部门
        DepartmentDTO active1 = createTestDepartment("活跃部门1", "ACTIVE_1", true);
        DepartmentDTO active2 = createTestDepartment("活跃部门2", "ACTIVE_2", true);
        DepartmentDTO inactive = createTestDepartment("非活跃部门", "INACTIVE_1", false);

        // When: 查询活跃部门
        List<DepartmentDTO> activeDepartments = departmentService.getAllActiveDepartments(TEST_FACTORY_ID);

        // Then: 验证结果包含活跃部门
        assertThat(activeDepartments).isNotNull();
        assertThat(activeDepartments)
                .extracting(DepartmentDTO::getIsActive)
                .allMatch(active -> active == true);
    }

    // ==================== 2. 部门更新测试 ====================

    @Test
    @Order(4)
    @Transactional
    @DisplayName("Test4: 更新部门信息")
    void testUpdateDepartment() {
        // Given: 创建一个部门
        DepartmentDTO original = createTestDepartment("原始部门", "ORIGINAL_DEPT", true);

        // When: 更新部门信息
        DepartmentDTO updateDto = DepartmentDTO.builder()
                .name("更新后的部门")
                .description("更新后的描述")
                .color("#2196F3")
                .displayOrder(99)
                .build();
        DepartmentDTO updated = departmentService.updateDepartment(TEST_FACTORY_ID, original.getId(), updateDto);

        // Then: 验证更新结果
        assertThat(updated).isNotNull();
        assertThat(updated.getName()).isEqualTo("更新后的部门");
        assertThat(updated.getDescription()).isEqualTo("更新后的描述");
        assertThat(updated.getColor()).isEqualTo("#2196F3");
        assertThat(updated.getDisplayOrder()).isEqualTo(99);
        assertThat(updated.getCode()).isEqualTo("ORIGINAL_DEPT"); // 编码未改变
    }

    @Test
    @Order(5)
    @Transactional
    @DisplayName("Test5: 更新部门编码")
    void testUpdateDepartmentCode() {
        // Given: 创建一个部门
        DepartmentDTO original = createTestDepartment("测试更新编码", "OLD_CODE", true);

        // When: 更新编码
        DepartmentDTO updateDto = DepartmentDTO.builder()
                .code("NEW_CODE")
                .build();
        DepartmentDTO updated = departmentService.updateDepartment(TEST_FACTORY_ID, original.getId(), updateDto);

        // Then: 验证编码更新成功
        assertThat(updated).isNotNull();
        assertThat(updated.getCode()).isEqualTo("NEW_CODE");
    }

    // ==================== 3. 部门编码唯一性测试 ====================

    @Test
    @Order(6)
    @Transactional
    @DisplayName("Test6: 验证部门编码唯一性")
    void testDepartmentCodeUniqueness() {
        // Given: 创建一个部门
        createTestDepartment("已存在部门", "EXISTING_CODE", true);

        // When & Then: 尝试创建重复编码的部门应抛出异常
        DepartmentDTO duplicate = DepartmentDTO.builder()
                .name("重复编码部门")
                .code("EXISTING_CODE")
                .build();

        assertThatThrownBy(() -> departmentService.createDepartment(TEST_FACTORY_ID, duplicate))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("部门编码已存在");
    }

    @Test
    @Order(7)
    @Transactional
    @DisplayName("Test7: 检查编码是否存在")
    void testCheckCodeExists() {
        // Given: 创建一个部门
        DepartmentDTO dept = createTestDepartment("编码检查部门", "CHECK_CODE", true);

        // When & Then: 检查已存在的编码
        boolean exists = departmentService.checkCodeExists(TEST_FACTORY_ID, "CHECK_CODE", null);
        assertThat(exists).isTrue();

        // When & Then: 检查不存在的编码
        boolean notExists = departmentService.checkCodeExists(TEST_FACTORY_ID, "NOT_EXISTS", null);
        assertThat(notExists).isFalse();

        // When & Then: 排除自身后检查
        boolean excludeSelf = departmentService.checkCodeExists(TEST_FACTORY_ID, "CHECK_CODE", dept.getId());
        assertThat(excludeSelf).isFalse();
    }

    // ==================== 4. 部门层级关系测试 ====================

    @Test
    @Order(8)
    @Transactional
    @DisplayName("Test8: 创建父子部门层级关系")
    void testDepartmentHierarchy() {
        // Given: 创建父部门
        DepartmentDTO parent = createTestDepartment("父部门", "PARENT_DEPT", true);

        // When: 创建子部门
        DepartmentDTO childDto = DepartmentDTO.builder()
                .name("子部门")
                .code("CHILD_DEPT")
                .parentDepartmentId(parent.getId())
                .isActive(true)
                .build();
        DepartmentDTO child = departmentService.createDepartment(TEST_FACTORY_ID, childDto);

        // Then: 验证层级关系
        assertThat(child).isNotNull();
        assertThat(child.getParentDepartmentId()).isEqualTo(parent.getId());
        assertThat(child.getParentDepartmentName()).isEqualTo("父部门");

        // When: 查询子部门
        List<Department> children = departmentRepository.findByFactoryIdAndParentDepartmentId(
                TEST_FACTORY_ID, parent.getId());

        // Then: 验证子部门查询结果
        assertThat(children).isNotEmpty();
        assertThat(children).extracting(Department::getName).contains("子部门");
    }

    @Test
    @Order(9)
    @Transactional
    @DisplayName("Test9: 查询部门树形结构")
    void testDepartmentTree() {
        // Given: 创建多层级部门
        DepartmentDTO root = createTestDepartment("根部门", "ROOT", true);
        DepartmentDTO child = createChildDepartment("子部门", "CHILD", root.getId());

        // When: 获取部门树
        List<DepartmentDTO> tree = departmentService.getDepartmentTree(TEST_FACTORY_ID);

        // Then: 验证树形结构
        assertThat(tree).isNotNull();
        assertThat(tree).isNotEmpty();
    }

    // ==================== 5. 部门负责人管理测试 ====================

    @Test
    @Order(10)
    @Transactional
    @DisplayName("Test10: 设置和查询部门负责人")
    void testDepartmentManager() {
        // Given: 创建部门并设置负责人
        DepartmentDTO dto = DepartmentDTO.builder()
                .name("有负责人的部门")
                .code("WITH_MANAGER")
                .managerUserId(1L) // 假设用户ID=1存在
                .isActive(true)
                .build();

        // When: 创建部门
        DepartmentDTO created = departmentService.createDepartment(TEST_FACTORY_ID, dto);

        // Then: 验证负责人信息
        assertThat(created).isNotNull();
        assertThat(created.getManagerUserId()).isEqualTo(1L);

        // When: 更新负责人
        DepartmentDTO updateDto = DepartmentDTO.builder()
                .managerUserId(2L)
                .build();
        DepartmentDTO updated = departmentService.updateDepartment(TEST_FACTORY_ID, created.getId(), updateDto);

        // Then: 验证负责人更新
        assertThat(updated.getManagerUserId()).isEqualTo(2L);
    }

    // ==================== 6. 部门搜索测试 ====================

    @Test
    @Order(11)
    @Transactional
    @DisplayName("Test11: 按关键字搜索部门")
    void testSearchDepartments() {
        // Given: 创建多个部门
        createTestDepartment("技术部门", "TECH_DEPT", true);
        createTestDepartment("市场部门", "MARKET_DEPT", true);
        createTestDepartment("技术支持", "TECH_SUPPORT", true);

        // When: 搜索包含"技术"的部门
        Pageable pageable = PageRequest.of(0, 10);
        PageResponse<DepartmentDTO> searchResult = departmentService.searchDepartments(
                TEST_FACTORY_ID, "技术", pageable);

        // Then: 验证搜索结果
        assertThat(searchResult).isNotNull();
        assertThat(searchResult.getContent()).isNotEmpty();
        assertThat(searchResult.getContent())
                .extracting(DepartmentDTO::getName)
                .allMatch(name -> name.contains("技术"));
    }

    // ==================== 7. 部门状态管理测试 ====================

    @Test
    @Order(12)
    @Transactional
    @DisplayName("Test12: 批量更新部门状态")
    void testBatchUpdateDepartmentStatus() {
        // Given: 创建多个活跃部门
        DepartmentDTO dept1 = createTestDepartment("批量测试1", "BATCH_1", true);
        DepartmentDTO dept2 = createTestDepartment("批量测试2", "BATCH_2", true);

        // When: 批量禁用部门
        List<Integer> ids = Arrays.asList(dept1.getId(), dept2.getId());
        departmentService.updateDepartmentsStatus(TEST_FACTORY_ID, ids, false);

        // Then: 验证状态更新
        DepartmentDTO updated1 = departmentService.getDepartmentById(TEST_FACTORY_ID, dept1.getId());
        DepartmentDTO updated2 = departmentService.getDepartmentById(TEST_FACTORY_ID, dept2.getId());

        assertThat(updated1.getIsActive()).isFalse();
        assertThat(updated2.getIsActive()).isFalse();
    }

    // ==================== 8. 部门统计测试 ====================

    @Test
    @Order(13)
    @Transactional
    @DisplayName("Test13: 统计工厂部门数量")
    void testCountDepartments() {
        // Given: 当前部门数量
        long beforeCount = departmentRepository.countByFactoryId(TEST_FACTORY_ID);

        // When: 创建新部门
        createTestDepartment("统计测试部门", "COUNT_TEST", true);

        // Then: 验证数量增加
        long afterCount = departmentRepository.countByFactoryId(TEST_FACTORY_ID);
        assertThat(afterCount).isEqualTo(beforeCount + 1);
    }

    @Test
    @Order(14)
    @Transactional
    @DisplayName("Test14: 查询部门员工数量统计")
    void testDepartmentEmployeeCount() {
        // Given: 创建部门
        DepartmentDTO dept = createTestDepartment("员工统计部门", "EMP_COUNT", true);

        // When: 查询部门详情
        DepartmentDTO queried = departmentService.getDepartmentById(TEST_FACTORY_ID, dept.getId());

        // Then: 验证包含员工数量统计
        assertThat(queried).isNotNull();
        assertThat(queried.getEmployeeCount()).isNotNull();
        assertThat(queried.getEmployeeCount()).isGreaterThanOrEqualTo(0);
    }

    // ==================== 9. 部门初始化测试 ====================

    @Test
    @Order(15)
    @Transactional
    @DisplayName("Test15: 初始化默认部门")
    void testInitializeDefaultDepartments() {
        // Given: 清空当前工厂的部门
        String testFactoryId = "TEST_FACTORY_INIT";
        departmentRepository.findByFactoryId(testFactoryId)
                .forEach(dept -> departmentRepository.delete(dept));

        // When: 初始化默认部门
        departmentService.initializeDefaultDepartments(testFactoryId);

        // Then: 验证默认部门已创建
        List<Department> departments = departmentRepository.findByFactoryId(testFactoryId);
        assertThat(departments).isNotEmpty();
        assertThat(departments).hasSizeGreaterThanOrEqualTo(5); // 至少5个默认部门

        // 验证默认部门名称
        List<String> deptNames = departments.stream()
                .map(Department::getName)
                .toList();
        assertThat(deptNames).contains("养殖部门", "加工部门", "物流部门", "质量部门", "管理部门");
    }

    // ==================== 10. 服务依赖测试 ====================

    @Test
    @Order(16)
    @Transactional
    @DisplayName("Test16: 验证服务依赖注入")
    void testServiceDependencies() {
        assertThat(departmentService).isNotNull();
        assertThat(departmentRepository).isNotNull();
    }

    // ==================== 辅助方法 ====================

    /**
     * 创建测试部门
     */
    private DepartmentDTO createTestDepartment(String name, String code, Boolean isActive) {
        DepartmentDTO dto = DepartmentDTO.builder()
                .name(name)
                .code(code)
                .isActive(isActive)
                .displayOrder(0)
                .build();
        return departmentService.createDepartment(TEST_FACTORY_ID, dto);
    }

    /**
     * 创建子部门
     */
    private DepartmentDTO createChildDepartment(String name, String code, Integer parentId) {
        DepartmentDTO dto = DepartmentDTO.builder()
                .name(name)
                .code(code)
                .parentDepartmentId(parentId)
                .isActive(true)
                .displayOrder(0)
                .build();
        return departmentService.createDepartment(TEST_FACTORY_ID, dto);
    }
}
