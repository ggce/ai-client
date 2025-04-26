<template>
  <!-- GlobalTips组件不需要显示任何内容，它只是一个容器，用于插入Tips到DOM -->
  <div class="global-tips-wrapper"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Tips from './Tips.vue'
import { createApp } from 'vue'
import { TipsExpose } from '../types'

// 调试模式
const DEBUG = true;

// 调试日志
const debug = (message: string, ...args: any[]) => {
  if (DEBUG) {
    console.log(`[GlobalTips] ${message}`, ...args);
  }
};

/**
 * 创建Tips容器和实例
 */
const createGlobalTips = () => {
  debug('开始创建全局Tips实例');
  
  try {
    // 检查是否已存在
    if (window.__GLOBAL_TIPS_INSTANCE__) {
      debug('全局Tips实例已存在，跳过创建');
      return () => {};
    }
    
    // 创建容器
    const container = document.createElement('div');
    container.id = 'global-tips-container';
    document.body.appendChild(container);
    debug('Tips容器已创建并添加到DOM');
    
    // 创建Tips实例
    const app = createApp(Tips);
    const instance = app.mount(container) as unknown as TipsExpose;
    debug('Tips实例已创建并挂载');
    
    // 保存到全局变量
    window.__GLOBAL_TIPS_INSTANCE__ = instance;
    debug('Tips实例已保存到全局变量');
    
    // 确认Tips实例方法可用
    if (typeof instance.show === 'function') {
      debug('Tips实例方法可用');
    } else {
      debug('警告: Tips实例方法不可用', instance);
    }
    
    // 显示一个测试提示
    setTimeout(() => {
      try {
        debug('尝试显示测试提示');
        instance.show('GlobalTips组件已初始化', 'success', 1500);
        debug('测试提示已触发');
      } catch (error) {
        debug('触发测试提示失败', error);
      }
    }, 1000);
    
    return () => {
      // 清理函数
      debug('清理Tips实例');
      app.unmount();
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      window.__GLOBAL_TIPS_INSTANCE__ = null;
      debug('Tips实例已清理');
    };
  } catch (error) {
    debug('创建全局Tips实例失败', error);
    return () => {};
  }
};

// 组件挂载时创建Tips
let cleanup: (() => void) | null = null;

onMounted(() => {
  debug('组件已挂载');
  // 确保只创建一次实例
  if (!window.__GLOBAL_TIPS_INSTANCE__) {
    cleanup = createGlobalTips();
    debug('全局提示组件已创建');
  } else {
    debug('全局提示组件已存在，跳过创建');
  }
});

// 组件卸载时清理
onUnmounted(() => {
  debug('组件即将卸载');
  if (cleanup) {
    cleanup();
    cleanup = null;
    debug('全局提示组件已销毁');
  }
});
</script>

<style scoped>
.global-tips-wrapper {
  display: none;
}
</style>

<script lang="ts">
// 扩展全局Window接口，添加我们的全局变量
declare global {
  interface Window {
    __GLOBAL_TIPS_INSTANCE__: any | null;
  }
}

// 初始化全局变量
window.__GLOBAL_TIPS_INSTANCE__ = null;
</script> 