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
            <div class="session-title">
              <div class="title-text" :title="sessionTitles[sessionId] || sessionId.substring(0, 6)">
                {{ sessionTitles[sessionId] || sessionId.substring(0, 6) }}
              </div>
              <div class="session-id" v-if="!isSessionSidebarCollapsed">
                {{ sessionId.substring(0, 6) }}
              </div>
            </div>
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
import { listSessionIds, deleteSession as apiDeleteSession, getSessionMessages } from '../api/chat'

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

// 存储会话标题 (sessionId -> title)
const sessionTitles = ref<Record<string, string>>({})

// 获取会话第一条用户消息作为标题
const fetchSessionTitle = async (sessionId: string) => {
  try {
    const messages = await getSessionMessages(sessionId)
    // 寻找第一条用户消息
    const firstUserMessage = messages.find(msg => msg.role === 'user')
    if (firstUserMessage) {
      // 截取消息内容作为标题
      let title = firstUserMessage.content.trim()
      // 如果消息过长则截断显示
      if (title.length > 20) {
        title = title.substring(0, 20) + '...'
      }
      sessionTitles.value[sessionId] = title
    }
  } catch (error) {
    console.error(`获取会话 ${sessionId} 标题失败:`, error)
  }
}

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
    // 删除相关标题
    delete sessionTitles.value[sessionId]
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
    
    // 获取每个会话的标题
    for (const sessionId of sessionIds.value) {
      await fetchSessionTitle(sessionId)
    }
  } catch (error) {
    console.error('加载会话列表失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 监听活动会话ID变化
watch(() => props.activeSessionId, async (newId) => {
  if (newId) {
    if (!sessionIds.value.includes(newId)) {
    // 如果活动会话ID不在列表中，刷新列表
      await loadSessions()
    } else if (!sessionTitles.value[newId]) {
      // 如果存在但没有标题，获取标题
      await fetchSessionTitle(newId)
    }
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
  background-color: #f8f9fb;
  border-right: 1px solid #eaecf1;
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
  padding: 10px 12px;
  border-bottom: 1px solid #eaecf1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  color: #1a73e8;
  font-size: 14px;
  font-weight: 500;
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
  padding: 10px 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.new-session-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 14px;
  transition: all 0.2s ease;
  font-size: 13px;
  box-shadow: 0 2px 4px rgba(26, 115, 232, 0.2);
  position: relative;
  overflow: hidden;
}

.new-session-btn:hover {
  background-color: #1765cc;
  box-shadow: 0 3px 6px rgba(26, 115, 232, 0.3);
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
  gap: 6px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: white;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;
}

.session-item:hover {
  background-color: #f5f8ff;
  box-shadow: 0 2px 6px rgba(26, 115, 232, 0.08);
  transform: translateY(-1px);
}

.session-item.active {
  background-color: #e6f0ff;
  box-shadow: 0 2px 5px rgba(26, 115, 232, 0.15);
  border-left: 3px solid #1a73e8;
  padding-left: 7px;
}

.session-item.active .session-number {
  background-color: #1a73e8;
  color: white;
}

.session-item.active .title-text {
  color: #1a73e8;
  font-weight: 600;
}

.session-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0; /* 确保flex子项可以收缩 */
}

.session-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.title-text {
  font-size: 12px;
  font-weight: 500;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-id {
  font-size: 10px;
  color: #8c9aa8;
  margin-top: 2px;
}

.session-number {
  min-width: 22px;
  min-height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ecf2ff;
  color: #1a73e8;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
  margin-right: 10px;
}

.delete-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: transparent;
  border: none;
  font-size: 14px;
  line-height: 1;
  color: #aaa;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.15s ease;
}

.session-item:hover .delete-btn {
  opacity: 0.7;
}

.delete-btn:hover {
  background-color: #fee7e7;
  color: #d32f2f;
  opacity: 1 !important;
}

.loading-indicator {
  padding: 12px;
  text-align: center;
  color: #8c9aa8;
  font-size: 12px;
}

.session-sidebar.collapsed .session-title {
  display: none;
}

.session-sidebar.collapsed .session-info {
  justify-content: center;
  width: 100%;
  padding-left: 0;
}

.session-sidebar.collapsed .session-number {
  margin-right: 0;
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

.session-sidebar.collapsed .session-item {
  padding: 6px 4px;
  justify-content: center;
  overflow: hidden;
}
</style> 