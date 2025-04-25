<template>
  <div class="message assistant">
    <div class="message-row">
      <MessageAvatar type="assistant" />
      <div class="message-container">
        <div 
          class="tool-prompt-container" 
          :class="{ 'collapsed': shouldCollapseToolPrompt && !isExpanded }"
          @click="shouldCollapseToolPrompt && toggleExpand()"
        >
          <div class="tool-prompt-content" v-html="formattedPrompt"></div>
          <div v-if="shouldCollapseToolPrompt" class="toggle-indicator tool-prompt-toggle">
            <span class="toggle-text">{{ isExpanded ? '收起' : '展开详情' }}</span>
            <span class="toggle-icon">{{ isExpanded ? '▲' : '▼' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref, computed } from 'vue';
import MessageAvatar from './MessageAvatar.vue';

const props = defineProps<{
  content: string;
}>();

// Add the emit declaration
const emit = defineEmits(['tool-click']);

// 是否展开
const isExpanded = ref(false);

// 切换展开/折叠状态
const toggleExpand = () => {
  // Prevent event bubbling
  event?.stopPropagation();
  isExpanded.value = !isExpanded.value;
};

// 格式化特殊的工具调用提示消息
const formattedPrompt = computed(() => {
  try {
    // Find all tool calls in the content
    const toolNameMatches = [...props.content.matchAll(/<toolName>(.*?)<\/toolName>/g)];
    const toolArgsMatches = [...props.content.matchAll(/<toolArgs>(.*?)<\/toolArgs>/g)];
    
    // If no tool calls found, return original content
    if (toolNameMatches.length === 0) {
      return props.content;
    }
    
    // Process each tool call and combine the results
    const toolCallsHtml = [];
    
    for (let i = 0; i < toolNameMatches.length; i++) {
      const toolNameMatch = toolNameMatches[i];
      const toolArgsMatch = i < toolArgsMatches.length ? toolArgsMatches[i] : null;
      
      const toolName = toolNameMatch ? toolNameMatch[1] : "未知工具";
      let toolArgs = "{}";
      
      if (toolArgsMatch) {
        toolArgs = toolArgsMatch[1];
      }
      
      // Try to parse and beautify JSON parameters
      let formattedArgs = toolArgs;
      let argsObj: Record<string, any> = {};
      try {
        argsObj = JSON.parse(toolArgs);
        
        // Special handling for parameters containing URLs
        if (argsObj.url) {
          argsObj.url = `<a href="${argsObj.url}" style="color: #0366d6; word-break: break-all; overflow-wrap: break-word; max-width: 100%; display: inline-block; font-size: 0.85em; text-decoration: none;" target="_blank" rel="noopener noreferrer">${argsObj.url}</a>`;
        }
        
        // Create more user-friendly parameter display format
        let paramsList = '';
        if (Object.keys(argsObj).length > 0) {
          paramsList = Object.entries(argsObj).map(([key, value]) => {
            // Format different types of values
            let displayValue;
            if (typeof value === 'string') {
              // Handle string values, preserve HTML tags
              if (value.includes('style="color: #0366d6; word-break: break-all;')) {
                displayValue = value;
              } else {
                displayValue = `"${value}"`;
              }
            } else if (value === null) {
              displayValue = '<span style="color: #888;">null</span>';
            } else if (Array.isArray(value)) {
              // Format arrays with syntax highlighting
              try {
                const formattedArray = JSON.stringify(value, null, 2)
                  .replace(/\n/g, '<br>')
                  .replace(/\s{2}/g, '&nbsp;&nbsp;')
                  .replace(/(\[|\])/g, '<span style="color: #0366d6;">$1</span>')
                  .replace(/"([^"]+)":/g, '<span style="color: #7c62c2;">"$1"</span>:')
                  .replace(/: "([^"]+)"/g, ': <span style="color: #2e7d32;">"$1"</span>');
                displayValue = formattedArray;
              } catch (e) {
                displayValue = JSON.stringify(value);
              }
            } else if (typeof value === 'object') {
              // Format objects with syntax highlighting
              try {
                const formattedObject = JSON.stringify(value, null, 2)
                  .replace(/\n/g, '<br>')
                  .replace(/\s{2}/g, '&nbsp;&nbsp;')
                  .replace(/({|})/g, '<span style="color: #0366d6;">$1</span>')
                  .replace(/"([^"]+)":/g, '<span style="color: #7c62c2;">"$1"</span>:')
                  .replace(/: "([^"]+)"/g, ': <span style="color: #2e7d32;">"$1"</span>');
                displayValue = formattedObject;
              } catch (e) {
                displayValue = JSON.stringify(value);
              }
            } else {
              // Handle basic types
              displayValue = String(value);
            }
            
            // Return formatted parameter row
            return `<div style="display: flex; margin-bottom: 6px; line-height: 1.4; flex-wrap: wrap; align-items: flex-start; padding: 5px 8px; border-left: 2px solid #e0e0e0; background-color: rgba(0, 0, 0, 0.01); border-radius: 3px;">
              <span style="color: #666; min-width: 80px; font-weight: 600; padding-right: 10px; flex-shrink: 0; font-size: 0.85em;">${key}:</span>
              <span style="color: #333; word-break: break-word; white-space: pre-wrap; flex: 1; padding-left: 5px; font-family: 'Menlo', 'Monaco', 'Courier New', monospace; font-size: 0.85em; max-width: 100%; overflow-wrap: break-word;">${displayValue}</span>
            </div>`;
          }).join('');
        } else {
          paramsList = '<div style="color: #888; font-style: italic; font-size: 0.85em;">无参数</div>';
        }
        
        formattedArgs = paramsList;
      } catch (e) {
        console.error("解析工具参数失败:", e);
      }
      
      // Extract actual tool name (remove server prefix)
      let displayToolName = toolName;
      if (toolName.includes('_SERVERKEYTONAME_')) {
        displayToolName = toolName.split('_SERVERKEYTONAME_')[1];
      }
      
      // Create HTML for this tool call
      const toolCallHtml = `
        <div style="${i !== 0 ? 'margin-top: 8px;' : ''}; background-color: #FCFCFF; border-radius: 8px; border: 1px solid #E6E4F0; overflow: hidden; box-shadow: 0 2px 6px rgba(124, 98, 194, 0.1); transition: all 0.2s ease;">
          <div style="display: flex; align-items: center; padding: 8px 12px; background-color: #F7F5FF; border-bottom: 1px solid #E6E4F0; justify-content: space-between;">
            <div style="display: flex; align-items: center;">
              <span 
                style="font-weight: 600; font-family: monospace; color: #5D4DB3; font-size: 0.95em; padding: 3px 8px; background-color: rgba(124, 98, 194, 0.12); border-radius: 4px; display: inline-block; letter-spacing: 0.01em; border-left: 2px solid #7C62C2; cursor: pointer;"
                @click.stop="$emit('tool-click', toolName)"
                title="点击查看工具详情"
              >${displayToolName}</span>
              <div style="min-width: 40px; display: flex; align-items: center; justify-content: center; margin-left: 10px; background: linear-gradient(to bottom, #3ac264, #34a853); color: white; font-size: 0.7em; padding: 3px 8px; border-radius: 12px; font-weight: 600; letter-spacing: 0.03em; box-shadow: 0 1px 3px rgba(52, 168, 83, 0.3); border: 1px solid rgba(52, 168, 83, 0.2);">
                工具${toolNameMatches.length > 1 ? i + 1 : ''}
              </div>
            </div>
          </div>
          <div style="padding: 10px 12px; font-family: monospace; font-size: 0.85em; background-color: #FCFCFF; border-radius: 0 0 8px 8px; overflow: hidden;">
            ${formattedArgs}
          </div>
        </div>
      `;
      
      toolCallsHtml.push(toolCallHtml);
    }
    
    // Return all tool calls HTML combined
    return toolCallsHtml.join('');
  } catch (e) {
    console.error("格式化工具提示消息失败:", e);
    return props.content;
  }
});

// Check if tool prompt should be collapsed initially
const shouldCollapseToolPrompt = computed((): boolean => {
  try {
    // Check combined length of all tool arguments
    const toolArgsMatches = [...props.content.matchAll(/<toolArgs>(.*?)<\/toolArgs>/g)];
    let totalLength = 0;
    
    for (const match of toolArgsMatches) {
      if (match && match[1]) {
        totalLength += match[1].length;
      }
    }
    
    return totalLength > 200;
  } catch (e) {
    return false;
  }
});
</script>

<style scoped>
@import '../../assets/styles/message.css';
@import '../../assets/styles/tool-prompt.css';
</style> 