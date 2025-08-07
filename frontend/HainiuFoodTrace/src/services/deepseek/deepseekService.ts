/**
 * DeepSeek LLM 分析服务
 * Mock 实现 - 模拟DeepSeek API调用和响应
 */

export interface DeepSeekAnalysisRequest {
  // 分析类型
  analysisType: 'quality_control' | 'production_optimization' | 'safety_check' | 'equipment_diagnosis' | 'general_query';
  
  // 输入数据
  data: {
    // 文本描述
    description?: string;
    
    // 数值数据
    metrics?: Record<string, number>;
    
    // 图片数据（Base64编码）
    images?: string[];
    
    // 历史数据
    historicalData?: any[];
    
    // 上下文信息
    context?: {
      factoryId?: string;
      department?: string;
      equipmentId?: string;
      timestamp?: string;
    };
  };
  
  // 分析选项
  options?: {
    detailLevel: 'basic' | 'detailed' | 'comprehensive';
    includeRecommendations: boolean;
    includeRiskAssessment: boolean;
    language: 'zh' | 'en';
  };
}

export interface DeepSeekAnalysisResponse {
  success: boolean;
  analysisId: string;
  timestamp: string;
  analysisType: string;
  
  // 分析结果
  result: {
    // 主要分析结论
    summary: string;
    
    // 详细分析
    analysis: {
      findings: string[];
      insights: string[];
      trends?: string[];
    };
    
    // 风险评估
    riskAssessment?: {
      level: 'low' | 'medium' | 'high' | 'critical';
      factors: string[];
      recommendations: string[];
    };
    
    // 建议措施
    recommendations?: {
      immediate: string[];
      shortTerm: string[];
      longTerm: string[];
    };
    
    // 数值评分
    scores?: {
      quality: number;
      safety: number;
      efficiency: number;
      overall: number;
    };
  };
  
  // 置信度
  confidence: number;
  
  // 成本信息
  cost?: {
    tokens: number;
    estimatedCost: number; // 人民币分
  };
  
  // 错误信息
  error?: string;
}

// Mock 数据库 - 存储历史分析
const MOCK_ANALYSIS_HISTORY: DeepSeekAnalysisResponse[] = [];

// Mock 响应模板
const MOCK_RESPONSES = {
  quality_control: {
    summary: "基于提供的数据，产品质量总体符合标准，但在某些指标上存在改进空间。",
    findings: [
      "产品外观质量良好，符合行业标准",
      "检测到微量杂质，但在可接受范围内",
      "包装密封性良好，未发现泄漏风险",
      "温度控制记录显示全程保持在最适范围"
    ],
    insights: [
      "当前批次质量稳定性高于平均水平12%",
      "相比上月，缺陷率下降了0.3%",
      "建议优化第三道工序的参数设置"
    ]
  },
  production_optimization: {
    summary: "生产效率分析显示存在明显的优化空间，建议调整关键工艺参数。",
    findings: [
      "生产线整体效率为82%，略低于目标值85%",
      "瓶颈主要出现在包装环节",
      "设备利用率不均，部分设备存在闲置",
      "人员配置基本合理，但存在技能不匹配"
    ],
    insights: [
      "包装速度提升15%可使整体效率达到目标",
      "设备B2的故障率比平均水平高出30%",
      "员工培训投入ROI预计为1:4.2"
    ]
  },
  safety_check: {
    summary: "安全检查总体良好，发现2个中等风险点需要关注。",
    findings: [
      "防护设备配置完整，使用率达98%",
      "危险品存储区域标识清晰",
      "应急预案执行记录完善",
      "发现部分电气线路老化现象"
    ],
    insights: [
      "近期安全事故率下降了25%",
      "电气安全隐患需在30天内处理",
      "建议加强新员工安全培训"
    ]
  },
  equipment_diagnosis: {
    summary: "设备运行状态分析完成，发现1个需要维护的设备和2个预警信号。",
    findings: [
      "设备A1运行参数正常，效率稳定",
      "设备B2振动数据异常，建议检修",
      "温控系统响应延迟增加",
      "润滑系统油位略低于标准值"
    ],
    insights: [
      "设备B2预计在15-20天内需要停机维护",
      "预防性维护可避免潜在的30%产能损失",
      "建议升级温控系统的传感器"
    ]
  },
  general_query: {
    summary: "基于您的查询，我提供以下分析和建议。",
    findings: [
      "数据分析显示与查询相关的关键指标",
      "历史趋势表明存在可优化的环节",
      "当前状态整体稳定，但有改进空间"
    ],
    insights: [
      "建议关注核心指标的变化趋势",
      "可考虑采用更精确的监控方法",
      "定期回顾和调整策略将有助于持续改进"
    ]
  }
};

export class DeepSeekService {
  private static readonly API_BASE_URL = 'https://api.deepseek.com'; // Mock URL
  private static readonly COST_PER_1K_TOKENS = 0.14; // 人民币分
  
  /**
   * 提交分析请求
   */
  static async submitAnalysis(request: DeepSeekAnalysisRequest): Promise<DeepSeekAnalysisResponse> {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
      
      // 生成分析ID
      const analysisId = `ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 获取对应的Mock响应模板
      const template = MOCK_RESPONSES[request.analysisType] || MOCK_RESPONSES.general_query;
      
      // 生成动态内容
      const dynamicContent = this.generateDynamicContent(request);
      
      // 模拟成本计算
      const estimatedTokens = this.estimateTokenUsage(request);
      const cost = {
        tokens: estimatedTokens,
        estimatedCost: Math.round(estimatedTokens / 1000 * this.COST_PER_1K_TOKENS)
      };
      
      // 构建响应
      const response: DeepSeekAnalysisResponse = {
        success: true,
        analysisId,
        timestamp: new Date().toISOString(),
        analysisType: request.analysisType,
        result: {
          summary: this.personalizeContent(template.summary, request),
          analysis: {
            findings: template.findings.map(f => this.personalizeContent(f, request)),
            insights: template.insights.map(i => this.personalizeContent(i, request)),
            trends: dynamicContent.trends
          },
          riskAssessment: this.generateRiskAssessment(request),
          recommendations: this.generateRecommendations(request),
          scores: this.generateScores(request)
        },
        confidence: 0.85 + Math.random() * 0.1, // 85-95%
        cost
      };
      
      // 保存到历史记录
      MOCK_ANALYSIS_HISTORY.push(response);
      
      console.log('🤖 DeepSeek 分析完成:', {
        id: analysisId,
        type: request.analysisType,
        cost: cost.estimatedCost,
        confidence: response.confidence
      });
      
      return response;
      
    } catch (error) {
      console.error('DeepSeek 分析失败:', error);
      return {
        success: false,
        analysisId: '',
        timestamp: new Date().toISOString(),
        analysisType: request.analysisType,
        result: {
          summary: '',
          analysis: { findings: [], insights: [] }
        },
        confidence: 0,
        error: '分析服务暂时不可用，请稍后重试'
      };
    }
  }
  
  /**
   * 获取分析历史
   */
  static async getAnalysisHistory(limit: number = 20): Promise<DeepSeekAnalysisResponse[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return MOCK_ANALYSIS_HISTORY
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
  
  /**
   * 获取单个分析结果
   */
  static async getAnalysisById(analysisId: string): Promise<DeepSeekAnalysisResponse | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return MOCK_ANALYSIS_HISTORY.find(analysis => analysis.analysisId === analysisId) || null;
  }
  
  /**
   * 获取成本统计
   */
  static async getCostStatistics(days: number = 30): Promise<{
    totalCost: number;
    totalTokens: number;
    analysisCount: number;
    averageCost: number;
    dailyAverage: number;
  }> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentAnalyses = MOCK_ANALYSIS_HISTORY.filter(
      analysis => new Date(analysis.timestamp) >= cutoffDate && analysis.cost
    );
    
    const totalCost = recentAnalyses.reduce((sum, analysis) => sum + (analysis.cost?.estimatedCost || 0), 0);
    const totalTokens = recentAnalyses.reduce((sum, analysis) => sum + (analysis.cost?.tokens || 0), 0);
    
    return {
      totalCost,
      totalTokens,
      analysisCount: recentAnalyses.length,
      averageCost: recentAnalyses.length > 0 ? totalCost / recentAnalyses.length : 0,
      dailyAverage: totalCost / days
    };
  }
  
  /**
   * 生成动态内容
   */
  private static generateDynamicContent(request: DeepSeekAnalysisRequest): { trends: string[] } {
    const trends = [];
    
    if (request.data.metrics) {
      const metrics = Object.entries(request.data.metrics);
      if (metrics.length > 0) {
        const trend = Math.random() > 0.5 ? '上升' : '下降';
        const percentage = (Math.random() * 20 + 5).toFixed(1);
        trends.push(`核心指标较上期${trend}${percentage}%`);
      }
    }
    
    if (request.data.historicalData && request.data.historicalData.length > 0) {
      trends.push('历史数据显示周期性波动模式');
      trends.push('长期趋势保持稳定向好');
    }
    
    return { trends };
  }
  
  /**
   * 个性化内容
   */
  private static personalizeContent(content: string, request: DeepSeekAnalysisRequest): string {
    let personalized = content;
    
    if (request.data.context?.department) {
      personalized = personalized.replace(/部门/g, request.data.context.department);
    }
    
    if (request.data.context?.equipmentId) {
      personalized = personalized.replace(/设备/g, request.data.context.equipmentId);
    }
    
    return personalized;
  }
  
  /**
   * 生成风险评估
   */
  private static generateRiskAssessment(request: DeepSeekAnalysisRequest) {
    const riskLevels: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'low', 'medium', 'high'];
    const randomLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)];
    
    const factors = {
      low: ['操作规范', '数据稳定'],
      medium: ['轻微波动', '需要关注'],
      high: ['异常指标', '潜在风险'],
      critical: ['严重偏差', '紧急处理']
    };
    
    const recommendations = {
      low: ['继续监控', '保持现状'],
      medium: ['加强监控', '预防措施'],
      high: ['立即检查', '制定改进计划'],
      critical: ['紧急停机', '立即整改']
    };
    
    return {
      level: randomLevel,
      factors: factors[randomLevel],
      recommendations: recommendations[randomLevel]
    };
  }
  
  /**
   * 生成建议措施
   */
  private static generateRecommendations(request: DeepSeekAnalysisRequest) {
    const immediate = ['检查关键参数', '确认安全状态'];
    const shortTerm = ['优化工艺流程', '培训操作人员'];
    const longTerm = ['升级设备系统', '建立监控机制'];
    
    return { immediate, shortTerm, longTerm };
  }
  
  /**
   * 生成评分
   */
  private static generateScores(request: DeepSeekAnalysisRequest) {
    return {
      quality: Math.round(70 + Math.random() * 25),
      safety: Math.round(75 + Math.random() * 20),
      efficiency: Math.round(65 + Math.random() * 30),
      overall: Math.round(70 + Math.random() * 25)
    };
  }
  
  /**
   * 估算token使用量
   */
  private static estimateTokenUsage(request: DeepSeekAnalysisRequest): number {
    let tokens = 100; // 基础tokens
    
    if (request.data.description) {
      tokens += request.data.description.length / 2;
    }
    
    if (request.data.metrics) {
      tokens += Object.keys(request.data.metrics).length * 10;
    }
    
    if (request.data.images) {
      tokens += request.data.images.length * 200; // 图片处理
    }
    
    if (request.data.historicalData) {
      tokens += request.data.historicalData.length * 20;
    }
    
    // 根据详细级别调整
    const multiplier = {
      basic: 1,
      detailed: 1.5,
      comprehensive: 2.2
    };
    
    tokens *= multiplier[request.options?.detailLevel || 'basic'];
    
    return Math.round(tokens);
  }
}