import type { ProviderConfig } from '@/stores/settingsStore'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export class AIService {
  private static instance: AIService

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  // 调用AI API
  async callAI(messages: ChatMessage[], provider: ProviderConfig, modelId: string, stream: boolean = false): Promise<string> {
    try {
      // 获取模型配置以确定API类型
      const model = provider.models.find(m => m.id === modelId)
      const apiType = model?.apiType || provider.type
      
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
      throw error
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
          return await this.callGoogleAPI(messages, provider, modelId)
        default:
          return await this.callOpenAIAPIStream(messages, provider, modelId)
      }
    } catch (error) {
      // 流式失败时降级到非流式
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
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const result = data.choices[0]?.message?.content
    
    if (!result || result.trim() === '') {
      throw new Error('API返回空内容')
    }
    
    return result
  }

  // Anthropic API调用
  private async callAnthropicAPI(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // 分离系统消息和对话消息
    const systemMessage = messages.find(m => m.role === 'system')?.content || ''
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

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2000,
        system: systemMessage,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const result = data.content[0]?.text
    
    if (!result || result.trim() === '') {
      throw new Error('API返回空内容')
    }
    
    return result
  }

  // Google API调用
  private async callGoogleAPI(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    // Google Gemini API格式转换
    const systemMessage = messages.find(m => m.role === 'system')?.content || ''
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const contents = conversationMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))

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

    // 构建Google API URL - 总是拼接模型路径
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
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Google API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
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
    
    return result
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
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.7,
        max_tokens: 2000,
        stream: true
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    let result = ''
    const decoder = new TextDecoder()

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
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                result += content
                // 这里可以添加实时更新UI的回调
                if (this.onStreamUpdate) {
                  this.onStreamUpdate(content)
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

    return result
  }

  // Anthropic流式API调用
  private async callAnthropicAPIStream(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
    const systemMessage = messages.find(m => m.role === 'system')?.content || ''
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

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2000,
        system: systemMessage,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        })),
        stream: true
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    let result = ''
    const decoder = new TextDecoder()

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
                  result += content
                  if (this.onStreamUpdate) {
                    this.onStreamUpdate(content)
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

    return result
  }

  // Google流式API调用
  // 设置流式更新回调
  private onStreamUpdate?: (content: string) => void

  setStreamUpdateCallback(callback: (content: string) => void) {
    this.onStreamUpdate = callback
  }

  clearStreamUpdateCallback() {
    this.onStreamUpdate = undefined
  }

  // 获取可用模型列表
  async getAvailableModels(provider: ProviderConfig): Promise<string[]> {
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
      
      const response = await fetch(apiUrl, {
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
      
      // 提取模型ID列表
      if (data.data && Array.isArray(data.data)) {
        return data.data
          .map((model: any) => model.id)
          .filter((id: string) => id && typeof id === 'string')
          .sort()
      }
      
      throw new Error('无效的模型列表响应格式')
    } catch (error) {
      console.error('获取模型列表失败:', error)
      throw error
    }
  }

  // 测试连接
  async testConnection(provider: ProviderConfig, modelId: string): Promise<boolean> {
    try {
      const testMessages: ChatMessage[] = [
        { role: 'user', content: '测试连接' }
      ]
      
      const response = await this.callAI(testMessages, provider, modelId, false)
      return Boolean(response && typeof response === 'string' && response.trim().length > 0)
    } catch (error) {
      return false
    }
  }
}