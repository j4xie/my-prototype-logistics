#!/usr/bin/env node
/**
 * Automated i18n Migration Script
 *
 * This script helps automate the migration of Chinese text to i18n translations
 *
 * Usage:
 *   node scripts/migrate-i18n.js <file-path>
 *   node scripts/migrate-i18n.js --batch <directory-path>
 *
 * What it does:
 * 1. Adds useTranslation import and hook
 * 2. Extracts Chinese text strings
 * 3. Generates translation key suggestions
 * 4. Creates output for manual review
 */

const fs = require('fs');
const path = require('path');

// Chinese character regex
const CHINESE_REGEX = /[\u4e00-\u9fa5]+/g;

// Common patterns to extract
const PATTERNS = [
  // JSX text: <Text>中文</Text>
  /<Text[^>]*>([^<]*[\u4e00-\u9fa5][^<]*)<\/Text>/g,
  // String literals in quotes: '中文' or "中文"
  /['"]([^'"]*[\u4e00-\u9fa5][^'"]*)['"]/g,
  // Alert.alert: Alert.alert('title', 'message')
  /Alert\.alert\s*\(\s*['"]([^'"]*[\u4e00-\u9fa5][^'"]*)['"]\s*(?:,\s*['"]([^'"]*)['"]\s*)?\)/g,
  // placeholder: placeholder="中文"
  /placeholder\s*=\s*['"]([^'"]*[\u4e00-\u9fa5][^'"]*)['"]/g,
];

/**
 * Extract Chinese text from file content
 */
function extractChineseText(content) {
  const found = new Set();

  // Extract from JSX Text components
  const textMatches = content.matchAll(/<Text[^>]*>([^<]+)<\/Text>/g);
  for (const match of textMatches) {
    const text = match[1].trim();
    if (CHINESE_REGEX.test(text) && !text.startsWith('{')) {
      found.add(text);
    }
  }

  // Extract from string literals in common positions
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip import/export lines
    if (line.trim().startsWith('import ') || line.trim().startsWith('export ')) {
      continue;
    }

    // Extract quoted strings with Chinese
    const quotedMatches = line.matchAll(/['"]([^'"]+)['"]/g);
    for (const match of quotedMatches) {
      const text = match[1];
      if (CHINESE_REGEX.test(text) && text.length > 0) {
        found.add(text);
      }
    }
  }

  return Array.from(found);
}

/**
 * Generate translation key from Chinese text
 */
function generateKey(text, existingKeys = []) {
  // Simple pinyin mapping for common characters
  const pinyinMap = {
    '个人': 'personal',
    '信息': 'info',
    '修改': 'change',
    '密码': 'password',
    '用户': 'user',
    '名': 'name',
    '邮箱': 'email',
    '手机': 'phone',
    '部门': 'department',
    '职位': 'position',
    '保存': 'save',
    '编辑': 'edit',
    '提交': 'submit',
    '取消': 'cancel',
    '确认': 'confirm',
    '成功': 'success',
    '失败': 'failed',
    '加载': 'loading',
    '删除': 'delete',
    '添加': 'add',
    '查看': 'view',
    '列表': 'list',
    '详情': 'detail',
    '设置': 'settings',
    '退出': 'logout',
    '登录': 'login',
    '注册': 'register',
    '首页': 'home',
    '管理': 'management',
    '分析': 'analysis',
    '报表': 'report',
    '统计': 'statistics',
    '质检': 'quality',
    '批次': 'batch',
    '产量': 'output',
    '原料': 'material',
    '设备': 'equipment',
    '告警': 'alert',
    '今日': 'today',
    '昨日': 'yesterday',
    '本周': 'thisWeek',
    '本月': 'thisMonth',
  };

  // Try to generate a key from common words
  for (const [chinese, english] of Object.entries(pinyinMap)) {
    if (text.includes(chinese)) {
      const key = text.replace(chinese, english)
        .replace(/[\u4e00-\u9fa5]/g, '')
        .replace(/[^\w]/g, '')
        .replace(/\s+/g, '');

      if (key.length > 0 && !existingKeys.includes(key)) {
        return key;
      }
    }
  }

  // Fallback: generate generic key
  const shortText = text.substring(0, 20).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  let baseKey = `text_${shortText}`;
  let counter = 1;
  let finalKey = baseKey;

  while (existingKeys.includes(finalKey)) {
    finalKey = `${baseKey}_${counter}`;
    counter++;
  }

  return finalKey;
}

/**
 * Determine namespace from file path
 */
function determineNamespace(filePath) {
  if (filePath.includes('/factory-admin/')) return 'profile';
  if (filePath.includes('/workshop-supervisor/')) return 'processing';
  if (filePath.includes('/quality-inspector/')) return 'quality';
  if (filePath.includes('/platform/')) return 'management';
  if (filePath.includes('/reports/')) return 'reports';
  if (filePath.includes('/alerts/')) return 'alerts';
  if (filePath.includes('/attendance/') || filePath.includes('/work/')) return 'hr';
  if (filePath.includes('/warehouse/')) return 'warehouse';
  if (filePath.includes('/dispatcher/')) return 'dispatcher';
  if (filePath.includes('/traceability/') || filePath.includes('/common/')) return 'common';
  return 'common';
}

/**
 * Process a single file
 */
function processFile(filePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${filePath}`);
  console.log('='.repeat(60));

  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if already migrated
  if (content.includes('useTranslation')) {
    console.log('✓ Already migrated (contains useTranslation)');
    return { migrated: true, texts: [] };
  }

  // Extract Chinese text
  const chineseTexts = extractChineseText(content);

  if (chineseTexts.length === 0) {
    console.log('✓ No Chinese text found');
    return { migrated: false, texts: [] };
  }

  const namespace = determineNamespace(filePath);
  console.log(`Namespace: ${namespace}`);
  console.log(`Found ${chineseTexts.length} Chinese text strings:\n`);

  const translations = [];
  const existingKeys = [];

  chineseTexts.forEach((text, index) => {
    const key = generateKey(text, existingKeys);
    existingKeys.push(key);
    translations.push({ key, zhCN: text });
    console.log(`  ${index + 1}. "${text}"`);
    console.log(`     → t('${key}')  // Suggested key`);
  });

  console.log(`\nTo migrate this file:`);
  console.log(`1. Add import: import { useTranslation } from 'react-i18next';`);
  console.log(`2. Add hook: const { t } = useTranslation('${namespace}');`);
  console.log(`3. Replace strings with t() calls`);
  console.log(`4. Add to /src/i18n/locales/zh-CN/${namespace}.json:`);
  console.log(JSON.stringify(
    Object.fromEntries(translations.map(t => [t.key, t.zhCN])),
    null,
    2
  ));

  return { migrated: false, texts: chineseTexts, translations, namespace };
}

/**
 * Process directory recursively
 */
function processDirectory(dirPath) {
  const results = {
    total: 0,
    migrated: 0,
    needsMigration: 0,
    translations: {},
  };

  function walk(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.tsx')) {
        results.total++;
        const result = processFile(fullPath);

        if (result.migrated) {
          results.migrated++;
        } else if (result.texts && result.texts.length > 0) {
          results.needsMigration++;

          // Group by namespace
          const ns = result.namespace || 'common';
          if (!results.translations[ns]) {
            results.translations[ns] = [];
          }
          results.translations[ns].push(...(result.translations || []));
        }
      }
    }
  }

  walk(dirPath);

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files: ${results.total}`);
  console.log(`Already migrated: ${results.migrated}`);
  console.log(`Needs migration: ${results.needsMigration}`);
  console.log(`\nTranslations by namespace:`);

  for (const [ns, trans] of Object.entries(results.translations)) {
    console.log(`  ${ns}: ${trans.length} keys`);
  }

  return results;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  node scripts/migrate-i18n.js <file-path>');
  console.log('  node scripts/migrate-i18n.js --batch <directory-path>');
  process.exit(1);
}

if (args[0] === '--batch') {
  const dirPath = args[1] || './src/screens';
  processDirectory(dirPath);
} else {
  const filePath = args[0];
  processFile(filePath);
}
