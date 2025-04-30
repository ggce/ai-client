import { contextBridge, ipcRenderer, shell } from 'electron';

// 安全地暴露一些API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 示例方法：从渲染进程向主进程发送请求
  sendMessage: (message: string) => ipcRenderer.invoke('chat:message', message),
  
  // 获取应用版本号
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  
  // 打开文件对话框
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  
  // 保存文件对话框
  saveFile: (content: string) => ipcRenderer.invoke('dialog:saveFile', content),
  
  // 打开外部链接
  openExternalLink: (url: string) => shell.openExternal(url),
  
  // 发送系统通知
  sendNotification: (options: any) => ipcRenderer.invoke('notification:send', options),
  
  // 切换开发者工具
  toggleDevTools: () => ipcRenderer.invoke('window:toggleDevTools')
});

// 暴露用于打开外部链接的API
contextBridge.exposeInMainWorld('electron', {
  openExternal: (url: string) => shell.openExternal(url)
}); 