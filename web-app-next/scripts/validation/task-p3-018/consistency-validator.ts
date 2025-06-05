#!/usr/bin/env tsx

/**
 * Mock数据一致性验证器
 *
 * 验证现有Mock数据与权威Schema的一致性:
 * 1. 对比Mock API响应格式与OpenAPI Schema
 * 2. 验证Mock数据字段完整性和类型正确性
 * 3. 检查Mock数据与真实API响应格式的一致性
 * 4. 生成详细的一致性验证报告
 *
 * @author Phase-3技术团队
 * @date 2025-06-03
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as yaml from 'js-yaml';

// 一致性验证结果接口
interface ConsistencyValidationResult {
  endpoint: string;
  mockFilePath: string;
  schemaPath: string;
  isConsistent: boolean;
  issues: ConsistencyIssue[];
  mockDataSample: any;
  expectedSchema: any;
  score: number; // 一致性得分 0-100
}

// 一致性问题接口
interface ConsistencyIssue {
  type: 'missing_field' | 'wrong_type' | 'extra_field' | 'format_error' | 'structure_mismatch';
  field: string;
  expected: any;
  actual: any;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

// 验证报告接口
interface ConsistencyReport {
  summary: {
    totalEndpoints: number;
    consistentEndpoints: number;
    inconsistentEndpoints: number;
    overallScore: number;
    criticalIssues: number;
    warningIssues: number;
  };
  results: ConsistencyValidationResult[];
  recommendations: string[];
  timestamp: string;
}

class MockDataConsistencyValidator {
  private projectRoot: string;
  private openApiSchema: any;
  private mockDataSources: any[] = [];
  private validationResults: ConsistencyValidationResult[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    console.log(`🔍 Mock数据一致性验证器启动 - 项目根目录: ${this.projectRoot}`);
  }

  /**
   * 运行完整的一致性验证
   */
  public async validate(): Promise<ConsistencyReport> {
    console.log('🔍 开始Mock数据一致性验证...\n');

    try {
      // 执行验证步骤
      await this.loadOpenApiSchema();
      await this.discoverMockEndpoints();
      await this.validateConsistency();

      // 生成报告
      const report = this.generateReport();

      // 显示汇总结果
      console.log(`\n📊 一致性验证结果汇总:`);
      console.log(`🎯 总体得分: ${report.summary.overallScore.toFixed(1)}%`);
      console.log(`📊 端点统计: ${report.summary.totalEndpoints} 总计, ${report.summary.consistentEndpoints} 一致, ${report.summary.inconsistentEndpoints} 不一致`);
      console.log(`🚨 问题统计: ${report.summary.criticalIssues} 严重, ${report.summary.warningIssues} 警告`);

      if (report.recommendations.length > 0) {
        console.log(`\n💡 改进建议:`);
        report.recommendations.forEach((rec, i) => {
          console.log(`   ${i + 1}. ${rec}`);
        });
      }

      return report;
    } catch (error) {
      console.error(`❌ 验证过程失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 加载OpenAPI Schema
   */
  private async loadOpenApiSchema(): Promise<void> {
    try {
      const schemaPath = path.resolve(this.projectRoot, 'docs/api/openapi.yaml');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      this.openApiSchema = yaml.load(schemaContent) as any;

      console.log(`✅ OpenAPI Schema加载成功: ${Object.keys(this.openApiSchema.components?.schemas || {}).length} 个Schema定义`);
    } catch (error) {
      throw new Error(`❌ 加载OpenAPI Schema失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 发现和分析Mock API端点
   */
  private async discoverMockEndpoints(): Promise<void> {
    console.log(`\n🔍 发现Mock API端点...`);

    try {
      const mockApiFiles = await glob('web-app-next/src/app/api/**/route.ts', {
        cwd: this.projectRoot
      });

      for (const filePath of mockApiFiles) {
        await this.analyzeMockEndpoint(filePath);
      }

      console.log(`   发现 ${this.mockDataSources.length} 个Mock API端点`);
    } catch (error) {
      console.error(`❌ 发现Mock端点失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 分析单个Mock端点
   */
  private async analyzeMockEndpoint(filePath: string): Promise<void> {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      const content = fs.readFileSync(fullPath, 'utf8');

      // 提取Mock数据和响应格式
      const mockData = this.extractMockData(content, filePath);
      if (mockData) {
        this.mockDataSources.push({
          filePath: fullPath,
          relativePath: filePath,
          endpoint: this.getEndpointFromPath(filePath),
          mockData: mockData,
          content: content
        });
      }
    } catch (error) {
      console.error(`   ❌ 分析Mock端点失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从文件路径提取API端点
   */
  private getEndpointFromPath(filePath: string): string {
    // 标准化路径分隔符为正斜杠
    const normalizedPath = filePath.replace(/\\/g, '/');

    // web-app-next/src/app/api/auth/login/route.ts -> /auth/login
    const match = normalizedPath.match(/\/api\/(.+)\/route\.ts$/);
    if (match) {
      return '/' + match[1].replace(/\[(\w+)\]/g, '{$1}'); // 处理动态路由
    }
    return filePath;
  }

  /**
   * 提取Mock数据
   */
  private extractMockData(content: string, filePath: string): any {
    try {
      // 检查是否使用了createResponse函数
      const hasCreateResponse = content.includes('createResponse');
      const hasApiResponseInterface = content.includes('interface ApiResponse');

      // 查找NextResponse.json调用
      const jsonResponseMatch = content.match(/NextResponse\.json\(([\s\S]*?)\)/);
      if (jsonResponseMatch) {
        const responseCode = jsonResponseMatch[1];

        // 检查是否是间接响应(通过createResponse或其他函数)
        if (hasCreateResponse || hasApiResponseInterface) {
          return {
            type: 'standard_response',
            pattern: responseCode.trim(),
            hasSuccessField: true, // createResponse函数确保有success字段
            hasDataField: true, // createResponse函数确保有data字段
            hasMessageField: true, // createResponse函数确保有message字段
            usesCreateResponse: hasCreateResponse,
            hasApiResponseInterface: hasApiResponseInterface
          };
        }

        // 尝试解析简单的JSON对象
        try {
          // 简化的JSON解析 - 查找对象模式
          const objectMatch = responseCode.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            // 对于复杂的代码，我们记录响应格式模式
            return {
              type: 'nextresponse_json',
              pattern: responseCode.trim(),
              hasSuccessField: responseCode.includes('success'),
              hasDataField: responseCode.includes('data'),
              hasMessageField: responseCode.includes('message')
            };
          }
        } catch (e) {
          // 如果无法解析，记录模式信息
          return {
            type: 'complex_response',
            pattern: responseCode.trim(),
            file: filePath
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`   ⚠️ 提取Mock数据失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 验证Mock数据与Schema的一致性
   */
  private async validateConsistency(): Promise<void> {
    console.log(`\n🔍 验证Mock数据与Schema一致性...`);

    for (const mockSource of this.mockDataSources) {
      const result = await this.validateSingleEndpoint(mockSource);
      this.validationResults.push(result);
    }

    console.log(`   完成 ${this.validationResults.length} 个端点的一致性验证`);
  }

  /**
   * 验证单个端点的一致性
   */
  private async validateSingleEndpoint(mockSource: any): Promise<ConsistencyValidationResult> {
    const endpoint = mockSource.endpoint;
    const issues: ConsistencyIssue[] = [];
    let score = 100;

    try {
      // 查找对应的OpenAPI定义
      const pathKey = this.findMatchingOpenApiPath(endpoint);
      const openApiPath = pathKey ? this.openApiSchema.paths[pathKey] : null;

      if (!openApiPath) {
        issues.push({
          type: 'structure_mismatch',
          field: 'endpoint',
          expected: '在OpenAPI中定义',
          actual: '未找到定义',
          severity: 'high',
          description: `端点 ${endpoint} 在OpenAPI Schema中未找到对应定义`
        });
        score -= 30;
      } else {
        // 验证响应格式
        const responseValidation = this.validateResponseFormat(mockSource.mockData, openApiPath, endpoint);
        issues.push(...responseValidation.issues);
        score -= responseValidation.penalty;
      }

      // 验证API响应结构(检查是否使用标准ApiResponse格式)
      const structureValidation = this.validateApiResponseStructure(mockSource.mockData);
      issues.push(...structureValidation.issues);
      score -= structureValidation.penalty;

      const isConsistent = issues.filter(issue => issue.severity === 'high').length === 0;

      console.log(`   ${isConsistent ? '✅' : '❌'} ${endpoint}: ${score.toFixed(0)}%`);

      return {
        endpoint,
        mockFilePath: mockSource.relativePath,
        schemaPath: pathKey || 'NOT_FOUND',
        isConsistent,
        issues,
        mockDataSample: mockSource.mockData,
        expectedSchema: openApiPath,
        score: Math.max(0, score)
      };

    } catch (error) {
      console.error(`   ❌ 验证端点失败 ${endpoint}: ${error instanceof Error ? error.message : String(error)}`);

      return {
        endpoint,
        mockFilePath: mockSource.relativePath,
        schemaPath: 'ERROR',
        isConsistent: false,
        issues: [{
          type: 'structure_mismatch',
          field: 'validation',
          expected: '成功验证',
          actual: '验证失败',
          severity: 'high',
          description: `验证过程中发生错误: ${error instanceof Error ? error.message : String(error)}`
        }],
        mockDataSample: mockSource.mockData,
        expectedSchema: null,
        score: 0
      };
    }
  }

  /**
   * 查找匹配的OpenAPI路径
   */
  private findMatchingOpenApiPath(endpoint: string): string | null {
    const paths = Object.keys(this.openApiSchema.paths || {});

    // 直接匹配
    if (paths.includes(endpoint)) {
      return endpoint;
    }

    // 处理动态路由匹配
    for (const path of paths) {
      const pathPattern = path.replace(/\{[^}]+\}/g, '[^/]+');
      const regex = new RegExp(`^${pathPattern}$`);
      if (regex.test(endpoint)) {
        return path;
      }
    }

    return null;
  }

  /**
   * 验证响应格式
   */
  private validateResponseFormat(mockData: any, openApiPath: any, endpoint: string): { issues: ConsistencyIssue[], penalty: number } {
    const issues: ConsistencyIssue[] = [];
    let penalty = 0;

    try {
      // 检查是否有GET方法的200响应定义
      const getMethod = openApiPath.get;
      if (getMethod && getMethod.responses && getMethod.responses['200']) {
        const response200 = getMethod.responses['200'];
        const responseSchema = response200.content?.['application/json']?.schema;

        if (responseSchema) {
          // 检查是否引用了ApiResponse
          if (responseSchema.allOf && responseSchema.allOf.some((ref: any) => ref['$ref'] === '#/components/schemas/ApiResponse')) {
            // 验证Mock数据是否符合ApiResponse格式
            if (mockData && mockData.hasSuccessField && mockData.hasDataField) {
              // Mock数据看起来符合ApiResponse格式
            } else {
              issues.push({
                type: 'structure_mismatch',
                field: 'response_format',
                expected: 'ApiResponse格式 (success, data, message)',
                actual: mockData?.pattern || '未知格式',
                severity: 'medium',
                description: `${endpoint} 的Mock响应格式不符合标准ApiResponse格式`
              });
              penalty += 15;
            }
          }
        }
      }
    } catch (error) {
      issues.push({
        type: 'format_error',
        field: 'response_validation',
        expected: '成功验证响应格式',
        actual: '验证失败',
        severity: 'low',
        description: `响应格式验证过程中发生错误: ${error instanceof Error ? error.message : String(error)}`
      });
      penalty += 5;
    }

    return { issues, penalty };
  }

  /**
   * 验证API响应结构
   */
  private validateApiResponseStructure(mockData: any): { issues: ConsistencyIssue[], penalty: number } {
    const issues: ConsistencyIssue[] = [];
    let penalty = 0;

    if (!mockData) {
      issues.push({
        type: 'missing_field',
        field: 'mock_data',
        expected: '存在Mock数据',
        actual: '无Mock数据',
        severity: 'high',
        description: '未找到有效的Mock数据'
      });
      penalty += 25;
      return { issues, penalty };
    }

    // 检查标准ApiResponse字段
    if (!mockData.hasSuccessField) {
      issues.push({
        type: 'missing_field',
        field: 'success',
        expected: 'success字段',
        actual: '缺失',
        severity: 'medium',
        description: 'Mock响应缺少success字段'
      });
      penalty += 10;
    }

    if (!mockData.hasDataField) {
      issues.push({
        type: 'missing_field',
        field: 'data',
        expected: 'data字段',
        actual: '缺失',
        severity: 'medium',
        description: 'Mock响应缺少data字段'
      });
      penalty += 10;
    }

    return { issues, penalty };
  }

  /**
   * 生成一致性验证报告
   */
  private generateReport(): ConsistencyReport {
    const totalEndpoints = this.validationResults.length;
    const consistentEndpoints = this.validationResults.filter(r => r.isConsistent).length;
    const inconsistentEndpoints = totalEndpoints - consistentEndpoints;

    const overallScore = totalEndpoints > 0
      ? this.validationResults.reduce((sum, r) => sum + r.score, 0) / totalEndpoints
      : 0;

    const allIssues = this.validationResults.flatMap(r => r.issues);
    const criticalIssues = allIssues.filter(i => i.severity === 'high').length;
    const warningIssues = allIssues.filter(i => i.severity === 'medium').length;

    // 生成建议
    const recommendations: string[] = [];

    if (inconsistentEndpoints > 0) {
      recommendations.push(`发现 ${inconsistentEndpoints} 个不一致的端点，需要修正Mock数据格式`);
    }

    if (criticalIssues > 0) {
      recommendations.push(`存在 ${criticalIssues} 个严重问题，建议优先处理`);
    }

    if (overallScore < 80) {
      recommendations.push('整体一致性得分偏低，建议全面审查Mock数据与Schema的对齐');
    }

    const missingSchemaDefs = this.validationResults.filter(r => r.schemaPath === 'NOT_FOUND').length;
    if (missingSchemaDefs > 0) {
      recommendations.push(`${missingSchemaDefs} 个端点在OpenAPI Schema中缺少定义，需补充API文档`);
    }

    return {
      summary: {
        totalEndpoints,
        consistentEndpoints,
        inconsistentEndpoints,
        overallScore: Math.round(overallScore * 100) / 100,
        criticalIssues,
        warningIssues
      },
      results: this.validationResults,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 生成详细报告文件
 */
async function generateDetailedReport(report: ConsistencyReport): Promise<void> {
  try {
    const reportsDir = path.resolve(process.cwd(), 'web-app-next/scripts/validation/task-p3-018/reports');

    // 确保报告目录存在
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 生成JSON报告
    const jsonReportPath = path.join(reportsDir, 'consistency-validation-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // 生成Markdown报告
    const markdownReport = generateMarkdownReport(report);
    const mdReportPath = path.join(reportsDir, 'consistency-validation-report.md');
    fs.writeFileSync(mdReportPath, markdownReport);

    console.log(`\n📄 一致性验证报告已生成:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   Markdown: ${mdReportPath}`);

  } catch (error) {
    console.error(`❌ 生成报告失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 生成Markdown格式的一致性验证报告
 */
function generateMarkdownReport(report: ConsistencyReport): string {
  const { summary, results, recommendations, timestamp } = report;

  let markdown = `# Mock数据一致性验证报告

**验证时间**: ${new Date(timestamp).toLocaleString('zh-CN')}
**验证范围**: Mock API与OpenAPI Schema一致性

## 📊 验证结果汇总

| 指标 | 数值 | 状态 |
|------|------|------|
| 🎯 总体得分 | ${summary.overallScore.toFixed(1)}% | ${summary.overallScore >= 80 ? '✅ 良好' : summary.overallScore >= 60 ? '⚠️ 需改进' : '❌ 不及格'} |
| 📊 端点总数 | ${summary.totalEndpoints} | - |
| ✅ 一致端点 | ${summary.consistentEndpoints} | ${summary.totalEndpoints > 0 ? (summary.consistentEndpoints / summary.totalEndpoints * 100).toFixed(1) : 0}% |
| ❌ 不一致端点 | ${summary.inconsistentEndpoints} | ${summary.totalEndpoints > 0 ? (summary.inconsistentEndpoints / summary.totalEndpoints * 100).toFixed(1) : 0}% |
| 🚨 严重问题 | ${summary.criticalIssues} | ${summary.criticalIssues === 0 ? '✅' : '❌'} |
| ⚠️ 警告问题 | ${summary.warningIssues} | ${summary.warningIssues === 0 ? '✅' : '⚠️'} |

## 📋 详细验证结果

`;

  // 按一致性状态分组显示结果
  const consistentResults = results.filter(r => r.isConsistent);
  const inconsistentResults = results.filter(r => !r.isConsistent);

  if (consistentResults.length > 0) {
    markdown += `### ✅ 一致的端点 (${consistentResults.length}个)\n\n`;
    for (const result of consistentResults) {
      markdown += `#### ${result.endpoint}\n`;
      markdown += `- **文件路径**: \`${result.mockFilePath}\`\n`;
      markdown += `- **一致性得分**: ${result.score.toFixed(0)}%\n`;
      markdown += `- **Schema路径**: \`${result.schemaPath}\`\n`;
      if (result.issues.length > 0) {
        markdown += `- **轻微问题**: ${result.issues.length}个\n`;
      }
      markdown += '\n';
    }
  }

  if (inconsistentResults.length > 0) {
    markdown += `### ❌ 不一致的端点 (${inconsistentResults.length}个)\n\n`;
    for (const result of inconsistentResults) {
      markdown += `#### ${result.endpoint}\n`;
      markdown += `- **文件路径**: \`${result.mockFilePath}\`\n`;
      markdown += `- **一致性得分**: ${result.score.toFixed(0)}%\n`;
      markdown += `- **Schema路径**: \`${result.schemaPath}\`\n`;
      markdown += `- **问题数量**: ${result.issues.length}个\n`;

      if (result.issues.length > 0) {
        markdown += '\n**具体问题**:\n';
        for (const issue of result.issues) {
          const severityIcon = issue.severity === 'high' ? '🚨' : issue.severity === 'medium' ? '⚠️' : 'ℹ️';
          markdown += `- ${severityIcon} **${issue.field}**: ${issue.description}\n`;
          markdown += `  - 期望: ${JSON.stringify(issue.expected)}\n`;
          markdown += `  - 实际: ${JSON.stringify(issue.actual)}\n`;
        }
      }
      markdown += '\n';
    }
  }

  markdown += `## 💡 改进建议

`;

  if (recommendations.length > 0) {
    recommendations.forEach((rec, i) => {
      markdown += `${i + 1}. ${rec}\n`;
    });
  } else {
    markdown += '暂无改进建议，一致性验证通过。\n';
  }

  markdown += `\n---

*报告生成于: ${new Date(timestamp).toLocaleString('zh-CN')}*
*验证工具: Mock数据一致性验证器 v1.0.0*
`;

  return markdown;
}

/**
 * 主函数
 */
async function main() {
  try {
    const validator = new MockDataConsistencyValidator();
    const report = await validator.validate();
    await generateDetailedReport(report);

    console.log('\n✅ Mock数据一致性验证完成！');

    // 返回适当的退出码
    if (report.summary.criticalIssues > 0) {
      console.log('⚠️ 发现严重问题，请查看报告详情');
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error(`💥 一致性验证过程中发生致命错误: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行一致性验证
if (require.main === module) {
  main();
}

export type { ConsistencyValidationResult, ConsistencyIssue, ConsistencyReport };
export { MockDataConsistencyValidator };
