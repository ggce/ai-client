<template>
  <div class="chat-messages" ref="messagesContainer">
    <div
      v-for="(message, index) in messages"
      :key="index"
      class="message"
      :class="message.type"
      v-show="
        !(
          isLoading &&
          streamingMessage &&
          message.type === 'assistant' &&
          index === messages.length - 1
        )
      "
    >
      <div class="message-row">
        <div v-if="message.type === 'assistant'" class="avatar ai-avatar">
          <img src="/assets/logo.png" alt="AI" class="ai-logo" />
        </div>
        <div v-if="message.type === 'system'" class="avatar system-avatar">
          <div class="system-logo">系统</div>
        </div>
        <div v-if="message.type === 'user'" class="avatar user-avatar">
          <div class="user-logo">用户</div>
        </div>
        <div v-if="message.type === 'tool'" class="avatar tool-avatar">
          <div class="tool-logo">工具</div>
        </div>
        <div class="message-container">
          <!-- 显示推理内容区域 (仅当消息是AI类型且有推理内容) -->
          <div
            v-if="message.type === 'assistant' && message.reasoningContent"
            class="reasoning-container"
            :class="{ 'collapsed': expandedReasoningIndex !== index }"
            @click="toggleReasoning(index)"
          >
            <div class="reasoning-header">
              推理过程
              <span class="toggle-icon">{{ expandedReasoningIndex === index ? '▼' : '▶' }}</span>
            </div>
            <pre v-show="expandedReasoningIndex === index" class="reasoning-content">{{ message.reasoningContent }}</pre>
          </div>

          <!-- 工具消息标题显示 -->
          <div v-if="message.type === 'tool'" class="tool-header">
            <span class="tool-name">{{ getToolName(message.content) }}</span>
            <button
              class="copy-button"
              @click.stop="copyToClipboard(message.content, index)"
              @mouseenter="hoveredButton = index"
              @mouseleave="hoveredButton = null"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                ></path>
              </svg>
              <span v-if="hoveredButton === index" class="hover-tooltip">复制</span>
              <span v-if="copiedIndex === index" class="copy-tooltip">已复制</span>
            </button>
          </div>

          <!-- 工具内容区域，添加可折叠功能 -->
          <div
            v-if="message.type === 'tool'"
            class="tool-content-container"
            :class="{ 'collapsed': expandedToolIndex !== index }"
            @click="toggleTool(index)"
          >
            <div class="message-content" v-html="formatToolPreview(message.content)"></div>
            <div class="toggle-indicator">
              <span class="toggle-text">{{ expandedToolIndex === index ? '收起' : '展开详情' }}</span>
              <span class="toggle-icon">{{ expandedToolIndex === index ? '▲' : '▼' }}</span>
            </div>
          </div>

          <!-- 非工具内容正常显示 -->
          <div
            v-if="message.type !== 'tool'"
            class="message-content"
            v-html="formatMessage(message.content)"
          ></div>

          <!-- 展开后的工具内容 -->
          <div
            v-if="message.type === 'tool' && expandedToolIndex === index"
            class="tool-expanded-content"
            v-html="formatToolMessage(message.content)"
            @click.stop
          ></div>

          <!-- 只在AI消息下添加复制按钮 -->
          <div v-if="message.type === 'assistant'" class="message-actions">
            <button
              class="copy-button"
              @click="copyToClipboard(message.content, index)"
              @mouseenter="hoveredButton = index"
              @mouseleave="hoveredButton = null"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                ></path>
              </svg>
              <span v-if="hoveredButton === index" class="hover-tooltip"
                >复制</span
              >
              <span v-if="copiedIndex === index" class="copy-tooltip"
                >已复制</span
              >
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 显示加载状态 -->
    <div v-if="isLoading && !streamingReasoningContent && !streamingMessage" class="message assistant">
      <div class="message-row">
        <div class="avatar ai-avatar">
          <img src="/assets/logo.png" alt="AI" class="ai-logo" />
        </div>
        <div class="message-container typing-container">
          <div class="typing-indicator">
            <span class="typing-text">正在处理您的请求</span>
            <span class="typing-dots">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 推理中 -->
    <div v-if="isLoading && streamingReasoningContent && !streamingMessage" class="message assistant">
      <div class="message-row">
        <div class="avatar ai-avatar">
          <img src="/assets/logo.png" alt="AI" class="ai-logo" />
        </div>
        <div class="message-container typing-container">
          <div
            class="streaming-reasoning-container"
            v-if="
              streamingReasoningContent &&
              streamingReasoningContent.trim().length > 0
            "
          >
            <div class="reasoning-header">
              推理中
            </div>
            <pre class="reasoning-content">{{
              streamingReasoningContent
            }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- 显示流式输出的消息，当有streamingMessage内容时显示 -->
    <div v-if="isLoading && streamingMessage" class="message assistant streaming">
      <div class="message-row">
        <div class="avatar ai-avatar">
          <img src="/assets/logo.png" alt="AI" class="ai-logo" />
        </div>
        <div class="message-container">
          <!-- 先显示推理，再显示回答，保持顺序一致 -->
          <div
            class="streaming-reasoning-container"
            v-if="
              streamingReasoningContent &&
              streamingReasoningContent.trim().length > 0
            "
          >
            <div class="reasoning-header">
              推理完毕
            </div>
            <pre class="reasoning-content">{{ streamingReasoningContent }}</pre>
          </div>

          <div
            class="message-content"
            v-html="formatMessage(streamingMessage)"
          ></div>
          <div class="streaming-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref, watch, onMounted, nextTick } from "vue";
import MarkdownIt from "markdown-it";

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

// 初始化markdown解析器实例
const md = new MarkdownIt({
  breaks: true, // 将 \n 转换为 <br>
  linkify: true, // 自动识别链接
  typographer: true, // 启用一些排版替换
});

const messagesContainer = ref<HTMLElement | null>(null);
// 添加推理内容容器的ref
const reasoningContentRef = ref<HTMLElement | null>(null);
// 记录当前复制的消息索引，用于显示复制成功提示
const copiedIndex = ref<number | null>(null);
// 记录当前鼠标悬浮的按钮索引
const hoveredButton = ref<number | null>(null);

// 添加流式推理内容的展开状态
const isReasoningExpanded = ref(false);

// 添加一个消息中正在被查看的推理内容的索引
const expandedReasoningIndex = ref<number | null>(null);

// 添加工具消息展开/折叠状态
const expandedToolIndex = ref<number | null>(null);

// 修改toggleReasoning函数使其更可靠
const toggleReasoning = (index: number) => {
  // 防止事件冒泡
  event?.stopPropagation();
  
  if (expandedReasoningIndex.value === index) {
    expandedReasoningIndex.value = null; // 折叠
  } else {
    expandedReasoningIndex.value = index; // 展开
  }
};

// 添加工具消息的展开/折叠函数
const toggleTool = (index: number) => {
  // 防止事件冒泡
  event?.stopPropagation();
  
  // 记录当前工具消息元素
  const toolElement = event?.currentTarget as HTMLElement;
  // 记录当前滚动位置
  const currentScrollTop = messagesContainer.value?.scrollTop || 0;
  // 记录元素当前位置
  const elementTop = toolElement?.getBoundingClientRect().top || 0;
  
  if (expandedToolIndex.value === index) {
    expandedToolIndex.value = null; // 折叠
  } else {
    expandedToolIndex.value = index; // 展开
    
    // 使用nextTick确保DOM已更新
    nextTick(() => {
      // 计算展开后元素的新位置
      const newElementTop = toolElement?.getBoundingClientRect().top || 0;
      // 调整滚动位置，保持元素在相同位置
      const scrollAdjustment = newElementTop - elementTop;
      if (messagesContainer.value && scrollAdjustment !== 0) {
        messagesContainer.value.scrollTop = currentScrollTop + scrollAdjustment;
      }
    });
  }
};

// 展开或折叠流式推理内容
const toggleStreamingReasoning = () => {
  isReasoningExpanded.value = !isReasoningExpanded.value;
};

// 复制内容到剪贴板
const copyToClipboard = (text: string, index?: number) => {
  if (text) {
    // 复制原始Markdown文本，这样用户可以保留格式
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // 复制成功，显示提示
        if (index !== undefined) {
          copiedIndex.value = index;
        }
        // 2秒后自动隐藏提示
        setTimeout(() => {
          copiedIndex.value = null;
        }, 2000);
      })
      .catch((err) => {
        console.error("复制失败:", err);
      });
  }
};

// 提取工具名称
const getToolName = (content: string): string => {
  try {
    const parsed = JSON.parse(content);
    if (parsed.name) {
      return parsed.name;
    }
    if (parsed.errorMessage) {
      return "工具调用失败";
    }
    return "工具调用成功";
  } catch (e) {
    return "工具调用失败";
  }
};

// 工具结果预览（只显示第一行）
const formatToolPreview = (content: string): string => {
  if (!content) return "";

  try {
    // 尝试解析JSON
    const parsed = JSON.parse(content);
    
    // 处理工具错误消息
    if (parsed.errorMessage) {
      const errorMessage = parsed.errorMessage.toString();
      const firstLine = errorMessage.split('\n')[0] || "错误信息";
      return `<div class="tool-preview">${firstLine}${errorMessage.includes('\n') ? '...' : ''}</div>`;
    }
    
    // 处理常见工具消息格式
    if (parsed.content && Array.isArray(parsed.content) && parsed.content.length > 0) {
      if (parsed.content[0].type === 'text' && parsed.content[0].text) {
        const firstLine = parsed.content[0].text.split('\n')[0] || "工具结果";
        return `<div class="tool-preview">${firstLine}${parsed.content[0].text.includes('\n') ? '...' : ''}</div>`;
      }
      return `<div class="tool-preview">工具返回了 ${parsed.content.length} 项内容</div>`;
    }
    
    // 处理普通结果
    if (parsed.result) {
      const resultStr = parsed.result.toString();
      const firstLine = resultStr.split('\n')[0] || "工具结果";
      return `<div class="tool-preview">${firstLine}${resultStr.includes('\n') ? '...' : ''}</div>`;
    }
    
    return `<div class="tool-preview">点击查看完整结果</div>`;
  } catch (e) {
    // JSON解析失败，尝试获取第一行
    const firstLine = content.split('\n')[0] || "工具结果";
    return `<div class="tool-preview">${firstLine}${content.includes('\n') ? '...' : ''}</div>`;
  }
};

// 格式化消息，使用markdown-it解析
const formatMessage = (content: string): string => {
  if (!content) return "";

  // 检查是否为特殊工具调用提示格式
  if (content.startsWith('#useTool<toolName>')) {
    return formatToolPromptMessage(content);
  }

  // 使用markdown-it解析Markdown文本为HTML
  return md.render(content);
};

// 格式化特殊的工具调用提示消息
const formatToolPromptMessage = (content: string): string => {
  try {
    // 提取工具名称
    const toolNameMatch = content.match(/<toolName>(.*?)<\/toolName>/);
    const toolName = toolNameMatch ? toolNameMatch[1] : "未知工具";
    
    // 提取工具参数
    const toolArgsMatch = content.match(/<toolArgs>(.*?)<\/toolArgs>/);
    let toolArgs = "{}";
    if (toolArgsMatch) {
      toolArgs = toolArgsMatch[1];
    }
    
    // 尝试解析和美化JSON参数
    let formattedArgs = toolArgs;
    let argsObj: Record<string, any> = {};
    try {
      argsObj = JSON.parse(toolArgs);
      formattedArgs = JSON.stringify(argsObj, null, 2);
    } catch (e) {
      console.error("解析工具参数失败:", e);
    }
    
    // 提取工具的实际名称（去除服务器前缀）
    let displayToolName = toolName;
    if (toolName.includes('_SERVERKEYTONAME_')) {
      displayToolName = toolName.split('_SERVERKEYTONAME_')[1];
    }
    
    // 为不同类型的工具提供友好说明
    let actionDescription = "即将调用工具";
    let toolIcon = "🔧";
    
    // 根据工具名称提供不同的描述和图标
    if (displayToolName.includes('navigate') || displayToolName.includes('browser')) {
      toolIcon = "🌐";
    } else if (displayToolName.includes('search')) {
      toolIcon = "🔍";
    } else if (displayToolName.includes('read') || displayToolName.includes('get')) {
      toolIcon = "📥";
    } else if (displayToolName.includes('write') || displayToolName.includes('create')) {
      toolIcon = "📝";
    } else if (displayToolName.includes('delete') || displayToolName.includes('remove')) {
      toolIcon = "🗑️";
    }
    
    // 返回格式化后的HTML - 与工具消息结构一致
    return `
      <div class="tool-plan">
        <div class="tool-plan-header">
          ${toolIcon} 即将调用工具
        </div>
        <div class="tool-plan-content">
          <div class="tool-plan-name">
            <span class="tool-plan-label">工具名称：</span> 
            <span class="tool-plan-value">${displayToolName}</span>
          </div>
          <div class="tool-plan-params">
            <span class="tool-plan-label">参数：</span>
            <pre class="tool-plan-json">${formattedArgs}</pre>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    console.error("格式化工具提示消息失败:", e);
    return md.render(content);
  }
};

const formatToolMessage = (content: string): string => {
  if (!content) return "";

  try {
    // 尝试解析JSON
    const parsed = JSON.parse(content);
    
    // 处理工具错误消息
    if (parsed.errorMessage) {
      return `<div class="tool-error">
        <div class="tool-error-title">错误信息</div>
        <div class="tool-error-message">${parsed.errorMessage}</div>
      </div>`;
    }
    
    // 处理常见工具消息格式：content数组包含不同类型的内容
    if (parsed.content && Array.isArray(parsed.content)) {
      return parsed.content.map((item: { type: string; text?: string; url?: string; image?: string; }) => {
        if (item.type === 'text') {
          // 将换行符转换为HTML换行
          return `<div class="tool-text">${item.text?.replace(/\n/g, '<br>')}</div>`;
        } else if (item.type === 'image' && item.url) {
          return `<div class="tool-image"><img src="${item.url}" alt="工具生成的图片" /></div>`;
        } else if (item.type === 'url') {
          return `<div class="tool-url"><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a></div>`;
        } else {
          // 处理其他类型
          return `<div class="tool-item">${JSON.stringify(item)}</div>`;
        }
      }).join('');
    }
    
    // 格式化参数
    if (parsed.result) {
      return `<div class="tool-result">${parsed.result}</div>`;
    }
    
    // 如果不是预期格式，则美化显示JSON
    return `<pre class="tool-json">${JSON.stringify(parsed, null, 2)}</pre>`;
  } catch (e) {
    // JSON解析失败，按原样返回内容
    console.error("Tool message JSON parse error:", e);
    return `<div class="tool-text">${content}</div>`;
  }
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

// 监听展开的推理内容索引变化，展开时滚动到底部
watch(
  () => expandedReasoningIndex.value,
  () => {
    scrollReasoningToBottom();
  }
);

// 监听展开的工具内容索引变化
watch(
  () => expandedToolIndex.value,
  () => {
    // 不做额外滚动处理，由toggleTool函数处理
  }
);

// 初始化时滚动到底部
onMounted(() => {
  scrollToBottom();
});
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

.tool-avatar {
  background-color: #34a853;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.tool-logo {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message.user {
  align-items: flex-end;
}

.message.assistant,
.message.system,
.message.tool {
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

.message.assistant .message-container {
  background-color: #e6e6fa; /* 偏紫色 Lavender */
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

.message.tool .message-container {
  background-color: #e8f5e9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
}

.message-content {
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

/* 工具消息相关样式 */
.tool-text {
  padding: 8px 0;
  line-height: 1.6;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
  color: #37474f;
}

.tool-image {
  margin: 10px 0;
}

.tool-image img {
  max-width: 100%;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tool-url {
  padding: 6px 0;
}

.tool-url a {
  color: #1976d2;
  text-decoration: none;
  word-break: break-all;
}

.tool-url a:hover {
  text-decoration: underline;
}

.tool-item {
  background-color: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  margin: 6px 0;
  font-family: monospace;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
}

.tool-json {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  overflow-x: auto;
  color: #333;
  border: 1px solid #e0e0e0;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
}

.tool-result {
  padding: 8px 0;
  white-space: pre-wrap;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  max-height: 300px;
  overflow-y: auto;
}

.tool-error {
  background-color: #ffebee;
  border-left: 3px solid #ef5350;
  padding: 10px 14px;
  margin: 8px 0;
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.tool-error-title {
  font-weight: bold;
  color: #c62828;
  margin-bottom: 4px;
}

.tool-error-message {
  color: #b71c1c;
  font-family: monospace;
  white-space: pre-wrap;
}

/* 添加工具消息内容容器统一样式 */
.message.tool .message-content {
  max-height: 400px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

/* 自定义滚动条样式 */
.message.tool .message-content::-webkit-scrollbar {
  width: 6px;
}

.message.tool .message-content::-webkit-scrollbar-track {
  background: transparent;
}

.message.tool .message-content::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.message.tool .message-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.3);
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
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 优化Markdown样式 */
.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4),
.message-content :deep(h5),
.message-content :deep(h6) {
  margin-top: 12px;
  margin-bottom: 8px;
  font-weight: 600;
}

.message-content :deep(h1) {
  font-size: 1.4em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.message-content :deep(h2) {
  font-size: 1.3em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.message-content :deep(h3) {
  font-size: 1.2em;
}

.message-content :deep(h4) {
  font-size: 1.1em;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  padding-left: 1.2em;
  margin: 0.5em 0;
}

.message-content :deep(li) {
  margin: 0.1em 0;
}

.message-content :deep(p) {
  margin: 0.3em 0;
}

/* 确保代码块样式正确 */
.message-content :deep(pre) {
  background-color: #282c34;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 10px 0;
  color: #abb2bf;
}

.message-content :deep(code) {
  font-family: "Menlo", "Monaco", "Courier New", monospace;
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
  0%,
  100% {
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
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
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

/* 统一推理容器样式 */
.reasoning-container,
.streaming-reasoning-container {
  margin-top: 0;
  margin-bottom: 12px;
  padding: 10px;
  border-radius: 8px;
  background-color: #f0f8ff;
  min-height: 20px;
  border: 1px solid #6495ed;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
  cursor: pointer; /* 添加指针样式表明可点击 */
  transition: all 0.3s ease;
}

.reasoning-container.collapsed {
  min-height: 16px;
  padding: 8px 10px;
}

.reasoning-header {
  font-weight: bold;
  margin-bottom: 5px;
  color: #4169e1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-icon {
  font-size: 12px;
  transition: transform 0.3s ease;
  margin-left: 5px;
  color: #6495ed;
}

.reasoning-container.collapsed .reasoning-header {
  margin-bottom: 0;
}

.reasoning-container.collapsed .toggle-icon {
  color: #7a7a7a;
}

.reasoning-content {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.9em;
  color: #333;
  background-color: transparent;
  border: none;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  overflow-y: auto;
  max-height: 300px;
  min-height: 20px;
  scroll-behavior: smooth; /* 添加平滑滚动 */
  transition: max-height 0.3s ease;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  border-bottom: 1px solid #c8e6c9;
  padding-bottom: 6px;
}

.tool-name {
  font-weight: 600;
  color: #2e7d32;
  font-size: 14px;
}

/* 工具消息可折叠容器样式 */
.tool-content-container {
  cursor: pointer;
  position: relative;
  padding: 10px 14px;
  background-color: #f0f8f0;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s ease;
  border: 1px solid #d7ecd8;
}

.tool-content-container:hover {
  background-color: #e8f5e9;
  border-color: #c8e6c9;
  transform: translateY(-1px);
}

.tool-preview {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #2c3e50;
  line-height: 1.5;
  padding: 2px 0;
}

.toggle-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 6px;
  background-color: rgba(46, 125, 50, 0.08);
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.tool-content-container:hover .toggle-indicator {
  background-color: rgba(46, 125, 50, 0.15);
}

.toggle-text {
  font-size: 12px;
  color: #2e7d32;
  font-weight: 500;
}

.toggle-indicator .toggle-icon {
  margin-left: 4px;
  font-size: 10px;
  color: #2e7d32;
}

.tool-expanded-content {
  margin-top: 12px;
  padding: 15px;
  background-color: #f7fbf7;
  border-radius: 8px;
  border: 1px solid #d7ecd8;
  max-height: 400px;
  overflow-y: auto;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 工具调用提示消息样式 - 与工具消息一致 */
.tool-plan {
  width: 100%;
}

.tool-plan-header {
  font-weight: 600;
  color: #2e7d32;
  padding-bottom: 6px;
  margin-bottom: 8px;
  border-bottom: 1px solid #c8e6c9;
  font-size: 14px;
}

.tool-plan-content {
  background-color: #f0f8f0;
  border-radius: 8px;
  border: 1px solid #d7ecd8;
  padding: 10px;
}

.tool-plan-name {
  margin-bottom: 8px;
}

.tool-plan-label {
  font-weight: 500;
  color: #555;
}

.tool-plan-value {
  color: #2e7d32;
  font-family: 'Consolas', monospace;
  font-weight: 500;
}

.tool-plan-json {
  background-color: rgba(255, 255, 255, 0.5);
  padding: 10px;
  margin: 5px 0 0 0;
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: #37474f;
  white-space: pre-wrap;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgba(0, 0, 0, 0.05);
}
</style>