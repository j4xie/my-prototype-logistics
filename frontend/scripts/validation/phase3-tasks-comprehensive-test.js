/**
 * Phase-3 Tasks P3-011/012/013 综合验证脚本
 *
 * 任务清单:
 * - TASK-P3-011: 性能监控系统建立验证
 * - TASK-P3-012: 安全性现代化实现验证
 * - TASK-P3-013: 主题系统现代化验证
 */

const fs = require('fs');
const path = require('path');

class Phase3TasksValidator {
  constructor() {
    this.results = {
      'TASK-P3-011': { name: '性能监控系统', status: 'pending', details: [] },
      'TASK-P3-012': { name: '安全性现代化', status: 'pending', details: [] },
      'TASK-P3-013': { name: '主题系统现代化', status: 'pending', details: [] }
    };

    // 修复路径问题 - 使用项目根目录
    this.projectRoot = path.resolve(__dirname, '../..');
    this.webAppNextPath = path.join(this.projectRoot, 'web-app-next/src');
    // this.webAppPath = path.join(this.projectRoot, 'web-app/src'); // Legacy path - removed
    this.docsPath = path.join(this.projectRoot, 'docs');
  }

  // ========================= TASK-P3-011: 性能监控系统验证 =========================

  async validatePerformanceMonitoring() {
    const task = 'TASK-P3-011';
    this.log(task, '开始验证性能监控系统...');

    try {
      // 1. AI性能监控组件验证
      const aiMonitorPath = path.join(this.webAppNextPath, 'components/ui/ai-performance-monitor.tsx');
      if (this.fileExists(aiMonitorPath)) {
        const content = fs.readFileSync(aiMonitorPath, 'utf8');

        // 检查关键功能
        const checks = [
          { name: '缓存性能监控', pattern: /cache.*hitRate.*l1Hits.*l2Hits/s },
          { name: '批量处理监控', pattern: /batch.*totalRequests.*successfulRequests/s },
          { name: '实时数据更新', pattern: /useEffect.*updateMetrics.*setInterval/s },
          { name: '性能指标展示', pattern: /命中率.*平均耗时.*队列大小/s },
          { name: '开发环境限制', pattern: /process\.env\.NODE_ENV.*development/s }
        ];

        let passedChecks = 0;
        checks.forEach(check => {
          if (check.pattern.test(content)) {
            passedChecks++;
            this.log(task, `✅ ${check.name} - 已实现`);
          } else {
            this.log(task, `❌ ${check.name} - 缺失`);
          }
        });

        this.results[task].details.push(`AI性能监控组件: ${passedChecks}/${checks.length} 功能完整`);
      } else {
        this.log(task, `❌ AI性能监控组件文件不存在: ${aiMonitorPath}`);
        this.results[task].details.push('❌ AI性能监控组件文件缺失');
      }

      // 2. AI缓存管理器验证
      const cacheManagerPath = path.join(this.webAppNextPath, 'lib/ai-cache-manager.ts');
      if (this.fileExists(cacheManagerPath)) {
        const content = fs.readFileSync(cacheManagerPath, 'utf8');

        const cacheChecks = [
          { name: '双层缓存架构', pattern: /L1.*L2.*cache/s },
          { name: '性能统计', pattern: /CacheStatistics.*l1Hits.*l2Hits.*totalRequests/s },
          { name: '智能策略', pattern: /CacheStrategy.*ttl.*priority/s },
          { name: '缓存清理', pattern: /cleanup.*expired/s },
          { name: '全局实例', pattern: /getGlobalCacheManager/s }
        ];

        let passedCacheChecks = 0;
        cacheChecks.forEach(check => {
          if (check.pattern.test(content)) {
            passedCacheChecks++;
            this.log(task, `✅ ${check.name} - 已实现`);
          } else {
            this.log(task, `❌ ${check.name} - 缺失`);
          }
        });

        this.results[task].details.push(`AI缓存管理器: ${passedCacheChecks}/${cacheChecks.length} 功能完整`);
      } else {
        this.log(task, `❌ AI缓存管理器文件不存在: ${cacheManagerPath}`);
        this.results[task].details.push('❌ AI缓存管理器文件缺失');
      }

      // 3. AI批量控制器验证
      const batchControllerPath = path.join(this.webAppNextPath, 'lib/ai-batch-controller.ts');
      if (this.fileExists(batchControllerPath)) {
        this.log(task, '✅ AI批量控制器 - 已实现');
        this.results[task].details.push('✅ AI批量控制器已实现');
      } else {
        this.log(task, `❌ AI批量控制器文件不存在: ${batchControllerPath}`);
        this.results[task].details.push('❌ AI批量控制器文件缺失');
      }

      // 4. 性能钩子验证
      const hookPath = path.join(this.webAppNextPath, 'hooks/useAiDataFetch.ts');
      if (this.fileExists(hookPath)) {
        this.log(task, '✅ AI数据获取钩子 - 已实现');
        this.results[task].details.push('✅ AI数据获取钩子已实现');
      } else {
        this.log(task, `❌ AI数据获取钩子文件不存在: ${hookPath}`);
        this.results[task].details.push('❌ AI数据获取钩子文件缺失');
      }

      // 判断任务完成状态
      const totalDetails = this.results[task].details.length;
      const completedDetails = this.results[task].details.filter(d => d.includes('✅')).length;

      if (completedDetails >= totalDetails * 0.8) {
        this.results[task].status = 'completed';
        this.log(task, '✅ 性能监控系统验证完成');
      } else {
        this.results[task].status = 'partial';
        this.log(task, '⚠️ 性能监控系统部分完成');
      }

    } catch (error) {
      this.log(task, `❌ 验证失败: ${error.message}`);
      this.results[task].status = 'failed';
      this.results[task].details.push(`验证失败: ${error.message}`);
    }
  }

  // ========================= TASK-P3-012: 安全性现代化验证 =========================

  async validateSecurityModernization() {
    const task = 'TASK-P3-012';
    this.log(task, '开始验证安全性现代化...');

    try {
      // 1. Next.js 认证系统验证
      const authHookPath = path.join(this.webAppNextPath, 'hooks/useMockAuth.ts');
      if (this.fileExists(authHookPath)) {
        const content = fs.readFileSync(authHookPath, 'utf8');

        const authChecks = [
          { name: '多环境认证', pattern: /isPreviewMode.*isDevelopment.*生产环境/s },
          { name: '用户状态管理', pattern: /AuthState.*user.*isAuthenticated.*isLoading/s },
          { name: '权限控制', pattern: /permissions.*admin.*farming.*processing/s },
          { name: 'Token管理', pattern: /localStorage.*auth_token.*user_info/s }
        ];

        let passedAuthChecks = 0;
        authChecks.forEach(check => {
          if (check.pattern.test(content)) {
            passedAuthChecks++;
            this.log(task, `✅ ${check.name} - 已实现`);
          } else {
            this.log(task, `❌ ${check.name} - 缺失`);
          }
        });

        this.results[task].details.push(`Next.js认证系统: ${passedAuthChecks}/${authChecks.length} 功能完整`);
      } else {
        this.log(task, `❌ Next.js认证Hook文件不存在: ${authHookPath}`);
        this.results[task].details.push('❌ Next.js认证Hook文件缺失');
      }

      // 2. 传统安全模块验证
      const securityModules = [
        'csrf-protection.js',
        'input-validator.js',
        'api-rate-limiter.js'
      ];

      let securityModulesCount = 0;
      securityModules.forEach(module => {
        const modulePath = path.join(this.webAppPath, 'security', module);
        if (this.fileExists(modulePath)) {
          securityModulesCount++;
          this.log(task, `✅ ${module} - 已实现`);
        } else {
          this.log(task, `❌ ${module} - 缺失: ${modulePath}`);
        }
      });

      this.results[task].details.push(`传统安全模块: ${securityModulesCount}/${securityModules.length} 模块完整`);

      // 3. API认证文档验证
      const authDocPath = path.join(this.docsPath, 'api/authentication.md');
      if (this.fileExists(authDocPath)) {
        const content = fs.readFileSync(authDocPath, 'utf8');
        if (content.includes('JWT') && content.includes('Bearer') && content.includes('认证API')) {
          this.log(task, '✅ API认证文档 - 完整');
          this.results[task].details.push('✅ API认证文档完整');
        } else {
          this.log(task, '❌ API认证文档内容不完整');
          this.results[task].details.push('❌ API认证文档内容不完整');
        }
      } else {
        this.log(task, `❌ API认证文档不存在: ${authDocPath}`);
        this.results[task].details.push('❌ API认证文档缺失');
      }

      // 4. OpenAPI安全配置验证
      const openApiPath = path.join(this.docsPath, 'api/openapi.yaml');
      if (this.fileExists(openApiPath)) {
        const content = fs.readFileSync(openApiPath, 'utf8');
        if (content.includes('BearerAuth') && content.includes('JWT') && content.includes('security:')) {
          this.log(task, '✅ OpenAPI安全配置 - 已配置');
          this.results[task].details.push('✅ OpenAPI安全配置已配置');
        } else {
          this.log(task, '❌ OpenAPI安全配置不完整');
          this.results[task].details.push('❌ OpenAPI安全配置不完整');
        }
      } else {
        this.log(task, `❌ OpenAPI文档不存在: ${openApiPath}`);
        this.results[task].details.push('❌ OpenAPI文档缺失');
      }

      // 判断任务完成状态
      const totalDetails = this.results[task].details.length;
      const completedDetails = this.results[task].details.filter(d => d.includes('✅')).length;

      if (completedDetails >= totalDetails * 0.7) {
        this.results[task].status = 'completed';
        this.log(task, '✅ 安全性现代化验证完成');
      } else {
        this.results[task].status = 'partial';
        this.log(task, '⚠️ 安全性现代化部分完成');
      }

    } catch (error) {
      this.log(task, `❌ 验证失败: ${error.message}`);
      this.results[task].status = 'failed';
      this.results[task].details.push(`验证失败: ${error.message}`);
    }
  }

  // ========================= TASK-P3-013: 主题系统现代化验证 =========================

  async validateThemeModernization() {
    const task = 'TASK-P3-013';
    this.log(task, '开始验证主题系统现代化...');

    try {
      // 1. CSS变量系统验证
      const variablesPath = path.join(this.webAppNextPath, 'styles/globals/variables.css');
      if (this.fileExists(variablesPath)) {
        const content = fs.readFileSync(variablesPath, 'utf8');

        const themeChecks = [
          { name: '颜色系统', pattern: /--background.*--foreground.*--primary.*--secondary/s },
          { name: '暗色模式', pattern: /\.dark.*--background.*--foreground/s },
          { name: '间距系统', pattern: /--spacing-xs.*--spacing-sm.*--spacing-md/s },
          { name: '字体系统', pattern: /--font-size.*--font-weight/s },
          { name: '阴影系统', pattern: /--shadow-sm.*--shadow-md.*--shadow-lg/s },
          { name: 'Z-Index系统', pattern: /--z-dropdown.*--z-modal.*--z-toast/s },
          { name: '过渡动画', pattern: /--transition-fast.*--transition-normal/s }
        ];

        let passedThemeChecks = 0;
        themeChecks.forEach(check => {
          if (check.pattern.test(content)) {
            passedThemeChecks++;
            this.log(task, `✅ ${check.name} - 已实现`);
          } else {
            this.log(task, `❌ ${check.name} - 缺失`);
          }
        });

        this.results[task].details.push(`CSS变量系统: ${passedThemeChecks}/${themeChecks.length} 功能完整`);
      } else {
        this.log(task, `❌ CSS变量文件不存在: ${variablesPath}`);
        this.results[task].details.push('❌ CSS变量文件缺失');
      }

      // 2. 主题状态管理验证
      const appStorePath = path.join(this.webAppNextPath, 'store/appStore.ts');
      if (this.fileExists(appStorePath)) {
        const content = fs.readFileSync(appStorePath, 'utf8');

        if (content.includes('setTheme') && content.includes('dark') && content.includes('documentElement.classList.toggle')) {
          this.log(task, '✅ Zustand主题状态管理 - 已实现');
          this.results[task].details.push('✅ Zustand主题状态管理已实现');
        } else {
          this.log(task, '❌ Zustand主题状态管理不完整');
          this.results[task].details.push('❌ Zustand主题状态管理不完整');
        }
      } else {
        this.log(task, `❌ AppStore文件不存在: ${appStorePath}`);
        this.results[task].details.push('❌ AppStore文件缺失');
      }

      // 3. 全局样式验证
      const globalStylePath = path.join(this.webAppNextPath, 'app/globals.css');
      if (this.fileExists(globalStylePath)) {
        const content = fs.readFileSync(globalStylePath, 'utf8');

        if (content.includes('variables.css') && content.includes('hsl(var(--background))')) {
          this.log(task, '✅ 全局样式系统 - 已配置');
          this.results[task].details.push('✅ 全局样式系统已配置');
        } else {
          this.log(task, '❌ 全局样式系统配置不完整');
          this.results[task].details.push('❌ 全局样式系统配置不完整');
        }
      } else {
        this.log(task, `❌ 全局样式文件不存在: ${globalStylePath}`);
        this.results[task].details.push('❌ 全局样式文件缺失');
      }

      // 4. 主题常量验证
      const constantsPath = path.join(this.webAppNextPath, 'lib/constants.ts');
      if (this.fileExists(constantsPath)) {
        const content = fs.readFileSync(constantsPath, 'utf8');

        if (content.includes('THEMES') && content.includes('LIGHT') && content.includes('DARK') && content.includes('SYSTEM')) {
          this.log(task, '✅ 主题常量定义 - 已定义');
          this.results[task].details.push('✅ 主题常量定义已定义');
        } else {
          this.log(task, '❌ 主题常量定义不完整');
          this.results[task].details.push('❌ 主题常量定义不完整');
        }
      } else {
        this.log(task, `❌ 常量文件不存在: ${constantsPath}`);
        this.results[task].details.push('❌ 常量文件缺失');
      }

      // 5. 传统主题系统验证
      // const legacyThemePath = path.join(this.projectRoot, 'web-app/components/modules/ui/ui.js'); // Legacy path - removed
      const legacyThemePath = path.join(this.projectRoot, 'frontend/prototype/modern-app/styles/main.css');
      if (this.fileExists(legacyThemePath)) {
        const content = fs.readFileSync(legacyThemePath, 'utf8');

        if (content.includes('setTheme') && content.includes('toggleTheme') && content.includes('theme-')) {
          this.log(task, '✅ 传统主题系统 - 保持兼容');
          this.results[task].details.push('✅ 传统主题系统保持兼容');
        } else {
          this.log(task, '❌ 传统主题系统不完整');
          this.results[task].details.push('❌ 传统主题系统不完整');
        }
      } else {
        this.log(task, `❌ 传统主题文件不存在: ${legacyThemePath}`);
        this.results[task].details.push('❌ 传统主题文件缺失');
      }

      // 判断任务完成状态
      const totalDetails = this.results[task].details.length;
      const completedDetails = this.results[task].details.filter(d => d.includes('✅')).length;

      if (completedDetails >= totalDetails * 0.8) {
        this.results[task].status = 'completed';
        this.log(task, '✅ 主题系统现代化验证完成');
      } else {
        this.results[task].status = 'partial';
        this.log(task, '⚠️ 主题系统现代化部分完成');
      }

    } catch (error) {
      this.log(task, `❌ 验证失败: ${error.message}`);
      this.results[task].status = 'failed';
      this.results[task].details.push(`验证失败: ${error.message}`);
    }
  }

  // ========================= 工具方法 =========================

  fileExists(filePath) {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }

  log(task, message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${task}: ${message}`);
  }

  // ========================= 主执行方法 =========================

  async run() {
    console.log('🚀 开始Phase-3任务综合验证...\n');
    console.log(`项目根目录: ${this.projectRoot}`);
    console.log(`Web-App-Next路径: ${this.webAppNextPath}`);
    console.log(`Web-App路径: ${this.webAppPath}`);
    console.log(`文档路径: ${this.docsPath}\n`);

    try {
      // 并行执行三个任务验证
      await Promise.all([
        this.validatePerformanceMonitoring(),
        this.validateSecurityModernization(),
        this.validateThemeModernization()
      ]);

      // 生成综合报告
      this.generateReport();

    } catch (error) {
      console.error('验证过程中发生错误:', error);
    }
  }

  generateReport() {
    console.log('\n📊 === Phase-3任务验证报告 ===\n');

    let totalTasks = 0;
    let completedTasks = 0;
    let partialTasks = 0;

    Object.entries(this.results).forEach(([taskId, result]) => {
      totalTasks++;
      const statusIcon = result.status === 'completed' ? '✅' :
                        result.status === 'partial' ? '⚠️' :
                        result.status === 'failed' ? '❌' : '⏳';

      console.log(`${statusIcon} ${taskId}: ${result.name}`);
      result.details.forEach(detail => {
        console.log(`   ${detail}`);
      });
      console.log();

      if (result.status === 'completed') {
        completedTasks++;
      } else if (result.status === 'partial') {
        partialTasks++;
      }
    });

    const completionRate = Math.round((completedTasks / totalTasks) * 100);
    const effectiveCompletionRate = Math.round(((completedTasks + partialTasks * 0.7) / totalTasks) * 100);

    console.log(`📈 完成状态统计:`);
    console.log(`   ✅ 完全完成: ${completedTasks}/${totalTasks}`);
    console.log(`   ⚠️ 部分完成: ${partialTasks}/${totalTasks}`);
    console.log(`   ❌ 需要完善: ${totalTasks - completedTasks - partialTasks}/${totalTasks}`);
    console.log(`📊 总体完成度: ${effectiveCompletionRate}%`);

    if (effectiveCompletionRate >= 90) {
      console.log('🎉 优秀！Phase-3任务P3-011、P3-012、P3-013基本完成！');
    } else if (effectiveCompletionRate >= 70) {
      console.log('✅ 大部分任务已完成，少量功能需要完善');
    } else {
      console.log('⚠️ 需要进一步完善相关功能');
    }

    // 保存验证报告
    const reportData = {
      timestamp: new Date().toISOString(),
      projectRoot: this.projectRoot,
      tasks: this.results,
      summary: {
        totalTasks,
        completedTasks,
        partialTasks,
        completionRate,
        effectiveCompletionRate
      }
    };

    const reportPath = path.join(this.projectRoot, 'scripts/validation/reports/phase3-tasks-validation-report.json');
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📝 详细报告已保存至: ${reportPath}`);
  }
}

// 启动验证
const validator = new Phase3TasksValidator();
validator.run();
