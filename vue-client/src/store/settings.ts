import { defineStore } from 'pinia'
import { loadConfig, saveConfig, saveApiKey, saveModel } from '../api/config'
import router from '../router'

type Provider = 'deepseek' | 'openai'

interface ProviderConfig {
  apiKey: string
  baseURL: string
  model: string
}

interface SettingsState {
  providers: {
    [key: string]: ProviderConfig
  }
  currentProvider: Provider
  isSidebarCollapsed: boolean
  isSessionSidebarCollapsed?: boolean
}

export const useSettingsStore = defineStore('settings', {
  state: () => {
    const initialState: SettingsState = {
      providers: {
        deepseek: {
          apiKey: '',
          baseURL: '',
          model: 'deepseek-chat'
        },
        openai: {
          apiKey: '',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-4.1'
        }
      },
      currentProvider: 'deepseek',
      isSidebarCollapsed: false
    }
    
    // 扩展状态对象，添加会话侧边栏设置
    return {
      ...initialState,
      isSessionSidebarCollapsed: false
    } as SettingsState & { isSessionSidebarCollapsed: boolean }
  },
  
  getters: {
    // 提供一个获取会话侧边栏状态的getter
    sessionSidebarCollapsed: (state) => (state as any).isSessionSidebarCollapsed as boolean
  },
  
  actions: {
    async setProvider(provider: Provider) {
      // 记录之前的提供商
      const previousProvider = this.currentProvider
      // 设置新的提供商
      this.currentProvider = provider
      
      // 保存设置
      this.saveSettings()
      
      // 返回提供商是否改变
      return previousProvider !== provider
    },
    
    async setApiKey(provider: Provider, apiKey: string) {
      if (this.providers[provider]) {
        this.providers[provider].apiKey = apiKey
        const success = await saveApiKey(provider, apiKey)
        console.log(`保存${provider} API密钥 ${success ? '成功' : '失败'}`)
      }
    },
    
    setBaseURL(provider: Provider, baseURL: string) {
      if (this.providers[provider]) {
        this.providers[provider].baseURL = baseURL
      }
    },
    
    async setModel(provider: Provider, model: string) {
      if (this.providers[provider]) {
        this.providers[provider].model = model
        const success = await saveModel(provider, model)
        console.log(`保存${provider}模型${success ? '成功' : '失败'}`)
      }
    },
    
    toggleSidebar() {
      this.isSidebarCollapsed = !this.isSidebarCollapsed
      console.log('主侧边栏状态已切换为:', this.isSidebarCollapsed ? '收起' : '展开')
      this.saveSettings()
    },
    
    toggleSessionSidebar() {
      (this as any).isSessionSidebarCollapsed = !(this as any).isSessionSidebarCollapsed
      console.log('会话侧边栏状态已切换为:', (this as any).isSessionSidebarCollapsed ? '收起' : '展开')
      this.saveSettings()
    },
    
    async saveSettings() {
      const settingsToSave = {
        providers: this.providers,
        currentProvider: this.currentProvider,
        defaultProvider: this.currentProvider,
        isSidebarCollapsed: this.isSidebarCollapsed,
        isSessionSidebarCollapsed: (this as any).isSessionSidebarCollapsed
      }
      console.log('保存所有设置到Electron:', settingsToSave)
      
      const success = await saveConfig(settingsToSave)
      if (success) {
        console.log('所有设置保存成功')
      } else {
        console.error('设置保存失败')
      }
    },
    
    async loadSettings() {
      console.log('从Electron加载设置')
      const config = await loadConfig()
      
      if (config) {
        console.log('设置加载成功:', config)
        if (config.providers && Object.keys(config.providers).length > 0) {
          for (const provider in config.providers) {
            if (this.providers[provider]) {
              this.providers[provider] = {
                ...this.providers[provider],
                ...config.providers[provider]
              }
            }
          }
          
          if (config.currentProvider && 
             (config.currentProvider === 'deepseek' || config.currentProvider === 'openai')) {
            this.currentProvider = config.currentProvider
          }
        }
        
        if (typeof config.isSidebarCollapsed === 'boolean') {
          this.isSidebarCollapsed = config.isSidebarCollapsed
        }
        
        if (typeof (config as any).isSessionSidebarCollapsed === 'boolean') {
          (this as any).isSessionSidebarCollapsed = (config as any).isSessionSidebarCollapsed
        }
        
        console.log('设置已应用，当前状态:', {
          providers: this.providers,
          currentProvider: this.currentProvider,
          isSidebarCollapsed: this.isSidebarCollapsed ? '收起' : '展开',
          isSessionSidebarCollapsed: (this as any).isSessionSidebarCollapsed ? '收起' : '展开'
        })
      } else {
        console.log('未找到已保存的设置，使用默认值')
      }
    }
  }
}) 