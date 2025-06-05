#!/usr/bin/env tsx

/**
 * MSW技术方案可行性验证脚本
 * TASK-P3-017B Day 3 - 技术验证
 * 遵循规范: development-management-unified.mdc
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ValidationResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string;
  timestamp: string;
}

class MSWValidationSuite {
  private results: ValidationResult[] = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = join(__dirname, '../../../');
  }

  private addResult(result: Omit<ValidationResult, 'timestamp'>) {
    this.results.push({
      ...result,
      timestamp: new Date().toISOString()
    });
  }

  private log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
    const symbols = {
      info: 'ℹ',
      success: '✅',
      error: '❌',
      warn: '⚠️'
    };
    console.log(`${symbols[type]} ${message}`);
  }

  /**
   * 验证MSW核心依赖
   */
  async validateMSWDependencies(): Promise<void> {
    this.log('验证MSW核心依赖...', 'info');

    try {
      // 检查package.json中的MSW依赖
      const packageJsonPath = join(this.projectRoot, 'package.json');
      if (!existsSync(packageJsonPath)) {
        this.addResult({
          name: 'Package.json检查',
          status: 'FAIL',
          message: 'package.json文件不存在'
        });
        return;
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // 检查MSW版本
      const mswVersion = dependencies['msw'];
      if (!mswVersion) {
        this.addResult({
          name: 'MSW依赖检查',
          status: 'FAIL',
          message: 'MSW依赖未安装'
        });
      } else if (!mswVersion.includes('2.')) {
        this.addResult({
          name: 'MSW版本检查',
          status: 'WARN',
          message: `当前MSW版本: ${mswVersion}，建议使用v2.0+`
        });
      } else {
        this.addResult({
          name: 'MSW版本检查',
          status: 'PASS',
          message: `MSW版本符合要求: ${mswVersion}`
        });
      }

      // 检查相关工具依赖
      const requiredDeps = {
        '@hey-api/openapi-ts': 'OpenAPI TypeScript生成器',
        '@mswjs/source': 'MSW源码生成器',
        'typescript': 'TypeScript支持',
        'tsx': 'TypeScript执行器'
      };

      for (const [dep, description] of Object.entries(requiredDeps)) {
        if (dependencies[dep]) {
          this.addResult({
            name: `${description}检查`,
            status: 'PASS',
            message: `已安装: ${dependencies[dep]}`
          });
        } else {
          this.addResult({
            name: `${description}检查`,
            status: 'WARN',
            message: `建议安装: ${dep}`
          });
        }
      }

    } catch (error) {
      this.addResult({
        name: 'MSW依赖验证',
        status: 'FAIL',
        message: '依赖验证过程出错',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 验证Next.js App Router兼容性
   */
  async validateNextJSCompatibility(): Promise<void> {
    this.log('验证Next.js App Router兼容性...', 'info');

    try {
      // 检查Next.js版本
      const packageJsonPath = join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const nextVersion = dependencies['next'];
      if (!nextVersion) {
        this.addResult({
          name: 'Next.js检查',
          status: 'FAIL',
          message: 'Next.js依赖未安装'
        });
        return;
      }

      // 检查是否使用App Router
      const appDirPath = join(this.projectRoot, 'src/app');
      if (existsSync(appDirPath)) {
        this.addResult({
          name: 'App Router检查',
          status: 'PASS',
          message: 'App Router目录结构已存在'
        });

        // 检查layout.tsx
        const layoutPath = join(appDirPath, 'layout.tsx');
        if (existsSync(layoutPath)) {
          this.addResult({
            name: 'Root Layout检查',
            status: 'PASS',
            message: 'root layout.tsx文件存在'
          });
        } else {
          this.addResult({
            name: 'Root Layout检查',
            status: 'WARN',
            message: 'root layout.tsx文件不存在，需要创建'
          });
        }
      } else {
        this.addResult({
          name: 'App Router检查',
          status: 'WARN',
          message: 'App Router目录不存在，使用Pages Router'
        });
      }

      this.addResult({
        name: 'Next.js版本检查',
        status: nextVersion.includes('14.') ? 'PASS' : 'WARN',
        message: `Next.js版本: ${nextVersion}`
      });

    } catch (error) {
      this.addResult({
        name: 'Next.js兼容性验证',
        status: 'FAIL',
        message: '兼容性验证过程出错',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 验证MSW配置文件结构
   */
  async validateMSWConfiguration(): Promise<void> {
    this.log('验证MSW配置文件结构...', 'info');

    try {
      const mocksDir = join(this.projectRoot, 'src/mocks');

      if (!existsSync(mocksDir)) {
        this.addResult({
          name: 'Mocks目录检查',
          status: 'WARN',
          message: 'src/mocks目录不存在，需要创建'
        });
        return;
      }

      // 检查核心配置文件
      const coreFiles = {
        'setup.ts': 'MSW统一设置入口',
        'browser.ts': '浏览器端Worker配置',
        'node.ts': 'Node端Server配置'
      };

      for (const [file, description] of Object.entries(coreFiles)) {
        const filePath = join(mocksDir, file);
        if (existsSync(filePath)) {
          this.addResult({
            name: `${description}检查`,
            status: 'PASS',
            message: `${file}文件存在`
          });
        } else {
          this.addResult({
            name: `${description}检查`,
            status: 'WARN',
            message: `${file}文件不存在，需要创建`
          });
        }
      }

      // 检查目录结构
      const expectedDirs = ['handlers', 'data', 'schemas', 'config'];
      for (const dir of expectedDirs) {
        const dirPath = join(mocksDir, dir);
        if (existsSync(dirPath)) {
          this.addResult({
            name: `${dir}目录检查`,
            status: 'PASS',
            message: `${dir}/目录存在`
          });
        } else {
          this.addResult({
            name: `${dir}目录检查`,
            status: 'WARN',
            message: `${dir}/目录不存在，需要创建`
          });
        }
      }

    } catch (error) {
      this.addResult({
        name: 'MSW配置验证',
        status: 'FAIL',
        message: '配置验证过程出错',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 验证OpenAPI工具链
   */
  async validateOpenAPIToolchain(): Promise<void> {
    this.log('验证OpenAPI工具链...', 'info');

    try {
      // 检查OpenAPI Schema文件
      const schemaPath = join(this.projectRoot, 'src/mocks/schemas/openapi.yaml');
      if (existsSync(schemaPath)) {
        this.addResult({
          name: 'OpenAPI Schema检查',
          status: 'PASS',
          message: 'openapi.yaml文件存在'
        });

        // 简单验证YAML格式
        try {
          const schemaContent = readFileSync(schemaPath, 'utf8');
          if (schemaContent.includes('openapi:') && schemaContent.includes('paths:')) {
            this.addResult({
              name: 'Schema格式检查',
              status: 'PASS',
              message: 'OpenAPI Schema基本格式正确'
            });
          } else {
            this.addResult({
              name: 'Schema格式检查',
              status: 'WARN',
              message: 'OpenAPI Schema格式可能有问题'
            });
          }
        } catch (error) {
          this.addResult({
            name: 'Schema格式检查',
            status: 'FAIL',
            message: 'Schema文件读取失败',
            details: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        this.addResult({
          name: 'OpenAPI Schema检查',
          status: 'WARN',
          message: 'openapi.yaml文件不存在，需要创建'
        });
      }

      // 检查生成的TypeScript类型文件
      const typesPath = join(this.projectRoot, 'src/mocks/types/api.d.ts');
      if (existsSync(typesPath)) {
        this.addResult({
          name: 'TypeScript类型文件检查',
          status: 'PASS',
          message: 'api.d.ts类型文件存在'
        });
      } else {
        this.addResult({
          name: 'TypeScript类型文件检查',
          status: 'WARN',
          message: 'api.d.ts类型文件不存在，需要生成'
        });
      }

    } catch (error) {
      this.addResult({
        name: 'OpenAPI工具链验证',
        status: 'FAIL',
        message: '工具链验证过程出错',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 验证环境变量配置
   */
  async validateEnvironmentConfig(): Promise<void> {
    this.log('验证环境变量配置...', 'info');

    try {
      // 检查.env文件
      const envFiles = ['.env.local', '.env.development', '.env.test'];
      let hasEnvConfig = false;

      for (const envFile of envFiles) {
        const envPath = join(this.projectRoot, envFile);
        if (existsSync(envPath)) {
          const envContent = readFileSync(envPath, 'utf8');
          if (envContent.includes('NEXT_PUBLIC_MOCK_ENABLED')) {
            this.addResult({
              name: `${envFile}配置检查`,
              status: 'PASS',
              message: `${envFile}包含Mock配置`
            });
            hasEnvConfig = true;
          } else {
            this.addResult({
              name: `${envFile}配置检查`,
              status: 'WARN',
              message: `${envFile}缺少Mock配置`
            });
          }
        }
      }

      if (!hasEnvConfig) {
        this.addResult({
          name: '环境变量配置',
          status: 'WARN',
          message: '未找到Mock相关环境变量配置'
        });
      }

      // 检查当前环境变量
      const currentMockEnabled = process.env.NEXT_PUBLIC_MOCK_ENABLED;
      this.addResult({
        name: '当前Mock状态',
        status: 'PASS',
        message: `NEXT_PUBLIC_MOCK_ENABLED=${currentMockEnabled || 'undefined'}`
      });

    } catch (error) {
      this.addResult({
        name: '环境变量验证',
        status: 'FAIL',
        message: '环境变量验证过程出错',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 生成验证报告
   */
  private generateReport(): void {
    const reportDir = join(this.projectRoot, 'scripts/validation/task-p3-017b/reports');

    // 确保报告目录存在
    if (!existsSync(reportDir)) {
      require('fs').mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = join(reportDir, 'msw-validation-report.json');

    const report = {
      taskId: 'TASK-P3-017B',
      validationType: 'MSW技术方案可行性验证',
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        warned: this.results.filter(r => r.status === 'WARN').length,
        failed: this.results.filter(r => r.status === 'FAIL').length
      },
      results: this.results
    };

    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 生成Markdown报告
    this.generateMarkdownReport(report, reportDir);

    this.log(`验证报告已生成: ${reportPath}`, 'success');
  }

  private generateMarkdownReport(report: any, reportDir: string): void {
    const markdownPath = join(reportDir, 'msw-validation-report.md');

    let markdown = `# MSW技术方案可行性验证报告

**任务ID**: ${report.taskId}
**验证类型**: ${report.validationType}
**验证时间**: ${report.timestamp}

## 📊 验证摘要

- **总计**: ${report.summary.total}
- **通过**: ${report.summary.passed} ✅
- **警告**: ${report.summary.warned} ⚠️
- **失败**: ${report.summary.failed} ❌

## 📋 详细结果

`;

    for (const result of report.results) {
      const statusSymbol = {
        'PASS': '✅',
        'WARN': '⚠️',
        'FAIL': '❌'
      }[result.status as 'PASS' | 'WARN' | 'FAIL'];

      markdown += `### ${statusSymbol} ${result.name}

**状态**: ${result.status}
**消息**: ${result.message}
**时间**: ${result.timestamp}

`;

      if (result.details) {
        markdown += `**详情**: ${result.details}

`;
      }
    }

    markdown += `## 🎯 建议行动

`;

    const warnings = report.results.filter((r: any) => r.status === 'WARN');
    const failures = report.results.filter((r: any) => r.status === 'FAIL');

    if (failures.length > 0) {
      markdown += `### 🚨 优先处理（失败项）

`;
      failures.forEach((failure: any) => {
        markdown += `- **${failure.name}**: ${failure.message}
`;
      });
    }

    if (warnings.length > 0) {
      markdown += `### ⚠️ 建议改进（警告项）

`;
      warnings.forEach((warning: any) => {
        markdown += `- **${warning.name}**: ${warning.message}
`;
      });
    }

    if (failures.length === 0 && warnings.length === 0) {
      markdown += `### 🎉 验证通过

所有验证项目均已通过，MSW技术方案可行性得到确认。

`;
    }

    markdown += `---

**生成时间**: ${new Date().toISOString()}
**遵循规范**: development-management-unified.mdc
`;

    writeFileSync(markdownPath, markdown);
  }

  /**
   * 运行完整验证套件
   */
  async runFullValidation(): Promise<void> {
    this.log('🚀 开始MSW技术方案可行性验证', 'info');
    console.log('='.repeat(60));

    await this.validateMSWDependencies();
    await this.validateNextJSCompatibility();
    await this.validateMSWConfiguration();
    await this.validateOpenAPIToolchain();
    await this.validateEnvironmentConfig();

    console.log('='.repeat(60));

    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      warned: this.results.filter(r => r.status === 'WARN').length,
      failed: this.results.filter(r => r.status === 'FAIL').length
    };

    this.log(`验证完成! 总计: ${summary.total}, 通过: ${summary.passed}, 警告: ${summary.warned}, 失败: ${summary.failed}`, 'info');

    if (summary.failed > 0) {
      this.log('存在验证失败项，请检查报告详情', 'error');
    } else if (summary.warned > 0) {
      this.log('存在警告项，建议优化配置', 'warn');
    } else {
      this.log('所有验证项目通过! MSW技术方案可行性确认', 'success');
    }

    this.generateReport();
  }
}

// 主执行函数
async function main() {
  const validator = new MSWValidationSuite();
  await validator.runFullValidation();
}

// 如果作为脚本直接执行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MSWValidationSuite };
