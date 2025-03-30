// Figma API 使用示例
const figmaTools = require('./figma-tools');
require('dotenv').config();

// 从命令行参数获取Figma文件ID
const fileId = process.argv[2] || '请在命令行提供Figma文件ID';

async function main() {
  try {
    console.log('🔄 正在使用Figma API获取设计信息...');
    console.log(`📄 文件ID: ${fileId}`);
    console.log(`🔑 使用令牌: ${process.env.FIGMA_TOKEN.substring(0, 5)}...${process.env.FIGMA_TOKEN.substring(process.env.FIGMA_TOKEN.length - 5)}`);
    
    // 获取文件信息
    const fileInfo = await figmaTools.getFile(fileId);
    console.log('\n📝 文件信息:');
    console.log(`  名称: ${fileInfo.name}`);
    console.log(`  最后修改: ${new Date(fileInfo.lastModified).toLocaleString()}`);
    console.log(`  版本: ${fileInfo.version}`);
    
    // 获取画布信息
    const pages = fileInfo.document.children;
    console.log(`\n📑 文件包含 ${pages.length} 个页面:`);
    
    // 打印每个页面的信息
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`\n🖼️ 页面 ${i+1}: ${page.name}`);
      console.log(`  包含 ${page.children.length} 个元素`);
      
      // 获取页面上的所有顶级元素
      const elements = page.children;
      
      // 打印前5个元素的信息
      const elementsToShow = Math.min(5, elements.length);
      if (elementsToShow > 0) {
        console.log(`  前 ${elementsToShow} 个元素:`);
        for (let j = 0; j < elementsToShow; j++) {
          const element = elements[j];
          console.log(`    ${j+1}. [${element.type}] ${element.name || '未命名'} (ID: ${element.id.substring(0, 8)}...)`);
        }
      }
      
      // 如果只需要第一个页面的信息，可以break
      if (i === 0) break;
    }
    
    // 获取组件信息
    const components = await figmaTools.getFileComponents(fileId);
    console.log(`\n🧩 文件包含 ${components.meta.components ? Object.keys(components.meta.components).length : 0} 个组件`);
    
    console.log('\n✅ Figma设计信息获取完成!');
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    if (error.response) {
      console.error('  API响应:', error.response.data);
    }
    console.log('\n🔍 请检查:');
    console.log('  1. Figma文件ID是否正确');
    console.log('  2. Figma访问令牌是否有效');
    console.log('  3. 网络连接是否正常');
  }
}

main().catch(console.error); 