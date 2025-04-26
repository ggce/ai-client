<template>
  <div class="panel">
    <div class="chat-content">
      <header class="compact-header">
        <div class="header-content">
          <h1>Luna <small>{{ modelDisplay }}</small></h1>
          <div class="header-controls">
            <!-- 这里可以放置其他控制按钮 -->
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
            :streamingToolCalls="streamingToolCalls"
          />
          <ChatToolbar :messages="sessionMessages" />
          <div class="input-wrapper">
            <ChatInput 
              ref="chatInputRef" 
              @send="sendMessage" 
              @stop="stopGeneration" 
              :disabled="isLoading || !activeSessionId" 
              :isStreamActive="isLoading"
            />
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
import type { PropType } from 'vue'

import MessageList from '../components/MessageList.vue'
import ChatInput from '../components/ChatInput.vue'
import SessionSidebar from '../components/SessionSidebar.vue'
import ChatToolbar from '../components/ChatToolbar.vue'
import { useSettingsStore } from '../store/settings'
import { useRoute } from 'vue-router'
import {
  createSession,
  listSessionIds,
  getSessionMessages,
  sendStreamingSessionMessage,
} from '../api/chat'
import { SessionMessage, ChatMessage, ToolCall } from '../types';
import axios from 'axios'
import { tips } from '../utils/tips'

// 定义组件名称
defineOptions({
  name: 'ChatView'
})

// 本地管理会话ID
const activeSessionId = ref<string>('')

// 聊天输入框
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null);

// 将activeSessionId提供给可能需要的子组件
provide('activeSessionId', activeSessionId)

// 会话状态
const sessionMessages = ref<SessionMessage[]>([])

// 聊天状态
const isLoading = ref(false)
const streamingMessage = ref<string>('')
const streamingToolCalls = ref<ToolCall[]>([])
const streamingReasoningContent = ref<string>('') // 添加流式推理内容
// 存储当前活动的流控制器
const activeStreamController = ref<AbortController | null>(null)

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
    // 使用当前选择的提供商创建会话
    const currentProvider = settingsStore.currentProvider
    console.log(`使用提供商 ${currentProvider} 创建新会话`)
    const sessionId = await createSession(currentProvider)
    activeSessionId.value = sessionId
  } catch (error) {
    console.error('创建会话失败:', error)
    tips.error('创建会话失败，请检查网络连接或刷新页面重试')
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
    return [{ role: 'system', content: '请在右侧边栏选择或创建一个会话开始聊天' }]
  }
  
  return sessionMessages.value.map(msg => {
    // 确保reasoningContent是字符串或undefined
    const reasoningContent = typeof msg.reasoningContent === 'string' 
      ? msg.reasoningContent 
      : undefined
    
    return {
      ...msg,
      reasoningContent,
    } as ChatMessage
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
    tips.error('加载会话历史失败，请刷新页面重试')
  }
}

// 添加停止生成函数
const stopGeneration = async () => {
  if (activeStreamController.value) {
    // 取消当前活动的流请求
    activeStreamController.value.abort()
    activeStreamController.value = null
    
    // 更新加载状态
    isLoading.value = false
    
    // 通知服务器终止工具调用
    if (activeSessionId.value) {
      // 获取当前提供商
      const currentProvider = settingsStore.currentProvider
      
      // 尝试3次确保服务器收到停止请求
      let retryCount = 0;
      let success = false;
      
      console.log('开始发送停止生成请求...');
      
      while (retryCount < 3 && !success) {
        try {
          // 发送请求通知服务器停止工具调用，并传递提供商参数
          const response = await axios.post(
            `/api/sessions/${activeSessionId.value}/stop-generation?provider=${currentProvider}`,
            {},
            { timeout: 5000 } // 5秒超时
          );
          
          if (response.data.success) {
            console.log('停止生成请求成功');
            success = true;
          } else {
            console.warn('停止生成请求返回失败状态');
            retryCount++;
          }
        } catch (error) {
          console.error(`停止生成请求失败(尝试${retryCount + 1}/3):`, error);
          retryCount++;
          // 短暂延迟后重试
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // 如果所有重试都失败，显示提示
      if (!success) {
        tips.warning('停止生成请求失败，但已在本地中断响应');
      }
      
      // 重新加载当前会话的消息，以确保UI状态与后端一致
      await loadSessionMessages(activeSessionId.value);
    }
    
    // 清空流内容
    streamingMessage.value = ''
    streamingReasoningContent.value = ''
  }
}

// 更新sendMessage函数
const sendMessage = async function(message?: string, selectedTools?: string[]) {
  if (!isProviderConfigured()) {
    tips.warning('请先在设置页面配置API Key');
    sessionMessages.value.push({
      role: 'system',
      content: '请先在设置页面配置API Key。',
    });
    return;
  }

  if (!activeSessionId.value) {
    tips.info('请先选择或创建一个会话');
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
      selectedTools,
      {
        model: settingsStore.providers[settingsStore.currentProvider]?.model,
      }
    );
    
    // 保存流控制器，以便可以停止生成
    activeStreamController.value = stream.controller

    // 正在接收流式信息
    stream.onMessage(({
      content,  // 文本内容
      reasoningContent, // 推理内容
      toolCall,  // 工具
      isMessageUpdate // 消息是否更新
    }) => {
      // 文本内容
      streamingMessage.value += content;
      // 推理内容
      if (reasoningContent) {
        streamingReasoningContent.value += reasoningContent;
      }
      // 使用了工具
      if (toolCall) {
        console.log("需要调用工具");
        console.log(toolCall);
        // 添加进流工具数组
        streamingToolCalls.value.push(toolCall);
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
      stream.onComplete(() => {
        activeStreamController.value = null
        resolve()
      });
      stream.onError(() => {
        tips.error('消息发送失败，请稍后再试或检查API配置');
        activeStreamController.value = null
        resolve()
      });
    });
  } catch (error) {
    console.error('Failed to send message:', error)
    tips.error('消息发送失败，请稍后再试或检查API配置');
    // 更新最后一条AI消息为错误信息
    const lastMessage = sessionMessages.value[sessionMessages.value.length - 1]
    lastMessage.content = '消息发送失败，请稍后再试或检查API配置。'
  } finally {
    // 重新查询最新的对话
    await loadSessionMessages(activeSessionId.value);

    // 如果调用了工具，则再请求一次
    if (isUseToolCall) {
      sendMessage(undefined, chatInputRef.value?.getSelectedTools());
    } else {
      // 结束加载
      isLoading.value = false
      streamingMessage.value = ''
      streamingReasoningContent.value = ''
      streamingToolCalls.value = []
      activeStreamController.value = null
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

// 检查URL参数中的会话ID
const route = useRoute()

// 确保当前会话与选定的提供商匹配
const ensureSessionMatchesProvider = async () => {
  const currentProvider = settingsStore.currentProvider
  console.log(`确认会话与当前提供商匹配: ${currentProvider}`)
  
  try {
    // 如果已有活动会话，检查它是否属于当前提供商
    // 此处无法直接检查会话属于哪个提供商，所以我们先尝试获取当前提供商的所有会话
    const providerSessions = await listSessionIds(currentProvider)
    
    // 如果当前活动会话不在该提供商的会话列表中，则需要切换
    if (activeSessionId.value && !providerSessions.includes(activeSessionId.value)) {
      console.log(`当前会话 ${activeSessionId.value} 不属于提供商 ${currentProvider}，需要切换`)
      
      // 如果当前提供商有会话，切换到第一个
      if (providerSessions.length > 0) {
        console.log(`切换到${currentProvider}的现有会话: ${providerSessions[0]}`)
        activeSessionId.value = providerSessions[0]
        await loadSessionMessages(activeSessionId.value)
      } else {
        // 如果没有会话，创建一个新的
        console.log(`为${currentProvider}创建新会话`)
        const newSessionId = await createSession(currentProvider)
        activeSessionId.value = newSessionId
        await loadSessionMessages(newSessionId)
      }
    } else if (!activeSessionId.value) {
      // 如果没有活动会话，尝试使用当前提供商的会话或创建新会话
      if (providerSessions.length > 0) {
        console.log(`使用${currentProvider}的现有会话: ${providerSessions[0]}`)
        activeSessionId.value = providerSessions[0]
        await loadSessionMessages(activeSessionId.value)
      } else {
        // 如果没有会话，创建一个新的
        console.log(`为${currentProvider}创建新会话`)
        const newSessionId = await createSession(currentProvider)
        activeSessionId.value = newSessionId
        await loadSessionMessages(newSessionId)
      }
    }
  } catch (error) {
    console.error(`确保会话匹配时出错:`, error)
    tips.error('会话加载出错，请刷新页面重试');
  }
}

// 初始化时检查URL参数中的会话ID
onMounted(async () => {
  // 加载设置
  await settingsStore.loadSettings()
  
  // 检查URL中是否有会话ID
  const sessionIdFromUrl = route.query.sessionId as string
  if (sessionIdFromUrl) {
    console.log('从URL加载会话ID:', sessionIdFromUrl)
    activeSessionId.value = sessionIdFromUrl
    await loadSessionMessages(sessionIdFromUrl)
  }
  
  // 确保会话与当前提供商匹配
  await ensureSessionMatchesProvider()
})

// 监听路由变化
watch(() => route.query.sessionId, async (newSessionId) => {
  if (newSessionId && newSessionId !== activeSessionId.value) {
    console.log('路由会话ID变更:', newSessionId)
    activeSessionId.value = newSessionId as string
    await loadSessionMessages(newSessionId as string)
  }
}, { immediate: true })

// 监听提供商变化
watch(() => settingsStore.currentProvider, async (newProvider) => {
  console.log(`提供商变更为 ${newProvider}，确保会话匹配`)
  await ensureSessionMatchesProvider()
}, { immediate: false })
</script>

<style scoped>
.panel {
  display: flex;
  height: 100vh;
  max-height: 100vh;
  width: 100%;
  overflow: hidden; /* 防止整体出现滚动条 */
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
  flex-shrink: 0; /* 防止header被压缩 */
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
  font-size: 13px;
  color: #333;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden; /* 确保容器不会溢出 */
  font-size: 13px;
}

.message-container {
  flex: 1;
  overflow-y: auto; /* 仅消息区域出现滚动条 */
  padding: 10px;
}

.input-wrapper {
  padding: 10px;
  border-top: 1px solid #e0e0e0;
  background-color: #fff;
  flex-shrink: 0; /* 防止输入框被压缩 */
  position: relative; /* 确保始终在底部 */
  z-index: 2; /* 确保始终在顶层 */
}

h1 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

h1 small {
  font-size: 13px;
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

.model-title {
  font-size: 18px;
}

.model-subtitle {
  font-size: 13px;
}
</style>