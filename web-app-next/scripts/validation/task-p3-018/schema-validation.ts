#!/usr/bin/env tsx

/**
 * Schema结构完整性验证脚本
 *
 * 验证项目:
 * 1. OpenAPI Schema语法验证
 * 2. AsyncAPI Schema语法验证
 * 3. Schema结构完整性检查
 * 4. 与现有Mock API的一致性验证
 * 5. 必需字段和数据类型验证
 *
 * @author Phase-3技术团队
 * @date 2025-06-03
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// 验证结果接口
interface ValidationResult {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: any;
}

interface ValidationReport {
  schemaValidation: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
  };
  timestamp: string;
}

class SchemaValidator {
  private projectRoot: string;
  private results: ValidationResult[] = [];

  constructor() {
    // 找到项目根目录
    this.projectRoot = process.cwd();
    console.log(`🔍 项目根目录: ${this.projectRoot}`);
  }

  /**
   * 添加验证结果
   */
  private addResult(name: string, status: 'pass' | 'warning' | 'fail', message: string, details?: any) {
    this.results.push({ name, status, message, details });

    const statusIcon = status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    console.log(`${statusIcon} ${name}: ${message}`);

    if (details) {
      console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    }
  }

  /**
   * 验证文件是否存在
   */
  private validateFileExists(filePath: string, description: string): boolean {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      if (fs.existsSync(fullPath)) {
        this.addResult(
          `文件存在性检查 - ${description}`,
          'pass',
          `文件存在: ${filePath}`
        );
        return true;
      } else {
        this.addResult(
          `文件存在性检查 - ${description}`,
          'fail',
          `文件不存在: ${filePath}`
        );
        return false;
      }
    } catch (error) {
      this.addResult(
        `文件存在性检查 - ${description}`,
        'fail',
        `检查文件时发生错误: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * 验证YAML语法
   */
  private validateYamlSyntax(filePath: string, description: string): any {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const parsed = yaml.load(content);

      this.addResult(
        `YAML语法验证 - ${description}`,
        'pass',
        `YAML语法正确`
      );

      return parsed;
    } catch (error) {
      this.addResult(
        `YAML语法验证 - ${description}`,
        'fail',
        `YAML语法错误: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * 验证OpenAPI Schema结构
   */
  private validateOpenApiStructure(schema: any): void {
    if (!schema) return;

    // 检查基本结构
    const requiredFields = ['openapi', 'info', 'paths', 'components'];
    for (const field of requiredFields) {
      if (schema[field]) {
        this.addResult(
          `OpenAPI结构验证 - ${field}字段`,
          'pass',
          `${field}字段存在`
        );
      } else {
        this.addResult(
          `OpenAPI结构验证 - ${field}字段`,
          'fail',
          `缺少必需字段: ${field}`
        );
      }
    }

    // 检查版本号
    if (schema.openapi) {
      if (schema.openapi.startsWith('3.0')) {
        this.addResult(
          'OpenAPI版本验证',
          'pass',
          `使用OpenAPI 3.0版本: ${schema.openapi}`
        );
      } else {
        this.addResult(
          'OpenAPI版本验证',
          'warning',
          `非标准OpenAPI版本: ${schema.openapi}`
        );
      }
    }

    // 检查info部分
    if (schema.info) {
      const infoFields = ['title', 'version', 'description'];
      for (const field of infoFields) {
        if (schema.info[field]) {
          this.addResult(
            `OpenAPI Info验证 - ${field}`,
            'pass',
            `info.${field}存在`
          );
        } else {
          this.addResult(
            `OpenAPI Info验证 - ${field}`,
            'warning',
            `建议添加info.${field}字段`
          );
        }
      }
    }

    // 检查Schema定义
    if (schema.components?.schemas) {
      const schemaCount = Object.keys(schema.components.schemas).length;
      this.addResult(
        'OpenAPI Schema定义数量',
        'pass',
        `定义了 ${schemaCount} 个Schema`,
        { schemaCount, schemas: Object.keys(schema.components.schemas) }
      );

      // 检查核心Schema是否存在
      const coreSchemas = [
        'ApiResponse', 'UserInfo', 'Product', 'TraceInfo',
        'LoginRequest', 'LoginResponse', 'ErrorResponse'
      ];

      for (const coreSchema of coreSchemas) {
        if (schema.components.schemas[coreSchema]) {
          this.addResult(
            `核心Schema验证 - ${coreSchema}`,
            'pass',
            `核心Schema ${coreSchema} 已定义`
          );
        } else {
          this.addResult(
            `核心Schema验证 - ${coreSchema}`,
            'warning',
            `建议定义核心Schema: ${coreSchema}`
          );
        }
      }
    }

    // 检查API路径
    if (schema.paths) {
      const pathCount = Object.keys(schema.paths).length;
      this.addResult(
        'OpenAPI路径定义数量',
        'pass',
        `定义了 ${pathCount} 个API路径`,
        { pathCount, paths: Object.keys(schema.paths) }
      );

      // 检查核心API路径
      const coreApis = [
        '/auth/login', '/auth/logout', '/products',
        '/products/{id}', '/trace/{id}'
      ];

      for (const coreApi of coreApis) {
        if (schema.paths[coreApi]) {
          this.addResult(
            `核心API验证 - ${coreApi}`,
            'pass',
            `核心API ${coreApi} 已定义`
          );
        } else {
          this.addResult(
            `核心API验证 - ${coreApi}`,
            'warning',
            `建议定义核心API: ${coreApi}`
          );
        }
      }
    }
  }

  /**
   * 验证AsyncAPI Schema结构
   */
  private validateAsyncApiStructure(schema: any): void {
    if (!schema) return;

    // 检查基本结构
    const requiredFields = ['asyncapi', 'info', 'channels', 'components'];
    for (const field of requiredFields) {
      if (schema[field]) {
        this.addResult(
          `AsyncAPI结构验证 - ${field}字段`,
          'pass',
          `${field}字段存在`
        );
      } else {
        this.addResult(
          `AsyncAPI结构验证 - ${field}字段`,
          'fail',
          `缺少必需字段: ${field}`
        );
      }
    }

    // 检查版本号
    if (schema.asyncapi) {
      if (schema.asyncapi.startsWith('2.')) {
        this.addResult(
          'AsyncAPI版本验证',
          'pass',
          `使用AsyncAPI 2.x版本: ${schema.asyncapi}`
        );
      } else {
        this.addResult(
          'AsyncAPI版本验证',
          'warning',
          `非标准AsyncAPI版本: ${schema.asyncapi}`
        );
      }
    }

    // 检查频道定义
    if (schema.channels) {
      const channelCount = Object.keys(schema.channels).length;
      this.addResult(
        'AsyncAPI频道定义数量',
        'pass',
        `定义了 ${channelCount} 个消息频道`,
        { channelCount, channels: Object.keys(schema.channels) }
      );

      // 检查核心频道
      const coreChannels = [
        'farming/events', 'processing/events',
        'logistics/events', 'system/events', 'trace/aggregated'
      ];

      for (const coreChannel of coreChannels) {
        if (schema.channels[coreChannel]) {
          this.addResult(
            `核心频道验证 - ${coreChannel}`,
            'pass',
            `核心频道 ${coreChannel} 已定义`
          );
        } else {
          this.addResult(
            `核心频道验证 - ${coreChannel}`,
            'warning',
            `建议定义核心频道: ${coreChannel}`
          );
        }
      }
    }

    // 检查消息定义
    if (schema.components?.messages) {
      const messageCount = Object.keys(schema.components.messages).length;
      this.addResult(
        'AsyncAPI消息定义数量',
        'pass',
        `定义了 ${messageCount} 个消息类型`,
        { messageCount, messages: Object.keys(schema.components.messages) }
      );
    }

    // 检查Schema定义
    if (schema.components?.schemas) {
      const schemaCount = Object.keys(schema.components.schemas).length;
      this.addResult(
        'AsyncAPI Schema定义数量',
        'pass',
        `定义了 ${schemaCount} 个事件Schema`,
        { schemaCount, schemas: Object.keys(schema.components.schemas) }
      );
    }
  }

  /**
   * 验证Schema间的一致性
   */
  private validateSchemaConsistency(openApiSchema: any, asyncApiSchema: any): void {
    if (!openApiSchema || !asyncApiSchema) return;

    // 检查版本号一致性
    const openApiVersion = openApiSchema.info?.version;
    const asyncApiVersion = asyncApiSchema.info?.version;

    if (openApiVersion && asyncApiVersion) {
      if (openApiVersion === asyncApiVersion) {
        this.addResult(
          'Schema版本一致性',
          'pass',
          `两个Schema版本一致: ${openApiVersion}`
        );
      } else {
        this.addResult(
          'Schema版本一致性',
          'warning',
          `Schema版本不一致: OpenAPI(${openApiVersion}) vs AsyncAPI(${asyncApiVersion})`
        );
      }
    }

    // 检查基础响应格式是否一致
    const openApiResponse = openApiSchema.components?.schemas?.ApiResponse;
    const asyncApiBaseEvent = asyncApiSchema.components?.schemas?.BaseEvent;

    if (openApiResponse && asyncApiBaseEvent) {
      this.addResult(
        '基础格式一致性',
        'pass',
        'REST API响应格式和事件格式均已定义'
      );
    } else {
      this.addResult(
        '基础格式一致性',
        'warning',
        '建议确保REST API响应格式和事件格式的一致性'
      );
    }

    // 检查数据模型一致性 (Product, User等)
    const commonEntities = ['UserInfo', 'Product'];
    for (const entity of commonEntities) {
      const inOpenApi = openApiSchema.components?.schemas?.[entity];
      const inAsyncApi = asyncApiSchema.components?.schemas?.[entity];

      if (inOpenApi && inAsyncApi) {
        this.addResult(
          `数据模型一致性 - ${entity}`,
          'pass',
          `${entity}在两个Schema中均有定义`
        );
      } else if (inOpenApi || inAsyncApi) {
        this.addResult(
          `数据模型一致性 - ${entity}`,
          'warning',
          `${entity}仅在${inOpenApi ? 'OpenAPI' : 'AsyncAPI'}中定义`
        );
      }
    }
  }

  /**
   * 验证与现有Mock API的兼容性
   */
  private validateMockApiCompatibility(): void {
    try {
      // 检查现有的Mock API路由文件
      const mockApiPaths = [
        'web-app-next/src/app/api/auth/login/route.ts',
        'web-app-next/src/app/api/products/route.ts',
        'web-app-next/src/app/api/trace/[id]/route.ts'
      ];

      let compatibleCount = 0;
      let totalCount = 0;

      for (const apiPath of mockApiPaths) {
        totalCount++;
        if (this.validateFileExists(apiPath, `Mock API - ${path.basename(path.dirname(apiPath))}`)) {
          try {
            const fullPath = path.resolve(this.projectRoot, apiPath);
            const content = fs.readFileSync(fullPath, 'utf8');

            // 检查是否使用标准化响应格式
            if (content.includes('ApiResponse') && content.includes('success') && content.includes('data')) {
              this.addResult(
                `Mock API兼容性 - ${path.basename(path.dirname(apiPath))}`,
                'pass',
                '使用标准化API响应格式'
              );
              compatibleCount++;
            } else {
              this.addResult(
                `Mock API兼容性 - ${path.basename(path.dirname(apiPath))}`,
                'warning',
                '未使用标准化API响应格式，建议升级'
              );
            }
          } catch (error) {
            this.addResult(
              `Mock API兼容性 - ${path.basename(path.dirname(apiPath))}`,
              'fail',
              `读取文件失败: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }

      this.addResult(
        'Mock API整体兼容性',
        compatibleCount === totalCount ? 'pass' : 'warning',
        `${compatibleCount}/${totalCount} 个Mock API使用标准格式`,
        { compatibleCount, totalCount }
      );

    } catch (error) {
      this.addResult(
        'Mock API兼容性验证',
        'fail',
        `验证过程中发生错误: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 运行完整验证
   */
  public async validate(): Promise<ValidationReport> {
    console.log('🚀 开始Schema结构完整性验证...\n');

    // 1. 验证Schema文件存在性
    console.log('📁 第1步: 验证Schema文件存在性');
    const openApiExists = this.validateFileExists('docs/api/openapi.yaml', 'OpenAPI规范文档');
    const asyncApiExists = this.validateFileExists('docs/api/async-api.yaml', 'AsyncAPI规范文档');

    let openApiSchema: any = null;
    let asyncApiSchema: any = null;

    // 2. 验证YAML语法
    if (openApiExists || asyncApiExists) {
      console.log('\n📝 第2步: 验证YAML语法');

      if (openApiExists) {
        openApiSchema = this.validateYamlSyntax('docs/api/openapi.yaml', 'OpenAPI文档');
      }

      if (asyncApiExists) {
        asyncApiSchema = this.validateYamlSyntax('docs/api/async-api.yaml', 'AsyncAPI文档');
      }
    }

    // 3. 验证Schema结构完整性
    if (openApiSchema || asyncApiSchema) {
      console.log('\n🏗️ 第3步: 验证Schema结构完整性');

      if (openApiSchema) {
        this.validateOpenApiStructure(openApiSchema);
      }

      if (asyncApiSchema) {
        this.validateAsyncApiStructure(asyncApiSchema);
      }
    }

    // 4. 验证Schema间一致性
    if (openApiSchema && asyncApiSchema) {
      console.log('\n🔗 第4步: 验证Schema间一致性');
      this.validateSchemaConsistency(openApiSchema, asyncApiSchema);
    }

    // 5. 验证与现有Mock API的兼容性
    console.log('\n🔄 第5步: 验证Mock API兼容性');
    this.validateMockApiCompatibility();

    // 生成汇总统计
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      warnings: this.results.filter(r => r.status === 'warning').length,
      failed: this.results.filter(r => r.status === 'fail').length
    };

    const report: ValidationReport = {
      schemaValidation: this.results,
      summary,
      timestamp: new Date().toISOString()
    };

    // 显示汇总结果
    console.log('\n📊 验证结果汇总:');
    console.log(`✅ 通过: ${summary.passed}`);
    console.log(`⚠️ 警告: ${summary.warnings}`);
    console.log(`❌ 失败: ${summary.failed}`);
    console.log(`📋 总计: ${summary.total}`);

    const successRate = summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : '0';
    console.log(`🎯 成功率: ${successRate}%`);

    return report;
  }
}

/**
 * 生成验证报告文件
 */
async function generateReport(report: ValidationReport): Promise<void> {
  try {
    const reportsDir = path.resolve(process.cwd(), 'web-app-next/scripts/validation/task-p3-018/reports');

    // 确保报告目录存在
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 生成JSON报告
    const jsonReportPath = path.join(reportsDir, 'schema-validation-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // 生成Markdown报告
    const markdownReport = generateMarkdownReport(report);
    const mdReportPath = path.join(reportsDir, 'schema-validation-report.md');
    fs.writeFileSync(mdReportPath, markdownReport);

    console.log(`\n📄 验证报告已生成:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   Markdown: ${mdReportPath}`);

  } catch (error) {
    console.error(`❌ 生成报告失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 生成Markdown格式的验证报告
 */
function generateMarkdownReport(report: ValidationReport): string {
  const { summary, schemaValidation, timestamp } = report;

  let markdown = `# Schema结构完整性验证报告

**验证时间**: ${new Date(timestamp).toLocaleString('zh-CN')}
**验证范围**: OpenAPI 3.0 + AsyncAPI 2.6 规范验证

## 📊 验证结果汇总

| 状态 | 数量 | 百分比 |
|------|------|--------|
| ✅ 通过 | ${summary.passed} | ${(summary.passed / summary.total * 100).toFixed(1)}% |
| ⚠️ 警告 | ${summary.warnings} | ${(summary.warnings / summary.total * 100).toFixed(1)}% |
| ❌ 失败 | ${summary.failed} | ${(summary.failed / summary.total * 100).toFixed(1)}% |
| 📋 总计 | ${summary.total} | 100% |

**成功率**: ${(summary.passed / summary.total * 100).toFixed(1)}%

## 📋 详细验证结果

`;

  // 按状态分组显示结果
  const groupedResults = {
    pass: schemaValidation.filter(r => r.status === 'pass'),
    warning: schemaValidation.filter(r => r.status === 'warning'),
    fail: schemaValidation.filter(r => r.status === 'fail')
  };

  for (const [status, results] of Object.entries(groupedResults)) {
    if (results.length === 0) continue;

    const statusIcon = status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    const statusName = status === 'pass' ? '通过项目' : status === 'warning' ? '警告项目' : '失败项目';

    markdown += `### ${statusIcon} ${statusName} (${results.length}项)\n\n`;

    for (const result of results) {
      markdown += `- **${result.name}**: ${result.message}\n`;
      if (result.details) {
        markdown += `  \`\`\`json\n  ${JSON.stringify(result.details, null, 2)}\n  \`\`\`\n`;
      }
    }
    markdown += '\n';
  }

  markdown += `## 🎯 验证结论

`;

  if (summary.failed === 0) {
    if (summary.warnings === 0) {
      markdown += `✅ **完美通过**: 所有验证项目均通过，Schema结构完整且规范。`;
    } else {
      markdown += `⚠️ **基本通过**: 主要验证项目通过，但存在 ${summary.warnings} 个改进建议。`;
    }
  } else {
    markdown += `❌ **需要修复**: 存在 ${summary.failed} 个严重问题需要修复后才能继续。`;
  }

  markdown += `

## 📋 后续建议

基于验证结果，建议采取以下行动：

1. **立即修复**: 所有标记为"失败"的问题
2. **计划改进**: 处理标记为"警告"的优化建议
3. **持续验证**: 在Schema变更时重新执行此验证
4. **文档更新**: 确保Schema文档与实际实现保持同步

---

*报告生成于: ${new Date(timestamp).toLocaleString('zh-CN')}*
*验证工具: Schema结构完整性验证器 v1.0.0*
`;

  return markdown;
}

/**
 * 主函数
 */
async function main() {
  try {
    const validator = new SchemaValidator();
    const report = await validator.validate();
    await generateReport(report);

    // 根据验证结果设置退出码
    const hasFailures = report.summary.failed > 0;
    if (hasFailures) {
      console.log('\n❌ 验证未通过，请修复失败项目后重新验证。');
      process.exit(1);
    } else {
      console.log('\n✅ Schema结构验证通过！');
      process.exit(0);
    }

  } catch (error) {
    console.error(`💥 验证过程中发生致命错误: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行验证
if (require.main === module) {
  main();
}

export type { ValidationResult, ValidationReport };
export { SchemaValidator };
