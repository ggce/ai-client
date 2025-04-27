/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 声明导入Vue文件的模块类型，支持直接引用
declare module '*/components/messages/*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*/utils/markdown' {
  export function createMarkdownRenderer(): any;
  export function setupLinkify(md: any): void;
  export function setupExternalLinks(md: any): void;
  export interface LinkMatch {
    url: string;
    text: string;
    index: number;
    lastIndex: number;
    raw: string;
    schema?: string | undefined;
  }
}