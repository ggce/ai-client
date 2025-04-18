// 构建脚本用于整合Vue和Electron
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 构建配置
const config = {
  dev: process.argv.includes('--dev'),
  buildVue: !process.argv.includes('--no-vue'),
  runElectron: !process.argv.includes('--no-electron')
};

console.log('启动集成构建流程...');
console.log(`模式: ${config.dev ? '开发' : '生产'}`);

async function runCommand(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    console.log(`执行命令: ${command}`);
    const childProcess = exec(command, { cwd });
    
    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`命令执行失败，退出码: ${code}`));
      }
    });
  });
}

async function buildVue() {
  if (!config.buildVue) {
    console.log('跳过Vue构建');
    return;
  }
  
  console.log('构建Vue应用...');
  if (config.dev) {
    // 开发模式下，启动Vite开发服务器
    runCommand('npm run dev', path.join(process.cwd(), 'vue-client'));
    // 不等待，因为开发服务器会持续运行
    return Promise.resolve();
  } else {
    // 生产模式下，构建Vue应用
    return runCommand('npm run build', path.join(process.cwd(), 'vue-client'));
  }
}

async function buildElectron() {
  console.log('编译Electron应用...');
  return runCommand('tsc');
}

async function startElectron() {
  if (!config.runElectron) {
    console.log('跳过Electron启动');
    return;
  }
  
  console.log('启动Electron应用...');
  return runCommand('electron .');
}

async function main() {
  try {
    // 并行运行Vue构建和Electron编译
    await Promise.all([
      buildVue(),
      buildElectron()
    ]);
    
    // 启动Electron应用
    if (config.runElectron) {
      await startElectron();
    }
    
    console.log('构建流程完成');
  } catch (error) {
    console.error('构建过程中发生错误:', error);
    process.exit(1);
  }
}

main(); 