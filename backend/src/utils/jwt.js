import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * 生成JWT令牌
 * @param {Object} payload - 要编码的数据
 * @param {string} expiresIn - 过期时间
 * @returns {string} JWT令牌
 */
export const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * 验证JWT令牌
 * @param {string} token - JWT令牌
 * @returns {Object} 解码后的payload
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

/**
 * 为工厂用户生成认证令牌
 * @param {Object} user - 用户对象
 * @returns {Object} 包含token和refreshToken的对象
 */
export const generateAuthTokens = async (user) => {
  const payload = {
    userId: user.id,
    factoryId: user.factoryId,
    username: user.username,
    email: user.email,
    roleCode: user.roleCode,
    roleLevel: user.roleLevel,
    department: user.department,
    permissions: user.permissions || [],
    type: 'factory_user' // 用户类型标识
  };

  const token = generateToken(payload);
  const refreshToken = generateToken(
    { userId: user.id, factoryId: user.factoryId, type: 'factory_user' },
    REFRESH_TOKEN_EXPIRES_IN
  );

  // 删除用户的所有现有session
  await prisma.session.deleteMany({
    where: {
      userId: user.id,
      factoryId: user.factoryId
    }
  });

  // 将新session存储到数据库
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
  await prisma.session.create({
    data: {
      userId: user.id,
      factoryId: user.factoryId,
      token,
      refreshToken,
      expiresAt,
    },
  });

  return { token, refreshToken };
};

/**
 * 为平台管理员生成认证令牌
 * @param {Object} admin - 平台管理员对象
 * @returns {Object} 包含token和refreshToken的对象
 */
export const generatePlatformAuthTokens = (admin) => {
  const payload = {
    adminId: admin.id,
    username: admin.username,
    email: admin.email,
    type: 'platform_admin' // 平台管理员类型标识
  };

  const token = generateToken(payload);
  const refreshToken = generateToken(
    { adminId: admin.id, type: 'platform_admin' },
    REFRESH_TOKEN_EXPIRES_IN
  );

  return { token, refreshToken };
};

/**
 * 撤销用户的所有令牌
 * @param {number} userId - 用户ID
 * @param {string} factoryId - 工厂ID
 */
export const revokeUserTokens = async (userId, factoryId) => {
  await prisma.session.updateMany({
    where: {
      userId,
      factoryId,
    },
    data: {
      isRevoked: true,
    },
  });
};

/**
 * 验证会话是否有效
 * @param {string} token - JWT令牌
 * @returns {Object|null} 会话对象或null
 */
export const validateSession = async (token) => {
  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            factory: true
          }
        }
      },
    });

    if (!session || session.isRevoked || new Date() > session.expiresAt) {
      return null;
    }

    return session;
  } catch (error) {
    return null;
  }
};

/**
 * 刷新令牌
 * @param {string} refreshToken - 刷新令牌
 * @returns {Object} 新的令牌对象
 */
export const refreshAuthToken = async (refreshToken) => {
  try {
    const payload = verifyToken(refreshToken);
    
    if (payload.type === 'factory_user') {
      const session = await prisma.session.findUnique({
        where: { refreshToken },
        include: {
          user: {
            include: {
              factory: true
            }
          }
        },
      });

      if (!session || session.isRevoked) {
        throw new Error('Invalid refresh token');
      }

      // 生成新的令牌
      const newTokens = await generateAuthTokens(session.user);
      
      // 撤销旧的session
      await prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });

      return newTokens;
    } else if (payload.type === 'platform_admin') {
      const admin = await prisma.platformAdmin.findUnique({
        where: { id: payload.adminId },
      });

      if (!admin) {
        throw new Error('Invalid refresh token');
      }

      return generatePlatformAuthTokens(admin);
    }

    throw new Error('Invalid token type');
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

/**
 * 生成临时令牌（用于手机验证等）
 * @param {string} type - 令牌类型
 * @param {string} factoryId - 工厂ID
 * @param {string} phoneNumber - 手机号
 * @param {Object} data - 附加数据
 * @param {number} expiresInMinutes - 过期时间（分钟）
 * @returns {string} 临时令牌
 */
export const generateTempToken = async (type, factoryId, phoneNumber = null, data = null, expiresInMinutes = 30) => {
  const token = jwt.sign(
    { type, factoryId, phoneNumber, data, timestamp: Date.now() },
    JWT_SECRET,
    { expiresIn: `${expiresInMinutes}m` }
  );

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await prisma.tempToken.create({
    data: {
      token,
      type,
      factoryId,
      phoneNumber,
      data,
      expiresAt,
    },
  });

  return token;
};

/**
 * 验证并使用临时令牌
 * @param {string} token - 临时令牌
 * @param {string} type - 期望的令牌类型
 * @returns {Object} 令牌数据
 */
export const verifyAndUseTempToken = async (token, type) => {
  try {
    const payload = verifyToken(token);
    
    if (payload.type !== type) {
      throw new Error('Invalid token type');
    }

    const tempToken = await prisma.tempToken.findUnique({
      where: { token },
    });

    if (!tempToken || tempToken.isUsed || new Date() > tempToken.expiresAt) {
      throw new Error('Invalid or expired token');
    }

    // 标记令牌为已使用
    await prisma.tempToken.update({
      where: { id: tempToken.id },
      data: { isUsed: true },
    });

    return {
      factoryId: tempToken.factoryId,
      phoneNumber: tempToken.phoneNumber,
      data: tempToken.data,
    };
  } catch (error) {
    throw new Error('Invalid temp token');
  }
};