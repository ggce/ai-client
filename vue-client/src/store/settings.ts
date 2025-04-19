import { defineStore } from 'pinia'
import { loadConfig, saveConfig, saveApiKey, saveModel } from '../api/config'

type Provider = 'deepseek' | 'openai'

interface ProviderConfig {
  apiKey: string
  baseUrl: string
  model: string
}

interface SettingsState {
  providers: {
    [key: string]: ProviderConfig
  }
  currentProvider: Provider
  isSidebarCollapsed: boolean
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    providers: {
      deepseek: {
        apiKey: '',
        baseUrl: '',
        model: 'deepseek-chat'
      },
      openai: {
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1'
      }
    },
    currentProvider: 'deepseek',
    isSidebarCollapsed: false
  }),
  
  actions: {
    setProvider(provider: Provider) {
      this.currentProvider = provider
      this.saveSettings()
    },
    
    async setApiKey(provider: Provider, apiKey: string) {
      if (this.providers[provider]) {
        this.providers[provider].apiKey = apiKey
        const success = await saveApiKey(provider, apiKey)
        console.log(`保存${provider} API密钥 ${success ? '成功' : '失败'}`)
      }
    },
    
    setBaseUrl(provider: Provider, baseUrl: string) {
      if (this.providers[provider]) {
        this.providers[provider].baseUrl = baseUrl
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
      console.log('侧边栏状态已切换为:', this.isSidebarCollapsed ? '收起' : '展开')
      this.saveSettings()
    },
    
    async saveSettings() {
      const settingsToSave = {
        providers: this.providers,
        currentProvider: this.currentProvider,
        isSidebarCollapsed: this.isSidebarCollapsed
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
        
        console.log('设置已应用，当前状态:', {
          providers: this.providers,
          currentProvider: this.currentProvider,
          isSidebarCollapsed: this.isSidebarCollapsed ? '收起' : '展开'
        })
      } else {
        console.log('未找到已保存的设置，使用默认值')
      }
    }
  }
}) 