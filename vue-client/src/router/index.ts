import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '@/views/ChatView.vue'
import SettingsView from '@/views/SettingsView.vue'
import ToolsView from '@/views/ToolsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatView,
      meta: {
        keepAlive: true
      }
    },
    {
      path: '/tools',
      name: 'tools',
      component: ToolsView,
      meta: {
        keepAlive: true
      }
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      meta: {
        keepAlive: true
      }
    }
  ]
})

export default router 