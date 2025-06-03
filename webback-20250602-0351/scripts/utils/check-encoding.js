const fs = require('fs');
const path = require('path');

// Critical files to check
const criticalFiles = [
    'DIRECTORY_STRUCTURE.md',
    'docs/directory-structure-changelog.md',
    'README.md',
    'TASKS.md',
    '重构阶段记录.md',
    '项目重构方案.md',
    '所有文件解释.md'
];

console.log('🔍 Encoding Check Started');
console.log(`Time: ${new Date().toISOString()}`);
console.log('='.repeat(50));

let issueCount = 0;

criticalFiles.forEach(file => {
    console.log(`Checking: ${file}`);

    if (!fs.existsSync(file)) {
        console.log('  ❌ File not found');
        issueCount++;
        return;
    }

    try {
        const content = fs.readFileSync(file, 'utf8');
        const hasReplacementChars = content.includes('�');

        if (hasReplacementChars) {
            console.log('  ❌ Found replacement characters - encoding damaged');
            issueCount++;
        } else {
            console.log('  ✅ Encoding normal');
        }
    } catch (error) {
        console.log(`  ❌ Read error: ${error.message}`);
        issueCount++;
    }
});

console.log('='.repeat(50));
console.log('📊 Summary');
console.log(`Total files: ${criticalFiles.length}`);
console.log(`Issues found: ${issueCount}`);

if (issueCount === 0) {
    console.log('🎉 All files are OK!');
    process.exit(0);
} else {
    console.log(`⚠️ Found ${issueCount} encoding issues`);
    console.log('💡 Run "npm run fix-encoding" if you have GitHub backups');
    process.exit(1);
}
