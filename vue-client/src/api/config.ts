import axios from 'axios'
import { Provider, ProviderConfig, SettingsState, DeepSeekBalanceInfo, DeepSeekBalanceResponse } from '../types'

// 加载配置
export const loadConfig = async (): Promise<SettingsState | null> => {
  try {
    const response = await axios.get('/api/config')
    console.log('从Electron加载配置:', response.data)
    
    // 确保返回的数据有正确的结构和类型
    if (response.data && typeof response.data === 'object') {
      const config = response.data
      
      // 创建一个完整的配置结构
      const completeConfig: SettingsState = {
        providers: {
          deepseek: {
            apiKey: '',
            baseURL: '',
            model: 'deepseek-chat'
          },
          openai: {
            apiKey: '',
            baseURL: '',
            model: 'gpt-4.1'
          }
        },
        currentProvider: 'deepseek',
        isSidebarCollapsed: false
      }
      
      // 合并返回的数据和默认值
      if (config.providers) {
        completeConfig.providers = {
          ...completeConfig.providers,
          ...config.providers
        }
      }
      
      if (config.currentProvider && 
         (config.currentProvider === 'deepseek' || config.currentProvider === 'openai' || config.currentProvider === 'gemini')) {
        completeConfig.currentProvider = config.currentProvider as Provider
      }
      
      if (typeof config.isSidebarCollapsed === 'boolean') {
        completeConfig.isSidebarCollapsed = config.isSidebarCollapsed
      }
      
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
      currentConfig.providers[provider] = {
        apiKey: '',
        baseURL: '',
        model: provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4.1'
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
      currentConfig.providers[provider] = {
        apiKey: '',
        baseURL: '',
        model: model
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
export function getDefaultModel(provider: string): string {
  const config = getConfig();
  return provider === 'deepseek' 
    ? (config?.deepseek?.model || 'deepseek-chat') 
    : (config?.openai?.model || 'gpt-4.1');
}