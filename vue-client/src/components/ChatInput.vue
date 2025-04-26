<template>
  <div class="input-area">
    <div class="input-wrapper">
      <div class="textarea-container">
        <textarea 
          ref="textareaRef"
          class="input-textarea"
          v-model="messageInput" 
          placeholder="问一问Luna吧..." 
          rows="2"
          @input="autoResize"
          @keydown.enter.exact.prevent="handleEnterKey"
          :disabled="disabled"
        ></textarea>
        
        <!-- 工具列表悬浮面板 -->
        <div v-if="showToolsList" class="tools-panel" @click.stop>
          <div v-if="isLoading" class="tools-loading">
            <span class="loader"></span>
            <p>加载工具列表中...</p>
          </div>
          <div v-else-if="error" class="tools-error">
            <p>{{ error }}</p>
          </div>
          <div v-else class="tools-list">
            <div class="tools-header">使用工具</div>
            <div v-for="(tool, index) in availableTools" :key="index" class="tool-item" @click.stop="toggleToolSelection(tool)"
                 :class="{ 'selected': selectedTools.includes(tool.name) }">
              <div class="tool-checkbox">
                <svg v-if="selectedTools.includes(tool.name)" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="tool-check">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <span class="tool-name">{{ tool.name }}</span>
            </div>
          </div>
        </div>
        
        <!-- 工具栏 -->
        <div class="toolbar">
          <button class="toolbar-btn" title="工具" @click.prevent="toggleToolsList">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
            <span v-if="selectedTools.length > 0" class="tool-badge">{{ selectedTools.length }}</span>
          </button>
          <button class="toolbar-btn" title="文件" @click.prevent="handleFileAction">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </button>
          <button class="toolbar-btn" title="上传图片" @click.prevent="openFileUpload">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          </button>
          <button class="toolbar-btn" title="全屏模式" @click.prevent="toggleFullscreen">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
          </button>
        </div>
        
        <!-- 动态显示停止按钮或发送按钮 (移到输入框内部右下角) -->
        <button 
          v-if="isStreamActive"
          @click="handleStop" 
          class="action-button stop-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="6" width="12" height="12"></rect>
          </svg>
        </button>
        <button 
          v-else
          @click="handleSend" 
          :disabled="!canSend || disabled"
          class="action-button send-button"
          :class="{ 'active': canSend && !disabled }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineEmits, defineProps, onMounted, onUnmounted, inject } from 'vue'

const props = defineProps<{
  disabled?: boolean,
  isStreamActive?: boolean // 新增属性表示是否有活动的流传输
}>()

const messageInput = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isFullscreen = ref(false)
const showToolsList = ref(false)
const availableTools = ref<{ name: string; description: string }[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedTools = ref<string[]>([])

// 从父组件注入的isLoading状态
const isStreamActive = computed(() => props.isStreamActive === true)

interface MCPRawTool {
  name: string;
  description: string;
  parameters: {
    properties: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

// 获取工具列表
const fetchTools = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    // 从后端 API 获取工具列表
    const response = await fetch('/api/tools');
    
    if (!response.ok) {
      throw new Error(`获取工具列表失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as MCPRawTool[];
    
    // 将工具按前缀分组
    const toolsByPrefix: Record<string, boolean> = {};
    
    // 提取工具前缀
    data.forEach((tool: MCPRawTool) => {
      const parts = tool.name.split('_SERVERKEYTONAME_');
      const serverKey = parts[0]; // 服务器键名
      
      if (!toolsByPrefix[serverKey]) {
        toolsByPrefix[serverKey] = true;
      }
    });
    
    // 转换为工具列表格式
    availableTools.value = Object.keys(toolsByPrefix).map(key => ({
      name: key.startsWith('mcp_') ? key.substring(4) : key,
      description: `工具集合`
    }));
    
    isLoading.value = false;
  } catch (err) {
    console.error('获取工具列表失败:', err);
    error.value = '获取工具列表失败，请稍后重试';
    isLoading.value = false;
    
    // 使用备用数据
    availableTools.value = getBackupToolData();
  }
};

// 备用工具数据
const getBackupToolData = () => {
  return [
    { name: "smithery-ai-server-sequential-thinking", description: "工具集合" },
    { name: "smithery-ai-fetch", description: "工具集合" },
    { name: "files", description: "工具集合" },
    { name: "playwright", description: "工具集合" },
    { name: "excel-mcp-server", description: "工具集合" },
    { name: "mcp-doc", description: "工具集合" }
  ];
};

const emit = defineEmits<{
  send: [message: string, selectedTools?: string[]],
  stop: [] // 新增停止事件
}>()

const canSend = computed(() => messageInput.value.trim() !== '')

// 切换工具列表显示状态
const toggleToolsList = () => {
  showToolsList.value = !showToolsList.value
  
  // 添加active类到工具按钮
  if (showToolsList.value) {
    setTimeout(() => {
      const toolButton = document.querySelector('[title="工具"]')
      if (toolButton) {
        toolButton.classList.add('active')
      }
    }, 0)
  } else {
    const toolButton = document.querySelector('[title="工具"]')
    if (toolButton) {
      toolButton.classList.remove('active')
    }
  }
}

// 切换工具选择状态
const toggleToolSelection = (tool: { name: string }) => {
  const index = selectedTools.value.indexOf(tool.name)
  if (index === -1) {
    // 添加工具到选中列表
    selectedTools.value.push(tool.name)
  } else {
    // 从选中列表移除工具
    selectedTools.value.splice(index, 1)
  }
}

// 发送消息
const handleSend = () => {
  if (!canSend.value || props.disabled) return
  
  const message = messageInput.value.trim()
  emit('send', message, selectedTools.value.length > 0 ? selectedTools.value : undefined)
  messageInput.value = ''
  
  // Reset textarea height after sending
  setTimeout(() => {
    if (textareaRef.value) {
      // 如果当前是全屏模式，退出
      if (isFullscreen.value) {
        toggleFullscreen();
      } else {
        textareaRef.value.style.height = '40px'
      }
    }
  }, 0);
}

// 停止生成
const handleStop = () => {
  emit('stop')
}

// 点击页面其他位置时关闭工具列表
const handleDocumentClick = (event: MouseEvent) => {
  if (showToolsList.value) {
    const toolsPanel = document.querySelector('.tools-panel')
    const toolsButton = document.querySelector('[title="工具"]')
    
    if (toolsPanel && !toolsPanel.contains(event.target as Node) && 
        toolsButton && !toolsButton.contains(event.target as Node)) {
      showToolsList.value = false
      
      // 移除active类
      if (toolsButton) {
        toolsButton.classList.remove('active')
      }
    }
  }
}

const handleEnterKey = (event: KeyboardEvent) => {
  // 仅在未按下shift键的情况下按Enter发送
  if (!event.shiftKey) {
    handleSend()
  }
}

// 打开文件上传（暂时为占位函数）
const openFileUpload = () => {
  // 后续可以实现文件上传功能
  alert('文件上传功能即将推出！')
}

// 文件按钮操作（暂时为占位函数）
const handleFileAction = () => {
  // 后续可以实现文件操作功能
  alert('文件操作功能即将推出！')
}

// 切换全屏模式
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  const inputArea = textareaRef.value?.closest('.input-area')
  if (inputArea) {
    if (isFullscreen.value) {
      inputArea.classList.add('fullscreen')
      document.body.style.overflow = 'hidden'
      // 确保textarea能在全屏模式下填充可用空间
      if (textareaRef.value) {
        textareaRef.value.style.height = 'calc(100vh - 120px)'
      }
    } else {
      inputArea.classList.remove('fullscreen')
      document.body.style.overflow = ''
      // 恢复正常高度
      if (textareaRef.value) {
        autoResize()
      }
    }
  }
}

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  // 当按下回车键且当前不是在编辑状态时，聚焦到输入框
  if (e.key === 'Enter' && 
      document.activeElement !== textareaRef.value && 
      !props.disabled) {
    e.preventDefault()
    textareaRef.value?.focus()
  }
  
  // 添加ESC键退出全屏
  if (e.key === 'Escape' && isFullscreen.value) {
    toggleFullscreen()
  }
}

// Auto resize textarea based on content
const autoResize = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    const newHeight = Math.max(textareaRef.value.scrollHeight, 40); // Min height equivalent to ~3 lines
    textareaRef.value.style.height = `${newHeight}px`;
  }
}

defineExpose({
  getSelectedTools: () => selectedTools.value
})

// 组件挂载时添加事件监听器和获取工具列表
onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeyDown)
  document.addEventListener('click', handleDocumentClick)
  fetchTools(); // 获取工具列表
  
  // Set initial size
  setTimeout(() => {
    autoResize();
  }, 0);
})

// 组件卸载时移除事件监听器
onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeyDown)
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
.input-area {
  display: flex;
  align-items: center;
  padding: 0;
  background-color: white;
  position: relative;
  transition: all 0.3s ease;
  width: 100%;
}

.input-wrapper {
  position: relative;
  width: 100%;
  padding: 5px 3px;
  background-color: white;
  border-radius: 8px;
  transition: all 0.2s ease;
  margin-bottom: 0;
}

.textarea-container {
  position: relative;
  margin: 0;
  display: flex;
  background-color: #f9fafb;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 6px 36px 30px 8px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
  width: 100%;
}

.textarea-container:focus-within {
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
}

.input-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background-color: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  padding: 2px 0;
  min-height: 40px;
  height: auto;
  max-height: 200px;
  overflow-y: auto;
}

.input-textarea::placeholder {
  color: #9ca3af;
  opacity: 0.8;
}

/* 工具栏样式 */
.toolbar {
  display: flex;
  padding: 2px 4px;
  position: absolute;
  bottom: 0px;
  left: 0px;
  opacity: 0.8;
  border-radius: 6px;
  background-color: rgba(240, 240, 240, 0.8);
  transition: opacity 0.2s ease;
}

.toolbar:hover {
  opacity: 1;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #666;
  border-radius: 4px;
  margin-right: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative; /* 添加相对定位以支持工具数量标记 */
}

.toolbar-btn:hover {
  background-color: rgba(26, 115, 232, 0.1);
  color: #1a73e8;
}

.toolbar-btn:active {
  transform: scale(0.95);
}

/* 特殊样式工具按钮 */
.toolbar-btn[title="工具"] {
  color: #5f6368;
}

.toolbar-btn[title="工具"]:hover,
.toolbar-btn[title="工具"].active {
  color: #1a73e8;
  background-color: rgba(26, 115, 232, 0.1);
}

/* 发送和停止按钮的共享样式 */
.action-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 2;
}

/* 发送按钮样式 */
.send-button {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background-color: transparent;
  color: #3b82f6;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.send-button:hover {
  background-color: rgba(59, 130, 246, 0.1);
}

/* 停止按钮样式 */
.stop-button {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #d32f2f;
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.stop-button:hover {
  background-color: #e33e3e;
  transform: scale(1.05);
}

.stop-button:active {
  background-color: #b71c1c;
  transform: scale(0.95);
}

/* 全屏模式样式 */
.input-area.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 9999;
  padding: 0;
  margin: 0;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.input-area.fullscreen .input-wrapper {
  width: 100%;
  max-width: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  border-radius: 0;
}

.input-area.fullscreen .textarea-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: 20px;
  margin: 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.input-area.fullscreen .input-textarea {
  flex: 1;
  height: auto !important;
  min-height: calc(100% - 60px) !important;
  max-height: none;
  font-size: 16px;
  padding: 0;
  margin: 0;
  border: none;
  box-shadow: none;
}

.tool-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: #e53935;
  color: white;
  border-radius: 8px;
  font-size: 9px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

@media (max-width: 600px) {
  .toolbar-btn {
    width: 24px;
    height: 24px;
  }
  
  .toolbar {
    padding: 5px 8px;
  }
  
  textarea {
    min-height: 55px;
    padding-bottom: 36px;
  }
  
  .action-button {
    bottom: 6px;
    right: 6px;
    width: 28px;
    height: 28px;
  }
}

/* 工具列表面板样式 */
.tools-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 100%;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06);
  z-index: 100;
  margin-bottom: 6px;
  max-height: 260px;
  overflow-y: auto;
  animation: fadeInDown 0.2s ease-out;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

/* 加载状态样式 */
.tools-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #616161;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  margin: 6px;
}

.loader {
  width: 20px;
  height: 20px;
  border: 2px solid #e0e0e0;
  border-top-color: #2196f3;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误状态样式 */
.tools-error {
  padding: 14px;
  color: #d32f2f;
  text-align: center;
  background-color: rgba(211, 47, 47, 0.05);
  border-radius: 6px;
  margin: 6px;
  border: 1px solid rgba(211, 47, 47, 0.1);
  font-size: 12px;
}

.tools-header {
  padding: 10px 14px;
  font-weight: 600;
  color: #424242;
  border-bottom: 1px solid #eeeeee;
  background-color: #fafafa;
  position: sticky;
  top: 0;
  z-index: 2;
  font-size: 12px;
}

.tools-list {
  max-height: 260px;
  overflow-y: auto;
}

.tool-item {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.tool-item:hover {
  background-color: #f5f5f5;
}

.tool-item.selected {
  background-color: #e8f0fe;
}

.tool-checkbox {
  width: 16px;
  height: 16px;
  border: 1.5px solid #bdbdbd;
  border-radius: 3px;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.tool-item.selected .tool-checkbox {
  border-color: #1a73e8;
  background-color: #1a73e8;
}

.tool-check {
  color: white;
}

.tool-name {
  flex: 1;
  font-size: 12px;
  color: #333;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stop-generating-button {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f56c6c;
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.stop-generating-button:hover {
  background-color: #f78989;
  transform: scale(1.05);
}

.stop-generating-button:active {
  background-color: #dd6161;
  transform: scale(0.95);
}
</style> 