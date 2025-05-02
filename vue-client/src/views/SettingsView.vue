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
            <label v-for="provider in providerConfigs.providers" :key="provider">
              <input type="radio" v-model="selectedProvider" :value="provider">
              {{ providerConfigs.configs[provider].name }}
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h3>API密钥配置</h3>
          
          <div v-for="provider in providerConfigs.providers as Provider[]" :key="provider" 
               class="api-key-section" v-show="selectedProvider === provider">
            <label :for="`${provider}-api-key`">{{ providerConfigs.configs[provider].name }} API密钥</label>
            <div class="api-key-row">
              <input 
                type="text" 
                :id="`${provider}-api-key`"
                v-model="apiKeys[provider]" 
                :placeholder="`输入${providerConfigs.configs[provider].name} API密钥`" 
                class="api-key-input"
              >
              <button 
                v-if="provider === 'deepseek'"
                @click="checkDeepseekBalance" 
                class="balance-button"
                :disabled="!apiKeys.deepseek || isCheckingBalance"
              >
                {{ isCheckingBalance ? '查询中...' : '查询余额' }}
              </button>
            </div>

            <div v-if="provider === 'deepseek' && balanceInfo" class="balance-info">
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
            
            <div v-if="provider === 'deepseek' && balanceError" class="balance-error">
              余额查询失败: {{ balanceError }}
            </div>

            <label :for="`${provider}-base-url`">{{ providerConfigs.configs[provider].name }} 基础URL（可选）</label>
            <input 
              type="text" 
              :id="`${provider}-base-url`"
              v-model="baseUrls[provider]"
              :placeholder="`默认: ${providerConfigs.configs[provider].defaultUrl}`"
            >
            
            <label :for="`${provider}-model`">{{ providerConfigs.configs[provider].name }} 模型</label>
            <select 
              :id="`${provider}-model`"
              v-model="selectedModels[provider]" 
              class="model-select"
            >
              <option v-for="model in (providerConfigs.configs[provider] && providerConfigs.configs[provider].models ? providerConfigs.configs[provider].models : [])" 
                      :key="model" 
                      :value="model">
                {{ model }}
              </option>
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
import { tips } from '../utils/tips'
import { Provider } from '../types'
import type { ProvidersResponse } from '../api/provider'

// 定义组件名称
defineOptions({
  name: 'SettingsView'
})

const settingsStore = useSettingsStore()

// 状态
const selectedProvider = ref<Provider>(settingsStore.currentProvider)

// 从 settingsStore 获取 provider 配置
const providerConfigs = computed(() => settingsStore.providerConfigs as ProvidersResponse)

// 使用 Record 类型来确保类型安全
const apiKeys = ref<Record<Provider, string>>({} as Record<Provider, string>)
const baseUrls = ref<Record<Provider, string>>({} as Record<Provider, string>)
const selectedModels = ref<Record<Provider, string>>({} as Record<Provider, string>)
const showDebugConfig = ref(false)

// DeepSeek余额查询相关状态
const balanceInfo = ref<DeepSeekBalanceResponse | null>(null)
const balanceError = ref<string | null>(null)
const isCheckingBalance = ref(false)

// 查询DeepSeek账户余额
const checkDeepseekBalance = async () => {
  if (!apiKeys.value.deepseek) {
    balanceError.value = '请先输入API密钥'
    return
  }
  
  try {
    balanceError.value = null
    isCheckingBalance.value = true
    balanceInfo.value = await getDeepSeekBalance(apiKeys.value.deepseek)
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
watch(selectedProvider, async (newValue) => {
  await settingsStore.setProvider(newValue)
})

// 监听模型选择变化，并立即保存
watch(selectedModels, (newValue) => {
  Object.entries(newValue).forEach(([provider, model]) => {
    if (model) {
      settingsStore.setModel(provider as Provider, model)
    }
  })
}, { deep: true })

// 配置调试信息
const configDebug = computed(() => JSON.stringify({
  selectedProvider: selectedProvider.value,
  providers: Object.fromEntries(
    Object.entries(apiKeys.value).map(([provider, apiKey]) => [
      provider,
      {
        apiKey,
        baseURL: baseUrls.value[provider as Provider],
        model: selectedModels.value[provider as Provider]
      }
    ])
  )
}, null, 2))

// 加载当前配置
const loadSettings = async () => {
  try {
    // 加载已保存的设置
    await settingsStore.loadSettings()
    
    selectedProvider.value = settingsStore.currentProvider
    
    // 初始化每个provider的配置
    providerConfigs.value.providers.forEach((provider: Provider) => {
      const config = settingsStore.providers[provider]
      if (config) {
        apiKeys.value[provider] = config.apiKey || ''
        baseUrls.value[provider] = config.baseURL || ''
        selectedModels.value[provider] = config.model || ''
      }
    })
    
    // 如果已经配置了DeepSeek API密钥，自动查询余额
    if (apiKeys.value.deepseek && selectedProvider.value === 'deepseek') {
      checkDeepseekBalance()
    }
    
    console.log('设置已加载')
  } catch (error) {
    console.error('加载设置失败:', error)
    tips.error('加载设置失败')
  }
}

// 保存设置到store
const saveSettings = async () => {
  try {
    // 保存提供商设置
    await settingsStore.setProvider(selectedProvider.value)
    
    // 保存每个provider的配置
    for (const provider of providerConfigs.value.providers) {
      await settingsStore.setApiKey(provider, apiKeys.value[provider])
      settingsStore.setBaseURL(provider, baseUrls.value[provider])
      await settingsStore.setModel(provider, selectedModels.value[provider])
    }
    
    // 保存所有设置
    await settingsStore.saveSettings()
    
    // 显示保存成功提示
    tips.success('设置已保存')
  } catch (error) {
    console.error('保存设置失败:', error)
    tips.error('保存设置失败')
  }
}

// 切换调试配置显示
const toggleDebugConfig = () => {
  showDebugConfig.value = !showDebugConfig.value
}

// 组件挂载时加载设置
onMounted(loadSettings)

// 组件激活时刷新设置
onActivated(loadSettings)

// 组件销毁时保存设置
onDeactivated(() => {
  settingsStore.saveSettings()
})
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
  font-size: 11px;
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
  font-size: 15px;
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
  font-size: 13px;
  color: #555;
}

.api-key-section input, .api-key-section select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
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
  font-size: 11px;
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
  font-size: 13px;
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
  font-size: 13px;
}

.info-note {
  margin: 10px 0;
  padding: 10px;
  background-color: #e8f4fd;
  border-radius: 4px;
  border-left: 3px solid #1a73e8;
  color: #0d47a1;
  font-size: 13px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.info-icon {
  font-style: normal;
  color: #1a73e8;
}

.primary-button {
  background-color: #1a73e8;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 4px;
  font-size: 13px;
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

input, textarea {
  user-select: auto !important;
  -webkit-user-select: auto !important;
  -moz-user-select: auto !important;
  -ms-user-select: auto !important;
}
</style> 