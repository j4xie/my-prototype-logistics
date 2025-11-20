/**
 * 统一的错误提示文案配置
 *
 * 使用场景：
 * 1. 用户友好的错误提示
 * 2. 统一错误信息的措辞
 * 3. 支持国际化扩展
 */

/**
 * 网络错误提示
 */
export const NETWORK_ERRORS = {
  CONNECTION_FAILED: '网络连接失败，请检查网络设置后重试',
  TIMEOUT: '请求超时，请稍后重试',
  NO_INTERNET: '无法连接到网络，请检查您的网络连接',
  SERVER_UNREACHABLE: '无法连接到服务器，请稍后重试',
} as const;

/**
 * 认证错误提示
 */
export const AUTH_ERRORS = {
  LOGIN_EXPIRED: '登录已过期，请重新登录',
  INVALID_CREDENTIALS: '用户名或密码错误',
  PERMISSION_DENIED: '您没有权限执行此操作',
  ACCOUNT_DISABLED: '账号已被禁用，请联系管理员',
  TOKEN_INVALID: '登录凭证无效，请重新登录',
} as const;

/**
 * API错误提示
 */
export const API_ERRORS = {
  NOT_FOUND: '请求的资源不存在',
  SERVER_ERROR: '服务器繁忙，请稍后重试',
  VALIDATION_ERROR: '输入数据有误，请检查后重试',
  RATE_LIMIT: '操作过于频繁，请稍后再试',
  UNKNOWN: '操作失败，请稍后重试',
} as const;

/**
 * 数据操作错误提示
 */
export const DATA_ERRORS = {
  LOAD_FAILED: '数据加载失败，请重试',
  SAVE_FAILED: '保存失败，请重试',
  DELETE_FAILED: '删除失败，请重试',
  UPDATE_FAILED: '更新失败，请重试',
  EXPORT_FAILED: '导出失败，请重试',
  IMPORT_FAILED: '导入失败，请重试',
  NO_DATA: '暂无数据',
  DATA_CORRUPTED: '数据格式错误，请联系技术支持',
} as const;

/**
 * 表单验证错误提示
 */
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: '此字段为必填项',
  INVALID_EMAIL: '邮箱格式不正确',
  INVALID_PHONE: '手机号格式不正确',
  PASSWORD_TOO_SHORT: '密码长度至少8位',
  PASSWORD_MISMATCH: '两次输入的密码不一致',
  INVALID_DATE: '日期格式不正确',
  INVALID_NUMBER: '请输入有效的数字',
  VALUE_TOO_LARGE: '输入值过大',
  VALUE_TOO_SMALL: '输入值过小',
} as const;

/**
 * 文件操作错误提示
 */
export const FILE_ERRORS = {
  UPLOAD_FAILED: '文件上传失败，请重试',
  FILE_TOO_LARGE: '文件大小超过限制',
  INVALID_FILE_TYPE: '不支持的文件类型',
  NO_FILE_SELECTED: '请选择文件',
  READ_FAILED: '文件读取失败',
} as const;

/**
 * 功能未实现提示
 */
export const FEATURE_ERRORS = {
  NOT_IMPLEMENTED: '此功能尚未实现，敬请期待',
  COMING_SOON: '功能即将上线，敬请期待',
  UNDER_MAINTENANCE: '功能维护中，请稍后再试',
} as const;

/**
 * GPS/定位错误提示
 */
export const LOCATION_ERRORS = {
  PERMISSION_DENIED: 'GPS权限未授权，请在设置中开启位置权限',
  POSITION_UNAVAILABLE: '无法获取位置信息，请检查GPS设置',
  TIMEOUT: 'GPS定位超时，请确保GPS已开启',
  DISABLED: '设备GPS功能未开启',
} as const;

/**
 * 相机错误提示
 */
export const CAMERA_ERRORS = {
  PERMISSION_DENIED: '相机权限未授权，请在设置中开启相机权限',
  NOT_AVAILABLE: '相机不可用',
  CAPTURE_FAILED: '拍照失败，请重试',
} as const;

/**
 * 生物识别错误提示
 */
export const BIOMETRIC_ERRORS = {
  NOT_ENROLLED: '未设置生物识别，请在系统设置中添加指纹或面容',
  NOT_AVAILABLE: '设备不支持生物识别',
  FAILED: '生物识别验证失败',
  CANCELLED: '已取消生物识别验证',
} as const;

/**
 * 通用操作提示
 */
export const GENERAL_MESSAGES = {
  SUCCESS: '操作成功',
  LOADING: '加载中...',
  SAVING: '保存中...',
  DELETING: '删除中...',
  PROCESSING: '处理中...',
  PLEASE_WAIT: '请稍候...',
  RETRY: '重试',
  CANCEL: '取消',
  CONFIRM: '确认',
} as const;

/**
 * 根据错误类型获取用户友好的错误提示
 */
export function getErrorMessage(errorType: string, defaultMessage?: string): string {
  // 查找所有错误配置
  const allErrors = {
    ...NETWORK_ERRORS,
    ...AUTH_ERRORS,
    ...API_ERRORS,
    ...DATA_ERRORS,
    ...VALIDATION_ERRORS,
    ...FILE_ERRORS,
    ...FEATURE_ERRORS,
    ...LOCATION_ERRORS,
    ...CAMERA_ERRORS,
    ...BIOMETRIC_ERRORS,
  };

  // 尝试匹配错误类型
  const message = allErrors[errorType as keyof typeof allErrors];

  return message || defaultMessage || API_ERRORS.UNKNOWN;
}
