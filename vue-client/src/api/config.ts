import axios from 'axios'
import { Provider, SettingsState, DeepSeekBalanceResponse } from '../types'
import { getProviderConfigs } from './provider'

export type { DeepSeekBalanceResponse }

// 加载配置
export const loadConfig = async (): Promise<SettingsState | null> => {
  try {
    const response = await axios.get('/api/config')
    console.log('从Electron加载配置:', response.data)
    
    // 确保返回的数据有正确的结构和类型
    if (response.data && typeof response.data === 'object') {
      const config = response.data
      
      // 获取provider配置
      const providersData = await getProviderConfigs()
      
      // 创建一个完整的配置结构
      const completeConfig: SettingsState = {
        providers: {},
        currentProvider: 'deepseek',
        isSidebarCollapsed: false
      }
      
      // 初始化所有provider的默认配置
      providersData.providers.forEach((provider: Provider) => {
        completeConfig.providers[provider] = {
          apiKey: '',
          baseURL: '',
          model: (providersData.configs as any)[provider]?.defaultModel || '',
        }
      })
      
      // 合并返回的数据和默认值
      if (config.providers) {
        completeConfig.providers = {
          ...completeConfig.providers,
          ...config.providers
        }
      }
      
      // 验证 currentProvider 是否在支持的提供商列表中
      if (config.currentProvider && providersData.providers.includes(config.currentProvider)) {
        completeConfig.currentProvider = config.currentProvider as Provider
      }
      
      if (typeof config.isSidebarCollapsed === 'boolean') {
        completeConfig.isSidebarCollapsed = config.isSidebarCollapsed
      }

      console.log('加载配置:', completeConfig)
      
      return completeConfig
    }
    return null
  } catch (error) {
    console.error('加载配置失败:', error)
    return null
  }
}

// 保存配置
export const saveConfig = async (config: SettingsState): Promise<boolean> => {
  try {
    console.log('保存配置到Electron:', config)
    const response = await axios.post('/api/config', config)
    return response.data.success === true
  } catch (error) {
    console.error('保存配置失败:', error)
    return false
  }
}

// 单独保存API key
export const saveApiKey = async (provider: Provider, apiKey: string): Promise<boolean> => {
  try {
    // 先获取当前配置
    const currentConfig = await loadConfig()
    if (!currentConfig) return false
    
    // 更新API key
    if (!currentConfig.providers[provider]) {
      // 获取provider默认配置
      const providersData = await getProviderConfigs()
      
      currentConfig.providers[provider] = {
        apiKey: '',
        baseURL: '',
        model: (providersData.configs as any)[provider]?.defaultModel || ''
      }
    }
    
    currentConfig.providers[provider].apiKey = apiKey
    
    // 保存更新后的配置
    return await saveConfig(currentConfig)
  } catch (error) {
    console.error('保存API Key失败:', error)
    return false
  }
}

// 单独保存模型
export const saveModel = async (provider: Provider, model: string): Promise<boolean> => {
  try {
    // 先获取当前配置
    const currentConfig = await loadConfig()
    if (!currentConfig) return false
    
    // 更新模型
    if (!currentConfig.providers[provider]) {
      // 获取provider默认配置
      const providersData = await getProviderConfigs()
      
      currentConfig.providers[provider] = {
        apiKey: '',
        baseURL: '',
        model: model || (providersData.configs as any)[provider]?.defaultModel || ''
      }
    } else {
      currentConfig.providers[provider].model = model
    }
    
    // 保存更新后的配置
    return await saveConfig(currentConfig)
  } catch (error) {
    console.error('保存模型失败:', error)
    return false
  }
}

// 查询DeepSeek账户余额
export const getDeepSeekBalance = async (apiKey: string): Promise<DeepSeekBalanceResponse> => {
  try {
    const response = await axios.get(`/api/deepseek/balance?apiKey=${encodeURIComponent(apiKey)}`);
    return response.data;
  } catch (error) {
    console.error('获取DeepSeek余额失败:', error);
    throw error;
  }
}

// 获取默认模型
export const getDefaultModel = async (provider: Provider): Promise<string> => {
  try {
    const providersData = await getProviderConfigs()
    return (providersData.configs as any)[provider]?.defaultModel || 'deepseek-chat'
  } catch (error) {
    console.error('获取默认模型失败:', error)
    return 'deepseek-chat' // 作为最后的后备选项
  }
}