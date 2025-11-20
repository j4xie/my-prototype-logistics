/**
 * 功能未实现错误类
 * 当调用尚未实现的功能时抛出此错误
 *
 * 使用场景：
 * 1. 功能计划实现但当前未完成
 * 2. 替代返回假数据或mock数据的模式
 * 3. 生产代码中的TODO应该抛出此错误
 *
 * @example
 * ```typescript
 * throw new NotImplementedError(
 *   '生物识别登录',
 *   'Phase 4',
 *   '生物识别登录功能尚未实现，敬请期待',
 *   { trackingIssue: '#123', priority: 'P1' }
 * );
 * ```
 */
export class NotImplementedError extends Error {
  public readonly featureName: string;
  public readonly plannedVersion?: string;
  public readonly metadata?: Record<string, any>;

  constructor(
    featureName: string,
    plannedVersion?: string,
    customMessage?: string,
    metadata?: Record<string, any>
  ) {
    const message = customMessage ||
      `功能 "${featureName}" 尚未实现${plannedVersion ? `，计划在 ${plannedVersion} 版本中发布` : ''}。`;

    super(message);
    this.name = 'NotImplementedError';
    this.featureName = featureName;
    this.plannedVersion = plannedVersion;
    this.metadata = metadata;

    // 维护正确的原型链
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }

  /**
   * 获取用户友好的错误提示
   */
  getUserMessage(): string {
    const baseMessage = this.message;
    const issueInfo = this.metadata?.trackingIssue
      ? `\n\n追踪编号：${this.metadata.trackingIssue}`
      : '';
    return `${baseMessage}${issueInfo}`;
  }

  /**
   * 获取开发者调试信息
   */
  getDebugInfo(): string {
    return JSON.stringify(
      {
        name: this.name,
        featureName: this.featureName,
        plannedVersion: this.plannedVersion,
        message: this.message,
        metadata: this.metadata,
        stack: this.stack,
      },
      null,
      2
    );
  }
}
