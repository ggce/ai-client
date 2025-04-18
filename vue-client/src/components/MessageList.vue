<template>
  <div class="chat-messages" ref="messagesContainer">
    <div 
      v-for="(message, index) in messages" 
      :key="index" 
      class="message"
      :class="message.type"
    >
      <div class="message-row">
        <div v-if="message.type === 'ai'" class="avatar ai-avatar">
          <img src="/assets/logo.png" alt="AI" class="ai-logo" />
        </div>
        <div v-if="message.type === 'system'" class="avatar system-avatar">
          <div class="system-logo">系统</div>
        </div>
        <div v-if="message.type === 'user'" class="avatar user-avatar">
          <div class="user-logo">用户</div>
        </div>
        <div class="message-container">
          <div class="message-content" v-html="formatMessage(message.content)"></div>
          
          <!-- 只在AI消息下添加复制按钮 -->
          <div v-if="message.type === 'ai'" class="message-actions">
            <button 
              class="copy-button" 
              @click="copyToClipboard(message.content, index)" 
              @mouseenter="hoveredButton = index"
              @mouseleave="hoveredButton = null"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span v-if="hoveredButton === index" class="hover-tooltip">复制</span>
              <span v-if="copiedIndex === index" class="copy-tooltip">已复制</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 显示流式输出的消息，当有streamingMessage内容时显示 -->
    <div v-if="streamingMessage && isLoading" class="message ai streaming">
      <div class="message-row">
        <div class="avatar ai-avatar">
          <img src="/assets/logo.png" alt="AI" class="ai-logo" />
        </div>
        <div class="message-container">
          <div class="message-content" v-html="formatMessage(streamingMessage)"></div>
          <div class="streaming-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 新的加载状态显示 -->
    <div v-if="isLoading && !streamingMessage" class="message ai">
      <div class="message-row">
        <div class="avatar ai-avatar">
          <img src="/assets/logo.png" alt="AI" class="ai-logo" />
        </div>
        <div class="message-container typing-container">
          <div class="typing-indicator">
            <span class="typing-text">AI正在思考</span>
            <span class="typing-dots">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref, watch, onMounted, nextTick } from 'vue'

interface ChatMessage {
  type: 'user' | 'ai' | 'system'
  content: string
}

const props = defineProps<{
  messages: ChatMessage[]
  isLoading?: boolean
  streamingMessage?: string
}>()

const messagesContainer = ref<HTMLElement | null>(null)
// 记录当前复制的消息索引，用于显示复制成功提示
const copiedIndex = ref<number | null>(null)
// 记录当前鼠标悬浮的按钮索引
const hoveredButton = ref<number | null>(null)

// 复制内容到剪贴板
const copyToClipboard = (text: string, index?: number) => {
  if (text) {
    // 清除HTML标签，获取纯文本内容
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = formatMessage(text)
    const plainText = tempDiv.textContent || tempDiv.innerText || ''
    
    navigator.clipboard.writeText(plainText)
      .then(() => {
        // 复制成功，显示提示
        if (index !== undefined) {
          copiedIndex.value = index
        }
        // 2秒后自动隐藏提示
        setTimeout(() => {
          copiedIndex.value = null
        }, 2000)
      })
      .catch(err => {
        console.error('复制失败:', err)
      })
  }
}

// 格式化消息，处理markdown等
const formatMessage = (content: string): string => {
  if (!content) return ''
  
  // 处理代码块
  let formattedContent = content.replace(/```([a-z]*)\n([\s\S]*?)\n```/g, '<pre><code class="$1">$2</code></pre>')
  
  // 处理行内代码
  formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // 处理换行
  formattedContent = formattedContent.replace(/\n/g, '<br>')
  
  return formattedContent
}

// 自动滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 监听消息变化，自动滚动
watch(() => props.messages.length, () => {
  scrollToBottom()
})

// 监听加载状态变化，自动滚动
watch(() => props.isLoading, () => {
  scrollToBottom()
})

// 监听流式消息变化，自动滚动
watch(() => props.streamingMessage, () => {
  scrollToBottom()
}, { immediate: true })

// 初始化时滚动到底部
onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 10px;
}

.message {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
}

.message-row {
  display: flex;
  align-items: flex-start;
}

.message.user .message-row {
  flex-direction: row-reverse;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin: 0 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.ai-avatar {
  background-color: white;
}

.ai-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.system-avatar {
  background-color: #fbbc05;
  color: white;
  font-weight: bold;
  font-size: 12px;
}

.system-logo {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar {
  background-color: #1a73e8;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.user-logo {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message.user {
  align-items: flex-end;
}

.message.ai, .message.system {
  align-items: flex-start;
}

.message-container {
  max-width: 80%;
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.message.system .message-container {
  background-color: #fff8e1;
  max-width: 90%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message.ai .message-container {
  background-color: #E6E6FA; /* 偏紫色 Lavender */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message.streaming .message-container {
  border-left: 3px solid #8a2be2; /* 深紫色边框表示正在流式输出 */
}

.streaming-indicator {
  display: flex;
  margin-top: 4px;
  height: 8px;
}

.message.user .message-container {
  background-color: #e3f2fd;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message-content {
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

/* 按钮相关样式 */
.message-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.copy-button {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  position: relative;
  font-size: 12px;
  transition: background-color 0.2s;
}

.copy-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #333;
}

.hover-tooltip {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  bottom: 100%;
  right: 0;
  white-space: nowrap;
  margin-bottom: 4px;
  animation: fadeIn 0.1s ease-in;
}

.copy-tooltip {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  bottom: 100%;
  right: 0;
  white-space: nowrap;
  margin-bottom: 4px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.message-content :deep(pre) {
  background-color: #282c34;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 10px 0;
  color: #abb2bf;
}

.message-content :deep(code) {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 90%;
}

.message-content :deep(code:not(pre code)) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 4px;
  border-radius: 3px;
}

/* 新的打字中效果样式 */
.typing-container {
  min-width: 120px;
  padding: 8px 16px;
}

.typing-indicator {
  display: flex;
  align-items: center;
}

.typing-text {
  font-size: 14px;
  margin-right: 8px;
  color: #666;
}

.typing-dots {
  display: flex;
  align-items: center;
}

.dot {
  width: 6px;
  height: 6px;
  margin: 0 2px;
  background-color: #999;
  border-radius: 50%;
  animation: pulse 1.5s infinite ease-in-out;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(0.7);
    opacity: 0.5;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 打字光标动画 */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background-color: #666;
  margin-left: 2px;
  animation: blink 1s infinite;
  vertical-align: middle;
}
</style>