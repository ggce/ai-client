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
            <div class="api-key-row">
              <input 
                type="text" 
                id="deepseek-api-key"
                v-model="deepseekApiKey" 
                placeholder="输入Deepseek API密钥" 
                class="api-key-input"
              >
              <button 
                @click="checkDeepseekBalance" 
                class="balance-button"
                :disabled="!deepseekApiKey || isCheckingBalance"
              >
                {{ isCheckingBalance ? '查询中...' : '查询余额' }}
              </button>
            </div>

            <div v-if="balanceInfo" class="balance-info">
              <div class="balance-status" :class="{ 'balance-available': balanceInfo.is_available }">
                状态: {{ balanceInfo.is_available ? '可用' : '余额不足' }}
              </div>
              <div v-for="(balance, index) in balanceInfo.balance_infos" :key="index" class="balance-detail">
                <div>货币: {{ balance.currency }}</div>
                <div>总余额: {{ balance.total_balance }}</div>
                <div>赠金余额: {{ balance.granted_balance }}</div>
                <div>充值余额: {{ balance.topped_up_balance }}</div>
              </div>
            </div>
            
            <div v-if="balanceError" class="balance-error">
              余额查询失败: {{ balanceError }}
            </div>

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
              placeholder="默认: https://api.openai.com/v1"
            >
            <label for="openai-model">OpenAI 模型</label>
            <select 
              id="openai-model"
              v-model="openaiModel" 
              class="model-select"
            >
              <option value="gpt-4.1">GPT-4.1</option>
              <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
              <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
              <option value="o3-mini">O3 Mini</option>
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
import { ref, computed, onMounted, onActivated, onDeactivated, watch } from 'vue'
import { useSettingsStore } from '../store/settings'
import { getDeepSeekBalance, DeepSeekBalanceResponse } from '../api/config'

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
const openaiModel = ref('gpt-4.1')
const showDebugConfig = ref(false)

// DeepSeek余额查询相关状态
const balanceInfo = ref<DeepSeekBalanceResponse | null>(null)
const balanceError = ref<string | null>(null)
const isCheckingBalance = ref(false)

// 查询DeepSeek账户余额
const checkDeepseekBalance = async () => {
  if (!deepseekApiKey.value) {
    balanceError.value = '请先输入API密钥'
    return
  }
  
  try {
    balanceError.value = null
    isCheckingBalance.value = true
    balanceInfo.value = await getDeepSeekBalance(deepseekApiKey.value)
    console.log('DeepSeek余额信息:', balanceInfo.value)
  } catch (error) {
    balanceInfo.value = null
    balanceError.value = error instanceof Error ? error.message : '查询失败，请检查API密钥'
    console.error('查询DeepSeek余额失败:', error)
  } finally {
    isCheckingBalance.value = false
  }
}

// 监听当前选择的模型提供商变化，并立即保存
watch(selectedProvider, (newValue) => {
  settingsStore.setProvider(newValue)
})

// 监听模型选择变化，并立即保存
watch(deepseekModel, (newValue) => {
  if (newValue) {
    settingsStore.setModel('deepseek', newValue)
  }
})

watch(openaiModel, (newValue) => {
  if (newValue) {
    settingsStore.setModel('openai', newValue)
  }
})

// 配置调试信息
const configDebug = computed(() => JSON.stringify({
  selectedProvider: selectedProvider.value,
  providers: {
    deepseek: {
      apiKey: deepseekApiKey.value,
      baseURL: deepseekBaseUrl.value,
      model: deepseekModel.value
    },
    openai: {
      apiKey: openaiApiKey.value,
      baseURL: openaiBaseUrl.value,
      model: openaiModel.value
    }
  }
}, null, 2))

// 加载当前配置
const loadSettings = async () => {
  await settingsStore.loadSettings()
  
  selectedProvider.value = settingsStore.currentProvider as 'deepseek' | 'openai'
  
  const deepseekConfig = settingsStore.providers.deepseek
  if (deepseekConfig) {
    deepseekApiKey.value = deepseekConfig.apiKey || ''
    deepseekBaseUrl.value = deepseekConfig.baseURL || ''
    deepseekModel.value = deepseekConfig.model || 'deepseek-chat'
  }
  
  const openaiConfig = settingsStore.providers.openai
  if (openaiConfig) {
    openaiApiKey.value = openaiConfig.apiKey || ''
    openaiBaseUrl.value = openaiConfig.baseURL || ''
    openaiModel.value = openaiConfig.model || 'gpt-4.1'
  }

  console.log('设置已加载：', {
    provider: selectedProvider.value,
    deepseek: {
      apiKey: deepseekApiKey.value ? '******' : '',
      model: deepseekModel.value
    },
    openai: {
      apiKey: openaiApiKey.value ? '******' : '',
      model: openaiModel.value
    }
  })
  
  // 如果已经配置了DeepSeek API密钥，自动查询余额
  if (deepseekApiKey.value && selectedProvider.value === 'deepseek') {
    checkDeepseekBalance()
  }
}

// 保存设置到store
const saveSettings = async () => {
  // 保存提供商设置
  await settingsStore.setProvider(selectedProvider.value)
  
  // 设置Deepseek配置
  await settingsStore.setApiKey('deepseek', deepseekApiKey.value)
  settingsStore.setBaseURL('deepseek', deepseekBaseUrl.value)
  await settingsStore.setModel('deepseek', deepseekModel.value)
  
  // 设置OpenAI配置
  await settingsStore.setApiKey('openai', openaiApiKey.value)
  settingsStore.setBaseURL('openai', openaiBaseUrl.value)
  await settingsStore.setModel('openai', openaiModel.value)
  
  // 保存全部设置确保同步
  await settingsStore.saveSettings()
  
  // 显示保存成功提示
  showToast('设置已保存')
}

// 页面生命周期钩子
onMounted(() => {
  loadSettings()
  console.log('SettingsView mounted')
})

// 激活时触发（keep-alive组件被显示时）
onActivated(() => {
  console.log('SettingsView activated')
  // 每次组件被激活时重新加载设置以确保同步
  loadSettings()
})

// 停用时触发（keep-alive组件被隐藏时）
onDeactivated(() => {
  console.log('SettingsView deactivated')
})

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
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.api-key-section input:focus, .api-key-section select:focus {
  border-color: #1a73e8;
}

.api-key-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.api-key-input {
  flex: 1;
  margin-bottom: 0 !important;
}

.balance-button {
  padding: 10px 15px;
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.balance-button:hover {
  background-color: #0d66d0;
}

.balance-button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

.balance-info {
  margin: 10px 0 15px;
  padding: 10px;
  background-color: #f0f7ff;
  border-radius: 4px;
  border-left: 3px solid #1a73e8;
  font-size: 14px;
}

.balance-status {
  font-weight: bold;
  margin-bottom: 8px;
  color: #d32f2f;
}

.balance-status.balance-available {
  color: #388e3c;
}

.balance-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 5px;
  padding: 5px;
  background-color: white;
  border-radius: 3px;
}

.balance-detail > div {
  flex: 1;
  min-width: 120px;
}

.balance-error {
  margin: 10px 0;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 4px;
  border-left: 3px solid #d32f2f;
  color: #d32f2f;
  font-size: 14px;
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