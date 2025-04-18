// 开发脚本 - 支持Vue热重载和Electron同步更新
const { exec, spawn } = require('child_process');
const path = require('path');

// Vue开发服务器URL
const VUE_DEV_SERVER_URL = 'http://localhost:3000';

console.log('启动开发环境...');

// 启动Vue开发服务器
const vueProcess = spawn('npm', ['run', 'dev'], { 
  cwd: path.join(process.cwd(), 'vue-client'),
  stdio: 'inherit',
  shell: true
});

// 等待Vue开发服务器启动
setTimeout(() => {
  console.log('正在启动Electron应用...');
  
  // 启动Electron
  const electronProcess = spawn('npm', ['run', 'electron:dev'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VUE_DEV_SERVER_URL: VUE_DEV_SERVER_URL
    },
    stdio: 'inherit',
    shell: true
  });

  // 处理进程退出
  electronProcess.on('close', (code) => {
    console.log(`Electron进程退出，代码: ${code}`);
    vueProcess.kill();
    process.exit(0);
  });
}, 3000); // 等待3秒钟让Vue开发服务器启动

// 处理Ctrl+C等中断信号
process.on('SIGINT', () => {
  console.log('收到中断信号，正在关闭所有进程...');
  vueProcess.kill();
  process.exit(0);
}); 