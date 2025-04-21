<template>
  <div class="session-sidebar" :class="{ collapsed: isSessionSidebarCollapsed }">
    <div class="sidebar-header">
      <h2>会话列表</h2>
      <button @click="toggleSessionSidebar" class="toggle-btn" :disabled="isLoadingState">≡</button>
    </div>
    
    <div class="sidebar-content">
      <button @click="createNewSession" class="new-session-btn" :disabled="isLoadingState">
        <span class="icon">+</span>
        <span class="text">新建会话</span>
      </button>
      
      <div v-if="isLoading" class="loading-indicator">
        加载中...
      </div>
      
      <div v-else class="session-list">
        <div 
          v-for="(sessionId, index) in sessionIds" 
          :key="sessionId" 
          @click="!isLoadingState && selectSession(sessionId)"
          class="session-item"
          :class="{ active: sessionId === activeSessionId, disabled: isLoadingState }"
        >
          <div class="session-info">
            <div class="session-number">{{ index + 1 }}</div>
            <span class="session-id">{{ sessionId.substring(0, 6) }}</span>
          </div>
          <button 
            v-if="sessionId === activeSessionId && !isSessionSidebarCollapsed"
            @click.stop="deleteSession(sessionId)" 
            class="delete-btn"
            title="删除会话"
            :disabled="isLoadingState"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useSettingsStore } from '../store/settings'
import { createSession, listSessionIds, deleteSession as apiDeleteSession } from '../api/chat'

const props = defineProps<{
  activeSessionId: string
}>()

const emit = defineEmits<{
  'update:activeSessionId': [sessionId: string]
  'create-session': []
  'session-deleted': [sessionId: string]
}>()

// 注入全局loading状态
const isLoadingState = inject('isLoading', ref(false))

const settingsStore = useSettingsStore()
const isSessionSidebarCollapsed = computed(() => settingsStore.sessionSidebarCollapsed)
const sessionIds = ref<string[]>([])
const isLoading = ref(false)

// 切换侧边栏
const toggleSessionSidebar = () => {
  if (isLoadingState.value) return
  settingsStore.toggleSessionSidebar()
}

// 选择会话
const selectSession = (sessionId: string) => {
  if (isLoadingState.value) return
  emit('update:activeSessionId', sessionId)
}

// 创建新会话
const createNewSession = () => {
  if (isLoadingState.value) return
  emit('create-session')
}

// 删除会话
const deleteSession = async (sessionId: string) => {
  if (isLoadingState.value) return
  
  try {
    await apiDeleteSession(sessionId)
    // 从列表中移除
    sessionIds.value = sessionIds.value.filter(id => id !== sessionId)
    // 通知父组件
    emit('session-deleted', sessionId)
  } catch (error) {
    console.error('删除会话失败:', error)
  }
}

// 加载会话列表
const loadSessions = async () => {
  isLoading.value = true
  try {
    sessionIds.value = await listSessionIds()
  } catch (error) {
    console.error('加载会话列表失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 监听活动会话ID变化
watch(() => props.activeSessionId, (newId) => {
  if (newId && !sessionIds.value.includes(newId)) {
    // 如果活动会话ID不在列表中，刷新列表
    loadSessions()
  }
})

// 组件挂载时加载会话列表
onMounted(async () => {
  await loadSessions()
})
</script>

<style scoped>
.session-sidebar {
  width: 200px;
  background-color: #f0f2f5;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: width 0.3s ease;
  position: relative;
}

.session-sidebar.collapsed {
  width: 48px;
}

.sidebar-header {
  padding: 10px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  color: #1a73e8;
  font-size: 15px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toggle-btn {
  background: none;
  border: none;
  color: #555;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.toggle-btn:hover {
  background-color: rgba(0,0,0,0.05);
}

.session-sidebar.collapsed .text,
.session-sidebar.collapsed .sidebar-header h2,
.session-sidebar.collapsed .session-id {
  display: none;
}

.session-sidebar.collapsed .toggle-btn {
  transform: rotate(90deg);
}

.sidebar-content {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.new-session-btn {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 8px;
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 12px;
  transition: all 0.3s ease;
  font-size: 13px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  position: relative;
  overflow: hidden;
}

.new-session-btn:hover {
  background-color: #1558b3;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}

.new-session-btn .icon {
  font-size: 14px;
  margin-right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: margin 0.3s ease;
}

.new-session-btn .text {
  transition: opacity 0.3s ease, transform 0.3s ease;
  white-space: nowrap;
}

.session-sidebar.collapsed .new-session-btn {
  padding: 0;
  width: 32px;
  justify-content: center;
}

.session-sidebar.collapsed .new-session-btn .icon {
  margin-right: 0;
}

.session-sidebar.collapsed .new-session-btn .text {
  opacity: 0;
  transform: translateX(-10px);
  position: absolute;
  width: 0;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid #e0e0e0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  position: relative;
  overflow: visible;
}

.session-item:hover {
  background-color: #e8f0fe;
  border-color: #dae8fc;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.session-item.active {
  background-color: #e8f0fe;
  border-color: #bbdefb;
  box-shadow: 0 1px 3px rgba(26, 115, 232, 0.15);
}

.session-info {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
}

.session-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: rgba(74, 137, 220, 0.15);
  color: #4a89dc;
  font-size: 11px;
  font-weight: 500;
  margin-right: 8px;
  transition: all 0.2s ease;
  padding: 0 4px;
  position: relative;
  z-index: 1;
}

.session-item.active .session-number {
  background: rgba(58, 123, 213, 0.25);
  color: #3a7bd5;
  font-weight: 600;
}

.session-item:hover .session-number {
  background: rgba(74, 137, 220, 0.25);
}

.session-id {
  font-size: 10px;
  color: #888;
  margin-left: 4px;
  background-color: #f0f0f0;
  padding: 1px 4px;
  border-radius: 3px;
}

.delete-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #f5f5f5;
  border: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  opacity: 0.6;
  transition: opacity 0.2s, background-color 0.2s;
}

.delete-btn:hover {
  background-color: #ffcdd2;
  opacity: 1;
}

.loading-indicator {
  padding: 12px;
  text-align: center;
  color: #666;
  font-size: 12px;
}

.session-sidebar.collapsed .session-number {
  margin-right: 0;
}

.session-sidebar.collapsed .session-info {
  justify-content: center;
  width: 100%;
}

.session-sidebar.collapsed .session-item {
  justify-content: center;
  padding: 8px 4px;
}

.session-item.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.new-session-btn:disabled {
  background-color: #6c7b8a;
  transform: none;
  box-shadow: none;
}

.delete-btn:disabled {
  background-color: #e0e0e0;
  opacity: 0.5;
}
</style> 