import { defineStore } from 'pinia'

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
        baseUrl: '',
        model: 'gpt-3.5-turbo'
      }
    },
    currentProvider: 'deepseek',
    isSidebarCollapsed: true
  }),
  
  actions: {
    setProvider(provider: Provider) {
      this.currentProvider = provider
    },
    
    setApiKey(provider: Provider, apiKey: string) {
      if (this.providers[provider]) {
        this.providers[provider].apiKey = apiKey
      }
    },
    
    setBaseUrl(provider: Provider, baseUrl: string) {
      if (this.providers[provider]) {
        this.providers[provider].baseUrl = baseUrl
      }
    },
    
    setModel(provider: Provider, model: string) {
      if (this.providers[provider]) {
        this.providers[provider].model = model
      }
    },
    
    toggleSidebar() {
      this.isSidebarCollapsed = !this.isSidebarCollapsed
    },
    
    saveSettings() {
      localStorage.setItem('ai-chat-settings', JSON.stringify({
        providers: this.providers,
        currentProvider: this.currentProvider,
        isSidebarCollapsed: this.isSidebarCollapsed
      }))
    },
    
    loadSettings() {
      const settings = localStorage.getItem('ai-chat-settings')
      if (settings) {
        try {
          const parsed = JSON.parse(settings)
          this.$patch(parsed)
        } catch (error) {
          console.error('Failed to parse settings:', error)
        }
      }
    }
  }
}) 