<template>
  <div class="input-area">
    <div class="textarea-container">
      <textarea 
        ref="textareaRef"
        v-model="messageInput" 
        placeholder="在这里输入消息..." 
        rows="4"
        @keydown.enter.exact.prevent="handleEnterKey"
        :disabled="disabled"
      ></textarea>
      
      <!-- 工具列表悬浮面板 -->
      <div v-if="showToolsList" class="tools-panel">
        <div v-if="isLoading" class="tools-loading">
          <span class="loader"></span>
          <p>加载工具列表中...</p>
        </div>
        <div v-else-if="error" class="tools-error">
          <p>{{ error }}</p>
        </div>
        <div v-else class="tools-list">
          <div class="tools-header">使用工具</div>
          <div v-for="(tool, index) in availableTools" :key="index" class="tool-item" @click="toggleToolSelection(tool)"
               :class="{ 'selected': selectedTools.includes(tool.name) }">
            <div class="tool-checkbox">
              <svg v-if="selectedTools.includes(tool.name)" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="tool-check">
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
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
          <span v-if="selectedTools.length > 0" class="tool-badge">{{ selectedTools.length }}</span>
        </button>
        <button class="toolbar-btn" title="文件" @click.prevent="handleFileAction">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </button>
        <button class="toolbar-btn" title="上传图片" @click.prevent="openFileUpload">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
        </button>
        <button class="toolbar-btn" title="全屏模式" @click.prevent="toggleFullscreen">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
        </button>
      </div>
    </div>
    <button 
      @click="handleSend" 
      :disabled="!canSend || disabled"
      class="send-button"
      :class="{ 'active': canSend && !disabled }"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineEmits, defineProps, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const messageInput = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isFullscreen = ref(false)
const showToolsList = ref(false)
const availableTools = ref<{ name: string; description: string }[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedTools = ref<string[]>([])

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
  send: [message: string, selectedTools?: string[]]
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
    } else {
      inputArea.classList.remove('fullscreen')
      document.body.style.overflow = ''
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

defineExpose({
  getSelectedTools: () => selectedTools.value
})

// 组件挂载时添加事件监听器和获取工具列表
onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeyDown)
  document.addEventListener('click', handleDocumentClick)
  fetchTools(); // 获取工具列表
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
}

.textarea-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
}

textarea {
  width: 100%;
  height: auto;
  min-height: 70px;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 12px 16px;
  padding-bottom: 45px; /* 为工具栏留出空间 */
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  background-color: #fafafa;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

textarea:focus {
  border-color: #1a73e8;
  background-color: white;
}

textarea::placeholder {
  color: #999;
}

/* 工具栏样式 */
.toolbar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: transparent;
  border-top: none;
  z-index: 1;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
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

.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
  width: 46px;
  height: 60px;
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.send-button:hover {
  background-color: #1666d0;
}

.send-button:active {
  background-color: #1356b0;
}

.send-button.active {
  background-color: #1a73e8;
}

.send-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* 全屏模式样式 */
.input-area.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  padding: 20px;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
}

.input-area.fullscreen .textarea-container {
  height: 100%;
}

.input-area.fullscreen textarea {
  height: 100%;
  min-height: 100%;
  font-size: 16px;
  border: 1px solid #ddd;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

@media (max-width: 600px) {
  .toolbar-btn {
    width: 28px;
    height: 28px;
  }
  
  .toolbar {
    padding: 6px 10px;
  }
  
  textarea {
    min-height: 60px;
    padding-bottom: 40px;
  }
}

/* 工具列表面板样式 */
.tools-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 100%;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.08);
  z-index: 100;
  margin-bottom: 8px;
  max-height: 280px;
  overflow-y: auto;
  animation: fadeInDown 0.2s ease-out;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

/* 加载状态样式 */
.tools-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #616161;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  margin: 8px;
}

.loader {
  width: 24px;
  height: 24px;
  border: 2px solid #e0e0e0;
  border-top-color: #2196f3;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误状态样式 */
.tools-error {
  padding: 16px;
  color: #d32f2f;
  text-align: center;
  background-color: rgba(211, 47, 47, 0.05);
  border-radius: 8px;
  margin: 8px;
  border: 1px solid rgba(211, 47, 47, 0.1);
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.08);
  }
}

.tools-list {
  padding: 12px;
}

.tools-header {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #616161;
  padding: 0 4px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.tool-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.25s ease;
  margin-bottom: 6px;
  background-color: #f9f9f9;
  border: 1px solid transparent;
  position: relative;
}

.tool-item:last-child {
  margin-bottom: 0;
}

.tool-item:hover {
  background-color: #f2f2f2;
  border-color: #e0e0e0;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.tool-item.selected {
  background-color: rgba(46, 125, 50, 0.06);
  border: 1px solid rgba(46, 125, 50, 0.2);
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.15);
}

.tool-item.selected::before {
  display: none;
}

.tool-checkbox {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  min-width: 20px;
  margin-right: 12px;
  border-radius: 4px;
  border: 1.5px solid #d0d0d0;
  background-color: white;
  transition: all 0.3s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tool-item:hover .tool-checkbox {
  border-color: #aaa;
}

.tool-item.selected .tool-checkbox {
  border-color: #2e7d32;
  background-color: #2e7d32;
  box-shadow: 0 1px 4px rgba(46, 125, 50, 0.4);
  transform: scale(1.05);
}

.tool-check {
  color: white;
  stroke: white;
  stroke-width: 2.5;
  animation: checkmark 0.2s ease-in-out;
}

@keyframes checkmark {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.tool-icon {
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-name {
  font-size: 14px;
  color: #333;
  font-weight: 500;
  transition: color 0.2s ease;
}

.tool-item.selected .tool-name {
  color: #2e7d32;
}

/* 已选工具数量标记 */
.tool-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: #1a73e8;
  color: white;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
</style> 