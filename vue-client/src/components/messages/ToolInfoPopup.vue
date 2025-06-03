<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="tool-info-overlay" @click="closeToolInfo">
        <Transition name="zoom">
          <div v-show="visible" class="tool-info-content" @click.stop>
            <div class="tool-info-header">
              <h3 v-if="toolInfo.serverName && toolInfo.methodName" class="tool-title">
                <span class="server-name">{{ toolInfo.serverName }}</span>
                <span class="method-separator">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 5L15 12L9 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
                <span class="method-name">{{ toolInfo.methodName }}</span>
              </h3>
              <h3 v-else>{{ toolInfo.name || 'Tool Information' }}</h3>
              <button class="close-btn" @click.stop="closeToolInfo">×</button>
            </div>
            <div class="tool-info-body">
              <div v-if="loading" class="tool-info-loading">
                <div class="loading-spinner"></div>
                <span>Loading tool information...</span>
              </div>
              <div v-else-if="error" class="tool-info-error">{{ error }}</div>
              <div v-else>
                <p class="tool-description">{{ toolInfo.description || 'No description available' }}</p>
                <div v-if="toolInfo.parameters && Object.keys(toolInfo.parameters).length">
                  <h4>Parameters:</h4>
                  <div class="tool-parameters">
                    <div v-for="(param, paramName) in toolInfo.parameters.properties" :key="paramName" class="tool-parameter">
                      <div class="param-name">{{ paramName }}</div>
                      <div class="param-description">{{ param.description || 'No description' }}</div>
                      <div class="param-type">Type: {{ param.type || 'unknown' }}</div>
                      <div v-if="toolInfo.parameters.required && toolInfo.parameters.required.includes(paramName)" class="param-required">Required</div>
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
</template>

<script setup lang="ts">
import { ref, defineEmits, defineProps, defineExpose } from 'vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible']);

// Tool info state
const toolInfo = ref<Record<string, any>>({});
const loading = ref(false);
const error = ref('');
const toolsData = ref<Record<string, any>>({});
const hasLoadedToolsData = ref(false);

// Close popup and emit event
const closeToolInfo = () => {
  emit('update:visible', false);
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

// Show tool info
const showTool = async (toolName: string) => {
  const serverKey = toolName.split('_STOM_')[0] || '';
  const actualToolName = toolName.split('_STOM_')[1] || toolName;
  
  // Format display name for popup title
  let displayName = toolName;
  let serverName = '';
  let methodName = '';
  
  if (toolName.includes('_STOM_')) {
    const parts = toolName.split('_STOM_');
    serverName = parts[0];
    methodName = parts[1];
    displayName = `[${parts[0]}] ${parts[1]}()方法`;
  } else {
    // Fallback for other naming patterns
    const lastUnderscoreIndex = toolName.lastIndexOf('_');
    if (lastUnderscoreIndex > 0) {
      serverName = toolName.substring(0, lastUnderscoreIndex);
      methodName = toolName.substring(lastUnderscoreIndex + 1);
      displayName = `${serverName}工具下的${methodName}方法`;
    }
  }
  
  loading.value = true;
  error.value = '';
  toolInfo.value = {
    name: displayName,
    serverName: serverName,
    methodName: methodName
  };
  
  // If we already have the tools data, use it
  if (hasLoadedToolsData.value) {
    const tool = findToolByName(serverKey, actualToolName);
    if (tool) {
      toolInfo.value = { 
        ...tool,
        name: displayName,
        serverName: serverName,
        methodName: methodName
      };
      loading.value = false;
    } else {
      error.value = 'Tool information not found';
      loading.value = false;
    }
  } else {
    // Fetch tools data from API only when needed
    try {
      await fetchToolsData();
      hasLoadedToolsData.value = true;
      const tool = findToolByName(serverKey, actualToolName);
      if (tool) {
        toolInfo.value = {
          ...tool,
          name: displayName,
          serverName: serverName,
          methodName: methodName
        };
      } else {
        error.value = 'Tool information not found';
      }
    } catch (err) {
      error.value = 'Failed to fetch tool information';
      console.error('Error fetching tool info:', err);
    } finally {
      loading.value = false;
    }
  }
  
  emit('update:visible', true);
};

// Expose methods and refs for parent component
defineExpose({
  showTool,
  toolInfo,
  loading,
  error
});
</script>

<style scoped>
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

.tool-title {
  display: flex;
  align-items: center;
  font-size: 1.25em;
  margin: 0;
}

.server-name {
  background-color: rgba(124, 98, 194, 0.12);
  color: #5D4DB3;
  padding: 3px 10px;
  border-radius: 6px;
  font-weight: 600;
  border-left: 3px solid #7C62C2;
}

.method-separator {
  display: flex;
  align-items: center;
  margin: 0 8px;
  color: #8888aa;
}

.method-name {
  background-color: rgba(76, 175, 80, 0.12);
  color: #2e7d32;
  padding: 3px 10px;
  border-radius: 6px;
  font-weight: 600;
  border-left: 3px solid #4CAF50;
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