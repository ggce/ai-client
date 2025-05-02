import { defineStore } from 'pinia'
import { loadConfig, saveConfig, saveApiKey, saveModel } from '../api/config'
import { Provider, SettingsState } from '../types'

export const useSettingsStore = defineStore('settings', {
  state: () => {
    // 初始状态只包含必要的空结构
    const initialState: SettingsState = {
      providers: {},
      currentProvider: 'deepseek', // 这个默认值会在 loadSettings 时被更新
      isSidebarCollapsed: false
    }
    
    // 扩展状态对象，添加会话侧边栏设置和 providerConfigs
    return {
      ...initialState,
      isSessionSidebarCollapsed: false,
      providerConfigs: { providers: [], configs: {} } // 新增
    } as SettingsState & { isSessionSidebarCollapsed: boolean, providerConfigs: any }
  },
  
  getters: {
    sessionSidebarCollapsed: (state) => (state as any).isSessionSidebarCollapsed as boolean
  },
  
  actions: {
    async setProvider(provider: Provider) {
      // 记录之前的提供商
      const previousProvider = this.currentProvider
      // 设置新的提供商
      this.currentProvider = provider
      
      // 保存设置 - 使用await确保完成
      await this.saveSettings()
      
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
      
      try {
        // 加载配置（包含provider配置）
        const config = await loadConfig()
        // 新增：获取所有 provider 配置
        const providersResponse = await import('../api/provider')
        const providerConfigs = await providersResponse.getProviderConfigs()
        if (config) {
          console.log('设置加载成功:', config)
          // 更新状态
          this.providers = config.providers
          this.currentProvider = config.currentProvider
          this.isSidebarCollapsed = config.isSidebarCollapsed
          if (typeof (config as any).isSessionSidebarCollapsed === 'boolean') {
            (this as any).isSessionSidebarCollapsed = (config as any).isSessionSidebarCollapsed
          }
          // 新增：存储 providerConfigs
          this.providerConfigs = providerConfigs
          console.log('设置已应用，当前状态:', {
            providers: this.providers,
            currentProvider: this.currentProvider,
            isSidebarCollapsed: this.isSidebarCollapsed ? '收起' : '展开',
            isSessionSidebarCollapsed: (this as any).isSessionSidebarCollapsed ? '收起' : '展开',
            providerConfigs: this.providerConfigs
          })
        } else {
          console.log('未找到已保存的设置，使用默认值')
        }
      } catch (error) {
        console.error('加载设置失败:', error)
        throw error
      }
    }
  }
})