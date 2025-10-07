import express from 'express';
import multer from 'multer';
import mobileAuthMiddleware from '../middleware/mobileAuth.js';
import processingRoutes from './processing.js';
import activationRoutes from './activation.js';
import reportsRoutes from './reports.js';
import systemRoutes from './system.js';
import timeclockRoutes from './timeclock.js';
import workTypesRoutes from './workTypes.js';
import timeStatsRoutes from './timeStats.js';
import materialRoutes from './material.js';
import productTypeRoutes from './productType.js';
import conversionRoutes from './conversion.js';
import supplierRoutes from './supplier.js';
import customerRoutes from './customer.js';
import productionPlanRoutes from './productionPlan.js';
import materialBatchRoutes from './materialBatch.js';
import factorySettingsRoutes from './factorySettings.js';
import { getEmployees } from '../controllers/userController.js';
const router = express.Router();

// 文件上传配置 (移动端优化)
const upload = multer({
  dest: 'uploads/mobile/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // 最多10个文件
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

// 统一登录接口 - 自动识别平台用户和工厂用户
router.post('/auth/unified-login', async (req, res) => {
  const { username, password, deviceInfo } = req.body;

  try {
    const { unifiedLogin } = await import('../controllers/authController.js');
    
    // 调用统一登录函数
    const loginResult = await unifiedLogin(username, password, deviceInfo);
    
    if (!loginResult.success) {
      return res.status(401).json(loginResult);
    }
    
    // 记录设备信息
    if (deviceInfo) {
      console.log('移动端登录 - 设备信息:', {
        userId: loginResult.user.id,
        userType: loginResult.user.userType,
        deviceInfo
      });
    }
    
    res.json(loginResult);
  } catch (error) {
    console.error('统一登录失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '登录服务暂时不可用' 
    });
  }
});

// 移动端登录 (支持设备信息) - 保留旧接口兼容性
router.post('/auth/mobile-login', async (req, res) => {
  const { username, password, deviceInfo } = req.body;

  try {
    // 这里需要引入实际的认证控制器
    // const { authenticateUser, recordDeviceLogin, generateMobileToken } = require('../controllers/authController');
    
    // 验证用户凭据
    // const user = await authenticateUser(username, password);
    
    // 临时模拟响应
    const mockUser = {
      id: 1,
      username: username,
      role: 'developer',
      permissions: ['admin:all'],
      avatar: null
    };
    
    if (mockUser) {
      // 记录设备信息
      console.log('设备信息记录:', {
        userId: mockUser.id,
        deviceInfo: deviceInfo
      });
      
      // 生成移动端优化的token
      const token = 'mobile_token_' + Date.now();
      
      res.json({
        success: true,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
          permissions: mockUser.permissions,
          avatar: mockUser.avatar
        },
        token,
        expiresIn: '30d'
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }
  } catch (error) {
    console.error('移动端登录失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '登录服务暂时不可用' 
    });
  }
});

// 移动端文件上传
router.post('/upload/mobile', mobileAuthMiddleware, upload.array('files'), async (req, res) => {
  try {
    const { category, metadata } = req.body;
    const files = req.files;

    const uploadResults = [];

    for (const file of files) {
      // 这里可以添加图片压缩和优化逻辑
      // const optimizedPath = await optimizeImage(file.path);
      
      // 保存文件记录 (需要实际的数据库模型)
      // const fileRecord = await FileRecord.create({...});

      uploadResults.push({
        id: Date.now() + Math.random(),
        url: `/uploads/mobile/${file.filename}`,
        originalName: file.originalname,
        size: file.size
      });
    }

    res.json({
      success: true,
      files: uploadResults,
      message: `成功上传 ${uploadResults.length} 个文件`
    });
  } catch (error) {
    console.error('移动端文件上传失败:', error);
    res.status(500).json({
      success: false,
      message: '文件上传失败'
    });
  }
});

// DeepSeek分析接口
router.post('/analysis/deepseek', mobileAuthMiddleware, async (req, res) => {
  try {
    const { data, requestId } = req.body;

    // 这里需要实际的DeepSeek服务集成
    // const analysisResult = await deepseekService.analyzeData(data);
    
    // 临时模拟分析结果
    const mockAnalysisResult = {
      analysis: '基于提供的数据，系统检测到以下问题...',
      recommendations: ['建议调整温度控制', '增加质检频率'],
      confidence: 0.85,
      cost: 0.02
    };

    // 记录分析请求 (需要实际的数据库模型)
    // await AnalysisLog.create({...});

    res.json({
      success: true,
      result: mockAnalysisResult,
      requestId
    });
  } catch (error) {
    console.error('DeepSeek分析失败:', error);
    res.status(500).json({
      success: false,
      message: '智能分析服务暂时不可用'
    });
  }
});

// 应用激活
router.post('/activation/activate', async (req, res) => {
  try {
    const { activationCode, deviceInfo } = req.body;

    // 验证激活码格式
    if (!activationCode || typeof activationCode !== 'string') {
      return res.status(400).json({
        success: false,
        message: '激活码格式无效'
      });
    }

    // 验证设备信息
    if (!deviceInfo || !deviceInfo.deviceId) {
      return res.status(400).json({
        success: false,
        message: '设备信息不完整'
      });
    }

    // 临时激活码验证逻辑
    const validCodes = ['DEV_TEST_2024', 'HEINIU_MOBILE_2024', 'PROD_ACTIVATION'];
    
    if (!validCodes.includes(activationCode)) {
      return res.status(400).json({
        success: false,
        message: '无效的激活码'
      });
    }

    // 记录激活信息
    console.log('设备激活:', {
      activationCode,
      deviceInfo,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: '应用激活成功',
      data: {
        activatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1年有效期
        features: ['basic', 'camera', 'offline']
      }
    });
  } catch (error) {
    console.error('激活失败:', error);
    res.status(500).json({
      success: false,
      message: '激活服务暂时不可用'
    });
  }
});

// 验证激活状态
router.post('/activation/validate', async (req, res) => {
  try {
    const { activationCode, deviceId } = req.body;

    // 简单验证逻辑
    const validCodes = ['DEV_TEST_2024', 'HEINIU_MOBILE_2024', 'PROD_ACTIVATION'];
    
    const isValid = validCodes.includes(activationCode) && deviceId;

    res.json({
      success: true,
      isValid,
      message: isValid ? '激活状态有效' : '激活状态无效'
    });
  } catch (error) {
    console.error('验证激活状态失败:', error);
    res.status(500).json({
      success: false,
      isValid: false,
      message: '验证服务暂时不可用'
    });
  }
});

// 发送手机验证码
router.post('/auth/send-verification', async (req, res) => {
  const { phoneNumber, verificationType } = req.body;
  
  try {
    const { sendVerificationCode } = await import('../controllers/authController.js');
    
    const result = await sendVerificationCode(phoneNumber, verificationType);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '发送验证码失败，请稍后重试' 
    });
  }
});

// 检查白名单状态
router.post('/auth/check-whitelist', async (req, res) => {
  const { phoneNumber } = req.body;
  
  try {
    const { checkWhitelistStatus } = await import('../controllers/authController.js');
    
    const result = await checkWhitelistStatus(phoneNumber);
    res.json(result);
  } catch (error) {
    console.error('检查白名单失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务暂时不可用' 
    });
  }
});

// 注册第一阶段 - 手机验证
router.post('/auth/register-phase-one', async (req, res) => {
  const { phoneNumber, verificationType } = req.body;
  
  try {
    const { mobileRegisterPhaseOne } = await import('../controllers/authController.js');
    
    const result = await mobileRegisterPhaseOne(phoneNumber, verificationType);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('注册第一阶段失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '注册服务暂时不可用' 
    });
  }
});

// 注册第二阶段 - 完整信息
router.post('/auth/register-phase-two', async (req, res) => {
  try {
    const { mobileRegisterPhaseTwo } = await import('../controllers/authController.js');
    
    const result = await mobileRegisterPhaseTwo(req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('注册第二阶段失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '注册服务暂时不可用' 
    });
  }
});

// 设备绑定
router.post('/auth/bind-device', mobileAuthMiddleware, async (req, res) => {
  const { deviceId, deviceInfo } = req.body;
  
  try {
    const { bindDevice } = await import('../controllers/authController.js');
    
    const result = await bindDevice(req.user || req.admin, deviceId, deviceInfo);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('设备绑定失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '设备绑定失败' 
    });
  }
});

// 设备登录
router.post('/auth/device-login', async (req, res) => {
  const { deviceId, deviceToken } = req.body;
  
  try {
    const { deviceLogin } = await import('../controllers/authController.js');
    
    const result = await deviceLogin(deviceId, deviceToken);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('设备登录失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '设备登录失败' 
    });
  }
});

// Token刷新接口
router.post('/auth/refresh-token', async (req, res) => {
  const { refreshToken, deviceId } = req.body;
  
  try {
    if (!refreshToken) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少refresh token' 
      });
    }

    // 导入token刷新功能
    const { refreshAuthToken } = await import('../utils/jwt.js');
    
    const newTokens = await refreshAuthToken(refreshToken);
    
    console.log('Token刷新成功:', {
      deviceId: deviceId || 'unknown',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Token刷新成功',
      tokens: {
        accessToken: newTokens.token,
        refreshToken: newTokens.refreshToken,
        expiresIn: 24 * 60 * 60 // 24小时，单位秒
      }
    });
  } catch (error) {
    console.error('Token刷新失败:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Refresh token无效或已过期' 
    });
  }
});

// 用户信息验证接口
router.get('/auth/profile', mobileAuthMiddleware, async (req, res) => {
  try {
    if (req.user) {
      // 工厂用户
      res.json({
        success: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          userType: 'factory',
          role: req.user.roleCode,
          department: req.user.department,
          permissions: req.user.permissions || [],
          factory: req.factory ? {
            id: req.factory.id,
            name: req.factory.name,
            code: req.factory.code
          } : null
        }
      });
    } else if (req.admin) {
      // 平台管理员
      res.json({
        success: true,
        user: {
          id: req.admin.adminId,
          username: req.admin.username,
          email: req.admin.email,
          userType: 'platform',
          role: 'platform_admin',
          permissions: ['admin:all']
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: '未找到用户信息'
      });
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

// 设备列表查询接口
router.get('/auth/devices', mobileAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.admin?.adminId;
    const userType = req.user ? 'factory' : 'platform';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    // 由于当前设备信息存储在内存/日志中，这里提供模拟数据
    // 基于当前登录的设备信息构建响应
    const devices = [
      {
        id: `device_${userId}_1`,
        deviceName: 'Android设备',
        deviceModel: req.deviceInfo?.deviceModel || 'Unknown Android',
        platform: 'android',
        isActive: true,
        lastLoginAt: new Date().toISOString(),
        bindingDate: new Date().toISOString()
      }
    ];

    // 如果有额外的设备信息，可以从这里扩展
    console.log('获取设备列表:', {
      userId,
      userType,
      deviceCount: devices.length
    });

    res.json({
      success: true,
      data: {
        devices,
        total: devices.length
      }
    });
  } catch (error) {
    console.error('获取设备列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备列表失败'
    });
  }
});

// 移动端登出接口
// 注意：移动端登出主要依赖客户端清除token，服务器端仅记录登出事件
// 因为unifiedLogin不创建session，所以这里简化处理
router.post('/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证token'
      });
    }

    // 尝试验证token并提取用户信息（仅用于日志记录）
    try {
      const { verifyToken } = await import('../utils/jwt.js');
      const decoded = verifyToken(token);

      console.log('📱 移动端登出:', {
        userId: decoded.userId,
        userType: decoded.type,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Token验证失败也允许登出（可能已过期）
      console.log('⚠️ Token已失效的登出请求');
    }

    // 移动端登出成功响应
    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('移动端登出失败:', error);
    res.status(500).json({
      success: false,
      message: '登出失败，请重试'
    });
  }
});

// 批量权限检查接口
router.post('/permissions/batch-check', mobileAuthMiddleware, async (req, res) => {
  try {
    const { permissionChecks } = req.body;
    
    if (!permissionChecks || !Array.isArray(permissionChecks)) {
      return res.status(400).json({
        success: false,
        message: '无效的权限检查请求'
      });
    }

    // 导入权限检查函数
    const { calculateUserPermissions, hasPermission } = await import('../config/permissions.js');
    
    const userId = req.user?.id || req.admin?.adminId;
    const userType = req.user ? 'factory_user' : 'platform_admin';
    const userRole = req.user?.roleCode || req.admin?.role || 'platform_admin';
    const department = req.user?.department;

    // 计算用户权限
    const userPermissions = calculateUserPermissions(userType, userRole, department);
    
    // 批量检查权限
    const results = [];
    
    for (const check of permissionChecks) {
      const { type, values, operator = 'OR' } = check;
      let hasAccess = false;
      let reason = '';
      
      if (type === 'permission') {
        if (operator === 'AND') {
          // 所有权限都必须有
          hasAccess = values.every(permission => hasPermission(userPermissions, permission));
          reason = hasAccess ? '所有权限验证通过' : '缺少必要权限';
        } else {
          // 至少有一个权限
          hasAccess = values.some(permission => hasPermission(userPermissions, permission));
          reason = hasAccess ? '部分权限验证通过' : '无任何匹配权限';
        }
      } else if (type === 'role') {
        hasAccess = values.includes(userRole);
        reason = hasAccess ? '角色匹配' : '角色不匹配';
      } else if (type === 'level') {
        const minLevel = check.minimum || 0;
        const userLevel = userPermissions.level || 99;
        hasAccess = userLevel <= minLevel; // 数字越小权限越高
        reason = hasAccess ? '权限级别满足' : '权限级别不足';
      }
      
      results.push({
        type,
        values,
        operator,
        hasAccess,
        reason
      });
    }
    
    const overallAccess = results.every(r => r.hasAccess);
    
    console.log('批量权限检查:', {
      userId,
      userType,
      userRole,
      checkCount: permissionChecks.length,
      overallAccess
    });

    res.json({
      success: true,
      data: {
        userId,
        userType,
        userRole,
        hasAccess: overallAccess,
        results,
        userPermissions: userPermissions.permissions,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('批量权限检查失败:', error);
    res.status(500).json({
      success: false,
      message: '权限检查失败'
    });
  }
});

// Phase 2 - 加工模块路由
router.use('/processing', processingRoutes);

// Phase 3 - 激活管理路由
router.use('/activation', activationRoutes);

// Phase 3 - 报表生成路由
router.use('/reports', reportsRoutes);

// Phase 3 - 系统监控路由
router.use('/system', systemRoutes);

// 员工打卡时间追踪路由
router.use('/timeclock', timeclockRoutes);

// 工作类型管理路由
router.use('/work-types', workTypesRoutes);

// 时间统计路由
router.use('/time-stats', timeStatsRoutes);

// 原料类型管理路由
router.use('/materials', mobileAuthMiddleware, materialRoutes);

// 🆕 生产计划管理系统路由
router.use('/products', mobileAuthMiddleware, productTypeRoutes);           // 产品类型管理
router.use('/conversions', mobileAuthMiddleware, conversionRoutes);         // 转换率管理
router.use('/suppliers', mobileAuthMiddleware, supplierRoutes);             // 供应商管理
router.use('/customers', mobileAuthMiddleware, customerRoutes);             // 客户管理
router.use('/material-batches', mobileAuthMiddleware, materialBatchRoutes); // 原材料批次管理
router.use('/production-plans', mobileAuthMiddleware, productionPlanRoutes); // 生产计划管理

// 工厂设置路由（含AI设置管理）
router.use('/factory-settings', factorySettingsRoutes);

// 员工列表路由
router.get('/employees', mobileAuthMiddleware, getEmployees);

// 移动端健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '移动端API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

export default router;