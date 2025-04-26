<template>
  <!-- GlobalTips组件不需要显示任何内容，它只是一个容器，用于插入Tips到DOM -->
  <div class="global-tips-wrapper"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Tips from './Tips.vue'
import { createApp } from 'vue'
import { TipsExpose } from '../types'

/**
 * 创建Tips容器和实例
 */
const createGlobalTips = () => {
  try {
    // 检查是否已存在
    if (window.__GLOBAL_TIPS_INSTANCE__) {
      return () => {};
    }
    
    // 创建容器
    const container = document.createElement('div');
    container.id = 'global-tips-container';
    document.body.appendChild(container);
    
    // 创建Tips实例
    const app = createApp(Tips);
    const instance = app.mount(container) as unknown as TipsExpose;
    
    // 保存到全局变量
    window.__GLOBAL_TIPS_INSTANCE__ = instance;
    
    return () => {
      // 清理函数
      app.unmount();
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      window.__GLOBAL_TIPS_INSTANCE__ = null;
    };
  } catch (error) {
    console.error('初始化全局提示组件失败:', error);
    return () => {};
  }
};

// 组件挂载时创建Tips
let cleanup: (() => void) | null = null;

onMounted(() => {
  // 确保只创建一次实例
  if (!window.__GLOBAL_TIPS_INSTANCE__) {
    cleanup = createGlobalTips();
  }
});

// 组件卸载时清理
onUnmounted(() => {
  if (cleanup) {
    cleanup();
    cleanup = null;
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
    __GLOBAL_TIPS_INSTANCE__: TipsExpose | null;
  }
}

// 初始化全局变量
window.__GLOBAL_TIPS_INSTANCE__ = null;
</script> 