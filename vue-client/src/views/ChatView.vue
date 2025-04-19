<template>
  <div class="panel">
    <header class="compact-header">
      <div class="header-content">
        <h1>AI聊天 <small>{{ modelDisplay }}</small></h1>
        <label class="stream-toggle-compact">
          <input type="checkbox" v-model="useStreaming">
          <span class="slider-compact"></span>
          <span class="toggle-label-compact">流式输出</span>
        </label>
      </div>
    </header>

    <main>
      <div class="chat-container">
        <MessageList :messages="messages" :isLoading="isLoading" :streamingMessage="streamingMessage" />
        <div class="input-wrapper">
          <ChatInput @send="sendMessage" :disabled="isLoading" />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated, onDeactivated, computed } from 'vue'
import MessageList from '../components/MessageList.vue'
import ChatInput from '../components/ChatInput.vue'
import { useSettingsStore } from '../store/settings'
import { sendChatRequest, sendStreamingChatRequest } from '../api/chat'

// 定义组件名称
defineOptions({
  name: 'ChatView'
})

interface ChatMessage {
  type: 'user' | 'ai' | 'system'
  content: string
}

const messages = ref<ChatMessage[]>([
  { type: 'system', content: '欢迎使用AI聊天助手！请输入您的问题。' }
])
const isLoading = ref(false)
const streamingMessage = ref<string>('')
const useStreaming = ref<boolean>(true) // 默认使用流式输出

const settingsStore = useSettingsStore()

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

const isProviderConfigured = () => {
  const provider = settingsStore.currentProvider
  return !!settingsStore.providers[provider]?.apiKey
}

const sendMessage = async (content: string) => {
  // 检查当前提供商的API密钥是否已设置
  if (!isProviderConfigured()) {
    messages.value.push({ 
      type: 'system', 
      content: '请先在设置中配置API密钥' 
    })
    console.log('发送系统消息', messages.value)
    return
  }

  // 添加用户消息
  messages.value.push({ type: 'user', content })
  console.log('发送用户消息', messages.value)
  
  // 设置加载状态为true
  isLoading.value = true
  streamingMessage.value = ''
  
  try {
    const currentProvider = settingsStore.currentProvider
    const config = settingsStore.providers[currentProvider]
    
    // 确保使用的是正确的模型
    let modelName = config.model
    
    // 使用DeepSeek官方文档要求的模型名称
    if (currentProvider === 'deepseek') {
      if (!modelName) {
        // 如果没有设置模型，默认使用deepseek-chat (V3)
        modelName = 'deepseek-chat'
        console.log(`未设置模型，默认使用${modelName}`)
      }
    }
    
    // 准备会话历史 - 去除系统消息，仅保留用户和AI消息
    const conversationHistory = messages.value
      .filter(msg => msg.type === 'user' || msg.type === 'ai')
      // 排除最后一条用户消息，因为它会单独发送
      .slice(0, messages.value.length - 1)
    
    // 添加详细的调试日志
    console.log('所有消息:', messages.value.map((msg, index) => `[${index}] ${msg.type}: ${msg.content.substring(0, 30)}...`));
    console.log('发送的对话历史:', conversationHistory.map((msg, index) => 
      `[${index}] ${msg.type}: ${msg.content.substring(0, 30)}...`
    ));
    
    console.log('使用配置:', {
      provider: currentProvider,
      model: modelName,
      useStreaming: useStreaming.value,
      conversationHistoryLength: conversationHistory.length
    })
    
    if (useStreaming.value) {
      // 使用流式API
      let fullResponse = ''
      
      // 先不添加AI消息，等流式输出完成后再添加
      const userMessageIndex = messages.value.length - 1
      
      // 发送流式请求
      sendStreamingChatRequest(
        {
          message: content,
          provider: currentProvider,
          model: modelName, // 使用更新后的模型名称
          stream: true,
          config: {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl || undefined
          },
          conversationHistory: conversationHistory
        },
        // 处理每个流块
        (chunk: string) => {
          console.log(`收到流块 [${chunk.length}字符]: "${chunk.substring(0, 50)}${chunk.length > 50 ? '...' : ''}"`);
          fullResponse += chunk;
          streamingMessage.value = fullResponse;
          console.log(`当前完整响应(${fullResponse.length}字符)`);
        },
        // 完成回调
        () => {
          console.log('流式响应完成, 最终长度:', fullResponse.length);
          // 流式输出完成后，添加AI消息
          messages.value.push({ type: 'ai', content: fullResponse });
          streamingMessage.value = '';
          isLoading.value = false;
        },
        // 错误回调
        (error: unknown) => {
          console.error('流式请求失败:', error);
          messages.value.push({ 
            type: 'system', 
            content: `流式输出失败: ${error instanceof Error ? error.message : String(error)}` 
          });
          streamingMessage.value = '';
          isLoading.value = false;
        }
      )
    } else {
      // 使用传统API
      const response = await sendChatRequest({
        message: content,
        provider: currentProvider,
        model: config.model,
        config: {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl || undefined
        },
        conversationHistory: conversationHistory
      })
      
      // 添加AI响应
      if (response.reply) {
        messages.value.push({ type: 'ai', content: response.reply })
      }
      
      // 设置加载状态为false
      isLoading.value = false
    }
  } catch (error) {
    console.error('聊天请求失败:', error)
    messages.value.push({ 
      type: 'system', 
      content: `发送消息失败: ${error instanceof Error ? error.message : String(error)}` 
    })
    // 无论成功还是失败，都设置加载状态为false
    isLoading.value = false
  }
}

// 切换流式输出
const toggleStreaming = () => {
  useStreaming.value = !useStreaming.value
}

onMounted(() => {
  settingsStore.loadSettings()
  console.log('ChatView mounted')
})

// 激活时触发（keep-alive组件被显示时）
onActivated(() => {
  console.log('ChatView activated')
})

// 停用时触发（keep-alive组件被隐藏时）
onDeactivated(() => {
  console.log('ChatView deactivated')
})
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
}

.compact-header {
  margin-bottom: 10px;
  padding-bottom: 10px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.compact-header h1 {
  font-size: 18px;
  display: flex;
  align-items: center;
  margin-top: 0;
  margin-bottom: 0;
}

.compact-header h1 small {
  font-size: 12px;
  font-weight: normal;
  color: #777;
  margin-left: 8px;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
}

.stream-toggle-compact {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 12px;
}

.toggle-label-compact {
  margin-left: 6px;
  font-size: 12px;
  color: #666;
}

.stream-toggle-compact input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.slider-compact {
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  background-color: #ccc;
  transition: .4s;
  border-radius: 14px;
}

.slider-compact:before {
  position: absolute;
  content: "";
  height: 10px;
  width: 10px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.stream-toggle-compact input:checked + .slider-compact {
  background-color: #1a73e8;
}

.stream-toggle-compact input:focus + .slider-compact {
  box-shadow: 0 0 1px #1a73e8;
}

.stream-toggle-compact input:checked + .slider-compact:before {
  transform: translateX(14px);
}
</style>