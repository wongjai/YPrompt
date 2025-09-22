<template>
  <div class="bg-white rounded-lg shadow-sm flex flex-col h-full overflow-hidden">
    <div class="p-4 border-b border-gray-200 flex-shrink-0">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="font-semibold text-gray-800">AI助手对话</h2>
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
          
          <!-- 流式开关 -->
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-600">流式:</span>
            <button
              @click="toggleStreamMode"
              :class="[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                isStreamMode 
                  ? 'bg-blue-500' 
                  : 'bg-gray-300'
              ]"
              :title="isStreamMode ? '关闭流式模式' : '开启流式模式'"
            >
              <span
                :class="[
                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                  isStreamMode ? 'translate-x-5' : 'translate-x-1'
                ]"
              />
            </button>
          </div>
          
          <button
            @click="clearChat"
            class="text-gray-500 hover:text-gray-700 text-sm"
          >
            重新开始
          </button>
        </div>
      </div>
    </div>

    <!-- Chat Messages - 固定高度，内部滚动 -->
    <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" :style="{ maxHeight: shouldShowQuickReplies ? 'calc(100vh - 380px)' : 'calc(100vh - 300px)' }">
      <div
        v-for="(message, index) in promptStore.chatMessages"
        :key="message.id || index"
        :class="message.type === 'user' ? 'justify-end' : 'justify-start'"
        class="flex"
      >
        <div
          :class="[
            message.type === 'user' 
              ? 'bg-blue-500 text-white' 
              : message.isProgress 
                ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                : 'bg-gray-100 text-gray-800',
            message.isProgress && 'animate-pulse'
          ]"
          class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg transition-all duration-300"
        >
          <div
            v-if="message.type === 'ai'"
            v-html="renderMarkdown(message.content)"
            class="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-800"
          ></div>
          <div 
            v-else 
            v-html="renderUserMessage(message.content)"
            class="text-white [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-white [&_h5]:text-sm [&_h5]:font-bold [&_h5]:text-white [&_h6]:text-sm [&_h6]:font-bold [&_h6]:text-white [&_p]:text-white [&_p]:mb-2 [&_strong]:font-bold [&_strong]:text-white [&_b]:font-bold [&_b]:text-white [&_em]:italic [&_em]:text-white [&_i]:italic [&_i]:text-white [&_ul]:list-disc [&_ul]:list-inside [&_ul]:text-white [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:text-white [&_ol]:mb-2 [&_li]:text-white [&_li]:mb-1 [&_code]:bg-blue-600 [&_code]:text-blue-100 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_pre]:bg-blue-600 [&_pre]:text-blue-100 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_a]:text-blue-200 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-blue-300 [&_blockquote]:pl-2 [&_blockquote]:text-blue-100"
          ></div>
        </div>
      </div>
      
      <!-- Typing indicator -->
      <div v-if="promptStore.isTyping" class="flex justify-start">
        <div class="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
          <div class="flex space-x-1">
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 快速回复选项 - 独立区域，向上扩展 -->
    <div v-if="shouldShowQuickReplies" class="px-6 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div class="text-xs text-gray-500 mb-2">快速回复：</div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="reply in quickReplies"
          :key="reply"
          @click="selectQuickReply(reply)"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
        >
          {{ reply }}
        </button>
      </div>
    </div>

    <!-- Input Area - 固定在底部 -->
    <div ref="inputContainer" class="p-6 border-t border-gray-200 flex-shrink-0">
      <div class="flex space-x-2">
        <textarea
          ref="textareaRef"
          v-model="userInput"
          @keydown="handleKeydown"
          @input="adjustTextareaHeight"
          @focus="showQuickReplies = true"
          :placeholder="shouldShowQuickReplies ? '输入或点击上方快速回复...' : '请描述您的需求（Shift+Enter换行）'"
          :disabled="promptStore.isTyping || promptStore.isGenerating"
          :style="{ minHeight: '48px', maxHeight: maxTextareaHeight }"
          class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-base resize-none overflow-y-auto transition-all duration-200"
          rows="1"
        ></textarea>
        <button
          @click="sendMessage"
          :disabled="!userInput.trim() || promptStore.isTyping || promptStore.isGenerating"
          class="px-5 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue'
import { usePromptStore } from '@/stores/promptStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { AIGuideService } from '@/services/aiGuideService'
import { AIService } from '@/services/aiService'
import { PromptGeneratorService } from '@/services/promptGeneratorService'
import { getPromptGeneratorConfig } from '@/config/promptGenerator'
import { ArrowRight, ChevronUp } from 'lucide-vue-next'
import { marked } from 'marked'

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

// 模块配置（便于将来封装）
const config = getPromptGeneratorConfig()

const promptStore = usePromptStore()
const settingsStore = useSettingsStore()
const notificationStore = useNotificationStore()
const aiGuideService = AIGuideService.getInstance()
const userInput = ref('')
const chatContainer = ref<HTMLElement>()
const inputContainer = ref<HTMLElement>()
const textareaRef = ref<HTMLTextAreaElement>()

// 流式模式状态
const isStreamMode = ref(true) // 默认开启流式模式

// 响应式设计配置
const isMobileDevice = ref(false)
const maxTextareaHeight = computed(() => {
  // PC端最多5行，移动端最多3行，每行约24px
  const maxLines = isMobileDevice.value ? 3 : 5
  return `${maxLines * 24 + 24}px` // 24px行高 + 24px padding
})

// 检测设备类型
const detectMobileDevice = () => {
  isMobileDevice.value = window.innerWidth <= 768
}

// 自动调整textarea高度
const adjustTextareaHeight = () => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  // 获取当前高度
  const currentHeight = parseInt(getComputedStyle(textarea).height)
  
  // 临时重置高度以获取正确的scrollHeight
  const originalHeight = textarea.style.height
  textarea.style.height = 'auto'
  
  // 计算新高度
  const scrollHeight = textarea.scrollHeight
  const maxHeight = parseInt(maxTextareaHeight.value)
  const minHeight = 48
  
  // 恢复原来的高度
  textarea.style.height = originalHeight
  
  // 只在需要增加高度时才调整，或者当前高度小于最小高度时
  const idealHeight = Math.min(scrollHeight, maxHeight)
  if (idealHeight > currentHeight || currentHeight < minHeight) {
    textarea.style.height = `${idealHeight}px`
  }
}

// 快速回复功能
const showQuickReplies = ref(false)
const quickReplies = ref(config.quickReplies)

// 切换流式模式
const toggleStreamMode = () => {
  isStreamMode.value = !isStreamMode.value
  // 可以选择将状态保存到本地存储
  localStorage.setItem('yprompt_stream_mode', JSON.stringify(isStreamMode.value))
}

// 计算是否应该显示快捷回复（从第二个问题开始）
const shouldShowQuickReplies = computed(() => {
  // 对话消息数大于2（AI初始问题 + 用户第一次回答）时才显示快捷回复
  return promptStore.chatMessages.length >= 2 && showQuickReplies.value
})

// 点击外部区域隐藏快捷回复
const handleClickOutside = (event: MouseEvent) => {
  if (inputContainer.value && !inputContainer.value.contains(event.target as Node)) {
    showQuickReplies.value = false
  }
}

// Markdown渲染函数
const renderMarkdown = (content: string): string => {
  try {
    const result = marked(content, {
      breaks: true,
      gfm: true
    })
    // 确保返回字符串类型
    return typeof result === 'string' ? result : String(result)
  } catch (error) {
    return content // 降级为纯文本
  }
}

// 用户消息渲染函数 - 支持换行和基础markdown
const renderUserMessage = (content: string): string => {
  try {
    // 检查是否包含明显的markdown语法
    const hasMarkdown = /^#|^\*\*|^##|^\*|^-|\*\*.*\*\*|^1\.|```/.test(content) || 
                       content.includes('**') || content.includes('##') || content.includes('# ')
    
    if (hasMarkdown || content.length > 50) { // 长文本默认用markdown渲染
      // 使用markdown渲染
      const result = marked(content, {
        breaks: true,
        gfm: true
      })
      return typeof result === 'string' ? result : String(result)
    } else {
      // 简单文本只处理换行符
      return content.replace(/\n/g, '<br>')
    }
  } catch (error) {
    // 错误时使用markdown渲染作为兜底
    try {
      const result = marked(content, { breaks: true, gfm: true })
      return typeof result === 'string' ? result : String(result)
    } catch {
      return content.replace(/\n/g, '<br>')
    }
  }
}

// AI智能判断检测函数
const checkAIDecision = (response: string): boolean => {
  try {
    // 检查是否包含评估标签
    const assessmentMatch = response.match(/<ASSESSMENT>([\s\S]*?)<\/ASSESSMENT>/i)
    if (!assessmentMatch) {
      return false // 没有评估标签，继续对话
    }
    
    const assessmentContent = assessmentMatch[1]
    
    // 提取DECISION字段
    const decisionMatch = assessmentContent.match(/DECISION:\s*\[([^\]]+)\]/i)
    if (decisionMatch) {
      const decision = decisionMatch[1].trim().toUpperCase()
      return decision === 'END_NOW'
    }
    
    return false
  } catch (error) {
    return false // 解析错误时继续对话
  }
}

// 清理AI响应中的评估标签
const cleanAIResponse = (response: string): string => {
  try {
    // 移除完整的评估标签及其内容
    let cleaned = response.replace(/<ASSESSMENT>[\s\S]*?<\/ASSESSMENT>/gi, '').trim()
    
    // 处理流式过程中不完整的评估标签
    // 如果发现开始标签但没有结束标签，截断到开始标签之前
    const assessmentStart = cleaned.indexOf('<ASSESSMENT>')
    if (assessmentStart !== -1) {
      cleaned = cleaned.substring(0, assessmentStart).trim()
    }
    
    // 处理其他可能的不完整标签模式
    const patterns = [
      /<ASSE[^>]*$/i,     // 不完整的开始标签
      /<\/ASSE[^>]*$/i,   // 不完整的结束标签
      /\n\n<ASSE/i,       // 换行后的开始标签
      /CONTEXT:/i,        // 评估内容的关键词
      /TASK:/i,
      /FORMAT:/i,
      /QUALITY:/i,
      /TURN_COUNT:/i,
      /DECISION:/i,
      /CONFIDENCE:/i
    ]
    
    for (const pattern of patterns) {
      const match = cleaned.search(pattern)
      if (match !== -1) {
        cleaned = cleaned.substring(0, match).trim()
        break
      }
    }
    
    return cleaned
  } catch (error) {
    return response // 清理失败时返回原内容
  }
}

// 初始化对话（模块化设计）
const initializeChat = async () => {
  // 加载流式模式设置
  const savedStreamMode = localStorage.getItem('yprompt_stream_mode')
  if (savedStreamMode) {
    try {
      isStreamMode.value = JSON.parse(savedStreamMode)
    } catch (error) {
      console.error('Failed to parse stream mode setting:', error)
    }
  }
  
  if (promptStore.chatMessages.length === 0 && !promptStore.isInitialized) {
    promptStore.isInitialized = true
    await simulateTyping(config.welcomeMessage, false)
  }
}

// 挂载和卸载事件监听器
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', detectMobileDevice)
  detectMobileDevice() // 初始检测
  // 初始化对话
  initializeChat()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', detectMobileDevice)
})

// 选择快速回复
const selectQuickReply = (reply: string) => {
  userInput.value = reply
  showQuickReplies.value = false
  sendMessage()
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// 监听消息变化，自动滚动
watch(() => promptStore.chatMessages.length, scrollToBottom)
watch(() => promptStore.isTyping, scrollToBottom)

// 流式消息显示
let currentStreamingMessageIndex = -1

// 开始流式消息显示
const startStreamingMessage = () => {
  promptStore.isTyping = false // 停止thinking状态
  promptStore.addMessage('ai', '')
  currentStreamingMessageIndex = promptStore.chatMessages.length - 1
  return currentStreamingMessageIndex
}

// 更新流式消息内容
const updateStreamingMessage = (content: string) => {
  if (currentStreamingMessageIndex >= 0 && currentStreamingMessageIndex < promptStore.chatMessages.length) {
    promptStore.chatMessages[currentStreamingMessageIndex].content = content
  }
}

// 模拟AI打字效果或流式显示
const simulateTyping = async (message: string, isStreaming: boolean = false) => {
  
  if (isStreaming) {
    // 流式显示：立即添加空消息，然后逐步更新
    const messageIndex = promptStore.chatMessages.length
    promptStore.addMessage('ai', '')
    
    // 逐字符显示效果
    for (let i = 0; i <= message.length; i++) {
      promptStore.chatMessages[messageIndex].content = message.substring(0, i)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10))
    }
  } else {
    // 非流式：先显示打字效果，然后显示完整消息
    promptStore.isTyping = true
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100))
    promptStore.isTyping = false
    promptStore.addMessage('ai', message)
  }
}

// 发送消息
const sendMessage = async () => {
  if (!userInput.value.trim()) {
    return
  }
  
  // 检查是否配置了AI模型
  const provider = settingsStore.getCurrentProvider()
  const model = settingsStore.getCurrentModel()
  
  if (!provider || !model) {
    notificationStore.warning('请先在右上角设置中配置AI模型和API密钥')
    return
  }

  const currentInput = userInput.value
  promptStore.addMessage('user', currentInput)
  userInput.value = ''
  showQuickReplies.value = false // 发送后隐藏快速回复
  
  // 立即重置textarea高度到默认值
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = '48px'
  }

  // 立即显示AI正在思考的状态
  promptStore.isTyping = true

  try {
    // 根据用户设置使用流式或非流式模式
    const useStreamMode = isStreamMode.value
    
    if (useStreamMode) {
      // 流式模式
      const aiService = AIService.getInstance()
      
      // 准备流式显示
      let streamingContent = ''
      let messageIndex = -1
      
      // 设置流式回调函数
      aiService.setStreamUpdateCallback((chunk: string) => {
        if (messageIndex === -1) {
          // 第一次收到数据，创建消息
          messageIndex = startStreamingMessage()
        }
        streamingContent += chunk
        // 清理评估标签后显示内容
        const cleanContent = cleanAIResponse(streamingContent)
        updateStreamingMessage(cleanContent)
        scrollToBottom()
      })
      
      // 调用流式API
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '', // 用户消息已在chatMessages中，避免重复
        promptStore.chatMessages,
        provider,
        model.id,
        useStreamMode
      )

      // 清理流式回调
      aiService.clearStreamUpdateCallback()

      // AI智能判断检测
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基于我们的对话，我现在为您生成需求报告：')) {
        setTimeout(async () => {
          await generatePrompt(provider, model.id)
        }, 800)
      }
    } else {
      // 非流式模式
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '', // 用户消息已在chatMessages中，避免重复
        promptStore.chatMessages,
        provider,
        model.id,
        useStreamMode
      )

      // AI智能判断检测
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基于我们的对话，我现在为您生成需求报告：')) {
        // 清理响应中的评估标签，只显示用户可见内容
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
        
        setTimeout(async () => {
          await generatePrompt(provider, model.id)
        }, 800)
      } else {
        // 正常回复 - 清理评估标签
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
      }
    }
  } catch (error: unknown) {
    promptStore.isTyping = false // 重置思考状态
    promptStore.isGenerating = false
    const errorMessage = error instanceof Error ? error.message : String(error)
    notificationStore.error(`发生错误: ${errorMessage}`)
    
    // 清理流式回调（如果是流式模式）
    if (isStreamMode.value) {
      const aiService = AIService.getInstance()
      aiService.clearStreamUpdateCallback()
    }
  }
}


// 生成提示词
const generatePrompt = async (provider: any, modelId: string) => {
  try {

    // 生成需求报告
    const conversationHistory = promptStore.chatMessages.map(msg => ({
      type: msg.type,
      content: msg.content
    }))
    
    // 步骤0: 生成需求报告
    promptStore.isGenerating = true
    promptStore.currentExecutionStep = 'report'
    promptStore.addOrUpdateProgressMessage('🔄 正在基于对话生成需求报告...', 'progress')
    
    // 初始化空的需求报告，准备流式更新
    promptStore.promptData.requirementReport = ''
    
    // 设置流式回调函数
    const onReportStreamUpdate = (chunk: string) => {
      promptStore.promptData.requirementReport += chunk
    }
    
    const requirementReport = await aiGuideService.generateRequirementReportFromConversation(
      conversationHistory,
      provider,
      modelId,
      onReportStreamUpdate
    )
    
    // 最终确保数据正确性
    promptStore.promptData.requirementReport = requirementReport
    promptStore.showPreview = true // 立即显示预览面板
    
    // 检查执行模式
    if (promptStore.isAutoMode) {
      // 自动模式：执行完整流程
      promptStore.addOrUpdateProgressMessage('✅ 需求报告已生成！正在自动执行完整的提示词生成流程...', 'progress')
      
      // 导入PromptGeneratorService
      const promptGeneratorService = PromptGeneratorService.getInstance()
      
      // 步骤1: 获取关键指令
      promptStore.currentExecutionStep = 'thinking'
      promptStore.addOrUpdateProgressMessage('🔄 步骤 1/4: 正在分析需求并生成关键指令...', 'progress')
      const thinkingPoints = await promptGeneratorService.getSystemPromptThinkingPoints(
        requirementReport,
        modelId,
        'zh',
        [],
        provider
      )
      
      promptStore.promptData.thinkingPoints = thinkingPoints
      
      // 步骤2: 生成初始提示词
      promptStore.currentExecutionStep = 'initial'
      promptStore.addOrUpdateProgressMessage('🔄 步骤 2/4: 正在基于关键指令生成初始提示词...', 'progress')
      const initialPrompt = await promptGeneratorService.generateSystemPrompt(
        requirementReport,
        modelId,
        'zh',
        [],
        thinkingPoints,
        provider
      )
      
      promptStore.promptData.initialPrompt = initialPrompt
      
      // 步骤3: 获取优化建议
      promptStore.currentExecutionStep = 'advice'
      promptStore.addOrUpdateProgressMessage('🔄 步骤 3/4: 正在分析提示词并生成优化建议...', 'progress')
      const advice = await promptGeneratorService.getOptimizationAdvice(
        initialPrompt,
        'system',
        modelId,
        'zh',
        [],
        provider
      )
      
      promptStore.promptData.advice = advice
      
      // 步骤4: 生成最终提示词
      promptStore.currentExecutionStep = 'final'
      promptStore.addOrUpdateProgressMessage('🔄 步骤 4/4: 正在应用优化建议，生成最终提示词...', 'progress')
      const finalPrompt = await promptGeneratorService.applyOptimizationAdvice(
        initialPrompt,
        advice,
        'system',
        modelId,
        'zh',
        [],
        provider
      )
      
      // 保存最终结果
      promptStore.promptData.generatedPrompt = finalPrompt
      promptStore.addOrUpdateProgressMessage('✅ 已为您生成高质量的AI提示词！右侧可查看完整的生成过程和最终结果。', 'progress')
      
    } else {
      // 手动模式：只生成需求报告，等待用户手动操作
      promptStore.addOrUpdateProgressMessage('✅ 需求报告已生成！请在右侧预览面板中查看，您可以手动执行每个步骤。', 'progress')
    }
    
    promptStore.isGenerating = false
    promptStore.currentExecutionStep = null
    
  } catch (error: unknown) {
    promptStore.isGenerating = false
    promptStore.currentExecutionStep = null
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    notificationStore.error(`提示词生成失败: ${errorMessage}。请检查网络连接和API配置后重试`)
  }
}

// 清空对话重新开始（复用初始化逻辑）
const clearChat = () => {
  promptStore.clearChat()
  showQuickReplies.value = false // 重置快速回复状态
  
  // 复用初始化逻辑
  setTimeout(async () => {
    await simulateTyping(config.welcomeMessage, false)
    promptStore.isInitialized = true
  }, 500)
}

// 键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      // Shift + Enter: 换行
      return // 让默认行为发生（换行）
    } else {
      // Enter: 发送消息
      event.preventDefault()
      sendMessage()
    }
  }
}
</script>