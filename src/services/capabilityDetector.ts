import type { ProviderConfig, ModelCapabilities, ReasoningType, SupportedParams } from '@/stores/settingsStore'
import { AIService } from './aiService'
import type { ChatMessage } from './aiService'

export class CapabilityDetector {
  private static instance: CapabilityDetector
  private testCache = new Map<string, ModelCapabilities>()
  private aiService = AIService.getInstance()

  private function Object() { [native code] }() {}

  public static getInstance(): CapabilityDetector {
    if (!CapabilityDetector.instance) {
      CapabilityDetector.instance = new CapabilityDetector()
    }
    return CapabilityDetector.instance
  }

  async detectCapabilities(
    provider: ProviderConfig, 
    modelId: string,
    forceRefresh: boolean = false
  ): Promise<ModelCapabilities> {
    const cacheKey = `${provider.id}:${modelId}`
    
    // 檢查緩存（24小時有效期）- 除非強制刷新
    if (!forceRefresh && this.testCache.has(cacheKey)) {
      const cached = this.testCache.get(cacheKey)!
      const age = Date.now() - (cached.testResult?.timestamp.getTime() || 0)
      if (age < 24 * 60 * 60 * 1000) { // 24小時緩存
        return cached
      }
    }
    
    // 執行檢測
    const capabilities = await this.performCapabilityTest(provider, modelId)
    
    // 緩存結果
    this.testCache.set(cacheKey, capabilities)
    
    return capabilities
  }

  // 新增：快速連接測試+異步思考檢測
  async detectCapabilitiesWithCallback(
    provider: ProviderConfig, 
    modelId: string,
    onConnectionResult: (connected: boolean, responseTime: number, error?: string) => void,
    onThinkingResult: (capabilities: ModelCapabilities) => void,
    forceRefresh: boolean = false
  ): Promise<void> {
    const cacheKey = `${provider.id}:${modelId}`
    
    // 檢查緩存 - 除非強制刷新
    if (!forceRefresh && this.testCache.has(cacheKey)) {
      const cached = this.testCache.get(cacheKey)!
      const age = Date.now() - (cached.testResult?.timestamp.getTime() || 0)
      if (age < 24 * 60 * 60 * 1000) {
        // 緩存有效，直接返回結果
        onConnectionResult(
          cached.testResult?.connected || false,
          cached.testResult?.responseTime || 0,
          cached.testResult?.error
        )
        onThinkingResult(cached)
        return
      }
    }
    
    const apiType = this.getAPIType(provider, modelId)
    const startTime = Date.now()
    
    try {
      // 第一階段：快速連接測試
      const basicResult = await this.testBasicConnection(provider, modelId)
      const connectionTime = Date.now() - startTime
      
      onConnectionResult(basicResult.connected, connectionTime, basicResult.error)
      
      if (!basicResult.connected) {
        const failedCapabilities = this.createFailedCapabilities(basicResult, apiType)
        onThinkingResult(failedCapabilities)
        this.testCache.set(cacheKey, failedCapabilities)
        return
      }
      
      // 第二階段：異步思考能力測試（不阻塞UI）
      setTimeout(async () => {
        try {
          const thinkingResult = await this.testThinkingCapability(provider, modelId, apiType, basicResult.preferStream)
          
          const finalCapabilities: ModelCapabilities = {
            reasoning: thinkingResult.reasoning,
            reasoningType: thinkingResult.reasoningType,
            supportedParams: thinkingResult.supportedParams,
            testResult: {
              connected: true,
              reasoning: thinkingResult.reasoning,
              responseTime: connectionTime,
              timestamp: new Date()
            }
          }
          
          // 緩存並回調最終結果
          this.testCache.set(cacheKey, finalCapabilities)
          onThinkingResult(finalCapabilities)
        } catch (thinkingError) {
          // 思考測試失敗，但連接是成功的
          const partialCapabilities: ModelCapabilities = {
            reasoning: false,
            reasoningType: null,
            supportedParams: this.getDefaultCapabilities(apiType).supportedParams,
            testResult: {
              connected: true,
              reasoning: false,
              responseTime: connectionTime,
              timestamp: new Date()
            }
          }
          
          this.testCache.set(cacheKey, partialCapabilities)
          onThinkingResult(partialCapabilities)
        }
      }, 100) // 短暫延遲，讓UI先更新連接狀態
      
    } catch (error) {
      const failedResult = {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      }
      
      onConnectionResult(false, Date.now() - startTime, failedResult.error)
      
      const failedCapabilities = this.createFailedCapabilities(failedResult, apiType)
      onThinkingResult(failedCapabilities)
      this.testCache.set(cacheKey, failedCapabilities)
    }
  }

  private async performCapabilityTest(
    provider: ProviderConfig, 
    modelId: string
  ): Promise<ModelCapabilities> {
    const apiType = this.getAPIType(provider, modelId)
    const startTime = Date.now()
    
    try {
      // 1. 基礎連接測試
      const basicResult = await this.testBasicConnection(provider, modelId)
      if (!basicResult.connected) {
        return this.createFailedCapabilities(basicResult, apiType)
      }
      
      // 2. 思考能力測試
      const thinkingResult = await this.testThinkingCapability(provider, modelId, apiType, basicResult.preferStream)
      
      return {
        reasoning: thinkingResult.reasoning,
        reasoningType: thinkingResult.reasoningType,
        supportedParams: thinkingResult.supportedParams,
        testResult: {
          connected: true,
          reasoning: thinkingResult.reasoning,
          responseTime: Date.now() - startTime,
          timestamp: new Date()
        }
      }
    } catch (error) {
      return this.createFailedCapabilities({
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      }, apiType)
    }
  }

  private async testBasicConnection(
    provider: ProviderConfig, 
    modelId: string
  ): Promise<{ connected: boolean; preferStream?: boolean; error?: string }> {
    const testMessages: ChatMessage[] = [
      { role: 'user', content: 'Hi' }
    ]
    
    try {
      // 方法1：優先嚐試流式調用（現代AI API的主流方式）
      const streamResponse = await this.aiService.callAI(testMessages, provider, modelId, true)
      const streamConnected = Boolean(streamResponse && typeof streamResponse === 'string' && streamResponse.trim().length > 0)
      
      if (streamConnected) {
        return { connected: true, preferStream: true }
      }
    } catch (streamError) {
      console.log('流式測試失敗，嘗試非流式測試:', streamError)
    }
    
    try {
      // 方法2：回退到非流式調用
      const response = await this.aiService.callAI(testMessages, provider, modelId, false)
      const connected = Boolean(response && typeof response === 'string' && response.trim().length > 0)
      
      if (connected) {
        return { connected: true, preferStream: false }
      }
    } catch (nonStreamError) {
      return {
        connected: false,
        error: nonStreamError instanceof Error ? nonStreamError.message : String(nonStreamError)
      }
    }
    
    return { connected: false, error: '流式和非流式測試都失敗' }
  }

  private async testThinkingCapability(
    provider: ProviderConfig, 
    modelId: string, 
    apiType: string,
    preferStream?: boolean
  ): Promise<{
    reasoning: boolean
    reasoningType: ReasoningType | null
    supportedParams: SupportedParams
  }> {
    switch (apiType) {
      case 'openai':
        return await this.testOpenAIThinking(provider, modelId, preferStream)
      case 'google':
        return await this.testGeminiThinking(provider, modelId, preferStream)
      case 'anthropic':
        return await this.testClaudeThinking(provider, modelId, preferStream)
      default:
        return this.getDefaultCapabilities(apiType)
    }
  }

  private async testOpenAIThinking(
    provider: ProviderConfig, 
    modelId: string,
    preferStream?: boolean
  ): Promise<{
    reasoning: boolean
    reasoningType: ReasoningType | null
    supportedParams: SupportedParams
  }> {
    // 使用數學推理問題（業界最佳實踐）
    const testMessage: ChatMessage[] = [{
      role: 'user',
      content: '一家商店原價100元的商品，先打8折，再打9折，最終價格是多少？請詳細展示你的計算和推理過程。'
    }]
    
    try {
      // 檢測是否爲o1系列
      if (this.isO1Model(modelId)) {
        // o1系列模型的特殊檢測邏輯
        const response = await this.callOpenAIWithO1Params(provider, modelId, testMessage)
        return {
          reasoning: !!response.choices?.[0]?.message?.reasoning,
          reasoningType: 'openai-reasoning',
          supportedParams: {
            temperature: false,
            maxTokens: 'max_completion_tokens',
            streaming: false,
            systemMessage: true
          }
        }
      }
      
      // 常規OpenAI模型的思考能力測試
      const response = await this.callOpenAIWithThinkingInstructions(provider, modelId, testMessage, preferStream)
      const hasThinking = this.detectThinkingInResponse(response, 'openai')
      
      return {
        reasoning: hasThinking,
        reasoningType: hasThinking ? 'generic-cot' : null,
        supportedParams: {
          temperature: true,
          maxTokens: 'max_tokens',
          streaming: true,
          systemMessage: true
        }
      }
    } catch (error) {
      return this.getDefaultCapabilities('openai')
    }
  }

  private async testGeminiThinking(
    provider: ProviderConfig, 
    modelId: string,
    preferStream?: boolean
  ): Promise<{
    reasoning: boolean
    reasoningType: ReasoningType | null
    supportedParams: SupportedParams
  }> {
    // Gemini的思考能力檢測：通過API響應結構判斷是否支持thought字段
    const testMessage: ChatMessage[] = [{
      role: 'user',
      content: '請思考並回答：什麼是人工智能？'
    }]
    
    try {
      // 直接調用API，檢查原始響應結構
      const rawResponse = await this.callGeminiAPIRaw(provider, modelId, testMessage, preferStream)
      
      // 檢查響應中是否包含thought字段
      const hasThoughtField = this.detectGeminiThoughtField(rawResponse)
      
      // 如果沒有檢測到thought字段，通過模型名稱判斷是否爲支持thinking的版本
      let hasThinking = hasThoughtField
      if (!hasThoughtField) {
        hasThinking = this.isGeminiThinkingModel(modelId)
      }
      
      return {
        reasoning: hasThinking,
        reasoningType: hasThinking ? 'gemini-thought' : null,
        supportedParams: {
          temperature: true,
          maxTokens: 'max_tokens',
          streaming: true,
          systemMessage: true
        }
      }
    } catch (error) {
      return this.getDefaultCapabilities('google')
    }
  }

  private async testClaudeThinking(
    provider: ProviderConfig, 
    modelId: string,
    preferStream?: boolean
  ): Promise<{
    reasoning: boolean
    reasoningType: ReasoningType | null
    supportedParams: SupportedParams
  }> {
    // Claude的思考能力檢測：通過測試<thinking>標籤是否被支持
    const testMessage: ChatMessage[] = [{
      role: 'user',
      content: '請用<thinking>標籤展示你的思考過程，然後回答：什麼是AI？'
    }]
    
    try {
      const response = await this.aiService.callAI(testMessage, provider, modelId, preferStream || false)
      
      // Claude的思考能力判斷：檢查響應中是否包含<thinking>標籤
      const hasThinkingTags = typeof response === 'string' && 
                             (response.includes('<thinking>') && response.includes('</thinking>'))
      
      // 如果沒有thinking標籤，嘗試檢測是否是支持thinking的Claude模型
      let hasThinking = hasThinkingTags
      if (!hasThinkingTags) {
        // 某些Claude模型支持thinking但可能不會在簡單測試中使用
        // 通過模型名稱判斷是否爲支持thinking的版本
        hasThinking = this.isClaudeThinkingModel(modelId)
      }
      
      return {
        reasoning: hasThinking,
        reasoningType: hasThinking ? 'claude-thinking' : null,
        supportedParams: {
          temperature: true,
          maxTokens: 'max_tokens',
          streaming: true,
          systemMessage: true
        }
      }
    } catch (error) {
      return this.getDefaultCapabilities('anthropic')
    }
  }

  // 輔助方法
  private getAPIType(provider: ProviderConfig, modelId: string): string {
    const model = provider.models.find(m => m.id === modelId)
    return model?.apiType || provider.type
  }

  private isO1Model(modelId: string): boolean {
    return modelId.toLowerCase().includes('o1')
  }

  private isClaudeThinkingModel(modelId: string): boolean {
    const modelName = modelId.toLowerCase()
    // Claude 3.5以上版本通常支持thinking標籤
    return modelName.includes('claude-3.5') || 
           modelName.includes('claude-4') ||
           modelName.includes('sonnet') ||
           modelName.includes('opus')
  }

  private isGeminiThinkingModel(modelId: string): boolean {
    const modelName = modelId.toLowerCase()
    // Gemini 2.0以上版本支持thought字段
    return modelName.includes('gemini-2.') || 
           modelName.includes('gemini-pro') ||
           modelName.includes('thinking') ||
           modelName.includes('exp')
  }

  private detectGeminiThoughtField(response: any): boolean {
    try {
      // 如果響應是字符串，嘗試解析爲JSON
      if (typeof response === 'string') {
        try {
          response = JSON.parse(response)
        } catch {
          return false
        }
      }

      // 檢查Gemini API響應結構中的thought字段
      if (response && response.candidates && Array.isArray(response.candidates)) {
        for (const candidate of response.candidates) {
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.thought) {
                return true
              }
            }
          }
        }
      }

      return false
    } catch {
      return false
    }
  }

  private detectThinkingInResponse(response: any, apiType: string): boolean {
    if (typeof response !== 'string') {
      return false
    }
    
    const responseText = response.toLowerCase()
    
    switch (apiType) {
      case 'openai':
        return this.detectOpenAIThinking(response)
      case 'google':
        return responseText.includes('思考') || responseText.includes('分析') || responseText.includes('reasoning') || 
               this.hasStructuredThinking(response)
      case 'anthropic':
        return responseText.includes('<thinking>') || responseText.includes('讓我思考') || 
               responseText.includes('分析') || this.hasStructuredThinking(response)
      default:
        return false
    }
  }

  private detectOpenAIThinking(response: string): boolean {
    const responseText = response.toLowerCase()
    
    // 思考過程指示詞（基於最佳實踐）
    const thinkingIndicators = [
      // 直接思考標記
      '<thinking>', 'thinking:', '思考：', '分析：', '推理：',
      
      // 步驟性詞彙  
      '首先', '然後', '接着', '最後', '第一步', '第二步', '第三步',
      'step 1', 'step 2', 'step 3', '步驟1', '步驟2',
      
      // 計算過程詞彙
      '計算', '計算過程', '解題', '推導', '驗證',
      '原價', '打折', '折扣', '最終價格',
      
      // 分析性詞彙
      '讓我', '我需要', '我們來', '分析一下', '考慮到',
      '因此', '所以', '由此可見', '可以得出',
      
      // 推理過程
      '根據', '基於', '考慮', '假設', '如果', '那麼'
    ]
    
    // 計算匹配的指示詞數量
    const indicatorCount = thinkingIndicators.filter(indicator => 
      responseText.includes(indicator)
    ).length
    
    // 檢查是否有結構化思考
    const hasStructure = this.hasStructuredThinking(response)
    
    // 檢查是否有數學計算過程
    const hasMathProcess = this.hasMathematicalReasoning(response)
    
    // 綜合判斷：
    // 1. 至少2個思考指示詞 + 結構化思維
    // 2. 至少3個思考指示詞（即使沒有明顯結構）
    // 3. 有明確的數學推理過程
    // 4. 有thinking標籤或明確的分析過程
    return (indicatorCount >= 2 && hasStructure) || 
           (indicatorCount >= 3) ||
           hasMathProcess ||
           responseText.includes('<thinking>') ||
           responseText.includes('分析過程')
  }

  private hasStructuredThinking(response: string): boolean {
    // 檢查是否有編號列表 (1. 2. 3. 或 一、二、三、或 步驟1、步驟2)
    const hasNumberedList = /[1-9]\.|[一二三四五]\s*、|步驟\s*[1-9]/.test(response)
    
    // 檢查是否有多段落結構（超過2個換行）
    const paragraphCount = response.split('\n').filter(line => line.trim().length > 0).length
    const hasMultipleParagraphs = paragraphCount > 2
    
    // 檢查邏輯連接詞密度
    const logicalWords = ['因爲', '所以', '然而', '但是', '因此', '由於', '由此', '可見']
    const logicalWordCount = logicalWords.filter(word => response.includes(word)).length
    
    return hasNumberedList || (hasMultipleParagraphs && logicalWordCount >= 2)
  }

  private hasMathematicalReasoning(response: string): boolean {
    // 檢查是否包含數學計算過程
    const mathPatterns = [
      /\d+\s*[×*]\s*\d+/,           // 乘法：100 × 0.8
      /\d+\s*[÷/]\s*\d+/,           // 除法：100 ÷ 2  
      /\d+\s*[+]\s*\d+/,            // 加法：80 + 20
      /\d+\s*[-]\s*\d+/,            // 減法：100 - 20
      /=\s*\d+/,                    // 等號結果：= 72
      /0\.\d+/,                     // 小數：0.8, 0.9
      /\d+%/,                       // 百分比：80%
      /打.*折/,                     // 打折：打8折
      /折扣/,                       // 折扣詞彙
    ]
    
    return mathPatterns.some(pattern => pattern.test(response))
  }

  private getDefaultCapabilities(apiType: string): {
    reasoning: boolean
    reasoningType: ReasoningType | null
    supportedParams: SupportedParams
  } {
    const defaultParams: SupportedParams = {
      temperature: true,
      maxTokens: 'max_tokens',
      streaming: true,
      systemMessage: true
    }

    if (apiType === 'openai') {
      return {
        reasoning: false,
        reasoningType: null,
        supportedParams: { ...defaultParams }
      }
    } else if (apiType === 'google') {
      return {
        reasoning: false,
        reasoningType: null,
        supportedParams: { ...defaultParams }
      }
    } else if (apiType === 'anthropic') {
      return {
        reasoning: false,
        reasoningType: null,
        supportedParams: { ...defaultParams }
      }
    }

    return {
      reasoning: false,
      reasoningType: null,
      supportedParams: defaultParams
    }
  }

  private createFailedCapabilities(
    basicResult: { connected: boolean; error?: string }, 
    apiType: string
  ): ModelCapabilities {
    return {
      reasoning: false,
      reasoningType: null,
      supportedParams: this.getDefaultCapabilities(apiType).supportedParams,
      testResult: {
        connected: basicResult.connected,
        reasoning: false,
        responseTime: 0,
        error: basicResult.error,
        timestamp: new Date()
      }
    }
  }

  // OpenAI o1系列模型的特殊調用方法
  private async callOpenAIWithO1Params(
    provider: ProviderConfig, 
    modelId: string, 
    messages: ChatMessage[]
  ): Promise<any> {
    // 直接調用OpenAI API以檢測o1系列的reasoning字段
    try {
      if (!provider.baseUrl) {
        throw new Error('API URL 未配置')
      }
      
      let apiUrl = provider.baseUrl.trim()
      if (apiUrl.includes('/chat/completions')) {
        // 已經是完整URL，直接使用
      } else if (apiUrl.includes('/v1')) {
        apiUrl = apiUrl.replace(/\/+$/, '') + '/chat/completions'
      } else {
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
          max_completion_tokens: 100 // o1系列使用max_completion_tokens
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  private async callOpenAIWithThinkingInstructions(
    provider: ProviderConfig, 
    modelId: string, 
    messages: ChatMessage[],
    preferStream?: boolean
  ): Promise<any> {
    // 使用最佳實踐的思考指令
    const enhancedMessages: ChatMessage[] = [
      { 
        role: 'system', 
        content: '請在回答問題時展示你的完整思考過程。包括：1）分析問題 2）制定解決步驟 3）執行計算或推理 4）驗證答案。請明確標出每個步驟。'
      },
      ...messages
    ]
    return await this.aiService.callAI(enhancedMessages, provider, modelId, preferStream || false)
  }


  private async callGeminiAPIRaw(
    provider: ProviderConfig, 
    modelId: string, 
    messages: ChatMessage[],
    _preferStream?: boolean
  ): Promise<any> {
    // 直接調用Gemini API以獲取原始響應結構
    try {
      // 構建Gemini API URL
      if (!provider.baseUrl) {
        throw new Error('API URL 未配置')
      }
      let apiUrl = provider.baseUrl.trim()
      
      // 確保以/v1beta結尾，然後拼接模型路徑
      if (!apiUrl.endsWith('/v1beta')) {
        if (apiUrl.includes('/models/')) {
          apiUrl = apiUrl.split('/models/')[0]
        }
        if (!apiUrl.endsWith('/v1beta')) {
          apiUrl = apiUrl.replace(/\/+$/, '') + '/v1beta'
        }
      }
      
      // 拼接模型特定路徑
      apiUrl = `${apiUrl}/models/${modelId}:generateContent`
      
      // 添加API key參數
      const url = new URL(apiUrl)
      url.searchParams.set('key', provider.apiKey)
      
      // 轉換消息格式
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))

      const requestBody = {
        contents,
        generationConfig: {
          temperature: 0.7
        }
      }

      const response = await fetch(url.function toString() { [native code] }(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }


  // 清理緩存
  public clearCache(): void {
    this.testCache.clear()
  }

  // 獲取緩存統計
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.testCache.size,
      keys: Array.from(this.testCache.keys())
    }
  }
}