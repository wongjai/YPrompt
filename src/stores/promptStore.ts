import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface MessageAttachment {
  id: string
  name: string
  type: 'image' | 'document' | 'audio' | 'video'
  mimeType: string
  size: number
  data: string // Base64編碼的文件數據
  url?: string // 用於預覽的臨時URL（如果需要）
}

export interface ChatMessage {
  id?: string  // 消息ID，用於更新消息
  type: 'user' | 'ai'
  content: string
  timestamp: string
  isProgress?: boolean  // 標記是否爲進度消息
  isDeleted?: boolean   // 標記是否被刪除
  isEditing?: boolean   // 標記是否正在編輯
  originalContent?: string  // 編輯時保存原始內容
  attachments?: MessageAttachment[]  // 附件列表
}

export interface CollectedData {
  taskDefinition: string
  context: string
  outputFormat: string
  qualityCriteria: string
  executionParams: string
}

export interface PromptData {
  requirementReport: string // 需求總結報告
  thinkingPoints?: string[] // GPrompt關鍵指令
  initialPrompt?: string    // GPrompt初始提示詞
  advice?: string[]         // GPrompt優化建議
  generatedPrompt: string | {
    zh: string
    en: string
  }
  optimizedPrompt: {
    zh: string
    en: string
  }
}

export const usePromptStore = defineStore('prompt', () => {
  const currentStep = ref(0)
  const currentStepUserMessages = ref(0) // 當前步驟的用戶消息計數
  const chatMessages = ref<ChatMessage[]>([])
  const isTyping = ref(false)
  const isGenerating = ref(false)
  const showPreview = ref(false)
  const currentLanguage = ref<'zh' | 'en'>('zh')
  const isAutoMode = ref(true) // 執行模式：true=自動，false=手動
  const isInitialized = ref(false) // 添加全局初始化標誌
  const currentExecutionStep = ref<'report' | 'thinking' | 'initial' | 'advice' | 'final' | null>(null) // 當前執行步驟狀態

  const collectedData = ref<CollectedData>({
    taskDefinition: '',
    context: '',
    outputFormat: '',
    qualityCriteria: '',
    executionParams: ''
  })

  const promptData = ref<PromptData>({
    requirementReport: '', // 新增：需求總結報告
    generatedPrompt: {
      zh: '',
      en: ''
    },
    optimizedPrompt: {
      zh: '',
      en: ''
    }
  })

  const steps = [
    {
      id: 'taskDefinition',
      title: '任務定義',
      description: '明確AI助手的核心任務和主要功能'
    },
    {
      id: 'context',
      title: '使用場景',
      description: '瞭解AI的使用環境和目標用戶'
    },
    {
      id: 'outputFormat',
      title: '輸出格式',
      description: '定義AI回答的結構、格式和風格'
    },
    {
      id: 'qualityCriteria',
      title: '質量要求',
      description: '確定成功標準和質量期望'
    },
    {
      id: 'executionParams',
      title: '工作方式',
      description: '設定AI的思考方式和互動風格'
    },
    {
      id: 'optimization',
      title: '最終確認',
      description: '確認信息完整性並生成提示詞'
    }
  ]

  const addMessage = (type: 'user' | 'ai', content: string, attachments?: MessageAttachment[], options?: { id?: string, isProgress?: boolean }) => {
    const message: ChatMessage = {
      id: options?.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date().toISOString(),
      isProgress: options?.isProgress || false,
      attachments: attachments && attachments.length > 0 ? attachments : []
    }
    
    console.log('[PromptStore] Adding message:', {
      type: message.type,
      hasContent: !!message.content,
      attachmentCount: message.attachments?.length || 0,
      attachments: message.attachments?.map(att => ({ name: att.name, type: att.type, size: att.size, hasData: !!att.data }))
    })
    
    chatMessages.value.push(message)
    
    // 如果是用戶消息，增加當前步驟計數
    if (type === 'user') {
      currentStepUserMessages.value++
    }
  }

  // 添加或更新進度消息
  const addOrUpdateProgressMessage = (content: string, messageId: string = 'progress_message') => {
    const existingIndex = chatMessages.value.findIndex(msg => msg.id === messageId)
    
    if (existingIndex !== -1) {
      // 更新現有消息
      chatMessages.value[existingIndex].content = content
      chatMessages.value[existingIndex].timestamp = new Date().toISOString()
    } else {
      // 添加新的進度消息
      addMessage('ai', content, undefined, { id: messageId, isProgress: true })
    }
  }

  const clearChat = () => {
    chatMessages.value = []
    currentStep.value = 0
    currentStepUserMessages.value = 0
    showPreview.value = false
    isInitialized.value = false // 重置初始化標誌
    currentExecutionStep.value = null // 重置執行步驟狀態
    collectedData.value = {
      taskDefinition: '',
      context: '',
      outputFormat: '',
      qualityCriteria: '',
      executionParams: ''
    }
    // 完全重置promptData，保持初始狀態
    promptData.value = {
      requirementReport: '', // 也清空需求描述，讓用戶重新輸入
      generatedPrompt: {
        zh: '',
        en: ''
      },
      optimizedPrompt: {
        zh: '',
        en: ''
      }
    }
  }

  const nextStep = () => {
    if (currentStep.value < steps.length - 1) {
      currentStep.value++
      currentStepUserMessages.value = 0 // 重置當前步驟用戶消息計數
    }
  }

  const updateCollectedData = (stepId: string, value: string) => {
    if (stepId in collectedData.value) {
      const current = collectedData.value[stepId as keyof CollectedData]
      collectedData.value[stepId as keyof CollectedData] = current ? current + '\n' + value : value
    }
  }

  // 消息操作方法
  const deleteMessage = (messageId: string) => {
    const message = chatMessages.value.find(msg => msg.id === messageId)
    if (message) {
      message.isDeleted = true
    }
  }

  const startEditMessage = (messageId: string) => {
    const message = chatMessages.value.find(msg => msg.id === messageId)
    if (message) {
      message.isEditing = true
      message.originalContent = message.content
    }
  }

  const saveEditMessage = (messageId: string, newContent: string) => {
    const message = chatMessages.value.find(msg => msg.id === messageId)
    if (message) {
      message.content = newContent.trim()
      message.isEditing = false
      message.originalContent = undefined
      message.timestamp = new Date().toISOString()
    }
  }

  const cancelEditMessage = (messageId: string) => {
    const message = chatMessages.value.find(msg => msg.id === messageId)
    if (message && message.originalContent !== undefined) {
      message.content = message.originalContent
      message.isEditing = false
      message.originalContent = undefined
    }
  }

  const updateMessage = (messageId: string, newContent: string) => {
    const message = chatMessages.value.find(msg => msg.id === messageId)
    if (message) {
      message.content = newContent
      message.timestamp = new Date().toISOString()
    }
  }

  // 獲取有效消息（未被刪除的消息），用於API調用
  const getValidMessages = (): ChatMessage[] => {
    return chatMessages.value.filter(msg => !msg.isDeleted && !msg.isProgress)
  }

  return {
    currentStep,
    currentStepUserMessages,
    chatMessages,
    isTyping,
    isGenerating,
    showPreview,
    currentLanguage,
    isAutoMode,
    isInitialized,
    currentExecutionStep,
    collectedData,
    promptData,
    steps,
    addMessage,
    addOrUpdateProgressMessage,
    clearChat,
    nextStep,
    updateCollectedData,
    // 消息操作方法
    deleteMessage,
    startEditMessage,
    saveEditMessage,
    cancelEditMessage,
    updateMessage,
    getValidMessages
  }
})