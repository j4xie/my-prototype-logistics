import express from 'express';
import multer from 'multer';
import mobileAuthMiddleware from '../middleware/mobileAuth.js';
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

// 移动端健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '移动端API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

export default router;