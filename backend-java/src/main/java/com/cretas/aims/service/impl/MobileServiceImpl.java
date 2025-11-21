package com.cretas.aims.service.impl;

import com.cretas.aims.dto.MobileDTO;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.DeviceActivation;
import com.cretas.aims.entity.Equipment;
import com.cretas.aims.entity.EquipmentAlert;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.FactorySettings;
import com.cretas.aims.entity.PlatformAdmin;
import com.cretas.aims.entity.UserFeedback;
import com.cretas.aims.entity.ProcessingBatch;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.entity.Session;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.Whitelist;
import com.cretas.aims.entity.enums.AlertStatus;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.entity.enums.WhitelistStatus;
import com.cretas.aims.exception.AuthenticationException;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.mapper.UserMapper;
import com.cretas.aims.repository.DeviceActivationRepository;
import com.cretas.aims.repository.EquipmentAlertRepository;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.repository.PlatformAdminRepository;
import com.cretas.aims.repository.ProcessingBatchRepository;
import com.cretas.aims.repository.QualityInspectionRepository;
import com.cretas.aims.repository.SessionRepository;
import com.cretas.aims.repository.TimeClockRecordRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.WhitelistRepository;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.TempTokenService;
import com.cretas.aims.util.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 移动端服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class MobileServiceImpl implements MobileService {
    private static final Logger log = LoggerFactory.getLogger(MobileServiceImpl.class);

    private final UserRepository userRepository;
    private final DeviceActivationRepository deviceActivationRepository;
    private final SessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;
    private final UserMapper userMapper;
    private final TempTokenService tempTokenService;
    private final WhitelistRepository whitelistRepository;
    private final PlatformAdminRepository platformAdminRepository;

    // 人员报表相关Repository
    private final TimeClockRecordRepository timeClockRecordRepository;
    private final QualityInspectionRepository qualityInspectionRepository;
    private final ProcessingBatchRepository processingBatchRepository;

    // 设备告警相关Repository
    private final EquipmentAlertRepository equipmentAlertRepository;
    private final EquipmentRepository equipmentRepository;

    // 工厂设置相关Repository
    private final com.cretas.aims.repository.FactoryRepository factoryRepository;
    private final com.cretas.aims.repository.FactorySettingsRepository factorySettingsRepository;

    // 用户反馈相关Repository
    private final com.cretas.aims.repository.UserFeedbackRepository userFeedbackRepository;

    @Value("${app.upload.path:uploads/mobile}")
    private String uploadPath;

    @Value("${app.version.latest:1.0.0}")
    private String latestVersion;

    // 模拟设备登录记录（实际应使用数据库）
    private final Map<Integer, List<MobileDTO.DeviceInfo>> userDevices = new ConcurrentHashMap<>();

    @Override
    @Transactional
    public MobileDTO.LoginResponse unifiedLogin(MobileDTO.LoginRequest request) {
        String username = request.getUsername();
        String password = request.getPassword();

        log.info("移动端统一登录: username={}", username);

        // 优先级1: 检查是否为平台管理员
        Optional<PlatformAdmin> platformAdminOpt = platformAdminRepository.findByUsername(username);
        if (platformAdminOpt.isPresent()) {
            log.info("检测到平台管理员登录: username={}", username);
            return loginAsPlatformAdmin(platformAdminOpt.get(), password, request.getDeviceInfo());
        }

        // 优先级2: 工厂用户登录
        String factoryId = request.getFactoryId();

        // 智能推断 factoryId（如果未提供）
        if (factoryId == null || factoryId.trim().isEmpty()) {
            log.info("factoryId未提供，开始智能推断: username={}", username);
            List<User> users = userRepository.findAllByUsername(username);

            if (users.isEmpty()) {
                throw new BusinessException("用户名或密码错误");
            } else if (users.size() == 1) {
                factoryId = users.get(0).getFactoryId();
                log.info("智能推断成功: username={}, factoryId={}", username, factoryId);
            } else {
                // 存在多个同名用户，必须提供 factoryId
                throw new BusinessException("存在多个同名用户，请提供工厂ID进行登录");
            }
        }

        log.info("工厂用户登录: factoryId={}, username={}", factoryId, username);

        // 根据工厂ID和用户名查找用户
        User user = userRepository.findByFactoryIdAndUsername(factoryId, username)
                .orElseThrow(() -> new BusinessException("用户名或密码错误"));

        // 验证密码
        log.info("🔍 密码验证 - 用户: {}, 输入密码: {}, 数据库hash: {}",
            username, password, user.getPassword() != null ? user.getPassword().substring(0, 30) + "..." : "null");

        if (!passwordEncoder.matches(password, user.getPassword())) {
            log.error("❌ 密码验证失败 - 用户: {}", username);
            throw new BusinessException("用户名或密码错误");
        }

        log.info("✅ 密码验证成功 - 用户: {}", username);

        // 检查用户状态
        if (!user.getIsActive()) {
            throw new BusinessException("用户账号已被禁用");
        }

        // 记录设备信息
        if (request.getDeviceInfo() != null) {
            recordDeviceLogin(user.getId(), request.getDeviceInfo());
        }

        // 生成令牌（包含角色信息）
        String role = user.getRoleCode() != null ? user.getRoleCode() : "viewer";
        String token = jwtUtil.generateToken(user.getId().toString(), role);
        String refreshToken = jwtUtil.generateRefreshToken(user.getId().toString());

        // 更新最后登录时间
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        // 构建响应
        return MobileDTO.LoginResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .factoryId(user.getFactoryId())
                .factoryName(user.getFactory() != null ? user.getFactory().getName() : null)
                .role(user.getRole())
                .permissions(parsePermissions(user.getPermissions()))
                .token(token)
                .refreshToken(refreshToken)
                .expiresIn(3600L) // 1小时
                .lastLoginTime(user.getLastLogin())
                .profile(MobileDTO.UserProfile.builder()
                        .name(user.getName())
                        .avatar(user.getAvatar())
                        .department(user.getDepartment())
                        .position(user.getPosition())
                        .phoneNumber(user.getPhone())
                        .email(null)
                        .build())
                .build();
    }

    /**
     * 平台管理员登录
     */
    private MobileDTO.LoginResponse loginAsPlatformAdmin(PlatformAdmin admin, String password,
                                                         MobileDTO.DeviceInfo deviceInfo) {
        // 验证密码
        if (!passwordEncoder.matches(password, admin.getPassword())) {
            throw new BusinessException("用户名或密码错误");
        }

        // 检查账号状态
        if (!admin.isActive()) {
            throw new BusinessException("账号已被禁用");
        }

        // 记录设备信息
        if (deviceInfo != null) {
            recordDeviceLogin(admin.getId(), deviceInfo);
        }

        // 生成令牌（使用 "platform_" 前缀区分平台管理员，包含角色信息）
        String role = admin.getPlatformRole() != null ? admin.getPlatformRole().name() : "auditor";
        String token = jwtUtil.generateToken("platform_" + admin.getId(), role);
        String refreshToken = jwtUtil.generateRefreshToken("platform_" + admin.getId());

        // 更新最后登录时间
        admin.setLastLoginAt(LocalDateTime.now());
        platformAdminRepository.save(admin);

        // 构建响应
        return MobileDTO.LoginResponse.builder()
                .userId(admin.getId())
                .username(admin.getUsername())
                .factoryId(null) // 平台管理员没有 factoryId
                .factoryName("平台管理")
                .role(admin.getPlatformRole().name())
                .permissions(Arrays.asList(admin.getPermissions()))
                .token(token)
                .refreshToken(refreshToken)
                .expiresIn(3600L) // 1小时
                .lastLoginTime(admin.getLastLoginAt())
                .profile(MobileDTO.UserProfile.builder()
                        .name(admin.getRealName())
                        .avatar(null)
                        .department("平台管理部")
                        .position(admin.getPlatformRole().name())
                        .phoneNumber(admin.getPhoneNumber())
                        .email(admin.getEmail())
                        .build())
                .build();
    }

    @Override
    @Transactional
    public MobileDTO.ActivationResponse activateDevice(MobileDTO.ActivationRequest request) {
        log.info("设备激活: code={}, deviceId={}",
                request.getActivationCode(), request.getDeviceInfo().getDeviceId());

        // 查找激活码
        DeviceActivation activation = deviceActivationRepository
                .findByActivationCode(request.getActivationCode())
                .orElseThrow(() -> new BusinessException("无效的激活码"));

        // 验证激活码状态
        if (!"PENDING".equals(activation.getStatus())) {
            throw new BusinessException("激活码已被使用或已过期");
        }

        // 检查是否过期
        if (activation.getExpiresAt() != null &&
            LocalDateTime.now().isAfter(activation.getExpiresAt())) {
            activation.setStatus("EXPIRED");
            deviceActivationRepository.save(activation);
            throw new BusinessException("激活码已过期");
        }

        // 更新激活信息
        MobileDTO.DeviceInfo deviceInfo = request.getDeviceInfo();
        activation.setDeviceId(deviceInfo.getDeviceId());
        activation.setDeviceType(deviceInfo.getDeviceType());
        activation.setDeviceModel(deviceInfo.getModel());
        activation.setOsType(deviceInfo.getDeviceType());
        activation.setOsVersion(deviceInfo.getOsVersion());
        activation.setAppVersion(deviceInfo.getAppVersion());
        activation.setStatus("ACTIVATED");
        activation.setActivatedAt(LocalDateTime.now());
        deviceActivationRepository.save(activation);

        return MobileDTO.ActivationResponse.builder()
                .success(true)
                .factoryId(activation.getFactoryId())
                .factoryName(activation.getFactory() != null ? activation.getFactory().getName() : null)
                .activatedAt(activation.getActivatedAt())
                .validUntil(activation.getExpiresAt())
                .features(Arrays.asList("basic", "camera", "offline", "sync"))
                .configuration(new HashMap<>())
                .build();
    }

    @Override
    @Transactional
    public MobileDTO.UploadResponse uploadFiles(List<MultipartFile> files, String category, String metadata) {
        log.info("移动端文件上传: files={}, category={}", files.size(), category);

        MobileDTO.UploadResponse response = MobileDTO.UploadResponse.builder()
                .files(new ArrayList<>())
                .successCount(0)
                .failedCount(0)
                .build();

        // 确保上传目录存在
        Path uploadDir = Paths.get(uploadPath);
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            log.error("创建上传目录失败", e);
            throw new BusinessException("文件上传服务暂时不可用");
        }

        for (MultipartFile file : files) {
            try {
                // 生成唯一文件名
                String filename = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
                Path filepath = uploadDir.resolve(filename);

                // 保存文件
                file.transferTo(filepath.toFile());

                // 添加到响应
                MobileDTO.UploadedFile uploadedFile = MobileDTO.UploadedFile.builder()
                        .id(UUID.randomUUID().toString())
                        .url("/uploads/mobile/" + filename)
                        .originalName(file.getOriginalFilename())
                        .size(file.getSize())
                        .contentType(file.getContentType())
                        .uploadTime(LocalDateTime.now())
                        .build();

                response.getFiles().add(uploadedFile);
                response.setSuccessCount(response.getSuccessCount() + 1);
            } catch (Exception e) {
                log.error("文件上传失败: {}", file.getOriginalFilename(), e);
                response.setFailedCount(response.getFailedCount() + 1);
            }
        }

        return response;
    }

    @Override
    public MobileDTO.DashboardData getDashboardData(String factoryId, Integer userId) {
        log.debug("获取仪表盘数据: factoryId={}, userId={}", factoryId, userId);

        // ========== 查询今日统计数据 (2025-11-20 新增) ==========
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        // 1. 今日产量（千克）- 使用quantity字段，只统计已完成的批次
        Double todayOutputKg = processingBatchRepository
                .findByFactoryIdAndCreatedAtBetween(factoryId, startOfDay, endOfDay)
                .stream()
                .filter(batch -> "COMPLETED".equalsIgnoreCase(batch.getStatus()))
                .filter(batch -> batch.getQuantity() != null)
                .mapToDouble(batch -> batch.getQuantity().doubleValue())
                .sum();

        // 2. 总批次数
        Long totalBatchesLong = processingBatchRepository.countByFactoryId(factoryId);
        Integer totalBatches = totalBatchesLong != null ? totalBatchesLong.intValue() : 0;

        // 3. 总工人数
        Long totalWorkersLong = userRepository.countByFactoryId(factoryId);
        Integer totalWorkers = totalWorkersLong != null ? totalWorkersLong.intValue() : 0;

        // 4. 活跃设备数 (状态为RUNNING)
        Long activeEquipmentLong = equipmentRepository.countByFactoryIdAndStatus(factoryId, "RUNNING");
        Integer activeEquipment = activeEquipmentLong != null ? activeEquipmentLong.intValue() : 0;

        // 5. 总设备数
        Long totalEquipmentLong = equipmentRepository.countByFactoryId(factoryId);
        Integer totalEquipment = totalEquipmentLong != null ? totalEquipmentLong.intValue() : 0;

        log.debug("今日统计: 产量={}kg, 批次={}, 工人={}, 设备={}/{}",
                todayOutputKg, totalBatches, totalWorkers, activeEquipment, totalEquipment);

        // TODO: 从各个服务获取实际数据
        // 这里返回模拟数据
        return MobileDTO.DashboardData.builder()
                .todayStats(MobileDTO.TodayStats.builder()
                        .productionCount(156)
                        .qualityCheckCount(145)
                        .materialReceived(23)
                        .ordersCompleted(8)
                        .productionEfficiency(92.5)
                        .activeWorkers(45)
                        // ========== 新增字段 (2025-11-20) ==========
                        .todayOutputKg(todayOutputKg)
                        .totalBatches(totalBatches)
                        .totalWorkers(totalWorkers)
                        .activeEquipment(activeEquipment)
                        .totalEquipment(totalEquipment)
                        .build())
                .todoItems(Arrays.asList(
                        MobileDTO.TodoItem.builder()
                                .id("1")
                                .title("质检任务")
                                .description("批次#20250109-001需要质检")
                                .priority("HIGH")
                                .status("PENDING")
                                .dueTime(LocalDateTime.now().plusHours(2))
                                .build()
                ))
                .recentActivities(Arrays.asList(
                        MobileDTO.ActivityLog.builder()
                                .type("PRODUCTION")
                                .title("生产完成")
                                .description("批次#20250109-001生产完成")
                                .operator("张三")
                                .time(LocalDateTime.now().minusHours(1))
                                .build()
                ))
                .alerts(Arrays.asList(
                        MobileDTO.Alert.builder()
                                .type("WARNING")
                                .title("库存预警")
                                .message("原材料A库存不足")
                                .severity("MEDIUM")
                                .time(LocalDateTime.now())
                                .build()
                ))
                .quickActions(Arrays.asList(
                        MobileDTO.QuickAction.builder()
                                .icon("scan")
                                .title("扫码录入")
                                .action("SCAN_INPUT")
                                .color("#4CAF50")
                                .orderIndex(1)
                                .build()
                ))
                .build();
    }

    @Override
    @Transactional
    public MobileDTO.SyncResponse syncData(String factoryId, MobileDTO.SyncRequest request) {
        log.info("数据同步: factoryId={}, dataTypes={}", factoryId, request.getDataTypes());

        // TODO: 实现实际的数据同步逻辑
        return MobileDTO.SyncResponse.builder()
                .serverData(new HashMap<>())
                .conflictCount(new HashMap<>())
                .nextSyncToken(UUID.randomUUID().toString())
                .syncTime(LocalDateTime.now())
                .build();
    }

    @Override
    public void registerPushNotification(Integer userId, MobileDTO.PushRegistration registration) {
        log.info("注册推送通知: userId={}, platform={}", userId, registration.getPlatform());
        // TODO: 实现推送通知注册逻辑
    }

    @Override
    public void unregisterPushNotification(Integer userId, String deviceToken) {
        log.info("取消推送通知: userId={}, token={}", userId, deviceToken);
        // TODO: 实现取消推送通知逻辑
    }

    @Override
    public MobileDTO.VersionCheckResponse checkVersion(String currentVersion, String platform) {
        log.debug("检查版本: current={}, platform={}", currentVersion, platform);

        boolean updateRequired = false;
        boolean updateAvailable = false;

        // 简单版本比较逻辑
        if (!currentVersion.equals(latestVersion)) {
            updateAvailable = true;
            // 如果主版本号不同，则强制更新
            String[] current = currentVersion.split("\\.");
            String[] latest = latestVersion.split("\\.");
            if (!current[0].equals(latest[0])) {
                updateRequired = true;
            }
        }

        return MobileDTO.VersionCheckResponse.builder()
                .currentVersion(currentVersion)
                .latestVersion(latestVersion)
                .updateRequired(updateRequired)
                .updateAvailable(updateAvailable)
                .downloadUrl("https://download.example.com/app-" + platform + "-" + latestVersion + ".apk")
                .releaseNotes("1. 修复已知问题\n2. 性能优化\n3. 新增功能")
                .fileSize(52428800L) // 50MB
                .releaseDate(LocalDateTime.now().minusDays(7))
                .build();
    }

    @Override
    public MobileDTO.OfflineDataPackage getOfflineDataPackage(String factoryId, Integer userId) {
        log.info("获取离线数据包: factoryId={}, userId={}", factoryId, userId);

        // TODO: 生成实际的离线数据包
        return MobileDTO.OfflineDataPackage.builder()
                .packageId(UUID.randomUUID().toString())
                .version("1.0.0")
                .baseData(new HashMap<>())
                .configData(new HashMap<>())
                .generatedAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
    }

    @Override
    public void recordDeviceLogin(Integer userId, MobileDTO.DeviceInfo deviceInfo) {
        log.debug("记录设备登录: userId={}, deviceId={}", userId, deviceInfo.getDeviceId());

        userDevices.computeIfAbsent(userId, k -> new ArrayList<>());
        List<MobileDTO.DeviceInfo> devices = userDevices.get(userId);

        // 移除旧的相同设备记录
        devices.removeIf(d -> d.getDeviceId().equals(deviceInfo.getDeviceId()));

        // 添加新记录
        devices.add(deviceInfo);

        // 限制每个用户最多5个设备
        if (devices.size() > 5) {
            devices.remove(0);
        }
    }

    @Override
    public List<MobileDTO.DeviceInfo> getUserDevices(Integer userId) {
        log.debug("获取用户设备列表: userId={}", userId);
        return userDevices.getOrDefault(userId, new ArrayList<>());
    }

    @Override
    public void removeDevice(Integer userId, String deviceId) {
        log.info("移除设备: userId={}, deviceId={}", userId, deviceId);
        List<MobileDTO.DeviceInfo> devices = userDevices.get(userId);
        if (devices != null) {
            devices.removeIf(d -> d.getDeviceId().equals(deviceId));
        }
    }

    @Override
    public MobileDTO.LoginResponse refreshToken(String refreshToken) {
        log.debug("刷新令牌: token={}", refreshToken);

        // 验证刷新令牌
        if (!jwtUtil.validateToken(refreshToken)) {
            throw new BusinessException("无效的刷新令牌");
        }

        String userId = jwtUtil.getUserIdFromTokenAsString(refreshToken);
        User user = userRepository.findById(Integer.parseInt(userId))
                .orElseThrow(() -> new ResourceNotFoundException("用户不存在"));

        // 生成新的访问令牌
        String newToken = jwtUtil.generateToken(userId);

        return MobileDTO.LoginResponse.builder()
                .token(newToken)
                .refreshToken(refreshToken) // 保持原刷新令牌
                .expiresIn(3600L)
                .build();
    }

    @Override
    public void logout(Integer userId, String deviceId) {
        log.info("用户登出: userId={}, deviceId={}", userId, deviceId);

        // 移除设备记录
        if (StringUtils.hasText(deviceId)) {
            removeDevice(userId, deviceId);
        }

        // TODO: 清除相关的会话和缓存
    }

    @Override
    public Object getMobileConfig(String factoryId, String platform) {
        log.debug("获取移动端配置: factoryId={}, platform={}", factoryId, platform);

        // TODO: 从数据库获取实际配置
        Map<String, Object> config = new HashMap<>();
        config.put("theme", "light");
        config.put("language", "zh-CN");
        config.put("features", Arrays.asList("scan", "camera", "location"));
        config.put("syncInterval", 300); // 5分钟
        config.put("offlineMode", true);

        return config;
    }

    @Override
    public void reportCrash(MobileDTO.DeviceInfo deviceInfo, String crashLog) {
        log.error("崩溃报告 - 设备: {}, 日志: {}", deviceInfo, crashLog);
        // TODO: 存储崩溃日志到数据库或日志分析系统
    }

    @Override
    public void reportPerformance(MobileDTO.DeviceInfo deviceInfo, Object performanceData) {
        log.info("性能报告 - 设备: {}, 数据: {}", deviceInfo, performanceData);
        // TODO: 存储性能数据用于分析
    }

    @Override
    @Transactional
    public MobileDTO.RegisterPhaseOneResponse registerPhaseOne(MobileDTO.RegisterPhaseOneRequest request) {
        String phoneNumber = request.getPhoneNumber();
        String factoryId = request.getFactoryId();

        // 智能推断 factoryId（如果未提供）
        if (factoryId == null || factoryId.trim().isEmpty()) {
            log.info("factoryId未提供，通过手机号查找白名单: phone={}", phoneNumber);
            List<Whitelist> whitelists = whitelistRepository.findAllByPhoneNumber(phoneNumber);

            if (whitelists.isEmpty()) {
                throw new BusinessException("该手机号未在任何工厂白名单中，请联系管理员添加");
            } else if (whitelists.size() == 1) {
                factoryId = whitelists.get(0).getFactoryId();
                log.info("智能推断成功: phone={}, factoryId={}", phoneNumber, factoryId);
            } else {
                // 手机号在多个工厂白名单中，必须指定
                throw new BusinessException("该手机号在多个工厂白名单中，请提供工厂ID进行注册");
            }
        }

        log.info("移动端注册第一阶段: phone={}, factoryId={}", phoneNumber, factoryId);

        // 检查白名单
        Whitelist whitelist = whitelistRepository.findByFactoryIdAndPhoneNumber(factoryId, phoneNumber)
                .orElseThrow(() -> new BusinessException("该手机号未在白名单中，无法注册"));

        // 检查状态和有效性
        if (!whitelist.isValid()) {
            if (whitelist.getStatus() != WhitelistStatus.ACTIVE) {
                throw new BusinessException("该手机号已被禁用");
            } else {
                throw new BusinessException("该手机号白名单已过期");
            }
        }

        // 检查用户是否已存在
        Optional<User> existingUser = userRepository.findByFactoryIdAndPhone(factoryId, phoneNumber);
        boolean isNewUser = !existingUser.isPresent();

        // 生成临时令牌（30分钟有效）
        String tempToken = tempTokenService.generateTempToken(phoneNumber, 30);
        long expiresAt = System.currentTimeMillis() + 30 * 60 * 1000;

        log.info("手机验证成功: phone={}, isNewUser={}", phoneNumber, isNewUser);

        return MobileDTO.RegisterPhaseOneResponse.builder()
                .tempToken(tempToken)
                .expiresAt(expiresAt)
                .phoneNumber(phoneNumber)
                .factoryId(factoryId)
                .isNewUser(isNewUser)
                .message(isNewUser ? "验证成功，请继续填写注册信息" : "该手机号已注册")
                .build();
    }

    @Override
    @Transactional
    public MobileDTO.RegisterPhaseTwoResponse registerPhaseTwo(MobileDTO.RegisterPhaseTwoRequest request) {
        log.info("移动端注册第二阶段: factory={}, username={}", request.getFactoryId(), request.getUsername());

        // 验证临时令牌
        String phoneNumber = tempTokenService.validateAndGetPhone(request.getTempToken());
        if (phoneNumber == null) {
            throw new BusinessException("临时令牌无效或已过期，请重新验证手机号");
        }

        // 获取或推断 factoryId
        String factoryId = request.getFactoryId();
        if (factoryId == null || factoryId.trim().isEmpty()) {
            // 从白名单推断 factoryId
            List<Whitelist> whitelists = whitelistRepository.findAllByPhoneNumber(phoneNumber);
            if (whitelists.isEmpty()) {
                throw new BusinessException("无法推断工厂ID，请提供factoryId");
            } else if (whitelists.size() == 1) {
                factoryId = whitelists.get(0).getFactoryId();
                log.info("从白名单推断factoryId: phone={}, factoryId={}", phoneNumber, factoryId);
            } else {
                throw new BusinessException("该手机号在多个工厂白名单中，请提供factoryId");
            }
        }

        // 检查用户名是否已存在（用户名全局唯一）
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("该用户名已被使用");
        }

        // 创建用户
        User user = new User();
        user.setFactoryId(factoryId);
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getRealName());
        user.setPhone(phoneNumber);
        user.setPosition(request.getPosition() != null ? request.getPosition() : FactoryUserRole.unactivated.name());
        user.setIsActive(false); // 需要管理员激活
        user = userRepository.save(user);

        // 删除临时令牌
        tempTokenService.deleteTempToken(request.getTempToken());

        // 构建用户资料
        MobileDTO.UserProfile profile = MobileDTO.UserProfile.builder()
                .name(user.getFullName())
                .phoneNumber(user.getPhone())
                .email(null) // email字段已删除
                .position(user.getPosition())
                .build();

        log.info("移动端注册成功: userId={}, username={}", user.getId(), user.getUsername());

        return MobileDTO.RegisterPhaseTwoResponse.builder()
                .role(user.getPosition() != null ? user.getPosition() : "unactivated") // 使用position字段
                .profile(profile)
                .message("注册成功，请等待管理员激活您的账户")
                .registeredAt(LocalDateTime.now())
                .build();
    }

    /**
     * 解析权限字符串
     */
    private List<String> parsePermissions(String permissions) {
        if (!StringUtils.hasText(permissions)) {
            return new ArrayList<>();
        }
        return Arrays.asList(permissions.split(","));
    }

    // ==================== 从 AuthService 整合的方法 ====================

    @Override
    public boolean validateToken(String token) {
        if (!jwtUtil.validateToken(token)) {
            return false;
        }
        return sessionRepository.findByTokenAndIsRevokedFalse(token)
                .map(session -> session.getExpiresAt().isAfter(LocalDateTime.now()))
                .orElse(false);
    }

    @Override
    public UserDTO getUserFromToken(String token) {
        Integer userId = jwtUtil.getUserIdFromToken(token);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("用户不存在"));
        return userMapper.toDTO(user);
    }

    @Override
    @Transactional
    public void changePassword(Integer userId, String oldPassword, String newPassword) {
        // 查询用户
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("用户不存在"));

        // 验证旧密码
        if (!passwordEncoder.matches(oldPassword, user.getPasswordHash())) {
            throw new BusinessException("原密码错误");
        }

        // 更新密码
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // 撤销所有会话
        sessionRepository.revokeAllUserSessions(userId);
    }

    @Override
    @Transactional
    public void resetPassword(String factoryId, String username, String newPassword) {
        User user = userRepository.findByFactoryIdAndUsername(factoryId, username)
                .orElseThrow(() -> new ResourceNotFoundException("用户不存在"));

        // 更新密码
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // 撤销所有会话
        sessionRepository.revokeAllUserSessions(user.getId());
    }

    // ==================== 忘记密码功能实现 ====================

    // 验证码存储（实际应使用Redis）
    private final Map<String, VerificationCodeData> verificationCodes = new ConcurrentHashMap<>();

    /**
     * 验证码数据结构
     */
    private static class VerificationCodeData {
        String code;
        LocalDateTime createdAt;
        LocalDateTime expiresAt;
        int retryCount;

        public VerificationCodeData(String code, LocalDateTime createdAt, LocalDateTime expiresAt) {
            this.code = code;
            this.createdAt = createdAt;
            this.expiresAt = expiresAt;
            this.retryCount = 0;
        }
    }

    @Override
    @Transactional
    public MobileDTO.SendVerificationCodeResponse sendVerificationCode(MobileDTO.SendVerificationCodeRequest request) {
        String phoneNumber = request.getPhoneNumber();
        String verificationType = request.getVerificationType();

        log.info("发送验证码: phone={}, type={}", phoneNumber, verificationType);

        // 检查该手机号是否存在用户
        List<User> users = userRepository.findAllByPhone(phoneNumber);
        if (users.isEmpty()) {
            throw new BusinessException("该手机号未注册");
        }

        // 检查是否在冷却期（60秒内只能发送一次）
        String cacheKey = "verification_" + phoneNumber;
        VerificationCodeData existingData = verificationCodes.get(cacheKey);
        if (existingData != null && existingData.createdAt.plusSeconds(60).isAfter(LocalDateTime.now())) {
            long retryAfter = 60 - java.time.Duration.between(existingData.createdAt, LocalDateTime.now()).getSeconds();
            return MobileDTO.SendVerificationCodeResponse.builder()
                    .success(false)
                    .message("发送过于频繁，请稍后再试")
                    .expiresIn(null)
                    .retryAfter((int) retryAfter)
                    .sentAt(existingData.createdAt)
                    .build();
        }

        // 生成6位数字验证码
        String code = String.format("%06d", new Random().nextInt(999999));
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusMinutes(5); // 5分钟有效期

        // 存储验证码
        VerificationCodeData codeData = new VerificationCodeData(code, now, expiresAt);
        verificationCodes.put(cacheKey, codeData);

        // TODO: 实际应调用SMS服务发送短信
        log.info("【模拟短信】验证码: {} (有效期5分钟)", code);
        log.info("📱 发送验证码到 {}: {}", phoneNumber, code);

        return MobileDTO.SendVerificationCodeResponse.builder()
                .success(true)
                .message("验证码已发送")
                .expiresIn(300) // 5分钟
                .retryAfter(60) // 60秒后可重试
                .sentAt(now)
                .build();
    }

    @Override
    @Transactional
    public MobileDTO.VerifyResetCodeResponse verifyResetCode(MobileDTO.VerifyResetCodeRequest request) {
        String phoneNumber = request.getPhoneNumber();
        String inputCode = request.getVerificationCode();

        log.info("验证重置码: phone={}, code={}", phoneNumber, inputCode);

        // 检查验证码是否存在
        String cacheKey = "verification_" + phoneNumber;
        VerificationCodeData codeData = verificationCodes.get(cacheKey);

        if (codeData == null) {
            throw new BusinessException("验证码不存在或已过期");
        }

        // 检查是否过期
        if (LocalDateTime.now().isAfter(codeData.expiresAt)) {
            verificationCodes.remove(cacheKey);
            throw new BusinessException("验证码已过期");
        }

        // 验证码错误次数限制（最多3次）
        if (codeData.retryCount >= 3) {
            verificationCodes.remove(cacheKey);
            throw new BusinessException("验证码错误次数过多，请重新获取");
        }

        // 验证码校验
        if (!codeData.code.equals(inputCode)) {
            codeData.retryCount++;
            throw new BusinessException("验证码错误");
        }

        // 验证成功，生成重置令牌（30分钟有效）
        String resetToken = tempTokenService.generateTempToken(phoneNumber, 30);
        LocalDateTime now = LocalDateTime.now();

        // 删除验证码
        verificationCodes.remove(cacheKey);

        log.info("✅ 验证码验证成功: phone={}", phoneNumber);

        return MobileDTO.VerifyResetCodeResponse.builder()
                .success(true)
                .message("验证成功")
                .resetToken(resetToken)
                .expiresIn(1800) // 30分钟
                .verifiedAt(now)
                .build();
    }

    @Override
    @Transactional
    public MobileDTO.ForgotPasswordResponse forgotPassword(MobileDTO.ForgotPasswordRequest request) {
        String phoneNumber = request.getPhoneNumber();
        String resetToken = request.getResetToken();
        String newPassword = request.getNewPassword();

        log.info("忘记密码-重置密码: phone={}", phoneNumber);

        // 验证重置令牌
        String phoneFromToken = tempTokenService.validateAndGetPhone(resetToken);
        if (phoneFromToken == null || !phoneFromToken.equals(phoneNumber)) {
            throw new BusinessException("重置令牌无效或已过期");
        }

        // 查找用户（手机号可能对应多个用户）
        List<User> users = userRepository.findAllByPhone(phoneNumber);
        if (users.isEmpty()) {
            throw new BusinessException("该手机号未注册");
        }

        // 更新所有匹配用户的密码
        String encodedPassword = passwordEncoder.encode(newPassword);
        int updatedCount = 0;
        for (User user : users) {
            user.setPasswordHash(encodedPassword);
            userRepository.save(user);

            // 撤销该用户所有会话
            sessionRepository.revokeAllUserSessions(user.getId());

            updatedCount++;
            log.info("✅ 密码已重置: userId={}, username={}", user.getId(), user.getUsername());
        }

        // 删除重置令牌
        tempTokenService.deleteTempToken(resetToken);

        LocalDateTime now = LocalDateTime.now();
        log.info("✅ 密码重置完成: phone={}, 更新了{}个账户", phoneNumber, updatedCount);

        return MobileDTO.ForgotPasswordResponse.builder()
                .success(true)
                .message(updatedCount > 1
                        ? String.format("密码重置成功，已更新%d个关联账户", updatedCount)
                        : "密码重置成功")
                .resetAt(now)
                .build();
    }

    // ==================== 人员报表功能实现 ====================

    @Override
    public MobileDTO.PersonnelStatistics getPersonnelStatistics(String factoryId, String startDate, String endDate) {
        log.info("获取人员统计: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        // 获取工厂所有用户
        List<User> allUsers = userRepository.findByFactoryId(factoryId);
        int totalEmployees = allUsers.size();

        // 解析日期范围（如果提供）
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : LocalDate.now().minusMonths(1);
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();

        // 转换为LocalDateTime范围
        LocalDateTime startDateTime = start.atStartOfDay();
        LocalDateTime endDateTime = end.plusDays(1).atStartOfDay();

        // 从time_clock_record表查询实际考勤数据
        List<TimeClockRecord> allRecords = new ArrayList<>();
        for (User user : allUsers) {
            List<TimeClockRecord> userRecords = timeClockRecordRepository
                    .findByFactoryIdAndUserIdAndClockDateBetween(factoryId, Long.valueOf(user.getId()), startDateTime, endDateTime);
            allRecords.addAll(userRecords);
        }

        // 统计实际出勤人数（在日期范围内有打卡记录的人数）
        Set<Long> presentUserIds = allRecords.stream()
                .map(TimeClockRecord::getUserId)
                .collect(Collectors.toSet());
        int totalPresent = presentUserIds.size();

        // 缺勤人数
        int totalAbsent = totalEmployees - totalPresent;

        // 计算平均出勤率（出勤人数 / 总人数）
        double avgAttendanceRate = totalEmployees > 0
                ? ((double) totalPresent / totalEmployees) * 100
                : 0.0;

        // 统计活跃部门数（有员工的部门）
        long activeDepartments = allUsers.stream()
                .map(User::getDepartment)
                .filter(dept -> dept != null && !dept.isEmpty())
                .distinct()
                .count();

        // 计算实际总工时（分钟转小时）
        double totalWorkMinutes = allRecords.stream()
                .mapToDouble(record -> record.getWorkDurationMinutes() != null ? record.getWorkDurationMinutes() : 0.0)
                .sum();
        double totalWorkHours = totalWorkMinutes / 60.0;

        // 计算平均每人工时
        double avgWorkHoursPerEmployee = totalEmployees > 0
                ? totalWorkHours / totalEmployees
                : 0.0;

        log.info("人员统计完成: 总人数={}, 出勤={}, 缺勤={}, 总工时={}小时",
                totalEmployees, totalPresent, totalAbsent, String.format("%.1f", totalWorkHours));

        return MobileDTO.PersonnelStatistics.builder()
                .totalEmployees(totalEmployees)
                .totalPresent(totalPresent)
                .totalAbsent(totalAbsent)
                .avgAttendanceRate(avgAttendanceRate)
                .activeDepartments((int) activeDepartments)
                .totalWorkHours(totalWorkHours)
                .avgWorkHoursPerEmployee(avgWorkHoursPerEmployee)
                .build();
    }

    @Override
    public List<MobileDTO.WorkHoursRankingItem> getWorkHoursRanking(String factoryId, String startDate, String endDate, Integer limit) {
        log.info("获取工时排行: factoryId={}, startDate={}, endDate={}, limit={}", factoryId, startDate, endDate, limit);

        // 解析日期范围
        LocalDate start = LocalDate.parse(startDate);
        LocalDate end = LocalDate.parse(endDate);

        // 转换为LocalDateTime范围
        LocalDateTime startDateTime = start.atStartOfDay();
        LocalDateTime endDateTime = end.plusDays(1).atStartOfDay();

        // 获取工厂所有激活用户
        List<User> activeUsers = userRepository.findByFactoryIdAndIsActive(factoryId, true);

        // 计算每个用户的工时数据
        List<MobileDTO.WorkHoursRankingItem> ranking = new ArrayList<>();

        for (User user : activeUsers) {
            // 查询用户在日期范围内的所有打卡记录
            List<TimeClockRecord> records = timeClockRecordRepository
                    .findByFactoryIdAndUserIdAndClockDateBetween(factoryId, Long.valueOf(user.getId()), startDateTime, endDateTime);

            if (records.isEmpty()) {
                continue; // 没有打卡记录的用户不参与排行
            }

            // 计算总工时（分钟转小时）
            double totalWorkMinutes = records.stream()
                    .mapToDouble(r -> r.getWorkDurationMinutes() != null ? r.getWorkDurationMinutes() : 0.0)
                    .sum();
            double totalWorkHours = totalWorkMinutes / 60.0;

            // 计算总加班时长（分钟转小时）
            double totalOvertimeMinutes = records.stream()
                    .mapToDouble(r -> r.getOvertimeMinutes() != null ? r.getOvertimeMinutes() : 0.0)
                    .sum();
            double totalOvertimeHours = totalOvertimeMinutes / 60.0;

            // 统计出勤天数
            int attendanceDays = records.size();

            // 计算日期范围内的总天数
            long totalDays = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;

            // 计算出勤率
            double attendanceRate = totalDays > 0
                    ? ((double) attendanceDays / totalDays) * 100
                    : 0.0;

            ranking.add(MobileDTO.WorkHoursRankingItem.builder()
                    .userId(user.getId())
                    .userName(user.getFullName() != null ? user.getFullName() : user.getUsername())
                    .departmentId(user.getDepartment())
                    .departmentName(user.getDepartment() != null ? user.getDepartment() : "未分配")
                    .totalWorkHours(totalWorkHours)
                    .totalOvertimeHours(totalOvertimeHours)
                    .attendanceDays(attendanceDays)
                    .attendanceRate(attendanceRate)
                    .build());
        }

        // 按总工时降序排序
        ranking.sort((a, b) -> Double.compare(b.getTotalWorkHours(), a.getTotalWorkHours()));

        // 返回前N名
        int resultSize = Math.min(limit, ranking.size());
        log.info("工时排行计算完成: 共{}人, 返回前{}名", ranking.size(), resultSize);

        return ranking.subList(0, resultSize);
    }

    @Override
    public MobileDTO.OvertimeStatistics getOvertimeStatistics(String factoryId, String startDate, String endDate, String departmentId) {
        log.info("获取加班统计: factoryId={}, startDate={}, endDate={}, departmentId={}", factoryId, startDate, endDate, departmentId);

        // 解析日期范围
        LocalDate start = LocalDate.parse(startDate);
        LocalDate end = LocalDate.parse(endDate);

        // 转换为LocalDateTime范围
        LocalDateTime startDateTime = start.atStartOfDay();
        LocalDateTime endDateTime = end.plusDays(1).atStartOfDay();

        // 获取用户列表（可选按部门筛选）
        List<User> users;
        if (departmentId != null && !departmentId.isEmpty()) {
            users = userRepository.findByFactoryIdAndPosition(factoryId, departmentId);
        } else {
            users = userRepository.findByFactoryIdAndIsActive(factoryId, true);
        }

        // 统计每个用户的加班数据
        Map<Integer, Double> userOvertimeMap = new HashMap<>();
        double totalOvertimeMinutes = 0.0;

        for (User user : users) {
            // 查询用户在日期范围内的所有打卡记录
            List<TimeClockRecord> records = timeClockRecordRepository
                    .findByFactoryIdAndUserIdAndClockDateBetween(factoryId, Long.valueOf(user.getId()), startDateTime, endDateTime);

            // 计算该用户的总加班时长
            double userOvertimeMinutes = records.stream()
                    .mapToDouble(r -> r.getOvertimeMinutes() != null ? r.getOvertimeMinutes() : 0.0)
                    .sum();

            if (userOvertimeMinutes > 0) {
                userOvertimeMap.put(user.getId(), userOvertimeMinutes);
                totalOvertimeMinutes += userOvertimeMinutes;
            }
        }

        // 总加班时长（分钟转小时）
        double totalOvertimeHours = totalOvertimeMinutes / 60.0;

        // 有加班的员工数量
        int totalEmployeesWithOvertime = userOvertimeMap.size();

        // 平均每人加班时长
        double avgOvertimeHoursPerEmployee = totalEmployeesWithOvertime > 0
                ? totalOvertimeHours / totalEmployeesWithOvertime
                : 0.0;

        // 按加班时长排序，获取TOP 10
        List<Map.Entry<Integer, Double>> sortedEntries = userOvertimeMap.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .limit(10)
                .collect(Collectors.toList());

        // 构建TOP 10加班员工列表
        List<MobileDTO.OvertimeEmployeeItem> topOvertimeEmployees = new ArrayList<>();
        for (Map.Entry<Integer, Double> entry : sortedEntries) {
            Integer userId = entry.getKey();
            double overtimeMinutes = entry.getValue();

            User user = users.stream()
                    .filter(u -> u.getId().equals(userId))
                    .findFirst()
                    .orElse(null);

            if (user != null) {
                topOvertimeEmployees.add(MobileDTO.OvertimeEmployeeItem.builder()
                        .userId(user.getId())
                        .userName(user.getFullName() != null ? user.getFullName() : user.getUsername())
                        .overtimeHours(overtimeMinutes / 60.0)
                        .build());
            }
        }

        log.info("加班统计完成: 总加班{}小时, {}人有加班记录, TOP 10已生成",
                String.format("%.1f", totalOvertimeHours), totalEmployeesWithOvertime);

        return MobileDTO.OvertimeStatistics.builder()
                .totalOvertimeHours(totalOvertimeHours)
                .totalEmployeesWithOvertime(totalEmployeesWithOvertime)
                .avgOvertimeHoursPerEmployee(avgOvertimeHoursPerEmployee)
                .topOvertimeEmployees(topOvertimeEmployees)
                .build();
    }

    @Override
    public List<MobileDTO.PerformanceItem> getPersonnelPerformance(String factoryId, String startDate, String endDate, Integer userId) {
        log.info("获取人员绩效: factoryId={}, startDate={}, endDate={}, userId={}", factoryId, startDate, endDate, userId);

        // 解析日期范围
        LocalDate start = LocalDate.parse(startDate);
        LocalDate end = LocalDate.parse(endDate);

        // 转换为LocalDateTime范围
        LocalDateTime startDateTime = start.atStartOfDay();
        LocalDateTime endDateTime = end.plusDays(1).atStartOfDay();

        // 获取用户列表
        List<User> users;
        if (userId != null) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("用户不存在"));
            users = Arrays.asList(user);
        } else {
            users = userRepository.findByFactoryIdAndIsActive(factoryId, true);
        }

        // 计算每个用户的绩效数据
        List<MobileDTO.PerformanceItem> performance = new ArrayList<>();

        for (User user : users) {
            // 1. 从time_clock_records计算工时和出勤率
            List<TimeClockRecord> records = timeClockRecordRepository
                    .findByFactoryIdAndUserIdAndClockDateBetween(factoryId, Long.valueOf(user.getId()), startDateTime, endDateTime);

            double workMinutes = records.stream()
                    .mapToDouble(r -> r.getWorkDurationMinutes() != null ? r.getWorkDurationMinutes() : 0.0)
                    .sum();
            double workHours = workMinutes / 60.0;

            int attendanceDays = records.size();
            long totalDays = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
            double attendanceRate = totalDays > 0
                    ? ((double) attendanceDays / totalDays) * 100
                    : 0.0;

            // 2. 从quality_inspections计算质量分数（平均合格率）
            List<QualityInspection> inspections = qualityInspectionRepository
                    .findByFactoryIdAndDateRange(factoryId, start, end);

            // 筛选该用户作为质检员的记录
            List<QualityInspection> userInspections = inspections.stream()
                    .filter(qi -> qi.getInspectorId().equals(user.getId()))
                    .collect(Collectors.toList());

            double qualityScore = 0.0;
            if (!userInspections.isEmpty()) {
                double avgPassRate = userInspections.stream()
                        .filter(qi -> qi.getPassRate() != null)
                        .mapToDouble(qi -> qi.getPassRate().doubleValue())
                        .average()
                        .orElse(0.0);
                qualityScore = avgPassRate; // 合格率即为质量分数（0-100）
            } else {
                qualityScore = 85.0; // 无质检记录则给予默认分数
            }

            // 3. 从processing_batches计算效率分数
            // 效率评估：作为主管的批次完成情况
            // 注意：startDateTime和endDateTime已在方法开头定义

            List<ProcessingBatch> batches = processingBatchRepository
                    .findBatchesInDateRange(factoryId, startDateTime, endDateTime);

            // 筛选该用户作为主管的批次
            List<ProcessingBatch> userBatches = batches.stream()
                    .filter(batch -> batch.getSupervisorId() != null && batch.getSupervisorId().equals(user.getId()))
                    .collect(Collectors.toList());

            double efficiencyScore = 0.0;
            if (!userBatches.isEmpty()) {
                // 效率 = 完成批次数 / 总批次数 * 100
                long completedCount = userBatches.stream()
                        .filter(batch -> "COMPLETED".equals(batch.getStatus())
                                || ProcessingBatch.BatchStatus.COMPLETED.name().equals(batch.getStatus()))
                        .count();
                efficiencyScore = ((double) completedCount / userBatches.size()) * 100;
            } else {
                efficiencyScore = 80.0; // 无批次记录则给予默认分数
            }

            // 4. 计算综合分数（权重：出勤率30%, 质量40%, 效率30%）
            double overallScore = (attendanceRate * 0.3 + qualityScore * 0.4 + efficiencyScore * 0.3);

            performance.add(MobileDTO.PerformanceItem.builder()
                    .userId(user.getId())
                    .userName(user.getFullName() != null ? user.getFullName() : user.getUsername())
                    .departmentName(user.getDepartment() != null ? user.getDepartment() : "未分配")
                    .workHours(workHours)
                    .attendanceRate(attendanceRate)
                    .qualityScore(qualityScore)
                    .efficiencyScore(efficiencyScore)
                    .overallScore(overallScore)
                    .build());
        }

        // 按综合分数降序排序
        performance.sort((a, b) -> Double.compare(b.getOverallScore(), a.getOverallScore()));

        log.info("人员绩效计算完成: 共{}人", performance.size());

        return performance;
    }

    // ==================== 成本对比功能实现 ====================

    @Override
    public List<MobileDTO.BatchCostData> getBatchCostComparison(String factoryId, List<String> batchIds) {
        log.info("获取批次成本对比: factoryId={}, batchIds={}", factoryId, batchIds);

        List<MobileDTO.BatchCostData> costDataList = new ArrayList<>();

        for (String batchId : batchIds) {
            // 查询批次信息
            Optional<ProcessingBatch> batchOpt = processingBatchRepository.findByFactoryIdAndId(factoryId, batchId);

            if (batchOpt.isEmpty()) {
                log.warn("批次不存在: factoryId={}, batchId={}", factoryId, batchId);
                continue;
            }

            ProcessingBatch batch = batchOpt.get();

            // 提取成本数据（从BigDecimal转Double）
            Double totalCost = batch.getTotalCost() != null ? batch.getTotalCost().doubleValue() : 0.0;
            Double laborCost = batch.getLaborCost() != null ? batch.getLaborCost().doubleValue() : 0.0;
            Double materialCost = batch.getMaterialCost() != null ? batch.getMaterialCost().doubleValue() : 0.0;
            Double equipmentCost = batch.getEquipmentCost() != null ? batch.getEquipmentCost().doubleValue() : 0.0;
            Double otherCost = batch.getOtherCost() != null ? batch.getOtherCost().doubleValue() : 0.0;

            // 提取数量
            Double quantity = batch.getQuantity() != null ? batch.getQuantity().doubleValue() : 0.0;

            // 计算单位成本
            Double unitCost = quantity > 0 ? totalCost / quantity : 0.0;

            // 格式化日期（从startTime提取日期）
            String date = batch.getStartTime() != null
                    ? batch.getStartTime().toLocalDate().toString()
                    : "";

            // 构建成本数据对象
            MobileDTO.BatchCostData costData = MobileDTO.BatchCostData.builder()
                    .batchId(batch.getId())
                    .batchNumber(batch.getBatchNumber())
                    .productType(batch.getProductName())
                    .totalCost(totalCost)
                    .laborCost(laborCost)
                    .materialCost(materialCost)
                    .equipmentCost(equipmentCost)
                    .otherCost(otherCost)
                    .quantity(quantity)
                    .unitCost(unitCost)
                    .date(date)
                    .build();

            costDataList.add(costData);
        }

        log.info("批次成本对比完成: 共{}个批次", costDataList.size());

        return costDataList;
    }

    // ==================== 设备告警功能实现 ====================

    @Override
    public com.cretas.aims.dto.common.PageResponse<MobileDTO.AlertResponse> getEquipmentAlerts(String factoryId, String status, com.cretas.aims.dto.common.PageRequest pageRequest) {
        log.info("获取设备告警列表: factoryId={}, status={}, page={}, size={}",
                factoryId, status, pageRequest.getPage(), pageRequest.getSize());

        // 创建Spring分页请求
        org.springframework.data.domain.PageRequest springPageRequest =
                org.springframework.data.domain.PageRequest.of(
                    pageRequest.getPage() - 1,
                    pageRequest.getSize(),
                    org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "triggeredAt")
                );

        // 根据状态查询
        org.springframework.data.domain.Page<EquipmentAlert> page;
        if (status != null && !status.trim().isEmpty()) {
            AlertStatus alertStatus = AlertStatus.valueOf(status.toUpperCase());
            page = equipmentAlertRepository.findByFactoryIdAndStatus(factoryId, alertStatus, springPageRequest);
        } else {
            page = equipmentAlertRepository.findByFactoryId(factoryId, springPageRequest);
        }

        // 转换为响应DTO
        List<MobileDTO.AlertResponse> alertResponses = page.getContent().stream()
                .map(this::convertToAlertResponse)
                .collect(java.util.stream.Collectors.toList());

        // 创建分页响应
        com.cretas.aims.dto.common.PageResponse<MobileDTO.AlertResponse> response = new com.cretas.aims.dto.common.PageResponse<>();
        response.setContent(alertResponses);
        response.setPage(pageRequest.getPage());
        response.setSize(pageRequest.getSize());
        response.setTotalElements(page.getTotalElements());
        response.setTotalPages(page.getTotalPages());
        response.setFirst(page.isFirst());
        response.setLast(page.isLast());
        response.setCurrentPage(pageRequest.getPage()); // ✅ P3-1修复: 添加currentPage字段

        log.info("获取设备告警列表成功: 共{}条记录", page.getTotalElements());
        return response;
    }

    @Override
    @Transactional
    public MobileDTO.AlertResponse acknowledgeAlert(String factoryId, String alertId, Integer userId, String username, MobileDTO.AcknowledgeAlertRequest request) {
        log.info("确认设备告警: factoryId={}, alertId={}, userId={}", factoryId, alertId, userId);

        // 1. 获取或创建告警记录（支持动态ID）
        EquipmentAlert alert = getOrCreateAlert(factoryId, alertId);

        // 2. 检查告警状态
        if (alert.getStatus() == AlertStatus.RESOLVED) {
            throw new BusinessException("告警已解决，无法确认");
        }

        if (alert.getStatus() == AlertStatus.ACKNOWLEDGED) {
            throw new BusinessException("告警已被确认");
        }

        // 3. 更新告警状态为已确认
        alert.setStatus(AlertStatus.ACKNOWLEDGED);
        alert.setAcknowledgedAt(LocalDateTime.now());
        alert.setAcknowledgedBy(userId);
        alert.setAcknowledgedByName(username);

        equipmentAlertRepository.save(alert);

        log.info("告警确认成功: alertId={}, userId={}", alertId, userId);

        // 4. 转换为响应DTO
        return convertToAlertResponse(alert);
    }

    @Override
    @Transactional
    public MobileDTO.AlertResponse resolveAlert(String factoryId, String alertId, Integer userId, String username, MobileDTO.ResolveAlertRequest request) {
        log.info("解决设备告警: factoryId={}, alertId={}, userId={}", factoryId, alertId, userId);

        // 1. 获取或创建告警记录（支持动态ID）
        EquipmentAlert alert = getOrCreateAlert(factoryId, alertId);

        // 2. 检查告警状态
        if (alert.getStatus() == AlertStatus.RESOLVED) {
            throw new BusinessException("告警已解决");
        }

        // 3. 如果告警还未确认，先设置确认信息
        if (alert.getAcknowledgedAt() == null) {
            alert.setStatus(AlertStatus.ACKNOWLEDGED);
            alert.setAcknowledgedAt(LocalDateTime.now());
            alert.setAcknowledgedBy(userId);
            alert.setAcknowledgedByName(username);
        }

        // 4. 更新告警状态为已解决
        alert.setStatus(AlertStatus.RESOLVED);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setResolvedBy(userId);
        alert.setResolvedByName(username);

        // 5. 保存解决方案备注
        if (request != null && StringUtils.hasText(request.getResolutionNotes())) {
            alert.setResolutionNotes(request.getResolutionNotes());
        }

        equipmentAlertRepository.save(alert);

        log.info("告警解决成功: alertId={}, userId={}", alertId, userId);

        // 6. 转换为响应DTO
        return convertToAlertResponse(alert);
    }

    /**
     * 获取或创建告警记录（支持动态ID）
     */
    private EquipmentAlert getOrCreateAlert(String factoryId, String alertId) {
        // 1. 尝试作为数字ID查询
        if (alertId.matches("\\d+")) {
            Integer numericId = Integer.parseInt(alertId);
            return equipmentAlertRepository.findByFactoryIdAndId(factoryId, numericId)
                    .orElseThrow(() -> new ResourceNotFoundException("告警不存在: alertId=" + alertId));
        }

        // 2. 处理动态ID格式：MAINT_{equipmentId} 或 WARRANTY_{equipmentId}
        if (alertId.startsWith("MAINT_") || alertId.startsWith("WARRANTY_")) {
            String[] parts = alertId.split("_");
            if (parts.length != 2) {
                throw new BusinessException("无效的告警ID格式: " + alertId);
            }

            String alertType = parts[0];
            String equipmentId = parts[1];  // Equipment ID现在是String类型

            // 查询设备信息
            FactoryEquipment equipment = equipmentRepository.findById(equipmentId)
                    .orElseThrow(() -> new ResourceNotFoundException("设备不存在: equipmentId=" + equipmentId));

            // 根据类型创建告警记录（从设备维护信息动态生成）
            EquipmentAlert newAlert;
            if ("MAINT".equals(alertType)) {
                newAlert = createMaintenanceAlert(factoryId, equipment);
            } else {
                newAlert = createWarrantyAlert(factoryId, equipment);
            }

            return equipmentAlertRepository.save(newAlert);
        }

        throw new BusinessException("不支持的告警ID格式: " + alertId);
    }

    /**
     * 创建维护告警
     */
    private EquipmentAlert createMaintenanceAlert(String factoryId, FactoryEquipment equipment) {
        LocalDate nextMaintenanceDate = equipment.getNextMaintenanceDate();
        LocalDateTime triggeredAt = nextMaintenanceDate != null
                ? nextMaintenanceDate.atStartOfDay()
                : LocalDateTime.now();

        long daysOverdue = 0;
        if (nextMaintenanceDate != null) {
            daysOverdue = LocalDate.now().toEpochDay() - nextMaintenanceDate.toEpochDay();
        }

        String message;
        com.cretas.aims.entity.enums.AlertLevel level;

        if (daysOverdue > 7) {
            level = com.cretas.aims.entity.enums.AlertLevel.CRITICAL;
            message = String.format("设备维护已逾期 %d 天", daysOverdue);
        } else if (daysOverdue > 0) {
            level = com.cretas.aims.entity.enums.AlertLevel.WARNING;
            message = String.format("设备维护已逾期 %d 天", daysOverdue);
        } else {
            level = com.cretas.aims.entity.enums.AlertLevel.WARNING;
            message = "设备即将到达维护周期";
        }

        String details = String.format("上次维护: %s\n下次维护: %s",
                equipment.getLastMaintenanceDate() != null ? equipment.getLastMaintenanceDate().toString() : "未记录",
                nextMaintenanceDate != null ? nextMaintenanceDate.toString() : "未设置");

        return EquipmentAlert.builder()
                .factoryId(factoryId)
                .equipmentId(equipment.getId())
                .alertType("维护提醒")
                .level(level)
                .status(AlertStatus.ACTIVE)
                .message(message)
                .details(details)
                .triggeredAt(triggeredAt)
                .build();
    }

    /**
     * 创建保修告警
     */
    private EquipmentAlert createWarrantyAlert(String factoryId, FactoryEquipment equipment) {
        LocalDate warrantyExpiryDate = null;
        if (equipment.getPurchaseDate() != null) {
            warrantyExpiryDate = equipment.getPurchaseDate().plusYears(2);
        }

        LocalDateTime triggeredAt = warrantyExpiryDate != null
                ? warrantyExpiryDate.atStartOfDay()
                : LocalDateTime.now();

        long daysRemaining = 0;
        if (warrantyExpiryDate != null) {
            daysRemaining = warrantyExpiryDate.toEpochDay() - LocalDate.now().toEpochDay();
        }

        String message;
        com.cretas.aims.entity.enums.AlertLevel level;

        if (daysRemaining <= 7) {
            level = com.cretas.aims.entity.enums.AlertLevel.WARNING;
            message = String.format("保修将在 %d 天后到期", daysRemaining);
        } else {
            level = com.cretas.aims.entity.enums.AlertLevel.INFO;
            message = String.format("保修将在 %d 天后到期", daysRemaining);
        }

        String details = String.format("购买日期: %s\n保修到期: %s\n制造商: %s",
                equipment.getPurchaseDate() != null ? equipment.getPurchaseDate().toString() : "未知",
                warrantyExpiryDate != null ? warrantyExpiryDate.toString() : "未知",
                equipment.getManufacturer() != null ? equipment.getManufacturer() : "未知");

        return EquipmentAlert.builder()
                .factoryId(factoryId)
                .equipmentId(equipment.getId())
                .alertType("保修即将到期")
                .level(level)
                .status(AlertStatus.ACTIVE)
                .message(message)
                .details(details)
                .triggeredAt(triggeredAt)
                .build();
    }

    /**
     * 转换告警实体为响应DTO
     */
    private MobileDTO.AlertResponse convertToAlertResponse(EquipmentAlert alert) {
        // 获取设备名称
        String equipmentName = equipmentRepository.findById(alert.getEquipmentId())
                .map(eq -> eq.getEquipmentName())
                .orElse("未知设备");

        DateTimeFormatter formatter = DateTimeFormatter.ISO_DATE_TIME;

        return MobileDTO.AlertResponse.builder()
                .id(alert.getId())
                .factoryId(alert.getFactoryId())
                .equipmentId(alert.getEquipmentId())
                .equipmentName(equipmentName)
                .alertType(alert.getAlertType())
                .level(alert.getLevel().name())
                .status(alert.getStatus().name())
                .message(alert.getMessage())
                .details(alert.getDetails())
                .triggeredAt(alert.getTriggeredAt() != null ? alert.getTriggeredAt().format(formatter) : null)
                .acknowledgedAt(alert.getAcknowledgedAt() != null ? alert.getAcknowledgedAt().format(formatter) : null)
                .acknowledgedBy(alert.getAcknowledgedByName())
                .resolvedAt(alert.getResolvedAt() != null ? alert.getResolvedAt().format(formatter) : null)
                .resolvedBy(alert.getResolvedByName())
                .resolutionNotes(alert.getResolutionNotes())
                .build();
    }

    // ========== 工厂设置管理 ==========

    /**
     * 获取工厂设置
     */
    @Override
    public MobileDTO.FactorySettingsResponse getFactorySettings(String factoryId) {
        // 1. 查询工厂基本信息
        Factory factory = factoryRepository.findById(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂不存在: factoryId=" + factoryId));

        // 2. 查询或创建工厂设置记录
        FactorySettings settings = factorySettingsRepository.findByFactoryId(factoryId)
                .orElseGet(() -> createDefaultFactorySettings(factoryId));

        // 3. 解析工作时间设置JSON
        MobileDTO.WorkTimeSettings workTimeSettings = parseWorkTimeSettings(settings.getWorkTimeSettings());

        // 4. 构建响应
        return MobileDTO.FactorySettingsResponse.builder()
                // 基本信息（来自Factory表）
                .factoryName(factory.getName())
                .factoryAddress(factory.getAddress())
                .contactPhone(factory.getContactPhone())
                .contactEmail(factory.getContactEmail())
                // 工作时间配置（来自FactorySettings.workTimeSettings JSON）
                .workingHours(workTimeSettings.getWorkingHours())
                .lunchBreakStart(workTimeSettings.getLunchBreakStart())
                .lunchBreakEnd(workTimeSettings.getLunchBreakEnd())
                .workingDays(workTimeSettings.getWorkingDays())
                // 考勤配置（来自FactorySettings.workTimeSettings JSON）
                .lateThresholdMinutes(workTimeSettings.getLateThresholdMinutes())
                .earlyLeaveThresholdMinutes(workTimeSettings.getEarlyLeaveThresholdMinutes())
                // 功能开关（来自FactorySettings表）
                .enableOvertimeTracking(workTimeSettings.getEnableOvertimeTracking())
                .enableGPSChecking(workTimeSettings.getEnableGPSChecking())
                .build();
    }

    /**
     * 更新工厂设置
     */
    @Override
    @Transactional
    public MobileDTO.FactorySettingsResponse updateFactorySettings(
            String factoryId,
            MobileDTO.UpdateFactorySettingsRequest request,
            Integer userId) {

        // 1. 更新工厂基本信息
        Factory factory = factoryRepository.findById(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂不存在: factoryId=" + factoryId));

        if (request.getFactoryName() != null) {
            factory.setName(request.getFactoryName());
        }
        if (request.getFactoryAddress() != null) {
            factory.setAddress(request.getFactoryAddress());
        }
        if (request.getContactPhone() != null) {
            factory.setContactPhone(request.getContactPhone());
        }
        if (request.getContactEmail() != null) {
            factory.setContactEmail(request.getContactEmail());
        }
        factoryRepository.save(factory);

        // 2. 更新工厂设置
        FactorySettings settings = factorySettingsRepository.findByFactoryId(factoryId)
                .orElseGet(() -> createDefaultFactorySettings(factoryId));

        // 3. 构建工作时间设置JSON
        MobileDTO.WorkTimeSettings workTimeSettings = MobileDTO.WorkTimeSettings.builder()
                .workingHours(request.getWorkingHours() != null ? request.getWorkingHours() :
                        MobileDTO.WorkingHours.builder().startTime("08:00").endTime("17:00").build())
                .lunchBreakStart(request.getLunchBreakStart() != null ? request.getLunchBreakStart() : "12:00")
                .lunchBreakEnd(request.getLunchBreakEnd() != null ? request.getLunchBreakEnd() : "13:00")
                .workingDays(request.getWorkingDays() != null ? request.getWorkingDays() :
                        new boolean[]{true, true, true, true, true, false, false})
                .lateThresholdMinutes(request.getLateThresholdMinutes() != null ? request.getLateThresholdMinutes() : 10)
                .earlyLeaveThresholdMinutes(request.getEarlyLeaveThresholdMinutes() != null ?
                        request.getEarlyLeaveThresholdMinutes() : 10)
                .enableOvertimeTracking(request.getEnableOvertimeTracking() != null ?
                        request.getEnableOvertimeTracking() : true)
                .enableGPSChecking(request.getEnableGPSChecking() != null ? request.getEnableGPSChecking() : true)
                .build();

        // 4. 将工作时间设置序列化为JSON
        String workTimeSettingsJson = serializeWorkTimeSettings(workTimeSettings);
        settings.setWorkTimeSettings(workTimeSettingsJson);
        settings.setUpdatedBy(userId);
        factorySettingsRepository.save(settings);

        log.info("✅ 工厂设置已更新: factoryId={}, userId={}", factoryId, userId);

        // 5. 返回更新后的设置
        return getFactorySettings(factoryId);
    }

    /**
     * 创建默认工厂设置
     */
    private FactorySettings createDefaultFactorySettings(String factoryId) {
        // 默认工作时间设置
        MobileDTO.WorkTimeSettings defaultWorkTime = MobileDTO.WorkTimeSettings.builder()
                .workingHours(MobileDTO.WorkingHours.builder()
                        .startTime("08:00")
                        .endTime("17:00")
                        .build())
                .lunchBreakStart("12:00")
                .lunchBreakEnd("13:00")
                .workingDays(new boolean[]{true, true, true, true, true, false, false})
                .lateThresholdMinutes(10)
                .earlyLeaveThresholdMinutes(10)
                .enableOvertimeTracking(true)
                .enableGPSChecking(true)
                .build();

        String workTimeJson = serializeWorkTimeSettings(defaultWorkTime);

        FactorySettings settings = FactorySettings.builder()
                .factoryId(factoryId)
                .workTimeSettings(workTimeJson)
                .allowSelfRegistration(false)
                .requireAdminApproval(true)
                .defaultUserRole("viewer")
                .language("zh-CN")
                .timezone("Asia/Shanghai")
                .dateFormat("yyyy-MM-dd")
                .currency("CNY")
                .enableQrCode(true)
                .enableBatchManagement(true)
                .enableQualityCheck(true)
                .enableCostCalculation(true)
                .enableEquipmentManagement(true)
                .enableAttendance(true)
                .aiWeeklyQuota(20)
                .build();

        return factorySettingsRepository.save(settings);
    }

    /**
     * 解析工作时间设置JSON
     */
    private MobileDTO.WorkTimeSettings parseWorkTimeSettings(String json) {
        if (json == null || json.trim().isEmpty()) {
            // 返回默认值
            return MobileDTO.WorkTimeSettings.builder()
                    .workingHours(MobileDTO.WorkingHours.builder()
                            .startTime("08:00")
                            .endTime("17:00")
                            .build())
                    .lunchBreakStart("12:00")
                    .lunchBreakEnd("13:00")
                    .workingDays(new boolean[]{true, true, true, true, true, false, false})
                    .lateThresholdMinutes(10)
                    .earlyLeaveThresholdMinutes(10)
                    .enableOvertimeTracking(true)
                    .enableGPSChecking(true)
                    .build();
        }

        try {
            return objectMapper.readValue(json, MobileDTO.WorkTimeSettings.class);
        } catch (Exception e) {
            log.error("❌ 解析工作时间设置JSON失败: {}", json, e);
            throw new BusinessException("工作时间设置格式错误");
        }
    }

    /**
     * 序列化工作时间设置为JSON
     */
    private String serializeWorkTimeSettings(MobileDTO.WorkTimeSettings settings) {
        try {
            return objectMapper.writeValueAsString(settings);
        } catch (Exception e) {
            log.error("❌ 序列化工作时间设置失败", e);
            throw new BusinessException("工作时间设置序列化失败");
        }
    }

    // ========== 用户反馈管理 ==========

    /**
     * 提交用户反馈
     */
    @Override
    @Transactional
    public MobileDTO.FeedbackResponse submitFeedback(
            String factoryId,
            MobileDTO.SubmitFeedbackRequest request,
            Integer userId) {

        // 1. 验证反馈类型
        if (!request.getType().matches("bug|feature|other")) {
            throw new BusinessException("无效的反馈类型: " + request.getType());
        }

        // 2. 验证必填字段
        if (request.getTitle() == null || request.getTitle().trim().isEmpty()) {
            throw new BusinessException("反馈标题不能为空");
        }
        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            throw new BusinessException("反馈内容不能为空");
        }
        if (request.getContent().trim().length() < 10) {
            throw new BusinessException("反馈内容至少10个字符");
        }

        // 3. 序列化截图列表
        String screenshotsJson = null;
        if (request.getScreenshots() != null && !request.getScreenshots().isEmpty()) {
            try {
                screenshotsJson = objectMapper.writeValueAsString(request.getScreenshots());
            } catch (Exception e) {
                log.error("❌ 序列化截图列表失败", e);
                throw new BusinessException("截图数据格式错误");
            }
        }

        // 4. 创建反馈记录
        UserFeedback feedback = UserFeedback.builder()
                .factoryId(factoryId)
                .userId(userId)
                .type(request.getType())
                .title(request.getTitle().trim())
                .content(request.getContent().trim())
                .contact(request.getContact() != null ? request.getContact().trim() : null)
                .screenshots(screenshotsJson)
                .status("pending")
                .build();

        // 5. 保存到数据库
        UserFeedback savedFeedback = userFeedbackRepository.save(feedback);

        log.info("✅ 用户反馈提交成功: feedbackId={}, userId={}, type={}",
                savedFeedback.getId(), userId, request.getType());

        // 6. 构建响应
        return convertToFeedbackResponse(savedFeedback);
    }

    /**
     * 转换反馈实体为响应DTO
     */
    private MobileDTO.FeedbackResponse convertToFeedbackResponse(UserFeedback feedback) {
        // 解析截图JSON
        List<String> screenshots = new ArrayList<>();
        if (feedback.getScreenshots() != null && !feedback.getScreenshots().trim().isEmpty()) {
            try {
                screenshots = objectMapper.readValue(
                        feedback.getScreenshots(),
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class)
                );
            } catch (Exception e) {
                log.error("❌ 解析截图JSON失败: {}", feedback.getScreenshots(), e);
            }
        }

        DateTimeFormatter formatter = DateTimeFormatter.ISO_DATE_TIME;

        return MobileDTO.FeedbackResponse.builder()
                .feedbackId(String.valueOf(feedback.getId()))
                .type(feedback.getType())
                .title(feedback.getTitle())
                .content(feedback.getContent())
                .contact(feedback.getContact())
                .status(feedback.getStatus())
                .createdAt(feedback.getCreatedAt() != null ?
                        feedback.getCreatedAt().format(formatter) : null)
                .resolvedAt(feedback.getResolvedAt() != null ?
                        feedback.getResolvedAt().format(formatter) : null)
                .screenshots(screenshots)
                .build();
    }
}
