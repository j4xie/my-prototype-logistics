/**
 * 触觉反馈工具
 * 为用户操作提供触觉反馈，提升用户体验
 */

import * as Haptics from 'expo-haptics';

/**
 * 触觉反馈类型
 */
export enum HapticFeedbackType {
  // 轻量级反馈
  LIGHT = 'light',           // 轻触反馈（如按钮点击）
  MEDIUM = 'medium',         // 中等反馈（如选择项目）
  HEAVY = 'heavy',           // 重量级反馈（如重要操作）

  // 通知反馈
  SUCCESS = 'success',       // 成功操作
  WARNING = 'warning',       // 警告提示
  ERROR = 'error',           // 错误提示

  // 选择反馈
  SELECTION = 'selection',   // 选择变化（如滑动选择器）
}

/**
 * 触觉反馈管理器
 */
export class HapticManager {

  private static enabled = true;

  /**
   * 启用触觉反馈
   */
  static enable(): void {
    this.enabled = true;
  }

  /**
   * 禁用触觉反馈
   */
  static disable(): void {
    this.enabled = false;
  }

  /**
   * 检查是否启用
   */
  static isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 触发触觉反馈
   */
  static async trigger(type: HapticFeedbackType): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      switch (type) {
        case HapticFeedbackType.LIGHT:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;

        case HapticFeedbackType.MEDIUM:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;

        case HapticFeedbackType.HEAVY:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;

        case HapticFeedbackType.SUCCESS:
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;

        case HapticFeedbackType.WARNING:
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;

        case HapticFeedbackType.ERROR:
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;

        case HapticFeedbackType.SELECTION:
          await Haptics.selectionAsync();
          break;

        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.warn('触觉反馈失败:', error);
    }
  }

  // ==================== 便捷方法 ====================

  /**
   * 按钮点击反馈（轻量级）
   */
  static async buttonPress(): Promise<void> {
    await this.trigger(HapticFeedbackType.LIGHT);
  }

  /**
   * 确认操作反馈（中等）
   */
  static async confirm(): Promise<void> {
    await this.trigger(HapticFeedbackType.MEDIUM);
  }

  /**
   * 重要操作反馈（重量级）
   */
  static async important(): Promise<void> {
    await this.trigger(HapticFeedbackType.HEAVY);
  }

  /**
   * 成功反馈
   */
  static async success(): Promise<void> {
    await this.trigger(HapticFeedbackType.SUCCESS);
  }

  /**
   * 警告反馈
   */
  static async warning(): Promise<void> {
    await this.trigger(HapticFeedbackType.WARNING);
  }

  /**
   * 错误反馈
   */
  static async error(): Promise<void> {
    await this.trigger(HapticFeedbackType.ERROR);
  }

  /**
   * 选择反馈
   */
  static async selection(): Promise<void> {
    await this.trigger(HapticFeedbackType.SELECTION);
  }

  // ==================== 组合反馈 ====================

  /**
   * 上班打卡反馈（成功 + 重量级）
   */
  static async clockIn(): Promise<void> {
    await this.trigger(HapticFeedbackType.HEAVY);
    setTimeout(async () => {
      await this.trigger(HapticFeedbackType.SUCCESS);
    }, 100);
  }

  /**
   * 下班打卡反馈（重量级 + 成功）
   */
  static async clockOut(): Promise<void> {
    await this.trigger(HapticFeedbackType.HEAVY);
    setTimeout(async () => {
      await this.trigger(HapticFeedbackType.SUCCESS);
    }, 100);
  }

  /**
   * 数量增加反馈
   */
  static async increment(): Promise<void> {
    await this.trigger(HapticFeedbackType.LIGHT);
  }

  /**
   * 数量减少反馈
   */
  static async decrement(): Promise<void> {
    await this.trigger(HapticFeedbackType.LIGHT);
  }

  /**
   * 数据提交反馈（中等 + 成功）
   */
  static async submitData(): Promise<void> {
    await this.trigger(HapticFeedbackType.MEDIUM);
    setTimeout(async () => {
      await this.trigger(HapticFeedbackType.SUCCESS);
    }, 100);
  }

  /**
   * 设备启动反馈
   */
  static async equipmentStart(): Promise<void> {
    await this.trigger(HapticFeedbackType.HEAVY);
    setTimeout(async () => {
      await this.trigger(HapticFeedbackType.SUCCESS);
    }, 100);
  }

  /**
   * 设备停止反馈
   */
  static async equipmentStop(): Promise<void> {
    await this.trigger(HapticFeedbackType.HEAVY);
  }

  /**
   * 输入数字反馈
   */
  static async numberInput(): Promise<void> {
    await this.trigger(HapticFeedbackType.LIGHT);
  }

  /**
   * 删除输入反馈
   */
  static async deleteInput(): Promise<void> {
    await this.trigger(HapticFeedbackType.LIGHT);
  }

  /**
   * 鱼类品种选择反馈
   */
  static async selectFish(): Promise<void> {
    await this.trigger(HapticFeedbackType.SELECTION);
  }

  /**
   * 导航反馈
   */
  static async navigate(): Promise<void> {
    await this.trigger(HapticFeedbackType.LIGHT);
  }

  /**
   * 双击反馈序列
   */
  static async doubleTap(): Promise<void> {
    await this.trigger(HapticFeedbackType.LIGHT);
    setTimeout(async () => {
      await this.trigger(HapticFeedbackType.LIGHT);
    }, 100);
  }

  /**
   * 长按反馈
   */
  static async longPress(): Promise<void> {
    await this.trigger(HapticFeedbackType.MEDIUM);
  }
}

/**
 * 触觉反馈Hook（用于React组件）
 */
export const useHaptics = () => {
  return {
    enabled: HapticManager.isEnabled(),
    enable: () => HapticManager.enable(),
    disable: () => HapticManager.disable(),

    // 基础反馈
    light: () => HapticManager.buttonPress(),
    medium: () => HapticManager.confirm(),
    heavy: () => HapticManager.important(),

    // 通知反馈
    success: () => HapticManager.success(),
    warning: () => HapticManager.warning(),
    error: () => HapticManager.error(),

    // 选择反馈
    selection: () => HapticManager.selection(),

    // 业务反馈
    clockIn: () => HapticManager.clockIn(),
    clockOut: () => HapticManager.clockOut(),
    increment: () => HapticManager.increment(),
    decrement: () => HapticManager.decrement(),
    submitData: () => HapticManager.submitData(),
    equipmentStart: () => HapticManager.equipmentStart(),
    equipmentStop: () => HapticManager.equipmentStop(),
    numberInput: () => HapticManager.numberInput(),
    deleteInput: () => HapticManager.deleteInput(),
    selectFish: () => HapticManager.selectFish(),
    navigate: () => HapticManager.navigate(),
  };
};

/**
 * 默认导出
 */
export default HapticManager;
