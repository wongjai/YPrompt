import type { ProviderConfig } from '@/stores/settingsStore'
import type { MessageAttachment } from '@/stores/promptStore'

// 多模态内容类型
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
  private thinkBuffer: string = ''  // 用于处理跨chunk的<think>标签
  private isInThinkMode: boolean = false  // 是否正在处理think标签内容

  private constructor() {}

  // 创建带超时的fetch请求
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

  // 清理<think></think>标签内容，支持流式增量处理
  private filterThinkTags(chunk: string): string {
    // 将新的chunk添加到缓冲区
    this.thinkBuffer += chunk
    
    let result = ''
    let i = 0
    
    while (i < this.thinkBuffer.length) {
      if (this.isInThinkMode) {
        // 正在think标签内部，查找</think>标签
        const closeTagIndex = this.thinkBuffer.indexOf('</think>', i)
        if (closeTagIndex !== -1) {
          // 找到结束标签，跳过该部分
          this.isInThinkMode = false
          i = closeTagIndex + 8 // 跳过</think>
        } else {
          // 没找到结束标签，说明标签还未完整，保留剩余内容在缓冲区
          this.thinkBuffer = this.thinkBuffer.substring(i)
          return result
        }
      } else {
        // 不在think标签内部，查找<think>标签
        const openTagIndex = this.thinkBuffer.indexOf('<think>', i)
        if (openTagIndex !== -1) {
          // 找到开始标签，添加之前的内容到结果
          result += this.thinkBuffer.substring(i, openTagIndex)
          this.isInThinkMode = true
          i = openTagIndex + 7 // 跳过<think>
        } else {
          // 没找到开始标签，检查是否有不完整的标签
          const partialTagIndex = this.thinkBuffer.lastIndexOf('<')
          if (partialTagIndex !== -1 && partialTagIndex >= i) {
            const remainingText = this.thinkBuffer.substring(partialTagIndex)
            if ('<think>'.startsWith(remainingText)) {
              // 可能是不完整的<think>标签，保留在缓冲区
              result += this.thinkBuffer.substring(i, partialTagIndex)
              this.thinkBuffer = remainingText
              return result
            }
          }
          
          // 没有不完整的标签，添加所有剩余内容
          result += this.thinkBuffer.substring(i)
          this.thinkBuffer = ''
          return result
        }
      }
    }
    
    this.thinkBuffer = ''
    return result
  }

  // 重置think标签处理状态
  private resetThinkState(): void {
    this.thinkBuffer = ''
    this.isInThinkMode = false
  }

  // 清理完整文本中的<think></think>标签内容（用于最终结果处理）
  private cleanThinkTagsFromFullText(text: string): string {
    if (!text) return text
    
    // 使用正则表达式移除所有<think>...</think>标签及其内容
    return text.replace(/<think>[\s\S]*?<\/think>/g, '')
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  // 将附件转换为OpenAI格式的内容
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
          // OpenAI主要支持图片格式
          return {
            type: 'image_url' as const,
            image_url: {
              url: `data:${att.mimeType};base64,${att.data}`
            }
          } as MessageContent
        }
        
        // OpenAI目前主要支持图片，其他类型可以在这里扩展
        console.warn(`[AIService] OpenAI currently mainly supports images. Skipping ${att.type}: ${att.mimeType}`)
        return null
      })
      .filter((item): item is MessageContent => item !== null)
  }

  // 将附件转换为Anthropic格式的内容
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
          // Claude支持图片格式
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: att.mimeType,
              data: att.data
            }
          } as MessageContent
        } else if (att.type === 'document') {
          // Claude支持某些文档格式，但需要特殊处理
          // 目前Claude主要支持图片，文档内容可以作为文本传递
          const supportedDocumentTypes = ['text/plain', 'text/markdown', 'application/json']
          
          if (supportedDocumentTypes.includes(att.mimeType)) {
            // 对于文本文档，可以尝试解码并作为文本内容传递
            // 注意：这里需要根据实际API能力调整
            console.info(`[AIService] Anthropic document support limited. Consider converting ${att.mimeType} to text.`)
          }
          
          console.warn(`[AIService] Anthropic currently mainly supports images. Skipping document: ${att.mimeType}`)
          return null
        }
        
        // Claude目前主要支持图片，其他类型暂不支持
        console.warn(`[AIService] Anthropic currently mainly supports images. Skipping ${att.type}: ${att.mimeType}`)
        return null
      })
      .filter((item): item is MessageContent => item !== null)
  }

  // 将附件转换为Gemini格式的内容
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
        // 图片文件
        return {
          inline_data: {
            mime_type: att.mimeType,
            data: att.data
          }
        }
      } else if (att.type === 'document') {
        // 文档文件 - Gemini支持多种文档格式
        // 支持的文档类型包括：text/plain, application/pdf, text/html, text/css, text/javascript, application/json等
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
          // Microsoft Office 文档
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
        // 音频文件 - Gemini支持某些音频格式
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
        // 视频文件 - Gemini支持某些视频格式
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
      
      // 不支持的文件类型
      console.warn(`[AIService] Unsupported attachment type for Gemini: ${att.type}`)
      return null
    }).filter(Boolean)
  }

  // 将ChatMessage转换为多模态内容
  private convertToMultimodalContent(message: ChatMessage, apiType: string): MessageContent[] | any[] {
    const content: MessageContent[] | any[] = []
    
    console.log(`[AIService] Converting multimodal content for ${apiType}:`, {
      hasAttachments: !!(message.attachments && message.attachments.length > 0),
      attachmentCount: message.attachments?.length || 0,
      attachments: message.attachments?.map(att => ({ name: att.name, type: att.type, size: att.size }))
    })
    
    // 添加文本内容
    if (typeof message.content === 'string' && message.content.trim()) {
      if (apiType === 'google') {
        // Gemini格式不需要type字段
        (content as any[]).push({ text: message.content })
      } else {
        (content as MessageContent[]).push({ type: 'text', text: message.content })
      }
    }
    
    // 添加附件内容
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
          
          // 对于Gemini，检查是否有被过滤的附件
          const originalCount = message.attachments.length
          const processedCount = geminiAttachments.length
          if (processedCount < originalCount) {
            // 有附件被过滤，添加描述文本
            const unsupportedAttachments = message.attachments.filter((att) => {
              // 重新运行转换检查哪些被过滤了
              return !this.isAttachmentSupportedByGemini(att)
            })
            
            if (unsupportedAttachments.length > 0) {
              const attachmentDescriptions = unsupportedAttachments.map(att => 
                `${att.name} (${att.type}, ${(att.size / 1024).toFixed(1)}KB)`
              ).join(', ')
              
              const attachmentInfoText = `[用户上传了以下附件，但当前无法直接处理: ${attachmentDescriptions}。用户询问关于这些附件的问题。]`
              
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

  // 解析API错误并提供友好的用户反馈
  private parseAPIError(error: any, apiType: string): string {
    try {
      let errorMessage = ''
      let errorCode = ''
      
      // 尝试解析不同格式的错误响应
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
      
      // 检查是否是MIME类型不支持的错误
      const mimeTypePattern = /Unsupported MIME type: ([^(]+)/i
      const mimeMatch = errorMessage.match(mimeTypePattern)
      
      if (mimeMatch) {
        const unsupportedMimeType = mimeMatch[1].trim()
        
        // 根据MIME类型提供具体的文件类型提示
        let fileTypeHint = ''
        if (unsupportedMimeType.startsWith('application/vnd.openxmlformats-officedocument')) {
          if (unsupportedMimeType.includes('wordprocessingml')) {
            fileTypeHint = 'Word文档(.docx)'
          } else if (unsupportedMimeType.includes('spreadsheetml')) {
            fileTypeHint = 'Excel表格(.xlsx)'
          } else if (unsupportedMimeType.includes('presentationml')) {
            fileTypeHint = 'PowerPoint演示文稿(.pptx)'
          } else {
            fileTypeHint = 'Office文档'
          }
        } else if (unsupportedMimeType.startsWith('application/msword')) {
          fileTypeHint = 'Word文档(.doc)'
        } else if (unsupportedMimeType.startsWith('application/vnd.ms-excel')) {
          fileTypeHint = 'Excel表格(.xls)'
        } else if (unsupportedMimeType.startsWith('application/vnd.ms-powerpoint')) {
          fileTypeHint = 'PowerPoint演示文稿(.ppt)'
        } else if (unsupportedMimeType.startsWith('application/pdf')) {
          fileTypeHint = 'PDF文档'
        } else if (unsupportedMimeType.startsWith('text/')) {
          fileTypeHint = '文本文件'
        } else if (unsupportedMimeType.startsWith('image/')) {
          fileTypeHint = '图片文件'
        } else if (unsupportedMimeType.startsWith('audio/')) {
          fileTypeHint = '音频文件'
        } else if (unsupportedMimeType.startsWith('video/')) {
          fileTypeHint = '视频文件'
        } else {
          fileTypeHint = '该文件'
        }
        
        // 根据API类型提供建议
        let modelSuggestion = ''
        switch (apiType) {
          case 'openai':
            modelSuggestion = '当前OpenAI模型主要支持图片格式。建议切换到支持更多文件类型的模型（如Gemini）'
            break
          case 'anthropic':
            modelSuggestion = '当前Claude模型主要支持图片格式。建议切换到支持更多文件类型的模型（如Gemini）'
            break
          case 'google':
            modelSuggestion = '当前Gemini模型不支持此文件格式。建议使用支持的格式（图片、PDF、Office文档等）'
            break
          default:
            modelSuggestion = '当前模型不支持此文件格式。建议切换到支持多模态的模型'
        }
        
        return `${fileTypeHint}格式不受当前模型支持。\n\n${modelSuggestion}，或移除附件后重新发送。`
      }
      
      // 检查是否是其他常见的附件相关错误
      if (errorMessage.toLowerCase().includes('multimodal') || 
          errorMessage.toLowerCase().includes('attachment') ||
          errorMessage.toLowerCase().includes('file') ||
          errorMessage.toLowerCase().includes('image')) {
        return `当前模型不支持附件功能。请移除附件或切换到支持多模态的模型（如GPT-4 Vision、Claude 3或Gemini）。`
      }
      
      // 检查是否是模型不支持的错误
      if (errorMessage.toLowerCase().includes('model') && 
          (errorMessage.toLowerCase().includes('not found') || 
           errorMessage.toLowerCase().includes('invalid'))) {
        return `模型不可用或配置错误。请检查模型名称和API配置。`
      }
      
      // 检查是否是API密钥相关错误
      if (errorMessage.toLowerCase().includes('api key') || 
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('authentication') ||
          errorCode === '401') {
        return `API密钥无效或未授权。请检查您的API密钥配置。`
      }
      
      // 检查是否是配额或限制错误
      if (errorMessage.toLowerCase().includes('quota') || 
          errorMessage.toLowerCase().includes('limit') ||
          errorMessage.toLowerCase().includes('rate') ||
          errorCode === '429') {
        return `API调用频率过高或配额已用完。请稍后重试或检查您的API账户状态。`
      }
      
      // 如果是网络相关错误
      if (errorMessage.toLowerCase().includes('network') || 
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('connection')) {
        return `网络连接错误。请检查网络连接后重试。`
      }
      
      // 返回清理后的原始错误信息
      return `API请求失败：${errorMessage}`
      
    } catch (parseError) {
      // 解析错误时返回通用错误信息
      return `API请求失败，请检查网络连接和配置后重试。`
    }
  }

  // 提取系统消息文本的辅助方法
  private extractSystemMessageText(messages: ChatMessage[]): string {
    const systemMsg = messages.find(m => m.role === 'system')
    if (!systemMsg) return ''
    if (typeof systemMsg.content === 'string') return systemMsg.content
    if (Array.isArray(systemMsg.content)) {
      // 如果是MessageContent[]，提取所有文本内容
      return systemMsg.content.map(c => c.text || '').join(' ')
    }
    return ''
  }

  // 检查附件是否被Gemini支持
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
        // Microsoft Office 文档
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

  // 检查模型是否支持多模态内容
  private checkMultimodalSupport(modelId: string, apiType: string, attachments: MessageAttachment[]): { 
    supported: boolean; 
    message?: string 
  } {
    if (!attachments || attachments.length === 0) {
      return { supported: true }
    }

    const modelName = modelId.toLowerCase()
    
    // 检查不同API类型的多模态支持
    switch (apiType) {
      case 'openai':
        // OpenAI模型支持检查
        if (modelName.includes('gpt-4') && (modelName.includes('vision') || modelName.includes('4o'))) {
          // 只支持图片
          const hasNonImage = attachments.some(att => att.type !== 'image')
          if (hasNonImage) {
            return {
              supported: false,
              message: `当前模型 ${modelId} 仅支持图片附件，不支持文档、音频或视频。请移除非图片附件或切换到支持多模态的模型（如 Gemini）。`
            }
          }
          return { supported: true }
        } else {
          return {
            supported: false,
            message: `当前模型 ${modelId} 不支持多模态输入。请移除附件或切换到支持视觉的模型（如 GPT-4 Vision、GPT-4o 或 Gemini）。`
          }
        }
        
      case 'anthropic':
        // Claude模型支持检查
        if (modelName.includes('claude') && modelName.includes('3')) {
          // 只支持图片
          const hasNonImage = attachments.some(att => att.type !== 'image')
          if (hasNonImage) {
            return {
              supported: false,
              message: `当前模型 ${modelId} 仅支持图片附件，不支持文档、音频或视频。请移除非图片附件或切换到支持多模态的模型（如 Gemini）。`
            }
          }
          return { supported: true }
        } else {
          return {
            supported: false,
            message: `当前模型 ${modelId} 不支持多模态输入。请移除附件或切换到支持视觉的模型（如 Claude 3 或 Gemini）。`
          }
        }
        
      case 'google':
        // Gemini模型支持检查
        if (modelName.includes('gemini') && (modelName.includes('1.5') || modelName.includes('2.') || modelName.includes('flash') || modelName.includes('pro'))) {
          return { supported: true } // Gemini支持最全面的多模态
        } else {
          return {
            supported: false,
            message: `当前模型 ${modelId} 不支持多模态输入。请移除附件或切换到支持多模态的 Gemini 模型（如 gemini-1.5-pro、gemini-1.5-flash）。`
          }
        }
        
      default:
        return {
          supported: false,
          message: `当前API类型 ${apiType} 的多模态支持未知。请移除附件或切换到已知支持多模态的模型。`
        }
    }
  }
  private hasMultimodalContent(message: ChatMessage): boolean {
    return !!(message.attachments && message.attachments.length > 0)
  }

  // 调用AI API
  async callAI(messages: ChatMessage[], provider: ProviderConfig, modelId: string, stream: boolean = false): Promise<string> {
    // 获取模型配置以确定API类型（移到try外部以便catch块访问）
    const model = provider.models.find(m => m.id === modelId)
    const apiType = model?.apiType || provider.type
    
    try {
      // 检查多模态支持
      const allAttachments = messages.flatMap(msg => msg.attachments || [])
      const supportCheck = this.checkMultimodalSupport(modelId, apiType, allAttachments)
      
      if (!supportCheck.supported) {
        console.warn('[AIService] Multimodal not supported:', supportCheck.message)
        // 返回友好的提示信息而不是抛出错误
        return supportCheck.message || '当前模型不支持附件，请移除附件或切换模型。'
      }
      
      let result: string
      if (stream) {
        // 流式调用
        result = await this.callAIStream(messages, provider, modelId, apiType)
      } else {
        // 非流式调用
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
      // 解析错误并提供友好的反馈
      const friendlyErrorMessage = this.parseAPIError(error, apiType)
      throw new Error(friendlyErrorMessage)
    }
  }

  // 流式AI API调用
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
      // 检查是否是不支持的MIME类型错误，如果是，直接抛出友好错误，不尝试降级
      const errorMessage = (error as any)?.message || (error as any)?.error?.message || String(error)
      if (errorMessage.toLowerCase().includes('unsupported mime type')) {
        const friendlyErrorMessage = this.parseAPIError(error, apiType)
        throw new Error(friendlyErrorMessage)
      }
      
      // 其他错误尝试降级到非流式
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
        // 降级失败，解析并抛出友好的错误信息
        const friendlyErrorMessage = this.parseAPIError(fallbackError, apiType)
        throw new Error(friendlyErrorMessage)
      }
    }
  }

  // OpenAI API调用（也适用于兼容OpenAI的API）
  private async callOpenAIAPI(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // 构建OpenAI API URL - 智能处理基础URL和完整URL
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    
    if (apiUrl.includes('/chat/completions')) {
      // 已经是完整URL，直接使用
      // 例如: https://xxx/v1/chat/completions
    } else if (apiUrl.includes('/v1')) {
      // 包含v1但没有chat/completions，拼接chat/completions
      // 例如: https://xxx/v1 -> https://xxx/v1/chat/completions
      apiUrl = apiUrl.replace(/\/+$/, '') + '/chat/completions'
    } else {
      // 基础URL，需要拼接完整路径
      // 例如: https://xxx -> https://xxx/v1/chat/completions
      apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/chat/completions'
    }
    
    // 对于思考模型（如gpt-5-high）使用更长的超时时间
    const isThinkingModel = modelId.includes('gpt-5') || modelId.includes('o1') || modelId.includes('thinking')
    const timeoutMs = isThinkingModel ? 600000 : 300000 // 思考模型10分钟，普通模型5分钟
    
    const response = await this.fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(msg => {
          // 检查是否有多模态内容
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
      // 抛出包含完整错误信息的错误对象，供上层parseAPIError解析
      const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    const data = await response.json()
    
    // 支持多种API响应格式的内容提取
    let result: string | undefined
    
    if (data.choices && data.choices[0]?.message?.content) {
      // OpenAI 格式: {choices: [{message: {content: "text"}}]}
      result = data.choices[0].message.content
    } else if (data.candidates && data.candidates[0]?.content?.parts) {
      // Gemini 格式: {candidates: [{content: {parts: [{text: "text"}]}}]}
      const parts = data.candidates[0].content.parts
      // 查找包含text的部分（过滤掉thought等）
      for (const part of parts) {
        if (part.text && !part.thought) {
          result = part.text
          break
        }
      }
    } else if (data.content && typeof data.content === 'string') {
      // 直接返回内容格式
      result = data.content
    } else if (data.text && typeof data.text === 'string') {
      // 简单文本格式
      result = data.text
    }
    
    if (!result || result.trim() === '') {
      throw new Error('API返回空内容或无法解析响应格式')
    }
    
    // 清理响应内容中的评估标签等
    result = this.cleanResponse(result)
    
    // 清理think标签内容
    result = this.cleanThinkTagsFromFullText(result)
    
    return result
  }

  // Anthropic API调用
  private async callAnthropicAPI(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // 分离系统消息和对话消息
    const systemMessage = this.extractSystemMessageText(messages)
    const conversationMessages = messages.filter(m => m.role !== 'system')

    // 构建Anthropic API URL - 智能处理基础URL和完整URL
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    if (!apiUrl.includes('/v1/messages')) {
      // 如果是基础URL，需要拼接路径
      apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/messages'
    }

    // 对于思考模型使用更长的超时时间
    const isThinkingModel = modelId.includes('claude-3') || modelId.includes('thinking') || modelId.includes('sonnet')
    const timeoutMs = isThinkingModel ? 600000 : 300000 // 思考模型10分钟，普通模型5分钟

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
      // 抛出包含完整错误信息的错误对象，供上层parseAPIError解析
      const error = new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    const data = await response.json()
    const result = data.content[0]?.text
    
    if (!result || result.trim() === '') {
      throw new Error('API返回空内容')
    }
    
    // 清理think标签内容
    const cleanedResult = this.cleanThinkTagsFromFullText(result)
    
    return cleanedResult
  }

  // Google Gemini API调用
  private async callGoogleAPI(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // Google Gemini API格式转换
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

    // 如果有系统消息，添加到第一个用户消息前
    if (systemMessage && contents.length > 0) {
      // 找到第一个用户消息
      const firstUserContent = contents.find(content => content.role === 'user')
      if (firstUserContent && firstUserContent.parts) {
        // 查找文本部分
        const textPart = firstUserContent.parts.find(part => part.text)
        if (textPart) {
          // 将系统消息添加到现有文本前
          textPart.text = systemMessage + '\n\n' + textPart.text
        } else {
          // 如果没有文本部分，添加一个新的文本部分到开头
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

    // 构建Google Gemini API URL - 总是拼接模型路径
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    // 确保以/v1beta结尾，然后拼接模型路径
    if (!apiUrl.endsWith('/v1beta')) {
      // 如果是完整的generateContent URL，提取baseURL部分
      if (apiUrl.includes('/models/')) {
        apiUrl = apiUrl.split('/models/')[0]
      }
      // 确保以/v1beta结尾
      if (!apiUrl.endsWith('/v1beta')) {
        apiUrl = apiUrl.replace(/\/+$/, '') + '/v1beta'
      }
    }
    // 拼接模型特定路径
    apiUrl = `${apiUrl}/models/${modelId}:generateContent`
    
    // 添加API key参数
    const url = new URL(apiUrl)
    url.searchParams.set('key', provider.apiKey)
    
    // 对于Google模型使用较长的超时时间
    const timeoutMs = 300000 // 5分钟
    
    const response = await this.fetchWithTimeout(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, timeoutMs)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // 抛出包含完整错误信息的错误对象，供上层parseAPIError解析
      const error = new Error(`Google Gemini API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    const data = await response.json()
    
    // 在parts数组中找到非思考内容的文本
    const candidate = data.candidates?.[0]
    if (!candidate?.content?.parts) {
      throw new Error('API返回数据结构异常')
    }
    
    // 查找实际的回答文本（排除thought内容）
    let result = ''
    for (const part of candidate.content.parts) {
      if (part.text && !part.thought) {
        result = part.text
        break
      }
    }
    
    if (!result || result.trim() === '') {
      throw new Error('API返回空内容')
    }
    
    // 清理think标签内容
    const cleanedResult = this.cleanThinkTagsFromFullText(result)
    
    return cleanedResult
  }

  // OpenAI流式API调用
  private async callOpenAIAPIStream(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // 构建OpenAI API URL - 智能处理基础URL和完整URL
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    
    if (apiUrl.includes('/chat/completions')) {
      // 已经是完整URL，直接使用
      // 例如: https://xxx/v1/chat/completions
    } else if (apiUrl.includes('/v1')) {
      // 包含v1但没有chat/completions，拼接chat/completions
      // 例如: https://xxx/v1 -> https://xxx/v1/chat/completions
      apiUrl = apiUrl.replace(/\/+$/, '') + '/chat/completions'
    } else {
      // 基础URL，需要拼接完整路径
      // 例如: https://xxx -> https://xxx/v1/chat/completions
      apiUrl = apiUrl.replace(/\/+$/, '') + '/v1/chat/completions'
    }
    
    // 对于思考模型（如gpt-5-high）使用更长的超时时间
    const isThinkingModel = modelId.includes('gpt-5') || modelId.includes('o1') || modelId.includes('thinking')
    const timeoutMs = isThinkingModel ? 600000 : 300000 // 思考模型10分钟，普通模型5分钟
    
    const response = await this.fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(msg => {
          // 检查是否有多模态内容
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
      // 抛出包含完整错误信息的错误对象，供上层parseAPIError解析
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
    
    // 重置think标签处理状态
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
              
              // 支持多种流式响应格式
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
                // 简化流式格式
                content = parsed.delta.text
              } else if (parsed.text) {
                // 直接文本格式
                content = parsed.text
              }
              
              if (content) {
                // 清理<think></think>标签内容
                const filteredContent = this.filterThinkTags(content)
                if (filteredContent) {
                  result += filteredContent
                  if (this.onStreamUpdate) {
                    this.onStreamUpdate(filteredContent)
                  }
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!result || result.trim() === '') {
      throw new Error('API返回空内容')
    }

    // 清理流式响应内容中的评估标签等
    result = this.cleanResponse(result)
    
    // 清理think标签内容
    result = this.cleanThinkTagsFromFullText(result)

    return result
  }

  // Anthropic流式API调用
  private async callAnthropicAPIStream(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    const systemMessage = this.extractSystemMessageText(messages)
    const conversationMessages = messages.filter(m => m.role !== 'system')

    // 构建Anthropic API URL - 智能处理基础URL和完整URL
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    if (!apiUrl.includes('/v1/messages')) {
      // 如果是基础URL，需要拼接路径
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
      // 抛出包含完整错误信息的错误对象，供上层parseAPIError解析
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
    
    // 重置think标签处理状态
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
                  // 清理<think></think>标签内容
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
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!result || result.trim() === '') {
      throw new Error('API返回空内容')
    }

    // 清理think标签内容
    result = this.cleanThinkTagsFromFullText(result)

    return result
  }

  // Google Gemini流式API调用
  private async callGoogleAPIStream(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // Google Gemini API格式转换
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

    // 如果有系统消息，添加到第一个用户消息前
    if (systemMessage && contents.length > 0) {
      contents[0].parts[0].text = systemMessage + '\n\n' + contents[0].parts[0].text
    }

    // 构建Google Gemini API URL - 总是拼接模型路径
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    let apiUrl = provider.baseUrl.trim()
    // 确保以/v1beta结尾，然后拼接模型路径
    if (!apiUrl.endsWith('/v1beta')) {
      // 如果是完整的generateContent URL，提取baseURL部分
      if (apiUrl.includes('/models/')) {
        apiUrl = apiUrl.split('/models/')[0]
      }
      // 确保以/v1beta结尾
      if (!apiUrl.endsWith('/v1beta')) {
        apiUrl = apiUrl.replace(/\/+$/, '') + '/v1beta'
      }
    }
    // 拼接模型特定路径，添加stream参数
    apiUrl = `${apiUrl}/models/${modelId}:streamGenerateContent`
    
    // 添加API key和SSE格式参数
    const url = new URL(apiUrl)
    url.searchParams.set('key', provider.apiKey)
    url.searchParams.set('alt', 'sse')  // Gemini API返回SSE格式
    
    const response = await this.fetchWithTimeout(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // 抛出包含完整错误信息的错误对象，供上层parseAPIError解析
      const error = new Error(`Google Gemini API error: ${response.status} ${response.statusText}`)
      ;(error as any).error = errorData
      ;(error as any).status = response.status
      throw error
    }

    if (!response.body) {
      throw new Error('响应体为空')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let result = ''
    
    // 重置think标签处理状态
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
                    // 清理<think></think>标签内容
                    const filteredContent = this.filterThinkTags(part.text)
                    if (filteredContent) {
                      result += filteredContent
                      // 调用流式更新回调
                      if (this.onStreamUpdate) {
                        this.onStreamUpdate(filteredContent)
                      }
                    }
                  }
                }
              }
            } catch (parseError) {
              // 忽略解析错误，继续处理下一行
              continue
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!result || result.trim() === '') {
      throw new Error('API返回空内容')
    }

    // 清理流式响应内容中的评估标签等
    result = this.cleanResponse(result)
    
    // 清理think标签内容
    result = this.cleanThinkTagsFromFullText(result)

    return result
  }

  // 清理AI响应中的评估标签
  private cleanResponse(response: string): string {
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

  // 设置流式更新回调
  private onStreamUpdate?: (content: string) => void

  setStreamUpdateCallback(callback: (content: string) => void) {
    this.onStreamUpdate = callback
  }

  clearStreamUpdateCallback() {
    this.onStreamUpdate = undefined
  }

  // 获取可用模型列表
  async getAvailableModels(provider: ProviderConfig, preferredApiType?: 'openai' | 'anthropic' | 'google'): Promise<string[]> {
    try {
      // 确定API类型 - 优先使用传入的API类型
      const apiType = preferredApiType || provider.type
      
      // 根据API类型调用不同方法
      switch (apiType) {
        case 'openai':
          return await this.getOpenAIModels(provider)
        case 'anthropic':
          return await this.getAnthropicModels()
        case 'google':
          return await this.getGeminiModels(provider)
        case 'custom':
          // 自定义类型需要进一步判断实际API类型
          return await this.getCustomProviderModels(provider, preferredApiType)
        default:
          return await this.getOpenAIModels(provider)
      }
    } catch (error) {
      throw error
    }
  }

  // OpenAI模型列表获取
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
    
    throw new Error('OpenAI API返回的模型列表格式不正确')
  }

  // Gemini模型列表获取
  private async getGeminiModels(provider: ProviderConfig): Promise<string[]> {
    if (!provider.baseUrl) {
      throw new Error('API URL 未配置')
    }
    const apiUrl = this.buildGeminiModelsUrl(provider.baseUrl)
    
    // Gemini使用URL参数认证
    const url = new URL(apiUrl)
    url.searchParams.set('key', provider.apiKey)
    
    const response = await this.fetchWithTimeout(url.toString(), {
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
            return model.name.replace(/^models\//, '') // 移除 "models/" 前缀
          }
          return model.id || model.name
        })
        .filter((name: string) => name && typeof name === 'string')
        .sort()
    }
    
    throw new Error('Gemini API返回的模型列表格式不正确')
  }

  // Anthropic模型列表获取
  private async getAnthropicModels(): Promise<string[]> {
    // Anthropic不提供公开的模型列表API，返回预定义列表
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ].sort()
  }

  // 自定义提供商模型列表获取
  private async getCustomProviderModels(provider: ProviderConfig, preferredApiType?: 'openai' | 'anthropic' | 'google'): Promise<string[]> {
    // 如果用户已选择API类型，直接使用该类型
    if (preferredApiType) {
      switch (preferredApiType) {
        case 'openai':
          return await this.getOpenAIModels(provider)
        case 'anthropic':
          return await this.getAnthropicModels()
        case 'google':
          return await this.getGeminiModels(provider)
        default:
          // 继续执行下面的智能判断逻辑
          break
      }
    }
    
    // 智能判断API类型，避免不必要的重复调用
    const baseUrl = provider.baseUrl?.toLowerCase() || ''
    
    // 如果URL包含Gemini相关标识，直接使用Gemini API
    if (baseUrl.includes('googleapis.com') || 
        baseUrl.includes('generativelanguage') ||
        baseUrl.includes('/v1beta') ||
        baseUrl.includes('gemini')) {
      try {
        return await this.getGeminiModels(provider)
      } catch (error) {
        // Gemini API失败，不再尝试其他格式，直接抛出错误
        throw new Error(`Gemini API获取模型列表失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    // 如果URL包含Anthropic相关标识，直接返回预定义列表
    if (baseUrl.includes('anthropic.com') || baseUrl.includes('claude')) {
      return await this.getAnthropicModels()
    }
    
    // 对于其他自定义提供商，尝试多种格式
    try {
      // 首先尝试OpenAI格式
      return await this.getOpenAIModels(provider)
    } catch (error1) {
      try {
        // 然后尝试Gemini格式（仅当URL不明确时）
        return await this.getGeminiModels(provider)
      } catch (error2) {
        // 最后使用通用解析逻辑
        return await this.getModelsWithGenericParsing(provider)
      }
    }
  }

  // 通用模型列表解析（保持向后兼容）
  private async getModelsWithGenericParsing(provider: ProviderConfig): Promise<string[]> {
    try {
      // 构建模型列表API URL
      if (!provider.baseUrl) {
        throw new Error('API URL 未配置')
      }
      let apiUrl = provider.baseUrl.trim()
      
      if (apiUrl.includes('/models')) {
        // 已经是模型列表URL，直接使用
      } else if (apiUrl.includes('/v1')) {
        // 包含v1但没有models，拼接models
        apiUrl = apiUrl.replace(/\/+$/, '') + '/models'
      } else {
        // 基础URL，需要拼接完整路径
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
      
      // 提取模型ID列表 - 支持多种API格式
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
            // 提取模型名称，支持 "models/gemini-1.5-pro" 格式
            if (model.name && typeof model.name === 'string') {
              return model.name.replace(/^models\//, '') // 移除 "models/" 前缀
            }
            return model.id || model.name
          })
          .filter((name: string) => name && typeof name === 'string')
      } else if (Array.isArray(data)) {
        // 直接数组格式: [{id: "model-id"}, ...] 或 ["model-id", ...]
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
      
      throw new Error('无效的模型列表响应格式')
    } catch (error) {
      throw error
    }
  }

  // OpenAI模型列表URL构建
  private buildOpenAIModelsUrl(baseUrl: string): string {
    if (!baseUrl) {
      throw new Error('API URL 未配置')
    }
    
    let apiUrl = baseUrl.trim()
    
    if (apiUrl.includes('/models')) {
      // 已经是模型列表URL，直接使用
      return apiUrl
    } else if (apiUrl.includes('/v1')) {
      // 包含v1但没有models，拼接models
      return apiUrl.replace(/\/+$/, '') + '/models'
    } else {
      // 基础URL，需要拼接完整路径
      return apiUrl.replace(/\/+$/, '') + '/v1/models'
    }
  }

  // Gemini模型列表URL构建
  private buildGeminiModelsUrl(baseUrl: string): string {
    if (!baseUrl) {
      throw new Error('API URL 未配置')
    }
    
    let apiUrl = baseUrl.trim()
    
    if (apiUrl.includes('/models')) {
      // 已经是模型列表URL，直接使用
      return apiUrl
    } else if (apiUrl.includes('/v1beta')) {
      // 包含v1beta但没有models，拼接models
      return apiUrl.replace(/\/+$/, '') + '/models'
    } else {
      // 基础URL，需要拼接完整路径
      return apiUrl.replace(/\/+$/, '') + '/v1beta/models'
    }
  }

  // 测试连接（保持向后兼容）
  async testConnection(provider: ProviderConfig, modelId: string): Promise<boolean> {
    try {
      const result = await this.testModelCapabilities(provider, modelId)
      return result.success
    } catch (error) {
      return false
    }
  }

  // 新的模型能力检测方法
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