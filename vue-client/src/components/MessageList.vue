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
          message.type === 'assistant' &&
          index === messages.length - 1
        )
      "
    >
      <!-- User messages -->
      <UserMessage
        v-if="message.type === 'user'"
        :content="message.content"
      />

      <!-- System messages -->
      <SystemMessage
        v-if="message.type === 'system'"
        :content="message.content"
      />

      <!-- Tool messages -->
      <ToolMessage
        v-if="message.type === 'tool'"
        :content="message.content" 
      />

      <!-- Assistant messages - regular or tool prompt -->
      <template v-if="message.type === 'assistant'">
        <ToolPromptMessage 
          v-if="isToolPromptMessage(message.content)"
          :content="message.content"
          @tool-click="handleToolClick"
        />
        <AssistantMessage
          v-else
          :content="message.content"
          :reasoning-content="message.reasoningContent"
          :index="index"
        />
      </template>
    </div>

    <!-- Loading state (no streaming) -->
    <LoadingMessage v-if="isLoading && !streamingReasoningContent && !streamingMessage" />

    <!-- Streaming reasoning state -->
    <StreamingReasoningMessage 
      v-if="isLoading && streamingReasoningContent && !streamingMessage"
      :content="streamingReasoningContent"
    />

    <!-- Streaming message state -->
    <StreamingMessage 
      v-if="isLoading && streamingMessage"
      :message="streamingMessage"
      :reasoning-content="streamingReasoningContent"
      @tool-click="handleToolClick"
    />

    <!-- Tool info popup -->
    <ToolInfoPopup
      v-model:visible="showToolInfo"
      ref="toolInfoPopup"
    />
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref, watch, onMounted, nextTick, onUnmounted } from "vue";
import MarkdownIt from "markdown-it";

// Import message components
import UserMessage from "./messages/UserMessage.vue";
import SystemMessage from "./messages/SystemMessage.vue";
import AssistantMessage from "./messages/AssistantMessage.vue";
import ToolMessage from "./messages/ToolMessage.vue";
import ToolPromptMessage from "./messages/ToolPromptMessage.vue";
import LoadingMessage from "./messages/LoadingMessage.vue";
import StreamingMessage from "./messages/StreamingMessage.vue";
import StreamingReasoningMessage from "./messages/StreamingReasoningMessage.vue";
import ToolInfoPopup from './messages/ToolInfoPopup.vue';

// Define the window interface for Electron APIs
declare global {
  interface Window {
    electronAPI?: {
      openExternalLink: (url: string) => void;
      getAppVersion: () => Promise<string>;
      openFile: () => Promise<string | null>;
      saveFile: (content: string) => Promise<boolean>;
    };
    electron?: {
      openExternal: (url: string) => void;
    };
  }
}

interface ChatMessage {
  type: 'user' | 'assistant' | 'system' | 'tool'
  content: string;
  reasoningContent?: string; // 添加推理内容字段
}

const props = defineProps<{
  messages: ChatMessage[];
  isLoading?: boolean;
  streamingMessage?: string;
  streamingReasoningContent?: string; // 添加流式推理内容
}>();

const messagesContainer = ref<HTMLElement | null>(null);
const toolInfoPopup = ref<any>(null);
const showToolInfo = ref(false);

// 检查消息是否为工具调用提示
const isToolPromptMessage = (content: string): boolean => {
  return content.startsWith('#useTool<toolName>');
};

// 自动滚动到底部
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
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

// 监听消息变化，自动滚动
watch(
  () => props.messages.length,
  () => {
    scrollToBottom();
  }
);

// 监听加载状态变化，自动滚动
watch(
  () => props.isLoading,
  () => {
    scrollToBottom();
  }
);

// 监听推理消息变化，自动滚动
watch(
  () => props.streamingReasoningContent,
  () => {
    scrollToBottom();
    scrollReasoningToBottom();
  },
  { immediate: true }
);

// 监听流式消息变化，自动滚动
watch(
  () => props.streamingMessage,
  () => {
    scrollToBottom();
  },
  { immediate: true }
);

// 初始化时滚动到底部
onMounted(() => {
  scrollToBottom();
  
  // Add event listener for all link clicks in the messages container
  document.addEventListener('click', handleLinkClick);
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

// Clean up event listeners when component is unmounted
onUnmounted(() => {
  document.removeEventListener('click', handleLinkClick);
});

// Handle tool clicks by delegating to the ToolInfoPopup component
const handleToolClick = (toolName: string) => {
  if (toolInfoPopup.value) {
    toolInfoPopup.value.showTool(toolName);
  }
};
</script>

<style>
@import '../assets/styles/message.css';
</style>