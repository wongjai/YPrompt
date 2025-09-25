<template>
  <div class="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex flex-col overflow-hidden">
    <!-- 設置按鈕 -->
    <SettingsModal />

    <div class="w-full flex flex-col flex-1 overflow-hidden">
      <!-- Header - 恢復美觀的頭部 -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="min-w-0">
            <h1 class="text-xl lg:text-2xl font-bold text-gray-800 mb-1">智能提示詞創建</h1>
            <p class="text-sm lg:text-base text-gray-600">AI引導式對話，幫您構建完美的提示詞</p>
          </div>
          
          <!-- 模型選擇器 -->
          <div class="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
            <label class="text-sm font-medium text-gray-700 whitespace-nowrap">AI模型:</label>
            <select
              v-model="settingsStore.selectedProvider"
              @change="onProviderChange"
              class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 min-w-0 flex-1 sm:flex-none"
            >
              <option value="">選擇提供商</option>
              <option
                v-for="provider in availableProviders"
                :key="provider.id"
                :value="provider.id"
              >
                {{ provider.name }}
              </option>
            </select>
            
            <select
              v-model="settingsStore.selectedModel"
              @change="settingsStore.saveSettings"
              :disabled="!settingsStore.selectedProvider"
              class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50 min-w-0 flex-1 sm:flex-none"
            >
              <option value="">選擇模型</option>
              <option
                v-for="model in availableModels"
                :key="model.id"
                :value="model.id"
              >
                {{ model.name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- 主內容區域 - 支持移動端摺疊，同時保持PC模式滾動修復 -->
      <div v-if="!isMobile" class="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
        <!-- PC端 - Left Panel -->
        <div class="flex flex-col">
          <ChatInterface />
        </div>
        <!-- PC端 - Right Panel -->
        <div class="flex flex-col">
          <PreviewPanel />
        </div>
      </div>

      <!-- 移動端佈局 -->
      <div v-else class="flex flex-col flex-1 min-h-0 overflow-hidden">
        <!-- AI助手對話摺疊標題欄 - 固定在頂部 -->
        <div 
          v-if="!chatExpanded"
          @click="toggleChat"
          class="bg-white rounded-lg shadow-sm p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors flex-shrink-0 mb-2"
        >
          <h3 class="font-semibold text-gray-800">AI助手對話</h3>
          <ChevronDown class="w-5 h-5 text-gray-500" />
        </div>

        <!-- AI助手對話模塊 -->
        <div v-if="chatExpanded" class="flex flex-col flex-1 min-h-0 mb-2">
          <ChatInterface 
            :is-mobile="isMobile"
            :is-expanded="chatExpanded"
            @toggle="toggleChat"
          />
        </div>

        <!-- 提示詞預覽模塊 -->
        <div v-if="previewExpanded" class="flex flex-col flex-1 min-h-0 mb-2">
          <PreviewPanel 
            :is-mobile="isMobile"
            :is-expanded="previewExpanded"
            @toggle="togglePreview"
          />
        </div>

        <!-- 提示詞預覽摺疊標題欄 - 固定在底部 -->
        <div 
          v-if="!previewExpanded"
          @click="togglePreview"
          class="bg-white rounded-lg shadow-sm p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <h3 class="font-semibold text-gray-800">提示詞預覽</h3>
          <ChevronDown class="w-5 h-5 text-gray-500" />
        </div>
      </div>
    </div>
    
    <!-- 通知容器 -->
    <NotificationContainer />
  </div>
</template>

<script setup lang="ts">
import ChatInterface from '@/components/ChatInterface.vue'
import PreviewPanel from '@/components/PreviewPanel.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import NotificationContainer from '@/components/NotificationContainer.vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePromptStore } from '@/stores/promptStore'
import { onMounted, computed, ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const settingsStore = useSettingsStore()
const promptStore = usePromptStore()

// 移動端摺疊狀態管理
const isMobile = ref(false)
const chatExpanded = ref(true)  // 默認展開對話
const previewExpanded = ref(false)  // 默認摺疊預覽

const connectionStatus = ref<'disconnected' | 'connected' | 'error'>('disconnected')

// 可用的提供商
const availableProviders = computed(() => {
  return settingsStore.getAvailableProviders()
})

// 當前提供商的可用模型
const availableModels = computed(() => {
  if (!settingsStore.selectedProvider) return []
  return settingsStore.getAvailableModels(settingsStore.selectedProvider)
})

// 提供商改變時重置模型選擇
const onProviderChange = () => {
  settingsStore.selectedModel = ''
  const models = availableModels.value
  if (models.length > 0) {
    settingsStore.selectedModel = models[0].id
  }
  settingsStore.saveSettings()
  checkConnection()
}

// 檢查連接狀態 - 僅檢查配置完整性，不發送實際API請求
const checkConnection = () => {
  const provider = settingsStore.getCurrentProvider()
  const model = settingsStore.getCurrentModel()
  
  if (!provider || !model || !provider.apiKey) {
    connectionStatus.value = 'disconnected'
    return
  }

  // 如果配置完整，標記爲已連接，實際連接狀態在使用時驗證
  connectionStatus.value = 'connected'
}

// 監聽模型選擇變化
watch(() => [settingsStore.selectedProvider, settingsStore.selectedModel], checkConnection)

// 檢測移動端設備
const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024 // lg斷點
}

// 切換對話模塊
const toggleChat = () => {
  if (isMobile.value) {
    if (chatExpanded.value) {
      // 如果當前展開，摺疊它並展開預覽
      chatExpanded.value = false
      previewExpanded.value = true
    } else {
      // 如果當前摺疊，展開它並摺疊預覽
      chatExpanded.value = true
      previewExpanded.value = false
    }
  }
}

// 切換預覽模塊
const togglePreview = () => {
  if (isMobile.value) {
    if (previewExpanded.value) {
      // 如果當前展開，摺疊它並展開對話
      previewExpanded.value = false
      chatExpanded.value = true
    } else {
      // 如果當前摺疊，展開它並摺疊對話
      previewExpanded.value = true
      chatExpanded.value = false
    }
  }
}

// 監聽生成狀態，自動切換模塊
watch(() => promptStore.isGenerating, (isGenerating) => {
  if (isMobile.value && isGenerating) {
    // 開始生成時切換到預覽模塊
    chatExpanded.value = false
    previewExpanded.value = true
  }
})

// 監聽需求報告生成，自動切換
watch(() => promptStore.promptData.requirementReport, (report) => {
  if (isMobile.value && report && report.trim().length > 0) {
    // 生成報告後切換到預覽模塊
    chatExpanded.value = false
    previewExpanded.value = true
  }
})

// 初始化
onMounted(() => {
  settingsStore.loadSettings()
  
  // 如果沒有配置，顯示設置界面
  const hasConfiguredProvider = availableProviders.value.length > 0
  if (!hasConfiguredProvider) {
    setTimeout(() => {
      settingsStore.showSettings = true
    }, 1000)
  } else {
    checkConnection()
  }

  // 檢查移動端
  checkMobile()
  window.addEventListener('resize', checkMobile)

  // 對話初始化交給ChatInterface組件處理
})
</script>