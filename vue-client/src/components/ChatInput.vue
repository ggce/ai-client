<template>
  <div class="input-area" :class="{ 'fullscreen': isFullscreen }">
    <div class="input-wrapper">
      <div class="textarea-container">
        <textarea 
          ref="textareaRef"
          class="input-textarea"
          v-model="messageInput" 
          :placeholder="isFullscreen ? '按Enter键换行，按Ctrl+Enter发送消息...' : '问一问Luna吧...'" 
          rows="2"
          @input="autoResize"
          @keydown.enter="handleEnterKey"
          @keydown.ctrl.enter="handleSend"
          :disabled="disabled"
        ></textarea>
        
        <!-- 全屏模式下的提示 -->
        <div v-if="isFullscreen" class="fullscreen-tips">
          <kbd>Enter</kbd> 换行 | <kbd>Ctrl+Enter</kbd> 发送 | <kbd>Esc</kbd> 退出全屏
        </div>
        
        <!-- 修改常用提示语面板，使用共享样式类 -->
        <div v-if="showPromptsList" class="floating-panel prompts-panel" @click.stop>
          <div class="panel-header">
            <span>常用提示语</span>
            <div class="header-right">
              <div class="tabs">
                <div 
                  class="tab-item" 
                  :class="{ 'active': selectedPromptTab === 'builtin' }" 
                  @click="switchPromptTab('builtin')"
                >
                  内置
                </div>
                <div 
                  class="tab-item" 
                  :class="{ 'active': selectedPromptTab === 'custom' }" 
                  @click="switchPromptTab('custom')"
                >
                  自定义
                </div>
              </div>
              <button v-if="selectedPromptTab === 'custom'" class="add-prompt-btn" @click="showAddPromptModal = true">
                <span class="add-icon">+</span> 添加
              </button>
            </div>
          </div>
          <div class="panel-content">
            <div v-if="currentTabPrompts.length === 0" class="empty-prompts">
              <div class="empty-icon">📝</div>
              <div class="empty-text">暂无自定义提示语</div>
              <div v-if="selectedPromptTab === 'custom'" class="empty-subtext">点击上方"添加"按钮添加</div>
              <div v-else class="empty-subtext">您可以在设置中添加自定义提示语</div>
            </div>
            <div v-else v-for="(prompt, index) in currentTabPrompts" 
                 :key="index" 
                 class="prompt-item"
                 @click="usePrompt(prompt.prompt)">
              <div class="prompt-title">{{ prompt.title }}</div>
              <div class="prompt-text">{{ prompt.prompt }}</div>
              <div v-if="selectedPromptTab === 'custom'" class="prompt-actions" @click.stop>
                <button class="prompt-delete-btn" @click.stop="deleteCustomPrompt(index)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 添加提示语弹窗 -->
        <div v-if="showAddPromptModal" class="modal-overlay" @click="showAddPromptModal = false">
          <div class="modal-container" @click.stop>
            <div class="modal-header">
              <h3>添加自定义提示语</h3>
              <button class="modal-close-btn" @click="showAddPromptModal = false">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label for="promptTitle">标题</label>
                <input 
                  type="text" 
                  id="promptTitle" 
                  v-model="newPrompt.title" 
                  placeholder="输入提示语标题" 
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label for="promptText">内容</label>
                <textarea 
                  id="promptText" 
                  v-model="newPrompt.prompt" 
                  placeholder="输入提示语内容" 
                  class="form-textarea"
                  rows="4"
                ></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="modal-cancel-btn" @click="showAddPromptModal = false">取消</button>
              <button class="modal-save-btn" @click="saveCustomPrompt" :disabled="!newPrompt.title || !newPrompt.prompt">保存</button>
            </div>
          </div>
        </div>
        
        <!-- 工具列表悬浮面板 -->
        <div v-if="showToolsList" class="floating-panel tools-panel" @click.stop>
          <div v-if="isLoading" class="tools-loading">
            <span class="loader"></span>
            <p>加载工具列表中...</p>
          </div>
          <div v-else-if="error" class="tools-error">
            <p>{{ error }}</p>
          </div>
          <div v-else class="tools-list">
            <div class="panel-header">工具列表</div>

            <!-- 工具类型标签页 -->
            <div class="tools-tabs">
              <div class="tab-item" 
                   :class="{ 'active': selectedTab === 'all' }" 
                   @click="selectedTab = 'all'">
                全部<span class="tab-count">{{ availableTools.length }}</span>
              </div>
              <div v-for="type in toolTypes" 
                   :key="type" 
                   class="tab-item" 
                   :class="{ 'active': selectedTab === type }" 
                   @click="selectedTab = type">
                {{ type }}<span class="tab-count">{{ toolsByType[type]?.length || 0 }}</span>
              </div>
            </div>

            <!-- 工具列表 -->
            <div class="panel-content">
              <div v-if="currentTabTools.length === 0" class="tools-empty">
                当前分类下没有可用工具
              </div>
              <div v-for="(tool, index) in currentTabTools" :key="index" class="tool-item"
                   :class="{ 'selected': selectedTools.includes(tool.name) }">
                <div class="tool-checkbox" @click.stop="toggleToolSelection(tool)">
                  <svg v-if="selectedTools.includes(tool.name)" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="tool-check">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div class="tool-info">
                  <span class="tool-name">{{ tool.name }}</span>
                  <span v-if="tool.type" class="tool-type">{{ tool.type }}</span>
                </div>
                <span v-if="tool.description" class="tool-description">{{ tool.description }}</span>
              </div>
            </div>

            <!-- 已选工具栏 - 移到底部 -->
            <div v-if="selectedTools.length > 0" class="selected-tools-bar">
              <div class="selected-tools-header">
                <div class="selected-tools-title">已选工具</div>
                <button class="clear-tools-btn" @click="clearSelectedTools">清空</button>
              </div>
              <div class="selected-tools-list">
                <div v-for="toolName in selectedTools" :key="toolName" class="selected-tool-item">
                  {{ toolName }}
                  <button class="remove-tool-btn" @click.stop="toggleToolSelection({name: toolName})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 工具栏 -->
        <div class="toolbar">
          <button 
            class="toolbar-btn tools-button" 
            @click.stop="toggleToolsList"
            :class="{ 'active': showToolsList }"
            title="选择工具"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
            <span v-if="selectedTools.length > 0" class="tool-badge">{{ selectedTools.length }}</span>
          </button>
          <button 
            class="toolbar-btn prompts-button" 
            @click.stop="togglePromptsList"
            :class="{ 'active': showPromptsList }"
            title="常用提示语"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
          <button class="toolbar-btn" title="文件" @click.prevent="handleFileAction">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </button>
          <button class="toolbar-btn" title="上传图片" @click.prevent="handleImgUpload">
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
import { ref, computed, defineEmits, defineProps, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  disabled?: boolean,
  isStreamActive?: boolean // 新增属性表示是否有活动的流传输
}>()

const messageInput = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isFullscreen = ref(false)
const showToolsList = ref(false)
const availableTools = ref<{ name: string; description: string; type?: string }[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedTools = ref<string[]>([])
const selectedTab = ref<string>('all') // 默认选中全部标签
const toolTypes = ref<string[]>([]) // 存储所有工具类型
const showPromptsList = ref(false)
const selectedPromptTab = ref('builtin') // 默认选中内置标签
const showAddPromptModal = ref(false)
const newPrompt = ref<CustomPrompt>({ title: '', prompt: '' })

// 修改自定义提示语类型定义
interface CustomPrompt {
  title: string;
  prompt: string;
}

const builtinPrompts = ref([
  { title: '翻译为中文', prompt: '请将以下内容翻译为中文：' },
  { title: '翻译为英文', prompt: '请将以下内容翻译为英文：' },
  { title: '总结内容', prompt: '请总结以下内容的要点：' },
  { title: '代码解释', prompt: '请解释以下代码的功能和工作原理：' },
  { title: '优化代码', prompt: '请优化以下代码，提高其性能和可读性：' },
  { title: '写邮件', prompt: '请帮我写一封邮件，内容是：' },
  { title: '润色文本', prompt: '请帮我润色以下文本，使其更加专业和流畅：' },
  { title: '头脑风暴', prompt: '请围绕以下主题进行头脑风暴，提供多种创意和想法：' },
  { title: '分析问题', prompt: '请分析以下问题的原因和可能的解决方案：' },
  { title: '写作建议', prompt: '请针对以下写作内容给出改进建议：' },
  { title: '创建计划', prompt: '请帮我创建一个详细的计划来实现以下目标：' },
  { title: '比较异同', prompt: '请比较以下两个概念/产品的异同点：' },
])

const customPrompts = ref<CustomPrompt[]>([])

// 获取当前选中标签页的提示语
const currentTabPrompts = computed(() => {
  return selectedPromptTab.value === 'builtin' ? builtinPrompts.value : customPrompts.value
})

// 按类型分组的工具
const toolsByType = computed(() => {
  const result: Record<string, typeof availableTools.value> = { 'all': availableTools.value }
  
  // 按类型分组
  availableTools.value.forEach(tool => {
    if (tool.type) {
      if (!result[tool.type]) {
        result[tool.type] = []
      }
      result[tool.type].push(tool)
    }
  })
  
  return result
})

// 当前选中标签页的工具
const currentTabTools = computed(() => {
  return selectedTab.value === 'all' ? availableTools.value : toolsByType.value[selectedTab.value] || []
})

// 从父组件注入的isLoading状态
const isStreamActive = computed(() => props.isStreamActive === true)

// 获取工具列表
const fetchTools = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    // 从后端 API 获取MCP服务器配置
    const response = await fetch('/api/mcp-servers');
    
    if (!response.ok) {
      throw new Error(`获取服务器配置失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const { servers, serverTypeMap } = data;
    
    // 转换为工具列表格式
    availableTools.value = Object.keys(servers).map(key => ({
      name: key,
      description: servers[key].description || `工具集合`,
      type: servers[key].type ? serverTypeMap[servers[key].type] : undefined
    }));
    
    // 收集所有工具类型
    const types = new Set<string>();
    availableTools.value.forEach(tool => {
      if (tool.type) {
        types.add(tool.type);
      }
    });
    toolTypes.value = Array.from(types);
    
    isLoading.value = false;
  } catch (err) {
    console.error('获取服务器配置失败:', err);
    error.value = '获取服务器配置失败，请稍后重试';
    isLoading.value = false;
    
    availableTools.value = [];
  }
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
      const toolButton = document.querySelector('.tools-button')
      if (toolButton) {
        toolButton.classList.add('active')
      }
    }, 0)
  } else {
    const toolButton = document.querySelector('.tools-button')
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
  // 获取点击的元素
  const target = event.target as HTMLElement;
  
  // 检查点击是否在工具按钮上
  const toolsButton = document.querySelector('.tools-button');
  if (toolsButton && toolsButton.contains(target)) {
    return; // 点击的是工具按钮，不处理
  }
  
  // 检查点击是否在提示语按钮上
  const promptsButton = document.querySelector('.prompts-button');
  if (promptsButton && promptsButton.contains(target)) {
    return; // 点击的是提示语按钮，不处理
  }
  
  // 检查点击是否在工具面板内
  const toolsPanel = document.querySelector('.tools-panel');
  if (toolsPanel && !toolsPanel.contains(target) && showToolsList.value) {
    showToolsList.value = false;
  }
  
  // 检查点击是否在提示语面板内
  const promptsPanel = document.querySelector('.prompts-panel');
  if (promptsPanel && !promptsPanel.contains(target) && showPromptsList.value) {
    showPromptsList.value = false;
  }
}

const handleEnterKey = (event: KeyboardEvent) => {
  // 在全屏模式下，回车键直接换行而不发送消息
  if (isFullscreen.value) {
    // 在全屏模式下不阻止默认行为，允许换行
    return;
  }
  
  // 在非全屏模式下，仅在未按下shift键的情况下按Enter发送
  if (!event.shiftKey) {
    event.preventDefault(); // 阻止默认换行行为
    handleSend();
  }
}

// 图片上传
const handleImgUpload = () => {
  // 后续可以实现图片上传功能
  console.log('图片上传功能即将推出！');
}

// 文件按钮操作（暂时为占位函数）
const handleFileAction = () => {
  // 后续可以实现文件操作功能
  console.log('文件操作功能即将推出！');
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

  // 加载自定义提示语
  loadCustomPrompts();
})

// 组件卸载时移除事件监听器
onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeyDown)
  document.removeEventListener('click', handleDocumentClick)
})

// Add this function to clear all selected tools
const clearSelectedTools = () => {
  selectedTools.value = [];
}

// 切换提示语列表显示状态
const togglePromptsList = () => {
  showPromptsList.value = !showPromptsList.value
  
  // 添加active类到提示语按钮
  if (showPromptsList.value) {
    setTimeout(() => {
      const promptButton = document.querySelector('.prompts-button')
      if (promptButton) {
        promptButton.classList.add('active')
      }
    }, 0)
  } else {
    const promptButton = document.querySelector('.prompts-button')
    if (promptButton) {
      promptButton.classList.remove('active')
    }
  }
  
  // 如果打开提示语列表，则关闭工具列表
  if (showPromptsList.value && showToolsList.value) {
    showToolsList.value = false
    const toolButton = document.querySelector('.tools-button')
    if (toolButton) {
      toolButton.classList.remove('active')
    }
  }
}

// 使用提示语
const usePrompt = (promptText: string) => {
  messageInput.value = promptText
  showPromptsList.value = false
}

// 切换提示语标签页
const switchPromptTab = (tabName: string) => {
  selectedPromptTab.value = tabName
}

// 添加自定义提示语
const saveCustomPrompt = async () => {
  try {
    // 先添加到本地状态
    customPrompts.value.push({...newPrompt.value})
    
    // 保存到服务器
    const response = await fetch('/api/custom-prompts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompts: customPrompts.value
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to save custom prompts')
    }
    
    // 重置表单并关闭弹窗
    showAddPromptModal.value = false
    newPrompt.value = { title: '', prompt: '' }
  } catch (error) {
    console.error('Error saving custom prompt:', error)
    // 可以添加错误提示
  }
}

// 删除自定义提示语
const deleteCustomPrompt = async (index: number) => {
  try {
    // 先从本地状态删除
    customPrompts.value.splice(index, 1)
    
    // 保存到服务器
    const response = await fetch('/api/custom-prompts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompts: customPrompts.value
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to save custom prompts after deletion')
    }
  } catch (error) {
    console.error('Error deleting custom prompt:', error)
    // 可以添加错误提示
  }
}

// 加载自定义提示语
const loadCustomPrompts = async () => {
  try {
    const response = await fetch('/api/custom-prompts')
    if (response.ok) {
      const data = await response.json()
      customPrompts.value = data.prompts || []
    }
  } catch (error) {
    console.error('Failed to load custom prompts:', error)
  }
}
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

.toolbar-btn.active {
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
  background-color: #f56c6c;
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.stop-button:hover {
  background-color: #f78989;
  transform: scale(1.05);
}

.stop-button:active {
  background-color: #dd6161;
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
  padding-bottom: 40px; /* 增加底部空间放置提示 */
  margin: 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
  position: relative;
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
  line-height: 1.6;
}

.tool-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background-color: #f44336;
  color: white;
  border-radius: 50%;
  font-size: 10px;
  min-width: 15px;
  height: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  font-weight: bold;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
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

/* 添加共享的浮动面板样式 */
.floating-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 100%;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05);
  z-index: 100;
  margin-bottom: 10px;
  overflow-y: auto;
  animation: fadeInDown 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(0, 0, 0, 0.06);
  max-height: 500px;
  transform-origin: top center;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #eeeeee;
  font-weight: 600;
  color: #424242;
  background-color: #fafafa;
  position: sticky;
  top: 0;
  z-index: 3;
  font-size: 13px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-content {
  max-height: 370px;
  overflow-y: auto;
  padding: 4px 0;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: #dadce0 #f8f9fa;
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: #f8f9fa;
}

.panel-content::-webkit-scrollbar-thumb {
  background-color: #dadce0;
  border-radius: 6px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background-color: #bdc1c6;
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

.tools-list {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 修改提示语样式，与工具样式保持一致 */
.prompts-list {
  padding: 0;
}

.prompt-item {
  padding: 8px 14px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.prompt-item:hover {
  background-color: #f8f9fa;
}

.prompt-item:active {
  background-color: #f0f7ff;
}

.prompt-item::after {
  content: '';
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23aaa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='9 18 15 12 9 6'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.5;
  transition: all 0.2s;
}

.prompt-item:hover::after {
  opacity: 0.8;
  right: 12px;
}

.prompt-title {
  font-size: 12px;
  font-weight: 500;
  color: #202124;
  margin-bottom: 1px;
  padding-right: 20px;
}

.prompt-text {
  font-size: 11px;
  color: #5f6368;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 20px;
  line-height: 1.2;
}

/* 保留原有的空状态样式 */
.empty-prompts {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 4px;
}

.empty-subtext {
  font-size: 0.85rem;
  color: var(--color-text-light);
}

/* 添加淡入动画 */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 工具项样式 */
.tool-item {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 12px;
  position: relative;
  overflow: hidden;
}

.tool-item:hover {
  background-color: #f8f9fa;
}

.tool-item.selected {
  background-color: #f0f7ff;
}

.tool-item.selected:hover {
  background-color: #e8f3ff;
}

.tool-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid #bdbdbd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  background-color: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tool-item.selected .tool-checkbox {
  border-color: #1a73e8;
  background-color: #1a73e8;
  transform: scale(1.05);
}

.tool-check {
  color: white;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tool-item.selected .tool-check {
  opacity: 1;
  transform: scale(1);
}

.tool-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 8px;
}

.tool-name {
  font-size: 13px;
  color: #202124;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}

.tool-item:hover .tool-name {
  color: #1a73e8;
}

.tool-type {
  font-size: 11px;
  color: #1a73e8;
  background-color: #e8f0fe;
  padding: 2px 8px;
  border-radius: 12px;
  display: inline-block;
  flex-shrink: 0;
  border: 1px solid #d2e3fc;
  transition: all 0.2s;
  font-weight: 500;
}

.tool-item:hover .tool-type {
  background-color: #d2e3fc;
  border-color: #b8d3fb;
}

.tool-description {
  font-size: 12px;
  color: #5f6368;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  flex-shrink: 0;
  transition: color 0.2s;
}

.tool-item:hover .tool-description {
  color: #3c4043;
}

/* 标签页样式 */
.tools-tabs {
  display: flex;
  overflow-x: auto;
  padding: 0 10px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 34px;
  z-index: 2;
  white-space: nowrap;
  scrollbar-width: thin;
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
  flex-shrink: 0; /* Prevent tabs from shrinking */
  min-height: 36px; /* Ensure minimum height for tabs */
}

.tools-tabs::-webkit-scrollbar {
  height: 3px;
}

.tools-tabs::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.tools-tabs::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.tab-item {
  padding: 8px 14px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tab-item:hover {
  color: #1a73e8;
  background-color: rgba(26, 115, 232, 0.05);
}

.tab-item.active {
  color: #1a73e8;
  border-bottom-color: #1a73e8;
  font-weight: 500;
}

.tab-count {
  font-size: 10px;
  background-color: #e0e0e0;
  color: #666;
  border-radius: 10px;
  padding: 0 5px;
  min-width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
}

.tab-item.active .tab-count {
  background-color: #1a73e8;
  color: white;
}

/* 已选工具栏样式 */
.selected-tools-bar {
  padding: 8px 12px;
  border-top: 1px solid #e0e0e0;
  background-color: #f5f7fa;
  position: sticky;
  bottom: 0;
  z-index: 2;
  width: 100%;
  box-sizing: border-box;
}

.selected-tools-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.selected-tools-title {
  font-size: 12px;
  font-weight: 500;
  color: #424242;
}

.selected-tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.selected-tool-item {
  background-color: #e8f0fe;
  color: #1a73e8;
  padding: 5px 10px;
  border-radius: 16px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #d2e3fc;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.selected-tool-item:hover {
  background-color: #d2e3fc;
}

.remove-tool-btn {
  background: none;
  border: none;
  padding: 1px;
  cursor: pointer;
  color: #5f6368;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  width: 14px;
  height: 14px;
}

.remove-tool-btn:hover {
  background-color: rgba(0, 0, 0, 0.08);
  color: #d93025;
}

.clear-tools-btn {
  background: none;
  border: none;
  color: #1a73e8;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.clear-tools-btn:hover {
  background-color: rgba(26, 115, 232, 0.08);
}

.tools-empty {
  padding: 20px;
  text-align: center;
  color: #666;
  font-size: 13px;
  background-color: #f9f9f9;
  border-radius: 4px;
  margin: 10px;
}

.tabs {
  display: flex;
  gap: 8px;
}

/* 自定义提示语头部 */
.custom-prompts-header {
  display: none;
}

.add-prompt-btn {
  background-color: #e8f0fe;
  color: #1a73e8;
  border: 1px solid #d2e3fc;
  border-radius: 16px;
  padding: 2px 10px;
  font-size: 12px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.add-prompt-btn:hover {
  background-color: #d2e3fc;
  border-color: #b8d3fb;
}

.add-icon {
  font-size: 14px;
  font-weight: bold;
}

/* 提示语操作按钮 */
.prompt-actions {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
}

.prompt-item:hover .prompt-actions {
  display: block;
}

.prompt-item:hover::after {
  display: none;
}

.prompt-delete-btn {
  background: none;
  border: none;
  color: #5f6368;
  padding: 4px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.prompt-delete-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #d93025;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background-color: white;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: modalFadeIn 0.2s ease;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: 16px;
  border-bottom: 1px solid #eeeeee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #202124;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #5f6368;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-body {
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #5f6368;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
  color: #202124;
  box-sizing: border-box;
}

.form-input:focus, .form-textarea:focus {
  border-color: #1a73e8;
  outline: none;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
}

.form-textarea {
  resize: vertical;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #eeeeee;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-cancel-btn, .modal-save-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-cancel-btn {
  background-color: transparent;
  color: #5f6368;
  border: 1px solid #dadce0;
}

.modal-cancel-btn:hover {
  background-color: #f1f3f4;
}

.modal-save-btn {
  background-color: #1a73e8;
  color: white;
  border: none;
}

.modal-save-btn:hover {
  background-color: #1967d2;
}

.modal-save-btn:disabled {
  background-color: #dadce0;
  cursor: not-allowed;
}
</style> 