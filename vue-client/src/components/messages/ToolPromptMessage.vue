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
    
    <!-- Tool description popup with transition -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showToolInfo" class="tool-info-overlay" @click.stop="closeToolInfo">
          <Transition name="zoom">
            <div v-show="showToolInfo" class="tool-info-content" @click.stop>
              <div class="tool-info-header">
                <h3>{{ selectedToolInfo.name || 'Tool Information' }}</h3>
                <button class="close-btn" @click.stop="closeToolInfo">×</button>
              </div>
              <div class="tool-info-body">
                <div v-if="loadingToolInfo" class="tool-info-loading">
                  <div class="loading-spinner"></div>
                  <span>Loading tool information...</span>
                </div>
                <div v-else-if="toolInfoError" class="tool-info-error">{{ toolInfoError }}</div>
                <div v-else>
                  <p class="tool-description">{{ selectedToolInfo.description || 'No description available' }}</p>
                  <div v-if="selectedToolInfo.parameters && Object.keys(selectedToolInfo.parameters).length">
                    <h4>Parameters:</h4>
                    <div class="tool-parameters">
                      <div v-for="(param, paramName) in selectedToolInfo.parameters.properties" :key="paramName" class="tool-parameter">
                        <div class="param-name">{{ paramName }}</div>
                        <div class="param-description">{{ param.description || 'No description' }}</div>
                        <div class="param-type">Type: {{ param.type || 'unknown' }}</div>
                        <div v-if="selectedToolInfo.parameters.required && selectedToolInfo.parameters.required.includes(paramName)" class="param-required">Required</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import MessageAvatar from './MessageAvatar.vue';

const props = defineProps<{
  content: string;
}>();

// 是否展开
const isExpanded = ref(false);

// Tool info popup state
const showToolInfo = ref(false);
const selectedToolInfo = ref<any>({});
const loadingToolInfo = ref(false);
const toolInfoError = ref('');
const toolsData = ref<Record<string, any>>({});
// Flag to track if we've already fetched tools data
const hasLoadedToolsData = ref(false);

// 切换展开/折叠状态
const toggleExpand = () => {
  // Prevent event bubbling
  event?.stopPropagation();
  isExpanded.value = !isExpanded.value;
};

// Close tool info popup
const closeToolInfo = () => {
  showToolInfo.value = false;
};

// Handle escape key to close popup
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && showToolInfo.value) {
    closeToolInfo();
  }
};

// Add keyboard event listener when component is mounted
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

// Remove event listener when component is unmounted
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown);
  // Also remove the global event listener for tool description click
  window.removeEventListener('showToolDescription', handleShowToolDescription as EventListener);
});

// Handler for the custom event
const handleShowToolDescription = ((event: CustomEvent) => {
  const toolName = event.detail;
  if (toolName) {
    showToolDescription(toolName);
  }
}) as EventListener;

// Add global event listener for tool description click
window.addEventListener('showToolDescription', handleShowToolDescription);

// Show tool info popup
const showToolDescription = (toolName: string) => {
  const serverKey = toolName.split('_SERVERKEYTONAME_')[0] || '';
  const actualToolName = toolName.split('_SERVERKEYTONAME_')[1] || toolName;
  
  // Format display name for popup title
  let displayName = toolName;
  if (toolName.includes('_SERVERKEYTONAME_')) {
    const parts = toolName.split('_SERVERKEYTONAME_');
    displayName = `[${parts[0]}] ${parts[1]}()方法`;
  } else {
    // Fallback for other naming patterns
    const lastUnderscoreIndex = toolName.lastIndexOf('_');
    if (lastUnderscoreIndex > 0) {
      const serverName = toolName.substring(0, lastUnderscoreIndex);
      const methodName = toolName.substring(lastUnderscoreIndex + 1);
      displayName = `${serverName}工具下的${methodName}方法`;
    }
  }
  
  loadingToolInfo.value = true;
  toolInfoError.value = '';
  selectedToolInfo.value = {
    name: displayName
  };
  
  // If we already have the tools data, use it
  if (hasLoadedToolsData.value) {
    const tool = findToolByName(serverKey, actualToolName);
    if (tool) {
      selectedToolInfo.value = { 
        ...tool,
        name: displayName // Override the name with our formatted version
      };
      loadingToolInfo.value = false;
    } else {
      toolInfoError.value = 'Tool information not found';
      loadingToolInfo.value = false;
    }
  } else {
    // Fetch tools data from API only when needed
    fetchToolsData()
      .then(() => {
        hasLoadedToolsData.value = true;
        const tool = findToolByName(serverKey, actualToolName);
        if (tool) {
          selectedToolInfo.value = {
            ...tool,
            name: displayName // Override the name with our formatted version
          };
        } else {
          toolInfoError.value = 'Tool information not found';
        }
      })
      .catch(error => {
        toolInfoError.value = 'Failed to fetch tool information';
        console.error('Error fetching tool info:', error);
      })
      .finally(() => {
        loadingToolInfo.value = false;
      });
  }
  
  showToolInfo.value = true;
};

// Find tool in tools data
const findToolByName = (serverKey: string, toolName: string) => {
  // First try to find by exact name
  if (toolsData.value[toolName]) {
    return toolsData.value[toolName];
  }
  
  // Then try to find by serverKey_toolName pattern
  if (serverKey && toolsData.value[`${serverKey}_${toolName}`]) {
    return toolsData.value[`${serverKey}_${toolName}`];
  }
  
  // Check each tool name for a match
  for (const key in toolsData.value) {
    if (key.includes(toolName) || (serverKey && key.includes(serverKey))) {
      return toolsData.value[key];
    }
  }
  
  return null;
};

// Fetch tools data from API
const fetchToolsData = async () => {
  try {
    const response = await fetch('/api/tools');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Process tools data into a map for easier lookup
    const toolsMap: Record<string, any> = {};
    if (Array.isArray(data)) {
      data.forEach(tool => {
        if (tool.name) {
          toolsMap[tool.name] = tool;
        }
      });
    } else if (typeof data === 'object') {
      for (const key in data) {
        if (Array.isArray(data[key])) {
          data[key].forEach((tool: any) => {
            if (tool.name) {
              toolsMap[tool.name] = tool;
              // Also store with server prefix for easier lookup
              toolsMap[`${key}_${tool.name}`] = tool;
            }
          });
        }
      }
    }
    
    toolsData.value = toolsMap;
    return toolsMap;
  } catch (error) {
    console.error('Error fetching tools data:', error);
    throw error;
  }
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
                onclick="window.dispatchEvent(new CustomEvent('showToolDescription', {detail: '${toolName}'}))"
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
.message-container {
  padding: 8px;
}

/* Tool Info Popup Styles */
.tool-info-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.tool-info-content {
  background-color: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  position: relative;
  border: 1px solid rgba(124, 98, 194, 0.2);
}

.tool-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #eee;
  background-color: #F7F5FF;
}

.tool-info-header h3 {
  margin: 0;
  font-size: 1.25em;
  color: #5D4DB3;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.8em;
  cursor: pointer;
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #333;
}

.tool-info-body {
  padding: 24px;
}

.tool-description {
  margin-top: 0;
  line-height: 1.6;
  color: #333;
  font-size: 1.05em;
}

.tool-parameters {
  margin-top: 20px;
}

.tool-parameter {
  margin-bottom: 20px;
  padding: 14px;
  border-left: 3px solid #7C62C2;
  background-color: #f9f9f9;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.tool-parameter:hover {
  background-color: #f5f2ff;
  box-shadow: 0 2px 6px rgba(124, 98, 194, 0.1);
}

.param-name {
  font-weight: bold;
  color: #5D4DB3;
  margin-bottom: 6px;
  font-size: 1.1em;
}

.param-description {
  margin-bottom: 8px;
  font-size: 0.95em;
  line-height: 1.5;
}

.param-type {
  font-size: 0.85em;
  color: #666;
  font-family: monospace;
  background-color: rgba(0, 0, 0, 0.04);
  padding: 3px 6px;
  border-radius: 4px;
  display: inline-block;
}

.param-required {
  display: inline-block;
  margin-left: 8px;
  background-color: #ffecb3;
  color: #e65100;
  font-size: 0.8em;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.tool-info-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: #666;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid rgba(124, 98, 194, 0.1);
  border-top-color: #7C62C2;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tool-info-error {
  color: #d32f2f;
  padding: 12px 16px;
  border-left: 3px solid #d32f2f;
  background-color: #ffebee;
  border-radius: 6px;
  font-size: 0.95em;
}

/* Transition Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.zoom-enter-active,
.zoom-leave-active {
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
              opacity 0.3s ease;
}

.zoom-enter-from,
.zoom-leave-to {
  transform: scale(0.95);
  opacity: 0;
}
</style> 