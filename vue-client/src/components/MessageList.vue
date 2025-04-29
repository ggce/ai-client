<template>
  <div class="chat-messages" ref="messagesContainer">
    <!-- Regular messages -->
    <div
      v-for="(message, index) in messages"
      :key="index"
      v-show="
        !(
          isLoading &&
          streamingMessage &&
          message.role === 'assistant' &&
          index === messages.length - 1
        )
      "
    >
      <!-- User messages -->
      <UserMessage
        v-if="message.role === 'user'"
        :content="message.content"
      />

      <!-- System messages -->
      <SystemMessage
        v-if="message.role === 'system' && message.isShow !== false"
        :content="message.content"
      />

      <!-- Tool messages -->
      <!-- <ToolMessage
        v-if="message.role === 'tool'"
        :content="message.content" 
      /> -->

      <!-- Assistant messages - regular or tool prompt -->
      <template v-if="message.role === 'assistant'">
        <ToolPromptMessage 
          v-if="message.toolCalls && message.toolCalls.length > 0"
          :content="message.content"
          :next-messages="messages.slice(index + 1)"
          :toolCalls="message.toolCalls"
          @tool-click="handleToolClick"
          @tool-result-click="handleToolResultClick"
        />
        <AssistantMessage
          v-else
          :content="message.content"
          :reasoning-content="message.reasoningContent"
          :index="index"
          :total-length="messages.length"
        />
      </template>
    </div>

    <!-- Loading state (no streaming) -->
    <LoadingMessage v-if="isLoading && !streamingReasoningContent && !streamingMessage" />

    <!-- Streaming reasoning state -->
    <StreamingMessage 
      v-if="isLoading && streamingReasoningContent && !streamingMessage"
      :message="''"
      :reasoning-content="streamingReasoningContent"
      :is-reasoning-only-mode="true"
    />

    <!-- Streaming message state -->
    <StreamingMessage 
      v-if="isLoading && streamingMessage"
      :message="streamingMessage"
      :reasoning-content="streamingReasoningContent"
    />

    <!-- Tool info popup -->
    <ToolInfoPopup
      v-model:visible="showToolInfo"
      ref="toolInfoPopup"
    />

    <!-- Tool call result dialog -->
    <ToolCallResultDialog
      v-model:visible="showToolResult"
      :tool-result="currentToolResult"
    />
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref, watch, onMounted, nextTick, onUnmounted } from "vue";

// Import message components
import UserMessage from "./messages/UserMessage.vue";
import SystemMessage from "./messages/SystemMessage.vue";
import AssistantMessage from "./messages/AssistantMessage.vue";
import ToolMessage from "./messages/ToolMessage.vue";
import ToolPromptMessage from "./messages/ToolPromptMessage.vue";
import LoadingMessage from "./messages/LoadingMessage.vue";
import StreamingMessage from "./messages/StreamingMessage.vue";
import ToolInfoPopup from './messages/ToolInfoPopup.vue';
import ToolCallResultDialog from './messages/ToolCallResultDialog.vue';

import { ChatMessage, ToolCall } from '../types';

// Define the window interface for Electron APIs
declare global {
  interface Window {
    electronAPI?: {
      openExternalLink: (url: string) => void;
      getAppVersion: () => Promise<string>;
      openFile: () => Promise<string | null>;
      saveFile: (content: string) => Promise<boolean>;
      sendNotification?: (options: any) => Promise<void>;
    };
    electron?: {
      openExternal: (url: string) => void;
    };
  }
}

const props = defineProps<{
  messages: ChatMessage[];
  isLoading?: boolean;
  streamingMessage?: string;
  streamingReasoningContent?: string; // 添加流式推理内容
  streamingToolCalls?: ToolCall[],  // 工具数组
}>();

const messagesContainer = ref<HTMLElement | null>(null);
const toolInfoPopup = ref<any>(null);
const showToolInfo = ref(false);
const showToolResult = ref(false);
const currentToolResult = ref('');

// 滚动控制变量
const userHasScrolled = ref(false);
const isNearBottom = ref(true);
const scrollThreshold = 100; // 距离底部多少像素内视为"接近底部"

// 检查是否在底部附近
const checkIfNearBottom = (): boolean => {
  if (!messagesContainer.value) return true;
  
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  
  return distanceFromBottom <= scrollThreshold;
};

// 自动滚动到底部 - 增加智能判断
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    // 只有当用户没有手动滚动，或者用户已经滚动到接近底部时才自动滚动
    if (!userHasScrolled.value || isNearBottom.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      // 重置用户滚动标志
      if (isNearBottom.value) {
        userHasScrolled.value = false;
      }
    }
  }
};

// 滚动推理内容到底部
const scrollReasoningToBottom = async () => {
  await nextTick();
  // 查找所有包含reasoning-content类的元素
  const reasoningElements = document.querySelectorAll('.reasoning-content');
  // 对每个元素进行滚动处理
  reasoningElements.forEach(element => {
    element.scrollTop = element.scrollHeight;
  });
};

// 处理滚动事件
const handleScroll = () => {
  if (!messagesContainer.value) return;
  
  // 用户手动滚动时设置标志
  userHasScrolled.value = true;
  
  // 检查是否接近底部
  isNearBottom.value = checkIfNearBottom();
  
  // 如果滚动到底部，重置用户滚动标志
  if (isNearBottom.value) {
    userHasScrolled.value = false;
  }
};

// 监听消息变化，自动滚动 - 现在考虑用户行为
watch(
  () => props.messages.length,
  () => {
    scrollToBottom();
  }
);

// 监听加载状态变化，自动滚动
watch(
  () => props.isLoading,
  (newVal, oldVal) => {
    // 当加载开始或结束时，应该滚动到底部
    if (newVal !== oldVal) {
      // 当AI开始回复或结束回复时，重置用户滚动状态
      userHasScrolled.value = false;
      scrollToBottom();
    }
  }
);

// 监听推理消息变化，智能自动滚动
watch(
  () => props.streamingReasoningContent,
  () => {
    scrollToBottom();
    scrollReasoningToBottom();
  },
  { immediate: true }
);

// 监听流式消息变化，智能自动滚动
watch(
  () => props.streamingMessage,
  () => {
    scrollToBottom();
  },
  { immediate: true }
);

// 初始化时设置滚动监听
onMounted(() => {
  // 初始滚动到底部
  scrollToBottom();
  
  // 添加滚动事件监听器
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', handleScroll);
  }
  
  // 添加链接点击事件监听器
  document.addEventListener('click', handleLinkClick);
});

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleScroll);
  }
  document.removeEventListener('click', handleLinkClick);
});

// Handle link clicks to open in default browser
const handleLinkClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const link = target.closest('a');
  
  // Only handle links with href
  if (link && link.href) {
    // 检查是否为外部链接
    const isExternalLink = (
      (link.href.startsWith('http://') || link.href.startsWith('https://')) &&
      !link.href.startsWith(window.location.origin) && // 不是当前域名的链接
      !link.hasAttribute('target') // 没有指定target属性的链接
    );
    
    // 只处理外部链接
    if (isExternalLink) {
      event.preventDefault();
      
      try {
        // Use the electron API if available - try both ways
        if (window.electronAPI && typeof window.electronAPI.openExternalLink === 'function') {
          window.electronAPI.openExternalLink(link.href);
        } else if (window.electron && typeof window.electron.openExternal === 'function') {
          window.electron.openExternal(link.href);
        } else {
          // Fallback for non-electron environments or if APIs aren't available
          window.open(link.href, '_blank', 'noopener,noreferrer');
        }
      } catch (error) {
        console.error('Error opening link:', error);
        // Final fallback if any error occurs
        window.open(link.href, '_blank', 'noopener,noreferrer');
      }
    }
  }
};

// Handle tool clicks by delegating to the ToolInfoPopup component
const handleToolClick = (toolName: string) => {
  if (toolInfoPopup.value) {
    toolInfoPopup.value.showTool(toolName);
  }
};

const handleToolResultClick = (result: string) => {
  currentToolResult.value = result;
  showToolResult.value = true;
};
</script>

<style>
@import '../assets/styles/message.css';
</style>