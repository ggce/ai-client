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
import Sidebar from '@/components/Sidebar.vue'
import { ref, onMounted } from 'vue'

const isMacOS = ref(false)

onMounted(() => {
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
}
</style>