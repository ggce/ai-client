<template>
  <div class="sidebar" :class="{ collapsed: isSidebarCollapsed }">
    <div class="sidebar-header">
      <h2>Luna</h2>
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
  background-color: #f8f9fb;
  border-right: 1px solid #eaecf1;
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
  padding: 10px 12px;
  border-bottom: 1px solid #eaecf1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  color: #1a73e8;
  font-size: 14px;
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
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background-color: rgba(0,0,0,0.05);
  color: #1a73e8;
}

.sidebar.collapsed .toggle-btn {
  transform: rotate(90deg);
}

.sidebar-menu {
  flex: 1;
  padding: 10px 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  margin: 4px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #555;
  border-radius: 6px;
  text-decoration: none;
  border: none;
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.sidebar.collapsed .menu-item {
  padding: 6px 4px;
  justify-content: center;
  margin: 4px;
  overflow: hidden;
}

.menu-item:hover {
  background-color: #f5f8ff;
  color: #1a73e8;
  box-shadow: 0 2px 6px rgba(26, 115, 232, 0.08);
  transform: translateY(-1px);
}

.menu-item.active {
  background-color: #e6f0ff;
  color: #1a73e8;
  border-left: 3px solid #1a73e8;
  padding-left: 7px;
  box-shadow: 0 2px 5px rgba(26, 115, 232, 0.15);
}

.menu-icon-wrapper {
  min-width: 22px;
  min-height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ecf2ff;
  color: #1a73e8;
  border-radius: 50%;
  font-size: 11px;
  flex-shrink: 0;
  margin-right: 10px;
}

.sidebar.collapsed .menu-icon-wrapper {
  margin-right: 0;
}

.menu-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 500;
  color: #222;
}

.sidebar-footer {
  padding: 10px 12px;
  border-top: 1px solid #eaecf1;
  font-size: 9px;
  color: #888;
  text-align: center;
}

.sidebar.collapsed .sidebar-footer {
  padding: 10px 4px;
}

.sidebar-title {
  font-size: 15px;
}

.sidebar-item {
  font-size: 13px;
}

.item-timestamp {
  font-size: 12px;
}

.empty-text {
  font-size: 9px;
}

.menu-icon {
  font-size: 10px;
}

.sidebar.collapsed .menu-item.active {
  border-left: none;
  border-left-width: 0;
  padding-left: 0;
  border-radius: 50%;
  background-color: #e6f0ff;
}

.menu-item.active .menu-icon-wrapper {
  background-color: #1a73e8;
  color: white;
}

.menu-item.active .menu-text {
  color: #1a73e8;
  font-weight: 600;
}

.sidebar.collapsed .menu-icon-wrapper {
  margin-right: 0;
}

.sidebar.collapsed .menu-item {
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 4px auto;
  padding: 0;
}
</style> 