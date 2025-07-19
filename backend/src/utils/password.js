import bcrypt from 'bcrypt';

// 密码加密的盐值轮数
const SALT_ROUNDS = 12;

/**
 * 密码强度验证规则
 * 至少8位，包含大小写字母、数字
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * 验证密码强度
 * @param {string} password - 密码
 * @returns {Object} 验证结果
 */
export const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('密码至少需要8个字符');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母');
  }
  
  if (!/\d/.test(password)) {
    errors.push('密码必须包含至少一个数字');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 哈希密码
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 哈希后的密码
 */
export const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error('密码加密失败');
  }
};

/**
 * 验证密码
 * @param {string} plainPassword - 明文密码
 * @param {string} hashedPassword - 哈希后的密码
 * @returns {Promise<boolean>} 验证结果
 */
export const verifyPassword = async (plainPassword, hashedPassword) => {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    throw new Error('密码验证失败');
  }
};

/**
 * 生成随机密码
 * @param {number} length - 密码长度
 * @returns {string} 随机密码
 */
export const generateRandomPassword = (length = 12) => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // 确保至少包含一个大写字母、小写字母、数字
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  
  // 填充剩余长度
  for (let i = 3; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // 打乱密码顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * 生成重置密码的安全码
 * @returns {string} 6位数字安全码
 */
export const generateSecurityCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};