/**
 * 预览模式管理工具
 * 
 * 提供预览模式的检测、启用、禁用等功能
 * 通过sessionStorage管理预览状态
 */

export const PREVIEW_MODE_KEY = 'preview_mode_enabled';
export const PREVIEW_USER_KEY = 'preview_user_data';

/**
 * 预览模式状态接口
 */
export interface PreviewModeState {
  enabled: boolean;
  entryTime: number;
  fromUrl?: string;
}

/**
 * 虚拟预览用户数据
 */
export interface PreviewUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: {
    id: string;
    name: string;
    description: string;
    level: number;
  };
  permissions: {
    modules: {
      farming_access: boolean;
      processing_access: boolean;
      logistics_access: boolean;
      admin_access: boolean;
      platform_access: boolean;
    };
    features: string[];
    role: string;
    roleLevel: number;
  };
  legacyPermissions: Array<{
    id: string;
    name: string;
    resource: string;
    action: string;
  }>;
  createdAt: string;
  lastLoginAt: string;
}

/**
 * 预览模式管理类
 */
export class PreviewModeManager {
  /**
   * 检查是否处于预览模式
   */
  static isPreviewMode(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const state = sessionStorage.getItem(PREVIEW_MODE_KEY);
      if (!state) return false;
      
      const previewState: PreviewModeState = JSON.parse(state);
      return previewState.enabled;
    } catch (error) {
      console.warn('[PreviewMode] 检查预览模式状态失败:', error);
      return false;
    }
  }

  /**
   * 启用预览模式
   */
  static enablePreviewMode(fromUrl?: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const state: PreviewModeState = {
        enabled: true,
        entryTime: Date.now(),
        fromUrl
      };
      
      sessionStorage.setItem(PREVIEW_MODE_KEY, JSON.stringify(state));
      console.log('[PreviewMode] 预览模式已启用', { fromUrl });
    } catch (error) {
      console.error('[PreviewMode] 启用预览模式失败:', error);
    }
  }

  /**
   * 禁用预览模式
   */
  static disablePreviewMode(): void {
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.removeItem(PREVIEW_MODE_KEY);
      sessionStorage.removeItem(PREVIEW_USER_KEY);
      console.log('[PreviewMode] 预览模式已禁用');
    } catch (error) {
      console.error('[PreviewMode] 禁用预览模式失败:', error);
    }
  }

  /**
   * 获取预览模式状态
   */
  static getPreviewState(): PreviewModeState | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const state = sessionStorage.getItem(PREVIEW_MODE_KEY);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.warn('[PreviewMode] 获取预览状态失败:', error);
      return null;
    }
  }

  /**
   * 创建虚拟预览用户
   */
  static createPreviewUser(): PreviewUser {
    const previewUser: PreviewUser = {
      id: 'preview_user_' + Date.now(),
      username: 'preview_admin',
      displayName: '预览模式管理员',
      email: 'preview@demo.com',
      role: {
        id: 'preview_admin',
        name: '预览模式管理员',
        description: '拥有所有权限的演示账户',
        level: 0
      },
      permissions: {
        modules: {
          farming_access: true,
          processing_access: true,
          logistics_access: true,
          admin_access: true,
          platform_access: true
        },
        features: [
          'user_manage_all',
          'whitelist_manage_all', 
          'stats_view_all'
        ],
        role: 'PREVIEW_ADMIN',
        roleLevel: 0
      },
      legacyPermissions: [
        { id: '0', name: '平台管理', resource: 'platform', action: 'manage' },
        { id: '1', name: '农业管理', resource: 'farming', action: 'manage' },
        { id: '2', name: '生产管理', resource: 'processing', action: 'manage' },
        { id: '3', name: '物流管理', resource: 'logistics', action: 'manage' },
        { id: '4', name: '系统管理', resource: 'admin', action: 'manage' },
        { id: '5', name: '溯源查询', resource: 'trace', action: 'read' }
      ],
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    return previewUser;
  }

  /**
   * 获取预览用户数据
   */
  static getPreviewUser(): PreviewUser | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const userData = sessionStorage.getItem(PREVIEW_USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.warn('[PreviewMode] 获取预览用户数据失败:', error);
      return null;
    }
  }

  /**
   * 设置预览用户数据
   */
  static setPreviewUser(user: PreviewUser): void {
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.setItem(PREVIEW_USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('[PreviewMode] 设置预览用户数据失败:', error);
    }
  }

  /**
   * 检查是否从preview页面跳转而来
   */
  static isFromPreviewPage(): boolean {
    if (typeof window === 'undefined') return false;
    
    return document.referrer.includes('/preview');
  }

  /**
   * 获取预览模式的过期时间 (8小时)
   */
  static getExpiryTime(): number {
    return 8 * 60 * 60 * 1000; // 8小时
  }

  /**
   * 检查预览模式是否过期
   */
  static isExpired(): boolean {
    const state = this.getPreviewState();
    if (!state) return true;
    
    const expiryTime = this.getExpiryTime();
    return Date.now() - state.entryTime > expiryTime;
  }

  /**
   * 清理过期的预览模式
   */
  static cleanupExpired(): void {
    if (this.isExpired()) {
      this.disablePreviewMode();
    }
  }
}

/**
 * 预览模式Hook
 */
export function usePreviewMode() {
  const isPreviewMode = PreviewModeManager.isPreviewMode();
  const previewUser = PreviewModeManager.getPreviewUser();
  const previewState = PreviewModeManager.getPreviewState();

  return {
    isPreviewMode,
    previewUser,
    previewState,
    enablePreviewMode: PreviewModeManager.enablePreviewMode,
    disablePreviewMode: PreviewModeManager.disablePreviewMode,
    createPreviewUser: PreviewModeManager.createPreviewUser,
    isFromPreviewPage: PreviewModeManager.isFromPreviewPage
  };
}