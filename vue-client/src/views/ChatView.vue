<template>
  <div class="panel">
    <div class="chat-content">
      <header class="compact-header">
        <div class="header-content">
          <h1>AI聊天 <small>{{ modelDisplay }}</small></h1>
          <div class="header-controls">
            <!-- 删除流式开关 -->
          </div>
        </div>
      </header>

      <main>
        <div class="chat-container">
          <MessageList 
            :messages="displayMessages" 
            :isLoading="isLoading" 
            :streamingMessage="streamingMessage" 
            :streamingReasoningContent="streamingReasoningContent" 
          />
          <ChatToolbar :messages="sessionMessages" />
          <div class="input-wrapper">
            <ChatInput @send="sendMessage" :disabled="isLoading || !activeSessionId" />
          </div>
        </div>
      </main>
    </div>
    
    <SessionSidebar 
      :activeSessionId="activeSessionId"
      @update:activeSessionId="setActiveSessionId"
      @create-session="handleCreateSession"
      @session-deleted="handleSessionDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, inject, provide } from 'vue'
import { Ref } from 'vue'
// 使用类型断言
import MessageList from '../components/MessageList.vue'
import ChatInput from '../components/ChatInput.vue'
import SessionSidebar from '../components/SessionSidebar.vue'
import ChatToolbar from '../components/ChatToolbar.vue'
import { useSettingsStore } from '../store/settings'
import {
  createSession,
  listSessionIds,
  getSessionMessages,
  sendStreamingSessionMessage,
  deleteSession,
  SessionMessage
} from '../api/chat'

// 定义组件名称
defineOptions({
  name: 'ChatView'
})

interface ChatMessage {
  type: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  reasoningContent?: string // 添加推理内容字段
}

// 本地管理会话ID
const activeSessionId = ref<string>('')

// 将activeSessionId提供给可能需要的子组件
provide('activeSessionId', activeSessionId)

// 会话状态
const sessionMessages = ref<SessionMessage[]>([])

// 聊天状态
const isLoading = ref(false)
const streamingMessage = ref<string>('')
const streamingReasoningContent = ref<string>('') // 添加流式推理内容

// 将isLoading提供给其他组件
provide('isLoading', isLoading)

const settingsStore = useSettingsStore()

// 设置活动会话ID
const setActiveSessionId = (sessionId: string) => {
  activeSessionId.value = sessionId
}

// 创建新会话
const handleCreateSession = async () => {
  try {
    const sessionId = await createSession()
    activeSessionId.value = sessionId
  } catch (error) {
    console.error('创建会话失败:', error)
  }
}

// 处理会话删除
const handleSessionDeleted = (deletedId: string) => {
  if (activeSessionId.value === deletedId) {
    activeSessionId.value = ''
  }
}

// 转换服务器消息到显示消息
const displayMessages = computed<ChatMessage[]>(() => {
  if (!activeSessionId.value) {
    return [{ type: 'system', content: '请在右侧边栏选择或创建一个会话开始聊天' }]
  }
  
  if (sessionMessages.value.length === 0) {
    return [{ type: 'system', content: '这是一个新的会话，开始聊天吧！' }]
  }
  
  return sessionMessages.value.map(msg => {
    let type = msg.role
    
    // 确保reasoningContent是字符串或undefined
    const reasoningContent = typeof msg.reasoningContent === 'string' 
      ? msg.reasoningContent 
      : undefined
    
    return {
      type,
      content: msg.content,
      reasoningContent
    }
  })
})

// 计算当前使用的模型显示文本
const modelDisplay = computed(() => {
  const provider = settingsStore.currentProvider
  const config = settingsStore.providers[provider]
  
  if (!config?.apiKey) {
    return '未配置API密钥'
  }
  
  let modelName = config.model || '默认模型'
  
  // 针对DeepSeek模型显示版本名称
  if (provider === 'deepseek') {
    if (modelName === 'deepseek-chat' || (!config.model)) {
      return 'DeepSeek V3'
    } else if (modelName === 'deepseek-reasoner') {
      return 'DeepSeek R1'
    }
  }
  
  // 返回与设置页一致的格式
  return modelName
})

// 检查提供商配置
const isProviderConfigured = () => {
  const provider = settingsStore.currentProvider
  return !!settingsStore.providers[provider]?.apiKey
}

// 加载会话历史
const loadSessionMessages = async (sessionId: string) => {
  if (!sessionId) return
  
  try {
    sessionMessages.value = await getSessionMessages(sessionId)
  } catch (error) {
    console.error('加载会话历史失败:', error)
    sessionMessages.value = []
  }
}

// 发送消息
const sendMessage = async function(message?: string) {
  if (!isProviderConfigured()) {
    sessionMessages.value.push({
      role: 'system',
      content: '请先在设置页面配置API Key。',
    });
    return;
  }

  if (!activeSessionId.value) {
    sessionMessages.value.push({
      role: 'system',
      content: '请先选择或创建一个会话。',
    });
    return;
  }

  if (message) {
    // 添加用户消息
    const userMessage = {
      role: 'user' as const,
      content: message,
    };
    sessionMessages.value.push(userMessage);
  }

  // 开始加载
  isLoading.value = true
  streamingMessage.value = ''
  streamingReasoningContent.value = ''

  let isUseToolCall = false;

  try {
    // 使用流式请求
    const stream = await sendStreamingSessionMessage(
      activeSessionId.value,
      message,
      {
        model: settingsStore.providers[settingsStore.currentProvider]?.model,
      }
    );

    // 正在接收流式信息
    stream.onMessage(({
      content,  // 文本内容
      reasoningContent, // 推理内容
      toolCalls,  // 工具
      isMessageUpdate // 消息是否更新
    }) => {
      // 文本内容
      streamingMessage.value += content;
      // 推理内容
      if (reasoningContent) {
        streamingReasoningContent.value += reasoningContent;
      }
      // 使用了工具
      if (toolCalls) {
        console.log("需要调用工具");
        console.log(toolCalls);
        isUseToolCall = true;
      }

      // 消息更新
      if (isMessageUpdate) {
        // 重新查询最新的对话
        loadSessionMessages(activeSessionId.value);
      }
    });
    
    // 等待流式响应完成
    await new Promise<void>((resolve) => {
      stream.onComplete(() => resolve());
      stream.onError(() => resolve());
    });
  } catch (error) {
    console.error('Failed to send message:', error)
    // 更新最后一条AI消息为错误信息
    const lastMessage = sessionMessages.value[sessionMessages.value.length - 1]
    lastMessage.content = '消息发送失败，请稍后再试或检查API配置。'
  } finally {
    // 重新查询最新的对话
    await loadSessionMessages(activeSessionId.value);

    // 如果调用了工具，则再请求一次
    if (isUseToolCall) {
      sendMessage();
    } else {
      // 结束加载
      isLoading.value = false
      streamingMessage.value = ''
      streamingReasoningContent.value = ''
    }
  }
}

// 监听会话变化
watch(() => activeSessionId.value, async (newSessionId) => {
  if (newSessionId) {
    await loadSessionMessages(newSessionId)
  } else {
    sessionMessages.value = []
  }
})

// 组件挂载时加载会话列表
onMounted(async () => {
  settingsStore.loadSettings()
  
  // 如果已经有活动会话ID，加载其消息
  if (activeSessionId.value) {
    await loadSessionMessages(activeSessionId.value)
  }
})
</script>

<style scoped>
.panel {
  display: flex;
  height: 100vh;
  max-height: 100vh;
  width: 100%;
}

.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.compact-header {
  background-color: #f5f5f5;
  padding: 10px 20px;
  border-bottom: 1px solid #e0e0e0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.stream-toggle-compact {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.slider-compact {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
  background-color: #ccc;
  border-radius: 20px;
  margin-right: 10px;
  transition: .4s;
}

.slider-compact:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: .4s;
}

input:checked + .slider-compact {
  background-color: #1890ff;
}

input:checked + .slider-compact:before {
  transform: translateX(20px);
}

.toggle-label-compact {
  font-size: 14px;
  color: #333;
}

main {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.input-wrapper {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
  background-color: #fff;
}

h1 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

h1 small {
  font-size: 14px;
  color: #888;
  font-weight: normal;
  margin-left: 8px;
}

.hidden-checkbox {
  position: absolute;
  opacity: 0;
  height: 0;
  width: 0;
}
</style>