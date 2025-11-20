const fs = require('fs');
const path = require('path');

/**
 * 批量更新所有HTML页面为移动端版本
 */

// 递归查找HTML文件
function findHTMLFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findHTMLFiles(filePath, fileList);
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

// 更新单个文件
function updateFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf-8');
        let modified = false;

        // 1. 更新viewport
        if (!content.includes('maximum-scale=1.0')) {
            content = content.replace(
                /<meta name="viewport" content="[^"]*">/,
                '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'
            );
            modified = true;
        }

        // 2. 添加mobile.css（如果还没有）
        if (!content.includes('mobile.css')) {
            content = content.replace(
                '</head>',
                `    <link rel="stylesheet" href="../../assets/css/mobile.css">
</head>`
            );
            modified = true;
        }

        // 3. 添加flow-navigator.js（如果还没有）
        if (!content.includes('flow-navigator.js')) {
            content = content.replace(
                '</body>',
                `    <script src="../../assets/js/flow-navigator.js"></script>
</body>`
            );
            modified = true;
        }

        // 保存文件
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`✓ Updated: ${path.relative(process.cwd(), filePath)}`);
            return true;
        } else {
            console.log(`- Skipped (already updated): ${path.relative(process.cwd(), filePath)}`);
            return false;
        }
    } catch (error) {
        console.error(`✗ Error updating ${filePath}:`, error.message);
        return false;
    }
}

// 主执行函数
function main() {
    console.log('🚀 开始批量更新HTML页面为移动端版本...\n');

    const pagesDir = path.join(__dirname, 'pages');

    // 查找所有HTML文件
    const htmlFiles = findHTMLFiles(pagesDir);

    console.log(`📁 找到 ${htmlFiles.length} 个HTML文件\n`);

    let updated = 0;
    let skipped = 0;

    htmlFiles.forEach(file => {
        if (updateFile(file)) {
            updated++;
        } else {
            skipped++;
        }
    });

    console.log(`\n✅ 更新完成！`);
    console.log(`   - 更新: ${updated} 个文件`);
    console.log(`   - 跳过: ${skipped} 个文件`);
    console.log(`   - 总计: ${htmlFiles.length} 个文件`);
}

// 执行
main();
