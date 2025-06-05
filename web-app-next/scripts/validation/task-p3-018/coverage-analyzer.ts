#!/usr/bin/env tsx

/**
 * Mock API覆盖率分析器 & 迁移规划工具
 *
 * 基于Day 1-3验证成果，进行精确的覆盖率统计：
 * 1. 整合Day 1 Schema基线、Day 2 Mock数据清查、Day 3 一致性验证结果
 * 2. 计算真实的Mock API覆盖率，替代之前混乱的百分比数据
 * 3. 制定中央Mock服务迁移的详细计划
 * 4. 识别高风险数据迁移点和优先级排序
 * 5. 生成TASK-P3-018B的技术基线和实施建议
 *
 * @author Phase-3技术团队
 * @date 2025-06-03
 * @version 1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as yaml from 'js-yaml';

// 覆盖率分析结果接口
interface CoverageAnalysisResult {
  summary: {
    totalApiEndpoints: number;
    mockedEndpoints: number;
    unmockedEndpoints: number;
    realCoverageRate: number; // 真实覆盖率
    consistentMockEndpoints: number;
    inconsistentMockEndpoints: number;
    qualityCoverageRate: number; // 高质量覆盖率
  };
  detailedBreakdown: {
    byModule: ModuleCoverage[];
    byEndpoint: EndpointCoverage[];
    byDataSource: DataSourceCoverage[];
  };
  migrationPlan: MigrationPlan;
  recommendations: string[];
  riskAssessment: RiskAssessment;
  timestamp: string;
}

// 模块覆盖情况
interface ModuleCoverage {
  module: string;
  totalEndpoints: number;
  mockedEndpoints: number;
  coverageRate: number;
  quality: 'high' | 'medium' | 'low';
  endpoints: string[];
}

// 端点覆盖情况
interface EndpointCoverage {
  endpoint: string;
  method: string;
  isMocked: boolean;
  isConsistent: boolean;
  mockSources: string[];
  dataSize: number;
  lastModified: string;
  migrationPriority: 'high' | 'medium' | 'low';
  migrationComplexity: 'simple' | 'moderate' | 'complex';
}

// 数据源覆盖情况
interface DataSourceCoverage {
  sourceType: 'api_route' | 'test_script' | 'component' | 'json_file';
  fileCount: number;
  mockCount: number;
  totalSize: number;
  averageQuality: number;
  migrationStrategy: string;
}

// 迁移计划
interface MigrationPlan {
  phases: MigrationPhase[];
  timeline: string;
  resources: string[];
  dependencies: string[];
  successCriteria: string[];
}

// 迁移阶段
interface MigrationPhase {
  phase: string;
  description: string;
  tasks: string[];
  duration: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  dependencies: string[];
}

// 风险评估
interface RiskAssessment {
  highRiskItems: RiskItem[];
  mediumRiskItems: RiskItem[];
  lowRiskItems: RiskItem[];
  overallRiskLevel: 'high' | 'medium' | 'low';
  mitigationStrategies: string[];
}

// 风险项目
interface RiskItem {
  item: string;
  description: string;
  impact: string;
  probability: string;
  mitigation: string;
}

class MockApiCoverageAnalyzer {
  private projectRoot: string;
  private openApiSchema: any;
  private mockDataSources: any[] = [];
  private consistencyResults: any[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    console.log(`📊 Mock API覆盖率分析器启动 - 项目根目录: ${this.projectRoot}`);
  }

  /**
   * 运行完整的覆盖率分析
   */
  public async analyze(): Promise<CoverageAnalysisResult> {
    console.log('📊 开始Mock API覆盖率分析与迁移规划...\n');

    try {
      // 加载基础数据
      await this.loadBaselineData();
      await this.loadMockDataSources();
      await this.loadConsistencyResults();

      // 执行分析
      const summary = await this.calculateCoverageSummary();
      const detailedBreakdown = await this.analyzeDetailedBreakdown();
      const migrationPlan = await this.createMigrationPlan();
      const riskAssessment = await this.assessMigrationRisks();
      const recommendations = await this.generateRecommendations();

      const result: CoverageAnalysisResult = {
        summary,
        detailedBreakdown,
        migrationPlan,
        recommendations,
        riskAssessment,
        timestamp: new Date().toISOString()
      };

      // 显示分析结果
      console.log(`\n📊 覆盖率分析结果汇总:`);
      console.log(`🎯 真实覆盖率: ${summary.realCoverageRate.toFixed(1)}% (${summary.mockedEndpoints}/${summary.totalApiEndpoints})`);
      console.log(`💎 高质量覆盖率: ${summary.qualityCoverageRate.toFixed(1)}% (一致性Mock)`);
      console.log(`📈 模块覆盖: ${detailedBreakdown.byModule.length} 个模块分析完成`);
      console.log(`🎯 端点覆盖: ${detailedBreakdown.byEndpoint.length} 个端点详细分析`);
      console.log(`📦 数据源: ${detailedBreakdown.byDataSource.length} 种数据源类型统计`);

      return result;
    } catch (error) {
      console.error(`❌ 覆盖率分析失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 加载基线数据 (Day 1 Schema)
   */
  private async loadBaselineData(): Promise<void> {
    try {
      const schemaPath = path.resolve(this.projectRoot, 'docs/api/openapi.yaml');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      this.openApiSchema = yaml.load(schemaContent) as any;

      const totalEndpoints = Object.keys(this.openApiSchema.paths || {}).length;
      console.log(`✅ 基线Schema加载: ${totalEndpoints} 个API端点定义`);
    } catch (error) {
      throw new Error(`❌ 加载基线Schema失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 加载Mock数据源 (Day 2 扫描结果)
   */
  private async loadMockDataSources(): Promise<void> {
    try {
      const scanReportPath = path.resolve(
        this.projectRoot,
        'web-app-next/scripts/validation/task-p3-018/reports/mock-data-scan-report.json'
      );

      if (fs.existsSync(scanReportPath)) {
        const scanReport = JSON.parse(fs.readFileSync(scanReportPath, 'utf8'));
        this.mockDataSources = scanReport.sources || [];

        console.log(`✅ Mock数据源加载: ${this.mockDataSources.length} 个数据源文件`);
      } else {
        console.log(`⚠️ 未找到Mock数据扫描报告，将重新扫描...`);
        await this.scanMockDataSources();
      }
    } catch (error) {
      console.error(`⚠️ 加载Mock数据源失败，将重新扫描: ${error instanceof Error ? error.message : String(error)}`);
      await this.scanMockDataSources();
    }
  }

  /**
   * 重新扫描Mock数据源
   */
  private async scanMockDataSources(): Promise<void> {
    const mockApiFiles = await glob('web-app-next/src/app/api/**/route.ts', {
      cwd: this.projectRoot
    });

    this.mockDataSources = mockApiFiles.map(filePath => ({
      filePath,
      sourceType: 'api_route',
      mockCount: 1,
      size: this.getFileSize(filePath),
      lastModified: this.getFileModifiedTime(filePath)
    }));

    console.log(`✅ 重新扫描完成: ${this.mockDataSources.length} 个Mock API文件`);
  }

  /**
   * 加载一致性验证结果 (Day 3 验证结果)
   */
  private async loadConsistencyResults(): Promise<void> {
    try {
      const consistencyReportPath = path.resolve(
        this.projectRoot,
        'web-app-next/scripts/validation/task-p3-018/reports/consistency-validation-report.json'
      );

      if (fs.existsSync(consistencyReportPath)) {
        const consistencyReport = JSON.parse(fs.readFileSync(consistencyReportPath, 'utf8'));
        this.consistencyResults = consistencyReport.results || [];

        console.log(`✅ 一致性结果加载: ${this.consistencyResults.length} 个端点验证结果`);
      } else {
        console.log(`⚠️ 未找到一致性验证报告，将假设所有端点一致`);
        this.consistencyResults = [];
      }
    } catch (error) {
      console.error(`⚠️ 加载一致性验证结果失败: ${error instanceof Error ? error.message : String(error)}`);
      this.consistencyResults = [];
    }
  }

  /**
   * 计算覆盖率摘要
   */
  private async calculateCoverageSummary(): Promise<CoverageAnalysisResult['summary']> {
    const totalApiEndpoints = Object.keys(this.openApiSchema.paths || {}).length;

    // 正确计算已Mock的端点数量
    let mockedEndpoints = 0;
    Object.keys(this.openApiSchema.paths || {}).forEach(endpoint => {
      if (this.isMocked(endpoint)) {
        mockedEndpoints++;
      }
    });

    const unmockedEndpoints = totalApiEndpoints - mockedEndpoints;
    const realCoverageRate = totalApiEndpoints > 0 ? (mockedEndpoints / totalApiEndpoints) * 100 : 0;

    const consistentMockEndpoints = this.consistencyResults.filter(result => result.isConsistent).length;
    const inconsistentMockEndpoints = this.consistencyResults.length - consistentMockEndpoints;
    const qualityCoverageRate = totalApiEndpoints > 0 ? (consistentMockEndpoints / totalApiEndpoints) * 100 : 0;

    return {
      totalApiEndpoints,
      mockedEndpoints,
      unmockedEndpoints,
      realCoverageRate,
      consistentMockEndpoints,
      inconsistentMockEndpoints,
      qualityCoverageRate
    };
  }

  /**
   * 分析详细分解情况
   */
  private async analyzeDetailedBreakdown(): Promise<CoverageAnalysisResult['detailedBreakdown']> {
    const byModule = await this.analyzeByModule();
    const byEndpoint = await this.analyzeByEndpoint();
    const byDataSource = await this.analyzeByDataSource();

    return {
      byModule,
      byEndpoint,
      byDataSource
    };
  }

  /**
   * 按模块分析覆盖率
   */
  private async analyzeByModule(): Promise<ModuleCoverage[]> {
    const modules = new Map<string, string[]>();

    // 从OpenAPI Schema中提取模块信息
    Object.keys(this.openApiSchema.paths || {}).forEach(endpoint => {
      const module = this.extractModuleFromEndpoint(endpoint);
      if (!modules.has(module)) {
        modules.set(module, []);
      }
      modules.get(module)!.push(endpoint);
    });

    const moduleCoverage: ModuleCoverage[] = [];

    for (const [module, endpoints] of modules) {
      const totalEndpoints = endpoints.length;
      const mockedEndpoints = endpoints.filter(endpoint =>
        this.isMocked(endpoint)
      ).length;

      const coverageRate = totalEndpoints > 0 ? (mockedEndpoints / totalEndpoints) * 100 : 0;
      const quality = this.calculateModuleQuality(endpoints);

      moduleCoverage.push({
        module,
        totalEndpoints,
        mockedEndpoints,
        coverageRate,
        quality,
        endpoints
      });
    }

    return moduleCoverage.sort((a, b) => b.coverageRate - a.coverageRate);
  }

  /**
   * 按端点分析覆盖率
   */
  private async analyzeByEndpoint(): Promise<EndpointCoverage[]> {
    const endpointCoverage: EndpointCoverage[] = [];

    Object.entries(this.openApiSchema.paths || {}).forEach(([endpoint, definition]: [string, any]) => {
      const methods = Object.keys(definition).filter(key =>
        ['get', 'post', 'put', 'delete', 'patch'].includes(key.toLowerCase())
      );

      methods.forEach(method => {
        const isMocked = this.isMocked(endpoint);
        const consistencyResult = this.consistencyResults.find(r => r.endpoint === endpoint);
        const isConsistent = consistencyResult ? consistencyResult.isConsistent : false;

        const mockSources = this.getMockSources(endpoint);
        const dataSize = this.calculateEndpointDataSize(endpoint);
        const lastModified = this.getEndpointLastModified(endpoint);

        endpointCoverage.push({
          endpoint,
          method: method.toUpperCase(),
          isMocked,
          isConsistent,
          mockSources,
          dataSize,
          lastModified,
          migrationPriority: this.calculateMigrationPriority(endpoint, isMocked, isConsistent),
          migrationComplexity: this.calculateMigrationComplexity(endpoint)
        });
      });
    });

    return endpointCoverage;
  }

  /**
   * 按数据源分析覆盖率
   */
  private async analyzeByDataSource(): Promise<DataSourceCoverage[]> {
    const sourceTypes = ['api_route', 'test_script', 'component', 'json_file'] as const;
    const dataSourceCoverage: DataSourceCoverage[] = [];

    for (const sourceType of sourceTypes) {
      const sources = this.mockDataSources.filter(source => source.sourceType === sourceType);
      const fileCount = sources.length;
      const mockCount = sources.reduce((sum, source) => sum + (source.mockCount || 1), 0);
      const totalSize = sources.reduce((sum, source) => sum + (source.size || 0), 0);
      const averageQuality = this.calculateSourceTypeQuality(sourceType);

      dataSourceCoverage.push({
        sourceType,
        fileCount,
        mockCount,
        totalSize,
        averageQuality,
        migrationStrategy: this.getMigrationStrategy(sourceType)
      });
    }

    return dataSourceCoverage;
  }

  /**
   * 创建迁移计划
   */
  private async createMigrationPlan(): Promise<MigrationPlan> {
    const phases: MigrationPhase[] = [
      {
        phase: 'Phase 1: 中央Mock服务基础建设',
        description: '建立MSW + OpenAPI为基础的中央Mock服务架构',
        tasks: [
          '实施TASK-P3-018B: 中央Mock服务核心实现',
          '建立Mock数据版本管理机制',
          '实现环境切换(Mock/真实API)功能',
          '建立Mock数据质量监控'
        ],
        duration: '5天',
        priority: 'critical',
        riskLevel: 'medium',
        dependencies: ['TASK-P3-018基线确立']
      },
      {
        phase: 'Phase 2: 高优先级端点迁移',
        description: '迁移核心业务模块的Mock数据到中央服务',
        tasks: [
          '迁移认证模块Mock数据',
          '迁移用户管理Mock数据',
          '迁移产品管理Mock数据',
          '迁移溯源功能Mock数据'
        ],
        duration: '3天',
        priority: 'high',
        riskLevel: 'low',
        dependencies: ['Phase 1完成']
      },
      {
        phase: 'Phase 3: 业务模块扩展',
        description: '实施TASK-P3-019A，扩展所有业务模块Mock支持',
        tasks: [
          '扩展农业模块Mock数据',
          '扩展物流模块Mock数据',
          '扩展加工模块Mock数据',
          '扩展管理员模块Mock数据'
        ],
        duration: '7天',
        priority: 'medium',
        riskLevel: 'medium',
        dependencies: ['Phase 2完成']
      },
      {
        phase: 'Phase 4: 遗留数据清理',
        description: '清理散落的Mock数据，确保单一数据源',
        tasks: [
          '清理组件内嵌Mock数据',
          '整合测试脚本Mock数据',
          '移除冗余JSON Mock文件',
          '更新开发文档和使用指南'
        ],
        duration: '2天',
        priority: 'low',
        riskLevel: 'low',
        dependencies: ['Phase 3完成']
      }
    ];

    return {
      phases,
      timeline: '预计总时长: 17天',
      resources: ['Phase-3技术团队', 'Mock API基线Schema', '一致性验证工具'],
      dependencies: ['TASK-P3-018完成', 'OpenAPI Schema v1.0.0-baseline确立'],
      successCriteria: [
        'Mock API中央化率 >= 95%',
        '一致性验证通过率 = 100%',
        '开发环境Mock响应时间 <= 100ms',
        '零破坏性变更，现有功能100%兼容'
      ]
    };
  }

  /**
   * 评估迁移风险
   */
  private async assessMigrationRisks(): Promise<RiskAssessment> {
    const highRiskItems: RiskItem[] = [
      {
        item: '多源Mock数据不一致',
        description: '同一端点存在多个不同的Mock实现',
        impact: '可能导致开发测试环境行为不一致',
        probability: '中等',
        mitigation: '建立统一的Mock数据校验机制，确保数据一致性'
      }
    ];

    const mediumRiskItems: RiskItem[] = [
      {
        item: 'Mock服务性能问题',
        description: '中央Mock服务可能成为性能瓶颈',
        impact: '影响开发环境响应速度',
        probability: '较低',
        mitigation: '实施Mock数据缓存和性能监控'
      },
      {
        item: '复杂业务逻辑Mock化',
        description: '某些端点包含复杂的业务逻辑难以Mock',
        impact: '功能测试覆盖不完整',
        probability: '中等',
        mitigation: '采用分层Mock策略，重要逻辑保持真实API调用'
      }
    ];

    const lowRiskItems: RiskItem[] = [
      {
        item: '开发者使用习惯变更',
        description: '开发者需要适应新的Mock使用方式',
        impact: '短期开发效率轻微影响',
        probability: '较高',
        mitigation: '提供详细使用文档和培训'
      }
    ];

    return {
      highRiskItems,
      mediumRiskItems,
      lowRiskItems,
      overallRiskLevel: 'medium',
      mitigationStrategies: [
        '建立全面的回归测试覆盖',
        '实施渐进式迁移策略',
        '保持原有Mock作为备份方案',
        '建立实时监控和快速回滚机制'
      ]
    };
  }

  /**
   * 生成建议
   */
  private async generateRecommendations(): Promise<string[]> {
    const summary = await this.calculateCoverageSummary();
    const recommendations: string[] = [];

    // 基于覆盖率的建议
    if (summary.realCoverageRate < 80) {
      recommendations.push(`当前Mock覆盖率${summary.realCoverageRate.toFixed(1)}%偏低，建议优先实现核心业务端点Mock`);
    }

    if (summary.qualityCoverageRate < summary.realCoverageRate) {
      const gap = summary.realCoverageRate - summary.qualityCoverageRate;
      recommendations.push(`发现${gap.toFixed(1)}%的Mock存在一致性问题，建议在迁移前先修复`);
    }

    // 基于数据源分布的建议
    const apiRouteSources = this.mockDataSources.filter(s => s.sourceType === 'api_route').length;
    const totalSources = this.mockDataSources.length;

    if (apiRouteSources < totalSources * 0.5) {
      recommendations.push('发现大量散落的Mock数据，建议加快中央化迁移进程');
    }

    // 通用建议
    recommendations.push('建议按模块优先级进行分阶段迁移，降低整体风险');
    recommendations.push('建立Mock数据版本管理和自动同步机制');
    recommendations.push('在TASK-P3-018B中优先实现环境切换功能');

    return recommendations;
  }

  // 辅助方法

  private extractModuleFromEndpoint(endpoint: string): string {
    const parts = endpoint.split('/').filter(part => part && !part.startsWith('{'));
    return parts[0] || 'core';
  }

  private isMocked(endpoint: string): boolean {
    // 先检查是否有对应的Mock API文件
    const hasApiRoute = this.mockDataSources.some(source =>
      source.sourceType === 'api_route' && source.filePath.includes(endpoint.substring(1))
    );

    // 如果没有找到API路由，检查是否有其他Mock源
    if (!hasApiRoute) {
      return this.getMockSources(endpoint).length > 0;
    }

    return hasApiRoute;
  }

  private calculateModuleQuality(endpoints: string[]): 'high' | 'medium' | 'low' {
    const consistentCount = endpoints.filter(endpoint => {
      const result = this.consistencyResults.find(r => r.endpoint === endpoint);
      return result && result.isConsistent;
    }).length;

    const qualityRate = endpoints.length > 0 ? consistentCount / endpoints.length : 0;

    if (qualityRate >= 0.8) return 'high';
    if (qualityRate >= 0.5) return 'medium';
    return 'low';
  }

  private getMockSources(endpoint: string): string[] {
    const endpointPath = endpoint.substring(1); // 移除开头的斜杠

    return this.mockDataSources
      .filter(source => {
        // 标准化文件路径
        const normalizedPath = source.filePath.replace(/\\/g, '/');

        // 检查是否包含对应的路径
        if (normalizedPath.includes(endpointPath)) {
          return true;
        }

        // 对于动态路由，检查文件夹结构
        const pathParts = endpointPath.split('/');
        const hasAllParts = pathParts.every(part => {
          // 忽略动态参数部分 {id} 等
          if (part.startsWith('{') && part.endsWith('}')) {
            return true;
          }
          return normalizedPath.includes(part);
        });

        return hasAllParts;
      })
      .map(source => source.filePath);
  }

  private calculateEndpointDataSize(endpoint: string): number {
    const sources = this.getMockSources(endpoint);
    return sources.reduce((sum, sourcePath) => {
      return sum + this.getFileSize(sourcePath);
    }, 0);
  }

  private getEndpointLastModified(endpoint: string): string {
    const sources = this.getMockSources(endpoint);
    if (sources.length === 0) return '';

    const latestTime = sources.reduce((latest, sourcePath) => {
      const modTime = this.getFileModifiedTime(sourcePath);
      return modTime > latest ? modTime : latest;
    }, '');

    return latestTime;
  }

  private calculateMigrationPriority(endpoint: string, isMocked: boolean, isConsistent: boolean): 'high' | 'medium' | 'low' {
    if (!isMocked) return 'low';
    if (!isConsistent) return 'high';

    // 基于业务重要性
    const criticalModules = ['auth', 'users', 'products', 'trace'];
    const module = this.extractModuleFromEndpoint(endpoint);

    if (criticalModules.includes(module)) return 'high';
    return 'medium';
  }

  private calculateMigrationComplexity(endpoint: string): 'simple' | 'moderate' | 'complex' {
    const sources = this.getMockSources(endpoint);

    if (sources.length === 0) return 'simple';
    if (sources.length === 1) return 'simple';
    if (sources.length <= 3) return 'moderate';
    return 'complex';
  }

  private calculateSourceTypeQuality(sourceType: string): number {
    const sources = this.mockDataSources.filter(s => s.sourceType === sourceType);
    if (sources.length === 0) return 0;

    // API路由质量最高，组件质量最低
    const qualityMap = {
      'api_route': 0.9,
      'test_script': 0.7,
      'json_file': 0.6,
      'component': 0.4
    };

    return qualityMap[sourceType as keyof typeof qualityMap] || 0.5;
  }

  private getMigrationStrategy(sourceType: string): string {
    const strategyMap = {
      'api_route': '直接迁移到中央Mock服务',
      'test_script': '整合到中央服务，保留测试特定数据',
      'json_file': '合并到中央数据源，移除冗余文件',
      'component': '移除内嵌Mock，使用中央服务'
    };

    return strategyMap[sourceType as keyof typeof strategyMap] || '评估后决定迁移策略';
  }

  private getFileSize(filePath: string): number {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      const stats = fs.statSync(fullPath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private getFileModifiedTime(filePath: string): string {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      const stats = fs.statSync(fullPath);
      return stats.mtime.toISOString();
    } catch {
      return '';
    }
  }
}

/**
 * 生成覆盖率分析报告
 */
async function generateCoverageReport(analysis: CoverageAnalysisResult): Promise<void> {
  try {
    const reportsDir = path.resolve(process.cwd(), 'web-app-next/scripts/validation/task-p3-018/reports');

    // 确保报告目录存在
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 生成JSON报告
    const jsonReportPath = path.join(reportsDir, 'coverage-analysis-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(analysis, null, 2));

    // 生成Markdown报告
    const markdownReport = generateMarkdownReport(analysis);
    const mdReportPath = path.join(reportsDir, 'coverage-analysis-report.md');
    fs.writeFileSync(mdReportPath, markdownReport);

    console.log(`\n📄 覆盖率分析报告已生成:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   Markdown: ${mdReportPath}`);

  } catch (error) {
    console.error(`❌ 生成覆盖率报告失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 生成Markdown格式的覆盖率分析报告
 */
function generateMarkdownReport(analysis: CoverageAnalysisResult): string {
  const { summary, detailedBreakdown, migrationPlan, recommendations, riskAssessment, timestamp } = analysis;

  let markdown = `# Mock API覆盖率分析与迁移规划报告

**分析时间**: ${new Date(timestamp).toLocaleString('zh-CN')}
**分析范围**: 基于Day 1-3成果的综合覆盖率统计与TASK-P3-018B迁移规划

## 📊 覆盖率分析摘要

| 指标 | 数值 | 状态 |
|------|------|------|
| 🎯 真实覆盖率 | ${summary.realCoverageRate.toFixed(1)}% | ${summary.realCoverageRate >= 80 ? '✅ 良好' : summary.realCoverageRate >= 60 ? '⚠️ 需改进' : '❌ 不足'} |
| 💎 高质量覆盖率 | ${summary.qualityCoverageRate.toFixed(1)}% | ${summary.qualityCoverageRate >= 80 ? '✅ 优秀' : summary.qualityCoverageRate >= 60 ? '⚠️ 良好' : '❌ 需改进'} |
| 📊 总API端点 | ${summary.totalApiEndpoints} | - |
| ✅ 已Mock端点 | ${summary.mockedEndpoints} | ${summary.totalApiEndpoints > 0 ? (summary.mockedEndpoints / summary.totalApiEndpoints * 100).toFixed(1) : 0}% |
| ❌ 未Mock端点 | ${summary.unmockedEndpoints} | ${summary.totalApiEndpoints > 0 ? (summary.unmockedEndpoints / summary.totalApiEndpoints * 100).toFixed(1) : 0}% |
| ✨ 一致性端点 | ${summary.consistentMockEndpoints} | ${summary.mockedEndpoints > 0 ? (summary.consistentMockEndpoints / summary.mockedEndpoints * 100).toFixed(1) : 0}% |

## 📋 详细分析结果

### 🎛️ 按模块覆盖率分析

| 模块 | 总端点 | 已Mock | 覆盖率 | 质量 |
|------|--------|---------|--------|------|
`;

  detailedBreakdown.byModule.forEach(module => {
    const qualityIcon = module.quality === 'high' ? '🟢' : module.quality === 'medium' ? '🟡' : '🔴';
    markdown += `| ${module.module} | ${module.totalEndpoints} | ${module.mockedEndpoints} | ${module.coverageRate.toFixed(1)}% | ${qualityIcon} ${module.quality} |\n`;
  });

  markdown += `\n### 📦 按数据源类型分析

| 数据源类型 | 文件数 | Mock数 | 总大小 | 平均质量 | 迁移策略 |
|------------|--------|--------|--------|----------|----------|
`;

  detailedBreakdown.byDataSource.forEach(source => {
    const sizeKB = (source.totalSize / 1024).toFixed(1);
    const qualityPercent = (source.averageQuality * 100).toFixed(0);
    markdown += `| ${source.sourceType} | ${source.fileCount} | ${source.mockCount} | ${sizeKB}KB | ${qualityPercent}% | ${source.migrationStrategy} |\n`;
  });

  markdown += `\n## 🚀 迁移计划

### 总体规划
- **预计时长**: ${migrationPlan.timeline}
- **所需资源**: ${migrationPlan.resources.join(', ')}
- **关键依赖**: ${migrationPlan.dependencies.join(', ')}

### 实施阶段

`;

  migrationPlan.phases.forEach((phase, index) => {
    const priorityIcon = phase.priority === 'critical' ? '🔥' : phase.priority === 'high' ? '🔴' : phase.priority === 'medium' ? '🟡' : '🟢';
    const riskIcon = phase.riskLevel === 'high' ? '🔴' : phase.riskLevel === 'medium' ? '🟡' : '🟢';

    markdown += `#### ${phase.phase}\n`;
    markdown += `- **描述**: ${phase.description}\n`;
    markdown += `- **时长**: ${phase.duration}\n`;
    markdown += `- **优先级**: ${priorityIcon} ${phase.priority}\n`;
    markdown += `- **风险等级**: ${riskIcon} ${phase.riskLevel}\n`;
    markdown += `- **依赖**: ${phase.dependencies.join(', ')}\n`;
    markdown += `- **任务清单**:\n`;
    phase.tasks.forEach(task => {
      markdown += `  - ${task}\n`;
    });
    markdown += '\n';
  });

  markdown += `### 成功标准
${migrationPlan.successCriteria.map(criteria => `- ${criteria}`).join('\n')}

## ⚠️ 风险评估

### 整体风险等级: ${riskAssessment.overallRiskLevel.toUpperCase()}

#### 🔴 高风险项目
${riskAssessment.highRiskItems.map(item => `
**${item.item}**
- 描述: ${item.description}
- 影响: ${item.impact}
- 概率: ${item.probability}
- 缓解措施: ${item.mitigation}
`).join('\n')}

#### 🟡 中等风险项目
${riskAssessment.mediumRiskItems.map(item => `
**${item.item}**
- 描述: ${item.description}
- 影响: ${item.impact}
- 概率: ${item.probability}
- 缓解措施: ${item.mitigation}
`).join('\n')}

#### 🟢 低风险项目
${riskAssessment.lowRiskItems.map(item => `
**${item.item}**
- 描述: ${item.description}
- 影响: ${item.impact}
- 概率: ${item.probability}
- 缓解措施: ${item.mitigation}
`).join('\n')}

### 风险缓解策略
${riskAssessment.mitigationStrategies.map(strategy => `- ${strategy}`).join('\n')}

## 💡 建议与下一步

${recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

## 📈 后续任务关联

本分析报告将为以下任务提供技术基线：

1. **TASK-P3-018B**: 中央Mock服务实现
   - 使用本报告的迁移计划作为实施指导
   - 按照风险评估结果进行分阶段迁移
   - 参考数据源分析结果设计中央服务架构

2. **TASK-P3-019A**: Mock业务模块扩展
   - 基于模块覆盖率分析确定扩展优先级
   - 使用端点分析结果进行业务逻辑Mock化
   - 遵循质量标准确保一致性

---

*报告生成于: ${new Date(timestamp).toLocaleString('zh-CN')}*
*分析工具: Mock API覆盖率分析器 v1.0.0*
*基础数据: TASK-P3-018 Day 1-3验证成果*
`;

  return markdown;
}

/**
 * 主函数
 */
async function main() {
  try {
    const analyzer = new MockApiCoverageAnalyzer();
    const analysis = await analyzer.analyze();
    await generateCoverageReport(analysis);

    console.log('\n✅ Mock API覆盖率分析与迁移规划完成！');
    console.log(`📊 真实覆盖率: ${analysis.summary.realCoverageRate.toFixed(1)}%`);
    console.log(`💎 高质量覆盖率: ${analysis.summary.qualityCoverageRate.toFixed(1)}%`);
    console.log(`🚀 迁移阶段: ${analysis.migrationPlan.phases.length} 个阶段规划完成`);

    process.exit(0);
  } catch (error) {
    console.error(`💥 覆盖率分析过程中发生错误: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行覆盖率分析
if (require.main === module) {
  main();
}

export type { CoverageAnalysisResult, ModuleCoverage, EndpointCoverage, DataSourceCoverage, MigrationPlan };
export { MockApiCoverageAnalyzer };
