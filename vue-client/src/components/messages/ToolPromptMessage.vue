<template>
  <div class="message assistant">
    <div class="message-row">
      <div class="avatar ai-avatar" :class="{ 'loading': isLoading }">
        <img src="/assets/logo.png" alt="AI" class="ai-logo" />
      </div>
      
      <div
        class="message-container"
        :class="{
          'with-content': content,
        }"
      >
        <div 
          class="tool-prompt-container" 
          :class="{ 'collapsed': shouldCollapseToolPrompt && !isExpanded }"
        >
          <!-- 推理内容 -->
          <ReasoningContainer
            v-if="reasoningContent && reasoningContent.trim().length > 0"
            :content="reasoningContent"
            :is-collapsed="isCollapsedReasoning"
            @toggle="toggleReasoning"
          />
          <!-- 正文内容 -->
          <div v-if="content" class="message-content" v-html="formattedContent"></div>
          <div class="tool-prompt-content">
            <div 
              v-for="(toolCall, index) in processedToolCalls" 
              :key="index"
              :class="{ 'tool-card-container-not-first': index !== 0 }"
              class="tool-card-container"
            >
              <div class="tool-card-header">
                <div class="tool-card-header-left">
                  <span 
                    class="tool-name"
                    title="点击查看工具详情"
                    @click="emit('tool-click', toolCall.name)"
                  >{{ toolCall.displayName }}</span>
                  <div
                    class="tool-badge tool-processing"
                    :class="{
                      'tool-failed': failSet && failSet.has(toolCall.toolCallId),
                      'tool-finished': finishedSet && finishedSet.has(toolCall.toolCallId)
                    }"
                    @click="openToolCallResult(toolCall.toolCallId)"
                  >
                    <template v-if="failSet && failSet.has(toolCall.toolCallId)">已失败</template>
                    <template v-else-if="finishedSet && finishedSet.has(toolCall.toolCallId)">已完成</template>
                    <template v-else-if="finishedSet && !finishedSet.has(toolCall.toolCallId)">调用中</template>
                  </div>
                </div>
              </div>
              <div class="tool-card-body">
                <div v-html="toolCall.formattedArgs"></div>
              </div>
            </div>
          </div>
          <div
            v-if="shouldCollapseToolPrompt"
            class="toggle-indicator tool-prompt-toggle"
            @click="shouldCollapseToolPrompt && toggleExpand()"
          >
            <span class="toggle-text">{{ isExpanded ? '收起' : '展开详情' }}</span>
            <span class="toggle-icon">{{ isExpanded ? '▲' : '▼' }}</span>
          </div>
        </div>
        <div v-if="isLoading" class="streaming-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ReasoningContainer from './ReasoningContainer.vue';
import { defineProps, ref, computed, onMounted } from 'vue';
import { ToolCall, ChatMessage } from '../../types';
import { createMarkdownRenderer } from '../../utils/markdown';

const props = defineProps<{
  content: string;
  reasoningContent?: string;
  isLoading?: boolean;
  toolCalls?: Array<ToolCall>;
  nextMessages?: Array<ChatMessage>;
}>();

// 添加事件
const emit = defineEmits(['tool-click', 'tool-result-click']);

// 是否展开
const isExpanded = ref(false);

// 初始化markdown解析器
const md = createMarkdownRenderer();

// 推理内容是否收起
const isCollapsedReasoning = ref(true);

// 修改toggleReasoning函数使其更可靠
const toggleReasoning = () => {
  // 防止事件冒泡
  event?.stopPropagation();

  isCollapsedReasoning.value = !isCollapsedReasoning.value;
};

// 格式化消息
const formattedContent = computed(() => {
  if (!props.content) return "";
  return md.render(props.content);
});

// 切换展开/折叠状态
const toggleExpand = () => {
  // 防止事件冒泡
  event?.stopPropagation();
  isExpanded.value = !isExpanded.value;
};

// 处理工具调用数据
interface ProcessedToolCall {
  name: string;
  toolCallId: string;
  displayName: string;
  formattedArgs: string;
}

// 处理工具调用数据
const processedToolCalls = computed<ProcessedToolCall[]>(() => {
  // 如果没有传入工具调用或数组为空，返回空数组
  if (!props.toolCalls || props.toolCalls.length === 0) {
    return [];
  }
  
  // 处理新的toolCalls数据结构
  return props.toolCalls.map(toolCall => {
    // 获取工具名称
    const toolName = toolCall.function.name;
    
    // 提取显示名称（移除服务器前缀）
    let displayName = toolName;
    if (toolName.includes('_SERVERKEYTONAME_')) {
      displayName = toolName.split('_SERVERKEYTONAME_')[1];
    }
    
    // 格式化参数
    const formattedArgs = formatToolArguments(toolCall.function.arguments);
    
    return {
      name: toolName,
      toolCallId: toolCall.id,
      displayName,
      formattedArgs
    };
  });
});

// 后面的工具完成情况map
const finishedSet = computed(() => {
  const finishedSet = new Set<string>();

  props.nextMessages?.forEach((message) => {
    if (message.role === 'tool' && message.toolCallId) {
      if (processedToolCalls.value.find(toolCall => toolCall.toolCallId === message.toolCallId)) {
        finishedSet.add(message.toolCallId);
      };
    }
  });

  return finishedSet;
});

// 后面的工具失败情况map
const failSet = computed(() => {
  const failSet = new Set<string>();

  props.nextMessages?.forEach((message) => {
    if (message.role === 'tool' && message.toolCallId) {
      try {
        const parsed = JSON.parse(message.content);

        if (parsed.errorMessage || parsed.error) {
          failSet.add(message.toolCallId);
        }
      } catch (e) {
        return false;
      }
    }
  });

  return failSet;
});

// 格式化工具参数的函数
const formatToolArguments = (toolArgs: string): string => {
  // 解析和美化JSON参数
  let formattedArgs = toolArgs;
  let argsObj: Record<string, any> = {};
  
  try {
    argsObj = JSON.parse(toolArgs);
    
    // 特殊处理包含URL的参数
    if (argsObj.url) {
      argsObj.url = `<a href="${argsObj.url}" class="tool-url-link" target="_blank" rel="noopener noreferrer">${argsObj.url}</a>`;
    }
    
    // 创建更友好的参数显示格式
    let paramsList = '';
    if (Object.keys(argsObj).length > 0) {
      paramsList = Object.entries(argsObj).map(([key, value]) => {
        // 格式化不同类型的值
        let displayValue;
        if (typeof value === 'string') {
          // 处理字符串值，保留HTML标签
          if (value.includes('class="tool-url-link"')) {
            displayValue = value;
          } else {
            displayValue = `"${value}"`;
          }
        } else if (value === null) {
          displayValue = '<span class="tool-null-value">null</span>';
        } else if (Array.isArray(value)) {
          // 使用语法高亮格式化数组
          try {
            const formattedArray = JSON.stringify(value, null, 2)
              .replace(/\n/g, '<br>')
              .replace(/\s{2}/g, '&nbsp;&nbsp;')
              .replace(/(\[|\])/g, '<span class="tool-syntax-bracket">$1</span>')
              .replace(/"([^"]+)":/g, '<span class="tool-syntax-key">"$1"</span>:')
              .replace(/: "([^"]+)"/g, ': <span class="tool-syntax-string">"$1"</span>');
            displayValue = formattedArray;
          } catch (e) {
            displayValue = JSON.stringify(value);
          }
        } else if (typeof value === 'object') {
          // 使用语法高亮格式化对象
          try {
            const formattedObject = JSON.stringify(value, null, 2)
              .replace(/\n/g, '<br>')
              .replace(/\s{2}/g, '&nbsp;&nbsp;')
              .replace(/({|})/g, '<span class="tool-syntax-bracket">$1</span>')
              .replace(/"([^"]+)":/g, '<span class="tool-syntax-key">"$1"</span>:')
              .replace(/: "([^"]+)"/g, ': <span class="tool-syntax-string">"$1"</span>');
            displayValue = formattedObject;
          } catch (e) {
            displayValue = JSON.stringify(value);
          }
        } else {
          // 处理基本类型
          displayValue = String(value);
        }
        
        // 返回格式化的参数行
        return `<div class="tool-param-row">
          <span class="tool-param-key">${key}:</span>
          <span class="tool-param-value">${displayValue}</span>
        </div>`;
      }).join('');
    } else {
      paramsList = '<div class="tool-no-params">无参数</div>';
    }
    
    formattedArgs = paramsList;
  } catch (e) {
    console.error("解析工具参数失败:", e);
  }
  
  return formattedArgs;
};

// 检查工具提示是否应初始折叠
const shouldCollapseToolPrompt = computed((): boolean => {
  try {
    if (props.toolCalls && props.toolCalls.length > 0) {
      // 检查所有工具调用参数的总长度
      let totalLength = 0;
      for (const toolCall of props.toolCalls) {
        totalLength += toolCall.function.arguments.length;
      }
      return totalLength > 200;
    }
    return false;
  } catch (e) {
    return false;
  }
});

// 打开工具调用结果
function openToolCallResult(toolCallId: string) {
  if (!finishedSet.value.has(toolCallId)) {
    return;
  }
  
  // 查找对应的工具调用结果
  const toolResult = props.nextMessages?.find(
    message => message.role === 'tool' && message.toolCallId === toolCallId
  );
  
  if (toolResult) {
    emit('tool-result-click', toolResult.content);
  }
}

onMounted(() => {
})
</script>

<style scoped>
@import '../../assets/styles/message.css';
@import '../../assets/styles/tool-prompt.css';

/* 工具卡片样式 */
.tool-card-container {
  background-color: #FCFCFF;
  border-radius: 8px;
  border: 1px solid #E6E4F0;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(124, 98, 194, 0.1);
  transition: all 0.2s ease;
  max-width: 600px;
}

.tool-card-container-not-first {
  margin-top: 8px;
}

.tool-card-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #F7F5FF;
  border-bottom: 1px solid #E6E4F0;
  justify-content: space-between;
}

.tool-card-header-left {
  display: flex;
  align-items: center;
}

.tool-name {
  font-weight: 600;
  font-family: monospace;
  color: #5D4DB3;
  font-size: 0.85em;
  padding: 3px 8px;
  background-color: rgba(124, 98, 194, 0.12);
  border-radius: 4px;
  display: inline-block;
  letter-spacing: 0.01em;
  border-left: 2px solid #7C62C2;
  cursor: pointer;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-badge {
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10px;
  margin-right: 10px;
  color: white;
  font-size: 0.7em;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: center;
}

.tool-badge.tool-processing {
  background: linear-gradient(135deg, #FF9933 0%, #FF8533 100%);
  border: 1px solid rgba(255, 153, 51, 0.3);
  box-shadow: 0 2px 4px rgba(255, 153, 51, 0.2);
  animation: pulse 2s infinite, badge-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tool-badge.tool-finished {
  cursor: pointer;
  background: linear-gradient(135deg, #34c759 0%, #32b350 100%);
  border: 1px solid rgba(52, 199, 89, 0.3);
  box-shadow: 0 2px 4px rgba(52, 199, 89, 0.15);
  animation: badge-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tool-badge.tool-failed {
  cursor: pointer;
  background: linear-gradient(135deg, #ff3b30 0%, #dc352b 100%);
  border: 1px solid rgba(255, 59, 48, 0.3);
  box-shadow: 0 2px 4px rgba(255, 59, 48, 0.15);
  animation: badge-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tool-badge.tool-failed:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(255, 59, 48, 0.25);
}

.tool-badge.tool-finished:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(52, 199, 89, 0.25);
}

@keyframes badge-enter {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 2px 4px rgba(255, 153, 51, 0.2);
  }
  50% {
    box-shadow: 0 2px 8px rgba(255, 153, 51, 0.4);
  }
  100% {
    box-shadow: 0 2px 4px rgba(255, 153, 51, 0.2);
  }
}

.tool-card-body {
  padding: 10px 12px;
  font-family: monospace;
  font-size: 0.8em;
  background-color: #FCFCFF;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
}

/* 参数格式化样式 */
.tool-param-row {
  display: flex;
  margin-bottom: 6px;
  line-height: 1.4;
  flex-wrap: wrap;
  align-items: flex-start;
  padding: 5px 8px;
  border-left: 2px solid #e0e0e0;
  background-color: rgba(0, 0, 0, 0.01);
  border-radius: 3px;
}

.tool-param-key {
  color: #666;
  min-width: 80px;
  font-weight: 600;
  padding-right: 10px;
  flex-shrink: 0;
  font-size: 0.8em;
}

.tool-param-value {
  color: #333;
  word-break: break-word;
  white-space: pre-wrap;
  flex: 1;
  padding-left: 5px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.8em;
  max-width: 100%;
  overflow-wrap: break-word;
}

.tool-url-link {
  color: #0366d6;
  word-break: break-all;
  overflow-wrap: break-word;
  max-width: 100%;
  display: inline-block;
  font-size: 0.85em;
  text-decoration: none;
}

.tool-null-value {
  color: #888;
}

.tool-no-params {
  color: #888;
  font-style: italic;
  font-size: 0.85em;
}

/* 语法高亮 */
.tool-syntax-bracket {
  color: #0366d6;
}

.tool-syntax-key {
  color: #7c62c2;
}

.tool-syntax-string {
  color: #2e7d32;
}
</style> 