<template>
  <div class="bg-white rounded-lg shadow-sm p-6">
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-2">系統提示詞生成器</h2>
      <p class="text-sm text-gray-600">按照GPrompt方式生成高質量AI系統提示詞</p>
    </div>

    <!-- 用戶輸入區域 -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          AI角色描述
        </label>
        <textarea
          v-model="description"
          placeholder="請描述您希望AI扮演的角色和主要任務..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows="4"
        ></textarea>
      </div>

      <!-- 語言選擇 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          輸出語言
        </label>
        <select 
          v-model="language" 
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="zh">中文</option>
          <option value="en">英文</option>
        </select>
      </div>

      <!-- 操作按鈕 -->
      <div class="flex space-x-3">
        <button
          @click="handleGetPoints"
          :disabled="isBusy || !description.trim()"
          class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="loadingStep === 1" class="flex items-center">
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            獲取關鍵指令...
          </span>
          <span v-else>獲取關鍵指令</span>
        </button>

        <button
          @click="handleAutomate"
          :disabled="isBusy || !description.trim()"
          class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="loadingStep === 0" class="flex items-center">
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            自動生成中...
          </span>
          <span v-else>自動生成提示詞</span>
        </button>

        <button
          @click="useConversationResult"
          :disabled="isBusy || !conversationReport"
          class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          使用對話結果
        </button>
      </div>

      <!-- 對話結果提示 -->
      <div v-if="conversationReport" class="bg-purple-50 border-l-4 border-purple-400 p-4">
        <p class="text-purple-700">📋 檢測到對話式需求收集結果，點擊"使用對話結果"可直接基於需求報告生成提示詞。</p>
      </div>

      <!-- 自動化進度顯示 -->
      <div v-if="automationStatus" class="bg-blue-50 border-l-4 border-blue-400 p-4">
        <p class="text-blue-700">{{ automationStatus }}</p>
      </div>

      <!-- 錯誤信息 -->
      <div v-if="error" class="bg-red-50 border-l-4 border-red-400 p-4">
        <p class="text-red-700">{{ error }}</p>
      </div>
    </div>

    <!-- 步驟1: 關鍵指令 -->
    <div v-if="completedSteps.includes(1)" class="mt-6">
      <div class="border rounded-lg">
        <div 
          @click="openStep = openStep === 1 ? 0 : 1"
          class="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 rounded-t-lg"
        >
          <div class="flex items-center">
            <div class="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm mr-3">
              ✓
            </div>
            <h3 class="font-medium text-gray-800">步驟1: 關鍵指令</h3>
          </div>
          <div class="text-gray-500">
            {{ openStep === 1 ? '−' : '+' }}
          </div>
        </div>
        
        <div v-if="openStep === 1" class="p-4 border-t">
          <div v-if="thinkingPoints" class="space-y-2">
            <div 
              v-for="(_, index) in thinkingPoints" 
              :key="index"
              class="flex items-start"
            >
              <span class="text-gray-500 mr-2">•</span>
              <input
                v-model="thinkingPoints[index]"
                class="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div class="mt-4 flex justify-between">
              <button
                @click="addThinkingPoint"
                class="px-3 py-1 text-blue-600 hover:text-blue-800 text-sm"
              >
                + 添加指令
              </button>
              
              <button
                @click="handleGenerateInitial"
                :disabled="loadingStep === 2"
                class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="loadingStep === 2" class="flex items-center">
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  生成初始提示詞...
                </span>
                <span v-else>生成初始提示詞</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 步驟2: 初始提示詞 -->
    <div v-if="completedSteps.includes(2)" class="mt-4">
      <div class="border rounded-lg">
        <div 
          @click="openStep = openStep === 2 ? 0 : 2"
          class="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 rounded-t-lg"
        >
          <div class="flex items-center">
            <div class="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm mr-3">
              ✓
            </div>
            <h3 class="font-medium text-gray-800">步驟2: 初始提示詞</h3>
          </div>
          <div class="text-gray-500">
            {{ openStep === 2 ? '−' : '+' }}
          </div>
        </div>
        
        <div v-if="openStep === 2" class="p-4 border-t">
          <div v-if="initialPrompt" class="space-y-4">
            <textarea
              v-model="initialPrompt"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="8"
            ></textarea>
            
            <div class="flex justify-between">
              <button
                @click="copyToClipboard(initialPrompt)"
                class="px-3 py-1 text-blue-600 hover:text-blue-800 text-sm"
              >
                {{ copiedInitial ? '已複製!' : '複製' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 步驟3: 優化建議 -->
    <div v-if="completedSteps.includes(3)" class="mt-4">
      <div class="border rounded-lg">
        <div 
          @click="openStep = openStep === 3 ? 0 : 3"
          class="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 rounded-t-lg"
        >
          <div class="flex items-center">
            <div class="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm mr-3">
              ✓
            </div>
            <h3 class="font-medium text-gray-800">步驟3: 優化建議</h3>
          </div>
          <div class="text-gray-500">
            {{ openStep === 3 ? '−' : '+' }}
          </div>
        </div>
        
        <div v-if="openStep === 3" class="p-4 border-t">
          <div v-if="advice" class="space-y-2">
            <div 
              v-for="(_, index) in advice" 
              :key="index"
              class="flex items-start"
            >
              <span class="text-gray-500 mr-2">•</span>
              <input
                v-model="advice[index]"
                class="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div class="mt-4 flex justify-between">
              <button
                @click="copyToClipboard(advice.join('\\n'))"
                class="px-3 py-1 text-blue-600 hover:text-blue-800 text-sm"
              >
                {{ copiedAdvice ? '已複製!' : '複製建議' }}
              </button>
              
              <button
                @click="handleApplyAdvice"
                :disabled="loadingStep === 4"
                class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="loadingStep === 4" class="flex items-center">
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  應用建議...
                </span>
                <span v-else>應用建議</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 步驟4: 最終提示詞 -->
    <div v-if="completedSteps.includes(4)" class="mt-4">
      <div class="border rounded-lg">
        <div 
          @click="openStep = openStep === 4 ? 0 : 4"
          class="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 rounded-t-lg"
        >
          <div class="flex items-center">
            <div class="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm mr-3">
              ✓
            </div>
            <h3 class="font-medium text-gray-800">步驟4: 最終提示詞</h3>
          </div>
          <div class="text-gray-500">
            {{ openStep === 4 ? '−' : '+' }}
          </div>
        </div>
        
        <div v-if="openStep === 4" class="p-4 border-t">
          <div v-if="finalPrompt" class="space-y-4">
            <textarea
              v-model="finalPrompt"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="12"
            ></textarea>
            
            <div class="flex justify-between">
              <button
                @click="copyToClipboard(finalPrompt)"
                class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                {{ copiedFinal ? '已複製!' : '複製最終提示詞' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePromptStore } from '@/stores/promptStore'
import { PromptGeneratorService } from '@/services/promptGeneratorService'

const settingsStore = useSettingsStore()
const promptStore = usePromptStore()
const promptGeneratorService = PromptGeneratorService.getInstance()

// 數據狀態
const description = ref('')
const language = ref('zh')
const thinkingPoints = ref<string[] | null>(null)
const initialPrompt = ref<string | null>(null)
const advice = ref<string[] | null>(null)
const finalPrompt = ref<string | null>(null)

// UI狀態
const loadingStep = ref<number | null>(null)
const automationStatus = ref<string | null>(null)
const error = ref<string | null>(null)
const completedSteps = ref<number[]>([])
const openStep = ref<number>(1)

// 複製狀態
const copiedInitial = ref(false)
const copiedAdvice = ref(false)
const copiedFinal = ref(false)

// 計算屬性
const isBusy = computed(() => loadingStep.value !== null)
const conversationReport = computed(() => promptStore.promptData.requirementReport)

// 重置狀態
const resetState = () => {
  thinkingPoints.value = null
  initialPrompt.value = null
  advice.value = null
  finalPrompt.value = null
  completedSteps.value = []
  error.value = null
  automationStatus.value = null
}


// 獲取關鍵指令
const handleGetPoints = async () => {
  if (!description.value.trim()) return
  
  try {
    loadingStep.value = 1
    resetState()
    openStep.value = 1
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      throw new Error('請先配置AI模型和API密鑰')
    }
    
    const points = await promptGeneratorService.getSystemPromptThinkingPoints(
      description.value,
      model.id,
      language.value,
      [],
      provider
    )
    
    thinkingPoints.value = points
    completedSteps.value = [1]
    openStep.value = 1
    
  } catch (err: any) {
    error.value = err.message || '獲取關鍵指令失敗'
  } finally {
    loadingStep.value = null
  }
}

// 自動生成
const handleAutomate = async () => {
  if (!description.value.trim()) return
  
  try {
    loadingStep.value = 0
    resetState()
    openStep.value = 1
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      throw new Error('請先配置AI模型和API密鑰')
    }
    
    // 步驟1: 生成關鍵指令
    automationStatus.value = '步驟 1/4: 生成關鍵指令...'
    const points = await promptGeneratorService.getSystemPromptThinkingPoints(
      description.value,
      model.id,
      language.value,
      [],
      provider
    )
    thinkingPoints.value = points
    completedSteps.value = [1]
    
    // 步驟2: 生成初始提示詞
    automationStatus.value = '步驟 2/4: 生成初始提示詞...'
    const initial = await promptGeneratorService.generateSystemPrompt(
      description.value,
      model.id,
      language.value,
      [],
      points,
      provider
    )
    initialPrompt.value = initial
    completedSteps.value = [1, 2]
    
    // 步驟3: 獲取優化建議
    automationStatus.value = '步驟 3/4: 獲取優化建議...'
    const adviceResult = await promptGeneratorService.getOptimizationAdvice(
      initial,
      'system',
      model.id,
      language.value,
      [],
      provider
    )
    advice.value = adviceResult
    completedSteps.value = [1, 2, 3]
    
    // 步驟4: 生成最終提示詞
    automationStatus.value = '步驟 4/4: 生成最終提示詞...'
    const final = await promptGeneratorService.applyOptimizationAdvice(
      initial,
      adviceResult,
      'system',
      model.id,
      language.value,
      [],
      provider
    )
    finalPrompt.value = final
    completedSteps.value = [1, 2, 3, 4]
    openStep.value = 4
    
    automationStatus.value = null
    
  } catch (err: any) {
    error.value = err.message || '自動生成失敗'
    automationStatus.value = null
  } finally {
    loadingStep.value = null
  }
}

// 生成初始提示詞
const handleGenerateInitial = async () => {
  if (!thinkingPoints.value) return
  
  try {
    loadingStep.value = 2
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    
    if (!provider || !model) {
      throw new Error('請先配置AI模型和API密鑰')
    }
    
    const initial = await promptGeneratorService.generateSystemPrompt(
      description.value,
      model.id,
      language.value,
      [],
      thinkingPoints.value,
      provider
    )
    
    initialPrompt.value = initial
    completedSteps.value = [...completedSteps.value, 2]
    
    // 自動獲取優化建議
    const adviceResult = await promptGeneratorService.getOptimizationAdvice(
      initial,
      'system',
      model.id,
      language.value,
      [],
      provider
    )
    advice.value = adviceResult
    completedSteps.value = [...completedSteps.value, 3]
    
    // 自動生成最終提示詞
    const final = await promptGeneratorService.applyOptimizationAdvice(
      initial,
      adviceResult,
      'system',
      model.id,
      language.value,
      [],
      provider
    )
    finalPrompt.value = final
    completedSteps.value = [...completedSteps.value, 4]
    
  } catch (err: any) {
    error.value = err.message || '生成初始提示詞失敗'
  } finally {
    loadingStep.value = null
  }
}

// 應用建議
const handleApplyAdvice = async () => {
  if (!initialPrompt.value || !advice.value) return
  
  try {
    loadingStep.value = 4
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      throw new Error('請先配置AI模型和API密鑰')
    }
    
    const final = await promptGeneratorService.applyOptimizationAdvice(
      initialPrompt.value,
      advice.value,
      'system',
      model.id,
      language.value,
      [],
      provider
    )
    
    finalPrompt.value = final
    if (!completedSteps.value.includes(4)) {
      completedSteps.value = [...completedSteps.value, 4]
    }
    openStep.value = 4
    
  } catch (err: any) {
    error.value = err.message || '應用建議失敗'
  } finally {
    loadingStep.value = null
  }
}

// 添加關鍵指令
const addThinkingPoint = () => {
  if (thinkingPoints.value) {
    thinkingPoints.value.push('')
  }
}

// 使用對話結果
const useConversationResult = () => {
  if (conversationReport.value) {
    description.value = conversationReport.value
  }
}

// 複製到剪貼板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    
    // 設置對應的複製狀態
    if (text === initialPrompt.value) {
      copiedInitial.value = true
      setTimeout(() => copiedInitial.value = false, 2000)
    } else if (text === finalPrompt.value) {
      copiedFinal.value = true
      setTimeout(() => copiedFinal.value = false, 2000)
    } else {
      copiedAdvice.value = true
      setTimeout(() => copiedAdvice.value = false, 2000)
    }
  } catch (err) {
  }
}
</script>