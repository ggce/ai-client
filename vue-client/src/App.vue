<template>
  <div class="app-container" :class="{'macos': isMacOS}">
    <div v-if="isMacOS" class="titlebar" />
    <Sidebar />
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <keep-alive v-if="route.meta.keepAlive">
          <component :is="Component" />
        </keep-alive>
        <component v-else :is="Component" />
      </router-view>
    </main>
    
    <!-- 全局Tips组件 -->
    <GlobalTips />
  </div>
</template>

<script setup lang="ts">
import Sidebar from './components/Sidebar.vue'
import { ref, onMounted } from 'vue'
import { useSettingsStore } from './store/settings'
import GlobalTips from './components/GlobalTips.vue'

const isMacOS = ref(false)
const settingsStore = useSettingsStore()

onMounted(async () => {
  // 加载保存的设置，使用await确保设置在应用启动前加载完成
  await settingsStore.loadSettings()
  console.log('应用启动时的侧边栏状态:', settingsStore.isSidebarCollapsed ? '收起' : '展开')
  
  // 检测是否为macOS
  isMacOS.value = navigator.platform.toLowerCase().includes('mac')
})
</script>

<style>
.app-container {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  position: relative;
}

.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  -webkit-app-region: drag;
  z-index: 9999;
}

/* 为macOS标题栏预留空间 */
.app-container.macos {
  padding-top: 28px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
</style>