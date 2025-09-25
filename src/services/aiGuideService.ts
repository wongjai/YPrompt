import { AIService } from './aiService'
import type { ChatMessage } from './aiService'
import type { ProviderConfig } from '@/stores/settingsStore'
import type { MessageAttachment } from '@/stores/promptStore'
import { promptConfigManager } from '@/config/prompts'

export class AIGuideService {
  private static instance: AIGuideService
  private aiService: AIService

  private constructor() {
    this.aiService = AIService.getInstance()
  }

  // 獲取流式模式設置（與ChatInterface保持同步）
  private getStreamMode(): boolean {
    try {
      const savedStreamMode = localStorage.getItem('yprompt_stream_mode')
      return savedStreamMode ? JSON.parse(savedStreamMode) : true // 默認爲true
    } catch (error) {
      return true // 默認爲流式模式
    }
  }

  public static getInstance(): AIGuideService {
    if (!AIGuideService.instance) {
      AIGuideService.instance = new AIGuideService()
    }
    return AIGuideService.instance
  }

  public async generateSimpleResponse(
    userInput: string,
    conversationHistory: Array<{ type: string; content: string; attachments?: MessageAttachment[] }>,
    provider: ProviderConfig,
    modelId: string,
    stream: boolean = false
  ): Promise<string> {
    
    const messages = this.buildSimpleConversationMessages(userInput, conversationHistory)
    
    // 調用AI API
    const response = await this.aiService.callAI(messages, provider, modelId, stream)
    
    if (!response || response.trim() === '') {
      throw new Error('AI API返回了空響應')
    }
    
    return response
  }

  // 構建簡化的對話消息
  private buildSimpleConversationMessages(
    userInput: string,
    conversationHistory: Array<{ type: string; content: string; attachments?: MessageAttachment[] }>
  ): ChatMessage[] {
    console.log('[AIGuideService] Building conversation messages with history:', {
      historyLength: conversationHistory.length,
      hasAttachments: conversationHistory.some(msg => msg.attachments && msg.attachments.length > 0),
      attachmentCounts: conversationHistory.map(msg => ({ type: msg.type, attachments: msg.attachments?.length || 0 }))
    })
    
    // 系統消息：使用內置的用戶引導規則
    const systemMessage: ChatMessage = {
      role: 'system' as const,
      content: promptConfigManager.getUserGuidedPromptRules()
    }

    // 對話歷史
    const conversationMessages: ChatMessage[] = conversationHistory.map(msg => {
      const message: ChatMessage = {
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
        attachments: msg.attachments || []
      }
      
      console.log('[AIGuideService] Processing message:', {
        role: message.role,
        hasAttachments: !!(message.attachments && message.attachments.length > 0),
        attachmentCount: message.attachments?.length || 0,
        attachments: message.attachments?.map(att => ({ name: att.name, type: att.type, size: att.size }))
      })
      
      return message
    })

    // 構建消息數組
    const messages: ChatMessage[] = [systemMessage, ...conversationMessages]
    
    // 只有當userInput不爲空時才添加當前用戶消息（避免重複）
    if (userInput.trim()) {
      messages.push({
        role: 'user' as const,
        content: userInput
      })
    }

    console.log('[AIGuideService] Final messages array:', {
      totalMessages: messages.length,
      messagesWithAttachments: messages.filter(msg => msg.attachments && msg.attachments.length > 0).length
    })

    return messages
  }

  // 獲取步驟信息
  private getStepInfo(stepId: string) {
    const steps = [
      { 
        id: 'taskDefinition', 
        title: '任務定義', 
        description: '明確AI助手的核心任務和主要功能',
        focus: '重點了解用戶希望AI完成什麼樣的工作'
      },
      { 
        id: 'context', 
        title: '使用場景', 
        description: '瞭解AI的使用環境和目標用戶',
        focus: '重點了解在什麼情況下使用、面向什麼樣的用戶'
      },
      { 
        id: 'outputFormat', 
        title: '輸出格式', 
        description: '定義AI回答的結構、格式和風格',
        focus: '重點了解希望AI如何組織和呈現答案'
      },
      { 
        id: 'qualityCriteria', 
        title: '質量要求', 
        description: '確定成功標準和質量期望',
        focus: '重點了解對準確性、完整性等方面的要求'
      },
      { 
        id: 'executionParams', 
        title: '工作方式', 
        description: '設定AI的思考方式和互動風格',
        focus: '重點了解希望AI採用什麼樣的工作方式和語調'
      },
      { 
        id: 'optimization', 
        title: '最終確認', 
        description: '確認信息完整性並生成提示詞',
        focus: '彙總所有信息並生成最終提示詞'
      }
    ]

    return steps.find(step => step.id === stepId) || steps[0]
  }

  // 獲取步驟的初始問題 - 使用AI生成
  public async getInitialQuestion(
    stepId: string, 
    provider?: ProviderConfig, 
    modelId?: string,
    stream: boolean = false
  ): Promise<string> {
    if (!provider || !modelId) {
      throw new Error('需要配置AI提供商和模型')
    }
    
    return await this.generateInitialQuestionWithAI(stepId, provider, modelId, stream)
  }

  // 使用AI生成初始問題
  private async generateInitialQuestionWithAI(
    stepId: string,
    provider: ProviderConfig,
    modelId: string,
    stream: boolean = false
  ): Promise<string> {
    const currentStep = this.getStepInfo(stepId)
    
    const systemMessage = {
      role: 'system' as const,
      content: promptConfigManager.getUserGuidedPromptRules()
    }

    const userMessage = {
      role: 'user' as const,
      content: `請爲"${currentStep.title}"步驟生成一個合適的開場問題。這個步驟的目標是：${currentStep.description}`
    }

    const response = await this.aiService.callAI([systemMessage, userMessage], provider, modelId, stream)
    return response
  }

  // 基於對話歷史生成需求報告
  public async generateRequirementReportFromConversation(
    conversationHistory: Array<{ type: string; content: string; attachments?: MessageAttachment[] }>,
    provider?: ProviderConfig,
    modelId?: string,
    onStreamUpdate?: (content: string) => void
  ): Promise<string> {
    if (!provider || !modelId) {
      throw new Error('需要配置AI提供商和模型')
    }
    
    return await this.generateReportFromConversationWithAI(conversationHistory, provider, modelId, onStreamUpdate)
  }

  // 使用AI基於對話歷史生成需求報告
  private async generateReportFromConversationWithAI(
    conversationHistory: Array<{ type: string; content: string; attachments?: MessageAttachment[] }>,
    provider: ProviderConfig,
    modelId: string,
    onStreamUpdate?: (content: string) => void
  ): Promise<string> {
    const systemMessage = {
      role: 'system' as const,
      content: promptConfigManager.getRequirementReportRules()
    }

    const conversationSummary = conversationHistory
      .map(msg => {
        let content = `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`
        
        // 如果有附件，添加附件信息
        if (msg.attachments && msg.attachments.length > 0) {
          const attachmentInfo = msg.attachments.map(att => 
            `[附件: ${att.name} (${att.type}, ${att.size} bytes)]`
          ).join(', ')
          content += `\n附件: ${attachmentInfo}`
        }
        
        return content
      })
      .join('\n\n')

    const userMessage = {
      role: 'user' as const,
      content: `基於以下對話歷史生成需求總結報告：

**對話歷史：**
${conversationSummary}

請生成完整的需求總結報告，確保所有5個部分都有具體內容。`
    }

    const streamMode = this.getStreamMode()
    
    // 如果有流式回調且啓用流式模式，設置流式更新
    if (onStreamUpdate && streamMode) {
      this.aiService.setStreamUpdateCallback((chunk: string) => {
        onStreamUpdate(chunk)
      })
    }
    
    const response = await this.aiService.callAI([systemMessage, userMessage], provider, modelId, streamMode)
    
    // 清理流式回調
    if (onStreamUpdate && streamMode) {
      this.aiService.clearStreamUpdateCallback()
    }
    
    return response
  }

  
}