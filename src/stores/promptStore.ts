import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface MessageAttachment {
  id: string
  name: string
  type: 'image' | 'document' | 'audio' | 'video'
  mimeType: string
  size: number
  data: string // Base64编码的文件数据
  url?: string // 用于预览的临时URL（如果需要）
}

export interface ChatMessage {
  id?: string  // 消息ID，用于更新消息
  type: 'user' | 'ai'
  content: string
  timestamp: string
  isProgress?: boolean  // 标记是否为进度消息
  isDeleted?: boolean   // 标记是否被删除
  isEditing?: boolean   // 标记是否正在编辑
  originalContent?: string  // 编辑时保存原始内容
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
  requirementReport: string // 需求总结报告
  thinkingPoints?: string[] // GPrompt关键指令
  initialPrompt?: string    // GPrompt初始提示词
  advice?: string[]         // GPrompt优化建议
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
  const currentStepUserMessages = ref(0) // 当前步骤的用户消息计数
  const chatMessages = ref<ChatMessage[]>([])
  const isTyping = ref(false)
  const isGenerating = ref(false)
  const showPreview = ref(false)
  const currentLanguage = ref<'zh' | 'en'>('zh')
  const isAutoMode = ref(true) // 执行模式：true=自动，false=手动
  const isInitialized = ref(false) // 添加全局初始化标志
  const currentExecutionStep = ref<'report' | 'thinking' | 'initial' | 'advice' | 'final' | null>(null) // 当前执行步骤状态

  const collectedData = ref<CollectedData>({
    taskDefinition: '',
    context: '',
    outputFormat: '',
    qualityCriteria: '',
    executionParams: ''
  })

  const promptData = ref<PromptData>({
    requirementReport: '', // 新增：需求总结报告
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
      title: '任务定义',
      description: '明确AI助手的核心任务和主要功能'
    },
    {
      id: 'context',
      title: '使用场景',
      description: '了解AI的使用环境和目标用户'
    },
    {
      id: 'outputFormat',
      title: '输出格式',
      description: '定义AI回答的结构、格式和风格'
    },
    {
      id: 'qualityCriteria',
      title: '质量要求',
      description: '确定成功标准和质量期望'
    },
    {
      id: 'executionParams',
      title: '工作方式',
      description: '设定AI的思考方式和互动风格'
    },
    {
      id: 'optimization',
      title: '最终确认',
      description: '确认信息完整性并生成提示词'
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
    
    // 如果是用户消息，增加当前步骤计数
    if (type === 'user') {
      currentStepUserMessages.value++
    }
  }

  // 添加或更新进度消息
  const addOrUpdateProgressMessage = (content: string, messageId: string = 'progress_message') => {
    const existingIndex = chatMessages.value.findIndex(msg => msg.id === messageId)
    
    if (existingIndex !== -1) {
      // 更新现有消息
      chatMessages.value[existingIndex].content = content
      chatMessages.value[existingIndex].timestamp = new Date().toISOString()
    } else {
      // 添加新的进度消息
      addMessage('ai', content, undefined, { id: messageId, isProgress: true })
    }
  }

  const clearChat = () => {
    chatMessages.value = []
    currentStep.value = 0
    currentStepUserMessages.value = 0
    showPreview.value = false
    isInitialized.value = false // 重置初始化标志
    currentExecutionStep.value = null // 重置执行步骤状态
    collectedData.value = {
      taskDefinition: '',
      context: '',
      outputFormat: '',
      qualityCriteria: '',
      executionParams: ''
    }
    // 完全重置promptData，保持初始状态
    promptData.value = {
      requirementReport: '', // 也清空需求描述，让用户重新输入
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
      currentStepUserMessages.value = 0 // 重置当前步骤用户消息计数
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

  // 获取有效消息（未被删除的消息），用于API调用
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