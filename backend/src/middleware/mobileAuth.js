import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mobileAuthMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: '未提供认证token' 
    });
  }

  try {
    // 对于临时的mobile token，先进行简单验证
    if (token.startsWith('mobile_token_')) {
      // 临时验证逻辑
      const tokenTime = parseInt(token.replace('mobile_token_', ''));
      const currentTime = Date.now();
      const tokenAge = currentTime - tokenTime;
      
      // Token有效期30天
      if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
        return res.status(401).json({
          success: false,
          message: 'token已过期'
        });
      }
      
      // 获取一个可用的工厂ID用于临时测试
      const availableFactory = await prisma.factory.findFirst({
        where: { isActive: true },
        select: { id: true }
      });
      
      // 设置临时用户信息（统一格式）
      req.user = {
        id: 1,
        username: 'mobile_user',
        userType: 'mobile',
        factoryId: availableFactory?.id || null,
        permissions: ['basic_access']
      };
      
      return next();
    }

    // 对于真实JWT token的验证逻辑
    const { verifyToken, validateSession } = await import('../utils/jwt.js');
    
    const decoded = verifyToken(token);
    
    // 验证session是否有效（对于工厂用户）
    if (decoded.type === 'factory_user') {
      const session = await validateSession(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'token已失效，请重新登录'
        });
      }
      
      // 统一用户上下文格式
      req.user = {
        id: session.user.id,
        username: session.user.username,
        userType: 'factory',
        factoryId: session.user.factoryId,
        roleCode: session.user.roleCode,
        department: session.user.department,
        permissions: session.user.permissions || []
      };
      req.factory = session.user.factory;
      
    } else if (decoded.type === 'platform_admin') {
      // 获取可用的工厂ID供平台管理员测试使用
      const availableFactory = await prisma.factory.findFirst({
        where: { isActive: true },
        select: { id: true }
      });
      
      // 统一用户上下文格式（平台管理员）
      req.user = {
        id: decoded.adminId,
        username: decoded.username,
        email: decoded.email,
        userType: 'platform',
        factoryId: availableFactory?.id || null, // 给平台管理员分配一个工厂用于测试
        permissions: ['platform_access', 'cross_factory_access']
      };
      
      // 保留原有的req.admin以兼容现有代码
      req.admin = decoded;
      
    } else {
      return res.status(401).json({
        success: false,
        message: '无效的token类型'
      });
    }

    next();
  } catch (error) {
    console.error('Token验证失败:', error);
    return res.status(401).json({
      success: false,
      message: 'token无效或已过期'
    });
  }
};

export default mobileAuthMiddleware;