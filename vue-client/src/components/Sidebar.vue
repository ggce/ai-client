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
        <span class="menu-icon">💬</span>
        <span class="menu-text">聊天</span>
      </router-link>
      
      <router-link 
        to="/settings" 
        class="menu-item" 
        active-class="active"
      >
        <span class="menu-icon">⚙️</span>
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
  width: 250px;
  background-color: #f8f9fa;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: width 0.3s ease;
  position: relative;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar.collapsed .menu-text,
.sidebar.collapsed .sidebar-header h2,
.sidebar.collapsed .current-model-display {
  display: none;
}

.sidebar-header {
  padding: 15px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  color: #1a73e8;
  font-size: 18px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toggle-btn {
  background: none;
  border: none;
  color: #555;
  font-size: 18px;
  cursor: pointer;
  padding: 5px;
  line-height: 1;
}

.toggle-btn:hover {
  background-color: rgba(0,0,0,0.05);
}

.sidebar.collapsed .toggle-btn {
  transform: rotate(90deg);
}

.sidebar-menu {
  flex: 1;
  padding: 20px 0;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #555;
  border-left: 3px solid transparent;
  text-decoration: none;
}

.sidebar.collapsed .menu-item {
  padding: 12px;
  justify-content: center;
}

.menu-item:hover {
  background-color: #e8f0fe;
  color: #1a73e8;
}

.menu-item.active {
  background-color: #e8f0fe;
  color: #1a73e8;
  border-left-color: #1a73e8;
}

.menu-icon {
  margin-right: 10px;
  font-size: 16px;
}

.sidebar.collapsed .menu-icon {
  margin-right: 0;
}

.menu-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.sidebar-footer {
  padding: 15px 20px;
  border-top: 1px solid #e9ecef;
  font-size: 11px;
  color: #666;
  text-align: center;
}

.sidebar.collapsed .sidebar-footer {
  padding: 15px 5px;
}
</style> 