// AI服务接口类型定义
export interface AIConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  timeout?: number;
}

export interface PredictionRequest {
  type: 'cost' | 'quality' | 'yield' | 'risk';
  data: Record<string, any>;
  timeRange?: {
    start: string;
    end: string;
  };
}

export interface PredictionResponse {
  prediction: number | string;
  confidence: number;
  factors: Array<{
    name: string;
    impact: number;
    description: string;
  }>;
  recommendations: string[];
  metadata: {
    modelVersion: string;
    timestamp: string;
    dataPoints: number;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ChatResponse {
  message: string;
  suggestions?: string[];
  references?: Array<{
    title: string;
    url: string;
    excerpt: string;
  }>;
}

class AIService {
  private config: AIConfig;
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5分钟缓存

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(type: string, data: any): string {
    return `${type}_${JSON.stringify(data)}`;
  }

  /**
   * 检查缓存
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * 发送HTTP请求
   */
  private async request<T>(
    endpoint: string,
    data: any,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.config.endpoint}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...options.headers,
      },
      body: JSON.stringify({
        model: this.config.model,
        ...data,
      }),
      signal: AbortSignal.timeout(this.config.timeout || 30000),
      ...options,
    });

    if (!response.ok) {
      throw new Error(
        `AI API 请求失败: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * 业务预测分析
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const cacheKey = this.getCacheKey('prediction', request);
    const cached = this.getFromCache<PredictionResponse>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await this.request<PredictionResponse>('/predict', {
        type: request.type,
        data: request.data,
        timeRange: request.timeRange,
      });

      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('预测分析失败:', error);
      throw new Error(
        `预测分析失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 智能对话
   */
  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    try {
      const response = await this.request<ChatResponse>('/chat', {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        max_tokens: 1000,
      });

      return response;
    } catch (error) {
      console.error('智能对话失败:', error);
      throw new Error(
        `智能对话失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 文档智能解析
   */
  async analyzeDocument(file: File): Promise<{
    summary: string;
    keywords: string[];
    entities: Array<{
      name: string;
      type: string;
      confidence: number;
    }>;
    insights: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.config.endpoint}/analyze-document`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`文档分析失败: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('文档分析失败:', error);
      throw new Error(
        `文档分析失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 智能推荐
   */
  async getRecommendations(context: {
    userProfile: Record<string, any>;
    currentData: Record<string, any>;
    preferences?: string[];
  }): Promise<
    Array<{
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      actionType: 'warning' | 'suggestion' | 'opportunity';
      expectedImpact: string;
    }>
  > {
    const cacheKey = this.getCacheKey('recommendations', context);
    const cached = this.getFromCache<any>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await this.request<any>('/recommendations', context);
      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('获取推荐失败:', error);
      throw new Error(
        `获取推荐失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 风险评估
   */
  async assessRisk(data: {
    farmData?: Record<string, any>;
    weatherData?: Record<string, any>;
    marketData?: Record<string, any>;
    historicalData?: Record<string, any>;
  }): Promise<{
    overallRisk: number; // 0-100
    riskFactors: Array<{
      category: string;
      level: number;
      description: string;
      mitigation: string[];
    }>;
    recommendations: string[];
  }> {
    try {
      const response = await this.request<any>('/assess-risk', data);
      return response;
    } catch (error) {
      console.error('风险评估失败:', error);
      throw new Error(
        `风险评估失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 清理过期缓存
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<AIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 创建全局AI服务实例
let aiService: AIService;

export const initAIService = (config: AIConfig): AIService => {
  aiService = new AIService(config);

  // 定期清理缓存
  setInterval(() => {
    aiService.clearExpiredCache();
  }, 60000); // 每分钟清理一次

  return aiService;
};

export const getAIService = (): AIService => {
  if (!aiService) {
    throw new Error('AI服务未初始化，请先调用 initAIService()');
  }
  return aiService;
};

export default AIService;
