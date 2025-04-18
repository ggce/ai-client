<template>
  <div class="panel">
    <header class="compact-header">
      <h1>AI聊天 <small>支持多种AI模型</small></h1>
      <div class="stream-toggle">
        <label class="switch">
          <input type="checkbox" v-model="useStreaming">
          <span class="slider"></span>
        </label>
        <span class="toggle-label">流式输出</span>
      </div>
    </header>

    <main>
      <div class="chat-container">
        <MessageList :messages="messages" :isLoading="isLoading" :streamingMessage="streamingMessage" />
        <ChatInput @send="sendMessage" :disabled="isLoading" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated, onDeactivated } from 'vue'
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
    
    console.log('使用配置:', {
      provider: currentProvider,
      model: modelName,
      useStreaming: useStreaming.value
    })
    
    if (useStreaming.value) {
      // 使用流式API
      let fullResponse = ''
      
      // 添加一个空的AI消息，用于流式更新
      messages.value.push({ type: 'ai', content: '' })
      const messageIndex = messages.value.length - 1
      
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
          }
        },
        // 处理每个流块
        (chunk: string) => {
          console.log(`收到流块: "${chunk}"`);
          fullResponse += chunk;
          streamingMessage.value = fullResponse;
          
          // 实时更新消息内容
          messages.value[messageIndex].content = fullResponse;
          console.log(`当前完整响应(${fullResponse.length}字符): "${fullResponse.slice(-50)}"`);
        },
        // 完成回调
        () => {
          console.log('流式响应完成, 最终长度:', fullResponse.length);
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
        }
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

.compact-header h1 {
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0;
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

/* 切换开关样式 */
.stream-toggle {
  display: flex;
  align-items: center;
  margin-top: 10px;
}

.toggle-label {
  margin-left: 8px;
  font-size: 14px;
  color: #666;
}

.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #1a73e8;
}

input:focus + .slider {
  box-shadow: 0 0 1px #1a73e8;
}

input:checked + .slider:before {
  transform: translateX(20px);
}
</style>