<template>
  <div class="message assistant">
    <div class="message-row">
      <div class="avatar ai-avatar" :class="{ 'loading': isLoading }">
        <img src="/assets/logo.png" alt="AI" class="ai-logo" />
        <div v-show="isLoading" class="loading-indicator status-calling">调用中</div>
      </div>
      
      <div class="message-container">
        <div 
          class="tool-prompt-container" 
          :class="{ 'collapsed': shouldCollapseToolPrompt && !isExpanded }"
        >
          <div class="tool-prompt-content">
            <!-- 没有工具调用时显示原始内容 -->
            <div v-if="!props.toolCalls || props.toolCalls.length === 0" v-html="props.content"></div>
            
            <!-- 有工具调用时显示工具卡片 -->
            <div v-else>
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
                    <div class="tool-badge">
                      工具{{ props.toolCalls.length > 1 ? index + 1 : '' }}
                    </div>
                  </div>
                </div>
                <div class="tool-card-body">
                  <div v-html="toolCall.formattedArgs"></div>
                </div>
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
import { defineProps, ref, computed } from 'vue';
import { ToolCall } from '../../types';

const props = defineProps<{
  content: string;
  isLoading?: boolean;
  toolCalls?: Array<ToolCall>
}>();

// 添加事件
const emit = defineEmits(['tool-click']);

// 是否展开
const isExpanded = ref(false);

// 切换展开/折叠状态
const toggleExpand = () => {
  // 防止事件冒泡
  event?.stopPropagation();
  isExpanded.value = !isExpanded.value;
};

// 处理工具调用数据
interface ProcessedToolCall {
  name: string;
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
      displayName,
      formattedArgs
    };
  });
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
  font-size: 0.95em;
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
  margin-right: 20px;
  background: linear-gradient(to bottom, #3ac264, #34a853);
  color: white;
  font-size: 0.7em;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  box-shadow: 0 1px 3px rgba(52, 168, 83, 0.3);
  border: 1px solid rgba(52, 168, 83, 0.2);
}

.tool-card-body {
  padding: 10px 12px;
  font-family: monospace;
  font-size: 0.85em;
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
  font-size: 0.85em;
}

.tool-param-value {
  color: #333;
  word-break: break-word;
  white-space: pre-wrap;
  flex: 1;
  padding-left: 5px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.85em;
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