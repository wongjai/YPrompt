import type { ProviderConfig } from '@/stores/settingsStore'
import type { MessageAttachment } from '@/stores/promptStore'

// 多模態內容類型
export interface MessageContent {
  type: 'text' | 'image_url' | 'image'
  text?: string
  image_url?: {
    url: string
  }
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | MessageContent[]
  attachments?: MessageAttachment[]
}

export class AIService {
  private static instance: AIService
  private thinkBuffer: string = ''  // 用於處理跨chunk的<think>標籤
  private isInThinkMode: boolean = false  // 是否正在處理think標籤內容

  private function Object() { [native code] }() {}

  // 創建帶超時的fetch請求
  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 300000): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // 清理<think></think>標籤內容，支持流式增量處理
  private filterThinkTags(chunk: string): string {
    // 將新的chunk添加到緩衝區
    this.thinkBuffer += chunk
    
    let result = ''
    let i = 0
    
    while (i < this.thinkBuffer.length) {
      if (this.isInThinkMode) {
        // 正在think標籤內部，查找</think>標籤
        const closeTagIndex = this.thinkBuffer.indexOf('</think>', i)
        if (closeTagIndex !== -1) {
          // 找到結束標籤，跳過該部分
          this.isInThinkMode = false
          i = closeTagIndex + 8 // 跳過</think>
        } else {
          // 沒找到結束標籤，說明標籤還未完整，保留剩餘內容在緩衝區
          this.thinkBuffer = this.thinkBuffer.substring(i)
          return result
        }
      } else {
        // 不在think標籤內部，查找<think>標籤
        const openTagIndex = this.thinkBuffer.indexOf('<think>', i)
        if (openTagIndex !== -1) {
          // 找到開始標籤，添加之前的內容到結果
          result += this.thinkBuffer.substring(i, openTagIndex)
          this.isInThinkMode = true
          i = openTagIndex + 7 // 跳過<think>
        } else {
          // 沒找到開始標籤，檢查是否有不完整的標籤
          const partialTagIndex = this.thinkBuffer.lastIndexOf('<')
          if (partialTagIndex !== -1 && partialTagIndex >= i) {
            const remainingText = this.thinkBuffer.substring(partialTagIndex)
            if ('<think>'.startsWith(remainingText)) {
              // 可能是不完整的<think>標籤，保留在緩衝區
              result += this.thinkBuffer.substring(i, partialTagIndex)
              this.thinkBuffer = remainingText
              return result
            }
          }
          
          // 沒有不完整的標籤，添加所有剩餘內容
          result += this.thinkBuffer.substring(i)
          this.thinkBuffer = ''
          return result
        }
      }
    }
    
    this.thinkBuffer = ''
    return result
  }

  // 重置think標籤處理狀態
  private resetThinkState(): void {
    this.thinkBuffer = ''
    this.isInThinkMode = false
  }

  // 清理完整文本中的<think></think>標籤內容（用於最終結果處理）
  private cleanThinkTagsFromFullText(text: string): string {
    if (!text) return text
    
    // 使用正則表達式移除所有<think>...</think>標籤及其內容
    return text.replace(/<think>[\s\S]*?<\/think>/g, '')
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  // 將附件轉換爲OpenAI格式的內容
  private convertAttachmentsToOpenAI(attachments: MessageAttachment[]): MessageContent[] {
    return attachments
      .map(att => {
        console.log(`[AIService] Converting attachment for OpenAI:`, {
          name: att.name,
          type: att.type,
          mimeType: att.mimeType,
          size: att.size,
          hasData: !!att.data
        })
        
        if (att.type === 'image') {
          // OpenAI主要支持圖片格式
          return {
            type: 'image_url' as const,
            image_url: {
              url: `data:${att.mimeType};base64,${att.data}`
            }
          } as MessageContent
        }
        
        // OpenAI目前主要支持圖片，其他類型可以在這裏擴展
        console.warn(`[AIService] OpenAI currently mainly supports images. Skipping ${att.type}: ${att.mimeType}`)
        return null
      })
      .filter((item): item is MessageContent => item !== null)
  }

  // 將附件轉換爲Anthropic格式的內容
  private convertAttachmentsToAnthropic(attachments: MessageAttachment[]): MessageContent[] {
    return attachments
      .map(att => {
        console.log(`[AIService] Converting attachment for Anthropic:`, {
          name: att.name,
          type: att.type,
          mimeType: att.mimeType,
          size: att.size,
          hasData: !!att.data
        })
        
        if (att.type === 'image') {
          // Claude支持圖片格式
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: att.mimeType,
              data: att.data
            }
          } as MessageContent
        } else if (att.type === 'document') {
          // Claude支持某些文檔格式，但需要特殊處理
          // 目前Claude主要支持圖片，文檔內容可以作爲文本傳遞
          const supportedDocumentTypes = ['text/plain', 'text/markdown', 'application/json']
          
          if (supportedDocumentTypes.includes(att.mimeType)) {
            // 對於文本文檔，可以嘗試解碼並作爲文本內容傳遞
            // 注意：這裏需要根據實際API能力調整
            console.info(`[AIService] Anthropic document support limited. Consider converting ${att.mimeType} to text.`)
          }
          
          console.warn(`[AIService] Anthropic currently mainly supports images. Skipping document: ${att.mimeType}`)
          return null
        }
        
        // Claude目前主要支持圖片，其他類型暫不支持
        console.warn(`[AIService] Anthropic currently mainly supports images. Skipping ${att.type}: ${att.mimeType}`)
        return null
      })
      .filter((item): item is MessageContent => item !== null)
  }

  // 將附件轉換爲Gemini格式的內容
  private convertAttachmentsToGemini(attachments: MessageAttachment[]): any[] {
    return attachments.map(att => {
      console.log(`[AIService] Converting attachment for Gemini:`, {
        name: att.name,
        type: att.type,
        mimeType: att.mimeType,
        size: att.size,
        hasData: !!att.data
      })
      
      if (att.type === 'image') {
        // 圖片文件
        return {
          inline_data: {
            mime_type: att.mimeType,
            data: att.data
          }
        }
      } else if (att.type === 'document') {
        // 文檔文件 - Gemini支持多種文檔格式
        // 支持的文檔類型包括：text/plain, application/pdf, text/html, text/css, text/javascript, application/json等
        const supportedDocumentTypes = [
          'text/plain',
          'text/html',
          'text/css',
          'text/javascript',
          'application/json',
          'text/markdown',
          'application/pdf',
          'text/csv',
          'text/xml',
          'application/xml',
          // Microsoft Office 文檔
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
          'application/msword', // .doc
          'application/vnd.ms-excel', // .xls
          'application/vnd.ms-powerpoint', // .ppt
          'application/rtf'
        ]
        
        if (supportedDocumentTypes.includes(att.mimeType)) {
          return {
            inline_data: {
              mime_type: att.mimeType,
              data: att.data
            }
          }
        } else {
          console.warn(`[AIService] Unsupported document type for Gemini: ${att.mimeType}`)
          return null
        }
      } else if (att.type === 'audio') {
        // 音頻文件 - Gemini支持某些音頻格式
        const supportedAudioTypes = [
          'audio/wav',
          'audio/mp3',
          'audio/mpeg',
          'audio/aac',
          'audio/ogg',
          'audio/flac'
        ]
        
        if (supportedAudioTypes.includes(att.mimeType)) {
          return {
            inline_data: {
              mime_type: att.mimeType,
              data: att.data
            }
          }
        } else {
          console.warn(`[AIService] Unsupported audio type for Gemini: ${att.mimeType}`)
          return null
        }
      } else if (att.type === 'video') {
        // 視頻文件 - Gemini支持某些視頻格式
        const supportedVideoTypes = [
          'video/mp4',
          'video/mpeg',
          'video/mov',
          'video/avi',
          'video/x-flv',
          'video/mpg',
          'video/webm',
          'video/wmv'
        ]
        
        if (supportedVideoTypes.includes(att.mimeType)) {
          return {
            inline_data: {
              mime_type: att.mimeType,
              data: att.data
            }
          }
        } else {
          console.warn(`[AIService] Unsupported video type for Gemini: ${att.mimeType}`)
          return null
        }
      }
      
      // 不支持的文件類型
      console.warn(`[AIService] Unsupported attachment type for Gemini: ${att.type}`)
      return null
    }).filter(Boolean)
  }

  // 將ChatMessage轉換爲多模態內容
  private convertToMultimodalContent(message: ChatMessage, apiType: string): MessageContent[] | any[] {
    const content: MessageContent[] | any[] = []
    
    console.log(`[AIService] Converting multimodal content for ${apiType}:`, {
      hasAttachments: !!(message.attachments && message.attachments.length > 0),
      attachmentCount: message.attachments?.length || 0,
      attachments: message.attachments?.map(att => ({ name: att.name, type: att.type, size: att.size }))
    })
    
    // 添加文本內容
    if (typeof message.content === 'string' && message.content.trim()) {
      if (apiType === 'google') {
        // Gemini格式不需要type字段
        (content as any[]).push({ text: message.content })
      } else {
        (content as MessageContent[]).push({ type: 'text', text: message.content })
      }
    }
    
    // 添加附件內容
    if (message.attachments && message.attachments.length > 0) {
      console.log(`[AIService] Processing ${message.attachments.length} attachments for ${apiType}`)
      
      switch (apiType) {
        case 'openai':
          const openaiAttachments = this.convertAttachmentsToOpenAI(message.attachments)
          console.log(`[AIService] OpenAI attachments:`, openaiAttachments.length)
          content.push(...openaiAttachments)
          break
        case 'anthropic':
          const anthropicAttachments = this.convertAttachmentsToAnthropic(message.attachments)
          console.log(`[AIService] Anthropic attachments:`, anthropicAttachments.length)
          content.push(...anthropicAttachments)
          break
        case 'google':
          const geminiAttachments = this.convertAttachmentsToGemini(message.attachments)
          console.log(`[AIService] Gemini attachments:`, geminiAttachments.length)
          content.push(...geminiAttachments)
          
          // 對於Gemini，檢查是否有被過濾的附件
          const originalCount = message.attachments.length
          const processedCount = geminiAttachments.length
          if (processedCount < originalCount) {
            // 有附件被過濾，添加描述文本
            const unsupportedAttachments = message.attachments.filter((att) => {
              // 重新運行轉換檢查哪些被過濾了
              return !this.isAttachmentSupportedByGemini(att)
            })
            
            if (unsupportedAttachments.length > 0) {
              const attachmentDescriptions = unsupportedAttachments.map(att => 
                `${att.name} (${att.type}, ${(att.size / 1024).toFixed(1)}KB)`
              ).join(', ')
              
              const attachmentInfoText = `[用戶上傳了以下附件，但當前無法直接處理: ${attachmentDescriptions}。用戶詢問關於這些附件的問題。]`
              
              if (apiType === 'google') {
                (content as any[]).push({ text: attachmentInfoText })
              } else {
                (content as MessageContent[]).push({ type: 'text', text: attachmentInfoText })
              }
            }
          }
          break
      }
    }
    
    console.log(`[AIService] Final content for ${apiType}:`, content.length, 'items')
    return content
  }

  // 解析API錯誤並提供友好的用戶反饋
  private parseAPIError(error: any, apiType: string): string {
    try {
      let errorMessage = ''
      let errorCode = ''
      
      // 嘗試解析不同格式的錯誤響應
      if (error.message && typeof error.message === 'string') {
        errorMessage = error.message
      } else if (error.error && error.error.message) {
        errorMessage = error.error.message
        errorCode = error.error.code || error.error.type || ''
      } else if (typeof error === 'string') {
        errorMessage = error
      } else {
        errorMessage = JSON.stringify(error)
      }
      
      // 檢查是否是MIME類型不支持的錯誤
      const mimeTypePattern = /Unsupported MIME type: ([^(]+)/i
      const mimeMatch = errorMessage.match(mimeTypePattern)
      
      if (mimeMatch) {
        const unsupportedMimeType = mimeMatch[1].trim()
        
        // 根據MIME類型提供具體的文件類型提示
        let fileTypeHint = ''
        if (unsupportedMimeType.startsWith('application/vnd.openxmlformats-officedocument')) {
          if (unsupportedMimeType.includes('wordprocessingml')) {
            fileTypeHint = 'Word文檔(.docx)'
          } else if (unsupportedMimeType.includes('spreadsheetml')) {
            fileTypeHint = 'Excel表格(.xlsx)'
          } else if (unsupportedMimeType.includes('presentationml')) {
            fileTypeHint = 'PowerPoint演示文稿(.pptx)'
          } else {
            fileTypeHint = 'Office文檔'
          }
        } else if (unsupportedMimeType.startsWith('application/msword')) {
          fileTypeHint = 'Word文檔(.doc)'
        } else if (unsupportedMimeType.startsWith('application/vnd.ms-excel')) {
          fileTypeHint = 'Excel表格(.xls)'
        } else if (unsupportedMimeType.startsWith('application/vnd.ms-powerpoint')) {
          fileTypeHint = 'PowerPoint演示文稿(.ppt)'
        } else if (unsupportedMimeType.startsWith('application/pdf')) {
          fileTypeHint = 'PDF文檔'
        } else if (unsupportedMimeType.startsWith('text/')) {
          fileTypeHint = '文本文件'
        } else if (unsupportedMimeType.startsWith('image/')) {
          fileTypeHint = '圖片文件'
        } else if (unsupportedMimeType.startsWith('audio/')) {
          fileTypeHint = '音頻文件'
        } else if (unsupportedMimeType.startsWith('video/')) {
          fileTypeHint = '視頻文件'
        } else {
          fileTypeHint = '該文件'
        }
        
        // 根據API類型提供建議
        let modelSuggestion = ''
        switch (apiType) {
          case 'openai':
            modelSuggestion = '當前OpenAI模型主要支持圖片格式。建議切換到支持更多文件類型的模型（如Gemini）'
            break
          case 'anthropic':
            modelSuggestion = '當前Claude模型主要支持圖片格式。建議切換到支持更多文件類型的模型（如Gemini）'
            break
          case 'google':
            modelSuggestion = '當前Gemini模型不支持此文件格式。建議使用支持的格式（圖片、PDF、Office文檔等）'
            break
          default:
            modelSuggestion = '當前模型不支持此文件格式。建議切換到支持多模態的模型'
        }
        
        return `${fileTypeHint}格式不受當前模型支持。\n\n${modelSuggestion}，或移除附件後重新發送。`
      }
      
      // 檢查是否是其他常見的附件相關錯誤
      if (errorMessage.toLowerCase().includes('multimodal') || 
          errorMessage.toLowerCase().includes('attachment') ||
          errorMessage.toLowerCase().includes('file') ||
          errorMessage.toLowerCase().includes('image')) {
        return `當前模型不支持附件功能。請移除附件或切換到支持多模態的模型（如GPT-4 Vision、Claude 3或Gemini）。`
      }
      
      // 檢查是否是模型不支持的錯誤
      if (errorMessage.toLowerCase().includes('model') && 
          (errorMessage.toLowerCase().includes('not found') || 
           errorMessage.toLowerCase().includes('invalid'))) {
        return `模型不可用或配置錯誤。請檢查模型名稱和API配置。`
      }
      
      // 檢查是否是API密鑰相關錯誤
      if (errorMessage.toLowerCase().includes('api key') || 
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('authentication') ||
          errorCode === '401') {
        return `API密鑰無效或未授權。請檢查您的API密鑰配置。`
      }
      
      // 檢查是否是配額或限制錯誤
      if (errorMessage.toLowerCase().includes('quota') || 
          errorMessage.toLowerCase().includes('limit') ||
          errorMessage.toLowerCase().includes('rate') ||
          errorCode === '429') {
        return `API調用頻率過高或配額已用完。請稍後重試或檢查您的API賬戶狀態。`
      }
      
      // 如果是網絡相關錯誤
      if (errorMessage.toLowerCase().includes('network') || 
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('connection')) {
        return `網絡連接錯誤。請檢查網絡連接後重試。`
      }
      
      // 返回清理後的原始錯誤信息
      return `API請求失敗：${errorMessage}`
      
    } catch (parseError) {
      // 解析錯誤時返回通用錯誤信息
      return `API請求失敗，請檢查網絡連接和配置後重試。`
    }
  }

  // 提取系統消息文本的輔助方法
  private extractSystemMessageText(messages: ChatMessage[]): string {
    const systemMsg = messages.find(m => m.role === 'system')
    if (!systemMsg) return ''
    if (typeof systemMsg.content === 'string') return systemMsg.content
    if (Array.isArray(systemMsg.content)) {
      // 如果是MessageContent[]，提取所有文本內容
      return systemMsg.content.map(c => c.text || '').join(' ')
    }
    return ''
  }

  // 檢查附件是否被Gemini支持
  private isAttachmentSupportedByGemini(att: MessageAttachment): boolean {
    if (att.type === 'image') {
      return true
    } else if (att.type === 'document') {
      const supportedDocumentTypes = [
        'text/plain',
        'text/html',
        'text/css',
        'text/javascript',
        'application/json',
        'text/markdown',
        'application/pdf',
        'text/csv',
        'text/xml',
        'application/xml',
        // Microsoft Office 文檔
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/msword', // .doc
        'application/vnd.ms-excel', // .xls
        'application/vnd.ms-powerpoint', // .ppt
        'application/rtf'
      ]
      return supportedDocumentTypes.includes(att.mimeType)
    } else if (att.type === 'audio') {
      const supportedAudioTypes = [
        'audio/wav',
        'audio/mp3',
        'audio/mpeg',
        'audio/aac',
        'audio/ogg',
        'audio/flac'
      ]
      return supportedAudioTypes.includes(att.mimeType)
    } else if (att.type === 'video') {
      const supportedVideoTypes = [
        'video/mp4',
        'video/mpeg',
        'video/mov',
        'video/avi',
        'video/x-flv',
        'video/mpg',
        'video/webm',
        'video/wmv'
      ]
      return supportedVideoTypes.includes(att.mimeType)
    }
    
    return false
  }

  // 檢查模型是否支持多模態內容
  private checkMultimodalSupport(modelId: string, apiType: string, attachments: MessageAttachment[]): { 
    supported: boolean; 
    message?: string 
  } {
    if (!attachments || attachments.length === 0) {
      return { supported: true }
    }

    const modelName = modelId.toLowerCase()
    
    // 檢查不同API類型的多模態支持
    switch (apiType) {
      case 'openai':
        // OpenAI模型支持檢查
        if (modelName.includes('gpt-4') && (modelName.includes('vision') || modelName.includes('4o'))) {
          // 只支持圖片
          const hasNonImage = attachments.some(att => att.type !== 'image')
          if (hasNonImage) {
            return {
              supported: false,
              message: `當前模型 ${modelId} 僅支持圖片附件，不支持文檔、音頻或視頻。請移除非圖片附件或切換到支持多模態的模型（如 Gemini）。`
            }
          }
          return { supported: true }
        } else {
          return {
            supported: false,
            message: `當前模型 ${modelId} 不支持多模態輸入。請移除附件或切換到支持視覺的模型（如 GPT-4 Vision、GPT-4o 或 Gemini）。`
          }
        }
        
      case 'anthropic':
        // Claude模型支持檢查
        if (modelName.includes('claude') && modelName.includes('3')) {
          // 只支持圖片
          const hasNonImage = attachments.some(att => att.type !== 'image')
          if (hasNonImage) {
            return {
              supported: false,
              message: `當前模型 ${modelId} 僅支持圖片附件，不支持文檔、音頻或視頻。請移除非圖片附件或切換到支持多模態的模型（如 Gemini）。`
            }
          }
          return { supported: true }
        } else {
          return {
            supported: false,
            message: `當前模型 ${modelId} 不支持多模態輸入。請移除附件或切換到支持視覺的模型（如 Claude 3 或 Gemini）。`
          }
        }
        
      case 'google':
        // Gemini模型支持檢查
        if (modelName.includes('gemini') && (modelName.includes('1.5') || modelName.includes('2.') || modelName.includes('flash') || modelName.includes('pro'))) {
          return { supported: true } // Gemini支持最全面的多模態
        } else {
          return {
            supported: false,
            message: `當前模型 ${modelId} 不支持多模態輸入。請移除附件或切換到支持多模態的 Gemini 模型（如 gemini-1.5-pro、gemini-1.5-flash）。`
          }
        }
        
      default:
        return {
          supported: false,
          message: `當前API類型 ${apiType} 的多模態支持未知。請移除附件或切換到已知支持多模態的模型。`
        }
    }
  }
  private hasMultimodalContent(message: ChatMessage): boolean {
    return !!(message.attachments && message.attachments.length > 0)
  }

  // 調用AI API
  async callAI(messages: ChatMessage[], provider: ProviderConfig, modelId: string, stream: boolean = false): Promise<string> {
    // 獲取模型配置以確定API類型（移到try外部以便catch塊訪問）
    const model = provider.models.find(m => m.id === modelId)
    const apiType = model?.apiType || provider.type
    
    try {
      // 檢查多模態支持
      const allAttachments = messages.flatMap(msg => msg.attachments || [])
      const supportCheck = this.checkMultimodalSupport(modelId, apiType, allAttachments)
      
      if (!supportCheck.supported) {
        console.warn('[AIService] Multimodal not supported:', supportCheck.message)
        // 返回友好的提示信息而不是拋出錯誤
        return supportCheck.message || '當前模型不支持附件，請移除附件或切換模型。'
      }
      
      let result: string
      if (stream) {
        // 流式調用
        result = await this.callAIStream(messages, provider, modelId, apiType)
      } else {
        // 非流式調用
        switch (apiType) {
          case 'openai':
            result = await this.callOpenAIAPI(messages, provider, modelId)
            break
          case 'anthropic':
            result = await this.callAnthropicAPI(messages, provider, modelId)
            break
          case 'google':
            result = await this.callGoogleAPI(messages, provider, modelId)
            break
          default:
            result = await this.callOpenAIAPI(messages, provider, modelId)
        }
      }
      
      return result
    } catch (error) {
      // 解析錯誤並提供友好的反饋
      const friendlyErrorMessage = this.parseAPIError(error, apiType)
      throw new Error(friendlyErrorMessage)
    }
  }

  // 流式AI API調用
  async callAIStream(messages: ChatMessage[], provider: ProviderConfig, modelId: string, apiType: string): Promise<string> {
    try {
      switch (apiType) {
        case 'openai':
          return await this.callOpenAIAPIStream(messages, provider, modelId)
        case 'anthropic':
          return await this.callAnthropicAPIStream(messages, provider, modelId)
        case 'google':
          return await this.callGoogleAPIStream(messages, provider, modelId)
        default:
          return await this.callOpenAIAPIStream(messages, provider, modelId)
      }
    } catch (error) {
      // 檢查是否是不支持的MIME類型錯誤，如果是，直接拋出友好錯誤，不嘗試降級
      const errorMessage = (error as any)?.message || (error as any)?.error?.message || String(error)
      if (errorMessage.toLowerCase().includes('unsupported mime type')) {
        const friendlyErrorMessage = this.parseAPIError(error, apiType)
        throw new Error(friendlyErrorMessage)
      }
      
      // 其他錯誤嘗試降級到非流式
      try {
        switch (apiType) {
          case 'openai':
            return await this.callOpenAIAPI(messages, provider, modelId)
          case 'anthropic':
            return await this.callAnthropicAPI(messages, provider, modelId)
          case 'google':
            return await this.callGoogleAPI(messages, provider, modelId)
          default:
            return await this.callOpenAIAPI(messages, provider, modelId)
        }
      } catch (fallbackError) {
        // 降級失敗，解析並拋出友好的錯誤信息
        const friendlyErrorMessage = this.parseAPIError(fallbackError, apiType)
        throw new Error(friendlyErrorMessage)
      }
    }
  }

  // OpenAI API調用（也適用於兼容OpenAI的API）
  private async callOpenAIAPI(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // 構建OpenAI API URL - 智能處理基礎URL和完整URL
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    
    if (apiUrl.includes('/chat/completions')) {
      // 已經是完整URL，直接使用
      // 例如: https://xxx/v1/chat/completions
    } else if (apiUrl.includes('/v1')) {
      // 包含v1但沒有chat/completions，拼接chat/completions
      // 例如: https://xxx/v1 -> https://xxx/v1/chat/completions
      apiUrl = apiUrl.replace(/\/+$/, '') + '/chat/completions'
    } else {
      // 基礎URL，需要拼接完整路徑
      // 例如: https://xxx -> https://xxx/v1/chat/completions
      apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/chat/completions'
    }
    
    // 對於思考模型（如gpt-5-high）使用更長的超時時間
    const isThinkingModel = modelId.includes('gpt-5') || modelId.includes('o1') || modelId.includes('thinking')
    const timeoutMs = isThinkingModel ? 600000 : 300000 // 思考模型10分鐘，普通模型5分鐘
    
    const response = await this.fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(msg => {
          // 檢查是否有多模態內容
          if (this.hasMultimodalContent(msg)) {
            const multimodalContent = this.convertToMultimodalContent(msg, 'openai')
            return {
              role: msg.role,
              content: multimodalContent
            }
          } else {
            return {
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
            }
          }
        }),
        temperature: 0.7,
        max_tokens: 60000
      })
    }, timeoutMs)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // 拋出包含完整錯誤信息的錯誤對象，供上層parseAPIError解析
      const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    const data = await response.json()
    
    // 支持多種API響應格式的內容提取
    let result: string | undefined
    
    if (data.choices && data.choices[0]?.message?.content) {
      // OpenAI 格式: {choices: [{message: {content: "text"}}]}
      result = data.choices[0].message.content
    } else if (data.candidates && data.candidates[0]?.content?.parts) {
      // Gemini 格式: {candidates: [{content: {parts: [{text: "text"}]}}]}
      const parts = data.candidates[0].content.parts
      // 查找包含text的部分（過濾掉thought等）
      for (const part of parts) {
        if (part.text && !part.thought) {
          result = part.text
          break
        }
      }
    } else if (data.content && typeof data.content === 'string') {
      // 直接返回內容格式
      result = data.content
    } else if (data.text && typeof data.text === 'string') {
      // 簡單文本格式
      result = data.text
    }
    
    if (!result || result.trim() === '') {
      throw new Error('API返回空內容或無法解析響應格式')
    }
    
    // 清理響應內容中的評估標籤等
    result = this.cleanResponse(result)
    
    // 清理think標籤內容
    result = this.cleanThinkTagsFromFullText(result)
    
    return result
  }

  // Anthropic API調用
  private async callAnthropicAPI(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // 分離系統消息和對話消息
    const systemMessage = this.extractSystemMessageText(messages)
    const conversationMessages = messages.filter(m => m.role !== 'system')

    // 構建Anthropic API URL - 智能處理基礎URL和完整URL
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    if (!apiUrl.includes('/v1/messages')) {
      // 如果是基礎URL，需要拼接路徑
      apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/messages'
    }

    // 對於思考模型使用更長的超時時間
    const isThinkingModel = modelId.includes('claude-3') || modelId.includes('thinking') || modelId.includes('sonnet')
    const timeoutMs = isThinkingModel ? 600000 : 300000 // 思考模型10分鐘，普通模型5分鐘

    const response = await this.fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 60000,
        system: systemMessage,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: this.hasMultimodalContent(msg) 
            ? this.convertToMultimodalContent(msg, 'anthropic')
            : (typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content[0]?.text || '' : String(msg.content)))
        }))
      })
    }, timeoutMs)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // 拋出包含完整錯誤信息的錯誤對象，供上層parseAPIError解析
      const error = new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    const data = await response.json()
    const result = data.content[0]?.text
    
    if (!result || result.trim() === '') {
      throw new Error('API返回空內容')
    }
    
    // 清理think標籤內容
    const cleanedResult = this.cleanThinkTagsFromFullText(result)
    
    return cleanedResult
  }

  // Google Gemini API調用
  private async callGoogleAPI(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // Google Gemini API格式轉換
    const systemMessage = this.extractSystemMessageText(messages)
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const contents = conversationMessages.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user'
      
      if (this.hasMultimodalContent(msg)) {
        const parts = this.convertToMultimodalContent(msg, 'google')
        return { role, parts }
      } else {
        const text = typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
        return { role, parts: [{ text }] }
      }
    })

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: 0.7
      }
    }

    // 如果有系統消息，添加到第一個用戶消息前
    if (systemMessage && contents.length > 0) {
      // 找到第一個用戶消息
      const firstUserContent = contents.find(content => content.role === 'user')
      if (firstUserContent && firstUserContent.parts) {
        // 查找文本部分
        const textPart = firstUserContent.parts.find(part => part.text)
        if (textPart) {
          // 將系統消息添加到現有文本前
          textPart.text = systemMessage + '\n\n' + textPart.text
        } else {
          // 如果沒有文本部分，添加一個新的文本部分到開頭
          firstUserContent.parts.unshift({ text: systemMessage } as any)
        }
      }
    }

    console.log('[AIService] Final Gemini request body:', {
      contentsCount: contents.length,
      firstContentRole: contents[0]?.role,
      firstContentPartsCount: contents[0]?.parts?.length,
      hasInlineData: contents.some(content => 
        content.parts?.some(part => part.inline_data)
      ),
      systemMessageLength: systemMessage.length,
      modelId: modelId
    })

    // 構建Google Gemini API URL - 總是拼接模型路徑
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    // 確保以/v1beta結尾，然後拼接模型路徑
    if (!apiUrl.endsWith('/v1beta')) {
      // 如果是完整的generateContent URL，提取baseURL部分
      if (apiUrl.includes('/models/')) {
        apiUrl = apiUrl.split('/models/')[0]
      }
      // 確保以/v1beta結尾
      if (!apiUrl.endsWith('/v1beta')) {
        apiUrl = apiUrl.replace(/\/+$/, '') + '/v1beta'
      }
    }
    // 拼接模型特定路徑
    apiUrl = `${apiUrl}/models/${modelId}:generateContent`
    
    // 添加API key參數
    const url = new URL(apiUrl)
    url.searchParams.set('key', provider.apiKey)
    
    // 對於Google模型使用較長的超時時間
    const timeoutMs = 300000 // 5分鐘
    
    const response = await this.fetchWithTimeout(url.function toString() { [native code] }(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, timeoutMs)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // 拋出包含完整錯誤信息的錯誤對象，供上層parseAPIError解析
      const error = new Error(`Google Gemini API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    const data = await response.json()
    
    // 在parts數組中找到非思考內容的文本
    const candidate = data.candidates?.[0]
    if (!candidate?.content?.parts) {
      throw new Error('API返回數據結構異常')
    }
    
    // 查找實際的回答文本（排除thought內容）
    let result = ''
    for (const part of candidate.content.parts) {
      if (part.text && !part.thought) {
        result = part.text
        break
      }
    }
    
    if (!result || result.trim() === '') {
      throw new Error('API返回空內容')
    }
    
    // 清理think標籤內容
    const cleanedResult = this.cleanThinkTagsFromFullText(result)
    
    return cleanedResult
  }

  // OpenAI流式API調用
  private async callOpenAIAPIStream(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // 構建OpenAI API URL - 智能處理基礎URL和完整URL
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    
    if (apiUrl.includes('/chat/completions')) {
      // 已經是完整URL，直接使用
      // 例如: https://xxx/v1/chat/completions
    } else if (apiUrl.includes('/v1')) {
      // 包含v1但沒有chat/completions，拼接chat/completions
      // 例如: https://xxx/v1 -> https://xxx/v1/chat/completions
      apiUrl = apiUrl.replace(/\/+$/, '') + '/chat/completions'
    } else {
      // 基礎URL，需要拼接完整路徑
      // 例如: https://xxx -> https://xxx/v1/chat/completions
      apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/chat/completions'
    }
    
    // 對於思考模型（如gpt-5-high）使用更長的超時時間
    const isThinkingModel = modelId.includes('gpt-5') || modelId.includes('o1') || modelId.includes('thinking')
    const timeoutMs = isThinkingModel ? 600000 : 300000 // 思考模型10分鐘，普通模型5分鐘
    
    const response = await this.fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(msg => {
          // 檢查是否有多模態內容
          if (this.hasMultimodalContent(msg)) {
            const multimodalContent = this.convertToMultimodalContent(msg, 'openai')
            return {
              role: msg.role,
              content: multimodalContent
            }
          } else {
            return {
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
            }
          }
        }),
        temperature: 0.7,
        max_tokens: 60000,
        stream: true
      })
    }, timeoutMs)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // 拋出包含完整錯誤信息的錯誤對象，供上層parseAPIError解析
      const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    let result = ''
    const decoder = new TextDecoder()
    
    // 重置think標籤處理狀態
    this.resetThinkState()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              let content: string | undefined
              
              // 支持多種流式響應格式
              if (parsed.choices?.[0]?.delta?.content) {
                // OpenAI 流式格式
                content = parsed.choices[0].delta.content
              } else if (parsed.candidates?.[0]?.content?.parts) {
                // Gemini SSE 流式格式
                const parts = parsed.candidates[0].content.parts
                for (const part of parts) {
                  if (part.text && !part.thought) {
                    content = part.text
                    break
                  }
                }
              } else if (parsed.delta?.text) {
                // 簡化流式格式
                content = parsed.delta.text
              } else if (parsed.text) {
                // 直接文本格式
                content = parsed.text
              }
              
              if (content) {
                // 清理<think></think>標籤內容
                const filteredContent = this.filterThinkTags(content)
                if (filteredContent) {
                  result += filteredContent
                  if (this.onStreamUpdate) {
                    this.onStreamUpdate(filteredContent)
                  }
                }
              }
            } catch (e) {
              // 忽略解析錯誤
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!result || result.trim() === '') {
      throw new Error('API返回空內容')
    }

    // 清理流式響應內容中的評估標籤等
    result = this.cleanResponse(result)
    
    // 清理think標籤內容
    result = this.cleanThinkTagsFromFullText(result)

    return result
  }

  // Anthropic流式API調用
  private async callAnthropicAPIStream(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    const systemMessage = this.extractSystemMessageText(messages)
    const conversationMessages = messages.filter(m => m.role !== 'system')

    // 構建Anthropic API URL - 智能處理基礎URL和完整URL
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    if (!apiUrl.includes('/v1/messages')) {
      // 如果是基礎URL，需要拼接路徑
      apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/messages'
    }

    const response = await this.fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 60000,
        system: systemMessage,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: this.hasMultimodalContent(msg) 
            ? this.convertToMultimodalContent(msg, 'anthropic')
            : (typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content[0]?.text || '' : String(msg.content)))
        })),
        stream: true
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // 拋出包含完整錯誤信息的錯誤對象，供上層parseAPIError解析
      const error = new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    let result = ''
    const decoder = new TextDecoder()
    
    // 重置think標籤處理狀態
    this.resetThinkState()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text
                if (content) {
                  // 清理<think></think>標籤內容
                  const filteredContent = this.filterThinkTags(content)
                  if (filteredContent) {
                    result += filteredContent
                    if (this.onStreamUpdate) {
                      this.onStreamUpdate(filteredContent)
                    }
                  }
                }
              }
            } catch (e) {
              // 忽略解析錯誤
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!result || result.trim() === '') {
      throw new Error('API返回空內容')
    }

    // 清理think標籤內容
    result = this.cleanThinkTagsFromFullText(result)

    return result
  }

  // Google Gemini流式API調用
  private async callGoogleAPIStream(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // Google Gemini API格式轉換
    const systemMessage = this.extractSystemMessageText(messages)
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const contents = conversationMessages.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user'
      
      if (this.hasMultimodalContent(msg)) {
        const parts = this.convertToMultimodalContent(msg, 'google')
        return { role, parts }
      } else {
        const text = typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
        return { role, parts: [{ text }] }
      }
    })

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: 0.7
      }
    }

    // 如果有系統消息，添加到第一個用戶消息前
    if (systemMessage && contents.length > 0) {
      contents[0].parts[0].text = systemMessage + '\n\n' + contents[0].parts[0].text
    }

    // 構建Google Gemini API URL - 總是拼接模型路徑
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    // 確保以/v1beta結尾，然後拼接模型路徑
    if (!apiUrl.endsWith('/v1beta')) {
      // 如果是完整的generateContent URL，提取baseURL部分
      if (apiUrl.includes('/models/')) {
        apiUrl = apiUrl.split('/models/')[0]
      }
      // 確保以/v1beta結尾
      if (!apiUrl.endsWith('/v1beta')) {
        apiUrl = apiUrl.replace(/\/+$/, '') + '/v1beta'
      }
    }
    // 拼接模型特定路徑，添加stream參數
    apiUrl = `${apiUrl}/models/${modelId}:streamGenerateContent`
    
    // 添加API key和SSE格式參數
    const url = new URL(apiUrl)
    url.searchParams.set('key', provider.apiKey)
    url.searchParams.set('alt', 'sse')  // Gemini API返回SSE格式
    
    const response = await this.fetchWithTimeout(url.function toString() { [native code] }(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // 拋出包含完整錯誤信息的錯誤對象，供上層parseAPIError解析
      const error = new Error(`Google Gemini API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    if (!response.body) {
      throw new Error('響應體爲空')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let result = ''
    
    // 重置think標籤處理狀態
    this.resetThinkState()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const candidate = parsed.candidates?.[0]
              if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                  if (part.text && !part.thought) {
                    // 清理<think></think>標籤內容
                    const filteredContent = this.filterThinkTags(part.text)
                    if (filteredContent) {
                      result += filteredContent
                      // 調用流式更新回調
                      if (this.onStreamUpdate) {
                        this.onStreamUpdate(filteredContent)
                      }
                    }
                  }
                }
              }
            } catch (parseError) {
              // 忽略解析錯誤，繼續處理下一行
              continue
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!result || result.trim() === '') {
      throw new Error('API返回空內容')
    }

    // 清理流式響應內容中的評估標籤等
    result = this.cleanResponse(result)
    
    // 清理think標籤內容
    result = this.cleanThinkTagsFromFullText(result)

    return result
  }

  // 清理AI響應中的評估標籤
  private cleanResponse(response: string): string {
    try {
      // 移除完整的評估標籤及其內容
      let cleaned = response.replace(/<ASSESSMENT>[\s\S]*?<\/ASSESSMENT>/gi, '').trim()
      
      // 處理流式過程中不完整的評估標籤
      // 如果發現開始標籤但沒有結束標籤，截斷到開始標籤之前
      const assessmentStart = cleaned.indexOf('<ASSESSMENT>')
      if (assessmentStart !== -1) {
        cleaned = cleaned.substring(0, assessmentStart).trim()
      }
      
      // 處理其他可能的不完整標籤模式
      const patterns = [
        /<ASSE[^>]*$/i,     // 不完整的開始標籤
        /<\/ASSE[^>]*$/i,   // 不完整的結束標籤
        /\n\n<ASSE/i,       // 換行後的開始標籤
        /CONTEXT:/i,        // 評估內容的關鍵詞
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
      return response // 清理失敗時返回原內容
    }
  }

  // 設置流式更新回調
  private onStreamUpdate?: (content: string) => void

  setStreamUpdateCallback(callback: (content: string) => void) {
    this.onStreamUpdate = callback
  }

  clearStreamUpdateCallback() {
    this.onStreamUpdate = undefined
  }

  // 獲取可用模型列表
  async getAvailableModels(provider: ProviderConfig, preferredApiType?: 'openai' | 'anthropic' | 'google'): Promise<string[]> {
    try {
      // 確定API類型 - 優先使用傳入的API類型
      const apiType = preferredApiType || provider.type
      
      // 根據API類型調用不同方法
      switch (apiType) {
        case 'openai':
          return await this.getOpenAIModels(provider)
        case 'anthropic':
          return await this.getAnthropicModels()
        case 'google':
          return await this.getGeminiModels(provider)
        case 'custom':
          // 自定義類型需要進一步判斷實際API類型
          return await this.getCustomProviderModels(provider, preferredApiType)
        default:
          return await this.getOpenAIModels(provider)
      }
    } catch (error) {
      throw error
    }
  }

  // OpenAI模型列表獲取
  private async getOpenAIModels(provider: ProviderConfig): Promise<string[]> {
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    const apiUrl = this.buildOpenAIModelsUrl(provider.baseUrl)
    
    const response = await this.fetchWithTimeout(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`OpenAI Models API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.data && Array.isArray(data.data)) {
      return data.data
        .map((model: any) => model.id)
        .filter((id: string) => id && typeof id === 'string')
        .sort()
    }
    
    throw new Error('OpenAI API返回的模型列表格式不正確')
  }

  // Gemini模型列表獲取
  private async getGeminiModels(provider: ProviderConfig): Promise<string[]> {
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    const apiUrl = this.buildGeminiModelsUrl(provider.baseUrl)
    
    // Gemini使用URL參數認證
    const url = new URL(apiUrl)
    url.searchParams.set('key', provider.apiKey)
    
    const response = await this.fetchWithTimeout(url.function toString() { [native code] }(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Gemini Models API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.models && Array.isArray(data.models)) {
      return data.models
        .map((model: any) => {
          if (model.name && typeof model.name === 'string') {
            return model.name.replace(/^models\//, '') // 移除 "models/" 前綴
          }
          return model.id || model.name
        })
        .filter((name: string) => name && typeof name === 'string')
        .sort()
    }
    
    throw new Error('Gemini API返回的模型列表格式不正確')
  }

  // Anthropic模型列表獲取
  private async getAnthropicModels(): Promise<string[]> {
    // Anthropic不提供公開的模型列表API，返回預定義列表
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ].sort()
  }

  // 自定義提供商模型列表獲取
  private async getCustomProviderModels(provider: ProviderConfig, preferredApiType?: 'openai' | 'anthropic' | 'google'): Promise<string[]> {
    // 如果用戶已選擇API類型，直接使用該類型
    if (preferredApiType) {
      switch (preferredApiType) {
        case 'openai':
          return await this.getOpenAIModels(provider)
        case 'anthropic':
          return await this.getAnthropicModels()
        case 'google':
          return await this.getGeminiModels(provider)
        default:
          // 繼續執行下面的智能判斷邏輯
          break
      }
    }
    
    // 智能判斷API類型，避免不必要的重複調用
    const baseUrl = provider.baseUrl?.toLowerCase() || ''
    
    // 如果URL包含Gemini相關標識，直接使用Gemini API
    if (baseUrl.includes('googleapis.com') || 
        baseUrl.includes('generativelanguage') ||
        baseUrl.includes('/v1beta') ||
        baseUrl.includes('gemini')) {
      try {
        return await this.getGeminiModels(provider)
      } catch (error) {
        // Gemini API失敗，不再嘗試其他格式，直接拋出錯誤
        throw new Error(`Gemini API獲取模型列表失敗: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    // 如果URL包含Anthropic相關標識，直接返回預定義列表
    if (baseUrl.includes('anthropic.com') || baseUrl.includes('claude')) {
      return await this.getAnthropicModels()
    }
    
    // 對於其他自定義提供商，嘗試多種格式
    try {
      // 首先嚐試OpenAI格式
      return await this.getOpenAIModels(provider)
    } catch (error1) {
      try {
        // 然後嘗試Gemini格式（僅當URL不明確時）
        return await this.getGeminiModels(provider)
      } catch (error2) {
        // 最後使用通用解析邏輯
        return await this.getModelsWithGenericParsing(provider)
      }
    }
  }

  // 通用模型列表解析（保持向後兼容）
  private async getModelsWithGenericParsing(provider: ProviderConfig): Promise<string[]> {
    try {
      // 構建模型列表API URL
      if (!provider.baseUrl) {
        throw new Error('API URL 未配置')
      }
      let apiUrl = provider.baseUrl.trim()
      
      if (apiUrl.includes('/models')) {
        // 已經是模型列表URL，直接使用
      } else if (apiUrl.includes('/v1')) {
        // 包含v1但沒有models，拼接models
        apiUrl = apiUrl.replace(/\/+$/, '') + '/models'
      } else {
        // 基礎URL，需要拼接完整路徑
        apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/models'
      }
      
      const response = await this.fetchWithTimeout(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Models API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // 提取模型ID列表 - 支持多種API格式
      let models: any[] = []
      
      if (data.data && Array.isArray(data.data)) {
        // OpenAI 格式: {data: [{id: "model-id"}, ...]}
        models = data.data
          .map((model: any) => model.id)
          .filter((id: string) => id && typeof id === 'string')
      } else if (data.models && Array.isArray(data.models)) {
        // Gemini 格式: {models: [{name: "models/model-name"}, ...]}
        models = data.models
          .map((model: any) => {
            // 提取模型名稱，支持 "models/gemini-1.5-pro" 格式
            if (model.name && typeof model.name === 'string') {
              return model.name.replace(/^models\//, '') // 移除 "models/" 前綴
            }
            return model.id || model.name
          })
          .filter((name: string) => name && typeof name === 'string')
      } else if (Array.isArray(data)) {
        // 直接數組格式: [{id: "model-id"}, ...] 或 ["model-id", ...]
        models = data
          .map((item: any) => {
            if (typeof item === 'string') {
              return item
            } else if (item.id) {
              return item.id
            } else if (item.name) {
              return item.name.replace(/^models\//, '')
            }
            return null
          })
          .filter((name: string) => name && typeof name === 'string')
      }
      
      if (models.length > 0) {
        return models.sort()
      }
      
      throw new Error('無效的模型列表響應格式')
    } catch (error) {
      throw error
    }
  }

  // OpenAI模型列表URL構建
  private buildOpenAIModelsUrl(baseUrl: string): string {
    if (!baseUrl) {
      throw new Error('API URL 未配置')
    }
    
    let apiUrl = baseUrl.trim()
    
    if (apiUrl.includes('/models')) {
      // 已經是模型列表URL，直接使用
      return apiUrl
    } else if (apiUrl.includes('/v1')) {
      // 包含v1但沒有models，拼接models
      return apiUrl.replace(/\/+$/, '') + '/models'
    } else {
      // 基礎URL，需要拼接完整路徑
      return apiUrl.replace(/\/+$/, '') + '/v1/models'
    }
  }

  // Gemini模型列表URL構建
  private buildGeminiModelsUrl(baseUrl: string): string {
    if (!baseUrl) {
      throw new Error('API URL 未配置')
    }
    
    let apiUrl = baseUrl.trim()
    
    if (apiUrl.includes('/models')) {
      // 已經是模型列表URL，直接使用
      return apiUrl
    } else if (apiUrl.includes('/v1beta')) {
      // 包含v1beta但沒有models，拼接models
      return apiUrl.replace(/\/+$/, '') + '/models'
    } else {
      // 基礎URL，需要拼接完整路徑
      return apiUrl.replace(/\/+$/, '') + '/v1beta/models'
    }
  }

  // 測試連接（保持向後兼容）
  async testConnection(provider: ProviderConfig, modelId: string): Promise<boolean> {
    try {
      const result = await this.testModelCapabilities(provider, modelId)
      return result.success
    } catch (error) {
      return false
    }
  }

  // 新的模型能力檢測方法
  async testModelCapabilities(
    provider: ProviderConfig, 
    modelId: string
  ): Promise<{ 
    success: boolean; 
    capabilities?: import('@/stores/settingsStore').ModelCapabilities; 
    error?: string 
  }> {
    try {
      const { CapabilityDetector } = await import('./capabilityDetector')
      const detector = CapabilityDetector.getInstance()
      const capabilities = await detector.detectCapabilities(provider, modelId)
      
      return {
        success: capabilities.testResult?.connected || false,
        capabilities,
        error: capabilities.testResult?.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}