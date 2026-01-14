/**
 * 海康威视设备密码生成和验证工具
 *
 * 海康威视官方密码规则：
 * - 长度：8-16 位
 * - 字符：至少两种类型组合（数字、小写字母、大写字母、特殊字符）
 * - 不能包含用户名（admin）
 */

/**
 * 生成符合海康威视密码规则的随机密码
 * @returns 8位随机密码，包含大写字母、小写字母和数字
 */
export function generateHikvisionPassword(): string {
  // 去掉易混淆字符：I, O, l, 0, 1
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';

  let password = '';

  // 确保至少包含3种字符类型（满足"至少两种"的要求）
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];

  // 填充到8位
  const all = upper + lower + digits;
  for (let i = 0; i < 5; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // 打乱顺序，避免固定模式
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * 验证密码是否符合海康规则
 * @param password 待验证的密码
 * @returns 验证结果
 */
export function validateHikvisionPassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (password.length < 8 || password.length > 16) {
    return { valid: false, error: '密码长度必须为8-16位' };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);

  const typeCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  if (typeCount < 2) {
    return {
      valid: false,
      error: '密码必须包含大写字母、小写字母、数字、特殊字符中的至少两种',
    };
  }

  if (password.toLowerCase().includes('admin')) {
    return { valid: false, error: '密码不能包含用户名 admin' };
  }

  return { valid: true };
}

/**
 * 获取密码强度等级
 * @param password 密码
 * @returns 强度等级：weak, medium, strong
 */
export function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);

  const typeCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

  if (password.length >= 12 && typeCount >= 3) {
    return 'strong';
  } else if (password.length >= 8 && typeCount >= 2) {
    return 'medium';
  }
  return 'weak';
}
