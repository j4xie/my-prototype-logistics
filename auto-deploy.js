const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');

// 需要安装chokidar: npm install chokidar --save-dev

// 监视的目录
const watchDirs = [
  './*.html',
  './components/**/*.js',
  './components/**/*.html',
  './assets/**/*.css',
  './assets/**/*.js'
];

// 部署函数
const deploy = () => {
  console.log('检测到文件变化，开始部署...');
  
  exec('npm run deploy:simple', (error, stdout, stderr) => {
    if (error) {
      console.error(`部署错误: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`部署警告: ${stderr}`);
    }
    console.log(`部署成功: ${stdout}`);
  });
};

// 创建监视器
const watcher = chokidar.watch(watchDirs, {
  ignored: /(^|[\/\\])\../, // 忽略隐藏文件
  persistent: true
});

console.log('启动自动部署监视器...');
console.log('正在监视以下目录:', watchDirs.join(', '));

// 添加事件监听器
let ready = false;
let timer = null;

// 使用防抖动方式处理变更 - 300ms内的变更会被合并为一次部署
const debounceDeploy = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    deploy();
    timer = null;
  }, 300);
};

watcher
  .on('add', path => {
    if (ready) {
      console.log(`文件已添加: ${path}`);
      debounceDeploy();
    }
  })
  .on('change', path => {
    if (ready) {
      console.log(`文件已修改: ${path}`);
      debounceDeploy();
    }
  })
  .on('unlink', path => {
    if (ready) {
      console.log(`文件已删除: ${path}`);
      debounceDeploy();
    }
  })
  .on('ready', () => {
    ready = true;
    console.log('初始扫描完成，准备监视文件变化');
  }); 