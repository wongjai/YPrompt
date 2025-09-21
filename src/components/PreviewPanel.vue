<template>
  <div class="bg-white rounded-lg shadow-sm flex flex-col h-full">
    <div class="p-4 border-b border-gray-200 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <h2 class="font-semibold text-gray-800">提示词预览</h2>
        <!-- 生成状态指示器 -->
        <div v-if="promptStore.currentExecutionStep || (promptStore.isGenerating && !promptStore.currentExecutionStep)" class="flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
          <RefreshCw class="w-3 h-3 animate-spin mr-1" />
          <span>{{ promptStore.currentExecutionStep ? getStepDisplayName(promptStore.currentExecutionStep) + '中' : '生成需求报告中' }}</span>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <!-- 移动端折叠按钮 -->
        <button
          v-if="isMobile && isExpanded"
          @click="$emit('toggle')"
          class="p-1 hover:bg-gray-100 rounded transition-colors"
          title="折叠"
        >
          <ChevronUp class="w-5 h-5 text-gray-500" />
        </button>
        <!-- <span class="text-sm text-gray-600">执行模式:</span> -->
        <div class="flex items-center space-x-2">
          <label class="flex items-center cursor-pointer">
            <input
              v-model="promptStore.isAutoMode"
              type="checkbox"
              class="sr-only peer"
            />
            <span class="text-sm text-gray-600">{{ promptStore.isAutoMode ? '自动：' : '手动：' }}</span>
            <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <!-- <span class="ml-3 text-sm font-medium text-gray-700">{{ promptStore.isAutoMode ? '自动' : '手动' }}</span> -->
          </label>
        </div>
      </div>
    </div>

    <!-- Loading state - 只在没有任何内容时显示 -->
    <div v-if="promptStore.isGenerating && !hasAnyContent" class="p-6 text-center">
      <RefreshCw class="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
      <p class="text-gray-600">正在生成提示词...</p>
    </div>

    <!-- Preview content - 有内容就显示，即使还在生成中 -->
    <div v-if="hasAnyContent" class="flex-1 flex flex-col overflow-hidden p-4">
      <!-- Language Tabs -->
      <div ref="tabContainer" class="flex space-x-2 mb-4 flex-shrink-0 overflow-x-auto scrollbar-hide scroll-smooth">
        <div class="flex space-x-2 min-w-max px-1">
          <!-- 正在生成时的进度提示 - 集成到标签栏中 -->
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
            关键指令
          </button>
          <button
            v-if="promptStore.promptData.initialPrompt"
            ref="initialTab"
            @click="handleTabChange('initial')"
            :class="activeTab === 'initial' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            class="px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex-shrink-0 relative"
          >
            初始提示词
          </button>
          <button
            v-if="promptStore.promptData.advice"
            ref="adviceTab"
            @click="handleTabChange('advice')"
            :class="activeTab === 'advice' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            class="px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex-shrink-0 relative"
          >
            优化建议
          </button>
          <button
            v-if="currentGeneratedPrompt"
            ref="zhTab"
            @click="handleTabChange('zh')"
            :class="activeTab === 'zh' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            class="px-3 py-1 rounded text-sm transition-colors whitespace-nowrap flex-shrink-0 relative"
          >
            最终提示词
          </button>
        </div>
      </div>

      <!-- Requirement Report -->
      <div v-if="activeTab === 'report'" class="border rounded-lg overflow-hidden flex flex-col flex-1">
        <div class="bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 flex items-center justify-between flex-shrink-0">
          <span>需求描述</span>
          <button
            @click="copyToClipboard(promptStore.promptData.requirementReport, 'report')"
            class="text-orange-500 hover:text-orange-600"
            title="复制到剪贴板"
          >
            <Check v-if="copyStatus['report']" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
          </button>
        </div>
        <div class="p-3 bg-white flex-1 flex flex-col overflow-hidden">
          <textarea
            v-model="promptStore.promptData.requirementReport"
            :placeholder="hasConversationData ? '基于对话生成的需求描述...' : '请直接描述您的需求，例如：我需要一个专业的代码审查助手，能够分析代码质量、发现潜在问题并提供改进建议...'"
            class="w-full flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          ></textarea>
          
          <!-- 执行按钮 - 固定在底部 -->
          <div class="mt-4 flex justify-between flex-shrink-0">
            <!-- 自动模式下的按钮 -->
            <div v-if="promptStore.isAutoMode" class="flex space-x-2">
              <button
                @click="executeFullWorkflow"
                :disabled="!promptStore.promptData.requirementReport.trim() || isExecuting || promptStore.isGenerating"
                class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <RefreshCw v-if="isExecuting || promptStore.isGenerating" class="w-4 h-4 animate-spin" />
                <span>{{ (isExecuting || promptStore.isGenerating) ? '自动生成中...' : '自动生成提示词' }}</span>
              </button>
            </div>
            
            <!-- 手动模式下的按钮 -->
            <div v-if="!promptStore.isAutoMode" class="flex justify-end">
              <button
                @click="executeThinkingPoints"
                :disabled="!promptStore.promptData.requirementReport.trim() || isExecuting"
                class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <RefreshCw v-if="isExecuting && promptStore.currentExecutionStep === 'thinking'" class="w-4 h-4 animate-spin" />
                <span>{{ (isExecuting && promptStore.currentExecutionStep === 'thinking') ? '执行中...' : '生成关键指令' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Thinking Points -->
      <div v-if="activeTab === 'thinking'" class="border rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
        <div class="bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 flex items-center justify-between flex-shrink-0">
          <span>关键指令 (GPrompt步骤1)</span>
          <button
            @click="copyToClipboard(promptStore.promptData.thinkingPoints?.join('\\n') || '', 'thinking')"
            class="text-purple-500 hover:text-purple-600"
            title="复制到剪贴板"
          >
            <Check v-if="copyStatus['thinking']" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
          </button>
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
                title="删除这条指令"
              >
                ×
              </button>
            </div>
          </div>
          
          <!-- 底部按钮区域 - 固定在底部 -->
          <div class="p-3 pt-4 flex justify-between flex-shrink-0 border-t border-gray-100 bg-white">
            <button
              @click="addThinkingPoint"
              class="px-3 py-1 text-purple-600 hover:text-purple-800 text-sm"
            >
              + 添加指令
            </button>
            
            <!-- 手动模式执行按钮 -->
            <div v-if="!promptStore.isAutoMode">
              <button
                @click="executeInitialPrompt"
                :disabled="!promptStore.promptData.thinkingPoints || promptStore.promptData.thinkingPoints.length === 0 || isExecuting"
                class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <RefreshCw v-if="isExecuting && promptStore.currentExecutionStep === 'initial'" class="w-4 h-4 animate-spin" />
                <span>{{ (isExecuting && promptStore.currentExecutionStep === 'initial') ? '执行中...' : '生成初始提示词' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Initial Prompt -->
      <div v-if="activeTab === 'initial'" class="border rounded-lg overflow-hidden flex flex-col flex-1">
        <div class="bg-green-50 px-3 py-2 text-sm font-medium text-green-700 flex items-center justify-between flex-shrink-0">
          <span>初始提示词 (GPrompt步骤2)</span>
          <button
            @click="copyToClipboard(promptStore.promptData.initialPrompt || '', 'initial')"
            class="text-green-500 hover:text-green-600"
            title="复制到剪贴板"
          >
            <Check v-if="copyStatus['initial']" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
          </button>
        </div>
        <div class="p-3 bg-white flex-1 flex flex-col overflow-hidden">
          <textarea
            v-model="promptStore.promptData.initialPrompt"
            class="w-full flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          ></textarea>
          
          <!-- 手动模式执行按钮 -->
          <div v-if="!promptStore.isAutoMode" class="mt-4 flex justify-end flex-shrink-0">
            <button
              @click="executeAdvice"
              :disabled="!promptStore.promptData.initialPrompt || isExecuting"
              class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <RefreshCw v-if="isExecuting && promptStore.currentExecutionStep === 'advice'" class="w-4 h-4 animate-spin" />
              <span>{{ (isExecuting && promptStore.currentExecutionStep === 'advice') ? '执行中...' : '生成优化建议' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Optimization Advice -->
      <div v-if="activeTab === 'advice'" class="border rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
        <div class="bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-700 flex items-center justify-between flex-shrink-0">
          <span>优化建议 (GPrompt步骤3)</span>
          <button
            @click="copyToClipboard(promptStore.promptData.advice?.join('\\n') || '', 'advice')"
            class="text-yellow-500 hover:text-yellow-600"
            title="复制到剪贴板"
          >
            <Check v-if="copyStatus['advice']" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
          </button>
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
                title="删除这条建议"
              >
                ×
              </button>
            </div>
          </div>
          
          <!-- 底部按钮区域 - 固定在底部 -->
          <div class="pt-4 flex justify-between flex-shrink-0 border-t border-gray-100" :class="isMobile ? 'p-3 bg-white' : 'mt-4'">
            <button
              @click="addAdviceItem"
              class="px-3 py-1 text-yellow-600 hover:text-yellow-800 text-sm"
            >
              + 添加建议
            </button>
            
            <!-- 手动模式执行按钮 -->
            <div v-if="!promptStore.isAutoMode">
              <button
                @click="executeFinalPrompt"
                :disabled="!promptStore.promptData.advice || promptStore.promptData.advice.length === 0 || isExecuting"
                class="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <RefreshCw v-if="isExecuting && promptStore.currentExecutionStep === 'final'" class="w-4 h-4 animate-spin" />
                <span>{{ (isExecuting && promptStore.currentExecutionStep === 'final') ? '执行中...' : '生成最终提示词' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Final Generated Prompt -->
      <div v-if="activeTab === 'zh'" class="border rounded-lg overflow-hidden flex flex-col flex-1">
        <div class="bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 flex items-center justify-between flex-shrink-0">
          <span>最终提示词 (GPrompt步骤4)</span>
          <button
            @click="copyToClipboard(currentGeneratedPrompt, 'final')"
            class="text-blue-500 hover:text-blue-600"
            title="复制到剪贴板"
          >
            <Check v-if="copyStatus['final']" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
          </button>
        </div>
        <div class="p-3 bg-white flex-1 flex flex-col overflow-hidden">
          <textarea
            v-model="currentGeneratedPrompt"
            class="w-full flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          ></textarea>
          
          <!-- Format and Language Conversion - 移到标签页内部 -->
          <div v-if="currentGeneratedPrompt" class="flex space-x-2 pt-4 flex-shrink-0">
            <button 
              @click="toggleFormat"
              :disabled="!currentGeneratedPrompt || isConvertingFormat || isConvertingLanguage"
              class="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw v-if="isConvertingFormat" class="w-4 h-4 animate-spin" />
              <span>{{ isConvertingFormat ? '转换中...' : (formatState === 'markdown' ? '转为XML格式' : '转为Markdown格式') }}</span>
            </button>
            <button 
              @click="toggleLanguage"
              :disabled="!currentGeneratedPrompt || isConvertingFormat || isConvertingLanguage"
              class="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw v-if="isConvertingLanguage" class="w-4 h-4 animate-spin" />
              <span>{{ isConvertingLanguage ? '转换中...' : (languageState === 'zh' ? '转为英文版' : '转为中文版') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!hasAnyContent && !promptStore.isGenerating" class="flex-1 flex items-center justify-center p-6 text-center text-gray-500">
      <div>
        <MessageCircle class="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p>请在上方"需求描述"中输入您的需求，或与AI助手对话后生成提示词</p>
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

// 解构props以避免未使用警告
const { isMobile, isExpanded } = props

const promptStore = usePromptStore()
const settingsStore = useSettingsStore()
const notificationStore = useNotificationStore()
const aiService = AIService.getInstance()

// 新增：标签页状态
const activeTab = ref<'report' | 'thinking' | 'initial' | 'advice' | 'zh' | 'en'>('report')

// 标签页相关 refs
const tabContainer = ref<HTMLElement>()
const reportTab = ref<HTMLButtonElement>()
const thinkingTab = ref<HTMLButtonElement>()
const initialTab = ref<HTMLButtonElement>()
const adviceTab = ref<HTMLButtonElement>()
const zhTab = ref<HTMLButtonElement>()

// 新增：跟踪最新生成的内容
const newContentTabs = ref<Set<string>>(new Set())

// 步骤显示名称映射
const getStepDisplayName = (step: string): string => {
  const stepNames: { [key: string]: string } = {
    'report': '生成需求报告',
    'thinking': '提取关键指令', 
    'initial': '生成初始提示词',
    'advice': '分析优化建议',
    'final': '合成最终提示词'
  }
  return stepNames[step] || '生成'
}


// 标记选项卡为已查看
const markTabAsViewed = (tab: string) => {
  newContentTabs.value.delete(tab)
}

// 自动滚动到激活的标签页
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
    
    // 计算标签页相对于容器的位置
    const tabLeftRelativeToContainer = tabRect.left - containerRect.left + container.scrollLeft
    const tabRightRelativeToContainer = tabLeftRelativeToContainer + tabRect.width
    
    // 检查标签页是否在可视区域内
    const containerWidth = containerRect.width
    const scrollLeft = container.scrollLeft
    const scrollRight = scrollLeft + containerWidth
    
    // 如果标签页不在可视区域内，则滚动到合适位置
    if (tabLeftRelativeToContainer < scrollLeft) {
      // 标签页在左侧不可见，滚动到标签页开始位置
      container.scrollTo({
        left: tabLeftRelativeToContainer - 20, // 留一点边距
        behavior: 'smooth'
      })
    } else if (tabRightRelativeToContainer > scrollRight) {
      // 标签页在右侧不可见，滚动使标签页完全可见
      container.scrollTo({
        left: tabLeftRelativeToContainer - containerWidth + tabRect.width + 20, // 留一点边距
        behavior: 'smooth'
      })
    }
  }
}

// 自动切换标签页并滚动（用于流式更新时）
const switchToTabWithScroll = (tab: string) => {
  activeTab.value = tab as any
  nextTick(() => {
    scrollToActiveTab(tab)
  })
}

// 监听activeTab变化，标记为已查看
const handleTabChange = (tab: string) => {
  activeTab.value = tab as any
  markTabAsViewed(tab)
  // 滚动到目标标签页
  nextTick(() => {
    scrollToActiveTab(tab)
  })
}

// 计算当前语言的提示词 - 可写的computed
const currentGeneratedPrompt = computed({
  get: () => {
    // 如果有GPrompt生成的最终提示词，优先使用
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
    // 更新数据到store
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

// 检查是否有任何内容可以显示
const hasAnyContent = computed(() => {
  return true // 始终显示，以便用户可以输入需求描述
})

// 检查是否有对话数据
const hasConversationData = computed(() => {
  return promptStore.chatMessages && promptStore.chatMessages.length > 0
})

// 添加关键指令
const addThinkingPoint = () => {
  if (promptStore.promptData.thinkingPoints) {
    promptStore.promptData.thinkingPoints.push('')
  }
}

// 删除关键指令
const removeThinkingPoint = (index: number) => {
  if (promptStore.promptData.thinkingPoints && promptStore.promptData.thinkingPoints.length > 1) {
    promptStore.promptData.thinkingPoints.splice(index, 1)
  }
}

// 添加优化建议
const addAdviceItem = () => {
  if (promptStore.promptData.advice) {
    promptStore.promptData.advice.push('')
  }
}

// 删除优化建议
const removeAdviceItem = (index: number) => {
  if (promptStore.promptData.advice && promptStore.promptData.advice.length > 1) {
    promptStore.promptData.advice.splice(index, 1)
  }
}

// 清理AI响应中的markdown代码块标记和多余描述
const cleanAIResponse = (response: string): string => {
  return response
    .replace(/^```[\w]*\n?/gm, '')  // 移除开头的 ```xml 或 ```
    .replace(/\n?```$/gm, '')       // 移除结尾的 ```
    // 移除常见的AI介绍性文字
    .replace(/^Here is the.*?translation.*?:\s*/i, '')
    .replace(/^Here is the.*?converted.*?:\s*/i, '')
    .replace(/^Here is.*?:\s*/i, '')
    .replace(/^以下是.*?翻译.*?：\s*/i, '')
    .replace(/^以下是.*?转换.*?：\s*/i, '')
    .replace(/^以下是.*?：\s*/i, '')
    .replace(/^.*?翻译结果.*?：\s*/i, '')
    .replace(/^.*?转换结果.*?：\s*/i, '')
    .trim()
}

// 转换状态管理
const isConvertingFormat = ref(false)  // 格式转换loading
const isConvertingLanguage = ref(false)  // 语言转换loading

// 执行模式管理 - isAutoMode 现在在 promptStore 中管理
const isExecuting = ref(false)

// 格式和语言状态管理
const formatState = ref<'markdown' | 'xml'>('markdown')  // 当前格式状态
const languageState = ref<'zh' | 'en'>('zh')  // 当前语言状态

// 备份内容，用于格式和语言切换
const backupContent = ref({
  markdown_zh: '',  // markdown中文版
  markdown_en: '',  // markdown英文版
  xml_zh: '',       // xml中文版
  xml_en: ''        // xml英文版
})

// 备份当前内容
const backupCurrentContent = () => {
  const currentContent = currentGeneratedPrompt.value
  if (currentContent) {
    const key = `${formatState.value}_${languageState.value}` as keyof typeof backupContent.value
    backupContent.value[key] = currentContent
  }
}

// 获取指定格式和语言的内容
const getContentByFormatAndLanguage = (format: 'markdown' | 'xml', language: 'zh' | 'en'): string => {
  const key = `${format}_${language}` as keyof typeof backupContent.value
  return backupContent.value[key]
}

// 初始化内容时备份markdown中文版
const initializeContent = () => {
  if (currentGeneratedPrompt.value && !backupContent.value.markdown_zh) {
    backupContent.value.markdown_zh = currentGeneratedPrompt.value
    formatState.value = 'markdown'
    languageState.value = 'zh'
  }
}

// 执行完整工作流（自动模式）
const executeFullWorkflow = async () => {
  if (!promptStore.promptData.requirementReport.trim()) {
    notificationStore.warning('请先输入需求描述')
    return
  }
  
  try {
    isExecuting.value = true
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('请先配置AI模型')
      return
    }
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    const requirementReport = promptStore.promptData.requirementReport
    
    // 步骤1: 生成关键指令
    promptStore.currentExecutionStep = 'thinking'
    let step1Content = ''
    let step1Initialized = false
    const onStep1Update = (chunk: string) => {
      step1Content += chunk
      
      // 首次收到数据时立即切换标签页
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
    
    // 步骤2: 生成初始提示词
    promptStore.currentExecutionStep = 'initial'
    let step2Initialized = false
    const onStep2Update = (chunk: string) => {
      // 首次收到数据时立即切换标签页
      if (!step2Initialized && chunk.trim()) {
        step2Initialized = true
        promptStore.promptData.initialPrompt = '正在生成...'
        switchToTabWithScroll('initial')
      }
      
      // 如果已经初始化，追加内容；否则设置内容
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
    
    // 步骤3: 获取优化建议
    promptStore.currentExecutionStep = 'advice'
    let step3Content = ''
    let step3Initialized = false
    const onStep3Update = (chunk: string) => {
      step3Content += chunk
      
      // 首次收到数据时立即切换标签页
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
    
    // 步骤4: 生成最终提示词
    promptStore.currentExecutionStep = 'final'
    let step4Initialized = false
    const onStep4Update = (chunk: string) => {
      // 首次收到数据时立即切换标签页
      if (!step4Initialized && chunk.trim()) {
        step4Initialized = true
        promptStore.promptData.generatedPrompt = '正在生成...'
        switchToTabWithScroll('zh')
      }
      
      // 如果已经初始化，追加内容；否则设置内容
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
    
    // 重置格式和语言状态，清空缓存
    formatState.value = 'markdown'
    languageState.value = 'zh'
    backupContent.value = {
      markdown_zh: finalPrompt,
      markdown_en: '',
      xml_zh: '',
      xml_en: ''
    }
    
    // 自动切换到最终提示词标签页
    switchToTabWithScroll('zh')
    
  } catch (error) {
    notificationStore.error('自动生成提示词失败，请重试')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 执行步骤1：生成关键指令
const executeThinkingPoints = async () => {
  if (!promptStore.promptData.requirementReport.trim()) {
    notificationStore.warning('请先输入需求报告')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'thinking'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('请先配置AI模型')
      return
    }
    
    
    // 导入PromptGeneratorService
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新状态
    let streamContent = ''
    let hasInitialized = false
    
    // 设置流式回调函数
    const onStreamUpdate = (chunk: string) => {
      streamContent += chunk
      
      // 首次收到有效数据时，立即切换到该标签页并初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.thinkingPoints = ['正在生成...']
        switchToTabWithScroll('thinking')
      }
      
      // 实时解析并更新关键指令
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
    
    // 最终确保数据正确性
    promptStore.promptData.thinkingPoints = thinkingPoints
    
  } catch (error) {
    notificationStore.error('生成关键指令失败，请重试')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 执行步骤2：生成初始提示词
const executeInitialPrompt = async () => {
  if (!promptStore.promptData.thinkingPoints || promptStore.promptData.thinkingPoints.length === 0) {
    notificationStore.warning('请先生成关键指令')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'initial'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('请先配置AI模型')
      return
    }
    
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新状态
    let hasInitialized = false
    
    // 设置流式回调函数
    const onStreamUpdate = (chunk: string) => {
      // 首次收到有效数据时，立即切换到该标签页并初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.initialPrompt = '正在生成...'
        switchToTabWithScroll('initial')
      }
      
      // 如果已经初始化，追加内容；否则设置内容
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
    
    // 最终确保数据正确性
    promptStore.promptData.initialPrompt = initialPrompt
    
  } catch (error) {
    notificationStore.error('生成初始提示词失败，请重试')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 执行步骤3：生成优化建议
const executeAdvice = async () => {
  if (!promptStore.promptData.initialPrompt) {
    notificationStore.error('请先生成初始提示词')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'advice'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('请先配置AI模型')
      return
    }
    
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新状态
    let streamContent = ''
    let hasInitialized = false
    
    // 设置流式回调函数
    const onStreamUpdate = (chunk: string) => {
      streamContent += chunk
      
      // 首次收到有效数据时，立即切换到该标签页并初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.advice = ['正在生成...']
        switchToTabWithScroll('advice')
      }
      
      // 实时解析并更新优化建议
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
    
    // 最终确保数据正确性
    promptStore.promptData.advice = advice
    
  } catch (error) {
    notificationStore.error('生成优化建议失败，请重试')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 执行步骤4：生成最终提示词
const executeFinalPrompt = async () => {
  if (!promptStore.promptData.initialPrompt || !promptStore.promptData.advice) {
    notificationStore.error('请先完成前面的步骤')
    return
  }
  
  try {
    isExecuting.value = true
    promptStore.currentExecutionStep = 'final'
    
    const provider = settingsStore.getCurrentProvider()
    const model = settingsStore.getCurrentModel()
    
    if (!provider || !model) {
      notificationStore.error('请先配置AI模型')
      return
    }
    
    
    const promptGeneratorService = PromptGeneratorService.getInstance()
    
    // 初始化流式更新状态
    let hasInitialized = false
    
    // 设置流式回调函数
    const onStreamUpdate = (chunk: string) => {
      // 首次收到有效数据时，立即切换到该标签页并初始化
      if (!hasInitialized && chunk.trim()) {
        hasInitialized = true
        promptStore.promptData.generatedPrompt = '正在生成...'
        switchToTabWithScroll('zh')
      }
      
      // 如果已经初始化，追加内容；否则设置内容
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
    
    // 最终确保数据正确性
    promptStore.promptData.generatedPrompt = finalPrompt
    
    // 重置格式和语言状态，清空缓存
    formatState.value = 'markdown'
    languageState.value = 'zh'
    backupContent.value = {
      markdown_zh: finalPrompt,
      markdown_en: '',
      xml_zh: '',
      xml_en: ''
    }
    
  } catch (error) {
    notificationStore.error('生成最终提示词失败，请重试')
  } finally {
    isExecuting.value = false
    promptStore.currentExecutionStep = null
  }
}

// 智能格式转换 (Markdown ⇄ XML)
const toggleFormat = async () => {
  if (!currentGeneratedPrompt.value) return
  
  try {
    isConvertingFormat.value = true
    
    // 备份当前内容
    backupCurrentContent()
    
    const targetFormat = formatState.value === 'markdown' ? 'xml' : 'markdown'
    const currentLanguage = languageState.value
    
    // 检查是否已有目标格式的缓存内容
    const cachedContent = getContentByFormatAndLanguage(targetFormat, currentLanguage)
    
    if (cachedContent) {
      // 有缓存，直接使用
      promptStore.promptData.generatedPrompt = cachedContent
      formatState.value = targetFormat
    } else {
      // 没有缓存，需要AI转换
      const provider = settingsStore.getCurrentProvider()
      const model = settingsStore.getCurrentModel()
      
      if (!provider || !model) {
        notificationStore.error('请先配置AI模型')
        return
      }

      let conversionPrompt = ''
      if (targetFormat === 'xml') {
        conversionPrompt = `将以下提示词转换为XML格式，使用语义化标签如 <role>、<task>、<constraints> 等组织结构。直接输出XML内容，不要添加说明文字：

${currentGeneratedPrompt.value}`
      } else {
        conversionPrompt = `将以下XML格式提示词转换为Markdown格式，使用标题、列表等语法。直接输出Markdown内容，不要添加说明文字：

${currentGeneratedPrompt.value}`
      }

      const response = await aiService.callAI([{
        role: 'user',
        content: conversionPrompt
      }], provider, model.id)

      const cleanedResponse = cleanAIResponse(response)
      promptStore.promptData.generatedPrompt = cleanedResponse
      
      // 缓存转换结果
      const cacheKey = `${targetFormat}_${currentLanguage}` as keyof typeof backupContent.value
      backupContent.value[cacheKey] = cleanedResponse
      
      formatState.value = targetFormat
    }
    
  } catch (error) {
    notificationStore.error('格式转换失败，请重试')
  } finally {
    isConvertingFormat.value = false
  }
}

// 智能语言转换 (中文 ⇄ 英文)
const toggleLanguage = async () => {
  if (!currentGeneratedPrompt.value) return
  
  try {
    isConvertingLanguage.value = true
    
    // 备份当前内容
    backupCurrentContent()
    
    const targetLanguage = languageState.value === 'zh' ? 'en' : 'zh'
    const currentFormat = formatState.value
    
    // 检查是否已有目标语言的缓存内容
    const cachedContent = getContentByFormatAndLanguage(currentFormat, targetLanguage)
    
    if (cachedContent) {
      // 有缓存，直接使用
      promptStore.promptData.generatedPrompt = cachedContent
      languageState.value = targetLanguage
    } else {
      // 没有缓存，需要AI翻译
      const provider = settingsStore.getCurrentProvider()
      const model = settingsStore.getCurrentModel()
      
      if (!provider || !model) {
        notificationStore.error('请先配置AI模型')
        return
      }

      let translationPrompt = ''
      if (targetLanguage === 'en') {
        translationPrompt = `Translate the following Chinese AI system prompt to English. Keep all technical terms and formatting intact. Output only the translated content without any explanations:

${currentGeneratedPrompt.value}`
      } else {
        translationPrompt = `将以下英文AI系统提示词翻译为中文，保持所有技术术语和格式不变。直接输出翻译内容，不要添加说明文字：

${currentGeneratedPrompt.value}`
      }

      const response = await aiService.callAI([{
        role: 'user',
        content: translationPrompt
      }], provider, model.id)

      const cleanedResponse = cleanAIResponse(response)
      promptStore.promptData.generatedPrompt = cleanedResponse
      
      // 缓存翻译结果
      const cacheKey = `${currentFormat}_${targetLanguage}` as keyof typeof backupContent.value
      backupContent.value[cacheKey] = cleanedResponse
      
      languageState.value = targetLanguage
    }
    
  } catch (error) {
    notificationStore.error('语言转换失败，请重试')
  } finally {
    isConvertingLanguage.value = false
  }
}

// 复制状态管理
const copyStatus = ref<{[key: string]: boolean}>({})

// 复制到剪贴板
const copyToClipboard = async (text: string, key: string = 'default') => {
  try {
    await navigator.clipboard.writeText(text)
    
    // 显示成功状态
    copyStatus.value[key] = true
    
    // 2秒后重置状态
    setTimeout(() => {
      copyStatus.value[key] = false
    }, 2000)
    
  } catch (error) {
    notificationStore.error('复制失败，请重试')
  }
}

// 监听对话清空，重置活动标签页和相关状态
watch(() => promptStore.chatMessages.length, (newLength) => {
  if (newLength === 0) {
    switchToTabWithScroll('report')
    // 重置所有状态
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

// 监听数据变化，自动切换到新生成的内容
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
  // 只有当有真实内容时才切换标签页
  if (newVal) {
    let hasContent = false
    if (typeof newVal === 'string') {
      hasContent = newVal.trim().length > 0
    } else if (typeof newVal === 'object') {
      hasContent = Boolean((newVal.zh && newVal.zh.trim().length > 0) || (newVal.en && newVal.en.trim().length > 0))
    }
    
    if (hasContent) {
      // 初始化状态和备份
      initializeContent()
      newContentTabs.value.add('zh')
      switchToTabWithScroll('zh')
    }
  }
})
</script>

<style scoped>
/* 隐藏水平滚动条但保持滚动功能 */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>