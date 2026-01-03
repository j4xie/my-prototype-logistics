package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.user.CreateUserRequest;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.entity.enums.HireType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.EntityNotFoundException;
import com.cretas.aims.mapper.UserMapper;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.UserService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 用户服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
public class UserServiceImpl implements UserService {
    private static final Logger log = LoggerFactory.getLogger(UserServiceImpl.class);

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final com.cretas.aims.utils.ExcelUtil excelUtil;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public UserServiceImpl(UserRepository userRepository, UserMapper userMapper, PasswordEncoder passwordEncoder,
                          com.cretas.aims.utils.ExcelUtil excelUtil) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.excelUtil = excelUtil;
    }

    @Override
    @Transactional
    public UserDTO createUser(String factoryId, CreateUserRequest request) {
        // 检查用户名是否已存在（用户名全局唯一）
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("用户名已存在");
        }

        // 创建用户实体
        User user = userMapper.toEntity(request, factoryId);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        // 保存用户
        user = userRepository.save(user);

        log.info("创建用户成功: factoryId={}, username={}", factoryId, user.getUsername());
        return userMapper.toDTO(user);
    }

    @Override
    @Transactional
    public UserDTO updateUser(String factoryId, Long userId, CreateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", String.valueOf(userId)));

        // 验证工厂ID
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该用户");
        }

        // 更新用户信息
        userMapper.updateEntity(user, request);

        // 如果提供了新密码，则更新密码
        if (request.getPassword() != null && !request.getPassword().isEmpty()) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        user = userRepository.save(user);

        log.info("更新用户成功: userId={}", userId);
        return userMapper.toDTO(user);
    }

    @Override
    @Transactional
    public void deleteUser(String factoryId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", String.valueOf(userId)));

        // 验证工厂ID
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该用户");
        }

        // 不允许删除超级管理员（通过职位判断）
        if (user.getPosition() != null &&
            (user.getPosition().equals("factory_super_admin") ||
             user.getPosition().equals("超级管理员"))) {
            throw new BusinessException("不能删除超级管理员");
        }

        userRepository.delete(user);
        log.info("删除用户成功: userId={}", userId);
    }

    @Override
    public UserDTO getUserById(String factoryId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", String.valueOf(userId)));

        // 验证工厂ID
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权查看该用户");
        }

        return userMapper.toDTO(user);
    }

    @Override
    public PageResponse<UserDTO> getUserList(String factoryId, PageRequest pageRequest) {
        Sort sort = Sort.by(
                pageRequest.getSortDirection().equalsIgnoreCase("DESC") ?
                Sort.Direction.DESC : Sort.Direction.ASC,
                pageRequest.getSortBy()
        );

        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                sort
        );

        Page<User> userPage = userRepository.findByFactoryId(factoryId, pageable);

        List<UserDTO> userDTOs = userPage.getContent().stream()
                .map(userMapper::toDTO)
                .collect(Collectors.toList());

        return PageResponse.of(
                userDTOs,
                pageRequest.getPage(),
                pageRequest.getSize(),
                userPage.getTotalElements()
        );
    }

    @Override
    public List<UserDTO> getUsersByRole(String factoryId, FactoryUserRole role) {
        // 使用角色代码查询
        return userRepository.findByFactoryIdAndRoleCode(factoryId, role.name())
                .stream()
                .map(userMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void activateUser(String factoryId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", String.valueOf(userId)));

        // 验证工厂ID
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该用户");
        }

        user.setIsActive(true);
        userRepository.save(user);

        log.info("激活用户成功: userId={}", userId);
    }

    @Override
    @Transactional
    public void deactivateUser(String factoryId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", String.valueOf(userId)));

        // 验证工厂ID
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该用户");
        }

        // 不允许停用超级管理员（通过职位判断）
        if (user.getPosition() != null &&
            (user.getPosition().equals("factory_super_admin") ||
             user.getPosition().equals("超级管理员"))) {
            throw new BusinessException("不能停用超级管理员");
        }

        user.setIsActive(false);
        userRepository.save(user);

        log.info("停用用户成功: userId={}", userId);
    }

    @Override
    @Transactional
    public void updateUserRole(String factoryId, Long userId, FactoryUserRole newRole) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", String.valueOf(userId)));

        // 验证工厂ID
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该用户");
        }

        // 更新职位字段（roleCode已删除）
        user.setPosition(newRole.name());
        userRepository.save(user);

        log.info("更新用户角色成功: userId={}, newRole={}", userId, newRole);
    }

    @Override
    public boolean checkUsernameExists(String factoryId, String username) {
        // 用户名全局唯一，不区分工厂
        return userRepository.existsByUsername(username);
    }

    @Override
    public boolean checkEmailExists(String factoryId, String email) {
        // email字段已删除，返回false
        return false;
    }

    @Override
    public PageResponse<UserDTO> searchUsers(String factoryId, String keyword, PageRequest pageRequest) {
        Sort sort = Sort.by(
                pageRequest.getSortDirection().equalsIgnoreCase("DESC") ?
                Sort.Direction.DESC : Sort.Direction.ASC,
                pageRequest.getSortBy()
        );

        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                sort
        );

        Page<User> userPage = userRepository.searchUsers(factoryId, keyword, pageable);

        List<UserDTO> userDTOs = userPage.getContent().stream()
                .map(userMapper::toDTO)
                .collect(Collectors.toList());

        return PageResponse.of(
                userDTOs,
                pageRequest.getPage(),
                pageRequest.getSize(),
                userPage.getTotalElements()
        );
    }

    @Override
    @Transactional
    public List<UserDTO> batchImportUsers(String factoryId, List<CreateUserRequest> requests) {
        return requests.stream()
                .map(request -> {
                    try {
                        return createUser(factoryId, request);
                    } catch (Exception e) {
                        log.error("导入用户失败: {}", e.getMessage());
                        return null;
                    }
                })
                .filter(user -> user != null)
                .collect(Collectors.toList());
    }

    @Override
    public byte[] exportUsers(String factoryId) {
        log.info("导出用户列表: factoryId={}", factoryId);

        // 查询所有用户
        List<User> users = userRepository.findByFactoryId(factoryId);

        // 转换为DTO
        List<UserDTO> userDTOs = users.stream()
                .map(userMapper::toDTO)
                .collect(Collectors.toList());

        // 转换为Excel导出DTO
        List<com.cretas.aims.dto.user.UserExportDTO> exportDTOs = userDTOs.stream()
                .map(com.cretas.aims.dto.user.UserExportDTO::fromUserDTO)
                .collect(Collectors.toList());

        // 生成Excel文件
        byte[] excelBytes = excelUtil.exportToExcel(
                exportDTOs,
                com.cretas.aims.dto.user.UserExportDTO.class,
                "用户列表"
        );

        log.info("用户列表导出成功: factoryId={}, count={}", factoryId, users.size());
        return excelBytes;
    }

    @Override
    public byte[] generateImportTemplate() {
        log.info("生成用户导入模板");

        // 使用ExcelUtil生成空模板
        byte[] templateBytes = excelUtil.generateTemplate(
                com.cretas.aims.dto.user.UserExportDTO.class,
                "用户导入模板"
        );

        log.info("用户导入模板生成成功");
        return templateBytes;
    }

    @Override
    // 不使用@Transactional，让每个save操作独立进行，避免单行失败导致整体回滚
    public com.cretas.aims.dto.common.ImportResult<UserDTO> importUsersFromExcel(
            String factoryId,
            java.io.InputStream inputStream) {
        log.info("开始从Excel批量导入用户: factoryId={}", factoryId);

        // 1. 解析Excel文件
        List<com.cretas.aims.dto.user.UserExportDTO> excelData;
        try {
            excelData = excelUtil.importFromExcel(inputStream,
                    com.cretas.aims.dto.user.UserExportDTO.class);
        } catch (Exception e) {
            log.error("Excel文件解析失败: factoryId={}", factoryId, e);
            throw new RuntimeException("Excel文件格式错误或无法解析: " + e.getMessage());
        }

        com.cretas.aims.dto.common.ImportResult<UserDTO> result =
                com.cretas.aims.dto.common.ImportResult.create(excelData.size());

        // 2. 逐行验证并导入
        for (int i = 0; i < excelData.size(); i++) {
            com.cretas.aims.dto.user.UserExportDTO exportDTO = excelData.get(i);
            int rowNumber = i + 2; // Excel行号（从2开始，1是表头）

            try {
                // 2.1 验证必填字段
                if (exportDTO.getUsername() == null || exportDTO.getUsername().trim().isEmpty()) {
                    result.addFailure(rowNumber, "用户名不能为空", toJsonString(exportDTO));
                    continue;
                }

                // 2.2 验证用户名唯一性（全局唯一）
                if (userRepository.existsByUsername(exportDTO.getUsername())) {
                    result.addFailure(rowNumber, "用户名已存在: " + exportDTO.getUsername(),
                            toJsonString(exportDTO));
                    continue;
                }

                // 2.3 转换为Entity
                User user = convertFromExportDTO(exportDTO, factoryId);

                // 2.4 保存
                User saved = userRepository.save(user);

                // 2.5 转换为DTO并记录成功
                UserDTO dto = userMapper.toDTO(saved);
                result.addSuccess(dto);

                log.debug("成功导入用户: row={}, username={}", rowNumber, exportDTO.getUsername());

            } catch (Exception e) {
                log.error("导入用户失败: factoryId={}, row={}, data={}", factoryId, rowNumber, exportDTO, e);
                result.addFailure(rowNumber, "保存失败: " + e.getMessage(), toJsonString(exportDTO));
            }
        }

        log.info("用户批量导入完成: factoryId={}, total={}, success={}, failure={}",
                factoryId, result.getTotalCount(), result.getSuccessCount(), result.getFailureCount());
        return result;
    }

    /**
     * 从UserExportDTO转换为User实体
     */
    private User convertFromExportDTO(com.cretas.aims.dto.user.UserExportDTO dto, String factoryId) {
        User user = new User();
        // User实体的ID是Integer自增类型，不需要手动设置
        user.setFactoryId(factoryId);
        user.setUsername(dto.getUsername());

        // 生成默认密码: username123
        String defaultPassword = dto.getUsername() + "123";
        user.setPasswordHash(passwordEncoder.encode(defaultPassword));

        user.setFullName(dto.getFullName());
        // User实体没有email字段，跳过
        user.setPhone(dto.getPhone());
        user.setDepartment(dto.getDepartmentDisplayName());
        user.setPosition(dto.getPosition());

        // 解析角色（roleDisplayName转roleCode）
        user.setRoleCode(parseRoleCode(dto.getRoleDisplayName()));

        user.setMonthlySalary(dto.getMonthlySalary());
        user.setExpectedWorkMinutes(dto.getExpectedWorkMinutes());
        user.setIsActive("激活".equals(dto.getStatus()));
        user.setCreatedAt(java.time.LocalDateTime.now());
        user.setUpdatedAt(java.time.LocalDateTime.now());

        return user;
    }

    /**
     * 将角色显示名称转换为角色代码
     */
    private String parseRoleCode(String roleDisplayName) {
        if (roleDisplayName == null || roleDisplayName.trim().isEmpty()) {
            return "factory_operator"; // 默认角色
        }

        // 根据显示名称映射到角色代码
        switch (roleDisplayName.trim()) {
            case "工厂超级管理员":
                return "factory_super_admin";
            case "工厂管理员":
                return "factory_admin";
            case "部门管理员":
                return "department_admin";
            case "生产主管":
                return "production_supervisor";
            case "质检员":
                return "quality_inspector";
            case "操作员":
                return "factory_operator";
            default:
                log.warn("未识别的角色显示名称: {}, 使用默认角色", roleDisplayName);
                return "factory_operator";
        }
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

    @Override
    public PageResponse<UserDTO> getUsersByJoinDateRange(
            String factoryId,
            LocalDate startDate,
            LocalDate endDate,
            int page,
            int size) {
        log.info("查询入职日期范围内用户: factoryId={}, startDate={}, endDate={}, page={}, size={}",
                factoryId, startDate, endDate, page, size);

        // 转换为 LocalDateTime（开始时间 00:00:00，结束时间为次日 00:00:00）
        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.plusDays(1).atStartOfDay();

        // 创建分页请求
        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                page - 1,  // Spring Data 页码从0开始
                size
        );

        // 查询数据
        Page<User> userPage = userRepository.findByFactoryIdAndCreatedAtBetween(
                factoryId,
                startDateTime,
                endDateTime,
                pageable
        );

        // 转换为 DTO
        List<UserDTO> userDTOs = userPage.getContent().stream()
                .map(userMapper::toDTO)
                .collect(Collectors.toList());

        log.info("查询入职日期范围内用户成功: factoryId={}, totalElements={}",
                factoryId, userPage.getTotalElements());

        return PageResponse.of(
                userDTOs,
                page,
                size,
                userPage.getTotalElements()
        );
    }

    // ==================== 调度员模块扩展实现 ====================

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public UserDTO getUserByEmployeeCode(String factoryId, String employeeCode) {
        User user = userRepository.findByFactoryIdAndEmployeeCode(factoryId, employeeCode)
                .orElseThrow(() -> new EntityNotFoundException("User", employeeCode));
        return userMapper.toDTO(user);
    }

    @Override
    @Transactional
    public void updateEmployeeCode(String factoryId, Long userId, String employeeCode) {
        // 验证工号格式 (001-999)
        if (!employeeCode.matches("^\\d{3}$")) {
            throw new BusinessException("工号格式错误，必须是3位数字 (001-999)");
        }

        int code = Integer.parseInt(employeeCode);
        if (code < 1 || code > 999) {
            throw new BusinessException("工号必须在 001-999 范围内");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", String.valueOf(userId)));

        // 验证工厂ID
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该用户");
        }

        // 检查工号是否已被其他用户使用
        userRepository.findByEmployeeCode(employeeCode).ifPresent(existingUser -> {
            if (!existingUser.getId().equals(userId)) {
                throw new BusinessException("工号已被使用: " + employeeCode);
            }
        });

        user.setEmployeeCode(employeeCode);
        userRepository.save(user);
        log.info("更新用户工号成功: userId={}, employeeCode={}", userId, employeeCode);
    }

    @Override
    public Map<String, Integer> getUserSkills(String factoryId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", String.valueOf(userId)));

        // 验证工厂ID
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权查看该用户");
        }

        return parseSkillLevels(user.getSkillLevels());
    }

    @Override
    @Transactional
    public void updateUserSkills(String factoryId, Long userId, Map<String, Integer> skillLevels) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", String.valueOf(userId)));

        // 验证工厂ID
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该用户");
        }

        // 验证技能等级范围 (1-5)
        for (Map.Entry<String, Integer> entry : skillLevels.entrySet()) {
            if (entry.getValue() < 1 || entry.getValue() > 5) {
                throw new BusinessException("技能等级必须在 1-5 范围内: " + entry.getKey());
            }
        }

        // 转换为JSON
        String skillLevelsJson = serializeSkillLevels(skillLevels);
        user.setSkillLevels(skillLevelsJson);
        userRepository.save(user);

        log.info("更新用户技能成功: userId={}, skills={}", userId, skillLevels);
    }

    @Override
    public List<UserDTO> getExpiringContracts(String factoryId, Integer daysAhead) {
        LocalDate warningDate = LocalDate.now().plusDays(daysAhead);

        List<User> users = userRepository.findByFactoryIdAndContractEndDateBefore(factoryId, warningDate);

        return users.stream()
                .filter(u -> u.getContractEndDate() != null && u.getContractEndDate().isAfter(LocalDate.now()))
                .map(userMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<UserDTO> getUsersByHireType(String factoryId, HireType hireType) {
        List<User> users = userRepository.findByFactoryIdAndHireType(factoryId, hireType);
        return users.stream()
                .map(userMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<UserDTO> getTemporaryWorkers(String factoryId) {
        // 临时性质的雇用类型: PART_TIME, DISPATCH, INTERN, TEMPORARY
        List<HireType> temporaryTypes = List.of(
                HireType.PART_TIME,
                HireType.DISPATCH,
                HireType.INTERN,
                HireType.TEMPORARY
        );

        List<User> users = userRepository.findByFactoryIdAndHireTypeIn(factoryId, temporaryTypes);
        return users.stream()
                .map(userMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public String generateNextEmployeeCode(String factoryId) {
        // 获取当前工厂最大的工号
        String maxCode = userRepository.findMaxEmployeeCodeByFactoryId(factoryId);

        int nextCode;
        if (maxCode == null || maxCode.isEmpty()) {
            nextCode = 1;
        } else {
            nextCode = Integer.parseInt(maxCode) + 1;
        }

        if (nextCode > 999) {
            throw new BusinessException("工号已用尽 (001-999)");
        }

        return String.format("%03d", nextCode);
    }

    /**
     * 解析技能等级 JSON 为 Map
     */
    private Map<String, Integer> parseSkillLevels(String skillLevelsJson) {
        if (skillLevelsJson == null || skillLevelsJson.isEmpty()) {
            return Collections.emptyMap();
        }

        try {
            return objectMapper.readValue(skillLevelsJson, new TypeReference<Map<String, Integer>>() {});
        } catch (Exception e) {
            log.warn("解析技能等级JSON失败: {}", skillLevelsJson, e);
            return Collections.emptyMap();
        }
    }

    /**
     * 序列化技能等级 Map 为 JSON
     */
    private String serializeSkillLevels(Map<String, Integer> skillLevels) {
        if (skillLevels == null || skillLevels.isEmpty()) {
            return "{}";
        }

        try {
            return objectMapper.writeValueAsString(skillLevels);
        } catch (Exception e) {
            log.warn("序列化技能等级失败", e);
            return "{}";
        }
    }
}
