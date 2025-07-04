#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUILD_PROFILES = {
  'development': {
    description: '开发版本 - 用于本地开发和调试',
    platforms: ['android', 'ios']
  },
  'preview': {
    description: '预览版本 - 用于内部测试',
    platforms: ['android', 'ios']
  },
  'production': {
    description: '生产版本 - 用于应用商店发布',
    platforms: ['android', 'ios']
  },
  'production-huawei': {
    description: '华为版本 - 用于华为应用市场',
    platforms: ['android']
  }
};

function printUsage() {
  console.log(`
🚀 食品溯源移动应用构建脚本

用法:
  node scripts/build.js <profile> <platform> [options]

构建配置:
${Object.entries(BUILD_PROFILES).map(([profile, config]) => 
  `  ${profile.padEnd(20)} - ${config.description}
    支持平台: ${config.platforms.join(', ')}`
).join('\n')}

平台选项:
  android, ios, all

选项:
  --submit     构建完成后自动提交到应用商店
  --wait       等待构建完成
  --clear-cache 清除构建缓存

示例:
  node scripts/build.js production android --submit --wait
  node scripts/build.js preview all --wait
  node scripts/build.js production-huawei android --submit
`);
}

function validateArgs(profile, platform) {
  if (!BUILD_PROFILES[profile]) {
    console.error(`❌ 错误: 未知的构建配置 "${profile}"`);
    console.error(`可用配置: ${Object.keys(BUILD_PROFILES).join(', ')}`);
    process.exit(1);
  }

  const supportedPlatforms = BUILD_PROFILES[profile].platforms;
  if (platform !== 'all' && !supportedPlatforms.includes(platform)) {
    console.error(`❌ 错误: 配置 "${profile}" 不支持平台 "${platform}"`);
    console.error(`支持的平台: ${supportedPlatforms.join(', ')}`);
    process.exit(1);
  }
}

function checkPrerequisites() {
  console.log('🔍 检查构建环境...');
  
  try {
    execSync('eas --version', { stdio: 'pipe' });
    console.log('✅ EAS CLI 已安装');
  } catch (error) {
    console.error('❌ 错误: EAS CLI 未安装');
    console.error('请运行: npm install -g eas-cli');
    process.exit(1);
  }

  try {
    execSync('expo --version', { stdio: 'pipe' });
    console.log('✅ Expo CLI 已安装');
  } catch (error) {
    console.error('❌ 错误: Expo CLI 未安装');
    console.error('请运行: npm install -g @expo/cli');
    process.exit(1);
  }

  // 检查必要的环境变量
  const requiredEnvVars = ['EXPO_TOKEN'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 错误: 缺少必要的环境变量:');
    missingVars.forEach(varName => console.error(`  - ${varName}`));
    process.exit(1);
  }

  console.log('✅ 环境检查通过');
}

function runCommand(command, options = {}) {
  console.log(`🔄 执行: ${command}`);
  try {
    const result = execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
      ...options
    });
    return result;
  } catch (error) {
    console.error(`❌ 命令执行失败: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

function buildApp(profile, platform, options) {
  const { submit, wait, clearCache } = options;
  
  console.log(`\n🏗️  开始构建应用`);
  console.log(`配置: ${profile}`);
  console.log(`平台: ${platform}`);
  console.log(`提交: ${submit ? '是' : '否'}`);
  console.log(`等待: ${wait ? '是' : '否'}`);

  // 清除缓存
  if (clearCache) {
    console.log('\n🧹 清除构建缓存...');
    runCommand('expo r -c');
  }

  // 构建参数
  const buildArgs = [
    '--profile', profile,
    '--non-interactive'
  ];

  if (wait) {
    buildArgs.push('--wait');
  }

  if (platform === 'all') {
    const platforms = BUILD_PROFILES[profile].platforms;
    platforms.forEach(plt => {
      console.log(`\n📱 构建 ${plt} 版本...`);
      runCommand(`eas build --platform ${plt} ${buildArgs.join(' ')}`);
      
      if (submit) {
        console.log(`\n📤 提交 ${plt} 版本...`);
        runCommand(`eas submit --platform ${plt} --latest --non-interactive`);
      }
    });
  } else {
    console.log(`\n📱 构建 ${platform} 版本...`);
    runCommand(`eas build --platform ${platform} ${buildArgs.join(' ')}`);
    
    if (submit) {
      console.log(`\n📤 提交 ${platform} 版本...`);
      runCommand(`eas submit --platform ${platform} --latest --non-interactive`);
    }
  }

  console.log('\n🎉 构建完成!');
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const profile = args[0];
  const platform = args[1] || 'all';
  
  const options = {
    submit: args.includes('--submit'),
    wait: args.includes('--wait'),
    clearCache: args.includes('--clear-cache')
  };

  validateArgs(profile, platform);
  checkPrerequisites();
  buildApp(profile, platform, options);
}

if (require.main === module) {
  main();
}