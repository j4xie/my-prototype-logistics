#!/usr/bin/env tsx

/**
 * Mock数据源清查脚本
 *
 * 扫描项目中所有形式的Mock数据源:
 * 1. API路由中的内联Mock数据
 * 2. 组件中的内嵌JSON Mock数据
 * 3. 测试脚本中的Mock数据
 * 4. 配置文件中的Mock数据
 * 5. 静态JSON文件中的Mock数据
 *
 * @author Phase-3技术团队
 * @date 2025-06-03
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Mock数据源信息接口
interface MockDataSource {
  type: 'api-route' | 'component' | 'test-script' | 'config' | 'static-json';
  filePath: string;
  relativePath: string;
  lineNumbers: number[];
  mockData: any[];
  description: string;
  size: number; // 文件大小(字节)
  lastModified: Date;
}

// 清查报告接口
interface MockDataReport {
  summary: {
    totalFiles: number;
    totalMockSources: number;
    byType: Record<string, number>;
    totalSize: number; // 总文件大小
  };
  sources: MockDataSource[];
  timestamp: string;
  recommendations: string[];
}

class MockDataScanner {
  private projectRoot: string;
  private mockSources: MockDataSource[] = [];
  private excludePatterns: string[] = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/scripts/validation/**' // 排除验证脚本自身
  ];

  constructor() {
    this.projectRoot = process.cwd();
    console.log(`🔍 开始Mock数据源清查 - 项目根目录: ${this.projectRoot}`);
  }

  /**
   * 扫描API路由中的Mock数据
   */
  private async scanApiRoutes(): Promise<void> {
    console.log('\n📡 扫描API路由中的Mock数据...');

    try {
      const apiRouteFiles = await glob('web-app-next/src/app/api/**/route.ts', {
        cwd: this.projectRoot,
        ignore: this.excludePatterns
      });

      for (const filePath of apiRouteFiles) {
        await this.analyzeApiRouteFile(filePath);
      }

      console.log(`   发现 ${apiRouteFiles.length} 个API路由文件`);
    } catch (error) {
      console.error(`❌ 扫描API路由失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 分析API路由文件
   */
  private async analyzeApiRouteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = fs.statSync(fullPath);

      const mockData: any[] = [];
      const lineNumbers: number[] = [];

      // 查找Mock数据模式
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 检查是否包含Mock数据模式
        if (this.containsMockData(line)) {
          lineNumbers.push(i + 1);

          // 尝试解析Mock数据
          const extractedData = this.extractMockDataFromLine(line, lines, i);
          if (extractedData) {
            mockData.push(extractedData);
          }
        }
      }

      if (mockData.length > 0) {
        this.mockSources.push({
          type: 'api-route',
          filePath: fullPath,
          relativePath: filePath,
          lineNumbers,
          mockData,
          description: `API路由: ${path.basename(path.dirname(filePath))}`,
          size: stats.size,
          lastModified: stats.mtime
        });

        console.log(`   ✓ ${filePath}: 发现 ${mockData.length} 个Mock数据`);
      }
    } catch (error) {
      console.error(`   ❌ 分析API路由文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 扫描组件中的Mock数据
   */
  private async scanComponents(): Promise<void> {
    console.log('\n🧩 扫描组件中的Mock数据...');

    try {
      const componentFiles = await glob('web-app-next/src/**/*.{tsx,ts,jsx,js}', {
        cwd: this.projectRoot,
        ignore: [...this.excludePatterns, '**/app/api/**'] // 排除API路由
      });

      let processedCount = 0;
      for (const filePath of componentFiles) {
        const hasMock = await this.analyzeComponentFile(filePath);
        if (hasMock) processedCount++;
      }

      console.log(`   检查了 ${componentFiles.length} 个组件文件，发现 ${processedCount} 个包含Mock数据`);
    } catch (error) {
      console.error(`❌ 扫描组件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 分析组件文件
   */
  private async analyzeComponentFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = fs.statSync(fullPath);

      const mockData: any[] = [];
      const lineNumbers: number[] = [];

      // 查找Mock数据模式 - 组件中的Mock模式通常不同
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 检查组件中的Mock数据模式
        if (this.containsComponentMockData(line)) {
          lineNumbers.push(i + 1);

          const extractedData = this.extractComponentMockData(line, lines, i);
          if (extractedData) {
            mockData.push(extractedData);
          }
        }
      }

      if (mockData.length > 0) {
        this.mockSources.push({
          type: 'component',
          filePath: fullPath,
          relativePath: filePath,
          lineNumbers,
          mockData,
          description: `组件Mock数据: ${path.basename(filePath)}`,
          size: stats.size,
          lastModified: stats.mtime
        });

        console.log(`   ✓ ${filePath}: 发现 ${mockData.length} 个Mock数据`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`   ❌ 分析组件文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 扫描测试脚本中的Mock数据
   */
  private async scanTestScripts(): Promise<void> {
    console.log('\n🧪 扫描测试脚本中的Mock数据...');

    try {
      const testFiles = await glob('**/*.{test,spec}.{ts,tsx,js,jsx}', {
        cwd: this.projectRoot,
        ignore: this.excludePatterns
      });

      let processedCount = 0;
      for (const filePath of testFiles) {
        const hasMock = await this.analyzeTestFile(filePath);
        if (hasMock) processedCount++;
      }

      console.log(`   检查了 ${testFiles.length} 个测试文件，发现 ${processedCount} 个包含Mock数据`);
    } catch (error) {
      console.error(`❌ 扫描测试脚本失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 分析测试文件
   */
  private async analyzeTestFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = fs.statSync(fullPath);

      const mockData: any[] = [];
      const lineNumbers: number[] = [];

      // 查找测试中的Mock数据模式
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (this.containsTestMockData(line)) {
          lineNumbers.push(i + 1);

          const extractedData = this.extractTestMockData(line, lines, i);
          if (extractedData) {
            mockData.push(extractedData);
          }
        }
      }

      if (mockData.length > 0) {
        this.mockSources.push({
          type: 'test-script',
          filePath: fullPath,
          relativePath: filePath,
          lineNumbers,
          mockData,
          description: `测试Mock数据: ${path.basename(filePath)}`,
          size: stats.size,
          lastModified: stats.mtime
        });

        console.log(`   ✓ ${filePath}: 发现 ${mockData.length} 个Mock数据`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`   ❌ 分析测试文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 扫描静态JSON文件
   */
  private async scanStaticJsonFiles(): Promise<void> {
    console.log('\n📄 扫描静态JSON Mock文件...');

    try {
      const jsonFiles = await glob('**/*.json', {
        cwd: this.projectRoot,
        ignore: [...this.excludePatterns, '**/package*.json', '**/tsconfig*.json']
      });

      let processedCount = 0;
      for (const filePath of jsonFiles) {
        const isMock = await this.analyzeJsonFile(filePath);
        if (isMock) processedCount++;
      }

      console.log(`   检查了 ${jsonFiles.length} 个JSON文件，发现 ${processedCount} 个Mock数据文件`);
    } catch (error) {
      console.error(`❌ 扫描静态JSON文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 分析JSON文件
   */
  private async analyzeJsonFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = fs.statSync(fullPath);

      // 检查是否是Mock数据文件
      if (this.isLikelyMockJsonFile(filePath, content)) {
        let parsedData;
        try {
          parsedData = JSON.parse(content);
        } catch {
          return false; // 无效的JSON
        }

        this.mockSources.push({
          type: 'static-json',
          filePath: fullPath,
          relativePath: filePath,
          lineNumbers: [1], // JSON文件整体算作一行
          mockData: [parsedData],
          description: `静态Mock JSON文件: ${path.basename(filePath)}`,
          size: stats.size,
          lastModified: stats.mtime
        });

        console.log(`   ✓ ${filePath}: Mock JSON数据文件`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`   ❌ 分析JSON文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 检查行是否包含Mock数据(API路由)
   */
  private containsMockData(line: string): boolean {
    const mockPatterns = [
      /return\s+NextResponse\.json\(/,
      /Response\.json\(/,
      /return.*\{.*success.*data.*\}/,
      /mockData\s*[=:]/,
      /mock.*[=:]/i,
      /const.*data.*=.*\{/,
      /const.*response.*=.*\{/
    ];

    return mockPatterns.some(pattern => pattern.test(line));
  }

  /**
   * 检查行是否包含组件Mock数据
   */
  private containsComponentMockData(line: string): boolean {
    const mockPatterns = [
      /const.*mock.*data/i,
      /mock.*=.*\[/i,
      /dummy.*data/i,
      /sample.*data/i,
      /test.*data/i,
      /fake.*data/i
    ];

    return mockPatterns.some(pattern => pattern.test(line));
  }

  /**
   * 检查行是否包含测试Mock数据
   */
  private containsTestMockData(line: string): boolean {
    const mockPatterns = [
      /mock\(/,
      /jest\.mock/,
      /vi\.mock/,
      /mockImplementation/,
      /mockReturnValue/,
      /when\(/,
      /stub\(/,
      /spy\(/
    ];

    return mockPatterns.some(pattern => pattern.test(line));
  }

  /**
   * 从行中提取Mock数据
   */
  private extractMockDataFromLine(line: string, lines: string[], startIndex: number): any {
    try {
      // 简单的数据提取逻辑 - 查找JSON对象
      const jsonMatch = line.match(/\{.*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return { pattern: 'complex_object', preview: line.trim() };
        }
      }

      return { pattern: 'detected', preview: line.trim() };
    } catch {
      return null;
    }
  }

  /**
   * 从组件中提取Mock数据
   */
  private extractComponentMockData(line: string, lines: string[], startIndex: number): any {
    try {
      return {
        type: 'component_mock',
        preview: line.trim(),
        context: 'component_data'
      };
    } catch {
      return null;
    }
  }

  /**
   * 从测试中提取Mock数据
   */
  private extractTestMockData(line: string, lines: string[], startIndex: number): any {
    try {
      return {
        type: 'test_mock',
        preview: line.trim(),
        context: 'test_data'
      };
    } catch {
      return null;
    }
  }

  /**
   * 判断是否是Mock JSON文件
   */
  private isLikelyMockJsonFile(filePath: string, content: string): boolean {
    const mockIndicators = [
      /mock/i,
      /dummy/i,
      /sample/i,
      /test.*data/i,
      /fake/i
    ];

    const pathIndicator = mockIndicators.some(pattern => pattern.test(filePath));
    const contentIndicator = content.length > 100 && content.includes('{'); // 非空的JSON

    return pathIndicator || (contentIndicator && filePath.includes('data'));
  }

  /**
   * 生成清查报告
   */
  private generateReport(): MockDataReport {
    const byType: Record<string, number> = {};
    let totalSize = 0;

    for (const source of this.mockSources) {
      byType[source.type] = (byType[source.type] || 0) + 1;
      totalSize += source.size;
    }

    const recommendations: string[] = [];

    // 生成建议
    if (this.mockSources.length > 10) {
      recommendations.push('检测到大量Mock数据源，建议统一迁移到中央Mock服务');
    }

    if (byType['api-route'] > 0) {
      recommendations.push(`发现 ${byType['api-route']} 个API路由包含Mock数据，建议迁移到MSW处理器`);
    }

    if (byType['component'] > 0) {
      recommendations.push(`发现 ${byType['component']} 个组件包含Mock数据，建议使用统一的Mock API服务`);
    }

    if (byType['static-json'] > 0) {
      recommendations.push(`发现 ${byType['static-json']} 个静态JSON Mock文件，建议整合到Mock数据管理器`);
    }

    return {
      summary: {
        totalFiles: this.mockSources.length,
        totalMockSources: this.mockSources.reduce((sum, source) => sum + source.mockData.length, 0),
        byType,
        totalSize
      },
      sources: this.mockSources,
      timestamp: new Date().toISOString(),
      recommendations
    };
  }

  /**
   * 运行完整扫描
   */
  public async scan(): Promise<MockDataReport> {
    console.log('🔍 开始Mock数据源清查...\n');

    // 执行各种扫描
    await this.scanApiRoutes();
    await this.scanComponents();
    await this.scanTestScripts();
    await this.scanStaticJsonFiles();

    // 生成报告
    const report = this.generateReport();

    // 显示汇总结果
    console.log('\n📊 Mock数据源清查结果汇总:');
    console.log(`📁 发现文件: ${report.summary.totalFiles}`);
    console.log(`📋 Mock数据源: ${report.summary.totalMockSources}`);
    console.log(`📏 总大小: ${(report.summary.totalSize / 1024).toFixed(2)} KB`);

    console.log('\n📂 按类型分布:');
    for (const [type, count] of Object.entries(report.summary.byType)) {
      const typeName = this.getTypeDisplayName(type);
      console.log(`   ${typeName}: ${count}`);
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 建议:');
      report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    return report;
  }

  /**
   * 获取类型显示名称
   */
  private getTypeDisplayName(type: string): string {
    const typeNames = {
      'api-route': '🚀 API路由',
      'component': '🧩 组件',
      'test-script': '🧪 测试脚本',
      'config': '⚙️ 配置文件',
      'static-json': '📄 静态JSON'
    };

    return typeNames[type as keyof typeof typeNames] || type;
  }
}

/**
 * 生成详细报告文件
 */
async function generateDetailedReport(report: MockDataReport): Promise<void> {
  try {
    const reportsDir = path.resolve(process.cwd(), 'web-app-next/scripts/validation/task-p3-018/reports');

    // 确保报告目录存在
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 生成JSON报告
    const jsonReportPath = path.join(reportsDir, 'mock-data-scan-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // 生成Markdown报告
    const markdownReport = generateMarkdownReport(report);
    const mdReportPath = path.join(reportsDir, 'mock-data-scan-report.md');
    fs.writeFileSync(mdReportPath, markdownReport);

    console.log(`\n📄 Mock数据清查报告已生成:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   Markdown: ${mdReportPath}`);

  } catch (error) {
    console.error(`❌ 生成报告失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 生成Markdown格式的清查报告
 */
function generateMarkdownReport(report: MockDataReport): string {
  const { summary, sources, timestamp, recommendations } = report;

  let markdown = `# Mock数据源清查报告

**扫描时间**: ${new Date(timestamp).toLocaleString('zh-CN')}
**扫描范围**: 全项目Mock数据源清查

## 📊 清查结果汇总

| 指标 | 数量 | 说明 |
|------|------|------|
| 📁 文件数量 | ${summary.totalFiles} | 包含Mock数据的文件 |
| 📋 Mock数据源 | ${summary.totalMockSources} | 总Mock数据条目 |
| 📏 总大小 | ${(summary.totalSize / 1024).toFixed(2)} KB | 所有Mock文件总大小 |

### 📂 按类型分布

| 类型 | 数量 | 百分比 |
|------|------|--------|
`;

  const total = Object.values(summary.byType).reduce((sum, count) => sum + count, 0);
  for (const [type, count] of Object.entries(summary.byType)) {
    const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0';
    const typeName = getTypeDisplayName(type);
    markdown += `| ${typeName} | ${count} | ${percentage}% |\n`;
  }

  markdown += `\n## 📋 详细清查结果

`;

  // 按类型分组显示Mock数据源
  const groupedSources = sources.reduce((groups, source) => {
    if (!groups[source.type]) {
      groups[source.type] = [];
    }
    groups[source.type].push(source);
    return groups;
  }, {} as Record<string, MockDataSource[]>);

  for (const [type, typeSources] of Object.entries(groupedSources)) {
    const typeName = getTypeDisplayName(type);
    markdown += `### ${typeName} (${typeSources.length}个文件)\n\n`;

    for (const source of typeSources) {
      markdown += `#### ${source.description}\n`;
      markdown += `- **文件路径**: \`${source.relativePath}\`\n`;
      markdown += `- **Mock数据数量**: ${source.mockData.length}\n`;
      markdown += `- **文件大小**: ${(source.size / 1024).toFixed(2)} KB\n`;
      markdown += `- **最后修改**: ${source.lastModified.toLocaleString('zh-CN')}\n`;

      if (source.lineNumbers.length > 0) {
        markdown += `- **位置**: 第 ${source.lineNumbers.join(', ')} 行\n`;
      }

      markdown += '\n';
    }
  }

  markdown += `## 💡 迁移建议

`;

  if (recommendations.length > 0) {
    recommendations.forEach((rec, i) => {
      markdown += `${i + 1}. ${rec}\n`;
    });
  } else {
    markdown += '暂无特殊建议。\n';
  }

  markdown += `\n## 🎯 下一步行动

基于清查结果，建议采取以下行动：

1. **优先处理**: API路由中的Mock数据，迁移到MSW处理器
2. **统一管理**: 整合散落的Mock数据到中央Mock服务
3. **清理冗余**: 删除过期或重复的Mock数据文件
4. **建立规范**: 制定Mock数据管理和使用规范

---

*报告生成于: ${new Date(timestamp).toLocaleString('zh-CN')}*
*扫描工具: Mock数据源清查器 v1.0.0*
`;

  return markdown;
}

/**
 * 获取类型显示名称 (独立函数版本)
 */
function getTypeDisplayName(type: string): string {
  const typeNames = {
    'api-route': '🚀 API路由',
    'component': '🧩 组件',
    'test-script': '🧪 测试脚本',
    'config': '⚙️ 配置文件',
    'static-json': '📄 静态JSON'
  };

  return typeNames[type as keyof typeof typeNames] || type;
}

/**
 * 主函数
 */
async function main() {
  try {
    const scanner = new MockDataScanner();
    const report = await scanner.scan();
    await generateDetailedReport(report);

    console.log('\n✅ Mock数据源清查完成！');
    process.exit(0);

  } catch (error) {
    console.error(`💥 清查过程中发生致命错误: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行清查
if (require.main === module) {
  main();
}

export type { MockDataSource, MockDataReport };
export { MockDataScanner };
