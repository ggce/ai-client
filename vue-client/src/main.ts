import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import './assets/main.css'
import './assets/styles/message.css'
import './assets/styles/tool-message.css'
import './assets/styles/reasoning.css'
import './assets/styles/tool-prompt.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app') 