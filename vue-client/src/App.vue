<template>
  <div class="app-container" :class="{'macos': isMacOS}">
    <Sidebar />
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <keep-alive v-if="route.meta.keepAlive">
          <component :is="Component" />
        </keep-alive>
        <component v-else :is="Component" />
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import Sidebar from './components/Sidebar.vue'
import { ref, onMounted } from 'vue'
import { useSettingsStore } from './store/settings'

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