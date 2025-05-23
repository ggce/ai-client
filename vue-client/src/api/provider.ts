import { Provider } from '../../src/types'

// Provider 配置接口
export interface ProviderConfig {
  name: string
  defaultUrl: string
  defaultModel: string
  models: readonly string[]
}

export interface ProvidersResponse {
  providers: Provider[]
  configs: Record<Provider, ProviderConfig>
}

// 获取所有可用的 provider 配置
export async function getProviderConfigs(): Promise<ProvidersResponse> {
  try {
    const response = await fetch('/api/providers/configs')
    if (!response.ok) {
      throw new Error('获取 provider 配置失败')
    }
    return await response.json()
  } catch (error) {
    console.error('获取 provider 配置失败:', error)
    throw error
  }
} 