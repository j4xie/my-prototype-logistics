#!/usr/bin/env node
/**
 * Extract Chinese strings from TypeScript/TSX files
 * Usage: node extract-chinese-strings.js <file-path>
 */

const fs = require('fs');
const path = require('path');

function extractChineseStrings(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const chineseStrings = new Set();

  // Pattern 1: String literals with Chinese characters
  // Matches: "包含中文", '包含中文', `包含中文`
  const stringLiteralPattern = /["'`]([^"'`]*[\u4e00-\u9fa5]+[^"'`]*)["'`]/g;

  // Pattern 2: JSX text with Chinese characters
  // Matches: <Text>中文文本</Text>
  const jsxTextPattern = />\s*([^<]*[\u4e00-\u9fa5]+[^<]*)\s*</g;

  let match;

  // Extract from string literals
  while ((match = stringLiteralPattern.exec(content)) !== null) {
    const str = match[1].trim();
    if (str && /[\u4e00-\u9fa5]/.test(str)) {
      chineseStrings.add(str);
    }
  }

  // Extract from JSX text
  while ((match = jsxTextPattern.exec(content)) !== null) {
    const str = match[1].trim();
    if (str && /[\u4e00-\u9fa5]/.test(str) && !str.startsWith('{')) {
      chineseStrings.add(str);
    }
  }

  return Array.from(chineseStrings).sort();
}

function generateTranslationKeys(strings, prefix = '') {
  const translations = {};

  strings.forEach((str, index) => {
    // Generate a simple key from the Chinese string
    let key = str
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')
      .substring(0, 30)
      .toLowerCase();

    // Remove leading/trailing underscores
    key = key.replace(/^_+|_+$/g, '');

    // Add index if key is too generic
    if (key.length < 3) {
      key = `text_${index}`;
    }

    translations[key] = str;
  });

  return translations;
}

function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node extract-chinese-strings.js <file-path>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const strings = extractChineseStrings(filePath);
  const fileName = path.basename(filePath, path.extname(filePath));

  console.log(`\n=== Extracted Chinese Strings from ${fileName} ===\n`);
  console.log(`Total: ${strings.length} unique strings\n`);

  strings.forEach((str, index) => {
    console.log(`${index + 1}. "${str}"`);
  });

  console.log(`\n=== Suggested Translation Keys ===\n`);
  const translations = generateTranslationKeys(strings);
  console.log(JSON.stringify(translations, null, 2));
}

main();
