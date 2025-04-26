import { TipsExpose } from './types'

/**
 * 全局窗口对象扩展
 */
declare global {
  interface Window {
    /**
     * 全局Tips组件实例
     * 用于在tips工具中访问
     */
    __GLOBAL_TIPS_INSTANCE__: TipsExpose | null;
  }
} 