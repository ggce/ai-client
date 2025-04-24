<template>
  <div class="sidebar" :class="{ collapsed: isSidebarCollapsed }">
    <div class="sidebar-header">
      <h2>AI聊天</h2>
      <button @click="toggleSidebar" class="toggle-btn">≡</button>
    </div>
    
    <div class="sidebar-menu">
      <router-link 
        to="/" 
        class="menu-item" 
        active-class="active" 
        exact
      >
        <div class="menu-icon-wrapper">
          <span class="menu-icon">💬</span>
        </div>
        <span class="menu-text">聊天</span>
      </router-link>
      
      <router-link 
        to="/tools" 
        class="menu-item" 
        active-class="active"
      >
        <div class="menu-icon-wrapper">
          <span class="menu-icon">🛠️</span>
        </div>
        <span class="menu-text">工具</span>
      </router-link>
      
      <router-link 
        to="/settings" 
        class="menu-item" 
        active-class="active"
      >
        <div class="menu-icon-wrapper">
          <span class="menu-icon">⚙️</span>
        </div>
        <span class="menu-text">设置</span>
      </router-link>
    </div>
    
    <div class="sidebar-footer">
      <!-- 移除了当前模型显示 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useSettingsStore } from '../store/settings'

const settingsStore = useSettingsStore()

const isSidebarCollapsed = computed(() => settingsStore.isSidebarCollapsed)

const toggleSidebar = () => {
  settingsStore.toggleSidebar()
}

// 观察侧边栏状态变化，记录日志
watch(isSidebarCollapsed, (newValue) => {
  console.log('侧边栏状态已更新为:', newValue ? '收起' : '展开')
})

// 组件挂载时记录初始状态
onMounted(() => {
  console.log('Sidebar组件挂载，初始状态:', isSidebarCollapsed.value ? '收起' : '展开')
})
</script>

<style scoped>
.sidebar {
  width: 200px;
  background-color: #f0f2f5;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: width 0.3s ease;
  position: relative;
}

.sidebar.collapsed {
  width: 48px;
}

.sidebar.collapsed .menu-text,
.sidebar.collapsed .sidebar-header h2,
.sidebar.collapsed .current-model-display {
  display: none;
}

.sidebar-header {
  padding: 10px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: transparent;
  box-shadow: none;
}

.sidebar-header h2 {
  color: #1a73e8;
  font-size: 15px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.toggle-btn {
  background: none;
  border: none;
  color: #555;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  border-radius: 3px;
  transition: all 0.2s;
  opacity: 1;
}

.toggle-btn:hover {
  background-color: rgba(0,0,0,0.05);
}

.sidebar.collapsed .toggle-btn {
  transform: rotate(90deg);
}

.sidebar-menu {
  flex: 1;
  padding: 10px 0;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  margin: 4px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #555;
  border-radius: 4px;
  text-decoration: none;
  border: 1px solid transparent;
  background-color: rgba(255, 255, 255, 0.8);
}

.sidebar.collapsed .menu-item {
  padding: 10px 0;
  justify-content: center;
  margin: 4px;
}

.menu-item:hover {
  background-color: #e8f0fe;
  color: #1a73e8;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  transform: translateY(-1px);
}

.menu-item.active {
  background-color: #e8f0fe;
  color: #1a73e8;
  border-color: #bbdefb;
  box-shadow: 0 1px 3px rgba(26, 115, 232, 0.15);
}

.menu-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: 8px;
}

.menu-icon {
  font-size: 14px;
}

.sidebar.collapsed .menu-icon-wrapper {
  margin-right: 0;
}

.menu-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}

.sidebar-footer {
  padding: 10px 12px;
  border-top: 1px solid #e9ecef;
  font-size: 10px;
  color: #888;
  text-align: center;
}

.sidebar.collapsed .sidebar-footer {
  padding: 10px 4px;
}
</style> 