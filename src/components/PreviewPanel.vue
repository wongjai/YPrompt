<template>
  <div class="bg-white rounded-lg shadow-sm flex flex-col h-full">
    <div class="p-4 border-b border-gray-200 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <h2 class="font-semibold text-gray-800">提示詞預覽</h2>
        <!-- 生成狀態指示器 -->
        <div v-if="promptStore.currentExecutionStep || (promptStore.isGenerating && !promptStore.currentExecutionStep)" class="flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
          <RefreshCw class="w-3 h-3 animate-spin mr-1" />
          <span>{{ promptStore.currentExecutionStep ? getStepDisplayName(promptStore.currentExecutionStep) + '中' : '生成需求報告中' }}</span>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <!-- 移動端摺疊按鈕 -->
        <button
          v-if="isMobile && isExpanded"
          @click="$emit('toggle')"
          class="p-1 hover:bg-gray-100 rounded transition-colors"
          title="摺疊"
        >
          <ChevronUp class="w-5 h-5 text-gray-500" />
        </button>
        <!-- <span class="text-sm text-gray-600">執行模式:</span> -->
        <div class="flex items-center space-x-2">
          <label class="flex items-center cursor-pointer">
            <input
              v-model="promptStore.isAutoMode"
              type="checkbox"
              class="sr-only peer"
            />
            <span class="text-sm text-gray-600">{{ promptStore.isAutoMode ? '自動：' : '手動：' }}</span>
            <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <!-- <span class="ml-3 text-sm font-medium text-gray-700">{{ promptStore.isAutoMode ? '自動' : '手動' }}</span> -->
          </label>
        </div>
      </div>
    </div>

    <!-- Loading state - 只在沒有任何內容時顯示 -->
    <div v-if="promptStore.isGenerating && !hasAnyContent" class="p-6 text-center">
      <RefreshCw class="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
      <p class="text-gray-600">正在生成提示詞...</p>
    </div>

    <!-- Preview content - 有內容就顯示，即使還在生成中 -->
    <div v-if="hasAnyContent" class="flex-1 flex flex-col overflow-hidden p-4">
      <!-- Language Tabs -->
      <div ref="tabContainer" class="flex space-x-2 mb-4 flex-shrink-0 overflow-x-auto scrollbar-hide scroll-smooth">
        <div class="flex space-x-2 min-w-max px-1">
          <!-- 正在生成時的進度提示 - 集成到標籤欄中 -->
          <div v-if="promptStore.isGenerating" class="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm whitespace-nowrap">
            <RefreshCw class="w-3 h-3 animate-spin mr-1" />
            <span>生成中</span>
          </div>
          <button
            ref="reportTab"
            @click="handleTabChange('report')"
            :class="activeTab === 'report' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            class="px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex-shrink-0"
          >
            需求描述
          </button>
          <button
            v-if="promptStore.promptData.thinkingPoints"
            ref="thinkingTab"
            @click="handleTabChange('thinking')"
            :class="activeTab === 'thinking' ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            class="px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex-shrink-0 relative"
          >
            關鍵指令
          </button>
          <button
            v-if="promptStore.promptData.initialPrompt"
            ref="initialTab"
            @click="handleTabChange('initial')"
            :class="activeTab === 'initial' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            class="px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex-shrink-0 relative"
          >
            初始提示詞
          </button>
          <button
            v-if="promptStore.promptData.advice"
            ref="adviceTab"
            @click="handleTabChange('advice')"
            :class="activeTab === 'advice' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            class="px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex-shrink-0 relative"
          >
            優化建議
          </button>
          <button
            v-if="currentGeneratedPrompt"
            ref="zhTab"
            @click="handleTabChange('zh')"
            :class="activeTab === 'zh' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            class="px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex-shrink-0 relative"
          >
            最終提示詞
          </button>
        </div>
      </div>

      <!-- Requirement Report -->
      <div v-if="activeTab === 'report'" class="border rounded-lg overflow-hidden flex flex-col flex-1">
        <div class="bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 flex items-center justify-between flex-shrink-0">
          <span>需求描述</span>
          <div class="flex items-center space-x-2">
            <button
              @click="regenerateRequirementReport"
              :disabled="isExecuting || promptStore.isGenerating"
              class="text-orange-500 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="重新生成需求描述"
            >
              <RefreshCw :class="['w-4 h-4', (isExecuting && promptStore.currentExecutionStep === 'report') && 'animate-spin']" />
            </button>
            <button
              @click="copyToClipboard(promptStore.promptData.requirementReport, 'report')"
              class="text-orange-500 hover:text-orange-600"
              title="複製到剪貼板"
            >
              <Check v-if="copyStatus['report']" class="w-4 h-4" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="p-3 bg-white flex-1 flex flex-col overflow-hidden">
          <textarea
            v-model="promptStore.promptData.requirementReport"
            :placeholder="hasConversationData ? '基於對話生成的需求描述...' : '請直接描述您的需求，例如：我需要一個專業的代碼審查助手，能夠分析代碼質量、發現潛在問題並提供改進建議...'"
            class="w-full flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 focus:ring-0 resize-none"
          ></textarea>
          
          <!-- 執行按鈕 - 固定在底部 -->
          <div class="mt-4 flex justify-between flex-shrink-0">
            <!-- 自動模式下的按鈕 -->
            <div v-if="promptStore.isAutoMode" class="flex space-x-2">
              <button
                @click="executeFullWorkflow"
                :disabled="!promptStore.promptData.requirementReport.trim() || isExecuting || promptStore.isGenerating"
                class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <RefreshCw v-if="isExecuting || promptStore.isGenerating" class="w-4 h-4 animate-spin" />
                <span>{{ (isExecuting || promptStore.isGenerating) ? '自動生成中...' : '自動生成提示詞' }}</span>
              </button>
            </div>
            
            <!-- 手動模式下的按鈕 -->
            <div v-if="!promptStore.isAutoMode" class="flex justify-end">
              <button
                @click="executeThinkingPoints"
                :disabled="!promptStore.promptData.requirementReport.trim() || isExecuting"
                class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <RefreshCw v-if="isExecuting && promptStore.currentExecutionStep === 'thinking'" class="w-4 h-4 animate-spin" />
                <span>{{ (isExecuting && promptStore.currentExecutionStep === 'thinking') ? '執行中...' : '生成關鍵指令' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Thinking Points -->
      <div v-if="activeTab === 'thinking'" class="border rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
        <div class="bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 flex items-center justify-between flex-shrink-0">
          <span>關鍵指令 (GPrompt步驟1)</span>
          <div class="flex items-center space-x-2">
            <button
              @click="regenerateThinkingPoints"
              :disabled="isExecuting || promptStore.isGenerating"
              class="text-purple-500 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="重新生成關鍵指令"
            >
              <RefreshCw :class="['w-4 h-4', (isExecuting && promptStore.currentExecutionStep === 'thinking') && 'animate-spin']" />
            </button>
            <button
              @click="copyToClipboard(promptStore.promptData.thinkingPoints?.join('\\n') || '', 'thinking')"
              class="text-purple-500 hover:text-purple-600"
              title="複製到剪貼板"
            >
              <Check v-if="copyStatus['thinking']" class="w-4 h-4" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="bg-white flex flex-col" :class="isMobile ? 'flex-1 min-h-0' : 'p-3 flex-1'">          <div class="space-y-2 overflow-y-auto flex-1" :class="isMobile ? 'p-3' : ''" :style="isMobile ? '' : 'max-height: calc(100vh - 400px);'">
            <div 
              v-for="(_, index) in promptStore.promptData.thinkingPoints" 
              :key="index"
              class="flex items-start"
            >
              <span class="text-purple-500 mr-2 mt-2">•</span>
              <input
                v-model="promptStore.promptData.thinkingPoints![index]"
                class="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                @click="removeThinkingPoint(index)"
                class="ml-2 px-2 py-1 text-red-500 hover:text-red-700 text-sm"
                title="刪除這條指令"
              >
                ×
              </button>
            </div>
          </div>
          
          <!-- 底部按鈕區域 - 固定在底部 -->
          <div class="p-3 pt-4 flex justify-between flex-shrink-0 border-t border-gray-100 bg-white">
            <button
              @click="addThinkingPoint"
              class="px-3 py-1 text-purple-600 hover:text-purple-800 text-sm"
            >
              + 添加指令
            </button>
            
            <!-- 手動模式執行按鈕 -->
            <div v-if="!promptStore.isAutoMode">
              <button
                @click="executeInitialPrompt"
                :disabled="!promptStore.promptData.thinkingPoints || promptStore.promptData.thinkingPoints.length === 0 || isExecuting"
                class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <RefreshCw v-if="isExecuting && promptStore.currentExecutionStep === 'initial'" class="w-4 h-4 animate-spin" />
                <span>{{ (isExecuting && promptStore.currentExecutionStep === 'initial') ? '執行中...' : '生成初始提示詞' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Initial Prompt -->
      <div v-if="activeTab === 'initial'" class="border rounded-lg overflow-hidden flex flex-col flex-1">
        <div class="bg-green-50 px-3 py-2 text-sm font-medium text-green-700 flex items-center justify-between flex-shrink-0">
          <span>初始提示詞 (GPrompt步驟2)</span>
          <div class="flex items-center space-x-2">
            <button
              @click="regenerateInitialPrompt"
              :disabled="isExecuting || promptStore.isGenerating"
              class="text-green-500 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="重新生成初始提示詞"
            >
              <RefreshCw :class="['w-4 h-4', (isExecuting && promptStore.currentExecutionStep === 'initial') && 'animate-spin']" />
            </button>
            <button
              @click="copyToClipboard(promptStore.promptData.initialPrompt || '', 'initial')"
              class="text-green-500 hover:text-green-600"
              title="複製到剪貼板"
            >
              <Check v-if="copyStatus['initial']" class="w-4 h-4" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="p-3 bg-white flex-1 flex flex-col overflow-hidden">
          <textarea
            v-model="promptStore.promptData.initialPrompt"
            class="w-full flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          ></textarea>
          
          <!-- 手動模式執行按鈕 -->
          <div v-if="!promptStore.isAutoMode" class="mt-4 flex justify-end flex-shrink-0">
            <button
              @click="executeAdvice"
              :disabled="!promptStore.promptData.initialPrompt || isExecuting"
              class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <RefreshCw v-if="isExecuting && promptStore.currentExecutionStep === 'advice'" class="w-4 h-4 animate-spin" />
              <span>{{ (isExecuting && promptStore.currentExecutionStep === 'advice') ? '執行中...' : '生成優化建議' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Optimization Advice -->
      <div v-if="activeTab === 'advice'" class="border rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
        <div class="bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-700 flex items-center justify-between flex-shrink-0">
          <span>優化建議 (GPrompt步驟3)</span>
          <div class="flex items-center space-x-2">
            <button
              @click="regenerateAdvice"
              :disabled="isExecuting || promptStore.isGenerating"
              class="text-yellow-500 hover:text-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="重新生成優化建議"
            >
              <RefreshCw :class="['w-4 h-4', (isExecuting && promptStore.currentExecutionStep === 'advice') && 'animate-spin']" />
            </button>
            <button
              @click="copyToClipboard(promptStore.promptData.advice?.join('\\n') || '', 'advice')"
              class="text-yellow-500 hover:text-yellow-600"
              title="複製到剪貼板"
            >
              <Check v-if="copyStatus['advice']" class="w-4 h-4" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="bg-white flex flex-col" :class="isMobile ? 'flex-1 min-h-0' : 'p-3 flex-1'">
          <div class="space-y-2 overflow-y-auto flex-1" :class="isMobile ? 'p-3' : ''" :style="isMobile ? '' : 'max-height: calc(100vh - 400px);'">
            <div 
              v-for="(_, index) in promptStore.promptData.advice" 
              :key="index"
              class="flex items-start"
            >
              <span class="text-yellow-500 mr-2 mt-2">•</span>
              <input
                v-model="promptStore.promptData.advice![index]"
                class="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <button
                @click="removeAdviceItem(index)"
                class="ml-2 px-2 py-1 text-red-500 hover:text-red-700 text-sm"
                title="刪除這條建議"
              >
                ×
              </button>
            </div>
          </div>
          
          <!-- 底部按鈕區域 - 固定在底部 -->
          <div class="pt-4 flex justify-between flex-shrink-0 border-t border-gray-100" :class="isMobile ? 'p-3 bg-white' : 'mt-4'">
            <button
              @click="addAdviceItem"
              class="px-3 py-1 text-yellow-600 hover:text-yellow-800 text-sm"
            >
              + 添加建議
            </button>
            
            <!-- 手動模式執行按鈕 -->
            <div v-if="!promptStore.isAutoMode">
              <button
                @click="executeFinalPrompt"
                :disabled="!promptStore.promptData.advice || promptStore.promptData.advice.length === 0 || isExecuting"
                class="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <RefreshCw v-if="isExecuting && promptStore.currentExecutionStep === 'final'" class="w-4 h-4 animate-spin" />
                <span>{{ (isExecuting && promptStore.currentExecutionStep === 'final') ? '執行中...' : '生成最終提示詞' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Final Generated Prompt -->
      <div v-if="activeTab === 'zh'" class="border rounded-lg overflow-hidden flex flex-col flex-1">
        <div class="bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 flex items-center justify-between flex-shrink-0">
          <span>最終提示詞 (GPrompt步驟4)</span>
          <div class="flex items-center space-x-2">
            <button
              @click="regenerateFinalPrompt"
              :disabled="isExecuting || promptStore.isGenerating"
              class="text-blue-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="重新生成最終提示詞"
            >
              <RefreshCw :class="['w-4 h-4', (isExecuting && promptStore.currentExecutionStep === 'final') && 'animate-spin']" />
            </button>
            <button
              @click="copyToClipboard(currentGeneratedPrompt, 'final')"
              class="text-blue-500 hover:text-blue-600"
              title="複製到剪貼板"
            >
              <Check v-if="copyStatus['final']" class="w-4 h-4" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="p-3 bg-white flex-1 flex flex-col overflow-hidden">
          <textarea
            v-model="currentGeneratedPrompt"
            class="w-full flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          ></textarea>
          
          <!-- Format and Language Conversion - 移到標籤頁內部 -->
          <div v-if="currentGeneratedPrompt" class="flex space-x-2 pt-4 flex-shrink-0">
            <button 
              @click="toggleFormat"
              :disabled="!currentGeneratedPrompt || isConvertingFormat || isConvertingLanguage"
              class="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw v-if="isConvertingFormat" class="w-4 h-4 animate-spin" />
              <span>{{ isConvertingFormat ? '轉換中...' : (formatState === 'markdown' ? '轉爲XML格式' : '轉爲Markdown格式') }}</span>
            </button>
            <button 
              @click="toggleLanguage"
              :disabled="!currentGeneratedPrompt || isConvertingFormat || isConvertingLanguage"
              class="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw v-if="isConvertingLanguage" class="w-4 h-4 animate-spin" />
              <span>{{ isConvertingLanguage ? '轉換中...' : (languageState === 'zh' ? '轉爲英文版' : '轉爲中文版') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!hasAnyContent && !promptStore.isGenerating" class="flex-1 flex items-center justify-center p-6 text-center text-gray-500">
      <div>
        <MessageCircle class="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p>請在上方"需求描述"中輸入您的需求，或與AI助手對話後生成提示詞</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { usePromptStore } from '@/stores/promptStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { AIService } from '@/services/aiService'
import { PromptGeneratorService } from '@/services/promptGeneratorService'
import { AIGuideService } from '@/services/aiGuideService'
import { cleanAIResponseForFormatting } from '@/utils/aiResponseUtils'
import { 
  RefreshCw, 
  Copy, 
  Check,
  MessageCircle,
  ChevronUp
} from 'lucide-vue-next'

// Props
const props = defineProps<{
  isMobile?: boolean
  isExpanded?: boolean
}>()

// Emits
defineEmits<{
  toggle: []
}>()

// 解構props以避免未使用警告
const { isMobile, isExpanded } = props

const promptStore = usePromptStore()
const settingsStore = useSettingsStore()
const notificationStore = useNotificationStore()
const aiService = AIService.getInstance()
const aiGuideService = AIGuideService.getInstance()

// 新增：標籤頁狀態
const activeTab = ref<'report' | 'thinking' | 'initial' | 'advice' | 'zh' | 'en'>('report')

// 標籤頁相關 refs
const tabContainer = ref<HTMLElement>()
const reportTab = ref<HTMLButtonElement>()
const thinkingTab = ref<HTMLButtonElement>()
const initialTab = ref<HTMLButtonElement>()
const adviceTab = ref<HTMLButtonElement>()
const zhTab = ref<HTMLButtonElement>()

// 新增：跟蹤最新生成的內容
const newContentTabs = ref<Set<string>>(new Set())

// 步驟顯示名稱映射
const getStepDisplayName = (step: string): string => {
  const stepNames: { [key: string]: string } = {
    'report': '生成需求報告',
    'thinking': '提取關鍵指令', 
    'initial': '生成初始提示詞',
    'advice': '分析優化建議',
    'final': '合成最終提示詞'
  }
  return stepNames[step] || '生成'
}


// 標記選項卡爲已查看
const markTabAsViewed = (tab: string) => {
  newContentTabs.value.delete(tab)
}

// 自動滾動到激活的標籤頁
const scrollToActiveTab = (tabName: string) => {
  const tabRefs = {
    'report': reportTab,
    'thinking': thinkingTab, 
    'initial': initialTab,
    'advice': adviceTab,
    'zh': zhTab
  }
  
  const targetTab = tabRefs[tabName as keyof typeof tabRefs]
  const container = tabContainer.value
  
  if (targetTab?.value && container) {
    const tabElement = targetTab.value
    const containerRect = container.getBoundingClientRect()
    const tabRect = tabElement.getBoundingClientRect()
    
    // 計算標籤頁相對於容器的位置
    const tabLeftRelativeToContainer = tabRect.left - containerRect.left + container.scrollLeft
    const tabRightRelativeToContainer = tabLeftRelativeToContainer + tabRect.width
    
    // 檢查標籤頁是否在可視區域內
    const containerWidth = containerRect.width
    const scrollLeft = container.scrollLeft
    const scrollRight = scrollLeft + containerWidth
    
    // 如果標籤頁不在可視區域內，則滾動到合適位置
    if (tabLeftRelativeToContainer < scrollLeft) {
      // 標籤頁在左側不可見，滾動到標籤頁開始位置
      container.scrollTo({
        left: tabLeftRelativeToContainer - 20, // 留一點邊距
        behavior: 'smooth'
      })
    } else if (tabRightRelativeToContainer > scrollRight) {
      // 標籤頁在右側不可見，滾動使標籤頁完全可見
      container.scrollTo({
        left: tabLeftRelativeToContainer - containerWidth + tabRect.width + 20, // 留一點邊距
        behavior: 'smooth'
      })
    }
  }
}

// 自動切換標籤頁並滾動（用於流式更新時）
const switchToTabWithScroll = (tab: string) => {
  activeTab.value = tab as any
  nextTick(() => {
    scrollToActiveTab(tab)
  })
}

// 監聽activeTab變化，標記爲已查看
const handleTabChange = (tab: string) => {
  activeTab.value = tab as any
  markTabAsViewed(tab)
  // 滾動到目標標籤頁
  nextTick(() => {
    scrollToActiveTab(tab)
  })
}

// 計算當前語言的提示詞 - 可寫的computed
const currentGeneratedPrompt = computed({
  get: () => {
    // 如果有GPrompt生成的最終提示詞，優先使用
    if (promptStore.promptData.generatedPrompt && typeof promptStore.promptData.generatedPrompt === 'string') {
      return promptStore.promptData.generatedPrompt
    }
    
    if (promptStore.promptData.generatedPrompt && typeof promptStore.promptData.generatedPrompt === 'object') {
      if (activeTab.value === 'zh') {
        return promptStore.promptData.generatedPrompt.zh || ''
      } else if (activeTab.value === 'en') {
        return promptStore.promptData.generatedPrompt.en || ''
      }
    }
    return ''
  },
  set: (value: string) => {
    // 更新數據到store
    if (typeof promptStore.promptData.generatedPrompt === 'string') {
      promptStore.promptData.generatedPrompt = value
    } else if (typeof promptStore.promptData.generatedPrompt === 'object') {
      if (activeTab.value === 'zh') {
        promptStore.promptData.generatedPrompt.zh = value
      } else if (activeTab.value === 'en') {
        promptStore.promptData.generatedPrompt.en = value
      }
    }
  }
})

// 檢查是否有任何內容可以顯示
const hasAnyContent = computed(() => {
  return true // 始終顯示，以便用戶可以輸入需求描述
})

// 檢查是否有對話數據
const hasConversationData = computed(() => {
  return promptStore.chatMessages && promptStore.chatMessages.length > 0
})

// 添加關鍵指令
const addThinkingPoint = () => {
  if (promptStore.promptData.thinkingPoints) {
    promptStore.promptData.thinkingPoints.push('')
  }
}

// 刪除關鍵指令
const removeThinkingPoint = (index: number) => {
  if (promptStore.promptData.thinkingPoints && promptStore.promptData.thinkingPoints.length > 1) {
    promptStore.promptData.thinkingPoints.splice(index, 1)
  }
}

// 添加優化建議
const addAdviceItem = () => {
  if (promptStore.promptData.advice) {
    promptStore.promptData.advice.push('')
  }
}

// 刪除優化建議
const removeAdviceItem = (index: number) => {
  if (promptStore.promptData.advice && promptStore.promptData.advice.length > 1) {
    promptStore.promptData.advice.splice(index, 1)
  }
}

// 轉換狀態管理
const isConvertingFormat = ref(false)  // 格式轉換loading
const isConvertingLanguage = ref(false)  // 語言轉換loading

// 執行模式管理 - isAutoMode 現在在 promptStore 中管理
const isExecuting = ref(false)

// 格式和語言狀態管理
const formatState = ref<'markdown' | 'xml'>('markdown')  // 當前格式狀態
const languageState = ref<'zh' | 'en'>('zh')  // 當前語言狀態

// 備份內容，用於格式和語言切換
const backupContent = ref({
  markdown_zh: '',  // markdown中文版
  markdown_en: '',  // markdown英文版
  xml_zh: '',       // xml中文版
  xml_en: ''        // xml英文版
})

// 備份當前內容
const backupCurrentContent = () => {
  const currentContent = currentGeneratedPrompt.value
  if (currentContent) {
    const key = `${formatState.value}_${languageState.value}` as keyof typeof backupContent.value
    backupContent.value[key] = currentContent
  }
}

// 獲取指定格式和語言的內容
const getContentByFormatAndLanguage = (format: 'markdown' | 'xml', language: 'zh' | 'en'): string => {
  const key = `${format}_${language}` as keyof typeof backupContent.value
  return backupContent.value[key]
}

// 初始化內容時備份markdown中文版
const initializeContent = () => {
  if (currentGeneratedPrompt.value && !backupContent.value.markdown_zh) {
    backupContent.value.markdown_zh = currentGeneratedPrompt.value
    formatState.value = 'markdown'
    languageState.value = 'zh'
  }
}

// 執行完整工作流（自動模式）
const executeFullWorkflow = async () => {
  if (!promptStore.promptData.requirementReport.trim()) {
    notificationStore.warning('請先輸入需求描述')
    return
  }
  
  try {
    isExecuting.value = true
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    const requirementReport = promptStore.promptData.requirementReport
    
    // 步驟1: 生成關鍵指令
    promptStore.currentExecutionStep = 'thinking'
    let step1Content = ''
    let step1Initialized = false
    const onStep1Update = (chunk: string) => {
      step1Content += chunk
      
      // 首次收到數據時立即切換標籤頁
      if (!step1Initialized && chunk.trim()) {
        step1Initialized = true
        promptStore.promptData.thinkingPoints = ['正在生成...']
        switchToTabWithScroll('thinking')
      }
      
      const points = step1Content.split('\n').map(s => s.replace(/^[*-]\s*/, '').trim()).filter(Boolean)
      if (points.length > 0) promptStore.promptData.thinkingPoints = points
    }
    
    const thinkingPoints = await promptGeneratorService.getSystemPromptThinkingPoints(
      requirementReport,
      model.id,
      'zh',
      [],
      provider,
      onStep1Update
    )
    promptStore.promptData.thinkingPoints = thinkingPoints
    
    // 步驟2: 生成初始提示詞
    promptStore.currentExecutionStep = 'initial'
    let step2Initialized = false
    const onStep2Update = (chunk: string) => {
      // 首次收到數據時立即切換標籤頁
      if (!step2Initialized && chunk.trim()) {
        step2Initialized = true
        promptStore.promptData.initialPrompt = '正在生成...'
        switchToTabWithScroll('initial')
      }
      
      // 如果已經初始化，追加內容；否則設置內容
      if (step2Initialized) {
        if (promptStore.promptData.initialPrompt === '正在生成...') {
          promptStore.promptData.initialPrompt = chunk
        } else {
          promptStore.promptData.initialPrompt += chunk
        }
      }
    }
    
    const initialPrompt = await promptGeneratorService.generateSystemPrompt(
      requirementReport,
      model.id,
      'zh',
      [],
      thinkingPoints,
      provider,
      onStep2Update
    )
    promptStore.promptData.initialPrompt = initialPrompt
    
    // 步驟3: 獲取優化建議
    promptStore.currentExecutionStep = 'advice'
    let step3Content = ''
    let step3Initialized = false
    const onStep3Update = (chunk: string) => {
      step3Content += chunk
      
      // 首次收到數據時立即切換標籤頁
      if (!step3Initialized && chunk.trim()) {
        step3Initialized = true
        promptStore.promptData.advice = ['正在生成...']
        switchToTabWithScroll('advice')
      }
      
      const adviceList = step3Content.split('\n').map(s => s.replace(/^[*-]\s*/, '').trim()).filter(Boolean)
      if (adviceList.length > 0) promptStore.promptData.advice = adviceList
    }
    
    const advice = await promptGeneratorService.getOptimizationAdvice(
      initialPrompt,
      'system',
      model.id,
      'zh',
      [],
      provider,
      onStep3Update
    )
    promptStore.promptData.advice = advice
    
    // 步驟4: 生成最終提示詞
    promptStore.currentExecutionStep = 'final'
    let step4Initialized = false
    const onStep4Update = (chunk: string) => {
      // 首次收到數據時立即切換標籤頁
      if (!step4Initialized && chunk.trim()) {
        step4Initialized = true
        promptStore.promptData.generatedPrompt = '正在生成...'
        switchToTabWithScroll('zh')
      }
      
      // 如果已經初始化，追加內容；否則設置內容
      if (step4Initialized) {
        if (promptStore.promptData.generatedPrompt === '正在生成...') {
          promptStore.promptData.generatedPrompt = chunk
        } else {
          promptStore.promptData.generatedPrompt += chunk
        }
      }
    }
    
    const finalPrompt = await promptGeneratorService.applyOptimizationAdvice(
      initialPrompt,
      advice,
      'system',
      model.id,
      'zh',
      [],
      provider,
      onStep4Update
    )
    promptStore.promptData.generatedPrompt = finalPrompt
    
    // 重置格式和語言狀態，清空緩存
    formatState.value = 'markdown'
    languageState.value = 'zh'
    backupContent.value = {
      markdown_zh: finalPrompt,
      markdown_en: '',
      xml_zh: '',
      xml_en: ''
    }
    
    // 自動切換到最終提示詞標籤頁
    switchToTabWithScroll('zh')
    
  } catch (error) {
    notificationStore.error('自動生成提示詞失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 執行步驟1：生成關鍵指令
const executeThinkingPoints = async () => {
  if (!promptStore.promptData.requirementReport.trim()) {
    notificationStore.warning('請先輸入需求報告')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'thinking'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    
    // 導入PromptGeneratorService
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新狀態
    let streamContent = ''
    let hasInitialized = false
    
    // 設置流式回調函數
    const onStreamUpdate = (chunk: string) => {
      streamContent += chunk
      
      // 首次收到有效數據時，立即切換到該標籤頁並初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.thinkingPoints = ['正在生成...']
        switchToTabWithScroll('thinking')
      }
      
      // 實時解析並更新關鍵指令
      const points = streamContent
        .split('\n')
        .map(s => s.replace(/^[*-]\s*/, '').trim())
        .filter(Boolean)
      
      if (points.length > 0) {
        promptStore.promptData.thinkingPoints = points
      }
    }
    
    const thinkingPoints = await promptGeneratorService.getSystemPromptThinkingPoints(
      promptStore.promptData.requirementReport,
      model.id,
      'zh',
      [],
      provider,
      onStreamUpdate
    )
    
    // 最終確保數據正確性
    promptStore.promptData.thinkingPoints = thinkingPoints
    
  } catch (error) {
    notificationStore.error('生成關鍵指令失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 執行步驟2：生成初始提示詞
const executeInitialPrompt = async () => {
  if (!promptStore.promptData.thinkingPoints || promptStore.promptData.thinkingPoints.length === 0) {
    notificationStore.warning('請先生成關鍵指令')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'initial'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新狀態
    let hasInitialized = false
    
    // 設置流式回調函數
    const onStreamUpdate = (chunk: string) => {
      // 首次收到有效數據時，立即切換到該標籤頁並初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.initialPrompt = '正在生成...'
        switchToTabWithScroll('initial')
      }
      
      // 如果已經初始化，追加內容；否則設置內容
      if (hasInitialized) {
        if (promptStore.promptData.initialPrompt === '正在生成...') {
          promptStore.promptData.initialPrompt = chunk
        } else {
          promptStore.promptData.initialPrompt += chunk
        }
      }
    }
    
    const initialPrompt = await promptGeneratorService.generateSystemPrompt(
      promptStore.promptData.requirementReport,
      model.id,
      'zh',
      [],
      promptStore.promptData.thinkingPoints,
      provider,
      onStreamUpdate
    )
    
    // 最終確保數據正確性
    promptStore.promptData.initialPrompt = initialPrompt
    
  } catch (error) {
    notificationStore.error('生成初始提示詞失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 執行步驟3：生成優化建議
const executeAdvice = async () => {
  if (!promptStore.promptData.initialPrompt) {
    notificationStore.error('請先生成初始提示詞')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'advice'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新狀態
    let streamContent = ''
    let hasInitialized = false
    
    // 設置流式回調函數
    const onStreamUpdate = (chunk: string) => {
      streamContent += chunk
      
      // 首次收到有效數據時，立即切換到該標籤頁並初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.advice = ['正在生成...']
        switchToTabWithScroll('advice')
      }
      
      // 實時解析並更新優化建議
      const adviceList = streamContent
        .split('\n')
        .map(s => s.replace(/^[*-]\s*/, '').trim())
        .filter(Boolean)
      
      if (adviceList.length > 0) {
        promptStore.promptData.advice = adviceList
      }
    }
    
    const advice = await promptGeneratorService.getOptimizationAdvice(
      promptStore.promptData.initialPrompt,
      'system',
      model.id,
      'zh',
      [],
      provider,
      onStreamUpdate
    )
    
    // 最終確保數據正確性
    promptStore.promptData.advice = advice
    
  } catch (error) {
    notificationStore.error('生成優化建議失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 執行步驟4：生成最終提示詞
const executeFinalPrompt = async () => {
  if (!promptStore.promptData.initialPrompt || !promptStore.promptData.advice) {
    notificationStore.error('請先完成前面的步驟')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'final'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新狀態
    let hasInitialized = false
    
    // 設置流式回調函數
    const onStreamUpdate = (chunk: string) => {
      // 首次收到有效數據時，立即切換到該標籤頁並初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.generatedPrompt = '正在生成...'
        switchToTabWithScroll('zh')
      }
      
      // 如果已經初始化，追加內容；否則設置內容
      if (hasInitialized) {
        if (promptStore.promptData.generatedPrompt === '正在生成...') {
          promptStore.promptData.generatedPrompt = chunk
        } else {
          promptStore.promptData.generatedPrompt += chunk
        }
      }
    }
    
    const finalPrompt = await promptGeneratorService.applyOptimizationAdvice(
      promptStore.promptData.initialPrompt,
      promptStore.promptData.advice,
      'system',
      model.id,
      'zh',
      [],
      provider,
      onStreamUpdate
    )
    
    // 最終確保數據正確性
    promptStore.promptData.generatedPrompt = finalPrompt
    
    // 重置格式和語言狀態，清空緩存
    formatState.value = 'markdown'
    languageState.value = 'zh'
    backupContent.value = {
      markdown_zh: finalPrompt,
      markdown_en: '',
      xml_zh: '',
      xml_en: ''
    }
    
  } catch (error) {
    notificationStore.error('生成最終提示詞失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 智能格式轉換 (Markdown ⇄ XML)
const toggleFormat = async () => {
  if (!currentGeneratedPrompt.value) return
  
  try {
    isConvertingFormat.value = true
    
    // 備份當前內容
    backupCurrentContent()
    
    const targetFormat = formatState.value === 'markdown' ? 'xml' : 'markdown'
    const currentLanguage = languageState.value
    
    // 檢查是否已有目標格式的緩存內容
    const cachedContent = getContentByFormatAndLanguage(targetFormat, currentLanguage)
    
    if (cachedContent) {
      // 有緩存，直接使用
      promptStore.promptData.generatedPrompt = cachedContent
      formatState.value = targetFormat
    } else {
      // 沒有緩存，需要AI轉換
      const provider = settingsStore.getCurrentProvider()
      const model = settingsStore.getCurrentModel()
      
      if (!provider || !model) {
        notificationStore.error('請先配置AI模型')
        return
      }

      let conversionPrompt = ''
      if (targetFormat === 'xml') {
        conversionPrompt = `將以下提示詞轉換爲XML格式，使用語義化標籤如 <role>、<task>、<constraints> 等組織結構。直接輸出XML內容，不要添加說明文字：

${currentGeneratedPrompt.value}`
      } else {
        conversionPrompt = `將以下XML格式提示詞轉換爲Markdown格式，使用標題、列表等語法。直接輸出Markdown內容，不要添加說明文字：

${currentGeneratedPrompt.value}`
      }

      const response = await aiService.callAI([{
        role: 'user',
        content: conversionPrompt
      }], provider, model.id)

      const cleanedResponse = cleanAIResponseForFormatting(response)
      promptStore.promptData.generatedPrompt = cleanedResponse
      
      // 緩存轉換結果
      const cacheKey = `${targetFormat}_${currentLanguage}` as keyof typeof backupContent.value
      backupContent.value[cacheKey] = cleanedResponse
      
      formatState.value = targetFormat
    }
    
  } catch (error) {
    notificationStore.error('格式轉換失敗，請重試')
  } finally {
    isConvertingFormat.value = false
  }
}

// 智能語言轉換 (中文 ⇄ 英文)
const toggleLanguage = async () => {
  if (!currentGeneratedPrompt.value) return
  
  try {
    isConvertingLanguage.value = true
    
    // 備份當前內容
    backupCurrentContent()
    
    const targetLanguage = languageState.value === 'zh' ? 'en' : 'zh'
    const currentFormat = formatState.value
    
    // 檢查是否已有目標語言的緩存內容
    const cachedContent = getContentByFormatAndLanguage(currentFormat, targetLanguage)
    
    if (cachedContent) {
      // 有緩存，直接使用
      promptStore.promptData.generatedPrompt = cachedContent
      languageState.value = targetLanguage
    } else {
      // 沒有緩存，需要AI翻譯
      const provider = settingsStore.getCurrentProvider()
      const model = settingsStore.getCurrentModel()
      
      if (!provider || !model) {
        notificationStore.error('請先配置AI模型')
        return
      }

      let translationPrompt = ''
      if (targetLanguage === 'en') {
        translationPrompt = `Translate the following Chinese AI system prompt to English. Keep all technical terms and formatting intact. Output only the translated content without any explanations:

${currentGeneratedPrompt.value}`
      } else {
        translationPrompt = `將以下英文AI系統提示詞翻譯爲中文，保持所有技術術語和格式不變。直接輸出翻譯內容，不要添加說明文字：

${currentGeneratedPrompt.value}`
      }

      const response = await aiService.callAI([{
        role: 'user',
        content: translationPrompt
      }], provider, model.id)

      const cleanedResponse = cleanAIResponseForFormatting(response)
      promptStore.promptData.generatedPrompt = cleanedResponse
      
      // 緩存翻譯結果
      const cacheKey = `${currentFormat}_${targetLanguage}` as keyof typeof backupContent.value
      backupContent.value[cacheKey] = cleanedResponse
      
      languageState.value = targetLanguage
    }
    
  } catch (error) {
    notificationStore.error('語言轉換失敗，請重試')
  } finally {
    isConvertingLanguage.value = false
  }
}

// 複製狀態管理
const copyStatus = ref<{[key: string]: boolean}>({})

// 複製到剪貼板
const copyToClipboard = async (text: string, key: string = 'default') => {
  try {
    await navigator.clipboard.writeText(text)
    
    // 顯示成功狀態
    copyStatus.value[key] = true
    
    // 2秒後重置狀態
    setTimeout(() => {
      copyStatus.value[key] = false
    }, 2000)
    
  } catch (error) {
    notificationStore.error('複製失敗，請重試')
  }
}

// 重新生成需求描述
const regenerateRequirementReport = async () => {
  if (!hasConversationData.value) {
    notificationStore.warning('需要先與AI助手對話才能重新生成需求描述')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'report'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    // 獲取對話歷史
    const validMessages = promptStore.getValidMessages()
    const conversationHistory = validMessages.map(msg => ({
      type: msg.type,
      content: msg.content
    }))
    
    // 設置流式更新
    let streamContent = ''
    const onStreamUpdate = (chunk: string) => {
      streamContent += chunk
      promptStore.promptData.requirementReport = streamContent
    }
    
    // 重新生成需求報告
    const requirementReport = await aiGuideService.generateRequirementReportFromConversation(
      conversationHistory,
      provider,
      model.id,
      onStreamUpdate
    )
    
    // 確保最終數據正確
    promptStore.promptData.requirementReport = requirementReport
    notificationStore.success('需求描述已重新生成')
    
  } catch (error) {
    notificationStore.error('重新生成需求描述失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 重新生成關鍵指令
const regenerateThinkingPoints = async () => {
  if (!promptStore.promptData.requirementReport.trim()) {
    notificationStore.warning('請先輸入需求描述')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'thinking'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新狀態
    let streamContent = ''
    let hasInitialized = false
    
    // 設置流式回調函數
    const onStreamUpdate = (chunk: string) => {
      streamContent += chunk
      
      // 首次收到有效數據時，立即切換到該標籤頁並初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.thinkingPoints = ['正在生成...']
        switchToTabWithScroll('thinking')
      }
      
      // 實時解析並更新關鍵指令
      const points = streamContent
        .split('\n')
        .map(s => s.replace(/^[*-]\s*/, '').trim())
        .filter(Boolean)
      
      if (points.length > 0) {
        promptStore.promptData.thinkingPoints = points
      }
    }
    
    const thinkingPoints = await promptGeneratorService.getSystemPromptThinkingPoints(
      promptStore.promptData.requirementReport,
      model.id,
      'zh',
      [],
      provider,
      onStreamUpdate
    )
    
    // 最終確保數據正確性
    promptStore.promptData.thinkingPoints = thinkingPoints
    notificationStore.success('關鍵指令已重新生成')
    
  } catch (error) {
    notificationStore.error('重新生成關鍵指令失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 重新生成初始提示詞
const regenerateInitialPrompt = async () => {
  if (!promptStore.promptData.thinkingPoints || promptStore.promptData.thinkingPoints.length === 0) {
    notificationStore.warning('請先生成關鍵指令')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'initial'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新狀態
    let hasInitialized = false
    
    // 設置流式回調函數
    const onStreamUpdate = (chunk: string) => {
      // 首次收到有效數據時，立即切換到該標籤頁並初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.initialPrompt = '正在生成...'
        switchToTabWithScroll('initial')
      }
      
      // 如果已經初始化，追加內容；否則設置內容
      if (hasInitialized) {
        if (promptStore.promptData.initialPrompt === '正在生成...') {
          promptStore.promptData.initialPrompt = chunk
        } else {
          promptStore.promptData.initialPrompt += chunk
        }
      }
    }
    
    const initialPrompt = await promptGeneratorService.generateSystemPrompt(
      promptStore.promptData.requirementReport,
      model.id,
      'zh',
      [],
      promptStore.promptData.thinkingPoints,
      provider,
      onStreamUpdate
    )
    
    // 最終確保數據正確性
    promptStore.promptData.initialPrompt = initialPrompt
    notificationStore.success('初始提示詞已重新生成')
    
  } catch (error) {
    notificationStore.error('重新生成初始提示詞失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 重新生成優化建議
const regenerateAdvice = async () => {
  if (!promptStore.promptData.initialPrompt) {
    notificationStore.error('請先生成初始提示詞')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'advice'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新狀態
    let streamContent = ''
    let hasInitialized = false
    
    // 設置流式回調函數
    const onStreamUpdate = (chunk: string) => {
      streamContent += chunk
      
      // 首次收到有效數據時，立即切換到該標籤頁並初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.advice = ['正在生成...']
        switchToTabWithScroll('advice')
      }
      
      // 實時解析並更新優化建議
      const adviceList = streamContent
        .split('\n')
        .map(s => s.replace(/^[*-]\s*/, '').trim())
        .filter(Boolean)
      
      if (adviceList.length > 0) {
        promptStore.promptData.advice = adviceList
      }
    }
    
    const advice = await promptGeneratorService.getOptimizationAdvice(
      promptStore.promptData.initialPrompt,
      'system',
      model.id,
      'zh',
      [],
      provider,
      onStreamUpdate
    )
    
    // 最終確保數據正確性
    promptStore.promptData.advice = advice
    notificationStore.success('優化建議已重新生成')
    
  } catch (error) {
    notificationStore.error('重新生成優化建議失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 重新生成最終提示詞
const regenerateFinalPrompt = async () => {
  if (!promptStore.promptData.initialPrompt || !promptStore.promptData.advice) {
    notificationStore.error('請先完成前面的步驟')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'final'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('請先配置AI模型')
      return
    }
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新狀態
    let hasInitialized = false
    
    // 設置流式回調函數
    const onStreamUpdate = (chunk: string) => {
      // 首次收到有效數據時，立即切換到該標籤頁並初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.generatedPrompt = '正在生成...'
        switchToTabWithScroll('zh')
      }
      
      // 如果已經初始化，追加內容；否則設置內容
      if (hasInitialized) {
        if (promptStore.promptData.generatedPrompt === '正在生成...') {
          promptStore.promptData.generatedPrompt = chunk
        } else {
          promptStore.promptData.generatedPrompt += chunk
        }
      }
    }
    
    const finalPrompt = await promptGeneratorService.applyOptimizationAdvice(
      promptStore.promptData.initialPrompt,
      promptStore.promptData.advice,
      'system',
      model.id,
      'zh',
      [],
      provider,
      onStreamUpdate
    )
    
    // 最終確保數據正確性
    promptStore.promptData.generatedPrompt = finalPrompt
    
    // 重置格式和語言狀態，清空緩存
    formatState.value = 'markdown'
    languageState.value = 'zh'
    backupContent.value = {
      markdown_zh: finalPrompt,
      markdown_en: '',
      xml_zh: '',
      xml_en: ''
    }
    
    notificationStore.success('最終提示詞已重新生成')
    
  } catch (error) {
    notificationStore.error('重新生成最終提示詞失敗，請重試')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 監聽對話清空，重置活動標籤頁和相關狀態
watch(() => promptStore.chatMessages.length, (newLength) => {
  if (newLength === 0) {
    switchToTabWithScroll('report')
    // 重置所有狀態
    newContentTabs.value.clear()
    formatState.value = 'markdown'
    languageState.value = 'zh'
    backupContent.value = {
      markdown_zh: '',
      markdown_en: '',
      xml_zh: '',
      xml_en: ''
    }
  }
})

// 監聽數據變化，自動切換到新生成的內容
watch(() => promptStore.promptData.requirementReport, (newVal) => {
  if (newVal && newVal.trim().length > 0) {
    newContentTabs.value.add('report')
    switchToTabWithScroll('report')
  }
})

watch(() => promptStore.promptData.thinkingPoints, (newVal) => {
  if (newVal && newVal.length > 0) {
    newContentTabs.value.add('thinking')
    switchToTabWithScroll('thinking')
  }
})

watch(() => promptStore.promptData.initialPrompt, (newVal) => {
  if (newVal && newVal.trim().length > 0) {
    newContentTabs.value.add('initial')
    switchToTabWithScroll('initial')
  }
})

watch(() => promptStore.promptData.advice, (newVal) => {
  if (newVal && newVal.length > 0) {
    newContentTabs.value.add('advice')
    switchToTabWithScroll('advice')
  }
})

watch(() => promptStore.promptData.generatedPrompt, (newVal) => {
  // 只有當有真實內容時才切換標籤頁
  if (newVal) {
    let hasContent = false
    if (typeof newVal === 'string') {
      hasContent = newVal.trim().length > 0
    } else if (typeof newVal === 'object') {
      hasContent = Boolean((newVal.zh && newVal.zh.trim().length > 0) || (newVal.en && newVal.en.trim().length > 0))
    }
    
    if (hasContent) {
      // 初始化狀態和備份
      initializeContent()
      newContentTabs.value.add('zh')
      switchToTabWithScroll('zh')
    }
  }
})
</script>

<style scoped>
/* 隱藏水平滾動條但保持滾動功能 */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>