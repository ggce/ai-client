<template>
  <div class="panel">
    <header class="compact-header">
      <h1>设置 <small>配置AI模型和API密钥</small></h1>
    </header>

    <main>
      <div class="settings-container">
        <div class="settings-section">
          <h3>选择AI模型</h3>
          <div class="radio-group">
            <label>
              <input type="radio" v-model="selectedProvider" value="deepseek">
              Deepseek
            </label>
            <label>
              <input type="radio" v-model="selectedProvider" value="openai">
              OpenAI
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h3>API密钥配置</h3>
          
          <div class="api-key-section" v-show="selectedProvider === 'deepseek'">
            <label for="deepseek-api-key">Deepseek API密钥</label>
            <input 
              type="text" 
              id="deepseek-api-key"
              v-model="deepseekApiKey" 
              placeholder="输入Deepseek API密钥" 
              class="api-key-input"
            >
            <label for="deepseek-base-url">Deepseek 基础URL（可选）</label>
            <input 
              type="text" 
              id="deepseek-base-url"
              v-model="deepseekBaseUrl"
              placeholder="默认: https://api.deepseek.com"
            >
            <label for="deepseek-model">Deepseek 模型</label>
            <select 
              id="deepseek-model"
              v-model="deepseekModel" 
              class="model-select"
            >
              <option value="deepseek-chat">DeepSeek V3</option>
              <option value="deepseek-reasoner">DeepSeek R1</option>
            </select>
          </div>

          <div class="api-key-section" v-show="selectedProvider === 'openai'">
            <label for="openai-api-key">OpenAI API密钥</label>
            <input 
              type="text" 
              id="openai-api-key"
              v-model="openaiApiKey" 
              placeholder="输入OpenAI API密钥" 
              class="api-key-input"
            >
            <label for="openai-base-url">OpenAI 基础URL（可选）</label>
            <input 
              type="text" 
              id="openai-base-url"
              v-model="openaiBaseUrl"
              placeholder="默认: https://api.openai.com"
            >
            <label for="openai-model">OpenAI 模型</label>
            <select 
              id="openai-model"
              v-model="openaiModel" 
              class="model-select"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </div>
        </div>

        <button 
          @click="saveSettings" 
          class="primary-button"
        >保存设置</button>
        
        <div class="settings-section">
          <h3>配置调试</h3>
          <button @click="toggleDebugConfig" class="secondary-button">显示当前配置</button>
          <pre v-if="showDebugConfig" class="config-debug">{{ configDebug }}</pre>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onActivated, onDeactivated } from 'vue'
import { useSettingsStore } from '../store/settings'

// 定义组件名称
defineOptions({
  name: 'SettingsView'
})

const settingsStore = useSettingsStore()

// 状态
const selectedProvider = ref<'deepseek' | 'openai'>('deepseek')
const deepseekApiKey = ref('')
const deepseekBaseUrl = ref('')
const deepseekModel = ref('deepseek-chat')
const openaiApiKey = ref('')
const openaiBaseUrl = ref('')
const openaiModel = ref('gpt-3.5-turbo')
const showDebugConfig = ref(false)

// 配置调试信息
const configDebug = computed(() => JSON.stringify({
  selectedProvider: selectedProvider.value,
  providers: {
    deepseek: {
      apiKey: maskApiKey(deepseekApiKey.value),
      baseUrl: deepseekBaseUrl.value,
      model: deepseekModel.value
    },
    openai: {
      apiKey: maskApiKey(openaiApiKey.value),
      baseUrl: openaiBaseUrl.value,
      model: openaiModel.value
    }
  }
}, null, 2))

// 加载当前配置
onMounted(() => {
  loadSettings()
  console.log('SettingsView mounted')
})

// 激活时触发（keep-alive组件被显示时）
onActivated(() => {
  console.log('SettingsView activated')
})

// 停用时触发（keep-alive组件被隐藏时）
onDeactivated(() => {
  console.log('SettingsView deactivated')
})

// 从store加载设置
const loadSettings = () => {
  settingsStore.loadSettings()
  
  selectedProvider.value = settingsStore.currentProvider as 'deepseek' | 'openai'
  
  const deepseekConfig = settingsStore.providers.deepseek
  if (deepseekConfig) {
    deepseekApiKey.value = deepseekConfig.apiKey || ''
    deepseekBaseUrl.value = deepseekConfig.baseUrl || ''
    deepseekModel.value = deepseekConfig.model || 'deepseek-chat'
  }
  
  const openaiConfig = settingsStore.providers.openai
  if (openaiConfig) {
    openaiApiKey.value = openaiConfig.apiKey || ''
    openaiBaseUrl.value = openaiConfig.baseUrl || ''
    openaiModel.value = openaiConfig.model || 'gpt-3.5-turbo'
  }
}

// 保存设置到store
const saveSettings = () => {
  // 设置当前提供商
  settingsStore.setProvider(selectedProvider.value)
  
  // 设置Deepseek配置
  settingsStore.setApiKey('deepseek', deepseekApiKey.value)
  settingsStore.setBaseUrl('deepseek', deepseekBaseUrl.value)
  settingsStore.setModel('deepseek', deepseekModel.value)
  
  // 设置OpenAI配置
  settingsStore.setApiKey('openai', openaiApiKey.value)
  settingsStore.setBaseUrl('openai', openaiBaseUrl.value)
  settingsStore.setModel('openai', openaiModel.value)
  
  // 保存到本地存储
  settingsStore.saveSettings()
  
  // 显示保存成功提示
  showToast('设置已保存')
}

// 切换显示调试配置
const toggleDebugConfig = () => {
  showDebugConfig.value = !showDebugConfig.value
}

// 显示消息提示
const showToast = (message: string) => {
  alert(message) // 简单实现，可以替换为更好的toast组件
}

// 遮蔽API密钥
const maskApiKey = (apiKey: string): string => {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '*'.repeat(apiKey.length)
  return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4)
}
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
}

.compact-header {
  margin-bottom: 10px;
  padding-bottom: 10px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.compact-header h1 {
  font-size: 18px;
  display: flex;
  align-items: center;
}

.compact-header h1 small {
  font-size: 12px;
  font-weight: normal;
  color: #777;
  margin-left: 8px;
}

.settings-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: #444;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.radio-group {
  display: flex;
  gap: 16px;
}

.radio-group label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.radio-group input[type="radio"] {
  margin-right: 8px;
}

.api-key-section {
  margin-top: 16px;
}

.api-key-section label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #555;
}

.api-key-section input, .api-key-section select {
  width: 100%;
  padding: 10px;
  margin-bottom: 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.api-key-section input:focus, .api-key-section select:focus {
  border-color: #1a73e8;
}

.primary-button {
  background-color: #1a73e8;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: block;
  width: 100%;
  margin-bottom: 24px;
}

.primary-button:hover {
  background-color: #1666d0;
}

.secondary-button {
  background-color: #f8f9fa;
  color: #444;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.secondary-button:hover {
  background-color: #f1f3f4;
}

.config-debug {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
}
</style> 