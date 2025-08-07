import jwt from 'jsonwebtoken';

const mobileAuthMiddleware = (req, res, next) => {
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
      
      // 设置临时用户信息
      req.user = {
        id: 1,
        username: 'mobile_user',
        platform: 'mobile'
      };
      
      return next();
    }

    // 对于JWT token的验证逻辑
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    // 检查token是否为移动端token
    if (decoded.platform !== 'mobile') {
      return res.status(401).json({
        success: false,
        message: '无效的移动端token'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'token无效或已过期'
    });
  }
};

export default mobileAuthMiddleware;