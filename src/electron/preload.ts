import { contextBridge, ipcRenderer } from 'electron';

// 安全地暴露一些API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 示例方法：从渲染进程向主进程发送请求
  sendMessage: (message: string) => ipcRenderer.invoke('chat:message', message),
  
  // 获取应用版本号
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  
  // 打开文件对话框
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  
  // 保存文件对话框
  saveFile: (content: string) => ipcRenderer.invoke('dialog:saveFile', content)
}); 