/**
 * 检查任务进度标记脚本
 * 确保在提交前已经在对应任务后标记了完成勾选
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置选项
const REPORT_DIR = process.env.REPORT_DIR || 'reports';
const PROGRESS_FILE = path.join('docs', 'task-test-progress.md');
const TASK_PATTERN = /\| (P[0-9]-[0-9]) \| .+ \| ⏳ 进行中 \|/g;

// 获取git差异
function getGitDiff() {
  try {
    return execSync('git diff --staged').toString();
  } catch (error) {
    console.error('获取Git差异失败:', error.message);
    return '';
  }
}

// 检查任务标记
function checkTaskTicks() {
  console.log('🔍 检查任务进度标记...');
  
  // 检查文件是否存在
  if (!fs.existsSync(PROGRESS_FILE)) {
    console.error(`❌ 错误: ${PROGRESS_FILE} 文件不存在`);
    process.exit(1);
  }
  
  // 读取文件内容
  const content = fs.readFileSync(PROGRESS_FILE, 'utf-8');
  
  // 获取git差异
  const diff = getGitDiff();
  
  // 检查是否有任务需要标记为完成
  let match;
  let foundUntickedTasks = false;
  
  while ((match = TASK_PATTERN.exec(content)) !== null) {
    const taskId = match[1];
    console.log(`⚠️ 发现未标记完成的任务: ${taskId}`);
    
    // 检查这个任务是否在当前提交中被更改了状态
    if (diff.includes(taskId) && !diff.includes(`${taskId} \\| .+ \\| ✔️`)) {
      console.log(`❌ 任务 ${taskId} 改动了但没有标记为完成`);
      foundUntickedTasks = true;
    }
  }
  
  if (foundUntickedTasks) {
    console.error('❌ 提交被阻止: 请在任务完成后在task-test-progress.md中标记为完成 (添加✔️)');
    process.exit(1);
  }
  
  console.log('✅ 任务进度标记检查通过');
}

// 执行检查
checkTaskTicks(); 