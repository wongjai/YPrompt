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
          return await this.callGoogleAPIStream(messages, provider, modelId)
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

  // Google Gemini API调用
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
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
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
                result += content
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

    // 清理流式响应内容中的评估标签等
    result = this.cleanResponse(result)

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

  // Google Gemini流式API调用
  private async callGoogleAPIStream(messages: ChatMessage[], provider: ProviderConfig, modelId: string): Promise<string> {
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
    url.searchParams.set('alt', 'sse')  // 关键：告诉Gemini API返回SSE格式
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    if (!response.body) {
      throw new Error('响应体为空')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let result = ''

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
                    result += part.text
                    // 调用流式更新回调
                    if (this.onStreamUpdate) {
                      this.onStreamUpdate(part.text)
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
  async getAvailableModels(provider: ProviderConfig): Promise<string[]> {
    try {
      // 确定API类型
      const apiType = provider.type
      
      // 根据API类型调用不同方法
      switch (apiType) {
        case 'openai':
          return await this.getOpenAIModels(provider)
        case 'anthropic':
          return await this.getAnthropicModels(provider)
        case 'google':
          return await this.getGeminiModels(provider)
        case 'custom':
          // 自定义类型需要进一步判断实际API类型
          return await this.getCustomProviderModels(provider)
        default:
          return await this.getOpenAIModels(provider)
      }
    } catch (error) {
      throw error
    }
  }

  // OpenAI模型列表获取
  private async getOpenAIModels(provider: ProviderConfig): Promise<string[]> {
    const apiUrl = this.buildOpenAIModelsUrl(provider.baseUrl)
    
    const response = await fetch(apiUrl, {
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
    const apiUrl = this.buildGeminiModelsUrl(provider.baseUrl)
    
    // Gemini使用URL参数认证
    const url = new URL(apiUrl)
    url.searchParams.set('key', provider.apiKey)
    
    const response = await fetch(url.toString(), {
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
  private async getAnthropicModels(provider: ProviderConfig): Promise<string[]> {
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
  private async getCustomProviderModels(provider: ProviderConfig): Promise<string[]> {
    // 对于自定义提供商，尝试多种格式
    try {
      // 首先尝试OpenAI格式
      return await this.getOpenAIModels(provider)
    } catch (error1) {
      try {
        // 然后尝试Gemini格式
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