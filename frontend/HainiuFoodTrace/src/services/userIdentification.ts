import { UserRole, User, PLATFORM_ROLES, FACTORY_ROLES } from '../types/auth';

export interface UserIdentificationResult {
  userType: 'platform' | 'factory';
  suggestedRoles: UserRole[];
  confidence: number;
  reasoning: string[];
  priority: number; // 1 = platform (highest), 2 = factory
}

export interface LoginPriorityConfig {
  platformUserPriority: 1;
  factoryUserPriority: 2;
  smartNavigation: {
    developer: '/home/selector';
    platform_admin: '/platform';
    factory_users: '/home/selector';
  };
}

export class UserIdentificationService {
  // 登录优先级配置 (平台用户优先级1，工厂用户优先级2)
  private static readonly LOGIN_PRIORITY_CONFIG: LoginPriorityConfig = {
    platformUserPriority: 1,
    factoryUserPriority: 2,
    smartNavigation: {
      developer: '/home/selector',
      platform_admin: '/platform',
      factory_users: '/home/selector'
    }
  };

  /**
   * 智能用户识别 - 基于用户名模式识别用户类型和角色
   */
  static identifyUser(username: string): UserIdentificationResult {
    const patterns = {
      platform: {
        // 系统开发者模式
        developer: [
          /^(dev|developer|system)[-_]?/i,
          /^admin[-_]?(dev|developer)/i,
          /[-_](dev|developer)$/i,
        ],
        
        // 平台超级管理员模式
        platformSuperAdmin: [
          /^(platform|admin|super)[-_]?admin/i,
          /^admin[-_]?(platform|super)/i,
          /^(platform|system)[-_]?super/i,
          /@(platform|admin)\./i,
        ],
        
        // 平台操作员模式
        platformOperator: [
          /^(platform|admin)[-_]?(operator|op)/i,
          /^(operator|op)[-_]?(platform|admin)/i,
          /operator.*platform/i,
        ],
        
        // 通用平台用户模式
        generic: [
          /^(admin|platform|system)/i,
          /@.*\.(platform|admin|system)\./i,
          /\.(platform|admin|system)@/i,
        ]
      },
      
      factory: {
        // 工厂超级管理员模式
        factoryAdmin: [
          /^(factory|plant|company)[-_]?admin/i,
          /^admin[-_]?(factory|plant|company)/i,
          /^(super|chief)[-_]?(manager|admin)/i,
          /manager.*factory/i,
        ],
        
        // 权限管理员模式
        permissionAdmin: [
          /^(permission|perm|auth)[-_]?(admin|manager)/i,
          /^(admin|manager)[-_]?(permission|perm|auth)/i,
          /permission.*admin/i,
        ],
        
        // 部门管理员模式
        departmentAdmin: [
          /^(dept|department)[-_]?(admin|manager|head)/i,
          /^(admin|manager|head)[-_]?(dept|department)/i,
          /^(farming|processing|logistics|quality)[-_]?(admin|manager)/i,
        ],
        
        // 操作员模式
        operator: [
          /^(operator|op|worker|staff|employee)/i,
          /^(user|member)[-_]?\d+/i,
          /\d+[-_]?(user|member|staff)/i,
        ],
        
        // 查看者模式
        viewer: [
          /^(viewer|view|guest|read)/i,
          /readonly/i,
          /guest[-_]?user/i,
        ],
        
        // 通用工厂用户模式
        generic: [
          /^(user|staff|employee|worker)/i,
          /@.*\.(company|corp|factory|plant)\./i,
          /\.(company|corp|factory|plant)@/i,
        ]
      }
    };

    let bestMatch: UserIdentificationResult = {
      userType: 'factory',
      suggestedRoles: [FACTORY_ROLES.OPERATOR],
      confidence: 0.1,
      reasoning: ['默认识别为工厂操作员'],
      priority: this.LOGIN_PRIORITY_CONFIG.factoryUserPriority
    };

    // 检查平台用户模式
    const platformMatches = this.checkPatterns(username, patterns.platform);
    if (platformMatches.maxConfidence > bestMatch.confidence) {
      bestMatch = {
        userType: 'platform',
        suggestedRoles: platformMatches.roles,
        confidence: platformMatches.maxConfidence,
        reasoning: platformMatches.reasoning,
        priority: this.LOGIN_PRIORITY_CONFIG.platformUserPriority
      };
    }

    // 检查工厂用户模式
    const factoryMatches = this.checkPatterns(username, patterns.factory);
    if (factoryMatches.maxConfidence > bestMatch.confidence) {
      bestMatch = {
        userType: 'factory',
        suggestedRoles: factoryMatches.roles,
        confidence: factoryMatches.maxConfidence,
        reasoning: factoryMatches.reasoning,
        priority: this.LOGIN_PRIORITY_CONFIG.factoryUserPriority
      };
    }

    // 特殊处理：邮箱格式分析
    if (username.includes('@')) {
      const emailAnalysis = this.analyzeEmailDomain(username);
      if (emailAnalysis.confidence > bestMatch.confidence * 0.8) {
        bestMatch.userType = emailAnalysis.userType;
        bestMatch.confidence = Math.max(bestMatch.confidence, emailAnalysis.confidence);
        bestMatch.reasoning.push(...emailAnalysis.reasoning);
        bestMatch.priority = emailAnalysis.userType === 'platform' 
          ? this.LOGIN_PRIORITY_CONFIG.platformUserPriority 
          : this.LOGIN_PRIORITY_CONFIG.factoryUserPriority;
      }
    }

    // 数字模式分析
    const numberAnalysis = this.analyzeNumberPatterns(username);
    if (numberAnalysis.confidence > 0) {
      bestMatch.reasoning.push(...numberAnalysis.reasoning);
    }

    return bestMatch;
  }

  /**
   * 检查用户名模式
   */
  private static checkPatterns(
    username: string, 
    patternGroups: { [key: string]: RegExp[] }
  ): {
    maxConfidence: number;
    roles: UserRole[];
    reasoning: string[];
  } {
    let maxConfidence = 0;
    let matchedRoles: UserRole[] = [];
    let reasoning: string[] = [];

    for (const [category, patterns] of Object.entries(patternGroups)) {
      for (const pattern of patterns) {
        if (pattern.test(username)) {
          const confidence = this.calculatePatternConfidence(pattern, username, category);
          
          if (confidence > maxConfidence) {
            maxConfidence = confidence;
            matchedRoles = this.getRolesByCategory(category);
            reasoning = [`用户名匹配${category}模式: ${pattern.toString()}`];
          }
        }
      }
    }

    return {
      maxConfidence,
      roles: matchedRoles,
      reasoning
    };
  }

  /**
   * 分析邮箱域名
   */
  private static analyzeEmailDomain(email: string): {
    userType: 'platform' | 'factory';
    confidence: number;
    reasoning: string[];
  } {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      return {
        userType: 'factory',
        confidence: 0.1,
        reasoning: ['无效邮箱格式']
      };
    }

    // 平台域名模式
    const platformDomains = [
      'platform.com', 'admin.com', 'system.com',
      'management.com', 'headquarters.com', 'hq.com'
    ];

    // 企业域名模式
    const enterpriseDomains = [
      'company.com', 'corp.com', 'factory.com', 'plant.com',
      'manufacturing.com', 'food.com', 'trace.com'
    ];

    // 公共邮箱域名 (通常是平台用户)
    const publicDomains = [
      'gmail.com', 'outlook.com', 'hotmail.com', 'qq.com',
      '163.com', '126.com', 'yahoo.com'
    ];

    if (platformDomains.includes(domain)) {
      return {
        userType: 'platform',
        confidence: 0.9,
        reasoning: [`邮箱域名${domain}表明为平台用户`]
      };
    }

    if (publicDomains.includes(domain)) {
      return {
        userType: 'platform',
        confidence: 0.7,
        reasoning: [`公共邮箱域名${domain}，可能为平台管理员`]
      };
    }

    if (enterpriseDomains.some(ed => domain.includes(ed))) {
      return {
        userType: 'factory',
        confidence: 0.8,
        reasoning: [`企业邮箱域名${domain}表明为工厂用户`]
      };
    }

    // 自定义域名通常是企业用户
    return {
      userType: 'factory',
      confidence: 0.6,
      reasoning: [`自定义域名${domain}，推测为企业用户`]
    };
  }

  /**
   * 分析数字模式
   */
  private static analyzeNumberPatterns(username: string): {
    confidence: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let confidence = 0;

    // 连续数字分析
    const numberMatches = username.match(/\d+/g);
    if (numberMatches) {
      const maxNumber = Math.max(...numberMatches.map(n => parseInt(n, 10)));
      
      if (maxNumber > 1000) {
        reasoning.push('包含大数字，可能为员工编号');
        confidence += 0.1;
      } else if (maxNumber > 100) {
        reasoning.push('包含中等数字，可能为部门编号');
        confidence += 0.05;
      } else if (maxNumber <= 10) {
        reasoning.push('包含小数字，可能为管理员序号');
        confidence += 0.15;
      }
    }

    // 日期模式分析
    const datePattern = /\d{2,4}[-_]?\d{1,2}[-_]?\d{1,2}/;
    if (datePattern.test(username)) {
      reasoning.push('包含日期模式');
      confidence += 0.05;
    }

    return { confidence, reasoning };
  }

  /**
   * 计算模式匹配的置信度
   */
  private static calculatePatternConfidence(
    pattern: RegExp, 
    username: string, 
    category: string
  ): number {
    let confidence = 0.5; // 基础置信度

    // 根据类别调整置信度
    const categoryWeights = {
      developer: 0.95,
      platformSuperAdmin: 0.9,
      platformOperator: 0.85,
      factoryAdmin: 0.8,
      permissionAdmin: 0.75,
      departmentAdmin: 0.7,
      operator: 0.6,
      viewer: 0.55,
      generic: 0.3
    };

    confidence = categoryWeights[category as keyof typeof categoryWeights] || 0.5;

    // 完全匹配加分
    const match = pattern.exec(username);
    if (match && match[0].length === username.length) {
      confidence += 0.2;
    }

    // 开头匹配加分
    if (pattern.test(username) && username.toLowerCase().startsWith(match?.[0]?.toLowerCase() || '')) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 根据类别获取推荐角色
   */
  private static getRolesByCategory(category: string): UserRole[] {
    const roleMapping: { [key: string]: UserRole[] } = {
      developer: [PLATFORM_ROLES.SYSTEM_DEVELOPER],
      platformSuperAdmin: [PLATFORM_ROLES.PLATFORM_SUPER_ADMIN, PLATFORM_ROLES.PLATFORM_OPERATOR],
      platformOperator: [PLATFORM_ROLES.PLATFORM_OPERATOR],
      factoryAdmin: [FACTORY_ROLES.FACTORY_SUPER_ADMIN, FACTORY_ROLES.PERMISSION_ADMIN],
      permissionAdmin: [FACTORY_ROLES.PERMISSION_ADMIN, FACTORY_ROLES.DEPARTMENT_ADMIN],
      departmentAdmin: [FACTORY_ROLES.DEPARTMENT_ADMIN, FACTORY_ROLES.OPERATOR],
      operator: [FACTORY_ROLES.OPERATOR, FACTORY_ROLES.VIEWER],
      viewer: [FACTORY_ROLES.VIEWER],
      generic: [FACTORY_ROLES.OPERATOR] // 默认为操作员
    };

    return roleMapping[category] || [FACTORY_ROLES.OPERATOR];
  }

  /**
   * 获取智能导航路径
   */
  static getSmartNavigationPath(user: User): string {
    const role = this.getUserRole(user);
    
    if (user.userType === 'platform') {
      if (role === PLATFORM_ROLES.SYSTEM_DEVELOPER) {
        return this.LOGIN_PRIORITY_CONFIG.smartNavigation.developer;
      }
      return this.LOGIN_PRIORITY_CONFIG.smartNavigation.platform_admin;
    } else {
      return this.LOGIN_PRIORITY_CONFIG.smartNavigation.factory_users;
    }
  }

  /**
   * 获取用户角色
   */
  private static getUserRole(user: User): UserRole {
    if (user.userType === 'platform') {
      return (user as any).platformUser?.role || PLATFORM_ROLES.PLATFORM_OPERATOR;
    } else {
      return (user as any).factoryUser?.role || FACTORY_ROLES.OPERATOR;
    }
  }

  /**
   * 验证用户识别结果
   */
  static validateIdentification(
    predicted: UserIdentificationResult,
    actual: { userType: 'platform' | 'factory'; role: UserRole }
  ): {
    isCorrect: boolean;
    accuracy: number;
    feedback: string;
  } {
    const userTypeCorrect = predicted.userType === actual.userType;
    const roleCorrect = predicted.suggestedRoles.includes(actual.role);
    
    let accuracy = 0;
    if (userTypeCorrect) accuracy += 0.6;
    if (roleCorrect) accuracy += 0.4;
    
    let feedback = '';
    if (userTypeCorrect && roleCorrect) {
      feedback = '识别完全正确';
    } else if (userTypeCorrect) {
      feedback = '用户类型正确，但角色预测有误';
    } else {
      feedback = '用户类型识别错误';
    }

    return {
      isCorrect: userTypeCorrect && roleCorrect,
      accuracy,
      feedback
    };
  }

  /**
   * 获取用户类型显示名称
   */
  static getUserTypeDisplayName(userType: 'platform' | 'factory'): string {
    return userType === 'platform' ? '平台用户' : '工厂用户';
  }

  /**
   * 获取登录优先级配置
   */
  static getLoginPriorityConfig(): LoginPriorityConfig {
    return this.LOGIN_PRIORITY_CONFIG;
  }

  /**
   * 基于优先级排序用户
   */
  static sortUsersByPriority(users: Array<{ username: string; [key: string]: any }>): Array<{ username: string; identification: UserIdentificationResult; [key: string]: any }> {
    return users
      .map(user => ({
        ...user,
        identification: this.identifyUser(user.username)
      }))
      .sort((a, b) => {
        // 首先按优先级排序 (数字小的优先级高)
        if (a.identification.priority !== b.identification.priority) {
          return a.identification.priority - b.identification.priority;
        }
        
        // 然后按置信度排序
        return b.identification.confidence - a.identification.confidence;
      });
  }

  /**
   * 生成识别报告
   */
  static generateIdentificationReport(username: string): {
    result: UserIdentificationResult;
    analysis: {
      patterns: string[];
      emailAnalysis: string[];
      numberAnalysis: string[];
      confidence: {
        level: 'high' | 'medium' | 'low';
        description: string;
      };
    };
  } {
    const result = this.identifyUser(username);
    
    const confidenceLevel = result.confidence >= 0.8 ? 'high' 
      : result.confidence >= 0.5 ? 'medium' : 'low';
    
    const confidenceDescriptions = {
      high: '高置信度 - 模式匹配明确，识别结果可靠',
      medium: '中等置信度 - 有一定模式匹配，但需要进一步确认',
      low: '低置信度 - 模式匹配较弱，建议手动确认用户类型'
    };

    return {
      result,
      analysis: {
        patterns: result.reasoning.filter(r => r.includes('模式')),
        emailAnalysis: result.reasoning.filter(r => r.includes('邮箱') || r.includes('域名')),
        numberAnalysis: result.reasoning.filter(r => r.includes('数字') || r.includes('编号')),
        confidence: {
          level: confidenceLevel,
          description: confidenceDescriptions[confidenceLevel]
        }
      }
    };
  }
}