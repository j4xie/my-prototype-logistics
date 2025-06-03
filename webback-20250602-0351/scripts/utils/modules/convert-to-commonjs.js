/**
 * @file convert-to-commonjs.js
 * @description 将ES模块语法转换为CommonJS语法
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// 默认模块目录
const DEFAULT_MODULES_DIR = path.join(__dirname, '..', 'components', 'modules');
const DEFAULT_MODULES = ['auth', 'data', 'store', 'ui', 'utils'];

// 处理文件
function processFile(filePath) {
  console.log(`处理文件: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    return;
  }
  
  // 读取文件内容
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 提取导入
  const imports = [];
  
  // 匹配默认导入 import name from './file'
  content = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (match, name, source) => {
    imports.push({ name, source, isDefault: true });
    return '// ' + match;
  });
  
  // 匹配命名导入 import { name } from './file'
  content = content.replace(/import\s+{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]/g, (match, names, source) => {
    names.split(',').forEach(n => {
      const trimmedName = n.trim();
      const parts = trimmedName.split(/\s+as\s+/);
      const originalName = parts[0].trim();
      const alias = parts.length > 1 ? parts[1].trim() : originalName;
      imports.push({ name: originalName, alias, source, isDefault: false });
    });
    return '// ' + match;
  });
  
  // 提取导出
  const exports = [];
  const defaultExport = { found: false, name: '', isObject: false, content: '' };
  
  // 匹配命名导出 export { name1, name2 }
  content = content.replace(/export\s+{\s*([^}]+)\s*};?/g, (match, names) => {
    names.split(',').forEach(n => {
      const trimmedName = n.trim();
      const parts = trimmedName.split(/\s+as\s+/);
      const originalName = parts[0].trim();
      const alias = parts.length > 1 ? parts[1].trim() : originalName;
      exports.push({ name: originalName, alias });
    });
    return '// ' + match;
  });
  
  // 匹配const导出 export const name = ...
  content = content.replace(/export\s+const\s+(\w+)\s*=\s*([^;]+);/g, (match, name, value) => {
    exports.push({ name, alias: name, value: value.trim() });
    return `const ${name} = ${value};`;
  });
  
  // 匹配类导出 export class Name {...
  content = content.replace(/export\s+(class|function)\s+(\w+)/g, (match, type, name) => {
    exports.push({ name, alias: name });
    return `${type} ${name}`;
  });
  
  // 匹配对象字面量默认导出 export default { ... };
  content = content.replace(/export\s+default\s+({[\s\S]*?});/g, (match, objectContent) => {
    defaultExport.found = true;
    defaultExport.isObject = true;
    defaultExport.content = objectContent;
    return '// ' + match;
  });
  
  // 匹配变量默认导出 export default name;
  content = content.replace(/export\s+default\s+(\w+);?/g, (match, name) => {
    defaultExport.found = true;
    defaultExport.name = name;
    return '// ' + match;
  });
  
  // 创建CommonJS版本
  let commonJsContent = content.split('\n')
    .filter(line => !line.trim().startsWith('export default') && !line.trim().startsWith('export {'))
    .join('\n');
  
  // 添加CommonJS导入
  const requireStatements = imports.map(imp => {
    if (imp.isDefault) {
      return `const ${imp.name} = require('${imp.source}');`;
    } else {
      return `const ${imp.alias} = require('${imp.source}').${imp.name};`;
    }
  });
  
  // 添加CommonJS导出
  let exportStatements = '';
  if (exports.length > 0 || defaultExport.found) {
    exportStatements = '\n// CommonJS导出\n';
    
    // 创建导出对象
    if (defaultExport.found) {
      if (defaultExport.isObject) {
        exportStatements += `module.exports = ${defaultExport.content};\n`;
      } else {
        exportStatements += `module.exports = ${defaultExport.name};\n`;
      }
      
      // 如果有命名导出，添加到module.exports
      if (exports.length > 0) {
        exports.forEach(exp => {
          exportStatements += `module.exports.${exp.alias} = ${exp.name};\n`;
        });
      }
    } else {
      // 只有命名导出
      exportStatements += 'module.exports = {\n';
      exports.forEach((exp, index) => {
        exportStatements += `  ${exp.alias}${index < exports.length - 1 ? ',' : ''}\n`;
      });
      exportStatements += '};\n';
    }
  }
  
  // 组合所有内容
  commonJsContent = requireStatements.join('\n') + 
    (requireStatements.length > 0 ? '\n\n' : '') + 
    commonJsContent + 
    exportStatements;
  
  // 写入文件
  fs.writeFileSync(filePath, commonJsContent, 'utf8');
  console.log(`已更新文件: ${filePath}`);
}

// 处理目录下的所有JavaScript文件
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.js')) {
      processFile(filePath);
    }
  }
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('未指定目标文件或目录，使用默认设置...');
    
    // 处理所有默认模块目录
    for (const moduleName of DEFAULT_MODULES) {
      const moduleDir = path.join(DEFAULT_MODULES_DIR, moduleName);
      if (fs.existsSync(moduleDir)) {
        processDirectory(moduleDir);
      }
    }
    
    // 处理主索引文件
    const indexFile = path.join(DEFAULT_MODULES_DIR, 'index.js');
    if (fs.existsSync(indexFile)) {
      processFile(indexFile);
    }
  } else {
    // 处理指定的文件或目录
    for (const target of args) {
      const targetPath = path.resolve(target);
      
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        
        if (stat.isDirectory()) {
          console.log(`处理目录: ${targetPath}`);
          processDirectory(targetPath);
        } else if (stat.isFile() && targetPath.endsWith('.js')) {
          processFile(targetPath);
        } else {
          console.error(`不是JavaScript文件: ${targetPath}`);
        }
      } else {
        console.error(`目标不存在: ${targetPath}`);
      }
    }
  }
  
  console.log('转换完成!');
}

// 执行主函数
main(); 